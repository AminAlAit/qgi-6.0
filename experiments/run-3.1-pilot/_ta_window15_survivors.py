"""Diagnostic: which countries/years survive terrorist_attack run-2 driver set at window=15
(the argmax window picked by _final_fit, 8.7% pos coverage) — characterize the skew.
THROWAWAY."""
from __future__ import annotations

import sys
from collections import Counter
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
RUN2_DRIVERS = [
    "VC.BTL.DETH", "VC.IDP.NWDS", "DT.TDS.DECT.EX.ZS",
    "MS.MIL.XPND.GD.ZS", "v2xel_frefair", "SL.UEM.1524.ZS",
]
PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "terrorist_attack" / "positives.csv"

pos = ss._load_positives(POSITIVES_CSV)
samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
panels = {ind: w.load_panel(ind, PANEL_DIR) for ind in RUN2_DRIVERS}

X, y, c, yr = w.build_X_y(samples, RUN2_DRIVERS, 15, panels)
pos_mask = (y == 1)
countries = [str(c[i]) for i in range(len(y)) if pos_mask[i]]
years = [int(yr[i]) for i in range(len(y)) if pos_mask[i]]
print(f"n_pos_survive={sum(pos_mask)}")
print("Countries (with counts):", Counter(countries))
print("Year range:", min(years), "-", max(years))
print("Years:", sorted(years))

all_pos_countries = set(pos["country"].tolist())
survive_countries = set(countries)
print("\nAll positive-set countries:", len(all_pos_countries))
print("Survive countries:", len(survive_countries))
print("MISSING from survivors (sample of 30):", sorted(all_pos_countries - survive_countries)[:30])
