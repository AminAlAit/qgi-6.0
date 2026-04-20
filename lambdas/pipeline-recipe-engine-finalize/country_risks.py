"""
country_risks.py — Compute country-risks.json from Athena (#375).

Mirrors the V1.8.1 scoring logic of qgi-ml/scripts/generate_country_risks.py
so the finalize Lambda produces dashboard/country-risks.json at pipeline end
without any manual step.

Public entry point:
    write_country_risks_json(
        run_query_fn,   # callable(sql) -> QueryExecutionId
        rows_fn,        # callable(query_id) -> list[dict]
        s3_client,
        bucket,
    )

The caller owns the Athena client + workgroup; this module is dependency-
injected for testability. Pure scoring functions have no AWS dependency and
are directly unit-testable.

Drama tier weights are EMBEDDED here to avoid a Lambda-time S3 dependency on
qgi-data/reference/category_drama_tiers.json. If tiers change there, update
DRAMA_TIER_WEIGHTS below and redeploy. Follow-up ticket: extract to a shared
module + sync-on-boot loader.
"""
import json
import math
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Constants (V1.8.1 — mirrors qgi-ml/scripts/generate_country_risks.py)
# ---------------------------------------------------------------------------
TIERS = {'S': (3, 8), 'M': (9, 20), 'L': (21, 40), 'XL': (41, 999)}

# Curated country IDs (55 countries with verified event histories as of 2026-04).
# NOTE: grows as verification widens — synced with generate_country_risks.py.
CURATED_IDS = frozenset({
    1, 3, 6, 10, 18, 28, 31, 44, 45, 48, 54, 62, 63, 66, 69, 74, 81,
    82, 100, 101, 102, 103, 106, 107, 112, 113, 114, 117, 121, 124,
    131, 140, 147, 149, 159, 162, 167, 174, 176, 182, 195, 205, 206,
    208, 212, 217, 221, 227, 228, 233, 234, 235, 242, 243, 248,
})

