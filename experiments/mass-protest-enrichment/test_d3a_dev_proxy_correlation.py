"""Tests for d3a_dev_proxy_correlation.py -- D3a (MANDATORY) from PRE-REGISTRATION.md
(mass_protest enrichment cycle, committed 7cdfb5f): OWID_POP_YOUNG's development-proxy
correlation vs NY.GNP.PCAP.CD, tested as level AND YoY first-difference.

Host-testable: pandas + numpy only.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import d3a_dev_proxy_correlation as d3a  # noqa: E402

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
REAL_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
REAL_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "mass_protest" / "positives.csv"


def _toy_panel(country: str, years: list[int], values: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"country": [country] * len(years), "year": years, "value": values})


# ============================================================================================
# value_at_year -- pure lookup (shared convention across the enrichment cycle's modules)
# ============================================================================================
def test_value_at_year_exact_match():
    panel = _toy_panel("Afghanistan", [1970, 1971], [0.1, 0.2])
    assert d3a.value_at_year(panel, "Afghanistan", 1971) == pytest.approx(0.2)


def test_value_at_year_missing_returns_none():
    panel = _toy_panel("Afghanistan", [1970, 1972], [0.1, 0.3])
    assert d3a.value_at_year(panel, "Afghanistan", 1971) is None


# ============================================================================================
# pearson_r -- pure numpy
# ============================================================================================
def test_pearson_r_perfect_positive():
    x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    y = np.array([2.0, 4.0, 6.0, 8.0, 10.0])
    assert d3a.pearson_r(x, y) == pytest.approx(1.0)


def test_pearson_r_perfect_negative():
    x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    y = np.array([5.0, 4.0, 3.0, 2.0, 1.0])
    assert d3a.pearson_r(x, y) == pytest.approx(-1.0)


def test_pearson_r_no_relationship():
    rng = np.random.default_rng(0)
    x = rng.normal(size=1000)
    y = rng.normal(size=1000)
    assert abs(d3a.pearson_r(x, y)) < 0.1


def test_pearson_r_degenerate_zero_variance_returns_nan():
    x = np.array([5.0, 5.0, 5.0])
    y = np.array([1.0, 2.0, 3.0])
    assert d3a.pearson_r(x, y) != d3a.pearson_r(x, y) or np.isnan(d3a.pearson_r(x, y))


# ============================================================================================
# build_level_dataset -- t-1 lookup, complete-case
# ============================================================================================
def _toy_positives() -> pd.DataFrame:
    return pd.DataFrame({"country": ["Afghanistan", "Afghanistan", "Bolivia"],
                          "year": [1965, 2012, 1964]})


def test_build_level_dataset_uses_year_minus_1():
    cand = _toy_panel("Afghanistan", [1964, 2011], [30.0, 25.0])
    proxy = _toy_panel("Afghanistan", [1964, 2011], [500.0, 700.0])
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3a.build_level_dataset(pos, cand, proxy)
    assert len(ds) == 2
    row = ds[ds["event_year"] == 1965].iloc[0]
    assert row["candidate"] == pytest.approx(30.0)
    assert row["proxy"] == pytest.approx(500.0)


def test_build_level_dataset_no_leakage_excludes_event_year_itself():
    cand = _toy_panel("Afghanistan", [1965], [999.0])  # value AT the event year only
    proxy = _toy_panel("Afghanistan", [1964], [500.0])
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3a.build_level_dataset(pos, cand, proxy)
    # candidate missing at t-1=1964 -> row dropped; the event-year value (999.0) never appears
    assert len(ds) == 0


def test_build_level_dataset_drops_incomplete_rows():
    cand = _toy_panel("Afghanistan", [1964, 2011], [30.0, 25.0])
    proxy = _toy_panel("Afghanistan", [1964], [500.0])  # missing at 2011
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3a.build_level_dataset(pos, cand, proxy)
    assert len(ds) == 1
    assert list(ds["event_year"]) == [1965]


# ============================================================================================
# build_yoy_dataset -- t-1 minus t-2 first-difference, complete-case on all 4 raw values
# ============================================================================================
def test_build_yoy_dataset_computes_first_difference():
    cand = _toy_panel("Afghanistan", [1963, 1964], [28.0, 30.0])
    proxy = _toy_panel("Afghanistan", [1963, 1964], [480.0, 500.0])
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3a.build_yoy_dataset(pos, cand, proxy)
    assert len(ds) == 1  # only the 1965 event has both t-1=1964 and t-2=1963
    row = ds.iloc[0]
    assert row["candidate_yoy"] == pytest.approx(30.0 - 28.0)
    assert row["proxy_yoy"] == pytest.approx(500.0 - 480.0)


def test_build_yoy_dataset_requires_all_four_values():
    cand = _toy_panel("Afghanistan", [1964], [30.0])  # missing 1963 (t-2)
    proxy = _toy_panel("Afghanistan", [1963, 1964], [480.0, 500.0])
    pos = _toy_positives()[lambda d: d["country"] == "Afghanistan"]
    ds = d3a.build_yoy_dataset(pos, cand, proxy)
    assert len(ds) == 0


# ============================================================================================
# d3a_verdict
# ============================================================================================
def test_d3a_verdict_passes_when_both_below_threshold():
    assert d3a.d3a_verdict(r_level=0.2, r_yoy=0.1, threshold=0.5) == "PASS_ORTHOGONAL"


def test_d3a_verdict_rejects_when_level_exceeds_threshold():
    assert d3a.d3a_verdict(r_level=-0.7, r_yoy=0.1, threshold=0.5) == "REJECT_PROXY_CONFOUND"


def test_d3a_verdict_rejects_when_yoy_exceeds_threshold():
    assert d3a.d3a_verdict(r_level=0.1, r_yoy=0.6, threshold=0.5) == "REJECT_PROXY_CONFOUND"


def test_d3a_verdict_boundary_is_reject_inclusive():
    assert d3a.d3a_verdict(r_level=0.5, r_yoy=0.1, threshold=0.5) == "REJECT_PROXY_CONFOUND"


def test_d3a_verdict_insufficient_n():
    assert d3a.d3a_verdict(
        r_level=0.1, r_yoy=0.1, threshold=0.5, n_level=5, n_yoy=5, min_n=30
    ) == "INSUFFICIENT_DATA"


def test_d3a_verdict_nan_correlation_is_insufficient_data():
    assert d3a.d3a_verdict(r_level=float("nan"), r_yoy=0.1, threshold=0.5) == "INSUFFICIENT_DATA"


# ============================================================================================
# End-to-end sanity on REAL panel data (host-only: pandas + numpy + pyarrow, no Docker).
# ============================================================================================
def test_d3a_real_data_produces_a_verdict():
    if not REAL_POSITIVES_CSV.exists() or not REAL_PANEL_DIR.exists():
        pytest.skip("real data files not present in this checkout")
    result = d3a.run_d3a(panel_dir=REAL_PANEL_DIR, positives_csv=REAL_POSITIVES_CSV, out_path=None)
    assert result["candidate_id"] == "OWID_POP_YOUNG"
    assert result["dev_proxy_id"] == "NY.GNP.PCAP.CD"
    assert result["verdict"] in ("PASS_ORTHOGONAL", "REJECT_PROXY_CONFOUND", "INSUFFICIENT_DATA")
    assert result["level"]["n_rows"] > 0
    assert result["yoy_first_diff"]["n_rows"] > 0
