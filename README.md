# QGI 6.0 — 7-Repository Multi-Account AWS Cloud, 14.3B Correlation Fleet & Trajectory Engine (2026)

**Generation 6.0 of 7.0** · Consolidates **`AminAlAit/qgi-aws-tf`**, **`AminAlAit/qgi-infra`**, **`AminAlAit/qgi-pipeline`**, **`AminAlAit/qgi-data`**, **`AminAlAit/qgi-ml`**, and **`AminAlAit/qgi-frontend`** (with companion repo **`AminAlAit/qgi-docs`**) · **Current Production Platform:** [**`AminAlAit/qgi` (QGI 7.0)**](https://github.com/AminAlAit/qgi) ([qgintelligence.com](https://qgintelligence.com))

---

## Overview

In 2026, Quantitative Geopolitical Intelligence scaled from the three-microservice cloud setup of **QGI 5.0** into a full multi-account **AWS Organizations** platform, a **14.3-billion pairwise correlation engine**, a **42-model Trajectory Engine (`te-fleet-run-2`)**, and a **Next.js 16 analytical terminal**.

During **Generation 6.0**, the platform was engineered and operated across seven specialized repositories (`1,306` commits on `main` and `353` feature/experiment branches — all preserved inside this unified repository). In **Generation 7.0**, these repositories were consolidated into the single production monorepo at [**`AminAlAit/qgi`**](https://github.com/AminAlAit/qgi).

---

## The 6 Consolidated Repositories & Their Engineering Scope

| Subdirectory | Original GitHub Repo | Commits & Branches Preserved | Core Engineering Scope |
| :--- | :--- | :--- | :--- |
| **`qgi-aws-tf/`** | `AminAlAit/qgi-aws-tf` | `87` commits · `5` branches (`qgi-aws-tf/*`) | **Multi-Account AWS Organization IaC:** Terraform provisioning Management, Staging, QA, and Production accounts (`eu-central-1`), Service Control Policies (SCPs), IAM Identity Center, keyless GitHub/Vercel OIDC roles, CloudTrail, and central ECR registries |
| **`qgi-infra/`** | `AminAlAit/qgi-infra` | `149` commits · `36` branches (`qgi-infra/*`) | **Workload Infrastructure-as-Code:** Multi-environment Terraform managing AWS Step Functions orchestration DAGs, AWS Batch Graviton/Spot compute environments, S3 Bronze/Silver/Gold lakehouse buckets, AWS Glue catalogs, Athena workgroups, and budget/timeout alarms |
| **`qgi-pipeline/`** | `AminAlAit/qgi-pipeline` | `179` commits · `27` branches (`qgi-pipeline/*`) | **14.3B Correlation & Cascade Engine:** Distributed Python 3.12 AWS Batch & Lambda fleet executing FFT-vectorized SCDI sweeps across 30+ anchor countries, cascade SCDI baking, Spot `SIGTERM` checkpoint recovery, and Athena partition compaction |
| **`qgi-data/`** | `AminAlAit/qgi-data` | `158` commits · `36` branches (`qgi-data/*`) | **Empirical Event & Indicator Catalogs:** Curated 100-country geopolitical event registry (`events/`), World Bank & V-Dem indicator schemas (`indicators/`), cohort sidecars, and Athena verification scripts |
| **`qgi-ml/`** | `AminAlAit/qgi-ml` | `218` commits · `99` branches (`qgi-ml/*`) | **Trajectory Engine & Econometric R&D:** 42-model Trajectory Engine fleet (`te-fleet-run-2`), Leave-One-Crisis-Out (LOCO) walk-forward backtesting (`loco/`), Venn-Abers isotonic probability calibration, survival analysis, and SHAP explainability |
| **`qgi-frontend/`** | `AminAlAit/qgi-frontend` | `519` commits · `150` branches (`qgi-frontend/*`) | **Next.js 16 Analytical Terminal:** React 19 + TypeScript 5 + Tailwind v4 web application powering [qgintelligence.com](https://qgintelligence.com) — featuring live country risk pulse, historical analogue comparison panels, and interactive trajectory charts |

*(Companion documentation and governance repository: **`AminAlAit/qgi-docs`**).*

---

## Repository Structure

```text
qgi-6.0/
├── qgi-aws-tf/                    # AWS Organizations, SCPs, OIDC & central ECR Terraform IaC
├── qgi-infra/                     # Step Functions, AWS Batch, S3 Data Lake, Glue & Athena Terraform IaC
├── qgi-pipeline/                  # Distributed Python 3.12 AWS Batch (14.3B FFT correlations) & Lambda workers
├── qgi-data/                      # Curated geopolitical event catalogs, indicator registries & Athena validators
├── qgi-ml/                        # Trajectory Engine (42 models), LOCO walk-forward backtesting & Venn-Abers calibration
└── qgi-frontend/                  # Next.js 16 App Router + React 19 analytical terminal
```

---

## Why We Consolidated QGI 6.0 into QGI 7.0 (`AminAlAit/qgi`)

Operating six interdependent code repositories introduced cross-repo PR synchronization overhead whenever a schema change spanned `qgi-data`, `qgi-pipeline`, `qgi-ml`, `qgi-infra`, and `qgi-frontend`. In **QGI 7.0** ([**`AminAlAit/qgi`**](https://github.com/AminAlAit/qgi)), we unified all six codebases into a single polyglot monorepo (`infra/`, `pipeline/`, `data-tools/`, `ml/`, `frontend/`) governed by an atomic 6-gate offline verification suite and path-filtered CI/CD workflows.

---

## QGI Generational Roadmap (`v1.0` → `v7.0`)

| Generation | Year | Repository | Original Name(s) | Architectural Milestone |
| :--- | :--- | :--- | :--- | :--- |
| **QGI 1.0** | 2023 | [`AminAlAit/qgi-1.0`](https://github.com/AminAlAit/qgi-1.0) | `trojan`, `trojan-streamlit` | Initial pairwise country correlation engine & first Streamlit UI |
| **QGI 2.0** | 2023 | [`AminAlAit/qgi-2.0`](https://github.com/AminAlAit/qgi-2.0) | `trojan-2.0` | Poetry-packaged ETLP pipeline, `Index` OOP hierarchy & STUMPY matrix profiles |
| **QGI 3.0** | 2024 | [`AminAlAit/qgi-3.0`](https://github.com/AminAlAit/qgi-3.0) | `qgi` (2024), `qgi-streamlit`, `qgi-local` | Multi-page Streamlit analytical terminal backed by relational SQLite/MySQL queries |
| **QGI 4.0** | 2025 | [`AminAlAit/qgi-4.0`](https://github.com/AminAlAit/qgi-4.0) | `qgi-4.0` | Formalization of the SCDI metric (Spearman + Cross-Correlation + DTW), Pipelines A–E & X Bot v1 |
| **QGI 5.0** | 2025–2026 | [`AminAlAit/qgi-5.0`](https://github.com/AminAlAit/qgi-5.0) | `qgi-pipeline-a/b/c` | First AWS cloud migration: Serverless Lambda ETL, Dockerized AWS Batch FFT worker & Athena CTAS |
| **QGI 6.0** *(Here)* | 2026 | **`AminAlAit/qgi-6.0`** | `qgi-aws-tf`, `qgi-infra`, `qgi-pipeline`, `qgi-data`, `qgi-ml`, `qgi-frontend`, `qgi-docs` | 4-account AWS Organization (14.3B FFT correlations), 42-model Trajectory Engine & Next.js 16 terminal |
| **QGI 7.0** *(Active)* | 2026–Present | [**`AminAlAit/qgi`**](https://github.com/AminAlAit/qgi) | `qgi`, `qgi-docs` | Unified production monorepo & live analytical terminal at [qgintelligence.com](https://qgintelligence.com) |
