"""
Phase 5b step 6: Recipe Engine finalize (#162 Layer 2).

Runs AFTER the Step Function's 5b.5 Map state has populated every
partition of qgi_data.recipes via per-country INSERTs (and the seed
country via the 5b.4 CTAS).

Responsibilities (all post-write, bounded wall time):

1. Count recipes + category breakdown (observability)
2. Create `recipes_normalized` view — the #158 follow-up that recomputes
   `pps` using the GLOBAL max(instance_count) + max(indicator_count)
   across ALL country partitions. Without this, the per-partition pps
   written by the Map state's INSERTs would not be comparable across
   countries. See #158 follow-up commit c856b67 for the original analysis.
3. Create `recipe_convergence` view (#133) — reads from recipes_normalized
   so `predictor_best_pps` is a true global max, not per-partition.
4. Pre-compute dashboard JSONs (#146):
     - ranking.json        — top 1000 patterns by pattern_power_score
     - early-warning.json  — B-leads-A patterns with end year ≥ (now-2)
     - recipes-top50.json  — diversity-capped top 50 recipes via convergence

Skips convergence + dashboard JSON steps on backtesting runs
(`cutoff_year` set) — only the canonical run should publish dashboards.

All queries here are either:
  - Bounded aggregates on the finished recipes table (1-2 GB scans, sub-min)
  - View CREATE OR REPLACE (instant, metadata only)
  - Athena SELECT for small result sets feeding JSON generation

Total wall time budget: ~2-3 min. Well under 900s.
"""

import os
import json
import logging
import time
from datetime import datetime, timezone

import boto3

# #375 — country-risks.json auto-generation at pipeline end
from country_risks import write_country_risks_json

logger = logging.getLogger()
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get('S3_BUCKET')
ATHENA_DB = os.environ.get('ATHENA_DATABASE', 'qgi_data')
ATHENA_WG = os.environ.get('ATHENA_WORKGROUP', 'QGI-Lambda-Workgroup')
DASHBOARD_PREFIX = 'dashboard'
RANKING_LIMIT = 1000

RECIPES_DEDUPED_VIEW_NAME = "recipes_deduped"
RECIPES_NORMALIZED_VIEW_NAME = "recipes_normalized"
CONVERGENCE_VIEW_NAME = "recipe_convergence"
# #462 Fork B: Phase 5b.6.5 Recipe Aggregation Level-4 table.
RECIPES_AGGREGATED_TABLE_NAME = "recipes_aggregated"
RECIPES_AGGREGATED_S3_PREFIX = "pipeline-recipe-aggregator/output/data/"
RECIPES_AGGREGATED_SCHEMA_VERSION = 1
PIPELINE_VERSION = os.environ.get('PIPELINE_VERSION', 'V2.0-dev')

# #463 Fork B: Phase 5b.6.6 Country-vs-Recipe Scoring.
COUNTRY_RECIPE_SCORES_TABLE_NAME = "country_recipe_scores"
COUNTRY_RECIPE_SCORES_S3_PREFIX = "pipeline-recipe-scorer/output/data/"
INDICATOR_MAP_S3_KEY = "pipeline-A-indicator-extractor/input/indicator_map.csv"
# Coverage threshold below which we suppress the score per Sebastien's
# partial-coverage tolerance (Decision-1 caveat). Refine post-eval (#463 Part C).
SCORER_MIN_COVERAGE = 0.30

# ---------------------------------------------------------------------------
# #170: Country → region map for the convergence score view.
#
# Canonical source of truth: qgi-data/registries/country_regions.yaml
# (synced to S3 at indicator-freshness/country_regions.yaml).
#
# This Lambda reads the YAML from S3 at init time and caches it.
# Falls back to an embedded copy if S3 read fails (cold start, missing
# file, permissions). The fallback is intentionally NOT maintained — it
# exists only as a safety net. If you update regions, update the YAML
# in qgi-data, sync to S3, and redeploy.
# ---------------------------------------------------------------------------
REGIONS_S3_KEY = os.environ.get(
    'REGIONS_KEY', 'indicator-freshness/country_regions.yaml'
)

def _load_country_regions():
    """Load country regions from S3 YAML, fall back to hardcoded."""
    try:
        obj = boto3.client('s3').get_object(Bucket=S3_BUCKET, Key=REGIONS_S3_KEY)
        raw = obj['Body'].read().decode('utf-8')
        # Parse simple YAML without pyyaml: each region is "REG:" followed by "  - XX" lines
        regions = {}
        current_region = None
        for line in raw.split('\n'):
            stripped = line.strip()
            if stripped.startswith('#') or stripped.startswith('version') or not stripped:
                continue
            if not line.startswith(' ') and stripped.endswith(':'):
                current_region = stripped[:-1]
                regions[current_region] = set()
            elif current_region and stripped.startswith('- '):
                regions[current_region].add(stripped[2:].strip())
        if regions:
            logger.info(f"Loaded {sum(len(v) for v in regions.values())} country codes from S3")
            return regions
    except Exception:
        logger.warning("Failed to load country_regions from S3, using fallback", exc_info=True)

    # Hardcoded fallback (last synced 2026-04-10, 251 codes, 6 regions)
    return {
        "AFR": {"AO","BF","BI","BJ","BW","CD","CF","CG","CI","CM","CV","DJ","ER","ET","GA","GH","GM","GN","GQ","GW","KE","KM","LR","LS","MG","ML","MR","MU","MW","MZ","NA","NE","NG","RE","RW","SC","SH","SL","SN","SO","SS","ST","SZ","TD","TG","TZ","UG","YT","ZA","ZM","ZW"},
        "MEA": {"AE","BH","DZ","EG","EH","IL","IQ","IR","JO","KW","LB","LY","MA","OM","PS","QA","SA","SD","SY","TN","TR","YE"},
        "EUR": {"AD","AL","AT","AX","BA","BE","BG","BY","CH","CY","CZ","DE","DK","EE","ES","FI","FO","FR","GB","GG","GI","GL","GR","HR","HU","IE","IM","IS","IT","JE","LI","LT","LU","LV","MC","MD","ME","MK","MT","NL","NO","PL","PT","RO","RS","RU","SE","SI","SJ","SK","SM","UA","VA","XK"},
        "ASI": {"AF","AM","AZ","BD","BN","BT","CC","CN","CX","GE","HK","ID","IN","IO","JP","KG","KH","KP","KR","KZ","LA","LK","MM","MN","MO","MV","MY","NP","PH","PK","SG","TH","TJ","TL","TM","TW","UZ","VN"},
        "AMR": {"AG","AI","AN","AR","AW","BB","BL","BM","BO","BQ","BR","BS","BZ","CA","CL","CO","CR","CU","CW","DM","DO","EC","FK","GD","GF","GP","GS","GT","GY","HN","HT","JM","KN","KY","LC","MF","MQ","MS","MX","NI","PA","PE","PM","PR","PY","SR","SV","SX","TC","TT","US","UY","VC","VE","VG","VI"},
        "OCE": {"AQ","AS","AU","BV","CK","FJ","FM","GU","HM","KI","MH","MP","NC","NF","NR","NU","NZ","PF","PG","PN","PW","SB","TF","TK","TO","TV","UM","VU","WF","WS"},
    }

