"""
Phase 5b step 3: Recipe Engine list formatter (#162 Layer 2).

Input (from Step Functions, after `5b.2. Enumerate country_a_ids` Athena state):
    event = {
        "country_count_query_id": "abc-123-def",
        "cutoff_year": null | int,
        "run_id": "recipe-158-fix-..."
    }

The upstream Athena query is expected to be:
    SELECT country_a_id, count(*) AS pc
    FROM qgi_data.patterns
    WHERE country_a_id IS NOT NULL
    GROUP BY country_a_id
    ORDER BY pc ASC;

This Lambda:

1. Calls athena.get_query_results on country_count_query_id to read the
   sorted (country_a_id, pattern_count) list.
2. Picks the SMALLEST country (by pattern count) as the seed for the CTAS.
   This guarantees the SF-driven seed query is fast regardless of how
   country IDs are encoded. Guards against the #162 blocker where the
   naive "lowest integer ID" pick could land on a huge country and burn
   the 15-min Lambda ceiling on the seed step.
3. Pre-generates ALL per-country SQL strings in Python:
     - `seed_sql`: CTAS for the smallest-count country (creates table + first partition)
     - `insert_items`: list of {country_a_id, insert_sql, drop_partition_sql}
       for every OTHER country, each with the partition-filter WHERE clause
       bound in as a Python string (NO States.Format in ASL — avoids SQL
       escape footguns).
4. Returns a structured payload for the Step Function to dispatch:
     - seed_country_id, seed_sql (for the 5b.4 sequential seed state)
     - insert_items (for the 5b.5 Map state)
     - partitions_total

Doing Step 3 here (in Python) rather than in ASL `States.Format()` avoids
the #162 review issue 4: SQL escape hazards when any literal in the
INSERT query body contains quotes, percent signs, or backslashes.

This Lambda does NO Athena execution itself. Total wall time budget < 10s.
"""

import os
import json
import logging
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ATHENA_DB = os.environ.get('ATHENA_DATABASE', 'qgi_data')

athena = boto3.client('athena')


def lambda_handler(event, context):
    run_id = event.get('run_id', 'manual')
    cutoff_year = event.get('cutoff_year')
    query_id = event.get('country_count_query_id')

    if not query_id:
        raise ValueError(
            "country_count_query_id missing from event. Expected this Lambda "
            "to be chained after the '5b.2. Enumerate country_a_ids' Athena "
            "state which publishes QueryExecution.QueryExecutionId."
        )

    logger.info(
        f"Recipe engine list formatter starting. run_id={run_id}, "
        f"cutoff_year={cutoff_year}, upstream query_id={query_id}"
    )

    # Step 1: fetch the country_a_id, pattern_count list from Athena
    country_counts = _fetch_country_counts(query_id)
    if not country_counts:
        raise RuntimeError(
            "No country_a_id values returned from the upstream query. "
            "Phase 4 must have failed to populate the patterns table, or "
            "the upstream query is malformed."
        )

    logger.info(
        f"Fetched {len(country_counts)} country_a_id values. "
        f"Smallest: country_a_id={country_counts[0][0]} "
        f"({country_counts[0][1]} patterns). "
        f"Largest: country_a_id={country_counts[-1][0]} "
        f"({country_counts[-1][1]} patterns)."
    )

    # Step 2: seed = smallest country (by pattern count, asc order)
    seed_country_id, seed_count = country_counts[0]
    seed_sql = build_recipe_query(cutoff_year, seed_country_id, mode='ctas')

    # Step 3: pre-generate per-country INSERT + DROP PARTITION SQL for the
    # remaining countries. Each item carries both statements so the Map
    # state's inner state machine can run them in order without any
    # in-ASL string construction.
    insert_items = []
    for cid, count in country_counts[1:]:
        insert_items.append({
            'country_a_id': cid,
            'pattern_count': count,
            'drop_partition_sql': (
                f"ALTER TABLE {ATHENA_DB}.recipes "
                f"DROP IF EXISTS PARTITION (country_a_id = {int(cid)})"
            ),
            'insert_sql': build_recipe_query(
                cutoff_year, cid, mode='insert',
            ),
        })

    logger.info(
        f"Generated seed CTAS for country_a_id={seed_country_id} "
        f"({len(seed_sql)} chars) and {len(insert_items)} per-country "
        f"INSERT statements."
    )

    return {
        'statusCode': 200,
        'run_id': run_id,
        'cutoff_year': cutoff_year,
        'seed_country_id': seed_country_id,
        'seed_pattern_count': seed_count,
        'seed_sql': seed_sql,
        'insert_items': insert_items,
        'partitions_total': len(country_counts),
    }


