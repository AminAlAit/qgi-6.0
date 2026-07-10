"""Unit tests for subset_utils.py (PLAN.md §11 Step 2-3: EM vs advanced subset masking).

Pure dict/list logic only -- no pandas/numpy/sklearn -- runs on plain host Python.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import subset_utils as su  # noqa: E402


def _resolved_by_key():
    # Mirrors run_em_baseline.py's resolved_by_key shape: {(country, year): em_eligible_bool}
    return {
        ("Mexico", 1994): True,       # EM-eligible
        ("Thailand", 1997): True,     # EM-eligible
        ("Argentina", 2001): False,   # advanced (proxy artifact, per known_limitation)
        ("Japan", 1990): False,       # advanced
    }


def test_resolve_subset_mask_em_selects_only_em_eligible():
    rows = [("Mexico", 1994), ("Thailand", 1997), ("Argentina", 2001), ("Japan", 1990)]
    mask = su.resolve_subset_mask(rows, _resolved_by_key(), "em")
    assert mask == [True, True, False, False]


def test_resolve_subset_mask_advanced_selects_only_advanced():
    rows = [("Mexico", 1994), ("Thailand", 1997), ("Argentina", 2001), ("Japan", 1990)]
    mask = su.resolve_subset_mask(rows, _resolved_by_key(), "advanced")
    assert mask == [False, False, True, True]


def test_resolve_subset_mask_unresolved_row_excluded_from_both_subsets():
    rows = [("Nowhereland", 1999)]
    em_mask = su.resolve_subset_mask(rows, _resolved_by_key(), "em")
    adv_mask = su.resolve_subset_mask(rows, _resolved_by_key(), "advanced")
    assert em_mask == [False]
    assert adv_mask == [False]


def test_resolve_subset_mask_em_and_advanced_are_always_disjoint_for_resolved_rows():
    rows = [("Mexico", 1994), ("Thailand", 1997), ("Argentina", 2001), ("Japan", 1990),
            ("Nowhereland", 1999)]
    resolved = _resolved_by_key()
    em_mask = su.resolve_subset_mask(rows, resolved, "em")
    adv_mask = su.resolve_subset_mask(rows, resolved, "advanced")
    for r, e, a in zip(rows, em_mask, adv_mask):
        if r in resolved:
            assert e != a  # exactly one of the two subsets claims a resolved row
        else:
            assert e is False and a is False  # unresolved rows: neither subset claims it


def test_resolve_subset_mask_rejects_unknown_subset_name():
    with pytest.raises(ValueError):
        su.resolve_subset_mask([("Mexico", 1994)], _resolved_by_key(), "bogus")


def test_resolve_subset_mask_empty_rows_returns_empty_list():
    assert su.resolve_subset_mask([], _resolved_by_key(), "em") == []


def test_named_twin_crises_partition_matches_em_commitment_known_limitation():
    """Regression guard for the documented D5 5-of-7 / 3-of-7 split: the 7 §11 named
    twin-crisis (country, event_year) pairs partition EXACTLY as em_commitment.json's
    known_limitation documents -- Mexico/Thailand/Indonesia/Russia/Turkiye -> EM;
    Argentina/Brazil (+ South Korea) -> advanced. If cohort-assignments.json is ever
    swapped for a real WB income-group table, this test is expected to need updating --
    that is the point: it pins the CURRENT proxy's behavior so a silent change is caught.
    """
    resolved_by_key = {
        ("Mexico", 1994): True,
        ("Thailand", 1997): True,
        ("Indonesia", 1997): True,
        ("Russia", 1998): True,
        ("Turkiye", 2001): True,
        ("Argentina", 2001): False,
        ("Brazil", 1994): False,
        ("South Korea", 1997): False,
    }
    twins = list(resolved_by_key.keys())
    em_mask = su.resolve_subset_mask(twins, resolved_by_key, "em")
    adv_mask = su.resolve_subset_mask(twins, resolved_by_key, "advanced")
    em_twins = [c for c, m in zip(twins, em_mask) if m]
    adv_twins = [c for c, m in zip(twins, adv_mask) if m]
    assert len(em_twins) == 5
    assert len(adv_twins) == 3
    assert ("Argentina", 2001) in adv_twins and ("Brazil", 1994) in adv_twins