COUNTRY_REGIONS = _load_country_regions()


athena = boto3.client('athena')
s3 = boto3.client('s3')
cloudwatch = boto3.client('cloudwatch')  # #381 drift + #409 caught-exception metrics


def _emit_caught_exception(context_key):
    """Emit CloudWatch metric for a log-and-continue exception (#409).

    Some catch blocks intentionally log-and-continue for non-fatal steps
    (e.g. view creation, dashboard sub-writes). Those exceptions still
    represent operational signal that deserves an alarm when they spike.
    This helper ensures the occurrence is counted in CloudWatch even
    when the handler chooses not to re-raise.

    Discovered after 2026-04-22 finalize-Lambda silent-failure incident:
    country-risks.json silently stopped regenerating for 2 days because
    a signature-mismatch exception was caught, logged, and the handler
    still returned 200. See #373 (audit) and #409 (observability).
    """
    try:
        cloudwatch.put_metric_data(
            Namespace='QGI/Pipeline',
            MetricData=[{
                'MetricName': 'CaughtExceptionCount',
                'Value': 1.0,
                'Unit': 'Count',
                'Dimensions': [
                    {'Name': 'Lambda',
                     'Value': os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'unknown')},
                    {'Name': 'Location', 'Value': context_key},
                ],
            }],
        )
    except Exception:  # noqa: BLE001 — last-resort; don't shadow original
        logger.warning(
            "emit_caught_exception: metric put failed (swallowed) context=%s",
            context_key,
        )


def lambda_handler(event, context):
    run_id = event.get('run_id', 'manual')
    cutoff_year = event.get('cutoff_year')
    partitions_total = event.get('partitions_total', 'unknown')

    logger.info(
        f"Recipe engine finalize starting. run_id={run_id}, "
        f"cutoff_year={cutoff_year}, partitions_total={partitions_total}"
    )

    # Step 1: total count + category breakdown (small scans)
    count_id = run_query(f"SELECT count(*) FROM {ATHENA_DB}.recipes")
    count_result = athena.get_query_results(QueryExecutionId=count_id)
    total_recipes = int(count_result['ResultSet']['Rows'][1]['Data'][0]['VarCharValue'])
    logger.info(f"recipes row count: {total_recipes:,}")

    cat_id = run_query(
        f"SELECT event_category, count(*) AS cnt FROM {ATHENA_DB}.recipes "
        f"GROUP BY event_category ORDER BY cnt DESC LIMIT 20"
    )
    cat_result = athena.get_query_results(QueryExecutionId=cat_id)
    top_categories = [
        f"{r['Data'][0]['VarCharValue']}: {r['Data'][1]['VarCharValue']}"
        for r in cat_result['ResultSet']['Rows'][1:6]
    ]
    logger.info(f"Top categories: {top_categories}")

    # Step 2a: recipes_deduped view (#458) — bullet-6 longest-pattern
    # collapse. Must precede recipes_normalized + recipes_aggregated since
    # both read from this view.
    create_recipes_deduped_view()

    # Step 2b: recipes_normalized view (#158 follow-up)
    create_recipes_normalized_view()

    # Step 2c: recipes_aggregated table (#462 Fork B Phase 5b.6.5) — Level-4
    # Recipe object, one row per L3 event_category. Runs after the deduped
    # view exists; independent of recipes_normalized + convergence.
    aggregated_status = 'skipped'
    if cutoff_year is None:
        try:
            write_recipes_aggregated_table()
            aggregated_status = 'ok'
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Failed to write recipes_aggregated: {exc}")
            aggregated_status = f'error: {exc}'
            _emit_caught_exception('write_recipes_aggregated_table')

    # Step 2d: country_recipe_scores table (#463 Fork B Phase 5b.6.6 v0.1) —
    # one row per (country, recipe). Depends on recipes_aggregated being
    # populated in Step 2c. Skipped on backtest cutoffs (frontend-only
    # consumer; backtest runs don't publish to the dashboard).
    scores_status = 'skipped'
    if cutoff_year is None and aggregated_status == 'ok':
        try:
            write_country_recipe_scores()
            scores_status = 'ok'
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Failed to write country_recipe_scores: {exc}")
            scores_status = f'error: {exc}'
            _emit_caught_exception('write_country_recipe_scores')
    elif cutoff_year is None and aggregated_status != 'ok':
        # Skip explicitly if upstream failed — the scorer reads from
        # recipes_aggregated, no point trying.
        scores_status = f'skipped: aggregated upstream {aggregated_status}'

    # Step 3: convergence view (#133) — reads from recipes_normalized
    convergence_status = 'skipped'
    if cutoff_year is None:
        try:
            create_convergence_view()
            convergence_status = 'ok'
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Failed to create convergence view: {exc}")
            convergence_status = f'error: {exc}'
            _emit_caught_exception('create_convergence_view')

    # Step 4: dashboard JSONs (#146)
    dashboard_results = {}
    if cutoff_year is None:
        try:
            dashboard_results = write_dashboard_jsons()
            logger.info(f"Dashboard JSONs written: {dashboard_results}")
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Failed to write dashboard JSONs: {exc}")
            dashboard_results = {'error': str(exc)}
            _emit_caught_exception('write_dashboard_jsons')

    return {
        'statusCode': 200,
        'recipes_count': total_recipes,
        'top_categories': top_categories,
        'recipes_aggregated': aggregated_status,
        'country_recipe_scores': scores_status,
        'convergence_view': convergence_status,
        'dashboard': dashboard_results,
        'partitions_total': partitions_total,
    }


