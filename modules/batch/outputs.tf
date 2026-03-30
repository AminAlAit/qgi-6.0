output "job_queue_arn"        { value = aws_batch_job_queue.scdi.arn }
output "job_queue_name"       { value = aws_batch_job_queue.scdi.name }
output "job_definition_arn"   { value = aws_batch_job_definition.scdi_finder.arn }
output "job_definition_name"  { value = aws_batch_job_definition.scdi_finder.name }
