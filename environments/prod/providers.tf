terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
  assume_role {
    role_arn     = "arn:aws:iam::${var.aws_account_id}:role/OrganizationAccountAccessRole"
    session_name = "terraform-qgi-${var.environment}"
  }
  default_tags {
    tags = local.tags
  }
}
