"""
Phase 1 Batch Dispatcher (#FAR-1)

Replaces the legacy EC2 + SSM single-instance fetcher with a fan-out to
AWS Batch on Fargate Spot — one job per indicator. Each job sleeps a
random 1-5 min before its WB API call to enforce rate limiting via
natural distribution rather than centralized coordination.

## What this Lambda does

1. Reads `indicators/indicators.json` from S3 (written by sheet-fetcher).
2. Filters to status='process'.
3. Resets the qgi-pipeline-a-counter for this run_id (PutItem with
   pending = N). Always overwrites — re-running a stuck Step Function
   does not require manual cleanup.
4. Submits N AWS Batch jobs to the Fargate Spot job queue, one per
   indicator. Each job receives the indicator id + run_id + table
   names via container env var overrides.
5. Returns the count for the Step Function's logs.

The checker Lambda then polls the counter (every 2 min) until it
reaches 0; the Reporter Lambda sends the email; Phase 1.5 advances.

## Why we seed the counter to N upfront
Fargate Spot doesn't provision all N tasks instantly — they trickle in
over 30-90 seconds. If the counter started at 0 and tasks did +1 on
start, -1 on success, the counter could momentarily hit 0 between the
fast tasks finishing and the slow tasks starting. The next-phase Lambda
would advance prematurely. Seeding to N upfront eliminates the race:
the counter can only ever DECREASE from N to 0, and can only hit 0
once when every task has reported.
"""

import json
import logging
import os
import time
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
batch = boto3.client("batch")
dynamodb = boto3.resource("dynamodb")

S3_BUCKET = os.environ["S3_BUCKET"]
INDICATORS_KEY = "indicators/indicators.json"

BATCH_JOB_QUEUE = os.environ["BATCH_JOB_QUEUE"]
# Legacy: one JobDef for every indicator. Still the default when an
# indicator's provider isn't in BATCH_JOB_DEFINITION_MAP (below).
BATCH_JOB_DEFINITION = os.environ["BATCH_JOB_DEFINITION"]
# #240 Phase A: per-provider JobDef routing. JSON map of provider
# name -> Batch JobDef ARN. When an indicator's `provider` field
# matches a key here, the dispatcher submits to that JobDef instead
# of the default. Lets WB indicators flow to the WB fetcher and
# FAOSTAT indicators flow to the FAOSTAT bulk-download fetcher.
# Empty/missing env var = legacy single-JobDef behaviour.
try:
    BATCH_JOB_DEFINITION_MAP = json.loads(
        os.environ.get("BATCH_JOB_DEFINITION_MAP", "{}")
    )
    if not isinstance(BATCH_JOB_DEFINITION_MAP, dict):
        raise ValueError("BATCH_JOB_DEFINITION_MAP must decode to a dict")
except (ValueError, json.JSONDecodeError) as exc:
    logger.warning(
        "BATCH_JOB_DEFINITION_MAP env var is not valid JSON map; "
        "falling back to legacy single-JobDef mode. error=%s",
        exc,
    )
    BATCH_JOB_DEFINITION_MAP = {}

COUNTER_TABLE = os.environ["COUNTER_TABLE"]            # qgi-pipeline-a-counter
TRACKER_TABLE = os.environ.get("TRACKER_TABLE", "qgi-indicator-updates")
INDICATOR_VALUES_TABLE = os.environ.get(
    "INDICATOR_VALUES_TABLE", "qgi-indicator-values"
)
ATHENA_DATABASE = os.environ.get("ATHENA_DATABASE", "qgi_data")
ATHENA_WORKGROUP = os.environ.get("ATHENA_WORKGROUP", "QGI-Lambda-Workgroup")
ATHENA_OUTPUT_LOCATION = os.environ.get(
    "ATHENA_OUTPUT_LOCATION", f"s3://{S3_BUCKET}/query_results/"
)

JITTER_MIN_S = os.environ.get("JITTER_MIN_S", "60")
JITTER_MAX_S = os.environ.get("JITTER_MAX_S", "300")

# DISPATCH_LIMIT: cap the number of indicators dispatched per run.
# 0 = unlimited (production). Useful for E2E tests with 2-5 indicators.
DISPATCH_LIMIT = int(os.environ.get("DISPATCH_LIMIT", "0"))

counter_table = dynamodb.Table(COUNTER_TABLE)


