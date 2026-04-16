# ---------------------------------------------------------------------------
# Lambda placeholder zip — used for initial Terraform apply only.
# Real code is deployed by qgi-pipeline CI/CD (deploy-lambdas.yml).
#
# lifecycle.ignore_changes on filename/source_code_hash means re-apply
# after CI/CD deploys real code will not revert it.
#
# IMPORTANT (#153): the placeholder MUST fail loudly on invocation. If a
# Lambda is recreated via TF (rename, immutable attribute change, etc.)
# and no commit subsequently touches its source dir, CI never re-deploys
# and the placeholder ships live. The previous placeholder returned
# {statusCode: 200, body: 'placeholder'}, looking like a successful
# response — Step Functions happily passed it downstream. The result was
# the 2026-04-08 pipeline-ops-batch-checker outage where every pipeline
# run silently broke for days because the checker returned a stub instead
# of {jobs_running: int}.
#
# This placeholder now raises a clear, descriptive RuntimeError on every
# invocation. Any pipeline run hitting a non-deployed Lambda will fail
# within seconds with a self-explanatory error in CloudWatch + the SF
# execution history. Recovery is one CI run away (commit+push or
# `gh workflow run deploy-lambdas.yml -f deploy_all=true`).
# ---------------------------------------------------------------------------
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"
  source {
    content  = <<-EOT
      """Placeholder for a TF-managed Lambda whose real code has not been
      deployed by CI/CD yet. See qgi-infra/modules/pipeline/main.tf for
      the rationale (#153). Fix: trigger deploy-lambdas.yml in qgi-pipeline.
      """
      import os

      def lambda_handler(event, context):
          fn = os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "<unknown>")
          raise RuntimeError(
              f"PLACEHOLDER STUB STILL LIVE for Lambda '{fn}'. "
              f"Terraform created or recreated this function but CI/CD "
              f"(qgi-pipeline deploy-lambdas.yml) has not yet deployed "
              f"the real code. Trigger a deploy with: "
              f"`gh workflow run deploy-lambdas.yml --repo AminAlAit/qgi-pipeline "
              f"-f deploy_all=true` or push any commit touching "
              f"lambdas/{fn.removeprefix('qgi-')}/. See #153."
          )
    EOT
    filename = "lambda_function.py"
  }
}

