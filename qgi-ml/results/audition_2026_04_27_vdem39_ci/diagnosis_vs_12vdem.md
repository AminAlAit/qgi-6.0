# 39-VDEM CI-aware diagnosis vs 12-VDEM baseline

Recipes compared: 47
Tight CIs (<0.10): 4/47
Wide CIs  (>0.30): 15/47 — these are pure noise

## REAL improvements (10)
v12 AUC fell BELOW v39's 90% CI lower bound — V-Dem expansion genuinely lifted these.

| Recipe | v12 AUC | v39 AUC [CI] | CI width |
|---|---|---|---|
| human_rights_reform | 0.238 | **0.917** [0.833, 0.976] | 0.143 |
| economic_growth_milestone | 0.372 | **0.860** [0.767, 0.953] | 0.186 |
| military_policy_and_reform | 0.262 | **0.542** [0.422, 0.667] | 0.245 |
| epidemic_and_pandemic | 0.726 | **0.964** [0.916, 1.000] | 0.084 |
| terrorist_attack | 0.163 | **0.372** [0.313, 0.442] | 0.128 |
| social_policy_reform | 0.837 | **0.977** [0.930, 1.000] | 0.070 |
| peacekeeping_and_peace_process | 0.524 | **0.661** [0.548, 0.786] | 0.238 |
| military_coup | 0.821 | **0.940** [0.833, 1.000] | 0.167 |
| climate_agreement | 0.244 | **0.360** [0.302, 0.407] | 0.105 |
| trade_agreement | 0.881 | **0.952** [0.905, 1.000] | 0.095 |

## REAL regressions (7)
v12 AUC was ABOVE v39's 90% CI upper bound — V-Dem expansion genuinely hurt these.

| Recipe | v12 AUC | v39 AUC [CI] | CI width |
|---|---|---|---|
| oil_and_gas | 0.872 | **0.186** [0.104, 0.268] | 0.164 |
| sport_and_international_event | 0.953 | **0.395** [0.337, 0.442] | 0.105 |
| humanitarian_crisis | 0.814 | **0.267** [0.198, 0.337] | 0.140 |
| agricultural_policy | 0.837 | **0.337** [0.267, 0.396] | 0.128 |
| political_violence | 0.548 | **0.262** [0.131, 0.405] | 0.274 |
| political_corruption | 0.440 | **0.310** [0.250, 0.369] | 0.119 |
| executive_power_consolidation | 0.442 | **0.326** [0.256, 0.395] | 0.140 |

## Within noise — change NOT statistically distinguishable (30)
v12 point estimate falls within v39's 90% CI. The 'change' is consistent with bootstrap variance.

| Recipe | v12 AUC | v39 AUC [CI] | CI width |
|---|---|---|---|
| flood_and_cyclone | 0.690 | 0.589 [0.167, 1.000] | 0.833 |
| regional_integration | 0.470 | 0.595 [0.202, 0.976] | 0.774 |
| transitional_justice | 0.667 | 0.488 [0.131, 0.857] | 0.726 |
| multilateral_agreement | 0.531 | 0.619 [0.337, 0.950] | 0.613 |
| democratic_transition | 0.756 | 0.520 [0.292, 0.781] | 0.489 |
| diplomatic_rupture | 0.589 | 0.585 [0.316, 0.780] | 0.465 |
| energy_policy | 0.562 | 0.450 [0.250, 0.669] | 0.419 |
| migration_and_refugees | 0.680 | 0.720 [0.494, 0.904] | 0.410 |
| mass_protest | 0.537 | 0.633 [0.417, 0.815] | 0.398 |
| civil_war_and_insurgency | 0.492 | 0.528 [0.354, 0.718] | 0.364 |
| natural_disaster | 0.382 | 0.354 [0.179, 0.537] | 0.358 |
| infrastructure_project | 0.614 | 0.447 [0.275, 0.623] | 0.348 |
| interstate_war | 0.476 | 0.423 [0.262, 0.596] | 0.335 |
| territorial_disputes | 0.738 | 0.786 [0.619, 0.952] | 0.333 |
| government_formation | 0.606 | 0.552 [0.378, 0.703] | 0.325 |
| human_rights_violation | 0.850 | 0.775 [0.637, 0.925] | 0.288 |
| foreign_intervention | 0.750 | 0.690 [0.548, 0.833] | 0.286 |
| constitutional_change | 0.646 | 0.744 [0.595, 0.872] | 0.277 |
| fiscal_policy_change | 0.823 | 0.774 [0.635, 0.910] | 0.274 |
| political_repression | 0.631 | 0.626 [0.497, 0.769] | 0.273 |
| environmental_policy | 0.472 | 0.533 [0.390, 0.663] | 0.273 |
| elections_and_voting | 0.714 | 0.672 [0.542, 0.792] | 0.250 |
| sanctions_and_arms_embargo | 0.881 | 0.798 [0.667, 0.905] | 0.238 |
| bilateral_treaty | 0.703 | 0.771 [0.674, 0.891] | 0.216 |
| economic_recession | 0.815 | 0.897 [0.795, 0.985] | 0.190 |
| resource_conflict | 0.814 | 0.791 [0.698, 0.884] | 0.186 |
| currency_crisis | 0.767 | 0.849 [0.767, 0.931] | 0.163 |
| public_health_reform | 0.407 | 0.395 [0.326, 0.466] | 0.140 |
| cultural_and_heritage | 0.267 | 0.279 [0.221, 0.337] | 0.116 |
| poverty_and_inequality_crisis | 0.419 | 0.407 [0.360, 0.453] | 0.093 |

## Headline

- **10 real improvements**, **7 real regressions**, **30 within-noise**
- The 'median AUC dropped 0.041' headline collapses: most apparent swings are noise.
- Real signal lives in the *real-improvement* + *real-regression* lists.