# Embedded drama tier weights. Mirrors qgi-data/reference/category_drama_tiers.json
# (last synced 2026-04-13). Unknown categories fall through to DEFAULT_DRAMA_WEIGHT.
DRAMA_TIER_WEIGHTS = {
    # 1.0 — high-consequence
    'civil_war_and_insurgency': 1.0, 'interstate_war': 1.0, 'military_coup': 1.0,
    'political_violence': 1.0, 'ethnic_and_communal_conflict': 1.0,
    'terrorist_attack': 1.0, 'resource_conflict': 1.0, 'foreign_intervention': 1.0,
    'rocket_attack': 1.0, 'west_bank_violence': 1.0, 'israeli_military_operation': 1.0,
    'humanitarian_crisis': 1.0, 'humanitarian_crisi': 1.0,
    # 0.8 — serious
    'banking_and_financial_crisis': 0.8, 'currency_crisis': 0.8,
    'economic_crisi': 0.8, 'economic_recession': 0.8,
    'sanctions_and_arms_embargo': 0.8, 'territorial_disputes': 0.8,
    'mass_protest': 0.8, 'political_unrest': 0.8, 'political_repression': 0.8,
    'human_rights_violation': 0.8, 'poverty_and_inequality_crisis': 0.8,
    'migration_and_refugees': 0.8, 'epidemic_and_pandemic': 0.8,
    'media_freedom_concern': 0.8, 'political_corruption': 0.8,
    # 0.6 — notable
    'democratic_transition': 0.6, 'executive_power_consolidation': 0.6,
    'constitutional_change': 0.6, 'constitutional_referendum': 0.6,
    'elections_and_voting': 0.6, 'presidential_election': 0.6,
    'parliamentary_election': 0.6, 'diplomatic_rupture': 0.6,
    'ceasefire_agreement': 0.6, 'peacekeeping_and_peace_process': 0.6,
    'fiscal_policy_change': 0.6, 'monetary_policy_change': 0.6,
    'economic_nationalization': 0.6, 'economic_liberalization': 0.6,
    'labor_action': 0.6, 'transitional_justice': 0.6, 'human_rights_reform': 0.6,
    'judicial_reform': 0.6, 'political_reform': 0.6, 'military_policy_and_reform': 0.6,
    # 0.4 — moderate
    'government_formation': 0.4, 'bilateral_treaty': 0.4,
    'multilateral_agreement': 0.4, 'trade_agreement': 0.4,
    'economic_reform': 0.4, 'economic_policy_reform': 0.4,
    'economic_recovery': 0.4, 'economic_growth': 0.4,
    'economic_growth_milestone': 0.4, 'economic_diversification': 0.4,
    'economic_challenge': 0.4, 'economic_initiative': 0.4,
    'diplomatic_effort': 0.4, 'international_diplomacy': 0.4,
    'international_diplomatic_engagement': 0.4, 'international_relation': 0.4,
    'regional_cooperation': 0.4, 'regional_integration': 0.4,
    'regional_security_contribution': 0.4, 'foreign_aid_and_development': 0.4,
    'foreign_direct_investment': 0.4, 'increase_in_foreign_investment': 0.4,
    'public_sector_reform': 0.4, 'natural_disaster': 0.4,
    'flood_and_cyclone': 0.4, 'covid19_response': 0.4, 'pandemic_response': 0.4,
    'oil_and_gas': 0.4, 'energy_policy': 0.4, 'energy_export_expansion': 0.4,
    'trade_economic_strategy': 0.4, 'anticorruption_measure': 0.4,
    # 0.2 — low-drama (abbreviated; most health/env/digital categories)
    'health_sector_initiative': 0.2, 'health_care_system_reform': 0.2,
    'health_sector_improvement': 0.2, 'healthcare_advancement': 0.2,
    'healthcare_improvement': 0.2, 'healthcare_innovation': 0.2,
    'healthcare_reform': 0.2, 'healthcare_system_modernization': 0.2,
    'public_health_campaign': 0.2, 'public_health_initiative': 0.2,
    'public_health_reform': 0.2, 'social_policy_reform': 0.2,
    'social_program': 0.2, 'social_welfare_enhancement': 0.2,
    'social_equity_program': 0.2, 'environmental_policy': 0.2,
    'environmental_policie': 0.2, 'environmental_legislation': 0.2,
    'environmental_protection': 0.2, 'environmental_program': 0.2,
    'environmental_effort': 0.2, 'environmental_conservation': 0.2,
    'environmental_conservation_initiative': 0.2, 'environmental_initiative': 0.2,
    'environmental_awareness': 0.2, 'climate_action_plan': 0.2,
    'climate_agreement': 0.2, 'green_finance_initiative': 0.2,
    'renewable_energy': 0.2, 'renewable_energy_initiative': 0.2,
    'renewable_energy_project': 0.2, 'digital_policy': 0.2,
    'digital_transformation': 0.2, 'cybersecurity_enhancement': 0.2,
    'eu_policy_influence': 0.2, 'arctic_policy': 0.2, 'agricultural_policy': 0.2,
    # 0.05 — routine / suppress
    'infrastructure_project': 0.05, 'infrastructure_development': 0.05,
    'infrastructure_investment': 0.05, 'education_reform': 0.05,
    'education_initiative': 0.05, 'education_system_overhaul': 0.05,
    'educational_initiative': 0.05, 'educational_reform': 0.05,
    'cultural_promotion': 0.05, 'cultural_and_heritage': 0.05,
    'cultural_celebration': 0.05, 'cultural_festival': 0.05,
    'cultural_heritage': 0.05, 'cultural_heritage_preservation': 0.05,
    'cultural_initiative': 0.05, 'international_cultural_exchange_program': 0.05,
    'sport_and_international_event': 0.05, 'sports_achievement': 0.05,
    'fifa_world_cup': 0.05, 'tourism_development_strategy': 0.05,
    'sustainable_tourism_development': 0.05, 'technological_advancement': 0.05,
    'technological_innovation': 0.05, 'technological_innovation_initiative': 0.05,
}
DEFAULT_DRAMA_WEIGHT = 0.3  # same as qgi-ml/scripts/generate_country_risks.py

S3_KEY = 'dashboard/country-risks.json'
VERSION = 'V1.8.1'


# ---------------------------------------------------------------------------
# Pure scoring functions (unit-testable, no AWS dependency)
# ---------------------------------------------------------------------------
def drama_weight(category):
    """Return the drama tier weight for a category, falling back to default."""
    return DRAMA_TIER_WEIGHTS.get(category, DEFAULT_DRAMA_WEIGHT)


