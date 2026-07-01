"""run-3.1 pilot — stability-selection CORE (the arm runner).

Implements the two-arm, country-bootstrap *stability selection* wrapper described in
`PRE-REGISTRATION.md` §2 and `INTEGRATION-SPEC.md` §2/§5/§6, reusing the production walk
`qgi-ml/scripts/run_f_ml_1_poc.py` (imported, NEVER reimplemented) for every heavy step:
`build_samples`, `list_candidate_indicators`, `load_panel`, `univariate_loco_screen`,
`greedy_outer_loop`, `build_X_y`, `fit_predict_loco`, `bca_bootstrap_auc_ci`,
`panel_data_fingerprint`, `normalize_country_id`.

Two arms, both on the SAME 248-indicator pool (isolates the selection layer):
  * ``run31``      (NEW): correlation-dedup (|r|>0.85 on the 8-dim model features, keep the
                   best-univariate-LOCO representative per cluster) → univariate top-40 → greedy.
  * ``run3method`` (OLD): plain greedy — NO dedup → univariate top-40 → greedy.

Both arms are wrapped in a COUNTRY-LEVEL complementary-pairs bootstrap. For resample ``i`` the
UNIQUE COUNTRIES (never rows) are partitioned into two complementary, disjoint halves
(``np.random.default_rng(12345+i)``); each half is one greedy walk. Selection frequency
``pi_j`` is accumulated across all walks; the stable core = ``{j : pi_j >= 0.60}``.

B schedule (WALKS) = [50, 75, 100, 125, 150, 175, 200]; each resample contributes 2 walks, so a
checkpoint target is reached by accumulating resamples until ``len(selected_sets) >= target``
(odd targets overshoot by one walk — the recorded ``B`` is the actual accumulated walk count, a
conservative >=-target denominator). STOP when, for TWO CONSECUTIVE checkpoint transitions, BOTH
hold: ``max_j |Δpi_j| < 0.05`` AND Jaccard of ``{pi_j>=0.6}`` between the two checkpoints
``>= 0.90``. Hard ceiling B=200.

FIREWALL (sacred). Country-partition (complementary-pairs, WITHOUT replacement) resampling
provably cannot leak a country into its own held-out LOCO fold: a country is assigned to exactly
one half (asserted disjoint here), and the walk's ``fit_predict_loco`` does leave-one-COUNTRY-out
(``train_mask = countries != held``). There is never a duplicate country copy to leak. We NEVER
switch to with-replacement or row-level resampling. See ``resample_halves`` /
``_assert_loco_grouped_by_country`` and INTEGRATION-SPEC §6.

Standing rules honored: Python 3.13; deterministic (seed_base 12345); reuse (no reimplementation
of walk math); the heavy real-walk path is IMPORTABLE but only executed on real data — unit tests
inject a fake walk module and never touch it.

Writes ``results/{recipe_id}.{arm}.json`` per the FROZEN INTER-MODULE CONTRACT.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------------------------
# Locked stability-selection constants (mirror criteria.yaml `method.stability`).
# --------------------------------------------------------------------------------------------
PI_KEEP_THRESHOLD = 0.60          # stable core = {j : pi_j >= 0.60}
STOP_MAX_ABS_DELTA_PI = 0.05      # max_j |Δpi_j| must be strictly below this
STOP_KEEPSET_JACCARD = 0.90       # keepset Jaccard between checkpoints must be at/above this
ABS_R_THRESHOLD = 0.85            # correlation-dedup collinearity threshold
DEDUP_WINDOW = 10                 # feature window for the dedup correlation (screen's default)
DEDUP_MIN_COMMON = 30             # min shared (country,year) rows to declare collinearity
DEFAULT_B_SCHEDULE = (50, 75, 100, 125, 150, 175, 200)
DEFAULT_SEED_BASE = 12345
NEGATIVES_PER_POSITIVE = 3
FINAL_CI_BOOTSTRAP_B = 2000       # bca internal resamples for the final loco_auc CI (walk default)

_STOP_REASON_CONVERGED = "converged_two_consecutive_checkpoints"
_STOP_REASON_CEILING = "b_ceiling_reached"

# --------------------------------------------------------------------------------------------
# Lazy walk import (kept importable-without-the-ML-stack so unit tests can inject a fake).
# --------------------------------------------------------------------------------------------
_WALK: Any = None


def _walk() -> Any:
    """Import + cache the production walk module on first use.

    Deferred so that importing THIS module (and unit-testing its pure logic) does not require
    numpy/pandas/xgboost/sklearn/scipy to already be present. Unit tests set
    ``stability_select._WALK = <fake module>`` to bypass the real import entirely.
    """
    global _WALK
    if _WALK is not None:
        return _WALK
    scripts_dir = Path(__file__).resolve().parents[2] / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    import run_f_ml_1_poc as _w  # noqa: E402 (intentional lazy import)

    _WALK = _w
    return _WALK


# ============================================================================================
# Pure stability-accounting helpers (no walk / no ML deps — directly unit-tested).
# ============================================================================================
def compute_pi(selected_sets: list[list[str]]) -> dict[str, float]:
    """Selection frequency pi_j = (#walks selecting j) / (#walks).

    Each walk contributes at most 1 to any indicator's count (a set membership), so duplicate
    entries within a single selected set do not double-count. Returns only indicators selected
    at least once (pi>0); an omitted indicator has pi=0 by definition.
    """
    n = len(selected_sets)
    if n == 0:
        return {}
    counts: dict[str, int] = {}
    for s in selected_sets:
        for ind in set(s):
            counts[ind] = counts.get(ind, 0) + 1
    return {ind: counts[ind] / n for ind in counts}


def keepset(pi: dict[str, float], threshold: float = PI_KEEP_THRESHOLD) -> set[str]:
    """Stable core at a threshold: {j : pi_j >= threshold}."""
    return {ind for ind, v in pi.items() if v >= threshold}


def max_abs_delta_pi(pi_a: dict[str, float], pi_b: dict[str, float]) -> float:
    """max_j |pi_a[j] - pi_b[j]| over the UNION of keys (missing key => 0.0)."""
    keys = set(pi_a) | set(pi_b)
    if not keys:
        return 0.0
    return max(abs(pi_a.get(k, 0.0) - pi_b.get(k, 0.0)) for k in keys)


def jaccard(a: set[str], b: set[str]) -> float:
    """Jaccard overlap of two sets. Two EMPTY sets are defined as perfectly overlapping (1.0):
    identical (empty) keepsets are maximally stable, which is the correct signal for the stop
    rule."""
    a, b = set(a), set(b)
    union = a | b
    if not union:
        return 1.0
    return len(a & b) / len(union)


def _transition_converged(pi_prev: dict[str, float], pi_cur: dict[str, float]) -> bool:
    """One checkpoint transition satisfies BOTH stop conditions."""
    d = max_abs_delta_pi(pi_prev, pi_cur)
    j = jaccard(keepset(pi_prev), keepset(pi_cur))
    return (d < STOP_MAX_ABS_DELTA_PI) and (j >= STOP_KEEPSET_JACCARD)


def should_stop_now(pi_snapshots: list[dict[str, float]]) -> bool:
    """Stop iff the two most recent checkpoint TRANSITIONS both satisfy the criteria.

    Needs >= 3 checkpoints (=> 2 transitions). This is exactly the "two consecutive checkpoints"
    rule from PRE-REGISTRATION §2 / criteria.yaml.
    """
    if len(pi_snapshots) < 3:
        return False
    return (
        _transition_converged(pi_snapshots[-3], pi_snapshots[-2])
        and _transition_converged(pi_snapshots[-2], pi_snapshots[-1])
    )


def simulate_stop_schedule(pi_snapshots: list[dict[str, float]]) -> tuple[int, str]:
    """Given the FULL ordered list of per-checkpoint pi snapshots, return the (index, reason) at
    which the stability loop would stop. Pure mirror of the run loop's stop decision — used by
    the unit tests to validate the stop rule on a synthetic pi trajectory without running walks.
    """
    for k in range(len(pi_snapshots)):
        if should_stop_now(pi_snapshots[: k + 1]):
            return k, _STOP_REASON_CONVERGED
    return (len(pi_snapshots) - 1 if pi_snapshots else -1), _STOP_REASON_CEILING


# ============================================================================================
# Country-partition resampling (the firewall-safe bootstrap).
# ============================================================================================
def partition_countries(
    countries_sorted: list[str], resample_index: int, seed_base: int = DEFAULT_SEED_BASE
) -> tuple[set[str], set[str]]:
    """Partition the unique-country list into two complementary, disjoint halves.

    Deterministic per (resample_index, seed_base) via ``np.random.default_rng(seed_base +
    resample_index).permutation`` — byte-identical to the INTEGRATION-SPEC §2.1 reference. For an
    odd count the second half (B) carries the extra country. This is complementary-PAIRS
    (without-replacement) assignment: a country lands in EXACTLY ONE half — the firewall guarantee.
    """
    countries = np.asarray(list(countries_sorted))
    n = len(countries)
    rng = np.random.default_rng(seed_base + resample_index)
    perm = rng.permutation(n)
    half = n // 2
    set_a = {str(x) for x in countries[perm[:half]]}
    set_b = {str(x) for x in countries[perm[half:]]}
    return set_a, set_b


def resample_halves(
    samples: pd.DataFrame, resample_index: int, seed_base: int = DEFAULT_SEED_BASE
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build the two complementary country-half sample subsets for one resample.

    Subsets the ONE canonical ``samples`` frame by country (never rebuilds negatives), so the
    LOCO folds stay identical to the full-data fit. Hard-asserts the firewall: the two halves are
    disjoint (no country in both) and jointly cover every country.
    """
    countries = sorted(str(x) for x in samples["country"].unique())
    set_a, set_b = partition_countries(countries, resample_index, seed_base)
    all_set = set(countries)
    # FIREWALL: disjoint halves — a country can never sit in both a training fold and its own
    # held-out LOCO fold within a single walk. Complementary partition => provably no leak.
    assert set_a.isdisjoint(set_b), (
        f"FIREWALL VIOLATION: {sorted(set_a & set_b)} appear in both halves of resample "
        f"{resample_index}"
    )
    assert set_a | set_b == all_set, (
        "FIREWALL VIOLATION: complementary halves must cover every country exactly once"
    )
    col = samples["country"].astype(str)
    sub_a = samples[col.isin(set_a)].reset_index(drop=True)
    sub_b = samples[col.isin(set_b)].reset_index(drop=True)
    return sub_a, sub_b


def _assert_loco_grouped_by_country(res: dict[str, Any], samples: pd.DataFrame) -> None:
    """Runtime firewall check on a ``fit_predict_loco`` result: every OOF prediction is keyed to a
    country drawn from the input samples (LOCO grouped by held-out country), with no phantom /
    duplicated country and with all four output arrays mutually aligned. Cheap, and asserts the
    grouping-by-country invariant the firewall relies on."""
    n = len(res["probs"])
    assert len(res["labels"]) == n and len(res["countries"]) == n and len(res["years"]) == n, (
        "fit_predict_loco outputs must be mutually aligned (probs/labels/countries/years)"
    )
    input_countries = {str(x) for x in samples["country"].unique()}
    oof_countries = {str(x) for x in res["countries"]}
    assert oof_countries <= input_countries, (
        "LOCO grouping violation: OOF contains a country not in the input samples "
        f"({sorted(oof_countries - input_countries)})"
    )


# ============================================================================================
# Correlation dedup (arm 'run31' only) — reuses the walk's build_X_y for the feature basis.
# ============================================================================================
class _UnionFind:
    def __init__(self, items: list[str]) -> None:
        self.parent = {x: x for x in items}

    def find(self, x: str) -> str:
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:  # path compression
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            # attach the lexicographically larger root under the smaller for deterministic trees
            lo, hi = sorted((ra, rb))
            self.parent[hi] = lo


def _uni_score(scores: dict[str, dict], ind: str) -> float:
    """Univariate LOCO-AUC for an indicator from the screen's scores (NaN/absent -> -1.0)."""
    rec = scores.get(ind)
    if not rec:
        return -1.0
    v = rec.get("univariate_loco_auc")
    if v is None:
        return -1.0
    try:
        fv = float(v)
    except (TypeError, ValueError):
        return -1.0
    return -1.0 if math.isnan(fv) else fv


def _rank_top_n(candidates: list[str], scores: dict[str, dict], top_n: int) -> list[str]:
    """Rank candidates by univariate LOCO-AUC (desc), mirroring the walk's screen ranking
    (run_f_ml_1_poc line 841). Pre-sorted by name first so ties are broken deterministically."""
    ordered = sorted(candidates)
    ordered.sort(key=lambda i: _uni_score(scores, i), reverse=True)
    return ordered[:top_n]


def correlation_dedup(
    all_candidates: list[str],
    samples_subset: pd.DataFrame,
    panels: dict[str, Any],
    scores: dict[str, dict],
    abs_r: float = ABS_R_THRESHOLD,
    window: float = DEDUP_WINDOW,
    min_common: int = DEDUP_MIN_COMMON,
) -> tuple[list[str], dict[str, list[str]]]:
    """Collinearity dedup on the 8-dim MODEL features (not raw values).

    For every candidate, extract its per-row 8-vector via the walk's ``build_X_y`` (so |r| is on
    exactly the features the model sees). Two indicators are collinear when the MEAN of their
    per-feature-column |Pearson r| over the common (country,year) rows exceeds ``abs_r`` (mean of
    the 8 columns: a genuine near-duplicate is collinear across all engineered features; a single
    incidentally-correlated column cannot force a merge). Single-linkage connected components
    (union-find) form clusters; the cluster representative is the member with the highest
    univariate LOCO-AUC (from ``scores``). Returns ``(survivors, cluster_map)`` where survivors is
    the sorted list of representatives and ``cluster_map = {rep: sorted([members incl. rep])}``.
    """
    w = _walk()
    feats: dict[str, dict[tuple[str, int], np.ndarray]] = {}
    for ind in all_candidates:
        X, _y, c, yr = w.build_X_y(samples_subset, [ind], window, panels)
        feats[ind] = {(str(c[k]), int(yr[k])): X[k] for k in range(len(X))}

    def collinear(a: str, b: str) -> bool:
        common = sorted(set(feats[a]) & set(feats[b]))
        if len(common) < min_common:
            return False
        block_a = np.vstack([feats[a][k] for k in common])
        block_b = np.vstack([feats[b][k] for k in common])
        rs: list[float] = []
        for col in range(block_a.shape[1]):
            va, vb = block_a[:, col], block_b[:, col]
            if np.std(va) < 1e-9 or np.std(vb) < 1e-9:
                continue  # degenerate column contributes no collinearity evidence
            r = np.corrcoef(va, vb)[0, 1]
            if np.isnan(r):
                continue
            rs.append(abs(float(r)))
        return len(rs) > 0 and float(np.mean(rs)) > abs_r

    ordered = sorted(all_candidates)
    uf = _UnionFind(ordered)
    for ia in range(len(ordered)):
        for ib in range(ia + 1, len(ordered)):
            if collinear(ordered[ia], ordered[ib]):
                uf.union(ordered[ia], ordered[ib])

    clusters: dict[str, list[str]] = {}
    for ind in ordered:
        clusters.setdefault(uf.find(ind), []).append(ind)

    cluster_map: dict[str, list[str]] = {}
    survivors: list[str] = []
    for members in clusters.values():
        members_sorted = sorted(members)
        # representative = highest univariate LOCO-AUC; ties -> lexicographically smallest name
        rep = _best_representative(members_sorted, scores)
        cluster_map[rep] = members_sorted
        survivors.append(rep)
    return sorted(survivors), cluster_map


def _best_representative(members_sorted: list[str], scores: dict[str, dict]) -> str:
    """Cluster representative = highest univariate LOCO-AUC; ties broken by smallest name."""
    best = members_sorted[0]
    best_score = _uni_score(scores, best)
    for ind in members_sorted[1:]:
        s = _uni_score(scores, ind)
        if s > best_score:  # strict > keeps the earlier (lexicographically smaller) on ties
            best, best_score = ind, s
    return best


# ============================================================================================
# One arm-walk on one country half -> selected_indicators.
# ============================================================================================
def run_single_walk(
    arm: str,
    samples_subset: pd.DataFrame,
    all_candidates: list[str],
    panels: dict[str, Any],
    resample_seed: int,
) -> list[str]:
    """Run ONE greedy arm-walk on one country-half subset and return its selected indicators.

    ``run3method``: univariate screen -> top-40 -> greedy (NO dedup).
    ``run31``:      univariate screen -> correlation_dedup -> top-40 of survivors -> greedy.
    The greedy call settings are fixed per INTEGRATION-SPEC §2 (XGBoost, delta_step=DELTA_STEP,
    lock_floor=None so no compute-abort truncates a resample walk, checkpoint disabled, n_jobs=1).
    """
    if arm not in ("run31", "run3method"):
        raise ValueError(f"unknown arm {arm!r} (expected 'run31' or 'run3method')")
    w = _walk()
    n_pos_sub = int((samples_subset["label"] == 1).sum())
    max_steps = 5 if n_pos_sub < 60 else 12  # production cap rule on the subset's own n_pos

    if arm == "run3method":
        top40, _scores = w.univariate_loco_screen(samples_subset, all_candidates, panels)
    else:  # run31 — dedup between the screen and the top-40 cut
        _, scores = w.univariate_loco_screen(samples_subset, all_candidates, panels)
        survivors, _map = correlation_dedup(
            all_candidates, samples_subset, panels, scores, abs_r=ABS_R_THRESHOLD
        )
        top40 = _rank_top_n(survivors, scores, w.TOP_N_PREFILTER)

    greedy = w.greedy_outer_loop(
        samples_subset,
        top40,
        panels,
        architecture="XGBoost",
        delta_step=w.DELTA_STEP,
        max_steps=max_steps,
        seed=resample_seed,
        checkpoint_path=None,
        config_signature=None,
        lock_floor=None,
        # #961: n_jobs>1 is BIT-IDENTICAL to serial for the XGBoost architecture
        # (candidate x window fits are independent). Env-tunable so the pilot can
        # saturate host cores without changing selected sets. Default 1 (serial).
        n_jobs=int(os.environ.get("GREEDY_N_JOBS", "1")),
    )
    return list(greedy["selected_indicators"])


# ============================================================================================
# Final full-sample fit on the stable core -> OOF + BCa CI (identical folds to run-2 baseline).
# ============================================================================================
def _final_fit(
    stable_set: list[str], samples: pd.DataFrame, panels: dict[str, Any], seed: int
) -> dict[str, Any]:
    """Fit the stable core on the FULL canonical samples. Mirrors _main's per-window argmax:
    for each window in WINDOW_GRID build features + LOCO, keep the window with the max global AUC
    (ties -> smallest window, since WINDOW_GRID ascends and we compare strict >). Returns the
    frozen-contract OOF/loco_auc/CI plus the chosen window.
    """
    empty = {
        "loco_auc": float("nan"), "ci95_lo": None, "ci95_hi": None,
        "oof": [], "chosen_window": None,
    }
    if not stable_set:
        return empty
    w = _walk()
    best: tuple[float, int, dict[str, Any]] | None = None
    for win in w.WINDOW_GRID:
        X, y, c, yr = w.build_X_y(samples, stable_set, win, panels)
        if len(X) < 30 or len(np.unique(y)) < 2:
            continue
        res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=seed)
        auc = float(res["global_auc"])
        if best is None or auc > best[0]:
            best = (auc, win, res)
    if best is None:
        return empty
    _auc, win, res = best
    _assert_loco_grouped_by_country(res, samples)
    oof = [
        {
            "country": str(res["countries"][k]),
            "year": int(res["years"][k]),
            "prob": float(res["probs"][k]),
            "label": int(res["labels"][k]),
        }
        for k in range(len(res["probs"]))
    ]
    ci = w.bca_bootstrap_auc_ci(res["probs"], res["labels"], B=FINAL_CI_BOOTSTRAP_B, seed=seed)
    return {
        "loco_auc": float(res["global_auc"]),
        "ci95_lo": float(ci["ci95_lo"]),
        "ci95_hi": float(ci["ci95_hi"]),
        "oof": oof,
        "chosen_window": int(win),
    }


