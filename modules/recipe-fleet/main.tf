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
# Instance pool: c7g.large (2 vCPU / 4 GB, compute-optimized) +
#   m7g.large (2 vCPU / 8 GB). Both are 2-vCPU — matching the job's VCPU=2.
# c7g.medium (1 vCPU) is deliberately EXCLUDED: a 2-vCPU job can never be
# placed on it, so it would be dead weight / a scheduling-confusion hazard
# (AWS-expert review 2026-05-24). The cost-rule amendment still permits
# c7g.medium for any future 1-vCPU job, but not this 2-vCPU walker.
# m7g.xlarge / m7g.2xlarge are NOT listed — the general restriction (design
# §2a) still applies; only this fleet's specific allow-list is used.
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
    instance_type       = ["c7g.large", "m7g.large"]

    min_vcpus = 0
    # FLEET-9 / Condition F STRUCTURAL COST CAP (the real $100 enforcement): this ceiling
    # bounds the worst-case burn — no Spot-retry storm can outrun it. INVARIANT any FLEET-4
    # raise MUST preserve (PR #33 review: the retry_strategy attempts=2 DOUBLES the bound —
    # a job can run attempts × attempt_duration of billed vCPU; and the SFN 40h ceiling does
    # NOT terminate already-running Batch jobs, so it is not a billing bound):
    #   max_vcpus × attempts × attempt_duration_h × ~$0.05  ≤  $100
    # Today: 16 × 2 × 36 h × $0.05 ≈ $58. To reach max_vcpus=48, FLEET-4 must ALSO cut
    # attempt_duration to 18 h (48 × 2 × 18 × 0.05 ≈ $86) — the timeout is the lever, not
    # just the vCPU count. $0.05/vCPU-hr is a deliberately high (≈3×) Spot upper bound.
    # The $100 DAILY budget (modules/storage fleet_daily_100) is the monitor on top.
    max_vcpus     = 16 # 16 × 2 attempts × 36 h × $0.05 ≈ $58 worst-case (well under $100)
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
    # #931: reduced 3 -> 2. One reclaim retry is enough; a SECOND failure is
    # almost certainly a data/code issue, not a transient reclaim — and 3
    # attempts × 36h = 108h of worst-case compute before the SFN execution
    # ceiling (40h) even applies. Two bounds the runaway-cost tail.
    attempts = 2
  }

  timeout {
    # elections_and_voting measured at 21.8 h on laptop. A 5-recipe
    # batch containing the slowest recipe could theoretically run ~30 h.
    # 36 h (129600 s) gives comfortable headroom while bounding runaway cost.
    attempt_duration_seconds = 129600
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
# SFN input schema:
#   {
#     "mode": "canary" | "full",
#     "canary_recipe_id": "foreign_intervention",    // only for canary mode
#     "runnable_recipes": ["recipe_a", "recipe_b"],  // list from manifest
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
      # InputPath "$.runnable_recipes" expects the input to have been
      # pre-filtered to the runnable tier (N_pos >= 60) — either by the
      # build_recipe_manifest.py Pass state or by the caller.
      # -----------------------------------------------------------------
      "Fleet Fan-out" = {
        Type           = "Map"
        ItemsPath      = "$.runnable_recipes"
        MaxConcurrency = 2
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
                  Environment = [{
                    Name = "RECIPE_IDS"
                    # Each item is a comma-separated batch of recipe_ids.
                    "Value.$" = "$"
                  }]
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
