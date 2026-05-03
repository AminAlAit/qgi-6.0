"""
Phase 4 — validation gate for the EB-shrunken weight matrix.

Hypothesis: countries whose indicator profile, weighted by Phase 3's
per-event-category weights, looks more anomalous should have HIGHER
rates of those event categories in held-out years.

Test:
  For each (country, event_category) in the weight matrix's coverage:
    1. Compute country's z-score per indicator (across all countries
       at the cutoff year)
    2. anomaly_score = sum over (indicator in event_category) of
         |z_score| * weight
    3. Compare ranking of anomaly_scores vs ground-truth events that
       happened post-cutoff (binary: did the country experience this
       event_category in [cutoff+1, end_year]?)

Metrics:
  - Per-event-category AUC (treat anomaly_score as predictor; binary
    y_post_cutoff as label).
  - Cross-cell ECE (Expected Calibration Error) on min-max-scaled
    anomaly_scores.
  - Reliability diagram (10 deciles of predictions; for each decile
    record mean prediction vs actual event rate).

Decision:
  - mean_auc > 0.55 = the weights carry SOME signal (better than
    random)
  - mean_auc > 0.65 = useful for ranking
  - ECE < 0.10 = well-calibrated
  - The decision is informational; humans review the numbers and
    decide whether to ship Phase 3's weights downstream or revisit
    methodology (Phase 5+).

Inputs (all local / cached, no Athena $ beyond a small panel pull):
  - qgi-data/reference/weight-matrix.json (Phase 3 output)
  - qgi-data/reference/indicator-sectors.json
  - qgi-data/events/taxonomy_hierarchy.json
  - qgi-docs/methodology/indicator-catalog-detailed.md
  - indicator_map.csv (cached from S3)
  - qgi_data.indicators (Athena, ~$0.01)
  - qgi_data.events (Athena, ~$0.001)
  - qgi_data.countries (Athena, trivial)

Output:
  - qgi-data/reference/phase4-validation.json
"""
from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score


# Sibling-imports for data loaders. Same pattern bake_weight_matrix.py
# uses. Both modules are pure-Python; their imports are side-effect-free
# (boto3 clients are created lazily inside the loader functions, not at
# module load time).
_AUDITION = Path(__file__).resolve().parent / "audition_indicators.py"
_spec_a = importlib.util.spec_from_file_location("audition_indicators", _AUDITION)
au = importlib.util.module_from_spec(_spec_a)
sys.modules["audition_indicators"] = au
_spec_a.loader.exec_module(au)

_EB = Path(__file__).resolve().parent / "estimate_eb_hyperpriors.py"
_spec_eb = importlib.util.spec_from_file_location("eb_hyperpriors", _EB)
eb = importlib.util.module_from_spec(_spec_eb)
sys.modules["eb_hyperpriors"] = eb
_spec_eb.loader.exec_module(eb)


ROOT = Path(__file__).resolve().parent.parent.parent
WEIGHT_MATRIX_JSON = ROOT / "qgi-data" / "reference" / "weight-matrix.json"
OUTPUT_JSON = ROOT / "qgi-data" / "reference" / "phase4-validation.json"

# Default cutoff: 2014. Choice rationale: gives 11 years (2015-2025) of
# post-cutoff observation window for ground-truth events. Earlier cutoffs
# would extend the window but have sparser indicator coverage.
DEFAULT_CUTOFF_YEAR = 2014
DEFAULT_END_YEAR = 2025

# Z-score window: take the most recent N years before cutoff to compute
# country-level indicator stats (mean, std). 5 years balances recency
# with stability against single-year shocks.
ZSCORE_WINDOW_YEARS = 5

# ECE binning: 10 equal-width bins on [0, 1] after min-max scaling.
N_ECE_BINS = 10


# ---------------------------------------------------------------------------
# Load the weight matrix
# ---------------------------------------------------------------------------

