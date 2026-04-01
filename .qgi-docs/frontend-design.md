# QGI Frontend Design — Patterns & SCDIs Browser

> Derived from: full scan of `AminAlAit/qgi` Streamlit app (legacy reference implementation)
> Last updated: 2026-04-01
> Target: `qgi-frontend` Next.js SaaS app

---

## Overview

The `qgi-frontend` replaces the legacy Streamlit app with a production-grade Next.js SaaS application. This document captures everything learned from the legacy app's UX, data structures, and business logic that must be preserved or improved in the new frontend.

The legacy app has **6 pages**:

| Page | Purpose | Priority for new frontend |
|------|---------|--------------------------|
| Base Dashboard | Pattern leaderboard + scatter plot overview | Yes — homepage/dashboard |
| Patterns Portal | Main 5-step interactive pattern discovery | Yes — core feature |
| Events | Event frequency per country | Phase 2 |
| Experimental | Single country index browser | Phase 2 |
| FAQ | Explainer | Yes — landing site |
| Contact | Contact form | Yes — landing site |

---

## Core Terminology

| Term | Definition |
|------|-----------|
| **SCDI** | Single Dyadic Correlating Index — a statistically significant correlation between Country A's indicator segment and Country B's indicator segment, possibly offset in time |
| **Pattern** | Aggregation of all SCDIs sharing the same country pair, length, and start years. Answers: how many indicators, and how strongly, does A's trajectory match B's? |
| **Solos** | Single-index patterns (one SCDI per pattern). Used for detailed per-indicator chart rendering |
| **Pattern Power Score (PPS)** | Weighted quality metric: `0.1 × length_score + 0.3 × index_count_score + 0.6 × avg_correlation` |
| **Sector** | One of 13 thematic categories grouping related indicators (Economy, Military, Trade, etc.) |
| **Index** | Individual quantitative indicator (e.g. "GDP growth", "Military expenditure % GDP") |
| **Early Warning Signal** | A pattern where Country B's historical segment predates Country A's — Country A may be following Country B's past trajectory |
| **Recipe** | In the pipeline: the combination of (country_a, country_b, start_year_a, start_year_b, pattern_length). In the UI: the 5-parameter pattern selection |
| **Lag** | Implicit as `start_year_b - start_year_a`. Not stored as a separate field |

---

## Data Structures

### Pattern record (multi-index)

```
country_b_id_fk                int      — ID of Country B
start_year_a_fk                int      — Pattern start year for Country A
start_year_b_fk                int      — Pattern start year for Country B
pattern_length_fk              int      — Duration in years
indexes                        int      — Number of SCDIs in the pattern (≥ 2)
avg_corr                       float    — Average Pearson correlation across all SCDIs (0–1)
orgs                           int      — Number of distinct source organisations
Power                          float    — Pattern Power Score
Sectors                        list     — Sector names present in this pattern
overall_event_correlation_score float   — How similar the events of A and B were
event_correlation_count        int      — Number of matching events
similar_raw_event              string   — Description of matching events
similar_event_year_a           int
similar_event_year_b           int
```

**Derived/display columns** (renamed dynamically in the legacy app):
- `"{Country A} has Patterns with"` — partner name
- `"Starting Year for {Country A}"`
- `"Starting Year for Second Country"`
- `"Pattern Length"`
- `"Number of Indexes"`
- `"Correlation"` — shown as `%` string (e.g. `"95.61%"`)
- `"Pattern Power Score"`
- `"Organizations"`
- `"ES Score"` — Event Similarity Score
- `"Sectors"` — list, unknowns shown as `"Other"`

### Solo pattern record (single-index)

```
unique_id                      int
org_fk                         string   — e.g. "OECD", "World Bank", "SIPRI"
main_name_fk                   string   — Index category
index_name_fk                  string   — Specific indicator name
country_a_id_fk                int
country_b_id_fk                int
pattern_length_fk              int
correlation                    float
start_year_a_fk                int
index_values_a                 string   — Comma-separated values for Country A
start_year_b_fk                int
index_values_b                 string   — Comma-separated values for Country B
creation_date                  timestamp
Sector                         string
```

### Top-ranked patterns record

```
Country A                      int/name
Country B                      int/name
Starting Year A                int
Starting Year B                int
Pattern Length                 int
Number of Indexes              int
Average Correlation            string   — e.g. "95.61%"
Sources                        int      — Number of organisations
Pattern Power Ranking          float
```

### Country record

```
id         int     — Numeric ID used in all FK references
name_1     string  — Display name
alpha_2    string  — ISO 3166-1 alpha-2 (for flags)
```

---

## Page Designs

### 1. Dashboard (replaces Base Dashboard)

**Purpose:** First thing a user sees after login. Overview of the most powerful patterns across all country pairs.

