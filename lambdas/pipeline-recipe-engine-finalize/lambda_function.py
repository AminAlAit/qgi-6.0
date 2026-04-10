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

logger = logging.getLogger()
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get('S3_BUCKET')
ATHENA_DB = os.environ.get('ATHENA_DATABASE', 'qgi_data')
ATHENA_WG = os.environ.get('ATHENA_WORKGROUP', 'QGI-Lambda-Workgroup')
DASHBOARD_PREFIX = 'dashboard'
RANKING_LIMIT = 1000

RECIPES_NORMALIZED_VIEW_NAME = "recipes_normalized"
CONVERGENCE_VIEW_NAME = "recipe_convergence"

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

    # Step 2: recipes_normalized view (#158 follow-up)
    create_recipes_normalized_view()

    # Step 3: convergence view (#133) — reads from recipes_normalized
    convergence_status = 'skipped'
    if cutoff_year is None:
        try:
            create_convergence_view()
            convergence_status = 'ok'
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Failed to create convergence view: {exc}")
            convergence_status = f'error: {exc}'

    # Step 4: dashboard JSONs (#146)
    dashboard_results = {}
    if cutoff_year is None:
        try:
            dashboard_results = write_dashboard_jsons()
            logger.info(f"Dashboard JSONs written: {dashboard_results}")
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Failed to write dashboard JSONs: {exc}")
            dashboard_results = {'error': str(exc)}

    return {
        'statusCode': 200,
        'recipes_count': total_recipes,
        'top_categories': top_categories,
        'convergence_view': convergence_status,
        'dashboard': dashboard_results,
        'partitions_total': partitions_total,
    }


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

    Downstream consumers (convergence view + top50 dashboard query) read
    from this view instead of recipes directly.

    Requires Athena engine v3 for `SELECT * EXCEPT`. Confirmed live in
    QGI-Lambda-Workgroup.
    """
    sql = f"""
    CREATE OR REPLACE VIEW {ATHENA_DB}.{RECIPES_NORMALIZED_VIEW_NAME} AS
    SELECT
        r.* EXCEPT (pps),
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
    FROM {ATHENA_DB}.recipes r
    CROSS JOIN (
        SELECT
            cast(max(instance_count) as double)  AS max_inst,
            cast(max(indicator_count) as double) AS max_ind
        FROM {ATHENA_DB}.recipes
    ) g
    """
    logger.info("Creating recipes_normalized view (global pps)")
    run_query(sql)
    logger.info(f"View {ATHENA_DB}.{RECIPES_NORMALIZED_VIEW_NAME} created")


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
    return {
        'ranking': _write_ranking_json(),
        'early_warning': _write_early_warning_json(current_year),
        'recipes_top50': _write_recipes_top50_json(current_year),
    }


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


def _run_query_to_rows(sql):
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
