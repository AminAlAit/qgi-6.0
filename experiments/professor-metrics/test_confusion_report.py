"""Tests for confusion_report.py — pure/host-runnable (no xgboost, no Docker, no panels)."""
from __future__ import annotations

import json
import math

import pytest

import confusion_report as cr


def rows(spec):
    """spec: list of (country, year, prob, label)."""
    return [{"country": c, "year": y, "prob": p, "label": l} for c, y, p, l in spec]


# --------------------------------------------------------------------------- confusion_at
def test_confusion_at_counts_and_rates_hand_checked():
    # 2 TP, 1 FP, 1 FN, 2 TN at threshold 0.5
    oof = rows([
        ("A", 2000, 0.9, 1), ("A", 2001, 0.6, 1),   # TP, TP
        ("B", 2000, 0.7, 0),                          # FP
        ("B", 2001, 0.2, 1),                          # FN
        ("C", 2000, 0.1, 0), ("C", 2001, 0.4, 0),   # TN, TN
    ])
    c = cr.confusion_at(oof, 0.5)
    assert (c["tp"], c["fp"], c["fn"], c["tn"]) == (2, 1, 1, 2)
    assert c["n"] == 6 and c["predicted_positive"] == 3
    assert c["precision"] == pytest.approx(2 / 3, abs=1e-4)
    assert c["recall"] == pytest.approx(2 / 3, abs=1e-4)
    assert c["specificity"] == pytest.approx(2 / 3, abs=1e-4)
    assert c["f1"] == pytest.approx(2 / 3, abs=1e-4)
    assert c["accuracy"] == pytest.approx(4 / 6, abs=1e-4)


def test_threshold_is_inclusive_matching_the_sheet_convention():
    oof = rows([("A", 2000, 0.5, 1), ("B", 2000, 0.4999, 0)])
    c = cr.confusion_at(oof, 0.5)
    assert (c["tp"], c["tn"]) == (1, 1)  # prob == threshold counts as a positive prediction


def test_undefined_precision_is_none_not_zero():
    """No predicted positives => precision is undefined. Reporting 0.0 would understate."""
    oof = rows([("A", 2000, 0.1, 1), ("B", 2000, 0.2, 0)])
    c = cr.confusion_at(oof, 0.9)
    assert c["predicted_positive"] == 0
    assert c["precision"] is None
    assert c["f1"] is None
    assert c["recall"] == 0.0  # recall IS defined: there are real positives, none were caught


def test_mcc_perfect_and_degenerate():
    perfect = rows([("A", 2000, 0.9, 1), ("B", 2000, 0.1, 0)])
    assert cr.confusion_at(perfect, 0.5)["mcc"] == pytest.approx(1.0, abs=1e-6)
    # all predicted negative => a zero row/column => MCC undefined
    degenerate = rows([("A", 2000, 0.1, 1), ("B", 2000, 0.1, 0)])
    assert cr.confusion_at(degenerate, 0.5)["mcc"] is None


# ------------------------------------------------------------------------ ranking metrics
def test_ranking_metrics_perfect_separation():
    oof = rows([("A", 2000, 0.9, 1), ("A", 2001, 0.8, 1),
                ("B", 2000, 0.2, 0), ("B", 2001, 0.1, 0)])
    m = cr.ranking_metrics(oof)
    assert m["roc_auc_exact"] == pytest.approx(1.0)
    assert m["pr_auc_exact"] == pytest.approx(1.0)
    assert m["base_rate"] == pytest.approx(0.5)
    assert m["n_pos"] == 2 and m["n_neg"] == 2


def test_ranking_metrics_single_class_returns_none_not_half():
    oof = rows([("A", 2000, 0.9, 1), ("B", 2000, 0.8, 1)])
    m = cr.ranking_metrics(oof)
    assert m["roc_auc_exact"] is None and m["pr_auc_exact"] is None
    assert m["n_pos"] == 2 and m["n_neg"] == 0


def test_brier_score_is_mean_squared_error():
    oof = rows([("A", 2000, 1.0, 1), ("B", 2000, 0.0, 0)])
    assert cr.ranking_metrics(oof)["brier"] == pytest.approx(0.0)
    oof2 = rows([("A", 2000, 0.0, 1), ("B", 2000, 1.0, 0)])
    assert cr.ranking_metrics(oof2)["brier"] == pytest.approx(1.0)


# ------------------------------------------------------------------------ best_threshold
def test_best_threshold_finds_the_separating_point():
    oof = rows([("A", 2000, 0.9, 1), ("A", 2001, 0.8, 1),
                ("B", 2000, 0.3, 0), ("B", 2001, 0.2, 0)])
    best = cr.best_threshold(oof, "f1")
    assert best["f1"] == pytest.approx(1.0)
    assert best["threshold"] <= 0.8  # any cut between 0.3 and 0.8 is perfect


def test_best_threshold_rejects_unknown_metric():
    with pytest.raises(ValueError):
        cr.best_threshold(rows([("A", 2000, 0.5, 1)]), "accuracy")


