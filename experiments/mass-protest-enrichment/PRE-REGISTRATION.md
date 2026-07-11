# mass_protest enrichment — PRE-REGISTRATION 🔒 (2026-07-11)

Method of record: `qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md`. Fixed BEFORE build+test; no post-hoc relaxation. Purist GREEN (+ 2 edits, baked in below).

## Context (P0, verified)
- **Step 0 PASSED:** 336 events / 123 countries / 1944–2021, canonical waves present.
- **Honest baseline = 0.611** (run-2 drivers `SM.POP.RHCR.EO`, `v2excrptps`, `v2csprtcpt`; recomputed on current 336-event set, XGBoost, window 5; CI [0.568, 0.651]). Stored 0.655 → −0.044, CI-overlapping (not a clear mirage; like military_coup's drift). ⚠️ run-2's own drivers only survive coverage on **64% of positives @ w5** — measure every candidate against a **coverage-matched** baseline (banking's lesson).
- Architecture: XGBoost (n_pos 336 ≥ 60).

## Hypothesis
Measured grievance/demographic indicators — orthogonal to run-2's refugee/corruption/civil-society cluster — lift LOCO-AUC honestly above the coverage-matched 0.611.

## Candidates (ranked; favor MEASURED non-episode → low hindsight)
1. `AG.PRD.FOOD.XD` — food-production shortfall (bread/fuel grievance). 84% cov. Low hindsight.
2. `NY.GDP.MKTP.KD.ZG` — GDP-growth shock. 84%. Low hindsight.
3. `prior_mass_protest_count` / `years_since_last_mass_protest` — protest "trap"/diffusion. **BUILD FIRST (strictly lagged, test-first, leakage-review) as the D4 control** every repression/regime candidate must beat.
4. `OWID_POP_YOUNG` — youth bulge. 97% cov. ⚠️ **development-proxy risk → mandatory D3a control = `NY.GNP.PCAP.CD` (specified), tested as level AND YoY first-difference.**
5. `FP.CPI.TOTL.ZG` — inflation (price-shock, most mechanism-specific). 78% cov → **domain-critical coverage-exception discussion** (near-miss, not structural).
6. `v2x_regime` — regime type (ONE V-Dem representative). **Mandatory D3 V-Dem-block orthogonality** vs run-2's `v2excrptps`+`v2csprtcpt`.
- **PRESUMPTIVELY DISQUALIFIED:** `OWID_AUTOCRATIZATION` — confirmed hindsight/backdating confound in military_coup (2026-07-10). If ever tested, run the D8 lag-decay + leakage-safe-reconstruction check FIRST. `v2csreprss` — near-duplicate of run-2's `v2csprtcpt` (expect orthogonality reject).

## Acceptance bar — 8-gate AND (pre-registered)
D1 coverage-matched baseline (0.611, not a scalar) · D2 missingness placebo · D3 V-Dem-family orthogonality (mandatory for V-Dem candidates) · **D3a development-proxy control (`NY.GNP.PCAP.CD`) — mandatory for youth-bulge, level AND YoY** · D4 incremental lift over the prior-protest-trap baseline · D5 per-country decomposition (real protest countries) · D6 country-block ΔAUC CI-lower>0 vs 0.611 + BH-FDR · D7 locked temporal hold-out · **D8 (episode/expert-coded candidates only): lag-decay + leakage-safe-reconstruction — the military_coup lesson; cross-sectional D3 does NOT catch temporal backdating.**

## Confound focus
Episode-hindsight (D8) · development-proxy (D3a, youth-bulge) · prior-protest base-rate (D4) · V-Dem shared latent (D3). Watch heterogeneity (democratic vs authoritarian protest) via D5 — do not pre-split.

## Stop rule
None clears all gates → **0.611 is mass_protest's honest ceiling**; no further indicator search this cycle.

## Odds (prior)
Measured economic/demographic candidates are cleaner (lower hindsight) than banking/coup's — **~40–55%** of a real modest lift.

---

## OUTCOME (2026-07-11) — CEILING 0.611

None of the 5 screen survivors clears all 8 gates — **all fail D6** (country-block bootstrap ΔAUC CI-lower ≤ 0 vs the coverage-matched 0.611; none survives BH-FDR, all p_adj ≥ 0.81). Closest: **GDP-growth (`NY.GDP.MKTP.KD.ZG`)** — recipe 0.6355, dAUC **+0.023**, CI [−0.010, +0.054], p=0.16; it *does* beat the protest-trap floor (D4) but not the baseline (D6). Runner-up: prior-protest count (+0.016, D6-fails). Food-production negative, v2x_regime near-zero. **Youth-bulge rejected at D3a** (development-proxy confound in *levels*, r=−0.557 vs GDP-per-capita — poorer countries skew younger, exactly as pre-reg predicted; the YoY first-difference variant passes D3a cleanly but was not pre-registered → optional follow-up candidate). Protest-trap built + leakage-safe (26/26 tests). Per the pre-reg stop rule: **0.611 is mass_protest's honest ceiling; no further indicator search this cycle.** Optional threads: pre-register OWID_POP_YOUNG-YoY; FP.CPI (inflation) coverage-exception (78.9%, 1.1pp short).
