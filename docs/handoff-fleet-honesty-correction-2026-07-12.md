# Frontend Handoff — Fleet-Wide Confidence-Number Correction + Honesty Dev Blog (2026-07-12)

**From:** the QGI ML/R&D session (now single owner of recipe strategy + measurement).
**To:** the frontend session.
**Founder gate:** this is **outward-facing** — nothing ships without the founder's explicit sign-off. Package it as ONE honest change (numbers + wording + blog), not three.

This document is self-contained. It has everything you need to (1) correct 34 live recipe confidence numbers site-wide, (2) apply the paired wording change, and (3) write one dev blog explaining it. Read it top to bottom before touching anything.

---

## 0. TL;DR — what you're doing

1. **Bring 34 live recipe `loco_auc` numbers down** to their honest re-measured values (+ their CI bands), leave **8 unchanged**, and don't touch the **2 removed** (epidemic, natural_disaster).
2. **Soften wording** globally: "driving this trend" → "associated with" (these are correlations, not causes); add a stability caveat to the **8 fragile** recipes.
3. **Write one dev blog**: "why our confidence numbers went down, on purpose."
4. **Verify it's actually live** and get founder sign-off before + after.

The exact numbers are in §3. The machine-readable source of truth is
`qgi-ml/experiments/fleet-honesty-audit/results/corrections.json` (34 entries, every field).

---

## 1. Background — why this is happening (own this for the blog)

QGI's live recipes each advertise a discrimination number (`loco_auc`, rendered as a %, e.g. "86%"). Those numbers came from run-2's greedy recipe walk, which **picked the feature window that maximized AUC** (argmax over a 9-window grid) — a classic multiple-comparisons optimism. On a lucky window, the number looks great; it doesn't hold up when you re-measure honestly.

We re-measured **every live recipe** with the honest method already used to correct banking (0.771→0.638) and military_coup (0.686→0.652): refit the exact shipped recipe with leave-one-country-out CV, re-choosing the window over the current representative event set (`_final_fit`, seed 12345). **The method reproduced banking's 0.638 and coup's 0.652 to the decimal** — it's the same measurement the founder already ratified for those two, applied fleet-wide.

**Result: 34 of 42 live recipes are overstated** (median ≈ −0.06, worst −0.17). 8 reproduce honestly. This is not fraud and not a bug in the recipes — it's window-selection optimism baked into run-2's numbers. The recipes stay; their *numbers* must come down.