# ------------------------------------------------------------------------ top-k precision
def test_top_k_precision_and_lift():
    # 10 rows, 2 positives, both ranked top => precision@20% = 1.0, lift = 5x
    spec = [("A", 2000 + i, 0.9 - i * 0.01, 1 if i < 2 else 0) for i in range(10)]
    out = cr.top_k_precision(rows(spec), fractions=(0.2,))
    assert out[0]["k"] == 2 and out[0]["hits"] == 2
    assert out[0]["precision_at_k"] == pytest.approx(1.0)
    assert out[0]["lift_over_base"] == pytest.approx(5.0)


def test_top_k_always_takes_at_least_one_row():
    out = cr.top_k_precision(rows([("A", 2000, 0.9, 1), ("B", 2000, 0.1, 0)]), fractions=(0.01,))
    assert out[0]["k"] == 1


# ------------------------------------------------------------------------------- cohorts
def test_cohort_of_uses_exact_year_and_falls_back_to_unassigned():
    assignments = {"Wonderland": {"1999": "mid-tier", "2000": "fragile-state"}}
    assert cr.cohort_of(assignments, "Wonderland", 2000) == "fragile-state"
    assert cr.cohort_of(assignments, "Wonderland", 1998) == "unassigned"  # year not covered
    assert cr.cohort_of(assignments, "Atlantis", 2000) == "unassigned"    # country not covered


def test_by_cohort_partitions_every_row_exactly_once():
    assignments = {"A": {"2000": "fragile-state"}, "B": {"2000": "stable-democracy"}}
    oof = rows([("A", 2000, 0.9, 1), ("B", 2000, 0.2, 0), ("C", 2000, 0.5, 1)])
    out = cr.by_cohort(oof, assignments, 0.5)
    assert set(out) == {"fragile-state", "stable-democracy", "unassigned"}
    assert sum(v["n"] for v in out.values()) == len(oof)  # no row dropped, none double-counted


# ------------------------------------------------------------------------------ by_country
def test_by_country_orders_by_positive_count():
    oof = rows([("Quiet", 2000, 0.1, 0),
                ("Loud", 2000, 0.9, 1), ("Loud", 2001, 0.8, 1)])
    out = cr.by_country(oof)
    assert out[0]["country"] == "Loud" and out[0]["n_pos"] == 2


def test_by_country_respects_top_limit():
    oof = rows([(f"C{i}", 2000, 0.5, 1) for i in range(20)])
    assert len(cr.by_country(oof, top=5)) == 5


# -------------------------------------------------------------------------------- summarize
def test_summarize_carries_source_provenance():
    """The configuration must travel with the numbers — several persisted run-2 files are at
    superseded windows, and a report that loses that context invites a stale citation."""
    oof = rows([("A", 2000, 0.9, 1), ("B", 2000, 0.1, 0)])
    meta = {"arm": "run2", "loco_auc": 0.7707, "chosen_window": 25, "selected_set": ["X"]}
    rep = cr.summarize(oof, recipe="banking", source_file="x.json", source_meta=meta)
    assert rep["source_reported"]["loco_auc"] == 0.7707
    assert rep["source_reported"]["arm"] == "run2"
    assert rep["source_reported"]["chosen_window"] == 25
    assert rep["recipe"] == "banking"


def test_summarize_omits_cohorts_when_assignments_absent():
    oof = rows([("A", 2000, 0.9, 1), ("B", 2000, 0.1, 0)])
    rep = cr.summarize(oof, recipe="r", assignments=None)
    assert "by_cohort" not in rep
    assert "threshold_sweep" in rep and len(rep["threshold_sweep"]) == len(cr.DEFAULT_SWEEP)


def test_load_oof_file_splits_rows_from_metadata(tmp_path):
    p = tmp_path / "r.json"
    p.write_text(json.dumps({
        "recipe_id": "demo", "loco_auc": 0.6,
        "oof": [{"country": "A", "year": 2000, "prob": 0.9, "label": 1}],
    }), encoding="utf-8")
    oof, meta = cr.load_oof_file(p)
    assert len(oof) == 1 and meta["recipe_id"] == "demo" and "oof" not in meta


# ------------------------------------------- cross-check against the published June sheet
def test_matches_published_sheet_confusion_matrix_for_currency_crisis():
    """The June sheet reported currency_crisis @0.5 as tp=19 fp=19 fn=31 tn=143
    (P 0.50 / R 0.38 / F1 0.43). Reconstruct that exact cell layout and confirm this module
    reproduces the published rates — guards against a silent convention flip (e.g. swapping
    the FP/FN corners) between the June sheet and this successor tool."""
    oof = (
        rows([("P", 2000 + i, 0.9, 1) for i in range(19)])      # tp
        + rows([("Q", 2000 + i, 0.9, 0) for i in range(19)])    # fp
        + rows([("R", 2000 + i, 0.1, 1) for i in range(31)])    # fn
        + rows([("S", 2000 + i, 0.1, 0) for i in range(143)])   # tn
    )
    c = cr.confusion_at(oof, 0.5)
    assert (c["tp"], c["fp"], c["fn"], c["tn"]) == (19, 19, 31, 143)
    assert c["precision"] == pytest.approx(0.50, abs=0.005)
    assert c["recall"] == pytest.approx(0.38, abs=0.005)
    assert c["f1"] == pytest.approx(0.43, abs=0.005)
