"""Unit tests for baseline_harness.py's PURE helper functions (greedy-result parsing +
pairing-coverage diagnostics). No ML stack needed -- these are stdlib/json + arithmetic only.
The harness's main() orchestration (ss._final_fit / sp.pair_oof / sp.paired_bootstrap_delta_auc)
reuses already-unit-tested library functions and only runs for real inside Docker after a
completed greedy walk -- same precedent as p1/p2_evaluate.py, which has no dedicated test file
for its own thin main().
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import baseline_harness as bh  # noqa: E402


def _write_greedy_result(path: Path, selected, window, early_abort=False, final_auc=0.7):
    payload = {
        "schema_version": 1,
        "config_signature": "abc123",
        "written_at_utc": "2026-07-10T00:00:00+00:00",
        "state": {"selected": selected, "step": len(selected)},
        "result": {
            "selected_indicators": selected,
            "chosen_window": window,
            "final_global_auc": final_auc,
            "history": [],
            "early_abort_floor_unreachable": early_abort,
        },
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_load_selected_set_happy_path(tmp_path):
    p = tmp_path / "greedy-result.json"
    _write_greedy_result(p, ["credit_growth_3y_fd", "NV.SRV.TOTL.ZS"], 10)
    selected, window, early_abort = bh.load_selected_set(p)
    assert selected == ["credit_growth_3y_fd", "NV.SRV.TOTL.ZS"]
    assert window == 10
    assert early_abort is False


def test_load_selected_set_flags_early_abort(tmp_path):
    p = tmp_path / "greedy-result.json"
    _write_greedy_result(p, ["a"], 5, early_abort=True)
    _selected, _window, early_abort = bh.load_selected_set(p)
    assert early_abort is True


def test_load_selected_set_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        bh.load_selected_set(tmp_path / "does-not-exist.json")


def test_load_selected_set_empty_selection_raises(tmp_path):
    """An empty selected_indicators list means the greedy walk selected NOTHING -- a candidate
    fit against zero drivers is meaningless; fail loud rather than silently comparing baseline
    to an empty set."""
    p = tmp_path / "greedy-result.json"
    _write_greedy_result(p, [], None)
    with pytest.raises(ValueError, match="empty"):
        bh.load_selected_set(p)


def test_pairing_diagnostics_full_coverage_not_flagged():
    pairing = {"n_pairs": 100, "n_a": 100, "n_b": 100}
    diag = bh.pairing_diagnostics(pairing)
    assert diag["pair_fraction_of_a"] == 1.0
    assert diag["pair_fraction_of_b"] == 1.0
    assert diag["severe_coverage_mismatch"] is False


def test_pairing_diagnostics_severe_mismatch_flagged():
    """Mirrors the exact run-3.1 postmortem failure mode: the candidate arm's coverage
    collapses relative to the baseline, so the paired set shrinks drastically even though
    n_pairs > 0."""
    pairing = {"n_pairs": 10, "n_a": 10, "n_b": 200}
    diag = bh.pairing_diagnostics(pairing)
    assert diag["pair_fraction_of_a"] == 1.0
    assert diag["pair_fraction_of_b"] == pytest.approx(0.05)
    assert diag["severe_coverage_mismatch"] is True


def test_pairing_diagnostics_zero_pairs_is_severe():
    pairing = {"n_pairs": 0, "n_a": 50, "n_b": 60}
    diag = bh.pairing_diagnostics(pairing)
    assert diag["severe_coverage_mismatch"] is True
    assert diag["pair_fraction_of_a"] == 0.0
    assert diag["pair_fraction_of_b"] == 0.0


def test_pairing_diagnostics_custom_threshold():
    pairing = {"n_pairs": 60, "n_a": 100, "n_b": 100}  # 0.60 both sides
    assert bh.pairing_diagnostics(pairing, min_pair_fraction=0.5)["severe_coverage_mismatch"] is False
    assert bh.pairing_diagnostics(pairing, min_pair_fraction=0.7)["severe_coverage_mismatch"] is True
