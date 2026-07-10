"""Locked temporal hold-out confirmation for the banking wide-net re-selection run
(run-3.1 banking wide-net fix #6, 2026-07-10; PLAN.md §6 acceptance criterion #4).

`run_f_ml_1_poc.py` has NO train-on-A/predict-on-B entrypoint:
  * `fit_predict_loco` is leave-one-COUNTRY-out only (every country still gets its own
    fold trained on every OTHER country across ALL years) -- not a temporal hold-out.
  * `era_stratified_loco` is a POST-HOC stratification of already-pooled LOCO predictions:
    a post-2000 row's country still had a LOCO fold trained on data that INCLUDES
    pre-2000 years from every OTHER country. It is a useful diagnostic, but it is NOT
    leakage-safe as a hold-out confirmation.

This module IS that entrypoint: NEW, test-first code that fits ONE fresh classifier on the
screening-side rows and scores it ONCE on the frozen hold-out rows -- no re-selection (the
selected indicator set + window are consumed as-given from the greedy walk's output; this
module never re-runs the screen or the greedy loop). It reuses
`run_f_ml_1_poc._fit_predict_one_fold` (the fix #6 single-fold fit/predict primitive
extracted verbatim out of `fit_predict_loco`) for the actual model fit -- never a parallel
reimplementation that could silently drift from LOCO's own fitting code.

LEAKAGE-SAFE BY CONSTRUCTION:
  * `temporal_split` partitions rows strictly by calendar year: `screen = {year < cut_year}`,
    `holdout = {year >= cut_year}`. Every screen row's year is STRICTLY earlier than every
    holdout row's year; no row appears in both (asserted internally).
  * The model sees `build_X_y(screen_samples, ...)` ONLY during fitting.
    `extract_features_for_indicator` already only ever reads `series.loc[year-window:year-1]`
    for a sample at `year` (every other walk path relies on this same guarantee), so even a
    HOLDOUT row's own features never touch its own crisis year or later. On top of that
    per-row guarantee, this module additionally NEVER lets the model's TRAINING pass see any
    holdout-side (country, year) row at all -- a strictly stronger guarantee than LOCO's
    (LOCO's training fold for a held-out country DOES include other countries' full history,
    including years >= the held-out country's own crisis year).
  * Indicator/window SELECTION happens upstream (the greedy wide-net walk) and is frozen
    before this module ever runs -- "confirm once on the lock-box", never re-selected here.

CUT-YEAR CHOICE (fix #6's explicit ask): `pick_cut_year` walks a list of candidate cut years
from the boldest (PLAN.md §6's skeptic preference: train pre-2005 / test 2005-2020) to
progressively later cuts, and returns the FIRST candidate whose SCREENING side still clears
`MIN_POS_SURVIVAL` / `MIN_EFFECTIVE_NPOS` / `MIN_SURVIVE_COUNTRIES` / `MIN_NEG_SURVIVAL` for
the greedy walk's own selected set (the same coverage gate the production walk itself uses --
`coverage_report` + `coverage_gate_ok`, imported, never reimplemented). If even the latest
candidate fails, the cut must be re-chosen by hand (this module refuses to silently fall back
to a full era split, or to lock a cut that starves a low-coverage IDS-based candidate's
training side -- fail loud per the task brief).

SENSITIVITY (fix #6's explicit ask): `auc_with_without_cohort` reports the confirmed hold-out
AUC WITH and WITHOUT the 19-event 2008 shared-global-shock cohort, using `score_pilot.auc`
(pure stdlib, zero ML-stack dependency) on the SAME already-produced hold-out predictions --
a row-subset comparison, never a refit.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))
import score_pilot as sp  # noqa: E402  (pure stdlib -- zero ML-stack dependency, host-testable)

# Mirror run_f_ml_1_poc's module constants (kept in sync manually; low drift risk -- 4 ints/
# floats). Used only as this module's OWN defaults; every call site can override explicitly.
MIN_POS_SURVIVAL = 0.50
MIN_EFFECTIVE_NPOS = 30
MIN_SURVIVE_COUNTRIES = 10
MIN_NEG_SURVIVAL = 0.60


# ============================================================================================
# Pure helpers (no run_f_ml_1_poc import -- host-testable without the ML stack / joblib).
# ============================================================================================
def temporal_split(samples: pd.DataFrame, cut_year: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split `samples` (country/year/label) into (screen, holdout) at `cut_year`:
    `screen = {year < cut_year}`, `holdout = {year >= cut_year}`.

    LEAKAGE-SAFE BY CONSTRUCTION + self-verifying: asserts the two sides are disjoint, jointly
    cover every input row, and that every screen year is strictly less than every holdout year
    (vacuously true if either side is empty).
    """
    screen = samples[samples["year"] < cut_year].reset_index(drop=True)
    holdout = samples[samples["year"] >= cut_year].reset_index(drop=True)
    assert len(screen) + len(holdout) == len(samples), (
        "temporal_split must partition every input row (found rows in neither/both sides)"
    )
    if len(screen) and len(holdout):
        assert int(screen["year"].max()) < int(holdout["year"].min()), (
            "temporal_split leakage guard failed: a screen-side year is not strictly earlier "
            "than every holdout-side year"
        )
    return screen, holdout


