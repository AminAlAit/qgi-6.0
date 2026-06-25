"""Tests for the OWID fetcher transform + shared fetcher base (enrichment stage 2).

Pure logic only — no AWS, no network (the base's AWS clients are lazy and the
requests import is lazy, so importing these modules needs neither).

Covers:
  - base.iso3_map_from_df  (shared, same smoke as UNHCR suite)
  - base.to_canonical_frame (shared)
  - parse_owid_records — OW-01 Polity path (Code / Year / Democracy)
  - parse_owid_records — OW-04 CO2 growth rate path (iso_code / year / co2_growth_prct)
  - parse_owid_records — OW-04 fallback: derive YoY % change from co2 level column
  - aggregate / continent rows dropped (empty Code and OWID_ prefix)
  - unknown ISO-3 codes dropped
  - SPECS dictionary covers OW-01 and OW-04
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# Path wiring — mirrors test_fetch_unhcr.py exactly
# ---------------------------------------------------------------------------
_QGI_PIPELINE = Path(__file__).resolve().parents[3]
_BASE_DIR = _QGI_PIPELINE / "batch" / "_fetcher_base"
_OWID_SRC = _QGI_PIPELINE / "batch" / "indicator-fetcher-owid" / "src"
for _p in (_BASE_DIR, _OWID_SRC):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import qgi_fetcher_base as base  # noqa: E402
import fetch_owid as f  # noqa: E402

# ---------------------------------------------------------------------------
# Shared ISO-3 map used across tests
# ---------------------------------------------------------------------------
ISO3: dict[str, str] = {
    "AFG": "Afghanistan",
    "CHN": "China",
    "BRA": "Brazil",
    "DEU": "Germany",
    "USA": "United States",
}

# ---------------------------------------------------------------------------
# Shared base smoke-tests (same intent as UNHCR suite — confirm imports work)
# ---------------------------------------------------------------------------

def test_iso3_map_from_df_uppercases_and_skips_blanks():
    df = pd.DataFrame({
        "iso_alpha3": ["afg", "USA", "", None],
        "qgi_name": ["Afghanistan", "United States", "Nowhere", "AlsoNowhere"],
    })
    m = base.iso3_map_from_df(df)
    assert m == {"AFG": "Afghanistan", "USA": "United States"}


def test_to_canonical_frame_coerces_dedups_sorts_drops_nan():
    df = pd.DataFrame({
        "country": ["B", "A", "A", "A"],
        "year": ["2001", 2000, 2000, 2002],
        "value": [1.0, 5.0, 9.0, np.nan],
        "extra": [1, 2, 3, 4],
    })
    out = base.to_canonical_frame(df)
    assert list(out.columns) == base.OUTPUT_COLUMNS
    assert out["year"].dtype == np.int64
    assert out["value"].dtype == np.float64
    assert (out["is_predicted"] == False).all()  # noqa: E712
    assert out.to_dict("records") == [
        {"country": "A", "year": 2000, "value": 9.0, "is_predicted": False},
        {"country": "B", "year": 2001, "value": 1.0, "is_predicted": False},
    ]


def test_to_canonical_frame_requires_core_columns():
    with pytest.raises(ValueError):
        base.to_canonical_frame(pd.DataFrame({"country": ["A"], "year": [2000]}))

# ---------------------------------------------------------------------------
# OW-01: Polity V score  (Entity / Code / Year / Democracy columns)
# ---------------------------------------------------------------------------

def _polity_df() -> pd.DataFrame:
    """Synthetic representative payload matching OWID Polity grapher CSV format."""
    return pd.DataFrame({
        "Entity": [
            "Afghanistan", "Afghanistan", "China", "Brazil",
            "Africa (population-weighted)",   # aggregate — no Code
            "Asia",                            # aggregate — OWID_ code
            "Germany", "Germany",
        ],
        "Code": [
            "AFG", "AFG", "CHN", "BRA",
            "",           # empty code -> drop
            "OWID_ASI",   # OWID_ prefix -> drop
            "DEU", "DEU",
        ],
        "Year": [2015, 2016, 2015, 2015, 2015, 2015, 2017, 2018],
        "Democracy": [-1, -1, -7, 8, -6, -7, 10, 10],
    })


def test_parse_owid_polity_maps_iso3_and_drops_aggregates():
    out = f.parse_owid_records(
        raw_df=_polity_df(),
        value_col="Democracy",
        iso3_map=ISO3,
        code_col="Code",
        year_col="Year",
    )
    recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
    # known-good rows
    assert recs[("Afghanistan", 2015)] == -1.0
    assert recs[("Afghanistan", 2016)] == -1.0
    assert recs[("China", 2015)] == -7.0
    assert recs[("Brazil", 2015)] == 8.0
    assert recs[("Germany", 2017)] == 10.0
    assert recs[("Germany", 2018)] == 10.0
    # aggregates must be absent
    countries = {c for c, _ in recs}
    assert "Africa (population-weighted)" not in countries
    assert "Asia" not in countries


def test_parse_owid_polity_drops_unknown_iso3():
    df = pd.DataFrame({
        "Entity": ["Ruritania"],
        "Code": ["RUR"],  # not in ISO3 map
        "Year": [2010],
        "Democracy": [5],
    })
    out = f.parse_owid_records(df, "Democracy", ISO3, code_col="Code", year_col="Year")
    assert len(out) == 0
    assert list(out.columns) == ["country", "year", "value"]


def test_parse_owid_polity_returns_empty_when_all_aggregates():
    df = pd.DataFrame({
        "Entity": ["World", "Asia"],
        "Code": ["OWID_WRL", "OWID_ASI"],
        "Year": [2010, 2010],
        "Democracy": [-3, -4],
    })
    out = f.parse_owid_records(df, "Democracy", ISO3, code_col="Code", year_col="Year")
    assert len(out) == 0


def test_parse_owid_polity_aggregates_duplicate_country_year_by_mean():
    """If a country-year appears twice (shouldn't in Polity but defensive), mean is taken."""
    df = pd.DataFrame({
        "Entity": ["Afghanistan", "Afghanistan"],
        "Code": ["AFG", "AFG"],
        "Year": [2010, 2010],
        "Democracy": [2.0, 4.0],
    })
    out = f.parse_owid_records(df, "Democracy", ISO3, code_col="Code", year_col="Year")
    assert len(out) == 1
    assert out.iloc[0]["value"] == pytest.approx(3.0)

# ---------------------------------------------------------------------------
# OW-04: CO2 growth rate  (country / iso_code / year / co2_growth_prct columns)
# ---------------------------------------------------------------------------

def _co2_df(include_growth_prct: bool = True) -> pd.DataFrame:
    """Synthetic representative payload matching owid-co2-data.csv format."""
    base_data: dict = {
        "country": ["Afghanistan", "China", "Brazil", "Germany", "World", "Asia"],
        "iso_code": ["AFG", "CHN", "BRA", "DEU", "", "OWID_ASI"],
        "year": [2020, 2020, 2020, 2020, 2020, 2020],
        "co2": [10.0, 11000.0, 500.0, 700.0, 37000.0, 15000.0],
        "co2_per_capita": [0.25, 7.7, 2.3, 8.4, 4.7, 3.9],
    }
    if include_growth_prct:
        base_data["co2_growth_prct"] = [3.5, 1.5, -2.0, -5.0, 1.0, 0.5]
    return pd.DataFrame(base_data)


def test_parse_owid_co2_growth_prct_primary_path():
    out = f.parse_owid_records(
        raw_df=_co2_df(include_growth_prct=True),
        value_col="co2_growth_prct",
        iso3_map=ISO3,
        code_col="iso_code",
        year_col="year",
    )
    recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
    assert recs[("Afghanistan", 2020)] == pytest.approx(3.5)
    assert recs[("China", 2020)] == pytest.approx(1.5)
    assert recs[("Brazil", 2020)] == pytest.approx(-2.0)
    assert recs[("Germany", 2020)] == pytest.approx(-5.0)
    # aggregates must be absent
    countries = {c for c, _ in recs}
    assert "World" not in countries
    assert "Asia" not in countries


def test_parse_owid_co2_drops_empty_and_owid_codes():
    out = f.parse_owid_records(
        raw_df=_co2_df(include_growth_prct=True),
        value_col="co2_growth_prct",
        iso3_map=ISO3,
        code_col="iso_code",
        year_col="year",
    )
    # Only 4 real countries in ISO3 map; World (empty code) + Asia (OWID_) dropped
    assert len(out) == 4


def test_parse_owid_co2_fallback_yoy_pct_change_from_level():
    """When co2_growth_prct is absent, derive from the co2 level column."""
    # Build 3-year series for 2 countries (no growth_prct column)
    df = pd.DataFrame({
        "country": ["Afghanistan"] * 3 + ["China"] * 3,
        "iso_code": ["AFG"] * 3 + ["CHN"] * 3,
        "year": [2018, 2019, 2020] * 2,
        "co2": [100.0, 110.0, 121.0,     # AFG: +10%, +10%
                1000.0, 950.0, 902.5],     # CHN: -5%, -5%
        "co2_per_capita": [0.25] * 6,
    })
    # Note: no co2_growth_prct column
    out = f.parse_owid_records(
        raw_df=df,
        value_col="co2_growth_prct",
        iso3_map=ISO3,
        code_col="iso_code",
        year_col="year",
        fallback_level_col="co2",
    )
    recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
    # Year 2018 (first in each group) -> NaN pct_change -> dropped by to_canonical_frame / parse
    assert (2018) not in [yr for _, yr in recs]
    # AFG 2019: (110-100)/100 * 100 = 10%
    assert recs[("Afghanistan", 2019)] == pytest.approx(10.0, rel=1e-5)
    # AFG 2020: (121-110)/110 * 100 ≈ 10%
    assert recs[("Afghanistan", 2020)] == pytest.approx(10.0, rel=1e-5)
    # CHN 2019: (950-1000)/1000 * 100 = -5%
    assert recs[("China", 2019)] == pytest.approx(-5.0, rel=1e-5)
    # CHN 2020: (902.5-950)/950 * 100 = -5%
    assert recs[("China", 2020)] == pytest.approx(-5.0, rel=1e-5)


def test_parse_owid_co2_nan_growth_prct_rows_dropped():
    """Rows with NaN co2_growth_prct are silently dropped (not treated as 0)."""
    df = pd.DataFrame({
        "country": ["Afghanistan", "Afghanistan"],
        "iso_code": ["AFG", "AFG"],
        "year": [1960, 2020],  # 1960 has no GCP data -> NaN growth_prct
        "co2_growth_prct": [np.nan, 3.5],
    })
    out = f.parse_owid_records(
        raw_df=df,
        value_col="co2_growth_prct",
        iso3_map=ISO3,
        code_col="iso_code",
        year_col="year",
    )
    assert len(out) == 1
    assert out.iloc[0]["year"] == 2020
    assert out.iloc[0]["value"] == pytest.approx(3.5)

# ---------------------------------------------------------------------------
# SPECS dict sanity
# ---------------------------------------------------------------------------

def test_specs_covers_ow01_and_ow04():
    assert set(f.SPECS) == {"OW-01", "OW-04"}


def test_specs_ow01_has_correct_columns():
    cfg = f.SPECS["OW-01"]
    assert cfg["code_col"] == "Code"
    assert cfg["year_col"] == "Year"
    assert cfg["value_col"] == "Democracy"


def test_specs_ow04_has_correct_columns_and_fallback():
    cfg = f.SPECS["OW-04"]
    assert cfg["code_col"] == "iso_code"
    assert cfg["year_col"] == "year"
    assert cfg["value_col"] == "co2_growth_prct"
    assert cfg.get("fallback_level_col") == "co2"