# ---------------------------------------------------------------------------
# recipes_deduped view — bullet-6 nested-length collapse (#458)
# ---------------------------------------------------------------------------

def create_recipes_deduped_view():
    """Collapse same-event nested-length Pattern instances to the longest.

    Today's `qgi_data.recipes` keys recipe_id by
    (country_a, country_b, start_year_a, length, event_category). When a
    pair-event has multiple patterns at different lengths that all end at
    the same event (Saudi-Egypt-2011-len5-civil_war + 2010-len6 + 2009-len7
    all terminating at the same Saudi 2015 event), each becomes a separate
    recipe row. The founder's bullet 6 (Majles audit 2026-04-25) says take
    the longest. The recipe-engine doesn't, so today's instance_count and
    recipe_count are inflated 3-5x per pair-event.

    This view collapses to the LONGEST per
    (country_a, country_b, event_year_a, event_year_b, event_category).
    Tiebreak by pps so the highest-quality row wins when lengths match.

    Downstream consumers (recipes_normalized + country_risks salience SQL +
    standalone bakers) read from this view instead of recipes directly.

    Superseded by V2.0 #462 (Recipe Aggregation Level-4 table) — when that
    lands, retire this view. Until then, this is the cheapest fix for the
    inflation bug that doesn't require a recipe-engine rewrite.

    Requires Athena engine v3 for `SELECT * EXCEPT`. Confirmed live in
    QGI-Lambda-Workgroup.
    """
    sql = f"""
    CREATE OR REPLACE VIEW {ATHENA_DB}.{RECIPES_DEDUPED_VIEW_NAME} AS
    WITH ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY country_a_id, country_b_id,
                                event_year_a, event_year_b, event_category
                   ORDER BY length DESC, pattern_power_score DESC
               ) AS rn
        FROM {ATHENA_DB}.recipes
    )
    SELECT * EXCEPT(rn) FROM ranked WHERE rn = 1
    """
    logger.info("Creating recipes_deduped view (bullet-6 longest-pattern collapse)")
    run_query(sql)
    logger.info(f"View {ATHENA_DB}.{RECIPES_DEDUPED_VIEW_NAME} created")


# ---------------------------------------------------------------------------
# recipes_normalized view — global pps normalization (#158 follow-up)
# ---------------------------------------------------------------------------

def create_recipes_normalized_view():
    """Overlay view that recomputes pps using GLOBAL max across all partitions.

    The Map state's per-country INSERTs each compute their own local
    `max(instance_count)` and `max(indicator_count)` inside the per-country
    `global_stats` CTE — so the physically-stored `pps` column is per-
    partition wrong. This view re-reads the finished recipes table, takes
    the TRUE global max via CROSS JOIN, and rewrites `pps` on the fly.

    #458: now reads from `recipes_deduped` (bullet-6 collapse) instead of
    raw `recipes`, so global max is taken over the deduped row set rather
    than the inflated set. Downstream consumers (convergence view + top50
    dashboard query) inherit the dedup automatically through this view.

    Requires Athena engine v3 for `SELECT * EXCEPT`. Confirmed live in
    QGI-Lambda-Workgroup.
    """
    sql = f"""
    CREATE OR REPLACE VIEW {ATHENA_DB}.{RECIPES_NORMALIZED_VIEW_NAME} AS
    SELECT
        r.recipe_id, r.event_category, r.pattern_id, r.country_b_id,
        r.country_a_name, r.country_b_name, r.start_year_a, r.start_year_b,
        r.length, r.avg_correlation, r.end_year_a, r.end_year_b,
        r.event_window, r.event_year_a, r.event_year_b,
        r.event_title_a, r.event_title_b, r.indicator_count,
        r.pattern_power_score, r.instance_count, r.pattern_tier,
        r.median_lead_time_b, r.min_lead_time_b, r.max_lead_time_b,
        r.median_lead_time_a, r.country_a_id,
        -- #461: D7 plumbing carries through from recipes_deduped → here →
        -- convergence view (which reads from this view) → dashboard JSONs.
        r.contains_predicted,
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
        ) AS pps
    FROM {ATHENA_DB}.{RECIPES_DEDUPED_VIEW_NAME} r
    CROSS JOIN (
        SELECT
            cast(max(instance_count) as double)  AS max_inst,
            cast(max(indicator_count) as double) AS max_ind
        FROM {ATHENA_DB}.{RECIPES_DEDUPED_VIEW_NAME}
    ) g
    """
    logger.info("Creating recipes_normalized view (global pps over deduped set)")
    run_query(sql)
    logger.info(f"View {ATHENA_DB}.{RECIPES_NORMALIZED_VIEW_NAME} created")


# ---------------------------------------------------------------------------
# recipes_aggregated table — Fork B Phase 5b.6.5 (#462)
# ---------------------------------------------------------------------------

