# Cascade SFN — "" (not null) when enable_cascade = false, so the iam module's
# `var.state_machine_arn != ""` fallback (iam/main.tf) is taken in a TE-only env.
output "state_machine_arn" { value = coalesce(one(aws_sfn_state_machine.pipeline[*].arn), "") }
output "state_machine_name" { value = coalesce(one(aws_sfn_state_machine.pipeline[*].name), "") }
output "fetch_state_machine_arn" { value = aws_sfn_state_machine.fetch_pipeline.arn }
output "fetch_state_machine_name" { value = aws_sfn_state_machine.fetch_pipeline.name }

output "lambda_arns" {
  value = {
    # Always-present Lambdas
    ops_janitor          = aws_lambda_function.ops_janitor.arn
    a_sheet_fetcher      = aws_lambda_function.a_sheet_fetcher.arn
    a_batch_dispatcher   = aws_lambda_function.a_batch_dispatcher.arn
    a_batch_checker      = aws_lambda_function.a_batch_checker.arn
    a_reporter           = aws_lambda_function.a_reporter.arn
    ops_dlq_scanner      = aws_lambda_function.ops_dlq_scanner.arn
    batch_job_terminator = aws_lambda_function.batch_job_terminator.arn
    # Cascade/SCDI-exclusive Lambdas — "" (not null) when enable_cascade = false
    b_orchestrator    = coalesce(one(aws_lambda_function.b_orchestrator[*].arn), "")
    b_dispatcher      = coalesce(one(aws_lambda_function.b_dispatcher[*].arn), "")
    b_scdi_finder     = coalesce(one(aws_lambda_function.b_scdi_finder[*].arn), "")
    ops_batch_checker = coalesce(one(aws_lambda_function.ops_batch_checker[*].arn), "")
    c_dispatcher      = coalesce(one(aws_lambda_function.c_dispatcher[*].arn), "")
    c_worker          = coalesce(one(aws_lambda_function.c_worker[*].arn), "")
    c_dlq_inspector   = coalesce(one(aws_lambda_function.c_dlq_inspector[*].arn), "")
  }
}
