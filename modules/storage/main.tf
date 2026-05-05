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

  # Athena temp results — expire after 1 day (#593, tightened from #419's
  # 14 days, which itself was tightened from #69's 30 days). May 2026 S3
  # cost-spike forensic (cost spike occurred 2026-05-02; forensic run
  # 2026-05-03) revealed: median file size in this prefix is 100 BYTES
  # (Athena workgroup metadata), with thousands of tiny files
  # accumulating per script session. Athena CSV results are never
  # re-read after the originating session ends — the 14-day window was
  # pure cost overhead with no operational benefit. 1 day covers any
  # reasonable in-session re-fetch window. The `pipeline-B-scdi-finder/`
  # fragmentation problem is a separate ticket (#592 + #595).
  rule {
    id     = "expire-query-results"
    status = "Enabled"
    filter {
      prefix = "query_results/"
    }
    expiration {
      days = 1
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

  # #597: S3 server access logs land in s3-access-logs/ (self-logging).
  # 7 days is enough for post-hoc forensics on cost spikes and security
  # events. Server access logs are FREE to generate; the storage cost
  # for 7 days at typical QGI request rates is trivial (~10-50 MB/day).
  rule {
    id     = "expire-access-logs"
    status = "Enabled"
    filter {
      prefix = "s3-access-logs/"
    }
    expiration {
      days = 7
    }
  }
}

# #597: S3 server access logging — enables post-hoc forensics on cost
# spikes (which IAM principal opened how many objects in which prefix
# at what hour). The May 2 2026 GET spike ($9.44 in one day) was
# diagnosable only via Cost Explorer aggregates — couldn't attribute
# the 22M GETs to a specific principal without these logs.
#
# Self-logging pattern: target_bucket = source_bucket. AWS prevents
# infinite recursion (server access logs do NOT generate access log
# events themselves). The s3-access-logs/ prefix has its own 7-day
# lifecycle rule above to keep storage bounded.
#
# Cost: log generation is free, but the resulting PUTs and storage
# incur standard S3 charges. Estimate at QGI's current request rate:
# ~$2-5/month total (PUTs dominate; storage capped by 7-day expiry).
# This is intentionally a small cost in exchange for incident
# attribution — without these logs, we couldn't tell who triggered
# the May 2 spike. The paid S3 Request Metrics filter is NOT enabled
# (separate cost line); daily request-count visibility comes from
# S3 Storage Lens free tier (ticket #594).
#
# Retention rationale (7 days): chosen for cost containment and
# because the upstream cause (#592 SCDI fragmentation) explains the
# bulk of cost spikes. If a future incident requires a longer
# forensic window, bump to 30d in the lifecycle rule above — storage
# stays trivial.
#
# Permission path: server access logging requires the logging service
# principal (logging.s3.amazonaws.com) to write to the target prefix.
# Default delivery uses the log-delivery-write canned ACL, but our
# bucket has block_public_acls=true + ignore_public_acls=true (see
# aws_s3_bucket_public_access_block below) — that ACL grant is
# silently rejected. We instead grant the permission via bucket
# policy below (modern ACL-free path with aws:SourceAccount guard).
resource "aws_s3_bucket_logging" "data_lake" {
  bucket        = aws_s3_bucket.data_lake.id
  target_bucket = aws_s3_bucket.data_lake.id
  target_prefix = "s3-access-logs/"

  # Ensure the bucket policy is in place before logging is enabled,
  # otherwise the first batch of log deliveries fails until the
  # policy lands. Terraform usually orders this correctly via
  # implicit dependency on the bucket, but be explicit.
  depends_on = [aws_s3_bucket_policy.data_lake_cross_account]
}

# Allow management account to write to this bucket (for legacy data
# sync) AND allow the S3 logging service principal to deliver server
# access logs to the s3-access-logs/ prefix (#597). Both statements
# live in one policy to keep policy management contained.
resource "aws_s3_bucket_policy" "data_lake_cross_account" {
  bucket = aws_s3_bucket.data_lake.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowManagementAccountSync"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${var.management_account_id}:root" }
        Action    = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.data_lake.arn,
          "${aws_s3_bucket.data_lake.arn}/*"
        ]
      },
      {
        # #597: ACL-free log delivery path. block_public_acls=true on
        # the bucket would otherwise silently prevent the canned ACL
        # path used by default S3 server access logging. The
        # aws:SourceAccount condition prevents cross-account log
        # injection (AWS best practice since 2023).
        Sid       = "AllowS3LogDelivery"
        Effect    = "Allow"
        Principal = { Service = "logging.s3.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.data_lake.arn}/s3-access-logs/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = var.aws_account_id
          }
        }
      }
    ]
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
    location      = "s3://${local.bucket_name}/pipeline-B-scdi-finder/scdis-compacted/"
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
    # #461 (D7 plumbing): true when any year in either segment_a or
    # segment_b had `is_predicted=true` in indicators_completed. Pre-#461
    # rows have NULL; downstream consumers must coalesce to false.
    columns {
      name = "contains_predicted"
      type = "boolean"
    }
  }

  partition_keys {
    name = "country_a_id"
    type = "smallint"
  }
}

