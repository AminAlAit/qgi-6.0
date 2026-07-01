"""Unit tests for the run-3.1 pilot stability-selection CORE (`stability_select.py`).

Design contract (build brief): the HEAVY real-walk path is importable but NEVER executed here.
Every test either exercises a PURE helper (pi aggregation / stop rule / country partition) or
drives ``run_arm`` / ``run_single_walk`` / ``correlation_dedup`` against a *fake walk module*
injected via ``stability_select._WALK`` — so no numpy/xgboost model ever fits and no real panel
or positives file is read (aside from a tiny temp CSV that `run_arm` calls `pd.read_csv` on).

Requires only numpy + pandas + pytest (NOT xgboost/sklearn/scipy). Run:
    python -m pytest test_stability_select.py -v
"""
from __future__ import annotations

import json
import types

import numpy as np
import pandas as pd
import pytest

import stability_select as ss


# ============================================================================================
# (a) STOP RULE — fires correctly on a synthetic pi trajectory.
# ============================================================================================
def test_should_stop_now_needs_three_checkpoints():
    stable = {"a": 1.0, "b": 1.0}
    assert ss.should_stop_now([stable]) is False
    assert ss.should_stop_now([stable, stable]) is False       # only 1 transition
    assert ss.should_stop_now([stable, stable, stable]) is True  # 2 identical transitions


def test_stop_fires_after_two_consecutive_stable_transitions():
    # Trajectory: moves a lot 0->1, then is stable for the last three checkpoints.
    traj = [
        {"a": 0.20, "b": 0.90},   # cp0
        {"a": 0.70, "b": 0.95},   # cp1  (big move vs cp0 -> not converged)
        {"a": 0.90, "b": 0.98},   # cp2  (Δa=0.20 -> transition1 NOT ok)
        {"a": 0.91, "b": 0.99},   # cp3  (Δ small, keepset stable -> transition2 ok)
        {"a": 0.92, "b": 0.99},   # cp4  (Δ small -> transition3 ok) => stop here
    ]
    stop_idx, reason = ss.simulate_stop_schedule(traj)
    assert stop_idx == 4
    assert reason == "converged_two_consecutive_checkpoints"


def test_no_stop_when_pi_keeps_drifting_hits_ceiling():
    # pi_a climbs by 0.10 every checkpoint: max|Δpi| never < 0.05 -> never converges.
    traj = [{"a": round(0.1 * k, 3)} for k in range(7)]
    stop_idx, reason = ss.simulate_stop_schedule(traj)
    assert reason == "b_ceiling_reached"
    assert stop_idx == len(traj) - 1


def test_stop_requires_BOTH_delta_and_jaccard():
    # Deltas are tiny (<0.05) but the keepset flips membership each step: Jaccard 0 -> no stop.
    traj = [
        {"a": 0.61, "b": 0.59},
        {"a": 0.59, "b": 0.61},   # keepset {a}->{b}: Jaccard 0 though Δ=0.02
        {"a": 0.61, "b": 0.59},
        {"a": 0.59, "b": 0.61},
    ]
    _, reason = ss.simulate_stop_schedule(traj)
    assert reason == "b_ceiling_reached"


def test_jaccard_empty_sets_is_one():
    assert ss.jaccard(set(), set()) == 1.0
    assert ss.jaccard({"a"}, set()) == 0.0
    assert ss.jaccard({"a", "b"}, {"a"}) == pytest.approx(0.5)


def test_max_abs_delta_pi_over_union_of_keys():
    a = {"x": 0.5, "y": 0.9}
    b = {"x": 0.52, "z": 0.4}       # y drops to 0, z appears at 0.4
    assert ss.max_abs_delta_pi(a, b) == pytest.approx(0.9)  # y: |0.9-0.0|
    assert ss.max_abs_delta_pi({}, {}) == 0.0


# ============================================================================================
# (b) FIREWALL — complementary halves are disjoint and cover all countries.
# ============================================================================================
@pytest.mark.parametrize("n", [2, 5, 10, 16, 37])
@pytest.mark.parametrize("idx", [0, 1, 7, 123])
def test_partition_countries_disjoint_and_covering(n, idx):
    countries = [f"C{i:02d}" for i in range(n)]
    a, b = ss.partition_countries(countries, idx, seed_base=12345)
    assert a.isdisjoint(b)                       # FIREWALL: no country in both halves
    assert a | b == set(countries)               # complementary: covers every country
    assert len(a) + len(b) == n                  # partition (no duplication / drop)
    assert abs(len(a) - len(b)) <= 1             # balanced halves (N/2)


