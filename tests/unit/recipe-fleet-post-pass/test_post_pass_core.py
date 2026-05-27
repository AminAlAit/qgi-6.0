"""Unit tests for the recipe-fleet post-pass methodology-integrity core (FLEET-6 + FLEET-8):
confidence-tier classification, no-grandfathered-tier transition detection, integrity attestation.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(
    Path(__file__).resolve().parents[3] / "lambdas" / "recipe-fleet-post-pass"))
import post_pass_core as pp  # noqa: E402


def _res(verdict, auc=None, lo=None, hi=None, cohort_median=0.60):
    """Build a walk-summary stub. cohort_median sets a 3-cohort per_cohort block whose
    median equals the given value (≥0.55 passes criterion 5); None omits per_cohort."""
    r = {"verdict": verdict}
    if auc is not None:
        r["global_loco"] = {"auc": auc, "ci95_lo": lo, "ci95_hi": hi}
    if cohort_median is not None:
        r["per_cohort"] = {"a": {"loco_auc": cohort_median - 0.05},
                           "b": {"loco_auc": cohort_median},
                           "c": {"loco_auc": cohort_median + 0.05}}
    return r


# ---- classify_tier ----------------------------------------------------------

def test_lock_is_validated():
    assert pp.classify_tier(_res("LOCK"))["tier"] == pp.VALIDATED


def test_not_run_is_queued():
    assert pp.classify_tier(None)["tier"] == pp.QUEUED


def test_early_abort_routes_to_hold_not_a_tier():
    out = pp.classify_tier(_res("INCOMPLETE_CEILING_BELOW_FLOOR"))
    assert out["tier"] == pp.HOLD and "incomplete" in out["flags"]


def test_marginal_decent_auc_beats_chance_is_directional():
    out = pp.classify_tier(_res("MARGINAL_PENDING_BETA_CALIBRATION", 0.80, 0.73, 0.86))
    assert out["tier"] == pp.DIRECTIONAL and "high_uncertainty" not in out["flags"]


def test_directional_wide_ci_flags_high_uncertainty():
    out = pp.classify_tier(_res("HARD_FAIL", 0.70, 0.55, 0.86))  # width 0.31 > 0.20
    assert out["tier"] == pp.DIRECTIONAL and "high_uncertainty" in out["flags"]


def test_low_auc_is_experimental():
    assert pp.classify_tier(_res("HARD_FAIL", 0.59, 0.50, 0.68))["tier"] == pp.EXPERIMENTAL


def test_ci_straddling_chance_is_experimental_even_if_auc_high():
    # auc 0.66 ≥ 0.65 BUT ci_lo 0.49 ≤ 0.50 → not beating chance → experimental
    assert pp.classify_tier(_res("HARD_FAIL", 0.66, 0.49, 0.83))["tier"] == pp.EXPERIMENTAL


def test_no_scorable_loco_is_experimental():
    assert pp.classify_tier(_res("COVERAGE_FAIL", cohort_median=None))["tier"] == pp.EXPERIMENTAL


def test_low_per_cohort_median_blocks_directional():
    # criterion 5: global auc 0.80 + beats chance BUT cohort median 0.52 < 0.55 → experimental
    assert pp.classify_tier(_res("HARD_FAIL", 0.80, 0.72, 0.86, cohort_median=0.52))["tier"] == pp.EXPERIMENTAL


def test_beats_baseline_false_demotes_to_experimental():
    # criterion 4 supplied by caller: explicit False demotes even an otherwise-Directional recipe
    r = _res("HARD_FAIL", 0.80, 0.72, 0.86)
    assert pp.classify_tier(r, beats_baseline=False)["tier"] == pp.EXPERIMENTAL
    assert pp.classify_tier(r, beats_baseline=True)["tier"] == pp.DIRECTIONAL


def test_boundary_auc_065_cilo_above_050_is_directional():
    # auc exactly 0.65 (≥) + ci_lo 0.501 (>0.50) + good cohort → directional
    assert pp.classify_tier(_res("HARD_FAIL", 0.65, 0.501, 0.78))["tier"] == pp.DIRECTIONAL


def test_boundary_cilo_exactly_050_is_experimental():
    assert pp.classify_tier(_res("HARD_FAIL", 0.80, 0.50, 0.86))["tier"] == pp.EXPERIMENTAL


def test_ci_width_just_under_020_no_high_uncertainty():
    out = pp.classify_tier(_res("HARD_FAIL", 0.80, 0.61, 0.80))  # width 0.19 (< 0.20)
    assert out["tier"] == pp.DIRECTIONAL and "high_uncertainty" not in out["flags"]


def test_missing_ci_with_high_auc_is_experimental():
    # ci_lo None (key absent) must NOT pass beats-chance even with auc≥0.65
    assert pp.classify_tier(_res("HARD_FAIL", 0.80))["tier"] == pp.EXPERIMENTAL


# ---- detect_transitions (FLEET-6 no-grandfather) ----------------------------

def test_unchanged_tier_is_not_a_transition():
    assert pp.detect_transitions({"r": pp.DIRECTIONAL}, {"r": pp.DIRECTIONAL}) == []


def test_graduation_and_slip_detected_and_need_signoff():
    prev = {"up": pp.DIRECTIONAL, "down": pp.VALIDATED, "same": pp.EXPERIMENTAL}
    now = {"up": pp.VALIDATED, "down": pp.DIRECTIONAL, "same": pp.EXPERIMENTAL}
    t = {x["recipe_id"]: x for x in pp.detect_transitions(prev, now)}
    assert set(t) == {"up", "down"}  # 'same' omitted
    assert t["up"]["direction"] == "graduation" and t["up"]["needs_majles_signoff"]
    assert t["down"]["direction"] == "slip" and t["down"]["needs_majles_signoff"]


def test_lock_to_marginal_surfaces_as_slip():
    # the trio's specific concern: a graduated recipe slipping must NOT be silently kept
    t = pp.detect_transitions({"r": pp.VALIDATED}, {"r": pp.DIRECTIONAL})
    assert len(t) == 1 and t[0]["direction"] == "slip"


def test_new_recipe_from_queued():
    t = pp.detect_transitions({}, {"new": pp.DIRECTIONAL})
    assert t[0]["from_tier"] == pp.QUEUED and t[0]["direction"] == "graduation"


# ---- build_integrity_attestation (FLEET-8 Condition I) ----------------------

_OK = {"floor_ordering_ok": True, "no_grandfathered_tiers": True,
       "bit_identical_walk": True, "no_poisoned_indicator_holds_bypassed": True}


def test_attestation_all_yes_no_transitions_may_merge():
    a = pp.build_integrity_attestation(conditions=_OK, transitions=[], run_id="r1",
                                       panel_fingerprint="fp")
    assert a["all_conditions_pass"] and a["tracker_pr_may_merge"]


def test_attestation_blocks_on_failed_condition():
    bad = dict(_OK, floor_ordering_ok=False)
    a = pp.build_integrity_attestation(conditions=bad, transitions=[], run_id="r1",
                                       panel_fingerprint="fp")
    assert not a["all_conditions_pass"] and not a["tracker_pr_may_merge"]


def test_attestation_blocks_on_pending_majles_transition():
    trans = [{"recipe_id": "x", "from_tier": "directional", "to_tier": "validated",
              "direction": "graduation", "needs_majles_signoff": True}]
    a = pp.build_integrity_attestation(conditions=_OK, transitions=trans, run_id="r1",
                                       panel_fingerprint="fp")
    assert a["all_conditions_pass"] and not a["tracker_pr_may_merge"]  # graduation needs sign-off
    assert a["transitions_pending_majles"] == trans
