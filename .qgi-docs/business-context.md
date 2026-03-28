# QGI — Business Context

> Last updated: 2026-03-28

---

## What is QGI?

**QGI** = **Quantitative Geopolitical Intelligence**

QGI is a SaaS platform that captures how countries behave and react — and offers highly educated predictions on where countries are heading — by finding statistical patterns in how one country's quantitative history mirrors another country's future.

---

## The core insight

Every country's trajectory can be measured through indicators: GDP growth, energy exports, military spending, social stability, and hundreds more. QGI's central discovery is that **countries often walk the same path**, just at different times.

### SCDI — Single Dyadic Correlating Index

An SCDI is a statistically significant match between Country A's indicator segment and Country B's indicator segment of the same indicator, possibly offset in time:

> Country A's [indicator X] over years [T_a → T_a + length] correlates with Country B's [indicator X] over years [T_b → T_b + length] at strength R.

The years can overlap (T_a = T_b) or be offset (T_b > T_a means B is following A with a delay). There is no separate "lag" field — the lag is implicit as `start_year_b - start_year_a`.

### Pattern

A Pattern aggregates all SCDIs from **all indicators** that share the same country pair, length, and start years. It answers: "How many indicators, and how strongly, does Country A's [T_a → T_a+N] trajectory match Country B's [T_b → T_b+N] trajectory?"

**Pattern columns:**

| Column | Meaning |
|--------|---------|
| country_a_id | The "predictor" country |
| country_b_id | The "follower" country |
| length | Segment length in years |
| start_year_a | Country A's segment start |
| start_year_b | Country B's segment start |
| indicator_count | How many indicators contribute to this match |
| avg_correlation | Average Pearson correlation across contributing indicators |
| pattern_power_score | `length × indicator_count × avg_correlation` — composite ranking metric |

### Real-world example

| | SCDI 1: Energy Exports | SCDI 2: Military Expenditure |
|-|------------------------|------------------------------|
| Country A | Saudi Arabia | Saudi Arabia |
| Country B | Azerbaijan | Azerbaijan |
| Length | 5 years | 5 years |
| A segment | 2011–2016 | 2011–2016 |
| B segment | 2016–2021 | 2016–2021 |
| Correlation | 95% | 91% |

**What happened:** Saudi Arabia ended its 2011–2016 trajectory by starting the Yemen War. Azerbaijan ended its 2016–2021 trajectory by starting the Nagorno-Karabakh war.

**The insight:** A QGI user in 2019 would see: "Azerbaijan has been walking on Saudi Arabia's footsteps for 4 years. It is on the path of a trajectory that — for Saudi Arabia — ended in military conflict."

This is QGI's core value proposition: **finding these footstep relationships across all 260 countries and all available indicators, continuously**.

---

## Product layers

| Layer | Status | Description |
|-------|--------|-------------|
| Data ingestion (Phase 1) | Live | World Bank indicators, 260 countries, monthly |
| Indicator completion (Phase 1.5) | Not built | Self-predict missing recent years per indicator; flag as predicted |
| SCDI computation (Phase 2) | Live | Batch: all country pairs, all updated indicators |
| Pattern synthesis (Phase 4) | Live | Aggregate SCDIs into patterns |
| Recipes (Phase 6 — first KE pipeline) | Not started | Map patterns to real-world event types via country event data |
| Other KE pipelines | Planned | Influence Cascade, Country Profiles (future) |
| Website-facing APIs | Not started | SaaS subscription layer |
| Frontend | Not started | Web application for subscribers |

---

## Knowledge extraction — Recipes

The first knowledge extraction pipeline to build.

**Concept:** A Recipe is a pattern that has historically preceded a specific event type — e.g. "Military Conflict", "Economic Boom", "Inflation Surge", "Political Unrest".

**How it works:**
1. Collect the top ~10 most important events per country per year (AI-generated, see below)
2. For each pattern, look at what events occurred for Country A and Country B at the end of their respective segments (`start_year + length`)
3. If both countries ended with the same event type (e.g., both "Military Conflict"), that pattern is a candidate instance of the "Military Conflict" recipe
4. Aggregate many such instances → a Recipe = a statistical fingerprint of patterns that precede a given event type
5. Match current (possibly incomplete) patterns against Recipes → generate alerts: "Country X is currently showing a pattern consistent with the [Military Conflict] recipe"

**Events data model:**

| Field | Type | Description |
|-------|------|-------------|
| country | string | Country name |
| year | int | Year of the event |
| title | string | 2–3 word summary |
| description | string | 1–2 line description |
| severity | float/enum | Assessed by AI model |

**Collection method:** AI-generated from historical records (Claude or Gemini). One-time bulk generation for history, then annual updates.

**Important:** Recipe matching against current-year patterns requires completed (predicted) indicator values — which is why the Indicator Completion phase (1.5) is a prerequisite for Recipes to work in real-time.

**Other planned KE pipelines (deferred):** Influence Cascade, Country Profiles.

---

## Indicator completion

A critical missing pipeline component. World Bank (and other source) indicator values are often published 1–2 years late. To make Recipes useful in real-time, each indicator's time series must be extended to the current year using **self-prediction** (each indicator predicts its own missing values, not cross-indicator prediction).

**Rules:**
- Predicted values are stored distinctly from real values (flag: `is_predicted = true`)
- Frontend must visually differentiate predicted from real values
- SCDI/Pattern computation can run on predicted values, but outputs must carry a `contains_predicted` flag
- Self-prediction only — not cross-indicator

This is another reason the EventBridge Scheduler was paused: the pipeline should run indicator completion before SCDI computation, which it currently does not do.

---

## Customers and commercial model

**Business stage:** Pre-launch. Pipeline infrastructure is being rebuilt in Terraform before product development begins.

### Revenue streams

| Stream | Model | Price | Notes |
|--------|-------|-------|-------|
| B2B private indicators | Client pays to run their private dataset through the pipeline | ~$5K/indicator (large clients), ~$1.5K (standard), ~$2K (mid) | Pipeline already built; client data stays private, never mixed with public indicators |
| Client reports | One-off intelligence report for a specific country pair or question | Variable | White-glove service |
| SaaS tiers | Subscription access to QGI web platform | TBD tiers | Recipes alerts, pattern explorer, country profiles |
| Social media | Public-facing content (insights, pattern highlights) | Free / brand-building | Drives awareness and inbound |

### Target subscribers (SaaS)
- Journalists and investigative reporters
- Academic researchers and political scientists
- Policy makers and government analysts
- Corporate decision makers (risk, geopolitical exposure)
- Prediction market participants
- Geopolitics enthusiasts and informed news-followers

### B2B private indicator model (key differentiator)
A client with proprietary data (e.g. satellite imagery, private sentiment scores, classified economic data) can pay to have that indicator run through the QGI pipeline. The pipeline produces SCDIs and Patterns for that indicator against all 260 countries — results are returned to the client and never exposed on the public platform. This monetises the pipeline infrastructure independently of the SaaS product.

---

## Open product questions

See [open-questions.md](open-questions.md) for the full list.