def write_recipes_aggregated_table():
    """Phase 5b.6.5: produce qgi_data.recipes_aggregated (Level-4 Recipe object).

    One row per L3 event_category (~71 rows total). The
    Recipe-as-aggregated-fingerprint phase the audit found missing.

    Strategy: the Glue table is Terraform-owned (qgi-infra/modules/storage),
    so we can't use Athena CTAS (it would conflict on the table definition).
    Instead: clear the data prefix in S3, then INSERT INTO. Idempotent
    because the prefix wipe runs every cycle.

    Schema (per Majles consult Decision 3, extended from 3 to 11 properties):
      - event_category, canonical_length, length_distribution
      - indicator_fingerprint (top-15 by TF-IDF + Wilson 95% CI)
      - coverage_bias_diagnostic (n_pairs + OECD share + regional concentration)
      - total_instances, n_distinct_country_pairs
      - last_recomputed_at, pipeline_version, schema_version
      - contains_predicted (#461 D7 plumbing inherited)

    REFINEMENTS DEFERRED (TODO markers in the SQL):
      - avg_corr_magnitude per indicator: requires join back to scdis;
        emits 0.0 placeholder for now. Followup ticket TBD.
      - coverage_bias_diagnostic OECD/region shares: emits placeholder 0.0
        + empty array for now. Requires countries-table join with OECD list +
        region map. Followup once the SQL pattern stabilises.

    Cost: scans recipes_deduped (~400K rows post-#458 dedup) joined to
    patterns (~few-GB). Should complete sub-2-min in QGI-Lambda-Workgroup.
    """
    # 1. Clear existing data so re-runs are idempotent.
    logger.info(f"Clearing s3://{S3_BUCKET}/{RECIPES_AGGREGATED_S3_PREFIX}")
    paginator = s3.get_paginator('list_objects_v2')
    keys_to_delete = []
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=RECIPES_AGGREGATED_S3_PREFIX):
        for obj in page.get('Contents', []):
            keys_to_delete.append({'Key': obj['Key']})
            if len(keys_to_delete) >= 1000:
                s3.delete_objects(Bucket=S3_BUCKET, Delete={'Objects': keys_to_delete})
                keys_to_delete = []
    if keys_to_delete:
        s3.delete_objects(Bucket=S3_BUCKET, Delete={'Objects': keys_to_delete})

    # 2. INSERT INTO. Column order MUST match the Terraform-owned Glue
    # schema (qgi-infra/modules/storage/main.tf aws_glue_catalog_table.recipes_aggregated).
    sql = f"""
    INSERT INTO {ATHENA_DB}.{RECIPES_AGGREGATED_TABLE_NAME}
    WITH recipes_with_pattern AS (
        -- Join deduped recipes to patterns to recover indicator IDs.
        SELECT
            rd.event_category,
            rd.recipe_id,
            rd.country_a_id,
            rd.country_b_id,
            rd.length,
            COALESCE(rd.contains_predicted, FALSE) AS contains_predicted,
            p.indicator_numeric_ids
        FROM {ATHENA_DB}.{RECIPES_DEDUPED_VIEW_NAME} rd
        INNER JOIN {ATHENA_DB}.patterns p ON p.pattern_id = rd.pattern_id
    ),
    -- Per-category point estimates.
    category_basics AS (
        SELECT
            event_category,
            cast(approx_percentile(cast(length as double), 0.5) as smallint) AS canonical_length,
            cast(count(distinct recipe_id) as bigint) AS total_instances,
            cast(count(distinct cast(country_a_id as varchar) || '-' || cast(country_b_id as varchar)) as bigint) AS n_distinct_country_pairs,
            bool_or(contains_predicted) AS contains_predicted
        FROM recipes_with_pattern
        GROUP BY event_category
    ),
    -- Length histogram per category.
    length_dist_rows AS (
        SELECT event_category, length, cast(count(distinct recipe_id) as bigint) AS cnt
        FROM recipes_with_pattern
        GROUP BY event_category, length
    ),
    length_distributions AS (
        SELECT
            event_category,
            array_agg(
                cast(row(cast(length as smallint), cnt)
                     as row(length smallint, count bigint))
                ORDER BY length
            ) AS length_distribution
        FROM length_dist_rows
        GROUP BY event_category
    ),
    -- Per-indicator unnest for fingerprint.
    indicator_unnest AS (
        SELECT event_category, recipe_id, indicator_id
        FROM recipes_with_pattern
        CROSS JOIN UNNEST(indicator_numeric_ids) AS t(indicator_id)
    ),
    indicator_counts AS (
        SELECT
            event_category,
            indicator_id,
            count(distinct recipe_id) AS recipes_with_indicator
        FROM indicator_unnest
        GROUP BY event_category, indicator_id
    ),
    recipes_per_category AS (
        SELECT event_category, count(distinct recipe_id) AS n_recipes
        FROM recipes_with_pattern
        GROUP BY event_category
    ),
    total_recipes AS (
        SELECT count(distinct recipe_id) AS n_total FROM recipes_with_pattern
    ),
    -- Indicator metrics: frequency + TF-IDF + Wilson 95% CI on the proportion.
    -- Wilson formula: z=1.96, z²=3.8416. center=(p+z²/2n)/(1+z²/n);
    -- margin=z*sqrt(p(1-p)/n + z²/(4n²))/(1+z²/n).
    indicator_with_n AS (
        SELECT
            ic.event_category,
            ic.indicator_id,
            cast(ic.recipes_with_indicator as double) AS k_d,
            cast(rpc.n_recipes as double) AS n_d,
            cast(ic.recipes_with_indicator as double) / cast(rpc.n_recipes as double) AS p,
            cast(ic.recipes_with_indicator as double) / cast(rpc.n_recipes as double)
                * ln(cast(tr.n_total as double) / cast(ic.recipes_with_indicator as double)) AS tfidf
        FROM indicator_counts ic
        JOIN recipes_per_category rpc ON rpc.event_category = ic.event_category
        CROSS JOIN total_recipes tr
    ),
    indicator_with_ci AS (
        SELECT
            event_category,
            indicator_id,
            p AS frequency,
            tfidf,
            -- Wilson denominators / numerators broken out for readability.
            greatest(0.0,
                ((p + 1.9208 / n_d) / (1.0 + 3.8416 / n_d))
                - (1.96 * sqrt(p * (1.0 - p) / n_d + 0.9604 / (n_d * n_d)) / (1.0 + 3.8416 / n_d))
            ) AS ci_lower,
            least(1.0,
                ((p + 1.9208 / n_d) / (1.0 + 3.8416 / n_d))
                + (1.96 * sqrt(p * (1.0 - p) / n_d + 0.9604 / (n_d * n_d)) / (1.0 + 3.8416 / n_d))
            ) AS ci_upper,
            -- TODO #462 follow-up: avg correlation magnitude per indicator
            -- requires joining back to scdis. 0.0 placeholder for now.
            0.0 AS avg_corr_magnitude
        FROM indicator_with_n
    ),
    indicator_ranked AS (
        SELECT *,
            row_number() OVER (PARTITION BY event_category ORDER BY tfidf DESC) AS rn
        FROM indicator_with_ci
    ),
    indicator_fingerprints AS (
        SELECT
            event_category,
            array_agg(
                cast(row(
                    cast(indicator_id as smallint),
                    cast(frequency as real),
                    cast(ci_lower as real),
                    cast(ci_upper as real),
                    cast(avg_corr_magnitude as real),
                    cast(tfidf as real)
                ) as row(
                    indicator_id smallint,
                    frequency real,
                    ci_lower real,
                    ci_upper real,
                    avg_corr_magnitude real,
                    tfidf_score real
                ))
                ORDER BY tfidf DESC
            ) AS indicator_fingerprint
        FROM indicator_ranked
        WHERE rn <= 15
        GROUP BY event_category
    )
    -- Final SELECT — column order matches the Terraform Glue schema.
    SELECT
        cb.event_category,
        cb.canonical_length,
        ld.length_distribution,
        ifp.indicator_fingerprint,
        -- TODO #462 follow-up: compute oecd_share + regional_concentration
        -- via JOIN to qgi_data.countries (alpha_2) + OECD/region maps.
        -- Emits placeholder n_pairs (real) + 0.0 oecd_share + empty array
        -- for now so downstream consumers can already read the field.
        cast(row(
            cast(cb.n_distinct_country_pairs as int),
            cast(0.0 as real),
            cast(array[] as array<row(region varchar, share real)>)
        ) as row(
            n_pairs int,
            oecd_share real,
            regional_concentration array<row(region varchar, share real)>
        )) AS coverage_bias_diagnostic,
        cb.total_instances,
        cb.n_distinct_country_pairs,
        cast(current_timestamp as timestamp) AS last_recomputed_at,
        '{PIPELINE_VERSION}' AS pipeline_version,
        cast({RECIPES_AGGREGATED_SCHEMA_VERSION} as smallint) AS schema_version,
        cb.contains_predicted
    FROM category_basics cb
    LEFT JOIN length_distributions ld ON ld.event_category = cb.event_category
    LEFT JOIN indicator_fingerprints ifp ON ifp.event_category = cb.event_category
    """
    logger.info("Inserting into recipes_aggregated (Phase 5b.6.5 Level-4 fingerprints)")
    run_query(sql)
    logger.info(f"Wrote {ATHENA_DB}.{RECIPES_AGGREGATED_TABLE_NAME}")


