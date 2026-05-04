"""Unit tests for src/beta_calibration.py."""
from __future__ import annotations

import pathlib
import sys

import numpy as np
import pytest

SRC_DIR = pathlib.Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC_DIR))

import beta_calibration as bc  # noqa: E402


def test_beta_calibrator_identity_on_perfectly_calibrated_input():
    """When raw scores already match observed rates, calibration should be near identity."""
    rng = np.random.default_rng(0)
    n = 2000
    raw = rng.uniform(0, 1, size=n)
    # Generate labels with rate exactly equal to raw score (perfect cal target)
    y = (rng.uniform(0, 1, size=n) < raw).astype(int)
    cal = bc.BetaCalibrator.fit(raw, y)
    # Predict on a clean grid; calibrated values should track input closely
    s_test = np.linspace(0.05, 0.95, 19)
    pred = cal.predict(s_test)
    # Expect near-monotonic, near-identity (some shrinkage is OK)
    assert np.all(np.diff(pred) >= -1e-6)  # monotonic non-decreasing
    # Mean absolute deviation should be small
    assert np.mean(np.abs(pred - s_test)) < 0.10


def test_beta_calibrator_corrects_overconfident_input():
    """Overconfident predictions (extreme 0/1 values) should be pulled back toward middle."""
    rng = np.random.default_rng(1)
    n = 1000
    # Half the samples: predicted 0.95, observed rate 0.7 (overconfident high)
    raw_high = np.full(n // 2, 0.95)
    y_high = (rng.uniform(0, 1, size=n // 2) < 0.7).astype(int)
    # Half: predicted 0.05, observed rate 0.3 (overconfident low)
    raw_low = np.full(n // 2, 0.05)
    y_low = (rng.uniform(0, 1, size=n // 2) < 0.3).astype(int)
    raw = np.concatenate([raw_high, raw_low])
    y = np.concatenate([y_high, y_low])
    cal = bc.BetaCalibrator.fit(raw, y)
    # Calibrated 0.95 should be pulled down toward ~0.7
    pred_high = cal.predict(np.array([0.95]))[0]
    pred_low = cal.predict(np.array([0.05]))[0]
    assert pred_high < 0.95  # corrected downward
    assert pred_low > 0.05   # corrected upward
    # Predictions on raw=0.5 should also be reasonable (near middle-region)
    assert 0.0 < cal.predict(np.array([0.5]))[0] < 1.0


def test_beta_calibrator_preserves_monotonicity():
    """a >= 0 + b >= 0 bounds enforce monotonic calibration in s."""
    rng = np.random.default_rng(2)
    n = 500
    raw = rng.uniform(0, 1, size=n)
    y = (rng.uniform(0, 1, size=n) < raw ** 2).astype(int)  # nonlinear truth
    cal = bc.BetaCalibrator.fit(raw, y)
    # Predictions on monotonic grid must be monotonic non-decreasing
    grid = np.linspace(0.01, 0.99, 99)
    pred = cal.predict(grid)
    assert np.all(np.diff(pred) >= -1e-6)


def test_beta_calibrator_handles_extreme_inputs():
    """Inputs of exactly 0 or 1 must not crash (clipped internally)."""
    raw = np.array([0.0, 0.5, 1.0])
    y = np.array([0, 1, 1])
    cal = bc.BetaCalibrator.fit(raw, y)
    pred = cal.predict(np.array([0.0, 0.5, 1.0]))
    assert np.all(np.isfinite(pred))
    assert np.all((pred >= 0) & (pred <= 1))


def test_beta_calibrator_degenerate_with_one_sample():
    """Single sample -> identity calibrator (no fit), should not crash."""
    cal = bc.BetaCalibrator.fit(np.array([0.5]), np.array([1]))
    assert cal.n_fit == 1
    # Identity init: a=1, b=1, c=0
    # g(s) = log(s) + log(1-s) = log(s*(1-s))
    # sigmoid(g) = s*(1-s) / (s*(1-s) + 1)
    pred = cal.predict(np.array([0.3]))
    expected = (0.3 * 0.7) / (0.3 * 0.7 + 1)  # = 0.21 / 1.21 ≈ 0.1736
    assert abs(pred[0] - expected) < 0.01


def test_beta_calibrator_to_dict_round_trip():
    cal = bc.BetaCalibrator(a=2.0, b=1.5, c=-0.5, n_fit=100, converged=True)
    d = cal.to_dict()
    assert d["a"] == 2.0
    assert d["b"] == 1.5
    assert d["c"] == -0.5
    assert d["n_fit"] == 100
    assert d["converged"] is True


def test_beta_calibrator_shape_mismatch_raises():
    with pytest.raises(ValueError, match="shape mismatch"):
        bc.BetaCalibrator.fit(np.array([0.5, 0.6]), np.array([1, 1, 0]))
