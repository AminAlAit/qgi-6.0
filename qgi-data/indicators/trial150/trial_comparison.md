# Trial 150 — Opus-direct vs Sonnet+WebSearch comparison

**Scope:** 20 FAOSTAT indicators, mirror of the WB catalog schema.
**Winner:** Hybrid (see recommendation below).

## Side-by-side

| Dimension | Opus-direct | Sonnet+WebSearch |
|---|---|---|
| Wall time | ~4 min | ~5–10 min (async) |
| Tool calls | 0 | ~4 web calls (datasets_E.xml, OWID ETL docs, UN Data, Land Portal) |
| Distinct FAOSTAT domains | 10 (FS, FBS, QCL, TCL, CP, RL, RFN, GLW, GT, FI) | 6 (QCL, RL, RFN, FS, FBS, TCL) |
| Distinct categories | 5 (Food Security, Agriculture, Trade, Economic, Land Use, Environment) | 3 (Agriculture, Food Security, Trade) |
| ID format | `FAOSTAT.QCL.15.5510` (wrong — bogus prefix, dropped leading zeros) | `QCL.0015.5312` (native FAOSTAT format ✅) |
| Verified IDs? | No (explicitly flagged as draft) | Yes — 3 external sources cited |
| Includes livestock | ✅ cattle stocks (GLW) | ❌ |
| Includes forestry | ✅ forest area (RL.6650) | ❌ |
| Includes emissions | ✅ agri GHG (GT) | ❌ |
| Includes fisheries | ✅ fish production (FI) | ❌ |
| Includes food CPI | ✅ (CP) | ❌ |
| Number of cereal-crop rows | 2 (wheat, rice) | 5 (wheat area, wheat prod, wheat yield, rice prod, maize prod) |
| Number of fertilizer rows | 1 (N only) | 3 (N, P, K) |
| Number of land-use rows | 2 (ag land + arable) | 3 (arable + cropland + pastures) |

## Quality axes

### 1. ID correctness — **Sonnet wins decisively**
Opus's id_strings have two systematic errors:
- Bogus `FAOSTAT.` prefix that doesn't exist in FAOSTAT's native format
- Dropped leading zeros on item codes (`15` instead of `0015`, `27` instead of `0027`)

Sonnet's IDs match FAOSTAT's canonical pattern (`QCL.0015.5312`) and were cross-checked against three external sources.

For the actual deliverable these IDs need to be directly usable — **Opus IDs would fail at the fetcher adapter layer**.

### 2. Selection judgment — **Opus wins**
Opus's set is more diverse and better gap-fills WB:
- Sonnet's 5 cereal rows (wheat area, wheat prod, wheat yield, rice prod, maize prod) are **heavily auto-correlated** — a wheat-area drop predicts wheat-production drop ~99% of the time. For SCDI (Pearson distance) this is wasted signal.
- Sonnet's 3 fertilizer rows (N, P, K) similarly move together in most countries. Opus kept just N and spent the other two slots on livestock + fisheries + emissions + food CPI.
- Opus caught the WB overlap risk explicitly (`AG.PRD.FOOD.XD` already covers aggregate food production) and deliberately avoided the FAOSTAT equivalent. Sonnet partially ignored this and loaded up on raw-production rows.

Opus's set would produce more **independent signal** in the SCDI engine. Sonnet's set has more redundancy.

### 3. Description quality — **Tie**
Both are accurate, 1-2 sentence, state the unit, tie to QGI use cases. Sonnet is slightly more technical (cites element codes inline in text). Opus is slightly more narrative (Arab Spring reference, maritime dispute framing).

### 4. Category discipline — **Sonnet wins**
Ticket says "Be conservative about adding new categories." Sonnet added 2 (Agriculture, Food Security). Opus added 4 (Agriculture, Food Security, Land Use, plus used Environment). Sonnet closer to the spec.

### 5. Rigor — **Sonnet wins**
Verification URLs, explicit rejected-candidate list with reasons, noted edge cases (FBS 2010+ cutoff, FBSH crosswalk needed for historical depth). Opus did none of this verification work.

## Recommendation for the full ticket

Neither track wins outright. The highest-quality approach is a **two-stage pipeline**:

### Stage 1 — Opus does selection (no tool calls)
- Given the QGI context + existing WB 60-process catalog + SCDI correlation-avoidance constraint, Opus produces a candidate list of ~200 FAOSTAT indicators with:
  - Which of the ~200 should be `status=process` (the top ~25)
  - Category assignments (conservative — reuse WB vocab where possible)
  - Draft descriptions
  - Placeholder id_strings with best-effort DOMAIN.ITEM.ELEMENT (marked as unverified)

### Stage 2 — Sonnet+WebSearch verifies IDs
- For each of the ~200 draft indicators, Sonnet (or equivalent WebSearch-capable agent) looks up the real FAOSTAT metadata and:
  - Corrects the id_string to native format (leading zeros, no bogus prefixes)
  - Confirms the item code and element code map to the named indicator
  - Flags any indicator that doesn't actually exist in the live catalog
  - Returns a corrected JSON + a diff log of what changed

### Why split it
- Opus's strength is coherent cross-domain selection judgment, which is where the SCDI correlation problem bites. A WebSearch-driven selection tends to over-index on whatever's most documented (cereals, fertilizers) and creates the correlation redundancy we saw.
- Sonnet's strength is parallel fact-checking. WebSearch fan-out scales linearly with indicator count, and correcting an ID is a narrow, well-defined task.
- Doing both = good selection + correct IDs. Doing either alone = one or the other.

### Budget for full ticket
- Stage 1 (Opus selection for FAOSTAT + ILOSTAT): ~20 min
- Stage 2 (Sonnet verification, fan-out 5 agents × 40 indicators each per provider): ~20 min per provider, parallelizable
- Human review + final XLSX generation: 10–20 min
- **Total: ~1 hour for both providers, most of it async**

## Deliverables produced in this trial

- `opus_faostat_20.json` — 20 indicators, diverse set, unverified IDs
- `opus_report.md` — method, gaps, rejected alternatives, tradeoffs
- `sonnet_faostat_20.json` — 20 indicators, narrower set, verified IDs
- `sonnet_report.md` — verification sources, tradeoffs, rejected alternatives
- `trial_comparison.md` — this file

## Next step

Get user sign-off on the hybrid two-stage approach, then proceed to the full ticket. If the user disagrees on the correlation-redundancy critique of the Sonnet set, we could instead go straight with Sonnet+WebSearch for both stages (faster but more redundant catalog).