# ---------------------------------------------------------------------------
# country_recipe_scores table — Fork B Phase 5b.6.6 (#463), v0.1
# ---------------------------------------------------------------------------

def _read_indicator_map_csv():
    """Load the indicator string-id ↔ numeric_id map from S3.

    Mirrors the loader in qgi-pipeline/batch/scdi-finder/src/scdi_finder.py
    (which reads the same file directly via boto3, not Glue). Returns a
    dict {numeric_id: id_string}.

    Used by write_country_recipe_scores to inline the mapping into the
    Athena SQL via a VALUES clause — avoids needing a Glue table for the
    map (which would have to live in a dedicated S3 prefix away from
    other CSVs in `pipeline-A-indicator-extractor/input/`).
    """
    import csv
    import io
    obj = s3.get_object(Bucket=S3_BUCKET, Key=INDICATOR_MAP_S3_KEY)
    raw = obj['Body'].read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(raw))
    out = {}
    for row in reader:
        try:
            num_id = int(row['numeric_id'])
            id_str = row['id_string'].strip()
            if id_str:
                out[num_id] = id_str
        except (ValueError, KeyError):
            continue
    return out


def write_country_recipe_scores():
    """Phase 5b.6.6 v0.1: Country-vs-Recipe Scoring (weighted indicator coverage).

    For each (country, recipe) pair: compute a similarity score in [0,1]
    based on weighted indicator coverage of the Recipe's fingerprint. Per
    the design doc at qgi-docs/internal/design/recipe-scoring-architecture.md,
    this is the v0.1 algorithm — establishes the data plumbing + populates
    the table so #464's frontend renders SOMETHING for every (country,
    recipe) pair. v0.2 ships the full Pearson-trajectory algorithm in a
    follow-up session.

    v0.1 algorithm:
        For each fingerprint indicator i in recipe R:
            - Check if country C has any value for indicator i in the last
              `canonical_length` years from indicators_completed
            - If present, contribute weight = fp[i].avg_corr_magnitude
        similarity_raw = sum(weight[i] for matched i) / sum(weight[i] for all i)
        coverage_ratio = matched / total_in_fingerprint
        suppressed = (coverage_ratio < SCORER_MIN_COVERAGE)

    Calibration (Part B) deferred — similarity_calibrated = similarity_raw
    until the Platt training script lands. The frontend reads
    similarity_calibrated, so when calibration ships the column auto-updates
    on the next pipeline run with no frontend change required.

    Eval (Part C) deferred — V2.0-vs-V1.9.1 metrics ship as a separate
    qgi-ml/scripts/eval_v2_vs_v19.py.

    Strategy: clear the data S3 prefix on every run, then INSERT INTO the
    Terraform-defined table. Mirrors write_recipes_aggregated_table().
    """
    # 1. Read indicator_map from S3 — small file (~270 rows).
    indicator_map = _read_indicator_map_csv()
    if not indicator_map:
        raise RuntimeError(
            f"indicator_map.csv at s3://{S3_BUCKET}/{INDICATOR_MAP_S3_KEY} "
            f"is empty or unreadable; cannot score without numeric → string id mapping"
        )
    logger.info(f"Loaded {len(indicator_map)} indicator IDs from CSV")

    # 2. Clear existing parquet data so re-runs are idempotent.
    logger.info(f"Clearing s3://{S3_BUCKET}/{COUNTRY_RECIPE_SCORES_S3_PREFIX}")
    paginator = s3.get_paginator('list_objects_v2')
    keys_to_delete = []
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=COUNTRY_RECIPE_SCORES_S3_PREFIX):
        for obj in page.get('Contents', []):
            keys_to_delete.append({'Key': obj['Key']})
            if len(keys_to_delete) >= 1000:
                s3.delete_objects(Bucket=S3_BUCKET, Delete={'Objects': keys_to_delete})
                keys_to_delete = []
    if keys_to_delete:
        s3.delete_objects(Bucket=S3_BUCKET, Delete={'Objects': keys_to_delete})

    # 3. Build inline VALUES clause for the indicator_map. Athena accepts
    # up to 1024 rows in a single VALUES; ~270 fits comfortably. Escape
    # single-quotes defensively even though indicator IDs shouldn't have any.
    map_rows = ", ".join(
        f"({nid}, '{sid.replace(chr(39), chr(39)+chr(39))}')"
        for nid, sid in sorted(indicator_map.items())
    )

    # 4. INSERT INTO. Column order MUST match the Terraform-owned Glue
    # schema (qgi-infra/modules/storage/main.tf
    # aws_glue_catalog_table.country_recipe_scores). Failure to match is
    # an Athena type error — fails loud, not silent.
    sql = f"""
    INSERT INTO {ATHENA_DB}.{COUNTRY_RECIPE_SCORES_TABLE_NAME}
    WITH indicator_map AS (
        SELECT numeric_id, id_string
        FROM (VALUES {map_rows}) AS t(numeric_id, id_string)
    ),
    -- One row per (recipe, fingerprint indicator) — typically 71 × 15 ≈ 1065.
    fp_unnested AS (
        SELECT
            ra.event_category,
            cast(ra.canonical_length as integer) AS L,
            cast(fp.indicator_id as integer) AS num_id,
            cast(fp.avg_corr_magnitude as double) AS weight,
            cardinality(ra.indicator_fingerprint) AS n_in_fp,
            COALESCE(ra.contains_predicted, FALSE) AS recipe_contains_predicted
        FROM {ATHENA_DB}.{RECIPES_AGGREGATED_TABLE_NAME} ra
        CROSS JOIN UNNEST(ra.indicator_fingerprint) AS u(fp)
    ),
    fp_with_string AS (
        SELECT fp.*, im.id_string
        FROM fp_unnested fp
        JOIN indicator_map im ON im.numeric_id = fp.num_id
    ),
    -- Currently scoreable countries: anything in the countries reference
    -- table with both id and name_1 set. The 89 risk-scored countries from
    -- country-risks.json are a strict subset.
    countries_indexed AS (
        SELECT cast(cd.id as smallint) AS country_id, cd.name_1 AS name
        FROM {ATHENA_DB}.countries cd
        WHERE cd.name_1 IS NOT NULL AND cd.name_1 != ''
          AND cd.id IS NOT NULL AND cd.id != ''
    ),
    -- The cross join is ~270 countries × ~1065 fingerprint slots ≈ 287K rows.
    -- The EXISTS hits indicators_completed which is partitioned by indicator_id
    -- (string), so each subquery scan is bounded to one partition.
    country_indicator_check AS (
        SELECT
            ci.country_id,
            fws.event_category,
            fws.weight,
            fws.n_in_fp,
            fws.recipe_contains_predicted,
            EXISTS (
                SELECT 1 FROM {ATHENA_DB}.indicators_completed ic
                WHERE ic.indicator_id = fws.id_string
                  AND ic.country = ci.name
                  AND ic.year >= year(current_timestamp) - fws.L
                  AND ic.value IS NOT NULL
            ) AS present
        FROM countries_indexed ci
        CROSS JOIN fp_with_string fws
    ),
    aggregated AS (
        SELECT
            country_id,
            event_category,
            sum(weight * (CASE WHEN present THEN 1.0 ELSE 0.0 END))
                / nullif(sum(weight), 0.0) AS similarity_raw,
            cast(sum(CASE WHEN present THEN 1 ELSE 0 END) as integer) AS indicators_matched,
            cast(max(n_in_fp) as integer) AS indicators_in_fingerprint,
            cast(sum(CASE WHEN present THEN 1 ELSE 0 END) as double)
                / nullif(cast(max(n_in_fp) as double), 0.0) AS coverage_ratio,
            bool_or(recipe_contains_predicted) AS contains_predicted
        FROM country_indicator_check
        GROUP BY country_id, event_category
    )
    SELECT
        country_id,
        event_category,
        cast(similarity_raw as real) AS similarity_raw,
        -- v0.1: similarity_calibrated == similarity_raw. Part B (Platt
        -- calibration) updates this column on the next pipeline run.
        cast(similarity_raw as real) AS similarity_calibrated,
        cast(indicators_matched as smallint) AS indicators_matched,
        cast(indicators_in_fingerprint as smallint) AS indicators_in_fingerprint,
        cast(coverage_ratio as real) AS coverage_ratio,
        coverage_ratio < {SCORER_MIN_COVERAGE} AS suppressed,
        CASE WHEN coverage_ratio < {SCORER_MIN_COVERAGE}
            THEN 'insufficient indicator coverage ('
                 || cast(indicators_matched as varchar) || '/'
                 || cast(indicators_in_fingerprint as varchar)
                 || ' — minimum {int(SCORER_MIN_COVERAGE * 100)}%)'
            ELSE cast(NULL as varchar)
        END AS suppression_reason,
        contains_predicted,
        cast(current_timestamp as timestamp) AS last_computed_at,
        '{PIPELINE_VERSION}' AS pipeline_version,
        cast(NULL as varchar) AS calibration_mapping_version
    FROM aggregated
    """
    logger.info("Inserting into country_recipe_scores (Phase 5b.6.6 v0.1)")
    run_query(sql)
    logger.info(f"Wrote {ATHENA_DB}.{COUNTRY_RECIPE_SCORES_TABLE_NAME}")


