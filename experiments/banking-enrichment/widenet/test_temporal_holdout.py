"""Unit tests for temporal_holdout.py.

`temporal_split` / `auc_with_without_cohort` are pure (pandas + score_pilot's pure-stdlib
`auc`) and tested directly. `screen_side_coverage` / `pick_cut_year` / `fit_predict_holdout`
need `run_f_ml_1_poc` (coverage_report/coverage_gate_ok/build_X_y/_fit_predict_one_fold/
compute_auc/bca_bootstrap_auc_ci) -- injected here as a FAKE `walk_module` so the
ORCHESTRATION + LEAKAGE-SAFETY logic is verified on a plain host Python (no joblib/xgboost
needed); the real end-to-end run happens inside Docker with the real run_f_ml_1_poc module.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import temporal_holdout as th  # noqa: E402


def _samples(rows: list[tuple[str, int, int]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["country", "year", "label"])


# ============================================================================================
# temporal_split
# ============================================================================================
def test_temporal_split_partitions_by_year():
    samples = _samples([
        ("A", 1990, 1), ("A", 2000, 0), ("B", 2005, 1), ("B", 2010, 0), ("C", 1985, 1),
    ])
    screen, holdout = th.temporal_split(samples, cut_year=2000)
    assert sorted(screen["year"].tolist()) == [1985, 1990]
    assert sorted(holdout["year"].tolist()) == [2000, 2005, 2010]


def test_temporal_split_conserves_all_rows():
    samples = _samples([("A", y, 0) for y in range(1980, 2021)])
    screen, holdout = th.temporal_split(samples, cut_year=2005)
    assert len(screen) + len(holdout) == len(samples)


def test_temporal_split_leakage_guard_screen_strictly_before_holdout():
    samples = _samples([("A", y, 0) for y in range(1980, 2021)])
    screen, holdout = th.temporal_split(samples, cut_year=2005)
    assert screen["year"].max() < holdout["year"].min()
    assert screen["year"].max() == 2004
    assert holdout["year"].min() == 2005


def test_temporal_split_empty_screen_or_holdout_is_fine():
    samples = _samples([("A", 2010, 1), ("A", 2015, 0)])
    screen, holdout = th.temporal_split(samples, cut_year=1990)  # cut before everything
    assert len(screen) == 0
    assert len(holdout) == 2


# ============================================================================================
# auc_with_without_cohort
# ============================================================================================
def test_auc_with_without_cohort_excludes_only_the_target_year():
    probs = [0.9, 0.1, 0.8, 0.2, 0.5]
    labels = [1, 0, 1, 0, 1]
    years = [2008, 2008, 1997, 2001, 2008]
    out = th.auc_with_without_cohort(probs, labels, years, exclude_year=2008)
    assert out["n_total"] == 5
    assert out["n_excluded"] == 3
    # with-cohort AUC uses all 5 rows; without-cohort uses only the 2 non-2008 rows
    assert out["auc_with_cohort"] == pytest.approx(1.0)  # perfectly separated as constructed
    assert 0.0 <= out["auc_without_cohort"] <= 1.0


def test_auc_with_without_cohort_no_rows_excluded_when_year_absent():
    probs = [0.9, 0.1]
    labels = [1, 0]
    years = [1997, 2001]
    out = th.auc_with_without_cohort(probs, labels, years, exclude_year=2008)
    assert out["n_excluded"] == 0
    assert out["auc_with_cohort"] == out["auc_without_cohort"]


def test_auc_with_without_cohort_length_mismatch_raises():
    with pytest.raises(ValueError):
        th.auc_with_without_cohort([0.1, 0.2], [1], [2000, 2001])


# ============================================================================================
# Fake walk_module for the orchestration-level tests below.
# ============================================================================================
class _FakeWalk:
    """Minimal stand-in for run_f_ml_1_poc, covering exactly the surface temporal_holdout.py
    calls. `coverage_report`/`coverage_gate_ok` mirror the REAL functions' semantics closely
    enough to drive pick_cut_year's branch logic; `build_X_y`/`_fit_predict_one_fold`/
    `compute_auc`/`bca_bootstrap_auc_ci` are simple deterministic fakes."""

    def coverage_report(self, samples, selected_indicators, window, panels):
        n_pos_total = int((samples["label"] == 1).sum())
        n_neg_total = int((samples["label"] == 0).sum())
        return {
            "n_pos_total": n_pos_total, "n_pos_survive": n_pos_total,
            "n_neg_total": n_neg_total, "n_neg_survive": n_neg_total,
            "pos_coverage": 1.0 if n_pos_total else 0.0,
            "neg_coverage": 1.0 if n_neg_total else 0.0,
            "n_countries_survive": samples["country"].nunique(),
        }

    def coverage_gate_ok(self, cov, min_pos_survival, min_effective_npos,
                          min_survive_countries, min_neg_survival):
        return (
            cov["pos_coverage"] >= min_pos_survival
            and cov["neg_coverage"] >= min_neg_survival
            and cov["n_pos_survive"] >= min_effective_npos
            and cov["n_countries_survive"] >= min_survive_countries
        )

    def build_X_y(self, samples, selected_indicators, window, panels):
        n = len(samples)
        X = np.zeros((n, len(selected_indicators) * 10))
        y = samples["label"].to_numpy()
        c = samples["country"].to_numpy()
        yr = samples["year"].to_numpy()
        return X, y, c, yr

    def _fit_predict_one_fold(self, X_train, y_train, X_test, architecture, seed):
        # Deterministic fake "model": constant 0.5 for every test row.
        return np.full(len(X_test), 0.5)

    def compute_auc(self, probs, labels):
        probs = np.asarray(probs, float)
        labels = np.asarray(labels, int)
        if len(np.unique(labels)) < 2:
            return float("nan")
        return 0.5  # constant-probs fake model => chance AUC

    def bca_bootstrap_auc_ci(self, probs, labels, seed=0, B=200):
        return {"auc": 0.5, "ci95_lo": 0.4, "ci95_hi": 0.6}


def _big_samples(n_pos=60, n_neg=90, n_countries=15, year_start=1985, year_end=2020) -> pd.DataFrame:
    """Deterministic (no RNG): positives/negatives cycle evenly across `n_countries` and
    `range(year_start, year_end)`, so per-cut counts are exactly computable (used to drive
    pick_cut_year's coverage-gate transitions predictably)."""
    countries = [f"C{i:02d}" for i in range(n_countries)]
    years = list(range(year_start, year_end))
    rows = []
    for i in range(n_pos):
        rows.append((countries[i % n_countries], years[i % len(years)], 1))
    for i in range(n_neg):
        rows.append((countries[i % n_countries], years[i % len(years)], 0))
    return pd.DataFrame(rows, columns=["country", "year", "label"])


# ============================================================================================
# screen_side_coverage
# ============================================================================================
def test_screen_side_coverage_reports_gate_pass_field():
    samples = _big_samples()
    out = th.screen_side_coverage(samples, ["ind_a"], 10, {}, _FakeWalk())
    assert "gate_pass" in out
    assert out["gate_pass"] is True  # fake coverage is always 100%


def test_screen_side_coverage_fails_when_too_few_positives():
    samples = _samples([("A", 2000, 1), ("A", 2001, 0)])  # only 1 positive
    out = th.screen_side_coverage(samples, ["ind_a"], 10, {}, _FakeWalk())
    assert out["gate_pass"] is False  # n_pos_survive=1 < MIN_EFFECTIVE_NPOS=30


# ============================================================================================
# pick_cut_year
# ============================================================================================
def test_pick_cut_year_accepts_first_candidate_that_clears_coverage_and_fraction():
    samples = _big_samples()
    out = th.pick_cut_year(samples, [2005, 2010, 2015], ["ind_a"], 10, {}, _FakeWalk())
    assert out["locked_cut_year"] == 2005  # boldest candidate tried first, and it clears both bars
    assert out["attempts"][0]["cut_year"] == 2005
    assert out["attempts"][0]["accepted"] is True


def test_pick_cut_year_skips_a_candidate_with_too_small_holdout_fraction():
    samples = _big_samples()
    # A cut so late almost nothing is in the holdout -- min_holdout_frac should reject it.
    out = th.pick_cut_year(samples, [2019, 2010], ["ind_a"], 10, {}, _FakeWalk(), min_holdout_frac=0.15)
    assert out["locked_cut_year"] == 2010
    assert out["attempts"][0]["cut_year"] == 2019
    assert out["attempts"][0]["accepted"] is False


def test_pick_cut_year_raises_when_no_candidate_works():
    samples = _samples([("A", 2000, 1), ("A", 2001, 0)])  # tiny, will never clear coverage
    with pytest.raises(ValueError, match="no candidate"):
        th.pick_cut_year(samples, [2005, 2010], ["ind_a"], 10, {}, _FakeWalk())


def test_pick_cut_year_requires_nonempty_candidate_list():
    samples = _big_samples()
    with pytest.raises(ValueError):
        th.pick_cut_year(samples, [], ["ind_a"], 10, {}, _FakeWalk())


# ============================================================================================
# fit_predict_holdout
# ============================================================================================
def test_fit_predict_holdout_happy_path_shape_and_keys():
    samples = _big_samples()
    screen, holdout = th.temporal_split(samples, cut_year=2005)
    out = th.fit_predict_holdout(screen, holdout, ["ind_a"], 10, {}, "XGBoost", 12345, _FakeWalk())
    assert out["architecture"] == "XGBoost"
    assert out["n_train_rows"] == len(screen)
    assert out["n_test_rows"] == len(holdout)
    assert out["holdout_auc"] == 0.5  # fake model
    assert "sensitivity_2008_cohort" in out
    assert len(out["oof"]) == len(holdout)


def test_fit_predict_holdout_raises_on_single_class_train():
    # All-positive screen side -> build_X_y still returns rows but train has one class.
    screen = _samples([("A", 1990, 1), ("A", 1991, 1)])
    holdout = _samples([("A", 2010, 1), ("A", 2011, 0)])
    with pytest.raises(ValueError, match="screening-side"):
        th.fit_predict_holdout(screen, holdout, ["ind_a"], 10, {}, "XGBoost", 12345, _FakeWalk())


def test_fit_predict_holdout_raises_on_single_class_test():
    screen = _samples([("A", 1990, 1), ("A", 1991, 0)])
    holdout = _samples([("A", 2010, 1), ("A", 2011, 1)])  # holdout all-positive
    with pytest.raises(ValueError, match="holdout-side"):
        th.fit_predict_holdout(screen, holdout, ["ind_a"], 10, {}, "XGBoost", 12345, _FakeWalk())
