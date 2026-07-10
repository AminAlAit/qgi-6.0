"""§11 Step 2 -- recompute run-2's 3-driver baseline, LOCO-restricted to the EM-eligible
subset, window LOCKED to 15 (run-2's own chosen_window; NO fresh argmax on the smaller
EM-only sample -- PLAN.md §11 Step 1's explicit instruction). This EM-only AUC, NOT the
pooled 0.638, is the only valid denominator for the stdebt_reserves/m2_reserves LOCO scores
that come next in §11 Step 2.

Reuses (never reimplements): `run_f_ml_1_poc.build_samples` / `build_X_y` /
`fit_predict_loco` / `bca_bootstrap_auc_ci` / `coverage_report`, and this experiment's own
`em_classification.classify_rows_tolerant` (EM-eligibility, ex-ante lagged, tolerant of
unresolved rows) to filter the FULL pooled `samples` (positives + time-matched negatives)
down to the EM-eligible subset before fitting.

Docker-only (needs numpy/pandas/joblib/sklearn):
    MSYS_NO_PATHCONV=1 docker run --rm \\
      -v <repo>/qgi-ml:/work/qgi-ml -v <repo>/qgi-data:/work/qgi-data \\
      -w /work/qgi-ml qgi-run31-pilot:py313 \\
      python experiments/banking-enrichment/em_test/run_em_baseline.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
WIDENET_DIR = HERE.parent / "widenet"
for _p in (HERE, SCRIPTS_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import em_classification as ec  # noqa: E402
import subset_utils as su  # noqa: E402

SEED = 12345
RECIPE_ID = "banking_and_financial_crisis"
BASELINE_DRIVERS = ["NV.SRV.TOTL.ZS", "v2x_gender", "MS.MIL.XPND.GD.ZS"]  # run-2's own drivers
LOCKED_WINDOW = 15  # run-2's chosen_window (verified: widenet/results/full_run/baseline_harness_report.json)
NEGATIVES_PER_POSITIVE = 3  # matches build_samples' / stability_select's own default

DEFAULT_PANEL_DIR = WIDENET_DIR / "deduped_panel_dir"
DEFAULT_POSITIVES_CSV = ec.DEFAULT_POSITIVES_CSV
DEFAULT_COHORT_ASSIGNMENTS = ec.DEFAULT_COHORT_ASSIGNMENTS_PATH
DEFAULT_COMMITMENT_PATH = HERE / "results" / "em_commitment.json"


def run_em_baseline(
    panel_dir: Path = DEFAULT_PANEL_DIR,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    cohort_assignments_path: Path = DEFAULT_COHORT_ASSIGNMENTS,
    commitment_path: Path = DEFAULT_COMMITMENT_PATH,
    out_path: Path | None = None,
    subset: str = "em",
) -> dict[str, Any]:
    """`subset="em"` (default, back-compat): the §11 Step 1-2 EM-eligible baseline recompute
    (the ONLY valid denominator for stdebt_reserves/m2_reserves). `subset="advanced"`: the
    §11 Step 3 advanced-only baseline recompute (secondary/non-gating denominator for
    credit_growth_3y_fd). Both share the identical pooled-sample-then-filter procedure
    (`subset_utils.resolve_subset_mask`) -- never two independently-drifting code paths."""
    import numpy as np
    import pandas as pd

    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)

    if not commitment_path.exists():
        raise FileNotFoundError(
            f"{commitment_path} not found -- run em_classification.py FIRST to write the "
            "binding §11 COMMITMENT (n_pos_em_eligible + architecture) before computing any AUC"
        )
    commitment = json.loads(commitment_path.read_text(encoding="utf-8"))
    if subset == "em":
        architecture = commitment["architecture"]  # BINDING -- read from the committed file, never recomputed here
        n_pos_subset_positives = commitment["n_pos_em_eligible"]
    elif subset == "advanced":
        # §11 Step 3 is explicitly "secondary/non-gating" -- not covered by the EM COMMITMENT's
        # binding clause, but the SAME n_pos<60->LR/n_pos>=60->XGBoost rule still applies,
        # independently derived from em_commitment.json's own n_pos_advanced count (57 < 60 ->
        # LR) via em_classification.select_architecture -- never hand-picked.
        n_pos_subset_positives = commitment["n_pos_advanced"]
        architecture = ec.select_architecture(n_pos_subset_positives)
    else:
        raise ValueError(f"run_em_baseline: subset must be 'em' or 'advanced', got {subset!r}")

    # --- Build the identical pooled sample run-2's own baseline used (positives + time-matched
    # negatives, seed=12345) -- then EM-filter it. This guarantees the EM subset's negatives are
    # drawn from the SAME candidate pool/procedure as the pooled 0.638 run, not a fresh draw. ---
    # run_f_ml_1_poc.py has no reusable positives-loader (its own main() inlines this); mirror
    # stability_select._load_positives's exact normalization (country_id -> Title Case via
    # normalize_country_id, event_year -> year, label=1) rather than reimplementing it fresh.
    pos_df = pd.read_csv(positives_csv)
    pos_df["country"] = pos_df["country_id"].apply(w.normalize_country_id)
    pos_df = pos_df.rename(columns={"event_year": "year"})
    pos_df["label"] = 1
    pos = pos_df
    samples = w.build_samples(pos, negatives_per_positive=NEGATIVES_PER_POSITIVE, seed=SEED)
    n_pos_pooled = int((samples["label"] == 1).sum())

    assignments = ec.load_cohort_assignments(cohort_assignments_path)
    rows = list(zip(samples["country"].tolist(), samples["year"].astype(int).tolist()))
    resolved, unresolved = ec.classify_rows_tolerant(assignments, rows)
    resolved_by_key: dict[tuple[str, int], bool] = {
        (r["country"], r["event_year"]): r["em_eligible"] for r in resolved
    }
    # classify_rows_tolerant is called per (country, year) pair; duplicate (country, year)
    # rows (a positive and a time-matched negative can share a year for different countries,
    # or -- rarer -- collide) resolve identically since em_eligible is a pure function of
    # (country, year), so a dict keyed on (country, year) is safe here.
    subset_mask = np.array(
        su.resolve_subset_mask(rows, resolved_by_key, subset)
    )
    unresolved_mask = np.array(
        [(c, y) not in resolved_by_key for c, y in zip(samples["country"], samples["year"].astype(int))]
    )
    subset_samples = samples[subset_mask].reset_index(drop=True)
    n_pos_subset_samples = int((subset_samples["label"] == 1).sum())
    n_neg_subset_samples = int((subset_samples["label"] == 0).sum())

    panels = {ind: w.load_panel(ind, panel_dir) for ind in BASELINE_DRIVERS}
    coverage = w.coverage_report(subset_samples, BASELINE_DRIVERS, LOCKED_WINDOW, panels)

    X, y, c, yr = w.build_X_y(subset_samples, BASELINE_DRIVERS, LOCKED_WINDOW, panels)
    if len(X) == 0 or len(np.unique(y)) < 2:
        raise ValueError(
            f"{subset}-subset build_X_y produced no usable rows or a single class -- cannot "
            f"fit the baseline (n_pos_subset_samples={n_pos_subset_samples}, "
            f"n_neg_subset_samples={n_neg_subset_samples})"
        )
    res = w.fit_predict_loco(X, y, c, yr, architecture=architecture, seed=SEED)
    ci = w.bca_bootstrap_auc_ci(res["probs"], res["labels"], seed=SEED)

    out: dict[str, Any] = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "subset": subset,
        "drivers": BASELINE_DRIVERS,
        "window_locked": LOCKED_WINDOW,
        "window_locked_provenance": "run-2's own chosen_window (widenet/results/full_run/baseline_harness_report.json)",
        "architecture": architecture,
        "architecture_source": (
            "committed em_commitment.json (binding, no post-hoc re-derivation)" if subset == "em"
            else "em_classification.select_architecture(n_pos_advanced) -- secondary/non-gating "
                 "track, same binding rule, independently derived from em_commitment.json's own count"
        ),
        "n_pos_subset_positives_pre_build_X_y": n_pos_subset_positives,
        "n_pos_pooled_samples": n_pos_pooled,
        "n_rows_pooled_samples": int(len(samples)),
        "n_rows_unresolved_no_cohort_data": int(unresolved_mask.sum()),
        "n_rows_subset_samples": int(len(subset_samples)),
        "n_pos_subset_samples": n_pos_subset_samples,
        "n_neg_subset_samples": n_neg_subset_samples,
        "coverage_report_post_build_X_y": coverage,
        "n_rows_survived_build_X_y": int(len(X)),
        "n_pos_survived_build_X_y": int((y == 1).sum()),
        "baseline_loco_auc": float(res["global_auc"]),
        "ci95_lo": float(ci["ci95_lo"]),
        "ci95_hi": float(ci["ci95_hi"]),
        "ci80_lo": float(ci.get("ci80_lo", float("nan"))),
        "ci80_hi": float(ci.get("ci80_hi", float("nan"))),
        "per_country_auc": {k: float(v) for k, v in res["per_country_auc"].items()},
        "n_countries_in_loco": len(res["per_country_auc"]),
        "oof": [
            {"country": str(res["countries"][k]), "year": int(res["years"][k]),
             "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
            for k in range(len(res["probs"]))
        ],
        "pooled_baseline_auc_reference_NOT_the_denominator": 0.6381273123992031,
        "note": (
            f"This {subset}-only AUC is the valid denominator for scoring the §11 {subset}-subset "
            "candidate(s) per PLAN.md §11. The pooled 0.638 figure is included above ONLY as a "
            "reference point, never as the comparison baseline for the subset-scoped test."
        ),
    }
    # Back-compat alias for the EM subset (em_baseline_report.json's original consumers read
    # `em_baseline_loco_auc`; keep it alongside the new subset-agnostic `baseline_loco_auc`).
    if subset == "em":
        out["em_baseline_loco_auc"] = out["baseline_loco_auc"]

    if out_path is not None:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[run_em_baseline] wrote {out_path}")
    print(
        f"[run_em_baseline] subset={subset} architecture={architecture} "
        f"n_pos_subset_samples={n_pos_subset_samples} "
        f"baseline_loco_auc={out['baseline_loco_auc']!r} "
        f"CI95=[{out['ci95_lo']!r},{out['ci95_hi']!r}]"
    )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=DEFAULT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--cohort-assignments", type=Path, default=DEFAULT_COHORT_ASSIGNMENTS)
    ap.add_argument("--commitment-path", type=Path, default=DEFAULT_COMMITMENT_PATH)
    ap.add_argument("--subset", choices=["em", "advanced"], default="em")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)
    out_path = args.out or (
        HERE / "results" / ("em_baseline_report.json" if args.subset == "em" else "advanced_baseline_report.json")
    )
    run_em_baseline(
        args.panel_dir, args.positives_csv, args.cohort_assignments, args.commitment_path,
        out_path, subset=args.subset,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
