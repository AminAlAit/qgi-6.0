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
# qgi-pipeline-a-indicator-fetcher (#FAR-1) — TF-managed ECR repo
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "indicator_fetcher" {
  name                 = "qgi-pipeline-a-indicator-fetcher"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # No force_delete — we want TF to refuse if someone tries to rip this
  # out without first emptying the repo or re-applying the workflow.

  tags = {
    Project     = "qgi"
    Environment = "shared"
    ManagedBy   = "terraform"
    Owner       = "amin.al-ait"
  }
}

resource "aws_ecr_lifecycle_policy" "indicator_fetcher" {
  repository = aws_ecr_repository.indicator_fetcher.name

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

data "aws_iam_policy_document" "indicator_fetcher_ecr" {
  # GitHub Actions push access — same role as scdi-finder; role-level
  # policy (below) grants the push actions, repo policy authorizes them.
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

  # Cross-account pull access for all three QGI pipeline environments
  statement {
    sid    = "CrossAccountFargatePull"
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = [
        # Staging
        "arn:aws:iam::222222222222:role/qgi-fargate-execution-role",
        "arn:aws:iam::222222222222:role/qgi-fargate-indicator-fetcher-task-role",
        # QA (will be active once #90 follow-on lands)
        "arn:aws:iam::333333333333:role/qgi-fargate-execution-role",
        "arn:aws:iam::333333333333:role/qgi-fargate-indicator-fetcher-task-role",
        # Prod
        "arn:aws:iam::444444444444:role/qgi-fargate-execution-role",
        "arn:aws:iam::444444444444:role/qgi-fargate-indicator-fetcher-task-role",
      ]
    }
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
  }
}

resource "aws_ecr_repository_policy" "indicator_fetcher" {
  repository = aws_ecr_repository.indicator_fetcher.name
  policy     = data.aws_iam_policy_document.indicator_fetcher_ecr.json
}
