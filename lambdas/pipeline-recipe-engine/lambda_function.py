"""
Phase 5: Recipe Engine — matches patterns against events to create recipes.

Uses pure Athena SQL (CTAS) to JOIN patterns with events, applying:
- D4: event window = max(1, ceil(length * 0.15))
- D5: both countries must match the same event category

Supports optional cutoff_year for backtesting (D12/D13/D14).

Reads: qgi_data.patterns + qgi_data.events (via Athena)
Writes:
- s3://{bucket}/recipes/ (Parquet via CTAS)
- s3://{bucket}/dashboard/{ranking,early-warning,recipes-top50}.json
  Pre-computed dashboard JSON to eliminate per-request Athena cost (#146)
"""

import os
import json
import time
import logging
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get('S3_BUCKET')
ATHENA_DB = os.environ.get('ATHENA_DATABASE', 'qgi_data')
ATHENA_WG = os.environ.get('ATHENA_WORKGROUP', 'QGI-Lambda-Workgroup')
S3_OUTPUT = os.environ.get('S3_OUTPUT_LOCATION', f's3://{S3_BUCKET}/query_results/')
RECIPES_PREFIX = 'recipes'
DASHBOARD_PREFIX = 'dashboard'
RANKING_LIMIT = 1000  # pre-compute top 1000 unfiltered patterns; route falls back to Athena for filtered requests

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

    # 6. Pre-compute dashboard JSONs (#146)
    # Eliminates per-request Athena cost for the three biggest frontend queries.
    # Skip on backtesting runs (cutoff_year set) — only the canonical run should publish.
    dashboard_results = {}
    if cutoff_year is None:
        try:
            dashboard_results = write_dashboard_jsons()
            logger.info(f"Dashboard JSONs written: {dashboard_results}")
        except Exception as exc:  # noqa: BLE001
            # Pre-compute is best-effort; do not fail the whole pipeline if dashboard
            # writes break. The frontend routes still have Athena fallbacks.
            logger.exception(f"Failed to write dashboard JSONs: {exc}")
            dashboard_results = {'error': str(exc)}

    return {
        'statusCode': 200,
        'recipes_count': int(count),
        'top_categories': top_categories,
        'dashboard': dashboard_results,
    }


# ---------------------------------------------------------------------------
# Dashboard JSON pre-compute (#146)
# ---------------------------------------------------------------------------

def write_dashboard_jsons():
    """Run the three frontend dashboard queries and write results to S3 as JSON.

    Mirrors the SQL in qgi-frontend:
    - app/api/patterns/ranking/route.ts
    - app/api/patterns/early-warning/route.ts
    - app/api/recipes/top50/route.ts

    Frontend routes will GET these S3 objects instead of running Athena queries.
    """
    current_year = datetime.now(timezone.utc).year
    written = {}

    written['ranking'] = _write_ranking_json()
    written['early_warning'] = _write_early_warning_json(current_year)
    written['recipes_top50'] = _write_recipes_top50_json(current_year)

    return written


def _write_ranking_json():
    """Top 1000 unfiltered patterns by pattern_power_score."""
    # #128: include pattern_tier (with length-derived fallback for legacy rows)
    sql = f"""
    WITH c AS (
        SELECT id, MAX(name_1) AS name FROM qgi_data.countries WHERE name_1 != '' GROUP BY id
    )
    SELECT * FROM (
        SELECT ca.name AS country_a, cb.name AS country_b,
               p.start_year_a, p.start_year_b, p.length AS pattern_length,
               p.indicator_count AS num_indexes, p.avg_correlation, p.pattern_power_score,
               CAST(p.country_a_id AS VARCHAR) AS country_a_id,
               CAST(p.country_b_id AS VARCHAR) AS country_b_id,
               COALESCE(p.pattern_tier,
                   CASE
                       WHEN p.length BETWEEN 3 AND 8  THEN 'S'
                       WHEN p.length BETWEEN 9 AND 20 THEN 'M'
                       WHEN p.length BETWEEN 21 AND 40 THEN 'L'
                       ELSE 'XL'
                   END) AS pattern_tier,
               ROW_NUMBER() OVER (ORDER BY p.pattern_power_score DESC) AS rn
        FROM qgi_data.patterns p
        LEFT JOIN c ca ON ca.id = CAST(p.country_a_id AS VARCHAR)
        LEFT JOIN c cb ON cb.id = CAST(p.country_b_id AS VARCHAR)
    ) t
    WHERE rn <= {RANKING_LIMIT}
    ORDER BY rn
    """
    rows = _run_query_to_rows(sql)
    results = [
        {
            'country_a': r.get('country_a') or r.get('country_a_id'),
            'country_b': r.get('country_b') or r.get('country_b_id'),
            'country_a_id': r.get('country_a_id'),
            'country_b_id': r.get('country_b_id'),
            'start_year_a': _to_int(r.get('start_year_a')),
            'start_year_b': _to_int(r.get('start_year_b')),
            'pattern_length': _to_int(r.get('pattern_length')),
            'avg_correlation': _to_float(r.get('avg_correlation')),
            'pattern_power_score': _to_float(r.get('pattern_power_score')),
            'num_indexes': _to_int(r.get('num_indexes')),
            'pattern_tier': r.get('pattern_tier'),
            'predicted': False,
        }
        for r in rows
    ]
    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'limit': RANKING_LIMIT,
        'results': results,
    }
    _put_dashboard_json('ranking.json', payload)
    return len(results)


