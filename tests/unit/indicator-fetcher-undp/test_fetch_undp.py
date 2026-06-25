"""Tests for the UNDP HDR bulk-CSV fetcher (enrichment stage 2).

Pure logic only — no AWS, no network.  The base's AWS clients are lazy and the
UNDP HTTP call is a lazy requests import inside _load_wide_df(), so neither the
base nor fetch_undp imports require credentials or internet access.

Synthetic payload mirrors the real HDR25 wide CSV structure:
    iso3, country, hdi_1990, hdi_2022, ihdi_2010, gii_1995, mys_2000, eys_2000,
    gdi_2000, (and no mpi_ columns — matching production reality).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

_QGI_PIPELINE = Path(__file__).resolve().parents[3]
_BASE_DIR = _QGI_PIPELINE / "batch" / "_fetcher_base"
_UNDP_SRC = _QGI_PIPELINE / "batch" / "indicator-fetcher-undp" / "src"
for _p in (_BASE_DIR, _UNDP_SRC):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import qgi_fetcher_base as base  # noqa: E402
import fetch_undp as f  # noqa: E402


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

ISO3 = {
    "AFG": "Afghanistan",
    "NOR": "Norway",
    "BRA": "Brazil",
    "DEU": "Germany",
}


def _make_wide_df() -> pd.DataFrame:
    """Synthetic wide CSV that mirrors the real HDR25 CSV structure."""
    return pd.DataFrame({
        "iso3":     ["AFG", "NOR", "BRA", "ZZZ", "DEU"],   # ZZZ = unknown
        "country":  ["Afghanistan", "Norway", "Brazil", "Unknown Territory", "Germany"],
        # HDI columns
        "hdi_1990": [0.295, 0.847, 0.603, 0.500, 0.801],
        "hdi_2022": [0.462, 0.966, 0.760, 0.600, 0.950],
        # Gender-disaggregated HDI — should be EXCLUDED from UD-01 parse
        "hdi_f_1990": [0.250, 0.840, 0.580, None, 0.790],
        "hdi_m_1990": [0.330, 0.854, 0.620, None, 0.812],
        # IHDI (only later years have data)
        "ihdi_2010": [0.340, 0.880, 0.570, None, 0.860],
        "ihdi_2022": [0.389, 0.904, 0.583, None, 0.880],
        # GII
        "gii_1995": [0.650, 0.060, 0.407, 0.300, 0.041],
        "gii_2022": [0.655, 0.020, 0.337, 0.250, 0.055],
        # MYS
        "mys_2000": [2.0, 11.8, 6.4, None, 13.2],
        "mys_2022": [3.9, 13.0, 8.1, None, 14.1],
        # EYS
        "eys_2000": [7.1, 16.0, 14.2, None, 15.8],
        "eys_2022": [9.8, 18.1, 15.7, None, 17.0],
        # GDI
        "gdi_2000": [0.620, 0.990, 0.950, None, 0.980],
        "gdi_2022": [0.680, 0.993, 0.972, None, 0.985],
        # NOTE: no mpi_ columns — matches production HDR25 CSV reality
    })


# ---------------------------------------------------------------------------
# Tests: parse_undp_wide — HDI (UD-01 prefix "hdi_")
# ---------------------------------------------------------------------------

class TestParseUndpWideHdi:
    def test_basic_melt_and_iso3_resolution(self):
        wide = _make_wide_df()
        out = f.parse_undp_wide(wide, "hdi_", ISO3)
        assert list(out.columns) == ["country", "year", "value"]
        # 4 resolvable ISO3 x 2 years = 8 rows (ZZZ dropped)
        assert len(out) == 8

    def test_values_are_correct(self):
        out = f.parse_undp_wide(_make_wide_df(), "hdi_", ISO3)
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert recs[("Afghanistan", 1990)] == pytest.approx(0.295)
        assert recs[("Norway", 2022)] == pytest.approx(0.966)
        assert recs[("Brazil", 1990)] == pytest.approx(0.603)
        assert recs[("Germany", 2022)] == pytest.approx(0.950)

    def test_gender_disaggregated_columns_excluded(self):
        """hdi_f_* and hdi_m_* must NOT appear as years (their suffix isn't purely numeric)."""
        out = f.parse_undp_wide(_make_wide_df(), "hdi_", ISO3)
        assert set(out["year"].unique()) == {1990, 2022}

    def test_unknown_iso3_dropped(self):
        out = f.parse_undp_wide(_make_wide_df(), "hdi_", ISO3)
        assert "Unknown Territory" not in out["country"].values
        assert all(c in ISO3.values() for c in out["country"].unique())


# ---------------------------------------------------------------------------
# Tests: parse_undp_wide — IHDI (UD-02 prefix "ihdi_")
# ---------------------------------------------------------------------------

class TestParseUndpWideIhdi:
    def test_ihdi_rows_parsed(self):
        out = f.parse_undp_wide(_make_wide_df(), "ihdi_", ISO3)
        assert len(out) == 8   # 4 countries x 2 years
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert recs[("Norway", 2022)] == pytest.approx(0.904)
        assert recs[("Afghanistan", 2010)] == pytest.approx(0.340)


# ---------------------------------------------------------------------------
# Tests: parse_undp_wide — GII (UD-03 prefix "gii_")
# ---------------------------------------------------------------------------

class TestParseUndpWideGii:
    def test_gii_values(self):
        out = f.parse_undp_wide(_make_wide_df(), "gii_", ISO3)
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert recs[("Norway", 1995)] == pytest.approx(0.060)
        assert recs[("Afghanistan", 2022)] == pytest.approx(0.655)


# ---------------------------------------------------------------------------
# Tests: parse_undp_wide — MPI absent (UD-04 scaffolded)
# ---------------------------------------------------------------------------

class TestParseUndpWideMpi:
    def test_mpi_prefix_absent_returns_empty(self):
        """HDR25 CSV has no mpi_ columns; should return empty frame gracefully."""
        out = f.parse_undp_wide(_make_wide_df(), "mpi_", ISO3)
        assert list(out.columns) == ["country", "year", "value"]
        assert len(out) == 0

    def test_mpi_prefix_present_if_future_csv_added(self):
        """Verify parse logic works if mpi_ columns appear in a future CSV."""
        wide = _make_wide_df().copy()
        wide["mpi_2015"] = [0.30, 0.01, 0.02, 0.40, 0.005]
        wide["mpi_2020"] = [0.28, np.nan, 0.02, 0.38, 0.004]
        out = f.parse_undp_wide(wide, "mpi_", ISO3)
        assert "mpi_2015" not in out.columns   # melted into year/value
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert recs[("Afghanistan", 2015)] == pytest.approx(0.30)
        # NaN rows dropped (Norway 2020)
        assert ("Norway", 2020) not in recs


# ---------------------------------------------------------------------------
# Tests: parse_undp_wide — MYS (UD-05) and EYS (UD-06)
# ---------------------------------------------------------------------------

class TestParseUndpWideMysEys:
    def test_mys_values(self):
        out = f.parse_undp_wide(_make_wide_df(), "mys_", ISO3)
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert recs[("Germany", 2022)] == pytest.approx(14.1)
        assert recs[("Afghanistan", 2000)] == pytest.approx(2.0)

    def test_eys_values(self):
        out = f.parse_undp_wide(_make_wide_df(), "eys_", ISO3)
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert recs[("Norway", 2022)] == pytest.approx(18.1)
        assert recs[("Brazil", 2000)] == pytest.approx(14.2)


# ---------------------------------------------------------------------------
# Tests: parse_undp_wide — GDI (UD-07)
# ---------------------------------------------------------------------------

class TestParseUndpWideGdi:
    def test_gdi_values(self):
        out = f.parse_undp_wide(_make_wide_df(), "gdi_", ISO3)
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert recs[("Norway", 2022)] == pytest.approx(0.993)
        assert recs[("Afghanistan", 2000)] == pytest.approx(0.620)


# ---------------------------------------------------------------------------
# Tests: edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_nan_values_dropped(self):
        """NaN values in value columns should not appear in output."""
        wide = _make_wide_df().copy()
        wide.loc[wide["iso3"] == "NOR", "hdi_1990"] = np.nan
        out = f.parse_undp_wide(wide, "hdi_", ISO3)
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert ("Norway", 1990) not in recs
        assert ("Norway", 2022) in recs   # other year still present

    def test_non_numeric_value_coerced_to_nan_and_dropped(self):
        wide = _make_wide_df().copy()
        wide.loc[wide["iso3"] == "BRA", "hdi_1990"] = "n.a."
        out = f.parse_undp_wide(wide, "hdi_", ISO3)
        recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
        assert ("Brazil", 1990) not in recs

    def test_empty_wide_df_returns_empty(self):
        empty = pd.DataFrame(columns=_make_wide_df().columns)
        out = f.parse_undp_wide(empty, "hdi_", ISO3)
        assert list(out.columns) == ["country", "year", "value"]
        assert len(out) == 0

    def test_all_unknown_iso3_returns_empty(self):
        wide = _make_wide_df().copy()
        wide["iso3"] = ["ZZZ", "ZZA", "ZZB", "ZZC", "ZZD"]
        out = f.parse_undp_wide(wide, "hdi_", ISO3)
        assert len(out) == 0

    def test_deduplication_via_mean(self):
        """Duplicate (iso3, year) rows after melt should be averaged."""
        wide = pd.DataFrame({
            "iso3": ["NOR", "NOR"],
            "country": ["Norway", "Norway"],
            "hdi_2000": [0.80, 0.90],   # two rows for same country + year
        })
        out = f.parse_undp_wide(wide, "hdi_", ISO3)
        assert len(out) == 1
        assert out.iloc[0]["value"] == pytest.approx(0.85)

    def test_output_columns_exactly(self):
        out = f.parse_undp_wide(_make_wide_df(), "hdi_", ISO3)
        assert list(out.columns) == ["country", "year", "value"]


# ---------------------------------------------------------------------------
# Tests: INDICATOR_PREFIX catalog covers all 7 specs
# ---------------------------------------------------------------------------

class TestIndicatorCatalog:
    def test_all_seven_indicators_wired(self):
        expected = {"UD-01", "UD-02", "UD-03", "UD-04", "UD-05", "UD-06", "UD-07"}
        assert set(f.INDICATOR_PREFIX) == expected

    def test_known_prefixes(self):
        assert f.INDICATOR_PREFIX["UD-01"] == "hdi_"
        assert f.INDICATOR_PREFIX["UD-02"] == "ihdi_"
        assert f.INDICATOR_PREFIX["UD-03"] == "gii_"
        assert f.INDICATOR_PREFIX["UD-04"] == "mpi_"
        assert f.INDICATOR_PREFIX["UD-05"] == "mys_"
        assert f.INDICATOR_PREFIX["UD-06"] == "eys_"
        assert f.INDICATOR_PREFIX["UD-07"] == "gdi_"


# ---------------------------------------------------------------------------
# Tests: shared base functions (re-verified here for completeness)
# ---------------------------------------------------------------------------

class TestSharedBase:
    def test_iso3_map_from_df_uppercases_and_skips_blanks(self):
        df = pd.DataFrame({
            "iso_alpha3": ["afg", "USA", "", None],
            "qgi_name":  ["Afghanistan", "United States", "Nowhere", "AlsoNowhere"],
        })
        m = base.iso3_map_from_df(df)
        assert m == {"AFG": "Afghanistan", "USA": "United States"}

    def test_to_canonical_frame_coerces_dedups_sorts_drops_nan(self):
        df = pd.DataFrame({
            "country": ["B", "A", "A", "A"],
            "year":    ["2001", 2000, 2000, 2002],
            "value":   [1.0, 5.0, 9.0, np.nan],
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

    def test_to_canonical_frame_requires_core_columns(self):
        with pytest.raises(ValueError):
            base.to_canonical_frame(
                pd.DataFrame({"country": ["A"], "year": [2000]})
            )
