"""
Contract test for pipeline-a-batch-checker (#FAR-1, issue #154).

Asserts the checker returns the exact shape the Step Function
'Phase A Done?' choice state references: {done, pending, total, run_id,
deadman_expired}. The choice state specifically reads $.a_check.done.
"""
import importlib.util
import os
import sys
import time
import types
from pathlib import Path
from unittest.mock import MagicMock, patch

_LAMBDAS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "lambdas"


def _load_checker(counter_item):
    """Load with a mocked DDB counter_table returning `counter_item`."""
    table = MagicMock()
    table.get_item.return_value = (
        {"Item": counter_item} if counter_item is not None else {}
    )

    ddb_resource = MagicMock()
    ddb_resource.Table.return_value = table

    boto3_stub = types.ModuleType("boto3")
    boto3_stub.client = MagicMock(return_value=MagicMock())
    boto3_stub.resource = MagicMock(return_value=ddb_resource)

    env = {"COUNTER_TABLE": "qgi-pipeline-a-counter", "DEADMAN_TIMEOUT_S": "5400"}
    with patch.dict(sys.modules, {"boto3": boto3_stub}), \
         patch.dict(os.environ, env):
        spec = importlib.util.spec_from_file_location(
            "a_batch_checker",
            str(_LAMBDAS_DIR / "pipeline-a-batch-checker" / "lambda_function.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    return mod


_REQUIRED_KEYS = {"done", "pending", "total", "run_id", "deadman_expired"}


def test_return_shape_has_all_required_keys():
    """Step Function 'Phase A Done?' reads $.a_check.done. Reporter also
    consumes .total, .pending, .deadman_expired via parameters mapping."""
    mod = _load_checker({"pending": 0, "total": 60})
    result = mod.lambda_handler({"run_id": "test-run"}, None)
    missing = _REQUIRED_KEYS - set(result.keys())
    assert not missing, f"missing keys {missing}. Got {result}"
    assert isinstance(result["done"], bool)
    assert isinstance(result["pending"], int)
    assert isinstance(result["total"], int)


def test_done_true_when_pending_zero():
    mod = _load_checker({"pending": 0, "total": 60})
    result = mod.lambda_handler({"run_id": "r1"}, None)
    assert result["done"] is True
    assert result["deadman_expired"] is False


def test_done_false_when_pending_nonzero_and_within_deadman():
    mod = _load_checker({"pending": 5, "total": 60})
    result = mod.lambda_handler(
        {"run_id": "r1", "phase1_started_at": int(time.time()) - 60}, None
    )
    assert result["done"] is False
    assert result["pending"] == 5
    assert result["deadman_expired"] is False


def test_deadman_forces_done_true_after_timeout():
    mod = _load_checker({"pending": 3, "total": 60})
    result = mod.lambda_handler(
        {"run_id": "r1", "phase1_started_at": int(time.time()) - 9999}, None
    )
    assert result["done"] is True
    assert result["deadman_expired"] is True
    assert result["pending"] == 3  # still reports real pending


def test_missing_counter_row_returns_not_done():
    """Dispatcher hasn't run yet or counter was wiped. Must not crash
    and must return done=False so SF keeps polling."""
    mod = _load_checker(None)
    result = mod.lambda_handler({"run_id": "r1"}, None)
    assert result["done"] is False
    assert set(result.keys()) >= _REQUIRED_KEYS