**Layout:**
- Top: scatter plot — X: Pattern Length (years), Y: Number of Indexes, point size proportional to PPS. Title: *"The Strengths & Lengths of International Relationships"*
- Right panel: Patterns Leaderboard — top 1000 patterns by PPS, showing Country A | Country B | PPS
- Bottom left: Full index catalogue table — all 100+ indexes, sectored
- Bottom right: Sector rose chart — 13 sectors, petal size = number of indexes per sector

**Data source:** `qgi_data.patterns` (top by PPS), `qgi_data.scdis` (index catalogue)

---

### 2. Patterns Portal (core feature, replaces Patterns Portal)

The main interaction flow is a **5-step cascading selection**. Each step narrows the next. All steps live in a left sidebar (desktop) or collapsible filter panel (mobile).

#### Step-by-step selection

| Step | Label | Input type | Notes |
|------|-------|-----------|-------|
| 1 | Select Country A | Searchable dropdown (~195 countries) | Triggers load of all patterns for this country |
| 2 | Advanced Filters (optional) | Expandable panel | Correlation range slider, Pattern Length range slider, Year Gap slider (min gap between start_year_a and start_year_b) |
| 3 | Select Country B | Searchable dropdown | Pre-filtered to countries that have patterns with A |
| 4 | Select Pattern Length | Dropdown | Pre-filtered to available lengths for (A, B) pair |
| 5 | Select Starting Year A | Dropdown | Pre-filtered based on A, B, length |
| 6 | Select Starting Year B | Dropdown | Pre-filtered, cascades from all above |

Once all 5 parameters are set, render the full pattern view (below).

#### Pattern view layout

**Top section — 5-column summary card:**

| Col | Content |
|-----|---------|
| 1 | Pattern Partners for Country A — ranked list with occurrence count |
| 2 | Country A flag + name + date range (`start_year_a` → `start_year_a + length`) |
| 3 | Pattern Power Score (large number) + doughnut chart of sector breakdown |
| 4 | Country B flag + name + date range (`start_year_b` → `start_year_b + length`) |
| 5 | Pattern Partners for Country B — ranked list with occurrence count |

**Expandable sections below (all collapsed by default):**

1. **Timeline of Events** — chronological timeline for both countries during pattern period. Show events from both countries interleaved. Each event: `{Country}: {raw_event} — {description}`. Use a timeline component (e.g. vis-timeline or custom).

2. **Patterns Table** — all SCDIs in the pattern:
   - Columns: Index Name, Starting Year A, Starting Year B, Correlation (%), Organisation, Sector
   - Sector multiselect filter at the top
   - Sortable by correlation descending

3. **Pattern Indexes Charts** — 2–3 column grid of line charts, one per SCDI:
   - Each chart: two lines (Country A = one colour, Country B = another)
   - X-axis: years
   - Y-axis: index values
   - Chart title: index name, subtitle: correlation %
   - Metadata popover per chart: index description, tips, source/citation, organisation
   - **Data transformation selector** (applies to all charts simultaneously):
     - Raw
     - Normalised (0–1)
     - Standardised (z-score)
     - Base-year indexed (first year = 100)
     - Logarithmic
     - Growth rates (YoY %)
   - **Align toggle**: when start_year_a ≠ start_year_b, option to align both series to relative Year 1, Year 2, … so shapes are directly comparable

---

### 3. Pattern Power Ranking (replaces the PPR expander)

Separate page or tab showing the full master ranking of all patterns (~95K+ rows). 

- Filterable by sector (multiselect)
- Sortable by PPS
- Columns: Country A | Country B | Start Year A | Start Year B | Length | Indexes | Avg Corr | Orgs | Sectors | PPS

---

### 4. Early Warning Signals

A dedicated view (new — not a full page in the legacy app, but the logic exists):