# ---------------------------------------------------------------------------
# Glue — dscdis table (Phase 5 v0.0b Stage D output of dscdi-finder Batch job)
# ---------------------------------------------------------------------------
# DSCDI = Detrended Similar-Country Dynamic Indicator. Per the Phase 5 v0.0b
# unanimous CSD reconvene DECISION 2026-05-05, this table is ADDITIVE alongside
# scdis (not a replacement). The 6-way mini-Majles agreed on a two-pass
# computation for severe-CSD global-arc indicators (Class A): an undemeaned
# baseline and a common-factor-demeaned primary output, distinguished by the
# `is_demeaned` column. Class B (WGI-pre-normalized) and Class C (idiosyncratic)
# indicators are single-pass with `is_demeaned=false`.
#
# Schema is INTENTIONALLY NARROWER than `scdis`. SCDI is a windowed-segment
# search (FFT cross-correlation finds time-shifted analogues with specific
# segment lengths and start years). DSCDI is fundamentally different: it
# computes a single full-panel pairwise Pearson correlation across all
# common years per country pair. There is no segment, no window, no time
# shift. Therefore the SCDI columns `length`, `start_year_a`, `start_year_b`
# are SEMANTICALLY MEANINGLESS for DSCDI and are NOT in this schema. (Earlier
# Stage D drafts inherited these columns by copy-paste; they were dropped
# 2026-05-06 as part of the Stage F preflight per the 6-way mini-Majles
# methodology DECISION.)
#
# Two columns drive Phase 6 ablation queries and downstream EB framework
# architecture-note logic:
#   - `is_demeaned`: false for baseline (Pass 1) or Class B/C; true for
#     primary demeaned output (Pass 2). Phase 6 reads only `is_demeaned=true`
#     for the canonical DSCDI substrate; the `is_demeaned=false` rows are
#     preserved for Miriam's three-substrate ablation (SCDI + ADF-DSCDI-
#     undemeaned + ADF-DSCDI-demeaned).
#   - `indicator_class`: 'A' / 'B' / 'C' per the Stage C input spec taxonomy.
#     Allows Phase 6 to filter / stratify by class without rejoining to the
#     class-assignment manifest at query time.
#
# Glue table is created here at Stage D; the underlying S3 prefix is empty
# until Stage F (deferred to end-of-cascade-mandate test-run authorization).
# Athena queries against `qgi_data.dscdis` will return zero rows until then,
# which is the correct behavior — code that reads from this table must
# tolerate empty results during the cascade window. See:
#   - Stage C input spec: qgi-docs/internal/ops/cascade-track/phase-5-v0.0b-stage-c-input-spec.md
#   - CSD reconvene DECISION: qgi-docs/internal/majles/in-progress/2026-05-05_Ihsa_phase5-v0-0b-csd-reconvene_DECISION.md
#   - DSCDI module (the writer's library): qgi-pipeline/batch/dscdi-finder/src/dscdi_finder.py
resource "aws_glue_catalog_table" "dscdis" {
  name          = "dscdis"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-B-dscdi-finder/dscdis/"
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
      name = "correlation"
      type = "float"
    }
    columns {
      name = "indicator_numeric_id"
      type = "smallint"
    }
    columns {
      name = "contains_predicted"
      type = "boolean"
    }
    # Stage D additions (per CSD reconvene DECISION):
    columns {
      name = "is_demeaned"
      type = "boolean"
    }
    columns {
      name = "indicator_class"
      type = "string"
    }
  }

  partition_keys {
    name = "country_a_id"
    type = "smallint"
  }
}

