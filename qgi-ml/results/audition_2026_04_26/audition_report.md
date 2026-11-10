# Indicator-to-Recipe Audit — 2026-04-26T13:58:11Z

**Pipeline:** v0 · **Cutoff year:** 2020 · **Random seed:** 42

**Indicators audited:** 25 · **Recipes covered:** 47 · **Recipe-indicator cells:** 705


## Headline

- Median per-recipe holdout AUC: **0.776**
- Recipes with AUC ≥ 0.55: **36/47**
- Top-lift indicator (across all recipes, sum of audition_score): **SP.POP.TOTL**
- Mean audition_score: **0.004** (predictive_lift × coverage_share × regional_evenness)

## Per-recipe summary

| Recipe | Tier | n_train | n_test | Test AUC | Top contributor |
|---|---|---|---|---|---|
| epidemic_and_pandemic | XL | 172 | 43 | 1.000 | SP.POP.TOTL |
| foreign_intervention | L | 172 | 43 | 0.988 | NY.GDP.PCAP.CD |
| social_policy_reform | M | 172 | 43 | 0.976 | SP.DYN.LE00.IN |
| trade_agreement | XL | 172 | 43 | 0.976 | SP.POP.TOTL |
| territorial_disputes | L | 172 | 43 | 0.976 | SP.POP.TOTL |
| interstate_war | L | 172 | 43 | 0.951 | MS.MIL.XPND.GD.ZS |
| humanitarian_crisis | XL | 172 | 43 | 0.929 | SP.DYN.TFRT.IN |
| oil_and_gas | L | 172 | 43 | 0.929 | SH.DYN.MORT |
| sport_and_international_event | L | 172 | 43 | 0.905 | NE.EXP.GNFS.ZS |
| public_health_reform | XL | 172 | 43 | 0.881 | SH.DYN.MORT |
| energy_policy | L | 172 | 43 | 0.859 | SP.POP.TOTL |
| terrorist_attack | L | 172 | 43 | 0.857 | MS.MIL.XPND.GD.ZS |
| migration_and_refugees | L | 172 | 43 | 0.856 | SP.DYN.TFRT.IN |
| infrastructure_project | L | 172 | 43 | 0.842 | MS.MIL.XPND.GD.ZS |
| currency_crisis | L | 172 | 43 | 0.833 | MS.MIL.XPND.GD.ZS |
| natural_disaster | L | 172 | 43 | 0.833 | SP.POP.TOTL |
| flood_and_cyclone | XL | 172 | 43 | 0.829 | NE.IMP.GNFS.ZS |
| mass_protest | L | 172 | 43 | 0.811 | NV.AGR.TOTL.ZS |
| human_rights_violation | L | 172 | 43 | 0.808 | SP.POP.TOTL |
| constitutional_change | L | 172 | 43 | 0.805 | NV.AGR.TOTL.ZS |
| bilateral_treaty | L | 172 | 43 | 0.801 | NE.IMP.GNFS.CD |
| peacekeeping_and_peace_process | L | 172 | 43 | 0.793 | FM.LBL.BMNY.GD.ZS |
| diplomatic_rupture | L | 172 | 43 | 0.792 | SP.POP.TOTL |
| elections_and_voting | L | 172 | 43 | 0.776 | SP.POP.TOTL |
| human_rights_reform | L | 172 | 43 | 0.768 | SP.POP.TOTL |
| economic_recession | L | 172 | 43 | 0.753 | SP.POP.TOTL |
| government_formation | L | 172 | 43 | 0.734 | SP.POP.TOTL |
| military_policy_and_reform | L | 172 | 43 | 0.732 | NY.GDP.PCAP.CD |
| fiscal_policy_change | L | 172 | 43 | 0.700 | FI.RES.TOTL.CD |
| democratic_transition | L | 172 | 43 | 0.700 | FI.RES.TOTL.CD |
| political_violence | L | 172 | 43 | 0.683 | SP.POP.TOTL |
| economic_growth_milestone | XL | 172 | 43 | 0.643 | IT.CEL.SETS.P2 |
| political_repression | L | 172 | 43 | 0.637 | IT.CEL.SETS.P2 |
| sanctions_and_arms_embargo | XL | 172 | 43 | 0.585 | FI.RES.TOTL.CD |
| multilateral_agreement | L | 172 | 43 | 0.577 | NV.AGR.TOTL.ZS |
| environmental_policy | L | 172 | 43 | 0.550 | SP.POP.TOTL |
| political_corruption | XL | 172 | 43 | 0.512 | SP.POP.TOTL |
| climate_agreement | XL | 172 | 43 | 0.512 | NE.IMP.GNFS.ZS |
| agricultural_policy | M | 172 | 43 | 0.488 | NY.GDP.PCAP.CD |
| resource_conflict | XL | 172 | 43 | 0.476 | FM.LBL.BMNY.GD.ZS |
| military_coup | M | 172 | 43 | 0.457 | NY.GDP.PCAP.CD |
| transitional_justice | XL | 172 | 43 | 0.451 | AG.PRD.FOOD.XD |
| executive_power_consolidation | M | 172 | 43 | 0.440 | IT.CEL.SETS.P2 |
| poverty_and_inequality_crisis | XL | 172 | 43 | 0.440 | AG.PRD.FOOD.XD |
| cultural_and_heritage | M | 172 | 43 | 0.381 | NE.EXP.GNFS.ZS |
| civil_war_and_insurgency | L | 172 | 43 | 0.371 | SP.POP.TOTL |
| regional_integration | L | 172 | 43 | 0.317 | MS.MIL.XPND.GD.ZS |