def test_partition_countries_deterministic():
    countries = [f"C{i}" for i in range(20)]
    assert ss.partition_countries(countries, 3) == ss.partition_countries(countries, 3)


def test_partition_countries_varies_with_index():
    countries = [f"C{i}" for i in range(20)]
    assert ss.partition_countries(countries, 3) != ss.partition_countries(countries, 4)


def test_resample_halves_country_disjoint_and_covering():
    # Two rows per country (a positive + a negative) to prove country-level (not row) splitting.
    rows = []
    for i in range(12):
        c = f"Country{i:02d}"
        rows.append({"country": c, "year": 2000 + i, "label": 1})
        rows.append({"country": c, "year": 1990 + i, "label": 0})
    samples = pd.DataFrame(rows)
    sub_a, sub_b = ss.resample_halves(samples, resample_index=2, seed_base=12345)
    ca, cb = set(sub_a["country"]), set(sub_b["country"])
    assert ca.isdisjoint(cb)                                    # no country leaks across halves
    assert ca | cb == set(samples["country"])                  # all countries covered
    # every ROW of a country travels with that country (no row-level split)
    assert len(sub_a) + len(sub_b) == len(samples)


def test_resample_halves_asserts_on_row_level_would_not_apply():
    # Sanity: a country present twice (two rows) still ends up wholly in one half.
    samples = pd.DataFrame(
        {"country": ["X", "X", "Y", "Y", "Z", "Z"], "year": [1, 2, 3, 4, 5, 6],
         "label": [1, 0, 1, 0, 1, 0]}
    )
    sub_a, sub_b = ss.resample_halves(samples, 0)
    for c in ("X", "Y", "Z"):
        in_a = c in set(sub_a["country"])
        in_b = c in set(sub_b["country"])
        assert in_a != in_b  # exactly one half


def test_assert_loco_grouped_by_country_detects_phantom():
    samples = pd.DataFrame({"country": ["A", "B"], "year": [1, 2], "label": [1, 0]})
    good = {
        "probs": np.array([0.1, 0.9]), "labels": np.array([0, 1]),
        "countries": np.array(["A", "B"]), "years": np.array([1, 2]),
    }
    ss._assert_loco_grouped_by_country(good, samples)  # no raise
    leaky = {
        "probs": np.array([0.1, 0.9]), "labels": np.array([0, 1]),
        "countries": np.array(["A", "PHANTOM"]), "years": np.array([1, 2]),
    }
    with pytest.raises(AssertionError):
        ss._assert_loco_grouped_by_country(leaky, samples)


# ============================================================================================
# (c) PI AGGREGATION math + keepset.
# ============================================================================================
def test_compute_pi_frequencies():
    sets = [["a", "b"], ["a"], ["a", "c"]]
    pi = ss.compute_pi(sets)
    assert pi["a"] == pytest.approx(1.0)
    assert pi["b"] == pytest.approx(1 / 3)
    assert pi["c"] == pytest.approx(1 / 3)
    assert set(pi) == {"a", "b", "c"}


def test_compute_pi_dedupes_within_a_walk():
    # A duplicated indicator inside one selected set counts once for that walk.
    pi = ss.compute_pi([["a", "a", "b"], ["a"]])
    assert pi["a"] == pytest.approx(1.0)
    assert pi["b"] == pytest.approx(0.5)


def test_compute_pi_empty():
    assert ss.compute_pi([]) == {}


def test_keepset_threshold():
    pi = {"a": 0.60, "b": 0.59, "c": 0.95, "d": 0.60000001}
    assert ss.keepset(pi, 0.60) == {"a", "c", "d"}
    assert ss.keepset(pi, 0.95) == {"c"}


