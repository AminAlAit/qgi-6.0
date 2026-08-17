"""One-shot: recompute economic_recession's run-2 2-driver baseline LOCO-AUC on the
CURRENT positives.csv (250 events / 106 countries, post US/France/Italy/Canada
events top-up), using the same machinery as the banking/military_coup/terrorist_attack
honesty passes (stability_select._final_fit -> run_f_ml_1_poc's build_X_y/fit_predict_loco,
XGBoost, seed=12345).

run-2 drivers sourced from qgi-docs/internal/decisions/f-ml-1-econ-recession-DECISION.md
(F-ML-1 walk 2, 2026-05-22): XGBoost (pre-§4.2-MLP-trigger) selected v2csreprss +
v2x_freexp_altinf at window=25y, LOCO-AUC=0.6978 (BCa CI95=[0.6382,0.7509]), on the
OLD 102-event positives.csv. That XGBoost result is the honest "run-2"-equivalent
comparator (the binding MLP-swap result, 0.4917, was subsequently cross-recipe-falsified
per F-ML-N and is NOT the comparator here).

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
RECIPE_ID = "economic_recession"
RUN2_DRIVERS = ["v2csreprss", "v2x_freexp_altinf"]
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
    "stored_run2_loco_auc": 0.6978,
    "stored_run2_n_pos": 102,
    "stored_run2_source": "qgi-docs/internal/decisions/f-ml-1-econ-recession-DECISION.md (F-ML-1 walk 2, 2026-05-22, XGBoost pre-trigger result)",
}
print(json.dumps(out, indent=2, default=str))

out_path = HERE / "results" / "economic_recession.run2_recomputed_on_250.json"
out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
print(f"[recompute] wrote {out_path}")