## Per-indicator coverage equity

| Indicator | n_countries | coverage_share | regional_evenness | mean_lift_across_recipes | audition_score |
|---|---|---|---|---|---|
| SP.POP.TOTL | 215 | 0.824 | 0.816 | 0.0252 | **0.0170** |
| MS.MIL.XPND.GD.ZS | 163 | 0.625 | 0.723 | 0.0246 | **0.0111** |
| NV.AGR.TOTL.ZS | 204 | 0.782 | 0.796 | 0.0151 | **0.0094** |
| NE.EXP.GNFS.ZS | 190 | 0.728 | 0.823 | 0.0091 | **0.0055** |
| NE.IMP.GNFS.ZS | 190 | 0.728 | 0.823 | 0.0090 | **0.0054** |
| SP.DYN.TFRT.IN | 215 | 0.824 | 0.816 | 0.0077 | **0.0052** |
| NE.CON.GOVT.ZS | 185 | 0.709 | 0.801 | 0.0084 | **0.0048** |
| FI.RES.TOTL.CD | 180 | 0.690 | 0.796 | 0.0084 | **0.0046** |
| AG.PRD.FOOD.XD | 195 | 0.747 | 0.806 | 0.0075 | **0.0045** |
| FM.LBL.BMNY.GD.ZS | 165 | 0.632 | 0.746 | 0.0087 | **0.0041** |
| IT.CEL.SETS.P2 | 213 | 0.816 | 0.818 | 0.0047 | **0.0031** |
| SP.DYN.LE00.IN | 215 | 0.824 | 0.816 | 0.0046 | **0.0031** |
| SH.DYN.MORT | 195 | 0.747 | 0.794 | 0.0051 | **0.0030** |
| NY.GDP.MKTP.KD | 211 | 0.808 | 0.816 | 0.0044 | **0.0029** |
| NY.GDP.PCAP.CD | 212 | 0.812 | 0.816 | 0.0040 | **0.0027** |
| NE.IMP.GNFS.CD | 190 | 0.728 | 0.823 | 0.0044 | **0.0026** |
| NE.EXP.GNFS.CD | 190 | 0.728 | 0.823 | 0.0037 | **0.0022** |
| NY.GDP.MKTP.CD | 212 | 0.812 | 0.816 | 0.0025 | **0.0017** |
| NY.GNP.PCAP.CD | 206 | 0.789 | 0.803 | 0.0016 | **0.0010** |
| NV.SRV.TOTL.ZS | 203 | 0.778 | 0.796 | 0.0014 | **0.0009** |
| FP.CPI.TOTL.ZG | 192 | 0.736 | 0.804 | 0.0004 | **0.0002** |
| NE.CON.PRVT.ZS | 187 | 0.716 | 0.816 | 0.0000 | **0.0000** |
| NV.IND.TOTL.ZS | 206 | 0.789 | 0.796 | 0.0000 | **0.0000** |
| SM.POP.NETM | 215 | 0.824 | 0.816 | 0.0000 | **0.0000** |
| IT.NET.USER.ZS | 212 | 0.812 | 0.818 | 0.0000 | **0.0000** |

## Methodology notes

- **Train/holdout:** stratified 80/20 country split per recipe (fixed seed 42)
- **Model:** GradientBoostingClassifier (sklearn) — n_estimators=80, max_depth=3, lr=0.05
- **Importance:** sklearn permutation_importance, n_repeats=10, scoring=neg_log_loss
- **Coverage equity:** `audition_score = predictive_lift × coverage_share × regional_evenness`
- **Regional evenness:** `1 - gini_coefficient(per-region share of countries with data)`
- **BH-FDR multiple-testing correction:** explicitly OUT OF SCOPE per founder veto (2026-04-26)
- **Missing data:** not imputed; rows with insufficient data drop out of the recipe model

## Audit metadata

- Audit date: `2026-04-26T13:58:11Z`
- Git SHA: `5970cda`
- Cutoff year: 2020
- Total countries (denominator): 261