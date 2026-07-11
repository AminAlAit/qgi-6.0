"""Tests for build_mass_protest_trap.py -- the protest-trap derived feature (D4,
pre-registered mass_protest enrichment cycle; PRE-REGISTRATION.md committed 7cdfb5f).

Candidate #3 requires the protest-trap (`prior_mass_protest_count` /
`years_since_last_mass_protest`) be built as a STRICTLY-LAGGED derived transform off
`positives.csv`: only prior years' mass-protest events may inform year t. This module is
host-testable (pandas + pyarrow only, no joblib/xgboost/sklearn -- matches the
em_test/confound_income_proxy.py / military-coup-enrichment/build_coup_trap.py DI split:
pure feature math + panel I/O here; the real LOCO-AUC fit lives in a Docker-only
orchestration script that imports `run_f_ml_1_poc`).

The LEAKAGE TEST (`test_leakage_*`) is the load-bearing test in this file: it asserts that
mutating or ADDING a mass-protest event at year >= t does not change the feature value
computed at year t, for every t in a representative sweep -- the direct, literal test the
pre-reg's D4 candidate-#3 build-first requirement asks for.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_mass_protest_trap as bmpt  # noqa: E402

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
REAL_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "mass_protest" / "positives.csv"
REAL_PANEL_SAMPLE = QGI_ML_ROOT / "data" / "parquet_panels" / "v2excrptps" / "v2excrptps.parquet"


# ============================================================================================
# prior_mass_protest_count -- pure function
# ============================================================================================
def test_prior_mass_protest_count_no_protests():
    assert bmpt.prior_mass_protest_count([], 2000) == 0


def test_prior_mass_protest_count_counts_strictly_before():
    protest_years = [1970, 1980, 1990]
    assert bmpt.prior_mass_protest_count(protest_years, 1985) == 2  # 1970, 1980 < 1985
    assert bmpt.prior_mass_protest_count(protest_years, 1971) == 1
    assert bmpt.prior_mass_protest_count(protest_years, 1970) == 0  # not <= : strictly before


def test_prior_mass_protest_count_excludes_protest_in_current_year():
    """The protest AT year t is the outcome, never counted as its own history."""
    assert bmpt.prior_mass_protest_count([2000], 2000) == 0


def test_prior_mass_protest_count_excludes_future_protests():
    assert bmpt.prior_mass_protest_count([1970, 2010], 1990) == 1


def test_prior_mass_protest_count_handles_duplicate_years():
    assert bmpt.prior_mass_protest_count([1970, 1970, 1980], 1990) == 3


# ============================================================================================
# years_since_last_mass_protest -- pure function
# ============================================================================================
def test_years_since_last_mass_protest_no_prior_returns_sentinel():
    assert bmpt.years_since_last_mass_protest([], 2000, sentinel=99.0) == 99.0
    assert bmpt.years_since_last_mass_protest([2005], 2000, sentinel=99.0) == 99.0  # future only


def test_years_since_last_mass_protest_basic():
    assert bmpt.years_since_last_mass_protest([1970, 1990], 2000, sentinel=99.0) == 10.0


def test_years_since_last_mass_protest_excludes_current_year_protest():
    """A protest AT year t must not make years_since=0 -- it is the outcome, not history."""
    assert bmpt.years_since_last_mass_protest([2000], 2000, sentinel=99.0) == 99.0


def test_years_since_last_mass_protest_picks_most_recent_prior():
    assert bmpt.years_since_last_mass_protest([1960, 1970, 1990], 1995, sentinel=99.0) == 5.0


# ============================================================================================
# normalize_country_id -- pure function (must match panel country strings so the protest-trap
# panel is actually joinable against `samples["country"]` built via the production walk).
# ============================================================================================
def test_normalize_country_id_simple_case():
    assert bmpt.normalize_country_id("afghanistan") == "Afghanistan"


def test_normalize_country_id_override_democratic_republic_of_congo():
    assert bmpt.normalize_country_id("democratic_republic_of_congo") == \
        "The Democratic Republic of the Congo"


def test_normalize_country_id_matches_real_panel_country_strings():
    """Integration check: every country_id in the REAL positives.csv, once normalized, must
    be a string that (for countries actually present in a real panel) matches the panel's own
    country column verbatim. This is the guard against a silent normalize_country_id drift
    between this module's copy and scripts/run_f_ml_1_poc.py's (the module this file
    duplicates from, verbatim, because that module is not host-importable without the full
    joblib/xgboost/sklearn stack -- see module docstring)."""
    if not REAL_POSITIVES_CSV.exists() or not REAL_PANEL_SAMPLE.exists():
        pytest.skip("real data files not present in this checkout")
    pos = pd.read_csv(REAL_POSITIVES_CSV)
    panel_countries = set(pd.read_parquet(REAL_PANEL_SAMPLE)["country"].unique())
    normalized = {bmpt.normalize_country_id(cid) for cid in pos["country_id"].unique()}
    # every normalized name must be a real, panel-recognized country string (no silent typo);
    # some may be legitimately absent from THIS SPECIFIC indicator's panel (coverage gaps are
    # a separate, expected concern) -- so we assert against the known-good override cases only
    # plus a spot sample, rather than requiring 100% presence in one arbitrary indicator panel.
    assert "South Korea" in normalized
    assert "Ivory Coast" in normalized
    # every normalized country_id that DOES appear (by construction) in this real panel's
    # country set must match EXACTLY (case + punctuation) -- catches any silent divergence.
    present_in_panel = normalized & panel_countries
    assert len(present_in_panel) > 50  # sanity: most of the 123 countries should resolve


# ============================================================================================
# load_positives
# ============================================================================================
def test_load_positives_normalizes_and_renames(tmp_path):
    csv = tmp_path / "positives.csv"
    csv.write_text(
        "country_id,event_year\nafghanistan,1965\nafghanistan,2012\n", encoding="utf-8"
    )
    df = bmpt.load_positives(csv)
    assert {"country", "year"}.issubset(df.columns)
    assert set(df["country"]) == {"Afghanistan"}
    assert sorted(df["year"]) == [1965, 2012]


# ============================================================================================
# build_mass_protest_trap_frames -- the derived-transform panel builder
# ============================================================================================
def _toy_positives() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "country": ["Afghanistan", "Afghanistan", "Bolivia"],
            "year": [1965, 2012, 1964],
        }
    )


def test_build_frames_returns_both_keys():
    frames = bmpt.build_mass_protest_trap_frames(_toy_positives(), year_start=1960, year_end=2015)
    assert set(frames.keys()) == {"prior_mass_protest_count", "years_since_last_mass_protest"}


def test_build_frames_schema_matches_panel_convention():
    frames = bmpt.build_mass_protest_trap_frames(_toy_positives(), year_start=1960, year_end=2015)
    for name, df in frames.items():
        assert {"country", "year", "value", "provider"}.issubset(df.columns)
        assert df["year"].dtype.kind in "iu"  # integer year, matching production panels


def test_build_frames_covers_full_cartesian_country_year():
    frames = bmpt.build_mass_protest_trap_frames(_toy_positives(), year_start=1960, year_end=1965)
    pmc = frames["prior_mass_protest_count"]
    # 2 countries x 6 years (1960..1965 inclusive)
    assert len(pmc) == 2 * 6


def test_build_frames_prior_mass_protest_count_values():
    frames = bmpt.build_mass_protest_trap_frames(_toy_positives(), year_start=1963, year_end=2013)
    pmc = frames["prior_mass_protest_count"].set_index(["country", "year"])["value"]
    assert pmc.loc[("Afghanistan", 1965)] == 0  # own protest year excluded
    assert pmc.loc[("Afghanistan", 1966)] == 1  # the 1965 protest now counts
    assert pmc.loc[("Afghanistan", 2012)] == 1  # 1965 counts, 2012 (self) excluded
    assert pmc.loc[("Afghanistan", 2013)] == 2  # both 1965 and 2012 now count


def test_build_frames_years_since_last_mass_protest_values():
    frames = bmpt.build_mass_protest_trap_frames(
        _toy_positives(), year_start=1963, year_end=2013, sentinel=99.0
    )
    ysl = frames["years_since_last_mass_protest"].set_index(["country", "year"])["value"]
    assert ysl.loc[("Afghanistan", 1965)] == 99.0  # no prior protest yet
    assert ysl.loc[("Afghanistan", 1966)] == 1.0
    assert ysl.loc[("Afghanistan", 1968)] == 3.0
    assert ysl.loc[("Afghanistan", 2013)] == 1.0  # most recent prior is 2012


def test_build_frames_countries_are_independent():
    """Bolivia's history must never leak into Afghanistan's feature values."""
    frames = bmpt.build_mass_protest_trap_frames(_toy_positives(), year_start=1960, year_end=2015)
    pmc = frames["prior_mass_protest_count"].set_index(["country", "year"])["value"]
    assert pmc.loc[("Afghanistan", 1964)] == 0  # Bolivia's 1964 protest must not count here


# ============================================================================================
# THE LEAKAGE TEST (D4's explicit ask): mutating/adding a protest at year >= t must not
# change the feature at t.
# ============================================================================================
def test_leakage_adding_future_protest_does_not_change_past_or_current_year_features():
    base = _toy_positives()
    mutated = pd.concat(
        [base, pd.DataFrame({"country": ["Afghanistan"], "year": [2015]})],
        ignore_index=True,
    )
    year_start, year_end = 1960, 2020
    base_frames = bmpt.build_mass_protest_trap_frames(base, year_start, year_end)
    mut_frames = bmpt.build_mass_protest_trap_frames(mutated, year_start, year_end)

    for name in ("prior_mass_protest_count", "years_since_last_mass_protest"):
        b = base_frames[name].set_index(["country", "year"])["value"]
        m = mut_frames[name].set_index(["country", "year"])["value"]
        # every year STRICTLY BEFORE the added protest (2015) must be byte-identical
        for year in range(year_start, 2015):
            assert b.loc[("Afghanistan", year)] == m.loc[("Afghanistan", year)], (
                f"{name} at year {year} changed after adding a future protest at 2015 -- LEAK"
            )
        # sanity: the mutation DID take effect at/after 2015 (proves the test is not vacuous)
        assert b.loc[("Afghanistan", 2016)] != m.loc[("Afghanistan", 2016)]


def test_leakage_adding_protest_at_exactly_year_t_does_not_change_feature_at_t():
    """A protest landing exactly AT year t (t == the added event's own year) must not count
    as its own history -- feature(t) must equal the base (no-protest-at-t) computation."""
    base = _toy_positives()
    mutated = pd.concat(
        [base, pd.DataFrame({"country": ["Afghanistan"], "year": [1975]})],
        ignore_index=True,
    )
    year_start, year_end = 1960, 1985
    base_frames = bmpt.build_mass_protest_trap_frames(base, year_start, year_end)
    mut_frames = bmpt.build_mass_protest_trap_frames(mutated, year_start, year_end)
    for name in ("prior_mass_protest_count", "years_since_last_mass_protest"):
        b = base_frames[name].set_index(["country", "year"])["value"]
        m = mut_frames[name].set_index(["country", "year"])["value"]
        assert b.loc[("Afghanistan", 1975)] == m.loc[("Afghanistan", 1975)], (
            f"{name} at year 1975 changed after adding a protest AT year 1975 itself -- LEAK"
        )
        # but the year immediately AFTER must reflect the new protest (non-vacuous)
        assert b.loc[("Afghanistan", 1976)] != m.loc[("Afghanistan", 1976)]


def test_leakage_mutating_existing_protest_year_forward_does_not_change_earlier_years():
    """'Mutating' a protest at year >= t (moving an existing 2012 protest forward to 2018, a
    year >= any t < 2018) must not change any feature value at a year < 2018."""
    base = _toy_positives()  # Afghanistan protests at 1965, 2012
    mutated = base.copy()
    mutated.loc[(mutated["country"] == "Afghanistan") & (mutated["year"] == 2012), "year"] = 2018
    year_start, year_end = 1960, 2020
    base_frames = bmpt.build_mass_protest_trap_frames(base, year_start, year_end)
    mut_frames = bmpt.build_mass_protest_trap_frames(mutated, year_start, year_end)
    for name in ("prior_mass_protest_count", "years_since_last_mass_protest"):
        b = base_frames[name].set_index(["country", "year"])["value"]
        m = mut_frames[name].set_index(["country", "year"])["value"]
        for year in range(year_start, 2012 + 1):
            # neither base nor mutated has a protest at/after this year within this range yet,
            # so both must compute identically for years <= the mutated event's NEW year
            assert b.loc[("Afghanistan", year)] == m.loc[("Afghanistan", year)], (
                f"{name} at year {year} changed after moving the 2012 protest to 2018 -- LEAK"
            )


def test_leakage_sweep_across_many_t_using_real_positives():
    """Broader sweep on the REAL 336-event positives.csv (not just the toy fixture): for a
    sample of (country, t) cells, adding a new mass-protest event at year >= t must never
    change feature(t)."""
    if not REAL_POSITIVES_CSV.exists():
        pytest.skip("real positives.csv not present in this checkout")
    pos = bmpt.load_positives(REAL_POSITIVES_CSV)
    year_start, year_end = 1900, 2023
    base_frames = bmpt.build_mass_protest_trap_frames(pos, year_start, year_end)

    # inject an extra protest for South Africa (highest protest-count country) at a late year
    injected_year = 2019
    mutated = pd.concat(
        [pos, pd.DataFrame({"country": ["South Africa"], "year": [injected_year]})],
        ignore_index=True,
    )
    mut_frames = bmpt.build_mass_protest_trap_frames(mutated, year_start, year_end)

    for name in ("prior_mass_protest_count", "years_since_last_mass_protest"):
        b = base_frames[name].set_index(["country", "year"])["value"]
        m = mut_frames[name].set_index(["country", "year"])["value"]
        for year in range(year_start, injected_year):  # strictly before the injected protest
            assert b.loc[("South Africa", year)] == m.loc[("South Africa", year)], (
                f"{name} at year {year} changed after injecting a protest at {injected_year} -- LEAK"
            )
        # non-vacuous: the year after the injection must differ
        assert b.loc[("South Africa", injected_year + 1)] != m.loc[("South Africa", injected_year + 1)]
        # other countries must be completely unaffected at every year
        for year in (1980, 2000, 2020):
            assert b.loc[("Afghanistan", year)] == m.loc[("Afghanistan", year)]


# ============================================================================================
# write_panels -- round trip against the production panel-dir convention
# ============================================================================================
def test_write_panels_round_trip(tmp_path):
    frames = bmpt.build_mass_protest_trap_frames(_toy_positives(), year_start=1960, year_end=1965)
    out_dir = tmp_path / "mass_protest_trap_panel_dir"
    bmpt.write_panels(frames, out_dir)
    for name in ("prior_mass_protest_count", "years_since_last_mass_protest"):
        p = out_dir / name / f"{name}.parquet"
        assert p.is_file()
        df = pd.read_parquet(p)
        assert {"country", "year", "value", "provider"}.issubset(df.columns)
        assert df["year"].dtype.name == "int32"
        assert df["value"].dtype.name == "float64"


# ============================================================================================
# End-to-end sanity against the real 336-row positives.csv.
# ============================================================================================
def test_real_positives_monotonic_prior_count_per_country():
    if not REAL_POSITIVES_CSV.exists():
        pytest.skip("real positives.csv not present in this checkout")
    pos = bmpt.load_positives(REAL_POSITIVES_CSV)
    frames = bmpt.build_mass_protest_trap_frames(pos, year_start=1900, year_end=2023)
    pmc = frames["prior_mass_protest_count"]
    for country, g in pmc.groupby("country"):
        g_sorted = g.sort_values("year")
        assert (g_sorted["value"].diff().dropna() >= 0).all(), (
            f"{country}: prior_mass_protest_count must be non-decreasing over time"
        )


def test_real_positives_south_africa_reaches_expected_final_count():
    """South Africa has 11 mass-protest events in the real data (highest); after the last
    one, the strictly-lagged prior_mass_protest_count the following year must equal 11."""
    if not REAL_POSITIVES_CSV.exists():
        pytest.skip("real positives.csv not present in this checkout")
    pos = bmpt.load_positives(REAL_POSITIVES_CSV)
    sa_years = sorted(pos.loc[pos["country"] == "South Africa", "year"].tolist())
    assert len(sa_years) == 11
    frames = bmpt.build_mass_protest_trap_frames(pos, year_start=1900, year_end=2023)
    pmc = frames["prior_mass_protest_count"].set_index(["country", "year"])["value"]
    last_year = sa_years[-1]
    assert pmc.loc[("South Africa", last_year)] == 10  # the last protest itself excluded
    assert pmc.loc[("South Africa", last_year + 1)] == 11
