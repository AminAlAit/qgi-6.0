"""Tests for screen_coverage.py -- D1 coverage-at-positive-cells screen (mass_protest
enrichment cycle). Host-testable: pandas + pyarrow only.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import screen_coverage as sc  # noqa: E402

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
REAL_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
REAL_TRAP_PANEL_DIR = HERE / "mass_protest_trap_panel_dir"
REAL_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "mass_protest" / "positives.csv"


def _toy_panel(country: str, years: list[int], values: list[float | None]) -> pd.DataFrame:
    return pd.DataFrame({"country": [country] * len(years), "year": years, "value": values})


# ============================================================================================
# value_at_year
# ============================================================================================
def test_value_at_year_exact_match():
    panel = _toy_panel("Afghanistan", [1970, 1971], [0.1, 0.2])
    assert sc.value_at_year(panel, "Afghanistan", 1971) == pytest.approx(0.2)


def test_value_at_year_missing_row_returns_none():
    panel = _toy_panel("Afghanistan", [1970, 1972], [0.1, 0.3])
    assert sc.value_at_year(panel, "Afghanistan", 1971) is None


def test_value_at_year_null_value_returns_none():
    panel = _toy_panel("Afghanistan", [1970, 1971], [0.1, float("nan")])
    assert sc.value_at_year(panel, "Afghanistan", 1971) is None


def test_value_at_year_missing_country_returns_none():
    panel = _toy_panel("Afghanistan", [1970], [0.1])
    assert sc.value_at_year(panel, "Bolivia", 1970) is None


# ============================================================================================
# coverage_at_offset
# ============================================================================================
def test_coverage_at_offset_all_covered():
    panel = _toy_panel("Afghanistan", [1964, 1965], [1.0, 2.0])
    positives = pd.DataFrame({"country": ["Afghanistan"], "year": [1965]})
    n_covered, n_total = sc.coverage_at_offset(panel, positives, offset=1)
    assert (n_covered, n_total) == (1, 1)


def test_coverage_at_offset_missing_is_not_covered():
    panel = _toy_panel("Afghanistan", [1965], [2.0])  # no 1964 row
    positives = pd.DataFrame({"country": ["Afghanistan"], "year": [1965]})
    n_covered, n_total = sc.coverage_at_offset(panel, positives, offset=1)
    assert (n_covered, n_total) == (0, 1)


# ============================================================================================
# coverage_at_positive_cells_t1_and_t2 -- the AND-of-both-offsets statistic
# ============================================================================================
def test_coverage_t1_and_t2_both_present_counts_as_covered():
    panel = _toy_panel("Afghanistan", [1963, 1964, 1965], [1.0, 2.0, 3.0])
    positives = pd.DataFrame({"country": ["Afghanistan"], "year": [1965]})
    stats = sc.coverage_at_positive_cells_t1_and_t2(panel, positives)
    assert stats["n_t1_and_t2_covered"] == 1
    assert stats["t1_and_t2_coverage_pct"] == 100.0


def test_coverage_t1_and_t2_only_t1_present_does_not_count():
    panel = _toy_panel("Afghanistan", [1964, 1965], [2.0, 3.0])  # no 1963 (t-2)
    positives = pd.DataFrame({"country": ["Afghanistan"], "year": [1965]})
    stats = sc.coverage_at_positive_cells_t1_and_t2(panel, positives)
    assert stats["n_t1_covered"] == 1
    assert stats["n_t2_covered"] == 0
    assert stats["n_t1_and_t2_covered"] == 0
    assert stats["t1_and_t2_coverage_pct"] == 0.0


def test_coverage_t1_and_t2_mixed_events():
    panel = _toy_panel(
        "Afghanistan", [1963, 1964, 1965, 2011, 2012], [1.0, 2.0, 3.0, 5.0, 6.0]
    )  # 2012 event: t-1=2011 present, t-2=2010 MISSING
    positives = pd.DataFrame({"country": ["Afghanistan", "Afghanistan"], "year": [1965, 2012]})
    stats = sc.coverage_at_positive_cells_t1_and_t2(panel, positives)
    assert stats["n_total"] == 2
    assert stats["n_t1_covered"] == 2  # both have t-1
    assert stats["n_t2_covered"] == 1  # only 1965 has t-2
    assert stats["n_t1_and_t2_covered"] == 1
    assert stats["t1_and_t2_coverage_pct"] == 50.0


# ============================================================================================
# d1_verdict
# ============================================================================================
def test_d1_verdict_passes_at_or_above_threshold():
    assert sc.d1_verdict(80.0, threshold=0.80) == "PASS_COVERAGE"
    assert sc.d1_verdict(95.0, threshold=0.80) == "PASS_COVERAGE"


def test_d1_verdict_fails_below_threshold():
    assert sc.d1_verdict(79.9, threshold=0.80) == "FAIL_COVERAGE"


# ============================================================================================
# normalize_country_id parity (must match build_mass_protest_trap.py's copy)
# ============================================================================================
def test_normalize_country_id_matches_trap_module():
    sys.path.insert(0, str(HERE))
    import build_mass_protest_trap as bmpt  # noqa: E402
    sample_ids = ["afghanistan", "democratic_republic_of_congo", "south_korea", "ivory_coast"]
    for cid in sample_ids:
        assert sc.normalize_country_id(cid) == bmpt.normalize_country_id(cid)


# ============================================================================================
# screen_candidate / run_screen_all -- real panel data (host-only, no Docker)
# ============================================================================================
def test_screen_candidate_missing_panel_reports_missing():
    positives = pd.DataFrame({"country": ["Afghanistan"], "year": [1965]})
    result = sc.screen_candidate("NOT.A.REAL.INDICATOR", REAL_PANEL_DIR, positives)
    assert result["verdict"] == "MISSING_PANEL"


@pytest.mark.parametrize(
    "indicator_id",
    ["AG.PRD.FOOD.XD", "NY.GDP.MKTP.KD.ZG", "OWID_POP_YOUNG", "FP.CPI.TOTL.ZG", "v2x_regime",
     "NY.GNP.PCAP.CD"],
)
def test_screen_candidate_real_data_produces_a_verdict(indicator_id):
    if not REAL_POSITIVES_CSV.exists() or not REAL_PANEL_DIR.exists():
        pytest.skip("real data files not present in this checkout")
    positives = sc._load_positives(REAL_POSITIVES_CSV)
    result = sc.screen_candidate(indicator_id, REAL_PANEL_DIR, positives)
    assert result["indicator_id"] == indicator_id
    assert result["verdict"] in ("PASS_COVERAGE", "FAIL_COVERAGE")
    assert 0.0 <= result["t1_and_t2_coverage_pct"] <= 100.0
    assert result["n_total"] == 336


def test_screen_candidate_protest_trap_features_are_fully_covered_by_construction():
    """The D4 protest-trap panels are a cartesian derived transform (every country x year in
    [1900,2023] has a value) -- coverage must be 100% at both t-1 and t-2."""
    if not REAL_POSITIVES_CSV.exists() or not REAL_TRAP_PANEL_DIR.exists():
        pytest.skip("real trap panel not built in this checkout (run build_mass_protest_trap.py)")
    positives = sc._load_positives(REAL_POSITIVES_CSV)
    for ind in ("prior_mass_protest_count", "years_since_last_mass_protest"):
        result = sc.screen_candidate(ind, REAL_TRAP_PANEL_DIR, positives)
        assert result["verdict"] == "PASS_COVERAGE"
        assert result["t1_and_t2_coverage_pct"] == 100.0


def test_run_screen_all_end_to_end():
    if not REAL_POSITIVES_CSV.exists() or not REAL_TRAP_PANEL_DIR.exists():
        pytest.skip("real data / trap panel not present in this checkout")
    out = sc.run_screen_all(out_path=None)
    assert out["n_positive_events"] == 336
    assert set(out["candidates"].keys()) == set(sc.CANDIDATES)
    # every candidate must resolve to one of the three known verdict buckets
    all_bucketed = set(out["survivors"]) | set(out["rejected"]) | set(out["missing_panel"])
    assert all_bucketed == set(sc.CANDIDATES)