locals {
  # AWS SDK for Pandas layer — provides pandas, pyarrow, numpy, scipy, etc.
  # Pinned to version 1. Check for updates periodically but test before bumping.
  # https://aws-sdk-pandas.readthedocs.io/en/stable/layers.html
  aws_sdk_pandas_layer = "arn:aws:lambda:${var.region}:336392948345:layer:AWSSDKPandas-Python313-Arm64:1"

  lambda_defaults = {
    runtime          = "python3.13"
    architectures    = ["arm64"]
    filename         = data.archive_file.placeholder.output_path
    source_code_hash = data.archive_file.placeholder.output_base64sha256
    role             = var.lambda_execution_role_arn
    layers           = [local.aws_sdk_pandas_layer]
  }
  s3_output_location = "s3://${var.data_lake_bucket_name}/query_results/"

  # Standard retry for all Lambda Task states — handles transient throttles and
  # service errors that are common on new accounts with low burst limits.
  lambda_retry = [{
    ErrorEquals     = ["Lambda.TooManyRequestsException", "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
    IntervalSeconds = 30
    MaxAttempts     = 5
    BackoffRate     = 2
  }]
}

# ---------------------------------------------------------------------------
# Phase 0 — ops janitor (purges all queues before each run)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "ops_janitor" {
  function_name    = "qgi-pipeline-ops-janitor"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 512
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      QUEUE_URLS = join(",", [
        var.queue_a_main_url, var.queue_a_dlq_url,
        var.queue_b_main_url, var.queue_b_dlq_url,
        var.queue_c_main_url, var.queue_c_dlq_url,
      ])
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 1 — sheet fetcher (reads xlsx from S3, writes indicators.json)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "a_sheet_fetcher" {
  function_name    = "qgi-pipeline-a-sheet-fetcher"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      INPUT_BUCKET      = var.data_lake_bucket_name
      INPUT_KEY         = "pipeline-A-indicator-extractor/indicators/Pipeline A Dispatcher World Bank Indicators.xlsx"
      OUTPUT_BUCKET     = var.data_lake_bucket_name
      OUTPUT_KEY        = "indicators/indicators.json"
      INDICATOR_MAP_KEY = "pipeline-A-indicator-extractor/input/indicator_map.csv"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 1 legacy SQS path (a_dispatcher, a_checker, a_indicator_extractor,
# a_worker, a_worker_sqs event source mapping) was deleted as part of
# #FAR-1. Replaced by the Fargate Spot dispatcher + checker below. Phase 1
# now reads indicators.json directly from S3 in the dispatcher and fans
# out one Fargate task per indicator — no SQS, no Lambda workers.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Phase 1 — Fargate Spot indicator fetcher (#FAR-1)
#
# Replaces the legacy EC2 + SSM Run Command approach (which hit the SSM
# 1-hour command timeout at 36/52 indicators) with a fan-out to AWS Batch
# on Fargate Spot. One Fargate task per indicator. Each task gets its own
# ENI/public IP, sleeps a random 1-5 min before its WB API call, then
# fetches/transforms/uploads.
#
# Coordination uses a DDB counter (qgi-pipeline-a-counter) keyed on run_id.
# The dispatcher seeds the counter to N at submission time (race-free vs
# starting at 0 + incrementing). Each fetcher task decrements on exit
# (success OR failure — the script always exits 0). The checker Lambda
# polls the counter from the Step Function loop.
# ---------------------------------------------------------------------------

# --- Dispatcher Lambda — replaces a_ec2_trigger ---
resource "aws_lambda_function" "a_batch_dispatcher" {
  function_name    = "qgi-pipeline-a-batch-dispatcher"
  handler          = "lambda_function.lambda_handler"
  timeout          = 300
  memory_size      = 256
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      S3_BUCKET              = var.data_lake_bucket_name
      INDICATORS_KEY         = "pipeline-A-indicator-extractor/input/indicators.json"
      BATCH_JOB_QUEUE        = var.fetcher_job_queue_arn
      BATCH_JOB_DEFINITION   = var.fetcher_job_definition_arn
      COUNTER_TABLE          = var.pipeline_a_counter_table_name
      TRACKER_TABLE          = var.indicator_table_name
      INDICATOR_VALUES_TABLE = var.indicator_values_table_name
      ATHENA_DATABASE        = var.glue_database_name
      ATHENA_WORKGROUP       = var.athena_workgroup_name
      ATHENA_OUTPUT_LOCATION = local.s3_output_location
      JITTER_MIN_S           = tostring(var.phase1_jitter_min_s)
      JITTER_MAX_S           = tostring(var.phase1_jitter_max_s)
      DISPATCH_LIMIT         = tostring(var.dispatch_limit)
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# --- Checker Lambda — replaces a_checker for Phase 1 ---
resource "aws_lambda_function" "a_batch_checker" {
  function_name    = "qgi-pipeline-a-batch-checker"
  handler          = "lambda_function.lambda_handler"
  timeout          = 30
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      COUNTER_TABLE   = var.pipeline_a_counter_table_name
      # #178: scan-count checker reads tracker table instead of counter
      TRACKER_TABLE   = var.indicator_table_name
      DEADMAN_SECONDS = tostring(var.phase1_deadman_seconds)
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 1 — Batch failure handler (GH#243 PERMA FIX)
#
# When a fetcher Fargate task is hard-killed (timeout, OOM, Spot reclaim),
# the worker's `except` block never runs and no FAILED tracker row is
# written. The checker's `tracker_count >= total` completion logic stalls
# forever (until the 90-min L5 deadman fires).
#
# This Lambda subscribes to Batch JobStateChange=FAILED events on the
# fetcher queue, parses INDICATOR_ID + RUN_ID from the dead container's
# environment, and writes a FAILED tracker row. Closes the deadlock.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "a_batch_failure_handler" {
  function_name    = "qgi-pipeline-a-batch-failure-handler"
  handler          = "lambda_function.lambda_handler"
  timeout          = 30
  memory_size      = 256
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  description = "GH#243: writes FAILED tracker row on Batch hard-kill (timeout, OOM, Spot)"

  environment {
    variables = {
      TRACKER_TABLE = var.indicator_table_name
      COUNTER_TABLE = var.pipeline_a_counter_table_name
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

resource "aws_cloudwatch_event_rule" "a_batch_fetcher_failed" {
  name        = "qgi-pipeline-a-batch-fetcher-failed"
  description = "GH#243: routes Batch FAILED events from fetcher queue to failure-handler Lambda"

  event_pattern = jsonencode({
    source        = ["aws.batch"]
    "detail-type" = ["Batch Job State Change"]
    detail = {
      status   = ["FAILED"]
      jobQueue = [var.fetcher_job_queue_arn]
    }
  })

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "a_batch_failure_handler" {
  rule = aws_cloudwatch_event_rule.a_batch_fetcher_failed.name
  arn  = aws_lambda_function.a_batch_failure_handler.arn
}

resource "aws_lambda_permission" "allow_eventbridge_failure_handler" {
  statement_id  = "AllowEventBridgeInvokeFailureHandler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.a_batch_failure_handler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.a_batch_fetcher_failed.arn
}

# ---------------------------------------------------------------------------
# Phase 1 — reporter (queries DynamoDB, sends SNS, returns updated_ids)
# Note: reporter also invokes b-orchestrator directly (known prod behaviour,
# kept for parity — means orchestrator is called twice when Step Functions
# also routes to Phase 2. Track fix in qgi-pipeline).
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "a_reporter" {
  function_name    = "qgi-pipeline-a-reporter"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      SNS_TOPIC_ARN  = var.sns_topic_arn
      PIPELINE_B_ARN = aws_lambda_function.b_orchestrator.arn
      # #FAR-1: tables read by the detailed email reporter
      TRACKER_TABLE = var.indicator_table_name
      COUNTER_TABLE = var.pipeline_a_counter_table_name
      # #175: write fetch manifest to S3 for the decoupled Main SF
      S3_BUCKET    = var.data_lake_bucket_name
      MANIFEST_KEY = "indicator-freshness/latest-fetch-manifest.json"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 1.5 — indicator completer (ETS self-prediction for missing recent years)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "a_completer" {
  function_name    = "qgi-pipeline-a-completer"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 1024
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET         = var.data_lake_bucket_name
      INPUT_PREFIX      = "pipeline-A-indicator-extractor/output/parquet"
      OUTPUT_PREFIX     = "pipeline-A-indicator-extractor/output/parquet-completed"
      INDICATOR_MAP_KEY = "pipeline-A-indicator-extractor/input/indicator_map.csv"
      ATHENA_DATABASE   = var.glue_database_name
      ATHENA_WORKGROUP  = var.athena_workgroup_name
      # #148: name of the DDB table to mirror indicator values into
      INDICATOR_VALUES_TABLE_NAME = var.indicator_values_table_name
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 2 — Batch orchestrator (launches one Batch job per updated indicator)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "b_orchestrator" {
  function_name    = "qgi-pipeline-b-scdi-finder-batch-orchestrator"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 512
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET            = var.data_lake_bucket_name
      S3_INPUT_PREFIX      = "pipeline-A-indicator-extractor/output/parquet-completed/"
      BATCH_JOB_QUEUE      = "qgi-pipeline-b-high-priority-queue"
      BATCH_JOB_DEFINITION = "scdi-finder-job"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 2 — batch checker (polls Batch job queue, called by Step Functions)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "ops_batch_checker" {
  function_name    = "qgi-pipeline-ops-batch-checker"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      JOB_QUEUE = var.batch_job_queue_arn
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 2 — b dispatcher (alternative fan-out path, not in Step Functions ASL)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "b_dispatcher" {
  function_name    = "qgi-pipeline-b-dispatcher"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET       = var.data_lake_bucket_name
      S3_INPUT_PREFIX = "pipeline-A-indicator-extractor/output/parquet-completed/"
      SQS_QUEUE_URL   = var.queue_b_main_url
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 2 — scdi finder Lambda (lightweight version for small runs)
# Not in Step Functions — triggered manually or via b-dispatcher.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "b_scdi_finder" {
  function_name    = "qgi-pipeline-b-scdi-finder"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET             = var.data_lake_bucket_name
      S3_INPUT_PREFIX       = "pipeline-A-indicator-extractor/output/parquet-completed/"
      S3_OUTPUT_PREFIX      = "pipeline-B-scdi-finder/scdis"
      MIN_LENGTH            = "3"
      CORRELATION_THRESHOLD = "0.5"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 4 — c dispatcher (fans out one SQS message per country)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "c_dispatcher" {
  function_name    = "qgi-pipeline-c-dispatcher"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET             = var.data_lake_bucket_name
      ATHENA_DATABASE       = var.glue_database_name
      COUNTRIES_NAMES_TABLE = "countries"
      SCDIS_TABLE           = "scdis"
      ATHENA_WORKGROUP      = var.athena_workgroup_name
      S3_OUTPUT_LOCATION    = local.s3_output_location
      SQS_QUEUE_URL         = var.queue_c_main_url
      COMPLETION_TABLE      = var.completion_table_name
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 4 — c worker (SQS-triggered, runs Athena INSERT per country)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "c_worker" {
  function_name    = "qgi-pipeline-c-worker"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 256
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET             = var.data_lake_bucket_name
      ATHENA_DATABASE       = var.glue_database_name
      SCDIS_TABLE           = "scdis"
      COUNTRIES_NAMES_TABLE = "countries"
      ATHENA_WORKGROUP      = var.athena_workgroup_name
      S3_OUTPUT_LOCATION    = local.s3_output_location
      SQS_QUEUE_URL         = var.queue_c_main_url
      COMPLETION_TABLE      = var.completion_table_name
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "c_worker_sqs" {
  event_source_arn                   = var.queue_c_main_arn
  function_name                      = aws_lambda_function.c_worker.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  enabled                            = true
}

# ---------------------------------------------------------------------------
# Phase 4 — completion checker (polls qgi-completion-counters instead of hard wait)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "c_checker" {
  function_name    = "qgi-pipeline-c-checker"
  handler          = "lambda_function.lambda_handler"
  timeout          = 30
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      COMPLETION_TABLE = var.completion_table_name
      S3_BUCKET        = var.data_lake_bucket_name
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 4/5 — c DLQ inspector
# Fixes prod bug: prod used non-existent 'countries_parquet' table.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "c_dlq_inspector" {
  function_name    = "qgi-pipeline-c-dlq-inspector"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      DLQ_URL               = var.queue_c_dlq_url
      S3_BUCKET             = var.data_lake_bucket_name
      ATHENA_DATABASE       = var.glue_database_name
      COUNTRIES_NAMES_TABLE = "countries"
      ATHENA_WORKGROUP      = var.athena_workgroup_name
      S3_OUTPUT_LOCATION    = local.s3_output_location
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "c_dlq_inspector_sqs" {
  event_source_arn = var.queue_c_dlq_arn
  function_name    = aws_lambda_function.c_dlq_inspector.arn
  batch_size       = 1
  enabled          = true
}

# ---------------------------------------------------------------------------
# Phase 5 — DLQ scanner (scans all DLQs, sends SNS summary)
# Expanded from prod: prod only scanned a+b DLQs; now includes c.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "ops_dlq_scanner" {
  function_name    = "qgi-pipeline-ops-dlq-scanner"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      DLQ_URLS      = join(",", [var.queue_a_dlq_url, var.queue_b_dlq_url, var.queue_c_dlq_url])
      SNS_TOPIC_ARN = var.sns_topic_arn
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 5 — Recipe engine (matches patterns + events → recipes)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "recipe_engine" {
  function_name    = "qgi-pipeline-recipe-engine"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 1024
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET          = var.data_lake_bucket_name
      ATHENA_DATABASE    = var.glue_database_name
      ATHENA_WORKGROUP   = var.athena_workgroup_name
      S3_OUTPUT_LOCATION = local.s3_output_location
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 5 — Recipe Engine List Formatter (#162 Layer 2)
#
# Tiny Lambda (~20 lines of real work) that parses the Athena query results
# from the "5b.2. Enumerate country_a_ids" state and pre-generates all
# per-country SQL strings (one CTAS for the smallest-by-pattern-count
# country, and INSERTs for the rest). Does NO Athena execution itself.
# Max wall time: ~10 seconds.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "recipe_engine_list_formatter" {
  function_name    = "qgi-pipeline-recipe-engine-list-formatter"
  handler          = "lambda_function.lambda_handler"
  timeout          = 60
  memory_size      = 256
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      ATHENA_DATABASE    = var.glue_database_name
      ATHENA_WORKGROUP   = var.athena_workgroup_name
      S3_OUTPUT_LOCATION = local.s3_output_location
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 5 — Recipe Engine Finalize (#162 Layer 2)
#
# Post-write Lambda: runs AFTER the Map state has populated all recipe
# partitions. Responsibilities: count/category stats, recipes_normalized
# view (#158 follow-up), convergence view (#133), dashboard JSONs (#146).
# All bounded aggregates on the finished recipes table: ~2-3 min wall time.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "recipe_engine_finalize" {
  function_name    = "qgi-pipeline-recipe-engine-finalize"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 1024
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      S3_BUCKET          = var.data_lake_bucket_name
      ATHENA_DATABASE    = var.glue_database_name
      ATHENA_WORKGROUP   = var.athena_workgroup_name
      S3_BUCKET          = var.data_lake_bucket_name
      S3_OUTPUT_LOCATION = local.s3_output_location
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# #175: Indicator manifest reader (decoupled pipeline)
#
# Reads the fetch manifest from S3 and returns it for the Main SF.
# ~35 LOC, no external dependencies, <1 second wall time.
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "indicator_manifest_reader" {
  function_name    = "qgi-pipeline-indicator-manifest-reader"
  handler          = "lambda_function.lambda_handler"
  timeout          = 30
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      S3_BUCKET    = var.data_lake_bucket_name
      MANIFEST_KEY = "indicator-freshness/latest-fetch-manifest.json"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Utility — Batch job terminator (Step Function + Lambda fan-out)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "batch_job_terminator" {
  function_name    = "qgi-batch-job-terminator"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 512
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role
  layers           = local.lambda_defaults.layers

  environment {
    variables = {
      BATCH_JOB_QUEUE = "qgi-pipeline-b-high-priority-queue"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

resource "aws_sfn_state_machine" "batch_job_terminator" {
  name     = "qgi-batch-job-terminator"
  role_arn = var.stepfunctions_role_arn

  definition = jsonencode({
    Comment = "Kill all active AWS Batch jobs. List → S3 chunks → parallel Map kill → Report."
    StartAt = "List Active Jobs"
    States = {

      "List Active Jobs" = {
        Type     = "Task"
        Resource = aws_lambda_function.batch_job_terminator.arn
        Parameters = {
          mode       = "list"
          reason     = "Terminated by Step Function."
          bucket     = var.data_lake_bucket_name
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.listing"
        Next       = "Any Jobs?"
      }

      "Any Jobs?" = {
        Type = "Choice"
        Choices = [{
          Variable           = "$.listing.total_jobs"
          NumericGreaterThan = 0
          Next               = "Kill All Chunks"
        }]
        Default = "No Jobs Found"
      }

      "No Jobs Found" = {
        Type    = "Succeed"
        Comment = "Nothing to kill."
      }

      "Kill All Chunks" = {
        Type           = "Map"
        ItemsPath      = "$.listing.chunk_indices"
        MaxConcurrency = 10
        ItemProcessor = {
          ProcessorConfig = {
            Mode = "INLINE"
          }
          StartAt = "Kill Chunk"
          States = {
            "Kill Chunk" = {
              Type     = "Task"
              Resource = aws_lambda_function.batch_job_terminator.arn
              Parameters = {
                mode            = "kill"
                reason          = "Terminated by Step Function."
                bucket          = var.data_lake_bucket_name
                "run_id.$"      = "$$.Execution.Name"
                "chunk_index.$" = "$.chunk_index"
              }
              End = true
              Retry = [{
                ErrorEquals     = ["States.ALL"]
                IntervalSeconds = 10
                MaxAttempts     = 3
                BackoffRate     = 2
              }]
            }
          }
        }
        ResultPath = "$.kill_results"
        Next       = "Report"
      }

      "Report" = {
        Type     = "Task"
        Resource = aws_lambda_function.batch_job_terminator.arn
        Parameters = {
          mode = "report"
        }
        ResultPath = "$.report"
        Next       = "Done"
      }

      "Done" = {
        Type = "Succeed"
      }
    }
  })

  tags = var.tags
}

# ---------------------------------------------------------------------------
# Step Functions — Fetch SF (#175: decoupled indicator data refresher)
#
# Standalone SF that fetches indicator data from WB/FAOSTAT/ILOSTAT,
# writes parquets to S3, and produces a manifest JSON for the Main SF.
# Runs monthly via EventBridge or manually. Does NOT process SCDIs/patterns.
# ---------------------------------------------------------------------------
resource "aws_sfn_state_machine" "fetch_pipeline" {
  name     = "qgi-indicator-data-refresher"
  role_arn = var.stepfunctions_role_arn

  definition = jsonencode({
    Comment = "QGI Fetch Pipeline (#175) — fetches indicator data, writes manifest"
    StartAt = "F.0 Fetch XLSX"
    States = {
      "F.0 Fetch XLSX" = {
        Type       = "Task"
        Resource   = aws_lambda_function.a_sheet_fetcher.arn
        ResultPath = "$.fetcher_output"
        Retry      = local.lambda_retry
        Next       = "F.1 Dispatch Fargate"
      }

      "F.1 Dispatch Fargate" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_batch_dispatcher.arn
        Parameters = {
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.dispatch_output"
        Retry      = local.lambda_retry
        Next       = "F.2 Wait 2m"
      }

      "F.2 Wait 2m" = {
        Type    = "Wait"
        Seconds = 120
        Next    = "F.3 Check Counter"
      }

      "F.3 Check Counter" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_batch_checker.arn
        Parameters = {
          "run_id.$"            = "$$.Execution.Name"
          "phase1_started_at.$" = "$.dispatch_output.phase1_started_at"
          "total.$"             = "$.dispatch_output.total"
        }
        ResultPath = "$.check"
        Retry      = local.lambda_retry
        Next       = "F.4 Fetchers Done?"
      }

      "F.4 Fetchers Done?" = {
        Type = "Choice"
        Choices = [{
          Variable      = "$.check.done"
          BooleanEquals = true
          Next          = "F.5 Report"
        }]
        Default = "F.2 Wait 2m"
      }

      # Reporter now writes manifest to S3 (#175) so the Main SF
      # can read it via the manifest-reader Lambda.
      "F.5 Report" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_reporter.arn
        Parameters = {
          "run_id.$"          = "$$.Execution.Name"
          "deadman_expired.$" = "$.check.deadman_expired"
          "total.$"           = "$.check.total"
          "done.$"            = "$.check.done"
          "pending.$"         = "$.check.pending"
        }
        ResultPath = "$.reporter_result"
        Retry      = local.lambda_retry
        End        = true
      }
    }
  })

  tags = var.tags
}

# ---------------------------------------------------------------------------
# EventBridge Scheduler — Fetch SF monthly (#175)
# DISABLED by default. Enable after first manual verification.
# ---------------------------------------------------------------------------
resource "aws_scheduler_schedule" "fetch_monthly" {
  name       = "qgi-indicator-data-refresher-1st"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(0 6 1 * ? *)"
  schedule_expression_timezone = "Europe/Berlin"

  state = "DISABLED"

  target {
    arn      = aws_sfn_state_machine.fetch_pipeline.arn
    role_arn = var.eventbridge_scheduler_role_arn
  }
}

# ---------------------------------------------------------------------------
# Step Functions — Main pipeline state machine
#
# Changes vs production:
# - Phase 3: Glue crawler replaced with MSCK REPAIR TABLE scdis (issue #66)
# - Phase 4 MSCK uses QGI-Lambda-Workgroup (prod used hardcoded 'primary')
# - All ARNs are environment-specific (no management account hardcoding)
# ---------------------------------------------------------------------------
resource "aws_sfn_state_machine" "pipeline" {
  name     = "qgi-indicator-monthly-updater"
  role_arn = var.stepfunctions_role_arn

  definition = jsonencode({
    Comment = "QGI Monthly Pipeline — stages 0-6"
    StartAt = "0. Janitor"
    States = {
      "0. Janitor" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_janitor.arn
        ResultPath = "$.janitor_output"
        Retry      = local.lambda_retry
        Next       = "Route by Mode"
      }

      # -----------------------------------------------------------------
      # #175: Mode routing — decoupled pipeline supports three run modes.
      #
      # Input: {"mode": "full"|"recipes_only"|"dashboards_only",
      #         "force_full_run": bool (optional, default false)}
      #
      # "full" (default): read manifest → completer → SCDI → patterns → recipes → report
      # "recipes_only":   skip phases 1-4, jump to 5b (recipe engine)
      # "dashboards_only": just regenerate the 3 dashboard JSONs from current recipes
      # -----------------------------------------------------------------
      "Route by Mode" = {
        Type = "Choice"
        Choices = [
          {
            Variable     = "$.mode"
            StringEquals = "recipes_only"
            Next         = "5b.1. Drop Recipes Table"
          },
          {
            Variable     = "$.mode"
            StringEquals = "dashboards_only"
            Next         = "Finalize Dashboards"
          }
        ]
        Default = "1a. Fetch Indicators XLSX"
      }

      # dashboards_only: invoke finalize directly, skip everything else
      "Finalize Dashboards" = {
        Type     = "Task"
        Resource = aws_lambda_function.recipe_engine_finalize.arn
        Parameters = {
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.recipe_finalize_output"
        Retry      = local.lambda_retry
        Next       = "6. Ops Report"
      }

      "1a. Fetch Indicators XLSX" = {
        Type       = "Task"
        Resource   = aws_lambda_function.a_sheet_fetcher.arn
        ResultPath = "$.fetcher_output"
        Retry      = local.lambda_retry
        Next       = "1-manifest. Read Fetch Manifest"
      }

      # #175: Reads the fetch manifest from S3 (written by the separate
      # Fetch SF qgi-indicator-data-refresher). Returns updated_ids +
      # all_indicator_ids. If force_full_run=true, overrides updated_ids
      # with all indicators for a full recompute.
      #
      # Output goes to $.reporter_result so all downstream states (1g,
      # 1h, 2a) work unchanged — they already reference
      # $.reporter_result.updated_ids and $.reporter_result.updated_count.
      "1-manifest. Read Fetch Manifest" = {
        Type       = "Task"
        Resource   = aws_lambda_function.indicator_manifest_reader.arn
        InputPath  = "$"
        ResultPath = "$.reporter_result"
        Retry      = local.lambda_retry
        Next       = "1g. Complete Indicator Series"
      }

      # #157: pass updated_ids into the completer so it only mirrors
      # changed indicators to qgi-indicator-values DDB.
      "1g. Complete Indicator Series" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_completer.arn
        Parameters = {
          "run_id.$"      = "$$.Execution.Name"
          "updated_ids.$" = "$.reporter_result.updated_ids"
        }
        ResultPath = "$.completer_result"
        Retry      = local.lambda_retry
        Next       = "1h. Updates Found?"
      }

      "1h. Updates Found?" = {
        Type = "Choice"
        Choices = [{
          Variable           = "$.reporter_result.updated_count"
          NumericGreaterThan = 0
          Next               = "2a. Dispatch SCDI Batch"
        }]
        Default = "6. Ops Report"
      }

      "2a. Dispatch SCDI Batch" = {
        Type     = "Task"
        Resource = aws_lambda_function.b_orchestrator.arn
        Parameters = {
          mode              = var.batch_invoke_mode
          "indicator_ids.$" = "$.reporter_result.updated_ids"
        }
        ResultPath = "$.trigger_b_output"
        Retry      = local.lambda_retry
        Next       = "2b. Wait 2m (SCDI Poll)"
      }

      # #167: replaced 30m hard wait with 2m poll loop (matches Phase 1 pattern).
      # Saves 20+ min of dead time on small test runs (3-indicator runs finish
      # in ~5 min but the old 30m wait sat idle). On full 60-indicator runs,
      # Batch takes ~20-30 min so the poll loop checks ~15 times and exits
      # within a minute of completion instead of waiting for the next 30m tick.
      "2b. Wait 2m (SCDI Poll)" = {
        Type    = "Wait"
        Seconds = 120
        Next    = "2c. Check SCDI Batch"
      }

      "2c. Check SCDI Batch" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_batch_checker.arn
        ResultPath = "$.batch_status"
        Retry      = local.lambda_retry
        Next       = "2d. SCDI Done?"
      }

      "2d. SCDI Done?" = {
        Type = "Choice"
        Choices = [{
          Variable           = "$.batch_status.jobs_running"
          NumericGreaterThan = 0
          Next               = "2b. Wait 2m (SCDI Poll)"
        }]
        Default = "3. Athena MSCK scdis"
      }

      # Phase 3: replaced Glue crawler with MSCK REPAIR TABLE scdis (issue #66)
      # Faster, cheaper (~$0), and avoids Glue crawler $0.44/DPU-hour cost.
      "3. Athena MSCK scdis" = {
        Type     = "Task"
        Resource = "arn:aws:states:::athena:startQueryExecution.sync"
        Parameters = {
          QueryString = "MSCK REPAIR TABLE `${var.glue_database_name}`.`scdis`;"
          WorkGroup   = var.athena_workgroup_name
          QueryExecutionContext = {
            Database = var.glue_database_name
          }
          ResultConfiguration = {
            OutputLocation = local.s3_output_location
          }
        }
        ResultPath = "$.repair_scdis_output"
        Next       = "4a. Dispatch Pattern Synth"
      }

      "4a. Dispatch Pattern Synth" = {
        Type     = "Task"
        Resource = aws_lambda_function.c_dispatcher.arn
        Parameters = {
          action     = "start"
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.dispatch_c_output"
        Retry      = local.lambda_retry
        Next       = "4b. Wait 30s (Pattern Poll)"
      }

      "4b. Wait 30s (Pattern Poll)" = {
        Type    = "Wait"
        Seconds = 30
        Next    = "4c. Check Pattern Counter"
      }

      "4c. Check Pattern Counter" = {
        Type     = "Task"
        Resource = aws_lambda_function.c_checker.arn
        Parameters = {
          "run_id.$"   = "$$.Execution.Name"
          "expected.$" = "$.dispatch_c_output.dispatched_count"
        }
        ResultPath = "$.c_check"
        Retry      = local.lambda_retry
        Next       = "4d. Patterns Done?"
      }

      "4d. Patterns Done?" = {
        Type = "Choice"
        Choices = [{
          Variable      = "$.c_check.done"
          BooleanEquals = true
          Next          = "4e. Athena MSCK patterns"
        }]
        Default = "4b. Wait 30s (Pattern Poll)"
      }

      "4e. Athena MSCK patterns" = {
        Type     = "Task"
        Resource = "arn:aws:states:::athena:startQueryExecution.sync"
        Parameters = {
          QueryString = "MSCK REPAIR TABLE `${var.glue_database_name}`.`patterns`;"
          WorkGroup   = var.athena_workgroup_name
          QueryExecutionContext = {
            Database = var.glue_database_name
          }
          ResultConfiguration = {
            OutputLocation = local.s3_output_location
          }
        }
        ResultPath = "$.repair_patterns_output"
        Next       = "5a. Athena MSCK events"
      }

      # Phase 5: Recipe engine — match patterns against events (D4/D5)
      "5a. Athena MSCK events" = {
        Type     = "Task"
        Resource = "arn:aws:states:::athena:startQueryExecution.sync"
        Parameters = {
          QueryString = "MSCK REPAIR TABLE `${var.glue_database_name}`.`events`;"
          WorkGroup   = var.athena_workgroup_name
          QueryExecutionContext = {
            Database = var.glue_database_name
          }
          ResultConfiguration = {
            OutputLocation = local.s3_output_location
          }
        }
        ResultPath = "$.repair_events_output"
        Next       = "5b.1. Drop Recipes Table"
      }

      # -----------------------------------------------------------------
      # Phase 5b: Recipe Engine (#162 Layer 2)
      #
      # Replaces the single monolithic recipe-engine Lambda that timed out
      # at 900s with a 6-state chain. Athena queries now run via SF native
      # .sync integration (no Lambda 15-min ceiling). Per-country INSERTs
      # fan out via Map state at concurrency 20.
      #
      # Flow:
      #   5b.1 DROP TABLE recipes     (Athena .sync)
      #   5b.2 Enumerate country_ids  (Athena .sync, sorted by pattern count)
      #   5b.3 List Formatter Lambda  (parse results, pre-gen SQL strings)
      #   5b.4 Seed CTAS              (Athena .sync, smallest country)
      #   5b.5 Map per-country INSERT (Athena .sync × 20, idempotent)
      #   5b.6 Finalize Lambda        (views + dashboard JSONs)
      # -----------------------------------------------------------------

      "5b.1. Drop Recipes Table" = {
        Type     = "Task"
        Resource = "arn:aws:states:::athena:startQueryExecution.sync"
        Parameters = {
          QueryString           = "DROP TABLE IF EXISTS `${var.glue_database_name}`.`recipes`;"
          WorkGroup             = var.athena_workgroup_name
          QueryExecutionContext = { Database = var.glue_database_name }
          ResultConfiguration   = { OutputLocation = local.s3_output_location }
        }
        ResultPath = "$.drop_recipes_output"
        Retry = [{
          ErrorEquals     = ["States.ALL"]
          IntervalSeconds = 5
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        # 5b.2 removed: Athena .sync doesn't support plain SELECT.
        # The enumerate query now runs inside 5b.3 (list-formatter Lambda).
        Next = "5b.3. List Formatter"
      }

      "5b.3. List Formatter" = {
        Type     = "Task"
        Resource = aws_lambda_function.recipe_engine_list_formatter.arn
        Parameters = {
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.recipe_list"
        Retry      = local.lambda_retry
        Next       = "5b.4. Seed CTAS"
      }

      "5b.4. Seed CTAS" = {
        Type     = "Task"
        Resource = "arn:aws:states:::athena:startQueryExecution.sync"
        Parameters = {
          "QueryString.$"       = "$.recipe_list.seed_sql"
          WorkGroup             = var.athena_workgroup_name
          QueryExecutionContext = { Database = var.glue_database_name }
          ResultConfiguration   = { OutputLocation = local.s3_output_location }
        }
        ResultPath = "$.seed_ctas_output"
        Retry = [{
          ErrorEquals     = ["States.ALL"]
          IntervalSeconds = 10
          MaxAttempts     = 1
          BackoffRate     = 1
        }]
        Next = "5b.5. Per-Country INSERTs"
      }

      "5b.5. Per-Country INSERTs" = {
        Type           = "Map"
        MaxConcurrency = 20
        ItemReader = {
          Resource     = "arn:aws:states:::s3:getObject"
          ReaderConfig = {
            InputType = "JSON"
          }
          Parameters = {
            "Bucket.$" = "$.recipe_list.insert_items_bucket"
            "Key.$"    = "$.recipe_list.insert_items_key"
          }
        }
        ItemProcessor = {
          ProcessorConfig = {
            Mode = "DISTRIBUTED"
            ExecutionType = "STANDARD"
          }
          StartAt = "Drop Partition"
          States = {
            "Drop Partition" = {
              Type     = "Task"
              Resource = "arn:aws:states:::athena:startQueryExecution.sync"
              Parameters = {
                "QueryString.$"       = "$.drop_partition_sql"
                WorkGroup             = var.athena_workgroup_name
                QueryExecutionContext = { Database = var.glue_database_name }
                ResultConfiguration   = { OutputLocation = local.s3_output_location }
              }
              ResultPath = "$.drop_output"
              Retry = [{
                ErrorEquals     = ["States.ALL"]
                IntervalSeconds = 5
                MaxAttempts     = 2
                BackoffRate     = 2
              }]
              Next = "Run INSERT"
            }
            "Run INSERT" = {
              Type     = "Task"
              Resource = "arn:aws:states:::athena:startQueryExecution.sync"
              Parameters = {
                "QueryString.$"       = "$.insert_sql"
                WorkGroup             = var.athena_workgroup_name
                QueryExecutionContext = { Database = var.glue_database_name }
                ResultConfiguration   = { OutputLocation = local.s3_output_location }
              }
              ResultPath = "$.insert_output"
              Retry = [{
                ErrorEquals     = ["States.ALL"]
                IntervalSeconds = 10
                MaxAttempts     = 2
                BackoffRate     = 2
              }]
              End = true
            }
          }
        }
        # #162 review issue 3: ToleratedFailurePercentage 0 means any
        # single per-country failure fails the whole Map immediately.
        # Zombie queries from in-flight iterations will keep running on
        # Athena (SF doesn't cancel them). Acceptable: they'll finish
        # harmlessly; the next pipeline run's DROP TABLE cleans up.
        # A cleanup Lambda (Catch → StopQueryExecution on survivors)
        # can be added later if the zombie cost is material.
        ToleratedFailurePercentage = 0
        ResultPath                 = "$.map_results"
        Next                       = "5b.6. Finalize"
      }

      "5b.6. Finalize" = {
        Type     = "Task"
        Resource = aws_lambda_function.recipe_engine_finalize.arn
        Parameters = {
          "run_id.$"           = "$$.Execution.Name"
          "partitions_total.$" = "$.recipe_list.partitions_total"
        }
        ResultPath = "$.recipe_finalize_output"
        Retry      = local.lambda_retry
        Next       = "5c. Athena MSCK recipes"
      }

      "5c. Athena MSCK recipes" = {
        Type     = "Task"
        Resource = "arn:aws:states:::athena:startQueryExecution.sync"
        Parameters = {
          QueryString = "MSCK REPAIR TABLE `${var.glue_database_name}`.`recipes`;"
          WorkGroup   = var.athena_workgroup_name
          QueryExecutionContext = {
            Database = var.glue_database_name
          }
          ResultConfiguration = {
            OutputLocation = local.s3_output_location
          }
        }
        ResultPath = "$.repair_recipes_output"
        Next       = "6. Ops Report"
      }

      "6. Ops Report" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_dlq_scanner.arn
        ResultPath = "$.dlq_report"
        Retry      = local.lambda_retry
        Next       = "Complete"
      }

      "Complete" = {
        Type = "Succeed"
      }
    }
  })

  tags = var.tags
}

# ---------------------------------------------------------------------------
# EventBridge Scheduler — 1st of month, 06:00 Europe/Berlin
# DISABLED by default in all environments.
# Enable manually or via CI/CD gate after verifying a successful staging run.
# ---------------------------------------------------------------------------
resource "aws_scheduler_schedule" "monthly" {
  name       = "qgi-indicator-monthly-updater-1st"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(0 6 1 * ? *)"
  schedule_expression_timezone = "Europe/Berlin"

  state = "DISABLED"

  target {
    arn      = aws_sfn_state_machine.pipeline.arn
    role_arn = var.eventbridge_scheduler_role_arn
  }
}
