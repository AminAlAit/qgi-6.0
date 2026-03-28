# TODO: fill in once staging AWS account and state backend are provisioned
# terraform {
#   backend "s3" {
#     bucket         = "qgi-infra-state-<account-id>"
#     key            = "staging/terraform.tfstate"
#     region         = "eu-central-1"
#     dynamodb_table = "qgi-infra-state-lock"
#     encrypt        = true
#   }
# }
