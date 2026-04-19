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


def _load_dispatcher(indicators, jobdef_map: str | None = None):
    """Load dispatcher module with mocked boto3.

    `jobdef_map`: optional JSON-encoded map passed as
    BATCH_JOB_DEFINITION_MAP env var (#240 Phase A per-provider
    routing). When None, the legacy single-JobDef path is exercised.
    """
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
        "BATCH_JOB_DEFINITION": "test-jobdef-default",
        "COUNTER_TABLE": "qgi-pipeline-a-counter",
    }
    if jobdef_map is not None:
        env["BATCH_JOB_DEFINITION_MAP"] = jobdef_map
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


# --------------------------------------------------------------------- #
# #240 Phase A — per-provider JobDef routing                            #
# --------------------------------------------------------------------- #


def test_per_provider_routing_sends_each_indicator_to_its_jobdef():
    """WB indicators should land on the WB JobDef, FAOSTAT on the
    FAOSTAT JobDef. Core acceptance test for the per-provider dispatch
    layer that #241's FAOSTAT fetcher depends on."""
    jobdef_map = json.dumps({
        "WB": "arn:aws:batch:eu-central-1:123:job-definition/wb-fetcher:1",
        "FAOSTAT": "arn:aws:batch:eu-central-1:123:job-definition/fao-fetcher:1",
    })
    mod, batch_client, _ = _load_dispatcher(
        [
            {"id_string": "NY.GDP.MKTP.CD", "status": "process", "provider": "WB"},
            {"id_string": "FA-01", "status": "process", "provider": "FAOSTAT"},
            {"id_string": "FA-04", "status": "process", "provider": "FAOSTAT"},
        ],
        jobdef_map=jobdef_map,
    )
    result = mod.lambda_handler({"run_id": "test-run"}, None)

    # Group calls by jobDefinition arg to verify routing
    by_jobdef: dict[str, list[str]] = {}
    for call in batch_client.submit_job.call_args_list:
        jd = call.kwargs["jobDefinition"]
        # Extract indicator from the container env override
        env_items = call.kwargs["containerOverrides"]["environment"]
        ind_id = next(e["value"] for e in env_items if e["name"] == "INDICATOR_ID")
        by_jobdef.setdefault(jd, []).append(ind_id)

    assert by_jobdef == {
        "arn:aws:batch:eu-central-1:123:job-definition/wb-fetcher:1": ["NY.GDP.MKTP.CD"],
        "arn:aws:batch:eu-central-1:123:job-definition/fao-fetcher:1": ["FA-01", "FA-04"],
    }
    assert result["dispatched"] == 3
    assert result["per_provider_counts"] == {"WB": 1, "FAOSTAT": 2}


def test_unknown_provider_falls_back_to_default_jobdef():
    """An indicator with a provider that's not in the map (e.g., future
    V-Dem before its JobDef is wired up) should go to the default
    BATCH_JOB_DEFINITION so we never drop it silently."""
    jobdef_map = json.dumps({
        "WB": "arn:aws:batch:eu-central-1:123:job-definition/wb-fetcher:1",
    })
    mod, batch_client, _ = _load_dispatcher(
        [
            {"id_string": "NY.GDP.MKTP.CD", "status": "process", "provider": "WB"},
            {"id_string": "V-01", "status": "process", "provider": "V_DEM"},
        ],
        jobdef_map=jobdef_map,
    )
    result = mod.lambda_handler({"run_id": "test-run"}, None)

    by_jobdef: dict[str, list[str]] = {}
    for call in batch_client.submit_job.call_args_list:
        jd = call.kwargs["jobDefinition"]
        env_items = call.kwargs["containerOverrides"]["environment"]
        ind_id = next(e["value"] for e in env_items if e["name"] == "INDICATOR_ID")
        by_jobdef.setdefault(jd, []).append(ind_id)

    assert "arn:aws:batch:eu-central-1:123:job-definition/wb-fetcher:1" in by_jobdef
    assert "test-jobdef-default" in by_jobdef
    assert by_jobdef["test-jobdef-default"] == ["V-01"]
    assert result["dispatched"] == 2


def test_missing_provider_field_defaults_to_wb_then_default_jobdef():
    """Legacy indicators.json without a `provider` field on each entry
    (pre-#240 data) should default to provider='WB' so nothing breaks
    during the rollout window."""
    mod, batch_client, _ = _load_dispatcher([
        {"id_string": "NY.GDP.MKTP.CD", "status": "process"},  # no provider field
    ])
    result = mod.lambda_handler({"run_id": "test-run"}, None)

    call = batch_client.submit_job.call_args_list[0]
    # No map env var set → falls back to legacy single JobDef for every provider
    assert call.kwargs["jobDefinition"] == "test-jobdef-default"
    env_items = call.kwargs["containerOverrides"]["environment"]
    provider_env = next((e for e in env_items if e["name"] == "PROVIDER"), None)
    assert provider_env is not None and provider_env["value"] == "WB"
    assert result["per_provider_counts"] == {"WB": 1}


def test_malformed_jobdef_map_env_falls_back_gracefully():
    """If BATCH_JOB_DEFINITION_MAP is set to something that isn't
    valid JSON (operator error during a TF apply), don't crash — log
    and fall back to legacy single-JobDef mode."""
    mod, batch_client, _ = _load_dispatcher(
        [{"id_string": "A", "status": "process", "provider": "WB"}],
        jobdef_map="not-json-at-all",
    )
    result = mod.lambda_handler({"run_id": "test-run"}, None)
    assert result["dispatched"] == 1
    assert batch_client.submit_job.call_args_list[0].kwargs["jobDefinition"] == (
        "test-jobdef-default"
    )


def test_provider_env_var_injected_into_fargate_task():
    """The fetcher container needs the PROVIDER env var to know which
    fetch pattern to run (in case one image handles multiple providers
    down the line, or for structured logging)."""
    mod, batch_client, _ = _load_dispatcher([
        {"id_string": "FA-01", "status": "process", "provider": "FAOSTAT"},
    ])
    mod.lambda_handler({"run_id": "test-run"}, None)
    call = batch_client.submit_job.call_args_list[0]
    env_items = call.kwargs["containerOverrides"]["environment"]
    env_map = {e["name"]: e["value"] for e in env_items}
    assert env_map["PROVIDER"] == "FAOSTAT"
    assert env_map["INDICATOR_ID"] == "FA-01"
