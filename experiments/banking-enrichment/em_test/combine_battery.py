"""§11 final combiner -- applies BH-FDR jointly across the <=3 scored candidates (D6's
second half) and produces the final D1-D7 AND verdict per candidate (PLAN.md §11 acceptance
bar). Reuses `score_pilot.bh_fdr` (never reimplemented) and `run_full_battery`'s D6 pure
gate (`d6_gate_pass`) / `all_seven_and`.

Run AFTER `run_full_battery.py` has produced one `battery_<indicator>_<subset>.json` per
candidate -- this script only reads those + applies FDR across their D6 p-values, then
writes the final per-candidate verdict + emits the §11 headline table.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
for _p in (HERE, PILOT_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import run_full_battery as rb  # noqa: E402 (pure gate functions only -- no heavy ML import at module scope)

FDR_Q = 0.10  # PLAN.md §11 does not pin a specific q; 0.10 is the repo's conventional default
              # (matches score_pilot's own criteria.yaml precedent) -- explicitly noted as a
              # SECONDARY safeguard per §11 bar #6, not the primary defense (the AND-gate is).


def combine(batteries: list[dict[str, Any]], fdr_q: float = FDR_Q) -> list[dict[str, Any]]:
    """`score_pilot.bh_fdr` needs its own import (host-testable pure stdlib) -- imported here
    rather than at module scope so this module's pure combiner logic stays testable without
    even score_pilot's numpy-adjacent deps (it has none, but keeps the DI pattern consistent
    with the rest of em_test/)."""
    import score_pilot as sp  # noqa: E402

    pvals = [
        b["d6_country_block_bootstrap_provisional"]["delta"]["p_value"] for b in batteries
    ]
    # bh_fdr needs finite p-values; a NaN/degenerate delta (e.g. single-class bootstrap
    # collapse) is treated as p=1.0 (never rejects) rather than crashing the whole combine.
    safe_pvals = [p if (p == p and p is not None) else 1.0 for p in pvals]
    reject_flags, _adj = sp.bh_fdr(safe_pvals, fdr_q)

    combined: list[dict[str, Any]] = []
    for b, fdr_reject in zip(batteries, reject_flags):
        d6 = b["d6_country_block_bootstrap_provisional"]
        ci_lo = d6["delta"]["ci95_lo"]
        d6_final_pass = rb.d6_gate_pass(ci_lo, fdr_reject)
        d7 = b["d7_temporal_holdout"]
        gates = {
            "d1": bool(b["d1_coverage_matched_baseline"]["gate_pass"]),
            "d2": bool(b["d2_missingness_placebo"]["gate_pass"]),
            "d3": bool(b["d3_income_proxy_beaten"]["gate_pass"]),
            "d4": bool(b["d4_era_2008_decomposition"]["gate_pass"]),
            "d5": bool(b["d5_per_country_named_twins"]["gate_pass"]),
            "d6": bool(d6_final_pass),
            "d7": bool(d7["gate_pass"]),
        }
        entry = dict(b)
        entry["d6_final"] = {
            "gate_pass": d6_final_pass, "fdr_reject": bool(fdr_reject),
            "fdr_q": fdr_q, "p_value": d6["delta"]["p_value"],
        }
        entry["gates"] = gates
        entry["passes_all_7"] = rb.all_seven_and(gates)
        combined.append(entry)
    return combined


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--battery-jsons", type=Path, nargs="+", required=True)
    ap.add_argument("--fdr-q", type=float, default=FDR_Q)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "em_test_final_verdict.json")
    args = ap.parse_args(argv)

    batteries = [json.loads(p.read_text(encoding="utf-8")) for p in args.battery_jsons]
    combined = combine(batteries, fdr_q=args.fdr_q)

    any_pass = any(e["passes_all_7"] for e in combined)
    out = {"fdr_q": args.fdr_q, "candidates": combined, "any_candidate_clears_all_7": any_pass}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"[combine_battery] wrote {args.out}")
    for e in combined:
        print(
            f"[combine_battery] {e['indicator_id']}/{e['subset']}: gates={e['gates']} "
            f"PASSES_ALL_7={e['passes_all_7']}"
        )
    print(f"[combine_battery] any_candidate_clears_all_7={any_pass}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
