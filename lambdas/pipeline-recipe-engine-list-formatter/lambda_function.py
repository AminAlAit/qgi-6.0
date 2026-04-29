"""
Phase 5b step 3: Recipe Engine list formatter — chunked edition (#490 perma-fix).

Problem solved
--------------
India had 12,012,139 patterns (densest country post V-Dem) and hit Athena's
hard 30-minute DML timeout during the per-country INSERT. The fix splits each
per-country INSERT into sub-queries filtered by (event_category, pattern_tier),
reducing per-chunk row count to stay safely under the 30-min ceiling even after
adding ILO / Polity / WID (~250 indicators, ~5.8x pattern growth).

Chunking strategy
-----------------
Axes chosen: event_category × pattern_tier
  - event_category: 71 layer-3 values — natural join axis, already used as
    the GROUP BY key in recipes_aggregated; adding it as a WHERE prunes both
    the events JOIN and the aggregation.
  - pattern_tier: 4 values (S/M/L/XL) derived from pattern.length; already
    a column in patterns, zero-cost to filter.
  - Combined ceiling: 71 × 4 = 284 chunks per country.

At today's scale (104 indicators, India ~12M patterns):
  ~12,000,000 patterns / (actual event coverage × 4 tiers) → chunks well
  under Athena's 30-min ceiling per chunk.

At 250-indicator scale (pattern count scales as (250/104)² ≈ 5.8×, so India
→ ~70M patterns):
  70,000,000 / 284 ≈ 246,000 rows per chunk → very safe (≈ 30 sec).

Total query budget at 250 indicators:
  214 countries × ≤284 chunks = 60,776 max. In practice many (country,
  category, tier) combos produce zero rows and are pruned at enumerate time
  (the enumerate query returns only combos that actually exist in patterns),
  so real chunk count will be materially lower.

Output shape
------------
insert_items: list of {
    country_a_id: int,
    event_category: str,
    pattern_tier: str,
    chunk_id: str,           # "{country_a_id}_{event_category}_{pattern_tier}"
    pattern_count: int,
    drop_partition_sql: str, # same as before — DROP IF EXISTS PARTITION
    insert_sql: str,         # INSERT with AND ea.category_normalized = '...'
                             #            AND p.pattern_tier = '...'
}

The seed item is the chunk with the fewest patterns (ASC order from the
enumerate query), and it is emitted as a CTAS instead of INSERT so the
table + first partition are created atomically.

Backward-compatible fields
--------------------------
- drop_partition_sql: unchanged format, keyed on country_a_id only.  Two
  chunks for the same country will both try to DROP the same partition before
  inserting. Because the Map state runs them in parallel, the second DROP is
  idempotent (DROP IF EXISTS). The actual data-write conflict is avoided
  because each chunk inserts a disjoint slice of the partition's rows
  (Athena appends to the partition; partitioned_by=country_a_id means
  each country has exactly one partition, but Athena handles concurrent
  appends to the same partition safely within a single pipeline run).
- partitions_total: now = total chunks (not countries), used only for
  observability logging in 5b.6 Finalize.

#162 Layer 2 contract preserved
---------------------------------
- seed_sql returned in the top-level payload (consumed by SF 5b.4 state).
- insert_items written to S3 (consumed by SF 5b.5 ItemReader).
- drop_partition_sql + insert_sql are pre-baked strings (no States.Format).
"""

import os
import json
import time
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ATHENA_DB = os.environ.get('ATHENA_DATABASE', 'qgi_data')
ATHENA_WG = os.environ.get('ATHENA_WORKGROUP', 'QGI-Lambda-Workgroup')
S3_BUCKET = os.environ.get('S3_BUCKET', '')
S3_OUTPUT = os.environ.get('S3_OUTPUT_LOCATION', '')

# The 4 tier values exactly as written by pipeline-c-worker (#128).
# XL is the catch-all for length > 40.
PATTERN_TIERS = ('S', 'M', 'L', 'XL')

