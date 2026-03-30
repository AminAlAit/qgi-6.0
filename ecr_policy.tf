# ---------------------------------------------------------------------------
# ECR Repository Policy — qgi-pipeline-b-scdi-finder
#
# Manages access to the shared scdi-finder container image:
#   - GitHub Actions (qgi-pipeline) can push new images
#   - QGI pipeline ECS instance roles (per account) can pull images
#
# The ECR repo itself is hand-built (not imported into TF state).
# This resource manages only the repository policy.
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
