variable "environment" {
  type = string
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID for this environment"
}

variable "management_account_id" {
  type        = string
  description = "Management account ID (hosts ECR)"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "data_lake_bucket_arn" {
  type = string
}

variable "queue_arns" {
  type        = list(string)
  description = "ARNs of all SQS queues (main + DLQ)"
}

variable "indicator_table_arn" {
  type = string
}

variable "completion_table_arn" {
  type = string
}

variable "sns_topic_arn" {
  type = string
}

variable "state_machine_arn" {
  type        = string
  description = "Step Functions state machine ARN for EventBridge scheduler role. Pass empty string during bootstrap."
  default     = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}
