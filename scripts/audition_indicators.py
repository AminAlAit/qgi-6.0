#!/usr/bin/env python3
"""
audition_indicators.py — Indicator-to-recipe auditioner v0 (#480).

Per-indicator predictive contribution per recipe via permutation importance
on a held-out country split. Combines lift with coverage-equity weighting
into an audition_score that feeds the public Recipe Confidence Index
(RCI, #481).

The auditioner is a constant consultant + record-keeper, NOT a gate:
indicator integration proceeds independently of audition findings.
Findings persist forever for retrospective reassessment.

Design doc: qgi-docs/internal/design/indicator-recipe-auditioner.md

Usage:
  python scripts/audition_indicators.py \\
      --bucket qgi-data-lake-222222222222 \\
      --workgroup QGI-Lambda-Workgroup \\
      --output-dir results/audition_2026_04_26/

Anti-patterns to avoid (see design doc):
  - BH-FDR multiple-testing correction is OUT OF SCOPE per founder veto
    (2026-04-26). Do not add. Do not relitigate.
  - Don't auto-promote/demote indicators based on audition_score
  - Don't impute missing data — report missingness as a signal
  - Don't expose audition_score formula publicly (RCI is the only public surface)
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import subprocess
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import boto3
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.model_selection import StratifiedShuffleSplit


TIERS = {"S": (3, 8), "M": (9, 20), "L": (21, 40), "XL": (41, 999)}
TOTAL_COUNTRIES = 261

# Audit defaults — match the per_recipe_auc.py baseline thresholds
MIN_TOTAL = 30
MIN_POS = 5
HOLDOUT_FRAC = 0.20
PERM_REPEATS = 10
RANDOM_SEED = 42


# ---------------------------------------------------------------------------
# Stage 0: data loading from S3 + Athena
# ---------------------------------------------------------------------------

def load_indicator_map(s3, bucket: str) -> dict[int, str]:
    """numeric_id (smallint, in fingerprints) → id_string (partition key)."""
    obj = s3.get_object(
        Bucket=bucket, Key="pipeline-A-indicator-extractor/input/indicator_map.csv"
    )
    text = obj["Body"].read().decode("utf-8")
    rdr = csv.DictReader(io.StringIO(text))
    return {int(r["numeric_id"]): r["id_string"] for r in rdr}


def load_country_regions(s3, bucket: str) -> dict[str, str]:
    """alpha_2 (e.g. 'BR') → region (e.g. 'AMR'). Hand-parse YAML to avoid
    a yaml dependency."""
    obj = s3.get_object(Bucket=bucket, Key="indicator-freshness/country_regions.yaml")
    text = obj["Body"].read().decode("utf-8")
    out: dict[str, str] = {}
    current = None
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.endswith(":") and not s.startswith("-"):
            current = s.rstrip(":")
            continue
        if s.startswith("- ") and current and current.isupper():
            out[s[2:].strip()] = current
    return out


def run_athena(ath, sql: str, bucket: str, workgroup: str, db: str = "qgi_data"):
    r = ath.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": db},
        WorkGroup=workgroup,
        ResultConfiguration={"OutputLocation": f"s3://{bucket}/query_results/"},
    )
    qid = r["QueryExecutionId"]
    while True:
        time.sleep(1.5)
        s = ath.get_query_execution(QueryExecutionId=qid)["QueryExecution"]["Status"]
        if s["State"] in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
    if s["State"] != "SUCCEEDED":
        raise RuntimeError(f"Athena {s['State']}: {s.get('StateChangeReason', '?')}")
    return qid


def athena_fetch_all(ath, qid: str) -> list[list]:
    """Page through results; first row is the header."""
    rows: list[list] = []
    token = None
    first = True
    while True:
        kw = {"QueryExecutionId": qid, "MaxResults": 1000}
        if token:
            kw["NextToken"] = token
        page = ath.get_query_results(**kw)
        page_rows = page["ResultSet"]["Rows"]
        if first and page_rows:
            page_rows = page_rows[1:]
            first = False
        for r in page_rows:
            rows.append([c.get("VarCharValue") for c in r["Data"]])
        token = page.get("NextToken")
        if not token:
            break
    return rows


def load_indicator_panel(ath, bucket, workgroup, indicator_ids: list[str],
                         start_year: int, end_year: int) -> pd.DataFrame:
    """Long-format (country, year, indicator_id, value)."""
    in_clause = ",".join(f"'{i}'" for i in indicator_ids)
    sql = f"""
    SELECT country, year, indicator_id, value
    FROM qgi_data.indicators
    WHERE indicator_id IN ({in_clause})
      AND year BETWEEN {start_year} AND {end_year}
      AND value IS NOT NULL
    """
    print(f"[athena] indicator panel: {len(indicator_ids)} indicators, {start_year}-{end_year}")
    qid = run_athena(ath, sql, bucket, workgroup)
    rows = athena_fetch_all(ath, qid)
    df = pd.DataFrame(rows, columns=["country", "year", "indicator_id", "value"])
    df["year"] = df["year"].astype(int)
    df["value"] = df["value"].astype(float)
    return df


def load_event_ground_truth(ath, bucket, workgroup, cutoff_year: int,
                            end_year: int) -> pd.DataFrame:
    """Returns (country_id, event_category, did_event_post_cutoff)."""
    sql = f"""
    SELECT country_id, category_normalized AS event_category,
           cast(max(year) > {cutoff_year} AS integer) AS y_post_cutoff
    FROM qgi_data.events
    WHERE category_normalized IS NOT NULL
      AND year BETWEEN 1900 AND {end_year}
    GROUP BY country_id, category_normalized
    """
    print(f"[athena] ground truth events; cutoff={cutoff_year}")
    qid = run_athena(ath, sql, bucket, workgroup)
    rows = athena_fetch_all(ath, qid)
    df = pd.DataFrame(rows, columns=["country_id", "event_category", "y_post_cutoff"])
    df["country_id"] = df["country_id"].astype(int)
    df["y_post_cutoff"] = df["y_post_cutoff"].astype(int)
    return df


def load_countries(ath, bucket, workgroup) -> pd.DataFrame:
    sql = """
    SELECT id AS country_id, name_1 AS name, alpha_2
    FROM qgi_data.countries
    WHERE id IS NOT NULL AND id != '' AND alpha_2 IS NOT NULL
    """
    print("[athena] countries")
    qid = run_athena(ath, sql, bucket, workgroup)
    rows = athena_fetch_all(ath, qid)
    df = pd.DataFrame(rows, columns=["country_id", "name", "alpha_2"])
    df["country_id"] = df["country_id"].astype(int)
    return df


def load_recipes_aggregated_with_fingerprints(ath, bucket, workgroup) -> list[dict]:
    """Pull event_category, canonical_length, and the indicator_fingerprint
    array (just indicator_id + tfidf_score per element).
    """
    sql = """
    SELECT event_category, canonical_length,
           transform(indicator_fingerprint,
                     fp -> cast(fp.indicator_id as varchar) || ':' || cast(fp.tfidf_score as varchar)
                    ) AS fp_pairs
    FROM qgi_data.recipes_aggregated
    """
    print("[athena] recipes_aggregated fingerprints")
    qid = run_athena(ath, sql, bucket, workgroup)
    rows = athena_fetch_all(ath, qid)
    out = []
    for cat, cl, fp_str in rows:
        if cat is None or cl is None or not fp_str:
            continue
        fp = []
        for entry in fp_str.strip("[] ").split(", "):
            if not entry:
                continue
            ind_id, tfidf = entry.split(":")
            fp.append({"indicator_id": int(ind_id), "tfidf": float(tfidf)})
        out.append({
            "event_category": cat,
            "canonical_length": int(cl),
            "fingerprint": fp,
        })
    return out


def tier_for_length(L: int) -> str:
    for t, (lo, hi) in TIERS.items():
        if lo <= L <= hi:
            return t
    return "XL"


# ---------------------------------------------------------------------------
# Stage 1: per-recipe feature preparation
# ---------------------------------------------------------------------------

INDICATOR_FEATURE_STATS = ["mean", "std", "last_value", "slope", "change", "n_obs"]


def _stats_for_series(years: np.ndarray, values: np.ndarray) -> list[float]:
    """6-stat summary of an indicator's window for one country."""
    if values.size == 0:
        return [np.nan] * len(INDICATOR_FEATURE_STATS)
    mean = float(np.mean(values))
    std = float(np.std(values)) if values.size > 1 else 0.0
    last_value = float(values[-1])
    if values.size > 1 and np.std(years) > 0:
        slope = float(np.polyfit(years, values, 1)[0])
    else:
        slope = 0.0
    change = float(values[-1] - values[0])
    n_obs = int(values.size)
    return [mean, std, last_value, slope, change, n_obs]


