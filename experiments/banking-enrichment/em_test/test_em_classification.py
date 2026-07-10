"""Unit tests for em_classification.py (PLAN.md §11 Step 0: EM-eligibility).

All functions under test here are PURE (dict/json/pandas only -- no sklearn/xgboost/joblib),
so this file runs on plain host Python, no Docker required. `build_em_commitment` (the
orchestration entrypoint that also normalizes positives.csv country_ids via
`run_f_ml_1_poc.normalize_country_id`) is exercised only inside Docker -- same DI split as
`temporal_holdout.py` / `baseline_harness.py` in this experiment.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import em_classification as ec  # noqa: E402


def _assignments() -> dict:
    """Minimal fixture mirroring qgi-data/reference/cohort-assignments.json's shape:
    {country: {year_str: cohort}}. Includes a synthetic graduation case (Testland flips
    mid-tier -> stable-democracy exactly in 1997) to exercise the ex-ante lag guarantee.
    """
    return {
        "Mexico": {"1993": "mid-tier", "1994": "mid-tier", "1995": "mid-tier"},
        "Argentina": {"2000": "stable-democracy", "2001": "stable-democracy"},
        "Thailand": {"1996": "mid-tier", "1997": "mid-tier"},
        "Testland": {"1995": "mid-tier", "1996": "mid-tier", "1997": "stable-democracy"},
    }


# ============================================================================================
# cohort_at
# ============================================================================================
def test_cohort_at_basic_lookup():
    assert ec.cohort_at(_assignments(), "Mexico", 1994) == "mid-tier"


def test_cohort_at_missing_country_raises():
    with pytest.raises(KeyError):
        ec.cohort_at(_assignments(), "Nowhereland", 1994)


def test_cohort_at_missing_year_raises():
    with pytest.raises(KeyError):
        ec.cohort_at(_assignments(), "Mexico", 1800)


# ============================================================================================
# em_eligible -- the ex-ante LAGGED (t-1) classification
# ============================================================================================
def test_em_eligible_uses_year_minus_1_not_event_year():
    # Mexico 1995's crisis-year cohort is irrelevant; only 1994 (t-1) is consulted.
    rec = ec.em_eligible(_assignments(), "Mexico", event_year=1995)
    assert rec["lag_year"] == 1994
    assert rec["cohort_t_minus_1"] == "mid-tier"
    assert rec["em_eligible"] is True


def test_em_eligible_advanced_cohort_excluded():
    rec = ec.em_eligible(_assignments(), "Argentina", event_year=2001)
    assert rec["cohort_t_minus_1"] == "stable-democracy"
    assert rec["em_eligible"] is False


def test_em_eligible_thailand_1997_is_em():
    rec = ec.em_eligible(_assignments(), "Thailand", event_year=1997)
    assert rec["em_eligible"] is True


def test_em_eligible_graduation_edge_case_is_leak_safe():
    """Testland graduates to stable-democracy exactly in the crisis year (1997). The t-1
    lag (1996) must see the PRE-graduation cohort (mid-tier) -- a country's OWN crisis (or
    a graduation that happens to coincide with/follow it) must never reclassify it via a
    same-year or future lookup. This is the graduation-edge-case guard PLAN.md §11 asks us
    to spot-check (mirrors South Korea/Poland/Chile in the real cohort file)."""
    rec = ec.em_eligible(_assignments(), "Testland", event_year=1997)
    assert rec["lag_year"] == 1996
    assert rec["cohort_t_minus_1"] == "mid-tier"
    assert rec["em_eligible"] is True
    # Sanity: the event year itself is already graduated -- proves the lag is load-bearing.
    assert ec.cohort_at(_assignments(), "Testland", 1997) == "stable-democracy"


def test_em_eligible_missing_lag_year_raises():
    with pytest.raises(KeyError):
        ec.em_eligible(_assignments(), "Mexico", event_year=1993)  # lag_year=1992, absent


def test_em_eligible_custom_advanced_cohort_label():
    rec = ec.em_eligible(_assignments(), "Mexico", event_year=1995, advanced_cohort="mid-tier")
    assert rec["em_eligible"] is False  # now mid-tier is treated as "advanced"


# ============================================================================================
# select_architecture -- the binding n_pos<60 -> LR / n_pos>=60 -> XGBoost rule
# ============================================================================================
@pytest.mark.parametrize(
    "n_pos,expected",
    [(0, "LR"), (1, "LR"), (59, "LR"), (60, "XGBoost"), (61, "XGBoost"), (200, "XGBoost")],
)
def test_select_architecture_threshold_boundary(n_pos, expected):
    assert ec.select_architecture(n_pos) == expected


def test_select_architecture_boundary_is_ge_not_gt():
    # n_pos == threshold selects XGBoost (mirrors run_f_ml_1_poc.py:
    # `architecture = "LR" if n_pos < 60 else "XGBoost"`).
    assert ec.select_architecture(60, threshold=60) == "XGBoost"
    assert ec.select_architecture(59, threshold=60) == "LR"


# ============================================================================================
# classify_positives / summarize_em_eligibility
# ============================================================================================
def test_classify_positives_returns_one_record_per_row():
    positives = [("Mexico", 1994), ("Argentina", 2001), ("Thailand", 1997)]
    recs = ec.classify_positives(_assignments(), positives)
    assert len(recs) == 3
    assert {r["country"] for r in recs} == {"Mexico", "Argentina", "Thailand"}
    em_flags = {r["country"]: r["em_eligible"] for r in recs}
    assert em_flags == {"Mexico": True, "Argentina": False, "Thailand": True}


def test_classify_positives_propagates_missing_country_error_with_context():
    positives = [("Mexico", 1994), ("Nowhereland", 1999)]
    with pytest.raises(KeyError, match="Nowhereland"):
        ec.classify_positives(_assignments(), positives)


def test_summarize_em_eligibility_counts_and_architecture():
    positives = [("Mexico", 1994), ("Argentina", 2001), ("Thailand", 1997)]
    recs = ec.classify_positives(_assignments(), positives)
    summary = ec.summarize_em_eligibility(recs)
    assert summary["n_pos_total"] == 3
    assert summary["n_pos_em_eligible"] == 2
    assert summary["n_pos_advanced"] == 1
    assert summary["architecture"] == ec.select_architecture(2)  # 2 < 60 -> LR
    assert summary["architecture"] == "LR"
    assert sorted(summary["em_eligible_countries"]) == ["Mexico", "Thailand"]
    assert summary["advanced_countries"] == ["Argentina"]


def test_summarize_em_eligibility_empty_is_lr_not_crash():
    summary = ec.summarize_em_eligibility([])
    assert summary["n_pos_total"] == 0
    assert summary["n_pos_em_eligible"] == 0
    assert summary["architecture"] == "LR"


# ============================================================================================
# classify_rows_tolerant -- used to EM-filter the full samples DataFrame (positives AND
# time-matched negatives) for the run-2 baseline recompute (§11 Step 2), where an unresolved
# country/year must be DROPPED + COUNTED, never crash the whole baseline run.
# ============================================================================================
def test_classify_rows_tolerant_splits_resolved_and_unresolved():
    rows = [("Mexico", 1994), ("Nowhereland", 1999), ("Argentina", 2001)]
    resolved, unresolved = ec.classify_rows_tolerant(_assignments(), rows)
    assert len(resolved) == 2
    assert len(unresolved) == 1
    assert unresolved[0]["country"] == "Nowhereland"
    resolved_countries = {r["country"] for r in resolved}
    assert resolved_countries == {"Mexico", "Argentina"}


def test_classify_rows_tolerant_missing_lag_year_is_unresolved_not_crash():
    rows = [("Mexico", 1993)]  # lag_year=1992, absent from fixture
    resolved, unresolved = ec.classify_rows_tolerant(_assignments(), rows)
    assert resolved == []
    assert len(unresolved) == 1
    assert unresolved[0]["country"] == "Mexico"
    assert unresolved[0]["event_year"] == 1993


def test_classify_rows_tolerant_preserves_em_eligible_flag():
    rows = [("Mexico", 1994), ("Argentina", 2001)]
    resolved, _ = ec.classify_rows_tolerant(_assignments(), rows)
    flags = {r["country"]: r["em_eligible"] for r in resolved}
    assert flags == {"Mexico": True, "Argentina": False}


def test_classify_rows_tolerant_empty_input():
    resolved, unresolved = ec.classify_rows_tolerant(_assignments(), [])
    assert resolved == [] and unresolved == []
