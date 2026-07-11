"""Independent verification script (NOT part of the pre-registered pipeline).

Recomputes ONLY the D1 baseline (run-2's 3 drivers, XGBoost, WINDOW_GRID argmax) for
whatever positives_csv path is passed, using the exact same production primitives
(run_f_ml_1_poc.build_samples/build_X_y/fit_predict_loco via stability_select._final_fit)
the pre-registered battery uses. Used to check sensitivity of the reported 0.611 baseline
to the 334-row (locked commit 7cdfb5f) vs 336-row (current working tree) positives.csv.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
WIDENET_DIR = QGI_ML_ROOT / "experiments" / "banking-enrichment" / "widenet"
EM_TEST_DIR = QGI_ML_ROOT / "experiments" / "banking-enrichment" / "em_test"
for _p in (HERE, SCRIPTS_DIR, PILOT_DIR, WIDENET_DIR, EM_TEST_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

SEED = 12345
RUN2_DRIVERS = ["SM.POP.RHCR.EO", "v2excrptps", "v2csprtcpt"]
MAIN_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"


def main(argv):
    import pandas as pd
    import run_f_ml_1_poc as w
    import stability_select as ss

    positives_csv = Path(argv[1])
    pos = pd.read_csv(positives_csv)
    pos["country"] = pos["country_id"].apply(w.normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    pos["label"] = 1
    samples = w.build_samples(pos, negatives_per_positive=3, seed=SEED)
    n_pos = int((samples["label"] == 1).sum())

    panels = {ind: w.load_panel(ind, MAIN_PANEL_DIR) for ind in RUN2_DRIVERS}
    baseline_fit = ss._final_fit(RUN2_DRIVERS, samples, panels, SEED)

    result = {
        "positives_csv": str(positives_csv),
        "n_pos_input_rows": int(len(pos)),
        "n_pos_built_samples": n_pos,
        "loco_auc": baseline_fit["loco_auc"],
        "ci95_lo": baseline_fit["ci95_lo"],
        "ci95_hi": baseline_fit["ci95_hi"],
        "chosen_window": baseline_fit["chosen_window"],
    }
    print(json.dumps(result, indent=2))
    out = HERE / "results" / f"verify_baseline_{positives_csv.stem}.json"
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
