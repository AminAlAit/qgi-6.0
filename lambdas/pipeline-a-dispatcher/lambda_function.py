import os
import logging
import json
import time
import boto3
import pandas as pd
import datetime
from dataclasses import dataclass

# Env Vars
S3_BUCKET = os.environ.get('S3_BUCKET')
SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL')
S3_PREFIX = os.environ.get('S3_PREFIX')
COMPLETION_TABLE = os.environ.get('COMPLETION_TABLE')
DISPATCH_LIMIT = int(os.environ.get('DISPATCH_LIMIT', '0'))  # 0 = unlimited
# Input: Where the Sheet Fetcher put the file
INPUT_KEY = "indicators/indicators.json"

logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

@dataclass
class IndicatorConfig:
    id_string: str
    numeric_id: int
    name: str
    status: str

def generate_master_maps(indicators_config):
    """Generates the shared registry JSON and numeric ID CSV map in S3."""
    # 1. Indicator Registry JSON
    registry = {ind.id_string: ind.name for ind in indicators_config}
    registry_key = f"{S3_PREFIX}/output/registry/indicator_registry.json"
    s3_client.put_object(Bucket=S3_BUCKET, Key=registry_key, Body=json.dumps(registry, indent=2))
    logger.info(f"Updated registry at s3://{S3_BUCKET}/{registry_key}")

    # 2. Numeric ID CSV Map
    map_data = [{"indicator_id_string": ind.id_string, "indicator_numeric_id": ind.numeric_id} for ind in indicators_config]
    map_csv = pd.DataFrame(map_data).to_csv(index=False)
    map_key = f"{S3_PREFIX}/input/indicator_map.csv"
    s3_client.put_object(Bucket=S3_BUCKET, Key=map_key, Body=map_csv)
    logger.info(f"Updated indicator map at s3://{S3_BUCKET}/{map_key}")

def lambda_handler(event, context):
    try:
        # 1. Load Config FROM S3
        logger.info(f"Loading config from s3://{S3_BUCKET}/{INPUT_KEY}")
        
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=INPUT_KEY)
        config_data = json.loads(response['Body'].read().decode('utf-8'))
        
        indicators = []
        for item in config_data['indicators']:
            indicators.append(IndicatorConfig(
                id_string=item['id_string'],
                numeric_id=item['numeric_id'],
                name=item['name'],
                status=item['status']
            ))

        # 2. Update Master Maps in S3
        generate_master_maps(indicators)

        # 3. Filter & Dispatch
        process_list = [ind for ind in indicators if ind.status == "process"]
        if DISPATCH_LIMIT > 0:
            process_list = process_list[:DISPATCH_LIMIT]
            logger.info(f"DISPATCH_LIMIT={DISPATCH_LIMIT} applied.")
        logger.info(f"Dispatching {len(process_list)} indicators to SQS.")
        
        run_id = event.get('run_id') or datetime.datetime.now().strftime("%Y-%m-%d-%H%M")

        for ind in process_list:
            payload = {
                "id_string": ind.id_string,
                "numeric_id": ind.numeric_id,
                "run_id": run_id
            }
            sqs_client.send_message(
                QueueUrl=SQS_QUEUE_URL,
                MessageBody=json.dumps(payload)
            )

        # Write completion counter so a-checker can poll without a hard wait
        if COMPLETION_TABLE:
            dynamodb.Table(COMPLETION_TABLE).put_item(Item={
                'run_id': run_id,
                'total_a': len(process_list),
                'expires_at': int(time.time()) + 7 * 24 * 3600,
            })

        return {
            "statusCode": 200,
            "run_id": run_id,
            "dispatched": len(process_list),
            "body": json.dumps({
                "status": "Success",
                "dispatched": len(process_list)
            })
        }

    except Exception as e:
        logger.error(f"Dispatcher failed: {e}", exc_info=True)
        raise e