def build_feature_matrix_v2(panel: pd.DataFrame, fingerprint: list[dict],
                            num_to_str: dict[int, str],
                            cutoff_year: int, canonical_length: int,
                            country_to_id: dict[str, int]) -> tuple[pd.DataFrame, list[str]]:
    """Build (country_id × feature) DataFrame for one recipe.

    Window: [cutoff_year - canonical_length, cutoff_year].
    Features per indicator: mean/std/last_value/slope/change/n_obs (6 each).
    """
    window_start = cutoff_year - canonical_length
    window_end = cutoff_year

    # Filter panel to fingerprint indicators + window
    fp_str_ids = [num_to_str[fp["indicator_id"]] for fp in fingerprint
                  if fp["indicator_id"] in num_to_str]
    if not fp_str_ids:
        return pd.DataFrame(), []

    pw = panel[
        (panel["indicator_id"].isin(fp_str_ids))
        & (panel["year"] >= window_start)
        & (panel["year"] <= window_end)
    ].copy()
    if pw.empty:
        return pd.DataFrame(), []

    feature_cols: list[str] = []
    for fp in fingerprint:
        if fp["indicator_id"] not in num_to_str:
            continue
        for stat in INDICATOR_FEATURE_STATS:
            feature_cols.append(f"ind{fp['indicator_id']}__{stat}")

    # Build per-country feature rows
    countries = sorted(pw["country"].unique())
    feature_rows: list[dict] = []
    for ctry in countries:
        if ctry not in country_to_id:
            continue
        country_id = country_to_id[ctry]
        cdata = pw[pw["country"] == ctry]
        row: dict = {"country_id": country_id, "country": ctry}
        for fp in fingerprint:
            if fp["indicator_id"] not in num_to_str:
                continue
            sid = num_to_str[fp["indicator_id"]]
            slc = cdata[cdata["indicator_id"] == sid].sort_values("year")
            if slc.empty:
                stats = [np.nan] * len(INDICATOR_FEATURE_STATS)
            else:
                stats = _stats_for_series(
                    slc["year"].to_numpy(), slc["value"].to_numpy()
                )
            for stat_name, val in zip(INDICATOR_FEATURE_STATS, stats):
                row[f"ind{fp['indicator_id']}__{stat_name}"] = val
        feature_rows.append(row)

    df = pd.DataFrame(feature_rows)
    return df, feature_cols


