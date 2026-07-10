"""military_coup / OWID_AUTOCRATIZATION backdating confound check -- Docker-only
orchestration (imports `run_f_ml_1_poc` / `stability_select` / `score_pilot`, which need
joblib/xgboost/sklearn/scipy -- not available on host). See `panel_transforms.py`'s module
docstring for the full confound writeup and the leakage argument per variant; this script
only orchestrates already-tested primitives:
  - `run_f_ml_1_poc.build_samples` / `build_X_y` / `fit_predict_loco` / `load_panel`
    (imported, never reimplemented).
  - `stability_select._final_fit` for the WINDOW_GRID argmax + LOCO OOF (identical pattern
    to `run_candidate_battery.py`'s D1 baseline / recipe fits).
  - `score_pilot.pair_oof` / `paired_bootstrap_delta_auc` for the paired country-cluster
    bootstrap delta vs the SAME row-aligned baseline used everywhere else in this cycle.
  - `panel_transforms.py` (THIS experiment's own pure, host-tested transforms -- see
    `test_panel_transforms.py`, 21/21 passing on host before this script ever touches
    Docker).

Three variant families, one shared baseline fit (RUN2_DRIVERS alone, fresh WINDOW_GRID
argmax -- expected to reproduce the pre-registered 0.652 anchor within tolerance, same as
`run_candidate_battery.py`'s D1):

  (a) lag-further -- `OWID_AUTOCRATIZATION` shifted forward 0/1/2/3/4 years (== reading the
      flag at t-1/t-2/t-3/t-4/t-5). If the +0.0589 lift is genuine multi-year leading
      signal, it should persist (even if it decays somewhat) as the lag grows; if it is
      coup-coincident retrospective coding, it should collapse toward the baseline once the
      window no longer includes the 1-2 years immediately preceding the coup.
  (b) leakage-safe real-time reconstruction -- a one-sided decline signal in
      v2x_polyarchy / v2x_libdem / v2x_regime, built ONLY from data <= t
      (`build_cum_drop_panel` / `build_zscore_decline_panel`), replacing
      OWID_AUTOCRATIZATION entirely. If THIS recovers a comparable lift, the signal is real
      and constructible without ERT's retrospective-confirmation step. If it does not, the
      ERT flag's advantage over its own real-time-safe reconstruction is itself evidence of
      hindsight content.
  (c) strict episode -- `OWID_AUTOCRATIZATION` zeroed unless the episode had already been
      running >= 2 or 3 years by the row's year (`build_strict_episode_panel`). If the lift
      survives on ONLY the "already well-established by t-1" episodes, the coup-coincident
      explanation is weakened (those episodes' t-1 status did not depend on the coup year to
      be confirmed as ongoing).

Usage:
    MSYS_NO_PATHCONV=1 docker run --rm \\
      -v <repo>/qgi-ml:/work/qgi-ml -v <repo>/qgi-data:/work/qgi-data \\
      -w /work/qgi-ml qgi-run31-pilot:py313 \\
      python experiments/military-coup-enrichment/confound_check/run_confound_variants.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
EXP_DIR = HERE.parent
QGI_ML_ROOT = EXP_DIR.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
for _p in (HERE, SCRIPTS_DIR, PILOT_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import panel_transforms as pt  # noqa: E402

SEED = 12345
RECIPE_ID = "military_coup"
RUN2_DRIVERS = ["SP.DYN.LE00.IN", "v2excrptps", "v2cltort", "v2xel_frefair", "v2x_clpol"]
CANDIDATE_ID = "OWID_AUTOCRATIZATION"
REALTIME_BASE_INDICATORS = ["v2x_polyarchy", "v2x_libdem", "v2x_regime"]
# label -> shift_years fed to shift_panel_forward. shift=0 reproduces the winning recipe's
# own t-1 read (sanity cross-check against FINAL-VERDICT.json's 0.7105); shift=1..4 push the
# read to t-2..t-5.
LAG_SHIFTS: dict[str, int] = {"t-1_baseline": 0, "t-2": 1, "t-3": 2, "t-4": 3, "t-5": 4}
STRICT_MARGINS = [2, 3]
B_EVAL = 1000

DEFAULT_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
DEFAULT_POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"


def _canonical_samples(w: Any, positives_csv: Path) -> Any:
    import pandas as pd
    pos = pd.read_csv(positives_csv)
    pos["country"] = pos["country_id"].apply(w.normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    pos["label"] = 1
    return w.build_samples(pos, negatives_per_positive=3, seed=SEED)


def _fit_summary(fit: dict[str, Any]) -> dict[str, Any]:
    return {
        "loco_auc": fit["loco_auc"], "ci95_lo": fit["ci95_lo"], "ci95_hi": fit["ci95_hi"],
        "chosen_window": fit["chosen_window"], "n_oof_rows": len(fit["oof"]),
    }


def _delta_vs_baseline(sp: Any, variant_oof: list[dict], baseline_oof: list[dict]) -> dict[str, Any]:
    if not variant_oof or not baseline_oof:
        return {"ci95_lo": None, "ci95_hi": None, "point": float("nan"), "p_value": None}
    pi = sp.pair_oof(variant_oof, baseline_oof)
    return sp.paired_bootstrap_delta_auc(
        pi["probs_a"], pi["probs_b"], pi["labels"], countries=pi["countries"],
        b_eval=B_EVAL, seed=SEED,
    )


def run(
    panel_dir: Path = DEFAULT_PANEL_DIR,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    out_path: Path | None = None,
) -> dict[str, Any]:
    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)
    import stability_select as ss  # noqa: E402
    import score_pilot as sp  # noqa: E402

    samples = _canonical_samples(w, positives_csv)
    run2_panels = {ind: w.load_panel(ind, panel_dir) for ind in RUN2_DRIVERS}
    owid_panel_raw = w.load_panel(CANDIDATE_ID, panel_dir)
    recipe = RUN2_DRIVERS + [CANDIDATE_ID]

    print("[run_confound_variants] fitting shared baseline (RUN2_DRIVERS alone)...")
    baseline_fit = ss._final_fit(RUN2_DRIVERS, samples, run2_panels, SEED)
    print(f"[run_confound_variants] baseline loco_auc={baseline_fit['loco_auc']:.4f} "
          f"(pre-registered anchor: 0.652)")

    def _fit_variant(candidate_panel: Any) -> dict[str, Any]:
        panels = dict(run2_panels)
        panels[CANDIDATE_ID] = candidate_panel
        fit = ss._final_fit(recipe, samples, panels, SEED)
        delta = _delta_vs_baseline(sp, fit["oof"], baseline_fit["oof"])
        return {**_fit_summary(fit), "delta_vs_baseline": delta}

    def _fit_variant_named(derived_id: str, derived_panel: Any) -> dict[str, Any]:
        panels = dict(run2_panels)
        panels[derived_id] = derived_panel
        this_recipe = RUN2_DRIVERS + [derived_id]
        fit = ss._final_fit(this_recipe, samples, panels, SEED)
        delta = _delta_vs_baseline(sp, fit["oof"], baseline_fit["oof"])
        return {**_fit_summary(fit), "delta_vs_baseline": delta}

    # --- (a) lag-further variants ---------------------------------------------------------
    lag_results: dict[str, Any] = {}
    for label, shift in LAG_SHIFTS.items():
        shifted_panel = pt.shift_panel_forward(owid_panel_raw, shift)
        result = _fit_variant(shifted_panel)
        result["shift_years"] = shift
        lag_results[label] = result
        d = result["delta_vs_baseline"]
        print(f"[lag] {label} (shift={shift}): auc={result['loco_auc']!r} "
              f"dAUC={d['point']!r} CI95=[{d['ci95_lo']!r},{d['ci95_hi']!r}] p={d.get('p_value')!r}")

    # --- (b) leakage-safe real-time reconstruction -----------------------------------------
    realtime_results: dict[str, Any] = {}
    for base_id in REALTIME_BASE_INDICATORS:
        base_panel = w.load_panel(base_id, panel_dir)
        variants = [
            ("cum_drop_5yr", pt.build_cum_drop_panel(base_panel, window=5)),
            ("zscore_decline_10yr", pt.build_zscore_decline_panel(base_panel, roll_window=10, min_periods=5)),
        ]
        for mode, derived_panel in variants:
            key = f"{base_id}__{mode}"
            derived_id = f"REALTIME_{key}"
            result = _fit_variant_named(derived_id, derived_panel)
            result["base_indicator"] = base_id
            result["mode"] = mode
            result["n_derived_panel_rows"] = int(len(derived_panel))
            realtime_results[key] = result
            d = result["delta_vs_baseline"]
            print(f"[realtime] {key}: auc={result['loco_auc']!r} dAUC={d['point']!r} "
                  f"CI95=[{d['ci95_lo']!r},{d['ci95_hi']!r}] p={d.get('p_value')!r}")

    # --- (c) strict episode (>= margin years established by t-1) ---------------------------
    strict_results: dict[str, Any] = {}
    for margin in STRICT_MARGINS:
        strict_panel = pt.build_strict_episode_panel(owid_panel_raw, margin_years=margin)
        result = _fit_variant(strict_panel)
        result["margin_years"] = margin
        result["n_ones_survived"] = int((strict_panel["value"] >= 0.5).sum())
        result["n_ones_raw"] = int((owid_panel_raw.dropna(subset=["value"])["value"] >= 0.5).sum())
        strict_results[f"margin_{margin}"] = result
        d = result["delta_vs_baseline"]
        print(f"[strict] margin={margin}: auc={result['loco_auc']!r} dAUC={d['point']!r} "
              f"CI95=[{d['ci95_lo']!r},{d['ci95_hi']!r}] p={d.get('p_value')!r} "
              f"ones_survived={result['n_ones_survived']}/{result['n_ones_raw']}")

    report: dict[str, Any] = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "run2_drivers": RUN2_DRIVERS,
        "candidate_id": CANDIDATE_ID,
        "b_eval": B_EVAL,
        "baseline": {**_fit_summary(baseline_fit), "pre_registered_anchor": 0.652},
        "winning_recipe_reference": {
            "auc": 0.710519467846339, "delta_ci95_lo": 0.019164235156879827,
            "source": "results/FINAL-VERDICT.json (OWID_AUTOCRATIZATION, all 7 gates passed)",
        },
        "variants": {
            "a_lag_further": lag_results,
            "b_realtime_reconstruction": realtime_results,
            "c_strict_episode": strict_results,
        },
    }

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[run_confound_variants] wrote {out_path}")
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=DEFAULT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "confound_check_report.json")
    args = ap.parse_args(argv)
    run(args.panel_dir, args.positives_csv, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
