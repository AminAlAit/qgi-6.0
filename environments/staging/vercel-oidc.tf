# ---------------------------------------------------------------------------
# Vercel -> AWS OIDC federation (live-pulse track, founder go 2026-06-12)
#
# Lets the production qgi-frontend (Vercel) read the live-pulse output from S3
# WITHOUT any stored AWS key: Vercel presents a short-lived OIDC token, AWS
# hands back ~1h credentials scoped to a read-only role. All-private (the S3
# object is never public) and $0 (free-tier reads). Matches the founder's
# existing OIDC pattern (GitHub Actions -> AWS).
#
# Vercel team slug + project (from the deployment URL
# vercel.com/aminalaits-projects/qgi-frontend). FOUNDER: confirm these against
# the Vercel project's OIDC settings page before relying on it — a wrong slug
# fails the AssumeRoleWithWebIdentity condition silently.
#   issuer  = https://oidc.vercel.com/aminalaits-projects   (Team issuer mode)
#   aud     = https://vercel.com/aminalaits-projects
#   sub     = owner:aminalaits-projects:project:qgi-frontend:environment:{production|preview}
# Docs: https://vercel.com/docs/oidc/aws
# ---------------------------------------------------------------------------

locals {
  vercel_oidc_issuer = "https://oidc.vercel.com/aminalaits-projects"
  vercel_oidc_aud    = "https://vercel.com/aminalaits-projects"
  vercel_oidc_host   = "oidc.vercel.com/aminalaits-projects" # condition-key prefix
}

# AWS no longer validates the thumbprint for issuers fronted by a public CA
# (oidc.vercel.com is), so the [0] leaf fingerprint below is accepted as a
# formality — it is not part of the token-trust path. The resource still
# requires the field, so fetch it from the live cert. One OIDC provider is
# allowed per issuer URL per account; no other module here touches this issuer.
data "tls_certificate" "vercel_oidc" {
  url = local.vercel_oidc_issuer
}

resource "aws_iam_openid_connect_provider" "vercel" {
  url             = local.vercel_oidc_issuer
  client_id_list  = [local.vercel_oidc_aud]
  thumbprint_list = [data.tls_certificate.vercel_oidc.certificates[0].sha1_fingerprint]
  tags            = local.tags
}

# Read-only role the frontend assumes via the Vercel OIDC token. Scoped to the
# two dashboard JSONs the site reads — nothing else in the data lake.
resource "aws_iam_role" "vercel_frontend_reader" {
  name = "qgi-vercel-frontend-reader"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.vercel.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      # Both aud AND sub required (AND semantics). StringEquals (not StringLike)
      # with exact subjects — no wildcards, so a future edit can't silently
      # broaden scope (e.g. environment:* would admit development).
      Condition = {
        StringEquals = {
          "${local.vercel_oidc_host}:aud" = local.vercel_oidc_aud
          # Production + preview deploys of THIS project only.
          "${local.vercel_oidc_host}:sub" = [
            "owner:aminalaits-projects:project:qgi-frontend:environment:production",
            "owner:aminalaits-projects:project:qgi-frontend:environment:preview",
          ]
        }
      }
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "vercel_frontend_reader" {
  role = aws_iam_role.vercel_frontend_reader.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "ReadDashboardJson"
      Effect = "Allow"
      Action = ["s3:GetObject"]
      # The frontend reads only existing objects, so GetObject is enough (a
      # miss returns 403 -> the loader's absent fallback, which is fine). No
      # ListBucket needed -> the role cannot enumerate the bucket.
      Resource = [
        "${module.storage.bucket_arn}/dashboard/hf-pulse-live.json",
        "${module.storage.bucket_arn}/dashboard/country-risks.json",
      ]
    }]
  })
}

output "vercel_frontend_reader_role_arn" {
  value       = aws_iam_role.vercel_frontend_reader.arn
  description = "Set this as AWS_ROLE_ARN in the Vercel qgi-frontend project (production env)."
}
