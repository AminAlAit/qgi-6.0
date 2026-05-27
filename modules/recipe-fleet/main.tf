# ---------------------------------------------------------------------------
# Recipe-fleet module — F-ML-1 multi-recipe walk infrastructure.
#
# Design doc: qgi-docs/internal/ops/ml-track/aws-recipe-fleet-design.md
# Build checklist: design doc §7.
#
# Architecture (from §1):
#   SFN Choice(mode) →
#     canary → single Batch job → waitForTaskToken approval gate (MANDATORY)
#     fan-out → Map over runnable recipes, MaxConcurrency=2 (serialized §2a)
#   → post-pass Lambda (stub; CI deploys real code)
#
# Cost decisions (§2a, founder-ratified 2026-05-24):
#   - 2-vCPU Graviton instances: c7g.large / c7g.medium / m7g.large
#   - SPOT_LOWEST_PRICE allocation strategy
#   - MaxConcurrency=2 in Map state (serialized; saves nothing on cost but
#     reduces Spot reclaim blast radius per §2a)
#   - Pre-filter sparse recipes via recipe-manifest.json before Map state
#
# IAM: job role has s3 read on parquet data + s3 put on results/checkpoints.
#      NO Athena permission (hard cost-safety requirement from design §3).
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Default VPC — reuse same data sources as modules/batch/main.tf
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
# ECR repository — recipe-fleet container image.
#
# Each environment owns its own ECR repo (same pattern as
# qgi-pipeline-a-indicator-fetcher in modules/batch/main.tf; management-
# account cross-account pull is parked, see #152 for prior art).
# Pushed by qgi-pipeline CI/CD via github-actions-qgi-ecr-push role.
# ---------------------------------------------------------------------------
resource "aws_ecr_repository" "recipe_fleet" {
  name                 = "qgi-recipe-fleet"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# IAM — Batch job role (task role for the recipe-fleet container).
#
# Permissions: s3 get on parquet data prefix + s3 put on results/checkpoints.
# EXPLICITLY NO ATHENA — hard cost-safety requirement (design §3, §6).
# CloudWatch Logs write for awslogs driver.
#
# Inline in this module (not delegated to modules/iam) because the recipe-
# fleet's permission set is deliberately narrower than the general batch_job
# role in modules/iam/main.tf (which has full S3 + ECR + logs). Keeping it
# here makes the "no Athena" constraint self-documenting and auditable.
# ---------------------------------------------------------------------------
resource "aws_iam_role" "recipe_fleet_job" {
  name = "qgi-recipe-fleet-job-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "recipe_fleet_job" {
  name = "qgi-recipe-fleet-job-policy"
  role = aws_iam_role.recipe_fleet_job.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 — read indicator parquet panels (synced once per job).
      # Scoped to the data prefix only; no access to other bucket prefixes.
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:HeadObject"]
        Resource = "arn:aws:s3:::${var.data_lake_bucket_name}/${var.parquet_data_prefix}*"
      },
      # S3 — ListBucket for the parquet prefix so sync tools work.
      # Condition limits the list to the data prefix.
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.data_lake_bucket_name}"
        Condition = {
          StringLike = {
            "s3:prefix" = ["${var.parquet_data_prefix}*"]
          }
        }
      },
      # S3 — write ml-results + checkpoints. Put/Get own artifacts.
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:HeadObject", "s3:DeleteObject"]
        Resource = [
          "arn:aws:s3:::${var.data_lake_bucket_name}/${var.ml_results_prefix}*",
          "arn:aws:s3:::${var.data_lake_bucket_name}/${var.ml_checkpoints_prefix}*",
        ]
      },
      # S3 — ListBucket for results + checkpoints prefixes.
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.data_lake_bucket_name}"
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "${var.ml_results_prefix}*",
              "${var.ml_checkpoints_prefix}*",
            ]
          }
        }
      },
      # S3 — read recipe-manifest.json so the entrypoint can self-filter.
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:HeadObject"]
        Resource = "arn:aws:s3:::${var.data_lake_bucket_name}/${var.recipe_manifest_s3_key}"
      },
      # S3 — read reference artifacts the chain needs as INPUTS (the cohort
      # sidecar cohort-assignments.json the entrypoint downloads at startup; the
      # walk + LOCK gate + track_record require it). Caught by the 2026-05-24
      # canary: the entrypoint's cohort download 403'd without this grant.
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:HeadObject"]
        Resource = "arn:aws:s3:::${var.data_lake_bucket_name}/reference/*"
      },
      # CloudWatch Logs — Batch job logs via awslogs driver.
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:${var.aws_account_id}:log-group:/aws/batch/qgi-recipe-fleet:*"
      },
      # NOTE: NO Athena, NO Glue, NO DynamoDB.
      # The walk operates entirely on local parquet + S3 blobs.
      # Any Athena permission here would violate the hard cost-safety rule
      # (design §3, §6) and must NOT be added without a new design-doc amendment.
    ]
  })
}

