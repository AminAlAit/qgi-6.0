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
# Glue — recipes table (Phase 5: pattern-event matches)
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "recipes" {
  name          = "recipes"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/recipes/"
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
      name = "recipe_id"
      type = "string"
    }
    columns {
      name = "event_category"
      type = "string"
    }
    columns {
      name = "pattern_id"
      type = "string"
    }
    columns {
      name = "country_a_id"
      type = "smallint"
    }
    columns {
      name = "country_b_id"
      type = "smallint"
    }
    columns {
      name = "country_a_name"
      type = "string"
    }
    columns {
      name = "country_b_name"
      type = "string"
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
      name = "length"
      type = "smallint"
    }
    columns {
      name = "avg_correlation"
      type = "double"
    }
    columns {
      name = "end_year_a"
      type = "smallint"
    }
    columns {
      name = "end_year_b"
      type = "smallint"
    }
    columns {
      name = "event_window"
      type = "smallint"
    }
    columns {
      name = "event_year_a"
      type = "smallint"
    }
    columns {
      name = "event_year_b"
      type = "smallint"
    }
    columns {
      name = "event_title_a"
      type = "string"
    }
    columns {
      name = "event_title_b"
      type = "string"
    }
    columns {
      name = "indicator_count"
      type = "bigint"
    }
    columns {
      name = "pattern_power_score"
      type = "double"
    }
    columns {
      name = "instance_count"
      type = "bigint"
    }
    # #128: Pattern length tier propagated from patterns table.
    # The recipe-engine CTAS adds p.pattern_tier to the SELECT.
    columns {
      name = "pattern_tier"
      type = "string"
    }
    # #129: New normalized 0-100 Pattern Power Score, computed in the recipe
    # engine CTAS via global maxima broadcast (CROSS JOIN). Replaces the legacy
    # `pattern_power_score` column for ranking/display. Old column kept for
    # backward compatibility and debugging.
    columns {
      name = "pps"
      type = "double"
    }
    # #134: Forecast timing — median lead time between pattern end and the
    # historical matched event, computed via approx_percentile across the
    # un-aggregated raw recipe rows in pipeline-recipe-engine. lead_time_b
    # is in the PREDICTOR country and is the headline "when?" number;
    # lead_time_a is kept for symmetry/debugging.
    columns {
      name = "median_lead_time_b"
      type = "smallint"
    }
    columns {
      name = "min_lead_time_b"
      type = "smallint"
    }
    columns {
      name = "max_lead_time_b"
      type = "smallint"
    }
    columns {
      name = "median_lead_time_a"
      type = "smallint"
    }
  }

  # #145: recipes is partitioned by country_a_id so that filtered queries
  # (recipes/country, dashboard top50, etc.) scan ~0.5% of the table instead of 100%.
  # The recipe-engine Lambda CTAS specifies partitioned_by=ARRAY['country_a_id'] and
  # writes data to s3://{bucket}/recipes/country_a_id={N}/...
  partition_keys {
    name = "country_a_id"
    type = "smallint"
  }
}

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

    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }

  tags = var.tags
}

# Enable Athena query result caching (24h TTL) — not yet natively supported
# by the Terraform AWS provider. Run once per environment after applying:
#   aws athena update-work-group --work-group QGI-Lambda-Workgroup \
#     --configuration-updates '{"ResultReuseConfiguration":{"ResultReuseByAgeConfiguration":{"Enabled":true,"MaxAgeInMinutes":1440}}}'
# Reduces Athena scan costs when Batch jobs re-query the same data (#109 P1-6).
