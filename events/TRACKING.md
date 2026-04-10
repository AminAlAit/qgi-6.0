# QGI Events — Sonnet Processing Tracking

Tracks how many times each country has been processed by a Sonnet agent.

**Counters are integers, not booleans**, because each pass can be re-run for higher quality:
- `0` = never run
- `1` = run once
- `2` = run twice (re-run for quality)
- `3+` = run three or more times

**Pass meanings:**
- **generated** — Sonnet wrote the events from scratch (new country with no prior data)
- **curated** — Sonnet applied E1–E5 cleanup rules (drop, dedup, merge, taxonomy normalize) — does NOT verify facts
- **verified** — Sonnet web-searched every event to confirm year, country, details — DOES verify facts

A country is "ready for V1.5.3 pipeline" only when `curated >= 1` AND `verified >= 1`.

**Source files:**
- Raw generated events: `data/events/batches/{country}.json`
- Curated/verified output: `data/events/curated/{country}.json`

**Counter updates:** when an agent finishes processing a country, edit this file and bump the corresponding counter.

---

## Tracking table

| Country | Generated | Curated | Verified | Last updated | Notes |
|---------|----------:|--------:|---------:|--------------|-------|
| afghanistan | 1 | 1 | 0 | 2026-04-07 | curated 323→184 (Soviet war + 2001-21 US war + 2021 Taliban collapsed) |
| albania | 1 | 0 | 0 | 2026-04-07 |  |
| algeria | 1 | 1 | 0 | 2026-04-07 | curated 161→132 |
| angola | 1 | 0 | 0 | 2026-04-07 |  |
| argentina | 1 | 1 | 0 | 2026-04-07 | curated 193→180 (agent reported wrong input count; only 13 dropped, re-curation candidate) |
| armenia | 1 | 0 | 0 | 2026-04-07 |  |
| australia | 1 | 0 | 0 | 2026-04-07 |  |
| austria | 1 | 0 | 0 | 2026-04-07 |  |
| azerbaijan | 1 | 0 | 0 | 2026-04-07 |  |
| belgium | 1 | 0 | 0 | 2026-04-07 |  |
| bolivia | 1 | 0 | 0 | 2026-04-07 |  |
| bosnia_and_herzegovina | 1 | 0 | 0 | 2026-04-07 |  |
| brazil | 1 | 1 | 0 | 2026-04-07 | curated 241→239 (NEAR-ZERO dedup, agent only fixed 1 dup + typos — strong re-curation candidate) |
| bulgaria | 1 | 0 | 0 | 2026-04-07 |  |
| cambodia | 1 | 0 | 0 | 2026-04-07 |  |
| cameroon | 1 | 0 | 0 | 2026-04-07 |  |
| canada | 1 | 0 | 0 | 2026-04-07 |  |
| central_african_republic | 1 | 0 | 0 | 2026-04-07 |  |
| chad | 1 | 0 | 0 | 2026-04-07 |  |
| chile | 1 | 0 | 0 | 2026-04-07 |  |
| china | 1 | 1 | 0 | 2026-04-07 | curated 349→177 (Cultural Revolution + Great Leap collapsed; first attempt asked for Bash, retry succeeded) |
| colombia | 1 | 0 | 0 | 2026-04-07 |  |
| costa_rica | 1 | 0 | 0 | 2026-04-07 |  |
| croatia | 1 | 0 | 0 | 2026-04-07 |  |
| cuba | 1 | 0 | 0 | 2026-04-07 |  |
| czechia | 1 | 0 | 0 | 2026-04-07 |  |
| denmark | 1 | 0 | 0 | 2026-04-07 |  |
| dominican_republic | 1 | 0 | 0 | 2026-04-07 |  |
| ecuador | 1 | 0 | 0 | 2026-04-07 |  |
| egypt | 1 | 1 | 0 | 2026-04-07 | curated 342→163 (source had ~45 exact duplicate titles; heavy E5 cleanup) |
| el_salvador | 1 | 0 | 0 | 2026-04-07 |  |
| eritrea | 1 | 1 | 0 | 2026-04-07 | curated 232→191 |
| estonia | 1 | 0 | 0 | 2026-04-07 |  |
| ethiopia | 1 | 1 | 0 | 2026-04-07 | curated 324→280 |
| finland | 1 | 0 | 0 | 2026-04-07 |  |
| france | 1 | 0 | 0 | 2026-04-07 |  |
| georgia | 1 | 0 | 0 | 2026-04-07 |  |
| germany | 1 | 0 | 0 | 2026-04-07 |  |
| ghana | 1 | 0 | 0 | 2026-04-07 |  |
| greece | 1 | 0 | 0 | 2026-04-07 |  |
| guatemala | 1 | 0 | 0 | 2026-04-07 |  |
| haiti | 1 | 0 | 0 | 2026-04-07 |  |
| honduras | 1 | 0 | 0 | 2026-04-07 |  |
| hungary | 1 | 0 | 0 | 2026-04-07 |  |
| india | 1 | 1 | 0 | 2026-04-07 | curated 316→226 (light dedup, candidate for re-curation) |
| indonesia | 1 | 1 | 0 | 2026-04-07 | curated 155→71 (1965 cluster collapsed to single mass-atrocity event) |
| iran | 1 | 1 | 0 | 2026-04-07 | curated 159→146 (LIGHT dedup, candidate for re-curation) |
| iraq | 1 | 1 | 0 | 2026-04-07 | curated 167→94 (aggressive E5: Iran-Iraq, sanctions, ISIS clusters collapsed) |
| ireland | 1 | 0 | 0 | 2026-04-07 |  |
| israel | 1 | 1 | 0 | 2026-04-07 | curated 157→117 |
| italy | 1 | 0 | 0 | 2026-04-07 |  |
| ivory_coast | 1 | 0 | 0 | 2026-04-07 |  |
| jamaica | 1 | 0 | 0 | 2026-04-07 |  |
| japan | 1 | 0 | 0 | 2026-04-07 |  |
| jordan | 1 | 1 | 0 | 2026-04-07 | curated 157→106; per-event verified flags in file are FAKE, ignore them |
| kazakhstan | 1 | 0 | 0 | 2026-04-07 |  |
| kenya | 1 | 0 | 0 | 2026-04-07 |  |
| kuwait | 1 | 1 | 0 | 2026-04-07 | curated 168→60 |
| kyrgyzstan | 1 | 0 | 0 | 2026-04-07 |  |
| laos | 1 | 0 | 0 | 2026-04-07 |  |
| lebanon | 1 | 1 | 0 | 2026-04-07 | curated 173→99 (Civil War cluster compressed hard) |
| libya | 1 | 1 | 0 | 2026-04-07 | curated 231→82 (Gaddafi era + 2011 + 2014 civil war collapsed) |
| madagascar | 1 | 0 | 0 | 2026-04-07 |  |
| malaysia | 1 | 0 | 0 | 2026-04-07 |  |
| mali | 1 | 0 | 0 | 2026-04-07 |  |
| mexico | 1 | 1 | 0 | 2026-04-07 | curated 171→114 |
| morocco | 1 | 1 | 0 | 2026-04-07 | curated 163→139 |
| mozambique | 1 | 0 | 0 | 2026-04-07 |  |
| myanmar | 1 | 0 | 0 | 2026-04-07 |  |
| nepal | 1 | 0 | 0 | 2026-04-07 |  |
| netherlands | 1 | 0 | 0 | 2026-04-07 |  |
| nicaragua | 1 | 0 | 0 | 2026-04-07 |  |
| nigeria | 1 | 1 | 0 | 2026-04-07 | curated 236→127 (Biafra, Boko Haram, transition clusters compressed) |
| north_korea | 1 | 0 | 0 | 2026-04-07 |  |
| norway | 1 | 0 | 0 | 2026-04-07 |  |
| pakistan | 1 | 1 | 0 | 2026-04-07 | curated 130→134 (file count >= input — likely under-applied E5; candidate for re-curation) |
| peru | 1 | 0 | 0 | 2026-04-07 |  |
| philippines | 1 | 1 | 0 | 2026-04-07 | curated 155→155 (ZERO dedup, agent only did category remap — strong re-curation candidate) |
| poland | 1 | 0 | 0 | 2026-04-07 |  |
| portugal | 1 | 0 | 0 | 2026-04-07 |  |
| romania | 1 | 0 | 0 | 2026-04-07 |  |
| russia | 1 | 1 | 0 | 2026-04-07 | curated 368→304 (LIGHT dedup for a 75yr Cold War history, re-curate candidate) |
| saudi_arabia | 1 | 1 | 0 | 2026-04-07 | curated 226→118 |
| singapore | 1 | 0 | 0 | 2026-04-07 |  |
| somalia | 1 | 0 | 0 | 2026-04-07 |  |
| south_africa | 1 | 1 | 0 | 2026-04-07 | curated 155→154 (NEAR-ZERO dedup despite explicit ask, agent ignored E5 — strong re-curation candidate) |
| south_korea | 1 | 0 | 0 | 2026-04-07 |  |
| spain | 1 | 0 | 0 | 2026-04-07 |  |
| sri_lanka | 1 | 0 | 0 | 2026-04-07 |  |
| sudan | 1 | 1 | 0 | 2026-04-07 | curated 161→90 (civil wars + 2019/2023 clusters merged) |
| sweden | 1 | 0 | 0 | 2026-04-07 |  |
| switzerland | 1 | 0 | 0 | 2026-04-07 |  |
| syria | 1 | 1 | 0 | 2026-04-07 | curated 183→173 (light dedup, may benefit from re-curation) |
| thailand | 1 | 0 | 0 | 2026-04-07 |  |
| tunisia | 1 | 1 | 0 | 2026-04-07 | curated 135→106 |
| turkey | 1 | 1 | 0 | 2026-04-07 | curated 147→97 |
| ukraine | 1 | 1 | 1 | 2026-04-07 | NO source batch — generated via Sonnet+WebSearch (43 events, real Wikipedia URLs). First country with verified=1 |
| united_arab_emirates | 1 | 1 | 0 | 2026-04-07 | curated 163→105 |
| united_kingdom | 1 | 0 | 0 | 2026-04-07 |  |
| united_states | 1 | 0 | 0 | 2026-04-07 |  |
| vietnam | 1 | 1 | 0 | 2026-04-07 | curated 220→79 (Vietnam War collapsed to phase markers) |
| yemen | 1 | 1 | 0 | 2026-04-07 | curated 176→149 |

---

## Aggregate progress

- Generated ≥1: **101 / 101** countries
- Curated ≥1: **23 / 101** countries (+ libya, afghanistan, china, iran, saudi_arabia, algeria, morocco, india, russia). Ukraine source file missing — fabricated agent output deleted; needs `generate` workflow not `curate`.
- Verified ≥1: **0 / 101** countries
- **Both curated ≥1 AND verified ≥1: 0 / 101** ← target threshold for unblocking pipeline cutover

## Unblock thresholds

- **#141** (event source cutover, batches/ → curated/): requires **≥75 / 101 countries** with both `curated ≥ 1` AND `verified ≥ 1`. Current: **0 / 75**.
