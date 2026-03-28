# QGI — Open Questions

> Answered questions are moved to the relevant doc. Only unresolved questions live here.
> Last updated: 2026-03-28

---

## Product / Business

**Q1. What does #17 qgi-api-cost-ticker do?**
"Cost ticker" could mean: (a) pipeline operational cost tracking (internal), (b) a "geopolitical cost" ticker (human/economic cost of events), or (c) something else. Needs clarification to know if this issue is still relevant given the Recipes direction.

**Q2. What are the 1-year and 3-year goals for QGI?**
Needed for: strategic prioritisation of engineering work.

---

## Recipes pipeline

**Q3. How do you define "end of a pattern" for event mapping?**
In the Saudi-Azeri example, the pattern ends at 2016 for Saudi and 2021 for Azerbaijan. What time window counts as "at the end"? E.g., within 1 year of `start_year + length`? Within 2 years?
Needed for: Recipe-building algorithm design.

**Q4. Does a Recipe require BOTH countries to have the same event type, or just one?**
In the Saudi-Azeri example, both ended in military conflict. Is "both countries" a hard requirement, or can a recipe fire if only one country had the event?
Needed for: Recipe matching algorithm.

**Q5. What is the minimum number of pattern instances for a Recipe to be considered statistically valid?**
E.g., must at least 5 country pairs have independently ended in "Military Conflict" before that Recipe is trusted?
Needed for: Recipe confidence scoring.

**Q6. How do you envision collecting country events?**
Options: (a) AI-generated in bulk (Claude/Gemini reads historical records), (b) third-party events API (GDELT, ACLED), (c) manual curation, (d) hybrid.
Needed for: events collection pipeline design.

**Q7. For Recipe matching against current patterns — how "current" is current?**
With indicator completion (self-prediction), patterns can extend to today. But how do you handle the uncertainty of predicted values when generating Recipe alerts? E.g., "80% confidence" based on how far the prediction extends?
Needed for: alert/confidence scoring design.

---

## Architecture

**Q8. Should Phase 1 hard waits (21 min workers, 60 min Pattern workers) be replaced with completion callbacks?**
Hard waits waste time when workers finish early. Alternative: track completion via DynamoDB counter (decrement per completed worker, trigger next phase when zero). Worth redesigning in the rebuild?

**Q9. Country name normalization strategy for multi-source ingestion**
Each new source uses different country identifiers. `countries.csv` has `alpha_2`, `alpha_3`, `numeric_code`, and 20 alternate name columns. Strategy: use ISO codes as primary key for normalization where available, with a per-source override table for mismatches?
Needed for: multi-source Phase 1 design.

**Q10. Indicator completion — where in the pipeline does it run?**
Options: (a) Phase 1.5 — immediately after Phase 1 ingest, before Phase 2 Batch; (b) separate monthly job that runs ahead of the main pipeline; (c) on-demand at query time.
The simpler answer is (a) — integrate into the existing Step Functions before Phase 2.

**Q11. What is the actual current volume of SCDIs and Patterns in S3?**
Run these and report back:
\`\`\`sql
SELECT COUNT(*) FROM qgi_data.scdis;
SELECT COUNT(*) FROM qgi_data.patterns;
\`\`\`
Needed for: understanding whether the knowledge extraction layer needs big-data tooling or Athena is sufficient.

---

## Data

**Q12. Can existing SCDI and Pattern data in S3 be discarded when the Terraform rebuild runs?**
The rebuild will recompute everything from scratch. Is the current data in `pipeline-B-scdi-finder/scdis/` and `pipeline-C-pattern-synthesizer/output/` worth preserving, or can it be recomputed?