# ---------------------------------------------------------------------------
# Convergence view (#133)
# ---------------------------------------------------------------------------

def _country_region_pairs():
    for region, codes in COUNTRY_REGIONS.items():
        for code in sorted(codes):
            yield code, region


def _country_regions_values_sql():
    rows = ",\n            ".join(
        f"('{code}', '{region}')" for code, region in _country_region_pairs()
    )
    return f"(VALUES\n            {rows}\n        ) AS t(alpha_2, region)"


def create_convergence_view():
    """#133 convergence view — reads from recipes_normalized."""
    region_values = _country_regions_values_sql()
    sql = f"""
    CREATE OR REPLACE VIEW {ATHENA_DB}.{CONVERGENCE_VIEW_NAME} AS
    WITH country_regions AS (
        SELECT alpha_2, region FROM {region_values}
    ),
    countries_dedup AS (
        SELECT id, MAX(alpha_2) AS alpha_2
        FROM {ATHENA_DB}.countries
        WHERE alpha_2 IS NOT NULL AND alpha_2 != ''
        GROUP BY id
    ),
    predictor_counts AS (
        SELECT
            r.country_a_id           AS following_country_id,
            r.event_category,
            r.end_year_a,
            r.country_b_id           AS predictor_country_id,
            COUNT(*)                 AS recipe_count,
            MAX(r.pps)               AS predictor_best_pps,
            ARBITRARY(r.pattern_tier) AS predictor_best_tier
        -- #158 follow-up: read from normalized view so pps is globally comparable
        FROM {ATHENA_DB}.{RECIPES_NORMALIZED_VIEW_NAME} r
        GROUP BY r.country_a_id, r.event_category, r.end_year_a, r.country_b_id
    ),
    predictor_contributions AS (
        SELECT
            pc.following_country_id,
            pc.event_category,
            pc.end_year_a,
            pc.predictor_country_id,
            pc.recipe_count,
            pc.predictor_best_pps,
            pc.predictor_best_tier,
            pr.region                                  AS predictor_region,
            CASE
                WHEN fr.region IS NOT NULL
                 AND pr.region IS NOT NULL
                 AND fr.region = pr.region THEN 0.7
                ELSE 1.0
            END                                        AS region_factor,
            LN(1.0 + CAST(pc.recipe_count AS double)) *
                CASE
                    WHEN fr.region IS NOT NULL
                     AND pr.region IS NOT NULL
                     AND fr.region = pr.region THEN 0.7
                    ELSE 1.0
                END                                    AS contribution
        FROM predictor_counts pc
        LEFT JOIN countries_dedup cf ON cf.id = CAST(pc.following_country_id AS varchar)
        LEFT JOIN countries_dedup cp ON cp.id = CAST(pc.predictor_country_id AS varchar)
        LEFT JOIN country_regions fr ON fr.alpha_2 = cf.alpha_2
        LEFT JOIN country_regions pr ON pr.alpha_2 = cp.alpha_2
    ),
    forecast_aggregated AS (
        SELECT
            following_country_id,
            event_category,
            end_year_a,
            SUM(contribution)                                       AS convergence_score,
            COUNT(DISTINCT predictor_country_id)                    AS n_predictors,
            COUNT(DISTINCT predictor_region)                        AS n_regions,
            MAX(predictor_best_pps)                                 AS best_pps,
            ARBITRARY(predictor_best_tier)                          AS best_tier,
            ARRAY_AGG(predictor_country_id ORDER BY predictor_best_pps DESC) AS predictor_country_ids
        FROM predictor_contributions
        GROUP BY following_country_id, event_category, end_year_a
    )
    SELECT
        following_country_id,
        event_category,
        end_year_a,
        convergence_score,
        n_predictors,
        n_regions,
        best_pps,
        best_tier,
        predictor_country_ids,
        CASE
            WHEN n_predictors < 2          THEN 'single'
            WHEN convergence_score < 4.0   THEN 'emerging'
            WHEN convergence_score < 7.0   THEN 'multilateral'
            ELSE 'high'
        END                                                                AS convergence_tier,
        best_pps * LN(1.0 + convergence_score)                             AS composite_sort_key
    FROM forecast_aggregated
    """
    logger.info(f"Creating convergence view ({len(sql)} chars)")
    run_query(sql)
    logger.info(f"Convergence view {ATHENA_DB}.{CONVERGENCE_VIEW_NAME} created")


