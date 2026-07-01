"""Tests for score_pilot.py (run-3.1 selection-method pilot scorer).

Covers: AUC-vs-reference equivalence, BH-FDR correctness, paired-bootstrap sign,
the Jaccard family (jaccard / mean-pairwise / split-half π reliability),
criteria.yaml loading of the locked values, and two fully-synthetic end-to-end
results sets that yield a KNOWN PASS and a KNOWN FAIL through score() + main().

Pure stdlib + pytest; runs in the qgi-x-venv (pytest 9.1.1, PyYAML 6.0.3, no numpy).
"""

import json
import random
from pathlib import Path

import pytest

import score_pilot as sp

HERE = Path(__file__).resolve().parent
REAL_CRITERIA = HERE / "criteria.yaml"


# --------------------------------------------------------------------------- #
# AUC: rank-based must equal the brute-force Mann-Whitney reference (ties=0.5)
# --------------------------------------------------------------------------- #
def _auc_ref(scores, labels):
    pos = [s for s, l in zip(scores, labels) if l == 1]
    neg = [s for s, l in zip(scores, labels) if l == 0]
    if not pos or not neg:
        return float("nan")
    c = 0.0
    for p in pos:
        for q in neg:
            if q < p:
                c += 1.0
            elif q == p:
                c += 0.5
    return c / (len(pos) * len(neg))


def test_auc_matches_reference_including_ties():
    rng = random.Random(7)
    for _ in range(200):
        n = rng.randint(2, 40)
        # Discrete score set forces frequent ties.
        scores = [rng.choice([0.0, 0.25, 0.5, 0.75, 1.0]) for _ in range(n)]
        labels = [rng.randint(0, 1) for _ in range(n)]
        a = sp.auc(scores, labels)
        b = _auc_ref(scores, labels)
        if a != a:  # both NaN (single-class)
            assert b != b
        else:
            assert abs(a - b) < 1e-12


def test_auc_perfect_and_reversed_and_tie():
    assert sp.auc([0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0]) == 1.0
    assert sp.auc([0.1, 0.2, 0.8, 0.9], [1, 1, 0, 0]) == 0.0
    assert sp.auc([0.5, 0.5, 0.5, 0.5], [1, 1, 0, 0]) == 0.5
    assert sp.auc([0.5, 0.5], [1, 1]) != sp.auc([0.5, 0.5], [1, 1])  # NaN (one class)


# --------------------------------------------------------------------------- #
# BH-FDR correctness
# --------------------------------------------------------------------------- #
def test_bh_fdr_all_reject_when_all_below_line():
    pvals = [0.01, 0.02, 0.03, 0.04, 0.05]
    reject, adj = sp.bh_fdr(pvals, 0.10)
    assert reject == [True] * 5
    # Adjusted p-values are all min(1, p*m/rank) monotone -> 0.05 here.
    assert all(abs(a - 0.05) < 1e-12 for a in adj)


def test_bh_fdr_only_smallest_rejected():
    pvals = [0.001, 0.5, 0.6, 0.7, 0.8]
    reject, adj = sp.bh_fdr(pvals, 0.10)
    assert reject == [True, False, False, False, False]
    assert adj[0] == pytest.approx(0.005)  # 0.001 * 5 / 1


def test_bh_fdr_stepup_rescues_middle():
    # Classic BH: p3 above its own line but rescued because a larger rank clears.
    pvals = [0.005, 0.03, 0.04, 0.9, 0.95]
    reject, _ = sp.bh_fdr(pvals, 0.10)
    # thresholds k/5*0.10 = .02 .04 .06 .08 .10 ; sorted p .005 .03 .04 .9 .95
    # largest k with p_(k) <= k/5*q: .04 <= .06 (k=3) -> reject ranks 1..3
    assert reject == [True, True, True, False, False]


def test_bh_fdr_none_reject():
    pvals = [0.5, 0.6, 0.7, 0.8, 0.9]
    reject, _ = sp.bh_fdr(pvals, 0.10)
    assert reject == [False] * 5


