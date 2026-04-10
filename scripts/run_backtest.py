#!/usr/bin/env python3
"""
QGI Backtesting Script V1.5.3 — Per-tier walk-forward validation (#130).

Changes from V1.5.2:
- Per-tier (S/M/L/XL) Platt scaling and thresholds
- Per-tier metrics + weighted aggregate
- XL fallback to M-tier Platt params when <500 positive pairs
- Configurable S3 bucket + workgroup via CLI args (no hardcoding)
- Output: JSON results + console tables

Usage:
    # Full backtest (validate on 2015, test on 2020):
    python run_backtest.py --bucket qgi-data-lake-222222222222 --mode full

    # With explicit region + workgroup:
    python run_backtest.py --bucket qgi-data-lake-222222222222 --region eu-central-1 --workgroup QGI-Lambda-Workgroup --mode full

    # Validate only (tune thresholds):
    python run_backtest.py --bucket qgi-data-lake-222222222222 --mode validate --cutoff 2015

    # Test only (locked threshold per tier):
    python run_backtest.py --bucket qgi-data-lake-222222222222 --mode test --cutoff 2020
"""

import argparse
import time
import json
import sys
import math
import os
from collections import defaultdict

import boto3
import numpy as np

# ---------------------------------------------------------------------------
# Tier definitions (#128)
# ---------------------------------------------------------------------------
TIERS = {
    'S':  (3, 8),
    'M':  (9, 20),
    'L':  (21, 40),
    'XL': (41, 999),
}

XL_FALLBACK_MIN_POSITIVES = 500  # If XL has fewer, use M-tier Platt params


# ---------------------------------------------------------------------------
# Athena helpers
# ---------------------------------------------------------------------------

def get_athena(args):
    """Build Athena client, optionally assuming a cross-account role."""
    if args.role_arn:
        sts = boto3.client('sts', region_name=args.region)
        creds = sts.assume_role(
            RoleArn=args.role_arn, RoleSessionName='backtest'
        )['Credentials']
        return boto3.client(
            'athena', region_name=args.region,
            aws_access_key_id=creds['AccessKeyId'],
            aws_secret_access_key=creds['SecretAccessKey'],
            aws_session_token=creds['SessionToken'],
        )
    return boto3.client('athena', region_name=args.region)


def run_query(athena, sql, bucket, workgroup, max_results=10000):
    """Execute Athena query synchronously. Returns list of row dicts."""
    r = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={'Database': 'qgi_data'},
        WorkGroup=workgroup,
        ResultConfiguration={
            'OutputLocation': f's3://{bucket}/query_results/',
        },
    )
    qid = r['QueryExecutionId']
    while True:
        time.sleep(2)
        s = athena.get_query_execution(
            QueryExecutionId=qid
        )['QueryExecution']['Status']
        if s['State'] in ('SUCCEEDED', 'FAILED', 'CANCELLED'):
            break
    if s['State'] != 'SUCCEEDED':
        print(
            f"FAILED: {s.get('StateChangeReason', '?')[:200]}",
            file=sys.stderr,
        )
        return []

    rows = []
    result = athena.get_query_results(
        QueryExecutionId=qid, MaxResults=max_results
    )
    cols = [
        c['Name']
        for c in result['ResultSet']['ResultSetMetadata']['ColumnInfo']
    ]
    for row in result['ResultSet']['Rows'][1:]:
        d = {
            cols[i]: row['Data'][i].get('VarCharValue')
            for i in range(len(cols))
        }
        rows.append(d)
    while 'NextToken' in result:
        result = athena.get_query_results(
            QueryExecutionId=qid,
            NextToken=result['NextToken'],
            MaxResults=max_results,
        )
        for row in result['ResultSet']['Rows']:
            d = {
                cols[i]: row['Data'][i].get('VarCharValue')
                for i in range(len(cols))
            }
            rows.append(d)
    return rows


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def log_score(count, correlation, indicator_count):
    """Log-space confidence scoring — prevents extreme outliers."""
    return (
        0.4 * math.log(float(count) + 1)
        + 0.4 * float(correlation)
        + 0.2 * math.log(float(indicator_count) + 1)
    )


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_metrics(y_true, y_scores, threshold):
    """Compute full metrics suite at a given threshold."""
    y_pred = (y_scores >= threshold).astype(int)
    tp = ((y_pred == 1) & (y_true == 1)).sum()
    fp = ((y_pred == 1) & (y_true == 0)).sum()
    fn = ((y_pred == 0) & (y_true == 1)).sum()

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0
    )
    base_rate = y_true.mean() if len(y_true) > 0 else 0
    lift = precision / base_rate if base_rate > 0 and precision > 0 else 0

    # Brier Score
    brier = ((y_scores - y_true) ** 2).mean()
    brier_ref = ((base_rate - y_true) ** 2).mean()
    bss = 1 - (brier / brier_ref) if brier_ref > 0 else 0

    # AUPRC
    sorted_idx = np.argsort(-y_scores)
    y_sorted = y_true[sorted_idx]
    tp_cum = 0
    auprc = 0.0
    prev_recall = 0.0
    for i in range(len(y_sorted)):
        if y_sorted[i] == 1:
            tp_cum += 1
        p = tp_cum / (i + 1)
        r = tp_cum / max(y_true.sum(), 1)
        auprc += (r - prev_recall) * p
        prev_recall = r

    # Precision@K and Lift@K
    def precision_at_k(k):
        if len(sorted_idx) < k:
            k = len(sorted_idx)
        return y_true[sorted_idx[:k]].sum() / k if k > 0 else 0

    def lift_at_k(k):
        pak = precision_at_k(k)
        return pak / base_rate if base_rate > 0 else 0

    return {
        'f1': round(f1, 4),
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'auprc': round(auprc, 4),
        'lift': round(lift, 2),
        'brier_skill_score': round(bss, 4),
        'precision_at_10': round(precision_at_k(10), 4),
        'precision_at_50': round(precision_at_k(50), 4),
        'precision_at_100': round(precision_at_k(100), 4),
        'lift_at_10': round(lift_at_k(10), 2),
        'lift_at_50': round(lift_at_k(50), 2),
        'lift_at_100': round(lift_at_k(100), 2),
        'lift_at_200': round(lift_at_k(200), 2),
        'coverage': round((y_scores > 0).mean(), 4),
        'base_rate': round(base_rate, 4),
        'n_predictions': int((y_pred == 1).sum()),
        'n_ground_truth': int(y_true.sum()),
        'n_total': len(y_true),
    }