# ---------------------------------------------------------------------------
# Glue — dscdi_indicator_manifest table (Phase 5 v0.0b Stage F preflight)
# ---------------------------------------------------------------------------
# One row per indicator processed by dscdi-finder. This is the Phase 6 EB
# framework's queryable substrate-quality surface — distinguishes the 4
# Class A demeaning_insufficient flagged indicators (FP.CPI.TOTL.ZG,
# NY.GDP.PCAP.CD, SH.DYN.MORT, SP.POP.TOTL per Stage E results) from the
# 105 indicators where the substrate is clean.
#
# Without this manifest, Phase 6 would have to either hardcode the flagged
# indicator IDs (brittle) or recompute mean_abs_pairwise_corr per indicator
# from the dscdis correlation rows at query time (expensive).
#
# Table is UNPARTITIONED. Each dscdi-finder Batch job writes a single 1-row
# Parquet file at `s3://{bucket}/pipeline-B-dscdi-finder/manifest/{indicator_id}.parquet`.
# Athena reads all files at the location prefix unioned. 109 indicators →
# 109 small files → ~10 KB total. No partition discovery needed; dots in
# indicator IDs (e.g., `FP.CPI.TOTL.ZG`) are valid in plain S3 object keys
# (only Hive partition VALUES are sensitive to dots).
#
# References:
#   - DSCDIResult dataclass: qgi-pipeline/batch/dscdi-finder/src/dscdi_finder.py
#   - Stage E completion report: qgi-docs/internal/ops/cascade-track/results/phase-5-v0.0b-stage-e-completion.md
resource "aws_glue_catalog_table" "dscdi_indicator_manifest" {
  name          = "dscdi_indicator_manifest"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-B-dscdi-finder/manifest/"
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
      name = "indicator_id"
      type = "string"
    }
    # from result.disposition.indicator_class on the DSCDIResult dataclass
    # (qgi-pipeline/batch/dscdi-finder/src/dscdi_finder.py — entrypoint
    # flattens this when constructing the manifest row).
    columns {
      name = "indicator_class"
      type = "string"
    }
    # from result.disposition.transform (same indirection note as above)
    columns {
      name = "transform"
      type = "string"
    }
    # bigint matches pandas int64 default for Python int columns; avoids
    # silent type drift when Athena/Glue reads the Parquet output.
    columns {
      name = "n_countries"
      type = "bigint"
    }
    # double (not float) so the Priya Stage C exit-gate threshold value
    # (0.25 boundary) is stored at full pandas float64 precision and
    # not silently downcast to FLOAT32 on Athena read. This is a
    # diagnostic-gate scalar, not a raw correlation value; precision
    # matters for Phase 6 architecture-note decisions.
    columns {
      name = "mean_abs_pairwise_corr"
      type = "double"
    }
    columns {
      name = "demeaning_applied"
      type = "boolean"
    }
    # Priya's Stage C exit gate flag — true when mean_abs_pairwise_corr
    # post-demeaning > 0.25 (Class A only; surfaces the 4 flagged indicators).
    columns {
      name = "demeaning_insufficient"
      type = "boolean"
    }
    # Reason demeaning was suppressed for an otherwise-Class-A indicator
    # (e.g., "no_transform_outlier" for NY.GDP.MKTP.KD.ZG which is already
    # a differenced series). Nullable string.
    #
    # PRODUCER CONTRACT: This column is derived AT WRITE TIME by the
    # dscdi-finder entrypoint (PR-3, qgi-pipeline) from indicator_id
    # membership in `OUTLIER_NO_TRANSFORM` / `OUTLIER_LOG_DIFFERENCE` etc.
    # `DSCDIResult` does not have a `suppressed_reason` field directly —
    # the dataclass exposes `demeaning_applied` (boolean), and the
    # entrypoint encodes the reason. PR-3 must include a unit test
    # asserting `suppressed_reason = 'no_transform_outlier'` for
    # NY.GDP.MKTP.KD.ZG and `suppressed_reason IS NULL` for indicators
    # where demeaning was actually applied.
    columns {
      name = "suppressed_reason"
      type = "string"
    }
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
    # #461 (D7 plumbing): aggregated `OR(scdi.contains_predicted)` across
    # the SCDIs that contributed to this pattern. Pre-#461 rows have NULL;
    # the recipe-engine + frontend badge logic coalesces NULL to false.
    columns {
      name = "contains_predicted"
      type = "boolean"
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
    # #348 V-Dem integration (#485): per-row provider attribution.
    # Legacy parquet (pre-#485) does not have this column; Athena returns
    # NULL for those rows. New writes (V-Dem ingest #487, future provider
    # ingestion scripts) populate "WB" / "FAO" / "VDEM" / "ILO" / "UCDP".
    # Backfill of legacy NULL rows happens implicitly on the next full
    # pipeline regeneration from source.
    columns {
      name = "provider"
      type = "string"
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
# Glue — recipes_aggregated table (#462 Fork B Level-4 Recipe object)
#
# Phase 5b.6.5 output: one row per L3 event_category (71 rows total). The
# Recipe-as-aggregated-fingerprint phase the audit found missing — founder's
# bullets 1, 2, 6 implemented as a real Athena CTAS scanning the deduped
# recipes view (#458) joined to patterns (for indicator IDs).
#
# Per Majles consult Decision 3 (carried OPPOSE 6-5): MVP property list
# extended from 3 to 11 to satisfy the council's calibration / uncertainty /
# coverage-bias / provenance pushback. See:
#   - qgi-docs/internal/majles/2026-04-25_recipe_v2_majles_consult.md
#     (Decision 3 + Step 4 synthesis)
#   - qgi-docs/internal/majles/2026-04-25_recipe_audit.md §4 (schema)
#
# This table is Terraform-managed (unlike `recipes` which goes through
# Athena CTAS) — V2.0's first-class object deserves explicit schema
# control so a producer-side regression fails LOUD on the next pipeline
# run rather than silently drifting.
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "recipes_aggregated" {
  name          = "recipes_aggregated"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-recipe-aggregator/output/data/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    # Core spec
    columns {
      name = "event_category"
      type = "string"
    }
    columns {
      name = "canonical_length"
      type = "smallint"
    }
    # Marcus + Roshani: dispersion alongside point estimate.
    columns {
      name = "length_distribution"
      type = "array<struct<length:smallint,count:bigint>>"
    }
    # Marcus + Roshani + Kwame: TF-IDF frequency, per-indicator CI, top-K=15.
    columns {
      name = "indicator_fingerprint"
      type = "array<struct<indicator_id:smallint,frequency:float,ci_lower:float,ci_upper:float,avg_corr_magnitude:float,tfidf_score:float>>"
    }
    # Amara: surface Eurocentric-data-skew as first-class property.
    columns {
      name = "coverage_bias_diagnostic"
      type = "struct<n_pairs:int,oecd_share:float,regional_concentration:array<struct<region:string,share:float>>>"
    }
    columns {
      name = "total_instances"
      type = "bigint"
    }
    columns {
      name = "n_distinct_country_pairs"
      type = "bigint"
    }
    # Ciaran: provenance for ops + drift detection.
    columns {
      name = "last_recomputed_at"
      type = "timestamp"
    }
    columns {
      name = "pipeline_version"
      type = "string"
    }
    # Nadia: schema-evolution discipline.
    columns {
      name = "schema_version"
      type = "smallint"
    }
    # #461 D7 plumbing inherited.
    columns {
      name = "contains_predicted"
      type = "boolean"
    }
  }

  # No partition keys: 71 rows total, partitioning is overkill.
}

# ---------------------------------------------------------------------------
# Glue — pattern_indicator_lookup table (#495 cost-reduction)
#
# A thin projection of qgi_data.patterns containing only
# (pattern_id, indicator_numeric_ids) — ~50 MB compressed vs 64 GB for the
# full patterns table. The recipe-engine CTAS uses this as the JOIN target
# for the recipes_deduped → patterns join, replacing the 64 GB full-table
# scan with a ~50 MB scan (~90% cost reduction per invocation).
#
# Built by build_pattern_indicator_lookup_table() in
# pipeline-recipe-engine-finalize/lambda_function.py, which:
#   1. Clears s3://…/pattern-indicator-lookup/parquet/
#   2. INSERT INTO SELECT pattern_id, indicator_numeric_ids FROM patterns
#   3. Guarded by the same 60-min idempotency window as recipes_aggregated
#
# No partition key: the table is tiny (one row per pattern — estimated
# ~500K rows at 50 MB total). Full-table scans on the lookup are cheap;
# no partition pruning benefit.
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "pattern_indicator_lookup" {
  name          = "pattern_indicator_lookup"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pattern-indicator-lookup/parquet/"
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
      name = "indicator_numeric_ids"
      type = "array<smallint>"
    }
  }

  # No partition keys: the full table is ~50 MB; full scans are negligible.
}

