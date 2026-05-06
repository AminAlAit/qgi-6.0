terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # #625: needed by null_resource.athena_result_reuse, which runs
    # `aws athena update-work-group` via local-exec to enable result
    # reuse on the QGI-Lambda-Workgroup. AWS provider 5.x does not
    # expose result_reuse_configuration on aws_athena_workgroup; this
    # is a transitional workaround until provider 6.x adoption.
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}
