"""Tests for screen_coverage.py -- D1 coverage-at-positive-cells screen
(economic_recession enrichment cycle). Structural port of
`experiments/mass-protest-enrichment/screen_coverage.py` (same t-1 AND t-2 >=80% method) onto
the economic_recession candidates: FD.AST.PRVT.GD.ZS (+accel3), FM.LBL.BMNY.GD.ZS (+decel3),
NE.GDI.TOTL.ZS (flagged sanity check).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import screen_coverage as s  # noqa: E402

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
REAL_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
REAL_DERIVED_PANEL_DIR = HERE / "credit_m2_panel_dir"
REAL_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"


def _toy_panel(country: str, years: list[int], values: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"country": [country] * len(years), "year": years, "value": values})


def _toy_positives() -> pd.DataFrame:
    return pd.DataFrame({"country": ["Chile", "Chile", "Peru"], "year": [1982, 2009, 1990]})


# ============================================================================================
# value_at_year -- pure lookup (verbatim behavior expected).
# ============================================================================================
def test_value_at_year_exact_match():
    panel = _toy_panel("Chile", [1980, 1981], [1.0, 2.0])
    assert s.value_at_year(panel, "Chile", 1981) == pytest.approx(2.0)


def test_value_at_year_missing_returns_none():
    panel = _toy_panel("Chile", [1980], [1.0])
    assert s.value_at_year(panel, "Chile", 1981) is None


def test_value_at_year_null_value_returns_none():
    panel = pd.DataFrame({"country": ["Chile"], "year": [1980], "value": [float("nan")]})
    assert s.value_at_year(panel, "Chile", 1980) is None


# ============================================================================================
# coverage_at_positive_cells_t1_and_t2
# ============================================================================================
def test_coverage_both_years_present():
    panel = _toy_panel("Chile", [1981, 1980], [1.0, 2.0])  # t-1=1981, t-2=1980 for event 1982
    positives = pd.DataFrame({"country": ["Chile"], "year": [1982]})
    out = s.coverage_at_positive_cells_t1_and_t2(panel, positives)
    assert out["n_t1_and_t2_covered"] == 1
    assert out["t1_and_t2_coverage_pct"] == pytest.approx(100.0)


def test_coverage_only_t1_present_does_not_count_as_both():
    panel = _toy_panel("Chile", [1981], [1.0])  # only t-1
    positives = pd.DataFrame({"country": ["Chile"], "year": [1982]})
    out = s.coverage_at_positive_cells_t1_and_t2(panel, positives)
    assert out["n_t1_and_t2_covered"] == 0
    assert out["n_t1_covered"] == 1


def test_coverage_neither_present():
    panel = _toy_panel("Chile", [1970], [1.0])
    positives = pd.DataFrame({"country": ["Chile"], "year": [1982]})
    out = s.coverage_at_positive_cells_t1_and_t2(panel, positives)
    assert out["n_t1_and_t2_covered"] == 0
    assert out["t1_and_t2_coverage_pct"] == pytest.approx(0.0)


# ============================================================================================
# d1_verdict
# ============================================================================================
def test_d1_verdict_pass_at_threshold():
    assert s.d1_verdict(80.0, threshold=0.80) == "PASS_COVERAGE"


def test_d1_verdict_fail_below_threshold():
    assert s.d1_verdict(79.9, threshold=0.80) == "FAIL_COVERAGE"


# ============================================================================================
# screen_candidate -- orchestration on toy panel_dir layout.
# ============================================================================================
def test_screen_candidate_missing_panel_reports_missing(tmp_path):
    positives = _toy_positives()
    out = s.screen_candidate("NOT.A.REAL.INDICATOR", tmp_path, positives)
    assert out["verdict"] == "MISSING_PANEL"


def test_screen_candidate_writes_pass_verdict(tmp_path):
    ind_dir = tmp_path / "FAKE.IND"
    ind_dir.mkdir(parents=True)
    years = list(range(1975, 2015))
    df = _toy_panel("Chile", years, [1.0] * len(years))
    df2 = _toy_panel("Peru", years, [1.0] * len(years))
    pd.concat([df, df2], ignore_index=True).to_parquet(ind_dir / "FAKE.IND.parquet")
    out = s.screen_candidate("FAKE.IND", tmp_path, _toy_positives())
    assert out["verdict"] == "PASS_COVERAGE"


# ============================================================================================
# End-to-end sanity on REAL panel data (host-only, no Docker).
# ============================================================================================
@pytest.mark.parametrize("indicator_id,panel_dir", [
    ("FD.AST.PRVT.GD.ZS", None),
    ("FM.LBL.BMNY.GD.ZS", None),
    ("NE.GDI.TOTL.ZS", None),
    ("FD.AST.PRVT.GD.ZS__accel3", "derived"),
    ("FM.LBL.BMNY.GD.ZS__decel3", "derived"),
])
def test_real_candidate_produces_a_verdict(indicator_id, panel_dir):
    src_dir = REAL_DERIVED_PANEL_DIR if panel_dir == "derived" else REAL_PANEL_DIR
    panel_path = src_dir / indicator_id / f"{indicator_id}.parquet"
    if not panel_path.is_file() or not REAL_POSITIVES_CSV.exists():
        pytest.skip("real data files not present in this checkout")
    positives = s._load_positives(REAL_POSITIVES_CSV)
    out = s.screen_candidate(indicator_id, src_dir, positives)
    assert out["verdict"] in ("PASS_COVERAGE", "FAIL_COVERAGE", "MISSING_PANEL")
