# Indicator-to-Recipe Audit — 2026-04-26T15:25:32Z

**Pipeline:** v0 · **Cutoff year:** 2020 · **Random seed:** 42

**Indicators audited:** 25 · **Recipes covered:** 47 · **Recipe-indicator cells:** 705


## Headline

- Median per-recipe holdout AUC: **0.577**
- Recipes with AUC ≥ 0.55: **25/47**
- Top-lift indicator (across all recipes, sum of audition_score): **MS.MIL.XPND.GD.ZS**
- Mean audition_score: **0.003** (predictive_lift × coverage_share × regional_evenness)

## Per-recipe summary

| Recipe | Tier | n_train | n_test | Test AUC | Top contributor |
|---|---|---|---|---|---|
| sport_and_international_event | L | 172 | 43 | 1.000 | IT.CEL.SETS.P2 |
| humanitarian_crisis | XL | 172 | 43 | 0.929 | NY.GDP.PCAP.CD |
| territorial_disputes | L | 172 | 43 | 0.927 | FI.RES.TOTL.CD |
| trade_agreement | XL | 172 | 43 | 0.854 | FI.RES.TOTL.CD |
| sanctions_and_arms_embargo | XL | 172 | 43 | 0.854 | SP.DYN.LE00.IN |
| foreign_intervention | L | 172 | 43 | 0.841 | SH.DYN.MORT |
| fiscal_policy_change | L | 172 | 43 | 0.825 | NE.IMP.GNFS.CD |
| human_rights_violation | L | 172 | 43 | 0.763 | IT.CEL.SETS.P2 |
| migration_and_refugees | L | 172 | 43 | 0.761 | NY.GDP.PCAP.CD |
| constitutional_change | L | 172 | 43 | 0.742 | FM.LBL.BMNY.GD.ZS |
| social_policy_reform | M | 172 | 43 | 0.738 | SP.DYN.LE00.IN |
| executive_power_consolidation | M | 172 | 43 | 0.738 | SH.DYN.MORT |
| epidemic_and_pandemic | XL | 172 | 43 | 0.720 | NE.IMP.GNFS.CD |
| elections_and_voting | L | 172 | 43 | 0.702 | NE.IMP.GNFS.CD |
| bilateral_treaty | L | 172 | 43 | 0.683 | AG.PRD.FOOD.XD |
| energy_policy | L | 172 | 43 | 0.679 | NE.IMP.GNFS.CD |
| human_rights_reform | L | 172 | 43 | 0.671 | SH.DYN.MORT |
| infrastructure_project | L | 172 | 43 | 0.644 | MS.MIL.XPND.GD.ZS |
| peacekeeping_and_peace_process | L | 172 | 43 | 0.634 | SP.DYN.TFRT.IN |
| democratic_transition | L | 172 | 43 | 0.633 | NV.AGR.TOTL.ZS |
| diplomatic_rupture | L | 172 | 43 | 0.617 | SH.DYN.MORT |
| military_coup | M | 172 | 43 | 0.610 | SP.DYN.LE00.IN |
| agricultural_policy | M | 172 | 43 | 0.595 | SP.POP.TOTL |
| multilateral_agreement | L | 172 | 43 | 0.577 | NV.AGR.TOTL.ZS |
| government_formation | L | 172 | 43 | 0.568 | IT.CEL.SETS.P2 |
| military_policy_and_reform | L | 172 | 43 | 0.537 | NE.EXP.GNFS.CD |
| transitional_justice | XL | 172 | 43 | 0.524 | AG.PRD.FOOD.XD |
| flood_and_cyclone | XL | 172 | 43 | 0.500 | MS.MIL.XPND.GD.ZS |
| public_health_reform | XL | 172 | 43 | 0.488 | NE.IMP.GNFS.CD |
| regional_integration | L | 172 | 43 | 0.488 | MS.MIL.XPND.GD.ZS |
| economic_recession | L | 172 | 43 | 0.479 | NY.GDP.MKTP.KD |
| mass_protest | L | 172 | 43 | 0.477 | AG.PRD.FOOD.XD |
| economic_growth_milestone | XL | 172 | 43 | 0.476 | SP.POP.TOTL |
| resource_conflict | XL | 172 | 43 | 0.452 | NY.GDP.PCAP.CD |
| environmental_policy | L | 172 | 43 | 0.442 | MS.MIL.XPND.GD.ZS |
| civil_war_and_insurgency | L | 172 | 43 | 0.437 | SP.DYN.LE00.IN |
| poverty_and_inequality_crisis | XL | 172 | 43 | 0.393 | FI.RES.TOTL.CD |
| natural_disaster | L | 172 | 43 | 0.383 | SP.DYN.TFRT.IN |
| political_repression | L | 172 | 43 | 0.379 | FI.RES.TOTL.CD |
| interstate_war | L | 172 | 43 | 0.354 | IT.CEL.SETS.P2 |
| climate_agreement | XL | 172 | 43 | 0.333 | SP.DYN.TFRT.IN |
| cultural_and_heritage | M | 172 | 43 | 0.333 | NY.GDP.MKTP.KD |
| political_violence | L | 172 | 43 | 0.305 | NY.GDP.PCAP.CD |
| currency_crisis | L | 172 | 43 | 0.131 | AG.PRD.FOOD.XD |
| political_corruption | XL | 172 | 43 | 0.122 | SP.DYN.TFRT.IN |
| oil_and_gas | L | 172 | 43 | 0.095 | AG.PRD.FOOD.XD |
| terrorist_attack | L | 172 | 43 | 0.071 | NY.GDP.MKTP.KD |

