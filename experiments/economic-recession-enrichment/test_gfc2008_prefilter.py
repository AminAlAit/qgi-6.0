"""Unit tests for gfc2008_prefilter.py -- D6 GFC-2008 concentration FAST PRE-FILTER, run
FIRST per PRE-REGISTRATION.md (committed 703e440): "reject a candidate that's purely a
global-2008-time-effect" before spending the rest of the battery. 13.2% of economic_recession
positives are 2008 (33/250).

`exclude_2008_rows` / `gfc2008_verdict` are pure (pandas only) and tested directly.
`run_prefilter_for_candidate` needs `run_f_ml_1_poc` (build_X_y/coverage_report/
coverage_gate_ok/fit_predict_loco/bca_bootstrap_auc_ci) -- injected here as a FAKE
`walk_module` so the ORCHESTRATION logic (build full-sample + 2008-excluded fits, compare,
verdict) is verified on plain host Python; the real run uses the real run_f_ml_1_poc module
(host has the full stack -- xgboost/sklearn/scipy all installed, no Docker required for this
gate).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gfc2008_prefilter as g  # noqa: E402


def _samples(rows: list[tuple[str, int, int]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["country", "year", "label"])


# ============================================================================================
# exclude_2008_rows -- pure row filter.
# ============================================================================================
def test_exclude_2008_rows_drops_only_the_target_year():
    samples = _samples([("A", 2008, 1), ("A", 2007, 1), ("B", 2008, 0), ("B", 1999, 0)])
    out = g.exclude_2008_rows(samples)
    assert sorted(out["year"].tolist()) == [1999, 2007]


def test_exclude_2008_rows_drops_both_positives_and_negatives_at_2008():
    samples = _samples([("A", 2008, 1), ("A", 2008, 0), ("A", 2008, 0)])
    out = g.exclude_2008_rows(samples)
    assert len(out) == 0


def test_exclude_2008_rows_no_op_when_2008_absent():
    samples = _samples([("A", 1999, 1), ("A", 2001, 0)])
    out = g.exclude_2008_rows(samples)
    assert len(out) == 2


def test_exclude_2008_rows_custom_year():
    samples = _samples([("A", 2020, 1), ("A", 1999, 0)])
    out = g.exclude_2008_rows(samples, exclude_year=2020)
    assert sorted(out["year"].tolist()) == [1999]


# ============================================================================================
# gfc2008_verdict -- pure verdict logic.
# ============================================================================================
def test_verdict_rejects_when_signal_collapses_to_chance_without_2008():
    assert g.gfc2008_verdict(auc_excl_2008=0.50) == "REJECT_GFC2008_CONCENTRATED"


def test_verdict_rejects_when_signal_is_below_chance_without_2008():
    assert g.gfc2008_verdict(auc_excl_2008=0.42) == "REJECT_GFC2008_CONCENTRATED"


def test_verdict_passes_when_signal_survives_above_chance_without_2008():
    assert g.gfc2008_verdict(auc_excl_2008=0.58) == "PASS_PREFILTER"


def test_verdict_boundary_is_reject_inclusive():
    assert g.gfc2008_verdict(auc_excl_2008=0.50, chance=0.50) == "REJECT_GFC2008_CONCENTRATED"


def test_verdict_none_is_inconclusive():
    assert g.gfc2008_verdict(auc_excl_2008=None) == "INCONCLUSIVE_INSUFFICIENT_DATA"


def test_verdict_nan_is_inconclusive():
    assert g.gfc2008_verdict(auc_excl_2008=float("nan")) == "INCONCLUSIVE_INSUFFICIENT_DATA"


# ============================================================================================
# Fake walk_module for the orchestration-level tests.
# ============================================================================================
class _FakeWalk:
    """Minimal stand-in for run_f_ml_1_poc, covering exactly the surface
    gfc2008_prefilter.py calls."""

    def __init__(self, auc_full: float, auc_excl: float):
        self._auc_full = auc_full
        self._auc_excl = auc_excl

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

    def fit_predict_loco(self, X, y, countries, years, architecture, seed=0):
        # Deterministic fake: whether this call is "full" or "2008-excluded" is inferred
        # from whether year 2008 appears in `years` -- the real distinguishing feature the
        # orchestration cares about (it never inspects fit_predict_loco's internals directly,
        # only its returned global_auc).
        auc = self._auc_full if 2008 in set(int(v) for v in years) else self._auc_excl
        n = len(y)
        return {
            "probs": np.full(n, 0.5), "labels": y, "countries": countries, "years": years,
            "per_country_auc": {}, "global_auc": auc,
        }

    def bca_bootstrap_auc_ci(self, probs, labels, seed=0, B=200):
        return {"auc": 0.5, "ci95_lo": 0.4, "ci95_hi": 0.6}


def _mixed_samples(n_pos_2008=10, n_pos_other=40, n_neg=150, n_countries=20) -> pd.DataFrame:
    """Deliberately keeps the "other" positives (1900-1929) and negatives (1950-1989) in year
    ranges that never collide with 2008, so `n_2008_rows_excluded` is exactly `n_pos_2008` --
    no accidental extra collisions from the modulo cycling."""
    countries = [f"C{i:02d}" for i in range(n_countries)]
    rows = []
    for i in range(n_pos_2008):
        rows.append((countries[i % n_countries], 2008, 1))
    for i in range(n_pos_other):
        rows.append((countries[i % n_countries], 1900 + (i % 30), 1))
    for i in range(n_neg):
        rows.append((countries[i % n_countries], 1950 + (i % 40), 0))
    return pd.DataFrame(rows, columns=["country", "year", "label"])


# ============================================================================================
# run_prefilter_for_candidate -- orchestration (DI'd walk_module).
# ============================================================================================
def test_run_prefilter_passes_when_signal_survives_without_2008():
    samples = _mixed_samples()
    walk = _FakeWalk(auc_full=0.65, auc_excl=0.60)
    out = g.run_prefilter_for_candidate(
        "cand", {"cand": pd.DataFrame()}, samples, window=3, architecture="LR", seed=12345,
        walk_module=walk,
    )
    assert out["verdict"] == "PASS_PREFILTER"
    assert out["auc_full_sample"] == pytest.approx(0.65)
    assert out["auc_excl_2008"] == pytest.approx(0.60)
    assert out["n_2008_rows_excluded"] == 10  # only positives at 2008 in this fixture


def test_run_prefilter_rejects_when_signal_is_purely_2008():
    samples = _mixed_samples()
    walk = _FakeWalk(auc_full=0.75, auc_excl=0.48)
    out = g.run_prefilter_for_candidate(
        "cand", {"cand": pd.DataFrame()}, samples, window=3, architecture="LR", seed=12345,
        walk_module=walk,
    )
    assert out["verdict"] == "REJECT_GFC2008_CONCENTRATED"


def test_run_prefilter_reports_coverage_gate_for_both_sides():
    samples = _mixed_samples()
    walk = _FakeWalk(auc_full=0.65, auc_excl=0.60)
    out = g.run_prefilter_for_candidate(
        "cand", {"cand": pd.DataFrame()}, samples, window=3, architecture="LR", seed=12345,
        walk_module=walk,
    )
    assert out["coverage_full_sample"]["gate_pass"] is True
    assert out["coverage_excl_2008"]["gate_pass"] is True


def test_run_prefilter_inconclusive_when_excl_coverage_fails():
    # Too few positives once 2008 is excluded and the fake coverage gate fails closed.
    samples = _samples([("A", 2008, 1)] * 5 + [("A", 1990, 1)] * 2 + [("B", 1991, 0)] * 5)
    walk = _FakeWalk(auc_full=0.70, auc_excl=0.55)
    out = g.run_prefilter_for_candidate(
        "cand", {"cand": pd.DataFrame()}, samples, window=3, architecture="LR", seed=12345,
        walk_module=walk,
    )
    assert out["coverage_excl_2008"]["gate_pass"] is False
    assert out["verdict"] == "INCONCLUSIVE_INSUFFICIENT_DATA"


def test_run_prefilter_all_reports_survivors_and_rejected():
    samples = _mixed_samples()
    walk_pass = _FakeWalk(auc_full=0.65, auc_excl=0.60)
    walk_reject = _FakeWalk(auc_full=0.75, auc_excl=0.48)
    per_candidate_walk = {"good_cand": walk_pass, "bad_cand": walk_reject}
    out = g.run_prefilter_all_di(
        ["good_cand", "bad_cand"], {"good_cand": pd.DataFrame(), "bad_cand": pd.DataFrame()},
        samples, per_candidate_walk, window=3, architecture="LR", seed=12345,
    )
    assert out["survivors"] == ["good_cand"]
    assert out["rejected"] == ["bad_cand"]
