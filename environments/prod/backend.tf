terraform {
  backend "s3" {
    bucket         = "qgi-infra-state-444444444444"
    key            = "prod/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "qgi-infra-state-lock"
    encrypt        = true
    assume_role = {
      role_arn = "arn:aws:iam::444444444444:role/OrganizationAccountAccessRole"
    }
  }
}