# ============================================================================================
# Provenance.
# ============================================================================================
def _config_signature(
    recipe_id: str, arm: str, pool_hash: str, seed_base: int,
    b_schedule: list[int], abs_r: float,
) -> str:
    payload = json.dumps(
        {
            "recipe_id": recipe_id,
            "arm": arm,
            "pool_hash": pool_hash,
            "seed_base": seed_base,
            "b_schedule": list(b_schedule),
            "abs_r_threshold": abs_r,
            "pi_keep_threshold": PI_KEEP_THRESHOLD,
            "stop_max_abs_delta_pi": STOP_MAX_ABS_DELTA_PI,
            "stop_keepset_jaccard": STOP_KEEPSET_JACCARD,
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _load_positives(positives_csv: Path) -> pd.DataFrame:
    """Load + normalize positives exactly as _main (lines 1528-1531)."""
    w = _walk()
    pos = pd.read_csv(positives_csv)
    pos["country"] = pos["country_id"].apply(w.normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    pos["label"] = 1
    return pos


# ============================================================================================
# The orchestrator.
# ============================================================================================
def run_arm(
    recipe_id: str,
    arm: str,
    panel_dir: str | Path,
    positives_csv: str | Path,
    cohort_sidecar: str | Path | None = None,
    out_dir: str | Path | None = None,
    seed_base: int = DEFAULT_SEED_BASE,
    b_schedule: list[int] = list(DEFAULT_B_SCHEDULE),
    git_commit: str | None = None,
) -> dict[str, Any]:
    """Run one arm of the run-3.1 pilot for one recipe and write the frozen-contract JSON.

    Parameters
    ----------
    arm : 'run31' (dedup ON) | 'run3method' (dedup OFF).
    cohort_sidecar : accepted for interface parity but NOT USED — per INTEGRATION-SPEC §4 the
        pilot's critical path and every frozen-contract field require zero cohort data.
    b_schedule : WALK-count checkpoints. Each resample = 2 walks; targets are reached by
        accumulating whole resamples until ``len(selected_sets) >= target`` (recorded ``B`` is the
        actual accumulated walk count).

    Returns the result dict (also written to ``{out_dir}/{recipe_id}.{arm}.json``).
    """
    if arm not in ("run31", "run3method"):
        raise ValueError(f"unknown arm {arm!r}")
    panel_dir = Path(panel_dir)
    positives_csv = Path(positives_csv)
    out_dir = Path(out_dir) if out_dir is not None else (Path(__file__).resolve().parent / "results")
    out_dir.mkdir(parents=True, exist_ok=True)
    b_schedule = list(b_schedule)
    w = _walk()

    # --- canonical samples (seed_base => identical folds across arms/baseline) --------------
    pos = _load_positives(positives_csv)
    samples = w.build_samples(pos, negatives_per_positive=NEGATIVES_PER_POSITIVE, seed=seed_base)
    n_pos = int((samples["label"] == 1).sum())
    all_candidates = w.list_candidate_indicators(panel_dir)
    panels = {ind: w.load_panel(ind, panel_dir) for ind in all_candidates}

    # --- complementary-pairs country-bootstrap stability loop ------------------------------
    selected_sets: list[list[str]] = []
    pi_snapshots: list[dict[str, float]] = []
    per_checkpoint: list[dict[str, Any]] = []
    resample_index = 0
    stop_reason: str | None = None
    b_ceiling = b_schedule[-1]

    for target in b_schedule:
        while len(selected_sets) < target:
            sub_a, sub_b = resample_halves(samples, resample_index, seed_base)
            resample_seed = seed_base + resample_index
            for sub in (sub_a, sub_b):
                selected_sets.append(
                    run_single_walk(arm, sub, all_candidates, panels, resample_seed)
                )
            resample_index += 1

        pi = compute_pi(selected_sets)
        pi_snapshots.append(pi)
        keep = sorted(keepset(pi, PI_KEEP_THRESHOLD))
        cp: dict[str, Any] = {
            "B": len(selected_sets),
            "keepset": keep,
            "pi_snapshot": {k: pi[k] for k in sorted(pi)},
        }
        if len(pi_snapshots) >= 2:
            d = max_abs_delta_pi(pi_snapshots[-2], pi_snapshots[-1])
            j = jaccard(keepset(pi_snapshots[-2]), keepset(pi_snapshots[-1]))
            cp["max_abs_delta_pi_vs_prev"] = d
            cp["keepset_jaccard_vs_prev"] = j
            cp["stop_criteria_satisfied"] = bool(d < STOP_MAX_ABS_DELTA_PI and j >= STOP_KEEPSET_JACCARD)
        else:
            cp["max_abs_delta_pi_vs_prev"] = None
            cp["keepset_jaccard_vs_prev"] = None
            cp["stop_criteria_satisfied"] = False
        per_checkpoint.append(cp)

        if should_stop_now(pi_snapshots):
            stop_reason = _STOP_REASON_CONVERGED
            break
        if len(selected_sets) >= b_ceiling:
            stop_reason = _STOP_REASON_CEILING
            break

    if stop_reason is None:  # exhausted schedule without an explicit stop
        stop_reason = _STOP_REASON_CEILING
    b_used = len(selected_sets)

    # --- final pi / stable core ------------------------------------------------------------
    pi_final = compute_pi(selected_sets)
    stable_set = sorted(keepset(pi_final, PI_KEEP_THRESHOLD))

    # --- canonical dedup cluster map on the FULL samples (run31 only) -----------------------
    if arm == "run31":
        _, full_scores = w.univariate_loco_screen(samples, all_candidates, panels)
        _survivors, dedup_cluster_map = correlation_dedup(
            all_candidates, samples, panels, full_scores, abs_r=ABS_R_THRESHOLD
        )
    else:
        dedup_cluster_map = {}

    # --- reference_set: ONE deterministic full-sample greedy walk (all countries; dedup applied
    #     for run31, not for run3method) at the base seed. This set is NOT defined by the pi>=0.60
    #     threshold, so score_pilot can measure a NON-tautological pi-coverage bar = "fraction of
    #     the reference_set that the bootstrap reselects with pi_j>=0.60" and a mean-pi bar over it
    #     (PRE-REG §5.1 "the locked set" / §5.5 "mean pi across the 5 locked sets"; adversarial
    #     review fix 5a — stable_set == {pi>=0.60} made those bars trivially 1.0). ------------------
    reference_set = sorted(run_single_walk(arm, samples, all_candidates, panels, seed_base))

    # --- final full-sample fit on the stable core ------------------------------------------
    fit = _final_fit(stable_set, samples, panels, seed_base)

    # --- provenance ------------------------------------------------------------------------
    pool_hash = w.panel_data_fingerprint(panel_dir, positives_csv)
    config_signature = _config_signature(
        recipe_id, arm, pool_hash, seed_base, b_schedule, ABS_R_THRESHOLD
    )
    resolved_commit = git_commit or os.environ.get("GIT_COMMIT", "UNKNOWN")

    result: dict[str, Any] = {
        "recipe_id": recipe_id,
        "arm": arm,
        "B_used": b_used,
        "stop_reason": stop_reason,
        "pi": pi_final,
        "stable_set": stable_set,
        "reference_set": reference_set,
        "resample_selected_sets": selected_sets,
        "per_checkpoint": per_checkpoint,
        "loco_auc": fit["loco_auc"],
        "ci95_lo": fit["ci95_lo"],
        "ci95_hi": fit["ci95_hi"],
        "oof": fit["oof"],
        "n_pos": n_pos,
        "final_indicator_count": len(stable_set),
        "dedup_cluster_map": dedup_cluster_map,
        "config_signature": config_signature,
        "git_commit": resolved_commit,
        "pool_hash": pool_hash,
        "seed_base": seed_base,
        # non-contract provenance (extra keys are harmless to downstream readers)
        "chosen_window": fit["chosen_window"],
        "b_schedule": b_schedule,
        "abs_r_threshold": ABS_R_THRESHOLD,
        "pi_keep_threshold": PI_KEEP_THRESHOLD,
    }

    out_path = out_dir / f"{recipe_id}.{arm}.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


# ============================================================================================
# CLI (real-walk entry point; NOT exercised by unit tests).
# ============================================================================================
def _default_panel_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "parquet_panels"


def _default_positives_csv(recipe_id: str) -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "data" / "shape_inputs_v2" / recipe_id / "positives.csv"
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="run-3.1 pilot stability-selection arm runner")
    ap.add_argument("--recipe-id", required=True)
    ap.add_argument("--arm", required=True, choices=["run31", "run3method"])
    ap.add_argument("--panel-dir", default=None)
    ap.add_argument("--positives-csv", default=None)
    ap.add_argument("--cohort-sidecar", default=None, help="accepted but unused (pilot needs none)")
    ap.add_argument("--out-dir", default=None)
    ap.add_argument("--seed-base", type=int, default=DEFAULT_SEED_BASE)
    ap.add_argument("--git-commit", default=None)
    ap.add_argument(
        "--b-schedule", default=None,
        help="comma-separated walk checkpoints; default 50,75,100,125,150,175,200",
    )
    args = ap.parse_args(argv)

    panel_dir = Path(args.panel_dir) if args.panel_dir else _default_panel_dir()
    positives_csv = (
        Path(args.positives_csv) if args.positives_csv else _default_positives_csv(args.recipe_id)
    )
    out_dir = Path(args.out_dir) if args.out_dir else (Path(__file__).resolve().parent / "results")
    b_schedule = (
        [int(x) for x in args.b_schedule.split(",")] if args.b_schedule else list(DEFAULT_B_SCHEDULE)
    )

    result = run_arm(
        recipe_id=args.recipe_id,
        arm=args.arm,
        panel_dir=panel_dir,
        positives_csv=positives_csv,
        cohort_sidecar=args.cohort_sidecar,
        out_dir=out_dir,
        seed_base=args.seed_base,
        b_schedule=b_schedule,
        git_commit=args.git_commit,
    )
    print(
        f"[{result['recipe_id']}.{result['arm']}] B_used={result['B_used']} "
        f"stop={result['stop_reason']} stable_set={result['stable_set']} "
        f"loco_auc={result['loco_auc']}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
