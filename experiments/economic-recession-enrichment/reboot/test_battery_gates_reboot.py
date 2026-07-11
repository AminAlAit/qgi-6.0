from __future__ import annotations

import math

import battery_gates_reboot as bg


# ============================================================================================
# floor_gate_pass
# ============================================================================================
def test_floor_gate_pass_above_floor():
    assert bg.floor_gate_pass(0.03) is True


def test_floor_gate_pass_at_floor_fails():
    assert bg.floor_gate_pass(0.02) is False  # strictly > floor required


def test_floor_gate_pass_below_floor_fails():
    assert bg.floor_gate_pass(0.005) is False


def test_floor_gate_pass_positive_but_below_floor_fails():
    """The whole point of the hardened +0.02 bar: a CI-lower that merely clears 0 (e.g.
    0.008) must NOT pass -- that's exactly what distinguishes this gate from a bare >0 check."""
    assert bg.floor_gate_pass(0.008) is False


def test_floor_gate_pass_none_fails_closed():
    assert bg.floor_gate_pass(None) is False


def test_floor_gate_pass_nan_fails_closed():
    assert bg.floor_gate_pass(float("nan")) is False


def test_floor_gate_pass_custom_floor():
    assert bg.floor_gate_pass(0.10, floor=0.05) is True
    assert bg.floor_gate_pass(0.03, floor=0.05) is False


# ============================================================================================
# era2008_verdict
# ============================================================================================
def test_era2008_reject_when_excl_2008_at_chance():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=0.50, auc_pre2008_era=0.70, n_pre2008_pos=20)
    assert out["verdict"] == "REJECT_GFC2008_CONCENTRATED"
    assert out["reject"] is True


def test_era2008_reject_when_excl_2008_below_chance():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=0.41, auc_pre2008_era=0.70, n_pre2008_pos=20)
    assert out["verdict"] == "REJECT_GFC2008_CONCENTRATED"


def test_era2008_inconclusive_when_excl_2008_none():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=None, auc_pre2008_era=0.70, n_pre2008_pos=20)
    assert out["verdict"] == "INCONCLUSIVE_INSUFFICIENT_DATA"
    assert out["reject"] is False


def test_era2008_inconclusive_when_excl_2008_nan():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=float("nan"), auc_pre2008_era=0.70, n_pre2008_pos=20)
    assert out["verdict"] == "INCONCLUSIVE_INSUFFICIENT_DATA"


def test_era2008_advisory_when_too_few_pre2008_positives():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=0.60, auc_pre2008_era=0.30, n_pre2008_pos=3)
    # Below min_pre2008_pos (default 8) -> advisory PASS even though the pre-2008 AUC itself
    # is terrible; excl-2008 already cleared chance and that's the binding leg here.
    assert out["verdict"] == "PASS_ERA_CHECK_PRE2008_ADVISORY_INSUFFICIENT"
    assert out["reject"] is False


def test_era2008_reject_worse_than_chance_pre2008():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=0.60, auc_pre2008_era=0.45, n_pre2008_pos=15)
    assert out["verdict"] == "REJECT_WORSE_THAN_CHANCE_PRE_2008"
    assert out["reject"] is True


def test_era2008_reject_worse_than_chance_pre2008_none():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=0.60, auc_pre2008_era=None, n_pre2008_pos=15)
    assert out["verdict"] == "REJECT_WORSE_THAN_CHANCE_PRE_2008"


def test_era2008_pass_all_clear():
    out = bg.era2008_verdict(auc_full=0.75, auc_excl_2008=0.65, auc_pre2008_era=0.60, n_pre2008_pos=15)
    assert out["verdict"] == "PASS_ERA_CHECK"
    assert out["reject"] is False


