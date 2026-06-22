# Cascade/SCDI-exclusive outputs — null when enable_cascade = false.
# The pipeline module variable batch_job_queue_arn has default = "" so
# environments can omit it when enable_cascade = false.
output "job_queue_arn" { value = one(aws_batch_job_queue.scdi[*].arn) }
output "job_queue_name" { value = one(aws_batch_job_queue.scdi[*].name) }
output "job_definition_arn" { value = one(aws_batch_job_definition.scdi_finder[*].arn) }
output "job_definition_name" { value = one(aws_batch_job_definition.scdi_finder[*].name) }

# #FAR-1: Phase 1 indicator fetcher Fargate Spot resources
output "fetcher_job_queue_arn" { value = aws_batch_job_queue.fetcher.arn }
output "fetcher_job_queue_name" { value = aws_batch_job_queue.fetcher.name }
output "fetcher_job_definition_arn" { value = aws_batch_job_definition.indicator_fetcher.arn }
output "fetcher_job_definition_name" { value = aws_batch_job_definition.indicator_fetcher.name }

# #241 Phase B: FAOSTAT bulk-download Fargate task. Same queue, different
# JobDef (bigger memory for pandas CSV parse). Dispatcher routes FAOSTAT
# indicators to this JobDef via BATCH_JOB_DEFINITION_MAP env var.
output "fao_fetcher_job_definition_arn" { value = aws_batch_job_definition.indicator_fetcher_fao.arn }
output "fao_fetcher_job_definition_name" { value = aws_batch_job_definition.indicator_fetcher_fao.name }
output "fao_fetcher_ecr_repository_url" { value = aws_ecr_repository.indicator_fetcher_fao.repository_url }

# #494 step 6: V-Dem annual-ingest Fargate task. Fed by the unzip
# Lambda + SF state machine in modules/pipeline/vdem.tf. The SF
# state machine references job_definition_arn directly (NOT via
# BATCH_JOB_DEFINITION_MAP — V-Dem is its own pipeline, not part of
# the indicator-fetcher dispatcher routing).
output "qgi_vdem_ingest_job_definition_arn" { value = aws_batch_job_definition.qgi_vdem_ingest.arn }
output "qgi_vdem_ingest_job_definition_name" { value = aws_batch_job_definition.qgi_vdem_ingest.name }
output "qgi_vdem_ingest_ecr_repository_url" { value = aws_ecr_repository.qgi_vdem_ingest.repository_url }