# ─── Smart-chunking thresholds (#533) ────────────────────────────────────────
# Per-country pattern_count buckets that decide chunking shape. Discovered
# 2026-04-29 in vdem-510-recipes-chunked-v3 SF run: uniform chunking emitted
# 15,031 chunks, ~80% from tiny countries that don't need fan-out at all.
#
# At ~10K patterns/min Athena throughput (extrapolated from India's 12M
# patterns / 30:38 timeout), each chunk should comfortably finish in <15min
# (50% safety margin under the 30-min DML wall). The boundaries below give
# each tier roughly that headroom at TODAY's scale (104 indicators); they
# scale through ~250 indicators before re-tuning.
#
# Tier 4 is reserved (decade-bucket axis) for countries whose (category, tier)
# slice itself exceeds the wall — currently no country does (India at 12M /
# 284 ≈ 42K patterns/chunk in Tier 3). Add a second enumerate query keyed on
# `start_year_a / 10` when a country first crosses the threshold.
TIER1_MAX_PATTERNS = 100_000     # below: single INSERT, no chunking
TIER2_MAX_PATTERNS = 1_000_000   # below: chunk by event_category only
TIER3_MAX_PATTERNS = 10_000_000  # below: chunk by (event_category, pattern_tier)
# Tier 4 above TIER3_MAX_PATTERNS: future axis (decade-bucket); for now Tier 4
# countries fall through to Tier 3 chunking with a warning logged.


def classify_country_tier(total_pattern_count: int) -> str:
    """Return 'tier1' / 'tier2' / 'tier3' / 'tier4' based on the country's
    total pattern count. See module-level threshold comments for rationale.
    """
    if total_pattern_count < TIER1_MAX_PATTERNS:
        return 'tier1'
    if total_pattern_count < TIER2_MAX_PATTERNS:
        return 'tier2'
    if total_pattern_count < TIER3_MAX_PATTERNS:
        return 'tier3'
    return 'tier4'

athena = boto3.client('athena')
s3 = boto3.client('s3')


