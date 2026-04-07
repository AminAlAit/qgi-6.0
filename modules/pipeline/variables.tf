variable "environment" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "management_account_id" {
  type = string
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "data_lake_bucket_name" {
  type = string
}

variable "glue_database_name" {
  type = string
}

variable "athena_workgroup_name" {
  type = string
}

variable "sns_topic_arn" {
  type = string
}

variable "lambda_execution_role_arn" {
  type = string
}

variable "stepfunctions_role_arn" {
  type = string
}

variable "eventbridge_scheduler_role_arn" {
  type = string
}

variable "batch_job_queue_arn" {
  type = string
}

variable "batch_job_definition_arn" {
  type = string
}

# SQS queue URLs and ARNs
variable "queue_a_main_url" { type = string }
variable "queue_a_main_arn" { type = string }
variable "queue_a_dlq_url"  { type = string }
variable "queue_b_main_url" { type = string }
variable "queue_b_main_arn" { type = string }
variable "queue_b_dlq_url"  { type = string }
variable "queue_c_main_url" { type = string }
variable "queue_c_main_arn" { type = string }
variable "queue_c_dlq_url"  { type = string }
variable "queue_c_dlq_arn"  { type = string }

variable "completion_table_name" {
  type        = string
  description = "Name of qgi-completion-counters DynamoDB table"
}

# #148: indicator values DDB for fast frontend reads
variable "indicator_values_table_name" {
  type        = string
  description = "Name of the qgi-indicator-values DynamoDB table (#148). Read by lib/indicator-values.ts via BatchGetItem; written by pipeline-a-completer."
}

variable "dispatch_limit" {
  type        = number
  default     = 0
  description = "Cap the number of indicators dispatched in Phase 1. 0 = unlimited (production). Set to 2 for E2E tests."
}

variable "batch_invoke_mode" {
  type        = string
  default     = "invoke"
  description = "Mode passed to b-orchestrator: 'invoke' submits all jobs; 'invoke_5' caps at 5 (for staging tests)."
}

# #FAR-1: Phase 1 Fargate Spot dispatch
variable "fetcher_job_queue_arn" {
  type        = string
  description = "Batch job queue ARN for Fargate Spot indicator fetcher tasks"
}

variable "fetcher_job_definition_arn" {
  type        = string
  description = "Batch job definition ARN for Fargate Spot indicator fetcher"
}

variable "pipeline_a_counter_table_name" {
  type        = string
  description = "Name of qgi-pipeline-a-counter DynamoDB table (#FAR-1)"
}

variable "indicator_table_name" {
  type        = string
  default     = "qgi-indicator-updates"
  description = "Name of qgi-indicator-updates tracker DDB table"
}

variable "phase1_deadman_seconds" {
  type        = number
  default     = 5400
  description = "Hard cap (seconds) for Phase 1 fan-out before deadman trips. Default 90 min."
}

variable "phase1_jitter_min_s" {
  type        = number
  default     = 60
  description = "Minimum random sleep (seconds) per fetcher task before WB API call"
}

variable "phase1_jitter_max_s" {
  type        = number
  default     = 300
  description = "Maximum random sleep (seconds) per fetcher task before WB API call"
}

variable "tags" {
  type    = map(string)
  default = {}
}