def _write_early_warning_json(current_year):
    """B-leads-A patterns ending in (now-2)..future, sorted by PPS desc, capped 500."""
    # #128: include pattern_tier (with length-derived fallback for legacy rows)
    sql = f"""
    WITH c AS (
        SELECT id, MAX(name_1) AS name FROM qgi_data.countries WHERE name_1 != '' GROUP BY id
    )
    SELECT ca.name AS country_a, cb.name AS country_b,
           p.start_year_a, p.start_year_b, p.length AS pattern_length,
           p.avg_correlation, p.pattern_power_score,
           p.indicator_count AS num_indexes,
           COALESCE(p.pattern_tier,
               CASE
                   WHEN p.length BETWEEN 3 AND 8  THEN 'S'
                   WHEN p.length BETWEEN 9 AND 20 THEN 'M'
                   WHEN p.length BETWEEN 21 AND 40 THEN 'L'
                   ELSE 'XL'
               END) AS pattern_tier
    FROM qgi_data.patterns p
    LEFT JOIN c ca ON ca.id = CAST(p.country_a_id AS VARCHAR)
    LEFT JOIN c cb ON cb.id = CAST(p.country_b_id AS VARCHAR)
    WHERE p.start_year_b < p.start_year_a
      AND (p.start_year_a + p.length) >= {current_year - 2}
    ORDER BY p.pattern_power_score DESC
    LIMIT 500
    """
    rows = _run_query_to_rows(sql)
    results = [
        {
            **r,
            'avg_correlation': _to_float(r.get('avg_correlation')),
            'pattern_power_score': _to_float(r.get('pattern_power_score')),
            'num_indexes': _to_int(r.get('num_indexes')),
        }
        for r in rows
    ]
    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'as_of_year': current_year,
        'results': results,
    }
    _put_dashboard_json('early-warning.json', payload)
    return len(results)


def _write_recipes_top50_json(current_year):
    """Deduped + diversity-capped top-50 recipes."""
    sql = f"""
    WITH deduped AS (
        SELECT
            recipe_id,
            MAX(event_category) AS event_category,
            MAX(country_a_id) AS country_a_id,
            MAX(country_b_id) AS country_b_id,
            MAX(country_a_name) AS country_a_name,
            MAX(country_b_name) AS country_b_name,
            MAX(start_year_a) AS start_year_a,
            MAX(start_year_b) AS start_year_b,
            MAX(length) AS length,
            MAX(avg_correlation) AS avg_correlation,
            MAX(end_year_a) AS end_year_a,
            MAX(end_year_b) AS end_year_b,
            MAX(event_window) AS event_window,
            MAX(event_year_a) AS event_year_a,
            MAX(event_year_b) AS event_year_b,
            MAX(event_title_a) AS event_title_a,
            MAX(event_title_b) AS event_title_b,
            MAX(indicator_count) AS indicator_count,
            MAX(pattern_power_score) AS pattern_power_score,
            MAX(pattern_tier) AS pattern_tier  -- #128
        FROM qgi_data.recipes
        WHERE start_year_b < start_year_a
          AND (start_year_a + length) >= {current_year - 2}
          AND (start_year_a + length) <= {current_year + 3}
        GROUP BY recipe_id
    ),
    ranked AS (
        SELECT d.*,
            ROW_NUMBER() OVER (PARTITION BY d.country_a_id ORDER BY d.pattern_power_score DESC) AS country_rank,
            ROW_NUMBER() OVER (PARTITION BY d.event_category ORDER BY d.pattern_power_score DESC) AS cat_rank
        FROM deduped d
    )
    SELECT * FROM ranked
    WHERE country_rank <= 3 AND cat_rank <= 10
    ORDER BY pattern_power_score DESC
    LIMIT 50
    """
    rows = _run_query_to_rows(sql)
    results = [
        {
            'recipe_id': r.get('recipe_id'),
            'event_category': r.get('event_category'),
            'country_a_id': _to_int(r.get('country_a_id')),
            'country_b_id': _to_int(r.get('country_b_id')),
            'country_a_name': r.get('country_a_name') or f"Country {r.get('country_a_id')}",
            'country_b_name': r.get('country_b_name') or f"Country {r.get('country_b_id')}",
            'start_year_a': _to_int(r.get('start_year_a')),
            'start_year_b': _to_int(r.get('start_year_b')),
            'length': _to_int(r.get('length')),
            'avg_correlation': _to_float(r.get('avg_correlation')),
            'end_year_a': _to_int(r.get('end_year_a')),
            'end_year_b': _to_int(r.get('end_year_b')),
            'event_window': _to_int(r.get('event_window')),
            'event_year_a': _to_int(r.get('event_year_a')),
            'event_year_b': _to_int(r.get('event_year_b')),
            'event_title_a': r.get('event_title_a'),
            'event_title_b': r.get('event_title_b'),
            'indicator_count': _to_int(r.get('indicator_count')),
            'pattern_power_score': _to_float(r.get('pattern_power_score')),
            'pattern_tier': r.get('pattern_tier'),  # #128
        }
        for r in rows
    ]
    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'as_of_year': current_year,
        'results': results,
    }
    _put_dashboard_json('recipes-top50.json', payload)
    return len(results)


