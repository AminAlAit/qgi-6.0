"""Tests for the GPR PoC correlation helpers (build agent ALPHA).

Validates pearson_r / spearman_r against KNOWN cases:
  - exact linear y = 2x          -> Pearson r == +1, Spearman == +1
  - exact decreasing monotonic    -> Pearson < 0, Spearman == -1
  - noisy y = 2x + small noise    -> Pearson high (~> 0.95)
  - tie handling, zero-variance, diff()
"""

import math

from validate_gpr_poc import (
    pearson_r, spearman_r, zscore, rmse, diff, quantile_threshold, spike_recall,
)


def approx(a, b, tol=1e-9):
    return abs(a - b) <= tol


def test_pearson_exact_positive_linear():
    xs = [1, 2, 3, 4, 5, 6, 7, 8]
    ys = [2 * x for x in xs]  # y = 2x, perfect positive
    assert approx(pearson_r(xs, ys), 1.0)


def test_pearson_exact_negative_linear():
    xs = [1, 2, 3, 4, 5]
    ys = [-3 * x + 10 for x in xs]  # perfect negative
    assert approx(pearson_r(xs, ys), -1.0)


def test_pearson_affine_invariance():
    # Pearson must be invariant to a*y + b with a>0 (the protocol's core assumption).
    xs = [3.0, 1.0, 4.0, 1.5, 5.0, 9.0, 2.0, 6.0]
    ys = [2.1, 0.9, 3.8, 1.7, 5.2, 8.6, 2.4, 6.1]
    base = pearson_r(xs, ys)
    scaled = pearson_r(xs, [100.0 * y + 7.0 for y in ys])  # GPRC = share/mean*100 form
    assert approx(base, scaled, tol=1e-9)


def test_pearson_noisy_high():
    xs = list(range(1, 41))
    noise = [0.3, -0.2, 0.1, -0.1, 0.25, -0.3, 0.05, -0.05] * 5
    ys = [2 * x + noise[i] for i, x in enumerate(xs)]
    r = pearson_r(xs, ys)
    assert r is not None and r > 0.95


def test_spearman_exact_monotonic_positive():
    # Strictly increasing but non-linear -> Spearman exactly +1, Pearson < 1.
    xs = [1, 2, 3, 4, 5, 6]
    ys = [x ** 3 for x in xs]
    assert approx(spearman_r(xs, ys), 1.0)
    assert pearson_r(xs, ys) < 1.0


def test_spearman_exact_monotonic_negative():
    xs = [1, 2, 3, 4, 5, 6]
    ys = [1.0 / x for x in xs]  # strictly decreasing
    assert approx(spearman_r(xs, ys), -1.0)


def test_spearman_handles_ties():
    # With ties, average-rank Spearman should still be well defined and == 1 for a
    # perfectly monotone (non-decreasing, matching) pair.
    xs = [1, 2, 2, 3, 4]
    ys = [10, 20, 20, 30, 40]
    assert approx(spearman_r(xs, ys), 1.0)


def test_zero_variance_returns_none():
    assert pearson_r([5, 5, 5, 5], [1, 2, 3, 4]) is None
    assert spearman_r([5, 5, 5, 5], [1, 2, 3, 4]) is None


def test_too_short_returns_none():
    assert pearson_r([1], [1]) is None
    assert spearman_r([], []) is None


def test_zscore_properties():
    z = zscore([2, 4, 6, 8, 10])
    assert approx(sum(z), 0.0, tol=1e-9)
    # population sd of z-scores == 1
    m = sum(z) / len(z)
    var = sum((v - m) ** 2 for v in z) / len(z)
    assert approx(math.sqrt(var), 1.0, tol=1e-9)


def test_rmse_identity_zero():
    assert approx(rmse([1, 2, 3], [1, 2, 3]), 0.0)


def test_rmse_known():
    # errors of 0,0,3 -> mean sq = 9/3 = 3 -> rmse = sqrt(3)
    assert approx(rmse([1, 2, 3], [1, 2, 6]), math.sqrt(3.0))


def test_diff_basic():
    assert diff([10, 12, 9, 15]) == [2, -3, 6]
    assert diff([5]) == []


def test_quantile_threshold():
    vals = [1, 2, 3, 4]
    # median (q=0.5) of [1,2,3,4] with linear interp = 2.5
    assert approx(quantile_threshold(vals, 0.5), 2.5)
    assert approx(quantile_threshold(vals, 0.0), 1.0)
    assert approx(quantile_threshold(vals, 1.0), 4.0)


def test_spike_recall_perfect():
    # Construct deltas where the largest |gprc| jumps coincide with the largest |proxy| jumps.
    gprc_delta = [0.1, 5.0, -0.2, 6.0, 0.05, -4.5, 0.3, 0.1, 7.0, -0.1]
    proxy_delta = [0.01, 0.9, -0.02, 1.0, 0.005, -0.8, 0.03, 0.01, 1.2, -0.01]
    recall, n_spikes = spike_recall(gprc_delta, proxy_delta)
    assert n_spikes >= 1
    assert recall == 1.0  # the big GPRC jumps line up with big proxy jumps


def test_spike_recall_anti_aligned():
    # Anti-aligned: his single biggest jump (idx 0) sits where the proxy is genuinely
    # in its LOW range, while the proxy's own big jumps (idx 3,4) sit where his is flat.
    # The proxy baseline values are spread so the top-quartile boundary is clearly above
    # the proxy value at his spike month -> that spike must NOT be caught -> recall 0.
    gprc_delta = [9.0, 0.1, 0.2, 0.15, 0.05, 0.12, 0.18, 0.08, 0.11, 0.09]
    proxy_delta = [0.001, 0.2, 0.3, 5.0, 6.0, 0.4, 0.5, 0.6, 0.7, 0.8]
    recall, n_spikes = spike_recall(gprc_delta, proxy_delta)
    assert n_spikes == 1
    assert recall == 0.0  # his spike month has proxy in the bottom range, not top quartile
