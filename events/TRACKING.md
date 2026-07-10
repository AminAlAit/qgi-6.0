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

**Counter updates:** when an agent finishes processing a country, edit this file and bump the Generated/Curated counters. The **Verified column is machine-owned** — see below; never bump it by hand.

**Verified counter — regenerated from truth (2026-07-02):** the `Verified` column of the
Tracking table below is REGENERATED from the actual `events/verification/` files by
`node workflows/events/_lib.mjs regen-tracking` (run automatically after every Mode A/B
event batch). Semantics: `Verified` = the MODAL per-event `verify_count` across the
country's verification entries (`0` = no verification file). Per-event counts live in
each entry's `verify_count` field (v2 double-verify schema). Only the Tracking table
directly below is regenerated; the dated session sections further down are frozen
historical records. Note: countries whose historical sessions recorded 2–3 verification
passes (iran, ukraine, venezuela, south_africa) read `1` here — those re-runs overwrote
verdicts in place and left no per-event audit trail, so exactly one recorded pass per
event survives on disk.

---

## Tracking table

| Country | Generated | Curated | Verified | Last updated | Notes |
|---------|----------:|--------:|---------:|--------------|-------|
| afghanistan | 1 | 1 | 1 | 2026-07-02 | curated 323→184 (Soviet war + 2001-21 US war + 2021 Taliban collapsed) |
| albania | 1 | 0 | 1 | 2026-07-02 |  |
| algeria | 1 | 1 | 1 | 2026-07-02 | curated 161→132 |
| angola | 1 | 0 | 1 | 2026-07-02 |  |
| argentina | 1 | 1 | 1 | 2026-07-02 | curated 193→180 (agent reported wrong input count; only 13 dropped, re-curation candidate) |
| armenia | 1 | 0 | 1 | 2026-07-02 |  |
| australia | 1 | 0 | 1 | 2026-07-02 |  |
| austria | 1 | 0 | 1 | 2026-07-02 |  |
| azerbaijan | 1 | 0 | 1 | 2026-07-02 |  |
| belgium | 1 | 0 | 1 | 2026-07-02 |  |
| bolivia | 1 | 0 | 1 | 2026-07-02 |  |
| bosnia_and_herzegovina | 1 | 0 | 1 | 2026-07-02 |  |
| brazil | 1 | 1 | 1 | 2026-07-02 | curated 241→239 (NEAR-ZERO dedup, agent only fixed 1 dup + typos — strong re-curation candidate) |
| bulgaria | 1 | 0 | 1 | 2026-07-02 |  |
| cambodia | 1 | 0 | 1 | 2026-07-02 |  |
| cameroon | 1 | 0 | 1 | 2026-07-02 |  |
| canada | 1 | 0 | 1 | 2026-07-02 |  |
| central_african_republic | 1 | 0 | 0 | 2026-04-07 |  |
| chad | 1 | 0 | 1 | 2026-07-02 |  |
| chile | 1 | 0 | 1 | 2026-07-02 |  |
| china | 1 | 1 | 1 | 2026-07-02 | curated 349→177 (Cultural Revolution + Great Leap collapsed; first attempt asked for Bash, retry succeeded) |
| colombia | 1 | 0 | 1 | 2026-07-02 |  |
| costa_rica | 1 | 0 | 1 | 2026-07-02 |  |
| croatia | 1 | 0 | 1 | 2026-07-02 |  |
| cuba | 1 | 0 | 1 | 2026-07-02 |  |
| czechia | 1 | 0 | 1 | 2026-07-02 |  |
| denmark | 1 | 0 | 1 | 2026-07-02 |  |
| dominican_republic | 1 | 0 | 1 | 2026-07-02 |  |
| ecuador | 1 | 0 | 1 | 2026-07-02 |  |
| egypt | 1 | 1 | 1 | 2026-07-02 | curated 342→163 (source had ~45 exact duplicate titles; heavy E5 cleanup) |
| el_salvador | 1 | 0 | 1 | 2026-07-02 |  |
| eritrea | 1 | 1 | 1 | 2026-07-02 | curated 232→191 |
| estonia | 1 | 0 | 1 | 2026-07-02 |  |
| ethiopia | 1 | 1 | 1 | 2026-07-02 | curated 324→280 |
| finland | 1 | 0 | 1 | 2026-07-02 |  |
| france | 1 | 0 | 1 | 2026-07-02 |  |
| georgia | 1 | 0 | 1 | 2026-07-02 |  |
| germany | 1 | 0 | 1 | 2026-07-02 |  |
| ghana | 1 | 0 | 1 | 2026-07-02 |  |
| greece | 1 | 0 | 1 | 2026-07-02 |  |
| guatemala | 1 | 0 | 1 | 2026-07-02 |  |
| haiti | 1 | 0 | 1 | 2026-07-02 |  |
| honduras | 1 | 0 | 1 | 2026-07-02 |  |
| hungary | 1 | 0 | 1 | 2026-07-02 |  |
| india | 1 | 1 | 1 | 2026-07-02 | curated 316→226 (light dedup, candidate for re-curation) |
| indonesia | 1 | 1 | 1 | 2026-07-02 | curated 155→71 (1965 cluster collapsed to single mass-atrocity event) |
| iran | 1 | 1 | 1 | 2026-07-02 | curated 159→146 (LIGHT dedup, candidate for re-curation) |
| iraq | 1 | 1 | 1 | 2026-07-02 | curated 167→94 (aggressive E5: Iran-Iraq, sanctions, ISIS clusters collapsed) |
| ireland | 1 | 0 | 1 | 2026-07-02 |  |
| israel | 1 | 1 | 1 | 2026-07-02 | curated 157→117 |
| italy | 1 | 0 | 1 | 2026-07-02 |  |
| ivory_coast | 1 | 0 | 1 | 2026-07-02 |  |
| jamaica | 1 | 0 | 1 | 2026-07-02 |  |
| japan | 1 | 0 | 1 | 2026-07-02 |  |
| jordan | 1 | 1 | 1 | 2026-07-02 | curated 157→106; per-event verified flags in file are FAKE, ignore them |
| kazakhstan | 1 | 0 | 1 | 2026-07-02 |  |
| kenya | 1 | 0 | 1 | 2026-07-02 |  |
| kuwait | 1 | 1 | 1 | 2026-07-02 | curated 168→60 |
| kyrgyzstan | 1 | 0 | 1 | 2026-07-02 |  |
| laos | 1 | 0 | 1 | 2026-07-02 |  |
| lebanon | 1 | 1 | 1 | 2026-07-02 | curated 173→99 (Civil War cluster compressed hard) |
| libya | 1 | 1 | 1 | 2026-07-02 | curated 231→82 (Gaddafi era + 2011 + 2014 civil war collapsed) |
| madagascar | 1 | 0 | 1 | 2026-07-02 |  |
| malaysia | 1 | 0 | 1 | 2026-07-02 |  |
| mali | 1 | 0 | 1 | 2026-07-02 |  |
| mexico | 1 | 1 | 1 | 2026-07-02 | curated 171→114 |
| morocco | 1 | 1 | 1 | 2026-07-02 | curated 163→139 |
| mozambique | 1 | 0 | 1 | 2026-07-02 |  |
| myanmar | 1 | 0 | 1 | 2026-07-02 |  |
| nepal | 1 | 0 | 1 | 2026-07-02 |  |
| netherlands | 1 | 0 | 1 | 2026-07-02 |  |
| nicaragua | 1 | 0 | 1 | 2026-07-02 |  |
| nigeria | 1 | 1 | 1 | 2026-07-02 | curated 236→127 (Biafra, Boko Haram, transition clusters compressed) |
| north_korea | 1 | 0 | 1 | 2026-07-02 |  |
| norway | 1 | 0 | 1 | 2026-07-02 |  |
| pakistan | 1 | 1 | 1 | 2026-07-02 | curated 130→134 (file count >= input — likely under-applied E5; candidate for re-curation) |
| peru | 1 | 0 | 1 | 2026-07-02 |  |
| philippines | 1 | 1 | 1 | 2026-07-02 | curated 155→155 (ZERO dedup, agent only did category remap — strong re-curation candidate) |
| poland | 1 | 0 | 1 | 2026-07-02 |  |
| portugal | 1 | 0 | 1 | 2026-07-02 |  |
| romania | 1 | 0 | 1 | 2026-07-02 |  |
| russia | 1 | 1 | 1 | 2026-07-02 | curated 368→304 (LIGHT dedup for a 75yr Cold War history, re-curate candidate) |
| saudi_arabia | 1 | 1 | 1 | 2026-07-02 | curated 226→118 |
| singapore | 1 | 0 | 1 | 2026-07-02 |  |
| somalia | 1 | 0 | 1 | 2026-07-02 |  |
| south_africa | 1 | 1 | 1 | 2026-07-02 | curated 155→154 (NEAR-ZERO dedup despite explicit ask, agent ignored E5 — strong re-curation candidate) |
| south_korea | 1 | 0 | 1 | 2026-07-02 |  |
| spain | 1 | 0 | 1 | 2026-07-02 |  |
| sri_lanka | 1 | 0 | 1 | 2026-07-02 |  |
| sudan | 1 | 1 | 1 | 2026-07-02 | curated 161→90 (civil wars + 2019/2023 clusters merged) |
| sweden | 1 | 0 | 1 | 2026-07-02 |  |
| switzerland | 1 | 0 | 1 | 2026-07-02 |  |
| syria | 1 | 1 | 1 | 2026-07-02 | curated 183→173 (light dedup, may benefit from re-curation) |
| thailand | 1 | 0 | 1 | 2026-07-02 |  |
| tunisia | 1 | 1 | 1 | 2026-07-02 | curated 135→106 |
| turkey | 1 | 1 | 0 | 2026-04-07 | curated 147→97 |
| turkmenistan | 1 | 1 | 1 | 2026-04-30 | curated 39 events; fully verified (39/39): 32 TRUE, 4 UNCERTAIN, 3 FALSE |
| ukraine | 1 | 1 | 1 | 2026-04-07 | NO source batch — generated via Sonnet+WebSearch (43 events, real Wikipedia URLs). First country with verified=1 |
| united_arab_emirates | 1 | 1 | 1 | 2026-07-02 | curated 163→105 |
| united_kingdom | 1 | 0 | 1 | 2026-07-02 |  |
| united_states | 1 | 0 | 1 | 2026-07-02 |  |
| vietnam | 1 | 1 | 1 | 2026-07-02 | curated 220→79 (Vietnam War collapsed to phase markers) |
| yemen | 1 | 1 | 1 | 2026-07-02 | curated 176→149 |
| andorra | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| antigua_and_barbuda | - | - | 2 | 2026-07-03 | row added by regen-tracking (Generated/Curated: see session logs below) |
| bahamas | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| bahrain | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| bangladesh | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| barbados | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| belarus | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| belize | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| benin | - | - | 0 | 2026-07-10 | row added by regen-tracking (Generated/Curated: see session logs below) |
| bhutan | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| botswana | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| brunei | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| burkina_faso | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| burundi | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| cabo_verde | - | - | 2 | 2026-07-03 | row added by regen-tracking (Generated/Curated: see session logs below) |
| comoros | - | - | 2 | 2026-07-09 | row added by regen-tracking (Generated/Curated: see session logs below) |
| cyprus | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| democratic_republic_of_congo | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| djibouti | - | - | 2 | 2026-07-05 | row added by regen-tracking (Generated/Curated: see session logs below) |
| dominica | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| equatorial_guinea | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| eswatini | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| fiji | - | - | 2 | 2026-07-05 | row added by regen-tracking (Generated/Curated: see session logs below) |
| gabon | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| gambia | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| grenada | - | - | 2 | 2026-07-09 | row added by regen-tracking (Generated/Curated: see session logs below) |
| guinea | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| guinea_bissau | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| guyana | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| iceland | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| kiribati | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| kosovo | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| latvia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| lesotho | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| liberia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| liechtenstein | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| lithuania | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| luxembourg | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| malawi | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| maldives | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| malta | - | - | 2 | 2026-07-03 | row added by regen-tracking (Generated/Curated: see session logs below) |
| marshall_islands | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| mauritania | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| mauritius | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| micronesia | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| moldova | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| monaco | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| mongolia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| montenegro | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| namibia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| nauru | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| new_zealand | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| niger | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| north_macedonia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| oman | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| palau | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| palestine | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| panama | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| papua_new_guinea | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| paraguay | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| qatar | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| republic_of_congo | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| rwanda | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| saint_kitts_and_nevis | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| saint_lucia | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| saint_vincent_and_the_grenadines | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| samoa | - | - | 2 | 2026-07-03 | row added by regen-tracking (Generated/Curated: see session logs below) |
| san_marino | - | - | 2 | 2026-07-09 | row added by regen-tracking (Generated/Curated: see session logs below) |
| sao_tome_and_principe | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| senegal | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| serbia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| seychelles | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| sierra_leone | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| slovakia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| slovenia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| solomon_islands | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| south_sudan | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| suriname | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| taiwan | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| tajikistan | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| tanzania | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| timor_leste | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| togo | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| tonga | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| trinidad_and_tobago | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| turkiye | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| tuvalu | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| uganda | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| uruguay | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| uzbekistan | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| vanuatu | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| vatican_city | - | - | 0 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| venezuela | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| zambia | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |
| zimbabwe | - | - | 1 | 2026-07-02 | row added by regen-tracking (Generated/Curated: see session logs below) |

