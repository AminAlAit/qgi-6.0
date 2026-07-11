"""Orchestration (Docker-only) for the SEPARATE universal terms-of-trade / commodity-shock
walk on the FULL 106-country economic_recession positives set, 2026-07-11 -- reported
UN-BLENDED from the OECD-scoped recipe (`run_scoped_battery.py`); this is a different
candidate, a different scope, and a different (much lower, per the D1 global screen) coverage
profile.

Recipe under test = run-2's 2 drivers (`v2csreprss`, `v2x_freexp_altinf`) + the near-universal
`TT.PRI.MRCH.XD.WD` (WDI terms-of-trade) + `COMMODITY_SHOCK.EXPORT_WEIGHTED` (export-weighted
commodity-shock interaction), on ALL 250 positives / 106 countries -- no OECD scoping.

Per `results/d1_reboot_coverage_screen_global.json` (already run): `TT.PRI.MRCH.XD.WD`
GLOBAL coverage-at-positive-cells is only 40.0% and `COMMODITY_SHOCK.EXPORT_WEIGHTED` is
74.0% -- BOTH fail the 80% D1 bar globally (only the OECD-scoped subset ever cleared it, and
only for the house-price/commodity-shock pair, not terms-of-trade). This module runs the walk
anyway per the task's explicit ask ("Separately run the universal ToT/commodity-shock walk on
the full 106 vs 0.547") and reports the REAL `run_f_ml_1_poc.coverage_report` /
`coverage_gate_ok` verdict honestly (guard #3: "REAL coverage screen ... not roster overlap")
-- a walk that fails its own production coverage gate is reported as COVERAGE_FAIL, not
silently fit on a truncated sample.

Reuses `run_scoped_battery.py`'s `_fit_at_window` / `_era_decomposition` primitives (imported,
never reimplemented) for the mandatory 2008 era-decomposition leg.

Writes `results/universal_tot_commodity_walk_report.json`.
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
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
for _p in (HERE, SCRIPTS_DIR, PILOT_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import battery_gates_reboot as bg  # noqa: E402
import run_scoped_battery as rsb  # noqa: E402 (reuse _fit_at_window / _era_decomposition)

SEED = 12345
RECIPE_ID = "economic_recession_universal_tot_commodity"
RUN2_DRIVERS = ["v2csreprss", "v2x_freexp_altinf"]
NEW_INDICATORS = ["TT.PRI.MRCH.XD.WD", "COMMODITY_SHOCK.EXPORT_WEIGHTED"]
RECIPE = RUN2_DRIVERS + NEW_INDICATORS
UNIVERSAL_ANCHOR_AUC = 0.547  # PRE-REGISTRATION.md's already-established honest universal baseline

MAIN_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
REBOOT_PANEL_DIR = HERE / "panel_dir"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"


def _panel_source_dir(indicator_id: str) -> Path:
    return REBOOT_PANEL_DIR if indicator_id in NEW_INDICATORS else MAIN_PANEL_DIR


def run_universal_walk(
    main_panel_dir: Path = MAIN_PANEL_DIR,
    reboot_panel_dir: Path = REBOOT_PANEL_DIR,
    positives_csv: Path = POSITIVES_CSV,
    out_path: Path | None = None,
) -> dict[str, Any]:
    import run_f_ml_1_poc as w  # noqa: E402
    import stability_select as ss  # noqa: E402
    import score_pilot as sp  # noqa: E402
    import oof_utils as ou  # noqa: E402
    import pandas as pd

    raw = pd.read_csv(positives_csv)
    pos = pd.DataFrame({
        "country": raw["country_id"].apply(w.normalize_country_id),
        "year": raw["event_year"].astype(int),
        "label": 1,
    })
    samples = w.build_samples(pos, negatives_per_positive=3, seed=SEED, time_matched=True)
    n_pos = int((samples["label"] == 1).sum())
    n_countries = int(samples["country"].nunique())

    all_ids = sorted(set(RECIPE))
    panels = {ind: w.load_panel(ind, _panel_source_dir(ind)) for ind in all_ids}
    baseline_panels = {ind: panels[ind] for ind in RUN2_DRIVERS}

    # --- guard #3: REAL coverage screen on the joint recipe, at every WINDOW_GRID candidate
    # (mirrors the production walk's own gate -- MIN_POS_SURVIVAL/MIN_EFFECTIVE_NPOS/
    # MIN_SURVIVE_COUNTRIES/MIN_NEG_SURVIVAL) -- reported honestly even if it fails. ----------
    coverage_by_window: dict[int, dict[str, Any]] = {}
    for win in w.WINDOW_GRID:
        cov = w.coverage_report(samples, RECIPE, win, panels)
        cov["gate_pass"] = bool(w.coverage_gate_ok(cov))
        coverage_by_window[int(win)] = cov
    any_window_passes_coverage = any(c["gate_pass"] for c in coverage_by_window.values())

    # --- baseline + candidate, own WINDOW_GRID argmax each (same pattern as
    # widenet/baseline_harness.py) -----------------------------------------------------------
    baseline_fit = ss._final_fit(RUN2_DRIVERS, samples, baseline_panels, SEED)
    candidate_fit = ss._final_fit(RECIPE, samples, panels, SEED)

    pi_ = sp.pair_oof(candidate_fit["oof"], baseline_fit["oof"])
    delta = sp.paired_bootstrap_delta_auc(
        pi_["probs_a"], pi_["probs_b"], pi_["labels"], countries=pi_["countries"], b_eval=2000, seed=SEED,
    )
    floor_pass = bg.floor_gate_pass(delta["ci95_lo"])

    per_country_auc = ou.per_country_auc_from_oof(candidate_fit["oof"])
    d5_pass = bg.per_country_gate_pass(per_country_auc)

    # --- mandatory 2008 era-decomposition, genuine refit at the candidate's own locked window
    locked_window = candidate_fit["chosen_window"]
    era_candidate = (
        rsb._era_decomposition(w, RECIPE, samples, panels, locked_window, SEED) if locked_window else None
    )

    baseline_vs_anchor_diff = (
        baseline_fit["loco_auc"] - UNIVERSAL_ANCHOR_AUC if baseline_fit["loco_auc"] == baseline_fit["loco_auc"]
        else None
    )

    overall_gates = {
        "coverage_gate_pass_any_window": any_window_passes_coverage,
        "floor_ci_lower_gt_0.02": floor_pass,
        "per_country_breadth": d5_pass,
        "era2008_not_rejected": not (era_candidate is not None and era_candidate["verdict"]["reject"]),
    }
    overall_clears = all(overall_gates.values())

    report: dict[str, Any] = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "scope": "universal_full_106",
        "n_countries_with_events": n_countries,
        "n_pos_samples": n_pos,
        "recipe_indicators": RECIPE,
        "new_indicators": NEW_INDICATORS,
        "universal_anchor_auc_0.547_note": (
            "PRE-REGISTRATION.md's already-established honest universal baseline (run-2's 2 "
            "V-Dem drivers, 250-event set, XGBoost window 3). This module ALSO refits that "
            "same baseline fresh (row-aligned to whatever rows this walk's own build_X_y "
            "produces) for the paired delta -- `baseline.loco_auc` vs `0.547` is a sanity "
            "check, not the primary comparator (the primary comparator IS 0.547 per the "
            "task's explicit framing: 'vs 0.547')."
        ),
        "coverage_screen_real": {
            "by_window": coverage_by_window, "any_window_passes_coverage_gate": any_window_passes_coverage,
        },
        "baseline": {
            "drivers": RUN2_DRIVERS, "loco_auc": baseline_fit["loco_auc"],
            "ci95_lo": baseline_fit["ci95_lo"], "ci95_hi": baseline_fit["ci95_hi"],
            "chosen_window": baseline_fit["chosen_window"],
            "diff_vs_0.547_anchor": baseline_vs_anchor_diff,
        },
        "candidate": {
            "loco_auc": candidate_fit["loco_auc"], "ci95_lo": candidate_fit["ci95_lo"],
            "ci95_hi": candidate_fit["ci95_hi"], "chosen_window": candidate_fit["chosen_window"],
            "diff_vs_0.547_anchor": (
                candidate_fit["loco_auc"] - UNIVERSAL_ANCHOR_AUC
                if candidate_fit["loco_auc"] == candidate_fit["loco_auc"] else None
            ),
        },
        "pairing": {"n_pairs": pi_["n_pairs"], "n_a": pi_["n_a"], "n_b": pi_["n_b"],
                    "label_mismatches": pi_["label_mismatches"]},
        "delta_auc_vs_refit_baseline": delta,
        "floor_gate_pass_ci_lower_gt_0.02": floor_pass,
        "d5_per_country": {"gate_pass": d5_pass, "per_country_auc": per_country_auc,
                            "n_countries": len(per_country_auc)},
        "era2008_decomposition_candidate_genuine_refit": era_candidate,
        "overall_gates": overall_gates,
        "overall_clears_full_battery": overall_clears,
    }

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[run_universal_walk] wrote {out_path}")
    print(
        f"[run_universal_walk] baseline={baseline_fit['loco_auc']!r} (0.547 anchor) "
        f"candidate={candidate_fit['loco_auc']!r} dAUC={delta['point']!r} "
        f"CI95=[{delta['ci95_lo']!r},{delta['ci95_hi']!r}] "
        f"coverage_gate_pass_any_window={any_window_passes_coverage} overall_clears={overall_clears}"
    )
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--main-panel-dir", type=Path, default=MAIN_PANEL_DIR)
    ap.add_argument("--reboot-panel-dir", type=Path, default=REBOOT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=POSITIVES_CSV)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "universal_tot_commodity_walk_report.json")
    args = ap.parse_args(argv)
    run_universal_walk(args.main_panel_dir, args.reboot_panel_dir, args.positives_csv, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
