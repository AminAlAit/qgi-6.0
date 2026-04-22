# ---------------------------------------------------------------------------
# Monitoring module — V1.9.1 scoring drift alarms (#381)
#
# The Lambda `qgi-pipeline-recipe-engine-finalize` emits 3 CloudWatch custom
# metrics to namespace `QGI/Pipeline` with dimension ScoringVersion=V1.9.1:
#   - HIGH_COUNTRY_COUNT     (Count)
#   - MEDIAN_SALIENCE_SCORE  (None / dimensionless)
#   - COUNTRY_RISKS_BYTES    (Bytes)
#
# Thresholds below are STATIC guardrails. We don't yet have 7 days of
# history to fit anomaly-detection bands, so we pick loose static bands
# around today's observations. These catch catastrophic drift (schema
# break, empty payload, collapsed distribution) without flapping on
# day-to-day noise.
#
# TODO(#381): Once 7+ days of metric history exists, replace these static
# alarms with `aws_cloudwatch_anomaly_detector` + ANOMALY_DETECTION_BAND
# alarms (±2σ). Keep the SNS wiring identical so the paging contract
# doesn't change.
# ---------------------------------------------------------------------------

locals {
  namespace = "QGI/Pipeline"
  dimensions = {
    ScoringVersion = "V1.9.1"
  }
}

# ---------------------------------------------------------------------------
# 1. HIGH_COUNTRY_COUNT — drift out of the acceptable HIGH-tier band.
#
# Ticket #377 target band: [25, 45] HIGH countries.
# Guardrail band: [15, 60] — catches drift outside the acceptable zone
# without flapping on normal scoring-run noise.
# Current staging observation: 33.
# Each scoring run emits one data point; 1h period / 1 evaluation = page
# on the first bad run. PAGES via SNS.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "high_country_count_low" {
  alarm_name          = "qgi-v191-high-country-count-out-of-band-low"
  alarm_description   = "V1.9.1 HIGH_COUNTRY_COUNT dropped below 15 (target band [25,45], guardrail [15,60]). Indicates scoring collapse or upstream data loss."
  namespace           = local.namespace
  metric_name         = "HIGH_COUNTRY_COUNT"
  dimensions          = local.dimensions
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  comparison_operator = "LessThanThreshold"
  threshold           = 15
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "high_country_count_high" {
  alarm_name          = "qgi-v191-high-country-count-out-of-band-high"
  alarm_description   = "V1.9.1 HIGH_COUNTRY_COUNT exceeded 60 (target band [25,45], guardrail [15,60]). Indicates score inflation or threshold drift."
  namespace           = local.namespace
  metric_name         = "HIGH_COUNTRY_COUNT"
  dimensions          = local.dimensions
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 60
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]
  tags                = var.tags
}

# ---------------------------------------------------------------------------
# 2. MEDIAN_SALIENCE_SCORE — distribution shift guard.
#
# Today's observation: ~0.5. Band [0.2, 1.5] is a loose sanity zone.
# No rolling mean yet; replace with ±2σ anomaly detection once 7 days
# of data is live. evaluation_periods=2 — require two trending-bad runs
# before paging so single-run noise doesn't flap. PAGES via SNS.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "median_salience_low" {
  alarm_name          = "qgi-v191-median-salience-out-of-band-low"
  alarm_description   = "V1.9.1 MEDIAN_SALIENCE_SCORE below 0.2 for two consecutive runs. Likely score compression or scoring bug."
  namespace           = local.namespace
  metric_name         = "MEDIAN_SALIENCE_SCORE"
  dimensions          = local.dimensions
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 0.2
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "median_salience_high" {
  alarm_name          = "qgi-v191-median-salience-out-of-band-high"
  alarm_description   = "V1.9.1 MEDIAN_SALIENCE_SCORE above 1.5 for two consecutive runs. Likely score inflation or upstream-signal break."
  namespace           = local.namespace
  metric_name         = "MEDIAN_SALIENCE_SCORE"
  dimensions          = local.dimensions
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 1.5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]
  tags                = var.tags
}

# ---------------------------------------------------------------------------
# 3. COUNTRY_RISKS_BYTES — payload-size sanity guard.
#
# Today's observation: ~684 KB. Band [200 KB, 2 MB] catches catastrophic
# shrink (schema break, empty payload) or bloat (runaway data).
# Per ticket #381: ALARM ONLY — do NOT page. State is visible in console.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "country_risks_bytes_low" {
  alarm_name          = "qgi-v191-country-risks-bytes-out-of-band-low"
  alarm_description   = "V1.9.1 COUNTRY_RISKS_BYTES dropped below 200 KB. Likely schema break or empty payload. ALARM-ONLY (no page)."
  namespace           = local.namespace
  metric_name         = "COUNTRY_RISKS_BYTES"
  dimensions          = local.dimensions
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  comparison_operator = "LessThanThreshold"
  threshold           = 200000
  treat_missing_data  = "notBreaching"
  alarm_actions       = []
  ok_actions          = []
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "country_risks_bytes_high" {
  alarm_name          = "qgi-v191-country-risks-bytes-out-of-band-high"
  alarm_description   = "V1.9.1 COUNTRY_RISKS_BYTES exceeded 2 MB. Likely runaway payload or serialization regression. ALARM-ONLY (no page)."
  namespace           = local.namespace
  metric_name         = "COUNTRY_RISKS_BYTES"
  dimensions          = local.dimensions
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 2000000
  treat_missing_data  = "notBreaching"
  alarm_actions       = []
  ok_actions          = []
  tags                = var.tags
}
