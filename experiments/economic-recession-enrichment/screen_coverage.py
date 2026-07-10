"""D1 -- coverage-at-positive-cells screen (economic_recession enrichment cycle).

Per the method of record (`qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md`
S2): "coverage-at-positive-cells (>=80% non-null at t-1 AND t-2 over the positives)" -- the
cheapest/hardest veto in the screening funnel, run AFTER the D6 GFC-2008 fast pre-filter (per
PRE-REGISTRATION.md, committed 703e440) but BEFORE any AUC test. Structural port of
`experiments/mass-protest-enrichment/screen_coverage.py` (identical method) onto
economic_recession's candidates: `FD.AST.PRVT.GD.ZS` (+ its `__accel3` derived transform),
`FM.LBL.BMNY.GD.ZS` (+ its `__decel3` derived transform), and `NE.GDI.TOTL.ZS` (flagged
sanity check only, per the pre-reg -- already the charter shape-prototype indicator, not a
promotable "new" driver even if it clears every gate).

Host-only: pandas + pyarrow. No joblib/xgboost/sklearn/scipy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd

DEFAULT_THRESHOLD = 0.80

CREDIT_INDICATOR_ID = "FD.AST.PRVT.GD.ZS"
M2_INDICATOR_ID = "FM.LBL.BMNY.GD.ZS"
CREDIT_ACCEL_ID = "FD.AST.PRVT.GD.ZS__accel3"
M2_DECEL_ID = "FM.LBL.BMNY.GD.ZS__decel3"
INVESTMENT_SANITY_ID = "NE.GDI.TOTL.ZS"

CANDIDATE_SOURCE = {
    CREDIT_INDICATOR_ID: "main",
    CREDIT_ACCEL_ID: "derived",
    M2_INDICATOR_ID: "main",
    M2_DECEL_ID: "derived",
    INVESTMENT_SANITY_ID: "main",
}
CANDIDATES = [CREDIT_INDICATOR_ID, CREDIT_ACCEL_ID, M2_INDICATOR_ID, M2_DECEL_ID,
              INVESTMENT_SANITY_ID]

# Verbatim copy of run_f_ml_1_poc.normalize_country_id (project convention; see
# build_coup_trap.py's docstring for why this is duplicated rather than imported).
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


# ============================================================================================
# Pure lookup + coverage math.
# ============================================================================================
def value_at_year(panel: pd.DataFrame, country: str, year: int) -> float | None:
    """Exact (country, year) lookup into a panel DataFrame (`country`, `year`, `value`
    columns). None if no exact row exists or the value is null -- a genuine gap, never
    silently imputed."""
    hit = panel[(panel["country"] == country) & (panel["year"] == year)]
    if hit.empty:
        return None
    v = hit["value"].iloc[0]
    if pd.isna(v):
        return None
    return float(v)


def coverage_at_positive_cells_t1_and_t2(
    panel: pd.DataFrame, positives: pd.DataFrame
) -> dict[str, Any]:
    """The D1 protocol statistic: fraction of positive events with a non-null value at BOTH
    t-1 AND t-2 (the AND is over each individual event, not the two aggregate fractions)."""
    n_total = len(positives)
    n_both = 0
    n_t1_only = 0
    n_t2_only = 0
    for _, r in positives.iterrows():
        country, event_year = str(r["country"]), int(r["year"])
        has_t1 = value_at_year(panel, country, event_year - 1) is not None
        has_t2 = value_at_year(panel, country, event_year - 2) is not None
        if has_t1 and has_t2:
            n_both += 1
        if has_t1:
            n_t1_only += 1
        if has_t2:
            n_t2_only += 1
    return {
        "n_total": n_total,
        "n_t1_covered": n_t1_only,
        "n_t2_covered": n_t2_only,
        "n_t1_and_t2_covered": n_both,
        "t1_coverage_pct": round(100 * n_t1_only / n_total, 1) if n_total else 0.0,
        "t2_coverage_pct": round(100 * n_t2_only / n_total, 1) if n_total else 0.0,
        "t1_and_t2_coverage_pct": round(100 * n_both / n_total, 1) if n_total else 0.0,
    }


def d1_verdict(t1_and_t2_coverage_pct: float, threshold: float = DEFAULT_THRESHOLD) -> str:
    """`PASS_COVERAGE` if the t-1 AND t-2 coverage fraction meets `threshold` (as a
    percentage, e.g. 80.0 for 80%), else `FAIL_COVERAGE`."""
    return "PASS_COVERAGE" if t1_and_t2_coverage_pct >= threshold * 100.0 else "FAIL_COVERAGE"


# ============================================================================================
# Orchestration (real panel data; host-only, no Docker).
# ============================================================================================
def _load_panel(panel_dir: Path, indicator_id: str) -> pd.DataFrame:
    return pd.read_parquet(panel_dir / indicator_id / f"{indicator_id}.parquet")


def _load_positives(positives_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(positives_csv)
    return pd.DataFrame(
        {
            "country": df["country_id"].apply(normalize_country_id),
            "year": df["event_year"].astype(int),
        }
    )


def screen_candidate(
    indicator_id: str,
    panel_dir: Path,
    positives: pd.DataFrame,
    threshold: float = DEFAULT_THRESHOLD,
) -> dict[str, Any]:
    panel_path = panel_dir / indicator_id / f"{indicator_id}.parquet"
    if not panel_path.is_file():
        return {"indicator_id": indicator_id, "verdict": "MISSING_PANEL", "threshold": threshold}
    panel = _load_panel(panel_dir, indicator_id)
    stats = coverage_at_positive_cells_t1_and_t2(panel, positives)
    verdict = d1_verdict(stats["t1_and_t2_coverage_pct"], threshold=threshold)
    return {"indicator_id": indicator_id, **stats, "verdict": verdict, "threshold": threshold}


def run_screen_all(
    candidates: list[str] = CANDIDATES,
    main_panel_dir: Path | None = None,
    derived_panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    threshold: float = DEFAULT_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    here = Path(__file__).resolve().parent
    qgi_ml_root = here.parents[1]
    main_panel_dir = main_panel_dir or (qgi_ml_root / "data" / "parquet_panels")
    derived_panel_dir = derived_panel_dir or (here / "credit_m2_panel_dir")
    positives_csv = positives_csv or (
        qgi_ml_root / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"
    )
    positives = _load_positives(positives_csv)

    results: dict[str, Any] = {}
    for ind in candidates:
        src_dir = derived_panel_dir if CANDIDATE_SOURCE.get(ind, "main") == "derived" else main_panel_dir
        results[ind] = screen_candidate(ind, src_dir, positives, threshold=threshold)

    out = {
        "n_positive_events": len(positives),
        "threshold": threshold,
        "candidates": results,
        "survivors": [c for c, r in results.items() if r["verdict"] == "PASS_COVERAGE"],
        "rejected": [c for c, r in results.items() if r["verdict"] == "FAIL_COVERAGE"],
        "missing_panel": [c for c, r in results.items() if r["verdict"] == "MISSING_PANEL"],
    }
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[screen_coverage] wrote {out_path}")
    for c, r in results.items():
        if r["verdict"] == "MISSING_PANEL":
            print(f"[screen_coverage] {c}: MISSING_PANEL")
        else:
            print(
                f"[screen_coverage] {c}: t1={r['t1_coverage_pct']}% t2={r['t2_coverage_pct']}% "
                f"t1&t2={r['t1_and_t2_coverage_pct']}% verdict={r['verdict']}"
            )
    return out


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--main-panel-dir", type=Path, default=None)
    ap.add_argument("--derived-panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument("--out", type=Path, default=here / "results" / "d1_coverage_screen_report.json")
    args = ap.parse_args(argv)
    run_screen_all(
        main_panel_dir=args.main_panel_dir, derived_panel_dir=args.derived_panel_dir,
        positives_csv=args.positives_csv, threshold=args.threshold, out_path=args.out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
