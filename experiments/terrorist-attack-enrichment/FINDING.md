# terrorist_attack — recipe is BROKEN on representative events (not enrichable as-is)

**2026-07-11.** P0 for enrichment surfaced that run-2's terrorist_attack recipe cannot be validly
measured on the current 242-event/71-country set — so its live ~0.73 is INVALID (not merely
skew-inflated like banking's 0.771; there is no valid honest number, because the recipe fails the
coverage gate at every window).

Per-driver diagnosis (`results_per_driver_coverage.json`, seed=12345):
- **VC.IDP.NWDS** — depth 2008–2023 (16y) → fails the ≥20y depth floor; ~19% pos-coverage. The culprit propping up the mirage.
- **VC.BTL.DETH** — 36y depth but only 109 countries have it → ~40% pos-coverage (country-coverage failure).
- **DT.TDS.DECT.EX.ZS** — marginal: ~54% pos but neg-coverage 46% (fails MIN_NEG_SURVIVAL 0.60).
- Clean: **MS.MIL.XPND.GD.ZS** (92%/88%), **v2xel_frefair** (V-Dem full depth). (SL.UEM.1524.ZS ~borderline.)

**Verdict: terrorist_attack needs a full recipe REBUILD** (re-screen the 248-indicator pool for a
coverage-valid driver set on the representative events) before it can be enriched — a distinct
project, not a quick fix. **Swapped out of the current parallel enrichment; logged as backlog.**

**Frontend implication:** terrorist_attack's live number (~0.73) should be treated as **invalid /
not-validly-measurable pending rebuild** — stronger than banking's number-correction (there's no
honest replacement value yet). Flag experimental / hold, don't just re-point it.

**Also — a pattern:** this is the 2nd recipe (with banking) whose live number turned out to be a
coverage/skew mirage. The other live LOCKed recipes should be coverage-audited on their current
event sets before their numbers are trusted.