# --------------------------------------------------------------------------- #
# Paired bootstrap sign
# --------------------------------------------------------------------------- #
def _oof(probs, labels, prefix="C"):
    return [{"country": f"{prefix}{i}", "year": 2000, "prob": probs[i], "label": labels[i]}
            for i in range(len(probs))]


def test_paired_bootstrap_sign_positive_when_a_better():
    labels = [1] * 10 + [0] * 10
    probs_a = [float(l) for l in labels]      # perfect -> AUC 1.0
    probs_b = [0.5] * 20                       # AUC 0.5
    d = sp.paired_bootstrap_delta_auc(probs_a, probs_b, labels, b_eval=300, seed=12345)
    assert d["point"] == pytest.approx(0.5)
    assert d["ci95_lo"] > 0.0
    assert d["p_value"] < 0.05


def test_paired_bootstrap_sign_zero_when_identical():
    labels = [1] * 10 + [0] * 10
    probs = [0.3 + 0.02 * i for i in range(20)]
    d = sp.paired_bootstrap_delta_auc(probs, list(probs), labels, b_eval=300, seed=12345)
    assert d["point"] == pytest.approx(0.0, abs=1e-12)
    assert d["ci95_lo"] <= 0.0 <= d["ci95_hi"]
    assert d["p_value"] >= 0.5


def test_paired_bootstrap_sign_negative_when_a_worse():
    labels = [1] * 10 + [0] * 10
    probs_a = [1.0 - float(l) for l in labels]  # reversed -> AUC 0.0
    probs_b = [float(l) for l in labels]        # perfect -> AUC 1.0
    d = sp.paired_bootstrap_delta_auc(probs_a, probs_b, labels, b_eval=300, seed=12345)
    assert d["point"] == pytest.approx(-1.0)
    assert d["ci95_hi"] < 0.0
    assert d["p_value"] < 0.05


def test_pair_oof_occurrence_index_matching():
    # Duplicate (country, year) keys must pair k-th <-> k-th in order.
    oof_a = [
        {"country": "X", "year": 2001, "prob": 0.1, "label": 0},
        {"country": "X", "year": 2001, "prob": 0.2, "label": 0},
        {"country": "Y", "year": 2002, "prob": 0.9, "label": 1},
    ]
    oof_b = [
        {"country": "X", "year": 2001, "prob": 0.11, "label": 0},
        {"country": "Y", "year": 2002, "prob": 0.91, "label": 1},
        {"country": "Z", "year": 2003, "prob": 0.5, "label": 1},  # only in b -> dropped
    ]
    p = sp.pair_oof(oof_a, oof_b)
    # X@2001 pairs only the first occurrence (b has one), Y@2002 pairs, Z dropped.
    assert p["n_pairs"] == 2
    assert p["probs_a"] == [0.1, 0.9]
    assert p["probs_b"] == [0.11, 0.91]
    assert p["labels"] == [0, 1]
    assert p["countries"] == ["X", "Y"]          # aligned country labels for clustering
    assert p["label_mismatches"] == 0


# --------------------------------------------------------------------------- #
# Country-cluster paired bootstrap (fix 2b): clustering must NOT shrink the CI
# --------------------------------------------------------------------------- #
def test_country_cluster_bootstrap_widens_ci_vs_iid():
    # Country A: arm-a perfectly separates; Country B: arm-a reversed. Pooled AUC=0.5.
    # Cluster resampling can draw A+A (AUC 1.0) or B+B (AUC 0.0) -> Δ spans ±0.5 -> WIDE CI.
    # i.i.d. row resampling mixes A/B rows -> Δ hugs 0 -> narrow CI (the under-coverage bug).
    probs_a = [0.9] * 5 + [0.1] * 5 + [0.1] * 5 + [0.9] * 5
    labels = [1] * 5 + [0] * 5 + [1] * 5 + [0] * 5
    probs_b = [0.5] * 20
    countries = ["A"] * 10 + ["B"] * 10
    d_iid = sp.paired_bootstrap_delta_auc(probs_a, probs_b, labels, countries=None,
                                          b_eval=500, seed=1)
    d_clu = sp.paired_bootstrap_delta_auc(probs_a, probs_b, labels, countries=countries,
                                          b_eval=500, seed=1)
    w_iid = d_iid["ci95_hi"] - d_iid["ci95_lo"]
    w_clu = d_clu["ci95_hi"] - d_clu["ci95_lo"]
    assert d_clu["n_clusters"] == 2
    assert w_clu > w_iid          # within-country correlation must not be discarded


