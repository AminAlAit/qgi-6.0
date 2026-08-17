"""Diagnostic: terrorist_attack run-2 6-driver LOCO-AUC per WINDOW_GRID cell, WITH the
coverage_gate_ok gate applied (as production run_f_ml_1_poc does), to check whether the
naive argmax (_final_fit, no coverage gate) picked a coverage-truncated / skew-inflated
window. THROWAWAY.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
for _p in (SCRIPTS_DIR, HERE):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import run_f_ml_1_poc as w  # noqa: E402
import stability_select as ss  # noqa: E402

SEED = 12345
RECIPE_ID = "terrorist_attack"
RUN2_DRIVERS = [
    "VC.BTL.DETH",
    "VC.IDP.NWDS",
    "DT.TDS.DECT.EX.ZS",
    "MS.MIL.XPND.GD.ZS",
    "v2xel_frefair",
    "SL.UEM.1524.ZS",
]
PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"

pos = ss._load_positives(POSITIVES_CSV)
samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
panels = {ind: w.load_panel(ind, PANEL_DIR) for ind in RUN2_DRIVERS}

rows = []
for win in w.WINDOW_GRID:
    X, y, c, yr = w.build_X_y(samples, RUN2_DRIVERS, win, panels)
    cov = w.coverage_report(samples, RUN2_DRIVERS, win, panels)
    gate = w.coverage_gate_ok(cov)
    entry = {"window": win, "coverage_pass": bool(gate), **cov}
    if len(X) >= 30 and len(set(y.tolist())) > 1:
        res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
        entry["global_auc"] = float(res["global_auc"])
    else:
        entry["global_auc"] = None
    rows.append(entry)
    print(json.dumps(entry))

out_path = HERE / "results" / "terrorist_attack.window_scan.json"
out_path.write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")
print(f"[scan] wrote {out_path}")

gated = [r for r in rows if r["coverage_pass"] and r["global_auc"] is not None]
if gated:
    best = max(gated, key=lambda r: r["global_auc"])
    print("\n[HONEST coverage-gated argmax]")
    print(json.dumps(best, indent=2))
else:
    print("\n[HONEST coverage-gated argmax] NONE — no window clears coverage_gate_ok for this driver set.")
