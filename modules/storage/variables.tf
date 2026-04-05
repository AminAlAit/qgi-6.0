variable "environment" {
  type        = string
  description = "Environment name (staging, qa, prod)"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID for this environment"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "management_account_id" {
  type        = string
  description = "Management AWS account ID (for cross-account S3 sync)"
  default     = "111111111111"
}

variable "tags" {
  type    = map(string)
  default = {}
}