### Added 2026-04-13 session (verification batch + extras)

| Country | Generated | Curated | Verified | Last updated | Notes |
|---------|----------:|--------:|---------:|--------------|-------|
| colombia | 1 | 1 | 1 | 2026-04-13 | 78 events, fully verified |
| ethiopia | 1 | 1 | 1 | 2026-04-13 | 280 events, partial verification (134/280) |
| egypt | 1 | 1 | 1 | 2026-04-13 | 163 events, partial verification (85/163) |
| iraq | 1 | 1 | 1 | 2026-04-13 | 94 events, partial (52/94) |
| south_africa | 1 | 1 | 1 | 2026-04-13 | partial (82/154) |
| syria | 1 | 1 | 1 | 2026-04-13 | partial (86/173) |
| venezuela | 1 | 1 | 1 | 2026-04-13 | 51 events, fully verified (50/51) |
| iran | 1 | 1 | 1 | 2026-04-13 | partial (45/101) |
| israel | 1 | 1 | 1 | 2026-04-13 | partial (47/117) |
| saudi_arabia | 1 | 1 | 1 | 2026-04-13 | partial (41/118) |
| china | 1 | 1 | 1 | 2026-04-13 | partial (104/177) |
| mexico | 1 | 1 | 1 | 2026-04-13 | partial (60/114) |
| turkey | 1 | 1 | 1 | 2026-04-13 | partial (35/52) |
| russia | 1 | 1 | 1 | 2026-04-13 | partial (119/304) |
| spain | 1 | 1 | 1 | 2026-04-13 | 70 events fully verified |
| portugal | 1 | 1 | 1 | 2026-04-13 | 69 events fully verified |
| ecuador | 1 | 1 | 1 | 2026-04-13 | 67 events fully verified |
| hungary | 1 | 1 | 1 | 2026-04-13 | 67 events fully verified |
| czechia | 1 | 1 | 1 | 2026-04-13 | 61 events fully verified |
| el_salvador | 1 | 1 | 1 | 2026-04-13 | 61 events fully verified |
| guatemala | 1 | 1 | 1 | 2026-04-13 | 61 events fully verified |
| nicaragua | 1 | 1 | 1 | 2026-04-13 | 59 events fully verified |
| bosnia_and_herzegovina | 1 | 1 | 1 | 2026-04-13 | 55 events fully verified |
| honduras | 1 | 1 | 1 | 2026-04-13 | 55 events fully verified |
| croatia | 1 | 1 | 1 | 2026-04-13 | 54 events fully verified |
| palestine | 1 | 1 | 0 | 2026-04-13 | 62 events |
| moldova | 1 | 1 | 0 | 2026-04-13 | 52 events |
| latvia | 1 | 1 | 0 | 2026-04-13 | 48 events |
| lithuania | 1 | 1 | 0 | 2026-04-13 | 45 events |
| estonia | 1 | 1 | 0 | 2026-04-13 | 50 events |
| north_macedonia | 1 | 1 | 0 | 2026-04-13 | 45 events |

