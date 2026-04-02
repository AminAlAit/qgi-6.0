import boto3
import json
import logging
import os
import time
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)

athena_client = boto3.client('athena')
sqs_client = boto3.client('sqs')
s3_client = boto3.client('s3')

def check_partition_exists(bucket, prefix, country_id):
    """Checks if any objects exist for a given Hive partition in S3."""
    partition_prefix = f"{prefix.rstrip('/')}/country_a_id={country_id}/"
    response = s3_client.list_objects_v2(Bucket=bucket, Prefix=partition_prefix, MaxKeys=1)
    return 'Contents' in response

def run_athena_query(query_string, workgroup, db_name, output_location):
    """Executes a query and waits for it to succeed."""
    logger.info(f"Executing query: \n{query_string}")
    result_output_location = f"{output_location.rstrip('/')}/worker_query_results/{uuid.uuid4()}"
    
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
                return
            else:
                error_message = stats['QueryExecution']['Status'].get('StateChangeReason', 'Unknown error')
                raise Exception(f"Query {query_execution_id} failed: {error_message}")
        time.sleep(5)

def add_partition_manually(table_name, partition_col, partition_val, s3_bucket, s3_prefix, workgroup, db_name, output_location):
    """Runs ALTER TABLE ADD PARTITION to surgically add a single missing partition."""
    partition_s3_location = f"s3://{s3_bucket}/{s3_prefix.rstrip('/')}/{partition_col}={partition_val}/"
    # Use IF NOT EXISTS to avoid errors if the partition was created despite the error
    add_partition_query = f"ALTER TABLE {db_name}.{table_name} ADD IF NOT EXISTS PARTITION ({partition_col}='{partition_val}') LOCATION '{partition_s3_location}'"
    logger.info(f"Running targeted ALTER TABLE command: {add_partition_query}")
    run_athena_query(add_partition_query, workgroup, db_name, output_location)


def _increment_completion(table_name, run_id):
    """Atomically increment processed_c counter for this run."""
    if not table_name or not run_id or run_id == 'unknown':
        return
    try:
        boto3.resource('dynamodb').Table(table_name).update_item(
            Key={'run_id': run_id},
            UpdateExpression='ADD processed_c :one',
            ExpressionAttributeValues={':one': 1},
        )
    except Exception as e:
        logger.error(f"Failed to increment completion counter: {e}", exc_info=True)
        raise


