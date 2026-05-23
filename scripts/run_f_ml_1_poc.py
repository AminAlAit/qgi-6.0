"""F-ML-1 per-recipe ML loop PoC driver.

Per `qgi-docs/internal/ops/ml-track/F-ML-1-pre-reg.md` (ratified 8/8 2026-05-21).

Parameterized for any recipe whose per-recipe pre-reg has been 3-seat
mechanics Majles ratified. Default values preserve civil_war_and_insurgency
backward compatibility. Override via CLI flags for other recipes.

Implements:
  §3.1  three-gate LOCK criterion (Global LOCO + per-cohort LOCO + per-cohort ECE)
  §4    architecture menu {LR, XGBoost, MLP} with mechanical fold-variance trigger
  §5    hybrid greedy outer + L1 inner; full LOCO no subsampling; window grid
  §6    descriptive emit with full-window per-tertile trajectory signature
  §10   DECISION-file-ready output JSON

Bindings honored:
  - Tariq T20-1/2: no same-walk-data amendments; positive provenance required
  - Ji-Hoon R1: DEPRECATED via F-ML-N §4.2 amendment 2026-05-22; XGBoost is now
    binding for N_pos>=60; fold-variance is informational diagnostic only (§4.2-SD)
  - Ji-Hoon R2: full LOCO across all 9 windows; no subsampling
  - Miriam M14-1: full-window per-tertile temporal profile in trajectory signature
  - Roshani R18-A/B: BCa bootstrap (B=2000); window_ci method explicit
  - Marcus M8-1/2: per-recipe floor provenance annotation; unified field-3 schema
  - Nasrin N-2: window_search_auxiliary_note in DECISION emit

F-ML-N §4.2 amendment 2026-05-22 (qgi-aws-tf#864, 8/8 ratified):
  - Original §4.2 fold-variance MLP trigger (threshold 0.05) REMOVED
  - XGBoost is binding for N_pos>=60; no automatic architecture swap
  - New §4.2-SD: mandatory stability diagnostic (LOW/MODERATE/HIGH labels);
    does NOT gate architecture; informational only
  - MLP not eliminated from menu; reintroduction requires F-ML-N+1 pre-reg
  - Amendment artifact: qgi-docs/internal/decisions/artifacts/F-ML-N-§4.2-amendment-2026-05-22.md

Mechanical correctness fix (2026-05-22): country_id normalization replaces `_`
with ` ` before `.title()` to match parquet panel + cohort-assignments format.
Discovered pre-walk-2 during econ_recession pre-reg prep. Civil_war walk-1 ran
WITHOUT this fix; its DECISION stands as ratified (the bug did not alter
HARD_FAIL routing). See per-recipe-pre-reg/economic-recession-pre-reg.md §3.a.

Run-time: multi-hour laptop. Zero AWS spend.

Usage (civil_war defaults):
    python scripts/run_f_ml_1_poc.py \\
        --output-dir ../qgi-docs/internal/ops/ml-track/results/f-ml-1-poc/

Usage (economic_recession, per-recipe pre-reg values):
    python scripts/run_f_ml_1_poc.py \\
        --recipe-id economic_recession \\
        --hybrid-baseline 0.4784 \\
        --lock-floor 0.65 \\
        --cohort-loco-floor 0.60 \\
        --output-dir ../qgi-docs/internal/ops/ml-track/results/f-ml-1-econ-rec/
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
SCRIPTS_ROOT = REPO_ROOT / "scripts"
for _p in (SCRIPTS_ROOT, SRC_ROOT, REPO_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("f-ml-1-poc")

# ---- F-ML-1 pre-reg binding constants ---------------------------------------

# Default values match civil_war_and_insurgency walk-1 (preserved for backward
# compatibility). For other recipes, override RECIPE_ID + HYBRID_BASELINE +
# LOCK_FLOOR + COHORT_LOCO_FLOOR via CLI flags. Each per-recipe pre-reg must
# be 3-seat mechanics Majles ratified before the corresponding walk fires
# (per F-ML-1 §2.5 + Marcus M8-1).
DEFAULT_RECIPE_ID = "civil_war_and_insurgency"

# §7 PoC scope (civil_war defaults)
DEFAULT_HYBRID_BASELINE = 0.7686  # per-recipe floor provenance: cascade-inherited (Marcus M8-1 path (a))
DEFAULT_LOCK_FLOOR = 0.7986       # HYBRID_BASELINE + 0.03

# §3.1 per-cohort floors (civil_war defaults)
DEFAULT_COHORT_LOCO_FLOOR = 0.68  # Kwame R1, civil_war-anchored
COHORT_ECE_GATE = 0.08            # F-H-7 inherited (not recipe-specific)

# §5 indicator selection
TOP_N_PREFILTER = 40
DELTA_STEP = 0.005  # greedy outer-loop stopping
THIN_RECIPE_CAP = 5  # N_pos < 60 → outer loop cap

# §5.4 window grid
WINDOW_GRID = [3, 5, 7, 10, 12, 15, 18, 21, 25]

# §4.2 MLP fold-variance trigger — DEPRECATED 2026-05-22 per F-ML-N amendment
# (qgi-aws-tf#864). XGBoost is now binding for N_pos>=60; no automatic MLP swap.
# Constant retained as a historical record only (not referenced in active code).
# See qgi-docs/internal/decisions/artifacts/F-ML-N-§4.2-amendment-2026-05-22.md
MLP_FOLD_VARIANCE_TRIGGER_DEPRECATED = 0.05  # noqa: F841 — kept for archival reference

# §3.1 Roshani R18-A bootstrap
BCA_BOOTSTRAP_B = 2000

# Country-name normalization overrides (2026-05-22).
# Naive `country_id.replace("_", " ").title()` fails for 4 country_ids whose
# canonical forms in the parquet panels + cohort-assignments.json use hyphens
# or lowercase conjunctions/articles. Verified by enumeration over all
# positives.csv country_ids vs panel_set × cohort_assignments_set. See
# `qgi-docs/internal/ops/ml-track/per-recipe-pre-reg/economic-recession-pre-reg.md` §3.a.
COUNTRY_NAME_OVERRIDES: dict[str, str] = {
    "democratic_republic_of_congo": "The Democratic Republic of the Congo",
    "guinea_bissau": "Guinea-Bissau",
    "republic_of_congo": "Republic of the Congo",
    "timor_leste": "Timor-Leste",
}


def normalize_country_id(country_id: str) -> str:
    """Normalize a positives.csv `country_id` to canonical Title Case form
    matching parquet panels + cohort-assignments.json.

    For 12 of 16 multi-word country_ids the naive
    `country_id.replace("_", " ").title()` is correct (e.g., "costa_rica" →
    "Costa Rica"). For the remaining 4 it produces a mismatch — overridden
    by `COUNTRY_NAME_OVERRIDES`.
    """
    if country_id in COUNTRY_NAME_OVERRIDES:
        return COUNTRY_NAME_OVERRIDES[country_id]
    return country_id.replace("_", " ").title()

# ---- AUC + bootstrap CI -----------------------------------------------------


def compute_auc(probs: np.ndarray, labels: np.ndarray) -> float:
    """Mann-Whitney U AUC (no sklearn dep at hot path)."""
    probs = np.asarray(probs, dtype=float)
    labels = np.asarray(labels, dtype=int)
    p_pos = probs[labels == 1]
    p_neg = probs[labels == 0]
    if len(p_pos) == 0 or len(p_neg) == 0:
        return float("nan")
    n_concordant = 0.0
    for p in p_pos:
        n_concordant += np.sum(p_neg < p) + 0.5 * np.sum(p_neg == p)
    return n_concordant / (len(p_pos) * len(p_neg))


def bca_bootstrap_auc_ci(
    probs: np.ndarray, labels: np.ndarray, B: int = BCA_BOOTSTRAP_B, seed: int = 0
) -> dict[str, float]:
    """BCa bootstrap on AUC. Returns point + 80% + 95% CI bands.

    Per Roshani R18-A: B=2000 (default); BCa correction for bias + acceleration.
    """
    rng = np.random.default_rng(seed)
    n = len(probs)
    point = compute_auc(probs, labels)

    boot_aucs = np.empty(B)
    for b in range(B):
        idx = rng.integers(0, n, size=n)
        boot_aucs[b] = compute_auc(probs[idx], labels[idx])
    boot_aucs = boot_aucs[~np.isnan(boot_aucs)]

    # BCa bias correction
    z0 = _phi_inv(np.mean(boot_aucs < point))

    # BCa acceleration via jackknife
    jack = np.empty(n)
    for i in range(n):
        mask = np.arange(n) != i
        jack[i] = compute_auc(probs[mask], labels[mask])
    jack_mean = np.nanmean(jack)
    diffs = jack_mean - jack
    num = np.nansum(diffs ** 3)
    den = 6.0 * (np.nansum(diffs ** 2) ** 1.5 + 1e-12)
    a_hat = num / den

    def _bca_quantile(q: float) -> float:
        z_q = _phi_inv(q)
        adj = z0 + (z0 + z_q) / max(1.0 - a_hat * (z0 + z_q), 1e-9)
        return float(_phi(adj))

    return {
        "auc": float(point),
        "ci80_lo": float(np.percentile(boot_aucs, 100 * _bca_quantile(0.10))),
        "ci80_hi": float(np.percentile(boot_aucs, 100 * _bca_quantile(0.90))),
        "ci95_lo": float(np.percentile(boot_aucs, 100 * _bca_quantile(0.025))),
        "ci95_hi": float(np.percentile(boot_aucs, 100 * _bca_quantile(0.975))),
        "n_bootstrap": int(B),
        "method": "bca_bootstrap",
    }


def _phi(x: float) -> float:
    from scipy.stats import norm
    return float(norm.cdf(x))


def _phi_inv(p: float) -> float:
    from scipy.stats import norm
    p = min(max(p, 1e-6), 1.0 - 1e-6)
    return float(norm.ppf(p))


# ---- Indicator panel loading ------------------------------------------------


def list_candidate_indicators(panel_dir: Path) -> list[str]:
    """Return list of all candidate indicator IDs in the substrate."""
    return sorted([p.name for p in panel_dir.iterdir() if p.is_dir()])


def load_panel(indicator_id: str, panel_dir: Path) -> pd.DataFrame:
    """Load one indicator's parquet panel. Returns DataFrame with country, year, value."""
    path = panel_dir / indicator_id / f"{indicator_id}.parquet"
    df = pd.read_parquet(path)
    # Normalize country names to Title Case (parquet panels use Title Case;
    # positives.csv uses lowercase — caller normalizes positives instead)
    return df