# ---------------------------------------------------------------------------
# Data loaders
# ---------------------------------------------------------------------------

def load_ground_truth(athena, cutoff, bucket, workgroup):
    """Load actual events after cutoff."""
    rows = run_query(
        athena,
        f"""
        SELECT country_id, category_normalized
        FROM qgi_data.events
        WHERE year > {cutoff}
        GROUP BY country_id, category_normalized
        """,
        bucket, workgroup,
    )
    return {(r['country_id'], r['category_normalized']) for r in rows}


def load_recipe_predictions_by_tier(athena, table, cutoff, bucket, workgroup):
    """Load aggregated recipe predictions, stratified by tier (#130).

    Returns: dict[tier_name] -> dict[(country_a_id, event_category)] -> score
    """
    preds_by_tier = {t: {} for t in TIERS}

    for tier_name, (lo, hi) in TIERS.items():
        rows = run_query(
            athena,
            f"""
            SELECT country_a_id, event_category,
                   count(*) as recipe_count,
                   avg(avg_correlation) as avg_corr,
                   avg(indicator_count) as avg_ind
            FROM qgi_data.{table}
            WHERE end_year_a <= {cutoff} AND end_year_b <= {cutoff}
              AND length BETWEEN {lo} AND {hi}
            GROUP BY country_a_id, event_category
            """,
            bucket, workgroup,
        )

        tier_preds = {}
        for r in rows:
            score = log_score(
                r['recipe_count'], r['avg_corr'], r['avg_ind']
            )
            tier_preds[(r['country_a_id'], r['event_category'])] = score

        # Normalize to 0-1 within tier
        if tier_preds:
            vals = list(tier_preds.values())
            mn, mx = min(vals), max(vals)
            rng = mx - mn if mx > mn else 1
            tier_preds = {k: (v - mn) / rng for k, v in tier_preds.items()}

        preds_by_tier[tier_name] = tier_preds
        print(f"  {tier_name} (length {lo}-{hi}): {len(tier_preds)} predictions")

    return preds_by_tier


def load_persistence(athena, cutoff, bucket, workgroup):
    """Persistence baseline: events in [cutoff-2, cutoff] predict cutoff+1."""
    rows = run_query(
        athena,
        f"""
        SELECT country_id, category_normalized, count(*) as cnt
        FROM qgi_data.events
        WHERE year BETWEEN {cutoff - 2} AND {cutoff}
        GROUP BY country_id, category_normalized
        """,
        bucket, workgroup,
    )
    return {
        (r['country_id'], r['category_normalized']): float(r['cnt']) / 3.0
        for r in rows
    }