## Per-indicator coverage equity

| Indicator | n_countries | coverage_share | regional_evenness | mean_lift_across_recipes | audition_score |
|---|---|---|---|---|---|
| MS.MIL.XPND.GD.ZS | 163 | 0.625 | 0.723 | 0.0181 | **0.0082** |
| AG.PRD.FOOD.XD | 195 | 0.747 | 0.806 | 0.0103 | **0.0062** |
| NE.IMP.GNFS.CD | 190 | 0.728 | 0.823 | 0.0095 | **0.0057** |
| IT.CEL.SETS.P2 | 213 | 0.816 | 0.818 | 0.0077 | **0.0052** |
| NV.AGR.TOTL.ZS | 204 | 0.782 | 0.796 | 0.0072 | **0.0045** |
| FI.RES.TOTL.CD | 180 | 0.690 | 0.796 | 0.0076 | **0.0042** |
| SP.DYN.LE00.IN | 215 | 0.824 | 0.816 | 0.0059 | **0.0039** |
| NE.EXP.GNFS.CD | 190 | 0.728 | 0.823 | 0.0065 | **0.0039** |
| NY.GDP.PCAP.CD | 212 | 0.812 | 0.816 | 0.0056 | **0.0037** |
| SH.DYN.MORT | 195 | 0.747 | 0.794 | 0.0061 | **0.0036** |
| NE.CON.GOVT.ZS | 185 | 0.709 | 0.801 | 0.0061 | **0.0035** |
| SP.DYN.TFRT.IN | 215 | 0.824 | 0.816 | 0.0050 | **0.0034** |
| NE.EXP.GNFS.ZS | 190 | 0.728 | 0.823 | 0.0056 | **0.0033** |
| FM.LBL.BMNY.GD.ZS | 165 | 0.632 | 0.746 | 0.0043 | **0.0020** |
| NY.GDP.MKTP.KD | 211 | 0.808 | 0.816 | 0.0028 | **0.0019** |
| SP.POP.TOTL | 215 | 0.824 | 0.816 | 0.0024 | **0.0016** |
| NY.GNP.PCAP.CD | 206 | 0.789 | 0.803 | 0.0023 | **0.0014** |
| NY.GDP.MKTP.CD | 212 | 0.812 | 0.816 | 0.0019 | **0.0013** |
| NE.CON.PRVT.ZS | 187 | 0.716 | 0.816 | 0.0016 | **0.0009** |
| NE.IMP.GNFS.ZS | 190 | 0.728 | 0.823 | 0.0013 | **0.0008** |
| NV.SRV.TOTL.ZS | 203 | 0.778 | 0.796 | 0.0010 | **0.0006** |
| FP.CPI.TOTL.ZG | 192 | 0.736 | 0.804 | 0.0000 | **0.0000** |
| IT.NET.USER.ZS | 212 | 0.812 | 0.818 | 0.0000 | **0.0000** |
| SM.POP.NETM | 215 | 0.824 | 0.816 | 0.0000 | **0.0000** |
| NV.IND.TOTL.ZS | 206 | 0.789 | 0.796 | 0.0000 | **0.0000** |

## Methodology notes

- **Train/holdout:** stratified 80/20 country split per recipe (fixed seed 42)
- **Model:** GradientBoostingClassifier (sklearn) — n_estimators=80, max_depth=3, lr=0.05
- **Importance:** sklearn permutation_importance, n_repeats=10, scoring=neg_log_loss
- **Coverage equity:** `audition_score = predictive_lift × coverage_share × regional_evenness`
- **Regional evenness:** `1 - gini_coefficient(per-region share of countries with data)`
- **BH-FDR multiple-testing correction:** explicitly OUT OF SCOPE per founder veto (2026-04-26)
- **Missing data:** not imputed; rows with insufficient data drop out of the recipe model

## Audit metadata

- Audit date: `2026-04-26T15:25:32Z`
- Git SHA: `6eb8251`
- Cutoff year: 2020
- Total countries (denominator): 261