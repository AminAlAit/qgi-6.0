"""Top-level driver for the military_coup 7-gate battery: runs `run_candidate_battery.py`
for all 6 screen survivors, applies joint BH-FDR across their D6 p-values
(`battery_gates.combine_with_fdr`), and writes the final per-candidate AND-gate verdict
(`results/FINAL-VERDICT.json`).

Docker-only (delegates the heavy per-candidate work to `run_candidate_battery`).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
for _p in (HERE,):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import battery_gates as bg  # noqa: E402
import run_candidate_battery as rcb  # noqa: E402

SCREEN_SURVIVORS = [
    "v2exl_legitlead", "v2pepwrses", "v2stcritapparm", "v2strenarm",
    "OWID_AUTOCRATIZATION", "NY.GDP.MKTP.KD.ZG",
]
FDR_Q = 0.10


def run_all(
    candidates: list[str] = SCREEN_SURVIVORS,
    out_dir: Path | None = None,
    fdr_q: float = FDR_Q,
) -> dict[str, Any]:
    out_dir = out_dir or (HERE / "results")
    out_dir.mkdir(parents=True, exist_ok=True)

    per_candidate: dict[str, dict[str, Any]] = {}
    for cand in candidates:
        per_candidate[cand] = rcb.run_battery_for_candidate(
            cand, out_path=out_dir / f"battery_{cand}.json",
        )

    # --- Joint BH-FDR across the D6 paired-bootstrap p-values (D6's second half). ---
    pvals = {
        c: per_candidate[c]["d6_country_block_bootstrap_provisional"]["delta_vs_baseline"]["p_value"]
        for c in candidates
    }
    fdr = bg.combine_with_fdr(pvals, fdr_q=fdr_q)

    final: dict[str, Any] = {"fdr_q": fdr_q, "candidates": {}, "any_candidate_clears_all_7": False}
    any_pass = False
    for c in candidates:
        rep = per_candidate[c]
        ci_lo = rep["d6_country_block_bootstrap_provisional"]["delta_vs_baseline"]["ci95_lo"]
        d6_final_pass = bg.d6_gate_pass(ci_lo, fdr[c]["reject"])
        gates = {
            "d1": bool(rep["d1_coverage_matched_baseline"]["gate_pass"]),
            "d2": bool(rep["d2_missingness_placebo"]["gate_pass"]),
            "d3": bool(rep["d3_vdem_orthogonality"]["gate_pass"]),
            "d4": bool(rep["d4_over_couptrap_baseline"]["gate_pass"]),
            "d5": bool(rep["d5_per_country"]["gate_pass"]),
            "d6": bool(d6_final_pass),
            "d7": bool(rep["d7_temporal_holdout"]["gate_pass"]),
        }
        passes_all_7 = bg.all_seven_and(gates)
        any_pass = any_pass or passes_all_7
        final["candidates"][c] = {
            "candidate_id": c,
            "recipe_auc": rep["recipe_fit"]["loco_auc"],
            "baseline_auc": rep["baseline"]["loco_auc"],
            "delta_vs_baseline": rep["d6_country_block_bootstrap_provisional"]["delta_vs_baseline"],
            "d6_fdr": fdr[c],
            "d6_final_pass": d6_final_pass,
            "gates": gates,
            "passes_all_7": passes_all_7,
            "d7_advisory": rep["d7_temporal_holdout"].get("advisory"),
        }
    final["any_candidate_clears_all_7"] = any_pass

    out_path = out_dir / "FINAL-VERDICT.json"
    out_path.write_text(json.dumps(final, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"[run_all_candidates] wrote {out_path}")
    for c in candidates:
        e = final["candidates"][c]
        print(f"[run_all_candidates] {c}: gates={e['gates']} PASSES_ALL_7={e['passes_all_7']}")
    print(f"[run_all_candidates] any_candidate_clears_all_7={any_pass}")
    return final


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--candidates", nargs="+", default=SCREEN_SURVIVORS)
    ap.add_argument("--out-dir", type=Path, default=None)
    ap.add_argument("--fdr-q", type=float, default=FDR_Q)
    args = ap.parse_args(argv)
    run_all(args.candidates, args.out_dir, args.fdr_q)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