def load_weight_matrix() -> pd.DataFrame:
    """Returns a DataFrame with columns:
    indicator_numeric_id, indicator_catalog_id, event_category, sector,
    L1, weight, used_fallback.
    """
    d = json.loads(WEIGHT_MATRIX_JSON.read_text(encoding="utf-8"))
    df = pd.DataFrame(d["weights"])
    print(f"  weight-matrix: {len(df)} rows ({d['n_full_eb_prior']} full EB, "
          f"{sum(df['used_fallback'])} fallback)")
    return df


# ---------------------------------------------------------------------------
# Compute z-scored indicator panel
# ---------------------------------------------------------------------------

def compute_country_zscores(panel: pd.DataFrame, cutoff_year: int) -> pd.DataFrame:
    """For each (country, indicator_id) pair compute the z-score of the
    country's value at cutoff_year against the cross-country distribution
    at cutoff_year (or median over the recent ZSCORE_WINDOW_YEARS for
    countries missing the cutoff_year value).

    Returns long-format DataFrame: (country, indicator_id, value, z_score)
    """
    # Use median over the ZSCORE_WINDOW_YEARS ending at cutoff_year (inclusive)
    # so a missing single-year value doesn't drop a country.
    win_lo = cutoff_year - ZSCORE_WINDOW_YEARS + 1
    win = panel[(panel["year"] >= win_lo) & (panel["year"] <= cutoff_year)].copy()
    country_vals = win.groupby(["country", "indicator_id"])["value"].median().reset_index()

    # Cross-country z-score per indicator (vectorized via transform — avoids
    # the pandas groupby.apply include_groups deprecation warning).
    grp = country_vals.groupby("indicator_id")["value"]
    mu = grp.transform("mean")
    # Use string-form transform for consistency with the surrounding "mean"
    # / "min" / "max" calls; faster than a lambda (avoids per-group Python
    # dispatch). Sonnet review 2026-05-03 caught the inconsistency.
    sd = grp.transform("std", ddof=0)
    # Where sd is 0/NaN: z-score is 0 (no information from that indicator)
    safe_sd = sd.where((sd > 0) & sd.notna(), other=np.nan)
    z = (country_vals["value"] - mu) / safe_sd
    country_vals = country_vals.copy()
    country_vals["z_score"] = z.fillna(0.0)
    return country_vals[["country", "indicator_id", "value", "z_score"]]


# ---------------------------------------------------------------------------
# Score per (country, event_category)
# ---------------------------------------------------------------------------

def score_country_event(weights_df: pd.DataFrame, zscores: pd.DataFrame,
                         country_id_to_str: dict, num_to_api: dict) -> pd.DataFrame:
    """For each (country_id, event_category) pair: compute
    anomaly_score = sum over indicators in the event_category of
        |z_score| * weight

    Args:
      weights_df: from weight-matrix.json (has indicator_numeric_id column)
      zscores: from compute_country_zscores (has country, indicator_id, z_score)
      country_id_to_str: {country_id: name} from qgi_data.countries
      num_to_api: {numeric_id: api_code} from indicator_map.csv

    Returns DataFrame: (country_id, country_str, event_category,
                       anomaly_score, n_indicators_used)

    The weights table is keyed by indicator_numeric_id; the indicator
    panel is keyed by api_code. We bridge via num_to_api passed in by
    the caller.
    """
    # Add api_code column to weights_df via the shared num_to_api
    weights_df = weights_df.copy()
    weights_df["api_code"] = weights_df["indicator_numeric_id"].map(num_to_api)
    n_unmapped = weights_df["api_code"].isna().sum()
    if n_unmapped:
        print(f"  [WARN] {n_unmapped} weight rows have no api_code mapping — dropped")
        weights_df = weights_df.dropna(subset=["api_code"])

    # zscores has country (string) and indicator_id (api_code) — rename for join
    z = zscores.rename(columns={"indicator_id": "api_code"})

    # Join weights with zscores on api_code, compute per (country, event_category)
    merged = weights_df.merge(z, on="api_code", how="inner")
    merged["partial_score"] = merged["weight"] * merged["z_score"].abs()

    agg = merged.groupby(["country", "event_category"]).agg(
        anomaly_score=("partial_score", "sum"),
        n_indicators_used=("partial_score", "count"),
    ).reset_index()

    # Map country (str) -> country_id (int) via inverse of country_id_to_str
    str_to_id = {v: k for k, v in country_id_to_str.items()}
    agg["country_id"] = agg["country"].map(str_to_id)
    n_unmapped = agg["country_id"].isna().sum()
    if n_unmapped:
        print(f"  [WARN] {n_unmapped} aggregation rows had no country_id mapping — dropped")
        agg = agg.dropna(subset=["country_id"])
    agg["country_id"] = agg["country_id"].astype(int)

    return agg.rename(columns={"country": "country_str"})[
        ["country_id", "country_str", "event_category", "anomaly_score", "n_indicators_used"]
    ]


