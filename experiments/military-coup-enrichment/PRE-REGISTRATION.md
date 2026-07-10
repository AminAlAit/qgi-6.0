# military_coup enrichment — PRE-REGISTRATION 🔒 (2026-07-10)

**Method of record:** `qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md`. Fixed BEFORE build+test; no post-hoc relaxation. Purist-gated (AMBER→GREEN once the two edits below are in — they are).

## Context (P0, verified)
- **Step 0 PASSED:** 207 events / 74 countries / 1931–2021, representative decade spread, all canonical coups present, **HOMOGENEOUS panel (no regime split — pooled test, no banking-style eligibility gate).**
- **Honest baseline = 0.652** (run-2's 5 drivers [`SP.DYN.LE00.IN`, `v2excrptps`, `v2cltort`, `v2xel_frefair`, `v2x_clpol`], recomputed on the current 207-event set, XGBoost, window 25; CI [0.598, 0.701]). Stored anchor was 0.677 → **−0.025, CI-overlapping: NOT skew-inflated** (unlike banking's 0.771→0.638). Minor live-number parity update recommended (0.677→0.652).
- **Architecture:** XGBoost (n_pos 207 ≥ 60). Coverage healthy (142/207 survive @ w25).

## Hypothesis
Coup-mechanism indicators — orthogonal to run-2's governance/rights cluster (run-2 has **zero** military-institution variables) — lift LOCO-AUC honestly above 0.652.

## Candidates (ranked; pull-and-test-ready unless noted)
1. `v2exl_legitlead` — leadership-legitimacy collapse (pre-coup danger zone). 97.6% cov.
2. `v2pepwrses` — ethnic/social-group power exclusion (horizontal inequality → factionalization). 97.6%.
3. `v2stcritapparm` — military appointment loyalty-vs-merit (**coup-proofing**, Powell). 87.4%. *The standout — run-2 has no military variable at all.*
4. `v2strenarm` — military remuneration (underpaid army → mutiny). 89.4%. Pairs with #3 (expect mutual redundancy; test jointly).
5. `OWID_AUTOCRATIZATION` — anocracy/autocratization. 97.6%. ⚠️ within-V-Dem-family redundancy risk vs run-2.
6. `NY.GDP.MKTP.KD.ZG` — GDP-growth shock. 75.4% (domain-critical coverage exception, documented).
7. `prior_coup_count` / `years_since_last_coup` — the **coup-trap** (strongest literature predictor). **NOT in panel → build as a strictly-lagged derived feature (test-first, leakage-review) — a blocking prerequisite this cycle (see D4).**

Deprioritized (coverage-vetoed): `MS.MIL.XPND.GD.ZS` (71%), `v2exremhog` (48%), military-personnel/trade series (<66%).

## Acceptance bar — 7-gate AND (all pre-registered; the AND-gate is primary defense)
1. **D1 coverage-matched baseline** — judged vs the recomputed 0.652 (not a scalar; row-aligned re-fit).
2. **D2 missingness placebo** — has-data dummy AND values-scrambled permutation score near-null. *For `NY.GDP.MKTP.KD.ZG` specifically: also test whether WDI-growth missingness correlates with coup-proneness (the banking "has-data ≠ regime" lesson).*
3. **D3 V-Dem-family orthogonality (HARDENED — purist edit #1):** **MANDATORY for ALL 5 V-Dem candidates** (`v2exl_legitlead`, `v2pepwrses`, `v2stcritapparm`, `v2strenarm`, `OWID_AUTOCRATIZATION`), not optional. Residualize/partial-correlation each against the **FULL run-2 4-driver V-Dem block** (`v2excrptps`, `v2cltort`, `v2xel_frefair`, `v2x_clpol`); reject on shared-latent-factor collinearity. **This is the coup analog of banking's income-proxy control** — it targets V-Dem's rater-hindsight contamination ("this leadership was clearly fragile → later had a coup"), the single biggest confound risk here.
4. **D4 prior-coup-history control (RESOLVED — purist edit #2):** the coup-trap feature is **built FIRST as a blocking prerequisite** (not deferred). Each candidate must show incremental lift **over a prior-coup-count-alone baseline** (does it add anything beyond "this country has coups"?). If the build slips, D4 is explicitly **downgraded to advisory in writing** — never left both "gates everything" and "deferred."
5. **D5 per-country decomposition** — lift lands on real coup countries, not 2–3 lucky folds.
6. **D6 block-bootstrap ΔAUC CI-lower > 0** vs 0.652, BH-FDR across candidates (weak at small k; secondary to the AND-gate).
7. **D7 locked leakage-safe temporal hold-out** replicates.

## Confound focus (coup-specific)
- **V-Dem rater-hindsight** (D3) — 5/7 candidates + 4/5 run-2 drivers are expert-coded; hindsight leaks.
- **Prior-coup base-rate** (D4) — "unstable countries stay unstable" is legitimate signal only if strictly lagged and shown to add beyond the coup-trap baseline.
- **Regime-type proxy** — a candidate must not just re-detect "anocratic/unstable country."
- Window-selection fragility (argmax w25, no nested correction) — inherited from run-2, flagged, run nested selection in parallel; do not let it drop from the report.

## Stop rule
If no candidate clears all 7 gates: record **0.652 as military_coup's honest ceiling** (update the live number), no further indicator search this cycle, move to the next trend.

## Odds (prior, un-anchored)
Better than banking's 30–50%: homogeneous panel + strong orthogonal military-institution candidates run-2 wholly lacks + a richer literature-backed shortlist. Rough prior **~45–60%** of a real, modest lift.