def test_era2008_custom_min_pre2008_pos():
    out = bg.era2008_verdict(
        auc_full=0.75, auc_excl_2008=0.60, auc_pre2008_era=0.30, n_pre2008_pos=10, min_pre2008_pos=15,
    )
    assert out["verdict"] == "PASS_ERA_CHECK_PRE2008_ADVISORY_INSUFFICIENT"


# ============================================================================================
# lag_decay_verdict
# ============================================================================================
def test_lag_decay_pass_leading():
    out = bg.lag_decay_verdict(auc_t1_only=0.70, auc_t2t3_only=0.62)
    assert out["verdict"] == "PASS_LEADING"
    assert out["reject"] is False


def test_lag_decay_reject_coincident_only():
    out = bg.lag_decay_verdict(auc_t1_only=0.70, auc_t2t3_only=0.48)
    assert out["verdict"] == "REJECT_COINCIDENT_ONLY"
    assert out["reject"] is True


def test_lag_decay_reject_at_exactly_chance():
    out = bg.lag_decay_verdict(auc_t1_only=0.70, auc_t2t3_only=0.50)
    assert out["verdict"] == "REJECT_COINCIDENT_ONLY"


def test_lag_decay_inconclusive_when_t2t3_none():
    out = bg.lag_decay_verdict(auc_t1_only=0.70, auc_t2t3_only=None)
    assert out["verdict"] == "INCONCLUSIVE_INSUFFICIENT_DATA"


def test_lag_decay_inconclusive_when_t2t3_nan():
    out = bg.lag_decay_verdict(auc_t1_only=0.70, auc_t2t3_only=float("nan"))
    assert out["verdict"] == "INCONCLUSIVE_INSUFFICIENT_DATA"


def test_lag_decay_pass_even_if_t1_weaker_than_t2t3():
    """Only the t-2/t-3 leg gates; t-1 being weaker is not itself disqualifying."""
    out = bg.lag_decay_verdict(auc_t1_only=0.51, auc_t2t3_only=0.65)
    assert out["verdict"] == "PASS_LEADING"


# ============================================================================================
# placebo_near_null / placebo_gate_pass
# ============================================================================================
def test_placebo_near_null_true_when_ci_lo_non_positive():
    assert bg.placebo_near_null(-0.01) is True
    assert bg.placebo_near_null(0.0) is True


def test_placebo_near_null_false_when_ci_lo_positive():
    assert bg.placebo_near_null(0.01) is False


def test_placebo_near_null_fails_closed_on_none():
    assert bg.placebo_near_null(None) is False


def test_placebo_gate_pass_both_near_null():
    assert bg.placebo_gate_pass(-0.02, -0.01) is True


def test_placebo_gate_pass_one_significant_fails():
    assert bg.placebo_gate_pass(-0.02, 0.03) is False


# ============================================================================================
# orthogonality_pass
# ============================================================================================
def test_orthogonality_pass_below_threshold():
    assert bg.orthogonality_pass(0.30) is True


def test_orthogonality_pass_at_threshold_fails():
    assert bg.orthogonality_pass(0.5) is False


def test_orthogonality_pass_above_threshold_fails():
    assert bg.orthogonality_pass(0.62) is False


def test_orthogonality_pass_none_fails_closed():
    assert bg.orthogonality_pass(None) is False


def test_orthogonality_pass_custom_threshold():
    assert bg.orthogonality_pass(0.55, threshold=0.6) is True


# ============================================================================================
# per_country_gate_pass
# ============================================================================================
def test_per_country_gate_pass_strict_majority():
    assert bg.per_country_gate_pass({"a": 0.6, "b": 0.7, "c": 0.4}) is True


def test_per_country_gate_pass_exact_half_fails():
    assert bg.per_country_gate_pass({"a": 0.6, "b": 0.4}) is False


def test_per_country_gate_pass_empty_fails_closed():
    assert bg.per_country_gate_pass({}) is False


def test_per_country_gate_pass_all_below_chance():
    assert bg.per_country_gate_pass({"a": 0.3, "b": 0.4}) is False
