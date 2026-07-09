"""P1 — enforce the two hard screening gates (G1 coverage, G2 orthogonality) on every
candidate derived transform BEFORE any candidate is allowed near an AUC run.

Per the banking-enrichment brief and `PLAN.md` §2 steps 3 + 5:

  G1 COVERAGE-AT-POSITIVE-CELLS: fraction of the 76 positive (country, event_year) banking
     crises for which the candidate panel is non-null at BOTH event_year-1 AND event_year-2.
     Require >= 0.80. These are exactly the two years the production walk's own
     `extract_features_for_indicator` window (`[year-window, year-1]`) would actually
     consume for a sample at `year=event_year` -- see `build_features.py`'s leakage-guarantee
     docstring for why checking these two specific years (rather than the raw panel's overall
     density) is the correct, non-redundant coverage measure.

  G2 RESIDUAL-ORTHOGONALITY: across the full aligned (country, year) panel, Pearson |rho| of
     the candidate vs EACH of the 3 run-2 banking drivers (NV.SRV.TOTL.ZS, v2x_gender,
     MS.MIL.XPND.GD.ZS), plus R^2 of the candidate regressed (OLS, closed-form via numpy
     lstsq -- no sklearn needed for a 3-variable regression) on all three simultaneously.
     Reject if max|rho| > 0.5.

A candidate that fails EITHER gate is marked `passes_both_gates: false` and MUST NOT be fed
into an AUC run (enforced here by simply never invoking any AUC/walk code -- this script does
not import `run_f_ml_1_poc` or `stability_select` at all; the gate check is fully
self-contained arithmetic on the panels, so there is no code path by which a failing
candidate's AUC could even be computed by this script).

Positives: `normalize_country_id` is REIMPLEMENTED here verbatim (not imported) so this
screen has zero dependency on the walk stack — it only needs pandas + numpy, and can run
standalone or inside the pilot image identically. Kept byte-identical to
`scripts/run_f_ml_1_poc.normalize_country_id` (see the docstring there); if that function
ever changes, update this copy too (there are only 4 override entries, low drift risk, and a
unit-testable pure function either way).

Run inside the pinned pilot image:
    docker run --rm -v <repo>/qgi-ml:/work/qgi-ml qgi-run31-pilot:py313 bash -c \
        "cd /work/qgi-ml/experiments/banking-enrichment/p1 && python screen.py"
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
CANDIDATES_DIR = HERE / "candidates"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / "banking_and_financial_crisis" / "positives.csv"
RESULTS_DIR = HERE / "results"

RUN2_DRIVERS = ["NV.SRV.TOTL.ZS", "v2x_gender", "MS.MIL.XPND.GD.ZS"]
G1_COVERAGE_MIN = 0.80
G2_MAX_ABS_RHO = 0.5

# Candidates built by build_features.py, tagged with their mechanism per PLAN.md §3.
CANDIDATES: dict[str, dict] = {
    "credit_gap_1s_fd": {
        "mechanism": "credit (domestic bank credit boom)",
        "source_series": "FD.AST.PRVT.GD.ZS (local cache)",
        "construction": "one-sided (real-time) HP-filter gap, lambda=1600, >=5 prior yrs",
    },
    "credit_gap_1s_fs": {
        "mechanism": "credit (total financial-system credit boom)",
        "source_series": "FS.AST.PRVT.GD.ZS (WB API pull)",
        "construction": "one-sided (real-time) HP-filter gap, lambda=1600, >=5 prior yrs",
    },
    "credit_growth_3y_fd": {
        "mechanism": "credit (domestic bank credit boom) -- leakage-proof fallback",
        "source_series": "FD.AST.PRVT.GD.ZS (local cache)",
        "construction": "level_t - level_(t-3), no filter",
    },
    "credit_growth_3y_fs": {
        "mechanism": "credit (total financial-system credit boom) -- leakage-proof fallback",
        "source_series": "FS.AST.PRVT.GD.ZS (WB API pull)",
        "construction": "level_t - level_(t-3), no filter",
    },
    "stdebt_reserves": {
        "mechanism": "external fragility (Guidotti-Greenspan rollover risk)",
        "source_series": "DT.DOD.DSTC.IR.ZS (WB API pull, already the target ratio)",
        "construction": "point-in-time short-term-debt / reserves ratio, as published",
    },
    "m2_reserves": {
        "mechanism": "external fragility (bank-run / currency-crisis vulnerability)",
        "source_series": "FM.LBL.BMNY.GD.ZS x NY.GDP.MKTP.CD / FI.RES.TOTL.CD (local cache)",
        "construction": "M2 (%GDP) converted to current US$ via GDP(current US$), "
                          "then ratio to reserves (current US$) -- unit-harmonized",
    },
}

# Overrides where positives.csv's `country_id.replace('_',' ').title()` does not match the
# panel's Title-Case country name (verbatim copy of run_f_ml_1_poc.COUNTRY_NAME_OVERRIDES).
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
# G1 — coverage at positive cells
# ============================================================================================
def load_positives() -> pd.DataFrame:
    pos = pd.read_csv(POSITIVES_CSV)
    pos["country"] = pos["country_id"].apply(normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    return pos[["country", "year"]]


def g1_coverage(candidate_df: pd.DataFrame, positives: pd.DataFrame) -> dict:
    """Fraction of the 76 positive events for which the candidate is non-null at BOTH
    event_year-1 AND event_year-2. Reports the per-event pass/fail list (not just the
    aggregate %) so a reviewer can see exactly which crisis-years are covered."""
    have = set(zip(candidate_df["country"], candidate_df["year"]))
    per_event = []
    n_pass = 0
    for _, row in positives.iterrows():
        country, year = row["country"], int(row["year"])
        has_t1 = (country, year - 1) in have
        has_t2 = (country, year - 2) in have
        ok = has_t1 and has_t2
        n_pass += int(ok)
        per_event.append(
            {"country": country, "event_year": year, "t1_present": has_t1,
             "t2_present": has_t2, "pass": ok}
        )
    n_total = len(positives)
    coverage_pct = n_pass / n_total if n_total else 0.0
    return {
        "coverage_pct": coverage_pct,
        "n_pass": n_pass,
        "n_total": n_total,
        "gate_pass": coverage_pct >= G1_COVERAGE_MIN,
        "threshold": G1_COVERAGE_MIN,
        "per_event": per_event,
    }


# ============================================================================================
# G2 — residual orthogonality vs the 3 run-2 drivers
# ============================================================================================
def pearson_rho(a: pd.DataFrame, b: pd.DataFrame) -> tuple[float, int]:
    """Pearson r of two (country, year, value) panels on their (country, year) intersection.
    Returns (rho, n_common_rows); rho is NaN if fewer than 3 common rows or either side is
    constant on the overlap."""
    merged = a.merge(b, on=["country", "year"], suffixes=("_a", "_b")).dropna(
        subset=["value_a", "value_b"]
    )
    n = len(merged)
    if n < 3:
        return float("nan"), n
    va, vb = merged["value_a"].to_numpy(dtype=float), merged["value_b"].to_numpy(dtype=float)
    if np.std(va) < 1e-12 or np.std(vb) < 1e-12:
        return float("nan"), n
    rho = float(np.corrcoef(va, vb)[0, 1])
    return rho, n


def g2_orthogonality(candidate_df: pd.DataFrame, driver_panels: dict[str, pd.DataFrame]) -> dict:
    """Pairwise |rho| vs each of the 3 run-2 drivers, plus R^2 of the candidate regressed on
    all 3 simultaneously (OLS via numpy.linalg.lstsq on the (country, year) rows where the
    candidate AND all 3 drivers are jointly non-null — the "full aligned panel")."""
    pair_results = {}
    max_abs_rho = 0.0
    for drv_id, drv_df in driver_panels.items():
        rho, n_common = pearson_rho(candidate_df, drv_df)
        pair_results[drv_id] = {"rho": rho, "n_common": n_common}
        if rho == rho:  # not NaN
            max_abs_rho = max(max_abs_rho, abs(rho))

    # Joint R^2: inner-join candidate with ALL 3 drivers on (country, year).
    merged = candidate_df.rename(columns={"value": "y"})
    for drv_id, drv_df in driver_panels.items():
        merged = merged.merge(
            drv_df.rename(columns={"value": drv_id}), on=["country", "year"], how="inner"
        )
    merged = merged.dropna(subset=["y"] + list(driver_panels))
    n_joint = len(merged)
    r2 = float("nan")
    if n_joint >= 5:
        y = merged["y"].to_numpy(dtype=float)
        X = np.column_stack(
            [np.ones(n_joint)] + [merged[d].to_numpy(dtype=float) for d in driver_panels]
        )
        # Guard against a degenerate (rank-deficient) design on a tiny/collinear overlap.
        coefs, _res, rank, _sv = np.linalg.lstsq(X, y, rcond=None)
        if rank == X.shape[1]:
            y_hat = X @ coefs
            ss_res = float(np.sum((y - y_hat) ** 2))
            ss_tot = float(np.sum((y - y.mean()) ** 2))
            r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-12 else float("nan")

    return {
        "pairwise": pair_results,
        "max_abs_rho": max_abs_rho,
        "joint_r2_vs_all_3_drivers": r2,
        "n_joint_rows": n_joint,
        "gate_pass": max_abs_rho <= G2_MAX_ABS_RHO,
        "threshold": G2_MAX_ABS_RHO,
    }


# ============================================================================================
# Orchestration
# ============================================================================================
def main() -> int:
    positives = load_positives()
    driver_panels = {
        drv: pd.read_parquet(PANEL_DIR / drv / f"{drv}.parquet")[["country", "year", "value"]]
        for drv in RUN2_DRIVERS
    }

    report: dict = {
        "run2_baseline_loco_auc": 0.7707246376811594,
        "run2_drivers": RUN2_DRIVERS,
        "g1_coverage_min": G1_COVERAGE_MIN,
        "g2_max_abs_rho": G2_MAX_ABS_RHO,
        "n_positives": len(positives),
        "candidates": {},
    }

    print(f"{'candidate':<24} {'mechanism':<45} {'G1 cov%':>8} {'G1':>5} "
          f"{'max|rho|':>9} {'R2':>7} {'G2':>5} {'BOTH':>6}")
    for cid, meta in CANDIDATES.items():
        cpath = CANDIDATES_DIR / cid / f"{cid}.parquet"
        cdf = pd.read_parquet(cpath)[["country", "year", "value"]]

        g1 = g1_coverage(cdf, positives)
        g2 = g2_orthogonality(cdf, driver_panels)
        both = g1["gate_pass"] and g2["gate_pass"]

        report["candidates"][cid] = {
            **meta,
            "parquet_path": str(cpath.relative_to(QGI_ML_ROOT)),
            "n_rows": len(cdf),
            "n_countries": int(cdf["country"].nunique()),
            "g1_coverage": g1,
            "g2_orthogonality": g2,
            "passes_both_gates": both,
        }
        print(
            f"{cid:<24} {meta['mechanism'][:44]:<45} "
            f"{g1['coverage_pct']*100:7.1f}% {'PASS' if g1['gate_pass'] else 'FAIL':>5} "
            f"{g2['max_abs_rho']:9.3f} {g2['joint_r2_vs_all_3_drivers']:7.3f} "
            f"{'PASS' if g2['gate_pass'] else 'FAIL':>5} {'PASS' if both else 'FAIL':>6}"
        )

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS_DIR / "p1_screen_report.json"

    def _json_safe(o):
        if isinstance(o, float):
            return None if (o != o or o in (float("inf"), float("-inf"))) else o
        if isinstance(o, dict):
            return {k: _json_safe(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [_json_safe(v) for v in o]
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return _json_safe(float(o))
        if isinstance(o, (np.bool_,)):
            return bool(o)
        return o

    out_path.write_text(json.dumps(_json_safe(report), indent=2), encoding="utf-8")
    print(f"\n[screen] wrote {out_path}")

    n_survivors = sum(1 for c in report["candidates"].values() if c["passes_both_gates"])
    print(f"[screen] {n_survivors}/{len(CANDIDATES)} candidates pass BOTH gates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
