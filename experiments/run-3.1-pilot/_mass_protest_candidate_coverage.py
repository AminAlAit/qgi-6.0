"""One-shot: coverage-at-positive-cells screen (crit. §2) for mass_protest
candidate indicators, at window=5 (run-2's chosen window) AND window=10 (a
common default), t-1/t-2 style via build_X_y's existing window join. THROWAWAY
diagnostic (qgi-ml CLAUDE.md test-first rule).
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
RECIPE_ID = "mass_protest"
PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"

CANDIDATES = [
    # grievance / economic hardship
    "FP.CPI.TOTL.ZG", "SL.UEM.TOTL.ZS", "SL.UEM.1524.ZS", "SI.POV.GINI",
    "AG.PRD.FOOD.XD", "NY.GDP.MKTP.KD.ZG",
    # youth bulge / urbanization
    "SP.POP.0014.TO.ZS", "OWID_POP_YOUNG", "OWID_SLUM_SHARE",
    # repression & regime type (V-Dem) -- hindsight-caution class
    "v2csreprss", "OWID_AUTOCRATIZATION", "v2x_regime", "v2smarrest", "v2elpeace",
    "v2x_libdem", "v2x_polyarchy",
    # near-tautology check
    "UCDP_GED_UNREST_EVENTS",
]

pos = ss._load_positives(POSITIVES_CSV)
samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
n_pos = int((samples["label"] == 1).sum())
print(f"[coverage] samples: n_pos={n_pos} n_neg={int((samples['label']==0).sum())}")

results = {}
for ind in CANDIDATES:
    try:
        panel = w.load_panel(ind, PANEL_DIR)
    except Exception as e:  # noqa: BLE001
        results[ind] = {"error": f"load_panel failed: {e}"}
        continue
    row = {}
    for win in (5, 10):
        panels = {ind: panel}
        cov = w.coverage_report(samples, [ind], win, panels)
        row[f"w{win}"] = {
            "pos_coverage": round(cov["pos_coverage"], 4),
            "neg_coverage": round(cov["neg_coverage"], 4),
            "n_pos_survive": cov["n_pos_survive"],
            "n_countries_survive": cov["n_countries_survive"],
        }
    results[ind] = row
    print(ind, json.dumps(row))

out_path = HERE / "results" / "mass_protest.candidate_coverage.json"
out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
print(f"[coverage] wrote {out_path}")
