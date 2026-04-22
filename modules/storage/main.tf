locals {
  bucket_name = "qgi-data-lake-${var.aws_account_id}"
}

# ---------------------------------------------------------------------------
# S3 — data lake
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "data_lake" {
  bucket = local.bucket_name
  tags   = var.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id
  versioning_configuration {
    status = "Disabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  # Athena temp results — expire after 30 days (issue #69)
  rule {
    id     = "expire-query-results"
    status = "Enabled"
    filter {
      prefix = "query_results/"
    }
    expiration {
      days = 30
    }
  }

  # #160: Quarantined parquet files — forensic backups from forced reruns.
  # Nobody looks at them after ~30 days. Move to Glacier IR after 90 days
  # (retrieval still instant, ~5x cheaper storage), delete after 180.
  rule {
    id     = "archive-quarantine"
    status = "Enabled"
    filter {
      prefix = "_quarantine/"
    }
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }
    expiration {
      days = 180
    }
  }

  # #160: Abort incomplete multipart uploads after 1 day (prevents orphaned
  # partial uploads from accumulating storage cost).
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Allow management account to write to this bucket (for legacy data sync)
resource "aws_s3_bucket_policy" "data_lake_cross_account" {
  bucket = aws_s3_bucket.data_lake.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowManagementAccountSync"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${var.management_account_id}:root" }
      Action    = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
      Resource = [
        aws_s3_bucket.data_lake.arn,
        "${aws_s3_bucket.data_lake.arn}/*"
      ]
    }]
  })
}

resource "aws_s3_bucket_public_access_block" "data_lake" {
  bucket                  = aws_s3_bucket.data_lake.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# SQS — Phase A
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "a_dlq" {
  name                      = "qgi-pipeline-a-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = var.tags
}

resource "aws_sqs_queue" "a_main" {
  name                       = "qgi-pipeline-a-main-queue"
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600 # 4 days
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.a_dlq.arn
    maxReceiveCount     = 3
  })
  tags = var.tags
}

# ---------------------------------------------------------------------------
# SQS — Phase B
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "b_dlq" {
  name                      = "qgi-pipeline-b-dlq"
  message_retention_seconds = 1209600
  tags                      = var.tags
}

resource "aws_sqs_queue" "b_main" {
  name                       = "qgi-pipeline-b-main-queue"
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.b_dlq.arn
    maxReceiveCount     = 3
  })
  tags = var.tags
}

# ---------------------------------------------------------------------------
# SQS — Phase C
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "c_dlq" {
  name                       = "qgi-pipeline-c-dlq"
  message_retention_seconds  = 1209600
  visibility_timeout_seconds = 900 # must be >= c-dlq-inspector Lambda timeout
  tags                       = var.tags
}

resource "aws_sqs_queue" "c_main" {
  name                       = "qgi-pipeline-c-main-queue"
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.c_dlq.arn
    maxReceiveCount     = 3
  })
  tags = var.tags
}