# ============================================================================================
# correlation_dedup — union-find clustering + representative selection (fake build_X_y).
# ============================================================================================
def test_correlation_dedup_merges_collinear_keeps_best_rep(monkeypatch):
    # i1 and i2 are perfectly collinear (i2 = 2*i1 per column -> |r|=1 on all 8 cols);
    # i3 is independent noise -> stays its own cluster.
    rng = np.random.default_rng(0)
    base = rng.normal(size=(40, 8))
    keys_c = [f"C{i}" for i in range(40)]
    keys_y = list(range(1980, 2020))

    feat = {
        "i1": base,
        "i2": 2.0 * base + 5.0,          # affine of i1 -> Pearson r = 1 per column
        "i3": rng.normal(size=(40, 8)),  # independent
    }

    def fake_build_X_y(samples, selected, window, panels):
        ind = selected[0]
        X = feat[ind]
        c = np.array(keys_c)
        yr = np.array(keys_y)
        y = np.zeros(40, dtype=int)
        return X, y, c, yr

    fake = types.SimpleNamespace(build_X_y=fake_build_X_y)
    monkeypatch.setattr(ss, "_WALK", fake)

    scores = {
        "i1": {"univariate_loco_auc": 0.70},
        "i2": {"univariate_loco_auc": 0.80},   # higher -> should be the representative of {i1,i2}
        "i3": {"univariate_loco_auc": 0.65},
    }
    survivors, cluster_map = ss.correlation_dedup(
        ["i1", "i2", "i3"], samples_subset=pd.DataFrame({"country": [], "year": [], "label": []}),
        panels={}, scores=scores, abs_r=0.85, min_common=30,
    )
    assert survivors == ["i2", "i3"]
    assert cluster_map["i2"] == ["i1", "i2"]      # merged cluster, members sorted
    assert cluster_map["i3"] == ["i3"]            # singleton


def test_correlation_dedup_no_merge_below_min_common(monkeypatch):
    # Collinear features but < min_common shared rows -> cannot establish collinearity -> no merge.
    base = np.random.default_rng(1).normal(size=(5, 8))

    def fake_build_X_y(samples, selected, window, panels):
        ind = selected[0]
        X = base if ind == "i1" else 3.0 * base
        c = np.array([f"C{i}" for i in range(5)])
        yr = np.array(list(range(2000, 2005)))
        return X, np.zeros(5, dtype=int), c, yr

    monkeypatch.setattr(ss, "_WALK", types.SimpleNamespace(build_X_y=fake_build_X_y))
    scores = {"i1": {"univariate_loco_auc": 0.7}, "i2": {"univariate_loco_auc": 0.8}}
    survivors, cluster_map = ss.correlation_dedup(
        ["i1", "i2"], pd.DataFrame({"country": [], "year": [], "label": []}),
        {}, scores, abs_r=0.85, min_common=30,
    )
    assert survivors == ["i1", "i2"]              # both survive (no merge)
    assert cluster_map == {"i1": ["i1"], "i2": ["i2"]}


# ============================================================================================
# Fake walk module for end-to-end run_arm / run_single_walk orchestration tests.
# ============================================================================================
def _make_fake_walk(greedy_return, n_countries=12):
    """Build a fake `run_f_ml_1_poc`-shaped module. All heavy math is stubbed deterministically."""
    fake = types.SimpleNamespace()
    fake.TOP_N_PREFILTER = 40
    fake.DELTA_STEP = 0.005
    fake.WINDOW_GRID = [3, 5]

    fake.normalize_country_id = lambda x: str(x)

    def build_samples(pos, negatives_per_positive=3, seed=0):
        rows = []
        for i in range(n_countries):
            c = f"Country{i:02d}"
            rows.append({"country": c, "year": 2000 + i, "label": 1})
            for j in range(negatives_per_positive):
                rows.append({"country": c, "year": 1990 + i + j, "label": 0})
        return pd.DataFrame(rows)

    fake.build_samples = build_samples
    fake.list_candidate_indicators = lambda panel_dir: ["i1", "i2", "i3", "i4"]
    fake.load_panel = lambda ind, panel_dir: None

    def univariate_loco_screen(samples, candidates, panels):
        scores = {c: {"univariate_loco_auc": 0.6 + 0.01 * k} for k, c in enumerate(candidates)}
        return list(candidates), scores

    fake.univariate_loco_screen = univariate_loco_screen

    def greedy_outer_loop(samples, candidates_top_n, panels, architecture, **kw):
        return {"selected_indicators": list(greedy_return)}

    fake.greedy_outer_loop = greedy_outer_loop

    def build_X_y(samples, selected, window, panels):
        # Deterministic, separable-by-label features so fit_predict_loco is well-defined.
        n = len(samples)
        X = np.zeros((n, 8 * len(selected)))
        y = samples["label"].to_numpy().astype(int)
        X[:, 0] = y + 0.01 * window
        c = samples["country"].to_numpy().astype(str)
        yr = samples["year"].to_numpy().astype(int)
        return X, y, c, yr

    fake.build_X_y = build_X_y

    def fit_predict_loco(X, y, countries, years, architecture, seed=0):
        probs = 0.5 + 0.4 * (y - 0.5) / 0.5 * 0.5  # positives high, negatives low
        probs = np.clip(0.5 + 0.3 * (2 * y - 1), 0.01, 0.99)
        return {
            "probs": np.asarray(probs, float),
            "labels": np.asarray(y, int),
            "countries": np.asarray(countries),
            "years": np.asarray(years),
            "per_country_auc": {},
            "global_auc": 0.75 + 0.001 * X.shape[1],  # depends on window/set size for argmax
        }

    fake.fit_predict_loco = fit_predict_loco
    fake.bca_bootstrap_auc_ci = lambda probs, labels, B=2000, seed=0: {
        "auc": float(np.mean(probs)), "ci95_lo": 0.70, "ci95_hi": 0.82,
        "ci80_lo": 0.72, "ci80_hi": 0.80, "n_bootstrap": B, "method": "fake",
    }
    fake.panel_data_fingerprint = lambda panel_dir, positives_csv=None: "deadbeefcafef00d"
    return fake


