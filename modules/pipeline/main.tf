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
  lambda_defaults = {
    runtime       = "python3.13"
    architectures = ["arm64"]
    filename      = data.archive_file.placeholder.output_path
    source_code_hash = data.archive_file.placeholder.output_base64sha256
    role          = var.lambda_execution_role_arn
  }
  s3_output_location = "s3://${var.data_lake_bucket_name}/query_results/"
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

  environment {
    variables = {
      INPUT_BUCKET = var.data_lake_bucket_name
      INPUT_KEY    = "pipeline-A-indicator-extractor/indicators/Pipeline A Dispatcher World Bank Indicators.xlsx"
      OUTPUT_BUCKET = var.data_lake_bucket_name
      OUTPUT_KEY    = "indicators/indicators.json"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 1 — dispatcher (reads indicators.json, fans out to SQS)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "a_dispatcher" {
  function_name    = "qgi-pipeline-a-dispatcher"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 512
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      S3_BUCKET     = var.data_lake_bucket_name
      S3_PREFIX     = "pipeline-A-indicator-extractor"
      INPUT_KEY     = "indicators/indicators.json"
      SQS_QUEUE_URL = var.queue_a_main_url
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 1 — indicator extractor (SQS-triggered, processes one indicator)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "a_indicator_extractor" {
  function_name    = "qgi-pipeline-a-indicator-extractor"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 512
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      S3_BUCKET        = var.data_lake_bucket_name
      S3_INPUT_PREFIX  = "pipeline-A-indicator-extractor/input"
      S3_OUTPUT_PREFIX = "pipeline-A-indicator-extractor/output"
      LOG_LEVEL        = "INFO"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Phase 1 — worker (SQS-triggered: fetches World Bank data, writes to S3,
# updates qgi-indicator-updates DynamoDB)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "a_worker" {
  function_name    = "qgi-pipeline-a-worker"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 512
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      S3_BUCKET        = var.data_lake_bucket_name
      S3_INPUT_PREFIX  = "pipeline-A-indicator-extractor/input"
      S3_OUTPUT_PREFIX = "pipeline-A-indicator-extractor/output"
      LOG_LEVEL        = "INFO"
      DYNAMODB_TABLE   = "qgi-indicator-updates"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "a_worker_sqs" {
  event_source_arn = var.queue_a_main_arn
  function_name    = aws_lambda_function.a_worker.arn
  batch_size       = 1
  enabled          = true
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

  environment {
    variables = {
      SNS_TOPIC_ARN  = var.sns_topic_arn
      PIPELINE_B_ARN = aws_lambda_function.b_orchestrator.arn
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
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      S3_BUCKET            = var.data_lake_bucket_name
      S3_INPUT_PREFIX      = "pipeline-A-indicator-extractor/output/csv/"
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

  environment {
    variables = {
      S3_BUCKET       = var.data_lake_bucket_name
      S3_INPUT_PREFIX = "pipeline-A-indicator-extractor/output/csv/"
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

  environment {
    variables = {
      S3_BUCKET             = var.data_lake_bucket_name
      S3_INPUT_PREFIX       = "pipeline-A-indicator-extractor/output/csv/"
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

  environment {
    variables = {
      S3_BUCKET             = var.data_lake_bucket_name
      ATHENA_DATABASE       = var.glue_database_name
      COUNTRIES_NAMES_TABLE = "countries"
      ATHENA_WORKGROUP      = var.athena_workgroup_name
      S3_OUTPUT_LOCATION    = local.s3_output_location
      SQS_QUEUE_URL         = var.queue_c_main_url
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
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      S3_BUCKET             = var.data_lake_bucket_name
      DB_NAME               = var.glue_database_name
      SCDIS_TABLE           = "scdis"
      COUNTRIES_NAMES_TABLE = "countries"
      ATHENA_WORKGROUP      = var.athena_workgroup_name
      S3_OUTPUT_LOCATION    = local.s3_output_location
      SQS_QUEUE_URL         = var.queue_c_main_url
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "c_worker_sqs" {
  event_source_arn = var.queue_c_main_arn
  function_name    = aws_lambda_function.c_worker.arn
  batch_size       = 1
  enabled          = true
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
# Utility — Batch job terminator (manual invocation only)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "batch_job_terminator" {
  function_name    = "qgi-batch-job-terminator"
  handler          = "lambda_function.lambda_handler"
  timeout          = 900
  memory_size      = 128
  runtime          = local.lambda_defaults.runtime
  architectures    = local.lambda_defaults.architectures
  filename         = local.lambda_defaults.filename
  source_code_hash = local.lambda_defaults.source_code_hash
  role             = local.lambda_defaults.role

  environment {
    variables = {
      BATCH_JOB_QUEUE = "qgi-pipeline-b-high-priority-queue"
    }
  }

  lifecycle { ignore_changes = [filename, source_code_hash] }
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
        Next       = "Phase 1: Ingest (Fetcher)"
      }

      "Phase 1: Ingest (Fetcher)" = {
        Type       = "Task"
        Resource   = aws_lambda_function.a_sheet_fetcher.arn
        ResultPath = "$.fetcher_output"
        Next       = "Phase 1: Ingest (Dispatch A)"
      }

      "Phase 1: Ingest (Dispatch A)" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_dispatcher.arn
        Parameters = {
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.dispatch_a_output"
        Next       = "Wait 21 Mins (Hard Wait)"
      }

      "Wait 21 Mins (Hard Wait)" = {
        Type    = "Wait"
        Seconds = 1260
        Comment = "Waiting for Phase A workers. Replace with DynamoDB counter (issue #76)."
        Next    = "Phase 1: Ingest (Reporter)"
      }

      "Phase 1: Ingest (Reporter)" = {
        Type     = "Task"
        Resource = aws_lambda_function.a_reporter.arn
        Parameters = {
          "run_id.$" = "$$.Execution.Name"
        }
        ResultPath = "$.reporter_result"
        Next       = "Decision: Updates Found?"
      }

      "Decision: Updates Found?" = {
        Type = "Choice"
        Choices = [{
          Variable          = "$.reporter_result.updated_count"
          NumericGreaterThan = 0
          Next              = "Phase 2: Compute (Trigger B)"
        }]
        Default = "Phase 5: Ops Report (Final Check)"
      }

      "Phase 2: Compute (Trigger B)" = {
        Type     = "Task"
        Resource = aws_lambda_function.b_orchestrator.arn
        Parameters = {
          mode            = var.batch_invoke_mode
          "indicator_ids.$" = "$.reporter_result.updated_ids"
        }
        ResultPath = "$.trigger_b_output"
        Next       = "Wait 30 Mins (Poll Interval)"
      }

      "Wait 30 Mins (Poll Interval)" = {
        Type    = "Wait"
        Seconds = 300
        Next    = "Phase 2: Check Batch Status"
      }

      "Phase 2: Check Batch Status" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_batch_checker.arn
        ResultPath = "$.batch_status"
        Next       = "Batch Done?"
      }

      "Batch Done?" = {
        Type = "Choice"
        Choices = [{
          Variable          = "$.batch_status.jobs_running"
          NumericGreaterThan = 0
          Next              = "Wait 30 Mins (Poll Interval)"
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
          action = "start"
        }
        ResultPath = "$.dispatch_c_output"
        Next       = "Wait 60 Mins (Hard Wait)"
      }

      "Wait 60 Mins (Hard Wait)" = {
        Type    = "Wait"
        Seconds = 3600
        Comment = "Waiting for Phase C workers. Replace with DynamoDB counter (issue #76)."
        Next    = "Phase 4: Synthesis (Repair patterns)"
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
        Next       = "Phase 5: Ops Report (Final Check)"
      }

      "Phase 5: Ops Report (Final Check)" = {
        Type       = "Task"
        Resource   = aws_lambda_function.ops_dlq_scanner.arn
        ResultPath = "$.dlq_report"
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
