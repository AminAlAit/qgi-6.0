terraform {
  backend "s3" {
    bucket         = "qgi-infra-state-222222222222"
    key            = "staging/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "qgi-infra-state-lock"
    encrypt        = true
  }
}
