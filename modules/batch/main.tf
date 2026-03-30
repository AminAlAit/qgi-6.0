# ---------------------------------------------------------------------------
# Default VPC — Batch compute environment runs in the default VPC.
# For prod, consider a dedicated VPC with private subnets.
# ---------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "defaultForAz"
    values = ["true"]
  }
}

data "aws_security_group" "default" {
  name   = "default"
  vpc_id = data.aws_vpc.default.id
}

# ---------------------------------------------------------------------------
# Batch compute environment
# Fixes the production cost issue: restricts to m7g.2xlarge only.
# The scdi-finder job requires 8 vCPU / 30 GB; m7g.2xlarge (8 vCPU, 32 GB)
# is the smallest Graviton instance that satisfies this requirement.
# Production had `instanceTypes = ["m7g", "r7g"]` (full families) which
# caused Batch to occasionally pick m7g.16xlarge ($35/run).
# ---------------------------------------------------------------------------
resource "aws_batch_compute_environment" "scdi_spot" {
  compute_environment_name = "qgi-pipeline-b-spot-environment"
  type                     = "MANAGED"
  state                    = "ENABLED"

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_PRICE_CAPACITY_OPTIMIZED"
    instance_type       = ["m7g.2xlarge"]

    min_vcpus     = 0
    max_vcpus     = 256 # up to 32 concurrent jobs
    desired_vcpus = 0

    instance_role = var.ecs_instance_profile_arn

    subnets            = data.aws_subnets.default.ids
    security_group_ids = [data.aws_security_group.default.id]

    ec2_configuration {
      image_type = "ECS_AL2023"
    }

    tags = var.tags
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# Batch job queue
# ---------------------------------------------------------------------------
resource "aws_batch_job_queue" "scdi" {
  name     = "qgi-pipeline-b-high-priority-queue"
  state    = "ENABLED"
  priority = 100

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.scdi_spot.arn
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# CloudWatch log group for Batch job logs
# Must exist before the first job runs; awslogs driver will fail otherwise.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "scdi_finder" {
  name              = "/aws/batch/qgi-scdi-finder"
  retention_in_days = 30
  tags              = var.tags
}

# ---------------------------------------------------------------------------
# Batch job definition — scdi-finder
# Image lives in the management account ECR (shared registry).
# Cross-account pull requires an ECR resource policy in the management
# account — add to qgi-aws-tf Terraform (tracked in issue #8).
# ---------------------------------------------------------------------------
resource "aws_batch_job_definition" "scdi_finder" {
  name = "scdi-finder-job"
  type = "container"

  platform_capabilities = ["EC2"]

  container_properties = jsonencode({
    image   = "${var.management_account_id}.dkr.ecr.${var.region}.amazonaws.com/qgi-pipeline-b-scdi-finder:latest"
    command = []

    jobRoleArn      = var.batch_job_role_arn
    executionRoleArn = var.batch_job_role_arn

    resourceRequirements = [
      { type = "VCPU",   value = "8" },
      { type = "MEMORY", value = "30000" },
    ]

    environment = [
      { name = "S3_BUCKET",            value = var.data_lake_bucket_name },
      { name = "S3_INPUT_PREFIX",      value = "pipeline-A-indicator-extractor/output/csv/" },
      { name = "S3_OUTPUT_PREFIX",     value = "pipeline-B-scdi-finder/scdis" },
      { name = "MIN_LENGTH",           value = "3" },
      { name = "CORRELATION_THRESHOLD", value = "0.5" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/aws/batch/qgi-scdi-finder"
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "scdi"
      }
    }
  })

  tags = var.tags
}
