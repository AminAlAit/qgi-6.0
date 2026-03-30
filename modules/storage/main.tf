locals {
  bucket_name = "qgi-data-lake-${var.aws_account_id}"
}

# ---------------------------------------------------------------------------
# S3 — data lake
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "data_lake" {
  bucket = local.bucket_name
  tags   = var.tags
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
  name                      = "qgi-pipeline-c-dlq"
  message_retention_seconds = 1209600
  tags                      = var.tags
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
    "parquet.compress"  = "SNAPPY"
    "classification"    = "parquet"
    "EXTERNAL"          = "TRUE"
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
  }

  partition_keys {
    name = "country_a_id"
    type = "smallint"
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
    "classification"            = "csv"
    "EXTERNAL"                  = "TRUE"
    "skip.header.line.count"    = "1"
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
  }

  tags = var.tags
}
