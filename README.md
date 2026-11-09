# QGI 6.0 — AWS Organization & Management Account IaC (qgi-aws-tf, 2026)

> [!IMPORTANT]
> **Historical Archive (`QGI v6.0`):** This repository was one of the 7 polyrepo components of **QGI 6.0** (March–August 2026). It has been consolidated with full commit history into **QGI 7.0** at [`AminAlAit/qgi/tree/main/infra/management`](https://github.com/AminAlAit/qgi/tree/main/infra/management) (Live at [qgintelligence.com](https://qgintelligence.com)).

## QGI Generational Lineage (`v1.0` → `v7.0`)

| Generation | Period | Architecture & Milestone | Repository |
|---|---|---|---|
| **QGI 1.0** | Mar–Oct 2023 | Initial Pairwise Country Correlation Engine & Streamlit Prototype | `AminAlAit/trojan`, `AminAlAit/trojan-streamlit` |
| **QGI 2.0** | Nov 2023 | Soft Power & Institutional Composite Index Prototype | `AminAlAit/trojan-2.0` |
| **QGI 3.0** | Jan–Feb 2024 | Standalone Multi-Page Streamlit Analytical Terminal | [`AminAlAit/qgi-streamlit`](https://github.com/AminAlAit/qgi-streamlit) |
| **QGI 4.0** | Feb–Sep 2025 | Local SCDI Formalization, MySQL→Parquet Engine (Pipelines A–E) & X Bot v1 | `AminAlAit/qgi-4.0` |
| **QGI 5.0** | Sep 2025–Mar 2026 | First-Generation AWS Cloud Migration (Decoupled Lambda & Batch Microservices) | `AminAlAit/qgi-pipeline-a/b/c-*` |
| **QGI 6.0** | Mar–Aug 2026 | **7-Repo Multi-Account AWS Cloud (14.3B FFT Correlations) & Trajectory Engine (42 Models)** | `AminAlAit/qgi-{aws-tf,infra,pipeline,data,ml,frontend}` |
| **QGI 7.0** | Oct 2026–Present | **Unified Public Monorepo & Sovereign IP Vault (Active Production)** | [`AminAlAit/qgi`](https://github.com/AminAlAit/qgi) & `AminAlAit/qgi-docs` |

---

## Component Scope in QGI 6.0

Managed the root AWS Organization (111111111111), Service Control Policies (SCPs), cross-account IAM OIDC roles, and central ECR repositories during the QGI 6.0 polyrepo era. Consolidated into [infra/management/](https://github.com/AminAlAit/qgi/tree/main/infra/management) in QGI 7.0.