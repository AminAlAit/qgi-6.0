"""Unit tests for scripts/score_countries.py — the F-ML-1 post-walk per-country
scoring step (#967).

Scope: pure helpers (no XGBoost, no SHAP). The orchestrator `score_recipe` is
validated end-to-end by the 2026-05-28 local bake (`bake-scores-locally.py`
producing the 10 cards-v3 + scores + analogs uploaded to S3) and by the canary
re-run after the ECR image rebuild — not by unit tests, which can't cheaply
spin up xgboost on a real recipe.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import score_countries as sc  # noqa: E402


# ---------- normalize_country_id --------------------------------------------

def test_normalize_country_id_underscore_to_space_title_case():
    assert sc.normalize_country_id("united_states") == "United States"
    assert sc.normalize_country_id("albania") == "Albania"
    assert sc.normalize_country_id("congo_dem_rep") == "Congo Dem Rep"


def test_normalize_country_id_idempotent_on_already_titled():
    assert sc.normalize_country_id("United States") == "United States"


# ---------- cos_sim ----------------------------------------------------------

def test_cos_sim_identical_vectors_returns_one():
    v = np.array([1.0, 2.0, 3.0])
    assert sc.cos_sim(v, v) == 1.0


def test_cos_sim_orthogonal_vectors_returns_zero():
    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert sc.cos_sim(a, b) == 0.0


def test_cos_sim_opposite_vectors_returns_negative_one():
    a = np.array([1.0, 0.0])
    b = np.array([-1.0, 0.0])
    assert sc.cos_sim(a, b) == -1.0


def test_cos_sim_zero_norm_vector_returns_zero_not_nan():
    """A zero feature vector cannot have a meaningful analog — 0.0 is the honest
    sentinel, never NaN (NaN would crash the sort)."""
    zero = np.zeros(5)
    other = np.array([1.0, 2.0, 0.0, 0.0, 0.0])
    assert sc.cos_sim(zero, other) == 0.0
    assert sc.cos_sim(other, zero) == 0.0


# ---------- signal_share_per_indicator --------------------------------------

def test_signal_share_sums_to_100_when_nonzero_shap():
    # 2 indicators × 8 features each = 16-length SHAP row
    row = np.array([1.0, -2.0, 3.0, -1.0, 0.5, -0.5, 1.5, -1.5,  # indicator 1 sum_abs=11
                     0.5, 0.5, 0.0, 1.0, -1.0, 2.0, -0.5, 0.5])    # indicator 2 sum_abs=6
    shares = sc.signal_share_per_indicator(row)
    assert len(shares) == 2
    assert abs(sum(shares) - 100.0) < 1e-6
    # indicator 1 should dominate (11/17 ≈ 65%)
    assert shares[0] > shares[1]


def test_signal_share_all_zero_row_returns_zeros():
    row = np.zeros(16)  # 2 indicators
    assert sc.signal_share_per_indicator(row) == [0.0, 0.0]


# ---------- histogram_bins --------------------------------------------------

def test_histogram_bins_20_bins_cover_0_to_100():
    scores = np.array([5.0, 25.0, 50.0, 75.0, 100.0])
    h = sc.histogram_bins(scores)
    assert len(h["histogram"]) == 20
    assert h["histogram"][0]["bin_lo"] == 0.0
    assert h["histogram"][-1]["bin_hi"] == 100.0
    # bins contiguous
    for i in range(19):
        assert h["histogram"][i]["bin_hi"] == h["histogram"][i + 1]["bin_lo"]


def test_histogram_bins_counts_sum_to_n_scored():
    scores = np.array([1.0, 25.0, 50.0, 75.0, 99.0, 100.0])
    h = sc.histogram_bins(scores)
    assert sum(b["count"] for b in h["histogram"]) == scores.size


def test_histogram_bins_last_bin_inclusive_on_100():
    """A score of exactly 100.0 must land in the last bin, never be dropped."""
    h = sc.histogram_bins(np.array([100.0]))
    assert h["histogram"][-1]["count"] == 1


def test_histogram_bins_empty_input_returns_empty_struct():
    h = sc.histogram_bins(np.array([]))
    assert h["histogram"] == []
    assert h["median"] is None and h["max"] is None


def test_histogram_bins_percentiles_match_numpy():
    scores = np.arange(101, dtype=float)  # 0..100
    h = sc.histogram_bins(scores)
    assert h["median"] == 50.0
    assert h["p90"] == 90.0
    assert h["max"] == 100.0


# ---------- country_movement_12y --------------------------------------------

def test_country_movement_12y_returns_one_entry_per_indicator():
    import pandas as pd
    panels = {
        "ind_a": pd.DataFrame({"country": ["Alpha"] * 12, "year": list(range(2013, 2025)),
                                 "value": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0]}),
        "ind_b": pd.DataFrame({"country": ["Alpha"] * 5, "year": list(range(2020, 2025)),
                                 "value": [100.0, 110.0, 105.0, 120.0, 130.0]}),
    }
    out = sc.country_movement_12y("Alpha", panels, ["ind_a", "ind_b"])
    assert len(out) == 2
    assert out[0]["code"] == "ind_a"
    assert len(out[0]["trajectory_12q"]) == 12
    assert out[0]["z_score_change"] is not None  # last - first; monotone increasing → positive
    assert out[0]["z_score_change"] > 0
    assert len(out[1]["trajectory_12q"]) == 5    # tail(12) on a 5-year panel returns 5 rows


def test_country_movement_12y_country_missing_yields_None_trajectory():
    import pandas as pd
    panels = {"ind_a": pd.DataFrame({"country": ["Beta"], "year": [2024], "value": [1.0]})}
    out = sc.country_movement_12y("Alpha", panels, ["ind_a"])
    assert out[0]["trajectory_12q"] == []
    assert out[0]["z_score_change"] is None


def test_country_movement_12y_single_point_zscore_change_is_None():
    import pandas as pd
    panels = {"ind_a": pd.DataFrame({"country": ["Alpha"], "year": [2024], "value": [42.0]})}
    out = sc.country_movement_12y("Alpha", panels, ["ind_a"])
    assert len(out[0]["trajectory_12q"]) == 1
    assert out[0]["z_score_change"] is None
