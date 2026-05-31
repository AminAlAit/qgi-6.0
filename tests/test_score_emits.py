"""Unit tests for score_countries.py emit helpers (frontend bake-request §A.1 / #974:
signed per-country SHAP magnitude). Pure numpy over a SHAP row — no XGBoost/SHAP fit.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import score_countries as sc  # noqa: E402


def test_signed_shap_sums_each_8_feature_block_with_sign():
    # 2 indicators x 8 features: block 0 all +1 (-> +8), block 1 all -2 (-> -16)
    row = np.array([1.0] * 8 + [-2.0] * 8)
    assert sc.signed_shap_per_indicator(row) == [8.0, -16.0]


def test_signed_shap_preserves_sign_where_share_discards_it():
    # signal_share takes |shap| (always >=0); signed keeps the direction.
    row = np.array([1.0] * 8 + [-2.0] * 8)
    share = sc.signal_share_per_indicator(row)   # [8/24, 16/24] * 100
    signed = sc.signed_shap_per_indicator(row)
    assert share[1] > 0                          # share is magnitude-only
    assert signed[1] < 0                          # signed shows "pushes away"
    # block 0: all positive, so share and sign agree in direction
    assert signed[0] > 0


def test_signed_shap_partial_cancellation_within_block():
    # one indicator, 8 features summing to a small signed net (+3 -1 ... )
    row = np.array([3.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    assert sc.signed_shap_per_indicator(row) == [2.0]


def test_signed_shap_same_block_grouping_as_signal_share():
    # both helpers must reshape identically (indicator-major, 8 per group)
    row = np.arange(24.0)  # 3 indicators
    assert len(sc.signed_shap_per_indicator(row)) == 3
    assert len(sc.signal_share_per_indicator(row)) == 3
