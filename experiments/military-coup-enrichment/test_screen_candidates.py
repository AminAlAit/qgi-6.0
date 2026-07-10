"""Tests for screen_candidates.py's pure logic (verdict combination). The coverage numbers
themselves come from `run_f_ml_1_poc.build_X_y` / `coverage_report` -- Docker-only, exercised
by `run_screen.py` (no dedicated host test, same precedent as
`experiments/banking-enrichment/widenet/baseline_harness.py`, which has no test file for its
own Docker-only `run_harness`)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import screen_candidates as sc  # noqa: E402


def test_coverage_screen_pass_when_all_thresholds_met():
    verdict = sc.coverage_verdict(
        pos_coverage=0.90, n_pos_survive=150, n_countries_survive=40,
        min_pos_coverage=0.50, min_pos_survive=30, min_countries=10,
    )
    assert verdict == "PASS"


def test_coverage_screen_fail_on_low_pos_coverage():
    verdict = sc.coverage_verdict(
        pos_coverage=0.30, n_pos_survive=60, n_countries_survive=40,
        min_pos_coverage=0.50, min_pos_survive=30, min_countries=10,
    )
    assert verdict == "COVERAGE_FAIL"


def test_coverage_screen_fail_on_too_few_countries():
    verdict = sc.coverage_verdict(
        pos_coverage=0.90, n_pos_survive=150, n_countries_survive=5,
        min_pos_coverage=0.50, min_pos_survive=30, min_countries=10,
    )
    assert verdict == "COVERAGE_FAIL"


def test_combined_verdict_requires_both_coverage_and_d3():
    assert sc.combined_verdict("PASS", "PASS_ORTHOGONAL") == "SCREEN_PASS"
    assert sc.combined_verdict("COVERAGE_FAIL", "PASS_ORTHOGONAL") == "SCREEN_FAIL"
    assert sc.combined_verdict("PASS", "REJECT_COLLINEAR") == "SCREEN_FAIL"
    assert sc.combined_verdict("PASS", None) == "SCREEN_PASS"  # non-V-Dem candidate: no D3 gate