def attach_target(features: pd.DataFrame, gt: pd.DataFrame, event_category: str) -> pd.DataFrame:
    """Add y column = 1 if (country, event_category) had post-cutoff event, else 0."""
    cat_gt = gt[gt["event_category"] == event_category][["country_id", "y_post_cutoff"]]
    out = features.merge(cat_gt, on="country_id", how="left")
    out["y"] = out["y_post_cutoff"].fillna(0).astype(int)
    return out.drop(columns=["y_post_cutoff"])


# ---------------------------------------------------------------------------
# Stage 2: per-recipe model fit + permutation importance
# ---------------------------------------------------------------------------

def fit_and_score(features: pd.DataFrame, feature_cols: list[str],
                  random_state: int = RANDOM_SEED
                  ) -> tuple[float, dict[str, float], int, int]:
    """Fit GBM on country-stratified train split, score on holdout.

    Returns (test_auc, perm_importance_per_feature, n_train, n_test).
    NaN in features is replaced with 0 — sklearn doesn't accept NaN.
    The n_obs feature column captures whether the indicator had data.
    """
    X = features[feature_cols].fillna(0.0).to_numpy()
    y = features["y"].to_numpy()

    # Need both classes in stratified split
    if y.sum() < 2 or (1 - y).sum() < 2:
        return float("nan"), {}, len(X), 0

    sss = StratifiedShuffleSplit(
        n_splits=1, test_size=HOLDOUT_FRAC, random_state=random_state
    )
    train_idx, test_idx = next(sss.split(X, y))
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    if y_test.sum() < 1 or (1 - y_test).sum() < 1:
        return float("nan"), {}, len(X_train), len(X_test)

    model = GradientBoostingClassifier(
        n_estimators=80, max_depth=3, learning_rate=0.05,
        random_state=random_state, subsample=0.9,
    )
    model.fit(X_train, y_train)

    # Test AUC
    proba = model.predict_proba(X_test)[:, 1]
    if len(np.unique(y_test)) < 2:
        test_auc = float("nan")
    else:
        from sklearn.metrics import roc_auc_score
        test_auc = float(roc_auc_score(y_test, proba))

    # Permutation importance on holdout
    pi = permutation_importance(
        model, X_test, y_test, n_repeats=PERM_REPEATS,
        random_state=random_state, scoring="neg_log_loss",
    )
    importances = {col: float(imp) for col, imp in zip(feature_cols, pi.importances_mean)}
    # Aggregate per indicator (sum across the 6 stat columns).
    # Column shape is "ind{numeric_id}__{stat_name}" — split on the
    # double-underscore so multi-word stat names (last_value, n_obs)
    # don't poison the prefix.
    per_indicator: dict[str, float] = defaultdict(float)
    for col, imp in importances.items():
        prefix = col.split("__", 1)[0]  # "ind123" ← "ind123__last_value"
        per_indicator[prefix] += max(0.0, imp)  # only positive lift counts
    return test_auc, dict(per_indicator), len(X_train), len(X_test)