def _put_dashboard_json(filename, payload):
    """Upload one dashboard JSON to S3 with sane cache headers."""
    body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f'{DASHBOARD_PREFIX}/{filename}',
        Body=body,
        ContentType='application/json',
        CacheControl='public, max-age=300, s-maxage=86400',
    )
    logger.info(f"Wrote s3://{S3_BUCKET}/{DASHBOARD_PREFIX}/{filename} ({len(body)} bytes)")


def _run_query_to_rows(sql):
    """Run an Athena query and return List[Dict[str,str]] (one dict per result row).

    Pages through results so queries returning >1000 rows still work.
    """
    query_id = run_query(sql)
    rows = []
    headers = None
    next_token = None
    while True:
        kwargs = {'QueryExecutionId': query_id}
        if next_token:
            kwargs['NextToken'] = next_token
        result = athena.get_query_results(**kwargs)
        result_rows = result['ResultSet']['Rows']
        if headers is None:
            headers = [col.get('VarCharValue', '') for col in result_rows[0]['Data']]
            data_rows = result_rows[1:]
        else:
            data_rows = result_rows
        for row in data_rows:
            cells = row.get('Data', [])
            rows.append({
                headers[i]: cells[i].get('VarCharValue', '') if i < len(cells) else ''
                for i in range(len(headers))
            })
        next_token = result.get('NextToken')
        if not next_token:
            break
    return rows


def _to_int(value):
    if value is None or value == '':
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _to_float(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_recipe_query(cutoff_year=None):
    """Build CTAS query that JOINs patterns with events using D4/D5 logic."""

    pattern_filter = ""
    event_filter = ""
    if cutoff_year:
        pattern_filter = f"WHERE (p.start_year_a + p.length) <= {cutoff_year} AND (p.start_year_b + p.length) <= {cutoff_year}"
        event_filter = f"AND e.year <= {cutoff_year}"

    # Athena CTAS partitioning rule (#145): the partition column(s) must be the
    # LAST column(s) in the SELECT list. country_a_id is moved to the very end
    # so that recipes is laid out as s3://{bucket}/recipes/country_a_id={N}/...
    # This makes country-filtered queries (recipes/country, dashboard top50, etc.)
    # scan ~0.5% of the table instead of 100%.
    return f"""
    CREATE TABLE qgi_data.recipes
    WITH (
        format = 'PARQUET',
        write_compression = 'SNAPPY',
        partitioned_by = ARRAY['country_a_id']
    ) AS

    SELECT
        concat(cast(p.country_a_id as varchar), '-',
               cast(p.country_b_id as varchar), '-',
               cast(p.start_year_a as varchar), '-',
               cast(p.length as varchar), '-',
               ea.category_normalized) as recipe_id,
        ea.category_normalized as event_category,
        p.pattern_id,
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
        p.pattern_power_score,
        -- #128: propagate the pattern length tier (S/M/L/XL) into recipes so
        -- per-tier backtesting (#130) and convergence scoring (#133) can read it
        -- without joining back to patterns. Falls back to a length-derived CASE
        -- for any rows in the legacy patterns table that pre-date #128.
        COALESCE(
            p.pattern_tier,
            CASE
                WHEN p.length BETWEEN 3 AND 8  THEN 'S'
                WHEN p.length BETWEEN 9 AND 20 THEN 'M'
                WHEN p.length BETWEEN 21 AND 40 THEN 'L'
                ELSE 'XL'
            END
        ) AS pattern_tier,
        -- Partition column MUST be last (Athena CTAS requirement)
        p.country_a_id
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
