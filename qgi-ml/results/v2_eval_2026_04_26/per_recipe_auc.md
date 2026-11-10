# Per-Recipe AUC Baseline Diagnostic (#478)

**Run date:** 2026-04-26 · **Pipeline:** V2.0 (Pearson trajectory similarity, tfidf weight)

**Ground truth:** V1.9.1 backtest pairs (test cutoff=2020) · **Categories scored:** 36 of 70 qualifying (n≥30, n_pos≥5)


## Headline

- Overall recipe AUC range: **0.321 → 0.790** (median 0.513)
- Recipes ≥ 0.55 AUC: **9/36** (25%)
- Recipes ≤ 0.50 AUC (random or worse): **16/36**

## Top 5 highest-AUC recipes

| Recipe | Family | Tier | AUC | n_total | n_pos | sim_gap |
|---|---|---|---|---|---|---|
| executive_power_consolidation | Political Power | M | **0.790** | 33 | 6 | +0.0707 |
| epidemic_and_pandemic | Humanitarian Crisis | XL | **0.778** | 71 | 8 | +0.0746 |
| infrastructure_project | Structural Trends | L | **0.605** | 57 | 30 | +0.0336 |
| transitional_justice | Political Power | XL | **0.600** | 41 | 11 | -0.0032 |
| political_repression | Governance & Rights | L | **0.597** | 71 | 25 | +0.0276 |

## Bottom 5 lowest-AUC recipes

| Recipe | Family | Tier | AUC | n_total | n_pos | sim_gap |
|---|---|---|---|---|---|---|
| human_rights_reform | Governance & Rights | L | **0.321** | 43 | 10 | -0.0314 |
| environmental_policy | Structural Trends | L | **0.346** | 33 | 14 | -0.0139 |
| military_coup | Political Power | M | **0.372** | 49 | 12 | -0.0453 |
| migration_and_refugees | Social Mobilization | L | **0.383** | 60 | 32 | -0.0493 |
| political_violence | Conflict & Violence | L | **0.426** | 55 | 12 | -0.0314 |

## Per-family rollup

| Family | n_recipes | mean AUC | median AUC | min | max |
|---|---|---|---|---|---|
| A: Political Power | 8 | 0.558 | 0.566 | 0.372 | 0.790 |
| B: Conflict & Violence | 5 | 0.480 | 0.479 | 0.426 | 0.529 |
| C: Governance & Rights | 5 | 0.474 | 0.487 | 0.321 | 0.597 |
| D: Economic Stress | 4 | 0.529 | 0.576 | 0.429 | 0.596 |
| E: Social Mobilization | 2 | 0.455 | 0.527 | 0.383 | 0.527 |
| F: Diplomacy & Geopolitics | 6 | 0.504 | 0.532 | 0.449 | 0.536 |
| G: Humanitarian Crisis | 3 | 0.576 | 0.504 | 0.445 | 0.778 |
| H: Structural Trends | 3 | 0.466 | 0.448 | 0.346 | 0.605 |

## Full per-recipe table (sorted by family, then AUC asc)