# ---------------------------------------------------------------------------
# Stage 3: coverage equity
# ---------------------------------------------------------------------------

def compute_indicator_coverage(panel: pd.DataFrame, country_to_alpha2: dict[str, str],
                               alpha2_to_region: dict[str, str]
                               ) -> pd.DataFrame:
    """Per indicator: n_countries_with_data, coverage_share, regional_evenness,
    missingness_global."""
    rows: list[dict] = []
    indicator_ids = panel["indicator_id"].unique()
    for sid in indicator_ids:
        sub = panel[panel["indicator_id"] == sid]
        countries_with_data = set(sub["country"].unique())
        n_countries = len(countries_with_data)
        coverage_share = n_countries / TOTAL_COUNTRIES

        # Regional evenness
        per_region: dict[str, int] = defaultdict(int)
        for ctry in countries_with_data:
            a2 = country_to_alpha2.get(ctry)
            if not a2:
                continue
            region = alpha2_to_region.get(a2)
            if region:
                per_region[region] += 1
        if not per_region:
            evenness = 0.0
        else:
            shares = np.array(list(per_region.values()), dtype=float)
            shares = shares / shares.sum()
            # Gini-style spread: 0 = perfectly uniform, 1 = perfectly concentrated.
            # Convert to evenness = 1 - gini.
            n = len(shares)
            if n <= 1:
                evenness = 0.0
            else:
                shares_sorted = np.sort(shares)
                idx = np.arange(1, n + 1)
                gini = (2.0 * np.sum(idx * shares_sorted) - (n + 1)) / n
                evenness = float(max(0.0, 1.0 - gini))

        rows.append({
            "indicator_id_string": sid,
            "n_countries_with_data": n_countries,
            "coverage_share": float(coverage_share),
            "regional_evenness": evenness,
            "missingness_global": float(1.0 - coverage_share),
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Stage 4: report rendering
# ---------------------------------------------------------------------------

def render_markdown(report: dict, output_path: Path) -> None:
    md = []
    md.append(f"# Indicator-to-Recipe Audit — {report['audit_date']}\n")
    md.append(f"**Pipeline:** {report['pipeline_version']} · **Cutoff year:** {report['cutoff_year']} · "
              f"**Random seed:** {RANDOM_SEED}\n")
    md.append(f"**Indicators audited:** {report['n_indicators']} · "
              f"**Recipes covered:** {report['n_recipes']} · "
              f"**Recipe-indicator cells:** {report['n_cells']}\n")
    md.append(f"\n## Headline\n")
    md.append(f"- Median per-recipe holdout AUC: **{report['median_recipe_auc']:.3f}**")
    md.append(f"- Recipes with AUC ≥ 0.55: **{report['n_recipes_above_055']}/{report['n_recipes_qualified']}**")
    md.append(f"- Top-lift indicator (across all recipes, sum of audition_score): **{report['top_indicator']}**")
    md.append(f"- Mean audition_score: **{report['mean_audition_score']:.3f}** (predictive_lift × coverage_share × regional_evenness)")

    md.append(f"\n## Per-recipe summary\n")
    md.append("| Recipe | Tier | n_train | n_test | Test AUC | Top contributor |")
    md.append("|---|---|---|---|---|---|")
    for r in report["per_recipe"]:
        md.append(
            f"| {r['event_category']} | {r['tier']} | {r['n_train']} | {r['n_test']} | "
            f"{r['test_auc']:.3f} | {r['top_indicator']} |"
        )

    md.append(f"\n## Per-indicator coverage equity\n")
    md.append("| Indicator | n_countries | coverage_share | regional_evenness | mean_lift_across_recipes | audition_score |")
    md.append("|---|---|---|---|---|---|")
    for r in sorted(report["per_indicator"], key=lambda r: -r["audition_score"])[:25]:
        md.append(
            f"| {r['indicator_id_string']} | {r['n_countries_with_data']} | "
            f"{r['coverage_share']:.3f} | {r['regional_evenness']:.3f} | "
            f"{r['mean_lift']:.4f} | **{r['audition_score']:.4f}** |"
        )

    md.append(f"\n## Methodology notes\n")
    md.append("- **Train/holdout:** stratified 80/20 country split per recipe (fixed seed 42)")
    md.append("- **Model:** GradientBoostingClassifier (sklearn) — n_estimators=80, max_depth=3, lr=0.05")
    md.append("- **Importance:** sklearn permutation_importance, n_repeats=10, scoring=neg_log_loss")
    md.append("- **Coverage equity:** `audition_score = predictive_lift × coverage_share × regional_evenness`")
    md.append("- **Regional evenness:** `1 - gini_coefficient(per-region share of countries with data)`")
    md.append("- **BH-FDR multiple-testing correction:** explicitly OUT OF SCOPE per founder veto (2026-04-26)")
    md.append("- **Missing data:** not imputed; rows with insufficient data drop out of the recipe model")

    md.append(f"\n## Audit metadata\n")
    md.append(f"- Audit date: `{report['audit_date']}`")
    md.append(f"- Git SHA: `{report['git_sha']}`")
    md.append(f"- Cutoff year: {report['cutoff_year']}")
    md.append(f"- Total countries (denominator): {TOTAL_COUNTRIES}")

    output_path.write_text("\n".join(md), encoding="utf-8")


def render_csv(report: dict, output_path: Path) -> None:
    cells = []
    for r in report["per_recipe"]:
        for ind, lift in r.get("indicator_lift", {}).items():
            cells.append({
                "event_category": r["event_category"],
                "tier": r["tier"],
                "indicator": ind,
                "predictive_lift": lift,
                "test_auc": r["test_auc"],
                "n_train": r["n_train"],
                "n_test": r["n_test"],
            })
    df = pd.DataFrame(cells)
    df.to_csv(output_path, index=False)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--bucket", required=True)
    p.add_argument("--workgroup", default="QGI-Lambda-Workgroup")
    p.add_argument("--region", default="eu-central-1")
    p.add_argument("--cutoff-year", type=int, default=2020)
    p.add_argument("--end-year", type=int, default=2026)
    p.add_argument("--max-canonical-length", type=int, default=40)
    p.add_argument("--output-dir", type=Path, required=True)
    p.add_argument("--upload", action="store_true",
                   help="Persist results to qgi_data.indicator_recipe_audit_results (v0.5)")
    args = p.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    audit_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        git_sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=str(Path(__file__).parent.parent)
        ).decode().strip()
    except Exception:
        git_sha = "unknown"

    s3 = boto3.client("s3", region_name=args.region)
    ath = boto3.client("athena", region_name=args.region)

    print(f"[stage 0] loading reference data...")
    num_to_str = load_indicator_map(s3, args.bucket)
    str_to_num = {v: k for k, v in num_to_str.items()}
    print(f"  indicator_map: {len(num_to_str)} entries")
    alpha2_to_region = load_country_regions(s3, args.bucket)
    print(f"  country_regions: {len(alpha2_to_region)} entries")
    countries_df = load_countries(ath, args.bucket, args.workgroup)
    country_to_id = dict(zip(countries_df["name"], countries_df["country_id"]))
    country_to_alpha2 = dict(zip(countries_df["name"], countries_df["alpha_2"]))
    print(f"  countries: {len(countries_df)}")

    recipes = load_recipes_aggregated_with_fingerprints(ath, args.bucket, args.workgroup)
    print(f"  recipes_aggregated: {len(recipes)}")

    # Union of all fingerprint indicators we need
    needed_num_ids: set[int] = set()
    for r in recipes:
        for fp in r["fingerprint"]:
            needed_num_ids.add(fp["indicator_id"])
    needed_str_ids = [num_to_str[n] for n in needed_num_ids if n in num_to_str]
    print(f"  fingerprint indicators (union): {len(needed_str_ids)}")

    panel = load_indicator_panel(
        ath, args.bucket, args.workgroup, needed_str_ids,
        args.cutoff_year - args.max_canonical_length, args.cutoff_year
    )
    print(f"  panel rows: {len(panel)}")

    gt = load_event_ground_truth(ath, args.bucket, args.workgroup,
                                 args.cutoff_year, args.end_year)
    print(f"  ground truth rows: {len(gt)}")

    print(f"\n[stage 1+2] per-recipe modeling...")
    per_recipe_records: list[dict] = []
    indicator_lift_accumulator: dict[int, list[float]] = defaultdict(list)

    for i, recipe in enumerate(recipes, 1):
        cat = recipe["event_category"]
        cl = recipe["canonical_length"]
        tier = tier_for_length(cl)
        print(f"  ({i}/{len(recipes)}) {cat} (cl={cl}, tier={tier})", end=" ", flush=True)

        features, feature_cols = build_feature_matrix_v2(
            panel, recipe["fingerprint"], num_to_str,
            args.cutoff_year, cl, country_to_id
        )
        if features.empty or not feature_cols:
            print("→ SKIP (no features)")
            continue
        labeled = attach_target(features, gt, cat)
        n_total = len(labeled)
        n_pos = int(labeled["y"].sum())
        if n_total < MIN_TOTAL or n_pos < MIN_POS:
            print(f"→ SKIP (n_total={n_total}, n_pos={n_pos})")
            continue

        try:
            test_auc, ind_lift, n_train, n_test = fit_and_score(
                labeled, feature_cols
            )
        except Exception as e:
            print(f"→ ERROR: {e}")
            continue

        # Map "ind123" prefix back to numeric id
        ind_lift_by_num: dict[int, float] = {}
        for prefix, lift in ind_lift.items():
            ind_lift_by_num[int(prefix.replace("ind", ""))] = lift

        # Per-indicator string for reporting
        ind_lift_by_str: dict[str, float] = {
            num_to_str[n]: lift for n, lift in ind_lift_by_num.items()
            if n in num_to_str
        }
        top_ind = max(ind_lift_by_str.items(), key=lambda kv: kv[1])[0] if ind_lift_by_str else "—"

        per_recipe_records.append({
            "event_category": cat,
            "tier": tier,
            "canonical_length": cl,
            "n_total": n_total,
            "n_pos": n_pos,
            "n_train": n_train,
            "n_test": n_test,
            "test_auc": test_auc,
            "indicator_lift": ind_lift_by_str,
            "top_indicator": top_ind,
        })

        for n_id, lift in ind_lift_by_num.items():
            indicator_lift_accumulator[n_id].append(lift)

        print(f"→ AUC={test_auc:.3f} top={top_ind}")

    print(f"\n[stage 3] coverage equity...")
    coverage_df = compute_indicator_coverage(
        panel, country_to_alpha2, alpha2_to_region
    )

    # Combine: per-indicator audition_score = mean_lift × coverage_share × regional_evenness
    per_indicator: list[dict] = []
    for _, row in coverage_df.iterrows():
        sid = row["indicator_id_string"]
        n_id = str_to_num.get(sid)
        lifts = indicator_lift_accumulator.get(n_id, [])
        mean_lift = float(np.mean(lifts)) if lifts else 0.0
        audition_score = mean_lift * row["coverage_share"] * row["regional_evenness"]
        per_indicator.append({
            "indicator_id_string": sid,
            "indicator_numeric_id": n_id,
            "n_countries_with_data": int(row["n_countries_with_data"]),
            "coverage_share": float(row["coverage_share"]),
            "regional_evenness": float(row["regional_evenness"]),
            "mean_lift": mean_lift,
            "n_recipes_appearing": len(lifts),
            "audition_score": float(audition_score),
        })

    print(f"\n[stage 4] rendering reports...")
    qualified = [r for r in per_recipe_records if not np.isnan(r["test_auc"])]
    aucs = [r["test_auc"] for r in qualified]
    above_055 = sum(1 for a in aucs if a >= 0.55)
    median_auc = float(np.median(aucs)) if aucs else float("nan")
    top_ind = max(per_indicator, key=lambda r: r["audition_score"])
    mean_score = float(np.mean([r["audition_score"] for r in per_indicator]))

    report = {
        "audit_date": audit_date,
        "git_sha": git_sha,
        "pipeline_version": "v0",
        "cutoff_year": args.cutoff_year,
        "n_indicators": len(per_indicator),
        "n_recipes": len(per_recipe_records),
        "n_recipes_qualified": len(qualified),
        "n_cells": sum(len(r.get("indicator_lift", {})) for r in per_recipe_records),
        "median_recipe_auc": median_auc,
        "n_recipes_above_055": above_055,
        "top_indicator": top_ind["indicator_id_string"],
        "mean_audition_score": mean_score,
        "per_recipe": sorted(per_recipe_records, key=lambda r: -r["test_auc"]),
        "per_indicator": per_indicator,
    }

    md_path = args.output_dir / "audition_report.md"
    csv_path = args.output_dir / "audition_cells.csv"
    json_path = args.output_dir / "audition_report.json"
    render_markdown(report, md_path)
    render_csv(report, csv_path)
    json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"  wrote {md_path}")
    print(f"  wrote {csv_path}")
    print(f"  wrote {json_path}")

    if args.upload:
        print("[stage 5] persistence to indicator_recipe_audit_results — pending v0.5")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
