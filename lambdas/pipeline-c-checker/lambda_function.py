"""
Phase 4 completion checker.

Called by Step Functions in a poll loop instead of the hard 60-min wait.
Reads qgi-completion-counters to compare processed vs total for Phase C.

Input:  {"run_id": "<run_id>", "expected": <int>}
Output: {"done": true/false, "processed": <int>, "total": <int>}
"""
import boto3
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ['COMPLETION_TABLE']


def lambda_handler(event, context):
    run_id = event['run_id']
    expected = int(event['expected'])

    table = dynamodb.Table(TABLE_NAME)
    item = table.get_item(Key={'run_id': run_id}).get('Item', {})
    processed = int(item.get('processed_c', 0))

    done = processed >= expected
    logger.info(f"run_id={run_id} processed={processed}/{expected} done={done}")
    return {"done": done, "processed": processed, "total": expected}
