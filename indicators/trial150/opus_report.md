# Opus-direct FAOSTAT 20 — research report

## Method

Generated from model knowledge only — **no WebSearch/WebFetch calls**. This is the "Opus-direct" control track for ticket #150's research-method trial.

## Domains drawn from

| Domain | Code | Why | Picks |
|---|---|---|---|
| Food Security Indicators | FS | The canonical food-insecurity headline metrics — prevalence of undernourishment, FIES, adequacy | 1-4 |
| Food Balance Sheets | FBS | Per-capita caloric/protein supply, vegetable-oil kcal share | 5, 6, 19 |
| Crops and Livestock Products | QCL | Cereal/wheat/rice production and yield — the core ag-production metrics | 7-10 |
| Trade Crops and Livestock | TCL | Cereal import quantity — import dependency calculation | 11 |
| Consumer Prices | CP | Food CPI — unrest precursor | 12 |
| Land Use | RL | Agricultural land, arable land, forest area | 13, 14, 16 |
| Fertilizer by Nutrient | RFN | Nitrogen use — intensification + Russia/Belarus exposure | 15 |
| Live Animals | GLW | Cattle stocks — pastoralist capital, drought proxy | 17 |
| Emissions Totals | GT | Agricultural GHG — decarbonization policy exposure | 18 |
| Fisheries and Aquaculture | FI | Fish production — protein security + maritime disputes | 20 |

## Gaps vs the existing 60 WB indicators

The existing WB processable set already covers `AG.PRD.FOOD.XD` (Food Production Index). I **deliberately did not pick the FAOSTAT equivalent** (QCL item 1744 PIN) — no point adding a parallel index when WB already pushes one.

Everything else I chose is net-new signal:
- WB has no undernourishment prevalence, FIES, kcal/capita, protein/capita, or food CPI
- WB cereal metrics are indirect (via food index) — FAOSTAT gives raw tonnes and yields broken out by commodity
- WB has no land-use category — `RL` coverage (agricultural, arable, forest) is all additive
- WB has no pastoralist/livestock metric — cattle stocks fills a Sahel/HoA blind spot

## Tradeoffs / known weaknesses

1. **ID format uncertainty** — FAOSTAT's public API uses different ID patterns depending on domain. I used the `DOMAIN.ITEM.ELEMENT` convention because that's the most common pattern in the QCL/FBS/TCL/RFN/GT domains, but some domains (FS, CP) use summary indicator IDs without item/element breakdown. **My id_strings should be treated as draft — they need verification against the live metadata API before the fetcher adapter is built.**

2. **Item codes are approximated from memory** — e.g. Wheat=15, Paddy rice=27, Cereals aggregate=1717, Cattle=866. These are FAOSTAT's actual codes for these items, but I can't guarantee I got every element code right (e.g. 5510=Production, 5419=Yield, 5611=Import quantity, 5142=Food supply kcal/capita/day, 5111=Stocks, 5110=Area).

3. **No FIES cardinal/ordinal distinction** — FIES actually has two metrics: "severe food insecurity" and "moderate-or-severe food insecurity". I picked the severe variant (stronger signal) but the moderate one might be more QGI-useful because it captures a broader distressed population.

4. **Missed water stress entirely** — AQUASTAT has agricultural freshwater withdrawal but it's a separate FAO product, not FAOSTAT proper. Filed mentally for an `AQUASTAT` companion provider ticket.

5. **No climate-change observational domain** — FAOSTAT has "Temperature change on land" (ET) but I judged it less directly predictive than the operational metrics. Defensible call but worth flagging.

## Indicators considered but rejected

- **QCL Maize production (item 56)** — would overlap rice and wheat by adding a third cereal; cereals aggregate (1717) already captures the total. Picked wheat+rice specifically because they're the two staples with highest geopolitical weight.
- **RL Rural population (item 3236)** — WB already has `SP.RUR.TOTL.ZS` and presumably `SP.RUR.TOTL`. Not picked.
- **FBS Meat supply kcal/capita/day** — interesting but moves slowly and correlates with income more than with crisis signals. Low marginal information over general kcal supply.
- **TCL Food exports value USD** — WB already has `TX.VAL.FOOD.ZS.UN`. Not picked.
- **PP Producer prices for wheat** — valuable but coverage is sparse for low-income countries; reserved for a second-tier expansion.

## Time budget

This entire track (JSON + report) took ~4 minutes of Opus reasoning with no tool calls. The comparison track (Sonnet+WebSearch) will include actual ID verification, which my track explicitly skipped.

## How to evaluate this track vs the Sonnet+WebSearch track

Critical question for the comparison: **are my id_strings actually right?** If yes, Opus-direct wins on speed (~4 min vs whatever the Sonnet track takes) and probably on selection judgment (single-pass coherent reasoning). If the IDs have errors, Sonnet+WebSearch wins cleanly because the trial is supposed to produce a directly-usable catalog.

Selection quality should be judged on:
1. Does the set fill WB gaps without duplication?
2. Are the descriptions accurate and QGI-framed?
3. Is the category mapping sensible (how many new categories did we have to add)?
4. Would a QGI analyst actually want these 20?
