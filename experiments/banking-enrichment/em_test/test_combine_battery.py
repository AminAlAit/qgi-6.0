"""Unit tests for combine_battery.py's PURE combiner (PLAN.md §11 bar #6's BH-FDR-across-
candidates step + the final D1-D7 AND verdict). No pandas/numpy/sklearn needed.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import combine_battery as cb  # noqa: E402


def _battery(indicator, p_value, ci_lo, other_gates_pass=True):
    return {
        "indicator_id": indicator,
        "subset": "em",
        "d1_coverage_matched_baseline": {"gate_pass": other_gates_pass},
        "d2_missingness_placebo": {"gate_pass": other_gates_pass},
        "d3_income_proxy_beaten": {"gate_pass": other_gates_pass},
        "d4_era_2008_decomposition": {"gate_pass": other_gates_pass},
        "d5_per_country_named_twins": {"gate_pass": other_gates_pass},
        "d6_country_block_bootstrap_provisional": {
            "gate_pass_no_fdr": ci_lo is not None and ci_lo == ci_lo and ci_lo > 0,
            "delta": {"ci95_lo": ci_lo, "p_value": p_value},
        },
        "d7_temporal_holdout": {"gate_pass": other_gates_pass, "advisory": False},
    }


def test_combine_applies_bh_fdr_across_all_candidates_jointly():
    batteries = [
        _battery("stdebt_reserves", p_value=0.01, ci_lo=0.03),
        _battery("m2_reserves", p_value=0.20, ci_lo=0.01),
        _battery("credit_growth_3y_fd", p_value=0.5, ci_lo=-0.02),
    ]
    combined = cb.combine(batteries, fdr_q=0.10)
    assert len(combined) == 3
    # every entry gets a real fdr_reject bool (not the provisional True placeholder)
    for entry in combined:
        assert "fdr_reject" in entry["d6_final"]


def test_combine_marks_pass_all_7_only_when_every_gate_true_including_final_d6():
    batteries = [_battery("stdebt_reserves", p_value=0.001, ci_lo=0.05, other_gates_pass=True)]
    combined = cb.combine(batteries, fdr_q=0.10)
    entry = combined[0]
    # single candidate at p=0.001, alpha effectively unshrunk -> should reject null -> D6 pass
    assert entry["d6_final"]["fdr_reject"] is True
    assert entry["passes_all_7"] is True


def test_combine_fails_overall_if_any_gate_false_even_with_fdr_reject():
    batteries = [_battery("stdebt_reserves", p_value=0.001, ci_lo=0.05, other_gates_pass=False)]
    combined = cb.combine(batteries, fdr_q=0.10)
    assert combined[0]["passes_all_7"] is False


def test_combine_d6_fails_when_ci_lower_not_positive_regardless_of_fdr():
    batteries = [_battery("stdebt_reserves", p_value=0.001, ci_lo=-0.01, other_gates_pass=True)]
    combined = cb.combine(batteries, fdr_q=0.10)
    assert combined[0]["d6_final"]["gate_pass"] is False
    assert combined[0]["passes_all_7"] is False
