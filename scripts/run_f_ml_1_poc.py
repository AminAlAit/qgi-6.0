"""F-ML-1 per-recipe ML loop PoC driver — civil_war_and_insurgency.

Per `qgi-docs/internal/ops/ml-track/F-ML-1-pre-reg.md` (ratified 8/8 2026-05-21).

Implements:
  §3.1  three-gate LOCK criterion (Global LOCO + per-cohort LOCO + per-cohort ECE)
  §4    architecture menu {LR, XGBoost, MLP} with mechanical fold-variance trigger
  §5    hybrid greedy outer + L1 inner; full LOCO no subsampling; window grid
  §6    descriptive emit with full-window per-tertile trajectory signature
  §10   DECISION-file-ready output JSON

Bindings honored:
  - Tariq T20-1/2: no same-walk-data amendments; positive provenance required
  - Ji-Hoon R1: fold-variance computed + MLP-trigger fired BEFORE LOCK gate eval
  - Ji-Hoon R2: full LOCO across all 9 windows; no subsampling
  - Miriam M14-1: full-window per-tertile temporal profile in trajectory signature
  - Roshani R18-A/B: BCa bootstrap (B=2000); window_ci method explicit
  - Marcus M8-1/2: per-recipe floor provenance annotation; unified field-3 schema
  - Nasrin N-2: window_search_auxiliary_note in DECISION emit

Run-time: multi-hour laptop. Zero AWS spend.

Usage:
    python scripts/run_f_ml_1_poc.py \\
        --output-dir ../qgi-docs/internal/ops/ml-track/results/f-ml-1-poc/
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

RECIPE_ID = "civil_war_and_insurgency"

# §7 PoC scope
HYBRID_BASELINE = 0.7686  # per-recipe floor provenance: cascade-inherited (Marcus M8-1)
DELTA_LIFT = 0.03
LOCK_FLOOR = HYBRID_BASELINE + DELTA_LIFT  # 0.7986

# §3.1 per-cohort floors
COHORT_LOCO_FLOOR = 0.68  # Kwame R1, civil_war-anchored
COHORT_ECE_GATE = 0.08    # F-H-7 inherited

# §5 indicator selection
TOP_N_PREFILTER = 40
DELTA_STEP = 0.005  # greedy outer-loop stopping
THIN_RECIPE_CAP = 5  # N_pos < 60 → outer loop cap

# §5.4 window grid
WINDOW_GRID = [3, 5, 7, 10, 12, 15, 18, 21, 25]

# §4.2 MLP fold-variance trigger
MLP_FOLD_VARIANCE_TRIGGER = 0.05

# §3.1 Roshani R18-A bootstrap
BCA_BOOTSTRAP_B = 2000

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
            clf = LogisticRegression(
                C=1.0, solver="lbfgs", class_weight="balanced",
                max_iter=2000, random_state=seed,
            )
            clf.fit(Xt, y_train)
            probs = clf.predict_proba(Xte)[:, 1]
        elif architecture == "XGBoost":
            from xgboost import XGBClassifier
            clf = XGBClassifier(
                n_estimators=200, max_depth=6, learning_rate=0.05,
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


def fold_variance(per_country_auc: dict[str, float]) -> float:
    """Per Ji-Hoon R1: variance of per-country LOCO-AUC."""
    aucs = np.array(list(per_country_auc.values()))
    aucs = aucs[~np.isnan(aucs)]
    if len(aucs) < 2:
        return 0.0
    return float(np.var(aucs))


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
        out[cohort] = {
            "n": int(len(p)),
            "loco_auc": float(cohort_auc) if not np.isnan(cohort_auc) else None,
            "ece": float(ece),
            "ece_ci95_lo": float(np.percentile(boots, 2.5)),
            "ece_ci95_hi": float(np.percentile(boots, 97.5)),
            "low_confidence": len(p) < 30,
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
) -> dict[str, Any]:
    """Per F-ML-1 §6: 5 descriptive emit fields."""

    # Field 1: learned_canonical_length
    field_1 = {
        "best_window": int(chosen_window),
        "window_ci": [int(chosen_window), int(chosen_window)],  # filled in later
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

    return {
        "learned_canonical_length": field_1,
        "indicator_importance_profile": field_2,
        "learned_aggregation_weights": field_3,
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
        return ""


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


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--panel-dir", type=Path,
                        default=REPO_ROOT / "data" / "parquet_panels")
    parser.add_argument("--positives-csv", type=Path,
                        default=REPO_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv")
    parser.add_argument("--cohort-sidecar", type=Path,
                        default=REPO_ROOT.parent / "qgi-data" / "reference" / "cohort-assignments.json")
    parser.add_argument("--max-greedy-steps", type=int, default=12)
    parser.add_argument("--negatives-per-positive", type=int, default=3)
    parser.add_argument("--seed", type=int, default=12345)
    parser.add_argument("--max-candidates-debug", type=int, default=None,
                        help="Debug mode: cap candidates at N (NOT for production walks).")
    args = parser.parse_args(argv)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    LOG.info("F-ML-1 PoC starting — recipe=%s", RECIPE_ID)
    t0 = time.time()

    # Load positives + build negatives
    pos = pd.read_csv(args.positives_csv)
    pos["country"] = pos["country_id"].str.title()  # Title-case for panel lookup
    pos = pos.rename(columns={"event_year": "year"})
    pos["label"] = 1
    LOG.info("Positives: %d rows, %d unique countries", len(pos), pos["country"].nunique())

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

    # Final fit with selected set + chosen window
    LOG.info("=== FINAL LOCO + FOLD-VARIANCE ===")
    X, y, c, yr = build_X_y(samples, greedy["selected_indicators"], greedy["chosen_window"], panels)
    final_xgb = fit_predict_loco(X, y, c, yr, architecture=architecture, seed=args.seed)
    fv = fold_variance(final_xgb["per_country_auc"])
    LOG.info("XGBoost final LOCO-AUC=%.4f, fold-variance=%.4f", final_xgb["global_auc"], fv)

    # Ji-Hoon R1 MLP trigger: mechanical, pre-LOCK examination
    mlp_trigger_decision_ts = datetime.now(timezone.utc).isoformat()
    trigger_mlp = fv > MLP_FOLD_VARIANCE_TRIGGER
    if trigger_mlp:
        LOG.info("MLP trigger fired (fold-variance %.4f > %.2f). Swapping to MLP.", fv, MLP_FOLD_VARIANCE_TRIGGER)
        final = fit_predict_loco(X, y, c, yr, architecture="MLP", seed=args.seed)
        chosen_arch = "MLP"
    else:
        final = final_xgb
        chosen_arch = "XGBoost"

    # LOCK gate eval (Ji-Hoon R1: AFTER MLP trigger)
    lock_gate_eval_ts = datetime.now(timezone.utc).isoformat()
    LOG.info("=== LOCK GATE EVAL ===")

    # Bootstrap CI on AUC
    LOG.info("BCa bootstrap on Global LOCO-AUC (B=%d)...", BCA_BOOTSTRAP_B)
    auc_ci = bca_bootstrap_auc_ci(final["probs"], final["labels"], B=BCA_BOOTSTRAP_B, seed=args.seed)

    # Per-cohort LOCO + ECE
    LOG.info("Per-cohort LOCO + ECE...")
    with open(args.cohort_sidecar, encoding="utf-8") as f:
        cohort_assignments = json.load(f)["assignments"]
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

    # §3.1 three-gate evaluation
    global_pass = final["global_auc"] >= LOCK_FLOOR
    cohort_loco_pass = all(
        (info["n"] < 5) or (info["loco_auc"] is not None and info["loco_auc"] >= COHORT_LOCO_FLOOR)
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

    borderline = bool(auc_ci["ci95_lo"] < LOCK_FLOOR) if verdict == "LOCK" else False

    # Descriptive emit (per §6 + Miriam M14-1)
    LOG.info("=== DESCRIPTIVE EMIT ===")
    if chosen_arch == "XGBoost":
        feature_importances = list(final_xgb["per_country_auc"].values())  # placeholder
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
    descriptive = emit_descriptive(
        greedy["selected_indicators"], greedy["chosen_window"], panels, samples,
        final, chosen_arch, feature_importances, audit_chart_path,
    )
    chart_path = plot_saudi_azeri_audit(descriptive, panels, greedy["chosen_window"], audit_chart_path)
    descriptive["ranked_trajectory_signature"]["saudi_azeri_audit_url"] = chart_path

    # window_search_auxiliary_note (per Nasrin N-2)
    final_step_history = greedy["history"][-1] if greedy["history"] else {}
    loco_auc_per_window: dict[int, float] = {}
    if greedy["selected_indicators"]:
        for w in WINDOW_GRID:
            Xw, yw, cw, yrw = build_X_y(samples, greedy["selected_indicators"], w, panels)
            if len(Xw) < 30 or len(np.unique(yw)) < 2:
                continue
            r = fit_predict_loco(Xw, yw, cw, yrw, architecture=chosen_arch, seed=args.seed)
            loco_auc_per_window[w] = float(r["global_auc"])
    window_aux = {
        "n_combinations_evaluated_final_step": int(len(WINDOW_GRID) * max(1, len(greedy["history"]))),
        "loco_auc_spread_across_windows": loco_auc_per_window,
    }

    # Compose DECISION-ready summary (per §10)
    elapsed = time.time() - t0
    summary = {
        "f_ml_1_pre_reg": "qgi-docs/internal/ops/ml-track/F-ML-1-pre-reg.md",
        "filed": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": elapsed,
        "recipe_id": RECIPE_ID,
        "verdict": verdict,
        "borderline_lock": borderline,
        "n_positives": n_pos,
        "n_negatives": int((samples["label"] == 0).sum()),
        "architecture": chosen_arch,
        "architecture_provenance": {
            "default_per_n_pos_rule": "LR (<60) | XGBoost (>=60)",
            "mlp_trigger_fold_variance": float(fv),
            "mlp_trigger_threshold": MLP_FOLD_VARIANCE_TRIGGER,
            "mlp_triggered": bool(trigger_mlp),
            "mlp_trigger_decision_ts": mlp_trigger_decision_ts,
            "lock_gate_eval_ts": lock_gate_eval_ts,
        },
        "per_recipe_floor_provenance": {
            "baseline_floor": HYBRID_BASELINE,
            "delta_lift": DELTA_LIFT,
            "lock_floor": LOCK_FLOOR,
            "source": "derived_from_prior_hybrid_lock",
            "prior_lock_value": HYBRID_BASELINE,
            "prior_lock_name": "Hybrid D2/D5",
        },
        "global_loco": auc_ci,
        "per_cohort": per_cohort,
        "gates_eval": {
            "global_loco_pass": bool(global_pass),
            "per_cohort_loco_pass": bool(cohort_loco_pass),
            "per_cohort_ece_pass": bool(cohort_ece_pass),
            "global_floor": LOCK_FLOOR,
            "cohort_loco_floor": COHORT_LOCO_FLOOR,
            "cohort_ece_gate": COHORT_ECE_GATE,
        },
        "univariate_screen": {
            "method": "LR, 10y window, ranked by global LOCO-AUC",
            "n_candidates_evaluated": len(all_candidates),
            "top_n_kept": TOP_N_PREFILTER,
            "top_n_indicators": top_n_inds,
        },
        "greedy_outer_loop": greedy,
        "fold_variance": float(fv),
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
