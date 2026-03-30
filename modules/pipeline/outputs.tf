output "state_machine_arn"  { value = aws_sfn_state_machine.pipeline.arn }
output "state_machine_name" { value = aws_sfn_state_machine.pipeline.name }

output "lambda_arns" {
  value = {
    ops_janitor        = aws_lambda_function.ops_janitor.arn
    a_sheet_fetcher    = aws_lambda_function.a_sheet_fetcher.arn
    a_dispatcher       = aws_lambda_function.a_dispatcher.arn
    a_indicator_extractor = aws_lambda_function.a_indicator_extractor.arn
    a_worker           = aws_lambda_function.a_worker.arn
    a_reporter         = aws_lambda_function.a_reporter.arn
    b_orchestrator     = aws_lambda_function.b_orchestrator.arn
    b_dispatcher       = aws_lambda_function.b_dispatcher.arn
    b_scdi_finder      = aws_lambda_function.b_scdi_finder.arn
    ops_batch_checker  = aws_lambda_function.ops_batch_checker.arn
    c_dispatcher       = aws_lambda_function.c_dispatcher.arn
    c_worker           = aws_lambda_function.c_worker.arn
    c_dlq_inspector    = aws_lambda_function.c_dlq_inspector.arn
    ops_dlq_scanner    = aws_lambda_function.ops_dlq_scanner.arn
    batch_job_terminator = aws_lambda_function.batch_job_terminator.arn
  }
}