def lambda_handler(event, context):
    DB_NAME = os.environ['ATHENA_DATABASE']
    SCDIS_TABLE = os.environ['SCDIS_TABLE']
    COUNTRIES_NAMES_TABLE = os.environ['COUNTRIES_NAMES_TABLE']
    ATHENA_WORKGROUP = os.environ['ATHENA_WORKGROUP']
    S3_OUTPUT_LOCATION = os.environ['S3_OUTPUT_LOCATION']
    SQS_QUEUE_URL = os.environ['SQS_QUEUE_URL']
    S3_BUCKET = os.environ['S3_BUCKET']
    COMPLETION_TABLE = os.environ.get('COMPLETION_TABLE')
    RUN_ID = event.get('run_id', 'unknown')

    PATTERNS_TABLE_NAME = "patterns"
    PATTERNS_S3_PREFIX = "pipeline-C-pattern-synthesizer/output/data/"

    for record in event["Records"]:
        receipt_handle = record["receiptHandle"]
        raw_body = record["body"]

        # Support both legacy plain-string messages and new JSON format
        try:
            msg = json.loads(raw_body)
            country_id_str = str(msg.get("country_id", raw_body))
            run_id_msg = msg.get("run_id", RUN_ID)
        except (json.JSONDecodeError, AttributeError):
            country_id_str = raw_body
            run_id_msg = RUN_ID

        if not country_id_str.isdigit():
            logger.warning(f"Skipping and deleting invalid message. Body is not a digit: '{country_id_str}'")
            sqs_client.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
            continue

        if check_partition_exists(S3_BUCKET, PATTERNS_S3_PREFIX, country_id_str):
            logger.info(f"Output for country ID {country_id_str} already exists in S3. Deleting redundant message and skipping.")
            sqs_client.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
            _increment_completion(COMPLETION_TABLE, run_id_msg)
            continue

        logger.info(f"--- WORKER MODE: Processing country ID: {country_id_str} ---")
        
        try:
            logger.info(f"Running INSERT query for {PATTERNS_TABLE_NAME} for country {country_id_str}")
            insert_patterns_query = f"""
                INSERT INTO {DB_NAME}.{PATTERNS_TABLE_NAME}
                WITH patterns_base AS (
                    SELECT
                        CAST(s.country_a_id AS smallint) AS country_a_id,
                        CAST(s.country_b_id AS smallint) AS country_b_id,
                        -- EXPLICIT CASTING IS THE FIX --
                        CAST(s.length AS smallint) AS length, 
                        CAST(s.start_year_a AS smallint) AS start_year_a, 
                        CAST(s.start_year_b AS smallint) AS start_year_b,
                        CAST(s.correlation AS double) AS correlation,
                        CAST(s.indicator_numeric_id AS smallint) AS indicator_numeric_id
                        ---------------------------------
                    FROM {DB_NAME}.{SCDIS_TABLE} s
                    WHERE s.country_a_id = {country_id_str}
                ),
                patterns_aggregated AS (
                    SELECT
                        country_a_id, country_b_id, length, start_year_a, start_year_b,
                        COUNT(*) AS indicator_count,
                        AVG(correlation) AS avg_correlation,
                        array_agg(indicator_numeric_id) as collected_indicator_ids
                    FROM patterns_base
                    GROUP BY country_a_id, country_b_id, length, start_year_a, start_year_b
                    HAVING COUNT(*) > 1
                )
                SELECT
                    to_hex(md5(to_utf8(concat_ws('-', 
                        CAST(country_a_id AS varchar), 
                        CAST(country_b_id AS varchar), 
                        CAST(length AS varchar), 
                        CAST(start_year_a AS varchar), 
                        CAST(start_year_b AS varchar)
                    )))) AS pattern_id,
                    country_b_id, length, start_year_a, start_year_b, 
                    indicator_count, 
                    avg_correlation,
                    -- This calculation no longer needs to cast length, as it's already a number
                    avg_correlation * CAST(length AS double) * indicator_count AS pattern_power_score,
                    collected_indicator_ids AS indicator_numeric_ids,
                    country_a_id 
                FROM patterns_aggregated
                """
            run_athena_query(insert_patterns_query, ATHENA_WORKGROUP, DB_NAME, S3_OUTPUT_LOCATION)
            
            logger.info(f"Successfully processed country ID {country_id_str}. Deleting message.")
            sqs_client.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
            _increment_completion(COMPLETION_TABLE, run_id_msg)

        except Exception as e:
            if "Insufficient permissions" in str(e) and "create partitions on Glue catalog" in str(e):
                logger.warning(f"Caught Glue permission error for country ID {country_id_str}. Checking for orphaned S3 data...")
                if check_partition_exists(S3_BUCKET, PATTERNS_S3_PREFIX, country_id_str):
                    logger.info(f"Orphaned S3 data found for country ID {country_id_str}. Attempting self-healing.")
                    try:
                        add_partition_manually(
                            PATTERNS_TABLE_NAME, "country_a_id", country_id_str, 
                            S3_BUCKET, PATTERNS_S3_PREFIX, 
                            ATHENA_WORKGROUP, DB_NAME, S3_OUTPUT_LOCATION
                        )
                        logger.info(f"Self-healing successful. Partition added. Deleting message for country ID {country_id_str}.")
                        sqs_client.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
                        _increment_completion(COMPLETION_TABLE, run_id_msg)
                        continue 
                    except Exception as repair_e:
                        logger.error(f"Self-healing FAILED for country ID '{country_id_str}'. ALTER TABLE command failed. Error: {repair_e}", exc_info=True)
                        raise repair_e
            
            logger.error(f"WORKER FAILED for country ID '{country_id_str}'. The message will be retried. Error: {e}", exc_info=True)
            raise e
    
    return {'statusCode': 200, 'body': 'Processed SQS messages successfully.'}
