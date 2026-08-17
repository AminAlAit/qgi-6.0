"""Generate the fleet-wide frontend correction package from the audit + verification.

Consumes results/fleet_audit.json (honest numbers + BCa CIs + fragility) and
results/mirage_verification.json (window-sweep confirmation + panel integrity + breadth).
Emits, for every flagged (MIRAGE/INFLATED) LIVE trend that verification CONFIRMS:
  * results/corrections.json — machine-readable {trend: {field: old -> new}} for the frontend
  * FRONTEND-CORRECTION-fleet.md — the handoff doc (same shape as the banking/coup handoffs,
    fleet-wide), incl. the operational note that cards are checksum-verified baked artifacts.

A flag that verification did NOT confirm (shipped reproduces at some window, or a panel
integrity failure) is listed under REVIEW — NOT auto-corrected. Host-only (reads JSON)."""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIT = HERE / "results" / "fleet_audit.json"
VERIF = HERE / "results" / "mirage_verification.json"
REMOVED_NOT_LIVE = {"epidemic_and_pandemic", "natural_disaster"}


def ci80_from_ci95(auc: float, lo95: float, hi95: float) -> tuple[float, float]:
    """Approximate an 80% band from the 95% band (1.2816/1.96 of the half-width) — the cards
    carry both; keep them internally consistent with the corrected point + 95% band."""
    half95 = (hi95 - lo95) / 2.0
    half80 = half95 * (1.2816 / 1.9600)
    return round(auc - half80, 4), round(auc + half80, 4)


def main() -> int:
    audit = {r["trend"]: r for r in json.loads(AUDIT.read_text(encoding="utf-8"))}
    verif = {}
    if VERIF.is_file():
        verif = {r["trend"]: r for r in json.loads(VERIF.read_text(encoding="utf-8"))}

    flagged = [t for t, r in audit.items()
               if r.get("verdict") in ("MIRAGE", "INFLATED") and t not in REMOVED_NOT_LIVE]
    flagged.sort(key=lambda t: audit[t].get("delta", 0))

    corrections, review = {}, []
    for t in flagged:
        a = audit[t]
        v = verif.get(t, {})
        confirmed = v.get("reproduces_at_any_window") is False and v.get("panel_ok") is True
        if not confirmed:
            review.append((t, v.get("reproduces_at_any_window"), v.get("panel_ok")))
            continue
        honest = a["honest"]
        lo, hi = a.get("honest_ci95_lo"), a.get("honest_ci95_hi")
        entry = {
            "shipped_loco_auc": a["shipped"],
            "honest_loco_auc": honest,
            "delta": a["delta"],
            "honest_ci95_lo": lo, "honest_ci95_hi": hi,
            "verdict": a["verdict"],
            "fragile": a.get("honest_sd", 0) >= 0.03,
            "honest_sd": a.get("honest_sd"),
            "verified_best_window": v.get("best_window"),
            "shipped_unreachable": True,
        }
        if lo is not None and hi is not None:
            entry["honest_ci80_lo"], entry["honest_ci80_hi"] = ci80_from_ci95(honest, lo, hi)
        corrections[t] = entry

    (HERE / "results" / "corrections.json").write_text(
        json.dumps(corrections, indent=2, default=str), encoding="utf-8")

    # ---- handoff markdown ----
    lines = []
    lines.append("# Frontend handoff → fleet-wide live-number correction (honesty audit, 2026-07-12)")
    lines.append("")
    lines.append("**From:** ML/R&D session. Re-measured every live run-2 recipe with the exact honest method "
                 "that produced banking's 0.638 and military_coup's 0.652 (both reproduced to the decimal — "
                 "method validated). Shipped numbers cherry-picked a lucky greedy window; the honest "
                 "re-measurement (`_final_fit`, re-argmax window over WINDOW_GRID, current representative "
                 "event set, seed 12345) is the defensible value.")
    lines.append("")
    lines.append(f"**{len(corrections)} live recipes need their number brought down.** Each was verified: its "
                 "shipped AUC is **unreachable at ANY window** on current data (not a measurement artifact — "
                 "8 other live recipes reproduce cleanly), and all recipe panels loaded with real data.")
    lines.append("")
    lines.append("⚠️ **Operational constraint (same as the banking handoff):** each card is a checksum-verified "
                 "baked artifact — a raw JSON edit fails the build unless `data/build-manifest.json`'s sha256 for "
                 "that card is also bumped, OR (clean path) the cards are re-baked at source with these values. "
                 "34 cards → **re-bake at source is strongly preferred** over 34 manual sha bumps.")
    lines.append("")
    lines.append("## Corrections (worst first)")
    lines.append("")
    lines.append("| Trend | Shipped | → Honest | 95% band | Δ | Note |")
    lines.append("|---|---|---|---|---|---|")
    for t, e in sorted(corrections.items(), key=lambda kv: kv[1]["delta"]):
        band = f"[{e.get('honest_ci95_lo')}, {e.get('honest_ci95_hi')}]"
        note = []
        if e["fragile"]:
            note.append(f"⚠️fragile (sd {e['honest_sd']})")
        if e["verdict"] == "INFLATED":
            note.append("minor")
        lines.append(f"| {t} | {e['shipped_loco_auc']:.3f} | **{e['honest_loco_auc']:.3f}** | "
                     f"{band} | {e['delta']:+.3f} | {', '.join(note)} |")
    lines.append("")
    lines.append("## Per-card fields to set")
    lines.append("For each trend, in `data/te-fleet-run-2/cards-v3/<trend>.card.json`:")
    lines.append("- `stats.loco_auc` → honest · `stats.ci95_lo/ci95_hi` → honest 95% band · "
                 "`stats.ci80_lo/ci80_hi` → honest 80% band · `greedy_walk.final_global_auc` → honest")
    lines.append("- Renders that self-update: `/trends` tiles, detail Discrimination + band, "
                 "trend-tracker blog tile (all read `stats.loco_auc`).")
    lines.append("")
    if review:
        lines.append("## ⚠️ NOT auto-corrected — needs review")
        for t, repro, pok in review:
            lines.append(f"- `{t}`: reproduces_at_any_window={repro}, panel_ok={pok} "
                         f"(shipped may be defensible OR verification incomplete — do NOT change yet)")
        lines.append("")
    lines.append("## Wording (global, all trends)")
    lines.append("- Soften \"driving this trend\" → \"associated with\" (correlational honesty; carries from banking).")
    lines.append("- Fragile trends (⚠️) — widen bands / add a stability caveat; their honest number swings "
                 "with the random negative draw.")

    (HERE / "FRONTEND-CORRECTION-fleet.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {len(corrections)} corrections + {len(review)} review-only")
    print(f"  -> results/corrections.json")
    print(f"  -> FRONTEND-CORRECTION-fleet.md")
    if review:
        print(f"  REVIEW (not auto-corrected): {[t for t,_,_ in review]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
