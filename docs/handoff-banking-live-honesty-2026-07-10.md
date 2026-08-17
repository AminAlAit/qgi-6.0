# Handoff → Frontend session: banking "honesty" corrections (live)

**From:** the ML / R&D session (banking recipe-enrichment work). **Date:** 2026-07-10.
**To:** the Claude Code session that ships `qgi-frontend`.
**Status:** ghost-changes — I investigated read-only; nothing applied. You own the edits + the PR + Sonnet review.

---

## Why (30 seconds)

The live `/trends/banking_and_financial_crisis` page shows **"77% confidence" / discrimination "0.771"** with a band **[0.683, 0.840]**. **That number is a mirage.** It was measured on an old, skewed event set (mostly advanced economies, missing every big emerging-market crisis). When we fixed the event set (76→116 events, added Mexico'94/Argentina'01/Indonesia'97/…) and re-scored the **same** recipe honestly, it is **0.638**, CI **[0.563, 0.701]** — ~0.13 lower. Four enrichment attempts then all failed a pre-registered honest bar, so **0.638 is banking's honest ceiling** (full R&D writeup: `qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md`).

Founder-ratified product actions: **(1) correct banking's live number 0.771 → 0.638 + widen the band; (2) soften the "key indicators / driving this trend" wording** (they're correlated associations, not proven drivers).

---

## ⚠️ READ FIRST — the operational constraint that makes this non-trivial

The recipe cards are **not hand-authored**. `data/te-fleet-run-2/cards-v3/*.card.json` are **baked artifacts fetched from S3** (`scripts/fetch-build-data.mjs`, PREBUILD) and **checksum-verified against `data/build-manifest.json`** on every Vercel build. So:

- **A raw JSON edit to the card will FAIL the next build** unless you also update that file's sha256 entry in `data/build-manifest.json`.
- The **clean fix is a re-bake at source (qgi-ml)** — regenerate banking's card from the current 116-event data so it carries 0.638 + honest CI + the correct verdict, and re-pin the vintage. That is an ML-pipeline action (flag it back to me / the ML session); it is **not** something you should fake in the frontend.
- **Interim hotfix (acceptable, but mark it clearly as a hotfix):** edit the card JSON below **and** update `data/build-manifest.json`'s sha for that file. It will be overwritten on the next re-bake — that's fine, because the re-bake will carry the same honest number.

Decide hotfix-now vs wait-for-rebake with the founder. Everything else below (wording) is a clean component edit with no such constraint.

---

## Change 1 — Correct banking's number (P0) · data edit

**File (the LIVE one):** `data/te-fleet-run-2/cards-v3/banking_and_financial_crisis.card.json`
*(NOT `data/te-sample-10/…` — that dir is dead/unimported. Both carry 0.7707; editing te-sample-10 does nothing.)*

| Field | Current | → New (honest) |
|---|---|---|
| `stats.loco_auc` | `0.7707246376811594` | `0.6383644815482402` |
| `stats.ci95_lo` | `0.6826595484470861` | `0.5629` |
| `stats.ci95_hi` | `0.8403781672241184` | `0.7013` |
| `greedy_walk.final_global_auc` (duplicate) | `0.7707246376811594` | `0.6383644815482402` |
| `stats.ci80_lo` / `ci80_hi` | `0.7148` / `0.8175` | (not rendered; update to `0.5860`/`0.6810` if re-baking, else leave) |

**Then bump** `data/build-manifest.json` sha256 for this card (or re-bake at source).

**Renders that update automatically (no code change needed):**
- `/trends` gallery `RecipeCard.tsx:297` → **"77%" becomes "64%"**; the confidence glow/tooltip follow.
- `/trends/banking_and_financial_crisis` detail `MinorPanels.tsx` DiscriminationPanel: **`:527` "0.771" → "0.638"**; **`:551-565` band "[0.683, 0.840]" → "[0.563, 0.701]"**; **`:491-496` verdict "Below the validation threshold by 0.028" → "…by 0.161"** (0.7986 − 0.638; this is computed in-component against the hardcoded `lockFloor=0.7986`, so it self-corrects — *do not* change the 0.7986 threshold).

> Net user-visible effect: banking honestly reads ~64% / 0.638, clearly below its validation threshold, with a wider honest band. That is the intent.

## Change 2 — Soften "driving this trend" wording (P1) · component edit · applies to ALL trends

These strings imply the indicators are proven causes. They're correlated associations. Soften (final copy is the founder's call; proposed below):

- `components/precedents-v4-1/MinorPanels.tsx:72` — title **"What is driving this trend"** → **"What moves with this trend"** (or "Indicators associated with this trend").
- `components/precedents-v4-1/MinorPanels.tsx:77` — caption **"These are the signals driving this trend: the handful whose combined movement gives it its fingerprint in the data."** → **"These indicators move *together with* this trend — a correlated blend that gives it its statistical fingerprint. They are associations, not proven drivers."**
- `components/signals/SignalsLeafDetail.tsx:670` — **"Top indicators"** → **"Associated indicators"**.
- `components/countries-v4-1/ReadMePanels.tsx:22` already says *"They are statistical associations, not proven causes."* — **good, keep it**; the above changes just make the headline match this hedge.
- Editorial/report pages that literally say **"Key indicators"** (lower priority, static per-report copy): `app/blog/foreign-intervention-graduation/page.tsx:268,412`; `app/reports/pakistan-profile/page.tsx:745`; `app/reports/niger-burkina-divergence/page.tsx:289`; `app/reports/uk-currency-crisis/page.tsx:454`. Soften opportunistically; not blocking.