def lambda_handler(event, context):
    run_id = event.get('run_id', 'manual')
    cutoff_year = event.get('cutoff_year')

    logger.info(
        f"Recipe engine list formatter (chunked) starting. "
        f"run_id={run_id}, cutoff_year={cutoff_year}"
    )

    # Step 1: enumerate (country_a_id, event_category, pattern_tier, count)
    # combos that actually exist. Sorted ASC by count so the smallest chunk
    # becomes the seed (keeps the CTAS fast regardless of country size).
    query_id = _run_enumerate_query(cutoff_year)

    # Step 2: fetch results
    chunks = _fetch_chunk_rows(query_id)
    if not chunks:
        raise RuntimeError(
            "No (country_a_id, event_category, pattern_tier) combos returned "
            "from the enumerate query. Phase 4 must have failed to populate "
            "the patterns table, or the upstream query is malformed."
        )

    # Step 2.5: aggregate per country, classify each country's tier, emit
    # adaptively-shaped chunks. See module-level threshold comments (#533).
    country_totals: dict[int, int] = {}
    for c in chunks:
        country_totals[c['country_a_id']] = (
            country_totals.get(c['country_a_id'], 0) + c['pattern_count']
        )
    country_tiers: dict[int, str] = {
        cid: classify_country_tier(total)
        for cid, total in country_totals.items()
    }
    tier_distribution = {
        t: sum(1 for tt in country_tiers.values() if tt == t)
        for t in ('tier1', 'tier2', 'tier3', 'tier4')
    }
    logger.info(
        f"Fetched {len(chunks)} (country, cat, tier) combos across "
        f"{len(country_totals)} countries. Tier distribution: {tier_distribution}. "
        f"Smallest combo: country_a_id={chunks[0]['country_a_id']} "
        f"cat={chunks[0]['event_category']} tier={chunks[0]['pattern_tier']} "
        f"({chunks[0]['pattern_count']} patterns). "
        f"Largest combo: country_a_id={chunks[-1]['country_a_id']} "
        f"cat={chunks[-1]['event_category']} tier={chunks[-1]['pattern_tier']} "
        f"({chunks[-1]['pattern_count']} patterns)."
    )

    # Build adaptive chunks per country. emit_chunks is the deduplicated
    # list of {country_a_id, event_category|None, pattern_tier|None,
    # pattern_count} dicts for the SF Map state. Sorted ASC by pattern
    # count so the smallest chunk lands as the seed CTAS.
    emit_chunks: list[dict] = []

    # Group raw enumerate results by country
    by_country: dict[int, list[dict]] = {}
    for c in chunks:
        by_country.setdefault(c['country_a_id'], []).append(c)

    for cid, country_combos in by_country.items():
        tier = country_tiers[cid]
        country_total = country_totals[cid]

        if tier == 'tier1':
            # No chunking: 1 INSERT per country with no category/tier filter.
            emit_chunks.append({
                'country_a_id': cid,
                'event_category': None,
                'pattern_tier': None,
                'pattern_count': country_total,
            })
        elif tier == 'tier2':
            # Aggregate combos by category; emit 1 chunk per (country, category).
            by_cat: dict[str, int] = {}
            for combo in country_combos:
                by_cat[combo['event_category']] = (
                    by_cat.get(combo['event_category'], 0)
                    + combo['pattern_count']
                )
            for cat, count in by_cat.items():
                emit_chunks.append({
                    'country_a_id': cid,
                    'event_category': cat,
                    'pattern_tier': None,
                    'pattern_count': count,
                })
        else:
            # Tier 3 (and Tier 4 for now — see module-level comment): emit
            # the raw enumerate combos as-is. (Tier 4's decade-bucket axis
            # is a future extension; today no (country, cat, tier) chunk
            # exceeds the 30-min ceiling at India's 12M-pattern scale.)
            if tier == 'tier4':
                logger.warning(
                    f"country_a_id={cid} has {country_total} patterns — "
                    f"Tier-4 (decade-bucket axis) is not yet implemented; "
                    f"falling through to Tier-3 (event_category × pattern_tier). "
                    f"Monitor this country's chunk runtimes — if any exceeds "
                    f"25min, file a follow-up to ship the decade axis."
                )
            for combo in country_combos:
                emit_chunks.append({
                    'country_a_id': cid,
                    'event_category': combo['event_category'],
                    'pattern_tier': combo['pattern_tier'],
                    'pattern_count': combo['pattern_count'],
                })

    # Sort ASC by pattern count so the smallest chunk becomes the seed CTAS.
    emit_chunks.sort(key=lambda c: c['pattern_count'])

    logger.info(
        f"Smart-chunking emitted {len(emit_chunks)} chunks "
        f"(was {len(chunks)} before tier-classification — "
        f"{(1 - len(emit_chunks) / max(len(chunks), 1)) * 100:.1f}% reduction)."
    )

    # Step 3: seed = smallest emitted chunk (CTAS, creates table + first
    # partition). Uses build_recipe_query with the chunk's possibly-None
    # category/tier — the function's existing `if X is not None` conditionals
    # produce a single-INSERT shape for Tier-1 seeds. Verified by tests.
    seed = emit_chunks[0]
    seed_sql = build_recipe_query(
        cutoff_year,
        country_a_id=seed['country_a_id'],
        event_category=seed['event_category'],
        pattern_tier=seed['pattern_tier'],
        mode='ctas',
    )

    # Step 4: all remaining chunks → INSERT items
    insert_items = []
    for chunk in emit_chunks[1:]:
        cid = chunk['country_a_id']
        cat = chunk['event_category']  # may be None for Tier-1 chunks
        tier = chunk['pattern_tier']   # may be None for Tier-1 / Tier-2 chunks
        # chunk_id encodes the chunk's filter shape — None → '*' for legibility
        chunk_id = (
            f"{cid}_"
            f"{cat if cat is not None else '*'}_"
            f"{tier if tier is not None else '*'}"
        )
        insert_items.append({
            'country_a_id': cid,
            'event_category': cat,
            'pattern_tier': tier,
            'chunk_id': chunk_id,
            'pattern_count': chunk['pattern_count'],
            # NO-OP DROP per #14 (a42b178): the SF state `5b.1 Drop Recipes
            # Table` already dropped the whole `recipes` table before the
            # Map state began, and `5b.4 Seed CTAS` recreated it fresh.
            # Per-chunk `DROP PARTITION IF EXISTS` was redundant *and*
            # dangerous (parallel Glue:BatchDeletePartition contention).
            # SELECT 1 keeps the SF schema unchanged while never touching Glue.
            'drop_partition_sql': "SELECT 1",
            'insert_sql': build_recipe_query(
                cutoff_year, country_a_id=cid,
                event_category=cat, pattern_tier=tier,
                mode='insert',
            ),
        })

    logger.info(
        f"Generated seed CTAS for chunk "
        f"country_a_id={seed['country_a_id']}, "
        f"cat={seed['event_category']}, tier={seed['pattern_tier']} "
        f"({len(seed_sql)} chars) and {len(insert_items)} chunk INSERT items."
    )

    # Step 5: write insert_items to S3 (payload exceeds SF 256KB limit).
    items_key = f"recipe-engine/insert-items-{run_id}.json"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=items_key,
        Body=json.dumps(insert_items),
        ContentType='application/json',
    )
    logger.info(
        f"Wrote {len(insert_items)} insert items to "
        f"s3://{S3_BUCKET}/{items_key}"
    )

    return {
        'statusCode': 200,
        'run_id': run_id,
        'cutoff_year': cutoff_year,
        'seed_country_id': seed['country_a_id'],
        'seed_pattern_count': seed['pattern_count'],
        'seed_sql': seed_sql,
        'insert_items_bucket': S3_BUCKET,
        'insert_items_key': items_key,
        # partitions_total = total emitted chunks after smart-chunking
        # (1 seed + N insert items). Used by 5b.6 Finalize for logging.
        'partitions_total': len(emit_chunks),
        # tier_distribution surfaces the size-tier classification for ops
        # observability — first place to look if a future run looks slow.
        'tier_distribution': tier_distribution,
    }


