terraform {
  backend "s3" {
    bucket         = "qgi-infra-state-555555555555"
    key            = "prod/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "qgi-infra-state-lock"
    encrypt        = true
  }
}
