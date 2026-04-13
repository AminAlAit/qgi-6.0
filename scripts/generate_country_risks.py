#!/usr/bin/env python3
"""
Generate country-risks.json for the QGI frontend.

Pre-computes V1.8.1 z-score + RRF scores per (country, category, tier)
so the Country Intelligence Browser reads from a static JSON instead of
live Athena queries. Cost: $0 per page view.

Usage:
    python generate_country_risks.py \
        --bucket qgi-data-lake-222222222222 \
        --region eu-central-1 \
        --output country-risks.json \
        --upload
"""

import argparse
import boto3
import json
import math
import os
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
TIERS = {'S': (3, 8), 'M': (9, 20), 'L': (21, 40), 'XL': (41, 999)}
WORKGROUP = 'QGI-Lambda-Workgroup'

# Curated country IDs (55 countries with verified event histories)
CURATED_IDS = {
    1, 3, 6, 10, 18, 28, 31, 44, 45, 48, 54, 62, 63, 66, 69, 74, 81,
    82, 100, 101, 102, 103, 106, 107, 112, 113, 114, 117, 121, 124,
    131, 140, 147, 149, 159, 162, 167, 174, 176, 182, 195, 205, 206,
    208, 212, 217, 221, 227, 228, 233, 234, 235, 242, 243, 248,
}


# ---------------------------------------------------------------------------
# Athena helper
# ---------------------------------------------------------------------------
def run_query(athena, sql, bucket):
    r = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={'Database': 'qgi_data'},
        WorkGroup=WORKGROUP,
        ResultConfiguration={'OutputLocation': f's3://{bucket}/query_results/'},
    )
    qid = r['QueryExecutionId']
    while True:
        time.sleep(2)
        s = athena.get_query_execution(QueryExecutionId=qid)['QueryExecution']['Status']
        if s['State'] in ('SUCCEEDED', 'FAILED', 'CANCELLED'):
            break
    if s['State'] != 'SUCCEEDED':
        print(f"  QUERY FAILED: {s.get('StateChangeReason', '?')[:200]}")
        return []
    rows, result = [], athena.get_query_results(QueryExecutionId=qid, MaxResults=1000)
    cols = [c['Name'] for c in result['ResultSet']['ResultSetMetadata']['ColumnInfo']]
    for row in result['ResultSet']['Rows'][1:]:
        rows.append({cols[i]: row['Data'][i].get('VarCharValue') for i in range(len(cols))})
    while 'NextToken' in result:
        result = athena.get_query_results(
            QueryExecutionId=qid, NextToken=result['NextToken'], MaxResults=1000)
        for row in result['ResultSet']['Rows']:
            rows.append({cols[i]: row['Data'][i].get('VarCharValue') for i in range(len(cols))})
    return rows


# ---------------------------------------------------------------------------
# Scoring (V1.8.1 — matches run_backtest.py)
# ---------------------------------------------------------------------------
def zscore_per_country(preds):
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


# ---------------------------------------------------------------------------
# Drama tiers (salience-finding: high-consequence events rank higher)
# ---------------------------------------------------------------------------
def load_drama_tiers():
    """Load category drama tier weights from qgi-data/reference/category_drama_tiers.json."""
    import os
    path = os.path.join(os.path.dirname(__file__), '..', '..', 'qgi-data', 'reference', 'category_drama_tiers.json')
    try:
        with open(path) as f:
            data = json.load(f)
        lookup = {}
        for weight_str, tier_info in data['tiers'].items():
            weight = float(weight_str)
            for cat in tier_info['categories']:
                lookup[cat] = weight
        return lookup
    except FileNotFoundError:
        print(f"  WARNING: {path} not found, drama tiers disabled")
        return {}


DRAMA_TIERS = load_drama_tiers()


def drama_weight(category):
    """Get drama tier weight for a category. Default 0.3 for unmapped categories."""
    return DRAMA_TIERS.get(category, 0.3)


