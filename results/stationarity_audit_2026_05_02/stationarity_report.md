# SCDI Panel Stationarity Audit — 2026-05-02T14:24:15Z

**Test:** CIPS (Pesaran 2007 Cross-sectionally Augmented IPS), case II (intercept, no trend)
**Critical values:** 5% = -2.11, 10% = -2.03, 1% = -2.27
**CADF lags:** 0

## Aggregate verdict

- **Sample size:** 20 indicators (18 evaluable, 2 not in data)
- **Stationary (PASS):** 7
- **Marginal:** 1
- **I(1) (FAIL):** 10
- **% I(1) or marginal:** 61.1%
- **Verdict:** **FULL_AUDIT**
- **Action:** Extend audit to remaining ~84 indicators before #577 production. #585 detrending engineering required for all I(1) confirmed.

## Per-indicator results

| Indicator | Sector | A priori | N | T | CIPS | Verdict |
|---|---|---|---|---|---|---|
| Population, total | WB-demographic | I(1) | 215 | 65 | 0.106 | **I(1)** |
| Life expectancy at birth | WB-demographic | I(1) | 215 | 65 | -2.309 | **STATIONARY** |
| Mortality rate, under-5 | WB-demographic | I(1) | 195 | 65 | -4.427 | **STATIONARY** |
| GDP per capita (current USD) | WB-economic | I(1) | 211 | 65 | -1.396 | **I(1)** |
| GDP (constant 2015 USD) | WB-economic | I(1) | 209 | 65 | -0.762 | **I(1)** |
| GDP (current USD) | WB-economic | I(1) | 211 | 65 | -1.353 | **I(1)** |
| GNI per capita Atlas | WB-economic | I(1) | 205 | 63 | -1.003 | **I(1)** |
| Mobile cellular subscriptions (per 100) | WB-infra | I(1) capped | 212 | 53 | -1.881 | **I(1)** |
| V-Dem polyarchy | V-Dem | I(1) | 175 | 237 | -2.359 | **STATIONARY** |
| V-Dem liberal democracy | V-Dem | I(1) | 175 | 237 | -2.129 | **STATIONARY** |
| V-Dem state fiscal capacity | V-Dem | ? | 168 | 237 | -2.290 | **STATIONARY** |
| V-Dem control of corruption | V-Dem | I(1) | 175 | 237 | -1.977 | **I(1)** |
| Exports of goods/services (current USD) | WB-trade | I(1) | 188 | 65 | -1.373 | **I(1)** |
| Imports of goods/services (current USD) | WB-trade | I(1) | 188 | 65 | -1.678 | **I(1)** |
| Food production index | FAOSTAT | mixed | 195 | 62 | -2.138 | **STATIONARY** |
| UCDP best-estimate battle deaths | UCDP | stationary | 0 | 0 | — | **INSUFFICIENT_DATA** |
| UCDP onset of armed conflict (binary) | UCDP | stationary | 0 | 0 | — | **INSUFFICIENT_DATA** |
| Inflation, consumer prices (annual %) | WB-economic | stationary | 190 | 65 | -6.184 | **STATIONARY** |
| Unemployment, total (% labor force) | WB-economic | stationary | 186 | 35 | -1.720 | **I(1)** |
| Tax revenue (% GDP) | WB-fiscal | stationary | 156 | 53 | -2.076 | **MARGINAL** |

## Methodology notes

- **CIPS:** average of country-level CADF t-statistics on the lag-y coefficient
- **CADF:** Δy_{i,t} = α + β·y_{i,t-1} + γ·ȳ_{t-1} + δ·Δȳ_t + ε_{i,t}
- **Cross-sectional augmentation** absorbs the common factor that makes naive IPS oversized
- **Stationary** = reject unit-root null at 5%
- **Marginal** = reject only at 10% (treat as contamination risk)
- **I(1)** = fail to reject — series treated as non-stationary, lift contamination likely
- **Acceptance gate** (Tariq #20 protocol from Ihsa I1):
    - <10% I(1) -> CHEAP_PATH (proceed)
    - 10-20% -> TARGETED_RECOMPUTATION (spawn #585)
    - >20% -> FULL_AUDIT (extend to remaining 84 indicators)

## Per-indicator rationale

- **Population, total** (SP.POP.TOTL): CIPS=0.106 ≥ 10% crit (-2.03); fail to reject unit-root null
- **Life expectancy at birth** (SP.DYN.LE00.IN): CIPS=-2.309 < 1% crit (-2.27); reject unit-root null at 1%
- **Mortality rate, under-5** (SH.DYN.MORT): CIPS=-4.427 < 1% crit (-2.27); reject unit-root null at 1%
- **GDP per capita (current USD)** (NY.GDP.PCAP.CD): CIPS=-1.396 ≥ 10% crit (-2.03); fail to reject unit-root null
- **GDP (constant 2015 USD)** (NY.GDP.MKTP.KD): CIPS=-0.762 ≥ 10% crit (-2.03); fail to reject unit-root null
- **GDP (current USD)** (NY.GDP.MKTP.CD): CIPS=-1.353 ≥ 10% crit (-2.03); fail to reject unit-root null
- **GNI per capita Atlas** (NY.GNP.PCAP.CD): CIPS=-1.003 ≥ 10% crit (-2.03); fail to reject unit-root null
- **Mobile cellular subscriptions (per 100)** (IT.CEL.SETS.P2): CIPS=-1.881 ≥ 10% crit (-2.03); fail to reject unit-root null
- **V-Dem polyarchy** (v2x_polyarchy): CIPS=-2.359 < 1% crit (-2.27); reject unit-root null at 1%
- **V-Dem liberal democracy** (v2x_libdem): CIPS=-2.129 < 5% crit (-2.11); reject unit-root null at 5%
- **V-Dem state fiscal capacity** (v2stfisccap): CIPS=-2.290 < 1% crit (-2.27); reject unit-root null at 1%
- **V-Dem control of corruption** (v2x_corr): CIPS=-1.977 ≥ 10% crit (-2.03); fail to reject unit-root null
- **Exports of goods/services (current USD)** (NE.EXP.GNFS.CD): CIPS=-1.373 ≥ 10% crit (-2.03); fail to reject unit-root null
- **Imports of goods/services (current USD)** (NE.IMP.GNFS.CD): CIPS=-1.678 ≥ 10% crit (-2.03); fail to reject unit-root null
- **Food production index** (AG.PRD.FOOD.XD): CIPS=-2.138 < 5% crit (-2.11); reject unit-root null at 5%
- **UCDP best-estimate battle deaths** (UCDP_BD_BEST): Indicator not present in qgi_data.indicators (likely not yet ingested)
- **UCDP onset of armed conflict (binary)** (UCDP_ONSET): Indicator not present in qgi_data.indicators (likely not yet ingested)
- **Inflation, consumer prices (annual %)** (FP.CPI.TOTL.ZG): CIPS=-6.184 < 1% crit (-2.27); reject unit-root null at 1%
- **Unemployment, total (% labor force)** (SL.UEM.TOTL.ZS): CIPS=-1.720 ≥ 10% crit (-2.03); fail to reject unit-root null
- **Tax revenue (% GDP)** (GC.TAX.TOTL.GD.ZS): CIPS=-2.076 < 10% crit (-2.03); reject at 10% only — borderline