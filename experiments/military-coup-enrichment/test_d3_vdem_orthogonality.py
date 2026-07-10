"""Tests for d3_vdem_orthogonality.py -- D3 (MANDATORY, hardened -- purist edit #1) from
PRE-REGISTRATION.md: residualize/partial-correlation each of the 5 V-Dem candidates against
the FULL run-2 4-driver V-Dem block (`v2excrptps`, `v2cltort`, `v2xel_frefair`, `v2x_clpol`);
reject on shared-latent-factor collinearity.

Host-testable: only pandas + numpy (no joblib/xgboost/sklearn/scipy needed -- OLS via
`numpy.linalg.lstsq`, matching the project's existing no-scipy-dependency convention for
pure-math modules, e.g. score_pilot.py's own note "pure stdlib... PyYAML... else fallback").
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import d3_vdem_orthogonality as d3  # noqa: E402

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
REAL_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
REAL_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "military_coup" / "positives.csv"


# ============================================================================================
# value_at_year -- pure lookup
# ============================================================================================
def _toy_panel(country: str, years: list[int], values: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"country": [country] * len(years), "year": years, "value": values})


def test_value_at_year_exact_match():
    panel = _toy_panel("Afghanistan", [1970, 1971, 1972], [0.1, 0.2, 0.3])
    assert d3.value_at_year(panel, "Afghanistan", 1971) == pytest.approx(0.2)


def test_value_at_year_missing_returns_none():
    panel = _toy_panel("Afghanistan", [1970, 1972], [0.1, 0.3])
    assert d3.value_at_year(panel, "Afghanistan", 1971) is None  # no exact 1971 row


def test_value_at_year_missing_country_returns_none():
    panel = _toy_panel("Afghanistan", [1970], [0.1])
    assert d3.value_at_year(panel, "Bolivia", 1970) is None


# ============================================================================================
# build_orthogonality_dataset -- assembling the (candidate, 4-block) matrix at year-1 of each
# positive event, complete-case only.
# ============================================================================================
def _toy_positives() -> pd.DataFrame:
    return pd.DataFrame({"country": ["Afghanistan", "Afghanistan", "Bolivia"],
                          "year": [1973, 1978, 1964]})


def test_build_dataset_uses_year_minus_1():
    # candidate + block values only present at year-1 of each event
    panels = {
        "cand": _toy_panel("Afghanistan", [1972, 1977], [1.0, 2.0]),
        "b1": _toy_panel("Afghanistan", [1972, 1977], [0.1, 0.2]),
        "b2": _toy_panel("Afghanistan", [1972, 1977], [0.3, 0.4]),
        "b3": _toy_panel("Afghanistan", [1972, 1977], [0.5, 0.6]),
        "b4": _toy_panel("Afghanistan", [1972, 1977], [0.7, 0.8]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2", "b3", "b4"],
                                        candidate_id="cand")
    assert len(ds) == 2
    assert set(ds["event_year"]) == {1973, 1978}
    row = ds[ds["event_year"] == 1973].iloc[0]
    assert row["cand"] == pytest.approx(1.0)
    assert row["b1"] == pytest.approx(0.1)


def test_build_dataset_drops_incomplete_rows():
    panels = {
        "cand": _toy_panel("Afghanistan", [1972, 1977], [1.0, 2.0]),
        "b1": _toy_panel("Afghanistan", [1972], [0.1]),  # missing at 1977
        "b2": _toy_panel("Afghanistan", [1972, 1977], [0.3, 0.4]),
        "b3": _toy_panel("Afghanistan", [1972, 1977], [0.5, 0.6]),
        "b4": _toy_panel("Afghanistan", [1972, 1977], [0.7, 0.8]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2", "b3", "b4"],
                                        candidate_id="cand")
    assert len(ds) == 1
    assert list(ds["event_year"]) == [1973]  # the 1978 row drops (year-1=1977 missing b1)


def test_build_dataset_no_leakage_uses_strictly_prior_year():
    """The dataset must read year-1 of the EVENT, never the event year itself (the coup
    outcome is not a predictor of itself)."""
    panels = {
        "cand": _toy_panel("Afghanistan", [1973], [999.0]),  # value AT the event year
        "b1": _toy_panel("Afghanistan", [1972], [0.1]),
        "b2": _toy_panel("Afghanistan", [1972], [0.3]),
        "b3": _toy_panel("Afghanistan", [1972], [0.5]),
        "b4": _toy_panel("Afghanistan", [1972], [0.7]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2", "b3", "b4"],
                                        candidate_id="cand")
    # the candidate value at the event year (999.0) must NOT appear -- only year-1 (missing
    # here for "cand"), so this row is correctly dropped as incomplete.
    assert len(ds) == 0


# ============================================================================================
# ols_multiple_r2 -- pure OLS via numpy, no scipy/sklearn.
# ============================================================================================
def test_ols_multiple_r2_perfect_collinearity():
    rng = np.random.default_rng(0)
    x1 = rng.normal(size=200)
    x2 = rng.normal(size=200)
    X = np.column_stack([x1, x2])
    y = 2.0 * x1 - 3.0 * x2 + 1.0  # exact linear combo -> R^2 == 1
    r2, r, _resid, _coef = d3.ols_multiple_r2(y, X)
    assert r2 == pytest.approx(1.0, abs=1e-8)
    assert r == pytest.approx(1.0, abs=1e-8)


def test_ols_multiple_r2_no_relationship():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(500, 4))
    y = rng.normal(size=500)  # independent noise -> R^2 near 0
    r2, r, _resid, _coef = d3.ols_multiple_r2(y, X)
    assert r2 < 0.05


def test_ols_multiple_r2_partial_relationship():
    rng = np.random.default_rng(2)
    X = rng.normal(size=(1000, 4))
    y = 0.5 * X[:, 0] + rng.normal(scale=2.0, size=1000)  # weak signal + noise
    r2, r, resid, _coef = d3.ols_multiple_r2(y, X)
    assert 0.0 < r2 < 0.5
    assert len(resid) == 1000


def test_ols_multiple_r2_residual_orthogonal_to_predictors():
    """Residuals from an OLS fit are (numerically) uncorrelated with every predictor column
    -- the defining property of least-squares residualization."""
    rng = np.random.default_rng(3)
    X = rng.normal(size=(300, 4))
    y = 1.5 * X[:, 1] - 0.7 * X[:, 3] + rng.normal(size=300)
    _r2, _r, resid, _coef = d3.ols_multiple_r2(y, X)
    for col in range(X.shape[1]):
        corr = np.corrcoef(resid, X[:, col])[0, 1]
        assert abs(corr) < 1e-8


# ============================================================================================
# screen_candidate -- verdict logic (reuses the walk's own ABS_R_THRESHOLD=0.85 collinearity
# bar, applied as a MULTIPLE-R against the 4-driver block rather than a pairwise r).
# ============================================================================================
def test_screen_candidate_rejects_above_threshold():
    verdict = d3.d3_verdict(multiple_r=0.90, threshold=0.85)
    assert verdict == "REJECT_COLLINEAR"


def test_screen_candidate_passes_below_threshold():
    verdict = d3.d3_verdict(multiple_r=0.40, threshold=0.85)
    assert verdict == "PASS_ORTHOGONAL"


def test_screen_candidate_boundary_is_reject_inclusive():
    # >= threshold counts as reject (matches stability_select.correlation_dedup's `> abs_r`
    # convention loosely -- here we use >= to be conservative on the mandatory D3 gate)
    verdict = d3.d3_verdict(multiple_r=0.85, threshold=0.85)
    assert verdict == "REJECT_COLLINEAR"


def test_screen_candidate_insufficient_n_is_inconclusive():
    verdict = d3.d3_verdict(multiple_r=0.40, threshold=0.85, n_rows=3, min_n=30)
    assert verdict == "INSUFFICIENT_DATA"


# ============================================================================================
# End-to-end sanity on REAL panel data (host-only: pandas + numpy + pyarrow, no Docker).
# ============================================================================================
RUN2_VDEM_BLOCK = ["v2excrptps", "v2cltort", "v2xel_frefair", "v2x_clpol"]
FIVE_VDEM_CANDIDATES = [
    "v2exl_legitlead", "v2pepwrses", "v2stcritapparm", "v2strenarm", "OWID_AUTOCRATIZATION",
]


@pytest.mark.parametrize("candidate_id", FIVE_VDEM_CANDIDATES)
def test_d3_real_data_produces_a_verdict_for_each_mandated_candidate(candidate_id):
    if not REAL_POSITIVES_CSV.exists() or not REAL_PANEL_DIR.exists():
        pytest.skip("real data files not present in this checkout")
    result = d3.run_d3_for_candidate(
        candidate_id, RUN2_VDEM_BLOCK, REAL_PANEL_DIR, REAL_POSITIVES_CSV,
    )
    assert result["candidate_id"] == candidate_id
    assert result["verdict"] in ("PASS_ORTHOGONAL", "REJECT_COLLINEAR", "INSUFFICIENT_DATA")
    assert 0.0 <= result["r2"] <= 1.0 + 1e-9
    assert result["n_rows"] > 0
