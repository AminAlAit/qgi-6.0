"""
Contract tests for pipeline-recipe-engine-list-formatter — chunked edition (#490).

The list-formatter now emits (country_a_id, event_category, pattern_tier)
chunks instead of per-country items.  These tests verify:

1.  Seed is the chunk with the fewest patterns (ASC order preserved)
2.  Every INSERT SQL has all three chunk filters (country, category, tier)
3.  Seed SQL is CTAS, all others are INSERT
4.  Empty enumerate results raise RuntimeError
5.  cutoff_year is threaded into all generated SQL
6.  DROP PARTITION SQL is generated keyed on country_a_id only (idempotent)
7.  partitions_total equals total chunk count
8.  All 71 taxonomy categories are representable — build_recipe_query handles
    any category string without raising
9.  All 4 pattern tiers (S/M/L/XL) are representable
10. CTAS and INSERT SQL are schema-identical (same final SELECT column order)
11. Single-chunk input (only one combo exists) still produces a valid result
12. Legacy NULL pattern_tier rows fall into a tier bucket via COALESCE
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

# ---------------------------------------------------------------------------
# Taxonomy: all 71 layer-3 category slugs (from qgi-data/events/taxonomy_hierarchy.json)
# ---------------------------------------------------------------------------
ALL_LAYER3_CATEGORIES = [
    "elections_and_voting", "government_formation", "constitutional_change",
    "decentralization_and_federalism", "democratic_transition",
    "executive_power_consolidation", "military_coup", "transitional_justice",
    "peacekeeping_and_peace_process", "interstate_war", "civil_war_and_insurgency",
    "terrorist_attack", "foreign_intervention", "ethnic_and_communal_conflict",
    "political_violence", "political_repression", "political_corruption",
    "human_rights_violation", "human_rights_reform", "military_policy_and_reform",
    "currency_crisis", "banking_and_financial_crisis", "economic_recession",
    "fiscal_policy_change", "monetary_policy_change", "economic_liberalization",
    "economic_nationalization", "economic_recovery", "economic_growth_milestone",
    "trade_agreement", "trade_dispute", "foreign_direct_investment",
    "industrial_policy", "sanctions_and_arms_embargo", "foreign_aid_and_development",
    "mass_protest", "labor_action", "social_policy_reform", "public_health_reform",
    "poverty_and_inequality_crisis", "religious_and_social_movement",
    "migration_and_refugees", "bilateral_treaty", "multilateral_agreement",
    "diplomatic_rupture", "territorial_disputes", "regional_integration",
    "earthquake", "flood_and_cyclone", "volcanic_eruption", "natural_disaster",
    "drought_and_famine", "epidemic_and_pandemic", "humanitarian_crisis",
    "water_crisis", "energy_policy", "oil_and_gas", "renewable_energy",
    "environmental_policy", "climate_agreement", "resource_conflict",
    "infrastructure_project", "urban_development", "education_reform",
    "education_and_research", "digital_policy", "technology_breakthrough",
    "cyberattack", "cultural_and_heritage", "sport_and_international_event",
    "agricultural_policy",
]
assert len(ALL_LAYER3_CATEGORIES) == 71, (
    f"Expected 71 layer-3 categories, got {len(ALL_LAYER3_CATEGORIES)}"
)

ALL_TIERS = ('S', 'M', 'L', 'XL')


# ---------------------------------------------------------------------------
# Test harness helpers
# ---------------------------------------------------------------------------

def _make_athena_results(chunks):
    """Build a mock get_query_results response for chunked enumerate query.

    chunks: list of (country_a_id, event_category, pattern_tier, count)
    """
    rows = [{"Data": [
        {"VarCharValue": "country_a_id"},
        {"VarCharValue": "event_category"},
        {"VarCharValue": "pattern_tier"},
        {"VarCharValue": "pc"},
    ]}]
    for cid, cat, tier, cnt in chunks:
        rows.append({"Data": [
            {"VarCharValue": str(cid)},
            {"VarCharValue": cat},
            {"VarCharValue": tier},
            {"VarCharValue": str(cnt)},
        ]})
    return {"ResultSet": {"Rows": rows}}


def _load_module(chunks):
    """Load list-formatter with mocked athena + s3 clients.

    chunks: list of (country_a_id, event_category, pattern_tier, count)
            sorted ASC by count (caller's responsibility, matching Athena ORDER BY pc ASC)
    """
    athena_mock = MagicMock()
    athena_mock.start_query_execution.return_value = {"QueryExecutionId": "q-enum-1"}
    athena_mock.get_query_execution.return_value = {
        "QueryExecution": {"Status": {"State": "SUCCEEDED"}}
    }
    athena_mock.get_query_results.return_value = _make_athena_results(chunks)

    s3_mock = MagicMock()
    s3_mock._captured_items = None

    original_put = s3_mock.put_object
    def capture_put(**kwargs):
        body = kwargs.get('Body', '{}')
        s3_mock._captured_items = json.loads(body)
        return original_put(**kwargs)
    s3_mock.put_object = MagicMock(side_effect=capture_put)

    def client_factory(name, *a, **kw):
        if name == "athena":
            return athena_mock
        if name == "s3":
            return s3_mock
        return MagicMock()

    boto3_stub = types.ModuleType("boto3")
    boto3_stub.client = MagicMock(side_effect=client_factory)

    env = {
        "ATHENA_DATABASE": "qgi_data",
        "ATHENA_WORKGROUP": "test-wg",
        "S3_BUCKET": "test-bucket",
    }
    with patch.dict(sys.modules, {"boto3": boto3_stub}), \
         patch.dict(os.environ, env):
        spec = importlib.util.spec_from_file_location(
            "list_formatter_chunked", str(_LAMBDA_FILE),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.time.sleep = lambda *_: None
    return mod, s3_mock


# ---------------------------------------------------------------------------
# Test 1: seed is the smallest-by-count chunk
# ---------------------------------------------------------------------------

def test_seed_is_smallest_chunk():
    """Seed must be the first element in the ASC-sorted chunk list."""
    chunks = [
        (99, "elections_and_voting", "S", 5),
        (42, "mass_protest", "M", 200),
        (1, "economic_recession", "XL", 50000),
    ]
    mod, s3_mock = _load_module(chunks)
    result = mod.lambda_handler({"run_id": "test"}, None)

    assert result['seed_country_id'] == 99, (
        f"seed should be country_a_id=99 (5 patterns), got {result['seed_country_id']}"
    )
    assert result['seed_pattern_count'] == 5


# ---------------------------------------------------------------------------
# Test 2: every INSERT SQL carries all three chunk filters
# ---------------------------------------------------------------------------

def test_all_inserts_have_chunk_filters():
    """Every generated INSERT must contain country, category, AND tier filter."""
    chunks = [
        (5, "elections_and_voting", "S", 1),
        (10, "mass_protest", "M", 100),
        (20, "economic_recession", "L", 200),
    ]
    mod, s3_mock = _load_module(chunks)
    result = mod.lambda_handler({"run_id": "test"}, None)

    # Seed also has filters
    assert "p.country_a_id = 5" in result['seed_sql']
    assert "elections_and_voting" in result['seed_sql']
    assert "'S'" in result['seed_sql']

    for item in s3_mock._captured_items:
        cid = item['country_a_id']
        cat = item['event_category']
        tier = item['pattern_tier']
        sql = item['insert_sql']
        assert f"p.country_a_id = {cid}" in sql, (
            f"INSERT chunk {cid}/{cat}/{tier} missing country filter"
        )
        assert f"'{cat}'" in sql, (
            f"INSERT chunk {cid}/{cat}/{tier} missing event_category filter"
        )
        assert f"'{tier}'" in sql, (
            f"INSERT chunk {cid}/{cat}/{tier} missing pattern_tier filter"
        )


# ---------------------------------------------------------------------------
# Test 3: seed is CTAS, rest are INSERT
# ---------------------------------------------------------------------------

def test_seed_is_ctas_and_rest_are_insert():
    chunks = [
        (5, "elections_and_voting", "S", 1),
        (10, "mass_protest", "M", 100),
        (20, "economic_recession", "L", 200),
    ]
    mod, s3_mock = _load_module(chunks)
    result = mod.lambda_handler({"run_id": "test"}, None)

    assert "CREATE TABLE" in result['seed_sql']
    assert "INSERT INTO" not in result['seed_sql']

    for item in s3_mock._captured_items:
        assert "INSERT INTO" in item['insert_sql']
        assert "CREATE TABLE" not in item['insert_sql']


# ---------------------------------------------------------------------------
# Test 4: empty enumerate results raise RuntimeError
# ---------------------------------------------------------------------------

def test_empty_chunk_list_raises():
    mod, _ = _load_module([])
    raised = False
    try:
        mod.lambda_handler({"run_id": "test"}, None)
    except RuntimeError as exc:
        raised = True
        assert "country_a_id" in str(exc).lower() or "combo" in str(exc).lower() or "No (" in str(exc)
    assert raised, "empty chunk list must raise RuntimeError"


# ---------------------------------------------------------------------------
# Test 5: cutoff_year is threaded into all SQL
# ---------------------------------------------------------------------------

def test_cutoff_year_threaded_into_sql():
    chunks = [
        (5, "elections_and_voting", "S", 1),
        (10, "mass_protest", "M", 100),
    ]
    mod, s3_mock = _load_module(chunks)
    result = mod.lambda_handler({"run_id": "test", "cutoff_year": 2020}, None)

    assert "2020" in result['seed_sql'], "seed SQL missing cutoff_year filter"
    for item in s3_mock._captured_items:
        assert "2020" in item['insert_sql'], (
            f"INSERT chunk {item['country_a_id']}/{item['event_category']}/"
            f"{item['pattern_tier']} missing cutoff_year"
        )


# ---------------------------------------------------------------------------
# Test 6: drop_partition_sql is a no-op (post 2026-04-29 fix)
# ---------------------------------------------------------------------------

def test_drop_partition_sql_is_noop():
    """Per 2026-04-29 SF-run failure: per-chunk DROP PARTITION caused
    glue:BatchDeletePartition concurrency contention when N chunks for the
    same country fanned out in parallel. The fix: emit a `SELECT 1` no-op,
    since the SF state `5b.1 Drop Recipes Table` already drops the whole
    `recipes` table before the Map state runs and `5b.4 Seed CTAS` recreates
    it fresh.

    All non-seed chunks must have drop_partition_sql == 'SELECT 1'.
    """
    chunks = [
        (5, "elections_and_voting", "S", 1),
        (5, "mass_protest", "M", 50),   # same country, different chunk
        (10, "economic_recession", "L", 200),
    ]
    mod, s3_mock = _load_module(chunks)
    mod.lambda_handler({"run_id": "test"}, None)

    for item in s3_mock._captured_items:
        sql = item['drop_partition_sql']
        assert sql == "SELECT 1", (
            f"drop_partition_sql must be the SELECT 1 no-op (chunk {item['chunk_id']}); "
            f"got {sql!r}. Per-chunk Glue partition deletes cause AccessDenied "
            f"contention under parallel fan-out."
        )
        # Must NOT contain DDL — that's the actual fix.
        assert "DROP" not in sql.upper()
        assert "PARTITION" not in sql.upper()


# ---------------------------------------------------------------------------
# Test 7: partitions_total equals total chunk count
# ---------------------------------------------------------------------------

def test_partitions_total_equals_chunk_count():
    chunks = [
        (5, "elections_and_voting", "S", 1),
        (10, "mass_protest", "M", 100),
        (20, "economic_recession", "L", 200),
        (30, "military_coup", "XL", 300),
    ]
    mod, s3_mock = _load_module(chunks)
    result = mod.lambda_handler({"run_id": "test"}, None)

    assert result['partitions_total'] == 4
    assert len(s3_mock._captured_items) == 3  # 4 total minus 1 seed


# ---------------------------------------------------------------------------
# Test 8: all 71 taxonomy categories representable in SQL (no crash)
# ---------------------------------------------------------------------------

def test_all_71_categories_representable():
    """build_recipe_query must not raise for any of the 71 taxonomy categories."""
    chunks = [(1, "elections_and_voting", "S", 1)]
    mod, _ = _load_module(chunks)

    for cat in ALL_LAYER3_CATEGORIES:
        try:
            sql = mod.build_recipe_query(
                cutoff_year=None,
                country_a_id=42,
                event_category=cat,
                pattern_tier='M',
                mode='insert',
            )
        except Exception as exc:
            raise AssertionError(
                f"build_recipe_query raised for category {cat!r}: {exc}"
            ) from exc
        assert f"'{cat}'" in sql, f"category {cat!r} not found in generated SQL"


# ---------------------------------------------------------------------------
# Test 9: all 4 pattern tiers representable in SQL
# ---------------------------------------------------------------------------

def test_all_4_tiers_representable():
    chunks = [(1, "elections_and_voting", "S", 1)]
    mod, _ = _load_module(chunks)

    for tier in ALL_TIERS:
        sql = mod.build_recipe_query(
            cutoff_year=None,
            country_a_id=42,
            event_category='elections_and_voting',
            pattern_tier=tier,
            mode='insert',
        )
        assert f"'{tier}'" in sql, f"tier {tier!r} not found in generated SQL"


# ---------------------------------------------------------------------------
# Test 10: CTAS and INSERT produce schema-identical SELECT column list
# ---------------------------------------------------------------------------

def test_ctas_and_insert_same_select_columns():
    """The SELECT body must be the same regardless of mode (CTAS vs INSERT).
    Specifically: the final column list must be identical so the Athena schema
    contract (#163) is not broken.
    """
    chunks = [(1, "elections_and_voting", "S", 1)]
    mod, _ = _load_module(chunks)

    ctas_sql = mod.build_recipe_query(
        country_a_id=1,
        event_category='elections_and_voting',
        pattern_tier='S',
        mode='ctas',
    )
    insert_sql = mod.build_recipe_query(
        country_a_id=1,
        event_category='elections_and_voting',
        pattern_tier='S',
        mode='insert',
    )

    # Both must contain the same column list markers
    shared_columns = [
        'recipe_id', 'event_category', 'pattern_id', 'country_b_id',
        'country_a_name', 'country_b_name', 'start_year_a', 'start_year_b',
        'length', 'avg_correlation', 'end_year_a', 'end_year_b',
        'event_window', 'event_year_a', 'event_year_b',
        'event_title_a', 'event_title_b', 'indicator_count',
        'pattern_power_score', 'instance_count', 'pattern_tier',
        'median_lead_time_b', 'min_lead_time_b', 'max_lead_time_b',
        'median_lead_time_a', 'pps', 'contains_predicted', 'country_a_id',
    ]
    for col in shared_columns:
        assert col in ctas_sql, f"Column {col!r} missing from CTAS SQL"
        assert col in insert_sql, f"Column {col!r} missing from INSERT SQL"


# ---------------------------------------------------------------------------
# Test 11: single-chunk input (degenerate case) produces a valid result
# ---------------------------------------------------------------------------

def test_single_chunk_input():
    """When only one chunk exists in the entire corpus, it becomes the seed CTAS
    and insert_items is empty.
    """
    chunks = [(42, "elections_and_voting", "S", 99)]
    mod, s3_mock = _load_module(chunks)
    result = mod.lambda_handler({"run_id": "test"}, None)

    assert result['seed_country_id'] == 42
    assert result['seed_pattern_count'] == 99
    assert "CREATE TABLE" in result['seed_sql']
    assert s3_mock._captured_items == []
    assert result['partitions_total'] == 1


# ---------------------------------------------------------------------------
# Test 12: chunk_id field is present and correctly formatted
# ---------------------------------------------------------------------------

def test_chunk_id_format():
    """Each insert item must carry a chunk_id = '{country_a_id}_{cat}_{tier}'."""
    chunks = [
        (1, "elections_and_voting", "S", 5),
        (2, "mass_protest", "M", 10),
    ]
    mod, s3_mock = _load_module(chunks)
    mod.lambda_handler({"run_id": "test"}, None)

    for item in s3_mock._captured_items:
        expected = f"{item['country_a_id']}_{item['event_category']}_{item['pattern_tier']}"
        assert item['chunk_id'] == expected, (
            f"chunk_id mismatch: expected {expected!r}, got {item['chunk_id']!r}"
        )
