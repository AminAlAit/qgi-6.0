# QGI Pipeline — Technical Architecture

> Last updated: 2026-03-28
> All resources are in `eu-central-1`, management AWS account `111111111111`.
> **DO NOT modify production resources** until Terraform rebuild is verified.

---

## Overview

The QGI pipeline is a monthly batch intelligence pipeline. It runs on the 1st of every month at 06:00 Europe/Berlin, triggered by an EventBridge Scheduler schedule (`qgi-indicator-monthly-updater-1st`, currently DISABLED during Terraform migration).

The pipeline is orchestrated by a Step Functions state machine (`qgi-indicator-monthly-updater`) and proceeds through 6 phases (0–5).

---

## Data flow

```
[EventBridge Scheduler]
        │
        ▼
[Step Functions: qgi-indicator-monthly-updater]
        │
        ├── Phase 0: Hygiene
        │   └── Lambda: qgi-pipeline-ops-janitor
        │       Cleans up previous run artifacts
        │
        ├── Phase 1: Ingest
        │   ├── Lambda: qgi-pipeline-a-sheet-fetcher
        │   │   Reads indicator config from S3 (xlsx/indicator_map.csv)
        │   │   Fetches full historical series from World Bank API
        │   │   Writes: s3://qgi-data-lake/pipeline-A-indicator-extractor/output/csv/{indicator_id}/{indicator_id}.csv.gz
        │   │
        │   ├── Lambda: qgi-pipeline-a-dispatcher
        │   │   Fans out one SQS message per (indicator × country) to qgi-pipeline-a-main-queue
        │   │
        │   ├── [Wait: 21 minutes — hard wait for workers to finish]
        │   │
        │   ├── Lambda: qgi-pipeline-a-reporter (+ workers via SQS)
        │   │   Workers: qgi-pipeline-a-worker, qgi-pipeline-a-indicator-extractor
        │   │   Reporter: checks qgi-indicator-updates DynamoDB, returns updated_count + updated_ids
        │   │
        │   └── Decision: updated_count > 0? → Phase 2 : Phase 5
        │
        ├── Phase 2: Compute (SCDI)
        │   ├── Lambda: qgi-pipeline-b-scdi-finder-batch-orchestrator
        │   │   Launches one AWS Batch job per (updated_indicator × country_a)
        │   │   e.g. 10 updated indicators × 260 countries = 2,600 jobs
        │   │
        │   ├── Batch job: scdi-finder (Docker, Graviton Spot, 2vCPU/4GB per job)
        │   │   Per job: one indicator, one country_a vs all country_b
        │   │   Algorithm: FFT cross-correlation (scipy), ProcessPoolExecutor across all CPUs
        │   │   Checkpointing: writes partial results to s3://.../pipeline-B-scdi-finder/tmp/
        │   │   Output: s3://.../pipeline-B-scdi-finder/scdis/country_a_id={id}/{indicator_id}.parquet
        │   │
        │   └── [Poll loop: Lambda qgi-pipeline-ops-batch-checker, every 30 min]
        │
        ├── Phase 3: Discovery (Glue Crawler)
        │   ├── Starts Glue crawler: qgi-scdis-partition-finder
        │   │   Scans pipeline-B-scdi-finder/scdis/ and registers new Hive partitions
        │   │   in Glue table: qgi_data.scdis
        │   └── [Poll loop: check crawler state every 5 min]
        │   NOTE: Candidate for replacement with MSCK REPAIR TABLE (see #TODO)
        │
        ├── Phase 4: Synthesis (Patterns)
        │   ├── Lambda: qgi-pipeline-c-dispatcher
        │   │   Queries qgi_data.countries (Glue table, backed by countries.csv in S3)
        │   │   Cleans old patterns from S3 + drops qgi_data.patterns Glue table
        │   │   Creates empty partitioned shell table
        │   │   Fans out one SQS message per country to qgi-pipeline-c-main-queue
        │   │
        │   ├── [Wait: 60 minutes — hard wait for workers to finish]
        │   │
        │   ├── Lambda: qgi-pipeline-c-worker (triggered by SQS)
        │   │   Per message: one country_a
        │   │   Runs Athena INSERT query: GROUP BY country_pair + lag params
        │   │   Reads from: qgi_data.scdis (Parquet, Hive-partitioned)
        │   │   Writes to: s3://.../pipeline-C-pattern-synthesizer/output/data/country_a_id={id}/
        │   │
        │   └── Athena: MSCK REPAIR TABLE patterns (registers new partitions)
        │
        └── Phase 5: Ops Report
            └── Lambda: qgi-pipeline-ops-dlq-scanner
                Scans all DLQs, reports failed messages
```

---

## Data model

