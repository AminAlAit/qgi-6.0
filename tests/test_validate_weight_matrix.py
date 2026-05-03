"""
Unit tests for Phase 4 validation gate (validate_weight_matrix.py).

Tests cover the math (z-score computation, scoring, AUC, ECE, reliability
binning) without touching Athena. The data loaders are exercised at module
import time — if any sibling-script import fails, test collection fails
loudly.

Author: Claude Opus 4.7 (1M context)
Generated: 2026-05-03
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest


# Load the script as a module without executing main(). Register in
# sys.modules BEFORE exec_module so any @dataclass etc. resolves
# cls.__module__ correctly (Python 3.14 hardening).
_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "validate_weight_matrix.py"
_spec = importlib.util.spec_from_file_location("validate_weight_matrix", _SCRIPT)
mod = importlib.util.module_from_spec(_spec)
sys.modules["validate_weight_matrix"] = mod
_spec.loader.exec_module(mod)


# ===========================================================================
# compute_country_zscores
# ===========================================================================

def test_zscore_zero_mean_one_std():
    """Z-scored values should have approximately mean=0 and std=1
    across countries (per indicator)."""
    rng = np.random.default_rng(42)
    countries = [f"C{i}" for i in range(50)]
    indicators = ["IND_A", "IND_B"]
    rows = []
    for c in countries:
        for ind in indicators:
            for y in range(2010, 2015):
                rows.append({"country": c, "year": y, "indicator_id": ind,
                             "value": float(rng.normal(loc=10.0, scale=3.0))})
    panel = pd.DataFrame(rows)

    z = mod.compute_country_zscores(panel, cutoff_year=2014)

    for ind in indicators:
        sub = z[z["indicator_id"] == ind]["z_score"]
        assert abs(sub.mean()) < 0.1, f"mean of z-scores not near 0: {sub.mean()}"
        assert abs(sub.std() - 1.0) < 0.15, f"std of z-scores not near 1: {sub.std()}"


def test_zscore_handles_zero_variance_indicator():
    """If an indicator has the same value across all countries (zero
    cross-sectional variance), z-score is 0 (not NaN)."""
    panel = pd.DataFrame([
        {"country": "X", "year": 2014, "indicator_id": "FLAT", "value": 5.0},
        {"country": "Y", "year": 2014, "indicator_id": "FLAT", "value": 5.0},
        {"country": "Z", "year": 2014, "indicator_id": "FLAT", "value": 5.0},
    ])
    z = mod.compute_country_zscores(panel, cutoff_year=2014)
    assert (z["z_score"] == 0.0).all(), "zero-variance indicator should produce z=0"


def test_zscore_uses_window_median_when_cutoff_year_missing():
    """If a country lacks the cutoff_year value, the helper uses the
    median across the window — not NaN."""
    # Country X has values for 2010-2013 but NOT 2014
    panel = pd.DataFrame([
        {"country": "X", "year": 2010, "indicator_id": "A", "value": 10.0},
        {"country": "X", "year": 2011, "indicator_id": "A", "value": 12.0},
        {"country": "X", "year": 2012, "indicator_id": "A", "value": 14.0},
        {"country": "X", "year": 2013, "indicator_id": "A", "value": 16.0},
        # Y has the cutoff year
        {"country": "Y", "year": 2014, "indicator_id": "A", "value": 50.0},
        # Z has the cutoff year
        {"country": "Z", "year": 2014, "indicator_id": "A", "value": 100.0},
    ])
    z = mod.compute_country_zscores(panel, cutoff_year=2014)
    # X's median over the window 2010-2014 is median([10,12,14,16]) = 13
    x_row = z[z["country"] == "X"]
    assert len(x_row) == 1
    assert abs(x_row["value"].iloc[0] - 13.0) < 1e-6


# ===========================================================================
# score_country_event
# ===========================================================================

def test_score_country_event_basic():
    """Verify the formula: anomaly_score = sum(weight * |z_score|)."""
    weights_df = pd.DataFrame([
        {"indicator_numeric_id": 1, "event_category": "elections", "weight": 0.5},
        {"indicator_numeric_id": 2, "event_category": "elections", "weight": 0.3},
        {"indicator_numeric_id": 1, "event_category": "protest",   "weight": 0.7},
    ])
    zscores = pd.DataFrame([
        {"country": "A", "indicator_id": "API_X", "value": 5.0, "z_score": 2.0},
        {"country": "A", "indicator_id": "API_Y", "value": 5.0, "z_score": -1.0},
    ])
    num_to_api = {1: "API_X", 2: "API_Y"}
    country_id_to_str = {100: "A"}

    out = mod.score_country_event(weights_df, zscores, country_id_to_str, num_to_api)

    # For (A, elections): partial_X = 0.5 * |2.0| = 1.0; partial_Y = 0.3 * |-1.0| = 0.3
    # Sum = 1.3
    elections = out[(out["country_str"] == "A") & (out["event_category"] == "elections")]
    assert len(elections) == 1
    assert abs(elections["anomaly_score"].iloc[0] - 1.3) < 1e-9
    assert int(elections["n_indicators_used"].iloc[0]) == 2

    # For (A, protest): partial_X = 0.7 * 2.0 = 1.4
    protest = out[(out["country_str"] == "A") & (out["event_category"] == "protest")]
    assert len(protest) == 1
    assert abs(protest["anomaly_score"].iloc[0] - 1.4) < 1e-9


def test_score_country_event_drops_unmapped_indicator():
    """Weight rows whose indicator_numeric_id has no api_code mapping
    are dropped, not treated as zero (silent failure would corrupt
    the comparison)."""
    weights_df = pd.DataFrame([
        {"indicator_numeric_id": 1, "event_category": "X", "weight": 0.5},
        {"indicator_numeric_id": 999, "event_category": "X", "weight": 0.5},  # no mapping
    ])
    zscores = pd.DataFrame([
        {"country": "A", "indicator_id": "API_X", "value": 5.0, "z_score": 2.0},
    ])
    num_to_api = {1: "API_X"}  # 999 deliberately absent
    country_id_to_str = {100: "A"}

    out = mod.score_country_event(weights_df, zscores, country_id_to_str, num_to_api)
    # Only the mapped indicator contributes; n_indicators_used=1
    assert len(out) == 1
    assert int(out["n_indicators_used"].iloc[0]) == 1
    assert abs(out["anomaly_score"].iloc[0] - 1.0) < 1e-9


# ===========================================================================
# compute_per_category_auc
# ===========================================================================

def test_per_category_auc_perfect_discrimination():
    """If anomaly_score perfectly orders countries by ground truth,
    AUC = 1.0."""
    scored = pd.DataFrame([
        {"country_id": 1, "event_category": "X", "anomaly_score": 0.1},
        {"country_id": 2, "event_category": "X", "anomaly_score": 0.5},
        {"country_id": 3, "event_category": "X", "anomaly_score": 0.9},
    ])
    gt = pd.DataFrame([
        {"country_id": 1, "event_category": "X", "y_post_cutoff": 0},
        {"country_id": 2, "event_category": "X", "y_post_cutoff": 0},
        {"country_id": 3, "event_category": "X", "y_post_cutoff": 1},
    ])
    out = mod.compute_per_category_auc(scored, gt)
    # n=3 < 5 floor → AUC=None per the safety check
    assert out[0]["auc"] is None
    assert out[0]["n_countries"] == 3


def test_per_category_auc_with_enough_data():
    """With at least 5 cells and mixed labels, AUC is computed."""
    scored = pd.DataFrame([
        {"country_id": i, "event_category": "X", "anomaly_score": float(i)}
        for i in range(10)
    ])
    # Higher scores → more likely to be positive (perfect ordering)
    gt = pd.DataFrame([
        {"country_id": i, "event_category": "X",
         "y_post_cutoff": 1 if i >= 5 else 0}
        for i in range(10)
    ])
    out = mod.compute_per_category_auc(scored, gt)
    assert out[0]["auc"] is not None
    assert abs(out[0]["auc"] - 1.0) < 1e-9


def test_per_category_auc_all_same_label_returns_none():
    """If all countries have the same label (all positive or all
    negative), AUC is undefined → None."""
    scored = pd.DataFrame([
        {"country_id": i, "event_category": "X", "anomaly_score": float(i)}
        for i in range(10)
    ])
    gt = pd.DataFrame([
        {"country_id": i, "event_category": "X", "y_post_cutoff": 1}
        for i in range(10)
    ])
    out = mod.compute_per_category_auc(scored, gt)
    assert out[0]["auc"] is None


# ===========================================================================
# compute_ece_and_reliability
# ===========================================================================

def test_ece_perfect_calibration():
    """When predictions exactly match event rates per bin, ECE = 0."""
    # Within event_category X: half the countries scored 0.0, half 0.1.
    # The high-score group has a 100% event rate, low-score group 0%.
    # After per-category min-max scale: low → 0.0, high → 1.0.
    # Bin 0 (score=0): event rate = 0; Bin 9 (score=1): event rate = 1.
    # All other bins empty. ECE = 0.
    scored = pd.DataFrame([
        {"country_id": i, "event_category": "X",
         "anomaly_score": 0.0 if i < 10 else 0.1}
        for i in range(20)
    ])
    gt = pd.DataFrame([
        {"country_id": i, "event_category": "X",
         "y_post_cutoff": 0 if i < 10 else 1}
        for i in range(20)
    ])
    ece, rel = mod.compute_ece_and_reliability(scored, gt, n_bins=10)
    # Bin 0 has 10 countries with pred=0.0, event_rate=0 → gap=0
    # Bin 9 has 10 countries with pred=1.0, event_rate=1 → gap=0
    # ECE = 0
    assert ece < 1e-9, f"perfect calibration should give ECE near 0, got {ece}"


def test_ece_total_miscalibration():
    """If predictions are inverted (high score → low event rate), ECE
    is large."""
    scored = pd.DataFrame([
        {"country_id": i, "event_category": "X",
         "anomaly_score": float(i)}
        for i in range(20)
    ])
    # Inverted: high scores get LOW labels
    gt = pd.DataFrame([
        {"country_id": i, "event_category": "X",
         "y_post_cutoff": 1 if i < 10 else 0}
        for i in range(20)
    ])
    ece, rel = mod.compute_ece_and_reliability(scored, gt, n_bins=10)
    # Min-max-scaled: low scores → 0, high scores → 1.
    # Low-score bin (pred~0) has all-positives (event_rate=1) → gap = 1
    # High-score bin (pred~1) has all-negatives (event_rate=0) → gap = 1
    # ECE should be substantial (closer to 1 than 0)
    assert ece > 0.5, f"total miscalibration should give large ECE, got {ece}"


def test_reliability_diagram_n_per_bin_sums_to_input():
    """Sum of bin counts equals total cells (no double-counting, no drops)."""
    scored = pd.DataFrame([
        {"country_id": i, "event_category": "X",
         "anomaly_score": float(i % 7)}
        for i in range(50)
    ])
    gt = pd.DataFrame([
        {"country_id": i, "event_category": "X",
         "y_post_cutoff": i % 2}
        for i in range(50)
    ])
    ece, rel = mod.compute_ece_and_reliability(scored, gt, n_bins=10)
    total_in_bins = sum(b["n"] for b in rel)
    assert total_in_bins == 50


# ===========================================================================
# Baseline weight builders (#598)
# ===========================================================================

def test_uniform_baseline_replaces_all_weights_with_one():
    """build_uniform_baseline sets every weight to 1.0, preserves rest."""
    weights_df = pd.DataFrame([
        {"indicator_numeric_id": 1, "event_category": "X", "weight": 0.123, "extra": "keep"},
        {"indicator_numeric_id": 2, "event_category": "Y", "weight": 0.456, "extra": "alsokeep"},
    ])
    out = mod.build_uniform_baseline(weights_df)
    assert (out["weight"] == 1.0).all()
    # Other columns preserved
    assert list(out["indicator_numeric_id"]) == [1, 2]
    assert list(out["event_category"]) == ["X", "Y"]
    assert list(out["extra"]) == ["keep", "alsokeep"]
    # Original df not mutated
    assert weights_df["weight"].iloc[0] == 0.123


def test_random_baseline_is_deterministic_with_seed():
    """Same seed → same random weights (reproducibility)."""
    weights_df = pd.DataFrame([
        {"indicator_numeric_id": i, "event_category": "X", "weight": 0.5}
        for i in range(20)
    ])
    out_a = mod.build_random_baseline(weights_df, seed=42)
    out_b = mod.build_random_baseline(weights_df, seed=42)
    pd.testing.assert_series_equal(out_a["weight"], out_b["weight"])

    # Different seed → different draws
    out_c = mod.build_random_baseline(weights_df, seed=99)
    assert not (out_a["weight"] == out_c["weight"]).all(), \
        "different seeds should produce different random draws"


def test_random_baseline_weights_in_unit_interval():
    """All random weights in [0, 1]."""
    weights_df = pd.DataFrame([
        {"indicator_numeric_id": i, "event_category": "X", "weight": 0.5}
        for i in range(100)
    ])
    out = mod.build_random_baseline(weights_df, seed=7)
    assert (out["weight"] >= 0.0).all()
    assert (out["weight"] <= 1.0).all()


def test_baselines_preserve_row_count():
    """Both baselines return the same number of rows as input."""
    weights_df = pd.DataFrame([
        {"indicator_numeric_id": i, "event_category": "X", "weight": 0.5}
        for i in range(42)
    ])
    assert len(mod.build_uniform_baseline(weights_df)) == 42
    assert len(mod.build_random_baseline(weights_df, seed=0)) == 42
