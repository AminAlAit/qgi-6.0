"""Unit tests for confound_income_proxy.py (PLAN.md §11 acceptance bar #3: "Income-proxy
control -- must beat a bare GNI-per-capita fit (NY.GNP.PCAP.CD, already in panel), CI
excluding zero, within the EM subsample").

`ci_excludes_zero` / `indicator_available_in_panel_dir` are PURE (no sklearn/xgboost/
joblib) -- host-testable, no Docker required. The scoring entrypoint
(`run_income_proxy_fit`, which calls `fit_predict_loco`) is exercised only inside Docker,
same DI split as the rest of `em_test/`.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import confound_income_proxy as cip  # noqa: E402


# ============================================================================================
# ci_excludes_zero
# ============================================================================================
@pytest.mark.parametrize(
    "lo,hi,expected",
    [
        (0.01, 0.10, True),    # entirely positive -> excludes zero
        (-0.10, -0.01, True),  # entirely negative -> excludes zero
        (-0.05, 0.05, False),  # straddles zero
        (0.0, 0.10, False),    # touches zero at the boundary -> does NOT exclude it
        (-0.10, 0.0, False),   # touches zero at the boundary -> does NOT exclude it
    ],
)
def test_ci_excludes_zero_cases(lo, hi, expected):
    assert cip.ci_excludes_zero(lo, hi) is expected


def test_ci_excludes_zero_nan_is_false():
    assert cip.ci_excludes_zero(float("nan"), 0.10) is False
    assert cip.ci_excludes_zero(-0.10, float("nan")) is False


def test_ci_excludes_zero_none_is_false():
    assert cip.ci_excludes_zero(None, 0.10) is False
    assert cip.ci_excludes_zero(-0.10, None) is False


def test_ci_excludes_zero_rejects_inverted_bounds():
    with pytest.raises(ValueError):
        cip.ci_excludes_zero(0.10, -0.10)  # lo > hi is a caller bug, not a valid CI


# ============================================================================================
# indicator_available_in_panel_dir
# ============================================================================================
def test_indicator_available_true_when_parquet_exists(tmp_path):
    ind_dir = tmp_path / "NY.GNP.PCAP.CD"
    ind_dir.mkdir()
    (ind_dir / "NY.GNP.PCAP.CD.parquet").write_bytes(b"not a real parquet, just presence-tested")
    assert cip.indicator_available_in_panel_dir(tmp_path, "NY.GNP.PCAP.CD") is True


def test_indicator_available_false_when_missing(tmp_path):
    assert cip.indicator_available_in_panel_dir(tmp_path, "NY.GNP.PCAP.CD") is False


def test_indicator_available_false_when_dir_but_no_parquet(tmp_path):
    (tmp_path / "NY.GNP.PCAP.CD").mkdir()
    assert cip.indicator_available_in_panel_dir(tmp_path, "NY.GNP.PCAP.CD") is False


# ============================================================================================
# Module constant sanity (the actual indicator id this control must use, per §11 bar #3).
# ============================================================================================
def test_income_proxy_indicator_id_is_gni_per_capita():
    assert cip.INCOME_PROXY_INDICATOR_ID == "NY.GNP.PCAP.CD"