@pytest.fixture
def positives_csv(tmp_path):
    p = tmp_path / "positives.csv"
    p.write_text("country_id,event_year\nafghanistan,1975\nangola,1990\n", encoding="utf-8")
    return p


def test_run_single_walk_run3method_skips_dedup(monkeypatch):
    fake = _make_fake_walk(greedy_return=["i1", "i2"])
    monkeypatch.setattr(ss, "_WALK", fake)
    samples = fake.build_samples(None)
    sel = ss.run_single_walk("run3method", samples, ["i1", "i2", "i3", "i4"], {}, resample_seed=1)
    assert sel == ["i1", "i2"]


def test_run_arm_run3method_end_to_end(monkeypatch, tmp_path, positives_csv):
    # Greedy always returns {i1,i2} -> pi stabilizes -> stop rule converges by the 3rd checkpoint.
    fake = _make_fake_walk(greedy_return=["i1", "i2"])
    monkeypatch.setattr(ss, "_WALK", fake)

    result = ss.run_arm(
        recipe_id="unit_recipe", arm="run3method",
        panel_dir=tmp_path, positives_csv=positives_csv, out_dir=tmp_path / "results",
        b_schedule=[4, 6, 8], git_commit="abc123",
    )

    # stop rule fired (identical stable set at every checkpoint => 2 consecutive converged)
    assert result["stop_reason"] == "converged_two_consecutive_checkpoints"
    assert result["B_used"] == 8            # 3rd checkpoint target
    assert result["stable_set"] == ["i1", "i2"]
    assert result["pi"]["i1"] == pytest.approx(1.0)
    assert result["final_indicator_count"] == 2
    assert result["dedup_cluster_map"] == {}   # run3method => no dedup map
    assert result["arm"] == "run3method"
    assert result["git_commit"] == "abc123"
    assert result["pool_hash"] == "deadbeefcafef00d"
    assert result["seed_base"] == 12345

    # OOF present, aligned, and grouped by country from the input samples.
    assert len(result["oof"]) > 0
    input_countries = {f"Country{i:02d}" for i in range(12)}
    assert {row["country"] for row in result["oof"]} <= input_countries
    for row in result["oof"]:
        assert set(row) == {"country", "year", "prob", "label"}

    # per_checkpoint carries the required frozen-contract keys.
    for cp in result["per_checkpoint"]:
        assert set(["B", "keepset", "pi_snapshot"]).issubset(cp)

    # file written per the frozen contract path.
    out_file = tmp_path / "results" / "unit_recipe.run3method.json"
    assert out_file.exists()
    on_disk = json.loads(out_file.read_text(encoding="utf-8"))
    assert on_disk["recipe_id"] == "unit_recipe"
    for field in [
        "recipe_id", "arm", "B_used", "stop_reason", "pi", "stable_set", "reference_set",
        "resample_selected_sets", "per_checkpoint", "loco_auc", "ci95_lo", "ci95_hi",
        "oof", "n_pos", "final_indicator_count", "dedup_cluster_map", "config_signature",
        "git_commit", "pool_hash", "seed_base",
    ]:
        assert field in on_disk, f"missing frozen-contract field {field}"
    # reference_set is the full-sample greedy pick (fake greedy returns {i1,i2}).
    assert on_disk["reference_set"] == ["i1", "i2"]


def test_run_arm_records_two_walks_per_resample(monkeypatch, tmp_path, positives_csv):
    fake = _make_fake_walk(greedy_return=["i1", "i2"])
    monkeypatch.setattr(ss, "_WALK", fake)
    result = ss.run_arm(
        recipe_id="unit_recipe", arm="run3method",
        panel_dir=tmp_path, positives_csv=positives_csv, out_dir=tmp_path / "results",
        b_schedule=[4, 6, 8],
    )
    # resample_selected_sets has one entry per WALK; B_used counts walks; even (2 per resample).
    assert len(result["resample_selected_sets"]) == result["B_used"]
    assert result["B_used"] % 2 == 0