- Shows patterns where `start_year_b < start_year_a` (Country A is following Country B's past trajectory)
- Filtered to patterns that end close to the current year (Country A is currently in the pattern window)
- Highlighted prominently — this is a core value proposition of QGI

---

## Sector Taxonomy

13 sectors used throughout the UI for filtering and display:

| Sector | Index count (approx) |
|--------|---------------------|
| Investments | 14 |
| Economy | 13 |
| Social | 6 |
| State Integrity | 4 |
| Education | 4 |
| Trade | 3 |
| Military | 3 |
| Health | 2 |
| Human Rights & Development | 1 |
| Resources | 1 |
| Public Services | 1 |
| Political State | 1 |
| Energy | 1 |

Sectors are used as multiselect filters on pattern tables and charts, and as a doughnut/rose chart in the dashboard.

---

## Charting Requirements

The legacy app uses ECharts (`streamlit-echarts`). For Next.js, use **ECharts via `echarts-for-react`** (or Apache ECharts directly) — not Recharts, as the ECharts feature set (rose charts, custom tooltip, data zoom) matches what's needed.

| Chart type | Where used | Library |
|-----------|-----------|---------|
| Line chart (dual series) | Pattern index charts | ECharts |
| Doughnut | Sector breakdown per pattern | ECharts |
| Scatter (sized points) | Base dashboard | ECharts |
| Rose / Nightingale | Sector distribution | ECharts |
| Timeline | Events | vis-timeline or custom |

**Line chart data transformation** must be computed client-side in real time as the user switches modes — no round-trip to the server.

---

## Regional Colour Coding

Countries are grouped into ~16 regions, each with a distinct display colour. Used in the leaderboard and pattern partner lists.

Regions:
- North Africa, West Africa, Central Africa, East Africa, Southern Africa
- North America, Central America, Caribbean, South America
- Europe, Caucasus, Middle East, Central Asia, South Asia, Southeast Asia, East Asia, Oceania

The exact region → colour mapping lives in the legacy `pages/patterns.py`. Extract this into a constants file in `qgi-frontend`.

---

## Predicted Values (Phase 1.5)

The pipeline adds `is_predicted` to indicator values and `contains_predicted_values` to SCDI/Pattern records when Phase 1.5 (Holt-Winters self-prediction) was used to complete a time series.

**UI requirements:**
- Line charts: predicted years rendered as dashed line / lighter opacity, clearly distinguished from real values
- Pattern table: badge on rows where `contains_predicted_values = true`
- Pattern Power Ranking: column showing predicted flag, filterable
- Tooltip/footnote: "One or more indicator values for these years are model predictions, not published data."

---

## Index Metadata

Each of the 100+ indicators has structured metadata (from `constant/index_metadata.py`, 725 lines):

```
name          string   — Display name
description   string   — What this indicator measures
tips          string   — How to interpret it in QGI context
source        string   — Organisation name (OECD, World Bank, SIPRI, etc.)
citation      string   — Full citation
```

This metadata is displayed as a **popover/tooltip** on each chart in the Patterns Portal and as detail rows in the index catalogue table.

The metadata must be queryable from the API — store in a static JSON file in `qgi-frontend` (it doesn't change between pipeline runs) or serve from a dedicated `/api/indexes` endpoint.

---

## Data Volume & Scale

| Entity | Count |
|--------|-------|
| Countries | ~195 |
| Indicators (indexes) | ~100 |
| Sectors | 13 |
| Patterns (total) | ~95,000+ |
| Pattern time range | 1990–present |
| Top-ranked patterns | 50 (dashboard) / 1000 (leaderboard) |

Patterns are queried from Athena — full table scans on `qgi_data.patterns` must be avoided. Always filter by `country_a` + `country_b` at minimum before fetching detail.

---

## Cascading Query Strategy (API layer)

Efficient data loading for the 5-step pattern selection:

1. `GET /api/countries` — full country list (cached, rarely changes)
2. `GET /api/patterns/partners?country_a={id}` — list of Country B options for Country A (returns distinct country_b + available lengths)
3. `GET /api/patterns/lengths?country_a={id}&country_b={id}` — available lengths
4. `GET /api/patterns/years?country_a={id}&country_b={id}&length={n}` — available (start_year_a, start_year_b) pairs
5. `GET /api/patterns/detail?country_a={id}&country_b={id}&start_a={y}&start_b={y}&length={n}` — full pattern with all SCDIs + solo index values for charting

Each step triggers the next dropdown to populate. Steps 1–4 can return small payloads (<1KB). Step 5 returns the full pattern data including `index_values_a` and `index_values_b` arrays for charting.

---

## Tickets to Update

Based on this analysis, the following tickets need richer scope:

| Ticket | What to add/update |
|--------|-------------------|
| **#100 SCDIs browser** | This is actually the Patterns Portal (5-step selection + charts + table + timeline). Rename and expand scope significantly. SCDIs are the underlying data, but the UI surface is the Pattern view. |
| **#101 Patterns browser** | This is more the Pattern Power Ranking table + Early Warning Signals view. Rename to clarify. |
| New ticket needed | **Index catalogue** — browsable table of all 100+ indicators with sector filtering and metadata |
| New ticket needed | **Early Warning Signals** — dedicated view for predictive patterns |
| New ticket needed | **Base Dashboard** — scatter plot + leaderboard (currently no ticket) |
| **#99 Data API layer** | Add the cascading query endpoints above. Add `/api/indexes` for metadata. |

---

## What the Legacy App Does NOT Have (new in qgi-frontend)

- User authentication (Cognito)
- Paywall / plan tiers
- Saved searches / watchlists (future)
- Email alerts when new patterns match a watchlist (future — relates to #77)
- Mobile-responsive layout (Streamlit is desktop-only)
- Blog / landing site