def _run_enumerate_query(cutoff_year=None):
    """Run a GROUP BY query that returns (country_a_id, event_category,
    pattern_tier, count) for every combo that actually exists in patterns,
    sorted ASC by count.

    Using COALESCE(pattern_tier, ...) mirrors the fallback logic in
    build_recipe_query so that every pattern row maps to exactly one tier
    bucket — no rows are lost.

    Returns the query execution ID. Polls until SUCCEEDED.
    """
    cutoff_filter = ""
    if cutoff_year:
        cutoff_filter = (
            f"AND (p.start_year_a + p.length) <= {cutoff_year} "
            f"AND (p.start_year_b + p.length) <= {cutoff_year}"
        )

    sql = f"""
        SELECT
            p.country_a_id,
            ea.category_normalized AS event_category,
            COALESCE(
                p.pattern_tier,
                CASE
                    WHEN p.length BETWEEN 3 AND 8  THEN 'S'
                    WHEN p.length BETWEEN 9 AND 20 THEN 'M'
                    WHEN p.length BETWEEN 21 AND 40 THEN 'L'
                    ELSE 'XL'
                END
            ) AS pattern_tier,
            count(*) AS pc
        FROM {ATHENA_DB}.patterns p
        INNER JOIN {ATHENA_DB}.events ea
            ON ea.country_id = p.country_a_id
            AND ea.year BETWEEN
                (p.start_year_a + p.length - greatest(1, cast(ceil(p.length * 0.15) as integer)))
                AND
                (p.start_year_a + p.length + greatest(1, cast(ceil(p.length * 0.15) as integer)))
        WHERE p.country_a_id IS NOT NULL
        {cutoff_filter}
        GROUP BY p.country_a_id, ea.category_normalized,
            COALESCE(
                p.pattern_tier,
                CASE
                    WHEN p.length BETWEEN 3 AND 8  THEN 'S'
                    WHEN p.length BETWEEN 9 AND 20 THEN 'M'
                    WHEN p.length BETWEEN 21 AND 40 THEN 'L'
                    ELSE 'XL'
                END
            )
        ORDER BY pc ASC
    """
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={'Database': ATHENA_DB},
        WorkGroup=ATHENA_WG,
    )
    query_id = response['QueryExecutionId']
    logger.info(f"Enumerate (chunked) query {query_id}: started")

    while True:
        status = athena.get_query_execution(QueryExecutionId=query_id)
        state = status['QueryExecution']['Status']['State']
        if state == 'SUCCEEDED':
            logger.info(f"Enumerate query {query_id}: SUCCEEDED")
            return query_id
        if state in ('FAILED', 'CANCELLED'):
            reason = status['QueryExecution']['Status'].get('StateChangeReason', 'unknown')
            raise RuntimeError(f"Enumerate query {state}: {reason}")
        time.sleep(1)


