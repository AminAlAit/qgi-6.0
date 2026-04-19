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
# Right-sized: jobs need 2 vCPU / 4 GB.
# Spot with multiple Graviton instance types for best availability + price.
# m6g.large (~$0.034/hr), c7g.large (~$0.043/hr), m7g.large (~$0.045/hr)
# All verified available in eu-central-1 a/b/c.
# maxvCpus=512 for good concurrency. Spot is cheaper but slower to allocate.
# ---------------------------------------------------------------------------
resource "aws_batch_compute_environment" "scdi_spot" {
  compute_environment_name = "qgi-pipeline-b-spot-environment"
  type                     = "MANAGED"
  state                    = "ENABLED"

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_CAPACITY_OPTIMIZED"
    instance_type       = ["m6g.large", "c7g.large", "m7g.large"]

    min_vcpus     = 0
    max_vcpus     = 512
    desired_vcpus = 0

    instance_role = var.ecs_instance_profile_arn

    subnets            = data.aws_subnets.default.ids
    security_group_ids = [data.aws_security_group.default.id]

    ec2_configuration {
      image_type = "ECS_AL2"
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
# Phase 1 indicator fetcher — Fargate Spot (#FAR-1)
#
# Replaces the legacy EC2+SSM single-instance fetcher with a fan-out to
# AWS Batch on Fargate Spot, one job per indicator. Each task sleeps a
# random 1-5 min before its WB API call so the requests naturally spread
# across time. Each Fargate Spot task gets its own public IP, so the WB
# rate limiter sees N independent clients instead of one source.
#
# Fargate Spot vs EC2 Spot:
# - No instance management, no boot time amortization
# - Smallest possible config: 0.25 vCPU + 512 MB RAM (~$0.0008 per task)
# - Each task gets its own micro-VM with its own ENI/IP
# - eu-central-1 quotas verified (sustained 20/sec, burst 100, 30 vCPU concurrent)
# ---------------------------------------------------------------------------

# ECR repo for the indicator-fetcher image now lives in the MANAGEMENT
# account (#152 Path A) alongside scdi-finder. This module pulls it
# cross-account via the job definition's image URI below. The local
# `aws_ecr_repository.indicator_fetcher` resource was removed as part
# of the migration; see the #152 runbook for the one-time image copy.

# Fargate Spot compute environment — no instances, no AMIs, no scaling.
# Just submits tasks and Fargate provisions micro-VMs on demand.
resource "aws_batch_compute_environment" "fetcher_fargate_spot" {
  compute_environment_name = "qgi-pipeline-a-fetcher-fargate-spot"
  type                     = "MANAGED"
  state                    = "ENABLED"

  compute_resources {
    type      = "FARGATE_SPOT"
    max_vcpus = 30 # service quota; bumpable via support ticket if needed for V1.6.0

    subnets            = data.aws_subnets.default.ids
    security_group_ids = [data.aws_security_group.default.id]
  }

  tags = var.tags
}

resource "aws_batch_job_queue" "fetcher" {
  name     = "qgi-pipeline-a-fetcher-queue"
  state    = "ENABLED"
  priority = 100

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.fetcher_fargate_spot.arn
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "indicator_fetcher" {
  name              = "/aws/batch/qgi-indicator-fetcher"
  retention_in_days = 14
  tags              = var.tags
}

# Job definition: 0.25 vCPU + 512 MB.
#
# GH#243 perma fix (2026-04-16): heavy WB indicators (FI.RES.TOTL.MO,
# BM.TRF.PWKR.CD.DT, etc.) were timing out at 15 min. Bumped to a generous
# 60 min so even the slowest indicators have headroom. Retries dropped from
# 10 \u2192 2 because timeouts aren't transient \u2014 retrying just burns Fargate.
#
# Hard-kill failures (timeout, OOM, Spot reclaim) bypass the worker's
# graceful failure path. Closed via the EventBridge rule + failure-handler
# Lambda (see modules/pipeline/main.tf).
resource "aws_batch_job_definition" "indicator_fetcher" {
  name = "qgi-indicator-fetcher-job"
  type = "container"

  platform_capabilities = ["FARGATE"]

  retry_strategy {
    attempts = 2 # GH#243: was 10. Timeouts aren't transient.
  }

  timeout {
    attempt_duration_seconds = 3600 # GH#243: was 900 (15min). Now 60min.
  }

  container_properties = jsonencode({
    # Per-environment ECR repo (not cross-account from management).
    # #152 Path A was parked — using local staging ECR for now.
    image   = "${var.aws_account_id}.dkr.ecr.${var.region}.amazonaws.com/qgi-pipeline-a-indicator-fetcher:latest"
    command = []

    jobRoleArn       = var.fargate_task_role_arn
    executionRoleArn = var.fargate_execution_role_arn

    resourceRequirements = [
      { type = "VCPU",   value = "0.25" },
      { type = "MEMORY", value = "512" },
    ]

    networkConfiguration = {
      assignPublicIp = "ENABLED" # required for Fargate to reach WB + S3 in default VPC
    }

    fargatePlatformConfiguration = {
      platformVersion = "LATEST"
    }

    # #FAR-1: arm64 — ~20% cheaper on Fargate Spot than x86, and keeps the
    # Phase 1 fetcher consistent with the rest of the Graviton stack.
    runtimePlatform = {
      cpuArchitecture       = "ARM64"
      operatingSystemFamily = "LINUX"
    }

    environment = [
      # Most env vars are overridden by the dispatcher per-job; defaults
      # here are used only if a manual `aws batch submit-job` is run for
      # debugging.
      { name = "JITTER_MIN_S",      value = "60" },
      { name = "JITTER_MAX_S",      value = "300" },
      { name = "MAX_FETCH_ATTEMPTS", value = "10" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/aws/batch/qgi-indicator-fetcher"
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "fetch"
      }
    }
  })

  tags = var.tags
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

    # T12 #305 HIGH fix (2026-04-19): executionRoleArn was erroneously set
    # to the task role (batch_job_role_arn). AWS Batch execution role and
    # task role serve different IAM trust principals — the execution role
    # is assumed by ECS (or Fargate) to pull the image + ship CloudWatch
    # logs, while the task role is assumed by the code INSIDE the
    # container. Conflating them gives the container the image-pull and
    # logging permissions as well, expanding its blast radius.
    #
    # The fargate_execution role already exists in the iam module with the
    # correct trust (ecs-tasks.amazonaws.com) + AmazonECSTaskExecutionRolePolicy.
    # Reused here for the scdi-finder Batch job (EC2-backed) — AWS uses
    # the same trust principal for Batch-on-EC2 and Batch-on-Fargate.
    jobRoleArn       = var.batch_job_role_arn
    executionRoleArn = var.fargate_execution_role_arn

    resourceRequirements = [
      { type = "VCPU",   value = "2" },
      { type = "MEMORY", value = "4096" },
    ]

    environment = [
      { name = "S3_BUCKET",            value = var.data_lake_bucket_name },
      { name = "S3_INPUT_PREFIX",      value = "pipeline-A-indicator-extractor/output/parquet-completed/" },
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
