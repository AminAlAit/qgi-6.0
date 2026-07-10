"""Orchestration for the military_coup 7-gate battery, ONE candidate at a time
(Docker-only: needs run_f_ml_1_poc / stability_select / score_pilot / temporal_holdout /
confound_missingness_placebo's pure panel transforms).

Per PRE-REGISTRATION.md (committed d277502): for the recipe = run-2's 5 drivers
(`SP.DYN.LE00.IN, v2excrptps, v2cltort, v2xel_frefair, v2x_clpol`) + ONE candidate,
compute:
  - the row-aligned baseline re-fit (D1) and the recipe's own LOCO-AUC, via
    `stability_select._final_fit` (imported, never reimplemented) -- both on the IDENTICAL
    canonical `samples` (seed=12345, negatives_per_positive=3), each with its OWN
    WINDOW_GRID argmax (mirrors `widenet/baseline_harness.py`'s pattern).
  - D2: has-data-dummy + values-scrambled-permutation placebo recipes (candidate slot
    replaced; run-2's 5 real drivers stay real), LOCKED to the real candidate recipe's own
    chosen_window (no fresh argmax on a placebo -- matches banking's own D2 convention).
    Uses `confound_missingness_placebo.build_has_data_dummy_panel` /
    `permute_values_mask_preserved` (imported, never reimplemented). For
    NY.GDP.MKTP.KD.ZG only: additionally computes the has-data/label point-biserial
    correlation (`oof_utils.point_biserial_corr`) on the candidate's OWN coverage mask at the
    chosen window.
  - D3: read (not recomputed) from `results/d3_vdem_orthogonality_report.json` (already run);
    None for NY.GDP.MKTP.KD.ZG (not V-Dem).
  - D4: paired-bootstrap delta vs the coup-trap-alone baseline's OOF
    (`results/coup_trap_alone_report.json`, already run).
  - D5: `oof_utils.per_country_auc_from_oof` on the candidate recipe's own OOF.
  - D6: paired-bootstrap delta vs the D1 baseline's OOF (FDR applied later, across all 6
    candidates, by `run_all_candidates.py`).
  - D7: locked temporal hold-out via `widenet/temporal_holdout.py` (imported, never
    reimplemented): `pick_cut_year` (boldest-cut-first) + `fit_predict_holdout`, LOCKED to
    the candidate recipe's own chosen_window.

Writes `results/battery_<candidate_id>.json`. The D6 gate here is PROVISIONAL (no FDR
applied yet -- `run_all_candidates.py` does the joint FDR + writes the final verdict).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
WIDENET_DIR = QGI_ML_ROOT / "experiments" / "banking-enrichment" / "widenet"
EM_TEST_DIR = QGI_ML_ROOT / "experiments" / "banking-enrichment" / "em_test"
for _p in (HERE, SCRIPTS_DIR, PILOT_DIR, WIDENET_DIR, EM_TEST_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import battery_gates as bg  # noqa: E402
import oof_utils as ou  # noqa: E402

SEED = 12345
RECIPE_ID = "military_coup"
RUN2_DRIVERS = ["SP.DYN.LE00.IN", "v2excrptps", "v2cltort", "v2xel_frefair", "v2x_clpol"]
VDEM_CANDIDATES = {
    "v2exl_legitlead", "v2pepwrses", "v2stcritapparm", "v2strenarm", "OWID_AUTOCRATIZATION",
}
GDP_CANDIDATE = "NY.GDP.MKTP.KD.ZG"

DEFAULT_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
DEFAULT_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"
DEFAULT_D3_REPORT = HERE / "results" / "d3_vdem_orthogonality_report.json"
DEFAULT_COUP_TRAP_REPORT = HERE / "results" / "coup_trap_alone_report.json"
D7_CANDIDATE_CUTS = [1985, 1990, 1995, 2000, 2005, 2010]  # boldest (earliest) cut first


def _canonical_samples(w: Any, positives_csv: Path) -> Any:
    import pandas as pd
    pos = pd.read_csv(positives_csv)
    pos["country"] = pos["country_id"].apply(w.normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    pos["label"] = 1
    return w.build_samples(pos, negatives_per_positive=3, seed=SEED)


def run_battery_for_candidate(
    candidate_id: str,
    panel_dir: Path = DEFAULT_PANEL_DIR,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    d3_report_path: Path = DEFAULT_D3_REPORT,
    coup_trap_report_path: Path = DEFAULT_COUP_TRAP_REPORT,
    out_path: Path | None = None,
) -> dict[str, Any]:
    import numpy as np

    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)
    import stability_select as ss  # noqa: E402
    import score_pilot as sp  # noqa: E402
    import temporal_holdout as th  # noqa: E402
    import confound_missingness_placebo as cmp_  # noqa: E402

    samples = _canonical_samples(w, positives_csv)

    all_ids = sorted(set(RUN2_DRIVERS) | {candidate_id})
    panels = {ind: w.load_panel(ind, panel_dir) for ind in all_ids}
    recipe = RUN2_DRIVERS + [candidate_id]

    # --- D1: row-aligned baseline re-fit + the recipe's own LOCO fit (WINDOW_GRID argmax
    # for each, independently -- mirrors baseline_harness.py's pattern). ---
    baseline_fit = ss._final_fit(RUN2_DRIVERS, samples, panels, SEED)
    recipe_fit = ss._final_fit(recipe, samples, panels, SEED)
    d1_pass = bg.d1_gate_pass(baseline_fit["loco_auc"])

    # --- D6 (provisional, no FDR yet): candidate recipe vs baseline. ---
    pi_d6 = sp.pair_oof(recipe_fit["oof"], baseline_fit["oof"])
    delta_d6 = sp.paired_bootstrap_delta_auc(
        pi_d6["probs_a"], pi_d6["probs_b"], pi_d6["labels"], countries=pi_d6["countries"],
        b_eval=1000, seed=SEED,
    )

    # --- D2: has-data-dummy + values-scrambled-permutation, LOCKED to recipe_fit's own
    # chosen_window (no fresh argmax on a placebo). ---
    locked_window = recipe_fit["chosen_window"]
    real_candidate_panel = panels[candidate_id]
    dummy_panel = cmp_.build_has_data_dummy_panel(real_candidate_panel)
    permuted_panel = cmp_.permute_values_mask_preserved(real_candidate_panel, seed=SEED)
    cmp_.assert_mask_preserved(real_candidate_panel, dummy_panel)
    cmp_.assert_mask_preserved(real_candidate_panel, permuted_panel)

    def _fit_recipe_with_swap(swap_panel) -> dict[str, Any]:
        swapped_panels = dict(panels)
        swapped_panels[candidate_id] = swap_panel
        X, y, c, yr = w.build_X_y(samples, recipe, locked_window, swapped_panels)
        if len(X) == 0 or len(np.unique(y)) < 2:
            return {"loco_auc": float("nan"), "oof": []}
        res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
        return {
            "loco_auc": float(res["global_auc"]),
            "oof": [
                {"country": str(res["countries"][k]), "year": int(res["years"][k]),
                 "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
                for k in range(len(res["probs"]))
            ],
        }

    dummy_fit = _fit_recipe_with_swap(dummy_panel)
    permuted_fit = _fit_recipe_with_swap(permuted_panel)

    def _delta_vs_baseline(placebo_oof: list[dict]) -> dict[str, Any]:
        if not placebo_oof:
            return {"ci95_lo": None, "ci95_hi": None, "point": float("nan")}
        pi_ = sp.pair_oof(placebo_oof, baseline_fit["oof"])
        return sp.paired_bootstrap_delta_auc(
            pi_["probs_a"], pi_["probs_b"], pi_["labels"], countries=pi_["countries"],
            b_eval=1000, seed=SEED,
        )

    delta_dummy = _delta_vs_baseline(dummy_fit["oof"])
    delta_permuted = _delta_vs_baseline(permuted_fit["oof"])

    gdp_missingness_r: float | None = None
    if candidate_id == GDP_CANDIDATE:
        # has-data mask for the candidate ALONE (build_X_y on [candidate_id] only, at the
        # locked window) vs label -- the banking "has-data != regime" check.
        Xc, yc, _cc, _yrc = w.build_X_y(samples, [candidate_id], locked_window,
                                         {candidate_id: real_candidate_panel})
        # has_data per (country, year) row of `samples` -- reconstruct the survival mask by
        # re-running build_X_y on the FULL samples index (build_X_y silently drops rows; we
        # need a per-row 0/1 survived flag, so re-derive by testing each row's own
        # extract_features_for_indicator directly).
        has_data = []
        labels_full = []
        for _, row in samples.iterrows():
            f = w.extract_features_for_indicator(
                real_candidate_panel, str(row["country"]), int(row["year"]), locked_window
            )
            has_data.append(1 if f is not None else 0)
            labels_full.append(int(row["label"]))
        gdp_missingness_r = ou.point_biserial_corr(labels_full, [float(x) for x in has_data])

    d2_pass = bg.d2_gate_pass(
        delta_dummy["ci95_lo"], delta_permuted["ci95_lo"], gdp_missingness_r=gdp_missingness_r,
    )

    # --- D3: read from the already-run V-Dem orthogonality screen (confirmation, not
    # recompute). N/A (None) for NY.GDP.MKTP.KD.ZG. ---
    d3_verdict: str | None = None
    if candidate_id in VDEM_CANDIDATES:
        d3_report = json.loads(d3_report_path.read_text(encoding="utf-8"))
        d3_verdict = d3_report["candidates"][candidate_id]["verdict"]
    d3_pass = bg.d3_gate_pass(d3_verdict)

    # --- D4: recipe vs coup-trap-alone. ---
    coup_trap_report = json.loads(coup_trap_report_path.read_text(encoding="utf-8"))
    pi_d4 = sp.pair_oof(recipe_fit["oof"], coup_trap_report["oof"])
    delta_d4 = sp.paired_bootstrap_delta_auc(
        pi_d4["probs_a"], pi_d4["probs_b"], pi_d4["labels"], countries=pi_d4["countries"],
        b_eval=1000, seed=SEED,
    )
    d4_pass = bg.d4_gate_pass(delta_d4["ci95_lo"])

    # --- D5: per-country decomposition on the recipe's own OOF. ---
    per_country_auc = ou.per_country_auc_from_oof(recipe_fit["oof"])
    d5_pass = bg.d5_gate_pass(per_country_auc)

    # --- D7: locked temporal hold-out, LOCKED to recipe_fit's own chosen_window. ---
    try:
        pick = th.pick_cut_year(
            samples, D7_CANDIDATE_CUTS, recipe, locked_window, panels, w,
            min_holdout_frac=0.10,
        )
        cut = pick["locked_cut_year"]
        screen, holdout = th.temporal_split(samples, cut)
        n_holdout_pos = int((holdout["label"] == 1).sum())
        d7_fit = th.fit_predict_holdout(
            screen, holdout, recipe, locked_window, panels, "XGBoost", SEED, w,
        )
        d7_ci_lo = d7_fit["holdout_auc_ci95"][0]
        d7_detail: dict[str, Any] = {"fit_failed": False, "locked_cut_year": cut,
                                      "cut_year_selection": pick, **d7_fit}
    except ValueError as exc:
        n_holdout_pos = 0
        d7_ci_lo = None
        d7_detail = {"fit_failed": True, "reason": str(exc)}
    d7_verdict = bg.d7_gate_verdict(n_holdout_pos, d7_ci_lo)

    gates_provisional = {
        "d1": d1_pass, "d2": d2_pass, "d3": d3_pass, "d4": d4_pass, "d5": d5_pass,
        "d6_no_fdr": bg.d6_gate_pass(delta_d6["ci95_lo"], fdr_reject=True),
        "d7": d7_verdict["gate_pass"],
    }

    report: dict[str, Any] = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "candidate_id": candidate_id,
        "recipe": recipe,
        "locked_window": locked_window,
        "baseline": {
            "drivers": RUN2_DRIVERS,
            "loco_auc": baseline_fit["loco_auc"],
            "ci95_lo": baseline_fit["ci95_lo"],
            "ci95_hi": baseline_fit["ci95_hi"],
            "chosen_window": baseline_fit["chosen_window"],
        },
        "recipe_fit": {
            "loco_auc": recipe_fit["loco_auc"],
            "ci95_lo": recipe_fit["ci95_lo"],
            "ci95_hi": recipe_fit["ci95_hi"],
            "chosen_window": recipe_fit["chosen_window"],
        },
        "d1_coverage_matched_baseline": {
            "gate_pass": d1_pass, "baseline_loco_auc": baseline_fit["loco_auc"],
            "anchor": bg.HONEST_BASELINE_ANCHOR, "tolerance": bg.D1_TOLERANCE,
        },
        "d2_missingness_placebo": {
            "gate_pass": d2_pass,
            "dummy_delta_vs_baseline": delta_dummy,
            "permuted_delta_vs_baseline": delta_permuted,
            "gdp_missingness_point_biserial_r": gdp_missingness_r,
        },
        "d3_vdem_orthogonality": {"gate_pass": d3_pass, "verdict": d3_verdict,
                                   "applicable": candidate_id in VDEM_CANDIDATES},
        "d4_over_couptrap_baseline": {
            "gate_pass": d4_pass, "delta_vs_couptrap": delta_d4,
            "couptrap_alone_loco_auc": coup_trap_report["loco_auc"],
        },
        "d5_per_country": {"gate_pass": d5_pass, "per_country_auc": per_country_auc,
                            "n_countries": len(per_country_auc)},
        "d6_country_block_bootstrap_provisional": {
            "gate_pass_no_fdr": gates_provisional["d6_no_fdr"], "delta_vs_baseline": delta_d6,
        },
        "d7_temporal_holdout": {**d7_verdict, "detail": d7_detail, "n_holdout_pos": n_holdout_pos},
        "gates_provisional": gates_provisional,
    }

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[run_candidate_battery] wrote {out_path}")
    print(
        f"[run_candidate_battery] {candidate_id}: baseline={baseline_fit['loco_auc']:.4f} "
        f"recipe={recipe_fit['loco_auc']:.4f} dAUC={delta_d6['point']:.4f} "
        f"CI95=[{delta_d6['ci95_lo']!r},{delta_d6['ci95_hi']!r}] gates={gates_provisional}"
    )
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--candidate-id", required=True)
    ap.add_argument("--panel-dir", type=Path, default=DEFAULT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--d3-report", type=Path, default=DEFAULT_D3_REPORT)
    ap.add_argument("--coup-trap-report", type=Path, default=DEFAULT_COUP_TRAP_REPORT)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)
    out = args.out or (HERE / "results" / f"battery_{args.candidate_id}.json")
    run_battery_for_candidate(
        args.candidate_id, args.panel_dir, args.positives_csv, args.d3_report,
        args.coup_trap_report, out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
