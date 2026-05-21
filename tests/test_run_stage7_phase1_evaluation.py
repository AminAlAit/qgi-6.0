"""Unit tests for Stage 7 phase-1 evaluation driver pure functions.

End-to-end smoke testing is via the --max-positives flag at the script
level (manual run; not in CI). These tests cover the pure helpers
(AUC, bootstrap CI, ECE, cohort lookup, JSON serialization) that any
end-to-end run depends on.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import run_stage7_phase1_evaluation as drv


def test_compute_auc_simple_perfect_separation():
    probs = np.array([0.9, 0.8, 0.1, 0.2])
    labels = np.array([1, 1, 0, 0])
    assert drv.compute_auc_simple(probs, labels) == 1.0


def test_compute_auc_simple_no_separation():
    probs = np.array([0.5, 0.5, 0.5, 0.5])
    labels = np.array([1, 1, 0, 0])
    assert drv.compute_auc_simple(probs, labels) == 0.5


def test_compute_auc_simple_single_class_returns_nan():
    probs = np.array([0.9, 0.8])
    labels = np.array([1, 1])
    assert np.isnan(drv.compute_auc_simple(probs, labels))


def test_bootstrap_loco_auc_ci_returns_well_formed():
    rng = np.random.default_rng(0)
    probs = np.concatenate([rng.uniform(0.6, 1.0, 50), rng.uniform(0.0, 0.4, 50)])
    labels = np.concatenate([np.ones(50, dtype=int), np.zeros(50, dtype=int)])
    out = drv.bootstrap_loco_auc_ci(probs, labels, n_bootstrap=200, seed=42)
    assert {"auc", "ci80_lo", "ci80_hi", "ci95_lo", "ci95_hi"} == set(out)
    assert 0.0 <= out["ci95_lo"] <= out["ci80_lo"] <= out["auc"]
    assert out["auc"] <= out["ci80_hi"] <= out["ci95_hi"] <= 1.0


def test_compute_ece_well_calibrated_is_low():
    rng = np.random.default_rng(0)
    n = 1000
    probs = rng.uniform(0.0, 1.0, n)
    labels = rng.binomial(1, probs)
    ece = drv.compute_ece(probs, labels)
    assert 0.0 <= ece <= 0.10  # well-calibrated reference


def test_compute_ece_miscalibrated_is_high():
    probs = np.full(100, 0.9)
    labels = np.zeros(100, dtype=int)  # all wrong
    ece = drv.compute_ece(probs, labels)
    assert ece >= 0.5


def test_per_cohort_ece_title_case_normalization():
    """Panel uses lowercase 'afghanistan'; sidecar uses Title Case 'Afghanistan'.

    The driver must Title-case on lookup or all cohorts will return n=0.
    """
    cohort_assignments = {
        "Afghanistan": {"2017": "fragile-state", "2018": "fragile-state"},
        "Sweden": {"2017": "stable-democracy"},
    }
    probs = np.array([0.7, 0.6, 0.3])
    labels = np.array([1, 1, 0])
    countries = np.array(["afghanistan", "afghanistan", "sweden"])
    years = np.array([2017, 2018, 2017])
    out = drv.per_cohort_ece(probs, labels, countries, years, cohort_assignments)
    assert out["fragile-state"]["n"] == 2
    assert out["stable-democracy"]["n"] == 1
    assert out["mid-tier"]["n"] == 0


def test_to_strict_json_replaces_nan():
    payload = {"a": float("nan"), "b": 1.0, "c": {"d": float("inf"), "e": [1.0, float("nan")]}}
    s = drv._to_strict_json(payload)
    parsed = json.loads(s)
    assert parsed["a"] is None
    assert parsed["b"] == 1.0
    assert parsed["c"]["d"] is None
    assert parsed["c"]["e"] == [1.0, None]


def test_determine_tier_pure_pass():
    cohort_results = {
        "civil_war_and_insurgency": {
            "loco_with_shape": {"auc": 0.85, "ci95_lo": 0.7},
            "delta_vs_hybrid_baseline": 0.12,
            "f_s_1": {"pass_strict": True, "pass_loose": True},
            "f_s_2": {"fail": False},
            "f_s_3": {"contributes": True},
            "f_s_4": {"status": "deferred"},
        },
        "economic_recession": {
            "loco_with_shape": {"auc": 0.72, "ci95_lo": 0.6},
            "delta_vs_hybrid_baseline": None,
            "f_s_1": {"pass_strict": True, "pass_loose": True},
            "f_s_2": {"fail": False},
            "f_s_3": {"contributes": True},
            "f_s_4": {"status": "deferred"},
        },
    }
    verdict = drv.determine_tier(cohort_results)
    assert verdict["final_tier"] == "PASS"
    assert verdict["f_s_1_pass"] is True
    assert verdict["f_s_3_pass"] is True


def test_determine_tier_hard_falsify_when_no_lift():
    cohort_results = {
        "civil_war_and_insurgency": {
            "loco_with_shape": {"auc": 0.65, "ci95_lo": 0.5},
            "delta_vs_hybrid_baseline": -0.10,
            "f_s_1": {"pass_strict": False, "pass_loose": False},
            "f_s_2": {"fail": True},
            "f_s_3": {"contributes": False},
            "f_s_4": {"status": "deferred"},
        },
        "economic_recession": {
            "loco_with_shape": {"auc": 0.55, "ci95_lo": 0.4},
            "delta_vs_hybrid_baseline": None,
            "f_s_1": {"pass_strict": False, "pass_loose": False},
            "f_s_2": {"fail": True},
            "f_s_3": {"contributes": False},
            "f_s_4": {"status": "deferred"},
        },
    }
    verdict = drv.determine_tier(cohort_results)
    assert verdict["final_tier"] == "HARD-FALSIFY"
    assert verdict["f_s_1_pass"] is False
