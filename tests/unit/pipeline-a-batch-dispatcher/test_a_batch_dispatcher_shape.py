"""
Contract test for pipeline-a-batch-dispatcher (#FAR-1, issue #154).

The Step Function pulls $.dispatch_a_output.phase1_started_at out of the
dispatcher result and feeds it into the checker as an input parameter.
A prior iteration (run far1-test-20260408-005530) failed because the
dispatcher didn't return phase1_started_at — the SF JSONPath resolution
exploded with 'invalid path'.

This test locks down the shape: {dispatched, total, phase1_started_at,
submit_failures, run_id}.
"""
import importlib.util
import json
import os
import sys
import types
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

_LAMBDAS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "lambdas"


def _load_dispatcher(indicators):
    body = BytesIO(json.dumps({"indicators": indicators}).encode("utf-8"))
    s3_client = MagicMock()
    s3_client.get_object.return_value = {"Body": body}

    batch_client = MagicMock()
    batch_client.submit_job.side_effect = lambda **kw: {"jobId": f"job-{kw['jobName']}"}

    table = MagicMock()
    ddb_resource = MagicMock()
    ddb_resource.Table.return_value = table

    def client_factory(name, *a, **kw):
        return {"s3": s3_client, "batch": batch_client}.get(name, MagicMock())

    boto3_stub = types.ModuleType("boto3")
    boto3_stub.client = MagicMock(side_effect=client_factory)
    boto3_stub.resource = MagicMock(return_value=ddb_resource)

    env = {
        "S3_BUCKET": "test-bucket",
        "BATCH_JOB_QUEUE": "test-queue",
        "BATCH_JOB_DEFINITION": "test-jobdef",
        "COUNTER_TABLE": "qgi-pipeline-a-counter",
    }
    with patch.dict(sys.modules, {"boto3": boto3_stub}), \
         patch.dict(os.environ, env):
        spec = importlib.util.spec_from_file_location(
            "a_batch_dispatcher",
            str(_LAMBDAS_DIR / "pipeline-a-batch-dispatcher" / "lambda_function.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    return mod, batch_client, table


_REQUIRED_KEYS = {"dispatched", "total", "phase1_started_at", "submit_failures", "run_id"}


def test_return_shape_has_phase1_started_at():
    """SF 'Phase 1: Check Counter' passes $.dispatch_a_output.phase1_started_at
    to the checker — missing key = JSONPath crash. Regression guard."""
    mod, _, _ = _load_dispatcher([
        {"id_string": "NY.GDP.MKTP.CD", "status": "process"},
        {"id_string": "SP.POP.TOTL", "status": "process"},
    ])
    result = mod.lambda_handler({"run_id": "test-run"}, None)
    missing = _REQUIRED_KEYS - set(result.keys())
    assert not missing, f"missing keys {missing}. Got {result}"
    assert isinstance(result["phase1_started_at"], int)
    assert result["phase1_started_at"] > 1_700_000_000  # post-2023 epoch sanity


def test_dispatched_and_total_match_process_status_count():
    mod, batch_client, _ = _load_dispatcher([
        {"id_string": "A", "status": "process"},
        {"id_string": "B", "status": "process"},
        {"id_string": "C", "status": "hold"},  # filtered out
        {"id_string": "D", "status": "process"},
    ])
    result = mod.lambda_handler({"run_id": "test-run"}, None)
    assert result["dispatched"] == 3
    assert result["total"] == 3
    assert batch_client.submit_job.call_count == 3
    assert result["submit_failures"] == []


def test_empty_process_list_seeds_counter_zero():
    """Edge case: nothing to do. Must not crash, must seed counter=0."""
    mod, batch_client, table = _load_dispatcher([
        {"id_string": "A", "status": "hold"},
    ])
    result = mod.lambda_handler({"run_id": "test-run"}, None)
    assert result["dispatched"] == 0
    assert batch_client.submit_job.call_count == 0
    # counter was seeded
    table.put_item.assert_called_once()
