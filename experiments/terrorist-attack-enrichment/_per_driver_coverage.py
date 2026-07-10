"""One-shot: per-driver coverage-at-positive-cells + year-depth diagnostic for
terrorist_attack's run-2 6-driver recipe, on the CURRENT 242-event/71-country
positives.csv (Step-0 PASSED per PRE-REGISTRATION.md).

For each of the 6 run-2 drivers individually (not the joint AND-set):
  - year-depth (min/max year present in the parquet panel, n_countries_nonnull)
  - single-driver coverage_report (pos_coverage / neg_coverage / n_countries_survive)
    at every window in WINDOW_GRID, using the SAME build_samples/build_X_y/
    coverage_report machinery as the joint recompute
    (experiments/run-3.1-pilot/_recompute_terrorist_attack_baseline.py) and the
    same seed=12345.

Purpose: isolate which of the 6 drivers is dragging joint AND-coverage down
(structural depth-mismatch) vs which are individually fine but casualties of the
AND-across-mismatched-depths problem. Root-cause read already flagged in
PRE-REGISTRATION.md #0: VC.IDP.NWDS has only 16 years of depth (2008-2024),
violating indicator-criteria.md crit-2 (>=20 continuous years overlapping the
1958-2021 event span).

THROWAWAY / one-off diagnostic (qgi-ml CLAUDE.md test-first rule: tagged as
throwaway, not committed as a script under test). Reuses run_f_ml_1_poc +
stability_select unmodified, same as the run-3.1-pilot recompute scripts.
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
EVENT_SPAN = (1958, 2021)  # from PRE-REGISTRATION.md Step-0 audit
DEPTH_FLOOR_YEARS = 20  # indicator-criteria.md crit-2

pos = ss._load_positives(POSITIVES_CSV)
print(f"[per-driver] loaded positives: n_rows={len(pos)} n_countries={pos['country'].nunique()}")

samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
n_pos = int((samples["label"] == 1).sum())
n_neg = int((samples["label"] == 0).sum())
print(f"[per-driver] samples built: n_pos={n_pos} n_neg={n_neg}")

results = []
for ind in RUN2_DRIVERS:
    panel = w.load_panel(ind, PANEL_DIR)
    yr_min = int(panel["year"].min())
    yr_max = int(panel["year"].max())
    depth_years = yr_max - yr_min + 1
    # overlap with the event span, continuous-years proxy (min/max span, not gap-checked)
    overlap_lo = max(yr_min, EVENT_SPAN[0])
    overlap_hi = min(yr_max, EVENT_SPAN[1])
    overlap_years = max(0, overlap_hi - overlap_lo + 1)
    n_countries_nonnull = int(panel.dropna(subset=["value"])["country"].nunique())

    panels_single = {ind: panel}
    window_covs = {}
    best_window = None
    best_pos_cov = -1.0
    for window in w.WINDOW_GRID:
        cov = w.coverage_report(samples, [ind], window, panels_single)
        gate_ok = w.coverage_gate_ok(cov)
        window_covs[str(window)] = {
            "pos_coverage": round(cov["pos_coverage"], 4),
            "neg_coverage": round(cov["neg_coverage"], 4),
            "n_pos_survive": cov["n_pos_survive"],
            "n_countries_survive": cov["n_countries_survive"],
            "coverage_gate_ok_standalone": gate_ok,
        }
        if cov["pos_coverage"] > best_pos_cov:
            best_pos_cov = cov["pos_coverage"]
            best_window = window

    depth_floor_pass = depth_years >= DEPTH_FLOOR_YEARS and overlap_years >= DEPTH_FLOOR_YEARS

    results.append({
        "indicator": ind,
        "panel_year_min": yr_min,
        "panel_year_max": yr_max,
        "panel_depth_years": depth_years,
        "overlap_years_vs_event_span_1958_2021": overlap_years,
        "depth_floor_20yr_pass": depth_floor_pass,
        "n_countries_nonnull_in_panel": n_countries_nonnull,
        "best_standalone_pos_coverage": round(best_pos_cov, 4),
        "best_window_for_standalone_pos_coverage": best_window,
        "window_grid_coverage": window_covs,
    })
    print(f"[per-driver] {ind}: depth={yr_min}-{yr_max} ({depth_years}y, overlap={overlap_years}y, "
          f"floor_pass={depth_floor_pass}) best_standalone_pos_cov={best_pos_cov:.4f} @w{best_window} "
          f"n_countries_nonnull={n_countries_nonnull}")

out = {
    "recipe_id": RECIPE_ID,
    "drivers": RUN2_DRIVERS,
    "seed": SEED,
    "n_pos_samples_built": n_pos,
    "n_neg_samples_built": n_neg,
    "event_span": EVENT_SPAN,
    "depth_floor_years": DEPTH_FLOOR_YEARS,
    "note": "coverage_report/coverage_gate_ok run per-driver STANDALONE (single-indicator "
            "candidate set), not the joint 6-driver AND-set. Standalone pass does not imply "
            "the driver survives the AND across all 6 depths jointly.",
    "per_driver": results,
}

out_path = HERE / "results_per_driver_coverage.json"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
print(f"[per-driver] wrote {out_path}")
