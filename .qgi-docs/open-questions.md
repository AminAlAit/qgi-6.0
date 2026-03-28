# QGI — Open Questions

> This file tracks architectural, product, and strategic questions that block design decisions.
> When answered, move the answer to the relevant doc and remove from here.
> Last updated: 2026-03-28

---

## Product / Business (high priority — blocks knowledge extraction design)

**Q1. What does QGI stand for?**
Needed for: business-context.md, all public-facing docs.

**Q2. What is the product in one sentence, and who is the intended customer?**
Is this: (a) a personal research tool for Amin, (b) a B2B data/intelligence product, (c) a public platform, (d) something else?
Needed for: business-context.md, prioritising the API layer (#15, #16, #17).

**Q3. What does a "Pattern" mean to a human analyst?**
Give an example: "Country A did X between years T1 and T2, and Country B did the same thing M years later, across N indicators. What does that tell us?"
Needed for: knowledge extraction design, API design, frontend design.

**Q4. What are your ideas for knowledge extraction (Phase 6+)?**
You mentioned you have several ideas. Even rough ones:
- Ranking algorithms? (e.g. top-10 predictive country pairs globally)
- Regime-change detection? (pattern breakdown signals)
- Investment/risk signals?
- Historical narrative generation? (e.g. "Country A in 1990 looks like Country B in 2024")
Needed for: Phase 6 architecture, deciding whether ML is involved.

**Q5. Who consumes the website-facing APIs (#15, #16, #17)?**
"Pattern of week", "cost ticker", "pipeline status" — for whom? Internal dashboard? Public website? Clients?
Needed for: API design, authentication requirements.

---

## Architecture (medium priority — blocks Terraform rebuild details)

**Q6. How many Batch jobs typically ran per monthly execution?**
Specifically: on a typical month, how many indicators get updated (have new World Bank data)?
If typically 5–10 indicators are updated, that's 1,300–2,600 Batch jobs per run.
Needed for: correct instance type and concurrency sizing in Terraform.

**Q7. What is the typical Batch job duration per country?**
Each job (one indicator × one country_a) runs FFT cross-correlation against 259 country_b's.
Even a rough estimate ("under 5 minutes", "5–30 minutes") matters for cost modelling.
Needed for: instance type selection, concurrency limits.

**Q8. Should Phase 1 hard waits (21 min for workers, 60 min for Pattern workers) be replaced?**
They waste time when workers finish early. Better approach: track completion via DynamoDB counter or Step Functions callbacks. Is this worth doing in the rebuild, or keep simple waits?
Needed for: Step Functions redesign decision.

**Q9. Country name resolution strategy for multi-source ingestion**
When a new source uses ISO codes or different country names, how do we map to `countries.csv`?
Options: (a) per-source lookup table in S3, (b) ISO alpha-2/3 column in countries.csv already exists — use it, (c) fuzzy matching Lambda.
Needed for: multi-source Phase 1 design.

**Q10. What happens to the `qgi-pipeline-c-poc` Lambda?**
It's a prototype of Pipeline C with combined dispatcher+worker. References non-existent `countries_parquet` table. Safe to delete after rebuild confirms Production Pipeline C is solid?
Current answer: yes, pending rebuild.

---

## Data (lower priority — can be answered during rebuild)

**Q11. Is `indicator_map.csv` currently manually maintained or auto-generated?**
Confirmed: consumed by `scdi_finder.py`. Should be auto-generated from xlsx.
Action: create issue to generate it in Pipeline A rather than maintaining manually.

**Q12. Should the `countries` Glue table be migrated to Parquet?**
Currently backed by CSV. Parquet would be faster and cheaper for Athena queries (Pattern synthesis queries join on countries).
The PoC Lambda (`qgi-pipeline-c-poc`) references a `countries_parquet` table that doesn't exist — was this the intent?

**Q13. Are there SCDIs or Patterns currently in S3 that are worth keeping?**
When the Terraform rebuild deploys and the new pipeline runs for the first time, it will recompute everything from scratch. Is the existing data in `pipeline-B-scdi-finder/scdis/` and `pipeline-C-pattern-synthesizer/output/` worth preserving or can it be recomputed?
