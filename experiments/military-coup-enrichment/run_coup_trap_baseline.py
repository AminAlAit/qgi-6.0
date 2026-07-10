"""Coup-trap-alone LOCO-AUC (D4 build step, military_coup enrichment cycle).

Docker-only orchestration (imports `run_f_ml_1_poc`, which needs joblib/xgboost/sklearn/
scipy -- not available on host; see `build_coup_trap.py`'s module docstring for the DI
split). Fits the coup-trap feature set (`prior_coup_count`, `years_since_last_coup`) ALONE
-- no run-2 drivers, no candidates -- through the IDENTICAL production pipeline every other
indicator uses (`build_samples` -> `build_X_y` -> `fit_predict_loco`, argmax over
`WINDOW_GRID`, XGBoost, seed=12345), on the canonical 207-event/74-country military_coup
sample. This is the "coup-trap-alone baseline" the pre-reg's D4 requires every candidate to
beat.

Run inside the pinned Docker image, AFTER `build_coup_trap.py` has written
`coup_trap_panel_dir/`:

    MSYS_NO_PATHCONV=1 docker run --rm \\
      -v <repo>/qgi-ml:/work/qgi-ml -v <repo>/qgi-data:/work/qgi-data \\
      -w /work/qgi-ml qgi-run31-pilot:py313 \\
      python experiments/military-coup-enrichment/run_coup_trap_baseline.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
for _p in (SCRIPTS_DIR,):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

SEED = 12345
RECIPE_ID = "military_coup"
COUP_TRAP_INDICATORS = ["prior_coup_count", "years_since_last_coup"]
DEFAULT_PANEL_DIR = HERE / "coup_trap_panel_dir"
DEFAULT_POSITIVES_CSV = (
    QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"
)


def run_coup_trap_alone(
    panel_dir: Path = DEFAULT_PANEL_DIR,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    out_path: Path | None = None,
) -> dict[str, Any]:
    import numpy as np
    import pandas as pd

    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)

    for ind in COUP_TRAP_INDICATORS:
        p = panel_dir / ind / f"{ind}.parquet"
        if not p.is_file():
            raise FileNotFoundError(
                f"{p} not found -- run build_coup_trap.py first to materialize the coup-trap "
                "panel"
            )

    pos_df = pd.read_csv(positives_csv)
    pos_df["country"] = pos_df["country_id"].apply(w.normalize_country_id)
    pos_df = pos_df.rename(columns={"event_year": "year"})
    pos_df["label"] = 1

    samples = w.build_samples(pos_df, negatives_per_positive=3, seed=SEED)
    n_pos_total = int((samples["label"] == 1).sum())
    n_neg_total = int((samples["label"] == 0).sum())

    panels = {ind: w.load_panel(ind, panel_dir) for ind in COUP_TRAP_INDICATORS}

    # Per-window fit + argmax (mirrors stability_select._final_fit's policy exactly: try
    # every WINDOW_GRID window, keep the max-global-AUC window, ties -> smallest window).
    per_window: dict[int, dict[str, Any]] = {}
    best: tuple[float, int, dict[str, Any], dict[str, Any]] | None = None
    for win in w.WINDOW_GRID:
        X, y, c, yr = w.build_X_y(samples, COUP_TRAP_INDICATORS, win, panels)
        cov = {
            "n_pos_total": n_pos_total, "n_neg_total": n_neg_total,
            "n_pos_survive": int((y == 1).sum()) if len(y) else 0,
            "n_neg_survive": int((y == 0).sum()) if len(y) else 0,
            "n_countries_survive": int(len(set(c.tolist()))) if len(c) else 0,
        }
        cov["pos_coverage"] = cov["n_pos_survive"] / n_pos_total if n_pos_total else 0.0
        cov["neg_coverage"] = cov["n_neg_survive"] / n_neg_total if n_neg_total else 0.0
        if len(X) < 30 or len(np.unique(y)) < 2:
            per_window[win] = {"skipped": True, "coverage": cov}
            continue
        res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
        auc = float(res["global_auc"])
        per_window[win] = {"skipped": False, "coverage": cov, "loco_auc": auc}
        if best is None or auc > best[0]:
            best = (auc, win, res, cov)

    if best is None:
        result: dict[str, Any] = {
            "seed": SEED, "recipe_id": RECIPE_ID, "indicators": COUP_TRAP_INDICATORS,
            "status": "NO_USABLE_WINDOW", "per_window": per_window,
        }
        if out_path is not None:
            out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print("[run_coup_trap_baseline] FAILED: no window produced >=30 rows / 2 classes")
        return result

    _auc, chosen_window, res, cov = best
    ci = w.bca_bootstrap_auc_ci(res["probs"], res["labels"], seed=SEED)
    fv_diag = w._build_stability_diagnostic(res["per_country_auc"])

    result = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "indicators": COUP_TRAP_INDICATORS,
        "architecture": "XGBoost",
        "n_pos_total": n_pos_total,
        "n_neg_total": n_neg_total,
        "chosen_window": chosen_window,
        "coverage_at_chosen_window": cov,
        "loco_auc": float(res["global_auc"]),
        "ci95_lo": float(ci["ci95_lo"]),
        "ci95_hi": float(ci["ci95_hi"]),
        "ci80_lo": float(ci["ci80_lo"]),
        "ci80_hi": float(ci["ci80_hi"]),
        "fold_stability": {
            "label": fv_diag["label"],
            "fold_variance": fv_diag["fold_variance"],
            "fold_auc_mean": fv_diag["fold_auc_mean"],
        },
        "per_window_auc": {
            str(win): v.get("loco_auc") for win, v in per_window.items() if not v.get("skipped")
        },
        "oof": [
            {"country": str(res["countries"][k]), "year": int(res["years"][k]),
             "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
            for k in range(len(res["probs"]))
        ],
    }

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[run_coup_trap_baseline] wrote {out_path}")
    print(
        f"[run_coup_trap_baseline] coup-trap-alone LOCO-AUC={result['loco_auc']:.4f} "
        f"CI95=[{result['ci95_lo']:.4f},{result['ci95_hi']:.4f}] "
        f"window={chosen_window} pos_coverage={cov['pos_coverage']:.3f} "
        f"n_pos_survive={cov['n_pos_survive']}/{n_pos_total} "
        f"stability={fv_diag['label']}"
    )
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=DEFAULT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "coup_trap_alone_report.json")
    args = ap.parse_args(argv)
    run_coup_trap_alone(args.panel_dir, args.positives_csv, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
