"""Unit tests for candidate_loco.py's PURE helpers (PLAN.md §11 Step 2-3: candidate LOCO
scoring on the EM/advanced subset + named twin-crisis lookup for the D5 gate).

No pandas/numpy/sklearn needed for these -- plain host Python.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import candidate_loco as cl  # noqa: E402


# ============================================================================================
# named_twins_present_in_subset
# ============================================================================================
def test_named_twins_present_in_subset_em_side():
    resolved_by_key = {
        ("Mexico", 1994): True, ("Thailand", 1997): True, ("Indonesia", 1997): True,
        ("Russia", 1998): True, ("Turkiye", 2001): True,
        ("Argentina", 2001): False, ("Brazil", 1994): False, ("South Korea", 1997): False,
    }
    present = cl.named_twins_present_in_subset(resolved_by_key, "em")
    assert set(present) == {"Mexico", "Thailand", "Indonesia", "Russia", "Turkiye"}


def test_named_twins_present_in_subset_advanced_side():
    resolved_by_key = {
        ("Mexico", 1994): True, ("Thailand", 1997): True, ("Indonesia", 1997): True,
        ("Russia", 1998): True, ("Turkiye", 2001): True,
        ("Argentina", 2001): False, ("Brazil", 1994): False, ("South Korea", 1997): False,
    }
    present = cl.named_twins_present_in_subset(resolved_by_key, "advanced")
    assert set(present) == {"Argentina", "Brazil", "South Korea"}


def test_named_twins_present_in_subset_missing_country_excluded():
    # A named twin absent from resolved_by_key entirely (unresolved) is excluded from BOTH.
    resolved_by_key = {("Mexico", 1994): True}
    assert cl.named_twins_present_in_subset(resolved_by_key, "em") == ["Mexico"]
    assert cl.named_twins_present_in_subset(resolved_by_key, "advanced") == []


# ============================================================================================
# filter_positives_to_subset
# ============================================================================================
def test_filter_positives_to_subset_em():
    positives = [("Mexico", 1994), ("Argentina", 2001), ("Thailand", 1997)]
    resolved_by_key = {("Mexico", 1994): True, ("Argentina", 2001): False, ("Thailand", 1997): True}
    out = cl.filter_positives_to_subset(positives, resolved_by_key, "em")
    assert out == [("Mexico", 1994), ("Thailand", 1997)]


def test_filter_positives_to_subset_advanced():
    positives = [("Mexico", 1994), ("Argentina", 2001), ("Thailand", 1997)]
    resolved_by_key = {("Mexico", 1994): True, ("Argentina", 2001): False, ("Thailand", 1997): True}
    out = cl.filter_positives_to_subset(positives, resolved_by_key, "advanced")
    assert out == [("Argentina", 2001)]


def test_filter_positives_to_subset_unresolved_row_dropped():
    positives = [("Nowhereland", 1999)]
    resolved_by_key: dict = {}
    assert cl.filter_positives_to_subset(positives, resolved_by_key, "em") == []
    assert cl.filter_positives_to_subset(positives, resolved_by_key, "advanced") == []
