variable "environment" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "management_account_id" {
  type        = string
  description = "Management account ID — ECR registry lives here"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "batch_job_role_arn" {
  type = string
}

variable "ecs_instance_profile_arn" {
  type = string
}

variable "data_lake_bucket_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
