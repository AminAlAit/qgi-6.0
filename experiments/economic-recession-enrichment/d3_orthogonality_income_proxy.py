"""D3 -- orthogonality (vs run-2 drivers) + income-proxy screen (economic_recession
enrichment cycle).

Per PRE-REGISTRATION.md (committed 703e440): "D3 orthogonality/income-proxy (run on
`FD.AST.PRVT.GD.ZS` FIRST given its 0.36 correlation)." Two sub-checks, BOTH must pass for
`PASS_ORTHOGONAL`:

  (a) Orthogonality vs run-2's drivers `['v2csreprss', 'v2x_freexp_altinf']` -- OLS multiple-R
      of the candidate regressed on the 2-driver block at event_year-1 (strictly prior, no
      leakage). Threshold 0.5 -- the CHARTER's own canonical bar
      (`qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md` S2:
      "residual-orthogonality (|rho|<0.5 of the derived transform vs the existing drivers)"),
      NOT the stricter 0.85 V-Dem-family shared-latent-factor bar used by
      `experiments/mass-protest-enrichment/d3_vdem_orthogonality.py` (that bar targets a
      DIFFERENT, V-Dem-specific confound class; this candidate family is not V-Dem). This
      targets "is the candidate just a re-expression of the existing run-2 drivers" -- the
      specific risk flagged for `FD.AST.PRVT.GD.ZS` in the pre-reg: |r|~0.36 vs run-2 (this
      module recomputes that exact number as `multiple_r`, confirming pre-reg provenance).
  (b) Income-proxy correlation vs `NY.GNP.PCAP.CD` -- Pearson r, tested as LEVEL AND YoY
      first-difference (both must clear |r|<0.5), same method + threshold as
      `experiments/mass-protest-enrichment/d3a_dev_proxy_correlation.py`. Financial-depth
      indicators (private credit/GDP, M2/GDP) are well-known to correlate mechanically with
      national income level -- if the candidate is really just GNI-per-capita in disguise,
      any apparent recession lift would be a development-proxy mirage (the same confound
      class that killed banking-enrichment attempt #3, GII/development-level).

Host-only: pandas + numpy (no scipy/sklearn/ML stack -- OLS via `numpy.linalg.lstsq`).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

DEFAULT_ORTHOGONALITY_R_THRESHOLD = 0.5   # vs run-2 block -- charter's canonical |rho|<0.5 bar (S2)
DEFAULT_PROXY_R_THRESHOLD = 0.5           # vs income proxy (method-of-record residual-orthogonality bar)
DEFAULT_MIN_N = 30

RUN2_DRIVER_BLOCK = ["v2csreprss", "v2x_freexp_altinf"]
DEV_PROXY_ID = "NY.GNP.PCAP.CD"

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
# Pre-reg sequencing: FD.AST.PRVT.GD.ZS FIRST (its 0.36 correlation flagged the check),
# then its accel3 transform, then FM.LBL.BMNY.GD.ZS + decel3, investment last (sanity only).
CANDIDATES = [CREDIT_INDICATOR_ID, CREDIT_ACCEL_ID, M2_INDICATOR_ID, M2_DECEL_ID,
              INVESTMENT_SANITY_ID]

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
# Pure lookups.
# ============================================================================================
def value_at_year(panel: pd.DataFrame, country: str, year: int) -> float | None:
    """Exact (country, year) lookup into a panel DataFrame (`country`, `year`, `value`
    columns). None if no exact row exists (no fallback / no interpolation)."""
    hit = panel[(panel["country"] == country) & (panel["year"] == year)]
    if hit.empty:
        return None
    return float(hit["value"].iloc[0])


def pearson_r(x: np.ndarray, y: np.ndarray) -> float:
    """Pearson correlation coefficient, pure numpy. NaN if either series has zero variance
    (degenerate -- correlation undefined, never silently reported as 0)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.std() < 1e-12 or y.std() < 1e-12:
        return float("nan")
    return float(np.corrcoef(x, y)[0, 1])


