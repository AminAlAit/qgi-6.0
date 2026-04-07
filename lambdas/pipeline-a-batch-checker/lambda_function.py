"""
Phase 1 Batch Checker (#FAR-1)

Polled by the Step Function every 2 minutes after the dispatcher fans out
N AWS Batch jobs. Reads qgi-pipeline-a-counter for the current run_id and
returns whether all jobs have decremented to zero.

## Return shape (consumed by the `Phase A Done?` Choice state)
  {
    "done": True/False,
    "pending": <int remaining>,
    "total": <int original>,
    "run_id": "...",
    "deadman_expired": True/False  # L5 safety net
  }

## Deadman timer (L5)
If pending > 0 and the run has been going for more than DEADMAN_TIMEOUT_S
(default 5400 = 90 min), we return done=True with deadman_expired=True.
This prevents the Step Function from polling forever if Batch itself
goes sideways. The Reporter will log loudly when this happens.

The 90-min default comfortably covers the worst case: 700 indicators
with 5-min jitter + 1-min fetch = ~6 min wall time per task, but Fargate
Spot launch rate is 20/sec sustained so 700 tasks queue and run in
~35 min total. 90 min gives ~2.5x headroom.
"""

import logging
import os
import time

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

COUNTER_TABLE = os.environ["COUNTER_TABLE"]
DEADMAN_TIMEOUT_S = int(os.environ.get("DEADMAN_TIMEOUT_S", "5400"))  # 90 min

counter_table = dynamodb.Table(COUNTER_TABLE)


def lambda_handler(event, context):
    run_id = event.get("run_id", "unknown")
    started_at = event.get("phase1_started_at")  # epoch seconds, set by dispatcher path

    response = counter_table.get_item(Key={"run_id": run_id})
    item = response.get("Item")

    if not item:
        # No counter for this run_id — dispatcher hasn't run yet, or it
        # was wiped. Treat as not-done so the Step Function keeps polling.
        logger.warning(f"No counter row for run_id={run_id}; reporting not-done")
        return {
            "done": False,
            "pending": -1,
            "total": -1,
            "run_id": run_id,
            "deadman_expired": False,
        }

    pending = int(item.get("pending", 0))
    total = int(item.get("total", 0))
    logger.info(
        f"Counter check: run_id={run_id} pending={pending}/{total}"
    )

    # Deadman timer (L5)
    deadman_expired = False
    if started_at and pending > 0:
        elapsed = time.time() - float(started_at)
        if elapsed > DEADMAN_TIMEOUT_S:
            logger.error(
                f"DEADMAN TIMER EXPIRED: run_id={run_id} pending={pending} "
                f"after {elapsed:.0f}s — forcing done=True"
            )
            deadman_expired = True

    return {
        "done": pending <= 0 or deadman_expired,
        "pending": pending,
        "total": total,
        "run_id": run_id,
        "deadman_expired": deadman_expired,
    }
