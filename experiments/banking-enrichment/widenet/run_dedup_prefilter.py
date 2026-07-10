"""Banking wide-net re-selection — correlation-dedup PRE-FILTER pass (fix #4, 2026-07-10).

Per PLAN.md §10.1 + the run-3.1 banking wide-net task brief: before the top-40 univariate cut,
collapse near-duplicate raw/derived indicators (|mean per-feature-column Pearson r| > 0.85,
union-find, keep the highest-univariate-LOCO representative per cluster) on the MERGED
248-raw + 6-derived-candidate pool (`build_merged_panel.py`'s `merged_panel_dir/`), using the
IDENTICAL pooled 116-positive sample draw the wide-net greedy walk itself will use (seed=12345,
negatives_per_positive=3, NO pre-split — per THE PLAN, one pooled audition, all 116 positives).

Reuses (never reimplements):
  * `run_f_ml_1_poc.build_samples` / `list_candidate_indicators` / `load_panel` /
    `univariate_loco_screen` (the walk's own §5.1 screen, at its default window=10, LR arch —
    used here ONLY to rank cluster representatives, never to pick the final top-N; the real
    top-40 cut happens inside the production CLI's own screen call on the deduped pool).
  * `stability_select.correlation_dedup` (explicitly named by the task brief — NOT
    `run-3.1-pilot/dedup.py`, a parallel/older implementation with a hardcoded 8-feature-column
    loop that is now STALE against the 10-feature block; see the note in this module's
    docstring bottom for the flagged-but-out-of-scope follow-up).

Physically restricts the eventual `run_f_ml_1_poc.py` CLI's candidate pool by writing a THIRD
panel_dir (`deduped_panel_dir/`) containing only the survivors, via
`build_merged_panel.copy_indicator_subset` — so NO CLI/argparse changes are needed (fix #2 says
the CLI's flags are used as-is): `--panel-dir` simply points at `deduped_panel_dir/` for the
real run.

Runs ONLY inside the pinned `qgi-run31-pilot:py313` image (needs run_f_ml_1_poc's full stack:
pandas/numpy/joblib; xgboost is not touched here since `univariate_loco_screen` uses LR).
Container invocation (mount BOTH repos, workdir /work/qgi-ml, relative script path):

    MSYS_NO_PATHCONV=1 docker run --rm \\
      -v <repo>/qgi-ml:/work/qgi-ml -v <repo>/qgi-data:/work/qgi-data \\
      -w /work/qgi-ml qgi-run31-pilot:py313 \\
      python experiments/banking-enrichment/widenet/run_dedup_prefilter.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
for _p in (SCRIPTS_DIR, PILOT_DIR, HERE):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import build_merged_panel as bmp  # noqa: E402

SEED = 12345
NEGATIVES_PER_POSITIVE = 3
RECIPE_ID = "banking_and_financial_crisis"

MERGED_PANEL_DIR = HERE / "merged_panel_dir"
DEDUPED_PANEL_DIR = HERE / "deduped_panel_dir"
DEDUP_REPORT_PATH = HERE / "dedup_report.json"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"


def run_dedup(
    panel_dir: Path,
    positives_csv: Path,
    walk_module: Any,
    stability_select_module: Any,
    seed: int = SEED,
) -> dict[str, Any]:
    """The dedup pass itself, with the walk/stability_select modules injected so this function
    is unit-testable with fakes (no real ML stack / no real 254-panel pool required). Returns
    the full report dict (also what gets written to dedup_report.json)."""
    w = walk_module
    ss = stability_select_module

    pos = w.pd.read_csv(positives_csv)
    pos["country"] = pos["country_id"].apply(w.normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    pos["label"] = 1
    samples = w.build_samples(pos, negatives_per_positive=NEGATIVES_PER_POSITIVE, seed=seed)
    n_pos = int((samples["label"] == 1).sum())

    all_candidates = w.list_candidate_indicators(panel_dir)
    panels = {ind: w.load_panel(ind, panel_dir) for ind in all_candidates}

    _, scores = w.univariate_loco_screen(samples, all_candidates, panels)
    survivors, cluster_map = ss.correlation_dedup(all_candidates, samples, panels, scores)

    non_singleton = {rep: members for rep, members in cluster_map.items() if len(members) > 1}
    return {
        "recipe_id": RECIPE_ID,
        "seed": seed,
        "negatives_per_positive": NEGATIVES_PER_POSITIVE,
        "n_pos_samples": n_pos,
        "abs_r_threshold": ss.ABS_R_THRESHOLD,
        "dedup_window": ss.DEDUP_WINDOW,
        "dedup_min_common": ss.DEDUP_MIN_COMMON,
        "n_candidates_before": len(all_candidates),
        "n_survivors_after": len(survivors),
        "n_clusters_total": len(cluster_map),
        "n_nonsingleton_clusters": len(non_singleton),
        "survivors": survivors,
        "cluster_map": cluster_map,
        "nonsingleton_cluster_map": non_singleton,
        "univariate_scores": {
            ind: scores[ind].get("univariate_loco_auc") for ind in all_candidates
        },
    }


def main() -> int:
    import run_f_ml_1_poc as w  # noqa: E402  (pulls in the full stack: pandas/numpy/joblib)
    import stability_select as ss  # noqa: E402

    if not MERGED_PANEL_DIR.exists():
        raise FileNotFoundError(
            f"{MERGED_PANEL_DIR} does not exist -- run build_merged_panel.py first"
        )

    report = run_dedup(MERGED_PANEL_DIR, POSITIVES_CSV, w, ss)
    DEDUP_REPORT_PATH.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(
        f"[dedup] {report['n_candidates_before']} -> {report['n_survivors_after']} survivors "
        f"({report['n_nonsingleton_clusters']} non-singleton clusters collapsed), "
        f"n_pos_samples={report['n_pos_samples']}"
    )

    copied = bmp.copy_indicator_subset(MERGED_PANEL_DIR, report["survivors"], DEDUPED_PANEL_DIR)
    print(f"[dedup] wrote {len(copied)}-indicator deduped_panel_dir -> {DEDUPED_PANEL_DIR}")
    print(f"[dedup] wrote {DEDUP_REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# ============================================================================================
# KNOWN FOLLOW-UP (flagged, out of scope for this run)
# ============================================================================================
# `experiments/run-3.1-pilot/dedup.py::dedup_candidates` is a SEPARATE, older collinearity-dedup
# implementation (used by the now-closed/invalidated run-3.1 pilot's `run31` arm) that hardcodes
# `_N_FEATURES = 8` when averaging per-column |Pearson r|. Since `extract_features_for_indicator`
# now returns 10 features (run-3.1 banking wide-net fix #1), that hardcode would silently ignore
# the two new lag columns (indices 8, 9) if `dedup.py` were ever reused post-fix. This module
# uses `stability_select.correlation_dedup` instead (explicitly named by the task brief, and
# already shape-safe: it loops `range(block_a.shape[1])`, not a hardcoded constant), so the
# stale constant in `dedup.py` is NOT exercised by this run -- flagged here for whoever next
# touches the (closed) run-3.1 pilot code.
