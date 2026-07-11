"""Tests for d3_vdem_orthogonality.py -- D3 (MANDATORY) from PRE-REGISTRATION.md
(mass_protest enrichment cycle, committed 7cdfb5f): residualize/partial-correlation
`v2x_regime` against run-2's 2-driver V-Dem block (`v2excrptps`, `v2csprtcpt`); reject on
shared-latent-factor collinearity.

Host-testable: only pandas + numpy (no joblib/xgboost/sklearn/scipy needed -- OLS via
`numpy.linalg.lstsq`).
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
REAL_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "mass_protest" / "positives.csv"


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
    assert d3.value_at_year(panel, "Afghanistan", 1971) is None


def test_value_at_year_missing_country_returns_none():
    panel = _toy_panel("Afghanistan", [1970], [0.1])
    assert d3.value_at_year(panel, "Bolivia", 1970) is None


# ============================================================================================
# build_orthogonality_dataset -- assembling the (candidate, 2-block) matrix at year-1 of each
# positive event, complete-case only.
# ============================================================================================
def _toy_positives() -> pd.DataFrame:
    return pd.DataFrame({"country": ["Afghanistan", "Afghanistan", "Bolivia"],
                          "year": [1965, 2012, 1964]})


def test_build_dataset_uses_year_minus_1():
    panels = {
        "cand": _toy_panel("Afghanistan", [1964, 2011], [1.0, 2.0]),
        "b1": _toy_panel("Afghanistan", [1964, 2011], [0.1, 0.2]),
        "b2": _toy_panel("Afghanistan", [1964, 2011], [0.3, 0.4]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2"], candidate_id="cand")
    assert len(ds) == 2
    assert set(ds["event_year"]) == {1965, 2012}
    row = ds[ds["event_year"] == 1965].iloc[0]
    assert row["cand"] == pytest.approx(1.0)
    assert row["b1"] == pytest.approx(0.1)


def test_build_dataset_drops_incomplete_rows():
    panels = {
        "cand": _toy_panel("Afghanistan", [1964, 2011], [1.0, 2.0]),
        "b1": _toy_panel("Afghanistan", [1964], [0.1]),  # missing at 2011
        "b2": _toy_panel("Afghanistan", [1964, 2011], [0.3, 0.4]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2"], candidate_id="cand")
    assert len(ds) == 1
    assert list(ds["event_year"]) == [1965]  # the 2012 row drops (year-1=2011 missing b1)


def test_build_dataset_no_leakage_uses_strictly_prior_year():
    """The dataset must read year-1 of the EVENT, never the event year itself (the mass-protest
    outcome is not a predictor of itself)."""
    panels = {
        "cand": _toy_panel("Afghanistan", [1965], [999.0]),  # value AT the event year
        "b1": _toy_panel("Afghanistan", [1964], [0.1]),
        "b2": _toy_panel("Afghanistan", [1964], [0.3]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2"], candidate_id="cand")
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
    X = rng.normal(size=(500, 2))
    y = rng.normal(size=500)  # independent noise -> R^2 near 0
    r2, r, _resid, _coef = d3.ols_multiple_r2(y, X)
    assert r2 < 0.05


def test_ols_multiple_r2_partial_relationship():
    rng = np.random.default_rng(2)
    X = rng.normal(size=(1000, 2))
    y = 0.5 * X[:, 0] + rng.normal(scale=2.0, size=1000)  # weak signal + noise
    r2, r, resid, _coef = d3.ols_multiple_r2(y, X)
    assert 0.0 < r2 < 0.5
    assert len(resid) == 1000


def test_ols_multiple_r2_residual_orthogonal_to_predictors():
    """Residuals from an OLS fit are (numerically) uncorrelated with every predictor column
    -- the defining property of least-squares residualization."""
    rng = np.random.default_rng(3)
    X = rng.normal(size=(300, 2))
    y = 1.5 * X[:, 1] - 0.7 * X[:, 0] + rng.normal(size=300)
    _r2, _r, resid, _coef = d3.ols_multiple_r2(y, X)
    for col in range(X.shape[1]):
        corr = np.corrcoef(resid, X[:, col])[0, 1]
        assert abs(corr) < 1e-8


# ============================================================================================
# d3_verdict -- verdict logic (reuses the walk's own ABS_R_THRESHOLD=0.85 collinearity bar,
# applied as a MULTIPLE-R against the 2-driver block rather than a pairwise r).
# ============================================================================================
def test_d3_verdict_rejects_above_threshold():
    verdict = d3.d3_verdict(multiple_r=0.90, threshold=0.85)
    assert verdict == "REJECT_COLLINEAR"


def test_d3_verdict_passes_below_threshold():
    verdict = d3.d3_verdict(multiple_r=0.40, threshold=0.85)
    assert verdict == "PASS_ORTHOGONAL"


def test_d3_verdict_boundary_is_reject_inclusive():
    verdict = d3.d3_verdict(multiple_r=0.85, threshold=0.85)
    assert verdict == "REJECT_COLLINEAR"


def test_d3_verdict_insufficient_n_is_inconclusive():
    verdict = d3.d3_verdict(multiple_r=0.40, threshold=0.85, n_rows=3, min_n=30)
    assert verdict == "INSUFFICIENT_DATA"


# ============================================================================================
# End-to-end sanity on REAL panel data (host-only: pandas + numpy + pyarrow, no Docker).
# ============================================================================================
def test_d3_real_data_produces_a_verdict_for_v2x_regime():
    if not REAL_POSITIVES_CSV.exists() or not REAL_PANEL_DIR.exists():
        pytest.skip("real data files not present in this checkout")
    result = d3.run_d3_for_candidate(
        "v2x_regime", d3.RUN2_VDEM_BLOCK, REAL_PANEL_DIR, REAL_POSITIVES_CSV,
    )
    assert result["candidate_id"] == "v2x_regime"
    assert result["verdict"] in ("PASS_ORTHOGONAL", "REJECT_COLLINEAR", "INSUFFICIENT_DATA")
    assert 0.0 <= result["r2"] <= 1.0 + 1e-9
    assert result["n_rows"] > 0
