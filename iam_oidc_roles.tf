# ---------------------------------------------------------------------------
# GitHub Actions OIDC Roles
#
# Eliminates static IAM keys from GitHub Actions workflows. All roles use
# the existing OIDC provider (token.actions.githubusercontent.com) which
# was bootstrapped separately.
#
# Covered repos:
#   - AminAlAit/cloud-resume-web  → S3 + CloudFront deploy
#   - AminAlAit/qgi               → ECR push (qgi-pipeline-b-scdi-finder)
#   - AminAlAit/qgi-aws-tf        → IAM key rotation (Codespace credential refresh)
# ---------------------------------------------------------------------------

locals {
  oidc_provider_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
  oidc_provider_url = "token.actions.githubusercontent.com"
}

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# cloud-resume-web — S3 + CloudFront deploy role
# Replaces: aminalait-github-actions-deploy IAM user
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "cloud_resume_web_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "${local.oidc_provider_url}:sub"
      values   = ["repo:AminAlAit/cloud-resume-web:*"]
    }
  }
}

resource "aws_iam_role" "cloud_resume_web_deploy" {
  name               = "github-actions-cloud-resume-web-deploy"
  assume_role_policy = data.aws_iam_policy_document.cloud_resume_web_assume.json
  description        = "OIDC role for AminAlAit/cloud-resume-web GitHub Actions - S3 + CloudFront deploy"

  tags = {
    Project = "aminalait-website"
  }
}

data "aws_iam_policy_document" "cloud_resume_web_deploy" {
  statement {
    sid    = "S3Deploy"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:GetObject",
    ]
    resources = [
      "arn:aws:s3:::aminalait.com",
      "arn:aws:s3:::aminalait.com/*",
    ]
  }

  statement {
    sid    = "CloudFrontInvalidate"
    effect = "Allow"
    actions = ["cloudfront:CreateInvalidation"]
    resources = [
      "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/E1MXUQ8TWPFAEQ",
    ]
  }
}

resource "aws_iam_role_policy" "cloud_resume_web_deploy" {
  name   = "cloud-resume-web-deploy-policy"
  role   = aws_iam_role.cloud_resume_web_deploy.id
  policy = data.aws_iam_policy_document.cloud_resume_web_deploy.json
}

# ---------------------------------------------------------------------------
# qgi — ECR push role
# Replaces: github-actions-ecr-pusher IAM user (AdminAccess removed — closes #24)
# Reuses existing least-privilege policy GitHubActionsECR-QGI-pB-SCDI-Finder-PushAccess
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "qgi_ecr_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "${local.oidc_provider_url}:sub"
      values   = ["repo:AminAlAit/qgi:*"]
    }
  }
}

resource "aws_iam_role" "qgi_ecr_push" {
  name               = "github-actions-qgi-ecr-push"
  assume_role_policy = data.aws_iam_policy_document.qgi_ecr_assume.json
  description        = "OIDC role for AminAlAit/qgi GitHub Actions - ECR push to qgi-pipeline-b-scdi-finder"

  tags = {
    Project = "qgi"
  }
}

resource "aws_iam_role_policy_attachment" "qgi_ecr_push" {
  role       = aws_iam_role.qgi_ecr_push.name
  policy_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/GitHubActionsECR-QGI-pB-SCDI-Finder-PushAccess"
}

# ---------------------------------------------------------------------------
# qgi-aws-tf — Codespace key rotation role
# Used by the rotate-codespace-keys.yml workflow to refresh ci-terraform-deployer keys
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "key_rotator_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:sub"
      # Only the main branch of this repo can rotate keys
      values = ["repo:AminAlAit/qgi-aws-tf:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "key_rotator" {
  name               = "github-actions-codespace-key-rotator"
  assume_role_policy = data.aws_iam_policy_document.key_rotator_assume.json
  description        = "OIDC role for AminAlAit/qgi-aws-tf - rotates ci-terraform-deployer IAM keys"
}

data "aws_iam_policy_document" "key_rotator" {
  statement {
    sid    = "RotateCodespaceKeys"
    effect = "Allow"
    actions = [
      "iam:CreateAccessKey",
      "iam:DeleteAccessKey",
      "iam:ListAccessKeys",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/ci-terraform-deployer",
    ]
  }
}

resource "aws_iam_role_policy" "key_rotator" {
  name   = "codespace-key-rotation-policy"
  role   = aws_iam_role.key_rotator.id
  policy = data.aws_iam_policy_document.key_rotator.json
}