# ---------------------------------------------------------------------------
# Dashboard JSONs (#146)
# ---------------------------------------------------------------------------

def write_dashboard_jsons():
    current_year = datetime.now(timezone.utc).year
    results = {
        'ranking': _write_ranking_json(),
        'early_warning': _write_early_warning_json(current_year),
        'recipes_top50': _write_recipes_top50_json(current_year),
    }
    # #375 — country-risks.json (V1.8.1 scoring) auto-generated at pipeline end
    try:
        country_risks_summary = write_country_risks_json(
            run_query_fn=run_query,
            rows_fn=_rows_from_query_id,
            s3_client=s3,
            bucket=S3_BUCKET,
            athena_db=ATHENA_DB,
            cloudwatch_client=cloudwatch,  # #381 drift metric emission
        )
        results['country_risks'] = country_risks_summary
        logger.info(f"country-risks.json: {country_risks_summary}")
    except Exception as exc:  # noqa: BLE001
        # Non-fatal: the 3 core dashboard JSONs already landed; country-risks
        # was added in #375 and shouldn't block the pipeline on regression.
        # #409: emit CloudWatch metric so the 2026-04-22 silent-failure class
        # (2 days of missing regeneration before anyone noticed) cannot recur
        # without an alarm firing.
        logger.exception(f"country-risks.json generation failed: {exc}")
        results['country_risks'] = {'error': str(exc)}
        _emit_caught_exception('write_country_risks_json')
    return results


