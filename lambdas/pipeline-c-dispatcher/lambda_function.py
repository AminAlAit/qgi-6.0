import boto3
import logging
import os
import csv
from io import StringIO
import uuid
import time

logger = logging.getLogger()
logger.setLevel(logging.INFO)

athena_client = boto3.client('athena')
s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')

def run_athena_query(query_string, workgroup, db_name, output_location, expects_result_path=False):
    """Executes a query, waits for it to succeed, and optionally returns the result path."""
    logger.info(f"Executing query: \n{query_string}")
    result_output_location = f"{output_location.rstrip('/')}/dispatcher_query_results/{uuid.uuid4()}"
    
    query_execution = athena_client.start_query_execution(
        QueryString=query_string,
        QueryExecutionContext={'Database': db_name},
        ResultConfiguration={'OutputLocation': result_output_location},
        WorkGroup=workgroup
    )
    query_execution_id = query_execution['QueryExecutionId']
    
    while True:
        stats = athena_client.get_query_execution(QueryExecutionId=query_execution_id)
        status = stats['QueryExecution']['Status']['State']
        if status in ('SUCCEEDED', 'FAILED', 'CANCELLED'):
            if status == 'SUCCEEDED':
                logger.info(f"Query {query_execution_id} succeeded.")
                if expects_result_path:
                    # Use actual output location from API — workgroup may enforce its own path
                    actual_output = stats['QueryExecution']['ResultConfiguration']['OutputLocation']
                    return f"{actual_output.rstrip('/')}/{query_execution_id}.csv"
                return None
            else:
                error_message = stats['QueryExecution']['Status'].get('StateChangeReason', 'Unknown error')
                raise Exception(f"Query {query_execution_id} failed: {error_message}")
        time.sleep(5)

def clean_s3_prefix(bucket, prefix):
    if not prefix.endswith('/'): prefix += '/'
    logger.info(f"Cleaning S3 prefix: s3://{bucket}/{prefix}")
    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
    
    keys_to_delete = [{'Key': obj['Key']} for page in pages for obj in page.get('Contents', [])]
    if keys_to_delete:
        for i in range(0, len(keys_to_delete), 1000):
            s3_client.delete_objects(Bucket=bucket, Delete={'Objects': keys_to_delete[i:i+1000]})

def lambda_handler(event, context):
    S3_BUCKET = os.environ['S3_BUCKET']
    DB_NAME = os.environ['ATHENA_DATABASE']
    COUNTRIES_NAMES_TABLE = os.environ['COUNTRIES_NAMES_TABLE']
    ATHENA_WORKGROUP = os.environ['ATHENA_WORKGROUP']
    S3_OUTPUT_LOCATION = os.environ['S3_OUTPUT_LOCATION']
    SQS_QUEUE_URL = os.environ['SQS_QUEUE_URL']
    
    PATTERNS_TABLE_NAME = "patterns"
    PATTERNS_S3_LOCATION = f"s3://{S3_BUCKET}/pipeline-C-pattern-synthesizer/output/data/"

    if event.get("action") == "start" or event.get("action") == "start_sample":
        logger.info("--- DISPATCHER MODE: Starting Pipeline C ---")
        
        # 1. Get list of country IDs
        countries_query = f"SELECT DISTINCT id FROM {DB_NAME}.{COUNTRIES_NAMES_TABLE}"
        result_path = run_athena_query(countries_query, ATHENA_WORKGROUP, DB_NAME, S3_OUTPUT_LOCATION, expects_result_path=True)
        result_key = result_path.replace(f"s3://{S3_BUCKET}/", "")
        obj = s3_client.get_object(Bucket=S3_BUCKET, Key=result_key)
        body = obj['Body'].read().decode('utf-8')
        csv_reader = csv.reader(StringIO(body))
        header = next(csv_reader)
        country_ids = sorted([row[0] for row in csv_reader if row and row[0]], key=int)
        logger.info(f"Found {len(country_ids)} country IDs to dispatch.")

        logger.info("Cleaning output locations and dropping old tables...")
        clean_s3_prefix(S3_BUCKET, PATTERNS_S3_LOCATION.replace(f"s3://{S3_BUCKET}/", ""))
        run_athena_query(f"DROP TABLE IF EXISTS `{DB_NAME}`.`{PATTERNS_TABLE_NAME}`;", ATHENA_WORKGROUP, DB_NAME, S3_OUTPUT_LOCATION)

        # Create the main patterns table (WITH pattern_id, WITHOUT indicator_ids)
        logger.info(f"Creating shell table: {PATTERNS_TABLE_NAME}")
        create_patterns_query = f"""
        CREATE EXTERNAL TABLE `{DB_NAME}`.`{PATTERNS_TABLE_NAME}` (
          `pattern_id` string,
          `country_b_id` smallint, 
          `length` smallint, 
          `start_year_a` smallint, 
          `start_year_b` smallint,
          `indicator_count` bigint, 
          `avg_correlation` double, 
          `pattern_power_score` double,
          `indicator_numeric_ids` array<smallint>
        )
        PARTITIONED BY (`country_a_id` smallint)
        STORED AS PARQUET
        LOCATION '{PATTERNS_S3_LOCATION}'
        """
        run_athena_query(create_patterns_query, ATHENA_WORKGROUP, DB_NAME, S3_OUTPUT_LOCATION)

        logger.info("Waiting for 10 seconds for Glue Catalog propagation...")
        time.sleep(10)

        # Purge queue (remains unchanged)
        logger.info(f"Purging main SQS queue: {SQS_QUEUE_URL}")
        sqs_client.purge_queue(QueueUrl=SQS_QUEUE_URL)
        time.sleep(5)

        # 3. Dispatch messages to SQS
        for count, country_id in enumerate(country_ids):
            sqs_client.send_message(QueueUrl=SQS_QUEUE_URL, MessageBody=country_id)
            logger.info(f"Dispatching country ID {country_id} to the SQS queue.")
            if (count + 1) % 10 == 0:
                logger.info(f"Dispatched {count + 1} countries to the SQS queue.")
            if event.get("action") == "start_sample":
                if count > 3:
                    break
        
        logger.info(f"Successfully dispatched all {len(country_ids)} countries to the SQS queue.")
        return {'statusCode': 200, 'body': f"Dispatched {len(country_ids)} countries."}
    else:
        logger.warning("Dispatcher invoked without 'action: start'. No action taken.")
        return {'statusCode': 400, 'body': 'Invalid invocation event.'}
