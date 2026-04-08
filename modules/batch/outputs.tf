output "job_queue_arn"       { value = aws_batch_job_queue.scdi.arn }
output "job_queue_name"      { value = aws_batch_job_queue.scdi.name }
output "job_definition_arn"  { value = aws_batch_job_definition.scdi_finder.arn }
output "job_definition_name" { value = aws_batch_job_definition.scdi_finder.name }

# #FAR-1: Phase 1 indicator fetcher Fargate Spot resources
output "fetcher_job_queue_arn"       { value = aws_batch_job_queue.fetcher.arn }
output "fetcher_job_queue_name"      { value = aws_batch_job_queue.fetcher.name }
output "fetcher_job_definition_arn"  { value = aws_batch_job_definition.indicator_fetcher.arn }
output "fetcher_job_definition_name" { value = aws_batch_job_definition.indicator_fetcher.name }
# ECR repo outputs removed — the fetcher image now lives in the management
# account (#152 Path A). Referenced via var.management_account_id inline.
