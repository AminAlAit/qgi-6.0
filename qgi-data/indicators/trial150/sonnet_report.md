# Sonnet FAOSTAT 20-Indicator Selection Report

## Domains Used

| Domain | Code | Count | Rationale |
|--------|------|-------|-----------|
| Crops & Livestock Products | QCL | 5 | Core crop production data — wheat, rice, maize production/area/yield are the most country-complete series (180+ countries, back to 1961) |
| Land Use | RL | 3 | Structural land capacity — arable, cropland, pastures; fills a gap WB doesn't cover at this granularity |
| Fertilizers by Nutrient | RFN | 3 | N/P/K agricultural use — leading input indicators with geopolitical supply-chain concentration (Russia/Belarus for potash) |
| Suite of Food Security Indicators | FS | 5 | FAO's curated SDG-aligned indicators — undernourishment, FIES, cereal import dependency, energy adequacy, depth of deficit |
| Food Balance Sheets | FBS | 2 | kcal and protein per capita — national food availability benchmarks complementing FS domain |
| Trade: Crops & Livestock | TCL | 2 | Cereal export value + import quantity — bilateral trade disruption signals |

## Verification Methodology

Indicator IDs were verified through three methods:

1. **FAOSTAT datasets XML manifest** (`https://bulks-faostat.fao.org/production/datasets_E.xml`) — confirms domain codes QCL, RL, RFN, FS, FBS, TCL exist in the production catalog.
2. **OWID ETL documentation** (`https://docs.owid.io/projects/etl/data/faostat/`) — confirms element codes 5312 (area harvested), 5510 (production), 5419 (yield), 5157 (agricultural use), 5110 (area), 5610 (import quantity), 5910 (export value) and item codes wheat=0015, rice=0027, maize=0056.
3. **UN Data portal cross-reference** (`http://data.un.org/Data.aspx?d=FAO&f=itemCode:21010`) — confirms FS item 21010 = Average dietary energy supply adequacy; item 21035 = Cereal import dependency ratio verified via search.
4. **Land Portal cross-reference** (`https://landportal.org/book/indicators/fao-6655-5110`) — confirms RL item 6655 + element 5110 = permanent meadows and pastures.

## Tradeoffs and Gaps

- **FS element code 6121**: Confirmed as the standard percentage element used across FS suite indicators; however, some FS items use different elements for raw values vs. % — may need validation during ingestion against actual CSV columns.
- **FBS item 2901**: Represents the "grand total" row in food balance sheets. FBS data starts 2010+ (use FBSH for 1961–2013 crosswalk if time series depth needed).
- **TCL item 0079**: FAOSTAT uses aggregate commodity groups; 0079 is the cereals aggregate. If granular wheat-trade separation is needed, use item 0015 in TCL.
- **No livestock indicators included**: Cattle head counts (QCL element 5111) and meat production were considered but the WB food production index (AG.PRD.FOOD.XD) already partially captures livestock output trends.

## Considered but Rejected

1. **QCL.0339.5510 — Soybeans production**: Strong geopolitical signal (US–China trade war proxy) but heavy overlap with WB agricultural production index; deferred to a future soy-specific track.
2. **RL.6790.5110 — Land area equipped for irrigation**: Excellent structural indicator for water-food nexus but country coverage thins below 120 nations for pre-2000 data; rejected on coverage constraint.
3. **RFN.3102.5159 — Nitrogen, Import quantity**: Highly relevant for import-dependent countries but duplicates signal already captured by the agricultural-use element (5157) for SCDI purposes; adding it would inflate auto-correlation within the fertilizer cluster.