def risk_tier_label(max_zscore):
    """Convert max z-score to a risk tier label.

    Thresholds tuned 2026-04-12: raised from 1.5/0.5 to 2.0/1.0 because
    per-country z-score normalization guarantees every country has at least
    one outlier category, inflating the old HIGH tier to 97/126 (77%).
    New thresholds produce a more meaningful distribution.
    """
    if max_zscore >= 1.2:
        return "HIGH"
    elif max_zscore >= 0.5:
        return "MODERATE"
    else:
        return "INDICATIVE"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='Generate country-risks.json')
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--region', default='eu-central-1')
    parser.add_argument('--output', default='country-risks.json')
    parser.add_argument('--upload', action='store_true', help='Upload to S3 dashboard/')
    args = parser.parse_args()

    athena = boto3.client('athena', region_name=args.region)
    s3 = boto3.client('s3', region_name=args.region)

    # 1. Load country names
    print("Loading countries...")
    cn = {}
    alpha2 = {}
    for r in run_query(athena, 'SELECT id, name_1, alpha_2 FROM qgi_data.countries WHERE name_1 IS NOT NULL', args.bucket):
        try:
            cid = int(float(r['id']))
            cn[cid] = r['name_1']
            alpha2[cid] = r.get('alpha_2', '')
        except:
            pass
    print(f"  {len(cn)} countries")

    # 2. Load recency
    print("Loading recency...")
    recency = {}
    for r in run_query(athena,
            'SELECT country_id, category_normalized, max(year) as y '
            'FROM qgi_data.events WHERE category_normalized IS NOT NULL '
            'GROUP BY country_id, category_normalized', args.bucket):
        try:
            recency[(int(float(r['country_id'])), r['category_normalized'])] = int(r['y'])
        except:
            pass

    # 3. Load persistence
    print("Loading persistence...")
    persist = {}
    for r in run_query(athena,
            'SELECT country_id, category_normalized, count(*) as c '
            'FROM qgi_data.events WHERE year BETWEEN 2023 AND 2025 '
            'AND category_normalized IS NOT NULL '
            'GROUP BY country_id, category_normalized', args.bucket):
        try:
            persist[(int(float(r['country_id'])), r['category_normalized'])] = float(r['c']) / 3.0
        except:
            pass

    # 4. Per-tier scoring
    countries_data = {}  # cid -> tier -> [(cat, z_score, rrf_rank, recipe_count, last_event_year)]

    for tier_name, (lo, hi) in TIERS.items():
        print(f"\nProcessing tier {tier_name} ({lo}-{hi} years)...")

        # Partner eligible counts
        pe = {}
        for r in run_query(athena,
                f'SELECT country_a_id, count(DISTINCT country_b_id) as p '
                f'FROM qgi_data.scdis WHERE length BETWEEN {lo} AND {hi} '
                f'GROUP BY country_a_id', args.bucket):
            try:
                pe[r['country_a_id']] = int(r['p'])
            except:
                pass

        # Recipe aggregates
        recipes = run_query(athena,
            f"SELECT country_a_id, event_category, count(*) as c, "
            f"avg(avg_correlation) as a, avg(indicator_count) as i "
            f"FROM qgi_data.recipes WHERE event_category IS NOT NULL "
            f"AND length BETWEEN {lo} AND {hi} "
            f"GROUP BY country_a_id, event_category", args.bucket)

        scored = {}
        recipe_counts = {}
        for r in recipes:
            try:
                cid = int(float(r['country_a_id']))
                partners = pe.get(r['country_a_id'], pe.get(str(cid), 5))
                if isinstance(partners, str):
                    partners = int(partners)
                prevalence = float(r['c']) / max(partners, 5)
                score = (0.30 * math.log(prevalence + 0.01)
                         + 0.40 * float(r['a'])
                         + 0.15 * math.log(float(r['i']) + 1)
                         + 0.15)
                ly = recency.get((cid, r['event_category']))
                if ly:
                    score += 0.15 * (0.85 ** max(2025 - ly, 0))
                scored[(cid, r['event_category'])] = score
                recipe_counts[(cid, r['event_category'])] = int(float(r['c']))
            except:
                pass

        # Z-score + RRF
        zscored = zscore_per_country(scored)
        fused = rank_fusion(zscored, persist)
        ranked = sorted(fused.items(), key=lambda x: -x[1])

        # Build rank map
        rank_map = {key: i + 1 for i, (key, _) in enumerate(ranked)}

        # Populate per-country data
        for (cid, cat), rrf_score in fused.items():
            if cid not in countries_data:
                countries_data[cid] = {}
            if tier_name not in countries_data[cid]:
                countries_data[cid][tier_name] = []

            z = zscored.get((cid, cat), 0)
            dw = drama_weight(cat)
            # salience_score: z-score amplified by drama weight
            salience = round(z * dw, 4)

            countries_data[cid][tier_name].append({
                'category': cat,
                'z_score': round(z, 3),
                'salience_score': salience,
                'drama_tier': dw,
                'rrf_rank': rank_map.get((cid, cat), 9999),
                'rrf_score': round(rrf_score, 6),
                'recipe_count': recipe_counts.get((cid, cat), 0),
                'last_event_year': recency.get((cid, cat)),
            })

        print(f"  {tier_name}: {len(scored)} scored pairs, {len(fused)} after fusion")

    # 5. Build output JSON
    print("\nBuilding output JSON...")
    output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'version': 'V1.8.1',
        'scoring': 'z-score per country + RRF ensemble with persistence',
        'tiers': {k: {'min_length': v[0], 'max_length': v[1]} for k, v in TIERS.items()},
        'curated_country_count': len(CURATED_IDS),
        'total_countries': 0,
        'countries': {},
    }

    for cid, tiers in countries_data.items():
        # Sort each tier's categories by RRF score descending, keep top 10
        country_entry = {
            'name': cn.get(cid, f'#{cid}'),
            'alpha_2': alpha2.get(cid, ''),
            'curated': cid in CURATED_IDS,
            'tiers': {},
            'overall_risk_tier': 'INDICATIVE',
        }

        max_salience = -999
        for tier_name in TIERS:
            cats = tiers.get(tier_name, [])
            # Sort by salience_score (z_score × drama_weight) — surfaces interesting predictions
            cats.sort(key=lambda x: -x['salience_score'])
            country_entry['tiers'][tier_name] = {
                'top_categories': cats[:10],
            }
            if cats:
                tier_max_salience = max(c['salience_score'] for c in cats[:5])
                max_salience = max(max_salience, tier_max_salience)

        country_entry['overall_risk_tier'] = risk_tier_label(max_salience)
        output['countries'][str(cid)] = country_entry

    output['total_countries'] = len(output['countries'])

    # 6. Write local file
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {args.output} ({os.path.getsize(args.output) / 1024:.0f} KB)")
    print(f"  {output['total_countries']} countries, {output['curated_country_count']} curated")

    # Count risk tiers
    tiers_count = Counter(c['overall_risk_tier'] for c in output['countries'].values())
    for tier, count in tiers_count.most_common():
        print(f"  {tier}: {count} countries")

    # 7. Upload to S3
    if args.upload:
        key = 'dashboard/country-risks.json'
        s3.put_object(
            Bucket=args.bucket,
            Key=key,
            Body=json.dumps(output, ensure_ascii=False),
            ContentType='application/json',
        )
        print(f"\nUploaded to s3://{args.bucket}/{key}")


if __name__ == '__main__':
    main()