# ---------------------------------------------------------------------------
# Glue — country_recipe_scores table (#463 Fork B Phase 5b.6.6)
#
# One row per (country, event_category) — ~89 × 71 = 6.3K rows total.
# Output of the Country-vs-Recipe Scoring Lambda: how does this country's
# current trajectory match the canonical Recipe for this event_category?
#
# Per Majles consult Decision 1 (11-0) + Decision 3 calibration requirement
# (Roshani / Nasrin: "calibration is not optional and is not deferred").
#
# Read by:
# - frontend `/signals/{country}` (all recipes for one country, sorted by score)
# - frontend `/signals/{country}/{slug}` (single (country, recipe) leaf)
# - frontend `/precedents/{slug}` ("currently flagged countries" section)
#
# No partitioning — table is small enough that full scans cost <0.01¢. The
# frontend queries are by country_id (signals pages) or event_category
# (precedents pages); both project well without partitioning.
# ---------------------------------------------------------------------------
resource "aws_glue_catalog_table" "country_recipe_scores" {
  name          = "country_recipe_scores"
  database_name = aws_glue_catalog_database.qgi_data.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "parquet.compress" = "SNAPPY"
    "classification"   = "parquet"
    "EXTERNAL"         = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${local.bucket_name}/pipeline-recipe-scorer/output/data/"
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
      name = "country_id"
      type = "smallint"
    }
    columns {
      name = "event_category"
      type = "string"
    }
    # Raw similarity in [0, 1] before calibration.
    columns {
      name = "similarity_raw"
      type = "float"
    }
    # Calibrated probability in [0, 1] via Platt or isotonic. This is the
    # number the frontend renders. Roshani's requirement.
    columns {
      name = "similarity_calibrated"
      type = "float"
    }
    # Sebastien's partial-coverage tolerance: how many of the fingerprint's
    # indicators were present in the country's data.
    columns {
      name = "indicators_matched"
      type = "smallint"
    }
    columns {
      name = "indicators_in_fingerprint"
      type = "smallint"
    }
    columns {
      name = "coverage_ratio"
      type = "float"
    }
    # When coverage < threshold (e.g. 30%), suppressed=true and the
    # frontend shows "insufficient indicator coverage" rather than a
    # potentially-misleading score.
    columns {
      name = "suppressed"
      type = "boolean"
    }
    columns {
      name = "suppression_reason"
      type = "string"
    }
    # #461 D7 plumbing inherited from the Recipe.
    columns {
      name = "contains_predicted"
      type = "boolean"
    }
    # Ciaran provenance.
    columns {
      name = "last_computed_at"
      type = "timestamp"
    }
    columns {
      name = "pipeline_version"
      type = "string"
    }
    columns {
      name = "calibration_mapping_version"
      type = "string"
    }
  }

  # No partition keys (~6.3K rows total).
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
    # #370 — dedicated prefix, not the shared `input/` prefix. The latter
    # holds countries.csv alongside indicator_map*.csv files whose
    # 2-column schemas are NOT countries-shaped. Reading the whole
    # `input/` prefix produced 811 rows instead of 261 (pre-fix) and
    # created the 2026-04-20 Phase B crash where FAO m49 map values
    # ("Afghanistan") landed in the id column and broke a later integer
    # cast in the recipe engine.
    #
    # First attempt (2026-04-22) used a file-level URI
    # (`.../input/countries.csv`). Glue OpenCSVSerde rejected it —
    # Athena returned 0 rows. Falling back to a dedicated sibling prefix
    # `pipeline-A-indicator-extractor/countries/` containing ONLY
    # countries.csv; this prefix is not used for any other pipeline
    # input, so future uploads cannot pollute it.
    #
    # IMPORTANT sync note: the original countries.csv at
    # `pipeline-A-indicator-extractor/input/countries.csv` is still read
    # directly (outside Glue) by three Batch containers (scdi-finder,
    # indicator-fetcher, indicator-fetcher-fao). The file in the new
    # `countries/` prefix is a COPY. When countries.csv is updated,
    # both copies must be updated. See pitfalls.md "countries.csv
    # duplicated locations" for the sync playbook.
    location      = "s3://${local.bucket_name}/pipeline-A-indicator-extractor/countries/"
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