def _fetch_chunk_rows(query_id):
    """Page through Athena query results and return a list of dicts:
    [{'country_a_id': int, 'event_category': str,
      'pattern_tier': str, 'pattern_count': int}, ...]
    sorted ASC by pattern_count (the upstream query already orders this way).
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
            result_rows = result_rows[1:]  # skip header row
            headers_seen = True
        for row in result_rows:
            cells = row.get('Data', [])
            if len(cells) < 4:
                continue
            raw_id = cells[0].get('VarCharValue')
            raw_cat = cells[1].get('VarCharValue')
            raw_tier = cells[2].get('VarCharValue')
            raw_cnt = cells[3].get('VarCharValue')
            if not all([raw_id, raw_cat, raw_tier, raw_cnt]):
                continue
            try:
                rows.append({
                    'country_a_id': int(raw_id),
                    'event_category': raw_cat,
                    'pattern_tier': raw_tier,
                    'pattern_count': int(raw_cnt),
                })
            except ValueError:
                logger.warning(
                    f"Skipping non-parseable row: id={raw_id!r} "
                    f"cat={raw_cat!r} tier={raw_tier!r} cnt={raw_cnt!r}"
                )
        next_token = result.get('NextToken')
        if not next_token:
            break
    return rows


def build_recipe_query(
    cutoff_year=None,
    country_a_id=None,
    event_category=None,
    pattern_tier=None,
    mode='ctas',
):
    """Build the per-chunk recipe SQL — CTAS for the seed, INSERT for the rest.

    Extends the #162 Layer 2 query with two extra WHERE filters:
      - AND ea.category_normalized = '<event_category>'    (events JOIN side)
      - AND COALESCE(p.pattern_tier, <fallback>) = '<tier>' (patterns side)

    These filters are applied to the patterns scan and events JOIN,
    ensuring each chunk scans only its slice. Total data scanned across
    all chunks equals the original single-country scan (no duplication).

    The MUST-produce-identical-rows contract:
      UNION over all (country, category, tier) chunks = what the old
      single-country INSERT produced. The event_category filter maps
      directly to the raw_recipes JOIN predicate
      (eb.category_normalized = ea.category_normalized), so filtering
      ea.category_normalized = X is equivalent to "all rows where both
      event A and event B are in category X" — same as the old query.
      The pattern_tier filter selects a disjoint length-band of patterns,
      so union across the 4 tiers = all patterns.

    Parameters
    ----------
    cutoff_year : int or None
    country_a_id : int   — MANDATORY
    event_category : str — MANDATORY for chunked mode
    pattern_tier : str   — MANDATORY for chunked mode; one of S/M/L/XL
    mode : 'ctas' | 'insert'
    """
    if country_a_id is None:
        raise ValueError("country_a_id is mandatory for build_recipe_query.")

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

    # Chunk filters — both are mandatory in the new path.
    if event_category is not None:
        # Single-quote escape: event category names are underscore-delimited
        # ASCII identifiers from the taxonomy; no quotes expected, but be safe.
        safe_cat = event_category.replace("'", "''")
        event_filter_a += f"\n            AND ea.category_normalized = '{safe_cat}'"

    if pattern_tier is not None:
        safe_tier = pattern_tier.replace("'", "''")
        # Use the same COALESCE expression as the enumerate query so every
        # pattern row (including legacy rows with NULL pattern_tier) falls
        # into exactly one chunk.
        pattern_filters.append(
            f"COALESCE(p.pattern_tier, "
            f"CASE "
            f"WHEN p.length BETWEEN 3 AND 8 THEN 'S' "
            f"WHEN p.length BETWEEN 9 AND 20 THEN 'M' "
            f"WHEN p.length BETWEEN 21 AND 40 THEN 'L' "
            f"ELSE 'XL' END) = '{safe_tier}'"
        )

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
            ) AS pattern_tier,
            COALESCE(p.contains_predicted, FALSE) AS contains_predicted
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
            bool_or(contains_predicted)      AS contains_predicted,
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
        r.contains_predicted,
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
