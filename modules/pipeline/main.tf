# ---------------------------------------------------------------------------
# Lambda placeholder zip — used for initial Terraform apply only.
# Real code is deployed by qgi-pipeline CI/CD (deploy-lambdas.yml).
# lifecycle.ignore_changes on filename/source_code_hash means re-apply
# after CI/CD deploys real code will not revert it.
# ---------------------------------------------------------------------------
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"
  source {
    content  = "def lambda_handler(event, context): return {'statusCode': 200, 'body': 'placeholder'}"
    filename = "lambda_function.py"
  }
}

locals {
  # AWS SDK for Pandas layer — provides pandas, pyarrow, numpy, scipy, etc.
  # Pinned to version 1. Check for updates periodically but test before bumping.
  # https://aws-sdk-pandas.readthedocs.io/en/stable/layers.html
  aws_sdk_pandas_layer = "arn:aws:lambda:${var.region}:336392948345:layer:AWSSDKPandas-Python313-Arm64:1"

  lambda_defaults = {
    runtime       = "python3.13"
    architectures = ["arm64"]
    filename      = data.archive_file.placeholder.output_path
    source_code_hash = data.archive_file.placeholder.output_base64sha256
    role          = var.lambda_execution_role_arn
    layers        = [local.aws_sdk_pandas_layer]
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
      INPUT_BUCKET        = var.data_lake_bucket_name
      INPUT_KEY           = "pipeline-A-indicator-extractor/indicators/Pipeline A Dispatcher World Bank Indicators.xlsx"
      OUTPUT_BUCKET       = var.data_lake_bucket_name
      OUTPUT_KEY          = "indicators/indicators.json"
      INDICATOR_MAP_KEY   = "pipeline-A-indicator-extractor/input/indicator_map.csv"
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
      S3_BUCKET                 = var.data_lake_bucket_name
      INDICATORS_KEY            = "pipeline-A-indicator-extractor/input/indicators.json"
      BATCH_JOB_QUEUE           = var.fetcher_job_queue_arn
      BATCH_JOB_DEFINITION      = var.fetcher_job_definition_arn
      COUNTER_TABLE             = var.pipeline_a_counter_table_name
      TRACKER_TABLE             = var.indicator_table_name
      INDICATOR_VALUES_TABLE    = var.indicator_values_table_name
      ATHENA_DATABASE           = var.glue_database_name
      ATHENA_WORKGROUP          = var.athena_workgroup_name
      ATHENA_OUTPUT_LOCATION    = local.s3_output_location
      JITTER_MIN_S              = tostring(var.phase1_jitter_min_s)
      JITTER_MAX_S              = tostring(var.phase1_jitter_max_s)
      DISPATCH_LIMIT            = tostring(var.dispatch_limit)
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
      COUNTER_TABLE     = var.pipeline_a_counter_table_name
      DEADMAN_SECONDS   = tostring(var.phase1_deadman_seconds)
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
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
      TRACKER_TABLE  = var.indicator_table_name
      COUNTER_TABLE  = var.pipeline_a_counter_table_name
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
      S3_BUCKET                   = var.data_lake_bucket_name
      INPUT_PREFIX                = "pipeline-A-indicator-extractor/output/parquet"
      OUTPUT_PREFIX               = "pipeline-A-indicator-extractor/output/parquet-completed"
      INDICATOR_MAP_KEY           = "pipeline-A-indicator-extractor/input/indicator_map.csv"
      ATHENA_DATABASE             = var.glue_database_name
      ATHENA_WORKGROUP            = var.athena_workgroup_name
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
          mode   = "list"
          reason = "Terminated by Step Function."
          bucket = var.data_lake_bucket_name
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
                mode        = "kill"
                reason      = "Terminated by Step Function."
                bucket      = var.data_lake_bucket_name
                "run_id.$"  = "$$.Execution.Name"
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
# Step Functions — state machine
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
    Comment = "QGI Monthly Pipeline — Phases 0-5"
    StartAt = "Phase 0: Hygiene (Janitor)"
    States = {
      "Phase 0: Hygiene (Janitor)" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_janitor.arn
        ResultPath = "$.janitor_output"
        Retry      = local.lambda_retry
        Next       = "Phase 1: Ingest (Fetcher)"
      }

      "Phase 1: Ingest (Fetcher)" = {
        Type       = "Task"
        Resource   = aws_lambda_function.a_sheet_fetcher.arn
        ResultPath = "$.fetcher_output"
        Retry      = local.lambda_retry
        Next       = "Phase 1: Dispatch Batch"
      }

      # #FAR-1: Fan out one Fargate Spot task per indicator. Dispatcher
      # seeds the counter to N at this step so the checker has a fixed
      # finish line.
      "Phase 1: Dispatch Batch" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_batch_dispatcher.arn
        Parameters = {
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.dispatch_a_output"
        Retry      = local.lambda_retry
        Next       = "Wait 2 Mins (Phase A Poll)"
      }

      "Wait 2 Mins (Phase A Poll)" = {
        Type    = "Wait"
        Seconds = 120
        Next    = "Phase 1: Check Counter"
      }

      # #FAR-1: Polls the qgi-pipeline-a-counter DDB row for run_id.
      # Returns done=true when pending hits 0, OR when the deadman
      # timer (default 90 min) expires (sets deadman_expired=true so
      # the reporter can flag the run as degraded).
      "Phase 1: Check Counter" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_batch_checker.arn
        Parameters = {
          "run_id.$"             = "$$.Execution.Name"
          "phase1_started_at.$"  = "$.dispatch_a_output.phase1_started_at"
          "total.$"              = "$.dispatch_a_output.total"
        }
        ResultPath = "$.a_check"
        Retry      = local.lambda_retry
        Next       = "Phase A Done?"
      }

      "Phase A Done?" = {
        Type = "Choice"
        Choices = [{
          Variable      = "$.a_check.done"
          BooleanEquals = true
          Next          = "Phase 1: Ingest (Reporter)"
        }]
        Default = "Wait 2 Mins (Phase A Poll)"
      }

      "Phase 1: Ingest (Reporter)" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_reporter.arn
        Parameters = {
          "run_id.$"           = "$$.Execution.Name"
          "deadman_expired.$"  = "$.a_check.deadman_expired"
          "total.$"            = "$.a_check.total"
          "done.$"             = "$.a_check.done"
          "pending.$"          = "$.a_check.pending"
        }
        ResultPath = "$.reporter_result"
        Retry      = local.lambda_retry
        Next       = "Phase 1.5: Complete Indicators"
      }

      "Phase 1.5: Complete Indicators" = {
        Type       = "Task"
        Resource   = aws_lambda_function.a_completer.arn
        ResultPath = "$.completer_result"
        Retry      = local.lambda_retry
        Next       = "Decision: Updates Found?"
      }

      "Decision: Updates Found?" = {
        Type = "Choice"
        Choices = [{
          Variable           = "$.reporter_result.updated_count"
          NumericGreaterThan = 0
          Next               = "Phase 2: Compute (Trigger B)"
        }]
        Default = "Phase 6: Ops Report (Final Check)"
      }

      "Phase 2: Compute (Trigger B)" = {
        Type     = "Task"
        Resource = aws_lambda_function.b_orchestrator.arn
        Parameters = {
          mode              = var.batch_invoke_mode
          "indicator_ids.$" = "$.reporter_result.updated_ids"
        }
        ResultPath = "$.trigger_b_output"
        Retry      = local.lambda_retry
        Next       = "Wait 2 Hrs (Spot Poll Interval)"
      }

      "Wait 2 Hrs (Spot Poll Interval)" = {
        Type    = "Wait"
        Seconds = 7200
        Next    = "Phase 2: Check Batch Status"
      }

      "Phase 2: Check Batch Status" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_batch_checker.arn
        ResultPath = "$.batch_status"
        Retry      = local.lambda_retry
        Next       = "Batch Done?"
      }

      "Batch Done?" = {
        Type = "Choice"
        Choices = [{
          Variable           = "$.batch_status.jobs_running"
          NumericGreaterThan = 0
          Next               = "Wait 2 Hrs (Spot Poll Interval)"
        }]
        Default = "Phase 3: MSCK Repair scdis"
      }

      # Phase 3: replaced Glue crawler with MSCK REPAIR TABLE scdis (issue #66)
      # Faster, cheaper (~$0), and avoids Glue crawler $0.44/DPU-hour cost.
      "Phase 3: MSCK Repair scdis" = {
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
        Next       = "Phase 4: Synthesis (Dispatch C)"
      }

      "Phase 4: Synthesis (Dispatch C)" = {
        Type     = "Task"
        Resource = aws_lambda_function.c_dispatcher.arn
        Parameters = {
          action     = "start"
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.dispatch_c_output"
        Retry      = local.lambda_retry
        Next       = "Wait 30s (Phase C Poll)"
      }

      "Wait 30s (Phase C Poll)" = {
        Type    = "Wait"
        Seconds = 30
        Next    = "Phase 4: Check Complete?"
      }

      "Phase 4: Check Complete?" = {
        Type     = "Task"
        Resource = aws_lambda_function.c_checker.arn
        Parameters = {
          "run_id.$"   = "$$.Execution.Name"
          "expected.$" = "$.dispatch_c_output.dispatched_count"
        }
        ResultPath = "$.c_check"
        Retry      = local.lambda_retry
        Next       = "Phase C Done?"
      }

      "Phase C Done?" = {
        Type = "Choice"
        Choices = [{
          Variable      = "$.c_check.done"
          BooleanEquals = true
          Next          = "Phase 4: Synthesis (Repair patterns)"
        }]
        Default = "Wait 30s (Phase C Poll)"
      }

      "Phase 4: Synthesis (Repair patterns)" = {
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
        Next       = "Phase 5: MSCK Repair events"
      }

      # Phase 5: Recipe engine — match patterns against events (D4/D5)
      "Phase 5: MSCK Repair events" = {
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
        Next       = "Phase 5: Recipe Engine"
      }

      "Phase 5: Recipe Engine" = {
        Type     = "Task"
        Resource = aws_lambda_function.recipe_engine.arn
        Parameters = {
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.recipe_engine_output"
        Retry      = local.lambda_retry
        Next       = "Phase 5: MSCK Repair recipes"
      }

      "Phase 5: MSCK Repair recipes" = {
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
        Next       = "Phase 6: Ops Report (Final Check)"
      }

      "Phase 6: Ops Report (Final Check)" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_dlq_scanner.arn
        ResultPath = "$.dlq_report"
        Retry      = local.lambda_retry
        Next       = "Workflow Complete"
      }

      "Workflow Complete" = {
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
