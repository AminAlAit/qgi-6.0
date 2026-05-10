"""
Phase 4 / Phase 5 v0.1a — validation gate for the EB-shrunken weight matrix.

Hypothesis: countries whose indicator profile, weighted by Phase 3's
per-event-category weights, looks more anomalous should have HIGHER
rates of those event categories in held-out years.

Test:
  For each (country, event_category) in the weight matrix's coverage:
    1. Compute country's z-score per indicator (across all countries
       at the cutoff year)
    2. anomaly_score = sum over (indicator in event_category) of
         f(z_score, direction) * weight
       where f() depends on the ablation arm — see Ablation arms below.
    3. Compare ranking of anomaly_scores vs ground-truth events that
       happened post-cutoff (binary: did the country experience this
       event_category in [cutoff+1, end_year]?)

Ablation arms (Phase 5 v0.1a, 4-arm design — see
qgi-docs/internal/ops/cascade-track/phase-5-v0.1a.md):

  | Arm | Formula                          | #591 filter? | Output captures              |
  |-----|----------------------------------|--------------|------------------------------|
  | A   | direction × z_score              | applied      | Both fixes simultaneously    |
  | B   | direction × z_score              | NOT applied  | Formula fix only             |
  | C   | |z_score|                        | applied      | Filter fix only              |
  | D   | |z_score|                        | NOT applied  | Phase 4 v0.2 equivalent      |

  D is the Phase 4 baseline; A is the treatment; B and C are the
  disaggregation arms that isolate the contribution of each fix.

Metrics:
  - Per-event-category AUC (treat anomaly_score as predictor; binary
    y_post_cutoff as label).
  - Bootstrap 95% CI on AUC per event_category (1000 resamples,
    bias-corrected percentile).
  - Stratified AUC: cells where n_indicators_used ≥ 10 vs < 10 (the
    "data-sufficient" stratum vs the "thin-coverage" stratum).
  - Per-event-category ECE (Expected Calibration Error) + reliability
    diagram. v3 had a single cross-category ECE; v4 adds per-category.
  - Cross-cell ECE retained for backward compatibility.

Decision (v4 — applies to whichever arm is active):
  - mean_auc > 0.55 = the weights carry SOME signal (better than random)
  - mean_auc > 0.65 = useful for ranking
  - ECE < 0.10 = well-calibrated
  - Arm-A-vs-Arm-D delta > 0.03 = signed-scoring + filter together
    produce meaningful AUC improvement (the Miriam <0.03 swing rule
    from DECISION v2)

Inputs (all local / cached, no Athena $ beyond a small panel pull):
  - qgi-data/reference/weight-matrix.json (Phase 3 output)
  - qgi-data/reference/indicator-directions.json (v4 NEW — per-indicator
    direction-of-effect annotations, +1/-1/0; see
    qgi-docs/internal/ops/cascade-track/catalog-direction-annotation-cascade-side.md
    + qgi-docs/internal/ops/ml-track/catalog-direction-annotation-ml-side.md
    for the source-of-truth working drafts. The JSON is built by a
    separate generator that consumes the two working drafts.)

    ⚠️ Arms A and B HARD-ERROR if this file is missing — they are not
    meaningfully runnable without per-indicator direction annotations.
    Until the generator ships, only arms C and D are operational.

  - qgi-data/reference/indicator-allow-list.json (#591 Option D; used
    when --ablation-arm in {A, C})

    ⚠️ Arms A and C HARD-ERROR if this file is missing. Generate it via
    `python qgi-ml/scripts/generate_indicator_allow_list.py --bucket ...`
    before running A/C.
  - qgi-data/events/taxonomy_hierarchy.json
  - qgi-docs/methodology/indicator-catalog-detailed.md
  - indicator_map.csv (cached from S3)
  - qgi_data.indicators (Athena, ~$0.01)
  - qgi_data.events (Athena, ~$0.001)
  - qgi_data.countries (Athena, trivial)

Output:
  - qgi-data/reference/phase4-validation-arm{A,B,C,D}.json
    (one file per arm; legacy `phase4-validation.json` is the alias
    for the D-arm output for backward compatibility with v3 consumers)
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score


def _derive_category_seed(master_seed: int, event_category: str) -> int:
    """Deterministic per-category seed for bootstrap CIs.

    Python's built-in `hash()` is randomized across processes by default
    (PYTHONHASHSEED) — using it would mean bootstrap CIs drift between
    re-runs even with a fixed `--bootstrap-seed`. SHA-256 over a stable
    string encoding gives the same 4-byte int every time, cross-process.

    Strict review 2026-05-11 M1: replaces an earlier `hash((seed, str(ec)))`
    construction with a deterministic equivalent.
    """
    key = f"{master_seed}:{event_category}".encode("utf-8")
    digest = hashlib.sha256(key).digest()[:4]
    return int.from_bytes(digest, byteorder="big", signed=False)


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
DIRECTIONS_JSON = ROOT / "qgi-data" / "reference" / "indicator-directions.json"
ALLOW_LIST_JSON = ROOT / "qgi-data" / "reference" / "indicator-allow-list.json"
ANCHOR_BATTERY_JSON = ROOT / "qgi-data" / "reference" / "cascade-anchor-case-battery.json"
OUTPUT_JSON_LEGACY = ROOT / "qgi-data" / "reference" / "phase4-validation.json"
OUTPUT_JSON_TEMPLATE = "phase4-validation-arm{arm}.json"

# Schema version. Bumped to 4 for the Phase 5 v0.1a 4-arm ablation
# (added: ablation_arm, direction-aware scoring, bootstrap CI per
# category, stratified AUC by n_indicators_used, per-category ECE).
# v2 = baselines added (#598); v3 was an internal-only iteration that
# never shipped; v4 = the v0.1a release.
SCHEMA_VERSION = 4

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

# Default seed for the random-weight baseline (#598). Fixed so re-runs
# of the same validation report reproduce identical baseline AUCs.
DEFAULT_BASELINE_SEED = 42

# Bootstrap parameters for per-category AUC CIs (v4 NEW).
# 1000 resamples gives stable percentile-CI estimates without making
# the validation run prohibitively expensive (~109 categories × 1000 ≈
# 109k roc_auc_score calls — under a minute on a modern machine).
DEFAULT_BOOTSTRAP_RESAMPLES = 1000
DEFAULT_BOOTSTRAP_SEED = 42
BOOTSTRAP_CI_ALPHA = 0.05  # 95% CI = [2.5th, 97.5th] percentile

# Stratified-AUC split threshold (v4 NEW). Cells with n_indicators_used
# >= 10 are "data-sufficient"; < 10 is "thin-coverage". The split
# isolates whether the weight-matrix signal is concentrated in
# well-covered categories (Miriam's RECONVENE concern).
STRATA_INDICATOR_COUNT_THRESHOLD = 10

# Valid ablation arms (Phase 5 v0.1a).
ABLATION_ARMS = ("A", "B", "C", "D")
DEFAULT_ABLATION_ARM = "D"  # default = Phase 4 v0.2 baseline behavior

# Per-arm config: (use_signed_scoring, apply_591_filter)
ARM_CONFIG = {
    "A": (True, True),   # signed × filter — treatment
    "B": (True, False),  # signed × NO filter
    "C": (False, True),  # unsigned × filter
    "D": (False, False), # unsigned × NO filter — baseline
}


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


def load_direction_annotations(path: Path = DIRECTIONS_JSON) -> dict[str, int]:
    """Read indicator-directions.json (v4 NEW) and return {api_code: direction}.

    Schema:
      {"schema_version": N,
       "generated": "...",
       "directions": [{"api_code": "...", "direction": +1|-1|0,
                       "tag": "[lit-only]|...", "justification": "..."}, ...]}

    Returns: dict mapping api_code -> int in {-1, 0, +1}. Unknown codes
    are treated as direction 0 (no signal) by the scoring function; this
    loader does NOT pre-populate unknowns — that's the caller's job.

    If the file doesn't exist, returns an empty dict and the caller's
    score function will treat all indicators as direction 0. This makes
    the script runnable even before the directions JSON has been built
    (useful for the D-arm baseline which doesn't need directions).
    """
    if not path.exists():
        print(f"  [WARN] {path.name} not found — direction annotations skipped "
              f"(all indicators treated as direction 0). Arms A and B will be "
              f"equivalent to the D-arm in this run; use --ablation-arm D "
              f"explicitly to suppress this warning.")
        return {}
    d = json.loads(path.read_text(encoding="utf-8"))
    out = {row["api_code"]: int(row["direction"]) for row in d.get("directions", [])}
    nz = sum(1 for v in out.values() if v != 0)
    print(f"  indicator-directions: {len(out)} annotations "
          f"({nz} non-zero signs, {len(out) - nz} direction:0)")
    return out


def load_allow_list(path: Path = ALLOW_LIST_JSON) -> set[int]:
    """Read indicator-allow-list.json (#591 Option D) and return the set
    of allowed indicator_numeric_id values. Used when --ablation-arm in
    {A, C} to restrict the weight matrix to the curated indicator set.

    If the file doesn't exist, returns None (sentinel for "no filter
    available"). The caller decides whether that's an error (in filter
    mode) or fine (in non-filter mode).
    """
    if not path.exists():
        print(f"  [WARN] {path.name} not found — #591 filter unavailable. "
              f"Arms A and C will fall back to unfiltered behavior in this run.")
        return None
    d = json.loads(path.read_text(encoding="utf-8"))
    ids = set(int(x) for x in d.get("allow_list_numeric_ids", []))
    print(f"  indicator-allow-list (#591): {len(ids)} numeric IDs in filter")
    return ids


def apply_591_filter(weights_df: pd.DataFrame, allow_ids: set[int]) -> pd.DataFrame:
    """Restrict the weight matrix to indicators in the #591 allow list.

    Used by arms A and C. If allow_ids is None (allow-list file missing),
    returns the input unchanged with a warning — the caller's --ablation-arm
    choice may be silently mis-specified in that case.
    """
    if allow_ids is None:
        print(f"  [WARN] #591 filter requested but allow_ids is None — "
              f"falling back to unfiltered weight matrix")
        return weights_df
    n_before = len(weights_df)
    out = weights_df[weights_df["indicator_numeric_id"].isin(allow_ids)].copy()
    n_after = len(out)
    print(f"  #591 filter: {n_before} → {n_after} rows "
          f"({n_before - n_after} dropped, {100 * n_after / n_before:.1f}% retained)")
    return out


def build_uniform_baseline(weights_df: pd.DataFrame) -> pd.DataFrame:
    """Replace every row's weight with 1.0, keeping the same (event_category,
    indicator_numeric_id) coverage.

    Tests the scoring formula in isolation. If uniform_AUC ≈ treatment_AUC,
    the |z_score| × weight formula is doing all the work and the EB priors
    contribute nothing. If uniform_AUC < treatment_AUC, the priors carry
    real signal. Filed as #598.
    """
    out = weights_df.copy()
    out["weight"] = 1.0
    return out


def build_random_baseline(weights_df: pd.DataFrame, seed: int) -> pd.DataFrame:
    """Replace every row's weight with a uniform random sample from [0, 1].

    Tests against pure noise. Random_AUC near 0.5 (and treatment_AUC also
    near 0.5) is the worst-case signal — the methodology produces no
    discrimination above chance.

    Seed is fixed (default 42) so re-runs reproduce identical baseline
    AUCs. Caller can override via --baseline-seed.
    """
    rng = np.random.default_rng(seed)
    out = weights_df.copy()
    out["weight"] = rng.uniform(0.0, 1.0, size=len(out))
    return out


def evaluate_weights(
    weights_df: pd.DataFrame, zscores: pd.DataFrame,
    country_id_to_str: dict, num_to_api: dict, gt: pd.DataFrame,
    label: str,
    use_signed_scoring: bool = False,
    directions: dict[str, int] | None = None,
    bootstrap_resamples: int = DEFAULT_BOOTSTRAP_RESAMPLES,
    bootstrap_seed: int = DEFAULT_BOOTSTRAP_SEED,
    anchor_battery: dict | None = None,
) -> dict:
    """Run the full evaluation pipeline (score → per-category AUC + CI →
    stratified-by-coverage AUC → per-category ECE + reliability +
    cross-category ECE) on a weights DataFrame and return the summary
    dict.

    Used for both the regular weight matrix and the baseline (uniform /
    random) variants. The same scoring formula is used in all cases —
    only the weights differ — which means any AUC delta is attributable
    to the weights, not the formula.

    v4 NEW: use_signed_scoring + directions arguments propagate the
    ablation-arm decision through to score_country_event. Bootstrap CI
    and stratified AUC are computed unconditionally (cheap relative to
    the Athena pull that already happened).
    """
    print(f"\n[evaluate: {label}]")
    scored = score_country_event(
        weights_df, zscores, country_id_to_str, num_to_api,
        use_signed_scoring=use_signed_scoring, directions=directions,
    )
    # v4: per-category AUC now carries bootstrap CI inline.
    per_cat = compute_per_category_auc_with_ci(
        scored, gt,
        n_resamples=bootstrap_resamples, seed=bootstrap_seed,
    )
    aucs_real = [c["auc"] for c in per_cat if c["auc"] is not None]
    if aucs_real:
        mean_auc = float(np.mean(aucs_real))
        median_auc = float(np.median(aucs_real))
        n_above_0_55 = sum(1 for a in aucs_real if a > 0.55)
        n_above_0_65 = sum(1 for a in aucs_real if a > 0.65)
    else:
        mean_auc = median_auc = float("nan")
        n_above_0_55 = n_above_0_65 = 0
    # v4: stratified AUC by n_indicators_used.
    stratified = compute_stratified_auc(scored, gt)
    # v4: per-category ECE.
    per_cat_ece = compute_per_category_ece(scored, gt)
    # Legacy v3 cross-category ECE retained for backward-compat consumers.
    ece, reliability = compute_ece_and_reliability(scored, gt)
    # v4 Step 3: anchor-case battery (regression suite, not validation).
    anchor_results = evaluate_anchor_cases(scored, anchor_battery)
    n_anchor_pass = sum(1 for r in anchor_results if r["passed"] is True)
    n_anchor_fail = sum(1 for r in anchor_results if r["passed"] is False)
    n_anchor_skip = sum(1 for r in anchor_results if r["passed"] is None)
    print(f"  {label}: mean_auc={mean_auc:.4f}  median_auc={median_auc:.4f}  "
          f"ece={ece:.4f}  n_categories_with_auc={len(aucs_real)}/{len(per_cat)}  "
          f"stratified[ds={stratified['data_sufficient']['mean_auc']:.4f}/tc="
          f"{stratified['thin_coverage']['mean_auc']:.4f}]  "
          f"anchors[pass={n_anchor_pass}/fail={n_anchor_fail}/skip={n_anchor_skip}]")
    return {
        "label": label,
        "n_event_categories": len(per_cat),
        "n_event_categories_with_auc": len(aucs_real),
        "n_predictions": len(scored),
        "mean_auc": mean_auc,
        "median_auc": median_auc,
        "n_auc_above_0_55": n_above_0_55,
        "n_auc_above_0_65": n_above_0_65,
        "ece": ece,
        "per_event_category_auc": per_cat,
        "reliability_diagram": reliability,
        # v4 NEW additions
        "stratified_auc": stratified,
        "per_event_category_ece": per_cat_ece,
        # v4 Step 3 anchor battery (None-tolerant — empty list if no battery loaded)
        "anchor_case_battery": {
            "n_pass": n_anchor_pass,
            "n_fail": n_anchor_fail,
            "n_skip": n_anchor_skip,
            "cases": anchor_results,
        },
    }


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
                         country_id_to_str: dict, num_to_api: dict,
                         use_signed_scoring: bool = False,
                         directions: dict[str, int] | None = None) -> pd.DataFrame:
    """For each (country_id, event_category) pair: compute
        anomaly_score = sum over indicators in the event_category of
            f(z_score, direction) * weight
    where f() is:
        - |z_score|                   when use_signed_scoring=False (arms C, D)
        - direction × z_score         when use_signed_scoring=True (arms A, B)

    v4 NEW (Phase 5 v0.1a): the use_signed_scoring + directions arguments.
    Signed mode requires a directions map ({api_code: int in {-1, 0, +1}}).
    Indicators not in the directions map (or with direction=0) contribute
    zero in signed mode (matches the catalog convention that direction:0 =
    "model learns from the absolute z_score is meaningless without a
    literature-defensible sign"). The previous unsigned behavior is
    preserved exactly when use_signed_scoring=False.

    Args:
      weights_df: from weight-matrix.json (has indicator_numeric_id column)
      zscores: from compute_country_zscores (has country, indicator_id, z_score)
      country_id_to_str: {country_id: name} from qgi_data.countries
      num_to_api: {numeric_id: api_code} from indicator_map.csv
      use_signed_scoring: if True, use direction × z_score; else |z_score|
      directions: required when use_signed_scoring=True; ignored otherwise

    Returns DataFrame: (country_id, country_str, event_category,
                       anomaly_score, n_indicators_used)

    The weights table is keyed by indicator_numeric_id; the indicator
    panel is keyed by api_code. We bridge via num_to_api passed in by
    the caller.
    """
    if use_signed_scoring and directions is None:
        raise ValueError(
            "score_country_event(use_signed_scoring=True) requires a "
            "directions map. Pass directions=load_direction_annotations()."
        )

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

    if use_signed_scoring:
        # signed: direction × z_score × weight. Indicators not in the
        # directions map get direction 0 (no contribution). Indicators
        # with direction:0 in the catalog also get zero contribution — this
        # is the catalog convention for "no defensible literature sign;
        # defer to Majles."
        #
        # SIGN INVERSION (Phase 5 v0.1a strict review B1, 2026-05-11):
        # Catalog convention is `+1 = protective / risk-reducing`. So:
        #   weight × (+1) × HIGH z_score → LARGE POSITIVE partial → "more
        #     protective" condition → LOWER event probability.
        # But downstream AUC computes roc_auc_score(y_post_cutoff,
        # anomaly_score), which assumes HIGH score predicts y=1. To keep
        # that contract, we NEGATE the per-row partial_score so the
        # aggregated `anomaly_score` is a RISK score:
        #   HIGH anomaly_score → HIGH event probability  (signed AND unsigned)
        # This makes signed and unsigned arms directly comparable on AUC
        # without per-arm interpretation gymnastics. It also makes
        # Miriam's <0.03 swing rule (A vs D delta) meaningful as a
        # directional improvement check.
        merged["direction"] = merged["api_code"].map(directions).fillna(0).astype(int)
        merged["partial_score"] = -(
            merged["weight"] * merged["direction"] * merged["z_score"]
        )
    else:
        # unsigned legacy: |z_score| × weight (Phase 4 v0.2 behavior).
        # Already a risk score by construction (HIGH |z| = more anomalous =
        # higher predicted risk), so no negation needed.
        merged["partial_score"] = merged["weight"] * merged["z_score"].abs()
        merged["direction"] = 0  # kept for downstream uniformity; unused

    # n_indicators_used counts partial_score values — for signed mode,
    # this counts ALL joined rows (including direction:0 zero-contributors)
    # so the stratified-AUC split (≥10 cells vs <10 cells) measures
    # candidate-pool size, not effective-signal-pool size. That's the
    # right semantics: the stratification asks "did we have enough
    # indicators to compute a meaningful score" — direction:0 indicators
    # were SEEN, just not USED in signed mode.
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


def _auc_bootstrap_ci(
    y: np.ndarray, pred: np.ndarray, n_resamples: int, seed: int, alpha: float,
) -> tuple[float | None, float | None, list[float]]:
    """Compute bootstrap percentile CI for ROC AUC.

    Returns (lo, hi, point_estimates) where:
      - lo, hi = alpha/2 and 1-alpha/2 percentiles of the resample AUCs
      - point_estimates = the resample AUCs (length n_resamples; resamples
        that produced AUC-undefined cases are excluded)

    If fewer than 10 valid resamples can be computed, returns (None, None, [])
    — the CI is meaningless on a thin support.

    v4 NEW (Phase 5 v0.1a Step 2 spec): 1000 resamples per recipe.
    """
    n = len(y)
    if n < 5:
        return None, None, []
    rng = np.random.default_rng(seed)
    aucs = []
    for _ in range(n_resamples):
        idx = rng.integers(0, n, size=n)
        y_b = y[idx]
        p_b = pred[idx]
        # Same all-same-label guard as compute_per_category_auc
        if y_b.sum() == 0 or y_b.sum() == n:
            continue
        try:
            aucs.append(float(roc_auc_score(y_b, p_b)))
        except Exception:
            continue
    if len(aucs) < 10:
        return None, None, aucs
    lo = float(np.percentile(aucs, 100 * (alpha / 2)))
    hi = float(np.percentile(aucs, 100 * (1 - alpha / 2)))
    return lo, hi, aucs


def compute_per_category_auc_with_ci(
    scored: pd.DataFrame, gt: pd.DataFrame,
    n_resamples: int = DEFAULT_BOOTSTRAP_RESAMPLES,
    seed: int = DEFAULT_BOOTSTRAP_SEED,
    alpha: float = BOOTSTRAP_CI_ALPHA,
) -> list[dict]:
    """v4 NEW. Per-category AUC plus bootstrap percentile CI.

    Same shape as compute_per_category_auc but each row also carries:
      - auc_ci_lo, auc_ci_hi: alpha/2 and 1-alpha/2 percentile of
        n_resamples bootstrap resamples
      - auc_ci_alpha: the CI level (for downstream display)

    Use deterministic seeds derived from (seed, event_category) so that
    re-runs produce identical CIs and individual category CIs are
    reproducible standalone. Falls back to None CIs when the resample
    distribution is too thin (< 10 valid resamples).
    """
    merged = scored.merge(gt, on=["country_id", "event_category"], how="inner")
    out = []
    for ec, grp in merged.groupby("event_category"):
        y = grp["y_post_cutoff"].values
        pred = grp["anomaly_score"].values

        if len(grp) < 5:
            auc = None
            ci_lo = ci_hi = None
        elif y.sum() == 0 or y.sum() == len(y):
            auc = None
            ci_lo = ci_hi = None
        else:
            try:
                auc = float(roc_auc_score(y, pred))
            except Exception:
                auc = None
            # Per-category seed: ensures CI for category X is reproducible
            # independently of other categories' presence. Uses SHA-256
            # (NOT Python `hash()`) for cross-process determinism — see
            # _derive_category_seed docstring + strict review 2026-05-11 M1.
            cat_seed = _derive_category_seed(seed, str(ec))
            ci_lo, ci_hi, _ = _auc_bootstrap_ci(
                y, pred, n_resamples=n_resamples,
                seed=cat_seed, alpha=alpha,
            )
        out.append({
            "event_category": ec,
            "n_countries": len(grp),
            "n_positive": int(y.sum()),
            "n_negative": int(len(y) - y.sum()),
            "auc": auc,
            "auc_ci_lo": ci_lo,
            "auc_ci_hi": ci_hi,
            "auc_ci_alpha": alpha,
        })
    return out


def compute_stratified_auc(scored: pd.DataFrame, gt: pd.DataFrame) -> dict:
    """v4 NEW. Stratified AUC by n_indicators_used.

    Splits cells into:
      - "data-sufficient" stratum: n_indicators_used >= STRATA_THRESHOLD
      - "thin-coverage" stratum:   n_indicators_used <  STRATA_THRESHOLD

    Within each stratum, compute per-category AUC the same way as
    compute_per_category_auc, then summarize. This isolates whether the
    weight-matrix signal is concentrated in well-covered categories
    (Miriam's RECONVENE concern from the post-Phase-4 DECISION v2).

    Returns:
      {"threshold": int,
       "data_sufficient": {"n_cells": int, "n_categories": int,
                           "mean_auc": float, "median_auc": float,
                           "per_event_category_auc": [...]},
       "thin_coverage":   {... same shape ...}}
    """
    merged = scored.merge(gt, on=["country_id", "event_category"], how="inner")
    if merged.empty:
        return {
            "threshold": STRATA_INDICATOR_COUNT_THRESHOLD,
            "data_sufficient": {"n_cells": 0, "n_categories": 0,
                                "mean_auc": float("nan"),
                                "median_auc": float("nan"),
                                "per_event_category_auc": []},
            "thin_coverage": {"n_cells": 0, "n_categories": 0,
                              "mean_auc": float("nan"),
                              "median_auc": float("nan"),
                              "per_event_category_auc": []},
        }

    out = {"threshold": STRATA_INDICATOR_COUNT_THRESHOLD}
    for label, mask in [
        ("data_sufficient", merged["n_indicators_used"] >= STRATA_INDICATOR_COUNT_THRESHOLD),
        ("thin_coverage",   merged["n_indicators_used"] <  STRATA_INDICATOR_COUNT_THRESHOLD),
    ]:
        sub = merged.loc[mask]
        per_cat = []
        for ec, grp in sub.groupby("event_category"):
            y = grp["y_post_cutoff"].values
            pred = grp["anomaly_score"].values
            if len(grp) < 5 or y.sum() == 0 or y.sum() == len(y):
                auc = None
            else:
                try:
                    auc = float(roc_auc_score(y, pred))
                except Exception:
                    auc = None
            per_cat.append({
                "event_category": ec, "n_countries": len(grp),
                "n_positive": int(y.sum()), "auc": auc,
            })
        aucs = [c["auc"] for c in per_cat if c["auc"] is not None]
        out[label] = {
            "n_cells": int(mask.sum()),
            "n_categories": len(per_cat),
            "mean_auc": float(np.mean(aucs)) if aucs else float("nan"),
            "median_auc": float(np.median(aucs)) if aucs else float("nan"),
            "per_event_category_auc": per_cat,
        }
    return out


def compute_per_category_ece(
    scored: pd.DataFrame, gt: pd.DataFrame, n_bins: int = N_ECE_BINS,
) -> list[dict]:
    """v4 NEW. Per-event-category ECE + reliability diagram.

    v3 had a single cross-category ECE (which mixes base rates and is
    misleading — see method_caveats[1]). v4 adds per-category ECE so
    each event_category gets its own calibration estimate against its
    own base rate.

    Each category's predictions are min-max-scaled to [0, 1] *within the
    category*, then binned the same way as the cross-category ECE.
    """
    merged = scored.merge(gt, on=["country_id", "event_category"], how="inner")
    out = []
    for ec, grp in merged.groupby("event_category"):
        if len(grp) < 5:
            out.append({
                "event_category": ec, "n_cells": len(grp),
                "ece": None, "reliability_diagram": [],
            })
            continue
        scores = grp["anomaly_score"].values
        s_min, s_max = scores.min(), scores.max()
        span = s_max - s_min
        if span == 0:
            pred_scaled = np.full(len(grp), 0.5)
        else:
            pred_scaled = (scores - s_min) / span
        y = grp["y_post_cutoff"].values
        bins = np.linspace(0, 1, n_bins + 1)
        ece = 0.0
        rel = []
        for i in range(n_bins):
            lo, hi = bins[i], bins[i + 1]
            if i < n_bins - 1:
                mask = (pred_scaled >= lo) & (pred_scaled < hi)
            else:
                mask = (pred_scaled >= lo) & (pred_scaled <= hi)
            n_in = int(mask.sum())
            if n_in == 0:
                rel.append({"bin_lo": float(lo), "bin_hi": float(hi),
                            "n": 0, "mean_prediction": None,
                            "event_rate": None, "abs_calibration_gap": None})
                continue
            bin_pred = float(pred_scaled[mask].mean())
            bin_event_rate = float(y[mask].mean())
            gap = abs(bin_pred - bin_event_rate)
            ece += (n_in / len(grp)) * gap
            rel.append({"bin_lo": float(lo), "bin_hi": float(hi),
                        "n": n_in, "mean_prediction": bin_pred,
                        "event_rate": bin_event_rate,
                        "abs_calibration_gap": gap})
        out.append({
            "event_category": ec, "n_cells": len(grp),
            "ece": float(ece), "reliability_diagram": rel,
        })
    return out


def load_anchor_battery(path: Path = ANCHOR_BATTERY_JSON) -> dict:
    """v4 NEW (Phase 5 v0.1a Step 3). Load cascade-anchor-case-battery.json.

    Returns the full parsed JSON object so callers have access to the
    schema metadata + cases. Missing-file behavior: returns None and
    warns; the per-arm evaluation continues without anchor-case results
    (anchor cases are a regression suite, not a hard-blocker).
    """
    if not path.exists():
        print(f"  [WARN] {path.name} not found — anchor-case battery skipped. "
              f"Anchor results will be absent from the per-arm output JSON.")
        return None
    d = json.loads(path.read_text(encoding="utf-8"))
    print(f"  anchor-case-battery: {len(d.get('cases', []))} cases "
          f"(schema_v{d.get('schema_version')})")
    return d


def _compute_percentile_per_category(scored: pd.DataFrame) -> pd.DataFrame:
    """Compute predicted-risk percentile per (country, event_category).

    Per the anchor-battery `rank_basis` convention (cascade-anchor-case-
    battery.json `evaluation_semantics.rank_basis`): ASCENDING by
    anomaly_score, so:
      - percentile = rank / n_countries  (rank starts at 1)
      - percentile = 0.05 = bottom 5% (least predicted-risk)
      - percentile = 0.95 = top 5%    (most predicted-risk)

    Under the v4 risk-direction convention (PR #43 B1 fix), HIGH
    anomaly_score = HIGH event probability. So HIGH percentile = HIGH
    predicted risk. All anchor predicates assume this convention.
    """
    out = scored.copy()
    # Rank ascending: lowest anomaly_score → rank 1 → low percentile.
    out["risk_rank"] = out.groupby("event_category")["anomaly_score"].rank(
        method="average", ascending=True,
    )
    out["n_in_category"] = out.groupby("event_category")["country_str"].transform("count")
    out["risk_percentile"] = out["risk_rank"] / out["n_in_category"]
    return out


def _eval_predicate(case: dict, percentile_df: pd.DataFrame) -> dict:
    """Evaluate a single anchor case against the percentile_df.

    Returns: {case_id, country, country_resolved_to, event_categories,
              test_type, evaluation_scope, phase_gate, predicate_type,
              actual_values, passed, reason}

    `passed` semantics:
      - True  : case passes the predicate
      - False : case fails the predicate
      - None  : case cannot be evaluated (universe gap, cross-arm
                scope, or primary+fallback both insufficient)
    """
    case_id = case["case_id"]
    country = case["country"]
    test_type = case["test_type"]
    scope = case.get("evaluation_scope", "per_arm")
    phase_gate = case["phase_gate"]
    pred = case["predicate"]
    pred_type = pred["type"]
    base = {
        "case_id": case_id,
        "country": country,
        "country_resolved_to": None,
        "event_categories": case["event_categories"],
        "test_type": test_type,
        "evaluation_scope": scope,
        "phase_gate": phase_gate,
        "predicate_type": pred_type,
        "actual_values": None,
        "passed": None,
        "reason": "",
    }

    # Universe-gap guard (T3 from strict review).
    if case.get("in_evaluation_universe") is False:
        base["reason"] = (
            f"country_outside_evaluation_universe (in_evaluation_universe=false; "
            f"see case.universe_note)"
        )
        return base

    # Cross-arm scope guard (T4 from strict review).
    if scope == "cross_arm":
        base["reason"] = (
            "evaluation_scope=cross_arm; computed in step 5 cross-arm comparison, "
            "not per-arm evaluation"
        )
        return base

    # Per-arm evaluation.
    cats = case["event_categories"]
    sub = percentile_df[
        (percentile_df["country_str"] == country)
        & (percentile_df["event_category"].isin(cats))
    ]

    # Country-fallback rule for case 8 (Yemen → Somalia).
    if case.get("country_alternatives") and not _country_has_sufficient_data(
        sub, cats, case.get("country_fallback_rule", {})
    ):
        # Primary insufficient; try alternatives in order.
        for alt in case["country_alternatives"]:
            alt_sub = percentile_df[
                (percentile_df["country_str"] == alt)
                & (percentile_df["event_category"].isin(cats))
            ]
            if not alt_sub.empty and _country_has_sufficient_data(
                alt_sub, cats, case.get("country_fallback_rule", {})
            ):
                sub = alt_sub
                base["country_resolved_to"] = alt
                break
        else:
            base["reason"] = (
                "primary country has insufficient data on >=3 categories "
                "(n_countries < 5 per category) AND fallback alternative(s) "
                "either insufficient or outside evaluation universe"
            )
            return base
    else:
        base["country_resolved_to"] = country

    if sub.empty:
        base["reason"] = (
            f"no rows in scored data for country={country} on any of "
            f"event_categories={cats}. Country may be missing from the "
            f"weight-matrix coverage or event ground truth."
        )
        return base

    # Collect per-category percentiles (the actual_values payload).
    actual_values = {
        row["event_category"]: float(row["risk_percentile"])
        for _, row in sub.iterrows()
    }
    base["actual_values"] = actual_values

    # Dispatch by predicate type.
    if pred_type == "percentile_below":
        threshold = pred["threshold"]
        # Single-category test (cases 1, 2 use this with one category)
        cat = cats[0]
        if cat not in actual_values:
            base["reason"] = f"event_category {cat} not in scored data for {country}"
            return base
        actual = actual_values[cat]
        passed = actual < threshold
        base["passed"] = bool(passed)
        base["reason"] = (
            f"{country} percentile on {cat} = {actual:.4f}; "
            f"threshold = below {threshold:.2f} → {'PASS' if passed else 'FAIL'}"
        )

    elif pred_type == "percentile_above":
        threshold = pred["threshold"]
        # Cases 4, 5: case 5 uses predicate_satisfies_any=True (any of
        # the 3 economic categories above threshold passes); case 4 has
        # a single category.
        # T1 strict-review fix: use strict `>` for "above" predicates to
        # match the strict `<` used by "below" predicates. The boundary
        # itself is on the FAIL side for both directions — matching the
        # JSON spec text "above the 50th percentile" (strict) and the
        # "below the 30th percentile" (strict).
        any_pass = case.get("predicate_satisfies_any", False)
        if any_pass:
            passes = [v > threshold for v in actual_values.values()]
            passed = any(passes)
            base["passed"] = bool(passed)
            base["reason"] = (
                f"{country} percentiles = {actual_values}; "
                f"threshold = above {threshold:.2f} (satisfies_any) → "
                f"{'PASS' if passed else 'FAIL'} "
                f"({sum(passes)}/{len(passes)} categories above threshold)"
            )
        else:
            cat = cats[0]
            if cat not in actual_values:
                base["reason"] = f"event_category {cat} not in scored data for {country}"
                return base
            actual = actual_values[cat]
            passed = actual > threshold
            base["passed"] = bool(passed)
            base["reason"] = (
                f"{country} percentile on {cat} = {actual:.4f}; "
                f"threshold = above {threshold:.2f} → {'PASS' if passed else 'FAIL'}"
            )

    elif pred_type == "rank_floor_all_categories":
        threshold = pred["threshold"]
        # ALL categories must be below threshold
        breaches = {c: v for c, v in actual_values.items() if v >= threshold}
        passed = len(breaches) == 0
        base["passed"] = bool(passed)
        if passed:
            max_p = max(actual_values.values()) if actual_values else 0.0
            base["reason"] = (
                f"{country} max percentile across {len(actual_values)} categories "
                f"= {max_p:.4f}; threshold = floor below {threshold:.2f} on ALL → PASS"
            )
        else:
            base["reason"] = (
                f"{country} BREACHES floor on {len(breaches)} categories: "
                f"{breaches}; threshold = below {threshold:.2f} on ALL → FAIL"
            )

    elif pred_type == "multi_category_count_above":
        threshold = pred["threshold"]
        min_categories = pred["min_categories"]
        # T1: strict `>` per the JSON spec text "above the 75th percentile"
        above = [c for c, v in actual_values.items() if v > threshold]
        passed = len(above) >= min_categories
        base["passed"] = bool(passed)
        base["reason"] = (
            f"{country} above {threshold:.2f} on {len(above)} of "
            f"{len(actual_values)} categories ({above}); "
            f"threshold = at least {min_categories} → {'PASS' if passed else 'FAIL'}"
        )

    elif pred_type == "rank_stability_across_versions":
        # Cross-arm scope; should have been caught above. Defensive.
        base["reason"] = (
            "rank_stability_across_versions is cross-arm; should not reach "
            "per-arm evaluation. This is a bug — case was missing "
            "evaluation_scope=cross_arm in the JSON."
        )
        return base

    else:
        base["reason"] = f"unknown predicate type: {pred_type}"
        return base

    return base


def _country_has_sufficient_data(
    sub: pd.DataFrame, cats: list, fallback_rule: dict,
) -> bool:
    """Yemen→Somalia fallback rule: country must have at least
    `min_categories_with_data` categories with `n_in_category >=
    min_n_countries_per_category` (T5 from strict review — threshold
    lifted from prose to structured data).
    """
    if not fallback_rule:
        return not sub.empty
    min_cats = fallback_rule.get("min_categories_with_data", 1)
    min_n = fallback_rule.get("min_n_countries_per_category", 1)
    qualifying = sub[sub["n_in_category"] >= min_n]
    return qualifying["event_category"].nunique() >= min_cats


def evaluate_anchor_cases(scored: pd.DataFrame, battery: dict | None) -> list[dict]:
    """v4 NEW (Phase 5 v0.1a Step 3). Evaluate the 8-case anchor battery
    against the per-arm scored output.

    Returns a list of per-case result dicts (see _eval_predicate for the
    schema). When battery is None (file missing), returns empty list +
    a warning was already printed by load_anchor_battery.
    """
    if battery is None:
        return []
    if scored.empty:
        return [
            {**{k: None for k in ("actual_values", "passed")},
             "case_id": c["case_id"], "country": c["country"],
             "reason": "scored DataFrame is empty"}
            for c in battery.get("cases", [])
        ]
    percentile_df = _compute_percentile_per_category(scored)
    return [_eval_predicate(case, percentile_df) for case in battery.get("cases", [])]


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

def main(
    cutoff_year: int = DEFAULT_CUTOFF_YEAR,
    end_year: int = DEFAULT_END_YEAR,
    with_baselines: bool = False,
    baseline_seed: int = DEFAULT_BASELINE_SEED,
    ablation_arm: str = DEFAULT_ABLATION_ARM,
    bootstrap_resamples: int = DEFAULT_BOOTSTRAP_RESAMPLES,
    bootstrap_seed: int = DEFAULT_BOOTSTRAP_SEED,
) -> None:
    if ablation_arm not in ABLATION_ARMS:
        raise ValueError(
            f"ablation_arm must be one of {ABLATION_ARMS}; got {ablation_arm!r}"
        )
    use_signed_scoring, apply_filter = ARM_CONFIG[ablation_arm]
    print(f"[0] Ablation arm: {ablation_arm} "
          f"(signed_scoring={use_signed_scoring}, apply_591_filter={apply_filter})")

    print(f"[1] Loading weight matrix ({WEIGHT_MATRIX_JSON.name})")
    weights_df = load_weight_matrix()

    # v4 NEW: direction annotations + #591 filter per arm. Hard-error
    # (NOT silent fallback) when a required input is missing in the
    # arm that requires it — per strict review 2026-05-11 m4. Silent
    # degradation in arm A would make it indistinguishable from arm B,
    # defeating the 4-arm ablation's whole purpose.
    directions: dict[str, int] = {}
    if use_signed_scoring:
        print(f"  Loading direction annotations ({DIRECTIONS_JSON.name})")
        directions = load_direction_annotations()
        if not directions:
            raise FileNotFoundError(
                f"Arm {ablation_arm} requires direction annotations at "
                f"{DIRECTIONS_JSON} but the file is missing or empty. "
                f"Either generate it (see qgi-docs/internal/ops/cascade-track/"
                f"catalog-direction-annotation-cascade-side.md for the source-of-"
                f"truth working draft + a generator-spec TODO), or rerun with "
                f"--ablation-arm D (the unsigned-no-filter baseline that does "
                f"not need directions)."
            )
    if apply_filter:
        print(f"  Loading #591 allow-list ({ALLOW_LIST_JSON.name})")
        allow_ids = load_allow_list()
        if allow_ids is None:
            raise FileNotFoundError(
                f"Arm {ablation_arm} requires the #591 allow-list at "
                f"{ALLOW_LIST_JSON} but the file is missing. Generate it "
                f"via `python qgi-ml/scripts/generate_indicator_allow_list.py "
                f"--bucket qgi-data-lake-222222222222`, or rerun with "
                f"--ablation-arm B or D (no-filter arms)."
            )
        weights_df = apply_591_filter(weights_df, allow_ids)

    # v4 Step 3: anchor-case battery (regression suite). Optional — if
    # missing, anchor results are absent from the output (NOT a fatal
    # error; anchor cases are documentation/regression, not gating).
    print(f"  Loading anchor-case battery ({ANCHOR_BATTERY_JSON.name})")
    anchor_battery = load_anchor_battery()

    needed_num_ids = sorted(weights_df["indicator_numeric_id"].unique().tolist())
    print(f"  indicators in weight matrix (post-filter): {len(needed_num_ids)}")

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

    print(f"\n[5] Evaluating weight matrices (arm={ablation_arm})")
    treatment = evaluate_weights(
        weights_df, zscores, country_id_to_str, num_to_api, gt,
        label=f"treatment_arm{ablation_arm}",
        use_signed_scoring=use_signed_scoring, directions=directions,
        bootstrap_resamples=bootstrap_resamples, bootstrap_seed=bootstrap_seed,
        anchor_battery=anchor_battery,
    )
    mean_auc = treatment["mean_auc"]
    n_above_0_55 = treatment["n_auc_above_0_55"]
    n_above_0_65 = treatment["n_auc_above_0_65"]
    median_auc = treatment["median_auc"]
    aucs_real = [c["auc"] for c in treatment["per_event_category_auc"] if c["auc"] is not None]
    ece = treatment["ece"]
    reliability = treatment["reliability_diagram"]
    per_cat = treatment["per_event_category_auc"]

    baseline_uniform = None
    baseline_random = None
    if with_baselines:
        # T5 strict-review fix: anchor battery is about treatment
        # methodology (does the formula correctly handle Malta, Norway,
        # etc.) — "Norway fails the floor under uniform weights" is
        # uninformative because the formula is what we're ablating.
        # Skip anchor evaluation for baselines.
        baseline_uniform = evaluate_weights(
            build_uniform_baseline(weights_df), zscores,
            country_id_to_str, num_to_api, gt,
            label="baseline_uniform",
            use_signed_scoring=use_signed_scoring, directions=directions,
            bootstrap_resamples=bootstrap_resamples, bootstrap_seed=bootstrap_seed,
            anchor_battery=None,
        )
        baseline_random = evaluate_weights(
            build_random_baseline(weights_df, seed=baseline_seed), zscores,
            country_id_to_str, num_to_api, gt,
            label=f"baseline_random_seed{baseline_seed}",
            use_signed_scoring=use_signed_scoring, directions=directions,
            bootstrap_resamples=bootstrap_resamples, bootstrap_seed=bootstrap_seed,
            anchor_battery=None,
        )

    # Reliability diagram log (treatment only — baselines' reliability is
    # in the JSON but printing all 3 to stdout is noisy.)
    print(f"\n[6] Treatment reliability bins (non-empty):")
    for b in reliability:
        if b["n"] > 0:
            print(f"    [{b['bin_lo']:.2f}, {b['bin_hi']:.2f}]  n={b['n']:>4d}  "
                  f"pred={b['mean_prediction']:.3f}  event_rate={b['event_rate']:.3f}  "
                  f"gap={b['abs_calibration_gap']:.3f}")

    # v4: per-arm output path. Legacy phase4-validation.json is also
    # written as a symlink-alias for the D-arm to preserve v3 consumers.
    output_path = ROOT / "qgi-data" / "reference" / OUTPUT_JSON_TEMPLATE.format(arm=ablation_arm)
    print(f"\n[7] Writing {output_path}")
    # Resolve decision before writing JSON (so consumers don't re-implement the
    # threshold logic). Sonnet review 2026-05-03 (Phase 4 v0.1) flagged this
    # as MINOR #6.
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

    # When baselines are computed AND treatment_AUC is below the random
    # baseline, that is a STRONGER REVISIT signal than just "below 0.55"
    # — it means the scoring formula plus weights produces predictions
    # WORSE than coin flips drawn from a hat. Sonnet review 2026-05-03
    # (Phase 4 v0.2) flagged this as MINOR #2.
    if (baseline_random is not None
            and np.isfinite(mean_auc)
            and np.isfinite(baseline_random["mean_auc"])
            and mean_auc < baseline_random["mean_auc"]):
        decision_rationale += (
            f" Treatment AUC ({mean_auc:.3f}) is BELOW the random-weight "
            f"baseline ({baseline_random['mean_auc']:.3f}); this is a "
            f"strong signal that the scoring formula — not the weights "
            f"— is the bottleneck."
        )

    output = {
        "schema_version": SCHEMA_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "ablation_arm": ablation_arm,
        "ablation_arm_config": {
            "use_signed_scoring": use_signed_scoring,
            "apply_591_filter": apply_filter,
        },
        "method": (
            f"anomaly_score = sum over (indicator in event_category) of "
            f"{'direction × z_score' if use_signed_scoring else '|z_score|'}"
            f" × weight"
            f"{' (post-#591 filter)' if apply_filter else ''}. "
            "AUC computed per event_category against y_post_cutoff with "
            f"bootstrap 95% CI ({DEFAULT_BOOTSTRAP_RESAMPLES} resamples). "
            "Stratified AUC by n_indicators_used (threshold "
            f"{STRATA_INDICATOR_COUNT_THRESHOLD}). ECE computed per category "
            f"and cross-category ({N_ECE_BINS} bins, min-max-scaled)."
        ),
        "method_caveats": [
            # Documented per Sonnet review 2026-05-03 (MAJOR #1 + MINOR #4).
            "Imbalanced ground truth bias: ground truth excludes (country, "
            "event_category) cells where the country never had ANY event of "
            "that category (pre or post cutoff). High-base-rate categories "
            "(e.g. bilateral_treaty ~0.72) suppress discrimination signal. "
            "Mean AUC is therefore a LOWER bound on per-cell predictive power.",
            "Cross-category ECE (`ece` field, `reliability_diagram`) reflects "
            "category-base-rate mixing, NOT per-category calibration. Use "
            "`per_event_category_ece` for per-category calibration instead. "
            "Both retained: cross-category for v3 backward-compat, "
            "per-category for Phase 5+ analysis.",
            "Bootstrap CI on per-category AUC uses percentile method "
            "(non-bias-corrected). For categories with n < 10 valid resamples "
            "the CI is reported as None — typically driven by all-same-label "
            "in many bootstrap draws when the ground-truth positive count is "
            "small, or when the underlying cell count is below the data-"
            "sufficiency floor of 5 (in which case the point-AUC is also None).",
            "In signed-scoring mode (arms A, B), indicators with direction:0 "
            "in the catalog contribute zero to the anomaly_score. The "
            "stratified-AUC `n_indicators_used` threshold counts ALL joined "
            "indicators (including direction:0 zero-contributors), so the "
            "stratification reflects candidate-pool size, not "
            "effective-signal-pool size.",
            "Risk-direction inversion (signed arms A, B): catalog convention "
            "is `+1 = protective`. To keep `anomaly_score` interpretable as a "
            "RISK score (HIGH → HIGH event probability — required for AUC "
            "vs y_post_cutoff comparability with the unsigned arms C, D), "
            "per-row partial scores in signed mode are negated: "
            "risk_partial = -(weight × direction × z_score). This makes "
            "signed and unsigned arm AUCs directly comparable, and makes "
            "the A-vs-D delta a directional improvement measure. See "
            "_derive_category_seed sibling for the related determinism fix.",
        ],
        "config": {
            "cutoff_year": cutoff_year,
            "end_year": end_year,
            "zscore_window_years": ZSCORE_WINDOW_YEARS,
            "n_ece_bins": N_ECE_BINS,
            "with_baselines": with_baselines,
            "baseline_seed": baseline_seed if with_baselines else None,
            "ablation_arm": ablation_arm,
            "use_signed_scoring": use_signed_scoring,
            "apply_591_filter": apply_filter,
            "bootstrap_resamples": bootstrap_resamples,
            "bootstrap_seed": bootstrap_seed,
            "strata_indicator_count_threshold": STRATA_INDICATOR_COUNT_THRESHOLD,
        },
        "summary": {
            "n_event_categories": len(per_cat),
            "n_event_categories_with_auc": len(aucs_real),
            "n_predictions": treatment["n_predictions"],
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
        # v4 NEW top-level keys
        "stratified_auc": treatment["stratified_auc"],
        "per_event_category_ece": treatment["per_event_category_ece"],
        # v4 Step 3 anchor-case battery (regression suite per
        # cascade-anchor-case-battery.json; Kwame's warning: passing != validation)
        "anchor_case_battery": treatment["anchor_case_battery"],
    }

    # Baselines (#598): when --with-baselines fires, attach the uniform and
    # random-weight evaluation summaries as top-level keys. The treatment-vs-
    # baseline comparison is what tells us whether the EB priors carry signal.
    # Both baseline blocks include n_predictions so the Ihsa-convening
    # sanity check (same pipeline, different weights → same n_predictions)
    # is mechanical, not manual. Sonnet review (MINOR #3, Phase 4 v0.2).
    if baseline_uniform is not None:
        output["baseline_uniform"] = {
            "mean_auc": baseline_uniform["mean_auc"],
            "median_auc": baseline_uniform["median_auc"],
            "ece": baseline_uniform["ece"],
            "n_predictions": baseline_uniform["n_predictions"],
            "n_event_categories_with_auc": baseline_uniform["n_event_categories_with_auc"],
            "n_auc_above_0_55": baseline_uniform["n_auc_above_0_55"],
            "n_auc_above_0_65": baseline_uniform["n_auc_above_0_65"],
            "per_event_category_auc": baseline_uniform["per_event_category_auc"],
            "reliability_diagram": baseline_uniform["reliability_diagram"],
        }
    if baseline_random is not None:
        output["baseline_random"] = {
            "seed": baseline_seed,
            "mean_auc": baseline_random["mean_auc"],
            "median_auc": baseline_random["median_auc"],
            "ece": baseline_random["ece"],
            "n_predictions": baseline_random["n_predictions"],
            "n_event_categories_with_auc": baseline_random["n_event_categories_with_auc"],
            "n_auc_above_0_55": baseline_random["n_auc_above_0_55"],
            "n_auc_above_0_65": baseline_random["n_auc_above_0_65"],
            "per_event_category_auc": baseline_random["per_event_category_auc"],
            "reliability_diagram": baseline_random["reliability_diagram"],
        }
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"    wrote validation report → {output_path.name}")

    # Legacy alias: keep phase4-validation.json pointing at the D-arm
    # output so v3 consumers (no --ablation-arm awareness) keep working.
    # For non-D arms, no legacy alias is written.
    if ablation_arm == "D":
        OUTPUT_JSON_LEGACY.write_text(json.dumps(output, indent=2), encoding="utf-8")
        print(f"    wrote legacy alias → {OUTPUT_JSON_LEGACY.name} (D-arm)")

    print(f"\n=== DECISION ===")
    print(f"  {decision}: {decision_rationale}")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--cutoff-year", type=int, default=DEFAULT_CUTOFF_YEAR)
    p.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
    p.add_argument("--with-baselines", action="store_true",
                   help="Run uniform-weight and random-weight baselines alongside "
                        "the regular Phase 3 weights. Output JSON gets top-level "
                        "`baseline_uniform` and `baseline_random` keys with the "
                        "same shape as `summary`. This is the comparison the "
                        "post-Phase-4 Ihsa convening uses to decide whether the "
                        "weights carry signal vs the scoring formula being the "
                        "bottleneck (#598). To force a refresh of the baselines, "
                        "delete or rename `weight-matrix.json` and re-bake.")
    p.add_argument("--baseline-seed", type=int, default=DEFAULT_BASELINE_SEED,
                   help=f"Seed for the random-weight baseline (default {DEFAULT_BASELINE_SEED}). "
                        "Fixed for reproducibility.")
    p.add_argument("--ablation-arm", choices=ABLATION_ARMS, default=DEFAULT_ABLATION_ARM,
                   help="Phase 5 v0.1a 4-arm ablation arm. "
                        "A = signed × #591 filter (treatment), "
                        "B = signed × no filter (formula-only), "
                        "C = unsigned × #591 filter (filter-only), "
                        f"D = unsigned × no filter (Phase 4 v0.2 baseline, default).")
    p.add_argument("--bootstrap-resamples", type=int, default=DEFAULT_BOOTSTRAP_RESAMPLES,
                   help=f"Bootstrap resamples for per-category AUC CI "
                        f"(default {DEFAULT_BOOTSTRAP_RESAMPLES}).")
    p.add_argument("--bootstrap-seed", type=int, default=DEFAULT_BOOTSTRAP_SEED,
                   help=f"Seed for bootstrap resampling (default {DEFAULT_BOOTSTRAP_SEED}). "
                        "Fixed for reproducibility.")
    args = p.parse_args()
    main(
        cutoff_year=args.cutoff_year,
        end_year=args.end_year,
        with_baselines=args.with_baselines,
        baseline_seed=args.baseline_seed,
        ablation_arm=args.ablation_arm,
        bootstrap_resamples=args.bootstrap_resamples,
        bootstrap_seed=args.bootstrap_seed,
    )
