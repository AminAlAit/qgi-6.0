"""
EC2 Stopper Lambda — stops the indicator fetcher EC2 instance after Phase 1 completes.

Called by Step Functions after the Phase 1 checker reports done=true.
"""

import os
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ec2 = boto3.client("ec2")

INSTANCE_ID = os.environ["INSTANCE_ID"]


def lambda_handler(event, context):
    logger.info(f"Stopping EC2 instance {INSTANCE_ID}")

    try:
        ec2.stop_instances(InstanceIds=[INSTANCE_ID])
        logger.info(f"Stop command sent to {INSTANCE_ID}")
    except Exception as e:
        # Don't fail the pipeline if stop fails — instance will auto-stop eventually
        logger.error(f"Failed to stop instance: {e}")

    return {"status": "stopped", "instance_id": INSTANCE_ID}