# --------------------------------------------------------------------------- #
# fix 4: an all-null CI (empty/unstable core) must score FAIL, never raise
# --------------------------------------------------------------------------- #
def test_eval_patient_null_ci_scores_fail_without_raising():
    criteria = sp.load_criteria(REAL_CRITERIA)
    run31 = {"arm": "run31", "stable_set": [], "reference_set": [], "pi": {},
             "resample_selected_sets": [], "ci95_lo": None, "ci95_hi": None,
             "loco_auc": float("nan")}
    run2 = {"arm": "run2", "selected_set": ["a", "b", "c"], "loco_auc": 0.70}
    ev = sp.eval_patient(run31, run2, "executive_power_consolidation", criteria, pi_keep=0.60)
    assert ev["raw_pass"] is False
    auc_check = next(c for c in ev["checks"] if c["name"] == "loco_auc_ci_lower_ge_run2_minus")
    assert auc_check["pass"] is False       # None handled -> clean FAIL, not a TypeError


def test_eval_territorial_null_ci_scores_fail_without_raising():
    criteria = sp.load_criteria(REAL_CRITERIA)
    run31 = {"arm": "run31", "stable_set": [], "reference_set": [],
             "ci95_lo": None, "ci95_hi": None}
    run2 = {"arm": "run2", "selected_set": ["p"], "loco_auc": 0.71}
    ev = sp.eval_territorial(run31, run2, "territorial_disputes", criteria)
    assert ev["raw_pass"] is False
    assert ev["includes_run2"] is False and ev["tight_below"] is False


# --------------------------------------------------------------------------- #
# fix 5a: π-coverage bar is measured over reference_set, NOT the tautological
# stable_set (== {π>=0.60}). A reference_set member with π<0.60 lowers the frac.
# --------------------------------------------------------------------------- #
def test_pi_coverage_bar_measured_over_reference_set_not_stable_set():
    criteria = sp.load_criteria(REAL_CRITERIA)
    run31 = {
        "arm": "run31",
        "stable_set": ["a", "b", "c"],               # == {π>=0.60}: would give frac 1.0
        "reference_set": ["a", "b", "c", "d", "e"],  # d,e are picked but NOT stable
        "pi": {"a": 0.9, "b": 0.8, "c": 0.7, "d": 0.3, "e": 0.1},
        "resample_selected_sets": [["a", "b", "c"]] * 8,
        "ci95_lo": 0.70, "ci95_hi": 0.80, "loco_auc": 0.75,
    }
    run2 = {"arm": "run2", "selected_set": ["a", "b", "c"], "loco_auc": 0.70}
    ev = sp.eval_patient(run31, run2, "executive_power_consolidation", criteria, pi_keep=0.60)
    frac_check = next(c for c in ev["checks"] if c["name"] == "pi_ge_keep_on_frac_of_set_ge")
    assert frac_check["detail"]["reference_set_size"] == 5
    assert frac_check["detail"]["frac_pi_ge_keep"] == pytest.approx(0.6)  # 3/5, NOT 1.0


# --------------------------------------------------------------------------- #
# Jaccard family
# --------------------------------------------------------------------------- #
def test_jaccard_basic_and_empty():
    assert sp.jaccard(["a", "b", "c"], ["b", "c", "d"]) == pytest.approx(2 / 4)
    assert sp.jaccard([], []) == 1.0            # two empty sets are identical
    assert sp.jaccard(["a"], []) == 0.0
    assert sp.jaccard(["a", "b"], ["a", "b"]) == 1.0