# ---- Feature extraction -----------------------------------------------------


def extract_features_for_indicator(
    panel: pd.DataFrame, country: str, year: int, window: int
) -> np.ndarray | None:
    """Per-indicator per-window feature vector.

    Returns 8 features:
        [last_z, mean_z, std_z, slope, accel, tertile1_mean, tertile2_mean, tertile3_mean]
    All z-scored vs panel-wide (cross-country) distribution at year-1.

    Returns None if insufficient data in window.
    """
    cdf = panel[panel["country"] == country]
    series = cdf.set_index("year")["value"]
    window_data = series.loc[year - window:year - 1].dropna()
    if len(window_data) < max(3, window // 3):
        return None

    # Panel-wide z-score normalization
    panel_at_year = panel[panel["year"] == year - 1]["value"].dropna()
    if len(panel_at_year) < 10:
        # Fallback: use country's own recent baseline if cross-country reference unavailable
        baseline = series.loc[max(year - 25, series.index.min()):year - 1].dropna()
        mu = float(baseline.mean())
        sd = float(baseline.std())
    else:
        mu = float(panel_at_year.mean())
        sd = float(panel_at_year.std())
    if sd < 1e-9:
        sd = 1.0
    z = (window_data.values - mu) / sd

    # Tertiles (per Miriam M14-1)
    t1, t2, t3 = np.array_split(z, 3)
    t1m = float(t1.mean()) if len(t1) > 0 else 0.0
    t2m = float(t2.mean()) if len(t2) > 0 else 0.0
    t3m = float(t3.mean()) if len(t3) > 0 else 0.0

    # Linear slope
    x = np.arange(len(z), dtype=float)
    if len(z) >= 2:
        slope = float(np.polyfit(x, z, 1)[0])
    else:
        slope = 0.0

    # Quadratic acceleration coefficient
    if len(z) >= 3:
        coefs = np.polyfit(x, z, 2)
        accel = float(2.0 * coefs[0])
    else:
        accel = 0.0

    return np.array(
        [float(z[-1]), float(z.mean()), float(z.std()), slope, accel, t1m, t2m, t3m],
        dtype=float,
    )


def build_X_y(
    samples: pd.DataFrame,
    selected_indicators: list[str],
    window: int,
    panels: dict[str, pd.DataFrame],
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Build feature matrix for one (selected_set, window) configuration.

    Returns:
        X: (n_valid, 8 * n_indicators) feature matrix
        y: (n_valid,) labels
        countries: (n_valid,) per-row country
        years: (n_valid,) per-row year
    """
    X_rows = []
    y_rows = []
    c_rows = []
    yr_rows = []
    for _, row in samples.iterrows():
        country = str(row["country"])
        year = int(row["year"])
        feat_parts = []
        skip = False
        for ind in selected_indicators:
            panel = panels[ind]
            f = extract_features_for_indicator(panel, country, year, window)
            if f is None:
                skip = True
                break
            feat_parts.append(f)
        if skip:
            continue
        X_rows.append(np.concatenate(feat_parts))
        y_rows.append(int(row["label"]))
        c_rows.append(country)
        yr_rows.append(year)
    if not X_rows:
        return np.zeros((0, 0)), np.zeros(0), np.array([]), np.array([])
    return (
        np.vstack(X_rows),
        np.array(y_rows),
        np.array(c_rows),
        np.array(yr_rows),
    )


# ---- LOCO + architecture ----------------------------------------------------


def fit_predict_loco(
    X: np.ndarray,
    y: np.ndarray,
    countries: np.ndarray,
    years: np.ndarray,
    architecture: str,
    seed: int = 0,
) -> dict[str, Any]:
    """Run full LOCO with the specified architecture.

    Returns pooled predictions + per-country AUC for fold-variance computation.
    Per Ji-Hoon R2: no subsampling. Full country fold.
    """
    from sklearn.preprocessing import StandardScaler

    unique_countries = sorted(set(countries.tolist()))
    pooled_probs: list[float] = []
    pooled_labels: list[int] = []
    pooled_countries: list[str] = []
    pooled_years: list[int] = []
    per_country_auc: dict[str, float] = {}

    for held in unique_countries:
        train_mask = countries != held
        test_mask = countries == held
        if test_mask.sum() == 0 or train_mask.sum() == 0:
            continue
        y_train = y[train_mask]
        if len(np.unique(y_train)) < 2:
            continue
        X_train = X[train_mask]
        X_test = X[test_mask]
        y_test = y[test_mask]
        n_pos = int((y_train == 1).sum())
        n_neg = int((y_train == 0).sum())
        spw = (n_neg / max(n_pos, 1)) if n_pos > 0 else 1.0

        # Replace NaN with 0
        X_train = np.where(np.isfinite(X_train), X_train, 0.0)
        X_test = np.where(np.isfinite(X_test), X_test, 0.0)

        if architecture == "LR":
            from sklearn.linear_model import LogisticRegression
            scaler = StandardScaler()
            Xt = scaler.fit_transform(X_train)
            Xte = scaler.transform(X_test)
            # Per F-ML-1 §5.2: L1-regularized inner model (Sonnet PR#90 B1).
            clf = LogisticRegression(
                C=1.0, penalty="l1", solver="saga", class_weight="balanced",
                max_iter=2000, random_state=seed,
            )
            clf.fit(Xt, y_train)
            probs = clf.predict_proba(Xte)[:, 1]
        elif architecture == "XGBoost":
            from xgboost import XGBClassifier
            # Per F-ML-1 §5.2: L1-regularized inner model (Sonnet PR#90 B1).
            # reg_alpha=0.1 inside XGBoost provides L1 regularization handling
            # collinearity at each greedy step.
            clf = XGBClassifier(
                n_estimators=200, max_depth=6, learning_rate=0.05,
                reg_alpha=0.1,
                scale_pos_weight=spw, eval_metric="logloss",
                random_state=seed, verbosity=0, n_jobs=1,
            )
            clf.fit(X_train, y_train)
            probs = clf.predict_proba(X_test)[:, 1]
        elif architecture == "MLP":
            from sklearn.neural_network import MLPClassifier
            scaler = StandardScaler()
            Xt = scaler.fit_transform(X_train)
            Xte = scaler.transform(X_test)
            clf = MLPClassifier(
                hidden_layer_sizes=(16,), activation="relu",
                solver="adam", learning_rate_init=1e-3, max_iter=200,
                early_stopping=True, random_state=seed,
            )
            clf.fit(Xt, y_train)
            probs = clf.predict_proba(Xte)[:, 1]
        else:
            raise ValueError(f"Unknown architecture {architecture!r}")

        pooled_probs.extend(probs.tolist())
        pooled_labels.extend(y_test.tolist())
        pooled_countries.extend([held] * test_mask.sum())
        pooled_years.extend(years[test_mask].tolist())
        if len(np.unique(y_test)) >= 2:
            per_country_auc[held] = compute_auc(probs, y_test)

    return {
        "probs": np.array(pooled_probs),
        "labels": np.array(pooled_labels),
        "countries": np.array(pooled_countries),
        "years": np.array(pooled_years),
        "per_country_auc": per_country_auc,
        "global_auc": compute_auc(np.array(pooled_probs), np.array(pooled_labels)),
    }


def _stability_label(fv: float) -> str:
    """Per F-ML-1 §4.2-SD: LOW (σ² < 0.04), MODERATE (0.04 ≤ σ² ≤ 0.10),
    HIGH (σ² > 0.10). Extracted as a named helper so tests can verify the
    driver's own thresholding logic directly (per Sonnet PR#92 FU-3)."""
    if fv < 0.04:
        return "LOW"
    elif fv <= 0.10:
        return "MODERATE"
    else:
        return "HIGH"


def _build_stability_diagnostic(per_country_auc: dict[str, float]) -> dict[str, Any]:
    """Per F-ML-1 §4.2-SD: compute the informational stability diagnostic
    emitted on every walk under the F-ML-N amendment.

    §4.2-SD requires logging: (1) per-fold AUC values, (2) fold-AUC mean,
    (3) fold-AUC variance, (4) qualitative label. Extracted as a helper so
    tests can verify it directly (per Sonnet PR#92 FU-2 + FU-3).
    """
    aucs = np.array(list(per_country_auc.values()))
    aucs = aucs[~np.isnan(aucs)]
    fv = float(np.var(aucs)) if len(aucs) >= 2 else 0.0
    fold_auc_mean = float(np.mean(aucs)) if len(aucs) >= 1 else float("nan")
    return {
        "fold_variance": fv,
        "fold_auc_mean": fold_auc_mean,
        "label": _stability_label(fv),
        "per_country_loco_auc": {k: float(v) for k, v in per_country_auc.items()},
        "thresholds": {"LOW_upper": 0.04, "MODERATE_upper": 0.10},
        "informational_only": True,
        "amendment_reference": (
            "F-ML-N §4.2 amendment 2026-05-22 (qgi-aws-tf#864); see "
            "qgi-docs/internal/decisions/artifacts/F-ML-N-§4.2-amendment-2026-05-22.md"
        ),
    }


def fold_variance(per_country_auc: dict[str, float]) -> float:
    """Per Ji-Hoon R1: variance of per-country LOCO-AUC."""
    aucs = np.array(list(per_country_auc.values()))
    aucs = aucs[~np.isnan(aucs)]
    if len(aucs) < 2:
        return 0.0
    return float(np.var(aucs))


def window_ci_via_bootstrap_argmax(
    per_window_predictions: dict[int, tuple[np.ndarray, np.ndarray]],
    B: int = BCA_BOOTSTRAP_B,
    seed: int = 0,
) -> tuple[int, int]:
    """Per Roshani R18-B: window_ci via bootstrap argmax-window distribution.

    For each of B bootstrap iterations:
      1. Resample with replacement (same indices across all windows for paired comparison)
      2. Compute AUC at each window on the bootstrap sample
      3. Record argmax_window
    Return [2.5, 97.5] percentile range of argmax_windows.
    """
    if not per_window_predictions:
        return (0, 0)
    windows = sorted(per_window_predictions.keys())
    # Ensure all windows have same N (some may differ due to data availability)
    common_n = min(len(per_window_predictions[w][0]) for w in windows)
    if common_n < 10:
        return (windows[0], windows[-1])
    rng = np.random.default_rng(seed)
    argmax_windows: list[int] = []
    for _ in range(B):
        idx = rng.integers(0, common_n, size=common_n)
        best_auc = -1.0
        best_window = windows[0]
        for w in windows:
            probs, labels = per_window_predictions[w]
            probs_b = probs[:common_n][idx]
            labels_b = labels[:common_n][idx]
            auc = compute_auc(probs_b, labels_b)
            if not np.isnan(auc) and auc > best_auc:
                best_auc = auc
                best_window = w
        argmax_windows.append(best_window)
    return (
        int(np.percentile(argmax_windows, 2.5)),
        int(np.percentile(argmax_windows, 97.5)),
    )


# ---- Univariate screen ------------------------------------------------------


def univariate_loco_screen(
    samples: pd.DataFrame,
    candidates: list[str],
    panels: dict[str, pd.DataFrame],
    default_window: int = 10,
    top_n: int = TOP_N_PREFILTER,
) -> tuple[list[str], dict[str, dict]]:
    """Per §5.1: univariate LOCO-AUC screen → top-N.

    Uses LR (fast) at default 10y window. Per F-ML-1 §5.1 the screen is
    architecture-agnostic and pre-filter only.
    """
    LOG.info("Univariate screen: %d candidates × default %d-y window", len(candidates), default_window)
    scores: dict[str, dict] = {}
    for i, ind in enumerate(candidates):
        if i % 20 == 0:
            LOG.info("  ...%d/%d", i, len(candidates))
        X, y, c, yr = build_X_y(samples, [ind], default_window, panels)
        if len(X) < 30:
            scores[ind] = {"univariate_loco_auc": float("nan"), "n_valid": int(len(X))}
            continue
        res = fit_predict_loco(X, y, c, yr, architecture="LR", seed=0)
        scores[ind] = {
            "univariate_loco_auc": float(res["global_auc"]),
            "n_valid": int(len(X)),
        }
    ranked = sorted(
        candidates,
        key=lambda i: scores[i]["univariate_loco_auc"] if not np.isnan(scores[i]["univariate_loco_auc"]) else -1.0,
        reverse=True,
    )
    return ranked[:top_n], scores


# ---- Greedy outer + window search -------------------------------------------


def greedy_outer_loop(
    samples: pd.DataFrame,
    candidates_top_n: list[str],
    panels: dict[str, pd.DataFrame],
    architecture: str,
    delta_step: float = DELTA_STEP,
    max_steps: int | None = None,
    seed: int = 0,
) -> dict[str, Any]:
    """Per §5.2/§5.3/§5.4: greedy outer loop with concurrent window search.

    At each step, evaluate (each remaining candidate × each window) via full LOCO.
    Pick the best (candidate, window) pair; add if lift ≥ delta_step.
    Per Ji-Hoon R2: full LOCO, no subsampling.
    """
    selected: list[str] = []
    chosen_window: int | None = None
    remaining = list(candidates_top_n)
    history: list[dict] = []

    # Current LOCO-AUC with empty set = baseline (random)
    current_auc = 0.5

    step = 0
    if max_steps is None:
        max_steps = len(candidates_top_n)
    while remaining and step < max_steps:
        step += 1
        LOG.info("Greedy step %d/%d (selected=%d, remaining=%d)", step, max_steps, len(selected), len(remaining))
        best = None
        for ci, cand in enumerate(remaining):
            for win in WINDOW_GRID:
                trial_set = selected + [cand]
                X, y, c, yr = build_X_y(samples, trial_set, win, panels)
                if len(X) < 30 or len(np.unique(y)) < 2:
                    continue
                res = fit_predict_loco(X, y, c, yr, architecture=architecture, seed=seed)
                auc = res["global_auc"]
                if best is None or auc > best["auc"]:
                    best = {"candidate": cand, "window": win, "auc": auc, "n_valid": len(X)}
            if (ci + 1) % 5 == 0:
                LOG.info("  evaluated %d/%d candidates at step %d", ci + 1, len(remaining), step)
        if best is None:
            LOG.info("  no candidate produced a valid LOCO; halting greedy")
            break
        lift = best["auc"] - current_auc
        LOG.info("  step %d best: %s at %d-y window, AUC=%.4f, lift=%+.4f",
                 step, best["candidate"], best["window"], best["auc"], lift)
        history.append({
            "step": step,
            "candidate": best["candidate"],
            "window": best["window"],
            "auc": float(best["auc"]),
            "lift_over_previous": float(lift),
            "selected_after": selected + [best["candidate"]],
        })
        if lift < delta_step:
            LOG.info("  lift below delta_step=%.4f; greedy halts (greedy-stopping invariant)", delta_step)
            break
        selected.append(best["candidate"])
        chosen_window = best["window"]
        remaining.remove(best["candidate"])
        current_auc = best["auc"]
    return {
        "selected_indicators": selected,
        "chosen_window": chosen_window,
        "final_global_auc": float(current_auc),
        "history": history,
    }


# ---- Per-cohort ECE ---------------------------------------------------------


def compute_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 10) -> float:
    if len(probs) == 0:
        return float("nan")
    bins = np.linspace(0, 1, n_bins + 1)
    idx = np.clip(np.digitize(probs, bins) - 1, 0, n_bins - 1)
    n = len(probs)
    ece = 0.0
    for b in range(n_bins):
        mask = idx == b
        if mask.sum() == 0:
            continue
        ece += (mask.sum() / n) * abs(probs[mask].mean() - labels[mask].mean())
    return float(ece)


def per_cohort_loco_and_ece(
    probs: np.ndarray,
    labels: np.ndarray,
    countries: np.ndarray,
    years: np.ndarray,
    cohort_assignments: dict,
) -> dict[str, dict[str, Any]]:
    cohorts = {"fragile-state": [], "mid-tier": [], "stable-democracy": []}
    for i in range(len(probs)):
        c = str(countries[i]).title()  # Title Case for cohort lookup
        yr = str(int(years[i]))
        cohort = cohort_assignments.get(c, {}).get(yr)
        if cohort in cohorts:
            cohorts[cohort].append((float(probs[i]), int(labels[i])))
    out: dict[str, dict[str, Any]] = {}
    rng = np.random.default_rng(0)
    for cohort, data in cohorts.items():
        if len(data) < 5:
            out[cohort] = {"n": len(data), "loco_auc": None, "ece": None, "low_confidence": True}
            continue
        p = np.array([x[0] for x in data])
        y = np.array([x[1] for x in data])
        if len(np.unique(y)) < 2:
            cohort_auc = float("nan")
        else:
            cohort_auc = compute_auc(p, y)
        ece = compute_ece(p, y)
        # Bootstrap ECE 95% CI
        boots = []
        for _ in range(500):
            ix = rng.integers(0, len(p), len(p))
            boots.append(compute_ece(p[ix], y[ix]))
        # Reliability diagram bins (per Sonnet PR#90 B2 residual: was None;
        # F-ML-1 §6 field 4 requires `reliability_diagram_bins` to be populated)
        n_bins = 10
        bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
        bin_idx = np.clip(np.digitize(p, bin_edges) - 1, 0, n_bins - 1)
        reliability_bins = []
        for b in range(n_bins):
            mask = bin_idx == b
            if mask.sum() == 0:
                reliability_bins.append({
                    "bin_lower": float(bin_edges[b]),
                    "bin_upper": float(bin_edges[b + 1]),
                    "n_in_bin": 0,
                    "mean_predicted": None,
                    "mean_actual": None,
                })
            else:
                reliability_bins.append({
                    "bin_lower": float(bin_edges[b]),
                    "bin_upper": float(bin_edges[b + 1]),
                    "n_in_bin": int(mask.sum()),
                    "mean_predicted": float(p[mask].mean()),
                    "mean_actual": float(y[mask].mean()),
                })
        out[cohort] = {
            "n": int(len(p)),
            "loco_auc": float(cohort_auc) if not np.isnan(cohort_auc) else None,
            "ece": float(ece),
            "ece_ci95_lo": float(np.percentile(boots, 2.5)),
            "ece_ci95_hi": float(np.percentile(boots, 97.5)),
            "low_confidence": len(p) < 30,
            "reliability_diagram_bins": reliability_bins,
        }
    return out


# ---- Descriptive emit per §6 + Miriam M14-1 ---------------------------------


def extract_trajectory_signature_full(
    panel: pd.DataFrame, country: str, year: int, window: int
) -> dict[str, Any]:
    """Per Miriam M14-1: full-window per-tertile + per-year temporal profile."""
    cdf = panel[panel["country"] == country]
    series = cdf.set_index("year")["value"]
    window_data = series.loc[year - window:year - 1].dropna()
    if len(window_data) < 3:
        return {"available": False}

    # Z-score
    baseline = series.loc[max(year - 25, series.index.min()):year - 1].dropna()
    mu = float(baseline.mean())
    sd = float(baseline.std()) or 1.0
    z = (window_data.values - mu) / sd

    t1, t2, t3 = np.array_split(z, 3)
    return {
        "available": True,
        "per_tertile_z_score": [
            float(t1.mean()) if len(t1) else 0.0,
            float(t2.mean()) if len(t2) else 0.0,
            float(t3.mean()) if len(t3) else 0.0,
        ],
        "per_tertile_direction_sign": [
            int(np.sign(t1.mean())) if len(t1) else 0,
            int(np.sign(t2.mean())) if len(t2) else 0,
            int(np.sign(t3.mean())) if len(t3) else 0,
        ],
        "temporal_profile": [float(v) for v in z.tolist()],
        "years_covered": [int(y) for y in window_data.index.tolist()],
    }


def emit_descriptive(
    selected: list[str],
    chosen_window: int,
    panels: dict[str, pd.DataFrame],
    samples: pd.DataFrame,
    final_loco: dict,
    architecture: str,
    feature_importances: list[float] | None,
    audit_chart_path: Path,
    per_cohort_profile: dict[str, dict[str, Any]] | None = None,
    window_ci: tuple[int, int] | None = None,
) -> dict[str, Any]:
    """Per F-ML-1 §6: 5 descriptive emit fields."""

    # Field 1: learned_canonical_length
    field_1 = {
        "best_window": int(chosen_window),
        "window_ci": [int(window_ci[0]), int(window_ci[1])] if window_ci else [int(chosen_window), int(chosen_window)],
        "window_search_grid": WINDOW_GRID,
        "window_ci_method": "bca_bootstrap_b2000",
    }

    # Field 2: indicator_importance_profile (SHAP-ranked)
    # For XGBoost, use feature_importances_; for LR, use abs coefficients
    # SHAP would be ideal but we'll use built-in importances for the PoC; flag as approximation
    field_2 = []
    if feature_importances is not None:
        n_feat_per_ind = 8
        for k, ind in enumerate(selected):
            block = feature_importances[k * n_feat_per_ind:(k + 1) * n_feat_per_ind]
            field_2.append({
                "indicator_id": ind,
                "importance_mean_abs": float(np.mean(np.abs(block))),
                "direction_sign": 1 if np.mean(block) > 0 else -1,
            })
        field_2 = sorted(field_2, key=lambda r: -r["importance_mean_abs"])

    # Field 3: learned_aggregation_weights (Marcus M8-2 unified schema)
    field_3 = {
        "type": "tree_importance" if architecture == "XGBoost" else "linear_coef",
        "values": [
            {"indicator_id": ind, "weight": float(np.mean(np.abs(
                feature_importances[k*8:(k+1)*8] if feature_importances is not None else [0.0]
            )))}
            for k, ind in enumerate(selected)
        ],
    }

    # Field 5: ranked_trajectory_signature (Miriam M14-1, FULL window)
    # Take top-N positives + extract trajectory for each indicator
    positives = samples[samples["label"] == 1].head(5)  # representative sample
    field_5 = {"saudi_azeri_audit_url": str(audit_chart_path), "per_indicator_signatures": []}
    for ind in selected:
        sigs = []
        for _, row in positives.iterrows():
            sig = extract_trajectory_signature_full(
                panels[ind], str(row["country"]), int(row["year"]), chosen_window
            )
            if sig["available"]:
                sigs.append({
                    "country": str(row["country"]),
                    "year": int(row["year"]),
                    **sig,
                })
        field_5["per_indicator_signatures"].append({
            "indicator_id": ind,
            "samples": sigs,
        })

    # Field 4: per_cohort_calibration_profile (Sonnet PR#90 B2 — was missing from emit)
    # Per F-ML-1 §6: required field mapping per-cohort calibration into the descriptive emit
    # (distinct from the summary root's `per_cohort` block; this is the
    # methodology-archive-grade artifact for Lloyd's audit).
    field_4 = {}
    if per_cohort_profile is not None:
        for cohort, info in per_cohort_profile.items():
            field_4[cohort] = {
                "ece": info.get("ece"),
                "ci95_lo": info.get("ece_ci95_lo"),
                "ci95_hi": info.get("ece_ci95_hi"),
                "n_test": info.get("n"),
                "reliability_diagram_bins": info.get("reliability_diagram_bins"),
            }

    return {
        "learned_canonical_length": field_1,
        "indicator_importance_profile": field_2,
        "learned_aggregation_weights": field_3,
        "per_cohort_calibration_profile": field_4,
        "ranked_trajectory_signature": field_5,
    }


# ---- Saudi-Azeri visual audit chart ----------------------------------------


def plot_saudi_azeri_audit(
    descriptive: dict, panels: dict[str, pd.DataFrame], chosen_window: int, save_path: Path
) -> str:
    """Per Miriam M14-1: visual auditability vs Saudi-Azeri canonical example."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        n_inds = len(descriptive["ranked_trajectory_signature"]["per_indicator_signatures"])
        if n_inds == 0:
            return ""
        fig, axes = plt.subplots(n_inds, 1, figsize=(10, 3 * n_inds), squeeze=False)
        for k, ind_sig in enumerate(descriptive["ranked_trajectory_signature"]["per_indicator_signatures"]):
            ax = axes[k, 0]
            for sample in ind_sig["samples"][:3]:
                profile = sample.get("temporal_profile", [])
                if profile:
                    ax.plot(profile, alpha=0.7, label=f"{sample['country']} {sample['year']}")
            ax.set_title(f"{ind_sig['indicator_id']} — {chosen_window}y trajectory (z-score)")
            ax.axhline(0, color="grey", linewidth=0.5)
            ax.legend(fontsize=8)
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=80)
        plt.close()
        LOG.info("Saudi-Azeri audit chart saved → %s", save_path)
        return str(save_path)
    except Exception as e:
        LOG.warning("Audit chart generation failed: %s", e)
        return "chart_generation_failed"  # sentinel per Sonnet PR#90 F4


# ---- Main orchestrator ------------------------------------------------------


def _to_strict_json(obj: Any) -> str:
    def _w(o):
        if isinstance(o, dict):
            return {k: _w(v) for k, v in o.items()}
        if isinstance(o, list):
            return [_w(v) for v in o]
        if isinstance(o, float):
            if np.isnan(o) or np.isinf(o):
                return None
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            v = float(o)
            return None if (np.isnan(v) or np.isinf(v)) else v
        if isinstance(o, np.ndarray):
            return [_w(x) for x in o.tolist()]
        return o
    return json.dumps(_w(obj), indent=2, ensure_ascii=False)


def _build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser. Extracted from `_main` so tests can exercise
    the SAME parser construction code path (avoiding shadow-parser drift)."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--recipe-id", default=DEFAULT_RECIPE_ID,
                        help="Recipe ID (e.g., civil_war_and_insurgency, economic_recession).")
    parser.add_argument("--hybrid-baseline", type=float, default=DEFAULT_HYBRID_BASELINE,
                        help="Per-recipe cascade-side baseline (Marcus M8-1 provenance). "
                             "Default 0.7686 = civil_war Hybrid LOCK; per-recipe pre-reg overrides.")
    parser.add_argument("--lock-floor", type=float, default=DEFAULT_LOCK_FLOOR,
                        help="Per-recipe global LOCO-AUC LOCK floor (§3.1 Gate 1). "
                             "Default 0.7986 = civil_war (Hybrid + 0.03); per-recipe pre-reg overrides.")
    parser.add_argument("--cohort-loco-floor", type=float, default=DEFAULT_COHORT_LOCO_FLOOR,
                        help="Per-cohort LOCO-AUC LOCK floor (§3.1 Gate 2). "
                             "Default 0.68 = civil_war Kwame R1 anchor; per-recipe pre-reg overrides.")
    parser.add_argument("--panel-dir", type=Path,
                        default=REPO_ROOT / "data" / "parquet_panels")
    parser.add_argument("--positives-csv", type=Path, default=None,
                        help="Positives CSV path. Defaults to "
                             "data/shape_inputs_v2/{recipe-id}/positives.csv.")
    parser.add_argument("--cohort-sidecar", type=Path,
                        default=REPO_ROOT.parent / "qgi-data" / "reference" / "cohort-assignments.json")
    parser.add_argument("--max-greedy-steps", type=int, default=12)
    parser.add_argument("--negatives-per-positive", type=int, default=3)
    parser.add_argument("--seed", type=int, default=12345)
    parser.add_argument("--max-candidates-debug", type=int, default=None,
                        help="Debug mode: cap candidates at N (NOT for production walks).")
    return parser


def _main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    recipe_id = args.recipe_id
    hybrid_baseline = float(args.hybrid_baseline)
    lock_floor = float(args.lock_floor)
    cohort_loco_floor = float(args.cohort_loco_floor)
    if args.positives_csv is None:
        args.positives_csv = REPO_ROOT / "data" / "shape_inputs_v2" / recipe_id / "positives.csv"

    LOG.info("F-ML-1 PoC starting — recipe=%s", recipe_id)
    LOG.info("Per-recipe LOCK params: hybrid_baseline=%.4f, lock_floor=%.4f, cohort_loco_floor=%.4f",
             hybrid_baseline, lock_floor, cohort_loco_floor)
    t0 = time.time()

    # Load positives + build negatives.
    # Country-name normalization (2026-05-22 mechanical correctness fix):
    # parquet panels + cohort-assignments.json use space-separated names
    # ("Costa Rica", "Bosnia and Herzegovina") AND hyphenated forms for some
    # cases ("Guinea-Bissau", "Timor-Leste") AND lowercase conjunctions/articles
    # ("Republic of the Congo"). The naive `.title()` was incorrect for ALL
    # multi-word names. `normalize_country_id` handles all 16 observed
    # positives.csv multi-word country_ids: 12 via simple replace+title, 4 via
    # COUNTRY_NAME_OVERRIDES. Pre-fix civil_war walk silently dropped 41
    # multi-word events at panel lookup (256 → 192 effective N_pos).
    # Civil_war DECISION stands as-ratified; this fix applies to walks from
    # 2026-05-22 forward. See per-recipe-pre-reg/economic-recession-pre-reg.md §3.a.
    pos = pd.read_csv(args.positives_csv)
    pos["country"] = pos["country_id"].apply(normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    pos["label"] = 1
    LOG.info("Positives: %d rows, %d unique countries", len(pos), pos["country"].nunique())

    # Startup validation: surface any normalized country name that is missing
    # from the parquet panels or cohort-assignments.json. Fail fast rather
    # than silently dropping samples at feature-extraction time (the bug class
    # discovered pre-walk-2 on 2026-05-22). At least one panel must contain
    # the country for it to participate in LOCO; missing from cohort-assignments
    # is non-fatal (the cohort gate excludes the sample but global LOCO still
    # counts it).
    pos_countries_for_check = set(pos["country"].unique())
    sample_panel_path = next(args.panel_dir.iterdir())
    sample_panel = pd.read_parquet(sample_panel_path / f"{sample_panel_path.name}.parquet")
    panel_countries_in_sample = set(sample_panel["country"].dropna().unique())
    missing_in_panel = pos_countries_for_check - panel_countries_in_sample
    if missing_in_panel:
        LOG.warning(
            "Countries in positives.csv not found in sample panel %s — "
            "feature extraction will fail for these and they will be "
            "silently dropped (verify normalize_country_id covers them): %s",
            sample_panel_path.name, sorted(missing_in_panel),
        )
    # Load cohort-assignments.json ONCE at startup and retain in memory
    # for the LOCK GATE EVAL phase. Reading the file a second time at LOCK
    # GATE EVAL (~4-5h later) was the failure mode on the original walk-4
    # attempt 2026-05-22 — a git checkout in qgi-data between startup and
    # eval swapped the working-tree file out, crashing the eval after the
    # full greedy outer loop had already run.
    with open(args.cohort_sidecar, encoding="utf-8") as _f:
        _cohort_payload = json.load(_f)
    cohort_assignments_cached = _cohort_payload["assignments"]
    missing_in_cohorts = pos_countries_for_check - set(cohort_assignments_cached.keys())
    if missing_in_cohorts:
        LOG.warning(
            "Countries in positives.csv not in cohort-assignments.json — "
            "samples will count toward global LOCO but be excluded from "
            "per-cohort gate evaluation: %s",
            sorted(missing_in_cohorts),
        )

    rng = np.random.default_rng(args.seed)
    pos_set = set(zip(pos["country"], pos["year"]))
    pos_countries = list(pos["country"].unique())
    valid_years = list(range(1980, 2023))
    n_neg_target = len(pos) * args.negatives_per_positive
    negs = []
    attempts = 0
    while len(negs) < n_neg_target and attempts < n_neg_target * 10:
        attempts += 1
        c = pos_countries[rng.integers(0, len(pos_countries))]
        y = int(valid_years[rng.integers(0, len(valid_years))])
        if (c, y) in pos_set:
            continue
        negs.append({"country": c, "year": y, "label": 0})
    samples = pd.concat([pos[["country", "year", "label"]], pd.DataFrame(negs)], ignore_index=True)
    LOG.info("Samples built: %d positives + %d negatives", (samples["label"] == 1).sum(), (samples["label"] == 0).sum())

    # Load all candidate panels
    all_candidates = list_candidate_indicators(args.panel_dir)
    if args.max_candidates_debug:
        all_candidates = all_candidates[:args.max_candidates_debug]
        LOG.warning("DEBUG: capping candidates at %d (NOT production-walk)", args.max_candidates_debug)
    LOG.info("Loading %d candidate panels...", len(all_candidates))
    panels = {ind: load_panel(ind, args.panel_dir) for ind in all_candidates}

    # Univariate screen (per §5.1)
    LOG.info("=== UNIVARIATE SCREEN ===")
    top_n_inds, univariate_scores = univariate_loco_screen(samples, all_candidates, panels)
    LOG.info("Top-%d indicators selected by univariate LOCO-AUC", len(top_n_inds))

    # Architecture per §4.2 — civil_war N_pos = 192 ≥ 60 → XGBoost default
    n_pos = int((samples["label"] == 1).sum())
    architecture = "LR" if n_pos < 60 else "XGBoost"
    LOG.info("Architecture (pre-walk per §4.2): %s (N_pos=%d)", architecture, n_pos)

    # Greedy outer loop + concurrent window search (per §5.2-§5.4)
    LOG.info("=== GREEDY OUTER LOOP + WINDOW SEARCH ===")
    cap = THIN_RECIPE_CAP if n_pos < 60 else args.max_greedy_steps
    greedy = greedy_outer_loop(
        samples, top_n_inds, panels, architecture,
        delta_step=DELTA_STEP, max_steps=cap, seed=args.seed,
    )
    LOG.info("Greedy result: %d selected, window=%s, final_AUC=%.4f",
             len(greedy["selected_indicators"]), greedy["chosen_window"], greedy["final_global_auc"])

    # Final fit with selected set + chosen window.
    # Per F-ML-N §4.2 amendment 2026-05-22: XGBoost is BINDING for N_pos >= 60.
    # The prior §4.2 fold-variance MLP trigger is removed entirely (cross-recipe
    # empirical evidence: civil_war + econ_recession both showed MLP collapse
    # by ~0.20 AUC). MLP is preserved in §4.1 menu but cannot be auto-swapped
    # without a fresh F-ML-N+1 pre-registration. See:
    # qgi-docs/internal/decisions/artifacts/F-ML-N-§4.2-amendment-2026-05-22.md
    LOG.info("=== FINAL LOCO ===")
    X, y, c, yr = build_X_y(samples, greedy["selected_indicators"], greedy["chosen_window"], panels)
    final = fit_predict_loco(X, y, c, yr, architecture=architecture, seed=args.seed)
    chosen_arch = architecture
    LOG.info("%s final LOCO-AUC=%.4f", chosen_arch, final["global_auc"])

    # §4.2-SD informational stability diagnostic (per Kwame BLOCKING rider:
    # MANDATORY logging per walk; non-optional). Records fold-variance + label
    # but does NOT gate architecture. Per Miriam M14-R5 BLOCKING: persistent
    # HIGH variance MAY be cited as contextual evidence in support of a future
    # F-ML-N+1 amendment, which requires its own prior-walk provenance + 8/8
    # ratification INDEPENDENT of this §4.2-SD signal.
    stability_diagnostic = _build_stability_diagnostic(final["per_country_auc"])
    fv = stability_diagnostic["fold_variance"]
    LOG.info("§4.2-SD diagnostic: fold-variance=%.4f, fold-AUC mean=%.4f, label=%s "
             "(informational only; does NOT gate architecture)",
             fv, stability_diagnostic["fold_auc_mean"], stability_diagnostic["label"])

    # LOCK gate eval
    lock_gate_eval_ts = datetime.now(timezone.utc).isoformat()
    LOG.info("=== LOCK GATE EVAL ===")

    # Bootstrap CI on AUC
    LOG.info("BCa bootstrap on Global LOCO-AUC (B=%d)...", BCA_BOOTSTRAP_B)
    auc_ci = bca_bootstrap_auc_ci(final["probs"], final["labels"], B=BCA_BOOTSTRAP_B, seed=args.seed)

    # Per-cohort LOCO + ECE — reuses the cohort_assignments dict loaded
    # at startup (cohort_assignments_cached) rather than re-reading from
    # disk. See startup-load rationale comment for the failure mode.
    LOG.info("Per-cohort LOCO + ECE...")
    cohort_assignments = cohort_assignments_cached
    per_cohort = per_cohort_loco_and_ece(
        final["probs"], final["labels"], final["countries"], final["years"], cohort_assignments
    )

    # Per-cohort BCa CI
    for cohort, info in per_cohort.items():
        if info["n"] >= 30 and info["loco_auc"] is not None:
            mask = np.array([
                cohort_assignments.get(str(co).title(), {}).get(str(int(yr_)), None) == cohort
                for co, yr_ in zip(final["countries"], final["years"])
            ])
            if mask.sum() >= 30:
                ci = bca_bootstrap_auc_ci(
                    final["probs"][mask], final["labels"][mask], B=BCA_BOOTSTRAP_B, seed=args.seed
                )
                info["loco_auc_ci95_lo"] = ci["ci95_lo"]
                info["loco_auc_ci95_hi"] = ci["ci95_hi"]

    # §3.1 three-gate evaluation (per-recipe floor parameters)
    global_pass = final["global_auc"] >= lock_floor
    cohort_loco_pass = all(
        (info["n"] < 5) or (info["loco_auc"] is not None and info["loco_auc"] >= cohort_loco_floor)
        for info in per_cohort.values()
    )
    cohort_ece_pass = all(
        (info["n"] < 5) or (info["ece"] is not None and info["ece"] <= COHORT_ECE_GATE)
        for info in per_cohort.values()
    )

    if global_pass and cohort_loco_pass and cohort_ece_pass:
        verdict = "LOCK"
    elif global_pass and cohort_loco_pass and not cohort_ece_pass:
        verdict = "MARGINAL_PENDING_BETA_CALIBRATION"
    else:
        verdict = "HARD_FAIL"

    borderline = bool(auc_ci["ci95_lo"] < lock_floor) if verdict == "LOCK" else False

    # Descriptive emit (per §6 + Miriam M14-1)
    LOG.info("=== DESCRIPTIVE EMIT ===")
    if chosen_arch == "XGBoost":
        # Re-fit one final XGBoost on full data to extract feature_importances_
        from xgboost import XGBClassifier
        X_all = np.where(np.isfinite(X), X, 0.0)
        full_xgb = XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            scale_pos_weight=(y==0).sum()/max((y==1).sum(),1),
            eval_metric="logloss", random_state=args.seed, verbosity=0, n_jobs=1,
        )
        full_xgb.fit(X_all, y)
        feature_importances = list(full_xgb.feature_importances_)
    else:
        feature_importances = None  # MLP: would need SHAP; skip for now

    audit_chart_path = args.output_dir / "saudi_azeri_audit.png"

    # window_search_auxiliary_note (per Nasrin N-2) + window_ci bootstrap (per Roshani R18-B)
    LOG.info("=== WINDOW-SEARCH AUXILIARY + WINDOW_CI BOOTSTRAP ===")
    final_step_history = greedy["history"][-1] if greedy["history"] else {}
    loco_auc_per_window: dict[int, float] = {}
    per_window_predictions: dict[int, tuple[np.ndarray, np.ndarray]] = {}
    if greedy["selected_indicators"]:
        for w in WINDOW_GRID:
            Xw, yw, cw, yrw = build_X_y(samples, greedy["selected_indicators"], w, panels)
            if len(Xw) < 30 or len(np.unique(yw)) < 2:
                continue
            r = fit_predict_loco(Xw, yw, cw, yrw, architecture=chosen_arch, seed=args.seed)
            loco_auc_per_window[w] = float(r["global_auc"])
            per_window_predictions[w] = (r["probs"], r["labels"])
    LOG.info("BCa argmax-window bootstrap (B=%d) for window_ci...", BCA_BOOTSTRAP_B)
    window_ci_pair = window_ci_via_bootstrap_argmax(per_window_predictions, B=BCA_BOOTSTRAP_B, seed=args.seed)
    LOG.info("window_ci=[%d, %d] (best=%s)", window_ci_pair[0], window_ci_pair[1], greedy["chosen_window"])
    window_aux = {
        "n_combinations_evaluated_final_step": int(len(WINDOW_GRID) * max(1, len(greedy["history"]))),
        "loco_auc_spread_across_windows": loco_auc_per_window,
    }

    # Now build the descriptive emit (depends on per_cohort + window_ci, computed above)
    descriptive = emit_descriptive(
        greedy["selected_indicators"], greedy["chosen_window"], panels, samples,
        final, chosen_arch, feature_importances, audit_chart_path,
        per_cohort_profile=per_cohort,
        window_ci=window_ci_pair,
    )
    chart_path = plot_saudi_azeri_audit(descriptive, panels, greedy["chosen_window"], audit_chart_path)
    descriptive["ranked_trajectory_signature"]["saudi_azeri_audit_url"] = chart_path

    # Compose DECISION-ready summary (per §10)
    elapsed = time.time() - t0
    summary = {
        "f_ml_1_pre_reg": "qgi-docs/internal/ops/ml-track/F-ML-1-pre-reg.md",
        "filed": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": elapsed,
        "recipe_id": recipe_id,
        "verdict": verdict,
        "borderline_lock": borderline,
        "n_positives": n_pos,
        "n_negatives": int((samples["label"] == 0).sum()),
        "architecture": chosen_arch,
        "architecture_provenance": {
            "default_per_n_pos_rule": "LR (<60) | XGBoost (>=60)",
            "amendment_reference": "F-ML-N §4.2 amendment 2026-05-22 (qgi-aws-tf#864): XGBoost binding for N_pos>=60; §4.2 fold-variance MLP trigger removed entirely",
            "amendment_artifact": "qgi-docs/internal/decisions/artifacts/F-ML-N-§4.2-amendment-2026-05-22.md",
            "lock_gate_eval_ts": lock_gate_eval_ts,
        },
        "stability_diagnostic": stability_diagnostic,
        "per_recipe_floor_provenance": {
            "hybrid_baseline": hybrid_baseline,
            "lock_floor": lock_floor,
            "cohort_loco_floor": cohort_loco_floor,
            "note": (
                "Marcus M8-1 path-(a)/(b)/(c) provenance: see F-ML-1 §7 "
                "(civil_war_and_insurgency / cascade-inherited) or "
                "qgi-docs/internal/ops/ml-track/per-recipe-pre-reg/ "
                "(other recipes; recipe_id with `_` -> `-` is the markdown filename stem)."
            ),
        },
        "global_loco": auc_ci,
        "per_cohort": per_cohort,
        "gates_eval": {
            "global_loco_pass": bool(global_pass),
            "per_cohort_loco_pass": bool(cohort_loco_pass),
            "per_cohort_ece_pass": bool(cohort_ece_pass),
            "global_floor": lock_floor,
            "cohort_loco_floor": cohort_loco_floor,
            "cohort_ece_gate": COHORT_ECE_GATE,
        },
        "univariate_screen": {
            "method": "LR, 10y window, ranked by global LOCO-AUC",
            "n_candidates_evaluated": len(all_candidates),
            "top_n_kept": TOP_N_PREFILTER,
            "top_n_indicators": top_n_inds,
        },
        "greedy_outer_loop": greedy,
        # Note: top-level "fold_variance" removed per Sonnet PR#92 FU-1.
        # Canonical location is `stability_diagnostic.fold_variance` (§4.2-SD).
        "descriptive_emit": descriptive,
        "window_search_auxiliary_note": window_aux,
    }
    out_path = args.output_dir / "f-ml-1-poc-summary.json"
    out_path.write_text(_to_strict_json(summary), encoding="utf-8")
    LOG.info("Wrote %s", out_path)
    LOG.info("=== F-ML-1 PoC VERDICT: %s (borderline=%s) ===", verdict, borderline)
    LOG.info("Elapsed: %.1f minutes", elapsed / 60)
    return 0


if __name__ == "__main__":
    sys.exit(_main())
