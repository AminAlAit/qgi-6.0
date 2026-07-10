"""Tests for d3_orthogonality_income_proxy.py -- D3 orthogonality (vs run-2 drivers) +
income-proxy screen (economic_recession enrichment cycle).

Per PRE-REGISTRATION.md (committed 703e440): "D3 orthogonality/income-proxy (run on
FD.AST.PRVT.GD.ZS FIRST given its 0.36 correlation)". Two sub-checks, BOTH must pass:
  (a) orthogonality vs run-2's drivers (`v2csreprss`, `v2x_freexp_altinf`) -- OLS multiple-R,
      same method as `experiments/mass-protest-enrichment/d3_vdem_orthogonality.py`.
  (b) income-proxy correlation vs `NY.GNP.PCAP.CD` (level AND YoY first-difference), same
      method as `experiments/mass-protest-enrichment/d3a_dev_proxy_correlation.py`.

Host-testable: pandas + numpy only (no scipy/sklearn/ML stack).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import d3_orthogonality_income_proxy as d3  # noqa: E402

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
REAL_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
REAL_DERIVED_PANEL_DIR = HERE / "credit_m2_panel_dir"
REAL_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"


def _toy_panel(country: str, years: list[int], values: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"country": [country] * len(years), "year": years, "value": values})


def _toy_positives() -> pd.DataFrame:
    return pd.DataFrame({"country": ["Chile", "Chile", "Bolivia"], "year": [1965, 2012, 1964]})


# ============================================================================================
# value_at_year -- pure lookup.
# ============================================================================================
def test_value_at_year_exact_match():
    panel = _toy_panel("Chile", [1970, 1971], [0.1, 0.2])
    assert d3.value_at_year(panel, "Chile", 1971) == pytest.approx(0.2)


def test_value_at_year_missing_returns_none():
    panel = _toy_panel("Chile", [1970], [0.1])
    assert d3.value_at_year(panel, "Chile", 1971) is None


# ============================================================================================
# ols_multiple_r2 -- pure OLS via numpy (verbatim method to d3_vdem_orthogonality's).
# ============================================================================================
def test_ols_multiple_r2_perfect_collinearity():
    rng = np.random.default_rng(0)
    x1 = rng.normal(size=200)
    x2 = rng.normal(size=200)
    X = np.column_stack([x1, x2])
    y = 2.0 * x1 - 3.0 * x2 + 1.0
    r2, r, _resid, _coef = d3.ols_multiple_r2(y, X)
    assert r2 == pytest.approx(1.0, abs=1e-8)
    assert r == pytest.approx(1.0, abs=1e-8)


def test_ols_multiple_r2_no_relationship():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(500, 2))
    y = rng.normal(size=500)
    r2, _r, _resid, _coef = d3.ols_multiple_r2(y, X)
    assert r2 < 0.05


# ============================================================================================
# pearson_r
# ============================================================================================
def test_pearson_r_perfect_positive():
    x = np.array([1.0, 2.0, 3.0, 4.0])
    y = np.array([2.0, 4.0, 6.0, 8.0])
    assert d3.pearson_r(x, y) == pytest.approx(1.0)


def test_pearson_r_degenerate_zero_variance_is_nan():
    x = np.array([1.0, 1.0, 1.0])
    y = np.array([1.0, 2.0, 3.0])
    assert d3.pearson_r(x, y) != d3.pearson_r(x, y)  # NaN != NaN


# ============================================================================================
# build_orthogonality_dataset -- year-1 lookups vs run-2 block, complete-case.
# ============================================================================================
def test_build_orthogonality_dataset_uses_year_minus_1():
    panels = {
        "cand": _toy_panel("Chile", [1964, 2011], [1.0, 2.0]),
        "b1": _toy_panel("Chile", [1964, 2011], [0.1, 0.2]),
        "b2": _toy_panel("Chile", [1964, 2011], [0.3, 0.4]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Chile"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2"], candidate_id="cand")
    assert len(ds) == 2
    assert set(ds["event_year"]) == {1965, 2012}


def test_build_orthogonality_dataset_drops_incomplete_rows():
    panels = {
        "cand": _toy_panel("Chile", [1964, 2011], [1.0, 2.0]),
        "b1": _toy_panel("Chile", [1964], [0.1]),  # missing at 2011
        "b2": _toy_panel("Chile", [1964, 2011], [0.3, 0.4]),
    }
    pos = _toy_positives()[lambda d: d["country"] == "Chile"]
    ds = d3.build_orthogonality_dataset(pos, panels, block_ids=["b1", "b2"], candidate_id="cand")
    assert len(ds) == 1
    assert list(ds["event_year"]) == [1965]


# ============================================================================================
# build_level_dataset / build_yoy_dataset -- income-proxy dataset assembly.
# ============================================================================================
def test_build_level_dataset_uses_year_minus_1():
    panels_cand = _toy_panel("Chile", [1964], [10.0])
    panels_proxy = _toy_panel("Chile", [1964], [5000.0])
    pos = _toy_positives()[lambda d: d["country"] == "Chile"][lambda d: d["year"] == 1965]
    ds = d3.build_level_dataset(pos, panels_cand, panels_proxy)
    assert len(ds) == 1
    assert ds.iloc[0]["candidate"] == pytest.approx(10.0)
    assert ds.iloc[0]["proxy"] == pytest.approx(5000.0)


def test_build_yoy_dataset_needs_both_years_for_both_series():
    panels_cand = _toy_panel("Chile", [1963, 1964], [9.0, 10.0])
    panels_proxy = _toy_panel("Chile", [1964], [5000.0])  # missing 1963
    pos = _toy_positives()[lambda d: d["country"] == "Chile"][lambda d: d["year"] == 1965]
    ds = d3.build_yoy_dataset(pos, panels_cand, panels_proxy)
    assert len(ds) == 0  # proxy missing t-2 -> incomplete


# ============================================================================================
# Verdict logic -- BOTH sub-checks must pass.
# ============================================================================================
def test_d3_verdict_passes_when_both_orthogonal():
    v = d3.d3_verdict(multiple_r=0.30, r_level=0.10, r_yoy=0.05, n_ortho=50, n_level=50, n_yoy=50)
    assert v == "PASS_ORTHOGONAL"


def test_d3_verdict_rejects_on_run2_collinearity():
    v = d3.d3_verdict(multiple_r=0.90, r_level=0.10, r_yoy=0.05, n_ortho=50, n_level=50, n_yoy=50)
    assert v == "REJECT_COLLINEAR_RUN2"


def test_d3_verdict_rejects_on_income_proxy_level():
    v = d3.d3_verdict(multiple_r=0.30, r_level=0.60, r_yoy=0.05, n_ortho=50, n_level=50, n_yoy=50)
    assert v == "REJECT_PROXY_CONFOUND"


def test_d3_verdict_rejects_on_income_proxy_yoy():
    v = d3.d3_verdict(multiple_r=0.30, r_level=0.10, r_yoy=0.60, n_ortho=50, n_level=50, n_yoy=50)
    assert v == "REJECT_PROXY_CONFOUND"


def test_d3_verdict_run2_collinearity_checked_before_proxy():
    """When BOTH sub-checks would reject, the run-2-collinearity reject takes precedence
    (checked first) -- an arbitrary-but-documented, deterministic tie-break."""
    v = d3.d3_verdict(multiple_r=0.90, r_level=0.60, r_yoy=0.05, n_ortho=50, n_level=50, n_yoy=50)
    assert v == "REJECT_COLLINEAR_RUN2"


def test_d3_verdict_insufficient_data():
    v = d3.d3_verdict(multiple_r=0.30, r_level=0.10, r_yoy=0.05, n_ortho=3, n_level=50, n_yoy=50, min_n=30)
    assert v == "INSUFFICIENT_DATA"


# ============================================================================================
# End-to-end sanity on REAL panel data (host-only, no Docker).
# ============================================================================================
@pytest.mark.parametrize("indicator_id,panel_dir", [
    (d3.CREDIT_INDICATOR_ID, None),
    (d3.M2_INDICATOR_ID, None),
    (d3.CREDIT_ACCEL_ID, "derived"),
    (d3.M2_DECEL_ID, "derived"),
])
def test_real_candidate_produces_a_verdict(indicator_id, panel_dir):
    src_dir = REAL_DERIVED_PANEL_DIR if panel_dir == "derived" else REAL_PANEL_DIR
    panel_path = src_dir / indicator_id / f"{indicator_id}.parquet"
    if not panel_path.is_file() or not REAL_POSITIVES_CSV.exists():
        pytest.skip("real data files not present in this checkout")
    out = d3.run_d3_for_candidate(
        indicator_id, panel_dir=src_dir, positives_csv=REAL_POSITIVES_CSV,
        main_panel_dir=REAL_PANEL_DIR,
    )
    assert out["verdict"] in ("PASS_ORTHOGONAL", "REJECT_COLLINEAR_RUN2",
                               "REJECT_PROXY_CONFOUND", "INSUFFICIENT_DATA")