def test_mean_pairwise_jaccard():
    # Three identical sets -> 1.0 ; three disjoint -> 0.0.
    assert sp.mean_pairwise_jaccard([["a", "b"]] * 3) == pytest.approx(1.0)
    assert sp.mean_pairwise_jaccard([["a"], ["b"], ["c"]]) == pytest.approx(0.0)
    # Single set -> NaN (no pair).
    x = sp.mean_pairwise_jaccard([["a"]])
    assert x != x


def test_pi_from_sets():
    pi = sp.pi_from_sets([["a", "b"], ["a"], ["a", "c"], ["a"]])
    assert pi["a"] == pytest.approx(1.0)
    assert pi["b"] == pytest.approx(0.25)
    assert pi["c"] == pytest.approx(0.25)


def test_split_half_pi_jaccard_stable_vs_unstable():
    # Perfectly stable: every walk selects the same set -> reliability 1.0.
    stable = [["a", "b", "c"]] * 8
    assert sp.split_half_pi_jaccard(stable, pi_keep=0.60) == pytest.approx(1.0)
    # Two halves select disjoint stable cores -> reliability 0.0.
    unstable = [["a", "b"]] * 4 + [["x", "y"]] * 4
    assert sp.split_half_pi_jaccard(unstable, pi_keep=0.60) == pytest.approx(0.0)


def test_percentile_linear():
    xs = [0.0, 1.0, 2.0, 3.0, 4.0]
    assert sp.percentile(xs, 0) == 0.0
    assert sp.percentile(xs, 100) == 4.0
    assert sp.percentile(xs, 50) == 2.0
    assert sp.percentile(xs, 25) == 1.0


# --------------------------------------------------------------------------- #
# criteria.yaml loading of the locked values
# --------------------------------------------------------------------------- #
def test_load_criteria_locked_values():
    c = sp.load_criteria(REAL_CRITERIA)
    assert sp._get(c, "meta", "b_eval") == 1000
    assert float(sp._get(c, "meta", "fdr", "q")) == pytest.approx(0.10)
    assert sp._get(c, "recipes", "civil_war_and_insurgency", "mandatory") is True
    assert float(sp._get(c, "method", "stability", "pi_keep_threshold")) == pytest.approx(0.60)
    assert int(sp._get(c, "overall_aws_funding_gate", "min_other_recipes_passing_post_fdr")) == 3
    assert float(sp._get(c, "overall_aws_funding_gate",
                         "mean_pairwise_jaccard_stability_improvement_over_run3_ge")) == pytest.approx(0.30)


def test_minimal_yaml_fallback_matches_pyyaml():
    # The stdlib fallback must agree with PyYAML on the fields the scorer reads.
    text = REAL_CRITERIA.read_text(encoding="utf-8")
    fb = sp._minimal_yaml(text)
    assert sp._get(fb, "meta", "b_eval") == 1000
    assert float(sp._get(fb, "meta", "fdr", "q")) == pytest.approx(0.10)
    assert int(sp._get(fb, "overall_aws_funding_gate", "min_other_recipes_passing_post_fdr")) == 3
    # territorial pass_if_any tight-width threshold survives the fallback parse.
    pa = sp._get(fb, "recipes", "territorial_disputes", "checks", "pass_if_any")
    widths = [e.get("ci_upper_lt_run2_and_ci_width_le") for e in pa if isinstance(e, dict)]
    assert 0.08 in [w for w in widths if w is not None]


