# Indicator-to-Recipe Audit — 2026-04-27T01:14:47Z

**Pipeline:** v0 · **Cutoff year:** 2020 · **Random seed:** 42

**Indicators audited:** 64 · **Recipes covered:** 47 · **Recipe-indicator cells:** 2538


## Headline

- Median per-recipe holdout AUC: **0.589**
- Recipes with AUC ≥ 0.55: **26/47**
- Top-lift indicator (across all recipes, sum of audition_score): **NE.IMP.GNFS.CD**
- Mean audition_score: **0.001** (predictive_lift × coverage_share × regional_evenness)

## Per-recipe summary

Test AUC column shows point estimate + 90% bootstrap CI on the holdout. Wide CIs (>0.20 spread) indicate the AUC is unstable on this small holdout — treat the point estimate with skepticism (#498).

| Recipe | Tier | n_total | n_pos | pos_rate | n_train | n_test | Test AUC [90% CI] | Top contributor |
|---|---|---|---|---|---|---|---|---|
| social_policy_reform | M | 216 | 6 | 0.028 | 172 | 44 | 0.977 [0.930, 1.000] | v2elintmon |
| epidemic_and_pandemic | XL | 216 | 8 | 0.037 | 172 | 44 | 0.964 [0.916, 1.000] | v2jureform |
| trade_agreement | XL | 216 | 8 | 0.037 | 172 | 44 | 0.952 [0.905, 1.000] | v2x_neopat |
| military_coup | M | 216 | 12 | 0.056 | 172 | 44 | 0.940 [0.833, 1.000] | v2lgqstexp |
| human_rights_reform | L | 216 | 10 | 0.046 | 172 | 44 | 0.917 [0.833, 0.976] | v2clkill |
| economic_recession | L | 216 | 26 | 0.120 | 172 | 44 | 0.897 [0.795, 0.985] | v2ex_hosw |
| economic_growth_milestone | XL | 216 | 5 | 0.023 | 172 | 44 | 0.860 [0.767, 0.953] | v2clkill |
| currency_crisis | L | 216 | 6 | 0.028 | 172 | 44 | 0.849 [0.767, 0.931] | v2ex_hosw |
| sanctions_and_arms_embargo | XL | 216 | 12 | 0.056 | 172 | 44 | 0.798 [0.667, 0.905] | SP.DYN.LE00.IN |
| resource_conflict | XL | 216 | 6 | 0.028 | 172 | 44 | 0.791 [0.698, 0.884] | v2x_neopat |
| territorial_disputes | L | 216 | 11 | 0.051 | 172 | 44 | 0.786 [0.619, 0.952] | v2x_corr |
| human_rights_violation | L | 216 | 18 | 0.083 | 172 | 44 | 0.775 [0.637, 0.925] | v2xel_frefair |
| fiscal_policy_change | L | 216 | 39 | 0.181 | 172 | 44 | 0.774 [0.635, 0.910] | NE.IMP.GNFS.CD |
| bilateral_treaty | L | 216 | 58 | 0.269 | 172 | 44 | 0.771 [0.674, 0.891] | v2xeg_eqprotec |
| constitutional_change | L | 216 | 23 | 0.106 | 172 | 44 | 0.744 [0.595, 0.872] | v2pepwrses |
| migration_and_refugees | L | 216 | 32 | 0.148 | 172 | 44 | 0.720 [0.494, 0.904] | v2cacamps |
| foreign_intervention | L | 216 | 11 | 0.051 | 172 | 44 | 0.690 [0.548, 0.833] | IT.CEL.SETS.P2 |
| elections_and_voting | L | 216 | 58 | 0.269 | 172 | 44 | 0.672 [0.542, 0.792] | v2cacamps |
| peacekeeping_and_peace_process | L | 216 | 11 | 0.051 | 172 | 44 | 0.661 [0.548, 0.786] | FM.LBL.BMNY.GD.ZS |
| mass_protest | L | 216 | 32 | 0.148 | 172 | 44 | 0.633 [0.417, 0.815] | v2svdomaut |
| political_repression | L | 216 | 25 | 0.116 | 172 | 44 | 0.626 [0.497, 0.769] | v2pepwrses |
| multilateral_agreement | L | 216 | 19 | 0.088 | 172 | 44 | 0.619 [0.337, 0.950] | v2elintmon |
| regional_integration | L | 216 | 12 | 0.056 | 172 | 44 | 0.595 [0.202, 0.976] | MS.MIL.XPND.GD.ZS |
| flood_and_cyclone | XL | 216 | 10 | 0.046 | 172 | 44 | 0.589 [0.167, 1.000] | v2pepwrort |
| diplomatic_rupture | L | 216 | 15 | 0.069 | 172 | 44 | 0.585 [0.316, 0.780] | v2x_partip |
| government_formation | L | 216 | 32 | 0.148 | 172 | 44 | 0.552 [0.378, 0.703] | v2cacamps |
| military_policy_and_reform | L | 216 | 10 | 0.046 | 172 | 44 | 0.542 [0.422, 0.667] | v2jureform |
| environmental_policy | L | 216 | 14 | 0.065 | 172 | 44 | 0.533 [0.390, 0.663] | SP.DYN.TFRT.IN |
| civil_war_and_insurgency | L | 216 | 27 | 0.125 | 172 | 44 | 0.528 [0.354, 0.718] | v2x_jucon |
| democratic_transition | L | 216 | 15 | 0.069 | 172 | 44 | 0.520 [0.292, 0.781] | v2stfisccap |
| transitional_justice | XL | 216 | 11 | 0.051 | 172 | 44 | 0.488 [0.131, 0.857] | v2pepwrses |
| energy_policy | L | 216 | 22 | 0.102 | 172 | 44 | 0.450 [0.250, 0.669] | v2x_neopat |
| infrastructure_project | L | 216 | 30 | 0.139 | 172 | 44 | 0.447 [0.275, 0.623] | v2jureform |
| interstate_war | L | 216 | 10 | 0.046 | 172 | 44 | 0.423 [0.262, 0.596] | v2x_clpriv |
| poverty_and_inequality_crisis | XL | 216 | 5 | 0.023 | 172 | 44 | 0.407 [0.360, 0.453] | v2x_partip |
| public_health_reform | XL | 216 | 5 | 0.023 | 172 | 44 | 0.395 [0.326, 0.466] | NE.IMP.GNFS.CD |
| sport_and_international_event | L | 216 | 6 | 0.028 | 172 | 44 | 0.395 [0.337, 0.442] | v2csprtcpt |
| terrorist_attack | L | 216 | 7 | 0.032 | 172 | 44 | 0.372 [0.313, 0.442] | v2x_jucon |
| climate_agreement | XL | 216 | 7 | 0.032 | 172 | 44 | 0.360 [0.302, 0.407] | NE.IMP.GNFS.ZS |
| natural_disaster | L | 216 | 14 | 0.065 | 172 | 44 | 0.354 [0.179, 0.537] | v2excrptps |
| agricultural_policy | M | 216 | 6 | 0.028 | 172 | 44 | 0.337 [0.267, 0.396] | v2x_partip |
| executive_power_consolidation | M | 216 | 6 | 0.028 | 172 | 44 | 0.326 [0.256, 0.395] | v2clkill |
| political_corruption | XL | 216 | 10 | 0.046 | 172 | 44 | 0.310 [0.250, 0.369] | IT.CEL.SETS.P2 |
| cultural_and_heritage | M | 216 | 5 | 0.023 | 172 | 44 | 0.279 [0.221, 0.337] | SP.DYN.TFRT.IN |
| humanitarian_crisis | XL | 216 | 6 | 0.028 | 172 | 44 | 0.267 [0.198, 0.337] | v2x_neopat |
| political_violence | L | 216 | 12 | 0.056 | 172 | 44 | 0.262 [0.131, 0.405] | SP.DYN.LE00.IN |
| oil_and_gas | L | 216 | 6 | 0.028 | 172 | 44 | 0.186 [0.104, 0.268] | AG.PRD.FOOD.XD |

## Per-indicator coverage equity (existing fingerprint indicators)

| Indicator | Provider | n_countries | coverage_share | regional_evenness | mean_lift_across_recipes | audition_score |
|---|---|---|---|---|---|---|
| NE.IMP.GNFS.CD | ? | 190 | 0.728 | 0.823 | 0.0046 | **0.0027** |
| SP.DYN.LE00.IN | ? | 215 | 0.824 | 0.816 | 0.0014 | **0.0009** |
| NV.AGR.TOTL.ZS | ? | 204 | 0.782 | 0.796 | 0.0014 | **0.0009** |
| MS.MIL.XPND.GD.ZS | ? | 163 | 0.625 | 0.723 | 0.0018 | **0.0008** |
| IT.CEL.SETS.P2 | ? | 213 | 0.816 | 0.818 | 0.0011 | **0.0008** |
| FI.RES.TOTL.CD | ? | 180 | 0.690 | 0.796 | 0.0012 | **0.0007** |
| NE.IMP.GNFS.ZS | ? | 190 | 0.728 | 0.823 | 0.0011 | **0.0006** |
| NY.GDP.MKTP.KD | ? | 211 | 0.808 | 0.816 | 0.0008 | **0.0006** |
| SP.DYN.TFRT.IN | ? | 215 | 0.824 | 0.816 | 0.0006 | **0.0004** |
| SH.DYN.MORT | ? | 195 | 0.747 | 0.794 | 0.0007 | **0.0004** |
| FM.LBL.BMNY.GD.ZS | ? | 165 | 0.632 | 0.746 | 0.0008 | **0.0004** |
| NE.EXP.GNFS.CD | ? | 190 | 0.728 | 0.823 | 0.0006 | **0.0004** |
| NE.EXP.GNFS.ZS | ? | 190 | 0.728 | 0.823 | 0.0006 | **0.0004** |
| NY.GDP.MKTP.CD | ? | 212 | 0.812 | 0.816 | 0.0005 | **0.0003** |
| SP.POP.TOTL | ? | 215 | 0.824 | 0.816 | 0.0004 | **0.0003** |
| NY.GDP.PCAP.CD | ? | 212 | 0.812 | 0.816 | 0.0004 | **0.0003** |
| AG.PRD.FOOD.XD | ? | 195 | 0.747 | 0.806 | 0.0004 | **0.0002** |
| NY.GNP.PCAP.CD | ? | 206 | 0.789 | 0.803 | 0.0003 | **0.0002** |
| NV.SRV.TOTL.ZS | ? | 203 | 0.778 | 0.796 | 0.0001 | **0.0001** |
| FP.CPI.TOTL.ZG | ? | 192 | 0.736 | 0.804 | 0.0000 | **0.0000** |
| NE.CON.GOVT.ZS | ? | 185 | 0.709 | 0.801 | 0.0000 | **0.0000** |
| NE.CON.PRVT.ZS | ? | 187 | 0.716 | 0.816 | 0.0000 | **0.0000** |
| IT.NET.USER.ZS | ? | 212 | 0.812 | 0.818 | 0.0000 | **0.0000** |
| SM.POP.NETM | ? | 215 | 0.824 | 0.816 | 0.0000 | **0.0000** |
| NV.IND.TOTL.ZS | ? | 206 | 0.789 | 0.796 | 0.0000 | **0.0000** |

## CANDIDATE indicators audited (NOT YET in any recipe fingerprint)

These indicators were tested as candidates alongside existing fingerprint members. audition_score reflects their predictive lift across all recipes — informational only (per founder direction, integration is independent of audition).

| Candidate | Provider | n_countries | coverage_share | regional_evenness | mean_lift_across_recipes | audition_score |
|---|---|---|---|---|---|---|
| v2cacamps | VDEM | 175 | 0.670 | 0.740 | 0.0045 | **0.0022** |
| v2elintmon | VDEM | 170 | 0.651 | 0.737 | 0.0041 | **0.0020** |
| v2x_neopat | VDEM | 175 | 0.670 | 0.740 | 0.0037 | **0.0018** |
| v2pepwrses | VDEM | 175 | 0.670 | 0.740 | 0.0032 | **0.0016** |
| v2jureform | VDEM | 175 | 0.670 | 0.740 | 0.0026 | **0.0013** |
| v2ex_hosw | VDEM | 175 | 0.670 | 0.740 | 0.0022 | **0.0011** |
| v2stfisccap | VDEM | 175 | 0.670 | 0.740 | 0.0021 | **0.0010** |
| v2exl_legitlead | VDEM | 175 | 0.670 | 0.740 | 0.0021 | **0.0010** |
| v2clkill | VDEM | 175 | 0.670 | 0.740 | 0.0021 | **0.0010** |
| v2xeg_eqprotec | VDEM | 175 | 0.670 | 0.740 | 0.0021 | **0.0010** |
| v2x_corr | VDEM | 175 | 0.670 | 0.740 | 0.0020 | **0.0010** |
| v2x_clpriv | VDEM | 175 | 0.670 | 0.740 | 0.0019 | **0.0010** |
| v2pepwrort | VDEM | 175 | 0.670 | 0.740 | 0.0019 | **0.0009** |
| v2x_clphy | VDEM | 175 | 0.670 | 0.740 | 0.0018 | **0.0009** |
| v2cltort | VDEM | 175 | 0.670 | 0.740 | 0.0017 | **0.0009** |
| v2svdomaut | VDEM | 175 | 0.670 | 0.740 | 0.0017 | **0.0008** |
| v2xel_frefair | VDEM | 175 | 0.670 | 0.740 | 0.0015 | **0.0007** |
| v2x_partip | VDEM | 175 | 0.670 | 0.740 | 0.0014 | **0.0007** |
| v2excrptps | VDEM | 175 | 0.670 | 0.740 | 0.0013 | **0.0007** |
| v2pepwrsoc | VDEM | 175 | 0.670 | 0.740 | 0.0013 | **0.0007** |
| v2lgqstexp | VDEM | 175 | 0.670 | 0.740 | 0.0012 | **0.0006** |
| v2psprlnks | VDEM | 175 | 0.670 | 0.740 | 0.0011 | **0.0005** |
| v2exremhog | VDEM | 134 | 0.513 | 0.694 | 0.0013 | **0.0005** |
| v2x_jucon | VDEM | 175 | 0.670 | 0.740 | 0.0008 | **0.0004** |
| v2x_freexp_altinf | VDEM | 175 | 0.670 | 0.740 | 0.0008 | **0.0004** |
| v2csreprss | VDEM | 175 | 0.670 | 0.740 | 0.0007 | **0.0004** |
| v2x_gender | VDEM | 175 | 0.670 | 0.740 | 0.0007 | **0.0004** |
| v2x_polyarchy | VDEM | 175 | 0.670 | 0.740 | 0.0007 | **0.0004** |
| v2x_libdem | VDEM | 175 | 0.670 | 0.740 | 0.0006 | **0.0003** |
| v2mecenefm | VDEM | 175 | 0.670 | 0.740 | 0.0006 | **0.0003** |
| v2xlg_legcon | VDEM | 175 | 0.670 | 0.740 | 0.0006 | **0.0003** |
| v2lgbicam | VDEM | 175 | 0.670 | 0.740 | 0.0006 | **0.0003** |
| v2pepwrgen | VDEM | 175 | 0.670 | 0.740 | 0.0006 | **0.0003** |
| v2x_clpol | VDEM | 175 | 0.670 | 0.740 | 0.0005 | **0.0003** |
| v2x_rule | VDEM | 175 | 0.670 | 0.740 | 0.0005 | **0.0003** |
| v2csprtcpt | VDEM | 175 | 0.670 | 0.740 | 0.0004 | **0.0002** |
| v2x_regime | VDEM | 175 | 0.670 | 0.740 | 0.0004 | **0.0002** |
| v2cseeorgs | VDEM | 175 | 0.670 | 0.740 | 0.0003 | **0.0001** |
| v2exaphogp | VDEM | 119 | 0.456 | 0.643 | 0.0003 | **0.0001** |

## Methodology notes

- **Train/holdout:** stratified 80/20 country split per recipe (fixed seed 42)
- **Model:** GradientBoostingClassifier (sklearn) — n_estimators=80, max_depth=3, lr=0.05
- **Importance:** sklearn permutation_importance, n_repeats=10, scoring=neg_log_loss
- **Coverage equity:** `audition_score = predictive_lift × coverage_share × regional_evenness`
- **Regional evenness:** `1 - gini_coefficient(per-region share of countries with data)`
- **BH-FDR multiple-testing correction:** explicitly OUT OF SCOPE per founder veto (2026-04-26)
- **Missing data:** not imputed; rows with insufficient data drop out of the recipe model

## Audit metadata

- Audit date: `2026-04-27T01:14:47Z`
- Git SHA: `c045d79`
- Cutoff year: 2020
- Total countries (denominator): 261