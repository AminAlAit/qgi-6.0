# Indicator-to-Recipe Audit — 2026-04-27T10:40:19Z

**Pipeline:** v0 · **Cutoff year:** 2020 · **Random seed:** 42

**Indicators audited:** 64 · **Recipes covered:** 47 · **Recipe-indicator cells:** 2538


## Headline

- Median per-recipe holdout AUC: **0.581**
- Recipes with AUC ≥ 0.55: **25/47**
- Top-lift indicator (across all recipes, sum of audition_score): **v2stfisccap**
- Mean audition_score: **0.001** (predictive_lift × coverage_share × regional_evenness)

## Per-recipe summary

Test AUC column shows point estimate + 90% bootstrap CI on the holdout. Wide CIs (>0.20 spread) indicate the AUC is unstable on this small holdout — treat the point estimate with skepticism (#498). MNAR column shows count of fingerprint indicators flagged for missingness-correlates-with-outcome (#493 item 1).

| Recipe | Tier | n_total | n_pos | pos_rate | n_train | n_test | Test AUC [90% CI] | MNAR | Top contributor |
|---|---|---|---|---|---|---|---|---|---|
| economic_growth_milestone | XL | 216 | 5 | 0.023 | 172 | 44 | 1.000 [1.000, 1.000] | 0 | SH.DYN.MORT |
| currency_crisis | L | 216 | 6 | 0.028 | 172 | 44 | 0.953 [0.906, 1.000] | 0 | v2exl_legitlead |
| economic_recession | L | 216 | 26 | 0.120 | 172 | 44 | 0.949 [0.876, 1.000] | 0 | v2ex_hosw |
| military_coup | M | 216 | 12 | 0.056 | 172 | 44 | 0.940 [0.857, 1.000] | 0 | v2stfisccap |
| human_rights_reform | L | 216 | 10 | 0.046 | 172 | 44 | 0.917 [0.833, 0.976] | 0 | v2clkill |
| epidemic_and_pandemic | XL | 216 | 8 | 0.037 | 172 | 44 | 0.869 [0.738, 0.976] | 0 | FM.LBL.BMNY.GD.ZS |
| human_rights_violation | L | 216 | 18 | 0.083 | 172 | 44 | 0.869 [0.762, 0.969] | 0 | v2pepwrsoc |
| fiscal_policy_change | L | 216 | 39 | 0.181 | 172 | 44 | 0.806 [0.694, 0.917] | 0 | NE.IMP.GNFS.CD |
| interstate_war | L | 216 | 10 | 0.046 | 172 | 44 | 0.774 [0.689, 0.869] | ⚠ 3 | MS.MIL.XPND.GD.ZS |
| democratic_transition | L | 216 | 15 | 0.069 | 172 | 44 | 0.772 [0.537, 0.960] | 0 | v2stfisccap |
| migration_and_refugees | L | 216 | 32 | 0.148 | 172 | 44 | 0.770 [0.494, 0.942] | 0 | v2cacamps |
| constitutional_change | L | 216 | 23 | 0.106 | 172 | 44 | 0.769 [0.564, 0.913] | 0 | NY.GDP.MKTP.KD |
| bilateral_treaty | L | 216 | 58 | 0.269 | 172 | 44 | 0.766 [0.635, 0.883] | 0 | v2excrptps |
| diplomatic_rupture | L | 216 | 15 | 0.069 | 172 | 44 | 0.732 [0.610, 0.829] | 0 | v2x_partip |
| elections_and_voting | L | 216 | 58 | 0.269 | 172 | 44 | 0.727 [0.588, 0.823] | 0 | v2cacamps |
| peacekeeping_and_peace_process | L | 216 | 11 | 0.051 | 172 | 44 | 0.702 [0.583, 0.810] | 0 | v2mecenefm |
| trade_agreement | XL | 216 | 8 | 0.037 | 172 | 44 | 0.690 [0.357, 1.000] | 0 | NY.GDP.MKTP.KD |
| sanctions_and_arms_embargo | XL | 216 | 12 | 0.056 | 172 | 44 | 0.673 [0.357, 0.976] | 0 | SP.DYN.LE00.IN |
| territorial_disputes | L | 216 | 11 | 0.051 | 172 | 44 | 0.649 [0.261, 1.000] | 0 | v2pepwrses |
| multilateral_agreement | L | 216 | 19 | 0.088 | 172 | 44 | 0.647 [0.375, 0.951] | 0 | v2elintmon |
| mass_protest | L | 216 | 32 | 0.148 | 172 | 44 | 0.637 [0.459, 0.781] | 0 | v2svdomaut |
| foreign_intervention | L | 216 | 11 | 0.051 | 172 | 44 | 0.631 [0.452, 0.763] | 0 | v2x_rule |
| energy_policy | L | 216 | 22 | 0.102 | 172 | 44 | 0.594 [0.438, 0.744] | 0 | v2jureform |
| humanitarian_crisis | XL | 216 | 6 | 0.028 | 172 | 44 | 0.581 [0.442, 0.721] | 0 | v2elintmon |
| regional_integration | L | 216 | 12 | 0.056 | 172 | 44 | 0.571 [0.202, 0.952] | 0 | v2pepwrgen |
| natural_disaster | L | 216 | 14 | 0.065 | 172 | 44 | 0.537 [0.374, 0.692] | 0 | v2excrptps |
| government_formation | L | 216 | 32 | 0.148 | 172 | 44 | 0.525 [0.332, 0.692] | 0 | v2cacamps |
| infrastructure_project | L | 216 | 30 | 0.139 | 172 | 44 | 0.513 [0.385, 0.654] | 0 | MS.MIL.XPND.GD.ZS |
| flood_and_cyclone | XL | 216 | 10 | 0.046 | 172 | 44 | 0.512 [0.202, 0.811] | 0 | v2x_freexp_altinf |
| political_repression | L | 216 | 25 | 0.116 | 172 | 44 | 0.503 [0.344, 0.646] | 0 | v2x_clphy |
| civil_war_and_insurgency | L | 216 | 27 | 0.125 | 172 | 44 | 0.446 [0.308, 0.605] | 0 | v2x_jucon |
| oil_and_gas | L | 216 | 6 | 0.028 | 172 | 44 | 0.442 [0.384, 0.488] | 0 | v2xel_frefair |
| military_policy_and_reform | L | 216 | 10 | 0.046 | 172 | 44 | 0.423 [0.238, 0.690] | ⚠ 3 | NY.GDP.PCAP.CD |
| poverty_and_inequality_crisis | XL | 216 | 5 | 0.023 | 172 | 44 | 0.419 [0.360, 0.477] | 0 | v2cltort |
| environmental_policy | L | 216 | 14 | 0.065 | 172 | 44 | 0.407 [0.195, 0.659] | 0 | v2elintmon |
| terrorist_attack | L | 216 | 7 | 0.032 | 172 | 44 | 0.395 [0.348, 0.453] | 0 | IT.CEL.SETS.P2 |
| social_policy_reform | M | 216 | 6 | 0.028 | 172 | 44 | 0.395 [0.348, 0.453] | 0 | IT.CEL.SETS.P2 |
| political_corruption | XL | 216 | 10 | 0.046 | 172 | 44 | 0.381 [0.310, 0.440] | 0 | v2stfisccap |
| political_violence | L | 216 | 12 | 0.056 | 172 | 44 | 0.369 [0.131, 0.643] | 0 | SP.DYN.LE00.IN |
| climate_agreement | XL | 216 | 7 | 0.032 | 172 | 44 | 0.360 [0.279, 0.419] | 0 | v2psprlnks |
| executive_power_consolidation | M | 216 | 6 | 0.028 | 172 | 44 | 0.337 [0.267, 0.407] | 0 | v2ex_hosw |
| sport_and_international_event | L | 216 | 6 | 0.028 | 172 | 44 | 0.326 [0.267, 0.395] | 0 | v2cseeorgs |
| agricultural_policy | M | 216 | 6 | 0.028 | 172 | 44 | 0.314 [0.233, 0.384] | 0 | v2x_jucon |
| resource_conflict | XL | 216 | 6 | 0.028 | 172 | 44 | 0.279 [0.209, 0.337] | 0 | v2csprtcpt |
| public_health_reform | XL | 216 | 5 | 0.023 | 172 | 44 | 0.256 [0.198, 0.326] | 0 | v2x_regime |
| transitional_justice | XL | 216 | 11 | 0.051 | 172 | 44 | 0.226 [0.167, 0.310] | 0 | v2cacamps |
| cultural_and_heritage | M | 216 | 5 | 0.023 | 172 | 44 | 0.209 [0.151, 0.279] | 0 | SP.DYN.TFRT.IN |

## Per-indicator scorecard (existing fingerprint indicators)

3-column scorecard view (#493 item 5): lift, coverage, evenness shown separately. MNAR column flags indicators where missingness correlates with outcome — treat their lift as suspect (#493 item 1).

| Indicator | Provider | Lift | Coverage | Evenness | MNAR | n_recipes | audition_score |
|---|---|---|---|---|---|---|---|
| NY.GDP.MKTP.KD | ? | 0.0028 | 0.808 | 0.816 | 0.26 | 47 | **0.0018** |
| NE.IMP.GNFS.CD | ? | 0.0027 | 0.728 | 0.823 | 0.16 | 47 | **0.0016** |
| SH.DYN.MORT | ? | 0.0023 | 0.747 | 0.794 | 0.20 | 47 | **0.0013** |
| MS.MIL.XPND.GD.ZS | ? | 0.0028 | 0.625 | 0.723 | 0.21 | 15 | **0.0013** |
| FM.LBL.BMNY.GD.ZS | ? | 0.0021 | 0.632 | 0.746 | 0.21 | 42 | **0.0010** |
| SP.DYN.LE00.IN | ? | 0.0013 | 0.824 | 0.816 | ⚠ 0.31 | 47 | **0.0009** |
| NY.GNP.PCAP.CD | ? | 0.0010 | 0.789 | 0.803 | 0.16 | 40 | **0.0007** |
| IT.CEL.SETS.P2 | ? | 0.0009 | 0.816 | 0.818 | 0.16 | 46 | **0.0006** |
| SP.POP.TOTL | ? | 0.0008 | 0.824 | 0.816 | ⚠ 0.31 | 47 | **0.0006** |
| NE.EXP.GNFS.CD | ? | 0.0009 | 0.728 | 0.823 | 0.16 | 47 | **0.0005** |
| AG.PRD.FOOD.XD | ? | 0.0007 | 0.747 | 0.806 | 0.20 | 38 | **0.0004** |
| NY.GDP.MKTP.CD | ? | 0.0006 | 0.812 | 0.816 | 0.30 | 47 | **0.0004** |
| NY.GDP.PCAP.CD | ? | 0.0005 | 0.812 | 0.816 | 0.30 | 47 | **0.0003** |
| NE.IMP.GNFS.ZS | ? | 0.0006 | 0.728 | 0.823 | 0.11 | 9 | **0.0003** |
| NV.AGR.TOTL.ZS | ? | 0.0005 | 0.782 | 0.796 | 0.14 | 26 | **0.0003** |
| SP.DYN.TFRT.IN | ? | 0.0005 | 0.824 | 0.816 | ⚠ 0.31 | 47 | **0.0003** |
| NE.EXP.GNFS.ZS | ? | 0.0005 | 0.728 | 0.823 | 0.09 | 9 | **0.0003** |
| FI.RES.TOTL.CD | ? | 0.0005 | 0.690 | 0.796 | 0.22 | 47 | **0.0003** |
| NE.CON.PRVT.ZS | ? | 0.0004 | 0.716 | 0.816 | 0.07 | 2 | **0.0002** |
| FP.CPI.TOTL.ZG | ? | 0.0000 | 0.736 | 0.804 | 0.06 | 3 | **0.0000** |
| NE.CON.GOVT.ZS | ? | 0.0000 | 0.709 | 0.801 | 0.07 | 3 | **0.0000** |
| NV.SRV.TOTL.ZS | ? | 0.0000 | 0.778 | 0.796 | 0.13 | 2 | **0.0000** |
| NV.IND.TOTL.ZS | ? | 0.0000 | 0.789 | 0.796 | 0.00 | 0 | **0.0000** |
| SM.POP.NETM | ? | 0.0000 | 0.824 | 0.816 | 0.00 | 0 | **0.0000** |
| IT.NET.USER.ZS | ? | 0.0000 | 0.812 | 0.818 | 0.00 | 0 | **0.0000** |

## CANDIDATE indicators scorecard (NOT YET in any recipe fingerprint)

3-column scorecard: lift × coverage × evenness shown separately. audition_score = product, but separate columns reveal high-lift / lower-coverage indicators that the multiplicative score hides (#493 item 5). Per founder direction, integration is independent of audition.

| Candidate | Provider | Lift | Coverage | Evenness | MNAR | n_recipes | audition_score |
|---|---|---|---|---|---|---|---|
| v2stfisccap | VDEM | 0.0045 | 0.670 | 0.740 | 0.29 | 47 | **0.0023** |
| v2pepwrses | VDEM | 0.0041 | 0.670 | 0.740 | 0.29 | 47 | **0.0020** |
| v2elintmon | VDEM | 0.0039 | 0.651 | 0.737 | 0.29 | 47 | **0.0019** |
| v2cacamps | VDEM | 0.0037 | 0.670 | 0.740 | 0.29 | 47 | **0.0018** |
| v2ex_hosw | VDEM | 0.0036 | 0.670 | 0.740 | 0.29 | 47 | **0.0018** |
| v2cltort | VDEM | 0.0026 | 0.670 | 0.740 | 0.29 | 47 | **0.0013** |
| v2exl_legitlead | VDEM | 0.0022 | 0.670 | 0.740 | 0.29 | 47 | **0.0011** |
| v2pepwrsoc | VDEM | 0.0021 | 0.670 | 0.740 | 0.29 | 47 | **0.0010** |
| v2exremhog | VDEM | 0.0026 | 0.513 | 0.694 | 0.24 | 47 | **0.0009** |
| v2excrptps | VDEM | 0.0018 | 0.670 | 0.740 | 0.29 | 47 | **0.0009** |
| v2svdomaut | VDEM | 0.0018 | 0.670 | 0.740 | 0.29 | 47 | **0.0009** |
| v2x_partip | VDEM | 0.0015 | 0.670 | 0.740 | 0.29 | 47 | **0.0008** |
| v2psprlnks | VDEM | 0.0014 | 0.670 | 0.740 | 0.29 | 47 | **0.0007** |
| v2x_neopat | VDEM | 0.0013 | 0.670 | 0.740 | 0.29 | 47 | **0.0007** |
| v2x_clpriv | VDEM | 0.0012 | 0.670 | 0.740 | 0.29 | 47 | **0.0006** |
| v2xeg_eqprotec | VDEM | 0.0012 | 0.670 | 0.740 | 0.29 | 47 | **0.0006** |
| v2x_gender | VDEM | 0.0011 | 0.670 | 0.740 | 0.29 | 47 | **0.0005** |
| v2pepwrort | VDEM | 0.0011 | 0.670 | 0.740 | 0.29 | 47 | **0.0005** |
| v2x_corr | VDEM | 0.0011 | 0.670 | 0.740 | 0.29 | 47 | **0.0005** |
| v2jureform | VDEM | 0.0009 | 0.670 | 0.740 | 0.29 | 47 | **0.0005** |
| v2x_clphy | VDEM | 0.0009 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2x_jucon | VDEM | 0.0009 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2xel_frefair | VDEM | 0.0008 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2lgqstexp | VDEM | 0.0008 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2clkill | VDEM | 0.0008 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2x_rule | VDEM | 0.0008 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2mecenefm | VDEM | 0.0007 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2xlg_legcon | VDEM | 0.0007 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2csprtcpt | VDEM | 0.0007 | 0.670 | 0.740 | 0.29 | 47 | **0.0004** |
| v2lgbicam | VDEM | 0.0006 | 0.670 | 0.740 | 0.29 | 47 | **0.0003** |
| v2x_clpol | VDEM | 0.0006 | 0.670 | 0.740 | 0.29 | 47 | **0.0003** |
| v2pepwrgen | VDEM | 0.0006 | 0.670 | 0.740 | 0.29 | 47 | **0.0003** |
| v2csreprss | VDEM | 0.0005 | 0.670 | 0.740 | 0.29 | 47 | **0.0003** |
| v2cseeorgs | VDEM | 0.0005 | 0.670 | 0.740 | 0.29 | 47 | **0.0002** |
| v2x_polyarchy | VDEM | 0.0004 | 0.670 | 0.740 | 0.29 | 47 | **0.0002** |
| v2x_freexp_altinf | VDEM | 0.0004 | 0.670 | 0.740 | 0.29 | 47 | **0.0002** |
| v2x_libdem | VDEM | 0.0004 | 0.670 | 0.740 | 0.29 | 47 | **0.0002** |
| v2exaphogp | VDEM | 0.0004 | 0.456 | 0.643 | 0.24 | 47 | **0.0001** |
| v2x_regime | VDEM | 0.0002 | 0.670 | 0.740 | 0.29 | 47 | **0.0001** |

## Rank stability vs prior audit (#493 item 6)

Baseline: `results\audition_2026_04_27_vdem39_ci\audition_report.json`

Per-recipe Kendall's tau on top-3 indicator rank-order vs baseline. tau=1 means same ranking; tau<0.3 means major reshuffle (treat with skepticism).

| Recipe | Baseline top-3 | New top-3 | Kendall's τ | Verdict |
|---|---|---|---|---|
| climate_agreement | NE.IMP.GNFS.ZS, v2cacamps, v2csprtcpt | v2psprlnks, v2exremhog, v2csprtcpt | -1.00 | RESHUFFLED |
| currency_crisis | v2ex_hosw, v2pepwrsoc, v2x_partip | v2exl_legitlead, v2pepwrort, v2x_jucon | -1.00 | RESHUFFLED |
| environmental_policy | SP.DYN.TFRT.IN, NE.EXP.GNFS.CD, v2x_clpriv | v2elintmon, v2pepwrgen, v2cseeorgs | -1.00 | RESHUFFLED |
| foreign_intervention | IT.CEL.SETS.P2, v2lgbicam, v2elintmon | v2x_rule, v2x_clpol, v2x_libdem | -1.00 | RESHUFFLED |
| humanitarian_crisis | v2x_neopat, SP.POP.TOTL, v2pepwrses | v2elintmon, v2lgbicam, v2xlg_legcon | -1.00 | RESHUFFLED |
| interstate_war | v2x_clpriv, v2csprtcpt, SH.DYN.MORT | MS.MIL.XPND.GD.ZS, v2jureform, v2x_gender | -1.00 | RESHUFFLED |
| public_health_reform | NE.IMP.GNFS.CD, NE.CON.GOVT.ZS, NE.EXP.GNFS.CD | v2x_regime, v2x_corr, NY.GDP.PCAP.CD | -1.00 | RESHUFFLED |
| resource_conflict | v2x_neopat, v2clkill, v2excrptps | v2csprtcpt, v2xel_frefair, v2x_freexp_altinf | -1.00 | RESHUFFLED |
| social_policy_reform | v2elintmon, v2x_neopat, v2pepwrgen | IT.CEL.SETS.P2, MS.MIL.XPND.GD.ZS, v2cltort | -1.00 | RESHUFFLED |
| sport_and_international_event | v2csprtcpt, v2x_jucon, v2x_libdem | v2cseeorgs, NE.EXP.GNFS.ZS, v2exaphogp | -1.00 | RESHUFFLED |
| territorial_disputes | v2x_corr, FI.RES.TOTL.CD, IT.CEL.SETS.P2 | v2pepwrses, v2pepwrort, v2exremhog | -1.00 | RESHUFFLED |
| terrorist_attack | v2x_jucon, v2pepwrort, v2exl_legitlead | IT.CEL.SETS.P2, SP.POP.TOTL, SP.DYN.LE00.IN | -1.00 | RESHUFFLED |
| oil_and_gas | AG.PRD.FOOD.XD, v2x_corr, v2x_neopat | v2xel_frefair, v2x_neopat, v2jureform | -0.75 | RESHUFFLED |
| executive_power_consolidation | v2clkill, v2psprlnks, v2x_freexp_altinf | v2ex_hosw, v2psprlnks, NE.CON.PRVT.ZS | -0.50 | RESHUFFLED |
| human_rights_violation | v2xel_frefair, v2x_partip, v2x_clpriv | v2pepwrsoc, v2x_partip, IT.CEL.SETS.P2 | -0.50 | RESHUFFLED |
| infrastructure_project | v2jureform, v2psprlnks, v2x_polyarchy | MS.MIL.XPND.GD.ZS, v2svdomaut, v2jureform | -0.50 | RESHUFFLED |
| trade_agreement | v2x_neopat, v2x_corr, NY.GDP.MKTP.KD | NY.GDP.MKTP.KD, v2x_clpol, v2x_clpriv | -0.50 | RESHUFFLED |
| bilateral_treaty | v2xeg_eqprotec, v2exl_legitlead, v2pepwrses | v2excrptps, v2exl_legitlead, v2xeg_eqprotec | -0.33 | RESHUFFLED |
| military_coup | v2lgqstexp, v2stfisccap, v2x_gender | v2stfisccap, v2ex_hosw, v2x_gender | -0.33 | RESHUFFLED |
| political_corruption | IT.CEL.SETS.P2, v2stfisccap, v2lgbicam | v2stfisccap, v2pepwrort, v2lgbicam | -0.33 | RESHUFFLED |
| political_repression | v2pepwrses, v2x_clphy, v2csreprss | v2x_clphy, v2cltort, v2csreprss | -0.33 | RESHUFFLED |
| agricultural_policy | v2x_partip, v2x_jucon, NY.GDP.PCAP.CD | v2x_jucon, NE.IMP.GNFS.ZS, NY.GDP.MKTP.CD | -0.25 | RESHUFFLED |
| constitutional_change | v2pepwrses, NV.AGR.TOTL.ZS, v2svdomaut | NY.GDP.MKTP.KD, v2pepwrses, v2exremhog | -0.25 | RESHUFFLED |
| economic_growth_milestone | v2clkill, NE.IMP.GNFS.ZS, v2mecenefm | SH.DYN.MORT, v2clkill, v2lgbicam | -0.25 | RESHUFFLED |
| energy_policy | v2x_neopat, v2jureform, SP.POP.TOTL | v2jureform, v2x_gender, v2elintmon | -0.25 | RESHUFFLED |
| military_policy_and_reform | v2jureform, NY.GDP.PCAP.CD, v2x_partip | NY.GDP.PCAP.CD, v2exl_legitlead, v2x_clpriv | -0.25 | RESHUFFLED |
| poverty_and_inequality_crisis | v2x_partip, v2x_regime, NY.GDP.MKTP.CD | v2cltort, v2x_partip, v2psprlnks | -0.25 | RESHUFFLED |
| transitional_justice | v2pepwrses, v2cacamps, v2x_clphy | v2cacamps, FM.LBL.BMNY.GD.ZS, v2svdomaut | -0.25 | RESHUFFLED |
| civil_war_and_insurgency | v2x_jucon, v2exremhog, v2excrptps | v2x_jucon, v2stfisccap, v2pepwrsoc | 0.00 | MIXED |
| cultural_and_heritage | SP.DYN.TFRT.IN, v2x_clpol, v2pepwrsoc | SP.DYN.TFRT.IN, MS.MIL.XPND.GD.ZS, NY.GDP.MKTP.KD | 0.00 | MIXED |
| democratic_transition | v2stfisccap, v2cltort, v2exl_legitlead | v2stfisccap, NE.EXP.GNFS.CD, FM.LBL.BMNY.GD.ZS | 0.00 | MIXED |
| elections_and_voting | v2cacamps, v2clkill, v2elintmon | v2cacamps, v2x_gender, v2stfisccap | 0.00 | MIXED |
| epidemic_and_pandemic | v2jureform, NE.IMP.GNFS.CD, NY.GDP.MKTP.CD | FM.LBL.BMNY.GD.ZS, v2jureform, NE.IMP.GNFS.CD | 0.00 | MIXED |
| fiscal_policy_change | NE.IMP.GNFS.CD, v2pepwrort, v2exremhog | NE.IMP.GNFS.CD, MS.MIL.XPND.GD.ZS, v2exremhog | 0.00 | MIXED |
| government_formation | v2cacamps, v2exl_legitlead, v2x_polyarchy | v2cacamps, NY.GNP.PCAP.CD, SP.POP.TOTL | 0.00 | MIXED |
| natural_disaster | v2excrptps, SP.DYN.TFRT.IN, v2jureform | v2excrptps, v2x_partip, v2x_rule | 0.00 | MIXED |
| political_violence | SP.DYN.LE00.IN, v2pepwrort, v2xel_frefair | SP.DYN.LE00.IN, v2stfisccap, v2pepwrses | 0.00 | MIXED |
| diplomatic_rupture | v2x_partip, v2cacamps, v2pepwrsoc | v2x_partip, v2x_corr, v2cacamps | 0.33 | MIXED |
| flood_and_cyclone | v2pepwrort, v2x_freexp_altinf, v2x_clpriv | v2x_freexp_altinf, v2pepwrort, v2mecenefm | 0.33 | MIXED |
| multilateral_agreement | v2elintmon, v2xeg_eqprotec, v2pepwrses | v2elintmon, v2pepwrses, v2xeg_eqprotec | 0.33 | MIXED |
| peacekeeping_and_peace_process | FM.LBL.BMNY.GD.ZS, v2mecenefm, SP.DYN.TFRT.IN | v2mecenefm, FM.LBL.BMNY.GD.ZS, v2exaphogp | 0.33 | MIXED |
| regional_integration | MS.MIL.XPND.GD.ZS, v2pepwrgen, FI.RES.TOTL.CD | v2pepwrgen, MS.MIL.XPND.GD.ZS, FI.RES.TOTL.CD | 0.33 | MIXED |
| human_rights_reform | v2clkill, v2x_clpriv, NE.EXP.GNFS.ZS | v2clkill, v2x_clpriv, FM.LBL.BMNY.GD.ZS | 0.67 | STABLE |
| mass_protest | v2svdomaut, v2elintmon, v2pepwrort | v2svdomaut, v2elintmon, v2cltort | 0.67 | STABLE |
| migration_and_refugees | v2cacamps, v2stfisccap, SP.DYN.LE00.IN | v2cacamps, v2stfisccap, v2pepwrsoc | 0.67 | STABLE |
| sanctions_and_arms_embargo | SP.DYN.LE00.IN, v2xeg_eqprotec, v2pepwrsoc | SP.DYN.LE00.IN, v2xeg_eqprotec, SP.POP.TOTL | 0.67 | STABLE |
| economic_recession | v2ex_hosw, v2cltort, v2elintmon | v2ex_hosw, v2cltort, v2elintmon | 1.00 | STABLE |

## Methodology notes

- **Train/holdout:** stratified 80/20 country split per recipe (fixed seed 42)
- **Model:** GradientBoostingClassifier (sklearn) — n_estimators=80, max_depth=3, lr=0.05
- **Importance:** sklearn permutation_importance, n_repeats=10, scoring=neg_log_loss
- **Coverage equity:** `audition_score = predictive_lift × coverage_share × regional_evenness`
- **Regional evenness:** `1 - gini_coefficient(per-region share of countries with data)`
- **BH-FDR multiple-testing correction:** explicitly OUT OF SCOPE per founder veto (2026-04-26)
- **Missing data:** not imputed; rows with insufficient data drop out of the recipe model

## Audit metadata

- Audit date: `2026-04-27T10:40:19Z`
- Git SHA: `99bf55a`
- Cutoff year: 2020
- Total countries (denominator): 261