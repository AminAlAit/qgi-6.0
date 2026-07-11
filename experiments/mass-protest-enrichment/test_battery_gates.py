"""Tests for battery_gates.py -- pure D1-D8 gate evaluators (host-testable, no ML stack)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import battery_gates as bg  # noqa: E402


# ============================================================================================
# D1
# ============================================================================================
def test_d1_pass_within_tolerance():
    assert bg.d1_gate_pass(0.6110118589249961) is True
    assert bg.d1_gate_pass(0.590) is True  # within 0.03
    assert bg.d1_gate_pass(0.635) is True  # within 0.03


def test_d1_fail_outside_tolerance():
    assert bg.d1_gate_pass(0.560) is False
    assert bg.d1_gate_pass(0.700) is False


def test_d1_fail_on_none_or_nan():
    assert bg.d1_gate_pass(None) is False
    assert bg.d1_gate_pass(float("nan")) is False


# ============================================================================================
# D2
# ============================================================================================
def test_d2_placebo_near_null_true_when_ci_lo_below_zero():
    assert bg.d2_placebo_near_null(-0.01) is True
    assert bg.d2_placebo_near_null(0.0) is True


def test_d2_placebo_near_null_false_when_ci_lo_above_zero():
    assert bg.d2_placebo_near_null(0.01) is False


def test_d2_placebo_near_null_fails_closed_on_missing():
    assert bg.d2_placebo_near_null(None) is False
    assert bg.d2_placebo_near_null(float("nan")) is False


def test_d2_gate_pass_both_near_null():
    assert bg.d2_gate_pass(-0.02, -0.01) is True


def test_d2_gate_pass_fails_if_either_placebo_shows_lift():
    assert bg.d2_gate_pass(0.05, -0.01) is False
    assert bg.d2_gate_pass(-0.01, 0.05) is False


def test_d2_gate_pass_fails_closed_on_missing():
    assert bg.d2_gate_pass(None, -0.01) is False
    assert bg.d2_gate_pass(-0.01, None) is False


# ============================================================================================
# D3
# ============================================================================================
def test_d3_none_is_auto_pass():
    assert bg.d3_gate_pass(None) is True


def test_d3_pass_orthogonal():
    assert bg.d3_gate_pass("PASS_ORTHOGONAL") is True


def test_d3_reject_collinear():
    assert bg.d3_gate_pass("REJECT_COLLINEAR") is False


def test_d3_insufficient_data_fails():
    assert bg.d3_gate_pass("INSUFFICIENT_DATA") is False


# ============================================================================================
# D3a
# ============================================================================================
def test_d3a_none_is_auto_pass():
    assert bg.d3a_gate_pass(None) is True


def test_d3a_pass_orthogonal():
    assert bg.d3a_gate_pass("PASS_ORTHOGONAL") is True


def test_d3a_reject_proxy_confound():
    assert bg.d3a_gate_pass("REJECT_PROXY_CONFOUND") is False


def test_d3a_insufficient_data_fails():
    assert bg.d3a_gate_pass("INSUFFICIENT_DATA") is False


# ============================================================================================
# D4
# ============================================================================================
def test_d4_pass_positive_ci_lower():
    assert bg.d4_gate_pass(0.01) is True


def test_d4_fail_ci_lower_at_or_below_zero():
    assert bg.d4_gate_pass(0.0) is False
    assert bg.d4_gate_pass(-0.05) is False


def test_d4_fail_on_missing():
    assert bg.d4_gate_pass(None) is False
    assert bg.d4_gate_pass(float("nan")) is False


# ============================================================================================
# D5
# ============================================================================================
def test_d5_pass_strict_majority():
    assert bg.d5_gate_pass({"A": 0.6, "B": 0.55, "C": 0.4}) is True  # 2/3 above chance


def test_d5_fail_minority_above_chance():
    assert bg.d5_gate_pass({"A": 0.6, "B": 0.4, "C": 0.3}) is False  # 1/3


def test_d5_fail_exact_half():
    assert bg.d5_gate_pass({"A": 0.6, "B": 0.4}) is False  # 1/2, not strict majority


def test_d5_fail_empty():
    assert bg.d5_gate_pass({}) is False


# ============================================================================================
# D6
# ============================================================================================
def test_d6_pass_positive_ci_and_fdr_reject():
    assert bg.d6_gate_pass(0.01, True) is True


def test_d6_fail_positive_ci_but_no_fdr_reject():
    assert bg.d6_gate_pass(0.01, False) is False


def test_d6_fail_ci_not_positive():
    assert bg.d6_gate_pass(-0.01, True) is False


def test_d6_fail_on_missing_ci():
    assert bg.d6_gate_pass(None, True) is False


# ============================================================================================
# D7
# ============================================================================================
def test_d7_advisory_downgrade_on_small_holdout():
    v = bg.d7_gate_verdict(n_holdout_pos=5, holdout_auc_ci_lo=0.3)
    assert v["gate_pass"] is True
    assert v["advisory"] is True


def test_d7_binding_pass():
    v = bg.d7_gate_verdict(n_holdout_pos=20, holdout_auc_ci_lo=0.55)
    assert v["gate_pass"] is True
    assert v["advisory"] is False


def test_d7_binding_fail_below_chance():
    v = bg.d7_gate_verdict(n_holdout_pos=20, holdout_auc_ci_lo=0.45)
    assert v["gate_pass"] is False
    assert v["advisory"] is False


def test_d7_binding_fail_missing_ci():
    v = bg.d7_gate_verdict(n_holdout_pos=20, holdout_auc_ci_lo=None)
    assert v["gate_pass"] is False
    assert v["advisory"] is False


def test_d7_boundary_exactly_min_pos_is_binding():
    # n_holdout_pos == min_pos_for_binding (8) is NOT < 8, so it's binding, not advisory
    v = bg.d7_gate_verdict(n_holdout_pos=8, holdout_auc_ci_lo=0.55)
    assert v["advisory"] is False


# ============================================================================================
# D8
# ============================================================================================
def test_d8_none_is_auto_pass():
    assert bg.d8_gate_pass(None) is True


def test_d8_pass_no_backdating():
    assert bg.d8_gate_pass("PASS_NO_BACKDATING") is True


def test_d8_reject_backdating():
    assert bg.d8_gate_pass("REJECT_BACKDATING") is False


# ============================================================================================
# all_eight_and
# ============================================================================================
def test_all_eight_and_true_when_all_pass():
    gates = {k: True for k in bg.GATE_KEYS}
    assert bg.all_eight_and(gates) is True


def test_all_eight_and_false_when_one_fails():
    gates = {k: True for k in bg.GATE_KEYS}
    gates["d4"] = False
    assert bg.all_eight_and(gates) is False


def test_all_eight_and_false_when_incomplete():
    gates = {k: True for k in bg.GATE_KEYS[:-1]}  # missing d8
    assert bg.all_eight_and(gates) is False


# ============================================================================================
# combine_with_fdr (needs score_pilot -- pure stdlib, host-importable)
# ============================================================================================
def test_combine_with_fdr_basic():
    pvals = {"cand_a": 0.001, "cand_b": 0.5, "cand_c": 0.9}
    out = bg.combine_with_fdr(pvals, fdr_q=0.10)
    assert set(out.keys()) == {"cand_a", "cand_b", "cand_c"}
    for k in out:
        assert "p_value" in out[k] and "p_adjusted" in out[k] and "reject" in out[k]
    # the smallest p-value should be at least as likely to be rejected as the largest
    assert out["cand_a"]["p_adjusted"] <= out["cand_c"]["p_adjusted"]


def test_combine_with_fdr_nan_treated_as_p1():
    pvals = {"cand_a": float("nan"), "cand_b": 0.5}
    out = bg.combine_with_fdr(pvals, fdr_q=0.10)
    assert out["cand_a"]["reject"] is False


def test_combine_with_fdr_none_treated_as_p1():
    pvals = {"cand_a": None, "cand_b": 0.5}
    out = bg.combine_with_fdr(pvals, fdr_q=0.10)
    assert out["cand_a"]["reject"] is False