def load_recency(athena, cutoff, bucket, workgroup):
    """Load most recent event year per (country, category) before cutoff."""
    rows = run_query(
        athena,
        f"""
        SELECT country_id, category_normalized, max(year) as last_year
        FROM qgi_data.events
        WHERE year <= {cutoff}
        GROUP BY country_id, category_normalized
        """,
        bucket, workgroup,
    )
    return {
        (r['country_id'], r['category_normalized']): int(r['last_year'])
        for r in rows
    }


def apply_recency(preds, recency, cutoff, decay=0.85):
    """Boost predictions by recency: recent events = higher score."""
    boosted = {}
    for key, score in preds.items():
        last_year = recency.get(key)
        if last_year is not None:
            years_ago = cutoff - last_year
            boost = decay ** years_ago
            boosted[key] = score + 0.3 * boost
        else:
            boosted[key] = score
    return boosted


def renormalize(preds):
    """Re-normalize scores to 0-1 after recency boost."""
    if not preds:
        return preds
    vals = list(preds.values())
    mn, mx = min(vals), max(vals)
    rng = mx - mn if mx > mn else 1
    return {k: (v - mn) / rng for k, v in preds.items()}


# ---------------------------------------------------------------------------
# Platt scaling + threshold search
# ---------------------------------------------------------------------------

def platt_scale(y_true_train, y_scores_train, y_scores_apply):
    """Fit Platt scaling on train, apply to given scores."""
    best_loss = float('inf')
    best_a, best_b = 1.0, 0.0

    for a in np.arange(0.5, 20, 0.5):
        for b in np.arange(-10, 5, 0.5):
            probs = 1.0 / (1.0 + np.exp(-(a * y_scores_train + b)))
            probs = np.clip(probs, 1e-7, 1 - 1e-7)
            loss = -np.mean(
                y_true_train * np.log(probs)
                + (1 - y_true_train) * np.log(1 - probs)
            )
            if loss < best_loss:
                best_loss = loss
                best_a, best_b = a, b

    calibrated = 1.0 / (1.0 + np.exp(-(best_a * y_scores_apply + best_b)))
    return calibrated, best_a, best_b


def find_threshold_at_precision(y_true, y_scores, target_precision=0.70):
    """Find the lowest threshold that achieves >= target precision.

    If no threshold hits the target, returns the threshold with max F1.
    """
    best_threshold = 0.5
    best_f1 = 0
    precision_met = False

    for t in np.arange(0.05, 0.95, 0.02):
        m = compute_metrics(y_true, y_scores, t)
        if m['precision'] >= target_precision and not precision_met:
            best_threshold = t
            precision_met = True
        if precision_met and m['precision'] >= target_precision and m['f1'] > best_f1:
            best_f1 = m['f1']
            best_threshold = t
        if not precision_met and m['f1'] > best_f1:
            best_f1 = m['f1']
            best_threshold = t

    return round(best_threshold, 2), round(best_f1, 4), precision_met


