# Handoff → Frontend session: military_coup live-number correction (parity)

**From:** the ML / R&D session. **Date:** 2026-07-10. **To:** the frontend-shipping session.
**Standalone** (the banking handoff `handoff-banking-live-honesty-2026-07-10.md` is already shared with you — this is a separate, smaller change; don't touch that one).

## Why (15 seconds)
military_coup went through the same honest re-measurement as banking. Its live number is **0.686 (renders "69%")**; the honest value on the current representative event set is **0.652**. Unlike banking, this is a **minor parity nudge (−0.034), NOT a mirage** — military_coup's number was never meaningfully inflated (stored 0.677 → 0.652, CI-overlapping). We're correcting it for honesty parity with banking. *(Details: `qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md`; verdict: the recipe stays run-2's drivers — an enrichment candidate cleared all 7 gates but was caught as a look-ahead confound, so no driver change.)*

## The change — one card, same mechanism as banking
**File:** `data/te-fleet-run-2/cards-v3/military_coup.card.json`

| Field | Current | → New (honest) |
|---|---|---|
| `stats.loco_auc` | `0.6858492894671886` | `0.6516442767459260` |
| `stats.ci95_lo` | `0.6321098046102466` | `0.5980` |
| `stats.ci95_hi` | `0.7377220939838365` | `0.7011` |
| `greedy_walk.final_global_auc` | `0.6858492894671886` | `0.6516442767459260` |

**⚠️ Same operational constraint as banking:** the card is a checksum-verified baked artifact — a raw JSON edit fails the build unless you **also bump `data/build-manifest.json`'s sha256 for this file**, OR (clean path) it's re-baked at source. Decide hotfix-vs-rebake with the founder.

**Renders that self-update (no code change):** `/trends` tile **69% → 65%**; detail Discrimination **0.686 → 0.652** + band **[0.632, 0.738] → [0.598, 0.701]** + the "below validation threshold" delta self-recomputes; the **trend-tracker blog tile** (`app/blog/trend-tracker/page.tsx`) reads the same field → **0.69 → 0.65** automatically.

## Scope notes
- **No wording change needed** here — the global "driving this trend → associations" softening is already covered in the banking handoff and applies to all trends.
- **No new blog required** (this is a null result). Optional: the "an indicator passed all 7 gates but was caught as backdated hindsight" story is a nice methodology footnote for the honesty blog if you write it.
- military_coup stays in the **experimental** tier (0.652 is below its validation threshold, correctly).

## Don't touch
`data/te-sample-10/*` (dead), the `0.7986` lock-floor threshold, other trends' numbers.

Verify: tile shows 65%, detail 0.652 + band [0.598, 0.701]; `build-manifest.json` sha updated (or source re-bake). PR + Sonnet review as standard.
