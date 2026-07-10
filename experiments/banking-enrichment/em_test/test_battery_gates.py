"""Unit tests for run_full_battery.py's PURE gate-evaluation helpers (D1-D7 AND-gate,
PLAN.md §11 acceptance bar). No pandas/numpy/sklearn needed -- plain host Python.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_full_battery as rb  # noqa: E402


def test_d2_missingness_placebo_gate_passes_when_both_near_null():
    assert rb.d2_gate_pass({"has_data_dummy_near_null": True, "permutation_near_null": True}) is True


def test_d2_missingness_placebo_gate_fails_when_either_reproduces_lift():
    assert rb.d2_gate_pass({"has_data_dummy_near_null": False, "permutation_near_null": True}) is False
    assert rb.d2_gate_pass({"has_data_dummy_near_null": True, "permutation_near_null": False}) is False


def test_d3_income_proxy_gate_uses_ci_excludes_zero():
    # candidate beats income proxy control, CI (of candidate - proxy delta) excludes 0
    assert rb.d3_gate_pass(ci_lo=0.02, ci_hi=0.15) is True
    assert rb.d3_gate_pass(ci_lo=-0.05, ci_hi=0.15) is False


def test_d4_era_gate_requires_survives_2008_exclusion_and_no_inversion():
    era_ok = {
        "sensitivity_2008_cohort": {"auc_with_cohort": 0.62, "auc_without_cohort": 0.60},
        "era_stratified_loco": {"pre_boundary": {"auc": 0.58}, "post_boundary": {"auc": 0.63}},
    }
    assert rb.d4_gate_pass(era_ok) is True

    era_inverted = {
        "sensitivity_2008_cohort": {"auc_with_cohort": 0.62, "auc_without_cohort": 0.60},
        "era_stratified_loco": {"pre_boundary": {"auc": 0.30}, "post_boundary": {"auc": 0.63}},
    }
    assert rb.d4_gate_pass(era_inverted) is False

    era_collapses_without_2008 = {
        "sensitivity_2008_cohort": {"auc_with_cohort": 0.65, "auc_without_cohort": 0.48},
        "era_stratified_loco": {"pre_boundary": {"auc": 0.58}, "post_boundary": {"auc": 0.63}},
    }
    assert rb.d4_gate_pass(era_collapses_without_2008) is False

    era_missing_pre = {
        "sensitivity_2008_cohort": {"auc_with_cohort": 0.62, "auc_without_cohort": 0.60},
        "era_stratified_loco": {"pre_boundary": {"auc": None}, "post_boundary": {"auc": 0.63}},
    }
    # Missing pre-boundary AUC (too few 1990s rows) -> cannot confirm no-inversion -> fail closed.
    assert rb.d4_gate_pass(era_missing_pre) is False


def test_d5_gate_requires_majority_of_present_twins_above_chance():
    assert rb.d5_gate_pass({"Mexico": 0.9, "Thailand": 0.8, "Russia": 0.4}) is True  # 2/3 >= 0.5
    assert rb.d5_gate_pass({"Mexico": 0.3, "Thailand": 0.4}) is False  # 0/2 >= 0.5
    assert rb.d5_gate_pass({}) is False  # no twins present -> cannot confirm concentration


def test_d6_gate_pass_requires_ci_lower_gt_zero_and_fdr_reject():
    assert rb.d6_gate_pass(ci95_lo=0.01, fdr_reject=True) is True
    assert rb.d6_gate_pass(ci95_lo=0.01, fdr_reject=False) is False
    assert rb.d6_gate_pass(ci95_lo=-0.01, fdr_reject=True) is False
    assert rb.d6_gate_pass(ci95_lo=float("nan"), fdr_reject=True) is False


def test_d7_gate_advisory_downgrade_below_min_positives():
    # Below the ~8-positive advisory threshold: gate is non-blocking (auto-pass with advisory flag).
    verdict = rb.d7_gate_verdict(n_post2005_pos=5, holdout_auc_ci_lo=None)
    assert verdict["gate_pass"] is True
    assert verdict["advisory"] is True

    verdict2 = rb.d7_gate_verdict(n_post2005_pos=12, holdout_auc_ci_lo=0.55)
    assert verdict2["gate_pass"] is True
    assert verdict2["advisory"] is False

    verdict3 = rb.d7_gate_verdict(n_post2005_pos=12, holdout_auc_ci_lo=0.45)
    assert verdict3["gate_pass"] is False
    assert verdict3["advisory"] is False


def test_all_seven_gates_and_requires_every_gate_true():
    all_pass = {f"d{i}": True for i in range(1, 8)}
    assert rb.all_seven_and(all_pass) is True
    one_fail = dict(all_pass)
    one_fail["d5"] = False
    assert rb.all_seven_and(one_fail) is False
