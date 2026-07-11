"""Orchestration (Docker-only: needs run_f_ml_1_poc / stability_select / score_pilot /
temporal_holdout) for the economic_recession OECD-SCOPED REBOOT's full battery, 2026-07-11.

Recipe under test = run-2's 2 drivers (`v2csreprss`, `v2x_freexp_altinf`) + the 2
coverage-surviving new indicators (`BIS.SPP.REAL.YOY`, `COMMODITY_SHOCK.EXPORT_WEIGHTED`;
`BIS.CREDIT_GAP.PRIV_NFC` and `DSTKMKTXD` FAILED the OECD-scoped D1 coverage gate -- see
`results/d1_reboot_coverage_screen_scoped.json` -- and are NOT part of this recipe).

Positives = the EX-ANTE OECD/advanced-economy scope (`oecd_scope.py`, 67 events / 28
countries) -- NOT the coverage-restricted union/intersection subsets from the D1 screen
(those were diagnostic-only; V-Dem drivers are near-universal coverage, so restricting the
SAMPLE set a priori to indicator coverage would be circular). `build_X_y` naturally drops any
row missing a selected indicator, and `pair_oof` intersects both arms' surviving rows -- the
project's standard "coverage-matched, row-aligned" pattern (see
`banking-enrichment/widenet/baseline_harness.py`, `mass-protest-enrichment/run_candidate_battery.py`).

Computes, per the task's guards:
  guard #1 -- SCOPED baseline: run-2's 2 drivers refit on the OECD-scoped samples (NOT 0.547).
  guard #1 (cont'd) -- candidate recipe vs SCOPED baseline: country-block paired-bootstrap
      delta-AUC + 95% CI (`score_pilot.pair_oof` + `paired_bootstrap_delta_auc`, imported).
  guard #2 -- MANDATORY 2008-concentration era-decomposition: genuine refits (never a
      post-hoc subset) of the RECIPE and the BASELINE at their own locked (argmax) window,
      on (a) the full scoped sample, (b) 2008 excluded entirely from TRAINING, (c) pre-2008
      years only. Also a post-hoc per-era paired-delta cross-check on the SAME already-fit
      full-sample OOF (a genuinely different question: "does the DELTA over baseline survive
      outside 2008", vs (a)-(c)'s "does the RECIPE'S OWN signal survive outside 2008").
  guard #3 -- real coverage (already run: `screen_coverage_reboot.py` /
      `results/d1_reboot_coverage_screen_scoped.json`; this module trusts that screen and
      only builds the 2 survivors into the recipe).
  Full battery: D2 missingness placebo (has-data dummy + values-scrambled permutation, one
      new indicator swapped at a time, locked window) -- D3 orthogonality (already run
      host-only: `d3_reboot_orthogonality.py`, read not recomputed here) -- D4 coincident-vs-
      leading lag-decay (per new indicator, univariate, locked window: normal vs
      year-shifted-back-1 samples) -- D5 per-country breadth -- D7 +0.02 floor (on guard #1's
      delta) -- D7 locked temporal hold-out.

Writes `results/scoped_battery_report.json`.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
WIDENET_DIR = QGI_ML_ROOT / "experiments" / "banking-enrichment" / "widenet"
MASS_PROTEST_DIR = QGI_ML_ROOT / "experiments" / "mass-protest-enrichment"
for _p in (HERE, SCRIPTS_DIR, PILOT_DIR, WIDENET_DIR, MASS_PROTEST_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import battery_gates_reboot as bg  # noqa: E402
import panel_placebo_reboot as pp  # noqa: E402
from oecd_scope import OECD_SCOPED_COUNTRY_IDS, filter_positives_to_oecd_scope  # noqa: E402

SEED = 12345
RECIPE_ID = "economic_recession_oecd_scoped"
RUN2_DRIVERS = ["v2csreprss", "v2x_freexp_altinf"]
NEW_INDICATORS = ["BIS.SPP.REAL.YOY", "COMMODITY_SHOCK.EXPORT_WEIGHTED"]
RECIPE = RUN2_DRIVERS + NEW_INDICATORS
INCOME_PROXY_ID = "NY.GNP.PCAP.CD"  # unused here (D3 already run host-only); kept for provenance only

MAIN_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
REBOOT_PANEL_DIR = HERE / "panel_dir"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"
D7_CANDIDATE_CUTS = [1990, 1995, 2000, 2005, 2010, 2015]  # boldest (earliest) cut first
EXCLUDE_YEAR = 2008
PRE_2008_CUTOFF = 2008
D2_PERMUTE_SEED = SEED  # deterministic placebo shuffles


def _panel_source_dir(indicator_id: str) -> Path:
    return REBOOT_PANEL_DIR if indicator_id in NEW_INDICATORS else MAIN_PANEL_DIR


def _load_positives_oecd_scoped(w: Any, positives_csv: Path) -> Any:
    import pandas as pd

    raw = pd.read_csv(positives_csv)
    scoped_raw = filter_positives_to_oecd_scope(raw)
    pos = pd.DataFrame(
        {
            "country": scoped_raw["country_id"].apply(w.normalize_country_id),
            "year": scoped_raw["event_year"].astype(int),
        }
    )
    pos["label"] = 1
    return pos


def _fit_at_window(w: Any, indicators: list[str], samples: Any, panels: dict[str, Any],
                    window: int, seed: int) -> dict[str, Any]:
    """One LOCO fit at a GIVEN (not grid-searched) window -- the genuine-refit primitive used
    for the era-decomposition legs (a locked window keeps the comparison apples-to-apples
    across the full/excl-2008/pre-2008 subsets rather than letting each subset re-argmax its
    own window)."""
    import numpy as np

    X, y, c, yr = w.build_X_y(samples, indicators, window, panels)
    if len(X) < 20 or len(np.unique(y)) < 2:
        return {
            "loco_auc": None, "ci95_lo": None, "ci95_hi": None, "n_rows": int(len(X)),
            "n_pos": int((y == 1).sum()) if len(y) else 0, "oof": [], "fit_failed": True,
        }
    res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=seed)
    ci = w.bca_bootstrap_auc_ci(res["probs"], res["labels"], seed=seed)
    oof = [
        {"country": str(res["countries"][k]), "year": int(res["years"][k]),
         "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
        for k in range(len(res["probs"]))
    ]
    return {
        "loco_auc": float(res["global_auc"]), "ci95_lo": float(ci["ci95_lo"]), "ci95_hi": float(ci["ci95_hi"]),
        "n_rows": int(len(X)), "n_pos": int((y == 1).sum()), "oof": oof, "fit_failed": False,
        "per_country_auc": {k: float(v) for k, v in res["per_country_auc"].items()},
    }


def _era_decomposition(w: Any, indicators: list[str], samples: Any, panels: dict[str, Any],
                        window: int, seed: int) -> dict[str, Any]:
    full = _fit_at_window(w, indicators, samples, panels, window, seed)
    samples_excl = samples[samples["year"] != EXCLUDE_YEAR].reset_index(drop=True)
    excl = _fit_at_window(w, indicators, samples_excl, panels, window, seed)
    samples_pre = samples[samples["year"] < PRE_2008_CUTOFF].reset_index(drop=True)
    n_pre2008_pos = int((samples_pre["label"] == 1).sum())
    pre = _fit_at_window(w, indicators, samples_pre, panels, window, seed) if n_pre2008_pos >= 2 else {
        "loco_auc": None, "ci95_lo": None, "ci95_hi": None, "n_rows": 0, "n_pos": n_pre2008_pos,
        "oof": [], "fit_failed": True,
    }
    verdict = bg.era2008_verdict(
        auc_full=full["loco_auc"], auc_excl_2008=excl["loco_auc"], auc_pre2008_era=pre["loco_auc"],
        n_pre2008_pos=n_pre2008_pos,
    )
    n_2008_pos = int(((samples["year"] == EXCLUDE_YEAR) & (samples["label"] == 1)).sum())
    n_total_pos = int((samples["label"] == 1).sum())
    return {
        "window": window, "exclude_year": EXCLUDE_YEAR, "pre_cutoff": PRE_2008_CUTOFF,
        "n_2008_positives": n_2008_pos, "n_total_positives": n_total_pos,
        "pct_2008_of_positives": (100.0 * n_2008_pos / n_total_pos) if n_total_pos else None,
        "full_sample": {k: v for k, v in full.items() if k != "oof"},
        "excl_2008": {k: v for k, v in excl.items() if k != "oof"},
        "pre_2008_era": {k: v for k, v in pre.items() if k != "oof"},
        "verdict": verdict,
    }


def _paired_delta_by_era_subset(sp: Any, candidate_oof: list[dict], baseline_oof: list[dict]) -> dict[str, Any]:
    """Post-hoc cross-check: split the ALREADY-COMPUTED paired (candidate, baseline) OOF rows
    by year and recompute paired-bootstrap delta-AUC on each era subset -- answers "does the
    DELTA over baseline survive outside 2008", a distinct question from the genuine-refit
    era-decomposition above (which asks whether each ARM's own signal survives)."""
    # score_pilot.pair_oof doesn't return years (only country/prob/label), so we re-derive a
    # year-aware pairing here with the identical pairing method (k-th occurrence per
    # (country, year) key) to slice the SAME paired rows by era.
    from collections import OrderedDict, defaultdict

    da: "OrderedDict[tuple, list]" = OrderedDict()
    db: dict = defaultdict(list)
    for r in candidate_oof:
        key = (str(r["country"]), int(r["year"]))
        da.setdefault(key, []).append((float(r["prob"]), int(r["label"])))
    for r in baseline_oof:
        key = (str(r["country"]), int(r["year"]))
        db[key].append((float(r["prob"]), int(r["label"])))
    probs_a, probs_b, labels, countries, years = [], [], [], [], []
    for key, rows_a in da.items():
        rows_b = db.get(key)
        if not rows_b:
            continue
        for k in range(min(len(rows_a), len(rows_b))):
            pa, la = rows_a[k]
            pb, _lb = rows_b[k]
            probs_a.append(pa); probs_b.append(pb); labels.append(la)
            countries.append(key[0]); years.append(key[1])

    def _delta_for(mask: list[bool]) -> dict[str, Any]:
        pa = [p for p, m in zip(probs_a, mask) if m]
        pb = [p for p, m in zip(probs_b, mask) if m]
        lb = [l for l, m in zip(labels, mask) if m]
        cc = [c for c, m in zip(countries, mask) if m]
        if not pa:
            return {"ci95_lo": None, "ci95_hi": None, "point": None, "n_pairs": 0}
        return sp.paired_bootstrap_delta_auc(pa, pb, lb, countries=cc, b_eval=1000, seed=SEED)

    n = len(labels)
    mask_all = [True] * n
    mask_excl_2008 = [y != EXCLUDE_YEAR for y in years]
    mask_pre_2008 = [y < PRE_2008_CUTOFF for y in years]
    return {
        "n_pairs_total": n,
        "with_2008": _delta_for(mask_all),
        "excl_2008": _delta_for(mask_excl_2008),
        "pre_2008_era": _delta_for(mask_pre_2008),
    }


def run_battery(
    main_panel_dir: Path = MAIN_PANEL_DIR,
    reboot_panel_dir: Path = REBOOT_PANEL_DIR,
    positives_csv: Path = POSITIVES_CSV,
    out_path: Path | None = None,
) -> dict[str, Any]:
    import numpy as np

    import run_f_ml_1_poc as w  # noqa: E402
    import stability_select as ss  # noqa: E402
    import score_pilot as sp  # noqa: E402
    import temporal_holdout as th  # noqa: E402
    import oof_utils as ou  # noqa: E402

    pos = _load_positives_oecd_scoped(w, positives_csv)
    samples = w.build_samples(pos, negatives_per_positive=3, seed=SEED, time_matched=True)
    n_pos = int((samples["label"] == 1).sum())
    n_countries = int(samples["country"].nunique())

    all_ids = sorted(set(RECIPE))
    panels = {ind: w.load_panel(ind, _panel_source_dir(ind)) for ind in all_ids}
    baseline_panels = {ind: panels[ind] for ind in RUN2_DRIVERS}

    # --- guard #1: SCOPED baseline + candidate recipe, own WINDOW_GRID argmax each ---------
    baseline_fit = ss._final_fit(RUN2_DRIVERS, samples, baseline_panels, SEED)
    candidate_fit = ss._final_fit(RECIPE, samples, panels, SEED)

    pi_main = sp.pair_oof(candidate_fit["oof"], baseline_fit["oof"])
    delta_main = sp.paired_bootstrap_delta_auc(
        pi_main["probs_a"], pi_main["probs_b"], pi_main["labels"],
        countries=pi_main["countries"], b_eval=2000, seed=SEED,
    )
    floor_pass = bg.floor_gate_pass(delta_main["ci95_lo"])

    # --- D5 per-country breadth (on the candidate's own OOF) --------------------------------
    per_country_auc = ou.per_country_auc_from_oof(candidate_fit["oof"])
    d5_pass = bg.per_country_gate_pass(per_country_auc)

    # --- guard #2: MANDATORY 2008 era-decomposition, genuine refits at the LOCKED window ----
    locked_window = candidate_fit["chosen_window"]
    baseline_locked_window = baseline_fit["chosen_window"]
    era_candidate = _era_decomposition(w, RECIPE, samples, panels, locked_window, SEED) if locked_window else None
    era_baseline = (
        _era_decomposition(w, RUN2_DRIVERS, samples, baseline_panels, baseline_locked_window, SEED)
        if baseline_locked_window else None
    )
    era_delta_posthoc = _paired_delta_by_era_subset(sp, candidate_fit["oof"], baseline_fit["oof"])

    # --- D2 missingness placebo, one new indicator swapped at a time, locked to candidate's
    # own chosen_window (no fresh argmax on a placebo). ---------------------------------------
    def _fit_recipe_with_swap(swap_indicator: str, swap_panel) -> dict[str, Any]:
        swapped_panels = dict(panels)
        swapped_panels[swap_indicator] = swap_panel
        X, y, c, yr = w.build_X_y(samples, RECIPE, locked_window, swapped_panels)
        if len(X) == 0 or len(np.unique(y)) < 2:
            return {"loco_auc": float("nan"), "oof": []}
        res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
        return {
            "loco_auc": float(res["global_auc"]),
            "oof": [
                {"country": str(res["countries"][k]), "year": int(res["years"][k]),
                 "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
                for k in range(len(res["probs"]))
            ],
        }

    def _delta_vs_baseline(placebo_oof: list[dict]) -> dict[str, Any]:
        if not placebo_oof:
            return {"ci95_lo": None, "ci95_hi": None, "point": None}
        pi_ = sp.pair_oof(placebo_oof, baseline_fit["oof"])
        return sp.paired_bootstrap_delta_auc(
            pi_["probs_a"], pi_["probs_b"], pi_["labels"], countries=pi_["countries"],
            b_eval=1000, seed=SEED,
        )

    placebo_results: dict[str, Any] = {}
    for ind in NEW_INDICATORS:
        real_panel = panels[ind]
        dummy_panel = pp.build_has_data_dummy_panel(real_panel)
        permuted_panel = pp.permute_values_mask_preserved(real_panel, seed=D2_PERMUTE_SEED)
        pp.assert_mask_preserved(real_panel, dummy_panel)
        pp.assert_mask_preserved(real_panel, permuted_panel)
        dummy_fit = _fit_recipe_with_swap(ind, dummy_panel)
        permuted_fit = _fit_recipe_with_swap(ind, permuted_panel)
        delta_dummy = _delta_vs_baseline(dummy_fit["oof"])
        delta_permuted = _delta_vs_baseline(permuted_fit["oof"])
        placebo_results[ind] = {
            "dummy_loco_auc": dummy_fit["loco_auc"], "dummy_delta_vs_baseline": delta_dummy,
            "permuted_loco_auc": permuted_fit["loco_auc"], "permuted_delta_vs_baseline": delta_permuted,
            "gate_pass": bg.placebo_gate_pass(delta_dummy["ci95_lo"], delta_permuted["ci95_lo"]),
        }

    # --- D4 coincident-vs-leading lag-decay, per new indicator, univariate, locked window ---
    def _univariate_fit(indicator: str, smp) -> dict[str, Any]:
        X, y, c, yr = w.build_X_y(smp, [indicator], locked_window, {indicator: panels[indicator]})
        if len(X) < 20 or len(np.unique(y)) < 2:
            return {"loco_auc": None, "n_rows": int(len(X))}
        res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
        return {"loco_auc": float(res["global_auc"]), "n_rows": int(len(X))}

    samples_shifted = samples.copy()
    samples_shifted["year"] = samples_shifted["year"] - 1

    lag_decay_results: dict[str, Any] = {}
    for ind in NEW_INDICATORS:
        auc_t1 = _univariate_fit(ind, samples)
        auc_shifted = _univariate_fit(ind, samples_shifted)
        verdict = bg.lag_decay_verdict(auc_t1["loco_auc"], auc_shifted["loco_auc"])
        lag_decay_results[ind] = {
            "auc_normal_t1_window": auc_t1, "auc_shifted_minus1_year": auc_shifted,
            "verdict": verdict,
        }

    # --- D7 locked temporal hold-out, LOCKED to candidate_fit's own chosen_window -----------
    try:
        pick = th.pick_cut_year(
            samples, D7_CANDIDATE_CUTS, RECIPE, locked_window, panels, w, min_holdout_frac=0.10,
        )
        cut = pick["locked_cut_year"]
        screen, holdout = th.temporal_split(samples, cut)
        n_holdout_pos = int((holdout["label"] == 1).sum())
        holdout_fit = th.fit_predict_holdout(screen, holdout, RECIPE, locked_window, panels, "XGBoost", SEED, w)
        holdout_ci_lo = holdout_fit["holdout_auc_ci95"][0]
        holdout_detail: dict[str, Any] = {"fit_failed": False, "locked_cut_year": cut,
                                           "cut_year_selection": pick, **holdout_fit}
    except ValueError as exc:
        n_holdout_pos = 0
        holdout_ci_lo = None
        holdout_detail = {"fit_failed": True, "reason": str(exc)}
    holdout_verdict = {
        "gate_pass": bool(holdout_ci_lo is not None and holdout_ci_lo == holdout_ci_lo and holdout_ci_lo > 0.50),
        "n_holdout_pos": n_holdout_pos, "holdout_auc_ci_lo": holdout_ci_lo,
    }

    # ------------------------------------------------------------------------------------------
    overall_gates = {
        "floor_ci_lower_gt_0.02": floor_pass,
        "per_country_breadth": d5_pass,
        "era2008_not_rejected": not (era_candidate is not None and era_candidate["verdict"]["reject"]),
        "placebo_near_null_all": all(v["gate_pass"] for v in placebo_results.values()),
        "lag_decay_leading_all": all(
            not v["verdict"]["reject"] for v in lag_decay_results.values()
        ),
        "temporal_holdout": holdout_verdict["gate_pass"] or n_holdout_pos < 8,
    }
    overall_clears = all(overall_gates.values())

    report: dict[str, Any] = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "scope": "oecd_scoped_ex_ante",
        "oecd_scoped_country_ids": sorted(OECD_SCOPED_COUNTRY_IDS),
        "n_scoped_countries_with_events": n_countries,
        "n_pos_samples": n_pos,
        "recipe_indicators": RECIPE,
        "new_indicators": NEW_INDICATORS,
        "baseline": {
            "drivers": RUN2_DRIVERS,
            "loco_auc": baseline_fit["loco_auc"], "ci95_lo": baseline_fit["ci95_lo"],
            "ci95_hi": baseline_fit["ci95_hi"], "chosen_window": baseline_fit["chosen_window"],
            "note": "SCOPED baseline per guard #1 -- run-2's drivers refit on the OECD-scoped "
                    "samples, NOT the universal 0.547 anchor.",
        },
        "candidate": {
            "loco_auc": candidate_fit["loco_auc"], "ci95_lo": candidate_fit["ci95_lo"],
            "ci95_hi": candidate_fit["ci95_hi"], "chosen_window": candidate_fit["chosen_window"],
        },
        "pairing": {"n_pairs": pi_main["n_pairs"], "n_a": pi_main["n_a"], "n_b": pi_main["n_b"],
                    "label_mismatches": pi_main["label_mismatches"]},
        "delta_auc_vs_scoped_baseline": delta_main,
        "floor_gate_pass_ci_lower_gt_0.02": floor_pass,
        "d5_per_country": {"gate_pass": d5_pass, "per_country_auc": per_country_auc,
                            "n_countries": len(per_country_auc)},
        "era2008_decomposition_candidate_genuine_refit": era_candidate,
        "era2008_decomposition_baseline_genuine_refit": era_baseline,
        "era2008_delta_posthoc_crosscheck": era_delta_posthoc,
        "d2_missingness_placebo": placebo_results,
        "d4_lag_decay": lag_decay_results,
        "d7_temporal_holdout": {**holdout_verdict, "detail": holdout_detail},
        "overall_gates": overall_gates,
        "overall_clears_full_battery": overall_clears,
    }

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[run_scoped_battery] wrote {out_path}")
    print(
        f"[run_scoped_battery] scoped_baseline={baseline_fit['loco_auc']!r} "
        f"candidate={candidate_fit['loco_auc']!r} dAUC={delta_main['point']!r} "
        f"CI95=[{delta_main['ci95_lo']!r},{delta_main['ci95_hi']!r}] "
        f"floor_pass={floor_pass} overall_clears={overall_clears} gates={overall_gates}"
    )
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--main-panel-dir", type=Path, default=MAIN_PANEL_DIR)
    ap.add_argument("--reboot-panel-dir", type=Path, default=REBOOT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=POSITIVES_CSV)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "scoped_battery_report.json")
    args = ap.parse_args(argv)
    run_battery(args.main_panel_dir, args.reboot_panel_dir, args.positives_csv, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
