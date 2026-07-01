"""Collinearity dedup for the run-3.1 selection-method pilot (NEW arm ``run31``).

Between the univariate LOCO screen and the top-40 cut, cluster the 248-indicator
pool by pairwise collinearity of their *model features* and keep only the
best-univariate-LOCO representative per cluster. This removes the near-duplicate
V-Dem-extended / World-Bank flood that poisoned run-3's greedy tie-breaks
(PRE-REGISTRATION.md §2.1; INTEGRATION-SPEC.md §5).

Public contract (frozen INTER-MODULE contract / INTEGRATION-SPEC §5)::

    dedup_candidates(candidates, panels, samples, univariate_scores,
                     abs_r_threshold=0.85) -> (kept, cluster_map)

      kept        : list[str]           survivors — one representative per cluster.
      cluster_map : dict[rep -> [members incl. rep]]   FULL partition of `candidates`
                    (singletons appear as ``{rep: [rep]}``); ``rep`` is always a member.

Method (locked for reproducibility):

  * **Feature basis = the SAME 8-dim engineered vector the model sees**, produced
    via the production ``build_X_y`` / ``extract_features_for_indicator`` at
    ``window=10`` (the univariate screen's ``default_window``; dedup precedes
    greedy, so no ``chosen_window`` exists yet). |r| is therefore computed on model
    features, NOT raw indicator values.
  * **Collinearity metric = MEAN of the per-feature-column |Pearson r|** over the 8
    columns, on the two indicators' COMMON ``(country, year)`` rows. A true
    near-duplicate is collinear across ALL 8 derived features; averaging avoids a
    spurious merge from one incidentally-correlated column. Degenerate
    (near-constant) columns contribute no evidence (skipped, not scored as r=0).
    Fewer than ``min_common`` shared rows ⇒ collinearity cannot be established ⇒
    NOT merged.
  * **Single-linkage clusters = connected components** (union-find) of the graph
    whose edges join pairs with mean |r| > ``abs_r_threshold``.
  * **Representative = the cluster member with the highest univariate LOCO-AUC**
    (``univariate_scores[ind]["univariate_loco_auc"]``); NaN / missing scores sort
    last; ties broken by the lexicographically smallest indicator id (deterministic).

Pure and deterministic: no RNG, no I/O, no mutation of inputs. Reuses the walk's
feature functions (imported, never re-implemented).

NOTE: this module may graduate into the production run-3.1 walk — it is NOT a
throwaway.
"""
from __future__ import annotations

import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np

# Reuse the production feature functions (INTEGRATION-SPEC §0/§5) — never copy them.
# The walk self-wires scripts/ + src/ + repo-root onto sys.path at import time and
# pulls in beta_calibration; xgboost/sklearn are imported lazily *inside*
# fit_predict_loco, so importing the walk for build_X_y needs only numpy/pandas/
# joblib/scipy (the dedup path never touches xgboost).
# Resolve scripts/ relative to this file (experiments/run-3.1-pilot → ../../scripts);
# fall back to the INTEGRATION-SPEC's absolute path if the repo layout ever moves.
_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
if not (_SCRIPTS / "run_f_ml_1_poc.py").exists():
    _SCRIPTS = Path(r"/workspace/qgi-6.0/qgi-ml/scripts")
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
import run_f_ml_1_poc as _walk  # noqa: E402  (path insert must precede import)

__all__ = ["dedup_candidates"]

DEFAULT_WINDOW = 10        # == univariate_loco_screen default_window (feature basis)
DEFAULT_MIN_COMMON = 30    # min shared (country, year) rows to judge collinearity
_N_FEATURES = 8            # extract_features_for_indicator returns an 8-vector
_STD_EPS = 1e-9            # a column with std below this is degenerate → no evidence


def _univariate_score(univariate_scores: Any, ind: str) -> float:
    """Best-univariate-LOCO score for ``ind``; ``-inf`` if missing / non-numeric / NaN.

    Accepts the production ``scores`` table (``{ind: {"univariate_loco_auc": float}}``)
    *and* a plain ``{ind: float}`` mapping (test convenience). ``-inf`` guarantees a
    NaN/absent score is only ever chosen as the representative when every member of
    its cluster is NaN/absent — in which case the lexicographic tie-break decides.
    """
    entry = univariate_scores.get(ind) if hasattr(univariate_scores, "get") else None
    val = entry.get("univariate_loco_auc", float("nan")) if isinstance(entry, dict) else entry
    try:
        val = float(val)
    except (TypeError, ValueError):
        return float("-inf")
    return val if not math.isnan(val) else float("-inf")