# ============================================================================================
# Pure OLS (numpy only -- no scipy/sklearn dependency). Verbatim method to
# d3_vdem_orthogonality.ols_multiple_r2.
# ============================================================================================
def ols_multiple_r2(y: np.ndarray, X: np.ndarray) -> tuple[float, float, np.ndarray, np.ndarray]:
    """OLS-regress `y` on `X` (with an intercept column appended internally). Returns
    `(r2, r, residuals, coefficients)` where `r = sqrt(r2)` is the MULTIPLE correlation
    coefficient (always >= 0)."""
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
        r2 = 0.0
    else:
        r2 = max(0.0, min(1.0, 1.0 - ss_res / ss_tot))
    r = float(np.sqrt(r2))
    return r2, r, resid, coef


# ============================================================================================
# Dataset assembly -- (a) orthogonality vs run-2 block, at event_year-1, complete-case.
# ============================================================================================
def build_orthogonality_dataset(
    positives: pd.DataFrame,
    panels: dict[str, pd.DataFrame],
    block_ids: list[str],
    candidate_id: str,
) -> pd.DataFrame:
    """For every (country, event_year) in `positives`, pull each of `block_ids` +
    `candidate_id` at `event_year - 1` (strictly prior -- no leakage). Complete-case only."""
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
# Dataset assembly -- (b) income-proxy level + YoY first-difference, complete-case.
# ============================================================================================
def build_level_dataset(
    positives: pd.DataFrame, candidate_panel: pd.DataFrame, proxy_panel: pd.DataFrame,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for _, r in positives.iterrows():
        country, event_year = str(r["country"]), int(r["year"])
        t1 = event_year - 1
        cand_v = value_at_year(candidate_panel, country, t1)
        proxy_v = value_at_year(proxy_panel, country, t1)
        if cand_v is not None and proxy_v is not None:
            rows.append({"country": country, "event_year": event_year,
                         "candidate": cand_v, "proxy": proxy_v})
    return pd.DataFrame(rows, columns=["country", "event_year", "candidate", "proxy"])


def build_yoy_dataset(
    positives: pd.DataFrame, candidate_panel: pd.DataFrame, proxy_panel: pd.DataFrame,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for _, r in positives.iterrows():
        country, event_year = str(r["country"]), int(r["year"])
        t1, t2 = event_year - 1, event_year - 2
        cand_t1 = value_at_year(candidate_panel, country, t1)
        cand_t2 = value_at_year(candidate_panel, country, t2)
        proxy_t1 = value_at_year(proxy_panel, country, t1)
        proxy_t2 = value_at_year(proxy_panel, country, t2)
        if None in (cand_t1, cand_t2, proxy_t1, proxy_t2):
            continue
        rows.append({
            "country": country, "event_year": event_year,
            "candidate_yoy": cand_t1 - cand_t2, "proxy_yoy": proxy_t1 - proxy_t2,
        })
    return pd.DataFrame(rows, columns=["country", "event_year", "candidate_yoy", "proxy_yoy"])


# ============================================================================================
# Combined verdict -- BOTH sub-checks must pass. Run-2-collinearity is checked FIRST
# (arbitrary-but-documented tie-break when both would reject).
# ============================================================================================
def d3_verdict(
    multiple_r: float, r_level: float, r_yoy: float,
    n_ortho: int | None = None, n_level: int | None = None, n_yoy: int | None = None,
    ortho_threshold: float = DEFAULT_ORTHOGONALITY_R_THRESHOLD,
    proxy_threshold: float = DEFAULT_PROXY_R_THRESHOLD,
    min_n: int = DEFAULT_MIN_N,
) -> str:
    """`INSUFFICIENT_DATA` if any sample size is below `min_n`. Else `REJECT_COLLINEAR_RUN2`
    if `multiple_r >= ortho_threshold` (checked first). Else `REJECT_PROXY_CONFOUND` if
    EITHER `|r_level|` or `|r_yoy|` meets/exceeds `proxy_threshold`. Else `PASS_ORTHOGONAL`
    (both sub-checks clear)."""
    for n in (n_ortho, n_level, n_yoy):
        if n is not None and n < min_n:
            return "INSUFFICIENT_DATA"
    if multiple_r != multiple_r:  # NaN guard
        return "INSUFFICIENT_DATA"
    if multiple_r >= ortho_threshold:
        return "REJECT_COLLINEAR_RUN2"
    if r_level != r_level or r_yoy != r_yoy:  # NaN guard (degenerate variance)
        return "INSUFFICIENT_DATA"
    if abs(r_level) >= proxy_threshold or abs(r_yoy) >= proxy_threshold:
        return "REJECT_PROXY_CONFOUND"
    return "PASS_ORTHOGONAL"


# ============================================================================================
# Orchestration (real panel data; host-only, no Docker).
# ============================================================================================
def _load_panel(panel_dir: Path, indicator_id: str) -> pd.DataFrame:
    return pd.read_parquet(panel_dir / indicator_id / f"{indicator_id}.parquet")


def _load_positives(positives_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(positives_csv)
    return pd.DataFrame({
        "country": df["country_id"].apply(normalize_country_id),
        "year": df["event_year"].astype(int),
    })


def run_d3_for_candidate(
    candidate_id: str,
    panel_dir: Path,
    positives_csv: Path,
    main_panel_dir: Path | None = None,
    block_ids: list[str] = RUN2_DRIVER_BLOCK,
    dev_proxy_id: str = DEV_PROXY_ID,
    ortho_threshold: float = DEFAULT_ORTHOGONALITY_R_THRESHOLD,
    proxy_threshold: float = DEFAULT_PROXY_R_THRESHOLD,
    min_n: int = DEFAULT_MIN_N,
) -> dict[str, Any]:
    """`panel_dir` is where `candidate_id` itself lives (main or derived panel_dir);
    `main_panel_dir` (defaults to `panel_dir` if not given) is where the run-2 block +
    income-proxy series live -- always the main World Bank/V-Dem panel_dir, even when the
    candidate itself is a derived transform."""
    main_panel_dir = main_panel_dir or panel_dir
    positives = _load_positives(positives_csv)
    candidate_panel = _load_panel(panel_dir, candidate_id)
    block_panels = {bid: _load_panel(main_panel_dir, bid) for bid in block_ids}
    proxy_panel = _load_panel(main_panel_dir, dev_proxy_id)

    # (a) orthogonality vs run-2 block.
    ortho_panels = {**block_panels, candidate_id: candidate_panel}
    ortho_ds = build_orthogonality_dataset(positives, ortho_panels, block_ids, candidate_id)
    n_ortho = len(ortho_ds)
    if n_ortho > 0:
        y_ortho = ortho_ds[candidate_id].to_numpy(dtype=float)
        X_ortho = ortho_ds[block_ids].to_numpy(dtype=float)
        r2, multiple_r, _resid, _coef = ols_multiple_r2(y_ortho, X_ortho)
        pairwise = {bid: float(np.corrcoef(ortho_ds[bid].to_numpy(dtype=float), y_ortho)[0, 1])
                    for bid in block_ids}
    else:
        r2, multiple_r, pairwise = float("nan"), float("nan"), {}

    # (b) income-proxy level + YoY.
    level_ds = build_level_dataset(positives, candidate_panel, proxy_panel)
    yoy_ds = build_yoy_dataset(positives, candidate_panel, proxy_panel)
    r_level = pearson_r(level_ds["candidate"], level_ds["proxy"]) if len(level_ds) else float("nan")
    r_yoy = pearson_r(yoy_ds["candidate_yoy"], yoy_ds["proxy_yoy"]) if len(yoy_ds) else float("nan")

    verdict = d3_verdict(
        multiple_r, r_level, r_yoy,
        n_ortho=n_ortho, n_level=len(level_ds), n_yoy=len(yoy_ds),
        ortho_threshold=ortho_threshold, proxy_threshold=proxy_threshold, min_n=min_n,
    )

    n_pos_total = len(positives)
    return {
        "candidate_id": candidate_id,
        "n_pos_total": n_pos_total,
        "orthogonality_vs_run2": {
            "block_ids": list(block_ids), "n_rows": n_ortho,
            "coverage_at_positive_cells": n_ortho / n_pos_total if n_pos_total else 0.0,
            "r2": r2, "multiple_r": multiple_r, "pairwise_r_vs_block": pairwise,
            "threshold": ortho_threshold,
        },
        "income_proxy": {
            "proxy_id": dev_proxy_id,
            "level": {"n_rows": len(level_ds), "r": r_level,
                      "coverage_at_positive_cells": len(level_ds) / n_pos_total if n_pos_total else 0.0},
            "yoy_first_diff": {"n_rows": len(yoy_ds), "r": r_yoy,
                                "coverage_at_positive_cells": len(yoy_ds) / n_pos_total if n_pos_total else 0.0},
            "threshold": proxy_threshold,
        },
        "min_n": min_n,
        "verdict": verdict,
    }


def run_d3_all(
    candidates: list[str] = CANDIDATES,
    main_panel_dir: Path | None = None,
    derived_panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    ortho_threshold: float = DEFAULT_ORTHOGONALITY_R_THRESHOLD,
    proxy_threshold: float = DEFAULT_PROXY_R_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    here = Path(__file__).resolve().parent
    qgi_ml_root = here.parents[1]
    main_panel_dir = main_panel_dir or (qgi_ml_root / "data" / "parquet_panels")
    derived_panel_dir = derived_panel_dir or (here / "credit_m2_panel_dir")
    positives_csv = positives_csv or (
        qgi_ml_root / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"
    )

    results: dict[str, Any] = {}
    for cid in candidates:
        src_dir = derived_panel_dir if CANDIDATE_SOURCE.get(cid, "main") == "derived" else main_panel_dir
        results[cid] = run_d3_for_candidate(
            cid, src_dir, positives_csv, main_panel_dir=main_panel_dir,
            ortho_threshold=ortho_threshold, proxy_threshold=proxy_threshold,
        )

    out = {
        "run2_driver_block": RUN2_DRIVER_BLOCK,
        "dev_proxy_id": DEV_PROXY_ID,
        "ortho_threshold": ortho_threshold,
        "proxy_threshold": proxy_threshold,
        "candidates": results,
        "survivors": [c for c, r in results.items() if r["verdict"] == "PASS_ORTHOGONAL"],
        "rejected_collinear_run2": [c for c, r in results.items() if r["verdict"] == "REJECT_COLLINEAR_RUN2"],
        "rejected_proxy_confound": [c for c, r in results.items() if r["verdict"] == "REJECT_PROXY_CONFOUND"],
        "inconclusive": [c for c, r in results.items() if r["verdict"] == "INSUFFICIENT_DATA"],
    }
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[d3_orthogonality_income_proxy] wrote {out_path}")
    for cid, r in results.items():
        o, p = r["orthogonality_vs_run2"], r["income_proxy"]
        print(
            f"[d3_orthogonality_income_proxy] {cid}: run2_R={o['multiple_r']:.4f} "
            f"proxy_r_level={p['level']['r']:.4f} proxy_r_yoy={p['yoy_first_diff']['r']:.4f} "
            f"verdict={r['verdict']}"
        )
    return out


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--main-panel-dir", type=Path, default=None)
    ap.add_argument("--derived-panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--ortho-threshold", type=float, default=DEFAULT_ORTHOGONALITY_R_THRESHOLD)
    ap.add_argument("--proxy-threshold", type=float, default=DEFAULT_PROXY_R_THRESHOLD)
    ap.add_argument("--out", type=Path, default=here / "results" / "d3_orthogonality_income_proxy_report.json")
    args = ap.parse_args(argv)
    run_d3_all(
        main_panel_dir=args.main_panel_dir, derived_panel_dir=args.derived_panel_dir,
        positives_csv=args.positives_csv, ortho_threshold=args.ortho_threshold,
        proxy_threshold=args.proxy_threshold, out_path=args.out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
