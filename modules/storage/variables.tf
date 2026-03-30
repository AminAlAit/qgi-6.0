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

variable "tags" {
  type    = map(string)
  default = {}
}
