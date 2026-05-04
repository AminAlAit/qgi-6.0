"""Unit tests for scripts/validate_ml_model.py.

Stage 0 deliverable per qgi-docs/internal/ops/ml-track/stage-0-pre-registration.md.

Synthesizes predictions + labels with known ground-truth properties and
verifies the Component 1/3/4/6 computation functions behave correctly:
    - Perfect ranking -> AUC = 1.0
    - Random ranking -> AUC ~ 0.5
    - Single-class labels -> AUC = NaN
    - Perfectly-calibrated predictions -> ECE -> 0
    - Anchor battery PASS/FAIL/SKIPPED logic per case shape
"""
from __future__ import annotations

import json
import pathlib
import sys

import numpy as np
import pytest

SCRIPTS_DIR = pathlib.Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import validate_ml_model as v  # noqa: E402


# ---------- compute_auc ----------


def test_compute_auc_perfect_ranking_is_one():
    preds = np.array([0.1, 0.2, 0.3, 0.4])
    labels = np.array([0, 0, 1, 1])
    assert v.compute_auc(preds, labels) == 1.0


def test_compute_auc_inverted_ranking_is_zero():
    preds = np.array([0.4, 0.3, 0.2, 0.1])
    labels = np.array([0, 0, 1, 1])
    assert v.compute_auc(preds, labels) == 0.0


def test_compute_auc_random_is_around_half():
    rng = np.random.default_rng(0)
    preds = rng.random(2000)
    labels = rng.integers(0, 2, size=2000)
    auc = v.compute_auc(preds, labels)
    assert 0.45 < auc < 0.55


def test_compute_auc_single_class_returns_nan():
    preds = np.array([0.1, 0.2, 0.3])
    labels = np.array([1, 1, 1])
    assert np.isnan(v.compute_auc(preds, labels))


def test_compute_auc_handles_ties_correctly():
    """Tied predictions should average ranks per standard convention."""
    preds = np.array([0.5, 0.5, 0.5, 0.5])
    labels = np.array([0, 0, 1, 1])
    # With all-tied predictions, AUC is exactly 0.5 (no discrimination)
    assert v.compute_auc(preds, labels) == 0.5


def test_compute_auc_shape_mismatch_raises():
    with pytest.raises(ValueError, match="shape mismatch"):
        v.compute_auc(np.array([0.5, 0.5]), np.array([0, 1, 0]))


# ---------- bootstrap_auc_ci ----------


def test_bootstrap_auc_ci_is_deterministic_with_seed():
    rng = np.random.default_rng(42)
    preds = rng.random(100)
    labels = rng.integers(0, 2, size=100)
    r1 = v.bootstrap_auc_ci(preds, labels, n_bootstrap=200, seed=0)
    r2 = v.bootstrap_auc_ci(preds, labels, n_bootstrap=200, seed=0)
    assert r1["auc_point"] == r2["auc_point"]
    assert r1["auc_ci_low"] == r2["auc_ci_low"]
    assert r1["auc_ci_high"] == r2["auc_ci_high"]


def test_bootstrap_auc_ci_returns_required_fields():
    rng = np.random.default_rng(0)
    preds = rng.random(100)
    labels = rng.integers(0, 2, size=100)
    out = v.bootstrap_auc_ci(preds, labels, n_bootstrap=100, seed=0)
    for key in ("auc_point", "auc_ci_low", "auc_ci_high", "n", "n_bootstrap", "n_valid_resamples"):
        assert key in out