def auc_with_without_cohort(
    probs: Any, labels: Any, years: Any, exclude_year: int = 2008,
) -> dict[str, Any]:
    """Sensitivity check (fix #6): AUC WITH vs WITHOUT rows from `exclude_year` (the 19-event
    2008 shared-global-shock cohort per the task brief), on the SAME already-produced hold-out
    predictions -- a row-subset comparison, never a refit. Uses `score_pilot.auc` (pure
    stdlib), so this needs no ML-stack import.
    """
    probs = list(probs)
    labels = [int(v) for v in labels]
    years = [int(v) for v in years]
    if not (len(probs) == len(labels) == len(years)):
        raise ValueError("probs/labels/years must be the same length")
    auc_with = sp.auc(probs, labels)
    keep = [y != exclude_year for y in years]
    probs_wo = [p for p, k in zip(probs, keep) if k]
    labels_wo = [l for l, k in zip(labels, keep) if k]
    n_excluded = len(probs) - len(probs_wo)
    auc_without = sp.auc(probs_wo, labels_wo) if labels_wo else float("nan")
    return {
        "exclude_year": exclude_year,
        "n_total": len(probs),
        "n_excluded": n_excluded,
        "auc_with_cohort": auc_with,
        "auc_without_cohort": auc_without,
    }


# ============================================================================================
# Coverage-gated cut selection + the fit/predict pass (need run_f_ml_1_poc; `walk_module` is
# injectable so the ORCHESTRATION logic is unit-testable with a fake -- same DI pattern as
# run_dedup_prefilter.run_dedup).
# ============================================================================================
def screen_side_coverage(
    screen_samples: pd.DataFrame,
    selected_indicators: list[str],
    window: int,
    panels: dict[str, pd.DataFrame],
    walk_module: Any,
    min_pos_survival: float = MIN_POS_SURVIVAL,
    min_effective_npos: int = MIN_EFFECTIVE_NPOS,
    min_survive_countries: int = MIN_SURVIVE_COUNTRIES,
    min_neg_survival: float = MIN_NEG_SURVIVAL,
) -> dict[str, Any]:
    """The SCREENING (training) side's coverage for the greedy walk's own selected set, via
    the production `coverage_report` + `coverage_gate_ok` (imported, never reimplemented) --
    the identical gate the production walk applies to its own full-sample selected set."""
    cov = walk_module.coverage_report(screen_samples, selected_indicators, window, panels)
    ok = walk_module.coverage_gate_ok(
        cov, min_pos_survival, min_effective_npos, min_survive_countries, min_neg_survival,
    )
    return {**cov, "gate_pass": bool(ok)}


