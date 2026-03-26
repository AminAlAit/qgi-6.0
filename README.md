# qgi-aws-tf

Terraform repository for Amin's AWS account organisation and QGI (Quantitative Geopolitical Intelligence) infrastructure.

**AWS Account:** `111111111111` · **Region:** `eu-central-1`

---

## What this repo does

This repo has two sequential responsibilities:

1. **Account organisation** — Fix the AWS account structure so QGI and the personal website (`aminalait.com`) live in properly isolated environments with clean billing, auditing, and tagging.
2. **QGI infrastructure** — Reconstruct the entire QGI data pipeline as Terraform, replacing the current hand-built state.

---

## Current state (March 2026)

| Item | Status |
|------|--------|
| AWS Organizations | ✅ Created (`o-tq0c7s4aea`) — no member accounts yet |
| CloudTrail | ❌ Not enabled |
| Cost allocation tags | ❌ Not activated in Billing |
| QGI resource tagging | ❌ No tags on any QGI resource |
| QGI Terraform | ❌ All resources built manually |
| EventBridge schedule | ❌ No scheduled rule found for QGI pipeline |

---

## The 4-phase plan

### Phase 1 — Account hygiene
- Enable CloudTrail (management events, multi-region)
- Activate cost allocation tags in AWS Billing console
- Tag all existing QGI resources

### Phase 2 — AWS Organizations
- Create `qgi` member account
- Create `personal-website` member account
- Set up IAM Identity Center for cross-account access
- Add Service Control Policies (region restriction, etc.)

### Phase 3 — Migrate website
- Re-point `cloud-resume-aws-tf` backend to the new `personal-website` account
- `terraform destroy` in old account, `terraform apply` in new
- Update Namecheap nameservers

### Phase 4 — Reconstruct QGI in Terraform _(main deliverable)_
- Full IaC for: Step Functions, Lambda, Batch, Glue, Athena, S3, SQS, DynamoDB, EventBridge, IAM
- State backend: `qgi-tf-state` S3 bucket in the QGI account
- All resources tagged `Project=qgi`

---

## QGI — what it is

QGI ingests World Bank economic/political indicator data for ~200 countries, computes FFT-based cross-correlations (SDCIs) between every country pair for every indicator, and synthesises them into Patterns and Influence Cascades. The end product is **QGI Macroscope** — a strategic intelligence dashboard currently in development.

### Pipeline architecture

```
EventBridge (monthly)
  └── Step Functions: qgi-indicator-monthly-updater
        ├── Phase 0: janitor (cleanup)
        ├── Phase 1: sheet-fetcher → dispatcher → reporter (World Bank ingestion)
        ├── Phase 2: batch-orchestrator → AWS Batch (FFT SDCI computation)
        ├── Phase 4: dispatcher → SQS → workers (Pattern synthesis)
        └── Phase 5: dlq-scanner (dead letter queue audit)
```

---

## Related repos

| Repo | Responsibility |
|------|---------------|
| `AminAlAit/cloud-resume-aws-tf` | Website infrastructure (S3, CloudFront, Lambda, Route 53) — complete |
| `AminAlAit/cloud-resume-web` | Frontend HTML/CSS/JS — complete |
| **This repo** | AWS Org setup + QGI Terraform |

---

## Conventions

- **Runtime:** Python 3.13 (Graviton/arm64)
- **Region:** `eu-central-1` exclusively
- **Naming:** `qgi-` prefix for pipeline, `qgi-api-` for website-facing endpoints
- **Tags:** `Project=qgi`, `Environment=production`, `ManagedBy=terraform`, `Owner=amin.al-ait`
- **State:** `s3://qgi-tf-state/qgi/terraform.tfstate` + DynamoDB lock `qgi-tf-state-lock`

See [CLAUDE.md](CLAUDE.md) for Claude Code-specific instructions.
