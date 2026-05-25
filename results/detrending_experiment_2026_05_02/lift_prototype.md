# Lean Lift Comparison: RAW vs DIFF (#585) — 2026-05-02T16:41:51Z

**Question:** When we apply first-differencing to I(1) indicators in feature construction, does GENUINE predictive signal survive (lift preserved) or COLLAPSE (lift kills)?

**Setup:** 5 recipes, cutoff year 2020, canonical length 25, GBM + permutation importance.


## Per-recipe AUC summary

| Recipe | I(1) in fp | n_total_feat | RAW AUC | DIFF AUC | Δ AUC |
|---|---|---|---|---|---|
| government_formation | 10 | 60 | 0.749 | 0.711 | **-0.039** |
| civil_war_and_insurgency | 10 | 60 | 0.746 | 0.789 | **+0.044** |
| trade_agreement | 9 | 60 | 0.602 | 0.894 | **+0.293** |
| economic_recession | 10 | 60 | 0.842 | 0.689 | **-0.154** |
| military_coup | 10 | 60 | 0.833 | 0.619 | **-0.214** |

## Per-(recipe × I(1)-indicator) lift comparison

| Recipe | Indicator | Lift RAW | Lift DIFF | Δ | Ratio (DIFF/RAW) |
|---|---|---|---|---|---|
| government_formation | Population, total (SP.POP.TOTL) | 0.0154 | 0.0257 | +0.0104 | 1.67 |
| government_formation | (unknown 165) (SP.DYN.TFRT.IN) | 0.0128 | 0.0010 | -0.0117 | 0.08 |
| government_formation | GDP (constant 2015 US$) (NY.GDP.MKTP.KD) | 0.0233 | 0.0025 | -0.0209 | 0.11 |
| government_formation | GDP (current US$) (NY.GDP.MKTP.CD) | 0.0159 | 0.0317 | +0.0158 | 1.99 |
| government_formation | GDP per capita (current US$) (NY.GDP.PCAP.CD) | 0.0005 | 0.0043 | +0.0038 | 8.81 |
| government_formation | Mobile cellular subscriptions (per 100 people) (IT.CEL.SETS.P2) | 0.0028 | 0.0132 | +0.0104 | 4.79 |
| government_formation | Total reserves (includes gold, current US$) (FI.RES.TOTL.CD) | 0.0035 | 0.0076 | +0.0041 | 2.17 |
| government_formation | Imports of goods and services (current US$) (NE.IMP.GNFS.CD) | 0.0021 | 0.0057 | +0.0036 | 2.69 |
| government_formation | Exports of goods and services (current US$) (NE.EXP.GNFS.CD) | 0.0067 | 0.0031 | -0.0036 | 0.46 |
| government_formation | GNI per capita, Atlas method (current US$) (NY.GNP.PCAP.CD) | 0.0033 | 0.0017 | -0.0016 | 0.51 |
| civil_war_and_insurgency | Population, total (SP.POP.TOTL) | 0.0766 | 0.0863 | +0.0097 | 1.13 |
| civil_war_and_insurgency | (unknown 165) (SP.DYN.TFRT.IN) | 0.0050 | 0.0047 | -0.0003 | 0.93 |
| civil_war_and_insurgency | GDP (current US$) (NY.GDP.MKTP.CD) | 0.0004 | 0.0035 | +0.0032 | 9.73 |
| civil_war_and_insurgency | GDP (constant 2015 US$) (NY.GDP.MKTP.KD) | 0.0000 | 0.0000 | -0.0000 | 0.00 |
| civil_war_and_insurgency | GDP per capita (current US$) (NY.GDP.PCAP.CD) | 0.0050 | 0.0005 | -0.0045 | 0.10 |
| civil_war_and_insurgency | Total reserves (includes gold, current US$) (FI.RES.TOTL.CD) | 0.0001 | 0.0011 | +0.0011 | 15.92 |
| civil_war_and_insurgency | Mobile cellular subscriptions (per 100 people) (IT.CEL.SETS.P2) | 0.0058 | 0.0051 | -0.0007 | 0.88 |
| civil_war_and_insurgency | GNI per capita, Atlas method (current US$) (NY.GNP.PCAP.CD) | 0.0045 | 0.0119 | +0.0074 | 2.66 |
| civil_war_and_insurgency | Imports of goods and services (current US$) (NE.IMP.GNFS.CD) | 0.0029 | 0.0022 | -0.0007 | 0.75 |
| civil_war_and_insurgency | Exports of goods and services (current US$) (NE.EXP.GNFS.CD) | 0.0000 | 0.0143 | +0.0143 | 992.67 |
| trade_agreement | Population, total (SP.POP.TOTL) | 0.0535 | 0.0157 | -0.0378 | 0.29 |
| trade_agreement | (unknown 165) (SP.DYN.TFRT.IN) | 0.0014 | 0.0039 | +0.0025 | 2.71 |
| trade_agreement | GDP (current US$) (NY.GDP.MKTP.CD) | 0.0016 | 0.0000 | -0.0016 | 0.02 |
| trade_agreement | GDP (constant 2015 US$) (NY.GDP.MKTP.KD) | 0.0035 | 0.0792 | +0.0757 | 22.37 |
| trade_agreement | GDP per capita (current US$) (NY.GDP.PCAP.CD) | 0.0000 | 0.0075 | +0.0075 | — |
| trade_agreement | Total reserves (includes gold, current US$) (FI.RES.TOTL.CD) | 0.0019 | 0.0159 | +0.0140 | 8.30 |
| trade_agreement | Mobile cellular subscriptions (per 100 people) (IT.CEL.SETS.P2) | 0.0067 | 0.0127 | +0.0061 | 1.91 |
| trade_agreement | Imports of goods and services (current US$) (NE.IMP.GNFS.CD) | 0.0000 | 0.0000 | +0.0000 | — |
| trade_agreement | Exports of goods and services (current US$) (NE.EXP.GNFS.CD) | 0.0000 | 0.0016 | +0.0016 | 333.79 |
| economic_recession | Population, total (SP.POP.TOTL) | 0.0530 | 0.0081 | -0.0449 | 0.15 |
| economic_recession | (unknown 165) (SP.DYN.TFRT.IN) | 0.0740 | 0.0000 | -0.0740 | 0.00 |
| economic_recession | GDP (current US$) (NY.GDP.MKTP.CD) | 0.0301 | 0.0216 | -0.0086 | 0.72 |
| economic_recession | GDP (constant 2015 US$) (NY.GDP.MKTP.KD) | 0.0028 | 0.0006 | -0.0022 | 0.21 |
| economic_recession | GDP per capita (current US$) (NY.GDP.PCAP.CD) | 0.0033 | 0.0000 | -0.0033 | 0.00 |
| economic_recession | Mobile cellular subscriptions (per 100 people) (IT.CEL.SETS.P2) | 0.0015 | 0.0099 | +0.0084 | 6.81 |
| economic_recession | Total reserves (includes gold, current US$) (FI.RES.TOTL.CD) | 0.0096 | 0.0030 | -0.0066 | 0.31 |
| economic_recession | Exports of goods and services (current US$) (NE.EXP.GNFS.CD) | 0.0000 | 0.0003 | +0.0003 | — |
| economic_recession | Imports of goods and services (current US$) (NE.IMP.GNFS.CD) | 0.0042 | 0.0078 | +0.0037 | 1.88 |
| economic_recession | GNI per capita, Atlas method (current US$) (NY.GNP.PCAP.CD) | 0.0000 | 0.0015 | +0.0014 | 119.57 |
| military_coup | Population, total (SP.POP.TOTL) | 0.0007 | 0.0029 | +0.0022 | 4.12 |
| military_coup | GDP (current US$) (NY.GDP.MKTP.CD) | 0.0026 | 0.0109 | +0.0083 | 4.13 |
| military_coup | GDP (constant 2015 US$) (NY.GDP.MKTP.KD) | 0.0025 | 0.0062 | +0.0037 | 2.49 |
| military_coup | (unknown 165) (SP.DYN.TFRT.IN) | 0.0555 | 0.0167 | -0.0388 | 0.30 |
| military_coup | GDP per capita (current US$) (NY.GDP.PCAP.CD) | 0.0016 | 0.0000 | -0.0016 | 0.00 |
| military_coup | Imports of goods and services (current US$) (NE.IMP.GNFS.CD) | 0.0012 | 0.0060 | +0.0048 | 4.86 |
| military_coup | Exports of goods and services (current US$) (NE.EXP.GNFS.CD) | 0.0000 | 0.0002 | +0.0002 | — |
| military_coup | Mobile cellular subscriptions (per 100 people) (IT.CEL.SETS.P2) | 0.0008 | 0.0039 | +0.0031 | 5.11 |
| military_coup | Total reserves (includes gold, current US$) (FI.RES.TOTL.CD) | 0.0029 | 0.0009 | -0.0020 | 0.32 |
| military_coup | Broad money (% of GDP) (FM.LBL.BMNY.GD.ZS) | 0.0004 | 0.0014 | +0.0010 | 3.19 |

## Interpretation

- **AUC change near zero** = detrending preserves overall recipe predictiveness
- **Per-indicator lift collapsing to ~0 under DIFF** = that indicator's lift was substrate-driven; detrending correctly removes spurious contribution
- **Per-indicator lift preserved under DIFF** = genuine signal survives; detrending didn't kill the indicator's predictive value
- **Per-indicator lift INCREASED under DIFF** = surprising; possibly the trend was masking change-driven signal

This is a 5-recipe lean prototype; full validation needs the heavy version (full auditioner with `--detrend-method first-diff` across the entire ~72-recipe corpus).