output "job_queue_arn"       { value = aws_batch_job_queue.scdi.arn }
output "job_queue_name"      { value = aws_batch_job_queue.scdi.name }
output "job_definition_arn"  { value = aws_batch_job_definition.scdi_finder.arn }
output "job_definition_name" { value = aws_batch_job_definition.scdi_finder.name }

# #FAR-1: Phase 1 indicator fetcher Fargate Spot resources
output "fetcher_job_queue_arn"       { value = aws_batch_job_queue.fetcher.arn }
output "fetcher_job_queue_name"      { value = aws_batch_job_queue.fetcher.name }
output "fetcher_job_definition_arn"  { value = aws_batch_job_definition.indicator_fetcher.arn }
output "fetcher_job_definition_name" { value = aws_batch_job_definition.indicator_fetcher.name }

# #241 Phase B: FAOSTAT bulk-download Fargate task. Same queue, different
# JobDef (bigger memory for pandas CSV parse). Dispatcher routes FAOSTAT
# indicators to this JobDef via BATCH_JOB_DEFINITION_MAP env var.
output "fao_fetcher_job_definition_arn"  { value = aws_batch_job_definition.indicator_fetcher_fao.arn }
output "fao_fetcher_job_definition_name" { value = aws_batch_job_definition.indicator_fetcher_fao.name }
output "fao_fetcher_ecr_repository_url"  { value = aws_ecr_repository.indicator_fetcher_fao.repository_url }