# ---------------------------------------------------------------------------
# Batch compute environment — right-sized small Graviton Spot (design §2a).
#
# Instance pool spans c7g.large(2)→c7g.4xlarge(16) so the #962 per-recipe job sizes
# (small 4 / medium 8 / fat 16 vCPU) each place on a best-fit instance; m7g.large is a
# 2-vCPU capacity fallback. c7g.medium (1 vCPU) is EXCLUDED — no job is 1-vCPU. The earlier
# 2-vCPU-only pool was superseded by the FLEET-4 #964-ratified sizing (2026-05-27).
#
# SPOT_PRICE_CAPACITY_OPTIMIZED: the price-aware Batch strategy (AWS Batch has
# no "lowest_price" option — that's an EC2-Fleet term; valid Batch values are
# BEST_FIT / BEST_FIT_PROGRESSIVE / SPOT_CAPACITY_OPTIMIZED /
# SPOT_PRICE_CAPACITY_OPTIMIZED). This picks pools that are both low-price and
# low-interruption — the right realization of the §2a "cheapest Spot" intent,
# and strictly better than the scdi env's SPOT_CAPACITY_OPTIMIZED (which
# ignores price). The walk is single-threaded so a reclaim costs one resumed
# greedy step (minutes) anyway.
# ---------------------------------------------------------------------------
resource "aws_batch_compute_environment" "recipe_fleet_spot" {
  compute_environment_name = "qgi-recipe-fleet-spot"
  type                     = "MANAGED"
  state                    = "ENABLED"

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_PRICE_CAPACITY_OPTIMIZED"
    # FLEET-4/#962: SFN Map sets each job's VCPU from the manifest (small 4→c7g.xlarge /
    # medium 8→c7g.2xlarge / fat 16→c7g.4xlarge). c7g.large(2) covers only the job-def
    # DEFAULT (never submitted by a sized job); m7g.large is a 2-vCPU capacity fallback.
    # Batch (SPOT_PRICE_CAPACITY_OPTIMIZED) best-fits each job's vCPU to the cheapest pool.
    instance_type = ["c7g.large", "c7g.xlarge", "c7g.2xlarge", "c7g.4xlarge", "m7g.large"]

    min_vcpus = 0
    # FLEET-9 / Condition F STRUCTURAL COST CAP (the real $100 enforcement): this ceiling
    # bounds the worst-case burn — no Spot-retry storm can outrun it. INVARIANT any FLEET-4
    # raise MUST preserve (PR #33 review: the retry_strategy attempts=2 DOUBLES the bound —
    # a job can run attempts × attempt_duration of billed vCPU; and the SFN 40h ceiling does
    # NOT terminate already-running Batch jobs, so it is not a billing bound):
    #   max_vcpus × attempts × attempt_duration_h × ~$0.05  ≤  $100
    # FLEET-4 raised this 16→48 PAIRED with the attempt_duration cut 36h→18h below, keeping
    # the invariant: 48 × 2 attempts × 18 h × $0.05 ≈ $86 (under $100). $0.05/vCPU-hr is a
    # deliberately high (≈3×) Spot upper bound. The $100 DAILY budget (modules/storage
    # fleet_daily_100) is the monitor on top. 48 also throttles concurrent fat jobs (16 vCPU
    # each → ≤3 at once) regardless of the SFN MaxConcurrency.
    max_vcpus     = 48 # 48 × 2 attempts × 18 h × $0.05 ≈ $86 worst-case (under $100)
    desired_vcpus = 0  # scale-to-zero — nothing runs between fan-outs

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
resource "aws_batch_job_queue" "recipe_fleet" {
  name     = "qgi-recipe-fleet-queue"
  state    = "ENABLED"
  priority = 100

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.recipe_fleet_spot.arn
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# CloudWatch log group — must exist before first job (awslogs driver).
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "recipe_fleet" {
  name              = "/aws/batch/qgi-recipe-fleet"
  retention_in_days = 30
  tags              = var.tags
}

# ---------------------------------------------------------------------------
# Batch job definition — recipe-fleet walker (EC2 Spot, arm64).
#
# vcpus=2 / memory=4096: matches the XGBoost walk profile. The walk is
# single-threaded (§2a) so additional vCPUs are wasted. 4 GB comfortably
# holds the parquet panels (tens of MB) + XGBoost model + SHAP.
#
# Each job carries a RECIPE_IDS env var (comma-separated list of recipe_ids
# to run sequentially in that job). The entrypoint processes them in order,
# skipping any with an existing greedy-result.json in S3 (resume-aware).
# ---------------------------------------------------------------------------
resource "aws_batch_job_definition" "recipe_fleet_walker" {
  name = "qgi-recipe-fleet-walker-job"
  type = "container"

  platform_capabilities = ["EC2"]

  retry_strategy {
    # A Spot reclaim restarts the job; the S3 checkpoint guard means
    # already-completed recipes in the batch are skipped on restart.
    # #931: reduced 3 -> 2. One reclaim retry is enough; a SECOND failure is almost
    # certainly a data/code issue, not a transient reclaim. attempts is the multiplier in
    # the FLEET-9 structural cost cap (max_vcpus × attempts × attempt_duration_h × rate):
    # at 2 × 18 h it is the runaway-cost bound, since the SFN 40h ceiling does NOT kill a
    # running Batch job (see compute env max_vcpus note).
    attempts = 2
  }

  timeout {
    # FLEET-4: cut 36h→18h. With #961 parallelization + #962 sizing the slowest job (1 fat
    # recipe at 16 vCPU — elections was 21.8h SERIAL on a laptop → ~2-3h at 16 vCPU) finishes
    # well under 18h, so this is comfortable headroom AND the per-recipe wall-time bound. The
    # cut is what keeps the FLEET-9 cap holding at max_vcpus=48 (48 × 2 × 18 × $0.05 ≈ $86).
    attempt_duration_seconds = 64800
  }

  container_properties = jsonencode({
    image   = "${var.aws_account_id}.dkr.ecr.${var.region}.amazonaws.com/qgi-recipe-fleet:latest"
    command = ["python", "/app/recipe_fleet_entrypoint.py"]

    # Task role: the narrow recipe-fleet job role (no Athena).
    # Execution role: shared Fargate execution role for image-pull + logs.
    jobRoleArn       = aws_iam_role.recipe_fleet_job.arn
    executionRoleArn = var.fargate_execution_role_arn

    resourceRequirements = [
      { type = "VCPU", value = "2" },
      { type = "MEMORY", value = "4096" },
    ]

    # NB: runtimePlatform is Fargate-ONLY — AWS Batch rejects it on EC2-backed
    # job definitions ("runtimePlatform is only applicable for Fargate", apply
    # 2026-05-24). For EC2 Batch the arm64-ness comes from the Graviton instance
    # pool (c7g/m7g) + the arm64 ECS AMI that image_type=ECS_AL2 auto-selects for
    # Graviton; no runtimePlatform block is set (matches the scdi-finder EC2 job).

    environment = [
      # These are default/fallback values. The SFN Map overrides
      # RECIPE_IDS per-job via containerOverrides.
      { name = "S3_BUCKET", value = var.data_lake_bucket_name },
      { name = "PARQUET_DATA_PREFIX", value = var.parquet_data_prefix },
      { name = "ML_RESULTS_PREFIX", value = var.ml_results_prefix },
      { name = "ML_CHECKPOINTS_PREFIX", value = var.ml_checkpoints_prefix },
      { name = "RECIPE_MANIFEST_S3_KEY", value = var.recipe_manifest_s3_key },
      # RECIPE_IDS: comma-separated list of recipe_ids for this job.
      # Overridden per-job by the SFN Map state's Parameters.containerOverrides.
      { name = "RECIPE_IDS", value = "" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/aws/batch/qgi-recipe-fleet"
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "recipe-fleet"
      }
    }
  })

  tags = var.tags
}

# ---------------------------------------------------------------------------
# Lambda — post-pass (stub).
#
# Placeholder following the modules/pipeline/main.tf pattern (#153):
# raises RuntimeError on invocation so any accidental invocation of the
# undeployed stub is immediately visible in CloudWatch + SFN history.
# Real code is deployed by qgi-pipeline CI/CD.
#
# Responsibilities (when real code ships):
#   - Read all per-recipe result JSONs from s3://…/ml-results/
#   - Compute cross-recipe compound risk
#   - Tiered Recipe-Tracker rollup
#   - Per-country profiles + rankings
#   - Emit frontend country-risks.json
#   - Majles mechanical pre-digest (deterministic tier + gate pass/fail)
# ---------------------------------------------------------------------------
data "archive_file" "recipe_fleet_post_pass_placeholder" {
  type        = "zip"
  output_path = "${path.module}/post_pass_placeholder.zip"
  source {
    content  = <<-EOT
      """Placeholder for qgi-recipe-fleet-post-pass Lambda.
      Real code has not been deployed by CI/CD yet.
      See modules/recipe-fleet/main.tf for rationale (#153 pattern).
      Fix: trigger deploy-lambdas.yml in qgi-pipeline.
      """
      import os

      def lambda_handler(event, context):
          fn = os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "<unknown>")
          raise RuntimeError(
              f"PLACEHOLDER STUB STILL LIVE for Lambda '{fn}'. "
              f"Terraform created this function but CI/CD has not yet deployed "
              f"the real code. Trigger: `gh workflow run deploy-lambdas.yml "
              f"--repo AminAlAit/qgi-pipeline -f deploy_all=true` or push "
              f"any commit touching lambdas/recipe-fleet-post-pass/. #153."
          )
    EOT
    filename = "lambda_function.py"
  }
}

resource "aws_cloudwatch_log_group" "recipe_fleet_post_pass" {
  name              = "/aws/lambda/qgi-recipe-fleet-post-pass"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_lambda_function" "recipe_fleet_post_pass" {
  function_name    = "qgi-recipe-fleet-post-pass"
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.13"
  architectures    = ["arm64"]
  timeout          = 300
  memory_size      = 512
  filename         = data.archive_file.recipe_fleet_post_pass_placeholder.output_path
  source_code_hash = data.archive_file.recipe_fleet_post_pass_placeholder.output_base64sha256
  role             = var.lambda_execution_role_arn

  environment {
    variables = {
      S3_BUCKET           = var.data_lake_bucket_name
      ML_RESULTS_PREFIX   = var.ml_results_prefix
      RECIPE_MANIFEST_KEY = var.recipe_manifest_s3_key
    }
  }

  # CI/CD deploys real code; ignore placeholder filename/hash after first apply.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# SQS — durable carrier for the canary approval task-token (design §4).
#
# The "Await Founder Approval" SFN state sends the waitForTaskToken into this
# queue; the founder reads the token from the message and calls
# `aws stepfunctions send-task-success --task-token <token>`. A dedicated
# queue (not a shared pipeline queue) keeps the approval flow isolated and
# auditable. 14-day retention so a token survives a long approval wait.
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "recipe_fleet_approval" {
  name                       = "qgi-recipe-fleet-approval"
  message_retention_seconds  = 1209600 # 14 days — token must outlive approval wait
  visibility_timeout_seconds = 43200   # 12 h — this is a human-approval queue; a read
  # must not re-expose the token mid-review (review 2026-05-24). Not a processing queue.
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Step Functions — recipe fleet orchestrator.
#
# Flow:
#   0. Read Manifest (Pass — reads recipe_manifest_s3_key, pre-filter)
#   1. Choice: mode == "canary" → Canary Job
#              else            → Fleet Fan-out
#
# Canary path (MANDATORY — design §4):
#   Canary Job (single Batch job, 1 recipe)
#   → Await Founder Approval (waitForTaskToken — STRUCTURALLY blocks fan-out)
#   → Fleet Fan-out (Map over runnable recipes)
#   → Post-pass Lambda
#
# Fan-out path (direct, for subsequent runs where canary already approved):
#   Fleet Fan-out (Map over runnable recipes)
#   → Post-pass Lambda
#
# The waitForTaskToken token is passed as an env-var override to the canary
# Batch job. The entrypoint writes it to S3; the founder (or an automated
# approval script) calls `aws stepfunctions send-task-success --task-token`.
# This is STRUCTURAL: the Map state cannot start until the token is sent.
#
# SFN input schema (FLEET-4b — caller passes the manifest's SIZED runnable_jobs):
#   {
#     "mode": "canary" | "full",
#     "canary_recipe_id": "government_formation",    // canary mode only (use a FAT recipe)
#     "canary_vcpu": 16,                             // canary mode only — REQUIRED; vcpu for
#                                                    //   the canary (omitting it fails the
#                                                    //   States.Format intrinsic at runtime)
#     "runnable_jobs": [                             // from manifest.runnable_jobs (#962)
#       {"recipe_ids": "recipe_a,recipe_b", "vcpu": 8, "tier": "medium"},
#       {"recipe_ids": "recipe_c", "vcpu": 16, "tier": "fat"}
#     ]
#   }
#
# The SFN IAM role (var.stepfunctions_role_arn from modules/iam) already has
# Lambda:InvokeFunction on qgi-*, S3 read/write, and CloudWatch Logs.
# It needs Batch:SubmitJob for the recipe-fleet queue — see GUESS section
# in the module's outputs.tf comment block.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "recipe_fleet_sfn" {
  name              = "/aws/states/qgi-recipe-fleet"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_sfn_state_machine" "recipe_fleet" {
  name     = "qgi-recipe-fleet"
  role_arn = var.stepfunctions_role_arn

  # TimeoutSeconds: 40 h covers the worst-case serialized fleet
  # (~23 runnable recipes × ~5h median + elections at 22h). A timeout here
  # is a safety net; individual Batch jobs have their own 36 h per-attempt
  # limit. SFN executions are free after the first 4000 state transitions.
  definition = jsonencode({
    Comment        = "QGI recipe-fleet orchestrator — canary gate + serialized Map fan-out (design §1/§4)"
    TimeoutSeconds = 144000
    StartAt        = "Route by Mode"
    States = {

      # -----------------------------------------------------------------
      # Mode routing: canary (1 recipe + approval gate) vs full fan-out.
      # -----------------------------------------------------------------
      "Route by Mode" = {
        Type = "Choice"
        Choices = [{
          Variable     = "$.mode"
          StringEquals = "canary"
          Next         = "Run Canary Job"
        }]
        Default = "Fleet Fan-out"
      }

      # -----------------------------------------------------------------
      # CANARY PATH
      # Run a single Batch job for one recipe; pass the waitForTaskToken
      # as an env-var override so the job can record it in S3.
      # The Batch integration resource + .sync suffix waits for job
      # completion, then proceeds to the approval gate.
      # -----------------------------------------------------------------
      "Run Canary Job" = {
        Type     = "Task"
        Resource = "arn:aws:states:::batch:submitJob.sync"
        Parameters = {
          JobName       = "qgi-recipe-fleet-canary"
          JobQueue      = aws_batch_job_queue.recipe_fleet.arn
          JobDefinition = aws_batch_job_definition.recipe_fleet_walker.arn
          ContainerOverrides = {
            Environment = [
              { Name = "RECIPE_IDS", "Value.$" = "$.canary_recipe_id" },
              { Name = "RUN_MODE", Value = "canary" },
              # FLEET-4b: size the canary like a real fan-out job so it MEASURES the
              # parallelized cost/time honestly. The consult requires a FAT canary; at the
              # default 2 vCPU a fat recipe would run ~21h serial (useless + itself costly).
              # Caller passes $.canary_vcpu (e.g. 16 for a fat canary).
              { Name = "N_JOBS", "Value.$" = "States.Format('{}', $.canary_vcpu)" },
            ]
            ResourceRequirements = [
              { Type = "VCPU", "Value.$" = "States.Format('{}', $.canary_vcpu)" },
              { Type = "MEMORY", Value = "4096" },
            ]
          }
        }
        ResultPath = "$.canary_result"
        Retry = [{
          ErrorEquals     = ["Batch.BatchException", "States.TaskFailed"]
          IntervalSeconds = 60
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        Next = "Await Founder Approval"
      }

      # -----------------------------------------------------------------
      # APPROVAL GATE — MANDATORY (design §4).
      #
      # waitForTaskToken: SFN pauses here indefinitely until the founder
      # (or an automated script) calls:
      #   aws stepfunctions send-task-success \
      #     --task-token <token> \
      #     --task-output '{"approved": true}'
      #
      # The token is written to S3 by the canary entrypoint at key:
      #   ml-results/canary-task-token-{execution_name}.txt
      #
      # This gate is STRUCTURAL — the fan-out Map CANNOT start until
      # this state receives the token. It is not a checklist item.
      #
      # HeartbeatSeconds = 0 disables the heartbeat timeout so the SFN
      # execution can wait days for founder approval without timing out.
      # The execution-level TimeoutSeconds (40 h) still applies.
      # Remove HeartbeatSeconds or set a value if automated approval
      # is wired later (e.g., a Slack-button Lambda sends the token).
      # -----------------------------------------------------------------
      "Await Founder Approval" = {
        Type     = "Task"
        Resource = "arn:aws:states:::sqs:sendMessage.waitForTaskToken"
        # SQS is a convenient durable carrier for the token — it's
        # already available on the account (qgi-pipeline SQS queues).
        # However, we use a dedicated approval SQS here to avoid queue
        # pollution.  If founder prefers SNS+email or Slack, swap the
        # Resource to the appropriate integration and update the send
        # parameters.  The waitForTaskToken mechanic is unchanged.
        #
        # TODO (before first use): create the approval SQS queue and
        # wire its URL into this state, OR replace with an SNS/Lambda
        # approval flow. For now this is wired to a placeholder ARN that
        # will fail at plan time — see GUESS notes in outputs.tf.
        # SQS sendMessage.waitForTaskToken:
        # - QueueUrl must be the HTTPS URL form, not an ARN.
        # - MessageBody is a string; pass the task token directly so the
        #   founder (or an approval script) can read it from the SQS message
        #   and call `aws stepfunctions send-task-success --task-token <token>`.
        Parameters = {
          QueueUrl        = aws_sqs_queue.recipe_fleet_approval.url
          "MessageBody.$" = "$$.Task.Token"
        }
        ResultPath = "$.approval"
        Next       = "Fleet Fan-out"
      }

      # -----------------------------------------------------------------
      # FAN-OUT — Map over runnable_recipes array.
      #
      # MaxConcurrency=2: design §2a "serialize". Two concurrent jobs
      # keeps the Spot pool from fragmenting while still overlapping
      # I/O-bound S3 sync phases. Set to 1 for maximum serialization.
      #
      # Each item in runnable_recipes is a list of ~5 recipe_ids (pre-
      # batched by build_recipe_manifest.py into "job batches" so each
      # Map iteration = one Batch job covering multiple recipes).
      #
      # FLEET-4b: ItemsPath is "$.runnable_jobs" — the SIZED form from the manifest
      # (build_recipe_manifest #962). Each item = {recipe_ids, vcpu, tier, ...}; the caller
      # passes the manifest's runnable_jobs as the execution input (pre-filtered to N_pos>=60).
      # MaxConcurrency=5 (was 2): more overlap; actual concurrency is hard-bounded by the
      # compute env max_vcpus=48 (≤3 fat jobs at 16 vCPU), so this never exceeds the cost cap.
      # -----------------------------------------------------------------
      "Fleet Fan-out" = {
        Type           = "Map"
        ItemsPath      = "$.runnable_jobs"
        MaxConcurrency = 5
        ItemProcessor = {
          ProcessorConfig = {
            Mode = "INLINE"
          }
          StartAt = "Submit Batch Job"
          States = {
            "Submit Batch Job" = {
              Type     = "Task"
              Resource = "arn:aws:states:::batch:submitJob.sync"
              Parameters = {
                "JobName.$"   = "States.Format('qgi-recipe-fleet-{}', $$.Map.Item.Index)"
                JobQueue      = aws_batch_job_queue.recipe_fleet.arn
                JobDefinition = aws_batch_job_definition.recipe_fleet_walker.arn
                ContainerOverrides = {
                  Environment = [
                    {
                      Name      = "RECIPE_IDS"
                      "Value.$" = "$.recipe_ids" # comma-separated batch for this sized job
                    },
                    {
                      Name = "N_JOBS"
                      # #962: the per-job vCPU = the parallel walk's --n-jobs (#961).
                      "Value.$" = "States.Format('{}', $.vcpu)"
                    }
                  ]
                  # #962: size the Batch container to this job's tier. Both VCPU and MEMORY
                  # are restated (override REPLACES the job-def resourceRequirements by type;
                  # restating both avoids any merge-vs-replace ambiguity). MEMORY stays 4096:
                  # the walk needs little RAM (panels are tens of MB) and 4 GB fits every tier
                  # instance (c7g.xlarge 8 GB → c7g.4xlarge 32 GB) with ECS-agent headroom.
                  ResourceRequirements = [
                    {
                      Type      = "VCPU"
                      "Value.$" = "States.Format('{}', $.vcpu)"
                    },
                    {
                      Type  = "MEMORY"
                      Value = "4096"
                    }
                  ]
                }
              }
              ResultPath = "$.job_result"
              Retry = [{
                ErrorEquals     = ["Batch.BatchException", "States.TaskFailed"]
                IntervalSeconds = 120
                MaxAttempts     = 3
                BackoffRate     = 2
              }]
              End = true
            }
          }
        }
        ResultPath = "$.fleet_results"
        Next       = "Post-pass Lambda"
      }

      # -----------------------------------------------------------------
      # POST-PASS Lambda — cross-recipe aggregation + frontend outputs.
      # Stub today; real code deployed by CI/CD.
      # -----------------------------------------------------------------
      "Post-pass Lambda" = {
        Type     = "Task"
        Resource = aws_lambda_function.recipe_fleet_post_pass.arn
        Parameters = {
          "execution_name.$"  = "$$.Execution.Name"
          "s3_bucket"         = var.data_lake_bucket_name
          "ml_results_prefix" = var.ml_results_prefix
        }
        ResultPath = "$.post_pass_result"
        Retry = [{
          ErrorEquals     = ["Lambda.TooManyRequestsException", "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
          IntervalSeconds = 30
          MaxAttempts     = 5
          BackoffRate     = 2
        }]
        End = true
      }
    }
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.recipe_fleet_sfn.arn}:*"
    include_execution_data = false
    level                  = "ERROR"
  }

  tags = var.tags
}