## Change 3 — Surface banking's experimental status honestly (P2 · optional · founder decision)

The card is flagged `verdict: "HARD_FAIL"`, `tier: "experimental"`, `tier_provenance: "…NOT Majles-ratified"`, `recipe_status_audience: "coming_soon"` — **but the trends route ignores all of these** and renders banking as a confident "In play" recipe. Correcting the number (Change 1) already makes the "below validation threshold" verdict truthful, which helps. If you want to go further, consider a small **"experimental — not yet validated"** tag on the detail page. This is a product-copy decision, not required by the ratified actions — flag to founder, don't ship unilaterally.

## Change 4 — NOT a frontend action, but log it

Only **banking** has been honestly re-measured. The other LOCKed recipes that carry `recipe_loco_auc` in `data/country-risks.json` (`civil_war_and_insurgency`, `multilateral_agreement`, `elections_and_voting`, `bilateral_treaty`) were likely baked on similarly old/skewed event sets and **may be inflated the same way**. Do **not** touch their numbers (no honest re-measurement exists). This is a flag for the ML session to re-validate at source — noted here so it isn't forgotten.

## Change 5 — Blog "Recipe/Trend tracker" (`app/blog/trend-tracker/page.tsx`) · mostly auto-fixed

The status board reads banking from the **same `recipe.stats` card fields** as `/trends`, so **Change 1 fixes it automatically — no separate code edit:**
- `:170-173` `WalkedCard` renders `stats.loco_auc.toFixed(2)` → banking tile **"0.77" becomes "0.64"**.
- `:111-112` renders the band `` `${ci95_lo.toFixed(2)}–${ci95_hi.toFixed(2)}` `` → banking **"0.68–0.84" becomes "0.56–0.70"**.

**What to actually do here:**
1. **Verify** banking's tile shows 0.64 / 0.56–0.70 after the card edit.
2. **Check the hardcoded summary copy** (`:32, :37, :46` metadata + the `:391-497` count chips): "42 in play (8 directional, 34 experimental), 27 coming soon". Correcting banking's number keeps it in the **experimental** tier (it does not move buckets), so the counts should still hold — but confirm, and confirm the "every score is gated on validation against held-out history" framing still reads true (banking's 0.638 is *below* its own validation threshold → correctly experimental, so the framing is fine).
3. **Keep the tracker's directional/experimental "confidence ladder" framing** — it is *already* the honest model (it grades confidence within the in-play set and doesn't oversell). If anything, the `/trends` detail page should learn from it.

## Change 6 — New blog post: "we corrected our own number" (optional, founder's call) · new page

Strong transparency content, and it fits the existing methodology-blog voice (`recipe-rebuild-level-4`, `foreign-intervention-graduation`). This is a **new Next.js blog page in your conventions** — you author it; brief below.

- **Working title:** *"Why our banking confidence just dropped from 77% to 64% — on purpose."*
- **Thesis:** a forecasting product that won't correct itself can't be trusted. We found our own headline was a mirage, fixed it, and published the lower honest number.
- **Arc:** (1) the mirage — 0.771 was measured on an event set missing every big emerging-market crisis (advanced-heavy skew + a window-selection argmax); (2) the fix — we added the missing crises (Mexico'94, Argentina'01, Indonesia'97, Russia'98…; 76→116 events) and re-scored the *same* recipe → **0.638**, CI [0.563, 0.701]; (3) *discovery vs confirmed* — why in-sample numbers inflate and why we only trust a locked hold-out + block-bootstrap; (4) we then tried **four** honest ways to beat 0.638 and all four were confounds (incl. an indicator that just re-discovered "rich vs poor country") → 0.638 is the honest ceiling; (5) the principle — pre-registration + a confound battery; we'd rather ship a true 0.64 than a fake 0.77.
- **Tone:** confident, transparent, methodology-forward. **Numbers to cite:** 0.771→0.638; 76→116 events; CI [0.563,0.701]; 4 attempts / 4 confounds; the GII "development-level confound" as the memorable example.
- **Source of record:** `qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md` (everything you need is there).

---

## Verification checklist (for you before PR)

- [ ] Edited the `te-fleet-run-2` card, **not** te-sample-10.
- [ ] Updated `data/build-manifest.json` sha (or confirmed a source re-bake) — else the build fails checksum.
- [ ] `/trends` banking tile shows **64%**, detail shows **0.638** + band **[0.563, 0.701]** + "below threshold by 0.161".
- [ ] Wording headline no longer says "driving"; matches the "associations, not proven causes" hedge.
- [ ] Did **not** change the `0.7986` lock-floor, and did **not** touch other trends' numbers.
- [ ] Standard: PR + Sonnet review before merge.

## Do NOT touch
- `data/te-sample-10/*` (dead), `RciBadge.tsx` + `data/recipe-confidence.json` (dead/unused), other recipes' `loco_auc`, the `0.7986` threshold constant.

Questions on the honest values or the re-bake path → ping the ML session.
