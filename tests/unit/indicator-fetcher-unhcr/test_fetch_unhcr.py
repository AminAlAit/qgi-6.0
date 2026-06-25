"""Tests for the UNHCR fetcher transform + shared fetcher base (enrichment stage 2).

Pure logic only - no AWS, no network (the base's AWS clients are lazy and the
UNHCR HTTP call is lazy-imported, so importing these modules needs neither).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

_QGI_PIPELINE = Path(__file__).resolve().parents[3]
_BASE_DIR = _QGI_PIPELINE / "batch" / "_fetcher_base"
_UNHCR_SRC = _QGI_PIPELINE / "batch" / "indicator-fetcher-unhcr" / "src"
for _p in (_BASE_DIR, _UNHCR_SRC):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import qgi_fetcher_base as base  # noqa: E402
import fetch_unhcr as f  # noqa: E402


# ---- shared base ------------------------------------------------------------

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
        "year": ["2001", 2000, 2000, 2002],   # mixed str/int; (A,2000) duplicated
        "value": [1.0, 5.0, 9.0, np.nan],      # last (A,2000)=9 wins; (A,2002) NaN dropped
        "extra": [1, 2, 3, 4],
    })
    out = base.to_canonical_frame(df)
    assert list(out.columns) == base.OUTPUT_COLUMNS
    assert out["year"].dtype == np.int64 and out["value"].dtype == np.float64
    assert (out["is_predicted"] == False).all()  # noqa: E712
    # sorted by (country, year); (A,2000) kept-last=9.0; (A,2002) dropped (NaN); (B,2001)=1.0
    assert out.to_dict("records") == [
        {"country": "A", "year": 2000, "value": 9.0, "is_predicted": False},
        {"country": "B", "year": 2001, "value": 1.0, "is_predicted": False},
    ]


def test_to_canonical_frame_requires_core_columns():
    import pytest
    with pytest.raises(ValueError):
        base.to_canonical_frame(pd.DataFrame({"country": ["A"], "year": [2000]}))  # no value


# ---- UNHCR parse ------------------------------------------------------------

ISO3 = {"AFG": "Afghanistan", "SYR": "Syria", "USA": "United States"}


def test_parse_unhcr_aggregates_by_country_year_and_maps_iso3():
    cfg = {"endpoint": "population", "value": "refugees", "country": "coo_iso"}
    records = [
        {"coo_iso": "AFG", "coa_iso": "PAK", "year": 2015, "refugees": "100"},
        {"coo_iso": "AFG", "coa_iso": "IRN", "year": 2015, "refugees": "50"},   # same (AFG,2015) -> sum 150
        {"coo_iso": "SYR", "coa_iso": "TUR", "year": 2016, "refugees": 200},
        {"coo_iso": "ZZZ", "coa_iso": "TUR", "year": 2016, "refugees": 999},     # unknown iso -> dropped
        {"coo_iso": "USA", "coa_iso": "CAN", "year": 2016, "refugees": ""},      # blank -> 0
    ]
    out = f.parse_unhcr_records(records, cfg, ISO3)
    recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
    assert recs[("Afghanistan", 2015)] == 150.0
    assert recs[("Syria", 2016)] == 200.0
    assert recs[("United States", 2016)] == 0.0
    assert all(c != "ZZZ" for c, _ in recs)  # unknown iso excluded


def test_parse_unhcr_empty_when_nothing_resolves():
    cfg = {"endpoint": "population", "value": "refugees", "country": "coo_iso"}
    out = f.parse_unhcr_records([{"coo_iso": "ZZZ", "year": 2015, "refugees": 5}], cfg, ISO3)
    assert list(out.columns) == ["country", "year", "value"]
    assert len(out) == 0


def test_unhcr_specs_cover_all_six():
    assert set(f.SPECS) == {"UN-01", "UN-02", "UN-03", "UN-04", "UN-05", "UN-06"}
