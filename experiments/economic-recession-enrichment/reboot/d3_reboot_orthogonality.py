"""D3 -- orthogonality (vs run-2 drivers) + income-proxy screen for the OECD-SCOPED REBOOT's
two coverage-surviving candidates (BIS.SPP.REAL.YOY, COMMODITY_SHOCK.EXPORT_WEIGHTED), on the
OECD-scoped 67-event positives subset (not the full 250 -- these are OECD-targeted candidates,
scored against the scope they're meant for, per this reboot's own convention).

Reuses `../d3_orthogonality_income_proxy.py`'s pure functions VERBATIM (imported, never
reimplemented): `value_at_year`, `pearson_r`, `ols_multiple_r2`, `build_orthogonality_dataset`,
`build_level_dataset`, `build_yoy_dataset`, `d3_verdict`, `RUN2_DRIVER_BLOCK`, `DEV_PROXY_ID`.
Only the candidate set + positives-scoping are new to this cycle.

Host-only: pandas + numpy (no scipy/sklearn/ML stack -- OLS via `numpy.linalg.lstsq`, same as
the parent module).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

_HERE = Path(__file__).resolve().parent
_PARENT_EXPERIMENT_DIR = _HERE.parent  # economic-recession-enrichment/ (has d3_orthogonality_income_proxy.py)
_QGI_ML_ROOT = _HERE.parents[2]
if str(_PARENT_EXPERIMENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_EXPERIMENT_DIR))

from d3_orthogonality_income_proxy import (  # noqa: E402  (path-injected import, see above)
    DEFAULT_ORTHOGONALITY_R_THRESHOLD,
    DEFAULT_PROXY_R_THRESHOLD,
    DEV_PROXY_ID,
    RUN2_DRIVER_BLOCK,
    build_level_dataset,
    build_orthogonality_dataset,
    build_yoy_dataset,
    d3_verdict,
    ols_multiple_r2,
    pearson_r,
)
from oecd_scope import filter_positives_to_oecd_scope  # noqa: E402
from screen_coverage_reboot import normalize_country_id  # noqa: E402  (re-exported from ../screen_coverage.py)

CANDIDATES = ["BIS.SPP.REAL.YOY", "COMMODITY_SHOCK.EXPORT_WEIGHTED"]


def _load_positives_oecd_scoped(positives_csv: Path) -> pd.DataFrame:
    raw = pd.read_csv(positives_csv)
    scoped_raw = filter_positives_to_oecd_scope(raw)
    return pd.DataFrame(
        {
            "country": scoped_raw["country_id"].apply(normalize_country_id),
            "year": scoped_raw["event_year"].astype(int),
        }
    )


def _load_panel(panel_dir: Path, indicator_id: str) -> pd.DataFrame:
    return pd.read_parquet(panel_dir / indicator_id / f"{indicator_id}.parquet")


def run_d3_for_candidate_scoped(
    candidate_id: str,
    reboot_panel_dir: Path,
    main_panel_dir: Path,
    positives_csv: Path,
    block_ids: list[str] = RUN2_DRIVER_BLOCK,
    dev_proxy_id: str = DEV_PROXY_ID,
    ortho_threshold: float = DEFAULT_ORTHOGONALITY_R_THRESHOLD,
    proxy_threshold: float = DEFAULT_PROXY_R_THRESHOLD,
    min_n: int = 30,
) -> dict[str, Any]:
    positives = _load_positives_oecd_scoped(positives_csv)
    candidate_panel = _load_panel(reboot_panel_dir, candidate_id)
    block_panels = {bid: _load_panel(main_panel_dir, bid) for bid in block_ids}
    proxy_panel = _load_panel(main_panel_dir, dev_proxy_id)

    ortho_panels = {**block_panels, candidate_id: candidate_panel}
    ortho_ds = build_orthogonality_dataset(positives, ortho_panels, block_ids, candidate_id)
    n_ortho = len(ortho_ds)
    if n_ortho > 0:
        y_ortho = ortho_ds[candidate_id].to_numpy(dtype=float)
        X_ortho = ortho_ds[block_ids].to_numpy(dtype=float)
        r2, multiple_r, _resid, _coef = ols_multiple_r2(y_ortho, X_ortho)
        pairwise = {bid: pearson_r(ortho_ds[bid].to_numpy(dtype=float), y_ortho) for bid in block_ids}
    else:
        r2, multiple_r, pairwise = float("nan"), float("nan"), {}

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
        "scope": "oecd_scoped",
        "n_pos_total_scoped": n_pos_total,
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


def run_d3_all_scoped(
    candidates: list[str] = CANDIDATES,
    reboot_panel_dir: Path | None = None,
    main_panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    ortho_threshold: float = DEFAULT_ORTHOGONALITY_R_THRESHOLD,
    proxy_threshold: float = DEFAULT_PROXY_R_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    reboot_panel_dir = reboot_panel_dir or (_HERE / "panel_dir")
    main_panel_dir = main_panel_dir or (_QGI_ML_ROOT / "data" / "parquet_panels")
    positives_csv = positives_csv or (
        _QGI_ML_ROOT / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"
    )

    results = {
        cid: run_d3_for_candidate_scoped(
            cid, reboot_panel_dir, main_panel_dir, positives_csv,
            ortho_threshold=ortho_threshold, proxy_threshold=proxy_threshold,
        )
        for cid in candidates
    }
    out = {
        "scope": "oecd_scoped",
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
        print(f"[d3_reboot_orthogonality] wrote {out_path}")
    for cid, r in results.items():
        o, p = r["orthogonality_vs_run2"], r["income_proxy"]
        print(
            f"[d3_reboot_orthogonality] {cid}: run2_R={o['multiple_r']:.4f} "
            f"proxy_r_level={p['level']['r']:.4f} proxy_r_yoy={p['yoy_first_diff']['r']:.4f} "
            f"verdict={r['verdict']}"
        )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reboot-panel-dir", type=Path, default=None)
    ap.add_argument("--main-panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=_HERE / "results" / "d3_reboot_orthogonality_report.json")
    args = ap.parse_args(argv)
    run_d3_all_scoped(
        reboot_panel_dir=args.reboot_panel_dir, main_panel_dir=args.main_panel_dir,
        positives_csv=args.positives_csv, out_path=args.out,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
