# ---------------------------------------------------------------------------
# GitHub Actions OIDC provider — allows qgi-pipeline CI/CD to deploy Lambdas
# ---------------------------------------------------------------------------
data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

resource "aws_iam_role" "github_actions_lambda_deploy" {
  name = "github-actions-qgi-lambda-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Allow from main branch and version tags
          "token.actions.githubusercontent.com:sub" = [
            "repo:AminAlAit/qgi-pipeline:ref:refs/heads/main",
            "repo:AminAlAit/qgi-pipeline:ref:refs/tags/*",
          ]
        }
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "github_actions_lambda_deploy" {
  name = "qgi-lambda-deploy-policy"
  role = aws_iam_role.github_actions_lambda_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:UpdateFunctionCode", "lambda:GetFunction"]
      Resource = "arn:aws:lambda:${var.region}:${var.aws_account_id}:function:qgi-*"
    }]
  })
}

# ---------------------------------------------------------------------------
# Lambda execution role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "lambda_execution" {
  name = "qgi-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "lambda_execution" {
  name = "qgi-lambda-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:${var.aws_account_id}:log-group:/aws/lambda/qgi-*"
      },
      # S3 — data lake
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket",
        "s3:GetBucketLocation"]
        Resource = [var.data_lake_bucket_arn, "${var.data_lake_bucket_arn}/*"]
      },
      # SQS — all pipeline queues
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage",
          "sqs:GetQueueAttributes", "sqs:GetQueueUrl", "sqs:ChangeMessageVisibility"]
        Resource = var.queue_arns
      },
      # DynamoDB — indicator updates + completion counters
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
          "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"]
        Resource = [var.indicator_table_arn, var.completion_table_arn]
      },
      # Athena
      {
        Effect   = "Allow"
        Action   = ["athena:StartQueryExecution", "athena:GetQueryExecution",
          "athena:GetQueryResults", "athena:StopQueryExecution",
          "athena:ListQueryExecutions"]
        Resource = "arn:aws:athena:${var.region}:${var.aws_account_id}:workgroup/QGI-Lambda-Workgroup"
      },
      # Glue — qgi_data database
      {
        Effect   = "Allow"
        Action   = ["glue:GetDatabase", "glue:GetTable", "glue:GetTables",
          "glue:CreateTable", "glue:UpdateTable", "glue:DeleteTable",
          "glue:GetPartition", "glue:GetPartitions", "glue:BatchCreatePartition",
          "glue:BatchDeletePartition"]
        Resource = [
          "arn:aws:glue:${var.region}:${var.aws_account_id}:catalog",
          "arn:aws:glue:${var.region}:${var.aws_account_id}:database/qgi_data",
          "arn:aws:glue:${var.region}:${var.aws_account_id}:table/qgi_data/*",
        ]
      },
      # Batch — orchestrator and terminator
      {
        Effect   = "Allow"
        Action   = ["batch:SubmitJob", "batch:DescribeJobs", "batch:ListJobs",
        "batch:TerminateJob", "batch:DescribeJobQueues", "batch:DescribeJobDefinitions"]
        Resource = "*"
      },
      # SNS — pipeline notifications
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = var.sns_topic_arn
      },
      # Lambda — reporter invokes b-orchestrator directly (known issue, kept for parity)
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = "arn:aws:lambda:${var.region}:${var.aws_account_id}:function:qgi-*"
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# AWS Batch — ECS instance role (EC2 instances in compute environment)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_instance" {
  name = "qgi-ecs-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_instance_container_service" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name = "qgi-ecs-instance-role"
  role = aws_iam_role.ecs_instance.name
}

# ---------------------------------------------------------------------------
# AWS Batch — job role (ECS task role for the scdi-finder container)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "batch_job" {
  name = "qgi-batch-job-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "batch_job" {
  name = "qgi-batch-job-policy"
  role = aws_iam_role.batch_job.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 — data lake
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:GetBucketLocation"]
        Resource = [var.data_lake_bucket_arn, "${var.data_lake_bucket_arn}/*"]
      },
      # ECR — pull image from management account
      # NOTE: management account ECR repo also needs a resource policy allowing this role.
      # Add aws_ecr_repository_policy in qgi-aws-tf management Terraform (see issue #8).
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage", "ecr:BatchCheckLayerAvailability"]
        Resource = "arn:aws:ecr:${var.region}:${var.management_account_id}:repository/qgi-pipeline-b-scdi-finder"
      },
      # CloudWatch Logs — Batch job logging
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:${var.aws_account_id}:log-group:/aws/batch/*"
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# Step Functions — execution role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "stepfunctions" {
  name = "qgi-stepfunctions-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.aws_account_id
        }
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "stepfunctions" {
  name = "qgi-stepfunctions-policy"
  role = aws_iam_role.stepfunctions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Invoke all qgi Lambda functions
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = "arn:aws:lambda:${var.region}:${var.aws_account_id}:function:qgi-*"
      },
      # Athena — for MSCK REPAIR TABLE queries (Phase 3 + Phase 4)
      {
        Effect   = "Allow"
        Action   = ["athena:StartQueryExecution", "athena:GetQueryExecution",
          "athena:GetQueryResults", "athena:StopQueryExecution"]
        Resource = "arn:aws:athena:${var.region}:${var.aws_account_id}:workgroup/*"
      },
      # S3 — Athena query result writes
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:GetBucketLocation",
          "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]
        Resource = [var.data_lake_bucket_arn, "${var.data_lake_bucket_arn}/*"]
      },
      # Glue — Athena needs Glue for metadata
      {
        Effect   = "Allow"
        Action   = ["glue:GetDatabase", "glue:GetTable", "glue:GetTables",
          "glue:GetPartition", "glue:GetPartitions", "glue:BatchCreatePartition",
          "glue:UpdateTable", "glue:CreateTable", "glue:DeleteTable"]
        Resource = [
          "arn:aws:glue:${var.region}:${var.aws_account_id}:catalog",
          "arn:aws:glue:${var.region}:${var.aws_account_id}:database/qgi_data",
          "arn:aws:glue:${var.region}:${var.aws_account_id}:table/qgi_data/*",
        ]
      },
      # CloudWatch Logs — Step Functions execution logging
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogDelivery", "logs:GetLogDelivery", "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery", "logs:ListLogDeliveries", "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies", "logs:DescribeLogGroups"]
        Resource = "*"
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# EventBridge Scheduler — role to start the Step Functions execution
# ---------------------------------------------------------------------------
resource "aws_iam_role" "eventbridge_scheduler" {
  name = "qgi-eventbridge-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.aws_account_id
        }
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "eventbridge_scheduler" {
  name = "qgi-eventbridge-scheduler-policy"
  role = aws_iam_role.eventbridge_scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["states:StartExecution"]
        Resource = var.state_machine_arn != "" ? var.state_machine_arn : "arn:aws:states:${var.region}:${var.aws_account_id}:stateMachine:qgi-indicator-monthly-updater"
      }
    ]
  })
}