### Indicators
Sourced from external APIs/files. Currently: World Bank only.
- Control surface: `Pipeline A Dispatcher World Bank Indicators.xlsx` (S3 + local)
- 260 total indicators; 50 active ("process"), 210 on hold
- Stored as: `{indicator_id}/{indicator_id}.csv.gz` — columns: `country, year, value`
- Indicator map: `indicator_map.csv` — maps `indicator_id_string` → `indicator_numeric_id` (consumed by scdi_finder; should be auto-generated from xlsx)

### Countries
- 260 countries in `countries.csv` (S3)
- Glue table: `qgi_data.countries` (backed by same S3 path)
- Has numeric `id`, `name_1` (primary name), `alpha_2`, `alpha_3`, `numeric_code`, + alternate names

### SCDIs (Single Dyadic Correlating Indexes)
One SCDI = a statistically significant correlation between Country A's indicator time series and Country B's time series at a given lag.

| Field | Type | Description |
|-------|------|-------------|
| country_a_id | uint16 | Country whose past is the predictor |
| country_b_id | uint16 | Country whose future is predicted |
| length | uint16 | Length of the correlated segment (years) |
| start_year_a | uint16 | Start year of Country A's segment |
| start_year_b | uint16 | Start year of Country B's segment |
| correlation | float32 | Pearson correlation coefficient (≥ 0.5 threshold) |
| indicator_numeric_id | uint16 | Which indicator this SCDI is from |

- Storage: Parquet, Hive-partitioned by `country_a_id`
- Location: `s3://qgi-data-lake/pipeline-B-scdi-finder/scdis/country_a_id={id}/{indicator_id}.parquet`
- Glue table: `qgi_data.scdis`

### Patterns
Aggregation of SCDIs per country pair, summarising how strongly Country A's history predicts Country B's future across all indicators and segment lengths.

| Field | Type | Description |
|-------|------|-------------|
| country_a_id | smallint | Predictor country |
| country_b_id | smallint | Predicted country |
| length | smallint | Segment length |
| start_year_a | smallint | Country A segment start |
| start_year_b | smallint | Country B segment start |
| indicator_count | bigint | How many indicators contribute to this pattern |
| avg_correlation | double | Average correlation across contributing indicators |
| pattern_power_score | double | `avg_correlation × length × indicator_count` |
| indicator_numeric_ids | — | Which indicators contribute (see pattern_indicator_map) |

- Storage: Parquet, Hive-partitioned by `country_a_id`
- Location: `s3://qgi-data-lake/pipeline-C-pattern-synthesizer/output/data/country_a_id={id}/`
- Glue table: `qgi_data.patterns`

### Knowledge extraction layer (not yet built)
`[TBD]` — See [open-questions.md](open-questions.md)

---

## Infrastructure

### Compute
- **AWS Batch** — Graviton Spot, compute env: `qgi-pipeline-b-spot-environment`
  - ⚠️ No instance type restriction → sometimes picks oversized instances (e.g. `m7g.16xlarge`)
  - Fix in rebuild: restrict to `m7g.xlarge` / `m7g.2xlarge`
- **Lambda** — Python 3.13, arm64, all `qgi-*` functions
- **Athena** — workgroup `QGI-Lambda-Workgroup`, writes to `s3://qgi-data-lake/query_results/`

### Storage
- `qgi-data-lake-111111111111` — all pipeline data
- `athena-query-results-111111111111` — used by Step Functions Phase 4 repair query

### Messaging
- SQS queues: `qgi-pipeline-{a,b,c}-main-queue` + `qgi-pipeline-{a,b,c}-dlq`

### State tracking
- DynamoDB: `qgi-indicator-updates` — tracks which indicators were updated per run

---

## Known design issues (to fix in Terraform rebuild)

| Issue | Impact | Fix |
|-------|--------|-----|
| No instance type restriction in Batch compute env | $3–35/run cost variance | Restrict to `m7g.xlarge` only |
| Phase 3 uses Glue crawler (slow, expensive) | ~$0.10/run, adds 5–10 min | Replace with `MSCK REPAIR TABLE scdis` |
| Phase 1 and Phase 4 use hard waits (21 min, 60 min) | Wastes time when workers finish early | Replace with SQS completion callbacks |
| `indicator_map.csv` manually maintained | Drift risk from xlsx | Auto-generate from xlsx in Pipeline A |
| No S3 lifecycle rule on `query_results/` | Unbounded growth | 30-day expiry on Athena temp results |
| Pipeline A hard-coded to World Bank | Can't add new sources | Multi-source ingestion architecture (#TODO) |
| Orphaned Glue tables in qgi_data | Noise, minor cost | Clean up in rebuild |

---

## Repos

| Repo | What lives here |
|------|----------------|
| `qgi-aws-tf` | Management account IaC only (org, OIDC, CloudTrail, Identity Center) |
| `qgi-infra` | Pipeline Terraform — staging/qa/prod environments |
| `qgi-pipeline` | All Lambda source + Batch job (scdi-finder) source |
