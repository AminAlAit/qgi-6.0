"""Tests for the UCDP fetcher transform (enrichment stage 2). Pure logic; no net/AWS."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

_QGI_PIPELINE = Path(__file__).resolve().parents[3]
for _p in (_QGI_PIPELINE / "batch" / "_fetcher_base",
           _QGI_PIPELINE / "batch" / "indicator-fetcher-ucdp" / "src"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import fetch_ucdp as f  # noqa: E402

NAME_MAP = {
    "Afghanistan": "Afghanistan",
    "DR Congo (Zaire)": "The Democratic Republic of the Congo",  # via override
    "Syria": "Syria",
}


def test_parse_ged_filters_by_type_of_violence_and_sums():
    records = [
        {"country": "Afghanistan", "year": 2001, "best": 100, "type_of_violence": 1},
        {"country": "Afghanistan", "year": 2001, "best": 50, "type_of_violence": 1},   # sum -> 150
        {"country": "Afghanistan", "year": 2001, "best": 999, "type_of_violence": 3},  # wrong tov -> excluded
        {"country": "Syria", "year": 2012, "best": 200, "type_of_violence": 1},
    ]
    out = f.parse_ged_records(records, tov=1, name_map=NAME_MAP)
    recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
    assert recs[("Afghanistan", 2001)] == 150.0
    assert recs[("Syria", 2012)] == 200.0
    assert ("Afghanistan", 2001) in recs and len(recs) == 2


def test_parse_ged_one_sided_and_override_mapping():
    records = [
        {"country": "DR Congo (Zaire)", "year": 2017, "best": 30, "type_of_violence": 3},
        {"country": "Nowhere", "year": 2017, "best": 5, "type_of_violence": 3},   # unmapped -> dropped
    ]
    out = f.parse_ged_records(records, tov=3, name_map=NAME_MAP)
    recs = {(r["country"], r["year"]): r["value"] for r in out.to_dict("records")}
    assert recs == {("The Democratic Republic of the Congo", 2017): 30.0}


def test_build_name_map_merges_overrides():
    merged = f.build_name_map({"Afghanistan": "Afghanistan"})
    assert merged["Afghanistan"] == "Afghanistan"
    assert merged["DR Congo (Zaire)"] == "The Democratic Republic of the Congo"


def test_specs_are_ged_only():
    # UC-02 / UC-03 are deferred (need the ACD + gw crosswalk) and must NOT be wired.
    assert set(f.SPECS) == {"UC-01", "UC-04"}


def test_fetch_one_rejects_deferred_indicator():
    import pytest
    with pytest.raises(ValueError, match="deferred"):
        f.fetch_one({"id_string": "UC-02"})
