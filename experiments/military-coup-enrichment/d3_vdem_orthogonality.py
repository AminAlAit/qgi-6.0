"""D3 -- MANDATORY V-Dem-family orthogonality screen (hardened, purist edit #1).

Per `PRE-REGISTRATION.md` (military_coup enrichment cycle, committed d277502) D3: residualize
/ partial-correlation each of the 5 V-Dem candidates (`v2exl_legitlead`, `v2pepwrses`,
`v2stcritapparm`, `v2strenarm`, `OWID_AUTOCRATIZATION`) against the FULL run-2 4-driver V-Dem
block (`v2excrptps`, `v2cltort`, `v2xel_frefair`, `v2x_clpol`); reject on shared-latent-factor
collinearity. This is the coup analog of banking's income-proxy control (D2/§11 bar #3 in the
banking cycle) -- it targets V-Dem's rater-hindsight contamination ("this leadership was
clearly fragile -> later had a coup"), the single biggest confound risk in this candidate
list (5/7 candidates + 4/5 run-2 drivers are expert-coded V-Dem series).

Method: for every one of the 207 military_coup positive events, pull each series' raw value
at `event_year - 1` (the same strictly-prior year `extract_features_for_indicator`'s
`last_z` reads -- no leakage, and it directly targets the "moment right before the coup"
where rater-hindsight would show up most). Complete-case only (drop an event if any of the
4-driver block or the candidate is missing at that year). OLS-regress the candidate on the
4-driver block (with intercept); the MULTIPLE correlation R = sqrt(R^2) is the collinearity
statistic. Verdict: `REJECT_COLLINEAR` if R >= `threshold` (default 0.85 -- reusing the
project's OWN existing collinearity bar, `stability_select.ABS_R_THRESHOLD`, which the run-3.1
pilot's `correlation_dedup` already uses for pairwise-indicator collinearity; applied here as
a MULTIPLE-R against a 4-variable block rather than a pairwise r against a single indicator).

Host-only: pandas + numpy + pyarrow (panel parquet reads). No joblib/xgboost/sklearn/scipy --
OLS via `numpy.linalg.lstsq`, so this entire module (including the real-data orchestration)
runs WITHOUT Docker, unlike the coverage screen / coup-trap-alone fit which need the full
`run_f_ml_1_poc` walk machinery.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

DEFAULT_R_THRESHOLD = 0.85  # reuses stability_select.ABS_R_THRESHOLD's collinearity bar
DEFAULT_MIN_N = 30  # below this, a partial-correlation estimate is too noisy to trust

RUN2_VDEM_BLOCK = ["v2excrptps", "v2cltort", "v2xel_frefair", "v2x_clpol"]
FIVE_VDEM_CANDIDATES = [
    "v2exl_legitlead", "v2pepwrses", "v2stcritapparm", "v2strenarm", "OWID_AUTOCRATIZATION",
]

# Verbatim copy of build_coup_trap.normalize_country_id (itself a verbatim copy of
# scripts/run_f_ml_1_poc.py's) -- see that module's docstring for why this is duplicated
# rather than imported (run_f_ml_1_poc needs the full ML stack, not present on host).
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
# Pure lookups + dataset assembly.
# ============================================================================================
def value_at_year(panel: pd.DataFrame, country: str, year: int) -> float | None:
    """Exact (country, year) lookup into a panel DataFrame (`country`, `year`, `value`
    columns). None if no exact row exists (no fallback / no interpolation -- a genuine gap,
    never silently imputed)."""
    hit = panel[(panel["country"] == country) & (panel["year"] == year)]
    if hit.empty:
        return None
    return float(hit["value"].iloc[0])


def build_orthogonality_dataset(
    positives: pd.DataFrame,
    panels: dict[str, pd.DataFrame],
    block_ids: list[str],
    candidate_id: str,
) -> pd.DataFrame:
    """For every (country, event_year) in `positives`, pull each of `block_ids` +
    `candidate_id` at `event_year - 1` (strictly prior -- the coup year itself is never
    read). Complete-case only: an event missing ANY of the block/candidate series at that
    year is dropped. Returns one row per surviving event with columns
    `country, event_year` + one column per series id.
    """
    all_ids = list(block_ids) + [candidate_id]
    rows: list[dict[str, Any]] = []
    for _, r in positives.iterrows():
        country = str(r["country"])
        event_year = int(r["year"])
        lookup_year = event_year - 1
        row: dict[str, Any] = {"country": country, "event_year": event_year}
        complete = True
        for sid in all_ids:
            v = value_at_year(panels[sid], country, lookup_year)
            if v is None:
                complete = False
                break
            row[sid] = v
        if complete:
            rows.append(row)
    if not rows:
        return pd.DataFrame(columns=["country", "event_year", *all_ids])
    return pd.DataFrame(rows)


# ============================================================================================
# Pure OLS (numpy only -- no scipy/sklearn dependency).
# ============================================================================================
def ols_multiple_r2(y: np.ndarray, X: np.ndarray) -> tuple[float, float, np.ndarray, np.ndarray]:
    """OLS-regress `y` on `X` (with an intercept column appended internally). Returns
    `(r2, r, residuals, coefficients)` where `r = sqrt(r2)` is the MULTIPLE correlation
    coefficient (always >= 0) and `coefficients` includes the intercept as its first entry.
    `r2` is clipped to [0, 1] (a numerically negative R^2 -- possible only from a
    near-singular design under float roundoff -- is floored at 0).
    """
    y = np.asarray(y, dtype=float)
    X = np.asarray(X, dtype=float)
    n = len(y)
    design = np.column_stack([np.ones(n), X])
    coef, _residuals_ss, _rank, _sv = np.linalg.lstsq(design, y, rcond=None)
    fitted = design @ coef
    resid = y - fitted
    ss_res = float(np.sum(resid ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    if ss_tot < 1e-12:
        r2 = 0.0  # degenerate: y is constant, no variance to explain
    else:
        r2 = max(0.0, min(1.0, 1.0 - ss_res / ss_tot))
    r = float(np.sqrt(r2))
    return r2, r, resid, coef


# ============================================================================================
# D3 verdict.
# ============================================================================================
def d3_verdict(
    multiple_r: float, threshold: float = DEFAULT_R_THRESHOLD,
    n_rows: int | None = None, min_n: int = DEFAULT_MIN_N,
) -> str:
    """`INSUFFICIENT_DATA` if `n_rows` (when given) is below `min_n`; else `REJECT_COLLINEAR`
    if `multiple_r >= threshold` (a candidate that is essentially a re-expression of the
    run-2 V-Dem block -- shared-latent-factor collinearity), else `PASS_ORTHOGONAL`."""
    if n_rows is not None and n_rows < min_n:
        return "INSUFFICIENT_DATA"
    return "REJECT_COLLINEAR" if multiple_r >= threshold else "PASS_ORTHOGONAL"


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


def run_d3_for_candidate(
    candidate_id: str,
    block_ids: list[str],
    panel_dir: Path,
    positives_csv: Path,
    threshold: float = DEFAULT_R_THRESHOLD,
    min_n: int = DEFAULT_MIN_N,
) -> dict[str, Any]:
    positives = _load_positives(positives_csv)
    all_ids = list(block_ids) + [candidate_id]
    panels = {sid: _load_panel(panel_dir, sid) for sid in all_ids}
    ds = build_orthogonality_dataset(positives, panels, block_ids, candidate_id)
    n_rows = len(ds)
    n_pos_total = len(positives)
    if n_rows == 0:
        return {
            "candidate_id": candidate_id, "block_ids": list(block_ids),
            "n_rows": 0, "n_pos_total": n_pos_total, "coverage_at_positive_cells": 0.0,
            "r2": float("nan"), "multiple_r": float("nan"),
            "verdict": "INSUFFICIENT_DATA", "threshold": threshold,
        }
    y = ds[candidate_id].to_numpy(dtype=float)
    X = ds[block_ids].to_numpy(dtype=float)
    r2, r, _resid, coef = ols_multiple_r2(y, X)
    verdict = d3_verdict(r, threshold=threshold, n_rows=n_rows, min_n=min_n)

    # Pairwise correlations too (transparency: which single block member drives the
    # collinearity, if any).
    pairwise = {
        bid: float(np.corrcoef(ds[bid].to_numpy(dtype=float), y)[0, 1]) for bid in block_ids
    }

    return {
        "candidate_id": candidate_id,
        "block_ids": list(block_ids),
        "n_rows": n_rows,
        "n_pos_total": n_pos_total,
        "coverage_at_positive_cells": n_rows / n_pos_total if n_pos_total else 0.0,
        "r2": r2,
        "multiple_r": r,
        "pairwise_r_vs_block": pairwise,
        "ols_coefficients_intercept_first": [float(c) for c in coef],
        "verdict": verdict,
        "threshold": threshold,
        "min_n": min_n,
    }


def run_d3_all(
    candidates: list[str] = FIVE_VDEM_CANDIDATES,
    block_ids: list[str] = RUN2_VDEM_BLOCK,
    panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    threshold: float = DEFAULT_R_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    here = Path(__file__).resolve().parent
    qgi_ml_root = here.parents[1]
    panel_dir = panel_dir or (qgi_ml_root / "data" / "parquet_panels")
    positives_csv = positives_csv or (
        qgi_ml_root / "data" / "shape_inputs_v2" / "military_coup" / "positives.csv"
    )
    results = {
        c: run_d3_for_candidate(c, block_ids, panel_dir, positives_csv, threshold=threshold)
        for c in candidates
    }
    out = {
        "run2_vdem_block": block_ids,
        "threshold": threshold,
        "candidates": results,
        "survivors": [c for c, r in results.items() if r["verdict"] == "PASS_ORTHOGONAL"],
        "rejected": [c for c, r in results.items() if r["verdict"] == "REJECT_COLLINEAR"],
        "inconclusive": [c for c, r in results.items() if r["verdict"] == "INSUFFICIENT_DATA"],
    }
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[d3_vdem_orthogonality] wrote {out_path}")
    for c, r in results.items():
        print(f"[d3_vdem_orthogonality] {c}: R={r['multiple_r']:.4f} R2={r['r2']:.4f} "
              f"n={r['n_rows']} verdict={r['verdict']}")
    return out


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--threshold", type=float, default=DEFAULT_R_THRESHOLD)
    ap.add_argument("--out", type=Path, default=here / "results" / "d3_vdem_orthogonality_report.json")
    args = ap.parse_args(argv)
    run_d3_all(
        panel_dir=args.panel_dir, positives_csv=args.positives_csv,
        threshold=args.threshold, out_path=args.out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