def test_run_arm_ceiling_when_never_converges(monkeypatch, tmp_path, positives_csv):
    # Each walk selects a UNIQUE indicator -> a fresh indicator enters at pi=1/B (from 0) at every
    # checkpoint, so max|Δpi| stays above 0.05 and the loop never converges -> hits the ceiling.
    counter = {"n": 0}

    def unique_greedy(samples, candidates_top_n, panels, architecture, **kw):
        counter["n"] += 1
        return {"selected_indicators": [f"uind{counter['n']}"]}

    fake = _make_fake_walk(greedy_return=["i1"])
    fake.greedy_outer_loop = unique_greedy
    monkeypatch.setattr(ss, "_WALK", fake)

    result = ss.run_arm(
        recipe_id="unit_recipe", arm="run3method",
        panel_dir=tmp_path, positives_csv=positives_csv, out_dir=tmp_path / "results",
        b_schedule=[4, 6, 8],
    )
    assert result["stop_reason"] == "b_ceiling_reached"
    assert result["B_used"] == 8
    assert result["stable_set"] == []          # no indicator ever reached pi>=0.60


def test_run_arm_run31_populates_dedup_map(monkeypatch, tmp_path, positives_csv):
    # In the fake, every indicator has identical features -> on the FULL 48-row samples they all
    # merge into one collinear cluster (>= min_common), so run31 emits a non-empty dedup map whose
    # representative is the highest-univariate-scored member (i4).
    fake = _make_fake_walk(greedy_return=["i1"])
    monkeypatch.setattr(ss, "_WALK", fake)
    result = ss.run_arm(
        recipe_id="unit_recipe", arm="run31",
        panel_dir=tmp_path, positives_csv=positives_csv, out_dir=tmp_path / "results",
        b_schedule=[4, 6, 8],
    )
    assert result["arm"] == "run31"
    assert result["dedup_cluster_map"], "run31 must emit a non-empty dedup cluster map"
    # all four candidates collapsed into one cluster, rep = best univariate (i4)
    assert result["dedup_cluster_map"] == {"i4": ["i1", "i2", "i3", "i4"]}


def test_run_arm_empty_stable_set_final_fit_is_graceful(monkeypatch, tmp_path, positives_csv):
    # Greedy selects nothing -> pi all zero -> empty stable set -> NaN loco_auc, empty oof.
    fake = _make_fake_walk(greedy_return=[])
    monkeypatch.setattr(ss, "_WALK", fake)
    result = ss.run_arm(
        recipe_id="unit_recipe", arm="run3method",
        panel_dir=tmp_path, positives_csv=positives_csv, out_dir=tmp_path / "results",
        b_schedule=[4, 6, 8],
    )
    assert result["stable_set"] == []
    assert result["final_indicator_count"] == 0
    assert result["oof"] == []
    assert result["ci95_lo"] is None and result["ci95_hi"] is None
    assert np.isnan(result["loco_auc"])


def test_config_signature_stable_and_arm_sensitive():
    s1 = ss._config_signature("r", "run31", "hash", 12345, [50, 75], 0.85)
    s2 = ss._config_signature("r", "run31", "hash", 12345, [50, 75], 0.85)
    s3 = ss._config_signature("r", "run3method", "hash", 12345, [50, 75], 0.85)
    assert s1 == s2 and s1 != s3 and len(s1) == 64


def test_final_fit_picks_argmax_window(monkeypatch):
    # global_auc = 0.75 + 0.001 * n_features; both windows give same set size, so first (smallest)
    # window wins the tie via strict-> comparison.
    fake = _make_fake_walk(greedy_return=["i1"])
    monkeypatch.setattr(ss, "_WALK", fake)
    samples = fake.build_samples(None)
    out = ss._final_fit(["i1", "i2"], samples, {}, seed=12345)
    assert out["chosen_window"] == 3        # smallest window on tie
    assert out["ci95_lo"] == 0.70
    assert len(out["oof"]) == len(samples)


def test_run_single_walk_rejects_unknown_arm(monkeypatch):
    monkeypatch.setattr(ss, "_WALK", _make_fake_walk(["i1"]))
    with pytest.raises(ValueError):
        ss.run_single_walk("bogus", pd.DataFrame({"label": [1]}), ["i1"], {}, 1)


def test_run_arm_rejects_unknown_arm():
    with pytest.raises(ValueError):
        ss.run_arm("r", "nope", "pd", "pc")
