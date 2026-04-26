# Indicator-to-Recipe Audit — 2026-04-26T19:37:17Z

**Pipeline:** v0 · **Cutoff year:** 2020 · **Random seed:** 42

**Indicators audited:** 37 · **Recipes covered:** 47 · **Recipe-indicator cells:** 1269


## Headline

- Median per-recipe holdout AUC: **0.631**
- Recipes with AUC ≥ 0.55: **28/47**
- Top-lift indicator (across all recipes, sum of audition_score): **v2cacamps**
- Mean audition_score: **0.001** (predictive_lift × coverage_share × regional_evenness)

## Per-recipe summary

| Recipe | Tier | n_train | n_test | Test AUC | Top contributor |
|---|---|---|---|---|---|
| sport_and_international_event | L | 172 | 44 | 0.953 | FM.LBL.BMNY.GD.ZS |
| sanctions_and_arms_embargo | XL | 172 | 44 | 0.881 | SP.DYN.LE00.IN |
| trade_agreement | XL | 172 | 44 | 0.881 | FI.RES.TOTL.CD |
| oil_and_gas | L | 172 | 44 | 0.872 | SP.DYN.LE00.IN |
| human_rights_violation | L | 172 | 44 | 0.850 | v2csreprss |
| social_policy_reform | M | 172 | 44 | 0.837 | SP.DYN.LE00.IN |
| agricultural_policy | M | 172 | 44 | 0.837 | v2x_regime |
| fiscal_policy_change | L | 172 | 44 | 0.823 | NE.IMP.GNFS.CD |
| military_coup | M | 172 | 44 | 0.821 | v2stfisccap |
| economic_recession | L | 172 | 44 | 0.815 | v2cacamps |
| resource_conflict | XL | 172 | 44 | 0.814 | v2excrptps |
| humanitarian_crisis | XL | 172 | 44 | 0.814 | NY.GNP.PCAP.CD |
| currency_crisis | L | 172 | 44 | 0.767 | v2stfisccap |
| democratic_transition | L | 172 | 44 | 0.756 | v2stfisccap |
| foreign_intervention | L | 172 | 44 | 0.750 | IT.CEL.SETS.P2 |
| territorial_disputes | L | 172 | 44 | 0.738 | FI.RES.TOTL.CD |
| epidemic_and_pandemic | XL | 172 | 44 | 0.726 | NE.IMP.GNFS.CD |
| elections_and_voting | L | 172 | 44 | 0.714 | v2cacamps |
| bilateral_treaty | L | 172 | 44 | 0.703 | v2xlg_legcon |
| flood_and_cyclone | XL | 172 | 44 | 0.690 | v2x_freexp_altinf |
| migration_and_refugees | L | 172 | 44 | 0.680 | v2stfisccap |
| transitional_justice | XL | 172 | 44 | 0.667 | SP.DYN.LE00.IN |
| constitutional_change | L | 172 | 44 | 0.646 | NV.AGR.TOTL.ZS |
| political_repression | L | 172 | 44 | 0.631 | v2x_clphy |
| infrastructure_project | L | 172 | 44 | 0.614 | MS.MIL.XPND.GD.ZS |
| government_formation | L | 172 | 44 | 0.606 | v2cacamps |
| diplomatic_rupture | L | 172 | 44 | 0.589 | v2x_partip |
| energy_policy | L | 172 | 44 | 0.562 | SP.POP.TOTL |
| political_violence | L | 172 | 44 | 0.548 | SP.DYN.LE00.IN |
| mass_protest | L | 172 | 44 | 0.537 | IT.CEL.SETS.P2 |
| multilateral_agreement | L | 172 | 44 | 0.531 | v2x_freexp_altinf |
| peacekeeping_and_peace_process | L | 172 | 44 | 0.524 | FM.LBL.BMNY.GD.ZS |
| civil_war_and_insurgency | L | 172 | 44 | 0.492 | v2x_jucon |
| interstate_war | L | 172 | 44 | 0.476 | SP.DYN.TFRT.IN |
| environmental_policy | L | 172 | 44 | 0.472 | NE.IMP.GNFS.CD |
| regional_integration | L | 172 | 44 | 0.470 | MS.MIL.XPND.GD.ZS |
| executive_power_consolidation | M | 172 | 44 | 0.442 | v2excrptps |
| political_corruption | XL | 172 | 44 | 0.440 | SP.POP.TOTL |
| poverty_and_inequality_crisis | XL | 172 | 44 | 0.419 | v2x_partip |
| public_health_reform | XL | 172 | 44 | 0.407 | v2csreprss |
| natural_disaster | L | 172 | 44 | 0.382 | SP.DYN.TFRT.IN |
| economic_growth_milestone | XL | 172 | 44 | 0.372 | v2csreprss |
| cultural_and_heritage | M | 172 | 44 | 0.267 | SP.DYN.TFRT.IN |
| military_policy_and_reform | L | 172 | 44 | 0.262 | v2x_clphy |
| climate_agreement | XL | 172 | 44 | 0.244 | NE.IMP.GNFS.ZS |
| human_rights_reform | L | 172 | 44 | 0.238 | SP.DYN.LE00.IN |
| terrorist_attack | L | 172 | 44 | 0.163 | SP.DYN.TFRT.IN |

## Per-indicator coverage equity (existing fingerprint indicators)

