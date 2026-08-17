"""EXPLORATORY (NOT adoptable) yield-curve + house-prices-alone probe for economic_recession.

⚠️ Both candidates here are tested BELOW the pre-registered D1 coverage gate on purpose:
  * OECD.TERM_SPREAD (the yield curve) FAILED D1 — 64.2% t1&t2 on the 67-event OECD-scoped set
    (`results/yieldcurve_coverage_scoped.json`); 15/24 misses have BOTH rate legs absent, so no
    fallback rescues it above ~72%. Per the reboot pre-registration it is therefore NOT
    adoptable regardless of the number below. This run answers only the residual question the
    founder explicitly asked: "does the yield curve show ANY signal on the events it DOES
    cover?" — reported as EXPLORATORY, coverage-caveated, never as a passing result.
  * BIS.SPP.REAL.YOY (real house-price YoY) PASSED D1 (82.1%) but in the main reboot was only
    tested BUNDLED with the commodity-shock indicator; this isolates it (the pending
    "house-prices-ALONE re-test").

Mechanism: monkeypatch `run_scoped_battery`'s module-level RECIPE/NEW_INDICATORS so the exact
same battery (coverage-matched baseline via row-aligned `pair_oof`, guard #2 2008
era-decomposition, guard #4 lag-decay) runs with each lead as the sole new indicator over
run-2's 2 drivers. Docker-only (xgboost/sklearn/scipy via qgi-run31-pilot:py313).
"""
from __future__ import annotations

import json
from pathlib import Path

import run_scoped_battery as rb

HERE = Path(__file__).resolve().parent


def run_one(new_inds: list[str], tag: str) -> dict:
    rb.NEW_INDICATORS = new_inds
    rb.RECIPE = rb.RUN2_DRIVERS + new_inds
    out = HERE / "results" / f"exploratory_{tag}.json"
    report = rb.run_battery(out_path=out)
    return report


def _summ(tag: str, r: dict) -> dict:
    g1 = r.get("guard1_scoped_baseline_vs_candidate", r)
    delta = g1.get("delta_main") or r.get("delta_main") or {}
    era = r.get("guard2_era_decomposition") or r.get("era") or {}
    return {"tag": tag, "delta_keys": list(delta.keys())[:12], "report_keys": list(r.keys())}


def main() -> int:
    summaries = {}
    for new_inds, tag in [(["OECD.TERM_SPREAD"], "yieldcurve"), (["BIS.SPP.REAL.YOY"], "houseprices_alone")]:
        print(f"\n===================== EXPLORATORY: {tag} =====================")
        rep = run_one(new_inds, tag)
        summaries[tag] = _summ(tag, rep)
        print(f"[{tag}] top-level report keys: {list(rep.keys())}")
    (HERE / "results" / "exploratory_summary_keys.json").write_text(
        json.dumps(summaries, indent=2, default=str), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
