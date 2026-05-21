"""Unit tests for F-ML-1 PoC driver pure functions.

Per F-ML-1 §2 binding rules + Stage 7 test-first discipline.
End-to-end smoke testing is via --max-candidates-debug flag at the script
level. These tests cover pure helpers (AUC, BCa bootstrap, feature
extraction, trajectory signature, fold variance).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import run_f_ml_1_poc as drv


def test_compute_auc_perfect():
    probs = np.array([0.9, 0.8, 0.1, 0.2])
    labels = np.array([1, 1, 0, 0])
    assert drv.compute_auc(probs, labels) == 1.0


def test_compute_auc_random():
    probs = np.array([0.5, 0.5, 0.5, 0.5])
    labels = np.array([1, 1, 0, 0])
    assert drv.compute_auc(probs, labels) == 0.5


def test_compute_auc_single_class_nan():
    probs = np.array([0.7, 0.8])
    labels = np.array([1, 1])
    assert np.isnan(drv.compute_auc(probs, labels))


def test_bca_bootstrap_ci_shape():
    rng = np.random.default_rng(0)
    probs = np.concatenate([rng.uniform(0.6, 1.0, 30), rng.uniform(0.0, 0.4, 30)])
    labels = np.concatenate([np.ones(30, dtype=int), np.zeros(30, dtype=int)])
    out = drv.bca_bootstrap_auc_ci(probs, labels, B=200, seed=42)
    assert {"auc", "ci80_lo", "ci80_hi", "ci95_lo", "ci95_hi", "n_bootstrap", "method"} == set(out)
    assert 0.0 <= out["ci95_lo"] <= out["ci80_lo"] <= out["auc"]
    assert out["auc"] <= out["ci80_hi"] <= out["ci95_hi"] <= 1.0
    assert out["method"] == "bca_bootstrap"


def test_fold_variance_zero_when_uniform():
    per_country_auc = {"a": 0.7, "b": 0.7, "c": 0.7}
    assert drv.fold_variance(per_country_auc) < 1e-15  # floating-point near-zero


def test_fold_variance_positive_when_varied():
    per_country_auc = {"a": 0.9, "b": 0.5, "c": 0.7}
    assert drv.fold_variance(per_country_auc) > 0.0


def test_compute_ece_well_calibrated_low():
    rng = np.random.default_rng(0)
    probs = rng.uniform(0, 1, 500)
    labels = rng.binomial(1, probs)
    ece = drv.compute_ece(probs, labels)
    assert 0.0 <= ece <= 0.10


def test_compute_ece_miscalibrated_high():
    probs = np.full(100, 0.9)
    labels = np.zeros(100, dtype=int)
    assert drv.compute_ece(probs, labels) >= 0.5


def test_extract_features_basic():
    """Per Miriam M14-1: tertile structure is at the right index slots."""
    df = pd.DataFrame({
        "country": ["TestCountry"] * 20,
        "year": list(range(2000, 2020)),
        "value": list(range(20)),
    })
    feats = drv.extract_features_for_indicator(df, "TestCountry", 2020, window=15)
    assert feats is not None
    assert feats.shape == (8,)
    # last_z, mean_z, std_z, slope, accel, t1m, t2m, t3m
    # slope should be positive (monotonically increasing)
    assert feats[3] > 0
    # tertile 3 mean > tertile 1 mean (later years higher value)
    assert feats[7] > feats[5]


def test_extract_features_insufficient_data_returns_none():
    df = pd.DataFrame({
        "country": ["TestCountry"] * 2,
        "year": [2018, 2019],
        "value": [1.0, 2.0],
    })
    feats = drv.extract_features_for_indicator(df, "TestCountry", 2020, window=10)
    assert feats is None  # < window // 3 = 3 valid years


def test_trajectory_signature_full_window_structure():
    """Per Miriam M14-1: signature must cover FULL window, not single lag."""
    df = pd.DataFrame({
        "country": ["TestCountry"] * 25,
        "year": list(range(1995, 2020)),
        "value": list(range(25)),
    })
    sig = drv.extract_trajectory_signature_full(df, "TestCountry", 2020, window=15)
    assert sig["available"] is True
    assert "per_tertile_z_score" in sig
    assert len(sig["per_tertile_z_score"]) == 3
    assert "per_tertile_direction_sign" in sig
    assert len(sig["per_tertile_direction_sign"]) == 3
    assert "temporal_profile" in sig
    assert len(sig["temporal_profile"]) == 15  # full window, not single lag
    # increasing values → late tertile higher than early
    assert sig["per_tertile_z_score"][2] > sig["per_tertile_z_score"][0]


def test_to_strict_json_replaces_nan():
    payload = {"a": float("nan"), "b": [1.0, float("inf")], "c": {"d": np.nan}}
    s = drv._to_strict_json(payload)
    parsed = json.loads(s)
    assert parsed["a"] is None
    assert parsed["b"][1] is None
    assert parsed["c"]["d"] is None


def test_to_strict_json_numpy_types():
    payload = {"i": np.int64(7), "f": np.float64(3.14), "arr": np.array([1, 2, 3])}
    s = drv._to_strict_json(payload)
    parsed = json.loads(s)
    assert parsed["i"] == 7
    assert parsed["f"] == 3.14
    assert parsed["arr"] == [1, 2, 3]