def pick_cut_year(
    samples: pd.DataFrame,
    candidate_cut_years: list[int],
    selected_indicators: list[str],
    window: int,
    panels: dict[str, pd.DataFrame],
    walk_module: Any,
    min_holdout_frac: float = 0.15,
) -> dict[str, Any]:
    """Try `candidate_cut_years` IN THE GIVEN ORDER (boldest/earliest cut first, per the task
    brief: start from PLAN.md §6's skeptic-preferred aggressive temporal block and only
    shrink the hold-out — i.e. move to a LATER cut — if the screening side fails coverage);
    return the first that (a) clears `screen_side_coverage`'s gate for the given selected set
    and (b) yields a hold-out row-fraction >= `min_holdout_frac` (so we don't accidentally
    lock a cut so late the "hold-out" is a token handful of rows).

    Returns a dict with the CHOSEN cut (`locked_cut_year`) plus the full per-candidate trace
    (`attempts`) for audit. Raises ValueError if NO candidate clears both conditions -- this
    module refuses to silently fall back to a full era split or a coverage-starved cut; a
    human must re-choose the candidate list.
    """
    if not candidate_cut_years:
        raise ValueError("candidate_cut_years must be non-empty")
    attempts: list[dict[str, Any]] = []
    n_total = len(samples)
    for cut in candidate_cut_years:
        screen, holdout = temporal_split(samples, cut)
        holdout_frac = (len(holdout) / n_total) if n_total else 0.0
        cov = screen_side_coverage(screen, selected_indicators, window, panels, walk_module)
        attempt = {
            "cut_year": cut,
            "n_screen_rows": len(screen),
            "n_holdout_rows": len(holdout),
            "holdout_row_fraction": holdout_frac,
            "screen_coverage": cov,
            "accepted": bool(cov["gate_pass"] and holdout_frac >= min_holdout_frac),
        }
        attempts.append(attempt)
        if attempt["accepted"]:
            return {"locked_cut_year": cut, "attempts": attempts, "min_holdout_frac": min_holdout_frac}
    raise ValueError(
        f"pick_cut_year: no candidate in {candidate_cut_years} cleared BOTH the screening-side "
        f"coverage gate AND holdout_row_fraction >= {min_holdout_frac}. See `attempts` in the "
        "raised context for the per-candidate trace -- re-choose the candidate list by hand "
        f"(attempts={attempts!r})"
    )


def fit_predict_holdout(
    screen_samples: pd.DataFrame,
    holdout_samples: pd.DataFrame,
    selected_indicators: list[str],
    window: int,
    panels: dict[str, pd.DataFrame],
    architecture: str,
    seed: int,
    walk_module: Any,
) -> dict[str, Any]:
    """Fit ONE fresh model on `screen_samples` and score it ONCE on `holdout_samples` — the
    actual locked confirmation. Reuses `walk_module._fit_predict_one_fold` (fix #6's extracted
    single-fold primitive) for the fit, and `walk_module.compute_auc` /
    `walk_module.bca_bootstrap_auc_ci` for scoring — no reimplementation.
    """
    w = walk_module
    X_train, y_train, c_train, yr_train = w.build_X_y(screen_samples, selected_indicators, window, panels)
    X_test, y_test, c_test, yr_test = w.build_X_y(holdout_samples, selected_indicators, window, panels)
    if len(X_train) == 0 or len(np.unique(y_train)) < 2:
        raise ValueError("screening-side build_X_y produced no usable rows or a single class")
    if len(X_test) == 0 or len(np.unique(y_test)) < 2:
        raise ValueError("holdout-side build_X_y produced no usable rows or a single class")

    probs = w._fit_predict_one_fold(X_train, y_train, X_test, architecture, seed)
    auc = w.compute_auc(probs, y_test)
    ci = w.bca_bootstrap_auc_ci(probs, y_test, seed=seed)
    sensitivity = auc_with_without_cohort(probs, y_test, yr_test, exclude_year=2008)

    return {
        "architecture": architecture,
        "window": window,
        "selected_indicators": list(selected_indicators),
        "n_train_rows": int(len(X_train)),
        "n_train_pos": int((y_train == 1).sum()),
        "n_test_rows": int(len(X_test)),
        "n_test_pos": int((y_test == 1).sum()),
        "holdout_auc": float(auc),
        "holdout_auc_ci95": [ci["ci95_lo"], ci["ci95_hi"]],
        "sensitivity_2008_cohort": sensitivity,
        "oof": [
            {"country": str(c_test[k]), "year": int(yr_test[k]), "prob": float(probs[k]), "label": int(y_test[k])}
            for k in range(len(probs))
        ],
    }