def _fetch_country_counts(query_id):
    """Page through Athena query results to build [(country_a_id, count), ...]
    sorted ASC by count (the upstream query already orders this way).
    """
    rows = []
    headers_seen = False
    next_token = None
    while True:
        kwargs = {'QueryExecutionId': query_id}
        if next_token:
            kwargs['NextToken'] = next_token
        result = athena.get_query_results(**kwargs)
        result_rows = result['ResultSet']['Rows']
        if not headers_seen:
            # first row is the header
            result_rows = result_rows[1:]
            headers_seen = True
        for row in result_rows:
            cells = row.get('Data', [])
            if len(cells) < 2:
                continue
            raw_id = cells[0].get('VarCharValue')
            raw_cnt = cells[1].get('VarCharValue')
            if raw_id is None or raw_cnt is None:
                continue
            try:
                rows.append((int(raw_id), int(raw_cnt)))
            except ValueError:
                logger.warning(
                    f"Skipping non-integer row: id={raw_id!r} cnt={raw_cnt!r}"
                )
        next_token = result.get('NextToken')
        if not next_token:
            break
    return rows


def build_recipe_query(cutoff_year=None, country_a_id=None, mode='ctas'):
    """Build the per-country recipe SQL — CTAS for the seed, INSERT for the rest.

    MUST produce the same column list and semantics across both modes, so
    the #163 schema-contract test (recipes CTAS ↔ INSERT column alignment)
    passes. The SELECT body is identical; only the outer wrapper differs.

    Parameters
    ----------
    cutoff_year : int or None
        Optional backtesting cutoff. Adds AND filters on p.start_year_* and
        event.year.
    country_a_id : int
        MANDATORY partition filter. Every per-country query (both seed CTAS
        and per-country INSERT) filters `p.country_a_id = N` so Athena
        prunes the patterns scan to exactly one partition (~200 MB vs the
        full 43 GB table).
    mode : 'ctas' | 'insert'
        'ctas' wraps the SELECT in `CREATE TABLE qgi_data.recipes WITH (...) AS`
        to create the table + first partition on the seed run.
        'insert' wraps it in `INSERT INTO qgi_data.recipes` for every other
        per-country Map iteration.
    """
    if country_a_id is None:
        raise ValueError(
            "country_a_id is mandatory for build_recipe_query in Layer 2. "
            "Unfiltered CTAS was the 43 GB full-scan bug fixed in #158 Layer 1."
        )

    pattern_filters = [f"p.country_a_id = {int(country_a_id)}"]
    event_filter_a = ""
    event_filter_b = ""
    if cutoff_year:
        pattern_filters.append(
            f"(p.start_year_a + p.length) <= {cutoff_year} "
            f"AND (p.start_year_b + p.length) <= {cutoff_year}"
        )
        event_filter_a = f"AND ea.year <= {cutoff_year}"
        event_filter_b = f"AND eb.year <= {cutoff_year}"

    pattern_where = "WHERE " + " AND ".join(f"({f})" for f in pattern_filters)

    select_body = f"""
    WITH raw_recipes AS (
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
            p.pattern_power_score,
            COALESCE(
                p.pattern_tier,
                CASE
                    WHEN p.length BETWEEN 3 AND 8  THEN 'S'
                    WHEN p.length BETWEEN 9 AND 20 THEN 'M'
                    WHEN p.length BETWEEN 21 AND 40 THEN 'L'
                    ELSE 'XL'
                END
            ) AS pattern_tier
        FROM {ATHENA_DB}.patterns p
        INNER JOIN {ATHENA_DB}.events ea
            ON ea.country_id = p.country_a_id
            AND ea.year BETWEEN
                (p.start_year_a + p.length - greatest(1, cast(ceil(p.length * 0.15) as integer)))
                AND
                (p.start_year_a + p.length + greatest(1, cast(ceil(p.length * 0.15) as integer)))
            {event_filter_a}
        INNER JOIN {ATHENA_DB}.events eb
            ON eb.country_id = p.country_b_id
            AND eb.category_normalized = ea.category_normalized
            AND eb.year BETWEEN
                (p.start_year_b + p.length - greatest(1, cast(ceil(p.length * 0.15) as integer)))
                AND
                (p.start_year_b + p.length + greatest(1, cast(ceil(p.length * 0.15) as integer)))
            {event_filter_b}
        LEFT JOIN {ATHENA_DB}.countries ca ON cast(ca.id as integer) = p.country_a_id
        LEFT JOIN {ATHENA_DB}.countries cb ON cast(cb.id as integer) = p.country_b_id
        {pattern_where}
    ),
    recipes_aggregated AS (
        SELECT
            recipe_id,
            arbitrary(event_category)        AS event_category,
            arbitrary(pattern_id)            AS pattern_id,
            arbitrary(country_b_id)          AS country_b_id,
            arbitrary(country_a_name)        AS country_a_name,
            arbitrary(country_b_name)        AS country_b_name,
            arbitrary(start_year_a)          AS start_year_a,
            arbitrary(start_year_b)          AS start_year_b,
            arbitrary(length)                AS length,
            arbitrary(avg_correlation)       AS avg_correlation,
            arbitrary(end_year_a)            AS end_year_a,
            arbitrary(end_year_b)            AS end_year_b,
            arbitrary(event_window)          AS event_window,
            min(event_year_a)                AS event_year_a,
            min(event_year_b)                AS event_year_b,
            arbitrary(event_title_a)         AS event_title_a,
            arbitrary(event_title_b)         AS event_title_b,
            arbitrary(indicator_count)       AS indicator_count,
            arbitrary(pattern_power_score)   AS pattern_power_score,
            arbitrary(pattern_tier)          AS pattern_tier,
            cast(count(*) as bigint)         AS instance_count,
            cast(approx_percentile(cast(event_year_b - end_year_b as double), 0.5) as smallint)
                AS median_lead_time_b,
            cast(min(event_year_b - end_year_b) as smallint) AS min_lead_time_b,
            cast(max(event_year_b - end_year_b) as smallint) AS max_lead_time_b,
            cast(approx_percentile(cast(event_year_a - end_year_a as double), 0.5) as smallint)
                AS median_lead_time_a,
            country_a_id
        FROM raw_recipes
        GROUP BY recipe_id, country_a_id
    ),
    global_stats AS (
        SELECT
            cast(max(instance_count) as double)  AS max_inst,
            cast(max(indicator_count) as double) AS max_ind
        FROM recipes_aggregated
    )
    SELECT
        r.recipe_id,
        r.event_category,
        r.pattern_id,
        r.country_b_id,
        r.country_a_name,
        r.country_b_name,
        r.start_year_a,
        r.start_year_b,
        r.length,
        r.avg_correlation,
        r.end_year_a,
        r.end_year_b,
        r.event_window,
        r.event_year_a,
        r.event_year_b,
        r.event_title_a,
        r.event_title_b,
        r.indicator_count,
        r.pattern_power_score,
        r.instance_count,
        r.pattern_tier,
        r.median_lead_time_b,
        r.min_lead_time_b,
        r.max_lead_time_b,
        r.median_lead_time_a,
        cast(
            (
                0.35 * r.avg_correlation
                + 0.30 * (ln(cast(r.instance_count as double) + 1.0)
                          / nullif(ln(g.max_inst + 1.0), 0.0))
                + 0.20 * (ln(cast(r.indicator_count as double) + 1.0)
                          / nullif(ln(g.max_ind + 1.0), 0.0))
                + 0.15 * (1.0 / (1.0 + 0.05 * greatest(0, cast(r.length as double) - 10.0)))
            ) * 100.0
            AS double
        ) AS pps,
        -- Partition column MUST be last (Athena CTAS requirement, #145)
        r.country_a_id
    FROM recipes_aggregated r
    CROSS JOIN global_stats g
    """

    if mode == 'ctas':
        return f"""
        CREATE TABLE {ATHENA_DB}.recipes
        WITH (
            format = 'PARQUET',
            write_compression = 'SNAPPY',
            partitioned_by = ARRAY['country_a_id']
        ) AS
        {select_body}
        """.strip()
    elif mode == 'insert':
        return f"INSERT INTO {ATHENA_DB}.recipes\n{select_body}".strip()
    else:
        raise ValueError(f"Unknown build_recipe_query mode: {mode!r}")