| Family | Recipe | Tier | AUC | base_rate | n_total | n_pos | sim_gap |
|---|---|---|---|---|---|---|---|
| A Political Power | military_coup | M | 0.372 | 0.245 | 49 | 12 | -0.0453 |
| A Political Power | democratic_transition | L | 0.502 | 0.203 | 74 | 15 | -0.0256 |
| A Political Power | elections_and_voting | L | 0.524 | 0.695 | 82 | 57 | +0.0219 |
| A Political Power | constitutional_change | L | 0.530 | 0.291 | 79 | 23 | +0.0104 |
| A Political Power | government_formation | L | 0.566 | 0.432 | 74 | 32 | -0.0134 |
| A Political Power | peacekeeping_and_peace_process | L | 0.580 | 0.216 | 51 | 11 | -0.0012 |
| A Political Power | transitional_justice | XL | 0.600 | 0.268 | 41 | 11 | -0.0032 |
| A Political Power | executive_power_consolidation | M | 0.790 | 0.182 | 33 | 6 | +0.0707 |
| B Conflict & Violence | political_violence | L | 0.426 | 0.218 | 55 | 12 | -0.0314 |
| B Conflict & Violence | civil_war_and_insurgency | L | 0.465 | 0.482 | 56 | 27 | -0.0286 |
| B Conflict & Violence | interstate_war | L | 0.479 | 0.237 | 38 | 9 | -0.0191 |
| B Conflict & Violence | foreign_intervention | L | 0.500 | 0.224 | 49 | 11 | -0.0000 |
| B Conflict & Violence | terrorist_attack | L | 0.529 | 0.137 | 51 | 7 | -0.0342 |
| C Governance & Rights | human_rights_reform | L | 0.321 | 0.233 | 43 | 10 | -0.0314 |
| C Governance & Rights | human_rights_violation | L | 0.447 | 0.295 | 61 | 18 | -0.0235 |
| C Governance & Rights | military_policy_and_reform | L | 0.487 | 0.237 | 38 | 9 | +0.0052 |
| C Governance & Rights | political_corruption | XL | 0.519 | 0.213 | 47 | 10 | -0.0199 |
| C Governance & Rights | political_repression | L | 0.597 | 0.352 | 71 | 25 | +0.0276 |
| D Economic Stress | economic_recession | L | 0.429 | 0.351 | 74 | 26 | -0.0102 |
| D Economic Stress | fiscal_policy_change | L | 0.513 | 0.481 | 81 | 39 | +0.0193 |
| D Economic Stress | trade_agreement | XL | 0.576 | 0.258 | 31 | 8 | -0.0222 |
| D Economic Stress | currency_crisis | L | 0.596 | 0.188 | 32 | 6 | +0.0430 |
| E Social Mobilization | migration_and_refugees | L | 0.383 | 0.533 | 60 | 32 | -0.0493 |
| E Social Mobilization | mass_protest | L | 0.527 | 0.405 | 79 | 32 | +0.0268 |
| F Diplomacy & Geopolitics | sanctions_and_arms_embargo | XL | 0.449 | 0.343 | 35 | 12 | -0.0224 |
| F Diplomacy & Geopolitics | multilateral_agreement | L | 0.481 | 0.333 | 57 | 19 | -0.0194 |
| F Diplomacy & Geopolitics | regional_integration | L | 0.490 | 0.316 | 38 | 12 | -0.0031 |
| F Diplomacy & Geopolitics | territorial_disputes | L | 0.532 | 0.355 | 31 | 11 | +0.0281 |
| F Diplomacy & Geopolitics | bilateral_treaty | L | 0.534 | 0.674 | 86 | 58 | +0.0160 |
| F Diplomacy & Geopolitics | diplomatic_rupture | L | 0.536 | 0.375 | 40 | 15 | +0.0313 |
| G Humanitarian Crisis | flood_and_cyclone | XL | 0.445 | 0.312 | 32 | 10 | +0.0083 |
| G Humanitarian Crisis | natural_disaster | L | 0.504 | 0.424 | 33 | 14 | -0.0153 |
| G Humanitarian Crisis | epidemic_and_pandemic | XL | 0.778 | 0.113 | 71 | 8 | +0.0746 |
| H Structural Trends | environmental_policy | L | 0.346 | 0.424 | 33 | 14 | -0.0139 |
| H Structural Trends | energy_policy | L | 0.448 | 0.512 | 43 | 22 | -0.0112 |
| H Structural Trends | infrastructure_project | L | 0.605 | 0.526 | 57 | 30 | +0.0336 |

## Synthesis

- **Best-served family:** G: Humanitarian Crisis (mean AUC 0.576) — these recipes' substrate (World Bank + FAO indicators) is sufficient to discriminate ground-truth events.
- **Worst-served family:** E: Social Mobilization (mean AUC 0.455) — these recipes are indicator-starved on the current substrate.
- **Family-AUC spread:** 0.121 AUC points between best and worst family.

**Hypothesis confirmation:** if the family AUC spread > 0.10 AUC points, the global metric was masking real heterogeneity — per-recipe metrics (#479) become the right framework. Auditioner (#480) should prioritize provider acquisition for the worst-served families.

**Pre-V-Dem baseline:** these numbers are the comparison set. Post-V-Dem (#348) integration should lift the worst-served families more than the best-served (substrate-effect hypothesis).
