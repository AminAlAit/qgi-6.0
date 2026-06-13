"""
Pre-registration / leakage-guard tests for the F-GPR-1 gap-closer (Ji-Hoon protocol).

Locks the protocol invariants that, if broken, would silently leak the test window or
re-implement the frozen metric math. Stdlib + pytest only.
"""
import json
import math
import os

import gap_closer as gc


def test_ridge_recovers_ols_at_tiny_lambda():
    """Ridge normal-equations solver must recover the OLS plane on a noiseless linear target."""
    # y = 2*x0 - 1*x1 (+0 intercept). Centered/standardized-ish inputs.
    X = [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [-1.0, 2.0], [3.0, -1.0], [2.0, 2.0]]
    y = [2 * r[0] - 1 * r[1] for r in X]
    w = gc.ridge_fit(X, y, 1e-9)
    assert abs(w[0] - 2.0) < 1e-4
    assert abs(w[1] + 1.0) < 1e-4


def test_ridge_shrinks_with_lambda():
    """Larger lambda -> smaller coefficient norm (the L2 penalty actually bites)."""
    X = [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [-1.0, 2.0], [3.0, -1.0], [2.0, 2.0]]
    y = [2 * r[0] - 1 * r[1] for r in X]
    w_small = gc.ridge_fit(X, y, 0.01)
    w_big = gc.ridge_fit(X, y, 100.0)
    n_small = math.sqrt(sum(v * v for v in w_small))
    n_big = math.sqrt(sum(v * v for v in w_big))
    assert n_big < n_small


def test_standardizer_is_train_only_and_applied_consistently():
    """G2: z-score uses train mean/sd; applying to the same rows yields ~0 mean / ~1 sd."""
    X = [[1.0, 10.0], [2.0, 20.0], [3.0, 30.0], [4.0, 40.0]]
    means, sds = gc.fit_feature_standardizer(X)
    Z = gc.apply_standardizer(X, means, sds)
    for j in range(2):
        col = [r[j] for r in Z]
        assert abs(sum(col) / len(col)) < 1e-9
    # a NEW point standardizes with the frozen train stats (not its own).
    z_new = gc.apply_standardizer([[5.0, 50.0]], means, sds)[0]
    assert z_new[0] == (5.0 - means[0]) / sds[0]


def test_delta_spearman_uses_frozen_helpers():
    """G5: delta_spearman must equal spearman_r(diff(a),diff(b)) -- no re-implementation."""
    a = [1.0, 3.0, 2.0, 5.0, 4.0, 8.0]
    b = [2.0, 1.0, 4.0, 3.0, 6.0, 5.0]
    assert gc.delta_spearman(a, b) == gc.spearman_r(gc.diff(a), gc.diff(b))


def test_features_exclude_baseline_and_counts():
    """Protocol (a): exactly 11 features; gpr_share / raw counts / total_docs are NOT among them."""
    assert gc.N_FEATURES == 11
    assert len(gc.FEATURE_NAMES) == 11
    assert "gpr_share" not in gc.FEATURE_NAMES
    assert "total_docs" not in gc.FEATURE_NAMES
    for name in gc.FEATURE_NAMES:
        assert not name.endswith("_count")
    # the 8 category features are SHARES, plus threats/acts share + avg_tone.
    assert gc.FEATURE_NAMES[-3:] == ["threats_share", "acts_share", "avg_tone"]


def test_results_json_freeze_order_and_oos_last():
    """G6: results JSON exists, records freeze order, OOS computed last; G1/G3/G7 reflected."""
    path = gc.RESULTS_JSON_PATH
    assert os.path.exists(path), "run gap_closer.py first to produce the results JSON"
    with open(path, encoding="utf-8") as f:
        r = json.load(f)
    fo = r["freeze_order"]
    # order keys present and OOS flagged last
    assert fo["1_feature_list"] == gc.FEATURE_NAMES
    assert "gpr_share (=naive proxy/baseline)" in fo["1_features_excluded"]
    assert fo["7_OOS_metrics_computed_last"] is True
    # G7: all 44 reported
    assert r["n_countries"] == 44
    assert len(r["per_country"]) == 44
    # G1: train/test split is the rectangular 81/55 cut
    sb = fo["2_split_boundary"]
    assert sb["n_train"] == 81 and sb["n_test"] == 55
    # G3: naive baseline scored on identical test months for every country
    for c in r["per_country"]:
        assert "naive_oos_delta_spearman" in c
        assert c["n_test_months"] == 55


def test_bars_are_consistent_with_aggregates():
    """The pre-registered bar booleans must match the reported aggregate numbers."""
    with open(gc.RESULTS_JSON_PATH, encoding="utf-8") as f:
        r = json.load(f)
    b = r["bars"]
    assert b["bar1_mean_oos_delta_spearman_ge_0.51"]["pass"] == (
        r["gapcloser_oos_mean_delta_spearman"] >= gc.BAR1_MEAN_DELTA_SPEARMAN)
    assert b["bar2_beats_naive_in_ge_30_countries"]["pass"] == (
        r["n_countries_gapcloser_beats_naive_oos"] >= gc.BAR2_MIN_COUNTRIES_BEAT)
    assert b["bar4_zero_negative_oos"]["pass"] == (
        r["n_countries_negative_oos_delta_spearman"] == 0)
    # SHIP is the AND of all four bars.
    assert r["SHIP_gapcloser_over_naive"] == all(v["pass"] for v in b.values())
