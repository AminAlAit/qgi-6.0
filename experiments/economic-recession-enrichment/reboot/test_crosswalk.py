"""Tests for the country_id -> ISO3/ISO2 crosswalk covering the 106 economic_recession event
countries (`data/shape_inputs_v2/economic_recession/positives.csv`). Written BEFORE
`crosswalk.py` per project test-first convention.

The crosswalk is the join key for every downstream WB-API (ISO3) and BIS-SDMX (ISO2) pull --
a wrong or missing code silently drops a country's entire coverage, so the tests are strict:
every positives.csv country_id must resolve, codes must be well-formed and unique, and the
normalized display name must match `screen_coverage.normalize_country_id`'s convention (the
same convention the WB parquet panels already use -- see reboot's `build_*` scripts).
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import pytest

from crosswalk import CROSSWALK, normalize_country_id

HERE = Path(__file__).resolve().parent
POSITIVES_CSV = HERE.parents[2] / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"

ISO3_RE = re.compile(r"^[A-Z]{3}$")
ISO2_RE = re.compile(r"^[A-Z]{2}$")


def _positive_country_ids() -> set[str]:
    df = pd.read_csv(POSITIVES_CSV)
    return set(df["country_id"].unique())


def test_positives_csv_has_106_countries():
    # Sanity check on the fixture itself -- the task spec's stated N.
    assert len(_positive_country_ids()) == 106


def test_every_positive_country_id_is_in_crosswalk():
    missing = _positive_country_ids() - set(CROSSWALK.keys())
    assert missing == set(), f"positives.csv country_ids missing from CROSSWALK: {sorted(missing)}"


def test_crosswalk_has_no_extra_entries_beyond_positives():
    # Keeps the crosswalk scoped to the 106-country event set (not a kitchen-sink global list)
    # so a stray typo'd key can't silently pass test_every_positive_country_id_is_in_crosswalk.
    extra = set(CROSSWALK.keys()) - _positive_country_ids()
    assert extra == set(), f"CROSSWALK has entries not in positives.csv: {sorted(extra)}"


def test_all_iso3_codes_well_formed():
    for cid, row in CROSSWALK.items():
        assert ISO3_RE.match(row["iso3"]), f"{cid}: bad iso3 {row['iso3']!r}"


def test_all_iso2_codes_well_formed():
    for cid, row in CROSSWALK.items():
        assert ISO2_RE.match(row["iso2"]), f"{cid}: bad iso2 {row['iso2']!r}"


def test_iso3_codes_unique():
    codes = [row["iso3"] for row in CROSSWALK.values()]
    dupes = {c for c in codes if codes.count(c) > 1}
    assert dupes == set(), f"duplicate iso3 codes: {dupes}"


def test_iso2_codes_unique():
    codes = [row["iso2"] for row in CROSSWALK.values()]
    dupes = {c for c in codes if codes.count(c) > 1}
    assert dupes == set(), f"duplicate iso2 codes: {dupes}"


def test_country_names_nonempty_and_unique():
    names = [row["country_name"] for row in CROSSWALK.values()]
    assert all(n.strip() for n in names)
    dupes = {n for n in names if names.count(n) > 1}
    assert dupes == set(), f"duplicate country_name values: {dupes}"


@pytest.mark.parametrize(
    "cid,expected_iso3,expected_iso2",
    [
        ("united_states", "USA", "US"),
        ("united_kingdom", "GBR", "GB"),
        ("south_korea", "KOR", "KR"),
        ("north_korea", "PRK", "KP"),
        ("turkiye", "TUR", "TR"),
        ("democratic_republic_of_congo", "COD", "CD"),
        ("ivory_coast", "CIV", "CI"),
        ("russia", "RUS", "RU"),
        ("czechia", "CZE", "CZ"),
        ("bosnia_and_herzegovina", "BIH", "BA"),
    ],
)
def test_spot_check_known_codes(cid, expected_iso3, expected_iso2):
    assert CROSSWALK[cid]["iso3"] == expected_iso3
    assert CROSSWALK[cid]["iso2"] == expected_iso2


def test_country_name_matches_normalize_country_id_convention():
    # The panel-builder scripts write `country` = normalize_country_id(country_id) so joins
    # against positives.csv (also run through normalize_country_id in screen_coverage.py) line
    # up. The crosswalk's country_name must agree, or coverage will silently under-count.
    for cid, row in CROSSWALK.items():
        assert row["country_name"] == normalize_country_id(cid), (
            f"{cid}: crosswalk name {row['country_name']!r} != "
            f"normalize_country_id {normalize_country_id(cid)!r}"
        )


def test_normalize_country_id_overrides_applied():
    assert normalize_country_id("democratic_republic_of_congo") == "The Democratic Republic of the Congo"
    assert normalize_country_id("bosnia_and_herzegovina") == "Bosnia And Herzegovina"
    assert normalize_country_id("ivory_coast") == "Ivory Coast"


def test_iso2_to_iso3_lookup_helper():
    from crosswalk import iso2_to_country_id

    assert iso2_to_country_id("US") == "united_states"
    assert iso2_to_country_id("KR") == "south_korea"
    assert iso2_to_country_id("ZZ") is None


def test_iso3_to_country_id_lookup_helper():
    from crosswalk import iso3_to_country_id

    assert iso3_to_country_id("USA") == "united_states"
    assert iso3_to_country_id("KOR") == "south_korea"
    assert iso3_to_country_id("ZZZ") is None
