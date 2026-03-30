output "bucket_name" {
  value = aws_s3_bucket.data_lake.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.data_lake.arn
}

output "queue_a_main_url" { value = aws_sqs_queue.a_main.url }
output "queue_a_main_arn" { value = aws_sqs_queue.a_main.arn }
output "queue_a_dlq_url"  { value = aws_sqs_queue.a_dlq.url }
output "queue_a_dlq_arn"  { value = aws_sqs_queue.a_dlq.arn }

output "queue_b_main_url" { value = aws_sqs_queue.b_main.url }
output "queue_b_main_arn" { value = aws_sqs_queue.b_main.arn }
output "queue_b_dlq_url"  { value = aws_sqs_queue.b_dlq.url }
output "queue_b_dlq_arn"  { value = aws_sqs_queue.b_dlq.arn }

output "queue_c_main_url" { value = aws_sqs_queue.c_main.url }
output "queue_c_main_arn" { value = aws_sqs_queue.c_main.arn }
output "queue_c_dlq_url"  { value = aws_sqs_queue.c_dlq.url }
output "queue_c_dlq_arn"  { value = aws_sqs_queue.c_dlq.arn }

output "all_queue_arns" {
  value = [
    aws_sqs_queue.a_main.arn, aws_sqs_queue.a_dlq.arn,
    aws_sqs_queue.b_main.arn, aws_sqs_queue.b_dlq.arn,
    aws_sqs_queue.c_main.arn, aws_sqs_queue.c_dlq.arn,
  ]
}

output "indicator_table_name" { value = aws_dynamodb_table.indicator_updates.name }
output "indicator_table_arn"  { value = aws_dynamodb_table.indicator_updates.arn }

output "completion_table_name" { value = aws_dynamodb_table.completion_counters.name }
output "completion_table_arn"  { value = aws_dynamodb_table.completion_counters.arn }

output "sns_topic_arn" { value = aws_sns_topic.pipeline_notifications.arn }

output "glue_database_name"    { value = aws_glue_catalog_database.qgi_data.name }
output "athena_workgroup_name" { value = aws_athena_workgroup.qgi.name }
