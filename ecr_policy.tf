# ---------------------------------------------------------------------------
# ECR — QGI pipeline container images (management account)
#
# Two repos live here:
#   1. qgi-pipeline-b-scdi-finder       — Phase 2 SCDI finder (EC2 Batch)
#   2. qgi-pipeline-a-indicator-fetcher — Phase 1 Fargate Spot fetcher (#FAR-1)
#
# Consolidated in management per #152 Path A (previously the fetcher repo
# lived in the staging account which blocked CI cross-account pushes).
#
# For scdi-finder the ECR repo itself is hand-built (not imported into TF
# state); we only manage its repository policy here. For indicator-fetcher
# the repo IS TF-managed since we're creating it greenfield during the
# migration.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "scdi_finder_ecr" {
  # GitHub Actions push access (qgi-pipeline repo, main branch)
  statement {
    sid    = "GitHubActionsPush"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.qgi_ecr_push.arn]
    }
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
  }

  # Cross-account pull access for QGI pipeline environments
  # ECS uses executionRoleArn (qgi-batch-job-role) for image pulls when set.
  # Also allow the ECS instance role as a fallback.
  #
  # NOTE 2026-05-10: this TF data block is currently DRIFTED from the live
  # scdi-finder repo policy (which uses account-root principals for 3 accts
  # qa+staging+prod, hand-built 2025-09). Applying this block as-is would
  # NARROW QA + prod scdi-finder pull access. Out of scope for the current
  # Stage F unblock — to be addressed in a follow-up PR that imports the
  # live policy and aligns to the :root pattern across all qgi mgmt-account
  # ECR repos. See AWS expert consult 2026-05-10.
  statement {
    sid    = "CrossAccountECSPull"
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = [
        # Staging (222222222222) — both roles may be used for ECR pull
        "arn:aws:iam::222222222222:role/qgi-ecs-instance-role",
        "arn:aws:iam::222222222222:role/qgi-batch-job-role",
      ]
    }
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
  }
}

resource "aws_ecr_repository_policy" "scdi_finder" {
  repository = "qgi-pipeline-b-scdi-finder"
  policy     = data.aws_iam_policy_document.scdi_finder_ecr.json
}

# ---------------------------------------------------------------------------
# qgi-pipeline-a-indicator-fetcher — DELETED 2026-05-11 (#635 closure)
#
# Originally added under #152 Path A (consolidate ECR push targets in the
# management account). Path A was effectively parked: by 2025-Q4 the
# qgi-pipeline ecr-push.yml workflow was pushing the indicator-fetcher
# image to BOTH the management mirror AND the staging-account ECR, and
# the live runtime path settled on the staging-account repo (managed by
# qgi-infra/modules/batch/main.tf and authorized by qgi-infra/modules/
# iam/main.tf's `github_actions_ecr_push` role). The management-account
# mirror never had consumers in production.
#
# Today (2026-05-11) the management-account ECR repo
# `qgi-pipeline-a-indicator-fetcher` does NOT exist in AWS — verified
# via `aws ecr describe-repositories --repository-names
# qgi-pipeline-a-indicator-fetcher` → RepositoryNotFoundException.
# The TF source described an intended state that AWS never reached.
#
# Deleting this block + the matching `ECRPushIndicatorFetcher` inline
# policy in iam_oidc_roles.tf eliminates ~92 lines of dead Path-A
# debris and removes the 3 phantom CREATE diffs from `terraform plan`.
# The promised permission from #635 is already satisfied by the
# staging-account push policy in qgi-infra (PR #23, merged 2026-05-11,
# includes ecr:BatchGetImage + ecr:DescribeImages).
#
# Architectural rationale (2026-05-11 architecture review): Phase 1
# fetchers are per-environment data jobs and SHOULD live in each
# environment's local ECR (qgi-infra owns those). Phase 2 B-stage
# Batch images (scdi-finder, dscdi-finder) are stateless compute that
# runs identically across all environments and CORRECTLY lives in
# management as a shared-services ECR with cross-account pull. The
# split is principled, not accidental.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# qgi-pipeline-b-dscdi-finder (Phase 5 v0.0b Stage F preflight) — TF-managed
#
# DSCDI = Detrended Similar-Country Dynamic Indicator. Companion to scdi-finder;
# additive scope per the 2026-05-04 founder amendment + 2026-05-05 unanimous
# 6-way mini-Majles CSD reconvene DECISION. Greenfield repo (TF-managed from
# the start; not hand-built like scdi-finder), so the resource policy follows
# the indicator-fetcher pattern (data + aws_ecr_repository_policy).
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "dscdi_finder" {
  name                 = "qgi-pipeline-b-dscdi-finder"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project     = "qgi"
    Environment = "shared"
    ManagedBy   = "terraform"
    Owner       = "amin.al-ait"
  }
}

resource "aws_ecr_lifecycle_policy" "dscdi_finder" {
  repository = aws_ecr_repository.dscdi_finder.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

data "aws_iam_policy_document" "dscdi_finder_ecr" {
  # GitHub Actions push access — same role as scdi-finder + indicator-fetcher.
  # Repo policy authorizes; role-level inline policy
  # (qgi_ecr_push_dscdi_finder in iam_oidc_roles.tf) grants the push actions.
  statement {
    sid    = "GitHubActionsPush"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.qgi_ecr_push.arn]
    }
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
  }

  # Cross-account pull access — staging only at this stage. QA + prod will
  # be added when the multi-environment Stage F rollout fires (post end-of-
  # cascade-mandate authorization).
  #
  # Account-root principal pattern (AWS principal-engineer best practice).
  # The earlier named-role list (qgi-ecs-instance-role + qgi-batch-job-role)
  # missed qgi-fargate-execution-role — the role Batch actually uses for
  # cross-account image pulls — and caused the 2026-05-10 Stage F smoke
  # failure (CannotPullImageManifestError, job a64f5dfa). See AWS expert
  # consult 2026-05-10 + scdi_finder_ecr above for the rationale and the
  # consumer-side IAM-simulator pre-flight check.
  statement {
    sid    = "CrossAccountECRPull"
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::222222222222:root", # staging
      ]
    }
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
  }
}

resource "aws_ecr_repository_policy" "dscdi_finder" {
  repository = aws_ecr_repository.dscdi_finder.name
  policy     = data.aws_iam_policy_document.dscdi_finder_ecr.json
}
