# qgi-aws-tf

Terraform hub repository for Amin's AWS organisation and the QGI (Quantitative Geopolitical Intelligence) pipeline infrastructure.

**Management account:** `111111111111` · **Region:** `eu-central-1`

---

## What this repo does

Manages the **management account only**:
- AWS Organizations structure
- CloudTrail (multi-region, management events)
- IAM Identity Center (SSO) — users and permission sets
- OIDC roles for GitHub Actions (ECR push, Lambda deploy, key rotation)
- Terraform state backend (S3 + DynamoDB)

QGI pipeline infrastructure lives in [`qgi-infra`](https://github.com/AminAlAit/qgi-infra). Application code lives in [`qgi-pipeline`](https://github.com/AminAlAit/qgi-pipeline).

---

## AWS account structure (as of March 2026)

| Account | ID | Purpose |
|---------|-----|---------|
| Management (Amin) | `111111111111` | Org root, CloudTrail, OIDC roles, state backend |
| `qgi-legacy` | `555555555555` | Old hand-built pipeline — read-only, do not deploy here |
| `qgi-prod` | `444444444444` | Terraform-managed production pipeline |
| `qgi-staging` | `222222222222` | Terraform-managed staging environment |
| `qgi-qa` | `333333333333` | Terraform-managed QA environment |
| `personal-website` | `666666666666` | aminalait.com infrastructure |

---

## QGI — what it is

QGI ingests World Bank economic/political indicator data for ~200 countries, computes FFT-based cross-correlations (SCDIs) between every country pair for every indicator, and synthesises them into Patterns. The end product is **QGI Macroscope** — a strategic intelligence dashboard.

### Pipeline architecture

```
EventBridge Scheduler (monthly, 6am Berlin, 1st of month)
  └── Step Functions: qgi-indicator-monthly-updater
        ├── Phase 0: Janitor — purge queues, clean temp data
        ├── Phase 1: Ingestion — fetch World Bank data → dispatch → workers → reporter
        ├── Phase 2: Compute — AWS Batch SCDI computation (Graviton Spot)
        ├── Phase 3: Glue — MSCK REPAIR TABLE on scdis and patterns
        ├── Phase 4: Synthesis — dispatcher → SQS → workers → pattern generation
        └── Phase 5: Audit — DLQ scan, ops report
```

---

## Environment strategy

| Environment | AWS Account | Deploy trigger |
|-------------|-------------|----------------|
| staging | `qgi-staging` (`222222222222`) | push to `main` in qgi-pipeline / qgi-infra |
| qa | `qgi-qa` (`333333333333`) | tag `rc-*` |
| prod | `qgi-prod` (`444444444444`) | tag `v*` |

---

## Related repos

| Repo | Responsibility |
|------|---------------|
| [`qgi-infra`](https://github.com/AminAlAit/qgi-infra) | Pipeline Terraform — staging/QA/prod environments |
| [`qgi-pipeline`](https://github.com/AminAlAit/qgi-pipeline) | Lambda + Batch application code |
| [`cloud-resume-aws-tf`](https://github.com/AminAlAit/cloud-resume-aws-tf) | aminalait.com infrastructure |
| [`cloud-resume-web`](https://github.com/AminAlAit/cloud-resume-web) | aminalait.com frontend |
| **This repo** | Management account IaC only |

---

## Conventions

- **Runtime:** Python 3.13 (Graviton/arm64)
- **Region:** `eu-central-1` exclusively
- **Naming:** `qgi-` prefix for pipeline, `qgi-api-` for website-facing endpoints
- **Tags:** `Project=qgi`, `Environment=<env>`, `ManagedBy=terraform`, `Owner=amin.al-ait`
- **State:** `s3://qgi-aws-tf-state-111111111111/management/terraform.tfstate` + DynamoDB lock `qgi-aws-tf-state-lock`

See [CLAUDE.md](CLAUDE.md) for Claude Code-specific instructions.

---

## Codespace — multi-repo setup

This repo is the **hub Codespace** for the entire system. When a Codespace is created here, sibling repos are automatically cloned alongside it:

- The `setup.sh` in `.devcontainer/` runs on every new Codespace and calls `git clone` (or `git pull`) for each sibling repo — no manual action needed.
- All repos land under `/workspaces/` next to each other.

**To get the VS Code multi-root sidebar** (all repos visible side-by-side in the Explorer):

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **"Open Workspace from File"**
2. Select `qgi-hub.code-workspace` at the root of this repo
3. VS Code will reload and show all repos in the sidebar — this persists for the lifetime of the Codespace

VS Code may also prompt you automatically with _"Do you want to open the workspace file?"_ when the Codespace first starts — clicking yes has the same effect.
