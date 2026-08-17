"""Turn `results/fleet_audit.json` into (1) a full ranked scorecard, (2) the flagged subset
that needs a frontend live-number correction, and (3) a fragility list (high seed-variance
recipes whose honest number is unstable). Host-only (reads JSON). Run AFTER audit_fleet.py."""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIT = HERE / "results" / "fleet_audit.json"

# Cards that exist in the repo but were TAKEN DOWN from the live site (founder, 2026-07-11):
# black-swan events QGI does not claim to predict. Re-measured for completeness but excluded
# from the live-mirage correction scope — they need no frontend action (already removed).
REMOVED_NOT_LIVE = {"epidemic_and_pandemic", "natural_disaster"}


def main() -> int:
    rows = json.loads(AUDIT.read_text(encoding="utf-8"))
    for r in rows:
        r["live"] = r.get("trend") not in REMOVED_NOT_LIVE
    scored = [r for r in rows if r.get("delta") is not None and r["live"]]
    removed = [r for r in rows if r.get("delta") is not None and not r["live"]]
    scored.sort(key=lambda r: r["delta"])  # most-inflated (most negative delta) first

    print("=" * 96)
    print(f"{'trend':32s} {'ship':>6s} {'honest':>7s} {'mean':>6s} {'sd':>5s} {'delta':>7s} {'dom':>5s} verdict")
    print("-" * 96)
    for r in scored:
        print(f"{r['trend']:32s} {r['shipped']:>6.3f} {r['honest']:>7.3f} "
              f"{r['honest_mean']:>6.3f} {r['honest_sd']:>5.3f} {r['delta']:>+7.3f} "
              f"{str(r.get('single_country_dominance','')):>5s} {r['verdict']}")

    mirage = [r for r in scored if r["verdict"] == "MIRAGE"]
    infl = [r for r in scored if r["verdict"] == "INFLATED"]
    fragile = [r for r in scored if r.get("honest_sd", 0) >= 0.03]
    failed = [r for r in rows if r.get("verdict") in ("FIT_FAILED", "ERROR")]

    print("\n" + "=" * 96)
    print(f"MIRAGE (delta <= -0.06, live-number correction needed): {len(mirage)}")
    for r in mirage:
        print(f"  {r['trend']:32s} {r['shipped']:.3f} -> {r['honest']:.3f}  "
              f"(d{r['delta']:+.3f}; honest 95% CI [{r.get('honest_ci95_lo')},{r.get('honest_ci95_hi')}])")
    print(f"\nINFLATED (-0.06 < delta <= -0.03): {len(infl)}")
    for r in infl:
        print(f"  {r['trend']:32s} {r['shipped']:.3f} -> {r['honest']:.3f} (d{r['delta']:+.3f})")
    print(f"\nFRAGILE (seed sd >= 0.03 — honest number unstable across negative draws): {len(fragile)}")
    for r in fragile:
        print(f"  {r['trend']:32s} honest={r['honest']:.3f} mean={r['honest_mean']:.3f} "
              f"sd={r['honest_sd']:.3f} seeds={r.get('per_seed_auc')}")
    if failed:
        print(f"\nFIT_FAILED/ERROR: {[r['trend'] for r in failed]}")

    if removed:
        print("\nREMOVED / NOT LIVE (black-swan — excluded from correction scope):")
        for r in removed:
            print(f"  {r['trend']:32s} shipped={r['shipped']:.3f} honest={r['honest']:.3f} "
                  f"(d{r['delta']:+.3f}) — was it a mirage? {'YES' if r['delta']<=-0.06 else 'no'}")

    n = len(scored)
    print("\n" + "=" * 96)
    print(f"FLEET SUMMARY ({n} LIVE recipes; {len(removed)} removed/not-live): {n} re-measured | "
          f"{len(mirage)} MIRAGE + {len(infl)} INFLATED = {len(mirage)+len(infl)} need correction "
          f"({100*(len(mirage)+len(infl))/n:.0f}% of fleet) | median |d| = "
          f"{sorted(abs(r['delta']) for r in scored)[n//2]:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
