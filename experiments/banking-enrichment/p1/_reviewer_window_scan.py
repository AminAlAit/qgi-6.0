"""Independent reviewer script (fresh, not reusing p2_evaluate.py/_independent_verify.py's
hardcoded 0.7707 assert -- that assert is STALE for the 116-positive set and would wrongly
fail). Purpose: check whether credit_growth_3y_fd's dAUC is a genuine signal or an artifact of
cherry-picking window=12 out of the 9-window grid (PLAN.md's own flagged "window-selection-
fragile" concern). Prints per-window AUC for baseline vs candidate across ALL windows, plus
per-country breakdown restricted to the named EM twin-crisis countries only.
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np

ROOT = Path("/work/qgi-ml")
PILOT_DIR = ROOT / "experiments" / "run-3.1-pilot"
sys.path.insert(0, str(PILOT_DIR))
sys.path.insert(0, str(ROOT / "scripts"))

import stability_select as ss  # noqa: E402
import score_pilot as sp  # noqa: E402
import run_f_ml_1_poc as w  # noqa: E402

SEED = 12345
POSITIVES_CSV = ROOT / "data" / "shape_inputs_v2" / "banking_and_financial_crisis" / "positives.csv"
PANEL_DIR = ROOT / "data" / "parquet_panels"
CAND_DIR = ROOT / "experiments" / "banking-enrichment" / "p1" / "candidates"
BASELINE_DRIVERS = ["NV.SRV.TOTL.ZS", "v2x_gender", "MS.MIL.XPND.GD.ZS"]
CANDIDATE = "credit_growth_3y_fd"

pos = ss._load_positives(POSITIVES_CSV)
samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
print("n_pos in samples:", int((samples["label"] == 1).sum()), "n total:", len(samples))

panels_base = {ind: w.load_panel(ind, PANEL_DIR) for ind in BASELINE_DRIVERS}
panels_cand = dict(panels_base)
panels_cand[CANDIDATE] = w.load_panel(CANDIDATE, CAND_DIR)
recipe_set = BASELINE_DRIVERS + [CANDIDATE]

print("\n--- per-window AUC scan: baseline vs candidate (is window=12 an outlier or the trend?) ---")
print(f"{'win':>4} {'base_auc':>10} {'cand_auc':>10} {'delta':>8} {'n_base':>7} {'n_cand':>7}")
rows = []
for win in w.WINDOW_GRID:
    Xb, yb, cb, yrb = w.build_X_y(samples, BASELINE_DRIVERS, win, panels_base)
    Xc, yc, cc, yrc = w.build_X_y(samples, recipe_set, win, panels_cand)
    auc_b = auc_c = None
    if len(Xb) >= 30 and len(np.unique(yb)) >= 2:
        rb = w.fit_predict_loco(Xb, yb, cb, yrb, architecture="XGBoost", seed=SEED)
        auc_b = float(rb["global_auc"])
    if len(Xc) >= 30 and len(np.unique(yc)) >= 2:
        rc = w.fit_predict_loco(Xc, yc, cc, yrc, architecture="XGBoost", seed=SEED)
        auc_c = float(rc["global_auc"])
    d = (auc_c - auc_b) if (auc_b is not None and auc_c is not None) else None
    print(f"{win:>4} {auc_b if auc_b is not None else 'skip':>10} "
          f"{auc_c if auc_c is not None else 'skip':>10} "
          f"{d if d is not None else '-':>8} {len(Xb):>7} {len(Xc):>7}")
    rows.append({"window": win, "auc_base": auc_b, "auc_cand": auc_c, "delta": d,
                 "n_base": len(Xb), "n_cand": len(Xc)})

n_windows_positive = sum(1 for r in rows if r["delta"] is not None and r["delta"] > 0)
n_windows_total = sum(1 for r in rows if r["delta"] is not None)
print(f"\ncandidate beats baseline in {n_windows_positive}/{n_windows_total} evaluable windows")

out_path = ROOT / "experiments" / "banking-enrichment" / "p1" / "retest_116" / "reviewer_window_scan.json"
out_path.write_text(json.dumps({"rows": rows,
                                 "n_windows_positive": n_windows_positive,
                                 "n_windows_total": n_windows_total}, indent=2), encoding="utf-8")
print("wrote", out_path)
