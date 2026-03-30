variable "environment" {
  type    = string
  default = "staging"
}

variable "aws_account_id" {
  type        = string
  description = "qgi-staging account ID"
}

variable "management_account_id" {
  type        = string
  description = "Management account ID — hosts ECR registry"
  default     = "111111111111"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}
