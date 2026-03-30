output "github_actions_lambda_deploy_role_arn" { value = aws_iam_role.github_actions_lambda_deploy.arn }
output "lambda_execution_role_arn"      { value = aws_iam_role.lambda_execution.arn }
output "batch_job_role_arn"             { value = aws_iam_role.batch_job.arn }
output "ecs_instance_profile_arn"       { value = aws_iam_instance_profile.ecs_instance.arn }
output "stepfunctions_role_arn"         { value = aws_iam_role.stepfunctions.arn }
output "eventbridge_scheduler_role_arn" { value = aws_iam_role.eventbridge_scheduler.arn }
