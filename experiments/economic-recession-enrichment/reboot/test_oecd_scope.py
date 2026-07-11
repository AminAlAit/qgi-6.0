"""Tests for `oecd_scope.py` -- the EX-ANTE OECD/advanced-economy country scope used to
restrict the D1 coverage gate to the sub-population these sourced indicators actually target
(per the task: "recession is being rebooted as an OECD-scoped sub-recipe"). The scope is
defined by ACTUAL OECD membership (38 members, 2024) + IMF WEO "advanced economy"
classification for the handful of non-OECD advanced economies in our 106-country roster
(Singapore) -- an EXTERNAL, ex-ante criterion, never derived from which countries happen to
have indicator data (that would be circular: "scope to wherever the data already covers,
then declare high coverage"). Written before `oecd_scope.py`.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from oecd_scope import OECD_SCOPED_COUNTRY_IDS, filter_positives_to_oecd_scope

HERE = Path(__file__).resolve().parent
POSITIVES_CSV = HERE.parents[2] / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"


def test_oecd_scoped_country_ids_are_all_valid_positives_country_ids():
    from crosswalk import CROSSWALK

    unknown = OECD_SCOPED_COUNTRY_IDS - set(CROSSWALK.keys())
    assert unknown == set(), f"OECD scope contains ids outside the 106-country crosswalk: {unknown}"


def test_oecd_scoped_country_ids_includes_canonical_members():
    for cid in ["united_states", "united_kingdom", "germany", "france", "japan", "italy", "south_korea"]:
        assert cid in OECD_SCOPED_COUNTRY_IDS


def test_oecd_scoped_country_ids_excludes_clearly_non_oecd():
    for cid in ["afghanistan", "sudan", "yemen", "nigeria", "china", "india", "russia", "iran"]:
        assert cid not in OECD_SCOPED_COUNTRY_IDS


def test_oecd_scope_count_is_in_task_ballpark():
    # Task spec's prior estimate: "~30-42 countries". The task explicitly warns the real N
    # may differ from the roster estimate -- this asserts a wide sanity band, not equality.
    assert 15 <= len(OECD_SCOPED_COUNTRY_IDS) <= 45


def test_filter_positives_to_oecd_scope_keeps_only_scoped_rows():
    positives = pd.read_csv(POSITIVES_CSV)
    scoped = filter_positives_to_oecd_scope(positives)
    assert set(scoped["country_id"].unique()) <= OECD_SCOPED_COUNTRY_IDS
    assert len(scoped) < len(positives)
    assert len(scoped) > 0


def test_filter_positives_to_oecd_scope_preserves_all_rows_for_scoped_countries():
    positives = pd.read_csv(POSITIVES_CSV)
    scoped = filter_positives_to_oecd_scope(positives)
    for cid in OECD_SCOPED_COUNTRY_IDS:
        expected = positives[positives["country_id"] == cid]
        actual = scoped[scoped["country_id"] == cid]
        assert len(expected) == len(actual)
