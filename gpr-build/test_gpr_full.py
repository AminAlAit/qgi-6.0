"""
Tests for the full-method GPR validation harness (validate_gpr_full.py).

Covers the NEW helpers (affine fit/apply, calibrated holdout RMSE, generic per-country
metrics, the production gate, load_all_gprc) and the all-44 panel iteration on a SYNTHETIC
fixture (no AWS/BigQuery; stdlib+xlrd only).

The synthetic fixture builds a controllable {ISO3:{YYYY-MM:value}} proxy + a matching
GPRC map so we can assert exact gate behaviour (perfect/anti/no correlation), then a real
smoke check reproduces the PoC's mean delta-Spearman ~0.4554 on the 5 overlap countries.
"""

import math
import os

import pytest

import validate_gpr_full as V


# ---------------------------------------------------------------------------
# helpers / fixtures
# ---------------------------------------------------------------------------
def _months(n, start_year=2015, start_month=2):
    """n consecutive 'YYYY-MM' strings."""
    out = []
    y, m = start_year, start_month
    for _ in range(n):
        out.append("%04d-%02d" % (y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def _series(vals, **kw):
    ms = _months(len(vals), **kw)
    return {m: v for m, v in zip(ms, vals)}


# ---------------------------------------------------------------------------
# affine fit / apply
# ---------------------------------------------------------------------------
def test_fit_affine_recovers_known_line():
    proxy = [0.0, 1.0, 2.0, 3.0, 4.0]
    target = [3.0 + 2.0 * x for x in proxy]  # a=3, b=2
    a, b = V.fit_affine(proxy, target)
    assert a == pytest.approx(3.0, abs=1e-9)
    assert b == pytest.approx(2.0, abs=1e-9)


def test_fit_affine_degenerate_returns_none():
    assert V.fit_affine([1.0, 1.0, 1.0], [1.0, 2.0, 3.0]) is None  # zero proxy variance
    assert V.fit_affine([1.0], [1.0]) is None                      # n<2


def test_apply_affine():
    assert V.apply_affine((1.0, 2.0), [0.0, 1.0, 2.0]) == [1.0, 3.0, 5.0]


# ---------------------------------------------------------------------------
# calibrated holdout RMSE
# ---------------------------------------------------------------------------
def test_calibrated_holdout_rmse_perfect_linear_is_zero():
    months = _months(10)
    px = [float(i) for i in range(10)]
    gp = [5.0 + 3.0 * x for x in px]  # exact affine -> holdout RMSE ~ 0
    c = V.calibrated_holdout_rmse(months, px, gp, train_frac=0.6)
    assert c is not None
    assert c["n_train"] == 6 and c["n_holdout"] == 4
    assert c["a"] == pytest.approx(5.0, abs=1e-6)
    assert c["b"] == pytest.approx(3.0, abs=1e-6)
    assert c["rmse_holdout"] == pytest.approx(0.0, abs=1e-6)
    assert c["rmse_train"] == pytest.approx(0.0, abs=1e-6)


def test_calibrated_holdout_rmse_too_few_points():
    assert V.calibrated_holdout_rmse(_months(5), [1.0] * 5, [1.0] * 5) is None


# ---------------------------------------------------------------------------
# country_metrics + production gate
# ---------------------------------------------------------------------------
def test_country_metrics_perfect_correlation_passes_gate():
    px = [float(i) + (0.13 if i % 2 else 0.0) for i in range(24)]  # monotone + jitter so deltas vary
    gp = [10.0 + 4.0 * x for x in px]                               # perfect positive affine
    m = V.country_metrics("ZZZ", _series(px), _series(gp), production_gate=0.90)
    assert m["n_months"] == 24
    assert m["pearson_r"] == pytest.approx(1.0, abs=1e-9)
    assert m["production_pass"] is True
    assert m["production_gate_metric"] == "pearson_levels_calibrated"
    # calibration present and near-exact
    assert m["calibration"]["rmse_holdout"] == pytest.approx(0.0, abs=1e-6)


def test_country_metrics_anticorrelation_fails_gate():
    px = [float(i) for i in range(24)]
    gp = [100.0 - 4.0 * x for x in px]  # perfect NEGATIVE -> signed r = -1, must FAIL
    m = V.country_metrics("ZZZ", _series(px), _series(gp), production_gate=0.90)
    assert m["pearson_r"] == pytest.approx(-1.0, abs=1e-9)
    assert m["production_pass"] is False


def test_country_metrics_noise_fails_gate():
    px = [0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0]
    gp = [1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0]
    m = V.country_metrics("ZZZ", _series(px), _series(gp), production_gate=0.90)
    assert m["production_pass"] is False


def test_country_metrics_min_months_guard():
    assert V.country_metrics("ZZZ", _series([1.0, 2.0]), _series([1.0, 2.0])) is None


def test_country_metrics_gate_metric_switch_is_explicit():
    px = [float(i) for i in range(24)]
    gp = [10.0 + 4.0 * x for x in px]
    m = V.country_metrics("ZZZ", _series(px), _series(gp),
                          production_gate=0.90, gate_metric="spearman_delta")
    assert m["production_gate_metric"] == "spearman_delta"
    # gate_value must equal the reported spearman_r (HEADLINE), not the levels pearson
    assert m["production_gate_value"] == pytest.approx(m["spearman_r"])


# ---------------------------------------------------------------------------
# validate_panel on a SYNTHETIC all-N fixture (the "all-44 iteration")
# ---------------------------------------------------------------------------
def _synthetic_panel(n_countries=44, n_months=30):
    """Build a synthetic GPRC key + matching proxy for n_countries.
    Country k: proxy is a noisy ramp; GPRC = a_k + b_k*proxy (+ tiny noise) so EVERY
    country is strongly positively correlated -> the whole panel should PASS the gate.
    Uses fake ISO3s 'C00'..'C{n-1}'."""
    gprc = {}
    proxy = {}
    for k in range(n_countries):
        iso3 = "C%02d" % k
        px = [float(i) + 0.37 * math.sin(i + k) for i in range(n_months)]
        gp = [5.0 + k + (2.0 + 0.1 * k) * x for x in px]
        proxy[iso3] = _series(px)
        gprc[iso3] = _series(gp)
    return proxy, gprc


def test_validate_panel_iterates_all_countries_and_passes():
    proxy, gprc = _synthetic_panel(n_countries=44, n_months=30)
    res = V.validate_panel(proxy, gprc_by_iso3=gprc, production_gate=0.90)
    assert res["n_scored"] == 44
    assert len(res["per_country"]) == 44
    # all strongly positive -> all pass production gate
    assert res["production_gate"]["n_pass"] == 44
    assert res["production_gate"]["PASS_ALL"] is True
    # delta-Spearman reference gate also computed
    assert res["poc_equivalent_gate"]["mean_delta_spearman"] is not None


def test_validate_panel_only_scores_covered_intersection():
    proxy, gprc = _synthetic_panel(n_countries=5, n_months=20)
    # add a proxy country with NO answer-key column -> must be skipped
    proxy["ZZZ"] = _series([float(i) for i in range(20)])
    # add an answer-key country the proxy doesn't cover -> must be skipped
    gprc["QQQ"] = _series([float(i) for i in range(20)])
    res = V.validate_panel(proxy, gprc_by_iso3=gprc, production_gate=0.90)
    assert "ZZZ" not in res["scored_countries"]
    assert "QQQ" not in res["scored_countries"]
    assert res["n_scored"] == 5


def test_validate_panel_mixed_pass_fail_counts_correctly():
    # 3 positive, 2 anti-correlated -> exactly 3 pass
    proxy, gprc = {}, {}
    for k in range(3):
        iso3 = "P%d" % k
        px = [float(i) for i in range(20)]
        proxy[iso3] = _series(px)
        gprc[iso3] = _series([1.0 + 2.0 * x for x in px])
    for k in range(2):
        iso3 = "N%d" % k
        px = [float(i) for i in range(20)]
        proxy[iso3] = _series(px)
        gprc[iso3] = _series([50.0 - 2.0 * x for x in px])
    res = V.validate_panel(proxy, gprc_by_iso3=gprc, production_gate=0.90)
    assert res["production_gate"]["n_pass"] == 3
    assert res["production_gate"]["PASS_ALL"] is False
    assert sorted(res["production_gate"]["pass_iso3"]) == ["P0", "P1", "P2"]


# ---------------------------------------------------------------------------
# answer-key loaders (real file)
# ---------------------------------------------------------------------------
@pytest.mark.skipif(not os.path.exists(V.XLS_PATH), reason="answer key not present")
def test_load_all_gprc_reads_44_columns():
    gprc, present = V.load_all_gprc()
    assert len(present) == 44
    assert "ARG" in present and "USA" in present and "RUS" in present
    # ARG should have many monthly values within the GDELT overlap window
    assert any(m.startswith("2018") for m in gprc["ARG"])


@pytest.mark.skipif(not os.path.exists(V.XLS_PATH), reason="answer key not present")
def test_load_shareh_categories_reads_8():
    cats = V.load_shareh_categories()
    assert sorted(cats) == [1, 2, 3, 4, 5, 6, 7, 8]
    assert all(len(cats[c]) > 0 for c in cats)


# ---------------------------------------------------------------------------
# SMOKE: reproduce the PoC delta-Spearman on the 5 overlap countries
# ---------------------------------------------------------------------------
@pytest.mark.skipif(
    not (os.path.exists(V.XLS_PATH) and os.path.exists(V.POC_CSV_PATH)),
    reason="PoC data not present",
)
def test_smoke_reproduces_poc_delta_spearman():
    proxy, _flags = V.build_topic_share_proxy(topics=("t02", "t03"))
    gprc, _present = V.load_all_gprc()
    res = V.validate_panel(proxy, gprc_by_iso3=gprc, production_gate=0.90)

    # The 5 PoC overlap countries must all be scored (they all have GPRC columns).
    poc5 = ["ARG", "EGY", "THA", "TUN", "VEN"]
    for iso3 in poc5:
        assert iso3 in res["scored_countries"], "%s missing from panel" % iso3

    # Mean delta-Spearman OVER THE 5 PoC COUNTRIES must reproduce ~0.4554.
    by = {c["iso3"]: c for c in res["per_country"]}
    poc_means = [by[iso3]["spearman_r"] for iso3 in poc5]
    mean_poc5 = sum(poc_means) / len(poc_means)
    assert mean_poc5 == pytest.approx(0.4554, abs=0.01), \
        "PoC delta-Spearman not reproduced: got %.4f" % mean_poc5
