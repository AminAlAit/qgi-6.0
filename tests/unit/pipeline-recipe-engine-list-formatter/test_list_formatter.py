"""
Contract tests for pipeline-recipe-engine-list-formatter (#162 Layer 2).

The list-formatter Lambda parses Athena query results (country_a_id + count)
and pre-generates all per-country SQL strings for the Map state. It does NO
Athena execution itself — just JSON formatting.

These tests verify:
1. The smallest-by-count country is selected as the CTAS seed (Sonnet blocker)
2. Every generated SQL carries a partition filter
3. The seed SQL is CTAS mode, the rest are INSERT mode
4. Empty query results raise RuntimeError (fail-loud)
5. cutoff_year is threaded into all generated SQL
"""
import importlib.util
import json
import os
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch

_LAMBDAS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "lambdas"
_LAMBDA_FILE = _LAMBDAS_DIR / "pipeline-recipe-engine-list-formatter" / "lambda_function.py"


def _make_athena_results(country_counts):
    """Build a mock get_query_results response for [(id, count), ...] sorted asc."""
    rows = [{"Data": [{"VarCharValue": "country_a_id"}, {"VarCharValue": "pc"}]}]
    for cid, cnt in country_counts:
        rows.append({"Data": [
            {"VarCharValue": str(cid)},
            {"VarCharValue": str(cnt)},
        ]})
    return {"ResultSet": {"Rows": rows}}


def _load_module(country_counts):
    """Load list-formatter with mocked athena + s3 clients."""
    athena_mock = MagicMock()
    athena_mock.start_query_execution.return_value = {"QueryExecutionId": "q-enum-1"}
    athena_mock.get_query_execution.return_value = {
        "QueryExecution": {"Status": {"State": "SUCCEEDED"}}
    }
    athena_mock.get_query_results.return_value = _make_athena_results(country_counts)

    s3_mock = MagicMock()
    # Capture what gets written to S3 so tests can inspect insert_items
    s3_mock._captured_items = None
    _original_put = s3_mock.put_object
    def capture_put(**kwargs):
        body = kwargs.get('Body', '{}')
        s3_mock._captured_items = json.loads(body)
        return _original_put(**kwargs)
    s3_mock.put_object = MagicMock(side_effect=capture_put)

    def client_factory(name, *a, **kw):
        if name == "athena":
            return athena_mock
        if name == "s3":
            return s3_mock
        return MagicMock()

    boto3_stub = types.ModuleType("boto3")
    boto3_stub.client = MagicMock(side_effect=client_factory)

    env = {"ATHENA_DATABASE": "qgi_data", "ATHENA_WORKGROUP": "test-wg", "S3_BUCKET": "test-bucket"}
    with patch.dict(sys.modules, {"boto3": boto3_stub}), \
         patch.dict(os.environ, env):
        spec = importlib.util.spec_from_file_location(
            "list_formatter", str(_LAMBDA_FILE),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        # Stub time.sleep so the poll loop doesn't actually wait
        mod.time.sleep = lambda *_: None
    return mod, s3_mock


# ---------------------------------------------------------------------------
# Test 1: seed is the smallest-by-count country (#162 blocker)
# ---------------------------------------------------------------------------

def test_seed_is_smallest_by_pattern_count():
    """The CTAS seed MUST be the country with the fewest patterns, not the
    lowest integer ID. Country_a_id=1 might be a huge country (USA-ish).
    """
    # counts already sorted asc: id=99 has 10 patterns (smallest), id=1 has 50000
    mod, s3_mock = _load_module([(99, 10), (42, 500), (1, 50000)])
    result = mod.lambda_handler({
        "run_id": "test",
    }, None)

    assert result['seed_country_id'] == 99, (
        f"seed should be country_a_id=99 (10 patterns, smallest), "
        f"got {result['seed_country_id']}. #162 blocker regression."
    )
    assert result['seed_pattern_count'] == 10


# ---------------------------------------------------------------------------
# Test 2: every INSERT SQL has a partition filter
# ---------------------------------------------------------------------------

def test_all_inserts_have_partition_filter():
    """Every generated INSERT must contain WHERE p.country_a_id = N."""
    mod, s3_mock = _load_module([(5, 1), (10, 100), (20, 200), (30, 300)])
    result = mod.lambda_handler({
                "run_id": "test",
    }, None)

    # Seed should also have partition filter
    assert "p.country_a_id = 5" in result['seed_sql']

    for item in s3_mock._captured_items:
        cid = item['country_a_id']
        assert f"p.country_a_id = {cid}" in item['insert_sql'], (
            f"INSERT for country_a_id={cid} missing partition filter"
        )


# ---------------------------------------------------------------------------
# Test 3: seed is CTAS, rest are INSERT
# ---------------------------------------------------------------------------

def test_seed_is_ctas_and_rest_are_insert():
    mod, s3_mock = _load_module([(5, 1), (10, 100), (20, 200)])
    result = mod.lambda_handler({
                "run_id": "test",
    }, None)

    assert "CREATE TABLE" in result['seed_sql']
    assert "INSERT INTO" not in result['seed_sql']

    for item in s3_mock._captured_items:
        assert "INSERT INTO" in item['insert_sql']
        assert "CREATE TABLE" not in item['insert_sql']


# ---------------------------------------------------------------------------
# Test 4: empty query results raise RuntimeError
# ---------------------------------------------------------------------------

def test_empty_country_list_raises():
    mod, s3_mock = _load_module([])
    raised = False
    try:
        mod.lambda_handler({
                        "run_id": "test",
        }, None)
    except RuntimeError as exc:
        raised = True
        assert "No country_a_id" in str(exc)
    assert raised, "empty country list must raise RuntimeError"


# ---------------------------------------------------------------------------
# Test 5: cutoff_year is threaded into SQL
# ---------------------------------------------------------------------------

def test_cutoff_year_threaded_into_sql():
    mod, s3_mock = _load_module([(5, 1), (10, 100)])
    result = mod.lambda_handler({
                "run_id": "test",
        "cutoff_year": 2020,
    }, None)

    assert "2020" in result['seed_sql'], "seed SQL missing cutoff_year filter"
    for item in s3_mock._captured_items:
        assert "2020" in item['insert_sql'], (
            f"INSERT for {item['country_a_id']} missing cutoff_year"
        )


# ---------------------------------------------------------------------------
# Test 6: DROP PARTITION SQL is generated for each INSERT item
# ---------------------------------------------------------------------------

def test_drop_partition_sql_generated():
    mod, s3_mock = _load_module([(5, 1), (10, 100), (20, 200)])
    result = mod.lambda_handler({
                "run_id": "test",
    }, None)

    for item in s3_mock._captured_items:
        cid = item['country_a_id']
        assert f"country_a_id = {cid}" in item['drop_partition_sql']
        assert "DROP IF EXISTS PARTITION" in item['drop_partition_sql']


# ---------------------------------------------------------------------------
# Test 7: partitions_total is correct
# ---------------------------------------------------------------------------

def test_partitions_total():
    mod, s3_mock = _load_module([(5, 1), (10, 100), (20, 200), (30, 300)])
    result = mod.lambda_handler({
                "run_id": "test",
    }, None)

    assert result['partitions_total'] == 4
    assert len(s3_mock._captured_items) == 3  # 4 total minus 1 seed
