# monitoring module variables

variable "environment" {
  description = "Environment name (staging, qa, prod)."
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN to publish paging alarms to (HIGH_COUNTRY_COUNT and MEDIAN_SALIENCE_SCORE). COUNTRY_RISKS_BYTES alarms do NOT page."
  type        = string
}

variable "tags" {
  description = "Tags applied to every monitoring resource."
  type        = map(string)
  default     = {}
}
