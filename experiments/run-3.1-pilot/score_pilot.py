#!/usr/bin/env python3
"""score_pilot.py -- run-3.1 selection-method pilot scorer.

Reads the FROZEN INTER-MODULE CONTRACT JSON produced by the ``stability_select``
and ``baseline`` agents (``results/{recipe}.{run31,run3method,run2}.json``) plus
the locked ``criteria.yaml``, and emits ``results/PILOT-REPORT.md`` +
``results/report.json`` with a per-recipe PASS/FAIL and the overall AWS-funding
gate verdict.

Spec of record: ``PRE-REGISTRATION.md`` (locked scorecard) + ``criteria.yaml``
(machine-readable bar). This scorer implements section 5 of the pre-registration.

Design notes (all thresholds are READ FROM criteria.yaml, never hard-coded, so
this scorer honours the locked bar exactly; the literals below are only defensive
fallbacks matching the locked values):

  1. Paired bootstrap ΔAUC (run31 - run2) on the OOF predictions, paired on
     identical country folds by matching ``(country, year)`` with a per-key
     occurrence index (INTEGRATION-SPEC §3 caveat: the two arms drop DIFFERENT
     rows in build_X_y, so we pair on the intersection). ``B_eval`` resamples,
     COUNTRY-CLUSTER (resample whole countries with replacement, take all their
     OOF rows), IDENTICAL indices for both arms => paired on identical country
     folds (fix 2b: i.i.d. row resampling ignores within-country correlation and
     under-covers). The point estimate is ΔAUC on the full matched set; the 95%
     CI is the 2.5/97.5 percentile band of the bootstrap Δ distribution; the
     p-value is a two-sided bootstrap p against H0: ΔAUC = 0.

  2. BH-FDR (Benjamini-Hochberg) at q = 0.10 is applied JOINTLY across the five
     recipe-level ΔAUC p-values (PRE-REG §5.0). Every recipe contributes a
     p-value to the family so the correction is calibrated across all five; the
     resulting reject flags then inform the significance-based bars.

  3. Per-recipe checks are evaluated EXACTLY per criteria.yaml:
       - civil_war  (control veto, evaluated FIRST): ΔAUC CI contains 0 AND
         |point| <= 0.02 AND Jaccard(stable_set, run2 set) >= 0.60. Fail =>
         entire pilot INVALIDATED.
       - executive_power / military_coup (patients): fraction of the REFERENCE
         set (the full-sample greedy pick, NOT stable_set which is {π>=0.60}) with
         π >= 0.60 is >= 0.60; split-half π Jaccard reliability >= 0.70
         (split resample_selected_sets into two equal halves, recompute π on
         each, Jaccard the two {π>=0.60} keepsets); |count - run2 count| <= 3;
         arm CI-lower >= run2 point - 0.02.
       - banking (gain-is-real): ΔAUC CI lower > 0 AND >= +0.03.
       - territorial (loss, decisive): arm CI includes run2 point  OR  arm CI
         upper < run2 point with width <= 0.08; a wide ambiguous CI = FAIL.

  4. "post-FDR" pass folds the joint FDR determination into the significance
     bars: banking must be FDR-rejected (significant positive gain); territorial
     "recovers" branch must NOT be rejected (was noise) while its "significantly
     below" branch must be rejected; control must NOT be rejected (do-no-harm);
     exec/military bars are π/count/AUC-CI (not the paired Δ) so their post-FDR
     pass equals their raw pass.

  5. Stability-improvement KPI = mean pairwise Jaccard of run31
     resample_selected_sets minus that of run3method, averaged across the 5
     recipes; the overall gate requires this to improve >= 0.30 absolute.

Pure stdlib (no numpy/pandas/yaml required at runtime): PyYAML is used when
available, else a minimal block-YAML fallback parses the locked file. Determinism
seed base = 12345.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import re
from collections import Counter, OrderedDict, defaultdict
from pathlib import Path
from typing import Any

# --------------------------------------------------------------------------- #
# Recipe registry (control first -- it is evaluated first and is a hard veto)
# --------------------------------------------------------------------------- #
CONTROL_RECIPE = "civil_war_and_insurgency"
RECIPE_ORDER = [
    CONTROL_RECIPE,
    "executive_power_consolidation",
    "military_coup",
    "banking_and_financial_crisis",
    "territorial_disputes",
]
PATIENT_RECIPES = {"executive_power_consolidation", "military_coup"}

SEED_BASE = 12345

# Defensive fallbacks (locked values); the real values are read from criteria.yaml.
_DEF_B_EVAL = 1000
_DEF_Q = 0.10
_DEF_PI_KEEP = 0.60


# =========================================================================== #
# Pure-math primitives (no numpy)
# =========================================================================== #
def _is_num(x) -> bool:
    """True iff ``x`` is a real, finite-ish number: NOT None and NOT NaN.

    Guard BEFORE any ``<``/``>``/``-`` on a contract CI value: an unstable/empty
    core writes ``ci95_lo/hi = null`` (JSON None). ``None == None`` is True, so a
    bare NaN-guard (``x == x``) lets None through and the next comparison /
    subtraction raises TypeError. Empty cores must score a clean FAIL, never crash
    (adversarial review fix 4; the EXPECTED path for the broken canaries).
    """
    return x is not None and x == x


def auc(scores: list[float], labels: list[int]) -> float:
    """Mann-Whitney-U AUC with mid-ranks for ties (== ties count 0.5).

    Identical semantics to run_f_ml_1_poc.compute_auc; O(n log n) via ranking so
    the paired bootstrap is fast in pure Python. NaN if either class is empty.
    """
    n = len(scores)
    n_pos = sum(1 for l in labels if l == 1)
    n_neg = n - n_pos
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    order = sorted(range(n), key=lambda i: scores[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        sv = scores[order[i]]
        while j + 1 < n and scores[order[j + 1]] == sv:
            j += 1
        avg = (i + 1 + j + 1) / 2.0  # average of 1-indexed ranks in the tie block
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    r_pos = sum(ranks[i] for i in range(n) if labels[i] == 1)
    u = r_pos - n_pos * (n_pos + 1) / 2.0
    return u / (n_pos * n_neg)


def percentile(values: list[float], q: float) -> float:
    """Linear-interpolated percentile (numpy default 'linear' method), q in 0..100."""
    if not values:
        return float("nan")
    xs = sorted(values)
    if len(xs) == 1:
        return xs[0]
    pos = (q / 100.0) * (len(xs) - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return xs[lo]
    frac = pos - lo
    return xs[lo] * (1.0 - frac) + xs[hi] * frac


def jaccard(a, b) -> float:
    """Jaccard index of two iterables of hashables; two empty sets => 1.0."""
    sa, sb = set(a), set(b)
    union = sa | sb
    if not union:
        return 1.0
    return len(sa & sb) / len(union)


def mean_pairwise_jaccard(sets: list) -> float:
    """Mean Jaccard over all C(L,2) unordered pairs of the given sets.

    NaN if fewer than two sets (no pair to average).
    """
    lst = [set(s) for s in sets]
    L = len(lst)
    if L < 2:
        return float("nan")
    total = 0.0
    cnt = 0
    for i in range(L):
        for j in range(i + 1, L):
            total += jaccard(lst[i], lst[j])
            cnt += 1
    return total / cnt if cnt else float("nan")


def pi_from_sets(sets: list) -> dict:
    """Selection frequency π_j = (#walks selecting j) / (#walks) over a list of sets."""
    n = len(sets)
    if n == 0:
        return {}
    c: Counter = Counter()
    for s in sets:
        for ind in set(s):
            c[ind] += 1
    return {k: v / n for k, v in c.items()}


def split_half_pi_jaccard(resample_selected_sets: list, pi_keep: float = _DEF_PI_KEEP) -> float:
    """Split-half π reliability: split the per-walk sets into two EQUAL halves,
    recompute π on each half, and Jaccard the two {π >= pi_keep} keepsets.

    For an odd number of walks the middle element is dropped so the halves are
    equal length. NaN if fewer than two walks.
    """
    L = len(resample_selected_sets)
    if L < 2:
        return float("nan")
    half = L // 2
    first = resample_selected_sets[:half]
    second = resample_selected_sets[half:2 * half]
    pi_a = pi_from_sets(first)
    pi_b = pi_from_sets(second)
    keep_a = {j for j, v in pi_a.items() if v >= pi_keep}
    keep_b = {j for j, v in pi_b.items() if v >= pi_keep}
    return jaccard(keep_a, keep_b)


def bh_fdr(pvals: list[float], q: float) -> tuple[list[bool], list[float]]:
    """Benjamini-Hochberg FDR.

    Returns (reject_flags, adjusted_pvalues) aligned to the input order.
    Rejects H_i for all i with p_(i) among the k smallest, where k is the largest
    rank with p_(k) <= (k/m) * q.
    """
    m = len(pvals)
    if m == 0:
        return [], []
    order = sorted(range(m), key=lambda i: pvals[i])
    kmax = 0
    for rank, idx in enumerate(order, start=1):
        if pvals[idx] <= (rank / m) * q:
            kmax = rank
    reject = [False] * m
    for rank, idx in enumerate(order, start=1):
        if rank <= kmax:
            reject[idx] = True
    # Monotone step-up adjusted p-values.
    adj = [0.0] * m
    prev = 1.0
    for rank in range(m, 0, -1):
        idx = order[rank - 1]
        val = min(prev, pvals[idx] * m / rank)
        adj[idx] = val
        prev = val
    return reject, adj


# =========================================================================== #
# Paired bootstrap ΔAUC
# =========================================================================== #
def pair_oof(oof_a: list[dict], oof_b: list[dict]) -> dict:
    """Pair two OOF lists on (country, year) with a per-key occurrence index.

    Both lists derive from the same canonical `samples` (INTEGRATION-SPEC §3) so
    the k-th (country, year) occurrence in one arm corresponds to the k-th in the
    other. Rows present in only one arm are excluded from the paired test.

    Returns {"probs_a", "probs_b", "labels", "countries", "n_pairs", "n_a",
             "n_b", "label_mismatches"}. ``countries`` is aligned to the paired
    rows and drives the country-cluster bootstrap (paired_bootstrap_delta_auc).
    """
    da: "OrderedDict[tuple, list]" = OrderedDict()
    db: dict = defaultdict(list)
    for r in oof_a:
        key = (str(r["country"]), int(r["year"]))
        da.setdefault(key, []).append((float(r["prob"]), int(r["label"])))
    for r in oof_b:
        key = (str(r["country"]), int(r["year"]))
        db[key].append((float(r["prob"]), int(r["label"])))

    probs_a: list[float] = []
    probs_b: list[float] = []
    labels: list[int] = []
    countries: list[str] = []
    mism = 0
    for key, rows_a in da.items():  # insertion order of arm A => deterministic
        rows_b = db.get(key)
        if not rows_b:
            continue
        for k in range(min(len(rows_a), len(rows_b))):
            pa, la = rows_a[k]
            pb, lb = rows_b[k]
            if la != lb:
                mism += 1
            probs_a.append(pa)
            probs_b.append(pb)
            labels.append(la)
            countries.append(key[0])
    return {
        "probs_a": probs_a,
        "probs_b": probs_b,
        "labels": labels,
        "countries": countries,
        "n_pairs": len(labels),
        "n_a": len(oof_a),
        "n_b": len(oof_b),
        "label_mismatches": mism,
    }


def paired_bootstrap_delta_auc(
    probs_a: list[float],
    probs_b: list[float],
    labels: list[int],
    countries: list | None = None,
    b_eval: int = _DEF_B_EVAL,
    seed: int = SEED_BASE,
) -> dict:
    """Paired COUNTRY-CLUSTER bootstrap of ΔAUC = AUC(a) - AUC(b) on identical folds.

    Both arms are resampled with the SAME indices each iteration (that is what
    makes it paired, on identical country folds per the pre-reg). The resampling
    unit is a whole COUNTRY, not a row: we resample the set of countries with
    replacement and take ALL of a drawn country's OOF rows (adversarial review fix
    2b). i.i.d. row resampling ignores within-country correlation and yields
    too-narrow CIs — risking a false control-invalidation and a false banking
    "≥+0.03" pass. Clustering by country restores honest interval width.

    ``countries`` aligns 1:1 with ``labels`` (from ``pair_oof``); if None, each row
    is its own cluster (degenerates to the i.i.d. row bootstrap — used only by unit
    tests that pass raw arrays). Returns the full-sample point Δ, the 95% CI, a
    two-sided bootstrap p-value against H0: ΔAUC = 0, and counts.
    """
    n = len(labels)
    point_a = auc(probs_a, labels)
    point_b = auc(probs_b, labels)
    point = point_a - point_b
    out = {
        "point": point,
        "auc_a": point_a,
        "auc_b": point_b,
        "ci95_lo": float("nan"),
        "ci95_hi": float("nan"),
        "p_value": float("nan"),
        "n_pairs": n,
        "n_clusters": 0,
        "n_boot_valid": 0,
        "b_eval": int(b_eval),
    }
    if n == 0 or point != point:  # empty or nan point (single-class overall)
        return out

    # Group row indices by country cluster (each row its own cluster if no countries).
    if countries is None:
        clusters = [[i] for i in range(n)]
    else:
        by_country: "OrderedDict[Any, list]" = OrderedDict()
        for i in range(n):
            by_country.setdefault(countries[i], []).append(i)
        clusters = list(by_country.values())  # deterministic (first-seen order)
    g = len(clusters)
    out["n_clusters"] = g

    rng = random.Random(seed)
    randrange = rng.randrange
    deltas: list[float] = []
    for _ in range(int(b_eval)):
        idx: list[int] = []
        for _c in range(g):  # resample WHOLE countries with replacement
            idx.extend(clusters[randrange(g)])
        ra = [probs_a[i] for i in idx]
        rb = [probs_b[i] for i in idx]
        rl = [labels[i] for i in idx]
        da_ = auc(ra, rl)
        if da_ != da_:  # single-class resample
            continue
        db_ = auc(rb, rl)
        if db_ != db_:
            continue
        deltas.append(da_ - db_)

    if not deltas:
        return out
    out["ci95_lo"] = percentile(deltas, 2.5)
    out["ci95_hi"] = percentile(deltas, 97.5)
    m = len(deltas)
    n_le = sum(1 for d in deltas if d <= 0.0)
    n_ge = sum(1 for d in deltas if d >= 0.0)
    p = 2.0 * min((n_le + 1) / (m + 1), (n_ge + 1) / (m + 1))
    out["p_value"] = min(1.0, p)
    out["n_boot_valid"] = m
    return out


# =========================================================================== #
# criteria.yaml loading (PyYAML if present, else a minimal block-YAML fallback)
# =========================================================================== #
def load_criteria(path) -> dict:
    text = Path(path).read_text(encoding="utf-8")
    try:  # PyYAML is present in the pilot test venv; preferred path.
        import yaml  # type: ignore

        data = yaml.safe_load(text)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return _minimal_yaml(text)


def _yaml_scalar(v: str):
    v = v.strip()
    if v == "" or v == "~" or v.lower() == "null":
        return None
    if len(v) >= 2 and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
        return v[1:-1]
    low = v.lower()
    if low in ("true", "yes"):
        return True
    if low in ("false", "no"):
        return False
    if re.fullmatch(r"[+-]?\d+", v):
        return int(v)
    if re.fullmatch(r"[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?", v):
        try:
            return float(v)
        except ValueError:
            return v
    return v


def _minimal_yaml(text: str):
    """Parse the small, well-formed block-YAML criteria file (no anchors/flow).

    Handles nested mappings, ``- item`` sequences (scalars or single-key maps),
    ``# comments`` (full-line and whitespace-preceded trailing), and scalar
    typing. Sufficient for criteria.yaml; not a general YAML implementation.
    """
    # Strip comments + blank lines, keep (indent, content) for non-empty lines.
    lines: list[tuple[int, str]] = []
    for raw in text.splitlines():
        # Drop full-line comments.
        if raw.lstrip().startswith("#"):
            continue
        # Drop whitespace-preceded trailing comments (values here contain no '#').
        raw = re.sub(r"\s+#.*$", "", raw)
        if raw.strip() == "":
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        lines.append((indent, raw.strip()))

    pos = 0

    def parse_block(min_indent: int):
        nonlocal pos
        # Decide sequence vs mapping by the first line at this indent.
        if pos >= len(lines):
            return None
        indent0 = lines[pos][0]
        is_seq = lines[pos][1].startswith("- ") or lines[pos][1] == "-"
        container: Any = [] if is_seq else OrderedDict()
        while pos < len(lines):
            indent, content = lines[pos]
            if indent < min_indent:
                break
            if indent > min_indent:
                # Should have been consumed by a child parse; skip defensively.
                pos += 1
                continue
            if content.startswith("- ") or content == "-":
                item = content[1:].strip()
                pos += 1
                if item == "":
                    container.append(parse_block(min_indent + 2))
                elif ":" in item and not _looks_like_plain_scalar(item):
                    # Inline single-key mapping inside a sequence entry.
                    key, _, val = item.partition(":")
                    val = val.strip()
                    if val == "":
                        sub = OrderedDict()
                        sub[key.strip()] = parse_block(_next_indent(min_indent))
                        container.append(sub)
                    else:
                        container.append(OrderedDict([(key.strip(), _yaml_scalar(val))]))
                else:
                    container.append(_yaml_scalar(item))
            else:
                key, _, val = content.partition(":")
                key = key.strip()
                val = val.strip()
                pos += 1
                if val == "":
                    child = parse_block(_next_indent(min_indent)) if _has_child(min_indent) else None
                    container[key] = child
                else:
                    container[key] = _yaml_scalar(val)
        return container

    def _has_child(cur_indent: int) -> bool:
        return pos < len(lines) and lines[pos][0] > cur_indent

    def _next_indent(cur_indent: int) -> int:
        return lines[pos][0] if pos < len(lines) else cur_indent + 2

    def _looks_like_plain_scalar(item: str) -> bool:
        # e.g. a bare "- 50" is a scalar even though YAML ints have no colon.
        return ":" not in item

    if not lines:
        return OrderedDict()
    return parse_block(lines[0][0])


# =========================================================================== #
# Result IO
# =========================================================================== #
def _read_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def load_recipe_results(results_dir: Path, recipe: str) -> dict:
    """Load the three arm JSONs for a recipe. Missing files raise FileNotFoundError."""
    out = {}
    for arm in ("run31", "run3method", "run2"):
        p = results_dir / f"{recipe}.{arm}.json"
        if not p.exists():
            raise FileNotFoundError(f"missing pilot result: {p}")
        out[arm] = _read_json(p)
    return out


# =========================================================================== #
# criteria accessors (read the locked file; fall back to locked literals)
# =========================================================================== #
def _get(d: dict, *keys, default=None):
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


# =========================================================================== #
# Per-recipe evaluation
# =========================================================================== #
def _check(name, passed, detail):
    return {"name": name, "pass": bool(passed), "detail": detail}


def eval_control(run31: dict, run2: dict, delta: dict, criteria: dict) -> dict:
    checks_cfg = _get(criteria, "recipes", CONTROL_RECIPE, "checks", default={}) or {}
    abs_le = float(checks_cfg.get("abs_point_estimate_le", 0.02))
    jac_ge = float(checks_cfg.get("selected_set_jaccard_vs_run2_ge", 0.60))
    want_contains_zero = bool(checks_cfg.get("delta_auc_ci_contains_zero", True))

    lo, hi, pt = delta["ci95_lo"], delta["ci95_hi"], delta["point"]
    contains_zero = (lo == lo and hi == hi and lo <= 0.0 <= hi)
    abs_ok = (pt == pt) and abs(pt) <= abs_le
    jac = jaccard(run31.get("stable_set", []), run2.get("selected_set", []))
    jac_ok = jac >= jac_ge

    checks = [
        _check(
            "delta_auc_ci_contains_zero",
            (contains_zero == want_contains_zero),
            {"ci95": [lo, hi], "contains_zero": contains_zero, "required": want_contains_zero},
        ),
        _check("abs_point_estimate_le", abs_ok, {"point": pt, "threshold": abs_le}),
        _check("selected_set_jaccard_vs_run2_ge", jac_ok, {"jaccard": jac, "threshold": jac_ge}),
    ]
    raw_pass = all(c["pass"] for c in checks)
    return {"checks": checks, "raw_pass": raw_pass, "jaccard_vs_run2": jac}


def eval_patient(run31: dict, run2: dict, recipe: str, criteria: dict, pi_keep: float) -> dict:
    checks_cfg = _get(criteria, "recipes", recipe, "checks", default={}) or {}
    frac_ge = float(checks_cfg.get("pi_ge_0.60_on_frac_of_set_ge", 0.60))
    reliab_ge = float(checks_cfg.get("split_half_pi_jaccard_reliability_ge", 0.70))
    count_within = int(checks_cfg.get("indicator_count_within_of_run2", 3))
    auc_margin = float(checks_cfg.get("loco_auc_ci_lower_ge_run2_minus", 0.02))

    stable = list(run31.get("stable_set", []))
    pi = run31.get("pi", {}) or {}
    # De-tautologized π-coverage bar (fix 5a): measure over the reference_set (a
    # full-sample greedy pick NOT defined by π≥0.60), NOT over stable_set (which IS
    # {π≥0.60}, making the bar trivially 1.0). Fall back to stable_set only for
    # legacy results missing the field.
    reference = list(run31.get("reference_set", run31.get("stable_set", [])))
    if reference:
        frac = sum(1 for j in reference if float(pi.get(j, 0.0)) >= pi_keep) / len(reference)
    else:
        frac = 0.0
    c1 = frac >= frac_ge

    reliab = split_half_pi_jaccard(run31.get("resample_selected_sets", []), pi_keep)
    c2 = _is_num(reliab) and reliab >= reliab_ge

    run2_count = len(run2.get("selected_set", []))
    count_diff = abs(len(stable) - run2_count)
    c3 = count_diff <= count_within

    arm_lo = run31.get("ci95_lo", float("nan"))
    run2_auc = run2.get("loco_auc", float("nan"))
    c4 = _is_num(arm_lo) and _is_num(run2_auc) and arm_lo >= (run2_auc - auc_margin)

    checks = [
        _check("pi_ge_keep_on_frac_of_set_ge", c1,
               {"frac_pi_ge_keep": frac, "threshold": frac_ge, "pi_keep": pi_keep,
                "reference_set_size": len(reference)}),
        _check("split_half_pi_jaccard_reliability_ge", c2,
               {"reliability": reliab, "threshold": reliab_ge}),
        _check("indicator_count_within_of_run2", c3,
               {"count": len(stable), "run2_count": run2_count, "diff": count_diff,
                "within": count_within}),
        _check("loco_auc_ci_lower_ge_run2_minus", c4,
               {"arm_ci95_lo": arm_lo, "run2_loco_auc": run2_auc, "margin": auc_margin,
                "required_ge": (run2_auc - auc_margin) if run2_auc == run2_auc else None}),
    ]
    raw_pass = all(c["pass"] for c in checks)
    return {"checks": checks, "raw_pass": raw_pass}


def eval_banking(delta: dict, recipe: str, criteria: dict) -> dict:
    checks_cfg = _get(criteria, "recipes", recipe, "checks", default={}) or {}
    gt = float(checks_cfg.get("paired_delta_auc_ci_lower_gt", 0.0))
    ge = float(checks_cfg.get("paired_delta_auc_ci_lower_ge", 0.03))
    lo = delta["ci95_lo"]
    c1 = (lo == lo) and lo > gt
    c2 = (lo == lo) and lo >= ge
    checks = [
        _check("paired_delta_auc_ci_lower_gt", c1, {"ci_lower": lo, "threshold": gt}),
        _check("paired_delta_auc_ci_lower_ge", c2, {"ci_lower": lo, "threshold": ge}),
    ]
    raw_pass = all(c["pass"] for c in checks)
    return {"checks": checks, "raw_pass": raw_pass}


def eval_territorial(run31: dict, run2: dict, recipe: str, criteria: dict) -> dict:
    cfg = _get(criteria, "recipes", recipe, "checks", default={}) or {}
    # Extract the tight-width threshold from the pass_if_any block.
    width_thr = 0.08
    pass_any = cfg.get("pass_if_any", []) or []
    for entry in pass_any:
        if isinstance(entry, dict) and "ci_upper_lt_run2_and_ci_width_le" in entry:
            width_thr = float(entry["ci_upper_lt_run2_and_ci_width_le"])
    arm_lo = run31.get("ci95_lo", float("nan"))
    arm_hi = run31.get("ci95_hi", float("nan"))
    run2_pt = run2.get("loco_auc", float("nan"))
    # Guard None (empty/unstable core) BEFORE any subtraction/comparison (fix 4):
    # an all-null CI must score a clean FAIL (neither branch true), never raise.
    width = (arm_hi - arm_lo) if (_is_num(arm_lo) and _is_num(arm_hi)) else float("nan")

    includes = (_is_num(arm_lo) and _is_num(arm_hi) and _is_num(run2_pt)
                and arm_lo <= run2_pt <= arm_hi)
    tight_below = (_is_num(arm_hi) and _is_num(run2_pt) and _is_num(width)
                   and arm_hi < run2_pt and width <= width_thr)

    checks = [
        _check("ci_includes_run2_point", includes,
               {"arm_ci95": [arm_lo, arm_hi], "run2_point": run2_pt}),
        _check("ci_upper_lt_run2_and_tight", tight_below,
               {"arm_ci95_hi": arm_hi, "run2_point": run2_pt, "width": width,
                "width_threshold": width_thr}),
    ]
    raw_pass = includes or tight_below
    return {
        "checks": checks,
        "raw_pass": raw_pass,
        "includes_run2": includes,
        "tight_below": tight_below,
    }


# =========================================================================== #
# Post-FDR pass logic (folds the joint FDR determination into significance bars)
# =========================================================================== #
def post_fdr_pass(recipe: str, ev: dict, fdr_reject: bool) -> tuple[bool, str]:
    """Return (post_fdr_pass, rationale). See module docstring §4."""
    raw = ev["raw_pass"]
    if recipe == CONTROL_RECIPE:
        # Do-no-harm: must pass the CI checks AND not be flagged significant.
        ok = raw and (not fdr_reject)
        return ok, "control: raw_pass AND not FDR-rejected (no significant harm)"
    if recipe in PATIENT_RECIPES:
        # Bar is π / count / arm-AUC-CI, not the paired Δ direction.
        return raw, "patient: bar is π/count/AUC-CI (FDR of Δ not gating)"
    if recipe == "banking_and_financial_crisis":
        ok = raw and fdr_reject
        return ok, "banking: raw_pass AND FDR-rejected (significant positive gain)"
    if recipe == "territorial_disputes":
        if ev.get("includes_run2"):
            ok = raw and (not fdr_reject)
            return ok, "territorial(recover): CI includes run2 AND not FDR-rejected (noise)"
        if ev.get("tight_below"):
            ok = raw and fdr_reject
            return ok, "territorial(decline): tight CI below run2 AND FDR-rejected (real)"
        return False, "territorial: ambiguous wide CI -> FAIL"
    return raw, "default"


# =========================================================================== #
# Orchestration
# =========================================================================== #
def score(results_dir: Path, criteria: dict, b_eval: int, seed: int = SEED_BASE) -> dict:
    q = float(_get(criteria, "meta", "fdr", "q", default=_DEF_Q))
    pi_keep = float(_get(criteria, "method", "stability", "pi_keep_threshold", default=_DEF_PI_KEEP))

    # Load all arms for all recipes.
    loaded = {r: load_recipe_results(results_dir, r) for r in RECIPE_ORDER}

    # 1. Paired bootstrap ΔAUC (run31 vs run2) for every recipe -> FDR family.
    deltas: dict = {}
    pair_info: dict = {}
    for r in RECIPE_ORDER:
        run31, run2 = loaded[r]["run31"], loaded[r]["run2"]
        pi_ = pair_oof(run31.get("oof", []), run2.get("oof", []))
        pair_info[r] = pi_
        deltas[r] = paired_bootstrap_delta_auc(
            pi_["probs_a"], pi_["probs_b"], pi_["labels"],
            countries=pi_["countries"], b_eval=b_eval, seed=seed,
        )

    # 2. BH-FDR jointly across the 5 ΔAUC p-values (fallback p=1.0 if undefined).
    pvals = [deltas[r]["p_value"] if deltas[r]["p_value"] == deltas[r]["p_value"] else 1.0
             for r in RECIPE_ORDER]
    reject_flags, adj_p = bh_fdr(pvals, q)
    fdr = {r: {"p_value": pvals[i], "p_adjusted": adj_p[i], "reject": reject_flags[i]}
           for i, r in enumerate(RECIPE_ORDER)}

    # 3. Per-recipe evaluation + stability improvement.
    recipes_out: "OrderedDict[str, Any]" = OrderedDict()
    for r in RECIPE_ORDER:
        run31, run3m, run2 = loaded[r]["run31"], loaded[r]["run3method"], loaded[r]["run2"]
        role = _get(criteria, "recipes", r, "role", default="")
        if r == CONTROL_RECIPE:
            ev = eval_control(run31, run2, deltas[r], criteria)
        elif r in PATIENT_RECIPES:
            ev = eval_patient(run31, run2, r, criteria, pi_keep)
        elif r == "banking_and_financial_crisis":
            ev = eval_banking(deltas[r], r, criteria)
        elif r == "territorial_disputes":
            ev = eval_territorial(run31, run2, r, criteria)
        else:
            ev = {"checks": [], "raw_pass": False}

        pf_pass, pf_rationale = post_fdr_pass(r, ev, fdr[r]["reject"])

        j31 = mean_pairwise_jaccard(run31.get("resample_selected_sets", []))
        j3m = mean_pairwise_jaccard(run3m.get("resample_selected_sets", []))
        improvement = (j31 - j3m) if (j31 == j31 and j3m == j3m) else float("nan")

        pi = run31.get("pi", {}) or {}
        stable = list(run31.get("stable_set", []))
        # mean-π gate over the reference_set (fix 5a) — the "locked set" of PRE-REG
        # §5.5, NOT stable_set (over which mean π is trivially ≥0.60 by definition).
        reference = list(run31.get("reference_set", run31.get("stable_set", [])))
        mean_pi = (sum(float(pi.get(j, 0.0)) for j in reference) / len(reference)) if reference else 0.0

        recipes_out[r] = {
            "recipe": r,
            "role": role,
            "checks": ev["checks"],
            "raw_pass": ev["raw_pass"],
            "post_fdr_pass": pf_pass,
            "post_fdr_rationale": pf_rationale,
            "delta_auc": deltas[r],
            "fdr": fdr[r],
            "pairing": {k: pair_info[r][k] for k in ("n_pairs", "n_a", "n_b", "label_mismatches")},
            "stability": {
                "mean_pairwise_jaccard_run31": j31,
                "mean_pairwise_jaccard_run3method": j3m,
                "improvement_over_run3method": improvement,
            },
            "stable_set_size": len(stable),
            "reference_set_size": len(reference),
            "mean_pi_over_reference_set": mean_pi,
            "run2_loco_auc": run2.get("loco_auc"),
            "arm_loco_auc": run31.get("loco_auc"),
            "arm_ci95": [run31.get("ci95_lo"), run31.get("ci95_hi")],
        }

    # 4. Overall AWS-funding gate (PRE-REG §5.5 / criteria overall_aws_funding_gate).
    gate_cfg = criteria.get("overall_aws_funding_gate", {}) if isinstance(criteria, dict) else {}
    control_must_pass = bool(gate_cfg.get("control_must_pass", True))
    min_other = int(gate_cfg.get("min_other_recipes_passing_post_fdr", 3))
    mean_pi_ge = float(gate_cfg.get("mean_pi_across_all_5_ge", 0.60))
    improvement_ge = float(gate_cfg.get("mean_pairwise_jaccard_stability_improvement_over_run3_ge", 0.30))

    control_pf = recipes_out[CONTROL_RECIPE]["post_fdr_pass"]
    control_raw = recipes_out[CONTROL_RECIPE]["raw_pass"]
    invalidated = not control_raw  # on_fail: invalidate_entire_pilot

    other = [r for r in RECIPE_ORDER if r != CONTROL_RECIPE]
    n_other_pass = sum(1 for r in other if recipes_out[r]["post_fdr_pass"])

    mean_pi_all5 = sum(recipes_out[r]["mean_pi_over_reference_set"] for r in RECIPE_ORDER) / len(RECIPE_ORDER)

    improvements = [recipes_out[r]["stability"]["improvement_over_run3method"] for r in RECIPE_ORDER]
    valid_impr = [x for x in improvements if x == x]
    mean_improvement = (sum(valid_impr) / len(valid_impr)) if valid_impr else float("nan")

    gate_checks = [
        _check("control_passes", (control_pf if control_must_pass else True),
               {"control_raw_pass": control_raw, "control_post_fdr_pass": control_pf,
                "required": control_must_pass}),
        _check("min_other_recipes_passing_post_fdr", n_other_pass >= min_other,
               {"n_passing": n_other_pass, "required_min": min_other,
                "of": len(other)}),
        _check("mean_pi_across_all_5_ge", mean_pi_all5 >= mean_pi_ge,
               {"mean_pi": mean_pi_all5, "threshold": mean_pi_ge}),
        _check("mean_pairwise_jaccard_stability_improvement_ge",
               (mean_improvement == mean_improvement) and mean_improvement >= improvement_ge,
               {"mean_improvement": mean_improvement, "threshold": improvement_ge}),
    ]
    overall_pass = (not invalidated) and all(c["pass"] for c in gate_checks)

    return {
        "pilot": "run-3.1 selection-method pilot",
        "seed_base": seed,
        "b_eval": int(b_eval),
        "fdr_q": q,
        "pi_keep_threshold": pi_keep,
        "recipe_order": RECIPE_ORDER,
        "recipes": recipes_out,
        "overall_gate": {
            "invalidated_by_control": invalidated,
            "checks": gate_checks,
            "n_other_recipes_passing_post_fdr": n_other_pass,
            "mean_pi_across_all_5": mean_pi_all5,
            "mean_pairwise_jaccard_stability_improvement": mean_improvement,
            "overall_pass": overall_pass,
        },
    }


# =========================================================================== #
# Rendering
# =========================================================================== #
def _fmt(x, nd=4):
    if x is None:
        return "n/a"
    if isinstance(x, float):
        if x != x:
            return "NaN"
        return f"{x:.{nd}f}"
    return str(x)


def _verdict(passed: bool) -> str:
    return "PASS" if passed else "FAIL"


def render_markdown(report: dict) -> str:
    L: list[str] = []
    ov = report["overall_gate"]
    L.append("# run-3.1 selection-method pilot -- PILOT REPORT")
    L.append("")
    L.append(f"- seed base: `{report['seed_base']}`  |  B_eval: `{report['b_eval']}`  |  "
             f"FDR q: `{report['fdr_q']}`  |  π keep: `{report['pi_keep_threshold']}`")
    L.append("- ΔAUC = paired bootstrap `AUC(run31) - AUC(run2)`, paired on (country, year); "
             "baseline is **run-2** (never run-3).")
    L.append("")
    headline = "OVERALL: **PASS -> AWS-funding gate CLEARED**" if ov["overall_pass"] \
        else "OVERALL: **FAIL -> stay local / iterate**"
    if ov["invalidated_by_control"]:
        headline = "OVERALL: **INVALIDATED (control veto failed)**"
    L.append(f"## {headline}")
    L.append("")

    # Per-recipe.
    for r in report["recipe_order"]:
        rec = report["recipes"][r]
        d = rec["delta_auc"]
        f = rec["fdr"]
        L.append(f"### {r}  ({rec['role']})  -- {_verdict(rec['post_fdr_pass'])}")
        role_tag = "CONTROL VETO -- evaluated first" if r == CONTROL_RECIPE else ""
        if role_tag:
            L.append(f"> {role_tag}")
        L.append("")
        L.append(f"- ΔAUC point: `{_fmt(d['point'])}`  |  95% CI: "
                 f"`[{_fmt(d['ci95_lo'])}, {_fmt(d['ci95_hi'])}]`  |  "
                 f"paired rows: `{d['n_pairs']}`  |  boot valid: `{d['n_boot_valid']}`")
        L.append(f"- FDR: p=`{_fmt(f['p_value'])}`  p_adj=`{_fmt(f['p_adjusted'])}`  "
                 f"reject=`{f['reject']}`")
        L.append(f"- arm LOCO-AUC: `{_fmt(rec['arm_loco_auc'])}`  CI "
                 f"`[{_fmt(rec['arm_ci95'][0])}, {_fmt(rec['arm_ci95'][1])}]`  |  "
                 f"run-2 LOCO-AUC: `{_fmt(rec['run2_loco_auc'])}`")
        st = rec["stability"]
        L.append(f"- stability (mean pairwise Jaccard): run31=`{_fmt(st['mean_pairwise_jaccard_run31'])}`  "
                 f"run3method=`{_fmt(st['mean_pairwise_jaccard_run3method'])}`  "
                 f"improvement=`{_fmt(st['improvement_over_run3method'])}`")
        L.append(f"- stable-set size: `{rec['stable_set_size']}`  |  "
                 f"reference-set size: `{rec['reference_set_size']}`  |  "
                 f"mean π over reference set: `{_fmt(rec['mean_pi_over_reference_set'])}`")
        L.append("")
        L.append("| check | verdict | detail |")
        L.append("|---|---|---|")
        for c in rec["checks"]:
            L.append(f"| {c['name']} | {_verdict(c['pass'])} | {json.dumps(_json_safe(c['detail']))} |")
        L.append(f"| _raw pass_ | {_verdict(rec['raw_pass'])} | all sub-checks |")
        L.append(f"| _post-FDR pass_ | {_verdict(rec['post_fdr_pass'])} | {rec['post_fdr_rationale']} |")
        L.append("")

    # Overall gate.
    L.append("## Overall AWS-funding gate")
    L.append("")
    L.append("| gate check | verdict | detail |")
    L.append("|---|---|---|")
    for c in ov["checks"]:
        L.append(f"| {c['name']} | {_verdict(c['pass'])} | {json.dumps(_json_safe(c['detail']))} |")
    L.append(f"| **OVERALL** | **{_verdict(ov['overall_pass'])}** | "
             f"invalidated_by_control=`{ov['invalidated_by_control']}` |")
    L.append("")
    return "\n".join(L)


# =========================================================================== #
# JSON sanitisation (NaN/Inf -> null so report.json is valid JSON)
# =========================================================================== #
def _json_safe(obj):
    if isinstance(obj, float):
        if obj != obj or obj in (float("inf"), float("-inf")):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    return obj


def write_outputs(report: dict, out_md: Path, out_json: Path) -> None:
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(render_markdown(report), encoding="utf-8")
    with open(out_json, "w", encoding="utf-8") as fh:
        json.dump(_json_safe(report), fh, indent=2)


# =========================================================================== #
# CLI
# =========================================================================== #
def main(argv=None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description="Score the run-3.1 selection-method pilot.")
    ap.add_argument("--results-dir", type=Path, default=here / "results")
    ap.add_argument("--criteria", type=Path, default=here / "criteria.yaml")
    ap.add_argument("--out-md", type=Path, default=None)
    ap.add_argument("--out-json", type=Path, default=None)
    ap.add_argument("--b-eval", type=int, default=None, help="override B_eval (default: criteria b_eval)")
    ap.add_argument("--seed", type=int, default=SEED_BASE)
    args = ap.parse_args(argv)

    criteria = load_criteria(args.criteria)
    b_eval = args.b_eval if args.b_eval is not None else int(_get(criteria, "meta", "b_eval", default=_DEF_B_EVAL))
    out_md = args.out_md or (args.results_dir / "PILOT-REPORT.md")
    out_json = args.out_json or (args.results_dir / "report.json")

    report = score(args.results_dir, criteria, b_eval=b_eval, seed=args.seed)
    write_outputs(report, out_md, out_json)

    ov = report["overall_gate"]
    verdict = "INVALIDATED" if ov["invalidated_by_control"] else ("PASS" if ov["overall_pass"] else "FAIL")
    print(f"[score_pilot] overall={verdict}  "
          f"other_passing={ov['n_other_recipes_passing_post_fdr']}  "
          f"mean_pi={ov['mean_pi_across_all_5']:.4f}  "
          f"improvement={ov['mean_pairwise_jaccard_stability_improvement']}")
    print(f"[score_pilot] wrote {out_md}")
    print(f"[score_pilot] wrote {out_json}")
    return 0 if ov["overall_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
