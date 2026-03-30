#!/bin/bash
# Bootstrap the Terraform state backend for the qgi-staging account.
# Run this ONCE before the first `terraform init` in environments/staging/.
#
# Prerequisites:
#   - aws CLI configured with credentials that can assume OrganizationAccountAccessRole
#     in the staging account (the ci-terraform-deployer user in management
#     account satisfies this via AWS Organizations).
#   - AWS_DEFAULT_REGION=eu-central-1 (set in devcontainer)
#
# Usage:
#   bash .devcontainer/../environments/staging/bootstrap/bootstrap.sh
# Or from repo root:
#   bash environments/staging/bootstrap/bootstrap.sh

set -euo pipefail

STAGING_ACCOUNT_ID="222222222222"
REGION="eu-central-1"
BUCKET_NAME="qgi-infra-state-${STAGING_ACCOUNT_ID}"
TABLE_NAME="qgi-infra-state-lock"
ROLE_ARN="arn:aws:iam::${STAGING_ACCOUNT_ID}:role/OrganizationAccountAccessRole"

echo "==> Assuming OrganizationAccountAccessRole in staging account ${STAGING_ACCOUNT_ID}..."
CREDS=$(aws sts assume-role \
  --role-arn "$ROLE_ARN" \
  --role-session-name "qgi-infra-bootstrap" \
  --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
  --output text)

export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | awk '{print $1}')
export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | awk '{print $2}')
export AWS_SESSION_TOKEN=$(echo "$CREDS" | awk '{print $3}')

echo "==> Creating S3 state bucket: ${BUCKET_NAME}"
if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
  echo "    (already exists — skipping)"
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"

  aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled

  aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
      "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
    }'

  aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  echo "    Created ${BUCKET_NAME}"
fi

echo "==> Creating DynamoDB lock table: ${TABLE_NAME}"
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" 2>/dev/null; then
  echo "    (already exists — skipping)"
else
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"

  aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
  echo "    Created ${TABLE_NAME}"
fi

unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN

echo ""
echo "Bootstrap complete. You can now run:"
echo "  cd environments/staging"
echo "  terraform init"
echo "  terraform plan"