### Added 2026-04-22 session (#408 expansion + dedup pass on Iran/Ukraine/Venezuela)

Closes #408 face-validity misses by expanding the 3 named countries with WebSearch-grounded events and a follow-up dedup/category-cleanup pass. All new events `verified: true` with real source URLs. Original-event verification status preserved (so totals don't all flip to fully verified).

| Country | Generated | Curated | Verified | Last updated | Notes |
|---------|----------:|--------:|---------:|--------------|-------|
| iran | 1 | 2 | 2 | 2026-04-22 | 146 → 187 (+41 WebSearch-grounded) → 181 after dedup pass; 84/181 verified (39 new verified, 45 from 2026-04-13 partial preserved) |
| ukraine | 1 | 3 | 3 | 2026-04-22 | 43 → 67 → 85 (+18 round 2 breadth via #421; E5 quality bar held, 9 candidates excluded); 82/85 verified |
| venezuela | 1 | 2 | 2 | 2026-04-22 | 51 → 71 (+20, rebalanced toward political_repression / banking_and_financial_crisis / humanitarian_crisis); 70/71 verified |

### Added 2026-04-16 session (38 countries — generated from scratch via Sonnet)

**Batch 1 (5):**

| Country | Generated | Curated | Verified | Last updated | Notes |
|---------|----------:|--------:|---------:|--------------|-------|
| austria | 1 | 0 | 0 | 2026-04-16 | 64 events, generated from scratch |
| belarus | 1 | 0 | 0 | 2026-04-16 | 105 events; auto-fix applied (electoral_fraud → elections_and_voting) |
| jamaica | 1 | 0 | 0 | 2026-04-16 | 63 events |
| kyrgyzstan | 1 | 0 | 0 | 2026-04-16 | 74 events |
| netherlands | 1 | 0 | 0 | 2026-04-16 | 73 events |

**Batch 2 (13):**

| Country | Generated | Curated | Verified | Last updated | Notes |
|---------|----------:|--------:|---------:|--------------|-------|
| panama | 1 | 0 | 0 | 2026-04-16 | 65 events |
| paraguay | 1 | 0 | 0 | 2026-04-16 | 65 events |
| rwanda | 1 | 0 | 0 | 2026-04-16 | 75 events |
| senegal | 1 | 0 | 0 | 2026-04-16 | 65 events |
| serbia | 1 | 0 | 0 | 2026-04-16 | 72 events |
| sweden | 1 | 0 | 0 | 2026-04-16 | 62 events |
| taiwan | 1 | 0 | 0 | 2026-04-16 | 77 events |
| tanzania | 1 | 0 | 0 | 2026-04-16 | 63 events |
| uganda | 1 | 0 | 0 | 2026-04-16 | 65 events |
| uruguay | 1 | 0 | 0 | 2026-04-16 | 67 events |
| uzbekistan | 1 | 0 | 0 | 2026-04-16 | 62 events |
| zambia | 1 | 0 | 0 | 2026-04-16 | 65 events |
| zimbabwe | 1 | 0 | 0 | 2026-04-16 | 73 events |

**Batch 3 (20):**

| Country | Generated | Curated | Verified | Last updated | Notes |
|---------|----------:|--------:|---------:|--------------|-------|
| burkina_faso | 1 | 0 | 0 | 2026-04-16 | 77 events |
| niger | 1 | 0 | 0 | 2026-04-16 | 61 events |
| guinea | 1 | 0 | 0 | 2026-04-16 | 67 events |
| liberia | 1 | 0 | 0 | 2026-04-16 | 64 events; auto-remap applied (4 invalid categories) |
| sierra_leone | 1 | 0 | 0 | 2026-04-16 | 60 events |
| togo | 1 | 0 | 1 | 2026-04-30 | 64 events, fully verified |
| benin | 1 | 0 | 0 | 2026-04-16 | 54 events; auto-remap applied (8 invalid categories) |
| democratic_republic_of_congo | 1 | 0 | 0 | 2026-04-16 | 86 events; auto-remap applied (19 invalid categories) |
| republic_of_congo | 1 | 0 | 0 | 2026-04-16 | 63 events; re-run with strict prompt (first run had 9 invalid categories) |
| botswana | 1 | 0 | 0 | 2026-04-16 | 59 events |
| namibia | 1 | 0 | 0 | 2026-04-16 | 57 events |
| burundi | 1 | 0 | 0 | 2026-04-16 | 63 events |
| south_sudan | 1 | 0 | 0 | 2026-04-16 | 63 events; auto-remap applied (15 invalid categories) |
| guyana | 1 | 0 | 0 | 2026-04-16 | 64 events |
| suriname | 1 | 0 | 0 | 2026-04-16 | 51 events; auto-remap applied (12 invalid categories) |
| bhutan | 1 | 0 | 0 | 2026-04-16 | 56 events; re-run with strict prompt (first run had 13 invalid categories) |
| oman | 1 | 0 | 0 | 2026-04-16 | 58 events |
| gabon | 1 | 0 | 0 | 2026-04-16 | 57 events; auto-remap applied (9 invalid categories) |
| gambia | 1 | 0 | 0 | 2026-04-16 | 50 events |
| djibouti | 1 | 0 | 0 | 2026-04-16 | 43 events |

---

## Aggregate progress (updated 2026-04-16, late afternoon — after Batch 3 + 20 additional countries)

- **Total country JSON files: 178** (was 120 at start of session — +58 today across 3 batches)
- **Total events: ~13,200** (was 9,465 at start of session — +~3,750 today; exact count via audit script)
- **Generated ≥1: 178 / 178**
- **Curated ≥1: ~54 / 178** countries (original 23 + 31 from 2026-04-13 verified batch)
- **Verified ≥1: ~25 / 178** countries (Ukraine + 24 from 2026-04-13)
- **Both curated ≥1 AND verified ≥1: ~25 / 178**
- **Today's net add (2026-04-16): 58 countries / ~3,750 events generated; 100% canonical category compliance after audit + remediation pass**

## Note on the 2026-04-16 batches

The 38 countries added today were **generated from scratch** by Sonnet agents (using the country-specific knowledge + targeted web searches), then immediately written to `curated/` with all `verified: false`. They have NOT been through the E1-E5 cleanup pass that other "curated" countries went through (since they were generated cleanly and didn't have the dedup/merge issues that came from older batch sources). Strict-prompt template (with inline 71-category list + self-validation) caught all category violations during the audit pass.

## Unblock thresholds

- **#141** (event source cutover, batches/ → curated/): requires ≥75/158 countries with both `curated ≥ 1` AND `verified ≥ 1`. Current: ~25/75. Verification campaign needed.

---

## 2026-04-16 (late) — Auto-remap pass on legacy curated files

A scripted remap (`_remap_categories.py`) normalized 327 distinct non-canonical category strings observed in the legacy curated/ corpus onto the canonical 71 Layer 3 codes from `taxonomy_hierarchy.json`.

- **Files audited:** 158
- **Files changed:** 71 (the older batches, generated before strict-prompt template existed)
- **Events remapped:** 3,001 / 11,959 (25.1% → 0%)
- **Events still invalid post-remap:** 0
- **Backups:** `curated/_backup_pre_remap/` (pre-remap snapshots of all 71 changed files)
- **Downstream effect:** salience module re-run (`compute_layered_salience.py`) now reports `skipped_invalid_category: 0` for all 158 countries; per-country salience JSONs in `qgi-frontend/data/salience/` regenerated and copied.
- **Why it matters:** before the remap, ~25% of all events were invisible to salience scoring because their category didn't map to any Layer 1/2/3 path. Post-remap, every event contributes to its proper L1 domain, producing meaningfully differentiated country profiles (e.g. Russia: B/D/F/H all "high"; Austria: A/E "moderate", D "indicative").

## 2026-04-16 (late, after Tier-1 batch) — Catalog now at 173

**Tier-1 batch added 15 countries (939 events) using strict-prompt template:**

| Country | Events | Year range |
|---|---:|---|
| equatorial_guinea | 61 | 1968-2025 |
| brunei | 54 | 1959-2025 |
| papua_new_guinea | 78 | 1975-2025 |
| timor_leste | 69 | 1974-2025 |
| mauritius | 60 | 1968-2025 |
| trinidad_and_tobago | 63 | 1962-2025 |
| bahamas | 54 | 1973-2025 |
| malawi | 71 | 1964-2025 |
| lesotho | 53 | 1966-2025 |
| eswatini | 56 | 1968-2025 |
| fiji | 70 | 1970-2025 |
| kosovo | 70 | 1989-2025 |
| guinea_bissau | 63 | 1973-2025 |
| cabo_verde | 56 | 1975-2025 |
| comoros | 61 | 1975-2025 |

- **15 / 15 files clean on first pass** (0 invalid categories) — strict-prompt template + inlined 71-category list confirmed working at 100%
- **2 minor JSON repairs** needed: `timor_leste.json` and `malawi.json` had agent invoke-tag bleed-through after the closing `]`; both auto-truncated by balanced-bracket parser; no event content lost
- Salience module re-run on full 173 corpus: **12,898 events / 0 skipped (non-canonical)**
- Per-country salience JSONs (174, includes _index.json) copied to `qgi-frontend/data/salience/`

## 2026-04-16 (late) — UN-193 catalog gap audit

Cross-checked the 158 curated country slugs against UN-193 + observers (Vatican, Palestine, Taiwan, Kosovo). **40 sovereigns missing**, split by curation priority:

**Tier 1 — geopolitically relevant, recommended for next batch (15):**
equatorial_guinea, brunei, papua_new_guinea, timor_leste, mauritius, trinidad_and_tobago, bahamas, malawi, lesotho, eswatini, fiji, kosovo, guinea_bissau, cabo_verde, comoros

**Tier 2 — microstates / small islands, lower priority but completes UN-193 (25):**
andorra, monaco, san_marino, liechtenstein, vatican_city (European microstates);
antigua_and_barbuda, barbados, dominica, grenada, saint_kitts_and_nevis, saint_lucia, saint_vincent_and_the_grenadines, belize (Caribbean + Central America);
nauru, palau, marshall_islands, micronesia, kiribati, samoa, solomon_islands, tonga, tuvalu, vanuatu (Pacific);
sao_tome_and_principe, seychelles (small islands)

## 2026-04-27 — 15-country verification batch (target: 150+ verified)

15 Sonnet+WebSearch agents in parallel, each verifying the curated event list of one country (~80 events average). Per-event verdict TRUE / FALSE / PARTIAL with reason + source URL. Results in `qgi-data/events/verification/{country}.json`.

**Aggregate:** 1,201 events verified, 986 TRUE / 202 PARTIAL / 13 FALSE (82.1% TRUE, 16.8% PARTIAL, 1.1% FALSE).

| Country | Generated | Curated | Verified | Last updated | Events | TRUE | PARTIAL | FALSE | TRUE% |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| south_africa | 1 | 1 | 2 | 2026-04-27 | 154 | 149 | 5 | 0 | 96.8% |
| jordan | 1 | 1 | 1 | 2026-04-27 | 106 | 97 | 8 | 1 | 91.5% |
| united_arab_emirates | 1 | 1 | 1 | 2026-04-27 | 105 | 62 | 41 | 2 | 59.0% |
| vietnam | 1 | 1 | 1 | 2026-04-27 | 79 | 71 | 8 | 0 | 89.9% |
| papua_new_guinea | 1 | 1 | 1 | 2026-04-27 | 78 | 70 | 8 | 0 | 89.7% |
| netherlands | 1 | 1 | 1 | 2026-04-27 | 73 | 56 | 17 | 0 | 76.7% |
| malawi | 1 | 1 | 1 | 2026-04-27 | 71 | 66 | 5 | 0 | 93.0% |
| malaysia | 1 | 1 | 1 | 2026-04-27 | 71 | 53 | 16 | 2 | 74.6% |
| germany | 1 | 1 | 1 | 2026-04-27 | 69 | 57 | 12 | 0 | 82.6% |
| timor_leste | 1 | 1 | 1 | 2026-04-27 | 69 | 61 | 8 | 0 | 88.4% |
| paraguay | 1 | 1 | 1 | 2026-04-27 | 68 | 45 | 23 | 0 | 66.2% |
| guinea | 1 | 1 | 1 | 2026-04-27 | 67 | 48 | 16 | 3 | 71.6% |
| zambia | 1 | 1 | 1 | 2026-04-27 | 65 | 51 | 13 | 1 | 78.5% |
| liberia | 1 | 1 | 1 | 2026-04-27 | 64 | 50 | 10 | 4 | 78.1% |
| palestine | 1 | 1 | 1 | 2026-04-27 | 62 | 50 | 12 | 0 | 80.6% |

**Cumulative:** verified country count is now **104 / 197 curated (53%)**. Per founder direction (memory `feedback_pipeline_run_threshold.md`): need **150+ verified** before next full pipeline run; **46 more verifications still required** (~3 more rounds of 15-agent batches).

**Notable findings:**
- South Africa is the gold-standard curation in this batch (96.8% TRUE on 154 events).
- UAE has the worst verification rate (59% TRUE / 39% PARTIAL) — heavy date-drift; flag for re-curation.
- Liberia has the most outright fabrications/wrongness (4 FALSE on 64 events / 6.3%).
- Most PARTIAL verdicts are date drifts off-by-1-to-3-years rather than wrong events. Pattern: curators correctly identified events but reached for approximate dates.
- Jordan despite the 2026-04-07 fabricated-flags incident — the underlying CONTENT is mostly correct; only the prior agent's claimed verifications were lies.

## 2026-04-27 — 6-country verification batch (geopolitically prioritized)

6 Sonnet+WebSearch agents in parallel, each verifying one geopolitically significant unverified country. Results in `qgi-data/events/verification/{country}.json`.

**Aggregate:** 348 events verified, 287 TRUE / 57 PARTIAL / 4 FALSE (82.5% TRUE, 16.4% PARTIAL, 1.1% FALSE).

| Country | Generated | Curated | Verified | Last updated | Events | TRUE | PARTIAL | FALSE | TRUE% |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| greece | 1 | 1 | 1 | 2026-04-27 | 65 | 55 | 10 | 0 | 84.6% |
| austria | 1 | 1 | 1 | 2026-04-27 | 64 | 50 | 11 | 3 | 78.1% |
| sweden | 1 | 1 | 1 | 2026-04-27 | 62 | 49 | 13 | 0 | 79.0% |
| poland | 1 | 1 | 1 | 2026-04-27 | 59 | 50 | 8 | 1 | 84.7% |
| kazakhstan | 1 | 1 | 1 | 2026-04-27 | 53 | 45 | 8 | 0 | 84.9% |
| singapore | 1 | 1 | 1 | 2026-04-27 | 45 | 38 | 7 | 0 | 84.4% |

**Cumulative:** verified country count is now **110 / 197 curated (56%)**. **40 more verifications still required to cross the 150-mark threshold** (memory: feedback_pipeline_run_threshold.md). ~3 more 15-agent rounds.

## 2026-04-30 — Turkmenistan single-country verification (canonical re-run)

Replaces an earlier incorrect-workflow pass. Full 39-event re-verification from scratch via WebSearch.

| Country | Generated | Curated | Verified | Last updated | Events | TRUE | UNCERTAIN | FALSE | TRUE% |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| turkmenistan | 1 | 1 | 1 | 2026-04-30 | 39 | 32 | 4 | 3 | 82.1% |

**Notable FALSE flags:**
- 2008 constitution described as creating a "bicameral legislature" — factually wrong; the 2008 constitution dissolved the Halk Maslahaty and produced a unicameral Mejlis (bicameral didn't come until 2020).
- 2025 Freedom House event claims score of "2 out of 100" and ranks Turkmenistan "below North Korea" — actual score is 1/100; North Korea scored 3/100 so the directional comparison is inverted.

**Notable UNCERTAIN flags:**
- 2004 dual citizenship event: protocol signed April 2003, not 2004; implementation contested through 2010.
- 2009 Galkynysh "second largest" confirmation: 2008 audit ranked it 4th-5th; the second-largest confirmation came from 2011-2013 audits.
- 2021 Berdimuhamedow "Hero for a third time": Arkadag/parliamentary chairmanship confirmed; third Hero medal unverified in accessible sources.

**Cumulative verified: 111 / ~197 curated (56%).**

**Notable findings:**
- Austria has the worst verification rate in this batch (78.1% TRUE / 4.7% FALSE) — joins Liberia and Guinea as countries with notable curation problems. 4 outright FALSE entries warrant a re-curation pass (similar to UAE, #499).
- Greece, Kazakhstan, Singapore, Poland all at 84%+ TRUE — clean curations with mostly off-by-1-year date drifts on PARTIAL.
- Pattern across both 2026-04-27 batches (15 + 6 = 21 countries): curators get events RIGHT, dates approximate. Date drift consistently dominates PARTIAL verdicts.

## 2026-04-30 — Mauritania canonical verification (42 events, re-run from scratch)

Single Sonnet+WebSearch canonical verification pass on all 42 curated Mauritania events, replacing the deprecated inline-flag workflow. Every event web-searched at least once; results in `qgi-data/events/verification/mauritania.json`.

| Country | Generated | Curated | Verified | Last updated | Events | TRUE | UNCERTAIN | FALSE | TRUE% |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| mauritania | 1 | 1 | 1 | 2026-04-30 | 42 | 37 | 5 | 0 | 88.1% |

**Cumulative verified: 112 / ~197 curated (57%).**

**Notable findings (Mauritania):**
- The 2000 "Failed Coup" (UNCERTAIN): no contemporaneous sources confirm a June 2000 coup attempt; the major documented attempt was June 2003. Likely a year attribution error in curation.
- The 2011 "Nema suicide bombing in February 2011" (UNCERTAIN): the Nema barracks car bomb was August 2010; the last AQIM attack inside Mauritania was a December 2011 kidnapping in Adel Bagrou, not a February 2011 bombing in Nema.
- The 2014 "IRA 13 members sentenced to up to 15 years" (UNCERTAIN): this matches a 2016 incident; the 2014 Biram arrest resulted in 2-year sentences issued January 2015.
- The 2015 drought "600,000 food insecure" (UNCERTAIN): general food crisis pattern confirmed but the exact 600,000 figure for 2015 specifically is unverified.
- The 2023 drought "900,000 food insecure" (UNCERTAIN): 2023 Harmonized Framework estimated closer to 500,000 for Mauritania's lean season; 900,000 not confirmed.
- No outright FALSE events: all 42 events are either genuinely verified (TRUE) or have uncertain/misattributed details (UNCERTAIN). Mauritania's curated events are factually real; the UNCERTAIN flags are year/detail attribution errors, not fabrications.

## 2026-04-30 — Slovenia verification (single country, Balkans/EU-success-story push)

1 Sonnet+WebSearch agent verifying all 42 curated Slovenia events. Results in `qgi-data/events/verification/slovenia.json`.

**Aggregate:** 42 events verified, 41 TRUE / 0 FALSE / 1 UNCERTAIN (97.6% TRUE, 0% FALSE, 2.4% UNCERTAIN).

| Country | Generated | Curated | Verified | Last updated | Events | TRUE | FALSE | UNCERTAIN | TRUE% |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| slovenia | 1 | 1 | 1 | 2026-04-30 | 42 | 41 | 0 | 1 | 97.6% |

**Cumulative verified: 113 / ~197 curated (57%).**

**Notable findings:**
- Slovenia is the cleanest curation in the entire verification campaign (97.6% TRUE on 42 events), surpassing South Africa (96.8%).
- No outright FALSE verdicts: every event describes a real occurrence correctly attributed to Slovenia.
- 1 UNCERTAIN verdict: 2025 NLB privatization completion — the state has held 25%+1 share since the 2018-2019 IPO and no confirmed sub-25% divestiture was found in searches; claim unverifiable.
- Patria conviction year 2014 labelled TRUE with clarification: original conviction June 2013, confirmed by higher court April 2014; curated year is defensible.
- Refugee route numbers (2015): sources vary from 419,000 to 477,000 transiting; "nearly half a million" is accurate.
- Water right amendment (2016): correctly stated as first EU country to enshrine drinking water access in constitution in this specific manner.

## 2026-04-30 — Togo canonical verification (64 events, West Africa autocratic-continuity push)

Single Sonnet+WebSearch canonical verification pass on all 64 curated Togo events. Every event web-searched at least once. Results in `qgi-data/events/verification/togo.json`.

| Country | Generated | Curated | Verified | Last updated | Events | TRUE | UNCERTAIN | FALSE | TRUE% |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| togo | 1 | 0 | 1 | 2026-04-30 | 64 | 56 | 4 | 4 | 87.5% |

**Cumulative verified: 114 / ~197 curated (58%).**

**Notable FALSE flags:**
- 2008 "EU Aid Resumes": EU aid resumed in 2007, not 2008; 14-year suspension (1993-2007) is accurate but year is wrong.
- 2019 "Legislative Elections — UNIR Retains Supermajority": elections held December 20, 2018 (not 2019); confirmed by IPU Parline.
- 2016 "West Africa's Largest Solar Plant Opens Near Lomé": plant opened June 2021 in Blitta (267 km from Lomé), built by AMEA Power with West African/Abu Dhabi financing — not EIB-financed and not 2016.
- 2019 "Togo Elected to UN Security Council Non-Permanent Seat": Togo's Security Council term was 2012-2013 (elected October 2011), not 2020-2021 as stated.
- 2018 "Constitutional Amendment Offers Prospective Term Limits": vote was May 2019, not 2018; description accurate otherwise.
- 2021 "State of Emergency Declared in Savanes Region": formal state of emergency declared June 2022, not 2021.

**Notable UNCERTAIN flags:**
- Wagner Group contacts (2022): no credible sourced reporting found.
- Phosphate exports "highest in a decade" (2023): surge confirmed but decade-high claim unverifiable.
- ECOWAS/AU criticism of 2024 constitutional reform: criticism was mild and both bodies ultimately commended the April 2024 elections.
- High Commission for Human Rights 1991: specific institution not confirmed in available sources.

---

## Reconciliation 2026-04-30 (end-of-day)

Verified-file count on disk vs prior cumulative tracking lines diverged because the 40 stranded files from earlier today's batch were never committed (rescued tonight in PR #6). The cumulative lines above reflect agents' partial views.

**Reconciled cumulative: 154 / ~197 curated (78%).**

Composition:
- 110 pre-rescue, already committed
- +40 stranded files rescued in PR #6 (commit `12a87ed3`)
- +4 from tonight's canonical batch: Mauritania (37/5/0), Turkmenistan (32/4/3), Slovenia (41/0/1), Togo (56/4/4)

Threshold status: 154 ≥ 150 ✓ (per `feedback_pipeline_run_threshold.md`). Pipeline-run unblock-conditions remain satisfied.