def build_arrays(preds, ground_truth):
    """Convert prediction dict + ground truth set into aligned numpy arrays."""
    all_pairs = sorted(set(preds.keys()) | ground_truth)
    y_true = np.array([1 if p in ground_truth else 0 for p in all_pairs])
    y_scores = np.array([preds.get(p, 0.0) for p in all_pairs])
    return y_true, y_scores


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def print_table(header, rows):
    widths = [
        max(len(str(r[i])) for r in [header] + rows) + 2
        for i in range(len(header))
    ]
    fmt = "".join(f"{{:<{w}s}}" for w in widths)
    print(fmt.format(*[str(h) for h in header]))
    print("-" * sum(widths))
    for row in rows:
        print(fmt.format(*[str(v) for v in row]))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='QGI Backtesting V1.5.3')
    parser.add_argument('--bucket', required=True, help='S3 data lake bucket')
    parser.add_argument('--region', default='eu-central-1')
    parser.add_argument('--workgroup', default='QGI-Lambda-Workgroup')
    parser.add_argument('--role-arn', default=None, help='Cross-account role ARN (optional)')
    parser.add_argument('--cutoff', type=int, default=2020)
    parser.add_argument('--mode', choices=['validate', 'test', 'full'], default='full')
    parser.add_argument('--threshold', type=float, default=None)
    parser.add_argument('--recipe-table', default='recipes')
    parser.add_argument('--target-precision', type=float, default=0.70, help='Min precision for threshold (#119)')
    parser.add_argument('--output', default='backtest_v153_results.json')
    args = parser.parse_args()

    athena = get_athena(args)

    if args.mode in ('full', 'validate'):
        # =================================================================
        # PHASE 1: VALIDATION (cutoff=2015) — fit per-tier Platt + thresholds
        # =================================================================
        print("=" * 70)
        print("PHASE 1: VALIDATION (cutoff=2015) — PER-TIER (#130)")
        print("=" * 70)

        gt_val = load_ground_truth(athena, 2015, args.bucket, args.workgroup)
        print(f"Ground truth: {len(gt_val)} (country, category) pairs post-2015")

        print("\nLoading per-tier predictions...")
        preds_by_tier_val = load_recipe_predictions_by_tier(
            athena, args.recipe_table, 2015, args.bucket, args.workgroup,
        )
        recency_val = load_recency(athena, 2015, args.bucket, args.workgroup)

        # Per-tier: apply recency, Platt scale, find threshold
        platt_params = {}
        tier_thresholds = {}
        tier_metrics_val = {}

        for tier_name in TIERS:
            preds = preds_by_tier_val[tier_name]
            if not preds:
                print(f"\n  {tier_name}: no predictions — skipping")
                tier_metrics_val[tier_name] = None
                continue

            preds_boosted = renormalize(
                apply_recency(preds, recency_val, 2015)
            )
            y_true, y_scores = build_arrays(preds_boosted, gt_val)
            n_positives = int(y_true.sum())

            # Platt scaling
            if tier_name == 'XL' and n_positives < XL_FALLBACK_MIN_POSITIVES:
                if 'M' in platt_params:
                    a, b = platt_params['M']
                    print(f"\n  {tier_name}: <{XL_FALLBACK_MIN_POSITIVES} positives ({n_positives}), using M-tier Platt params (a={a:.2f}, b={b:.2f})")
                    y_cal = 1.0 / (1.0 + np.exp(-(a * y_scores + b)))
                    platt_params[tier_name] = (a, b)
                else:
                    y_cal, a, b = platt_scale(y_true, y_scores, y_scores)
                    platt_params[tier_name] = (a, b)
            else:
                y_cal, a, b = platt_scale(y_true, y_scores, y_scores)
                platt_params[tier_name] = (a, b)

            # Threshold at target precision (#119)
            threshold, f1, precision_met = find_threshold_at_precision(
                y_true, y_cal, args.target_precision,
            )
            tier_thresholds[tier_name] = threshold

            m = compute_metrics(y_true, y_cal, threshold)
            tier_metrics_val[tier_name] = m

            status = "✓" if precision_met else "⚠ precision not met"
            print(
                f"\n  {tier_name}: Platt a={a:.2f} b={b:.2f} | "
                f"threshold={threshold} | F1={m['f1']} | "
                f"Precision={m['precision']} | AUPRC={m['auprc']} | "
                f"n={m['n_total']} ({n_positives} positives) | {status}"
            )

        # Aggregate
        print("\n" + "=" * 70)
        print("VALIDATION SUMMARY (per-tier)")
        print("=" * 70)
        header = ['Tier', 'F1', 'Precision', 'Recall', 'AUPRC', 'Lift@50', 'Threshold', 'N_pred', 'N_gt']
        rows = []
        total_preds = 0
        weighted_f1 = 0
        for tier_name in TIERS:
            m = tier_metrics_val.get(tier_name)
            if m is None:
                rows.append([tier_name, '-', '-', '-', '-', '-', '-', 0, 0])
                continue
            rows.append([
                tier_name, m['f1'], m['precision'], m['recall'], m['auprc'],
                m['lift_at_50'], tier_thresholds.get(tier_name, '-'),
                m['n_predictions'], m['n_ground_truth'],
            ])
            total_preds += m['n_total']
            weighted_f1 += m['f1'] * m['n_total']

        agg_f1 = round(weighted_f1 / total_preds, 4) if total_preds > 0 else 0
        rows.append(['AGG', agg_f1, '', '', '', '', '', total_preds, ''])
        print_table(header, rows)

    if args.mode in ('full', 'test'):
        # =================================================================
        # PHASE 2: TEST (cutoff=2020) — locked Platt params + thresholds
        # =================================================================
        print()
        print("=" * 70)
        print("PHASE 2: TEST (cutoff=2020) — LOCKED PARAMS")
        print("=" * 70)

        if args.mode == 'test' and args.threshold:
            # Single threshold mode (backward compat)
            tier_thresholds = {t: args.threshold for t in TIERS}
            platt_params = {t: (5.0, -2.5) for t in TIERS}  # default Platt
            print(f"Using supplied threshold={args.threshold} for all tiers")

        gt_test = load_ground_truth(athena, 2020, args.bucket, args.workgroup)
        print(f"Ground truth: {len(gt_test)} (country, category) pairs post-2020")

        print("\nLoading per-tier predictions...")
        preds_by_tier_test = load_recipe_predictions_by_tier(
            athena, args.recipe_table, 2020, args.bucket, args.workgroup,
        )
        recency_test = load_recency(athena, 2020, args.bucket, args.workgroup)
        persist_test = load_persistence(athena, 2020, args.bucket, args.workgroup)

        tier_metrics_test = {}
        for tier_name in TIERS:
            preds = preds_by_tier_test[tier_name]
            if not preds:
                tier_metrics_test[tier_name] = None
                continue

            preds_boosted = renormalize(
                apply_recency(preds, recency_test, 2020)
            )
            y_true, y_scores = build_arrays(preds_boosted, gt_test)

            # Apply LOCKED Platt params from validation
            a, b = platt_params.get(tier_name, (5.0, -2.5))
            y_cal = 1.0 / (1.0 + np.exp(-(a * y_scores + b)))

            threshold = tier_thresholds.get(tier_name, 0.5)
            m = compute_metrics(y_true, y_cal, threshold)
            tier_metrics_test[tier_name] = m

            print(
                f"\n  {tier_name}: threshold={threshold} (locked) | "
                f"F1={m['f1']} | Precision={m['precision']} | "
                f"AUPRC={m['auprc']} | Lift@50={m['lift_at_50']}"
            )

        # Persistence baseline
        y_true_p, y_scores_p = build_arrays(persist_test, gt_test)
        mp = compute_metrics(y_true_p, y_scores_p, 0.3)

        # Aggregate
        print("\n" + "=" * 70)
        print("TEST SUMMARY (per-tier, locked params)")
        print("=" * 70)
        header = ['Tier', 'F1', 'Precision', 'Recall', 'AUPRC', 'Lift@50', 'N_pred', 'N_gt']
        rows = []
        total_preds = 0
        weighted_f1 = 0
        for tier_name in TIERS:
            m = tier_metrics_test.get(tier_name)
            if m is None:
                rows.append([tier_name, '-', '-', '-', '-', '-', 0, 0])
                continue
            rows.append([
                tier_name, m['f1'], m['precision'], m['recall'], m['auprc'],
                m['lift_at_50'], m['n_predictions'], m['n_ground_truth'],
            ])
            total_preds += m['n_total']
            weighted_f1 += m['f1'] * m['n_total']

        agg_f1 = round(weighted_f1 / total_preds, 4) if total_preds > 0 else 0
        rows.append(['AGG', agg_f1, '', '', '', '', total_preds, ''])
        rows.append(['Persist', mp['f1'], mp['precision'], mp['recall'], mp['auprc'], mp['lift_at_50'], mp['n_predictions'], mp['n_ground_truth']])
        print_table(header, rows)

        beats_persist = agg_f1 > mp['f1']
        print(f"\nV1.5.3 beats persistence? {'YES' if beats_persist else 'NO'} (AGG F1={agg_f1} vs {mp['f1']})")

    # Save results
    if args.mode == 'full':
        results = {
            'version': 'V1.5.3',
            'tiers': list(TIERS.keys()),
            'tier_ranges': TIERS,
            'validation': {
                'cutoff': 2015,
                'platt_params': {t: list(v) for t, v in platt_params.items()},
                'thresholds': tier_thresholds,
                'metrics': {
                    t: m for t, m in tier_metrics_val.items() if m is not None
                },
            },
            'test': {
                'cutoff': 2020,
                'metrics': {
                    t: m for t, m in tier_metrics_test.items() if m is not None
                },
                'persistence': mp,
                'aggregate_f1': agg_f1,
                'beats_persistence': beats_persist,
            },
        }
        out_path = args.output
        with open(out_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to {out_path}")


if __name__ == '__main__':
    main()