# ---------------------------------------------------------------------------
# #594: Daily S3 cost alert via AWS Budgets (FREE: 2 budgets/account allowed)
# ---------------------------------------------------------------------------
#
# May 2 2026 had a $10.14 S3 cost spike that was completely invisible until
# the bill arrived 24+ hours later. This budget alerts the moment Cost
# Explorer detects S3 spend > $3 in a single day, giving us same-day signal
# vs. the prior end-of-week surprise.
#
# Why AWS Budgets instead of CloudWatch alarm on S3 request count:
#   - The alarm path requires S3 Storage Lens Advanced tier (~$0.36/mo for
#     1.8M-object bucket) since the FREE Storage Lens tier does not expose
#     GetRequests/PutRequests/AllRequests. Founder constraint is explicitly
#     ZERO new ongoing cost — Budgets is the only $0 path that catches the
#     spike same-day. (Sonnet research 2026-05-03 documented full trade-off.)
#   - Budgets alerts on dollar cost (the actual harm signal), not request
#     count. More directly actionable.
#   - 2 budgets per account are FREE; we use 1.
#
# Threshold rationale: $3/day picks up the May 2 incident ($10.14) cleanly
# and stays above QGI's typical daily S3 spend of ~$0.30. Tunable via
# var if needed for QA/prod.
#
# Latency: Cost Explorer cost data lags ~12-24h. The budget fires when AWS
# detects daily spend crossing the threshold — typically next-morning
# rather than real-time. This is the same lag we'd get from CloudWatch
# request metrics anyway (S3 request metrics are also daily).

