"""Phase 0 fast path: final LOCO-AUC fit for the coverage-VALID 3-driver AND-set
(v2xel_frefair, MS.MIL.XPND.GD.ZS, SL.UEM.1524.ZS) already established by
results_clean3_joint_coverage.json (coverage_gate_ok=True only at window=10,
65.29% pos / 61.16% neg / 158 of 242 positives / 69 of 71 countries).

Mirrors _recompute_terrorist_attack_baseline.py's machinery exactly (stability_select._final_fit
-> run_f_ml_1_poc.build_X_y/fit_predict_loco, XGBoost, seed=12345), just on this 3-driver set
instead of run-2's 6-driver set. Cheap (3 panels, not 248) -- fast path while the full
coverage-gated greedy re-screen (_phase0_coverage_gated_rescreen.py) runs separately over the
full pool.

THROWAWAY / one-off diagnostic (qgi-ml CLAUDE.md test-first rule).
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
DRIVERS = ["v2xel_frefair", "MS.MIL.XPND.GD.ZS", "SL.UEM.1524.ZS"]
PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"

pos = ss._load_positives(POSITIVES_CSV)
print(f"[clean3] loaded positives: n_rows={len(pos)} n_countries={pos['country'].nunique()}")

samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
n_pos = int((samples["label"] == 1).sum())
n_neg = int((samples["label"] == 0).sum())
print(f"[clean3] samples built: n_pos={n_pos} n_neg={n_neg}")

panels = {ind: w.load_panel(ind, PANEL_DIR) for ind in DRIVERS}

fit = ss._final_fit(DRIVERS, samples, panels, SEED)
print(f"[clean3] argmax final_fit: window={fit['chosen_window']} loco_auc={fit['loco_auc']:.4f} "
      f"ci=[{fit['ci95_lo']:.4f},{fit['ci95_hi']:.4f}]")

cov_argmax = w.coverage_report(samples, DRIVERS, fit["chosen_window"], panels)
gate_argmax = w.coverage_gate_ok(cov_argmax)
print(f"[clean3] coverage @argmax window={fit['chosen_window']}: {cov_argmax} gate_ok={gate_argmax}")

# Also report the LOCKED window=10 fit (the ONLY window where the joint AND-set clears
# coverage_gate_ok per results_clean3_joint_coverage.json / PRE-REGISTRATION.md §2 item 3 --
# "window LOCKED, not argmaxed, for the deliverable").
X10, y10, c10, yr10 = w.build_X_y(samples, DRIVERS, 10, panels)
res10 = w.fit_predict_loco(X10, y10, c10, yr10, architecture="XGBoost", seed=SEED)
ci10 = w.bca_bootstrap_auc_ci(res10["probs"], res10["labels"], B=2000, seed=SEED)
cov10 = w.coverage_report(samples, DRIVERS, 10, panels)
gate10 = w.coverage_gate_ok(cov10)
print(f"[clean3] LOCKED window=10: loco_auc={res10['global_auc']:.4f} "
      f"ci=[{ci10['ci95_lo']:.4f},{ci10['ci95_hi']:.4f}] coverage={cov10} gate_ok={gate10}")

out = {
    "recipe_id": RECIPE_ID,
    "seed": SEED,
    "drivers": DRIVERS,
    "n_pos_samples_built": n_pos,
    "n_neg_samples_built": n_neg,
    "architecture": "XGBoost",
    "argmax_window": {
        "chosen_window": fit["chosen_window"],
        "loco_auc": fit["loco_auc"],
        "ci95_lo": fit["ci95_lo"],
        "ci95_hi": fit["ci95_hi"],
        "coverage": cov_argmax,
        "coverage_gate_ok": gate_argmax,
    },
    "locked_window_10": {
        "loco_auc": float(res10["global_auc"]),
        "ci95_lo": float(ci10["ci95_lo"]),
        "ci95_hi": float(ci10["ci95_hi"]),
        "coverage": cov10,
        "coverage_gate_ok": gate10,
    },
    "note": "window=10 is the ONLY WINDOW_GRID cell where this 3-driver set clears "
            "coverage_gate_ok per results_clean3_joint_coverage.json -- PRE-REGISTRATION.md "
            "§2 item 3 requires the LOCKED window (10), not an argmax, for the Phase 0 "
            "deliverable number. Reporting both for transparency; locked_window_10 is the "
            "number of record if this set is adopted as Phase 0's baseline.",
}
out_path = HERE / "results_phase0_clean3_final_fit.json"
out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
print(f"[clean3] wrote {out_path}")
