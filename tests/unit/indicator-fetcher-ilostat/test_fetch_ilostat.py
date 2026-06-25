"""Tests for the ILOSTAT SDMX fetcher transform (enrichment stage 2).

Pure logic only — no AWS, no network. The base's AWS clients are lazy and the
pandasdmx import lives inside fetch_ilostat_raw(), so importing this module
under test needs neither sdmx1 nor AWS credentials.

The synthetic payloads mimic what pandasdmx 1.x returns from sdmx.to_pandas():
a pandas Series with a MultiIndex whose levels are named by the SDMX dimension
IDs (REF_AREA, TIME_PERIOD) plus OBS_VALUE as the final values column once
the series is reset_index()-ed and its last column is taken as the value.

We build the synthetic payloads directly as pandas Series with a MultiIndex so
no pandasdmx objects are needed in tests.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

_QGI_PIPELINE = Path(__file__).resolve().parents[3]
_BASE_DIR = _QGI_PIPELINE / "batch" / "_fetcher_base"
_ILO_SRC = _QGI_PIPELINE / "batch" / "indicator-fetcher-ilostat" / "src"
for _p in (_BASE_DIR, _ILO_SRC):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import qgi_fetcher_base as base  # noqa: E402
import fetch_ilostat as f  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers — build synthetic pandasdmx-style observation Series
# ---------------------------------------------------------------------------

ISO3 = {
    "DEU": "Germany",
    "BRA": "Brazil",
    "IND": "India",
    "USA": "United States",
}


def _make_obs_series(rows: list[tuple[str, str, float]]) -> pd.Series:
    """Build a Series that looks like what pandasdmx.to_pandas() returns.

    Each row is (iso3, time_period_str, obs_value).  The MultiIndex levels are
    named 'REF_AREA' and 'TIME_PERIOD', and the Series name (the value column)
    is 'OBS_VALUE'.  This matches the reset_index() structure that
    parse_ilostat_records inspects (it picks the last column as the value).
    """
    if not rows:
        return pd.Series(dtype=float, name="OBS_VALUE")
    idx = pd.MultiIndex.from_tuples(
        [(iso, tp) for iso, tp, _ in rows],
        names=["REF_AREA", "TIME_PERIOD"],
    )
    values = [v for _, _, v in rows]
    return pd.Series(values, index=idx, name="OBS_VALUE", dtype=float)


# ---------------------------------------------------------------------------
# Tests: parse_ilostat_records
# ---------------------------------------------------------------------------

class TestParseIlostatRecords:
    def test_maps_iso3_to_canonical_and_extracts_year(self):
        series = _make_obs_series([
            ("DEU", "2015", 15.3),
            ("BRA", "2016", 45.0),
        ])
        out = f.parse_ilostat_records(series, ISO3)
        assert set(out["country"]) == {"Germany", "Brazil"}
        assert list(out.loc[out["country"] == "Germany", "year"]) == [2015]
        assert list(out.loc[out["country"] == "Brazil", "value"]) == [45.0]

    def test_drops_unresolvable_iso3(self):
        series = _make_obs_series([
            ("DEU", "2015", 20.0),
            ("ZZZ", "2015", 99.9),   # unknown ISO -> dropped
            ("XYZ", "2016", 1.0),    # unknown ISO -> dropped
        ])
        out = f.parse_ilostat_records(series, ISO3)
        assert len(out) == 1
        assert out.iloc[0]["country"] == "Germany"

    def test_aggregates_quarterly_to_annual_mean(self):
        # Four quarters for Germany 2020 and two quarters for Brazil 2020
        series = _make_obs_series([
            ("DEU", "2020-Q1", 10.0),
            ("DEU", "2020-Q2", 20.0),
            ("DEU", "2020-Q3", 30.0),
            ("DEU", "2020-Q4", 40.0),
            ("BRA", "2020-Q1", 100.0),
            ("BRA", "2020-Q2", 200.0),
        ])
        out = f.parse_ilostat_records(series, ISO3)
        deu = out.loc[out["country"] == "Germany"]
        bra = out.loc[out["country"] == "Brazil"]
        assert len(deu) == 1
        assert abs(deu.iloc[0]["value"] - 25.0) < 1e-9  # mean of 10,20,30,40
        assert abs(bra.iloc[0]["value"] - 150.0) < 1e-9  # mean of 100,200

    def test_drops_observations_before_year_from(self):
        series = _make_obs_series([
            ("DEU", "1985", 5.0),   # before YEAR_FROM (1990) -> dropped
            ("DEU", "1990", 6.0),   # exactly 1990 -> kept
            ("BRA", "1989", 7.0),   # before -> dropped
        ])
        out = f.parse_ilostat_records(series, ISO3)
        assert len(out) == 1
        assert out.iloc[0]["year"] == 1990

    def test_drops_nan_obs_values(self):
        series = _make_obs_series([
            ("DEU", "2010", float("nan")),
            ("BRA", "2010", 50.0),
        ])
        out = f.parse_ilostat_records(series, ISO3)
        assert len(out) == 1
        assert out.iloc[0]["country"] == "Brazil"

    def test_returns_empty_frame_for_none_series(self):
        out = f.parse_ilostat_records(None, ISO3)
        assert list(out.columns) == ["country", "year", "value"]
        assert len(out) == 0

    def test_returns_empty_frame_for_empty_series(self):
        out = f.parse_ilostat_records(pd.Series(dtype=float), ISO3)
        assert list(out.columns) == ["country", "year", "value"]
        assert len(out) == 0

    def test_deduplicates_via_groupby_mean(self):
        # Two identical (country, year) rows -> averaged
        series = _make_obs_series([
            ("DEU", "2020", 10.0),
            ("DEU", "2020", 20.0),
        ])
        out = f.parse_ilostat_records(series, ISO3)
        assert len(out) == 1
        assert out.iloc[0]["value"] == 15.0

    def test_multi_country_multi_year(self):
        series = _make_obs_series([
            ("DEU", "2000", 1.0),
            ("DEU", "2001", 2.0),
            ("BRA", "2000", 3.0),
            ("IND", "2005", 4.0),
        ])
        out = f.parse_ilostat_records(series, ISO3)
        assert len(out) == 4
        assert set(out["country"]) == {"Germany", "Brazil", "India"}

    def test_handles_monthly_time_period(self):
        # Monthly format: YYYY-MM
        series = _make_obs_series([
            ("USA", "2018-01", 100.0),
            ("USA", "2018-06", 200.0),
            ("USA", "2019-01", 300.0),
        ])
        out = f.parse_ilostat_records(series, ISO3)
        assert len(out) == 2  # 2018 and 2019
        val_2018 = out.loc[out["year"] == 2018, "value"].iloc[0]
        assert abs(val_2018 - 150.0) < 1e-9  # mean of 100, 200


# ---------------------------------------------------------------------------
# Tests: SPECS coverage
# ---------------------------------------------------------------------------

class TestSpecs:
    def test_all_thirteen_indicators_present(self):
        expected = {f"IL-{i:02d}" for i in range(1, 14)}
        assert set(f.SPECS) == expected

    def test_every_spec_has_required_keys(self):
        required = {"dataflow", "key", "notes"}
        for iid, cfg in f.SPECS.items():
            missing = required - set(cfg)
            assert not missing, f"{iid} missing keys: {missing}"

    def test_every_dataflow_is_nonempty_string(self):
        for iid, cfg in f.SPECS.items():
            df_id = cfg["dataflow"]
            assert isinstance(df_id, str) and df_id, f"{iid} dataflow is empty"

    def test_every_key_is_string(self):
        for iid, cfg in f.SPECS.items():
            assert isinstance(cfg["key"], str), f"{iid} key must be str"

    def test_no_duplicate_dataflows_except_allowed(self):
        # Each indicator should use a distinct dataset (or a different key slice
        # of the same dataset). At minimum, no two specs should be identical.
        seen: set[tuple[str, str]] = set()
        for iid, cfg in f.SPECS.items():
            pair = (cfg["dataflow"], cfg["key"])
            assert pair not in seen, (
                f"Duplicate (dataflow, key) pair in {iid}: {pair}"
            )
            seen.add(pair)


# ---------------------------------------------------------------------------
# Tests: fetch_one raises on unknown indicator (no network needed)
# ---------------------------------------------------------------------------

class TestFetchOneUnknownIndicator:
    def test_raises_value_error_for_unknown_id(self, monkeypatch):
        # We do NOT want to call the real fetch; just test the guard
        with pytest.raises(ValueError, match="unknown ILOSTAT indicator"):
            # fetch_one calls base.load_iso3_country_map() only inside the real
            # network branch; the guard is hit before that
            f.fetch_one({"id_string": "IL-99"})


# ---------------------------------------------------------------------------
# Tests: base helpers (shared contract — same as UNHCR test mirrors)
# ---------------------------------------------------------------------------

class TestBaseFunctions:
    def test_iso3_map_from_df_uppercases_and_skips_blanks(self):
        df = pd.DataFrame({
            "iso_alpha3": ["deu", "BRA", "", None],
            "qgi_name": ["Germany", "Brazil", "Nowhere", "AlsoNowhere"],
        })
        m = base.iso3_map_from_df(df)
        assert m == {"DEU": "Germany", "BRA": "Brazil"}

    def test_to_canonical_frame_coerces_dedups_sorts_drops_nan(self):
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
        # (A,2000) last value = 9.0; (A,2002) dropped (NaN); (B,2001) = 1.0
        assert out.to_dict("records") == [
            {"country": "A", "year": 2000, "value": 9.0, "is_predicted": False},
            {"country": "B", "year": 2001, "value": 1.0, "is_predicted": False},
        ]

    def test_to_canonical_frame_requires_core_columns(self):
        with pytest.raises(ValueError):
            base.to_canonical_frame(
                pd.DataFrame({"country": ["A"], "year": [2000]})
            )
