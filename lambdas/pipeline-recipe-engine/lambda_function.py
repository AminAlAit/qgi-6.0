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

# ---------------------------------------------------------------------------
# #133: Country → region map for the convergence score view.
#
# Used to compute a region_diversity_factor when aggregating recipe contributions:
#   - 1.0 if predictor and following country are in different regions
#   - 0.7 if same region
# This rewards multi-source convergence that crosses geographic boundaries.
#
# Six broad regions, sufficient for QGI's purposes (we don't need UN-perfect
# accuracy — just a stable group label for the diversity bonus). Source of
# truth lives here in code; the recipe engine emits a VALUES clause for the
# Athena view at materialization time.
# ---------------------------------------------------------------------------
COUNTRY_REGIONS = {
    "AFR": {  # Sub-Saharan Africa
        "AO","BF","BI","BJ","BW","CD","CF","CG","CI","CM","CV","DJ","ER","ET","GA",
        "GH","GM","GN","GQ","GW","KE","KM","LR","LS","MG","ML","MR","MU","MW","MZ",
        "NA","NE","NG","RE","RW","SC","SH","SL","SN","SO","SS","ST","SZ","TD","TG",
        "TZ","UG","YT","ZA","ZM","ZW",
    },
    "MEA": {  # Middle East + North Africa
        "AE","BH","DZ","EG","EH","IL","IQ","IR","JO","KW","LB","LY","MA","OM","PS",
        "QA","SA","SD","SY","TN","TR","YE",
    },
    "EUR": {  # Europe (incl. Russia, ex-USSR western republics)
        "AD","AL","AT","AX","BA","BE","BG","BY","CH","CY","CZ","DE","DK","EE","ES",
        "FI","FO","FR","GB","GG","GI","GL","GR","HR","HU","IE","IM","IS","IT","JE",
        "LI","LT","LU","LV","MC","MD","ME","MK","MT","NL","NO","PL","PT","RO","RS",
        "RU","SE","SI","SJ","SK","SM","UA","VA","XK",
    },
    "ASI": {  # Asia (Central, East, South, Southeast)
        "AF","AM","AZ","BD","BN","BT","CC","CN","CX","GE","HK","ID","IN","IO","JP",
        "KG","KH","KP","KR","KZ","LA","LK","MM","MN","MO","MV","MY","NP","PH","PK",
        "SG","TH","TJ","TL","TM","TW","UZ","VN",
    },
    "AMR": {  # Americas (North, Central, South, Caribbean)
        "AG","AI","AN","AR","AW","BB","BL","BM","BO","BQ","BR","BS","BZ","CA","CL",
        "CO","CR","CU","CW","DM","DO","EC","FK","GD","GF","GP","GS","GT","GY","HN",
        "HT","JM","KN","KY","LC","MF","MQ","MS","MX","NI","PA","PE","PM","PR","PY",
        "SR","SV","SX","TC","TT","US","UY","VC","VE","VG","VI",
    },
    "OCE": {  # Oceania + remote islands / Antarctica
        "AQ","AS","AU","BV","CK","FJ","FM","GU","HM","KI","MH","MP","NC","NF","NR",
        "NU","NZ","PF","PG","PN","PW","SB","TF","TK","TO","TV","UM","VU","WF","WS",
    },
}


def _country_region_pairs():
    """Yield (alpha_2, region) tuples flattened from COUNTRY_REGIONS."""
    for region, codes in COUNTRY_REGIONS.items():
        for code in sorted(codes):
            yield code, region