def lambda_handler(event, context):
    run_id = event.get("run_id", "unknown")
    logger.info(f"Phase 1 Batch dispatcher starting for run_id={run_id}")

    # 1. Load indicators config from S3
    obj = s3.get_object(Bucket=S3_BUCKET, Key=INDICATORS_KEY)
    config = json.loads(obj["Body"].read().decode("utf-8"))
    process_list = [i for i in config["indicators"] if i["status"] == "process"]

    if DISPATCH_LIMIT > 0:
        process_list = process_list[:DISPATCH_LIMIT]
        logger.info(f"DISPATCH_LIMIT={DISPATCH_LIMIT} applied")

    n = len(process_list)
    logger.info(f"Will dispatch {n} Batch jobs")

    if n == 0:
        # Edge case: nothing to do. Set counter to 0 so the checker
        # immediately advances.
        counter_table.put_item(Item={"run_id": run_id, "pending": Decimal(0)})
        return {"dispatched": 0, "run_id": run_id}

    # 2. Seed the counter — overwrite any prior value for this run_id
    counter_table.put_item(
        Item={
            "run_id": run_id,
            "pending": Decimal(n),
            "total": Decimal(n),  # immutable, for the reporter to compare against
        }
    )
    logger.info(f"Counter seeded: {COUNTER_TABLE}[{run_id}].pending = {n}")

    # 3. Submit Batch jobs
    submitted = 0
    submit_failures = []
    # Track per-provider submission counts for the return payload —
    # lets the reporter show "dispatched 259 WB + 8 FAOSTAT" instead
    # of a single opaque number.
    per_provider_counts: dict[str, int] = {}
    for ind in process_list:
        ind_id = ind["id_string"]
        # Provider tag comes from the sheet-fetcher's #240 enrichment.
        # Unknown/missing provider = legacy path (single BATCH_JOB_DEFINITION).
        provider = ind.get("provider") or "WB"
        job_definition = BATCH_JOB_DEFINITION_MAP.get(provider, BATCH_JOB_DEFINITION)
        # Job names must be alphanum + - _; replace dots in WB indicator codes
        safe_id = ind_id.replace(".", "-").replace("_", "-")
        job_name = f"qgi-fetch-{safe_id}-{run_id[-12:]}"[:128]
        try:
            response = batch.submit_job(
                jobName=job_name,
                jobQueue=BATCH_JOB_QUEUE,
                jobDefinition=job_definition,
                containerOverrides={
                    "environment": [
                        {"name": "INDICATOR_ID", "value": ind_id},
                        {"name": "PROVIDER", "value": provider},
                        {"name": "RUN_ID", "value": run_id},
                        {"name": "S3_BUCKET", "value": S3_BUCKET},
                        {"name": "COUNTER_TABLE", "value": COUNTER_TABLE},
                        {"name": "TRACKER_TABLE", "value": TRACKER_TABLE},
                        {
                            "name": "INDICATOR_VALUES_TABLE",
                            "value": INDICATOR_VALUES_TABLE,
                        },
                        {"name": "ATHENA_DATABASE", "value": ATHENA_DATABASE},
                        {"name": "ATHENA_WORKGROUP", "value": ATHENA_WORKGROUP},
                        {
                            "name": "ATHENA_OUTPUT_LOCATION",
                            "value": ATHENA_OUTPUT_LOCATION,
                        },
                        {"name": "JITTER_MIN_S", "value": str(JITTER_MIN_S)},
                        {"name": "JITTER_MAX_S", "value": str(JITTER_MAX_S)},
                    ]
                },
            )
            submitted += 1
            per_provider_counts[provider] = per_provider_counts.get(provider, 0) + 1
            logger.debug(f"Submitted {ind_id} ({provider} → {job_definition}): {response['jobId']}")
        except Exception as e:  # noqa: BLE001
            logger.error(f"Failed to submit Batch job for {ind_id} ({provider}): {e}")
            submit_failures.append(ind_id)

    logger.info(
        f"Submitted {submitted}/{n} Batch jobs for run_id={run_id}. "
        f"Failures: {len(submit_failures)}"
    )

    # If some submissions failed, decrement the counter by that count so it
    # can still reach 0. Otherwise the run hangs forever waiting on jobs
    # that were never submitted.
    if submit_failures:
        counter_table.update_item(
            Key={"run_id": run_id},
            UpdateExpression="ADD pending :neg",
            ExpressionAttributeValues={":neg": Decimal(-len(submit_failures))},
        )
        logger.warning(
            f"Decremented counter by {len(submit_failures)} for failed submissions"
        )

    return {
        "dispatched": submitted,
        "total": submitted,
        # #240 Phase A: per-provider breakdown so the reporter can say
        # "dispatched 259 WB + 8 FAOSTAT" instead of one opaque number.
        "per_provider_counts": per_provider_counts,
        # Epoch seconds — checker uses this against DEADMAN_SECONDS to
        # decide whether the run has busted its hard deadline.
        "phase1_started_at": int(time.time()),
        "submit_failures": submit_failures,
        "run_id": run_id,
    }
