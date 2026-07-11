"""D1 -- coverage-at-positive-cells screen (mass_protest enrichment cycle).

Per the method of record (`qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md`
S2): "coverage-at-positive-cells (>=80% non-null at t-1 AND t-2 over the positives)" is the
cheapest/hardest veto in the screening funnel -- run BEFORE any AUC test. This module computes,
for every mass_protest candidate (+ the D4 protest-trap features, which are 100% covered by
construction, + the D3a dev-proxy control), the fraction of the 336 positive events that have a
non-null indicator value at `event_year - 1` AND at `event_year - 2` (both must be non-null for
the cell to count as "covered" -- matches the AND wording of the protocol).

Host-only: pandas + pyarrow. No joblib/xgboost/sklearn/scipy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd

DEFAULT_THRESHOLD = 0.80

# Verbatim copy of build_mass_protest_trap.normalize_country_id (itself a verbatim copy of
# scripts/run_f_ml_1_poc.py's) -- see that module's docstring for why this is duplicated
# rather than imported.
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


def coverage_at_offset(
    panel: pd.DataFrame, positives: pd.DataFrame, offset: int
) -> tuple[int, int]:
    """`(n_covered, n_total)` -- for each (country, event_year) row in `positives`, whether
    `panel` has a non-null value at `event_year - offset`."""
    n_total = len(positives)
    n_covered = 0
    for _, r in positives.iterrows():
        country, event_year = str(r["country"]), int(r["year"])
        if value_at_year(panel, country, event_year - offset) is not None:
            n_covered += 1
    return n_covered, n_total


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


# Every candidate named in PRE-REGISTRATION.md (committed 7cdfb5f), including the D4
# protest-trap features (built by build_mass_protest_trap.py; expected 100% by construction --
# they are a cartesian derived transform, no genuine data gaps) and the mandatory D3a
# dev-proxy control indicator (screened for its own coverage too, since a control that itself
# fails coverage cannot anchor a fair D3a comparison).
CANDIDATES = [
    "AG.PRD.FOOD.XD",
    "NY.GDP.MKTP.KD.ZG",
    "OWID_POP_YOUNG",
    "FP.CPI.TOTL.ZG",
    "v2x_regime",
    "prior_mass_protest_count",
    "years_since_last_mass_protest",
    "NY.GNP.PCAP.CD",  # D3a dev-proxy control
]


def run_screen_all(
    candidates: list[str] = CANDIDATES,
    panel_dir: Path | None = None,
    trap_panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    threshold: float = DEFAULT_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    here = Path(__file__).resolve().parent
    qgi_ml_root = here.parents[1]
    panel_dir = panel_dir or (qgi_ml_root / "data" / "parquet_panels")
    trap_panel_dir = trap_panel_dir or (here / "mass_protest_trap_panel_dir")
    positives_csv = positives_csv or (
        qgi_ml_root / "data" / "shape_inputs_v2" / "mass_protest" / "positives.csv"
    )
    positives = _load_positives(positives_csv)

    trap_ids = {"prior_mass_protest_count", "years_since_last_mass_protest"}
    results: dict[str, Any] = {}
    for ind in candidates:
        src_dir = trap_panel_dir if ind in trap_ids else panel_dir
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
    ap.add_argument("--panel-dir", type=Path, default=None)
    ap.add_argument("--trap-panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument("--out", type=Path, default=here / "results" / "d1_coverage_screen_report.json")
    args = ap.parse_args(argv)
    run_screen_all(
        panel_dir=args.panel_dir, trap_panel_dir=args.trap_panel_dir,
        positives_csv=args.positives_csv, threshold=args.threshold, out_path=args.out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