# ---------------------------------------------------------------------------
# DynamoDB — indicator updates tracker (Phase A reporter)
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "indicator_updates" {
  name         = "qgi-indicator-updates"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "run_id"
  range_key    = "indicator_id"

  attribute {
    name = "run_id"
    type = "S"
  }
  attribute {
    name = "indicator_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# DynamoDB — indicator values (#148)
#
# Frontend latency fix: pattern detail pages issue an N+1 burst of Athena
# queries (one per indicator). Each cold-start adds 2-10s. With ~22 indicators
# per pattern that's 10-50s of cumulative latency. Migrating reads to DDB
# turns the entire batch into a single BatchGetItem (sub-second).
#
# Schema:
#   PK   indicator_country : S   (e.g. "SP.POP.TOTL#South Korea")
#   SK   year              : N
#   attr value             : N
#
# Access pattern: BatchGetItem with up to 100 keys per call. The frontend
# pre-computes the (indicator, country, year) tuples for the requested
# pattern window and fetches them all in one round trip.
#
# Capacity: PAY_PER_REQUEST (workload is bursty + small — total dataset is
# ~750k items, well within DDB free tier).
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "indicator_values" {
  name         = "qgi-indicator-values"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "indicator_country"
  range_key    = "year"

  attribute {
    name = "indicator_country"
    type = "S"
  }
  attribute {
    name = "year"
    type = "N"
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# CloudWatch alarm — qgi-indicator-values write capacity surge guard (#157)
#
# 2026-04-08: a bug in pipeline-a-completer caused it to mirror every
# indicator on every pipeline run instead of just the changed ones.
# Result: ~1.77M DynamoDB writes in one day, $2.21 cost surge from a
# baseline of $0.0004/day. Fix shipped, but a defense-in-depth alarm
# is cheap insurance against the next regression.
#
# Threshold rationale: a healthy run mirrors at most ~24K writes
# (1-2 changed indicators × ~12K rows each). 100K writes in any single
# 5-min window is presumptively a bug. The alarm triggers on 2 of 2
# breaching periods to filter transient spikes from initial pipeline
# population runs.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "indicator_values_write_surge" {
  alarm_name          = "qgi-indicator-values-write-surge"
  alarm_description   = "Triggers when qgi-indicator-values write capacity exceeds 100K units in a 5-min window. See #157 — guard against the completer mirroring all indicators instead of only updated ones."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConsumedWriteCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 100000
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.indicator_values.name
  }

  alarm_actions = [aws_sns_topic.pipeline_notifications.arn]
  ok_actions    = [aws_sns_topic.pipeline_notifications.arn]

  tags = var.tags
}

# ---------------------------------------------------------------------------
# DynamoDB — Phase 1 fetcher counter (#FAR-1)
#
# Replaces the legacy completion-counters table for Phase 1 specifically.
# The dispatcher Lambda seeds `pending=N` at run start; each Fargate Spot
# task decrements `pending` by 1 when it finishes (success OR graceful
# failure). The checker Lambda polls until pending <= 0, then advances
# to the Reporter.
#
# Why a dedicated table (not reusing qgi-completion-counters):
#  - Phase 1 has its own lifecycle and deadman timeout
#  - Phase 4 (qgi-completion-counters) uses a different schema (processed_c
#    counter that goes UP, not DOWN)
#  - Cleaner blast radius — a Phase 1 race can't corrupt Phase 4 state
#
# Schema:
#   PK   run_id   : S   (Step Function execution name)
#   attr pending  : N   (decrements from total to 0)
#   attr total    : N   (immutable, set by dispatcher, used by reporter)
#   attr expires_at : N (TTL — clean up old run records after 30 days)
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "pipeline_a_counter" {
  name         = "qgi-pipeline-a-counter"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "run_id"

  attribute {
    name = "run_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# DynamoDB — completion counters (D6: replaces Phase 1/4 hard waits)
# Dispatcher writes run_id + total worker count; each worker decrements.
# Not yet wired into Step Functions — Lambda code update required (issue #76).
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "completion_counters" {
  name         = "qgi-completion-counters"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "run_id"

  attribute {
    name = "run_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# SNS — pipeline notifications (reporter + dlq-scanner)
# ---------------------------------------------------------------------------
resource "aws_sns_topic" "pipeline_notifications" {
  name = "qgi-monthly-updates"
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Glue — database
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_database" "qgi_data" {
  name = "qgi_data"
}

# ---------------------------------------------------------------------------
# Glue — scdis table (output of Phase B / scdi-finder Batch job)
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "scdis" {
  name          = "scdis"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-B-scdi-finder/scdis/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "country_b_id"
      type = "smallint"
    }
    columns {
      name = "length"
      type = "smallint"
    }
    columns {
      name = "start_year_a"
      type = "smallint"
    }
    columns {
      name = "start_year_b"
      type = "smallint"
    }
    columns {
      name = "correlation"
      type = "float"
    }
    columns {
      name = "indicator_numeric_id"
      type = "smallint"
    }
  }

  partition_keys {
    name = "country_a_id"
    type = "smallint"
  }
}

# ---------------------------------------------------------------------------
# Glue — patterns table (output of Phase C / pattern synthesizer)
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "patterns" {
  name          = "patterns"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-C-pattern-synthesizer/output/data/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "pattern_id"
      type = "string"
    }
    columns {
      name = "country_b_id"
      type = "smallint"
    }
    columns {
      name = "length"
      type = "smallint"
    }
    columns {
      name = "start_year_a"
      type = "smallint"
    }
    columns {
      name = "start_year_b"
      type = "smallint"
    }
    columns {
      name = "indicator_count"
      type = "bigint"
    }
    columns {
      name = "avg_correlation"
      type = "double"
    }
    columns {
      name = "pattern_power_score"
      type = "double"
    }
    columns {
      name = "indicator_numeric_ids"
      type = "array<smallint>"
    }
    # #128: Pattern length tier (S/M/L/XL). Derived from `length` in the
    # Phase 4 INSERT. Must be the last non-partition column to match the
    # SELECT order in pipeline-c-worker.
    columns {
      name = "pattern_tier"
      type = "string"
    }
  }

  partition_keys {
    name = "country_a_id"
    type = "smallint"
  }
}

# ---------------------------------------------------------------------------
# Glue — indicators table (Phase 1 output, Parquet)
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "indicators" {
  name          = "indicators"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-A-indicator-extractor/output/parquet/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "country"
      type = "string"
    }
    columns {
      name = "year"
      type = "int"
    }
    columns {
      name = "value"
      type = "double"
    }
  }

  partition_keys {
    name = "indicator_id"
    type = "string"
  }
}