def zscore_per_country(preds):
    """Per-country z-score normalization of prediction scores.

    Input: {(country_id, category): raw_score}
    Output: {(country_id, category): z_score}

    Single-prediction countries pass through unchanged (no std).
    """
    by_country = defaultdict(dict)
    for (cid, cat), s in preds.items():
        by_country[cid][(cid, cat)] = s
    result = {}
    for cid, cp in by_country.items():
        vals = list(cp.values())
        if len(vals) < 2:
            result.update(cp)
            continue
        mean = sum(vals) / len(vals)
        std = max((sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5, 1e-6)
        for key, score in cp.items():
            result[key] = (score - mean) / std
    return result


def rank_fusion(recipe_preds, persist_preds, k=60):
    """Reciprocal Rank Fusion of two prediction sources.

    RRF formula: sum_i 1 / (k + rank_i). Missing keys get max_rank.
    """
    rr = {key: i + 1 for i, (key, _) in enumerate(
        sorted(recipe_preds.items(), key=lambda x: -x[1]))}
    pr = {key: i + 1 for i, (key, _) in enumerate(
        sorted(persist_preds.items(), key=lambda x: -x[1]))}
    all_keys = set(recipe_preds.keys()) | set(persist_preds.keys())
    max_rank = len(all_keys) + 1
    return {
        key: 1 / (k + rr.get(key, max_rank)) + 1 / (k + pr.get(key, max_rank))
        for key in all_keys
    }


def risk_tier_label(top_salience, top_drama_weight):
    """Category-stratified risk tier (HIGH / MODERATE / INDICATIVE).

    Mirrors qgi-ml/scripts/generate_country_risks.py::risk_tier_label exactly.
    Crisis categories (drama_weight >= 1.0) use a lower threshold at both HIGH
    and MODERATE cuts; regular categories use the stricter bar. Rationale
    documented in the source script (#339 Sonnet advisor review).
    """
    CRISIS_HIGH_THRESHOLD = 1.4
    REGULAR_HIGH_THRESHOLD = 1.625
    CRISIS_MODERATE_THRESHOLD = 1.0
    REGULAR_MODERATE_THRESHOLD = 1.3

    is_crisis = top_drama_weight >= 1.0
    high_cut = CRISIS_HIGH_THRESHOLD if is_crisis else REGULAR_HIGH_THRESHOLD
    moderate_cut = (
        CRISIS_MODERATE_THRESHOLD if is_crisis else REGULAR_MODERATE_THRESHOLD
    )

    if top_salience >= high_cut:
        return 'HIGH'
    if top_salience >= moderate_cut:
        return 'MODERATE'
    return 'INDICATIVE'


def _to_int_safe(value):
    """Coerce Athena string cell to int; returns None on malformed input."""
    if value is None or value == '':
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _to_float_safe(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Aggregator (runs Athena queries via injected callables)
# ---------------------------------------------------------------------------
def compute_country_risks(run_query_fn, rows_fn, athena_db='qgi_data'):
    """Run Athena queries + V1.8.1 scoring, return the country-risks payload.

    Args:
        run_query_fn: callable(sql) -> QueryExecutionId. Must block until done.
        rows_fn:      callable(query_id) -> list[dict] mapping column names to
                      string cell values (matches lambda_function._run_query_to_rows).
        athena_db:    Athena database name.

    Returns:
        dict — the country-risks.json payload, ready for json.dumps.
    """
    # 1. Country names + alpha-2
    country_names, alpha2 = {}, {}
    country_rows = rows_fn(run_query_fn(
        f'SELECT id, name_1, alpha_2 FROM {athena_db}.countries WHERE name_1 IS NOT NULL'
    ))
    for r in country_rows:
        cid = _to_int_safe(r.get('id'))
        if cid is not None:
            country_names[cid] = r.get('name_1') or f'#{cid}'
            alpha2[cid] = r.get('alpha_2') or ''

    # 2. Recency (last event year per (country, category))
    recency = {}
    rec_rows = rows_fn(run_query_fn(
        f'SELECT country_id, category_normalized, max(year) as y '
        f'FROM {athena_db}.events WHERE category_normalized IS NOT NULL '
        f'GROUP BY country_id, category_normalized'
    ))
    for r in rec_rows:
        cid = _to_int_safe(r.get('country_id'))
        cat = r.get('category_normalized')
        yr = _to_int_safe(r.get('y'))
        if cid is not None and cat and yr is not None:
            recency[(cid, cat)] = yr

    # 3. Persistence (per-year event rate, 2023-2025 window)
    persist = {}
    per_rows = rows_fn(run_query_fn(
        f'SELECT country_id, category_normalized, count(*) as c '
        f'FROM {athena_db}.events WHERE year BETWEEN 2023 AND 2025 '
        f'AND category_normalized IS NOT NULL '
        f'GROUP BY country_id, category_normalized'
    ))
    for r in per_rows:
        cid = _to_int_safe(r.get('country_id'))
        cat = r.get('category_normalized')
        cnt = _to_float_safe(r.get('c'))
        if cid is not None and cat and cnt is not None:
            persist[(cid, cat)] = cnt / 3.0

    # 4. Per-tier scoring
    countries_data = {}  # cid -> tier -> [category dicts]
    for tier_name, (lo, hi) in TIERS.items():
        # Partner-eligible counts (pattern length in [lo, hi])
        pe = {}
        pe_rows = rows_fn(run_query_fn(
            f'SELECT country_a_id, count(DISTINCT country_b_id) as p '
            f'FROM {athena_db}.scdis WHERE length BETWEEN {lo} AND {hi} '
            f'GROUP BY country_a_id'
        ))
        for r in pe_rows:
            p = _to_int_safe(r.get('p'))
            if p is not None and r.get('country_a_id'):
                pe[r['country_a_id']] = p

        # Recipe aggregates
        recipes = rows_fn(run_query_fn(
            f"SELECT country_a_id, event_category, count(*) as c, "
            f"avg(avg_correlation) as a, avg(indicator_count) as i "
            f"FROM {athena_db}.recipes WHERE event_category IS NOT NULL "
            f"AND length BETWEEN {lo} AND {hi} "
            f"GROUP BY country_a_id, event_category"
        ))

        scored, recipe_counts = {}, {}
        for r in recipes:
            cid = _to_int_safe(r.get('country_a_id'))
            cat = r.get('event_category')
            cnt = _to_float_safe(r.get('c'))
            avg_corr = _to_float_safe(r.get('a'))
            ind_cnt = _to_float_safe(r.get('i'))
            if cid is None or not cat or cnt is None or avg_corr is None or ind_cnt is None:
                continue
            partners = pe.get(r.get('country_a_id'), pe.get(str(cid), 5))
            prevalence = cnt / max(partners, 5)
            score = (0.30 * math.log(prevalence + 0.01)
                     + 0.40 * avg_corr
                     + 0.15 * math.log(ind_cnt + 1)
                     + 0.15)
            ly = recency.get((cid, cat))
            if ly:
                score += 0.15 * (0.85 ** max(2025 - ly, 0))
            scored[(cid, cat)] = score
            recipe_counts[(cid, cat)] = int(cnt)

        # z-score + RRF
        zscored = zscore_per_country(scored)
        fused = rank_fusion(zscored, persist)
        ranked = sorted(fused.items(), key=lambda x: -x[1])
        rank_map = {key: i + 1 for i, (key, _) in enumerate(ranked)}

        for (cid, cat), rrf_score in fused.items():
            countries_data.setdefault(cid, {}).setdefault(tier_name, []).append({
                'category': cat,
                'z_score': round(zscored.get((cid, cat), 0), 3),
                'salience_score': round(zscored.get((cid, cat), 0) * drama_weight(cat), 4),
                'drama_tier': drama_weight(cat),
                'rrf_rank': rank_map.get((cid, cat), 9999),
                'rrf_score': round(rrf_score, 6),
                'recipe_count': recipe_counts.get((cid, cat), 0),
                'last_event_year': recency.get((cid, cat)),
            })

    # 5. Build output
    output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'version': VERSION,
        'scoring': 'z-score per country + RRF ensemble with persistence',
        'tiers': {k: {'min_length': v[0], 'max_length': v[1]} for k, v in TIERS.items()},
        'curated_country_count': len(CURATED_IDS),
        'total_countries': 0,
        'countries': {},
    }

    for cid, tiers in countries_data.items():
        country_entry = {
            'name': country_names.get(cid, f'#{cid}'),
            'alpha_2': alpha2.get(cid, ''),
            'curated': cid in CURATED_IDS,
            'tiers': {},
            'overall_risk_tier': 'INDICATIVE',
        }
        max_salience, top_dw = -999, DEFAULT_DRAMA_WEIGHT
        for tier_name in TIERS:
            cats = tiers.get(tier_name, [])
            cats.sort(key=lambda x: -x['salience_score'])
            country_entry['tiers'][tier_name] = {'top_categories': cats[:10]}
            for c in cats[:5]:
                if c['salience_score'] > max_salience:
                    max_salience = c['salience_score']
                    top_dw = c['drama_tier']
        country_entry['overall_risk_tier'] = risk_tier_label(max_salience, top_dw)
        output['countries'][str(cid)] = country_entry

    output['total_countries'] = len(output['countries'])
    return output


def write_country_risks_json(run_query_fn, rows_fn, s3_client, bucket, athena_db='qgi_data'):
    """Top-level entry point called from the finalize Lambda.

    Runs the full scoring pipeline, writes the output JSON to S3, and returns
    a summary dict for logging.
    """
    payload = compute_country_risks(run_query_fn, rows_fn, athena_db=athena_db)
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    s3_client.put_object(
        Bucket=bucket,
        Key=S3_KEY,
        Body=body,
        ContentType='application/json',
        CacheControl='public, max-age=300, s-maxage=86400',
    )
    tier_counts = Counter(c['overall_risk_tier'] for c in payload['countries'].values())
    return {
        'countries': payload['total_countries'],
        'curated': payload['curated_country_count'],
        'bytes': len(body),
        'tiers': dict(tier_counts),
    }
