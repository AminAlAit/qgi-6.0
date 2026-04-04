"""
EC2 Trigger Lambda — starts the indicator fetcher EC2 instance and sends
an SSM Run Command to execute fetch_indicators.py.

Called by Step Functions as the first step of Phase 1 (replacing SQS dispatch).

Returns: {"dispatched": N} where N = number of 'process' indicators found
(for compatibility with the existing Phase 1 checker).
"""

import os
import json
import time
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ec2 = boto3.client("ec2")
ssm = boto3.client("ssm")
s3 = boto3.client("s3")

INSTANCE_ID = os.environ["INSTANCE_ID"]
S3_BUCKET = os.environ["S3_BUCKET"]
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "qgi-indicator-updates")


def lambda_handler(event, context):
    run_id = event.get("run_id", "unknown")
    logger.info(f"Starting EC2 indicator fetcher for run_id={run_id}")

    # 1. Count how many indicators to process (for checker compatibility)
    config_obj = s3.get_object(Bucket=S3_BUCKET, Key="indicators/indicators.json")
    config = json.loads(config_obj["Body"].read().decode("utf-8"))
    process_count = sum(1 for i in config["indicators"] if i["status"] == "process")
    logger.info(f"Found {process_count} indicators to process")

    if process_count == 0:
        logger.info("No indicators to process, skipping EC2 start")
        return {"dispatched": 0}

    # 2. Write completion counter for the checker
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(os.environ.get("COMPLETION_TABLE", "qgi-completion-counters"))
    table.put_item(Item={
        "run_id": run_id,
        "total_a": process_count,
        "expires_at": int(time.time()) + 7 * 24 * 3600,
    })

    # 3. Start the EC2 instance
    logger.info(f"Starting EC2 instance {INSTANCE_ID}")
    ec2.start_instances(InstanceIds=[INSTANCE_ID])

    # 4. Wait for instance to be running + status checks passed
    logger.info("Waiting for instance to reach running state...")
    waiter = ec2.get_waiter("instance_status_ok")
    waiter.wait(
        InstanceIds=[INSTANCE_ID],
        WaiterConfig={"Delay": 15, "MaxAttempts": 20}  # Up to 5 min
    )
    logger.info("Instance is running and status checks passed")

    # 5. Deploy script to EC2 + install deps, then run
    deploy_and_run = (
        f"pip3 install -q python-dateutil wbgapi pandas pyarrow boto3 && "
        f"mkdir -p /opt/qgi && "
        f"python3 -c \""
        f"import boto3; "
        f"s3=boto3.client('s3',region_name='eu-central-1'); "
        f"obj=s3.get_object(Bucket='{S3_BUCKET}',Key='ec2-scripts/fetch_indicators.py'); "
        f"open('/opt/qgi/fetch_indicators.py','wb').write(obj['Body'].read())"
        f"\" && "
        f"python3 /opt/qgi/fetch_indicators.py"
        f" --run-id {run_id}"
        f" --bucket {S3_BUCKET}"
        f" --table {DYNAMODB_TABLE}"
    )
    logger.info(f"Sending SSM command to deploy and run fetch script")

    response = ssm.send_command(
        InstanceIds=[INSTANCE_ID],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": [deploy_and_run]},
        TimeoutSeconds=14400,  # 4 hour max
        Comment=f"QGI indicator fetch run_id={run_id}",
    )
    command_id = response["Command"]["CommandId"]
    logger.info(f"SSM command sent: {command_id}")

    return {
        "dispatched": process_count,
        "instance_id": INSTANCE_ID,
        "ssm_command_id": command_id,
    }