resource "aws_sns_topic" "cost_alerts" {
  name         = "qgi-${var.environment}-cost-alerts"
  display_name = "QGI Cost Alerts"
  tags         = var.tags
}

# Permission for AWS Budgets to publish to this SNS topic. Without this,
# Budgets' Publish call is silently denied — Budgets does NOT surface a
# permission error in the console; alarms simply don't fire.
#
# The aws:SourceAccount condition prevents the confused-deputy attack
# (per AWS 2023+ guidance for Budgets→SNS). Without it, a Budget in any
# AWS account could legitimately publish to this topic if they happen
# to know its ARN. Mirrors the pattern used by AllowS3LogDelivery
# above for the access-logs prefix.
resource "aws_sns_topic_policy" "cost_alerts" {
  arn = aws_sns_topic.cost_alerts.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowBudgetsToPublish"
      Effect    = "Allow"
      Principal = { Service = "budgets.amazonaws.com" }
      Action    = "SNS:Publish"
      Resource  = aws_sns_topic.cost_alerts.arn
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.aws_account_id
        }
      }
    }]
  })
}

# Daily S3 cost budget. Fires SNS notification when single-day actual spend
# crosses $3. Uses ACTUAL (not forecasted) so we react to real charges,
# not predictions (FORECASTED would create false positives on bursty
# pipeline runs).
resource "aws_budgets_budget" "s3_daily" {
  name         = "qgi-${var.environment}-s3-daily"
  budget_type  = "COST"
  limit_amount = "3.00"
  limit_unit   = "USD"
  time_unit    = "DAILY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Simple Storage Service"]
  }

  notification {
    comparison_operator = "GREATER_THAN"
    # 100% of the $3.00 limit = fires at >= $3.00 actual spend.
    # Threshold is a PERCENTAGE of limit_amount, not a raw dollar value.
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.cost_alerts.arn]
  }

  tags = var.tags

  # Topic policy must be attached BEFORE Budgets tries to publish.
  # Terraform cannot infer this from the topic-arn reference alone
  # (the policy is a side-effect on the topic, not a return value).
  depends_on = [aws_sns_topic_policy.cost_alerts]
}

# To get email or other notifications when this fires, add an
# aws_sns_topic_subscription pointing at contact@qgintelligence.com (the QGI
# ops alarm inbox per .claude/memory). Subscriptions require email
# confirmation outside Terraform — left out of this module to avoid
# imperatively triggering confirmation flows. Add per-environment in the
# environments/*/main.tf if desired.
