"""D6 -- GFC-2008 concentration FAST PRE-FILTER (economic_recession enrichment cycle).

Per PRE-REGISTRATION.md (committed 703e440), acceptance bar: "D6 GFC-2008 concentration =
FAST PRE-FILTER (run FIRST): 13.2% of positives are 2008 -- a candidate that's purely a
global-2008-time-effect is rejected before spending the rest of the battery."

Method: fit ONE univariate LOCO on the FULL sample and a SECOND univariate LOCO on the sample
with every row (positive AND negative) at `exclude_year` (default 2008) removed -- a genuine
refit, not a post-hoc subset of the same predictions (removing 2008 from TRAINING too, not
just scoring, is the correct test of "does this candidate carry any signal outside the global
shock year"). A candidate whose 2008-excluded AUC collapses to chance (<=0.50) is REJECTED as
purely a 2008 global-time-effect -- the crisis-cohort year alone would be doing all the work,
which is a confound (every country had a headline indicator move in 2008; that's calendar
time, not the candidate's own predictive shape) rather than a genuine leading signal.

This is the FIRST gate in the battery (run before D1 coverage / D3 orthogonality) precisely
because it is cheap (one univariate LR fit per candidate, not a multi-window greedy walk) and
catches the specific 2008-shock failure mode the pre-reg flags before any further spend.

DI pattern (mirrors `experiments/banking-enrichment/widenet/temporal_holdout.py`): the pure
row-filter (`exclude_2008_rows`) and verdict logic (`gfc2008_verdict`) are host-testable with
zero ML-stack dependency; `run_prefilter_for_candidate` / `run_prefilter_all_di` accept an
injected `walk_module` (or per-candidate dict of them) so the ORCHESTRATION is unit-testable
without joblib/xgboost/sklearn. `run_prefilter_all` (real orchestration) imports the real
`scripts/run_f_ml_1_poc` module -- the host environment here has the full ML stack installed
(xgboost/sklearn/scipy), so no Docker is required for this gate specifically (Docker remains
the vehicle for the heavier multi-window greedy walk stages downstream).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"

DEFAULT_EXCLUDE_YEAR = 2008
DEFAULT_CHANCE = 0.50
DEFAULT_WINDOW = 3          # matches the pre-reg's baseline window (XGBoost, window 3)
DEFAULT_ARCHITECTURE = "LR"  # fast univariate screen -- architecture-agnostic pre-filter
DEFAULT_SEED = 12345

# Mirror run_f_ml_1_poc's module constants (kept in sync manually; low drift risk).
MIN_POS_SURVIVAL = 0.50
MIN_EFFECTIVE_NPOS = 30
MIN_SURVIVE_COUNTRIES = 10
MIN_NEG_SURVIVAL = 0.60

CREDIT_INDICATOR_ID = "FD.AST.PRVT.GD.ZS"
M2_INDICATOR_ID = "FM.LBL.BMNY.GD.ZS"
CREDIT_ACCEL_ID = "FD.AST.PRVT.GD.ZS__accel3"
M2_DECEL_ID = "FM.LBL.BMNY.GD.ZS__decel3"
INVESTMENT_SANITY_ID = "NE.GDI.TOTL.ZS"  # flagged sanity check only, per pre-reg -- not "new"

# candidate_id -> which panel_dir it lives under ("main" = data/parquet_panels,
# "derived" = this experiment's credit_m2_panel_dir).
CANDIDATE_SOURCE = {
    CREDIT_INDICATOR_ID: "main",
    CREDIT_ACCEL_ID: "derived",
    M2_INDICATOR_ID: "main",
    M2_DECEL_ID: "derived",
    INVESTMENT_SANITY_ID: "main",
}
ALL_CANDIDATES = [CREDIT_INDICATOR_ID, CREDIT_ACCEL_ID, M2_INDICATOR_ID, M2_DECEL_ID,
                   INVESTMENT_SANITY_ID]

# Verbatim copy of run_f_ml_1_poc.normalize_country_id (that module is not host-importable
# without the full ML stack pre-check at import time in every caller; this copy matches the
# project's established duplication convention -- see build_coup_trap.py's docstring).
COUNTRY_NAME_OVERRIDES: dict[str, str] = {
    "democratic_republic_of_congo": "The Democratic Republic of the Congo",
    "guinea_bissau": "Guinea-Bissau",
    "republic_of_congo": "Republic of the Congo",
    "timor_leste": "Timor-Leste",
}


def normalize_country_id(country_id: str) -> str:
    if country_id in COUNTRY_NAME_OVERRIDES:
        return COUNTRY_NAME_OVERRIDES[country_id]
    return country_id.replace("_", " ").title()


def load_positives(positives_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(positives_csv)
    return pd.DataFrame({
        "country": df["country_id"].apply(normalize_country_id),
        "year": df["event_year"].astype(int),
    })


# ============================================================================================
# Pure row filter.
# ============================================================================================
def exclude_2008_rows(samples: pd.DataFrame, exclude_year: int = DEFAULT_EXCLUDE_YEAR) -> pd.DataFrame:
    """Drop every row (positive AND negative) at `exclude_year` -- both classes, so the
    resulting sample is a genuine "what if this calendar year never happened" refit, not a
    class-imbalanced subset."""
    return samples[samples["year"] != exclude_year].reset_index(drop=True)


# ============================================================================================
# Pure verdict.
# ============================================================================================
def gfc2008_verdict(auc_excl_2008: float | None, chance: float = DEFAULT_CHANCE) -> str:
    """`INCONCLUSIVE_INSUFFICIENT_DATA` if `auc_excl_2008` is None/NaN (fit failed or
    coverage gate blocked it upstream); `REJECT_GFC2008_CONCENTRATED` if the 2008-excluded
    AUC does not clear `chance` (the candidate carries no signal once the global 2008 shock
    year is removed -- boundary is REJECT-inclusive, matching the project's other threshold
    gates' `>=`/`<=` convention); else `PASS_PREFILTER`."""
    if auc_excl_2008 is None or auc_excl_2008 != auc_excl_2008:  # None or NaN
        return "INCONCLUSIVE_INSUFFICIENT_DATA"
    return "REJECT_GFC2008_CONCENTRATED" if auc_excl_2008 <= chance else "PASS_PREFILTER"


# ============================================================================================
# Orchestration (DI'd walk_module -- unit-testable without the ML stack).
# ============================================================================================
def run_prefilter_for_candidate(
    candidate_id: str,
    panels: dict[str, pd.DataFrame],
    samples: pd.DataFrame,
    window: int,
    architecture: str,
    seed: int,
    walk_module: Any,
    exclude_year: int = DEFAULT_EXCLUDE_YEAR,
    chance: float = DEFAULT_CHANCE,
    min_pos_survival: float = MIN_POS_SURVIVAL,
    min_effective_npos: int = MIN_EFFECTIVE_NPOS,
    min_survive_countries: int = MIN_SURVIVE_COUNTRIES,
    min_neg_survival: float = MIN_NEG_SURVIVAL,
) -> dict[str, Any]:
    """Fit full-sample + `exclude_year`-excluded univariate LOCO for one candidate and return
    the verdict. Both sides go through the SAME coverage gate (`walk_module.coverage_report` +
    `coverage_gate_ok`, imported/injected -- never reimplemented) before any model is fit;
    if EITHER side fails coverage the candidate is INCONCLUSIVE_INSUFFICIENT_DATA rather than
    silently fit on a truncated sample (same fail-closed convention as the rest of the
    battery)."""
    samples_excl = exclude_2008_rows(samples, exclude_year=exclude_year)
    n_excluded = len(samples) - len(samples_excl)

    cov_full = walk_module.coverage_report(samples, [candidate_id], window, panels)
    cov_full_ok = walk_module.coverage_gate_ok(
        cov_full, min_pos_survival, min_effective_npos, min_survive_countries, min_neg_survival,
    )
    cov_excl = walk_module.coverage_report(samples_excl, [candidate_id], window, panels)
    cov_excl_ok = walk_module.coverage_gate_ok(
        cov_excl, min_pos_survival, min_effective_npos, min_survive_countries, min_neg_survival,
    )

    result: dict[str, Any] = {
        "candidate_id": candidate_id,
        "exclude_year": exclude_year,
        "n_total_rows": int(len(samples)),
        "n_2008_rows_excluded": int(n_excluded),
        "coverage_full_sample": {**cov_full, "gate_pass": bool(cov_full_ok)},
        "coverage_excl_2008": {**cov_excl, "gate_pass": bool(cov_excl_ok)},
    }
    if not cov_full_ok or not cov_excl_ok:
        result.update({
            "auc_full_sample": None, "auc_excl_2008": None,
            "verdict": "INCONCLUSIVE_INSUFFICIENT_DATA",
        })
        return result

    X_full, y_full, c_full, yr_full = walk_module.build_X_y(samples, [candidate_id], window, panels)
    res_full = walk_module.fit_predict_loco(X_full, y_full, c_full, yr_full, architecture, seed)
    ci_full = walk_module.bca_bootstrap_auc_ci(res_full["probs"], res_full["labels"], seed=seed)

    X_excl, y_excl, c_excl, yr_excl = walk_module.build_X_y(samples_excl, [candidate_id], window, panels)
    res_excl = walk_module.fit_predict_loco(X_excl, y_excl, c_excl, yr_excl, architecture, seed)
    ci_excl = walk_module.bca_bootstrap_auc_ci(res_excl["probs"], res_excl["labels"], seed=seed)

    verdict = gfc2008_verdict(res_excl["global_auc"], chance=chance)
    result.update({
        "auc_full_sample": res_full["global_auc"],
        "auc_full_sample_ci95": [ci_full["ci95_lo"], ci_full["ci95_hi"]],
        "auc_excl_2008": res_excl["global_auc"],
        "auc_excl_2008_ci95": [ci_excl["ci95_lo"], ci_excl["ci95_hi"]],
        "lift_over_chance_full": res_full["global_auc"] - chance,
        "lift_over_chance_excl_2008": res_excl["global_auc"] - chance,
        "verdict": verdict,
    })
    return result


def run_prefilter_all_di(
    candidates: list[str],
    panels: dict[str, pd.DataFrame],
    samples: pd.DataFrame,
    per_candidate_walk_module: dict[str, Any],
    window: int,
    architecture: str,
    seed: int,
    exclude_year: int = DEFAULT_EXCLUDE_YEAR,
    chance: float = DEFAULT_CHANCE,
) -> dict[str, Any]:
    """Same DI pattern as `run_prefilter_for_candidate`, applied across `candidates`, one
    (possibly distinct) `walk_module` per candidate id -- lets unit tests drive different
    fake fit outcomes per candidate without a real ML stack."""
    results = {
        cid: run_prefilter_for_candidate(
            cid, panels, samples, window, architecture, seed,
            per_candidate_walk_module[cid], exclude_year=exclude_year, chance=chance,
        )
        for cid in candidates
    }
    return {
        "exclude_year": exclude_year,
        "chance": chance,
        "candidates": results,
        "survivors": [c for c, r in results.items() if r["verdict"] == "PASS_PREFILTER"],
        "rejected": [c for c, r in results.items() if r["verdict"] == "REJECT_GFC2008_CONCENTRATED"],
        "inconclusive": [c for c, r in results.items() if r["verdict"] == "INCONCLUSIVE_INSUFFICIENT_DATA"],
    }


# ============================================================================================
# Real orchestration (real panel data + real run_f_ml_1_poc; host has full ML stack).
# ============================================================================================
def _load_panel(panel_dir: Path, indicator_id: str) -> pd.DataFrame:
    return pd.read_parquet(panel_dir / indicator_id / f"{indicator_id}.parquet")


def run_prefilter_all(
    candidates: list[str] = ALL_CANDIDATES,
    main_panel_dir: Path | None = None,
    derived_panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    window: int = DEFAULT_WINDOW,
    architecture: str = DEFAULT_ARCHITECTURE,
    seed: int = DEFAULT_SEED,
    negatives_per_positive: int = 3,
    exclude_year: int = DEFAULT_EXCLUDE_YEAR,
    chance: float = DEFAULT_CHANCE,
    out_path: Path | None = None,
) -> dict[str, Any]:
    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    import run_f_ml_1_poc as walk_module  # local import: heavy ML-stack dep, real run only

    main_panel_dir = main_panel_dir or (QGI_ML_ROOT / "data" / "parquet_panels")
    derived_panel_dir = derived_panel_dir or (HERE / "credit_m2_panel_dir")
    positives_csv = positives_csv or (
        QGI_ML_ROOT / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"
    )

    positives = load_positives(positives_csv)
    positives = positives.assign(label=1)
    samples = walk_module.build_samples(
        positives, negatives_per_positive=negatives_per_positive, seed=seed, time_matched=True,
    )

    panels: dict[str, pd.DataFrame] = {}
    for cid in candidates:
        src_dir = main_panel_dir if CANDIDATE_SOURCE.get(cid, "main") == "main" else derived_panel_dir
        panels[cid] = _load_panel(src_dir, cid)

    results = {
        cid: run_prefilter_for_candidate(
            cid, panels, samples, window, architecture, seed, walk_module,
            exclude_year=exclude_year, chance=chance,
        )
        for cid in candidates
    }
    out = {
        "recipe_id": "economic_recession",
        "n_positive_events": int(len(positives)),
        "window": window,
        "architecture": architecture,
        "seed": seed,
        "exclude_year": exclude_year,
        "chance": chance,
        "candidates": results,
        "survivors": [c for c, r in results.items() if r["verdict"] == "PASS_PREFILTER"],
        "rejected": [c for c, r in results.items() if r["verdict"] == "REJECT_GFC2008_CONCENTRATED"],
        "inconclusive": [c for c, r in results.items() if r["verdict"] == "INCONCLUSIVE_INSUFFICIENT_DATA"],
    }
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[gfc2008_prefilter] wrote {out_path}")
    for cid, r in results.items():
        print(
            f"[gfc2008_prefilter] {cid}: auc_full={r.get('auc_full_sample')!r} "
            f"auc_excl_2008={r.get('auc_excl_2008')!r} verdict={r['verdict']}"
        )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--candidates", nargs="+", default=ALL_CANDIDATES)
    ap.add_argument("--main-panel-dir", type=Path, default=None)
    ap.add_argument("--derived-panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--window", type=int, default=DEFAULT_WINDOW)
    ap.add_argument("--architecture", type=str, default=DEFAULT_ARCHITECTURE)
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--exclude-year", type=int, default=DEFAULT_EXCLUDE_YEAR)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "d6_gfc2008_prefilter_report.json")
    args = ap.parse_args(argv)
    run_prefilter_all(
        candidates=args.candidates, main_panel_dir=args.main_panel_dir,
        derived_panel_dir=args.derived_panel_dir, positives_csv=args.positives_csv,
        window=args.window, architecture=args.architecture, seed=args.seed,
        exclude_year=args.exclude_year, out_path=args.out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