# =========================================================================== #
# Fully-synthetic end-to-end fixtures: a KNOWN PASS and a KNOWN FAIL
# =========================================================================== #
_N = 20
_COUNTRIES = [f"C{i}" for i in range(_N)]
_LABELS = [1] * (_N // 2) + [0] * (_N // 2)
_FLAT = [0.5] * _N
_PERFECT = [float(l) for l in _LABELS]


def _mk_oof(probs):
    return [{"country": _COUNTRIES[i], "year": 2000, "prob": probs[i], "label": _LABELS[i]}
            for i in range(_N)]


def _consistent(stable, k=6):
    return [list(stable) for _ in range(k)]


def _disjoint(tag, k=6):
    return [[f"{tag}_z{j}"] for j in range(k)]


def _run31(stable, oof_probs, ci_lo=0.70, ci_hi=0.80, loco=0.75, reference=None):
    # reference_set defaults to the stable set (a clean, fully-reselected pick):
    # frac(π≥0.60 over reference) = 1.0 and mean π over reference = 0.80 here.
    return {
        "arm": "run31",
        "stable_set": list(stable),
        "reference_set": list(stable if reference is None else reference),
        "pi": {ind: 0.80 for ind in stable},
        "resample_selected_sets": _consistent(stable),
        "loco_auc": loco,
        "ci95_lo": ci_lo,
        "ci95_hi": ci_hi,
        "oof": _mk_oof(oof_probs),
        "final_indicator_count": len(stable),
    }


def _run3method(tag):
    return {"arm": "run3method", "resample_selected_sets": _disjoint(tag)}


def _run2(selected, oof_probs, loco=0.70):
    return {
        "arm": "run2",
        "selected_set": list(selected),
        "loco_auc": loco,
        "ci95_lo": loco - 0.03,
        "ci95_hi": loco + 0.03,
        "oof": _mk_oof(oof_probs),
        "n_pos": _N // 2,
    }


def _build_pass_results():
    """Return {recipe: {arm: dict}} crafted to clear every locked criterion."""
    data = {}
    # CONTROL: identical OOF -> ΔAUC 0 (CI contains 0, |pt|<=0.02); Jaccard(stable,run2)=1.
    data["civil_war_and_insurgency"] = {
        "run31": _run31(["a", "b", "c"], _FLAT),
        "run3method": _run3method("civ"),
        "run2": _run2(["a", "b", "c"], _FLAT, loco=0.68),
    }
    # PATIENTS: π all>=0.6, split-half reliability 1.0, count diff 0, arm CI lo 0.70 >= 0.70-0.02.
    for rc, tag in (("executive_power_consolidation", "exe"), ("military_coup", "mil")):
        data[rc] = {
            "run31": _run31(["a", "b", "c", "d"], _FLAT, ci_lo=0.70, ci_hi=0.80),
            "run3method": _run3method(tag),
            "run2": _run2(["a", "b", "c", "d"], _FLAT, loco=0.70),
        }
    # BANKING: run31 perfect vs run2 chance -> ΔAUC CI lower 0.5 >= 0.03 and FDR-rejected.
    data["banking_and_financial_crisis"] = {
        "run31": _run31(["a", "b", "c"], _PERFECT),
        "run3method": _run3method("bnk"),
        "run2": _run2(["x", "y", "z"], _FLAT, loco=0.77),
    }
    # TERRITORIAL: identical OOF (not FDR-rejected) + arm CI brackets run2 point 0.71 -> "recover".
    data["territorial_disputes"] = {
        "run31": _run31(["a", "b", "c"], _FLAT, ci_lo=0.65, ci_hi=0.75, loco=0.70),
        "run3method": _run3method("ter"),
        "run2": _run2(["p", "q", "r", "s", "t"], _FLAT, loco=0.71),
    }
    return data


def _write_results(results_dir: Path, data: dict):
    results_dir.mkdir(parents=True, exist_ok=True)
    for recipe, arms in data.items():
        for arm, payload in arms.items():
            (results_dir / f"{recipe}.{arm}.json").write_text(
                json.dumps(payload), encoding="utf-8")


def _score_dir(results_dir: Path):
    criteria = sp.load_criteria(REAL_CRITERIA)
    return sp.score(results_dir, criteria, b_eval=300, seed=12345)


def test_end_to_end_known_pass(tmp_path):
    results_dir = tmp_path / "results"
    _write_results(results_dir, _build_pass_results())
    report = _score_dir(results_dir)

    ov = report["overall_gate"]
    assert ov["invalidated_by_control"] is False
    assert ov["overall_pass"] is True, report

    # Every recipe clears its post-FDR bar.
    for r in sp.RECIPE_ORDER:
        assert report["recipes"][r]["post_fdr_pass"] is True, r

    # Banking is the one FDR-rejected significant-positive gain.
    assert report["recipes"]["banking_and_financial_crisis"]["fdr"]["reject"] is True
    assert report["recipes"]["civil_war_and_insurgency"]["fdr"]["reject"] is False
    assert report["recipes"]["territorial_disputes"]["fdr"]["reject"] is False

    # Gate sub-metrics.
    assert ov["n_other_recipes_passing_post_fdr"] == 4
    assert ov["mean_pi_across_all_5"] >= 0.60
    assert ov["mean_pairwise_jaccard_stability_improvement"] >= 0.30


def test_end_to_end_known_fail_control_veto(tmp_path):
    # Break the control veto: make run31 stable set disjoint from run2's selected
    # set -> Jaccard 0 < 0.60 -> control fails -> ENTIRE pilot invalidated.
    data = _build_pass_results()
    data["civil_war_and_insurgency"]["run31"]["stable_set"] = ["zzz1", "zzz2", "zzz3"]
    data["civil_war_and_insurgency"]["run31"]["pi"] = {"zzz1": 0.8, "zzz2": 0.8, "zzz3": 0.8}
    data["civil_war_and_insurgency"]["run31"]["resample_selected_sets"] = _consistent(
        ["zzz1", "zzz2", "zzz3"])
    results_dir = tmp_path / "results"
    _write_results(results_dir, data)
    report = _score_dir(results_dir)

    ov = report["overall_gate"]
    assert ov["invalidated_by_control"] is True
    assert ov["overall_pass"] is False
    assert report["recipes"]["civil_war_and_insurgency"]["raw_pass"] is False


def test_end_to_end_known_fail_too_few_others(tmp_path):
    # Control passes, but break banking (no gain) AND territorial (ambiguous) so
    # only 2 of the 4 others pass -> gate fails on min_other, NOT invalidated.
    data = _build_pass_results()
    # Banking: identical OOF -> ΔAUC 0 -> CI lower not > 0 and not FDR-rejected.
    data["banking_and_financial_crisis"]["run31"]["oof"] = _mk_oof(_FLAT)
    # Territorial: arm CI far above run2 point and wide -> neither recover nor tight-below.
    data["territorial_disputes"]["run31"]["ci95_lo"] = 0.85
    data["territorial_disputes"]["run31"]["ci95_hi"] = 0.99
    results_dir = tmp_path / "results"
    _write_results(results_dir, data)
    report = _score_dir(results_dir)

    ov = report["overall_gate"]
    assert ov["invalidated_by_control"] is False
    assert report["recipes"]["civil_war_and_insurgency"]["post_fdr_pass"] is True
    assert report["recipes"]["banking_and_financial_crisis"]["post_fdr_pass"] is False
    assert report["recipes"]["territorial_disputes"]["post_fdr_pass"] is False
    assert ov["n_other_recipes_passing_post_fdr"] == 2
    assert ov["overall_pass"] is False


def test_main_writes_valid_outputs(tmp_path):
    results_dir = tmp_path / "results"
    _write_results(results_dir, _build_pass_results())
    out_md = results_dir / "PILOT-REPORT.md"
    out_json = results_dir / "report.json"
    rc = sp.main([
        "--results-dir", str(results_dir),
        "--criteria", str(REAL_CRITERIA),
        "--b-eval", "300",
        "--out-md", str(out_md),
        "--out-json", str(out_json),
    ])
    assert rc == 0                       # PASS fixture -> exit 0
    assert out_md.exists() and out_json.exists()
    # report.json must be strictly valid JSON (no NaN/Inf tokens).
    raw = out_json.read_text(encoding="utf-8")
    assert "NaN" not in raw and "Infinity" not in raw
    loaded = json.loads(raw)
    assert loaded["overall_gate"]["overall_pass"] is True
    # Markdown carries a clear headline + per-recipe verdicts.
    md = out_md.read_text(encoding="utf-8")
    assert "AWS-funding gate CLEARED" in md
    for r in sp.RECIPE_ORDER:
        assert r in md
