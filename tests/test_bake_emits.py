"""Unit tests for the Phase-1-BAKE emit helpers in bake_te_fleet_run_1.py
(frontend bake-request §A/§B: trajectory_alignment, per-cohort calibration,
v1_separation_pp). All pure functions over the walk summary — no S3, no re-walk.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import bake_te_fleet_run_1 as bake  # noqa: E402


# ---- _percentile ------------------------------------------------------------

def test_percentile_linear_interpolation():
    assert bake._percentile([1.0, 3.0], 25) == 1.5
    assert bake._percentile([1.0, 3.0], 75) == 2.5
    assert bake._percentile([2.0, 4.0], 50) == 3.0


def test_percentile_single_value():
    assert bake._percentile([7.0], 25) == 7.0
    assert bake._percentile([7.0], 75) == 7.0


# ---- _cohort_separation_pp (v1_separation_pp) -------------------------------

def test_cohort_separation_is_best_minus_worst():
    pc = {"a": {"loco_auc": 0.80}, "b": {"loco_auc": 0.60}, "c": {"loco_auc": 0.72}}
    assert bake._cohort_separation_pp(pc) == 0.20


def test_cohort_separation_needs_two_cohorts():
    assert bake._cohort_separation_pp({"a": {"loco_auc": 0.8}}) is None
    assert bake._cohort_separation_pp({}) is None
    assert bake._cohort_separation_pp(None) is None


def test_cohort_separation_ignores_missing_auc():
    pc = {"a": {"loco_auc": 0.8}, "b": {"ece": 0.1}}  # b has no loco_auc
    assert bake._cohort_separation_pp(pc) is None  # only 1 usable -> None


# ---- _per_cohort_calibration / _calibration_block ---------------------------

def test_per_cohort_calibration_maps_fields():
    pc = {"fragile-state": {"ece": 0.12, "reliability_diagram_bins": [1, 2], "n": 40}}
    out = bake._per_cohort_calibration(pc)
    assert out["fragile-state"] == {"ece": 0.12, "bins": [1, 2], "n": 40, "low_confidence": None}


def test_per_cohort_calibration_empty_is_none():
    assert bake._per_cohort_calibration(None) is None
    assert bake._per_cohort_calibration({}) is None


def test_calibration_block_folds_per_cohort_without_mutating_summary():
    summary = {
        "calibration": {"computed": True, "ece": 0.09, "bins": [1]},
        "per_cohort": {"stable": {"ece": 0.05, "reliability_diagram_bins": [3], "n": 20}},
    }
    block = bake._calibration_block(summary)
    assert block["computed"] is True and block["ece"] == 0.09
    assert block["per_cohort"]["stable"]["ece"] == 0.05
    # the summary's own calibration object must be untouched (fresh dict returned)
    assert "per_cohort" not in summary["calibration"]


def test_calibration_block_default_when_absent():
    block = bake._calibration_block({})
    assert block["computed"] is False and block["ece"] is None


# ---- _build_trajectory_alignment (the lead-year alignment) ------------------

def _summary_with_sigs(window, sigs):
    return {
        "greedy_outer_loop": {"chosen_window": window},
        "descriptive_emit": {"ranked_trajectory_signature": {"per_indicator_signatures": sigs}},
    }


def test_trajectory_alignment_aggregates_by_lead_year():
    # window 3 -> positions -3,-2,-1. Two positives, no gaps.
    sigs = [{
        "indicator_id": "v2x_test",
        "samples": [
            {"country": "A", "year": 2000, "temporal_profile": [1.0, 2.0, 3.0],
             "years_covered": [1997, 1998, 1999]},
            {"country": "B", "year": 2010, "temporal_profile": [3.0, 4.0, 5.0],
             "years_covered": [2007, 2008, 2009]},
        ],
    }]
    out = bake._build_trajectory_alignment(_summary_with_sigs(3, sigs), {"v2x_test": "Test Indicator"})
    assert out["window_years"] == 3
    assert out["samples_used"] == 2
    ind = out["indicators"][0]
    assert ind["code"] == "v2x_test"
    assert ind["name"] == "Test Indicator"
    assert ind["provider"] == bake._provider_for("v2x_test")
    # by_pos: -3:[1,3], -2:[2,4], -1:[3,5]
    assert ind["shape"]["mean"] == [2.0, 3.0, 4.0]
    assert ind["shape"]["p25"] == [1.5, 2.5, 3.5]
    assert ind["shape"]["p75"] == [2.5, 3.5, 4.5]


def test_trajectory_alignment_gap_does_not_smear_positions():
    # A gapped positive (missing the middle lead-year) must NOT contribute to -2.
    sigs = [{
        "indicator_id": "x",
        "samples": [
            {"country": "A", "year": 2000, "temporal_profile": [1.0, 2.0, 3.0],
             "years_covered": [1997, 1998, 1999]},
            {"country": "C", "year": 2020, "temporal_profile": [10.0, 30.0],
             "years_covered": [2017, 2019]},  # 2018 dropped -> rel -3 and -1 only
        ],
    }]
    out = bake._build_trajectory_alignment(_summary_with_sigs(3, sigs), {})
    mean = out["indicators"][0]["shape"]["mean"]
    # -3: mean(1,10)=5.5 ; -2: only A -> 2.0 ; -1: mean(3,30)=16.5
    assert mean == [5.5, 2.0, 16.5]


def test_trajectory_alignment_skips_length_mismatch_sample():
    sigs = [{
        "indicator_id": "x",
        "samples": [
            {"country": "A", "year": 2000, "temporal_profile": [1.0, 2.0],
             "years_covered": [1998, 1999]},
            {"country": "BAD", "year": 2010, "temporal_profile": [9.0, 9.0, 9.0],
             "years_covered": [2009]},  # mismatched lengths -> skipped
        ],
    }]
    out = bake._build_trajectory_alignment(_summary_with_sigs(2, sigs), {})
    # only sample A contributes (positions -2,-1)
    assert out["indicators"][0]["shape"]["mean"] == [1.0, 2.0]


def test_trajectory_alignment_none_when_no_descriptive_emit():
    assert bake._build_trajectory_alignment({"greedy_outer_loop": {"chosen_window": 5}}, {}) is None


def test_trajectory_alignment_none_when_window_too_small():
    sigs = [{"indicator_id": "x", "samples": [
        {"country": "A", "year": 2000, "temporal_profile": [1.0], "years_covered": [1999]}]}]
    assert bake._build_trajectory_alignment(_summary_with_sigs(1, sigs), {}) is None


def test_trajectory_alignment_interior_gap_is_interpolated_not_null():
    # A lead-year with NO covering positive must be interpolated to keep shape a
    # full number[] (frontend contract is non-nullable). window 3, only -3 and -1.
    sigs = [{"indicator_id": "x", "samples": [
        {"country": "A", "year": 2020, "temporal_profile": [10.0, 20.0],
         "years_covered": [2017, 2019]}]}]  # 2018 (lead -2) absent
    out = bake._build_trajectory_alignment(_summary_with_sigs(3, sigs), {})
    mean = out["indicators"][0]["shape"]["mean"]
    assert mean == [10.0, 15.0, 20.0]  # -2 linearly interpolated, no None
    assert all(v is not None for v in mean)


def test_trajectory_alignment_leading_gap_is_edge_filled():
    # window 3, sample covers only -2 and -1; -3 has no data -> carry nearest known.
    sigs = [{"indicator_id": "x", "samples": [
        {"country": "A", "year": 2020, "temporal_profile": [4.0, 6.0],
         "years_covered": [2018, 2019]}]}]
    out = bake._build_trajectory_alignment(_summary_with_sigs(3, sigs), {})
    assert out["indicators"][0]["shape"]["mean"] == [4.0, 4.0, 6.0]  # -3 back-filled


def test_trajectory_alignment_skips_codeless_block():
    sigs = [
        {"samples": [{"country": "A", "year": 2000, "temporal_profile": [1.0, 2.0],
                      "years_covered": [1998, 1999]}]},  # no indicator_id -> skipped
        {"indicator_id": "x", "samples": [{"country": "A", "year": 2000,
         "temporal_profile": [3.0, 4.0], "years_covered": [1998, 1999]}]},
    ]
    out = bake._build_trajectory_alignment(_summary_with_sigs(2, sigs), {})
    assert len(out["indicators"]) == 1 and out["indicators"][0]["code"] == "x"


def test_fill_gaps_all_none_returns_unchanged():
    assert bake._fill_gaps([None, None]) == [None, None]


# ---- build_analogs_file §D re-slice -----------------------------------------

def test_build_analogs_reslices_composite_into_subject_and_analogs():
    all_scores = {
        "r_hi": {"scores": [
            {"name": "Egypt", "score": 90, "indicator_trajectory_composite_12q": [1.0, 2.0, 3.0],
             "nearest_analogs": [{"country": "Syria", "year": 2011, "match_score": 0.9,
                                  "weak_analog": False}]},
            {"name": "Syria", "score": 40, "indicator_trajectory_composite_12q": [4.0, 5.0, 6.0],
             "nearest_analogs": []},
        ]},
        "r_lo": {"scores": [
            {"name": "Egypt", "score": 30, "indicator_trajectory_composite_12q": [7.0, 8.0, 9.0],
             "nearest_analogs": []},
        ]},
    }
    out = bake.build_analogs_file(all_scores, {}, {}, "v1")
    entries = {e["name"]: e for e in out["entries"]}
    # §D.1: Egypt's subject sparkline = its TOP recipe (r_hi, score 90), NOT r_lo (30)
    assert entries["Egypt"]["indicator_trajectory"] == [1.0, 2.0, 3.0]
    # §D.2: Egypt's analog Syria embeds Syria's composite from the SAME recipe (r_hi)
    syria_an = [a for a in entries["Egypt"]["analogs"] if a["country"] == "Syria"][0]
    assert syria_an["indicator_trajectory_12q"] == [4.0, 5.0, 6.0]


# ---- integration: build_card_v3 wires the three new emits --------------------

def test_build_card_v3_wires_new_emits():
    summary = {
        "recipe_id": "test_recipe",
        "verdict": "MARGINAL_PENDING_BETA_CALIBRATION",
        "greedy_outer_loop": {"chosen_window": 3, "selected_indicators": ["v2x_test"]},
        "global_loco": {"auc": 0.78, "ci95_lo": 0.70, "ci95_hi": 0.85},
        "per_cohort": {
            "fragile-state": {"loco_auc": 0.72, "ece": 0.12, "reliability_diagram_bins": [1], "n": 40},
            "stable": {"loco_auc": 0.81, "ece": 0.06, "reliability_diagram_bins": [2], "n": 30},
        },
        "calibration": {"computed": True, "ece": 0.09, "bins": [1, 2]},
        "descriptive_emit": {"ranked_trajectory_signature": {"per_indicator_signatures": [
            {"indicator_id": "v2x_test", "samples": [
                {"country": "A", "year": 2000, "temporal_profile": [1.0, 2.0, 3.0],
                 "years_covered": [1997, 1998, 1999]}]}]}},
    }
    card = bake.build_card_v3(summary, None, {"v2x_test": "Test"}, None, "bucket-x")
    assert card["reliability_multipass"]["v1_separation_pp"] == 0.09   # 0.81 - 0.72
    assert card["reliability_multipass"]["v4_oot_recall_pct"] is None  # still needs run-2
    assert card["calibration"]["computed"] is True
    assert card["calibration"]["per_cohort"]["fragile-state"]["ece"] == 0.12
    assert card["trajectory_alignment"]["window_years"] == 3
    assert card["trajectory_alignment"]["indicators"][0]["code"] == "v2x_test"
    # summary's own calibration object must not be mutated by the fold-in
    assert "per_cohort" not in summary["calibration"]