def test_bootstrap_auc_ci_perfect_signal_high_ci_low():
    """Perfect AUC -> bootstrap CI should be tight near 1.0."""
    preds = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
    labels = np.array([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    out = v.bootstrap_auc_ci(preds, labels, n_bootstrap=200, seed=0)
    assert out["auc_point"] == 1.0
    assert out["auc_ci_low"] > 0.85  # very tight CI for perfect signal


def test_bootstrap_auc_ci_rejects_invalid_confidence():
    with pytest.raises(ValueError, match="confidence"):
        v.bootstrap_auc_ci(np.array([0.5]), np.array([1]), confidence=1.5)


def test_bootstrap_auc_ci_returns_delta_vs_baseline():
    """Per spec F2: 'AUC delta vs naive base-rate classifier' -- baseline_auc=0.5
    by default; impl returns delta_point + delta_ci_low/high."""
    preds = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
    labels = np.array([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    out = v.bootstrap_auc_ci(preds, labels, n_bootstrap=200, seed=0, baseline_auc=0.5)
    assert out["baseline_auc"] == 0.5
    assert out["delta_point"] == out["auc_point"] - 0.5
    # CI on delta is just CI on AUC shifted by -0.5
    assert abs(out["delta_ci_low"] - (out["auc_ci_low"] - 0.5)) < 1e-9
    assert abs(out["delta_ci_high"] - (out["auc_ci_high"] - 0.5)) < 1e-9
    # Method recorded for Stage 1 BCa upgrade audit trail
    assert out["method"] == "percentile"


def test_bootstrap_auc_ci_custom_baseline():
    """Caller can compare to a backbone or multi-task v0 baseline AUC."""
    preds = np.array([0.1, 0.2, 0.8, 0.9])
    labels = np.array([0, 0, 1, 1])
    out = v.bootstrap_auc_ci(preds, labels, n_bootstrap=100, seed=0, baseline_auc=0.7)
    assert out["baseline_auc"] == 0.7
    assert abs(out["delta_point"] - (out["auc_point"] - 0.7)) < 1e-9


# ---------- compute_ece_and_reliability ----------


def test_ece_perfect_calibration_is_zero():
    """If predicted probability exactly equals observed rate per bin, ECE = 0."""
    # Construct: 100 samples per decile bin, observed rate matches midpoint
    preds = []
    labels = []
    for i in range(10):
        midpoint = (i + 0.5) / 10
        n_pos = int(midpoint * 100)
        preds.extend([midpoint] * 100)
        labels.extend([1] * n_pos + [0] * (100 - n_pos))
    out = v.compute_ece_and_reliability(np.array(preds), np.array(labels), n_bins=10)
    assert out["ece"] < 0.01


def test_ece_high_when_predictions_uniform_observed_imbalanced():
    """All preds 0.5 but actual base rate 0.1 -> per-bin |0.5-0.1| = 0.4."""
    preds = np.array([0.5] * 100)
    labels = np.array([1] * 10 + [0] * 90)
    out = v.compute_ece_and_reliability(preds, labels, n_bins=10)
    assert abs(out["ece"] - 0.4) < 0.01


def test_ece_reliability_diagram_has_n_bins():
    preds = np.linspace(0.0, 1.0, 100)
    labels = (preds > 0.5).astype(int)
    out = v.compute_ece_and_reliability(preds, labels, n_bins=10)
    assert len(out["reliability_diagram"]) == 10
    # Each bin has expected schema fields
    for b in out["reliability_diagram"]:
        for key in ("bin", "edge_low", "edge_high", "n", "predicted_mean", "observed_rate"):
            assert key in b


def test_ece_handles_empty_input():
    out = v.compute_ece_and_reliability(np.array([]), np.array([]), n_bins=10)
    assert np.isnan(out["ece"])


# ---------- compute_ece_bootstrap_diagnostic ----------


def test_ece_bootstrap_returns_distribution_summary():
    """Bootstrap diagnostic surfaces 25th/median/75th/95th/min/max + mean."""
    rng = np.random.default_rng(0)
    preds = rng.uniform(0, 1, size=200)
    labels = (rng.uniform(0, 1, size=200) < preds).astype(int)
    out = v.compute_ece_bootstrap_diagnostic(preds, labels, n_bootstrap=100, seed=0)
    for key in ("ece_bootstrap_mean", "ece_bootstrap_median",
                "ece_bootstrap_p25", "ece_bootstrap_p75",
                "ece_bootstrap_p95", "ece_bootstrap_min", "ece_bootstrap_max",
                "n_bootstrap", "n_valid_resamples", "method"):
        assert key in out
    # Distribution sanity: min <= p25 <= median <= p75 <= p95 <= max
    assert out["ece_bootstrap_min"] <= out["ece_bootstrap_p25"] <= out["ece_bootstrap_median"]
    assert out["ece_bootstrap_median"] <= out["ece_bootstrap_p75"] <= out["ece_bootstrap_p95"]
    assert out["ece_bootstrap_p95"] <= out["ece_bootstrap_max"]


def test_ece_bootstrap_deterministic_with_seed():
    """Same seed -> same bootstrap distribution summary."""
    preds = np.linspace(0.05, 0.95, 200)
    labels = (preds > 0.5).astype(int)
    a = v.compute_ece_bootstrap_diagnostic(preds, labels, n_bootstrap=50, seed=42)
    b = v.compute_ece_bootstrap_diagnostic(preds, labels, n_bootstrap=50, seed=42)
    assert a["ece_bootstrap_p75"] == b["ece_bootstrap_p75"]
    assert a["ece_bootstrap_mean"] == b["ece_bootstrap_mean"]


def test_ece_bootstrap_handles_empty_input():
    out = v.compute_ece_bootstrap_diagnostic(np.array([]), np.array([]), n_bootstrap=10)
    assert np.isnan(out["ece_bootstrap_p75"])
    assert out["n_valid_resamples"] == 0


def test_run_validation_includes_bootstrap_diagnostic_alongside_gate():
    """Founder tie-break compromise: gate uses in-sample ECE; diagnostic reported alongside.

    Asserts the happy path: a balanced 50-row sample with 20 resamples should
    produce 20 valid resamples (no degenerate single-class draws).
    """
    rng = np.random.default_rng(0)
    preds_list = []
    for i in range(50):
        preds_list.append({
            "country": f"c{i}", "year": 2024, "recipe_id": "test_recipe",
            "predicted_probability": float(rng.random()),
            "label": int(rng.integers(0, 2)),
        })
    out = v.run_validation(predictions=preds_list, anchor_battery=None,
                           n_bootstrap=20, seed=0)
    cal = out["components"]["calibration"]
    assert "per_recipe" in cal  # gate input (option a)
    assert "per_recipe_bootstrap_diagnostic" in cal  # diagnostic (option c)
    assert "gate_uses" in cal
    assert "in_sample_ece" in cal["gate_uses"]
    # Diagnostic has the bootstrap fields
    diag = cal["per_recipe_bootstrap_diagnostic"]["test_recipe"]
    assert "ece_bootstrap_p75" in diag
    # Happy-path resample count: 20 requested, 20 succeeded (balanced 50-row pool)
    assert diag["n_valid_resamples"] == 20


# ---------- compute_brier_decomposition ----------


def test_brier_decomposition_constant_prediction_at_base_rate():
    """If pred = base_rate everywhere, BS = uncertainty exactly.
    Resolution = 0 (no spread), reliability = 0 (perfect agreement)."""
    base_rate = 0.3
    n = 1000
    preds = np.array([base_rate] * n)
    labels = np.array([1] * 300 + [0] * 700)
    out = v.compute_brier_decomposition(preds, labels, n_bins=10)
    assert abs(out["brier_score"] - base_rate * (1 - base_rate)) < 0.01
    assert abs(out["uncertainty"] - base_rate * (1 - base_rate)) < 1e-9
    assert out["resolution"] < 0.01
    assert out["reliability"] < 0.01


def test_brier_decomposition_perfect_predictor_has_max_resolution():
    """Predictions = labels -> brier 0; resolution = uncertainty."""
    n = 1000
    preds = np.array([1.0] * 500 + [0.0] * 500)
    labels = np.array([1] * 500 + [0] * 500)
    out = v.compute_brier_decomposition(preds, labels, n_bins=10)
    assert out["brier_score"] < 0.01
    # Uncertainty = 0.5 * 0.5 = 0.25; resolution should equal uncertainty
    assert abs(out["resolution"] - 0.25) < 0.01
    assert out["reliability"] < 0.01


def test_brier_decomposition_handles_empty():
    out = v.compute_brier_decomposition(np.array([]), np.array([]), n_bins=10)
    assert np.isnan(out["brier_score"])


# ---------- evaluate_anchor_case ----------


def _mk_pred(country: str, year: int, recipe: str, p: float, label: int = 0) -> dict:
    return {"country": country, "year": year, "recipe_id": recipe,
            "predicted_probability": p, "label": label}


def test_evaluate_anchor_case_pass_when_country_in_band():
    """Production predictions use snake_case country slugs; anchor case carries
    country_slug; matching is on the slug."""
    case = {
        "id": 1, "country": "Malta", "country_slug": "malta",
        "recipe": "military_coup",
        "expected_rank_band": [0.0, 0.30],
    }
    preds = [_mk_pred("malta", 2020, "military_coup", 0.05)]
    preds += [_mk_pred(f"c{i}", 2020, "military_coup", 0.5 + i * 0.01) for i in range(50)]
    out = v.evaluate_anchor_case(case, preds)
    assert out["status"] == "PASS"
    assert out["observed_percentile"] < 0.30


def test_evaluate_anchor_case_fail_when_country_outside_band():
    case = {
        "id": 1, "country": "Malta", "country_slug": "malta",
        "recipe": "military_coup",
        "expected_rank_band": [0.0, 0.30],
    }
    # Malta gets a high prediction (above 30th percentile)
    preds = [_mk_pred("malta", 2020, "military_coup", 0.95)]
    preds += [_mk_pred(f"c{i}", 2020, "military_coup", i * 0.005) for i in range(50)]
    out = v.evaluate_anchor_case(case, preds)
    assert out["status"] == "FAIL"
    assert out["observed_percentile"] > 0.30


def test_evaluate_anchor_case_skipped_when_no_predictions_for_recipe():
    case = {
        "id": 99, "country": "Mars", "recipe": "no_such_recipe",
        "expected_rank_band": [0.0, 0.30],
    }
    out = v.evaluate_anchor_case(case, [_mk_pred("Mars", 2020, "other_recipe", 0.5)])
    assert out["status"] == "SKIPPED"


def test_evaluate_anchor_case_skipped_when_country_not_in_predictions():
    case = {
        "id": 1, "country": "Atlantis", "recipe": "civil_war_and_insurgency",
        "expected_rank_band": [0.0, 0.30],
    }
    out = v.evaluate_anchor_case(case, [_mk_pred("Norway", 2020, "civil_war_and_insurgency", 0.1)])
    assert out["status"] == "SKIPPED"


def test_evaluate_anchor_case_year_window_filters():
    case = {
        "id": 5, "country": "Sri Lanka", "recipe": "economic_recession",
        "year_window": [2022, 2022], "expected_rank_band": [0.5, 1.0],
    }
    # Sri Lanka in 2022 is high; in 2018 is low (filtered out by window)
    preds = [
        _mk_pred("Sri Lanka", 2022, "economic_recession", 0.95),
        _mk_pred("Sri Lanka", 2018, "economic_recession", 0.05),
    ]
    preds += [_mk_pred(f"c{i}", 2022, "economic_recession", i * 0.005) for i in range(50)]
    out = v.evaluate_anchor_case(case, preds)
    assert out["status"] == "PASS"


def test_evaluate_anchor_case_sentinel_returns_deferred():
    case = {
        "id": 3, "country": "Norway",
        "recipe_sentinel": "any_conflict_category",
        "resolves_to_layer1": "B",
        "expected_rank_band": [0.0, 0.20],
    }
    preds = [_mk_pred("Norway", 2020, "civil_war_and_insurgency", 0.1)]
    out = v.evaluate_anchor_case(case, preds)
    assert out["status"] == "DEFERRED_TO_STAGE_1"


def test_evaluate_anchor_case_rank_stability_not_yet_implemented():
    """Venezuela case 6 (rank stability) requires multi-version comparison;
    documented as NOT_YET_IMPLEMENTED in v1, not silently SKIPPED."""
    case = {
        "id": 6, "country": "Venezuela", "recipe": "economic_recession",
        "expected_rank_volatility_max": 0.10,
        # No expected_rank_band
    }
    out = v.evaluate_anchor_case(case, [])
    assert out["status"] == "NOT_YET_IMPLEMENTED"
    assert out["expected_rank_volatility_max"] == 0.10
    assert "multi-version" in out["reason"]


def test_evaluate_anchor_case_multi_row_window_takes_mean(caplog):
    """When a country appears multiple times in a multi-year window, take
    mean probability + log a warning so Stage 1 can confirm aggregation choice."""
    case = {
        "id": 99, "country": "Venezuela", "recipe": "economic_recession",
        "year_window": [2018, 2020],  # multi-year
        "expected_rank_band": [0.5, 1.0],
    }
    preds = [
        _mk_pred("Venezuela", 2018, "economic_recession", 0.6),
        _mk_pred("Venezuela", 2019, "economic_recession", 0.8),
        _mk_pred("Venezuela", 2020, "economic_recession", 0.9),
    ] + [_mk_pred(f"c{i}", 2019, "economic_recession", i * 0.005) for i in range(50)]
    with caplog.at_level("WARNING", logger="validate_ml_model"):
        out = v.evaluate_anchor_case(case, preds)
    # Should use mean probability across Venezuela's 3 rows
    assert out["country_prob_aggregation"] == "mean"
    assert abs(out["country_prob"] - (0.6 + 0.8 + 0.9) / 3) < 1e-9
    # Warning emitted
    assert any("3 prediction rows" in r.message for r in caplog.records)


# ---------- evaluate_anchor_battery ----------


def test_evaluate_anchor_battery_separates_active_and_deferred():
    battery = {
        "active_cases": [{
            "id": 2, "country": "Iceland", "recipe": "civil_war_and_insurgency",
            "expected_rank_band": [0.0, 0.30],
        }],
        "deferred_cases": [{
            "id": 1, "country": "Malta", "recipe": "military_coup",
            "deferred_reason": "hard-gated",
        }],
    }
    preds = [
        _mk_pred("Iceland", 2020, "civil_war_and_insurgency", 0.05),
    ] + [_mk_pred(f"c{i}", 2020, "civil_war_and_insurgency", 0.5 + i * 0.01) for i in range(20)]
    out = v.evaluate_anchor_battery(preds, battery)
    assert out["n_active"] == 1
    assert out["n_active_pass"] == 1
    assert out["n_deferred_by_hard_gate"] == 1
    assert out["deferred"][0]["status"] == "DEFERRED_BY_HARD_GATE"


def test_evaluate_anchor_battery_handles_empty_battery():
    out = v.evaluate_anchor_battery([], {"active_cases": [], "deferred_cases": []})
    assert out["n_active"] == 0


# ---------- run_validation orchestrator ----------


def test_run_validation_emits_full_payload_shape():
    rng = np.random.default_rng(0)
    preds_list = []
    for recipe in ("a", "b"):
        for i in range(50):
            preds_list.append({
                "country": f"c{i}",
                "year": 2024,
                "recipe_id": recipe,
                "predicted_probability": float(rng.random()),
                "label": int(rng.integers(0, 2)),
            })
    out = v.run_validation(predictions=preds_list, anchor_battery=None, n_bootstrap=50, seed=0)
    assert out["schema_version"] == 1
    assert out["n_predictions"] == 100
    assert out["n_recipes"] == 2
    for recipe in ("a", "b"):
        assert recipe in out["components"]["oos_by_time"]["per_recipe"]
        assert recipe in out["components"]["calibration"]["per_recipe"]
        assert recipe in out["components"]["brier"]["per_recipe"]
    assert out["components"]["anchor_battery"] is None  # no anchors passed


def test_run_validation_includes_anchors_when_provided():
    preds = [
        {"country": "Iceland", "year": 2024, "recipe_id": "civil_war_and_insurgency",
         "predicted_probability": 0.05, "label": 0},
    ] + [
        {"country": f"c{i}", "year": 2024, "recipe_id": "civil_war_and_insurgency",
         "predicted_probability": 0.5 + i * 0.01, "label": 0}
        for i in range(20)
    ]
    battery = {
        "active_cases": [{
            "id": 2, "country": "Iceland", "recipe": "civil_war_and_insurgency",
            "expected_rank_band": [0.0, 0.30],
        }],
        "deferred_cases": [],
    }
    out = v.run_validation(predictions=preds, anchor_battery=battery, n_bootstrap=20, seed=0)
    assert out["components"]["anchor_battery"]["n_active"] == 1
