# QGI — Architectural Decisions

> Records of key technical decisions, the reasoning behind them, and what was considered.
> Future contributors: read this before proposing changes to core algorithms.
> Last updated: 2026-03-28

---

## D1 — Correlation algorithm: Pearson with within-segment Z-scoring (no pre-normalisation)

**Decision:** Use Pearson correlation with Z-score normalisation applied within each segment (as implemented in `scdi_finder.py`). Do not apply first-differencing, log transformation, or global standardisation to indicator values before computing correlations.

**Rationale:**
Pearson correlation is mathematically scale-invariant. Comparing China's GDP ($15T) to Tuvalu's GDP ($40M) produces a valid correlation regardless of the magnitude difference — the scale cancels out in the formula.

`scdi_finder.py` already Z-score normalises segment A (`norm_segment_a = (segment_a - mean_a) / std_a`) and uses rolling mean/std for segment B, implementing the correct numerically stable Pearson formula. The algorithm asks: *"did both countries experience similar relative trajectories within this time window?"* — not "did they have similar absolute values."

**What was considered and rejected:**
- **First-differencing** (compare year-over-year changes): removes trend noise but breaks trajectory-shape matching. The Saudi-Azeri pattern value comes from sustained 5-year arcs, not year-on-year jumps. First-differencing would destroy Recipes signal.
- **Log transformation** of absolute-value indicators: unnecessary because within-segment Z-scoring already handles scale. Would add complexity with no accuracy gain.
- **Global standardisation** (Z-score across all countries/years for an indicator): changes the meaning of the correlation and makes cross-indicator comparisons less intuitive.

**Risk to watch:** Spurious correlations from shared global trends (e.g., both China and Tuvalu have upward GDP trend → high correlation within any 5-year window). Mitigated by the minimum correlation threshold (0.5) and the requirement for patterns to span multiple indicators (`indicator_count`). Future option: add a detrending step if spurious pattern rates prove high.

---

## D2 — Indicator completion: self-prediction only

**Decision:** When completing indicator values for years that have not yet been published by the source, use self-prediction only (each indicator's own time series predicts its own missing values). Do not use other indicators to predict a given indicator's values.

**Rationale:**
Cross-indicator prediction would introduce circular dependencies between SCDIs and the input data. If Indicator X is predicted using Indicator Y, and then we compute SCDIs between countries on both X and Y, the correlation results would be artificially inflated. Self-prediction avoids this contamination.

**Flagging:** Predicted values must carry `is_predicted = True` in storage. Any SCDI or Pattern computed from predicted values must carry `contains_predicted = True`. The frontend must display predicted values distinctly.

---

## D3 — Countries table: S3 Parquet + Glue, not DynamoDB

**Decision:** Store the canonical countries reference table as Parquet in S3, backed by a Glue table (`qgi_data.countries`). Do not migrate to DynamoDB.

**Rationale:**
- 260 rows, read-only, read in bulk at the start of each Batch job. Parquet in S3 is cheaper and faster for this pattern.
- DynamoDB adds cost and latency for a use case that doesn't need point lookups.
- Already works as a Glue table and is queried by Athena in Phase 4.

**Multi-source normalisation:** A separate `country_name_aliases` table (also S3 Parquet) maps `{source}_{name_or_code}` → `canonical_country_id` for each data source. Primary canonical name = `name_1` column (most widely known form, e.g. "France" not "Republic of France").

---

## D4 — Recipe event window: ±1 year, scaled for longer patterns

**Decision:** A Recipe is triggered when both Country A and Country B experience a matching event within `max(1, ceil(pattern_length × 0.15))` years after their respective segment ends.

**Examples:**
- Length 5: ±1 year window
- Length 10: ±2 year window
- Length 20: ±3 year window

**Rationale:**
Geopolitical events rarely follow indicator patterns with exact-year precision. A small tolerance window captures near-term consequences without becoming too loose. The 15% scaling is conventional in event studies; the minimum of 1 year ensures short patterns still have a tolerance.

**Tunable:** This parameter can be adjusted empirically as the Recipe corpus grows.

---

## D5 — Recipe validity: both countries must match the event type

**Decision:** A Recipe instance is only counted when BOTH Country A AND Country B experienced the matching event type within the tolerance window (D4).

**Rationale:** Requiring both countries strengthens the causal claim. If only one country ends in "Military Conflict," the pattern may be coincidental for the other country.

**Future option:** Introduce "strong recipe" (both match) and "weak recipe" (one match) tiers as the corpus grows and empirical thresholds become clear.

---

## D6 — Phase 1 completion waits: DynamoDB counter, not hard waits

**Decision:** Replace Step Functions hard waits (21 min for Phase 1 workers, 60 min for Phase 4 workers) with DynamoDB-based completion counters.

**Pattern:**
1. Dispatcher writes total worker count to DynamoDB (`run_{id}_workers_remaining = N`)
2. Each worker decrements the counter atomically on completion
3. The last worker to decrement (counter = 0) triggers the next Step Functions state via a callback token

**Rationale:** Hard waits waste time when workers finish early (common case). They also mask failures — a Phase 1 worker could have all failed silently but the pipeline would still proceed after 21 minutes. Counter-based completion is both faster and safer.

**Not yet implemented:** Build in Terraform rebuild.