# ---------------------------------------------------------------------------
# Glue — indicators_completed table (Phase 1.5 output, Parquet with is_predicted)
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "indicators_completed" {
  name          = "indicators_completed"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-A-indicator-extractor/output/parquet-completed/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "country"
      type = "string"
    }
    columns {
      name = "year"
      type = "int"
    }
    columns {
      name = "value"
      type = "double"
    }
    columns {
      name = "is_predicted"
      type = "boolean"
    }
  }

  partition_keys {
    name = "indicator_id"
    type = "string"
  }
}

# ---------------------------------------------------------------------------
# Glue — countries table (reference data, backed by CSV in S3)
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "countries" {
  name          = "countries"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification"         = "csv"
    "EXTERNAL"               = "TRUE"
    "skip.header.line.count" = "1"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-A-indicator-extractor/input/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      name                  = "csv"
      serialization_library = "org.apache.hadoop.hive.serde2.OpenCSVSerde"
      parameters = {
        "separatorChar" = ","
        "quoteChar"     = "\""
      }
    }

    dynamic "columns" {
      for_each = ["0_index_id", "id", "name_1", "name_2", "name_3", "name_4", "name_5",
        "name_6", "name_7", "name_8", "name_9", "name_10", "alpha_2", "alpha_3",
        "numeric_code", "name_11", "name_12", "name_13", "name_14", "name_15",
      "name_16", "name_17", "name_18", "name_19", "name_20"]
      content {
        name = columns.value
        type = "string"
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Glue — events table (legacy ChatGPT + Sonnet-generated events)
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "events" {
  name          = "events"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/events/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "country_name"
      type = "string"
    }
    columns {
      name = "year"
      type = "smallint"
    }
    columns {
      name = "title"
      type = "string"
    }
    columns {
      name = "description"
      type = "string"
    }
    columns {
      name = "category"
      type = "string"
    }
    columns {
      name = "category_normalized"
      type = "string"
    }
    columns {
      name = "source"
      type = "string"
    }
  }

  partition_keys {
    name = "country_id"
    type = "smallint"
  }
}

# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Glue — recipes table: pipeline-managed, NOT in Terraform (2026-04-22, #410)
#
# The recipes table is created + populated by the Phase 5b Layer 2 recipe
# engine via Athena CTAS (qgi-pipeline/lambdas/pipeline-recipe-engine-*).
# The pipeline owns the schema + partitions; Terraform does not.
#
# A prior version of this module defined aws_glue_catalog_table.recipes
# with a lifecycle ignore_changes workaround for partition_keys. That
# resource was never successfully imported into state because the AWS
# provider 5.x import step trips on:
#
#     Error: setting partition_keys:
#     Invalid address to set: []string{"partition_keys", "0", "parameters"}
#
# The provider tries to set partition_keys[0].parameters during refresh,
# but that attribute is not in the resource schema. A Glue catalog table
# created via Athena CTAS writes extra Parameters metadata into the
# partition column definition that Terraform cannot round-trip in 5.x.
#
# Re-adoption path (deferred): bump AWS provider to 6.x (separate ticket
# — breaking-change review needed across all qgi-infra modules), then
# terraform import module.storage.aws_glue_catalog_table.recipes
# "<account_id>:qgi_data:recipes". Until then, recipes stays out of state.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Athena workgroup
# ---------------------------------------------------------------------------
resource "aws_athena_workgroup" "qgi" {
  name          = "QGI-Lambda-Workgroup"
  force_destroy = true

  configuration {
    result_configuration {
      output_location = "s3://${local.bucket_name}/query_results/"
    }
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    # #142 cost guardrail: hard cap on data scanned per query.
    # 50 GB ≈ $0.25 per query at $5/TB. Any query exceeding this is
    # presumptively a bug (full-table scan on patterns/recipes without
    # partition pruning is the canonical example — that's how the 04-06
    # surge hit $18 in 3 hours from frontend dev). Athena aborts the
    # query immediately when this is exceeded; pipeline INSERTs are
    # well under this threshold (largest is ~few GB for SCDIs aggregation).
    #
    # Pipeline-side queries: cap is generous because Phase 2/4 INSERTs
    # legitimately scan multi-GB partitions during synthesis.
    # Frontend-side queries: cap forces frontend devs to use Children C/D
    # caches and pre-computed JSONs rather than direct SELECTs.
    bytes_scanned_cutoff_per_query = 50 * 1024 * 1024 * 1024 # 50 GiB

    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# CloudWatch alarm — Athena cost guardrail (#142)
#
# 2026-04-06: ~$18 in 3 hours of frontend dev work, from full-table scans
# on patterns/recipes (each call 50–2000 GB). Children A+B fixed the
# worst client-side patterns; this alarm closes the loop with a fast
# feedback signal if anything regresses.
#
# Metric: AWS/Athena ProcessedBytes for the QGI workgroup. Threshold of
# 100 GB in any 5-min window means a single accidental full-scan or a
# burst of expensive queries fires the alarm immediately.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "athena_processed_bytes_surge" {
  alarm_name          = "qgi-athena-processed-bytes-surge"
  alarm_description   = "Triggers when QGI Athena workgroup scans more than 100GB in a 5-min window. See #142 — guard against frontend or pipeline regressions doing unbounded full-table scans on patterns/recipes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ProcessedBytes"
  namespace           = "AWS/Athena"
  period              = 300
  statistic           = "Sum"
  threshold           = 100 * 1024 * 1024 * 1024 # 100 GiB
  treat_missing_data  = "notBreaching"

  dimensions = {
    WorkGroup  = aws_athena_workgroup.qgi.name
    QueryState = "SUCCEEDED"
  }

  alarm_actions = [aws_sns_topic.pipeline_notifications.arn]
  ok_actions    = [aws_sns_topic.pipeline_notifications.arn]

  tags = var.tags
}

# Enable Athena query result caching (24h TTL) — not yet natively supported
# by the Terraform AWS provider. Run once per environment after applying:
#   aws athena update-work-group --work-group QGI-Lambda-Workgroup \
#     --configuration-updates '{"ResultReuseConfiguration":{"ResultReuseByAgeConfiguration":{"Enabled":true,"MaxAgeInMinutes":1440}}}'
# Reduces Athena scan costs when Batch jobs re-query the same data (#109 P1-6).