def _feature_map(
    ind: str,
    samples: "Any",
    panels: dict,
    window: int,
) -> dict[tuple[str, int], np.ndarray]:
    """``(country, year) -> 8-vec`` for every sample row ``ind`` covers, via ``build_X_y``.

    Duplicate ``(country, year)`` sample rows collapse losslessly:
    ``extract_features_for_indicator`` is a pure function of ``(country, year, window)``,
    so every duplicate maps to an identical vector. A missing panel or zero coverage
    yields an empty map ⇒ the indicator shares no rows with anyone ⇒ it can never merge
    and stays its own singleton cluster (the safe default).
    """
    if ind not in panels:
        return {}
    X, _y, c, yr = _walk.build_X_y(samples, [ind], window, panels)
    if len(X) == 0:
        return {}
    return {
        (str(c[k]), int(yr[k])): np.asarray(X[k], dtype=float)
        for k in range(len(X))
    }


def _mean_abs_r(
    fa: dict[tuple[str, int], np.ndarray],
    fb: dict[tuple[str, int], np.ndarray],
    min_common: int,
) -> float | None:
    """Mean of per-column |Pearson r| over the two indicators' COMMON rows.

    Returns ``None`` when collinearity cannot be established: fewer than
    ``min_common`` shared rows, or no usable (non-degenerate, finite) column.
    """
    common = sorted(fa.keys() & fb.keys())
    if len(common) < min_common:
        return None
    A = np.vstack([fa[k] for k in common])   # (n_common, 8)
    B = np.vstack([fb[k] for k in common])
    rs: list[float] = []
    for col in range(_N_FEATURES):
        va = A[:, col]
        vb = B[:, col]
        if np.std(va) < _STD_EPS or np.std(vb) < _STD_EPS:
            continue  # degenerate column: contributes no collinearity evidence
        r = np.corrcoef(va, vb)[0, 1]
        if math.isnan(r):
            continue
        rs.append(abs(float(r)))
    if not rs:
        return None
    return float(np.mean(rs))


def dedup_candidates(
    candidates: list[str],
    panels: dict,
    samples: "Any",
    univariate_scores: Any,
    abs_r_threshold: float = 0.85,
    *,
    window: int = DEFAULT_WINDOW,
    min_common: int = DEFAULT_MIN_COMMON,
) -> tuple[list[str], dict[str, list[str]]]:
    """Collapse collinear indicators to one best-univariate representative per cluster.

    Args:
        candidates:        the candidate indicator ids (the full pool for the arm).
        panels:            ``{indicator_id: panel DataFrame}`` (country/year/value).
        samples:           the ``country/year/label`` sample frame for THIS walk
                           (a country-half subset in the stability wrapper; the full
                           canonical samples if run once). Only its ``(country, year)``
                           rows drive the feature basis; labels are irrelevant to dedup.
        univariate_scores: the univariate-screen ``scores`` table keyed by every
                           candidate — used only to pick the cluster representative.
        abs_r_threshold:   merge two indicators when mean |Pearson r| STRICTLY exceeds
                           this (PRE-REG §2.1 uses 0.85).
        window:            feature window for the |r| basis (default 10, the screen's).
        min_common:        min shared ``(country, year)`` rows required to merge a pair.

    Returns:
        ``(kept, cluster_map)`` — ``kept`` = sorted survivor reps; ``cluster_map`` a full
        partition ``{rep: [members incl. rep]}`` of the (de-duplicated) candidate set,
        with ``set(kept) == set(cluster_map)`` and every candidate in exactly one list.
    """
    # De-duplicate the input + fix a deterministic processing order.
    cand = sorted(dict.fromkeys(candidates))
    if not cand:
        return [], {}

    # 1. Model-feature vectors per indicator, keyed by (country, year) coverage rows.
    feats = {ind: _feature_map(ind, samples, panels, window) for ind in cand}

    # 2. Single-linkage clustering via union-find over collinear pairs.
    parent = {ind: ind for ind in cand}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # path halving (deterministic)
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        lo, hi = (ra, rb) if ra < rb else (rb, ra)
        parent[hi] = lo  # smaller-name root wins → deterministic component labels

    for i in range(len(cand)):
        fi = feats[cand[i]]
        if not fi:
            continue
        for j in range(i + 1, len(cand)):
            fj = feats[cand[j]]
            if not fj:
                continue
            m = _mean_abs_r(fi, fj, min_common)
            if m is not None and m > abs_r_threshold:
                union(cand[i], cand[j])

    # 3. Group candidates into connected components (single-linkage clusters).
    clusters: dict[str, list[str]] = defaultdict(list)
    for ind in cand:
        clusters[find(ind)].append(ind)

    # 4. Representative = highest univariate score; ties → lexicographically smallest id.
    cluster_map: dict[str, list[str]] = {}
    for members in clusters.values():
        members_sorted = sorted(members)  # ascending: earliest name wins on score ties
        rep = members_sorted[0]
        rep_score = _univariate_score(univariate_scores, rep)
        for m in members_sorted[1:]:
            s = _univariate_score(univariate_scores, m)
            if s > rep_score:  # strict '>' keeps the earlier (smaller) name on ties
                rep, rep_score = m, s
        cluster_map[rep] = members_sorted

    kept = sorted(cluster_map)
    return kept, cluster_map