# ---------------------------------------------------------------------------
# Compute AUC + ECE + reliability
# ---------------------------------------------------------------------------

def compute_per_category_auc(scored: pd.DataFrame, gt: pd.DataFrame) -> list[dict]:
    """For each event_category in scored, compute AUC of anomaly_score
    vs y_post_cutoff."""
    merged = scored.merge(gt, on=["country_id", "event_category"], how="inner")
    out = []
    for ec, grp in merged.groupby("event_category"):
        y = grp["y_post_cutoff"].values
        pred = grp["anomaly_score"].values
        # Order checks: n-floor BEFORE all-same-label so the floor's
        # intent is unambiguous. Both produce auc=None per the gate's
        # contract; the order is purely for clarity.
        if len(grp) < 5:
            auc = None
        elif y.sum() == 0 or y.sum() == len(y):
            # All same label — AUC undefined
            auc = None
        else:
            try:
                auc = float(roc_auc_score(y, pred))
            except Exception:
                auc = None
        out.append({
            "event_category": ec,
            "n_countries": len(grp),
            "n_positive": int(y.sum()),
            "n_negative": int(len(y) - y.sum()),
            "auc": auc,
        })
    return out


def compute_ece_and_reliability(scored: pd.DataFrame, gt: pd.DataFrame,
                                 n_bins: int = N_ECE_BINS) -> tuple[float, list[dict]]:
    """Min-max-scale anomaly_score to [0, 1] WITHIN EACH event_category
    (otherwise events with very different score scales would dominate),
    then compute ECE across all (country, event_category) cells.
    """
    merged = scored.merge(gt, on=["country_id", "event_category"], how="inner")
    if merged.empty:
        return float("nan"), []

    # Per-category min-max scale (vectorized via transform — avoids the
    # pandas groupby.apply include_groups deprecation warning).
    grp = merged.groupby("event_category")["anomaly_score"]
    s_min = grp.transform("min")
    s_max = grp.transform("max")
    span = s_max - s_min
    # When span == 0 (all scores equal in the category), pred_scaled=0.5
    merged = merged.copy()
    merged["pred_scaled"] = np.where(
        span == 0, 0.5, (merged["anomaly_score"] - s_min) / span.replace(0, np.nan),
    )
    merged["pred_scaled"] = merged["pred_scaled"].fillna(0.5)

    # Bin
    bins = np.linspace(0, 1, n_bins + 1)
    rel = []
    ece = 0.0
    n_total = len(merged)
    for i in range(n_bins):
        lo = bins[i]
        hi = bins[i + 1]
        mask = (merged["pred_scaled"] >= lo) & (merged["pred_scaled"] < hi if i < n_bins - 1
                                                else merged["pred_scaled"] <= hi)
        n_in = int(mask.sum())
        if n_in == 0:
            rel.append({"bin_lo": float(lo), "bin_hi": float(hi),
                        "n": 0, "mean_prediction": None, "event_rate": None,
                        "abs_calibration_gap": None})
            continue
        bin_pred = float(merged.loc[mask, "pred_scaled"].mean())
        bin_event_rate = float(merged.loc[mask, "y_post_cutoff"].mean())
        gap = abs(bin_pred - bin_event_rate)
        ece += (n_in / n_total) * gap
        rel.append({"bin_lo": float(lo), "bin_hi": float(hi),
                    "n": n_in, "mean_prediction": bin_pred,
                    "event_rate": bin_event_rate,
                    "abs_calibration_gap": gap})
    return float(ece), rel


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(cutoff_year: int = DEFAULT_CUTOFF_YEAR, end_year: int = DEFAULT_END_YEAR) -> None:
    print(f"[1] Loading weight matrix ({WEIGHT_MATRIX_JSON.name})")
    weights_df = load_weight_matrix()

    needed_num_ids = sorted(weights_df["indicator_numeric_id"].unique().tolist())
    print(f"  indicators in weight matrix: {len(needed_num_ids)}")

    print(f"\n[2] Building num_id -> api_code chain")
    num_to_api = eb.load_numeric_to_api()
    needed_api_codes = [num_to_api[nid] for nid in needed_num_ids if nid in num_to_api]
    print(f"  api_codes: {len(needed_api_codes)}")

    print(f"\n[3] Pulling Athena data (panel + ground truth + countries)")
    creds_path = Path(r"<USER_HOME>/AppData/Local/Temp/qgi/staging_creds.json")
    creds = json.loads(creds_path.read_text())
    sess = boto3.Session(
        aws_access_key_id=creds["ak"],
        aws_secret_access_key=creds["sk"],
        aws_session_token=creds["st"],
        region_name="eu-central-1",
    )
    ath = sess.client("athena")

    panel_lo = cutoff_year - ZSCORE_WINDOW_YEARS + 1
    panel = au.load_indicator_panel(
        ath, "qgi-data-lake-222222222222", "QGI-Lambda-Workgroup",
        needed_api_codes, panel_lo, cutoff_year,
    )
    print(f"  indicator panel: {len(panel):,} rows ({panel_lo}..{cutoff_year})")

    gt = au.load_event_ground_truth(
        ath, "qgi-data-lake-222222222222", "QGI-Lambda-Workgroup",
        cutoff_year, end_year,
    )
    print(f"  ground truth: {len(gt):,} (country_id, event_category) cells")

    countries = au.load_countries(
        ath, "qgi-data-lake-222222222222", "QGI-Lambda-Workgroup",
    )
    country_id_to_str = dict(zip(countries["country_id"].astype(int), countries["name"]))
    print(f"  countries: {len(country_id_to_str)}")

    print(f"\n[4] Computing country z-scores @ cutoff {cutoff_year}")
    zscores = compute_country_zscores(panel, cutoff_year)
    print(f"  z-scored cells: {len(zscores):,}")

    print(f"\n[5] Scoring per (country, event_category)")
    scored = score_country_event(weights_df, zscores, country_id_to_str, num_to_api)
    print(f"  scored cells: {len(scored):,}")

    print(f"\n[6] Computing per-event-category AUC")
    per_cat = compute_per_category_auc(scored, gt)
    aucs_real = [c["auc"] for c in per_cat if c["auc"] is not None]
    if aucs_real:
        mean_auc = float(np.mean(aucs_real))
        median_auc = float(np.median(aucs_real))
        n_above_0_55 = sum(1 for a in aucs_real if a > 0.55)
        n_above_0_65 = sum(1 for a in aucs_real if a > 0.65)
    else:
        mean_auc = median_auc = float("nan")
        n_above_0_55 = n_above_0_65 = 0
    print(f"  computable AUCs: {len(aucs_real)}/{len(per_cat)}")
    print(f"  mean AUC: {mean_auc:.4f}  median AUC: {median_auc:.4f}")
    print(f"  AUC > 0.55: {n_above_0_55}  AUC > 0.65: {n_above_0_65}")

    print(f"\n[7] Computing ECE + reliability diagram")
    ece, reliability = compute_ece_and_reliability(scored, gt)
    print(f"  ECE: {ece:.4f}")
    print(f"  reliability bins (non-empty):")
    for b in reliability:
        if b["n"] > 0:
            print(f"    [{b['bin_lo']:.2f}, {b['bin_hi']:.2f}]  n={b['n']:>4d}  "
                  f"pred={b['mean_prediction']:.3f}  event_rate={b['event_rate']:.3f}  "
                  f"gap={b['abs_calibration_gap']:.3f}")

    print(f"\n[8] Writing {OUTPUT_JSON}")
    # Resolve decision before writing JSON (so consumers don't re-implement the
    # threshold logic). Sonnet review 2026-05-03 flagged this as MINOR #6.
    if not np.isfinite(mean_auc):
        decision = "INSUFFICIENT_DATA"
        decision_rationale = (
            "mean AUC is NaN — no event_categories had enough cells with mixed "
            "labels to compute AUC. Cannot evaluate methodology."
        )
    elif mean_auc > 0.65:
        decision = "PROCEED"
        decision_rationale = f"mean AUC {mean_auc:.3f} > 0.65 — weights carry useful predictive signal."
    elif mean_auc > 0.55:
        decision = "PROCEED_WITH_CAUTION"
        decision_rationale = (
            f"mean AUC {mean_auc:.3f} > 0.55 — weights carry some signal but only "
            f"marginally above random. Phase 5+ should improve."
        )
    else:
        decision = "REVISIT"
        decision_rationale = (
            f"mean AUC {mean_auc:.3f} <= 0.55 — weights do not predict events better "
            f"than random. Check methodology before downstream use."
        )

    output = {
        "schema_version": 1,
        "generated": datetime.now(timezone.utc).isoformat(),
        "method": (
            "anomaly_score = sum over (indicator in event_category) of "
            "|z_score| * weight. AUC computed per event_category against "
            "y_post_cutoff. ECE computed on per-category-min-max-scaled "
            "predictions, 10 bins."
        ),
        "method_caveats": [
            # Documented per Sonnet review 2026-05-03 (MAJOR #1 + MINOR #4).
            "Imbalanced ground truth bias: ground truth excludes (country, "
            "event_category) cells where the country never had ANY event of "
            "that category (pre or post cutoff). High-base-rate categories "
            "(e.g. bilateral_treaty ~0.72) suppress discrimination signal. "
            "Mean AUC is therefore a LOWER bound on per-cell predictive power.",
            "Reliability diagram is cross-category and reflects category-base-"
            "rate mixing, NOT per-category calibration. Bin-level event_rate "
            "values mix cells from categories with very different base rates. "
            "ECE here measures aggregate miscalibration, not per-category.",
            "Scoring formula uses |z_score| (magnitude), losing direction. "
            "An indicator that predicts events when HIGH (e.g. debt-to-GDP) "
            "is treated identically to one that predicts events when LOW "
            "(e.g. democracy index). Signed scoring is methodology v2.",
            "No baseline comparison: a uniform-weight or random-weight baseline "
            "AUC would tell us whether low AUC is caused by the weights being "
            "noise or by the scoring formula being the bottleneck. Tracked as "
            "follow-up ticket #598.",
        ],
        "config": {
            "cutoff_year": cutoff_year,
            "end_year": end_year,
            "zscore_window_years": ZSCORE_WINDOW_YEARS,
            "n_ece_bins": N_ECE_BINS,
        },
        "summary": {
            "n_event_categories": len(per_cat),
            "n_event_categories_with_auc": len(aucs_real),
            "n_predictions": len(scored),
            "mean_auc": mean_auc,
            "median_auc": median_auc,
            "n_auc_above_0_55": n_above_0_55,
            "n_auc_above_0_65": n_above_0_65,
            "ece": ece,
            "decision": decision,
            "decision_rationale": decision_rationale,
        },
        "per_event_category_auc": per_cat,
        "reliability_diagram": reliability,
    }
    OUTPUT_JSON.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"    wrote validation report")

    print(f"\n=== DECISION ===")
    print(f"  {decision}: {decision_rationale}")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--cutoff-year", type=int, default=DEFAULT_CUTOFF_YEAR)
    p.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
    args = p.parse_args()
    main(cutoff_year=args.cutoff_year, end_year=args.end_year)
