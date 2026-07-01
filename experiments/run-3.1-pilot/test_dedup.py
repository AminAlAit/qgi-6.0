"""Unit tests for ``dedup.dedup_candidates`` (run-3.1 pilot collinearity dedup).

Fixtures are fully synthetic, in-memory panels/samples (no parquet, no AWS), so the
suite runs against the same production feature extractor (``build_X_y`` /
``extract_features_for_indicator``) the pilot uses, without the parquet substrate.

Requires: numpy, pandas, joblib, scipy (importing the walk pulls beta_calibration →
scipy). xgboost/sklearn are NOT needed — the dedup path only calls ``build_X_y``.

Core cases mandated by the build brief:
  * three near-duplicate indicators (mean |r| > 0.9) collapse to ONE cluster whose
    representative is the top-univariate member;
  * uncorrelated indicators are each kept as their own singleton.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dedup  # noqa: E402


# --------------------------------------------------------------------------- #
# Synthetic substrate                                                         #
# --------------------------------------------------------------------------- #
N_COUNTRIES = 40
YEARS = list(range(1985, 2021))          # dense panel → every window is populated
SAMPLE_YEARS = (2005, 2013)              # 2 sample years/country → 80 distinct rows
COUNTRIES = [f"C{ci:02d}" for ci in range(N_COUNTRIES)]


def _base_signal(ci: int, year: int) -> float:
    """A richly country-varying signal so ALL 8 engineered features carry large
    cross-row variance (level, trend, amplitude, phase all depend on country).
    That makes the shared-signal variance dominate the tiny per-indicator noise,
    so near-duplicate indicators correlate ~1 on every feature column."""
    amp = 2.0 + 0.25 * ci
    trend = 0.15 + 0.06 * ci
    phase = 0.7 * ci
    return 5.0 + 1.2 * ci + trend * (year - 2000) + amp * math.sin(0.5 * year + phase)


def _panel_from(value_fn) -> pd.DataFrame:
    rows = [
        {"country": COUNTRIES[ci], "year": yr, "value": float(value_fn(ci, yr))}
        for ci in range(N_COUNTRIES)
        for yr in YEARS
    ]
    return pd.DataFrame(rows)


def _near_duplicate_panel(noise_seed: int, noise_std: float = 0.02) -> pd.DataFrame:
    """Base signal + tiny INDEPENDENT noise → a near-duplicate (not identical) panel."""
    rng = np.random.default_rng(noise_seed)
    noise = {
        (ci, yr): float(rng.normal(0.0, noise_std))
        for ci in range(N_COUNTRIES)
        for yr in YEARS
    }
    return _panel_from(lambda ci, yr: _base_signal(ci, yr) + noise[(ci, yr)])


def _independent_panel(seed: int) -> pd.DataFrame:
    """Independent white-noise panel → uncorrelated with the base signal and with
    every other independent panel (features are structurally unrelated)."""
    rng = np.random.default_rng(seed)
    vals = {
        (ci, yr): float(rng.normal(50.0, 10.0))
        for ci in range(N_COUNTRIES)
        for yr in YEARS
    }
    return _panel_from(lambda ci, yr: vals[(ci, yr)])


@pytest.fixture(scope="module")
def fixture():
    """5 indicators: dup_a/dup_b/dup_c near-duplicate; indep_d/indep_e independent."""
    panels = {
        "dup_a": _near_duplicate_panel(noise_seed=101),
        "dup_b": _near_duplicate_panel(noise_seed=202),
        "dup_c": _near_duplicate_panel(noise_seed=303),
        "indep_d": _independent_panel(seed=404),
        "indep_e": _independent_panel(seed=505),
    }
    rows = []
    for ci in range(N_COUNTRIES):
        for k, yr in enumerate(SAMPLE_YEARS):
            rows.append({"country": COUNTRIES[ci], "year": yr, "label": (ci + k) % 2})
    samples = pd.DataFrame(rows)
    # dup_b is the clear top-univariate of the near-duplicate trio → expected rep.
    scores = {
        "dup_a": {"univariate_loco_auc": 0.61},
        "dup_b": {"univariate_loco_auc": 0.74},
        "dup_c": {"univariate_loco_auc": 0.58},
        "indep_d": {"univariate_loco_auc": 0.66},
        "indep_e": {"univariate_loco_auc": 0.63},
    }
    candidates = ["dup_a", "dup_b", "dup_c", "indep_d", "indep_e"]
    return candidates, panels, samples, scores


# --------------------------------------------------------------------------- #
# Sanity: the fixture actually realises the r>0.9 / r~0 structure it claims    #
# --------------------------------------------------------------------------- #
def test_fixture_realises_expected_correlation_structure(fixture):
    """Guard the fixture itself: near-dup pairs have mean|r| > 0.9, cross pairs < 0.85.
    A drifted fixture would make the real assertions vacuous, so pin it explicitly."""
    candidates, panels, samples, _ = fixture
    feats = {c: dedup._feature_map(c, samples, panels, dedup.DEFAULT_WINDOW) for c in candidates}

    for a, b in [("dup_a", "dup_b"), ("dup_a", "dup_c"), ("dup_b", "dup_c")]:
        m = dedup._mean_abs_r(feats[a], feats[b], dedup.DEFAULT_MIN_COMMON)
        assert m is not None and m > 0.9, f"near-dup {a},{b} mean|r|={m}"

    cross = [
        ("dup_a", "indep_d"), ("dup_b", "indep_e"), ("dup_c", "indep_d"),
        ("indep_d", "indep_e"),
    ]
    for a, b in cross:
        m = dedup._mean_abs_r(feats[a], feats[b], dedup.DEFAULT_MIN_COMMON)
        assert m is not None and m < 0.85, f"uncorrelated {a},{b} mean|r|={m}"


# --------------------------------------------------------------------------- #
# Core brief requirements                                                     #
# --------------------------------------------------------------------------- #
def test_near_duplicates_collapse_to_top_univariate(fixture):
    """3 near-duplicate indicators → ONE cluster, represented by the top-univariate."""
    candidates, panels, samples, scores = fixture
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, scores,
                                               abs_r_threshold=0.85)
    # The dup trio collapsed to exactly one survivor: the top-univariate dup_b.
    assert "dup_b" in kept
    assert "dup_a" not in kept and "dup_c" not in kept
    assert cluster_map["dup_b"] == ["dup_a", "dup_b", "dup_c"]


def test_uncorrelated_indicators_all_kept(fixture):
    """Independent indicators survive as their own singleton clusters."""
    candidates, panels, samples, scores = fixture
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, scores,
                                               abs_r_threshold=0.85)
    assert "indep_d" in kept and "indep_e" in kept
    assert cluster_map["indep_d"] == ["indep_d"]
    assert cluster_map["indep_e"] == ["indep_e"]


def test_survivor_count_and_partition_invariants(fixture):
    """kept == 3 survivors; cluster_map is a FULL, disjoint partition of candidates."""
    candidates, panels, samples, scores = fixture
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, scores)
    assert sorted(kept) == ["dup_b", "indep_d", "indep_e"]
    assert set(kept) == set(cluster_map)
    # every candidate in exactly one cluster; reps are members of their own cluster.
    all_members = [m for members in cluster_map.values() for m in members]
    assert sorted(all_members) == sorted(candidates)
    assert len(all_members) == len(candidates)  # disjoint (no double-count)
    for rep, members in cluster_map.items():
        assert rep in members


# --------------------------------------------------------------------------- #
# Determinism, tie-breaks, threshold + gate behaviour, edge cases             #
# --------------------------------------------------------------------------- #
def test_deterministic_repeat_calls(fixture):
    """Same inputs → byte-identical outputs (no RNG, no ordering nondeterminism)."""
    candidates, panels, samples, scores = fixture
    out1 = dedup.dedup_candidates(candidates, panels, samples, scores)
    out2 = dedup.dedup_candidates(list(reversed(candidates)), panels, samples, scores)
    assert out1 == out2  # input order must not matter


def test_representative_tie_break_is_lexicographic(fixture):
    """On equal univariate scores the lexicographically smallest id is the rep."""
    candidates, panels, samples, _ = fixture
    tied = {c: {"univariate_loco_auc": 0.70} for c in candidates}
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, tied)
    assert "dup_a" in kept                      # smallest name in the tied dup cluster
    assert cluster_map["dup_a"] == ["dup_a", "dup_b", "dup_c"]


def test_nan_score_never_beats_real_score(fixture):
    """A NaN/absent-scored member is never chosen over a real-scored cluster member."""
    candidates, panels, samples, _ = fixture
    scores = {
        "dup_a": {"univariate_loco_auc": float("nan")},  # smallest name, but NaN
        "dup_b": {"univariate_loco_auc": 0.55},
        "dup_c": {"univariate_loco_auc": float("nan")},
        # indep_* intentionally omitted → treated as -inf, still singleton reps.
    }
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, scores)
    assert cluster_map["dup_b"] == ["dup_a", "dup_b", "dup_c"]  # real score wins rep
    assert "indep_d" in kept and "indep_e" in kept


def test_plain_float_scores_supported(fixture):
    """A ``{ind: float}`` score mapping works as well as the nested production form."""
    candidates, panels, samples, _ = fixture
    scores = {"dup_a": 0.61, "dup_b": 0.74, "dup_c": 0.58, "indep_d": 0.66, "indep_e": 0.63}
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, scores)
    assert cluster_map["dup_b"] == ["dup_a", "dup_b", "dup_c"]


def test_min_common_gate_blocks_merges(fixture):
    """When too few rows are shared to judge collinearity, nothing merges."""
    candidates, panels, samples, scores = fixture
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, scores,
                                               min_common=10_000)
    assert sorted(kept) == sorted(candidates)
    for c in candidates:
        assert cluster_map[c] == [c]


def test_high_threshold_prevents_all_merges(fixture):
    """A threshold above any achievable mean|r| leaves every indicator a singleton."""
    candidates, panels, samples, scores = fixture
    kept, _ = dedup.dedup_candidates(candidates, panels, samples, scores,
                                     abs_r_threshold=0.999999)
    assert sorted(kept) == sorted(candidates)


def test_low_threshold_merges_all_into_global_top(fixture):
    """A ~0 threshold merges everything (single-linkage) into one global cluster,
    represented by the global top-univariate indicator."""
    candidates, panels, samples, scores = fixture
    kept, cluster_map = dedup.dedup_candidates(candidates, panels, samples, scores,
                                               abs_r_threshold=0.0)
    assert kept == ["dup_b"]  # dup_b (0.74) is the global argmax score
    assert cluster_map["dup_b"] == sorted(candidates)


def test_missing_panel_stays_singleton(fixture):
    """A candidate absent from `panels` shares no rows → cannot merge → kept singleton."""
    candidates, panels, samples, scores = fixture
    cands = candidates + ["ghost_z"]
    scores2 = dict(scores, ghost_z={"univariate_loco_auc": 0.9})
    kept, cluster_map = dedup.dedup_candidates(cands, panels, samples, scores2)
    assert "ghost_z" in kept
    assert cluster_map["ghost_z"] == ["ghost_z"]


def test_empty_candidates_returns_empty(fixture):
    _, panels, samples, scores = fixture
    assert dedup.dedup_candidates([], panels, samples, scores) == ([], {})


def test_duplicate_candidate_ids_are_collapsed(fixture):
    """Passing an id twice must not create phantom clusters or double-count members."""
    candidates, panels, samples, scores = fixture
    kept, cluster_map = dedup.dedup_candidates(candidates + ["dup_a", "indep_d"],
                                               panels, samples, scores)
    assert sorted(kept) == ["dup_b", "indep_d", "indep_e"]
    all_members = [m for members in cluster_map.values() for m in members]
    assert sorted(all_members) == sorted(set(candidates))


def test_inputs_not_mutated(fixture):
    """Pure function: candidate list / scores dict are not mutated in place."""
    candidates, panels, samples, scores = fixture
    cand_copy = list(candidates)
    scores_copy = {k: dict(v) for k, v in scores.items()}
    dedup.dedup_candidates(candidates, panels, samples, scores)
    assert candidates == cand_copy
    assert scores == scores_copy


# --------------------------------------------------------------------------- #
# fix 5e: consolidate dedup — the in-file stability_select.correlation_dedup and
# dedup.dedup_candidates MUST NOT drift. Assert byte-for-byte parity on the       #
# fixture (both reuse the SAME production build_X_y feature basis).               #
# --------------------------------------------------------------------------- #
def test_parity_with_stability_select_correlation_dedup(fixture):
    import stability_select as ss  # imported here so the dedup suite stays standalone

    candidates, panels, samples, scores = fixture
    for thr in (0.85, 0.0, 0.999999):
        surv_ss, map_ss = ss.correlation_dedup(candidates, samples, panels, scores, abs_r=thr)
        kept_d, map_d = dedup.dedup_candidates(candidates, panels, samples, scores,
                                               abs_r_threshold=thr)
        assert surv_ss == kept_d, f"survivors differ at abs_r={thr}"
        assert map_ss == map_d, f"cluster_map differs at abs_r={thr}"