def _write_ranking_json():
    sql = f"""
    WITH c AS (
        SELECT id, MAX(name_1) AS name FROM {ATHENA_DB}.countries WHERE name_1 != '' GROUP BY id
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
        FROM {ATHENA_DB}.patterns p
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
    sql = f"""
    WITH c AS (
        SELECT id, MAX(name_1) AS name FROM {ATHENA_DB}.countries WHERE name_1 != '' GROUP BY id
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
    FROM {ATHENA_DB}.patterns p
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
    """Top 50 recipes via convergence view, reading through recipes_normalized
    for globally-comparable pps.
    """
    sql = f"""
    WITH joined AS (
        SELECT
            r.*,
            cv.convergence_score,
            cv.n_predictors,
            cv.n_regions,
            cv.convergence_tier,
            cv.predictor_country_ids,
            cv.composite_sort_key
        -- #158 follow-up: recipes_normalized for globally-comparable pps
        FROM {ATHENA_DB}.{RECIPES_NORMALIZED_VIEW_NAME} r
        INNER JOIN {ATHENA_DB}.{CONVERGENCE_VIEW_NAME} cv
            ON cv.following_country_id = r.country_a_id
           AND cv.event_category       = r.event_category
           AND cv.end_year_a           = r.end_year_a
        WHERE r.start_year_b < r.start_year_a
          AND (r.start_year_a + r.length) >= {current_year - 2}
          AND (r.start_year_a + r.length) <= {current_year + 3}
          AND cv.n_predictors >= 2
    ),
    ranked AS (
        SELECT j.*,
            ROW_NUMBER() OVER (PARTITION BY j.country_a_id   ORDER BY j.composite_sort_key DESC) AS country_rank,
            ROW_NUMBER() OVER (PARTITION BY j.event_category ORDER BY j.composite_sort_key DESC) AS cat_rank
        FROM joined j
    )
    SELECT * FROM ranked
    WHERE country_rank <= 3 AND cat_rank <= 10
    ORDER BY composite_sort_key DESC
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
            'instance_count': _to_int(r.get('instance_count')),
            'pattern_power_score': _to_float(r.get('pattern_power_score')),
            'pps': _to_float(r.get('pps')),
            'pattern_tier': r.get('pattern_tier'),
            'median_lead_time': _to_int(r.get('median_lead_time_b')),
            'min_lead_time': _to_int(r.get('min_lead_time_b')),
            'max_lead_time': _to_int(r.get('max_lead_time_b')),
            'convergence_score': _to_float(r.get('convergence_score')),
            'convergence_tier': r.get('convergence_tier'),
            'n_predictors': _to_int(r.get('n_predictors')),
            'n_regions': _to_int(r.get('n_regions')),
            'predictor_country_ids': _parse_id_array(r.get('predictor_country_ids')),
            'composite_sort_key': _to_float(r.get('composite_sort_key')),
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
    body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f'{DASHBOARD_PREFIX}/{filename}',
        Body=body,
        ContentType='application/json',
        CacheControl='public, max-age=300, s-maxage=86400',
    )
    logger.info(f"Wrote s3://{S3_BUCKET}/{DASHBOARD_PREFIX}/{filename} ({len(body)} bytes)")


def _rows_from_query_id(query_id):
    """Fetch result rows for an already-executed Athena query.

    Used by write_country_risks_json which follows the protocol
    `rows_fn(run_query_fn(sql))` — run_query_fn returns a query_id, rows_fn
    expects a query_id (NOT raw SQL). See country_risks.py callsites.
    """
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


def _run_query_to_rows(sql):
    """Convenience: execute sql + return rows. Used by dashboard-JSON builders
    that construct a query inline and want rows in one call."""
    return _rows_from_query_id(run_query(sql))


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


def _parse_id_array(value):
    if value is None or value == '':
        return []
    if isinstance(value, list):
        return [int(x) for x in value if x is not None]
    s = str(value).strip()
    if s.startswith('[') and s.endswith(']'):
        s = s[1:-1]
    out = []
    for piece in s.split(','):
        piece = piece.strip()
        if not piece:
            continue
        try:
            out.append(int(piece))
        except ValueError:
            continue
    return out


def run_query(sql):
    """Sync Athena query with 1s poll loop. Raises on FAILED/CANCELLED."""
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
        if state == 'SUCCEEDED':
            logger.info(f"Query {query_id}: SUCCEEDED")
            return query_id
        if state in ('FAILED', 'CANCELLED'):
            reason = status['QueryExecution']['Status'].get('StateChangeReason', 'unknown')
            logger.error(f"Query {query_id}: {state} - {reason}")
            raise RuntimeError(f"Athena query {state}: {reason}")
        time.sleep(1)
