"""Phase 0 (PRE-REGISTRATION.md §2): coverage-GATED greedy re-screen of terrorist_attack's
run-2 driver set over the FULL 248-indicator candidate pool, on the CURRENT 242-event/
71-country positives.csv, seed=12345, XGBoost.

Per §2 item 1 ("hard coverage constraint during selection, not after"): this is satisfied by
construction by reusing `run_f_ml_1_poc.greedy_outer_loop` UNMODIFIED -- every (candidate,
window) grid cell it evaluates is ALREADY gated by `coverage_gate_ok` inside `_eval_grid_cell`
(>=50% positive-survival AND >=60% negative-survival on the trial set = selected-so-far + this
candidate, at that window). A coverage-failing cell returns None and is skipped by the greedy,
so the returned `selected_indicators` set is coverage-valid at `chosen_window` BY CONSTRUCTION --
no post-hoc filtering needed. `univariate_loco_screen` (the top-40 prefilter) applies the same
gate per-candidate before ranking, so VC.IDP.NWDS-style depth-starved indicators cannot even
enter the top-40.

This is a SHORT greedy (one full-sample walk, not run-3.1's 200-walk stability-selection
wrapper) -- matches the task brief's "short greedy over the 248-indicator pool, coverage-gated,
XGBoost, seed=12345". Reuses build_samples / list_candidate_indicators / load_panel /
univariate_loco_screen / greedy_outer_loop / build_X_y / fit_predict_loco /
coverage_report / coverage_gate_ok from scripts/run_f_ml_1_poc.py, and
stability_select._load_positives / _final_fit / NEGATIVES_PER_POSITIVE (import, never
reimplement).

THROWAWAY / one-off diagnostic (qgi-ml CLAUDE.md test-first rule: tagged as throwaway, not
committed as a script under test) -- same convention as the sibling _per_driver_coverage.py /
_recompute_terrorist_attack_baseline.py diagnostics in this cycle.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
RUN31_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
for _p in (SCRIPTS_DIR, RUN31_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import run_f_ml_1_poc as w  # noqa: E402
import stability_select as ss  # noqa: E402

SEED = 12345
RECIPE_ID = "terrorist_attack"
PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"

print(f"[phase0] recipe={RECIPE_ID} seed={SEED}")

pos = ss._load_positives(POSITIVES_CSV)
print(f"[phase0] loaded positives: n_rows={len(pos)} n_countries={pos['country'].nunique()}")

samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
n_pos = int((samples["label"] == 1).sum())
n_neg = int((samples["label"] == 0).sum())
print(f"[phase0] samples built: n_pos={n_pos} n_neg={n_neg}")

all_candidates = w.list_candidate_indicators(PANEL_DIR)
print(f"[phase0] candidate pool: {len(all_candidates)} indicators")

panels = {ind: w.load_panel(ind, PANEL_DIR) for ind in all_candidates}
print(f"[phase0] panels loaded for {len(panels)} indicators")

top40, uni_scores = w.univariate_loco_screen(samples, all_candidates, panels)
print(f"[phase0] univariate screen -> top{len(top40)}: {top40}")

# production cap rule (mirrors run_single_walk / _main): n_pos_built<60 -> 5 steps, else 12
max_steps = 5 if n_pos < 60 else 12
architecture = "XGBoost" if n_pos >= 60 else "LR"
print(f"[phase0] architecture={architecture} max_steps={max_steps} (n_pos_built={n_pos})")

greedy = w.greedy_outer_loop(
    samples,
    top40,
    panels,
    architecture=architecture,
    delta_step=w.DELTA_STEP,
    max_steps=max_steps,
    seed=SEED,
    checkpoint_path=None,
    config_signature=None,
    lock_floor=None,
    n_jobs=1,
)
print(f"[phase0] greedy done: selected={greedy['selected_indicators']} "
      f"chosen_window={greedy['chosen_window']} final_global_auc={greedy['final_global_auc']:.4f} "
      f"early_abort={greedy['early_abort_floor_unreachable']}")

selected = greedy["selected_indicators"]
out: dict = {
    "recipe_id": RECIPE_ID,
    "seed": SEED,
    "architecture": architecture,
    "n_pos_raw_positives_csv": int((pos["label"] == 1).sum()),
    "n_pos_samples_built": n_pos,
    "n_neg_samples_built": n_neg,
    "candidate_pool_size": len(all_candidates),
    "top40_after_univariate_screen": top40,
    "max_steps": max_steps,
    "delta_step": w.DELTA_STEP,
    "greedy_selected_indicators": selected,
    "greedy_chosen_window": greedy["chosen_window"],
    "greedy_final_global_auc_reported_by_walk": greedy["final_global_auc"],
    "greedy_history": greedy["history"],
    "greedy_early_abort_floor_unreachable": greedy["early_abort_floor_unreachable"],
}

if selected:
    # Re-derive the final fit via stability_select._final_fit (window ARGMAX over
    # WINDOW_GRID on the selected set, same machinery as the run-2 recompute + run-3.1
    # baseline) so this number is directly comparable to the run-2-recomputed-on-242 and
    # the 3-driver clean-subset numbers already produced this cycle. NOTE: this argmaxes
    # the window on the FINAL selected set (discovery-grade per PRE-REGISTRATION.md §5),
    # which may differ from greedy's own per-step-locked chosen_window above -- both are
    # reported.
    fit = ss._final_fit(selected, samples, panels, SEED)
    selected_panels = {ind: panels[ind] for ind in selected}
    cov_at_greedy_window = w.coverage_report(samples, selected, greedy["chosen_window"], selected_panels)
    cov_at_final_fit_window = w.coverage_report(samples, selected, fit["chosen_window"], selected_panels)
    out["final_fit_argmax_window"] = fit["chosen_window"]
    out["final_fit_loco_auc"] = fit["loco_auc"]
    out["final_fit_ci95_lo"] = fit["ci95_lo"]
    out["final_fit_ci95_hi"] = fit["ci95_hi"]
    out["coverage_at_greedy_chosen_window"] = cov_at_greedy_window
    out["coverage_gate_ok_at_greedy_chosen_window"] = w.coverage_gate_ok(cov_at_greedy_window)
    out["coverage_at_final_fit_argmax_window"] = cov_at_final_fit_window
    out["coverage_gate_ok_at_final_fit_argmax_window"] = w.coverage_gate_ok(cov_at_final_fit_window)
else:
    out["final_fit_argmax_window"] = None
    out["final_fit_loco_auc"] = float("nan")
    out["note_empty_selection"] = (
        "greedy selected ZERO indicators -- either no candidate cleared the coverage gate at "
        "any window jointly with an empty selected-so-far set, or the very first step's best "
        "lift fell below delta_step. This would mean Phase 0's coverage-gated re-screen found "
        "NO valid single starting driver, let alone a joint set -- treat as the §2 stop-rule "
        "(cycle BLOCKED, escalate to founder) unless the history below shows a coverage-only "
        "cause that a wider pool/threshold could plausibly fix."
    )

out_path = HERE / "results_phase0_coverage_gated_rescreen.json"
out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
print(f"[phase0] wrote {out_path}")
