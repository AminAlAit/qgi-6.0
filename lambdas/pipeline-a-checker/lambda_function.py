"""
Phase 1 completion checker.

Called by Step Functions in a poll loop instead of the hard 21-min wait.
Queries qgi-indicator-updates to count how many indicators have reached a
terminal state (UPDATED / UNCHANGED / FAILED / SKIPPED) for this run.

Input:  {"run_id": "<run_id>", "expected": <int>}
Output: {"done": true/false, "processed": <int>, "total": <int>}
"""
import boto3
import os
import logging
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ['DYNAMODB_TABLE']
TERMINAL_STATUSES = {"UPDATED", "UNCHANGED", "FAILED", "SKIPPED"}


def lambda_handler(event, context):
    run_id = event['run_id']
    expected = int(event['expected'])

    table = dynamodb.Table(TABLE_NAME)
    response = table.query(KeyConditionExpression=Key('run_id').eq(run_id))
    items = response['Items']
    processed = sum(1 for i in items if i.get('status') in TERMINAL_STATUSES)

    done = processed >= expected
    logger.info(f"run_id={run_id} processed={processed}/{expected} done={done}")
    return {"done": done, "processed": processed, "total": expected}
