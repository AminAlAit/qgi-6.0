"""
Phase 1 Batch Failure Handler (#243 PERMA FIX for the pending-counter deadlock)

## Problem
When a Phase 1 fetcher Batch job dies HARD — Fargate Spot reclaim, container
OOM, or `attemptDurationSeconds` timeout — the worker process is SIGKILL'd
mid-execution. The `except` block in `fetch_one.py` does NOT run, so:

  - No tracker row is written for that indicator.
  - No counter decrement happens.

The checker Lambda's completion logic is `tracker_count >= total`. With a
hard-killed indicator, tracker_count can never reach total. The Step Function
sits in the F.2→F.4 wait/check loop until the 90-min L5 deadman fires.

## Fix
This Lambda is triggered by EventBridge for Batch JobStateChange events
where the new state is FAILED, scoped to the qgi-pipeline-a-fetcher-queue.
On invocation, it:

  1. Extracts the indicator id from the job's container env (or the job name
     as a fallback).
  2. Extracts the run_id similarly.
  3. Writes a FAILED tracker row to qgi-indicator-updates with the actual
     status reason from the Batch event — closing the loop the worker never
     got to close.
  4. Decrements the qgi-pipeline-a-counter for backward-compat (ignored by
     #178 scan-count checker but kept for the legacy reporter).

This makes the checker progress correctly even when jobs die hard. The L5
deadman is now genuinely the LAST line of defence, not the first.

## Idempotency
The tracker write is idempotent on (run_id, indicator_id) since the worker's
final state-overwrite happens in a different code path; if both the worker
and this handler write a tracker row for the same indicator, the worker's
"FAILED" with full traceback wins on time, and this handler's row arrives
later as a state confirmation. DDB PutItem is last-write-wins on the PK,
which is fine — both rows say FAILED.

## Env vars
  - TRACKER_TABLE  (default: qgi-indicator-updates)
  - COUNTER_TABLE  (default: qgi-pipeline-a-counter)

## EventBridge rule that triggers this:
  Pattern:
  {
    "source": ["aws.batch"],
    "detail-type": ["Batch Job State Change"],
    "detail": {
      "status": ["FAILED"],
      "jobQueue": ["arn:aws:batch:...:job-queue/qgi-pipeline-a-fetcher-queue"]
    }
  }
"""

from __future__ import annotations

import logging
import os
import re
import time
from decimal import Decimal
from typing import Any

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
TRACKER_TABLE_NAME = os.environ.get("TRACKER_TABLE", "qgi-indicator-updates")
COUNTER_TABLE_NAME = os.environ.get("COUNTER_TABLE", "qgi-pipeline-a-counter")
tracker_table = dynamodb.Table(TRACKER_TABLE_NAME)
counter_table = dynamodb.Table(COUNTER_TABLE_NAME)


def _extract_env(env_list: list[dict] | None, key: str) -> str | None:
    """Find the value of `key` in a Batch container env list of {name,value}."""
    if not env_list:
        return None
    for kv in env_list:
        if kv.get("name") == key:
            return kv.get("value")
    return None


def _parse_indicator_from_job_name(job_name: str) -> str | None:
    """Fallback: parse INDICATOR_ID from the job name when env is absent.

    Dispatcher names jobs as: ``qgi-fetch-{safe_id}-{run_id_suffix}``
    where ``safe_id`` is the indicator id with `.` and `_` replaced by `-`,
    and ``run_id_suffix`` is the last 12 chars of the run_id.

    We strip the prefix and the trailing 12-char suffix to recover the
    safe_id, then convert dashes BACK to dots (best effort — WB indicator ids
    use dots, not underscores, in the canonical form).
    """
    m = re.match(r"^qgi-fetch-(?P<body>.+)-(?P<suffix>[A-Za-z0-9]{12})$", job_name)
    if not m:
        return None
    safe_id = m.group("body")
    # World Bank indicator ids look like "FI.RES.TOTL.MO" — restore dots.
    return safe_id.replace("-", ".")


def lambda_handler(event: dict[str, Any], context):
    """Process one Batch JobStateChange=FAILED event."""
    detail = event.get("detail", {}) if isinstance(event, dict) else {}
    job_id = detail.get("jobId") or "unknown"
    job_name = detail.get("jobName") or ""
    status_reason = (detail.get("statusReason") or "")[:1000]

    # Container env carries the canonical INDICATOR_ID + RUN_ID
    container = detail.get("container") or {}
    env_list = container.get("environment") or []
    indicator_id = _extract_env(env_list, "INDICATOR_ID") or _parse_indicator_from_job_name(job_name)
    run_id = _extract_env(env_list, "RUN_ID")

    if not run_id:
        # No run_id means we can't write a tracker row that the checker
        # could associate with the in-flight pipeline run. Log + bail.
        logger.warning(
            f"Batch failure event missing RUN_ID env (job_name={job_name!r}, "
            f"job_id={job_id}). No tracker row written. status_reason={status_reason!r}"
        )
        return {"status": "skipped", "reason": "no_run_id", "job_id": job_id}

    if not indicator_id:
        logger.warning(
            f"Batch failure event missing INDICATOR_ID for run_id={run_id} "
            f"(job_name={job_name!r}, job_id={job_id}). No tracker row written."
        )
        return {"status": "skipped", "reason": "no_indicator_id", "job_id": job_id}

    # Classify the failure for the ops report. The reason text is whatever
    # Batch saw — we just preserve it and tag the high-level kind.
    if "duration exceeded timeout" in status_reason.lower():
        kind = "TIMEOUT"
    elif "host EC2" in status_reason or "Spot" in status_reason:
        kind = "SPOT_RECLAIM"
    elif "OutOfMemory" in status_reason or "OOM" in status_reason:
        kind = "OOM"
    else:
        kind = "BATCH_FAILED"

    # Write a tracker row so the checker's tracker_count can reach total.
    # The schema mirrors what fetch_one.py writes on graceful failure.
    item = {
        "run_id": run_id,
        "indicator_id": indicator_id,
        "status": "FAILED",
        "failure_kind": kind,
        "timestamp": int(time.time()),
        "expire_at": int(time.time()) + 30 * 24 * 60 * 60,
        "error": f"Batch hard failure: {status_reason}"[:1000],
        "job_id": job_id,
        "source": "batch_failure_handler",
    }
    try:
        tracker_table.put_item(Item=item)
        logger.info(
            f"Wrote FAILED tracker row for {indicator_id} (run_id={run_id}, kind={kind})"
        )
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to write tracker row for {indicator_id}: {e}")
        return {"status": "error", "reason": str(e), "indicator_id": indicator_id}

    # Decrement the counter too — backward compat for the legacy reporter
    # (the #178 scan-count checker doesn't read this anymore but the reporter
    # might still inspect the legacy `pending` field).
    try:
        counter_table.update_item(
            Key={"run_id": run_id},
            UpdateExpression="ADD pending :neg",
            ExpressionAttributeValues={":neg": Decimal(-1)},
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Counter decrement failed for run_id={run_id}: {e} (non-fatal)")

    return {
        "status": "handled",
        "indicator_id": indicator_id,
        "run_id": run_id,
        "kind": kind,
        "job_id": job_id,
    }
