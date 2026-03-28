# QGI — Business Context

> **Status:** Partially documented. Sections marked `[TBD — ask Amin]` must be filled in.
> Last updated: 2026-03-28

---

## What is QGI?

**QGI** stands for `[TBD — ask Amin: what does the acronym stand for?]`

In one sentence: `[TBD — ask Amin: what is the product, and who is the intended customer/user?]`

### Working description (derived from architecture, pending confirmation)

QGI is a data intelligence platform that ingests quantitative indicators from international data sources (World Bank, OECD, UN, IMF, and others), computes statistical correlations between countries' indicator time series, and synthesizes these into geopolitical intelligence patterns — revealing which countries' historical trajectories predict other countries' future trajectories across economic, social, political, and stability dimensions.

---

## The core insight

The platform is built on a concept called the **SCDI (Single Dyadic Correlating Index)**:

> Country A's indicator X, measured over years T to T+N, correlates with Country B's indicator Y, measured over years T+M to T+M+N, at correlation strength R.

In plain terms: "What Country A did between years T and T+N is statistically similar to what Country B did M years later."

Aggregating thousands of SCDIs across many indicators for the same country pair produces a **Pattern** — a summary of how strongly and how often Country A's past predicts Country B's future (or vice versa).

`[TBD — ask Amin: what does a pattern mean to a human analyst? What geopolitical insight does it provide? Provide an example.]`

---

## Current product state

| Layer | Status | Description |
|-------|--------|-------------|
| Data ingestion (Phase 1) | Live | Fetches 50 active World Bank indicators for 260 countries monthly |
| SCDI computation (Phase 2) | Live | Batch job computes all country-pair SCDIs for updated indicators |
| Pattern synthesis (Phase 4) | Live | Aggregates SCDIs into per-country-pair patterns |
| Knowledge extraction | Not started | Extracting actionable intelligence from SCDIs and Patterns |
| Website-facing APIs | Not started | #15, #16, #17 — public or internal API layer |
| Frontend | Not started | `[TBD]` |

---

## Users and customers

`[TBD — ask Amin:]`
- Who is the intended user of the output? (Amin only? Clients? Public?)
- Is this a B2B product, B2C, or personal research tool?
- Is there a commercial model (subscription, consulting, data licensing)?
- Is the website (qgi-api-* Lambdas) public-facing or internal?

---

## Data sources

See [data-sources.md](data-sources.md) for the full source registry.

**Current:** World Bank API (50 active indicators, 210 on hold)
**Planned:** OECD, Our World In Data, UN, IMF, Fund for Peace, Freedom House, others

**Licensing constraint:** All sources must be free to use for commercial purposes, including commercial exploitation of derived intelligence (SCDIs, Patterns, downstream insights). This must be verified per source before integration.

---

## Strategic direction

`[TBD — ask Amin: what are the 1-year and 3-year goals for QGI?]`

Known intentions (derived from conversations):
- Rebuild the pipeline in Terraform (qgi-infra) for reproducibility and multi-environment support
- Extend ingestion to multiple data sources (multi-source architecture)
- Build knowledge extraction pipelines on top of SCDIs and Patterns
- Build website-facing API layer for consuming intelligence outputs
- Eventually: staging → QA → production environment progression

---

## Open product questions

See [open-questions.md](open-questions.md) for the full list.