def _country_regions_values_sql():
    """Render COUNTRY_REGIONS as a SQL VALUES clause for an Athena CTE."""
    rows = ",\n            ".join(
        f"('{code}', '{region}')" for code, region in _country_region_pairs()
    )
    return f"(VALUES\n            {rows}\n        ) AS t(alpha_2, region)"

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

    # 6. Create convergence view (#133) — must run BEFORE dashboard JSONs
    # so that _write_recipes_top50_json can read from it.
    convergence_status = 'skipped'
    if cutoff_year is None:
        try:
            create_convergence_view()
            convergence_status = 'ok'
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Failed to create convergence view: {exc}")
            convergence_status = f'error: {exc}'

    # 7. Pre-compute dashboard JSONs (#146)
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
        'convergence_view': convergence_status,
        'dashboard': dashboard_results,
    }


# ---------------------------------------------------------------------------
# Convergence view (#133)
# ---------------------------------------------------------------------------

CONVERGENCE_VIEW_NAME = "recipe_convergence"


def create_convergence_view():
    """Create or replace the recipe_convergence Athena view (#133).

    Aggregates recipes per (following_country, event_category, end_year_a) and
    computes a `convergence_score` that rewards multiple distinct predictor
    countries — especially predictors from different geographic regions.

    Formula:
        contribution_per_predictor = ln(1 + recipe_count) * region_diversity_factor
        convergence_score          = SUM(contributions)

    Where region_diversity_factor is 1.0 if the predictor is in a different
    region than the following country, 0.7 if same region. Log-dampening
    prevents a single prolific predictor from dominating.

    Convergence is kept ORTHOGONAL to PPS (#129) — not multiplied into it —
    so each dimension is auditable independently. Downstream queries that
    want a composite ranking compute `pps * ln(1 + convergence_score)` at
    SELECT time.

    The view exposes ALL forecasts including single-signal ones; the Top 50
    pre-compute (and downstream consumers) decide whether to filter on
    n_predictors >= 2.
    """
    region_values = _country_regions_values_sql()
    sql = f"""
    CREATE OR REPLACE VIEW qgi_data.{CONVERGENCE_VIEW_NAME} AS
    WITH country_regions AS (
        SELECT alpha_2, region FROM {region_values}
    ),
    countries_dedup AS (
        -- The legacy countries table has multiple name rows per id; collapse
        SELECT id, MAX(alpha_2) AS alpha_2
        FROM qgi_data.countries
        WHERE alpha_2 IS NOT NULL AND alpha_2 != ''
        GROUP BY id
    ),
    -- Step 1: per (following, category, end_year_a, predictor) — how many
    -- recipe matches contributed, plus the strongest pps among them.
    predictor_counts AS (
        SELECT
            r.country_a_id           AS following_country_id,
            r.event_category,
            r.end_year_a,
            r.country_b_id           AS predictor_country_id,
            COUNT(*)                 AS recipe_count,
            MAX(r.pps)               AS predictor_best_pps,
            ARBITRARY(r.pattern_tier) AS predictor_best_tier
        FROM qgi_data.recipes r
        GROUP BY r.country_a_id, r.event_category, r.end_year_a, r.country_b_id
    ),
    -- Step 2: resolve regions for both following and predictor countries,
    -- compute the per-predictor contribution.
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
    -- Step 3: aggregate to one row per forecast.
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
    logger.info(f"Convergence view qgi_data.{CONVERGENCE_VIEW_NAME} created")


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
    """Diversity-capped top-50 recipes, ranked by composite (pps × convergence).

    #129: recipes is pre-deduplicated at source — no MAX(...) GROUP BY needed.
    #133: ranking joins to the convergence view and orders by the composite
    sort key (best_pps * ln(1 + convergence_score)). Filters to forecasts
    with n_predictors >= 2 so the "Top 50" is genuinely multi-source.
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
        FROM qgi_data.recipes r
        INNER JOIN qgi_data.{CONVERGENCE_VIEW_NAME} cv
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
            'instance_count': _to_int(r.get('instance_count')),  # #129
            'pattern_power_score': _to_float(r.get('pattern_power_score')),  # legacy
            'pps': _to_float(r.get('pps')),  # #129 — new normalized 0-100 score
            'pattern_tier': r.get('pattern_tier'),  # #128
            # #133: convergence fields from the recipe_convergence view
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


