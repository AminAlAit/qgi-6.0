"""One-shot: recompute terrorist_attack's run-2 6-driver baseline LOCO-AUC on the
CURRENT positives.csv (242 events / 71 countries, Step-0 PASSED), using the same
machinery as the banking/military_coup honesty passes (stability_select._final_fit ->
run_f_ml_1_poc's build_X_y/fit_predict_loco, XGBoost, seed=12345).

run-2 drivers sourced from qgi-data/reference/shap-importances-terrorist_attack.json
(selected_indicators, computed_at_utc 2026-05-23, F-ML-1 walk).

THROWAWAY / one-off diagnostic (qgi-ml CLAUDE.md test-first rule: tag as throwaway,
not committed as a script under test).
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
print(f"[recompute] loaded positives: n_rows={len(pos)} n_countries={pos['country'].nunique()}")

samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
n_pos = int((samples["label"] == 1).sum())
n_neg = int((samples["label"] == 0).sum())
print(f"[recompute] samples built: n_pos={n_pos} n_neg={n_neg}")

panels = {ind: w.load_panel(ind, PANEL_DIR) for ind in RUN2_DRIVERS}

fit = ss._final_fit(RUN2_DRIVERS, samples, panels, SEED)

cov = w.coverage_report(samples, RUN2_DRIVERS, fit["chosen_window"], panels)

out = {
    "recipe_id": RECIPE_ID,
    "drivers": RUN2_DRIVERS,
    "seed": SEED,
    "n_pos_raw_positives_csv": int((pos["label"] == 1).sum()),
    "n_pos_samples_built": n_pos,
    "n_neg_samples_built": n_neg,
    "chosen_window": fit["chosen_window"],
    "loco_auc": fit["loco_auc"],
    "ci95_lo": fit["ci95_lo"],
    "ci95_hi": fit["ci95_hi"],
    "coverage_at_chosen_window": cov,
    "architecture": "XGBoost" if n_pos >= 60 else "LR",
    "stored_run2_reference": "qgi-data/reference/shap-importances-terrorist_attack.json (no loco_auc stored there, only SHAP importances/directions from the F-ML-1 walk)",
}
print(json.dumps(out, indent=2, default=str))

out_path = HERE / "results" / "terrorist_attack.run2_recomputed_on_242.json"
out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
print(f"[recompute] wrote {out_path}")