| Indicator | n_countries | coverage_share | regional_evenness | mean_lift_across_recipes | audition_score |
|---|---|---|---|---|---|
| MS.MIL.XPND.GD.ZS | 163 | 0.625 | 0.723 | 0.0071 | **0.0032** |
| NE.IMP.GNFS.CD | 190 | 0.728 | 0.823 | 0.0047 | **0.0028** |
| SP.DYN.LE00.IN | 215 | 0.824 | 0.816 | 0.0038 | **0.0026** |
| NV.AGR.TOTL.ZS | 204 | 0.782 | 0.796 | 0.0036 | **0.0022** |
| FI.RES.TOTL.CD | 180 | 0.690 | 0.796 | 0.0039 | **0.0021** |
| SP.DYN.TFRT.IN | 215 | 0.824 | 0.816 | 0.0031 | **0.0021** |
| IT.CEL.SETS.P2 | 213 | 0.816 | 0.818 | 0.0028 | **0.0019** |
| FM.LBL.BMNY.GD.ZS | 165 | 0.632 | 0.746 | 0.0035 | **0.0016** |
| SP.POP.TOTL | 215 | 0.824 | 0.816 | 0.0019 | **0.0013** |
| AG.PRD.FOOD.XD | 195 | 0.747 | 0.806 | 0.0021 | **0.0013** |
| NE.CON.GOVT.ZS | 185 | 0.709 | 0.801 | 0.0022 | **0.0012** |
| NV.SRV.TOTL.ZS | 203 | 0.778 | 0.796 | 0.0020 | **0.0012** |
| NE.EXP.GNFS.CD | 190 | 0.728 | 0.823 | 0.0019 | **0.0011** |
| NY.GDP.PCAP.CD | 212 | 0.812 | 0.816 | 0.0016 | **0.0011** |
| NY.GNP.PCAP.CD | 206 | 0.789 | 0.803 | 0.0015 | **0.0009** |
| SH.DYN.MORT | 195 | 0.747 | 0.794 | 0.0015 | **0.0009** |
| NY.GDP.MKTP.CD | 212 | 0.812 | 0.816 | 0.0011 | **0.0007** |
| NE.IMP.GNFS.ZS | 190 | 0.728 | 0.823 | 0.0010 | **0.0006** |
| NY.GDP.MKTP.KD | 211 | 0.808 | 0.816 | 0.0009 | **0.0006** |
| NE.EXP.GNFS.ZS | 190 | 0.728 | 0.823 | 0.0009 | **0.0005** |
| NE.CON.PRVT.ZS | 187 | 0.716 | 0.816 | 0.0006 | **0.0004** |
| FP.CPI.TOTL.ZG | 192 | 0.736 | 0.804 | 0.0005 | **0.0003** |
| SM.POP.NETM | 215 | 0.824 | 0.816 | 0.0000 | **0.0000** |
| IT.NET.USER.ZS | 212 | 0.812 | 0.818 | 0.0000 | **0.0000** |
| NV.IND.TOTL.ZS | 206 | 0.789 | 0.796 | 0.0000 | **0.0000** |

## CANDIDATE indicators audited (NOT YET in any recipe fingerprint)

These indicators were tested as candidates alongside existing fingerprint members. audition_score reflects their predictive lift across all recipes — informational only (per founder direction, integration is independent of audition).

| Candidate | n_countries | coverage_share | regional_evenness | mean_lift_across_recipes | audition_score |
|---|---|---|---|---|---|
| v2cacamps | 175 | 0.670 | 0.740 | 0.0065 | **0.0032** |
| v2x_clphy | 175 | 0.670 | 0.740 | 0.0045 | **0.0022** |
| v2stfisccap | 175 | 0.670 | 0.740 | 0.0043 | **0.0021** |
| v2csreprss | 175 | 0.670 | 0.740 | 0.0034 | **0.0017** |
| v2x_polyarchy | 175 | 0.670 | 0.740 | 0.0024 | **0.0012** |
| v2excrptps | 175 | 0.670 | 0.740 | 0.0022 | **0.0011** |
| v2x_partip | 175 | 0.670 | 0.740 | 0.0022 | **0.0011** |
| v2x_freexp_altinf | 175 | 0.670 | 0.740 | 0.0021 | **0.0010** |
| v2xlg_legcon | 175 | 0.670 | 0.740 | 0.0019 | **0.0010** |
| v2x_jucon | 175 | 0.670 | 0.740 | 0.0015 | **0.0007** |
| v2x_regime | 175 | 0.670 | 0.740 | 0.0014 | **0.0007** |
| v2x_libdem | 175 | 0.670 | 0.740 | 0.0008 | **0.0004** |

## Methodology notes

- **Train/holdout:** stratified 80/20 country split per recipe (fixed seed 42)
- **Model:** GradientBoostingClassifier (sklearn) — n_estimators=80, max_depth=3, lr=0.05
- **Importance:** sklearn permutation_importance, n_repeats=10, scoring=neg_log_loss
- **Coverage equity:** `audition_score = predictive_lift × coverage_share × regional_evenness`
- **Regional evenness:** `1 - gini_coefficient(per-region share of countries with data)`
- **BH-FDR multiple-testing correction:** explicitly OUT OF SCOPE per founder veto (2026-04-26)
- **Missing data:** not imputed; rows with insufficient data drop out of the recipe model

## Audit metadata

- Audit date: `2026-04-26T19:37:17Z`
- Git SHA: `8c9a4aa`
- Cutoff year: 2020
- Total countries (denominator): 261