def _parse_id_array(value):
    """Athena returns array<smallint> as a string like '[1, 5, 23]'. Parse to list[int]."""
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


def build_recipe_query(cutoff_year=None):
    """Build CTAS query that JOINs patterns with events using D4/D5 logic.

    The CTAS produces ONE row per recipe_id. The previous version emitted one
    row per (pattern × eventA × eventB) match, leading to massive duplication
    that downstream consumers had to collapse with `MAX(...) GROUP BY recipe_id`.
    Source-side aggregation (#129) eliminates that duplication permanently and
    populates the `instance_count` column the Glue schema has always had.

    Three CTEs:
      1. raw_recipes      — the old INNER JOIN, exploded form
      2. recipes_aggregated — collapsed to one row per recipe_id, COUNT(*) for
                              instance_count, MIN(event_year_*) for the earliest
                              precedent
      3. global_stats     — single-row max values for normalising the 0-100 PPS

    Athena CTAS rules:
      - Partition columns must be the LAST column(s) in the final SELECT
      - CTE chains may reference each other in declaration order
    """
    pattern_filter = ""
    event_filter_a = ""
    event_filter_b = ""
    if cutoff_year:
        pattern_filter = (
            f"WHERE (p.start_year_a + p.length) <= {cutoff_year} "
            f"AND (p.start_year_b + p.length) <= {cutoff_year}"
        )
        event_filter_a = f"AND ea.year <= {cutoff_year}"
        event_filter_b = f"AND eb.year <= {cutoff_year}"

    return f"""
    CREATE TABLE qgi_data.recipes
    WITH (
        format = 'PARQUET',
        write_compression = 'SNAPPY',
        partitioned_by = ARRAY['country_a_id']
    ) AS

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
            -- #128: tier with length-derived fallback for legacy rows
            COALESCE(
                p.pattern_tier,
                CASE
                    WHEN p.length BETWEEN 3 AND 8  THEN 'S'
                    WHEN p.length BETWEEN 9 AND 20 THEN 'M'
                    WHEN p.length BETWEEN 21 AND 40 THEN 'L'
                    ELSE 'XL'
                END
            ) AS pattern_tier
        FROM qgi_data.patterns p
        INNER JOIN qgi_data.events ea
            ON ea.country_id = p.country_a_id
            AND ea.year BETWEEN
                (p.start_year_a + p.length - greatest(1, cast(ceil(p.length * 0.15) as integer)))
                AND
                (p.start_year_a + p.length + greatest(1, cast(ceil(p.length * 0.15) as integer)))
            {event_filter_a}
        INNER JOIN qgi_data.events eb
            ON eb.country_id = p.country_b_id
            AND eb.category_normalized = ea.category_normalized
            AND eb.year BETWEEN
                (p.start_year_b + p.length - greatest(1, cast(ceil(p.length * 0.15) as integer)))
                AND
                (p.start_year_b + p.length + greatest(1, cast(ceil(p.length * 0.15) as integer)))
            {event_filter_b}
        LEFT JOIN qgi_data.countries ca ON cast(ca.id as integer) = p.country_a_id
        LEFT JOIN qgi_data.countries cb ON cast(cb.id as integer) = p.country_b_id
        {pattern_filter}
    ),
    -- #129: collapse the (pattern × eventA × eventB) explosion to one row per
    -- recipe_id and count the instances along the way.
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
            country_a_id
        FROM raw_recipes
        GROUP BY recipe_id, country_a_id
    ),
    -- #129: single-row maxima for the normalised 0-100 PPS. CROSS JOIN
    -- broadcasts these scalars onto every recipe row at zero scan cost.
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
        -- #129: new normalized 0-100 PPS. Weights 0.35/0.30/0.20/0.15 are
        -- initial; lock after V1.5.3 backtesting (#130) calibrates them
        -- empirically via logistic regression on verified recipes.
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
