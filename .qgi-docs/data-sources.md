# QGI — Indicator Data Sources

> Last updated: 2026-03-28
> **Licensing constraint:** All sources must permit free commercial use of derived intelligence.
> Before integrating any source, verify: (1) API/data terms allow commercial use, (2) derived products (SCDIs, Patterns, insights) can be used commercially.

---

## Current sources

### World Bank Open Data
- **Status:** Live (50 active indicators)
- **Access:** REST API — `api.worldbank.org/v2/`
- **Coverage:** 260 countries, annual resolution, up to ~60 years history
- **License:** CC BY 4.0 — free for commercial use ✓
- **Integration:** `qgi-pipeline-a-sheet-fetcher` Lambda
- **Indicator control:** `Pipeline A Dispatcher World Bank Indicators.xlsx` in S3

---

## Planned sources

> These are candidates. Licensing must be confirmed before implementation.

### OECD
- **Access:** SDMX REST API — `sdmx.oecd.org`
- **Coverage:** ~38 member countries + partners, annual + quarterly data
- **License:** `[TBD — verify commercial use of derived products]`
- **Notes:** Strong on economic, education, health, environment indicators for developed economies

### Our World In Data (OWID)
- **Access:** CSV files on GitHub (`github.com/owid/owid-datasets`) + API in development
- **Coverage:** Global, annual, very long historical series for some indicators
- **License:** CC BY 4.0 for most datasets ✓ (verify per indicator — some are sourced from restricted orgs)
- **Notes:** Excellent for social, health, energy, and governance indicators; easy to ingest as files

### UN Data / UNSD
- **Access:** REST API — `data.un.org/Host.aspx?Content=API`
- **Coverage:** Global, annual
- **License:** `[TBD — verify commercial use]`
- **Notes:** Population, trade, national accounts, demographics

### IMF
- **Access:** REST API — `datahelper.imf.org`
- **Coverage:** Global, annual + quarterly
- **License:** `[TBD — verify commercial use of derived products]`
- **Notes:** Strong on macroeconomics, fiscal data, balance of payments

### Fund for Peace (Fragile States Index)
- **Access:** Annual CSV/Excel release
- **Coverage:** ~179 countries, annual since 2006
- **License:** `[TBD — verify commercial use; currently free for non-commercial]`
- **Notes:** Governance, stability, conflict risk scores

### Freedom House (Freedom in the World)
- **Access:** Annual Excel release
- **Coverage:** ~210 countries, annual since 1973
- **License:** `[TBD — verify commercial use]`
- **Notes:** Political rights and civil liberties scores

---

## Integration architecture (multi-source design)

> See [architecture.md](architecture.md) for the full pipeline design.

All sources must produce normalized output in the same format before entering Phase 2 (SCDI):

```
country (string matching countries.csv name_1)
year    (integer, YYYY)
value   (float)
```

### Indicator control surface (xlsx) additions needed

The current xlsx has: `id_string, numeric_id, name, status, category, description`

Required additions for multi-source:
- `source` — e.g. `world_bank`, `oecd`, `owid`, `un`, `imf`, `fund_for_peace`, `freedom_house`
- `source_indicator_id` — the ID/code used by the source API or file (may differ from our `id_string`)
- `country_id_type` — how the source identifies countries (`iso_alpha2`, `iso_alpha3`, `name`, `custom`) for normalization

### Source types

| Type | Description | Examples |
|------|-------------|---------|
| `api` | Fetched programmatically from REST API | World Bank, OECD, IMF, UN |
| `file` | Annual release downloaded from URL or uploaded to S3 | Fund for Peace, Freedom House, OWID CSVs |

### Country name normalization

Each source uses different country identifiers. Pipeline A must map source identifiers to QGI's canonical `countries.csv` IDs before writing the normalized CSV. Country name resolution is a known hard problem (e.g. "Korea, Republic of" vs "South Korea" vs "KR").

`[TBD — design the country resolution strategy: lookup table per source? fuzzy matching? ISO code mapping?]`

---

## Source registry

`[TBD — once multi-source architecture is implemented, each active source should have a row in a DynamoDB or S3-backed registry with: source_id, type, fetch_url/path, last_fetched, active indicators count]`