**Strategic frame (settled, for the blog's thesis):** enrichment (adding indicators to raise AUC) has produced **0 honest wins across 5 trends** — the recipes are near their real ceilings. So the high-value move is **not chasing higher numbers; it's telling the truth about the ones we have.** QGI's edge is being the platform honest about what it can and can't predict.

---

## 2. Evidence — so you (and the blog) can trust and cite it

Every one of the 34 corrections passed an adversarial verification (all artifacts under `qgi-ml/experiments/fleet-honesty-audit/`):

- **Window-fragility proof** (`results/mirage_verification.json`): for each of the 34, we swept all 9 windows on the current data. The shipped number is **unreachable at ANY window** — 34/34 confirmed, **0 exceptions**. So the shipped value isn't just "a different window"; it doesn't reproduce anywhere.
- **Not a method artifact**: 8 live recipes reproduce *cleanly* at Δ≈0 under the identical method. A uniform measurement bias would drag all 42 down equally — it doesn't. The gap is recipe-specific.
- **No data glitches**: every recipe's indicator panels loaded with real (non-empty, non-NaN) data — 0 panel-integrity failures. A silently empty panel could fake a low number; none did.
- **Known-value cross-check**: banking → 0.638, coup → 0.652 (both match the values the founder already approved), recession → 0.593, mass_protest → 0.611 (match prior per-trend work).
- **Seed robustness**: the 30 highest recipes were measured across 3 seeds; **8 are "fragile"** (honest number swings ≥0.03 with the random negative draw) — these get widened bands, see §7.

Full audit: `results/fleet_audit.json` (all 44) · scorecard script: `experiments/fleet-honesty-audit/summarize_audit.py`.

---

## 3. THE CORRECTIONS — 34 recipes (worst first)

For each trend below, in `data/te-fleet-run-2/cards-v3/<trend>.card.json` set:
- `stats.loco_auc` = **loco_auc** column
- `stats.ci95_lo` / `stats.ci95_hi` = **ci95_lo / ci95_hi**
- `stats.ci80_lo` / `stats.ci80_hi` = **ci80_lo / ci80_hi**
- `greedy_walk.final_global_auc` = **loco_auc** (same value — keep it consistent with stats)
- leave `stats.n_bootstrap` as-is.

| # | trend (card file = `<trend>.card.json`) | loco_auc | ci95_lo | ci95_hi | ci80_lo | ci80_hi | fragile |
|---|---|---|---|---|---|---|---|
| 1 | monetary_policy_change | 0.617 | 0.5305 | 0.6972 | 0.5625 | 0.6715 | YES |
| 2 | executive_power_consolidation | 0.6331 | 0.5525 | 0.7095 | 0.5818 | 0.6844 |  |
| 3 | religious_and_social_movement | 0.6753 | 0.5674 | 0.7718 | 0.6085 | 0.7421 | YES |
| 4 | banking_and_financial_crisis | 0.6381 | 0.5612 | 0.6985 | 0.5932 | 0.683 |  |
| 5 | agricultural_policy | 0.6098 | 0.5363 | 0.6738 | 0.5648 | 0.6548 |  |
| 6 | labor_action | 0.6885 | 0.5873 | 0.7776 | 0.6263 | 0.7507 | YES |
| 7 | economic_growth_milestone | 0.6184 | 0.5248 | 0.7059 | 0.5592 | 0.6776 |  |
| 8 | economic_liberalization | 0.578 | 0.4986 | 0.6574 | 0.5261 | 0.6299 |  |
| 9 | currency_crisis | 0.7546 | 0.6735 | 0.8239 | 0.7054 | 0.8038 | YES |
| 10 | ethnic_and_communal_conflict | 0.6062 | 0.5261 | 0.682 | 0.5552 | 0.6572 |  |
| 11 | trade_agreement | 0.6236 | 0.5487 | 0.6932 | 0.5764 | 0.6708 | YES |
| 12 | economic_nationalization | 0.6951 | 0.6095 | 0.7687 | 0.6431 | 0.7471 | YES |
| 13 | technology_breakthrough | 0.6893 | 0.622 | 0.7543 | 0.646 | 0.7326 |  |
| 14 | political_violence | 0.5484 | 0.5067 | 0.5921 | 0.5205 | 0.5763 |  |
| 15 | diplomatic_rupture | 0.6553 | 0.5857 | 0.725 | 0.6098 | 0.7008 |  |
| 16 | fiscal_policy_change | 0.5929 | 0.5344 | 0.6468 | 0.5562 | 0.6296 |  |
| 17 | territorial_disputes | 0.6381 | 0.5715 | 0.6964 | 0.5973 | 0.6789 |  |
| 18 | economic_recession | 0.5934 | 0.5433 | 0.6433 | 0.5607 | 0.6261 |  |
| 19 | regional_integration | 0.658 | 0.5985 | 0.7088 | 0.6219 | 0.6941 |  |
| 20 | sanctions_and_arms_embargo | 0.7441 | 0.6656 | 0.8112 | 0.6965 | 0.7917 |  |
| 21 | migration_and_refugees | 0.5537 | 0.5053 | 0.6046 | 0.5212 | 0.5862 |  |
| 22 | political_corruption | 0.6268 | 0.5783 | 0.674 | 0.5955 | 0.6581 |  |
| 23 | terrorist_attack | 0.5748 | 0.535 | 0.6186 | 0.5475 | 0.6021 |  |
| 24 | military_policy_and_reform | 0.6218 | 0.5725 | 0.6704 | 0.5898 | 0.6538 |  |
| 25 | foreign_intervention | 0.6763 | 0.6173 | 0.732 | 0.6388 | 0.7138 |  |
| 26 | mass_protest | 0.611 | 0.5684 | 0.6512 | 0.5839 | 0.6381 |  |
| 27 | democratic_transition | 0.6539 | 0.6113 | 0.6955 | 0.6264 | 0.6814 |  |
| 28 | human_rights_reform | 0.5915 | 0.5292 | 0.6527 | 0.5511 | 0.6319 |  |
| 29 | energy_policy | 0.639 | 0.5702 | 0.6984 | 0.5971 | 0.6809 | YES |
| 30 | civil_war_and_insurgency | 0.651 | 0.6133 | 0.6847 | 0.6277 | 0.6743 |  |
| 31 | peacekeeping_and_peace_process | 0.6388 | 0.5876 | 0.6861 | 0.6066 | 0.671 |  |
| 32 | military_coup | 0.6516 | 0.598 | 0.7011 | 0.6179 | 0.6853 |  |
| 33 | infrastructure_project | 0.6534 | 0.5609 | 0.7327 | 0.5972 | 0.7096 | YES |
| 34 | government_formation | 0.5489 | 0.517 | 0.5823 | 0.5276 | 0.5702 |  |

> ⚠️ `banking_and_financial_crisis` (0.638) and `military_coup` (0.6516) are the two the founder already approved via the earlier standalone handoffs (`handoff-banking-live-honesty-2026-07-10.md`, `handoff-military-coup-live-number-2026-07-10.md`). If you already applied those, just confirm they match this table; this fleet pass supersedes and includes them.

**8 FRAGILE** (last column YES): monetary_policy_change, religious_and_social_movement, labor_action, currency_crisis, trade_agreement, economic_nationalization, energy_policy, infrastructure_project → see §7.

---

## 4. The 8 UNCHANGED — do NOT touch (they reproduce honestly)

`transitional_justice` · `human_rights_violation` · `interstate_war` · `political_repression` · `multilateral_agreement` · `elections_and_voting` · `bilateral_treaty` · `constitutional_change`

**2 REMOVED / not live — do NOT touch** (already off-site as un-predictable black-swans): `epidemic_and_pandemic`, `natural_disaster`. (For the record they weren't even mirages — they reproduce — but they stay removed on principle.)

---

## 5. HOW TO APPLY — the operational mechanism (read carefully)

The cards in `data/te-fleet-run-2/cards-v3/` are **checksum-verified baked artifacts**. `data/build-manifest.json` guards them; a raw edit to a card will fail the build unless the manifest is regenerated to match.

**🚨 CRITICAL TRAP — do NOT "re-bake from S3 source" naively.** The honest numbers in §3 are OUR re-measurement (they live in `qgi-ml`, not in the upstream S3 recipe pipeline). The S3 source still has the OLD inflated numbers. A blind re-bake would **overwrite the honest numbers with the stale ones.** So the honest values must be *injected*, one of two ways:

- **Option A (recommended for 34 cards): edit cards + regenerate the manifest.** Programmatically set the fields in §3 across the 34 card JSONs (loop over `corrections.json`), then run whatever generates `data/build-manifest.json` so its checksums match the edited cards. Confirm the exact guard/regen step in your build (the bake scripts under `scripts/` — `bake-country-recipe-scores.ts`, `bake-recipes-aggregated.ts`, `bake_methodology_data.py` — and the manifest generator; verify which one owns the card checksums). This is a data-only change, fully reproducible from `corrections.json`.
- **Option B (durable, bigger): fix it upstream.** Update the source recipe scores (S3 `te-fleet-run-2`) to the honest values, then re-bake normally. Correct long-term, but needs S3 write + the recipe pipeline; heavier. Decide A-vs-B with the founder — A is almost certainly right for a one-time number correction.

Write a small script that reads `corrections.json` and patches the 34 cards (don't hand-edit 34 files); commit the script so the change is auditable and re-runnable.

**Renders that self-update once the cards change (no component code needed):**
- `/trends` tiles (the % on each recipe tile)
- recipe detail page Discrimination value + CI band + any "below validation threshold" delta (self-recomputes)
- the **trend-tracker blog tile** (`app/blog/trend-tracker/page.tsx`) — reads the same `stats.loco_auc`

**Also check (don't assume):** the recipe **tier** field (`tier`, e.g. currency_crisis is `"directional"`) and `recipe_status_audience` (e.g. `"in_play"`). Several recipes drop enough that they may cross a tier threshold (directional → experimental). Re-evaluate tier assignments against whatever the tier thresholds are after the number change — a recipe shouldn't claim "directional" if its honest number no longer clears that bar. If unsure of the thresholds, ask the founder; don't silently leave a stale tier.

---

## 6. WORDING CHANGE (global, all trends)

Correlational honesty — these recipes show *association*, not causation, and now with lower numbers the language must match:

- **"driving this trend" → "associated with"** (and similar causal phrasings → correlational). Known location: `app/(app)/trends/[slug]/page.tsx`; also check `lib/tour-steps.ts`. Grep the whole app for "driving", "drives", "causes", "predicts" in recipe/indicator copy and soften to "associated with / correlated with / precedes".
- Keep it factual and calm — this pairs with the blog's honesty message.

---

## 7. FRAGILE recipes — widen the bands / add a caveat (8)

monetary_policy_change · religious_and_social_movement · labor_action · currency_crisis · trade_agreement · economic_nationalization · energy_policy · infrastructure_project

Their honest number swings ≥0.03 depending on the random negative sample — i.e. the point estimate is genuinely uncertain. For these:
- Use the **CI band prominently** (don't show a bare point number), and/or
- Add a short stability caveat (e.g. "estimate uncertain — limited events"), and/or
- Consider showing the 95% band rather than 80% for these.
Design call is yours; the requirement is that a user doesn't read a fragile 0.68 as if it were a solid 0.68.

---

## 8. THE DEV BLOG — detailed brief

**One post. Lead with integrity, not apology.** This is a credibility *asset*, not a mea culpa.

- **Working title:** "Why our confidence numbers just went down — on purpose" (or "We audited ourselves and corrected 34 numbers").
- **Audience:** analysts / prospective users who care whether QGI is trustworthy. Accessible, minimal jargon.
- **Location/format:** new folder under `app/blog/<slug>/page.tsx`, matching the existing blog structure (see `app/blog/trend-tracker/`, `app/blog/recipe-rebuild-level-4/` for the pattern). Add it to the blog index.
- **Thesis:** *A confidence number you can't reproduce is worse than a lower one you can. We re-measured every recipe honestly and corrected the ones that didn't hold up.*

**Suggested structure:**
1. **The problem, plainly.** Our recipe scores were chosen by picking the best-performing setting out of several — which flatters the number. (Analogy: testing a drug on 9 groups and reporting only the group where it worked.)
2. **What we did.** Re-measured all 42 live recipes with a single honest protocol (leave-one-country-out, no cherry-picking the window), the same method we'd already used to correct two recipes.
3. **What we found.** 34 of 42 were overstated (typical −6 points, worst −17); 8 held up exactly. We verified each: the old number is unreachable under honest measurement, and it's recipe-specific (not a quirk of the new method — 8 recipes reproduced cleanly).
4. **What we changed.** Brought 34 numbers down, widened bands where the estimate is genuinely uncertain, and softened "driving" → "associated with." One honest picture.
5. **Why this makes QGI better.** We're not in the business of the highest number; we're in the business of the *true* one. Most of these recipes are honestly modest-but-real early-warning signals (0.55–0.76), and we'd rather say so than oversell. (Optional: note that separately, our effort to *raise* these numbers by adding new data found no honest gains across 5 trends — the recipes are near their real ceilings, and pretending otherwise would be the dishonest path.)
6. **What stays the same.** The recipes, the methodology, the coverage — only the numbers got honest.

**Tone guardrails:** confident, specific, non-defensive. Cite the concrete proof (reproduces banking/coup exactly; 34/34 unreachable at any window). Don't overclaim the honest numbers either — they're modest and we're owning that. No naming/shaming of "run-2"; frame as normal scientific self-correction.

---

## 9. GATE & PROCESS (must-follow)

1. **Founder sign-off BEFORE anything goes live** — this changes every headline number on qgintelligence.com. Show him §3 + the draft blog; get an explicit yes.
2. **PR + Sonnet review** for the code/data change (standard rubric: correctness / scope / tests / breaking-change / cost). The card-patch script should have a test or at least a dry-run diff.
3. **Verify remote state before claiming done** (standing rule): "PR opened" ≠ "merged" ≠ "deployed" ≠ "live." After deploy, confirm on the real site, not local.
4. Ship it as **one coherent change** (numbers + wording + blog) so the site never shows lowered numbers without the explanation.

---

## 10. VERIFICATION CHECKLIST (confirm it's actually live)

- [ ] All 34 cards show the §3 `loco_auc` + bands; the 8 unchanged still show their old values; the 2 removed still absent.
- [ ] `build-manifest.json` regenerated — build passes (no checksum failure).
- [ ] `/trends` tiles show the new %s (spot-check currency_crisis → 75%, monetary_policy → 62%, banking → 64%).
- [ ] A recipe detail page shows the new Discrimination + CI band; the trend-tracker blog tile updated.
- [ ] Fragile recipes show a widened band / caveat.
- [ ] "driving this trend" phrasing gone (grep the built site / source).
- [ ] Dev blog live and linked from the blog index.
- [ ] Headless/curl check on the deployed URL for a couple of the new numbers (not just local).
- [ ] Founder signed off.

---

## 11. SOURCE-OF-TRUTH ARTIFACTS (in `qgi-ml/experiments/fleet-honesty-audit/`)

- `results/corrections.json` — **machine-readable, the thing to script against** (34 entries: shipped, honest, ci95, ci80, verdict, fragile, best_window).
- `FRONTEND-CORRECTION-fleet.md` — the short version of this handoff (auto-generated).
- `results/fleet_audit.json` — all 44 recipes re-measured.
- `results/mirage_verification.json` — the 34 window-sweep + panel + breadth proofs.
- `audit_fleet.py` / `verify_mirages.py` / `summarize_audit.py` / `generate_corrections.py` — the pipeline, if you need to re-run or extend.

Questions on any number, evidence, or the method → come back to this (ML) session. Anything outward-facing → founder signs off. 🤙
