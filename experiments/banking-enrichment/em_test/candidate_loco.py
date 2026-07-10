"""§11 Step 2-3 -- candidate LOCO scoring on the EM/advanced subset, for the D1/D5/D6/D7
inputs of the 7-gate confound battery (`run_full_battery.py`).

Reuses (never reimplements): `run_f_ml_1_poc.build_samples` / `build_X_y` /
`fit_predict_loco` / `bca_bootstrap_auc_ci` / `era_stratified_loco`,
`em_classification.classify_rows_tolerant` / `select_architecture`,
`subset_utils.resolve_subset_mask` (identical EM/advanced masking as `run_em_baseline.py`
and the two confound scripts), `p1/screen.g1_coverage` (the production G1 80%-coverage-at-
positive-cells gate, imported not reimplemented) restricted to the subset's own positives,
and `widenet/temporal_holdout.auc_with_without_cohort` for the D4 2008-cohort sensitivity
check on the candidate's own OOF predictions.

Named D5 twin-crisis set (PLAN.md §11 acceptance bar #5, task-brief's explicit 8-country
list): Mexico'94, Thailand'97, Indonesia'97, South Korea'97, Russia'98, Turkiye'01,
Argentina'01, Brazil'94. Under the cohort-assignments.json proxy (em_classification.py's
documented KNOWN LIMITATION), Mexico/Thailand/Indonesia/Russia/Turkiye resolve EM-eligible;
South Korea/Argentina/Brazil resolve advanced -- so this module reports whichever of the 8
fall inside the subset actually being scored, never silently drops the other side.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
WIDENET_DIR = HERE.parent / "widenet"
P1_DIR = HERE.parent / "p1"
for _p in (HERE, SCRIPTS_DIR, WIDENET_DIR, P1_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import em_classification as ec  # noqa: E402
import subset_utils as su  # noqa: E402

SEED = 12345
LOCKED_WINDOW = 15  # same lock as run_em_baseline.py / both confound scripts
DEFAULT_PANEL_DIR = WIDENET_DIR / "deduped_panel_dir"
DEFAULT_POSITIVES_CSV = ec.DEFAULT_POSITIVES_CSV
DEFAULT_COHORT_ASSIGNMENTS = ec.DEFAULT_COHORT_ASSIGNMENTS_PATH
DEFAULT_COMMITMENT_PATH = HERE / "results" / "em_commitment.json"
G1_COVERAGE_MIN = 0.80  # p1/screen.py's own G1 threshold, mirrored here for the report

# PLAN.md §11's explicit D5 named twin-crisis set (task-brief 8-country form).
NAMED_TWIN_CRISES: list[tuple[str, int]] = [
    ("Mexico", 1994), ("Thailand", 1997), ("Indonesia", 1997), ("South Korea", 1997),
    ("Russia", 1998), ("Turkiye", 2001), ("Argentina", 2001), ("Brazil", 1994),
]


# ============================================================================================
# Pure helpers (host-testable, no ML stack). See test_candidate_loco.py.
# ============================================================================================
def filter_positives_to_subset(
    positives: list[tuple[str, int]],
    resolved_by_key: dict[tuple[str, int], bool],
    subset: str,
) -> list[tuple[str, int]]:
    """The subset's own positives (country, year) pairs -- used for the G1 80%-coverage-at-
    positive-cells gate, which must be scored against the SUBSET's positives, never the full
    pooled 113 (that is exactly the aggregate-80%-gate failure mode PLAN.md §10 #3's log
    entry documents: external-fragility fails pooled because ~30+ advanced positives have 0%
    IDS coverage by construction, but the EM-scoped gate is the whole point of §11)."""
    mask = su.resolve_subset_mask(positives, resolved_by_key, subset)
    return [p for p, keep in zip(positives, mask) if keep]


def named_twins_present_in_subset(
    resolved_by_key: dict[tuple[str, int], bool],
    subset: str,
) -> list[str]:
    """Which of `NAMED_TWIN_CRISES` fall inside `subset` under the given resolution map.
    A named twin absent from `resolved_by_key` (unresolved) is excluded from BOTH subsets."""
    mask = su.resolve_subset_mask(NAMED_TWIN_CRISES, resolved_by_key, subset)
    return [c for (c, _y), keep in zip(NAMED_TWIN_CRISES, mask) if keep]


# ============================================================================================
# Orchestration (Docker-only: needs run_f_ml_1_poc + p1.screen.g1_coverage).
# ============================================================================================
def score_candidate(
    indicator_id: str,
    subset: str,
    candidate_panel_dir: Path,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    cohort_assignments_path: Path = DEFAULT_COHORT_ASSIGNMENTS,
    commitment_path: Path = DEFAULT_COMMITMENT_PATH,
    out_path: Path | None = None,
) -> dict[str, Any]:
    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)
    import screen as p1screen  # noqa: E402  (p1/screen.py -- G1 coverage gate, pure arithmetic, no heavy deps beyond pandas/numpy)
    import temporal_holdout as th  # noqa: E402

    if not commitment_path.exists():
        raise FileNotFoundError(f"{commitment_path} not found -- run em_classification.py first")
    commitment = json.loads(commitment_path.read_text(encoding="utf-8"))
    if subset == "em":
        architecture = commitment["architecture"]
    elif subset == "advanced":
        architecture = ec.select_architecture(commitment["n_pos_advanced"])
    else:
        raise ValueError(f"score_candidate: subset must be 'em' or 'advanced', got {subset!r}")

    pos_df = pd.read_csv(positives_csv)
    pos_df["country"] = pos_df["country_id"].apply(w.normalize_country_id)
    positives_all = list(zip(pos_df["country"].tolist(), pos_df["event_year"].astype(int).tolist()))
    pos_df = pos_df.rename(columns={"event_year": "year"})
    pos_df["label"] = 1
    samples = w.build_samples(pos_df, negatives_per_positive=3, seed=SEED)

    assignments = ec.load_cohort_assignments(cohort_assignments_path)
    sample_rows = list(zip(samples["country"].tolist(), samples["year"].astype(int).tolist()))
    resolved, _unresolved = ec.classify_rows_tolerant(assignments, sample_rows)
    resolved_by_key = {(r["country"], r["event_year"]): r["em_eligible"] for r in resolved}
    subset_mask = np.array(su.resolve_subset_mask(sample_rows, resolved_by_key, subset))
    subset_samples = samples[subset_mask].reset_index(drop=True)

    # G1 80%-coverage-at-positive-cells gate, restricted to the SUBSET's own positives
    # (indicator-criteria.md trend-panel-floor exception; p1/screen.py's own gate, imported).
    resolved_all, _ = ec.classify_rows_tolerant(assignments, positives_all)
    resolved_all_by_key = {(r["country"], r["event_year"]): r["em_eligible"] for r in resolved_all}
    subset_positives = filter_positives_to_subset(positives_all, resolved_all_by_key, subset)
    candidate_df = pd.read_parquet(candidate_panel_dir / indicator_id / f"{indicator_id}.parquet")[
        ["country", "year", "value"]
    ]
    subset_positives_df = pd.DataFrame(subset_positives, columns=["country", "year"])
    g1 = p1screen.g1_coverage(candidate_df, subset_positives_df)

    panels = {indicator_id: w.load_panel(indicator_id, candidate_panel_dir)}
    coverage = w.coverage_report(subset_samples, [indicator_id], LOCKED_WINDOW, panels)
    X, y, c, yr = w.build_X_y(subset_samples, [indicator_id], LOCKED_WINDOW, panels)
    if len(X) == 0 or len(np.unique(y)) < 2:
        raise ValueError(
            f"{indicator_id}/{subset}: build_X_y produced no usable rows or a single class"
        )
    res = w.fit_predict_loco(X, y, c, yr, architecture=architecture, seed=SEED)
    ci = w.bca_bootstrap_auc_ci(res["probs"], res["labels"], seed=SEED)

    # D4 inputs: era decomposition + 2008-cohort with/without sensitivity, on the candidate's
    # own pooled LOCO OOF predictions (production era_stratified_loco + temporal_holdout's
    # pure sp.auc-based sensitivity helper -- neither reimplemented).
    era = w.era_stratified_loco(res["probs"], res["labels"], res["years"])
    sens_2008 = th.auc_with_without_cohort(res["probs"], res["labels"], res["years"], exclude_year=2008)

    # D5 inputs: per-country AUC restricted to the named twin-crisis countries present in
    # this subset.
    twins_present = named_twins_present_in_subset(resolved_all_by_key, subset)
    twin_per_country_auc = {
        c_: res["per_country_auc"][c_] for c_ in twins_present if c_ in res["per_country_auc"]
    }
    twins_missing_from_loco = [c_ for c_ in twins_present if c_ not in res["per_country_auc"]]

    out: dict[str, Any] = {
        "seed": SEED,
        "indicator_id": indicator_id,
        "subset": subset,
        "window_locked": LOCKED_WINDOW,
        "architecture": architecture,
        "g1_coverage_gate": {**g1, "note": f"G1 restricted to the {subset}-subset's own {len(subset_positives)} positives"},
        "coverage_report_post_build_X_y": coverage,
        "n_rows_survived_build_X_y": int(len(X)),
        "n_pos_survived_build_X_y": int((y == 1).sum()),
        "candidate_loco_auc": float(res["global_auc"]),
        "ci95_lo": float(ci["ci95_lo"]),
        "ci95_hi": float(ci["ci95_hi"]),
        "ci80_lo": float(ci.get("ci80_lo", float("nan"))),
        "ci80_hi": float(ci.get("ci80_hi", float("nan"))),
        "per_country_auc": {k: float(v) for k, v in res["per_country_auc"].items()},
        "n_countries_in_loco": len(res["per_country_auc"]),
        "era_stratified_loco": era,
        "sensitivity_2008_cohort": sens_2008,
        "named_twins_present_in_subset": twins_present,
        "named_twins_per_country_auc": {k: float(v) for k, v in twin_per_country_auc.items()},
        "named_twins_missing_from_loco": twins_missing_from_loco,
        "oof": [
            {"country": str(res["countries"][k]), "year": int(res["years"][k]),
             "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
            for k in range(len(res["probs"]))
        ],
    }
    if out_path is not None:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[candidate_loco] wrote {out_path}")
    print(
        f"[candidate_loco] {indicator_id}/{subset}: g1_gate={'PASS' if g1['gate_pass'] else 'FAIL'} "
        f"({g1['coverage_pct']:.1%}) candidate_loco_auc={out['candidate_loco_auc']!r} "
        f"CI95=[{out['ci95_lo']!r},{out['ci95_hi']!r}]"
    )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--indicator-id", required=True)
    ap.add_argument("--subset", choices=["em", "advanced"], required=True)
    ap.add_argument("--candidate-panel-dir", type=Path, required=True)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--cohort-assignments", type=Path, default=DEFAULT_COHORT_ASSIGNMENTS)
    ap.add_argument("--commitment-path", type=Path, default=DEFAULT_COMMITMENT_PATH)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)
    out = args.out or (HERE / "results" / f"candidate_{args.indicator_id}_{args.subset}.json")
    score_candidate(
        args.indicator_id, args.subset, args.candidate_panel_dir, args.positives_csv,
        args.cohort_assignments, args.commitment_path, out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
