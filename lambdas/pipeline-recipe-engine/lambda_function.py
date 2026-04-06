"""
Phase 5: Recipe Engine — matches patterns against events to create recipes.

Uses pure Athena SQL (CTAS) to JOIN patterns with events, applying:
- D4: event window = max(1, ceil(length * 0.15))
- D5: both countries must match the same event category

Supports optional cutoff_year for backtesting (D12/D13/D14).

Reads: qgi_data.patterns + qgi_data.events (via Athena)
Writes: s3://{bucket}/recipes/ (Parquet via CTAS)
"""

import os
import time
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get('S3_BUCKET')
ATHENA_DB = os.environ.get('ATHENA_DATABASE', 'qgi_data')
ATHENA_WG = os.environ.get('ATHENA_WORKGROUP', 'QGI-Lambda-Workgroup')
S3_OUTPUT = os.environ.get('S3_OUTPUT_LOCATION', f's3://{S3_BUCKET}/query_results/')
RECIPES_PREFIX = 'recipes'

athena = boto3.client('athena')
s3 = boto3.client('s3')


def lambda_handler(event, context):
    run_id = event.get('run_id', 'manual')
    cutoff_year = event.get('cutoff_year')

    logger.info(f"Recipe Engine starting. run_id={run_id}, cutoff_year={cutoff_year}")

    # 1. Clean old recipe output
    clean_recipes()

    # 2. Drop old recipes table if exists
    run_query("DROP TABLE IF EXISTS qgi_data.recipes;")

    # 3. Run CTAS to generate recipes
    ctas_query = build_recipe_query(cutoff_year)
    logger.info(f"Running CTAS query ({len(ctas_query)} chars)")
    query_id = run_query(ctas_query)

    # 4. Count results
    count_id = run_query("SELECT count(*) as cnt FROM qgi_data.recipes;")
    result = athena.get_query_results(QueryExecutionId=count_id)
    count = result['ResultSet']['Rows'][1]['Data'][0]['VarCharValue']
    logger.info(f"Generated {count} recipes.")

    # 5. Get category breakdown
    cat_id = run_query(
        "SELECT event_category, count(*) as cnt FROM qgi_data.recipes "
        "GROUP BY event_category ORDER BY cnt DESC LIMIT 20;"
    )
    cat_result = athena.get_query_results(QueryExecutionId=cat_id)
    top_categories = [
        f"{r['Data'][0]['VarCharValue']}: {r['Data'][1]['VarCharValue']}"
        for r in cat_result['ResultSet']['Rows'][1:6]
    ]
    logger.info(f"Top categories: {top_categories}")

    return {
        'statusCode': 200,
        'recipes_count': int(count),
        'top_categories': top_categories,
    }


def build_recipe_query(cutoff_year=None):
    """Build CTAS query that JOINs patterns with events using D4/D5 logic."""

    pattern_filter = ""
    event_filter = ""
    if cutoff_year:
        pattern_filter = f"WHERE (p.start_year_a + p.length) <= {cutoff_year} AND (p.start_year_b + p.length) <= {cutoff_year}"
        event_filter = f"AND e.year <= {cutoff_year}"

    return f"""
    CREATE TABLE qgi_data.recipes
    WITH (
        format = 'PARQUET',
        write_compression = 'SNAPPY'
    ) AS

    SELECT
        concat(cast(p.country_a_id as varchar), '-',
               cast(p.country_b_id as varchar), '-',
               cast(p.start_year_a as varchar), '-',
               cast(p.length as varchar), '-',
               ea.category_normalized) as recipe_id,
        ea.category_normalized as event_category,
        p.pattern_id,
        p.country_a_id,
        p.country_b_id,
        ca.name_1 as country_a_name,
        cb.name_1 as country_b_name,
        p.start_year_a,
        p.start_year_b,
        p.length,
        p.avg_correlation,
        cast(p.start_year_a + p.length as smallint) as end_year_a,
        cast(p.start_year_b + p.length as smallint) as end_year_b,
        cast(greatest(1, cast(ceil(p.length * 0.15) as integer)) as smallint) as event_window,
        ea.year as event_year_a,
        eb.year as event_year_b,
        ea.title as event_title_a,
        eb.title as event_title_b,
        p.indicator_count,
        p.pattern_power_score
    FROM
        qgi_data.patterns p
    -- Join events for country A within D4 window
    INNER JOIN qgi_data.events ea
        ON ea.country_id = p.country_a_id
        AND ea.year BETWEEN
            (p.start_year_a + p.length - greatest(1, cast(ceil(p.length * 0.15) as integer)))
            AND
            (p.start_year_a + p.length + greatest(1, cast(ceil(p.length * 0.15) as integer)))
        {event_filter}
    -- D5: Join events for country B with SAME category within D4 window
    INNER JOIN qgi_data.events eb
        ON eb.country_id = p.country_b_id
        AND eb.category_normalized = ea.category_normalized
        AND eb.year BETWEEN
            (p.start_year_b + p.length - greatest(1, cast(ceil(p.length * 0.15) as integer)))
            AND
            (p.start_year_b + p.length + greatest(1, cast(ceil(p.length * 0.15) as integer)))
        {event_filter}
    -- Resolve country names
    LEFT JOIN qgi_data.countries ca ON cast(ca.id as integer) = p.country_a_id
    LEFT JOIN qgi_data.countries cb ON cast(cb.id as integer) = p.country_b_id
    {pattern_filter}
    """


def clean_recipes():
    """Delete existing recipe files from S3."""
    logger.info("Cleaning old recipe output...")
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=f"{RECIPES_PREFIX}/"):
        objects = page.get('Contents', [])
        if objects:
            s3.delete_objects(
                Bucket=S3_BUCKET,
                Delete={'Objects': [{'Key': o['Key']} for o in objects]}
            )
    logger.info("Old recipes cleaned.")


def run_query(sql):
    """Execute Athena query and wait for completion. Returns query execution ID."""
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={'Database': ATHENA_DB},
        WorkGroup=ATHENA_WG,
    )
    query_id = response['QueryExecutionId']
    logger.info(f"Query {query_id}: started")

    while True:
        status = athena.get_query_execution(QueryExecutionId=query_id)
        state = status['QueryExecution']['Status']['State']
        if state in ('SUCCEEDED',):
            logger.info(f"Query {query_id}: SUCCEEDED")
            return query_id
        elif state in ('FAILED', 'CANCELLED'):
            reason = status['QueryExecution']['Status'].get('StateChangeReason', 'unknown')
            logger.error(f"Query {query_id}: {state} - {reason}")
            raise RuntimeError(f"Athena query {state}: {reason}")
        time.sleep(5)
