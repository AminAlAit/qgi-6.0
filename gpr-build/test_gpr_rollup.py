"""Tests for the QGI-GPR roll-up renderer (gpr_rollup.py).

Covers the PURE surface only (no BigQuery / no creds): dictionary load, SQL
render for both phases, the dictionary-driven threats/acts split, placeholder
completeness, and the country-filter toggle. The bq subprocess path is a
verbatim port of seed_live_baseline.bq_query and is NOT exercised here.

Also covers the new hardening features (items 1-4 in the architecture review):
  - CLUSTER BY present in DDL (schema hardening)
  - slice_id renders into the INSERT (manifest audit tag)
  - manifest guard refuses an already-paid slice
  - incremental --month path renders a single-partition INSERT

Run:  python -m pytest test_gpr_rollup.py -v
"""
import json
import os
import re
import tempfile

from gpr_rollup import (
    load_categories, render_sql, render_incremental_sql,
    _half_or, _slug, _make_slice_id,
    load_manifest, check_manifest_allows_slice, advance_manifest,
    GPRC_FIPS_ILLUSTRATIVE,
)


# ---- dictionary load --------------------------------------------------------
def test_loads_exactly_8_categories_in_order():
    cats = load_categories()
    assert [c["cat"] for c in cats] == list(range(1, 9))


def test_every_category_has_nonempty_regex_and_axis():
    for c in load_categories():
        assert c["regex"], f"cat {c['cat']} empty regex"
        assert c["threat_or_act"] in ("threat", "act")
        assert c["col"].startswith(f"g{c['cat']}_")


def test_regex_is_pipe_join_of_gkg_themes_tokens():
    # The frozen P1 regex must be EXACTLY the confident gkg_themes tokens
    # joined with '|', with NO verify_on_creds tokens leaking in.
    import json, os
    d = json.load(open(
        os.path.join(os.path.dirname(__file__), "gpr-theme-dictionary-v2.json"),
        encoding="utf-8"))
    by_cat = {c["cat"]: c for c in d["categories"]}
    for c in load_categories():
        src = by_cat[c["cat"]]
        assert c["regex"] == "|".join(src["gkg_themes"])
        for voc in src.get("verify_on_creds", []):
            # a verify-on-creds token must NOT appear as a standalone regex alt
            assert voc not in c["regex"].split("|")


# ---- threats / acts split (read from the dictionary, not hardcoded) ---------
def test_threats_acts_split_matches_iacoviello():
    cats = load_categories()
    threats = {c["cat"] for c in cats if c["threat_or_act"] == "threat"}
    acts = {c["cat"] for c in cats if c["threat_or_act"] == "act"}
    assert threats == {1, 2, 3, 4, 5}   # GPRT half
    assert acts == {6, 7, 8}            # GPRA half


def test_half_or_builds_or_chain():
    cats = load_categories()
    expr = _half_or(cats, "act")
    assert expr.count(" OR ") == 2  # 3 act categories -> 2 ORs
    assert "g6_" in expr and "g7_" in expr and "g8_" in expr


def test_half_or_raises_on_unknown_side():
    try:
        _half_or(load_categories(), "neither")
    except ValueError:
        return
    raise AssertionError("expected ValueError for unknown threat_or_act")


# ---- render: no placeholders left, both phases ------------------------------
def test_render_phase_b_leaves_no_token_placeholders():
    sql = render_sql("B", load_categories(), country_fips=GPRC_FIPS_ILLUSTRATIVE)
    assert not re.findall(r"\{\{[A-Z][A-Z0-9_]*\}\}", sql)
    assert sql.lstrip().startswith("-- PHASE B")
    assert "GROUP BY country_code, month" in sql
    # denominator is DISTINCT docs, never a sum of flags
    assert "COUNT(DISTINCT doc_id)" in sql


def test_render_phase_a_is_create_plus_insert():
    sql = render_sql("A", load_categories())
    assert not re.findall(r"\{\{[A-Z][A-Z0-9_]*\}\}", sql)
    assert "CREATE TABLE IF NOT EXISTS" in sql
    assert "INSERT INTO" in sql
    # cost controls present
    assert "_PARTITIONTIME >= TIMESTAMP(" in sql
    assert "SELECT *" not in sql


def test_phase_a_includes_all_8_flag_exprs():
    sql = render_sql("A", load_categories())
    n = sql.count("REGEXP_CONTAINS(V2Themes, r'")
    assert n == 8, f"expected 8 category flag expressions, got {n}"


def test_gpr_any_is_or_across_all_8():
    sql = render_sql("A", load_categories())
    # the gpr_any LOGICAL_OR argument must OR all 8 category columns
    m = re.search(r"LOGICAL_OR\(([^)]*g8_[^)]*)\) AS gpr_any", sql)
    assert m, "gpr_any OR-of-all-8 not found"
    assert m.group(1).count(" OR ") == 7


# ---- country filter toggle --------------------------------------------------
def test_country_filter_present_when_fips_given():
    sql = render_sql("B", load_categories(), country_fips=["AR", "EG"])
    assert "country_code IN ('AR', 'EG')" in sql


def test_country_filter_absent_when_none():
    sql = render_sql("B", load_categories(), country_fips=None)
    assert "country_code IN (" not in sql
    assert "no country filter" in sql


# ---- slug ------------------------------------------------------------------
def test_slug_lowercases_and_underscores():
    assert _slug("Military Buildups") == "military_buildups"
    assert _slug("Beginning of War") == "beginning_of_war"


# ============================================================================
# NEW TESTS: hardening features (architecture review items 1-4)
# ============================================================================

# ---- item 1: CLUSTER BY in DDL ----------------------------------------------
def test_cluster_by_country_code_in_ddl():
    """CLUSTER BY country_code must appear in the Phase A CREATE TABLE DDL.

    This MUST be set before the first insert; changing clustering after data
    is written requires a full table rewrite (that would be a re-scan).
    """
    sql = render_sql("A", load_categories())
    assert "CLUSTER BY country_code" in sql, (
        "CLUSTER BY country_code missing from CREATE TABLE DDL. "
        "Must be present before any data is written."
    )


def test_partition_by_event_date_still_present():
    """PARTITION BY event_date must coexist with the new CLUSTER BY."""
    sql = render_sql("A", load_categories())
    assert "PARTITION BY event_date" in sql


# ---- item 2: slice_id renders into the INSERT --------------------------------
def test_slice_id_rendered_in_phase_a_insert():
    """The INSERT must carry the slice_id literal so SELECT DISTINCT slice_id
    shows exactly which slices were paid for, and duplicate inserts are detectable.
    """
    sql = render_sql("A", load_categories(),
                     slice_start="2015-02-18", slice_end="2016-01-01")
    # The rendered value should be the literal string '2015-02-18_2016-01-01'
    assert "'2015-02-18_2016-01-01' AS slice_id" in sql, (
        f"slice_id literal not found in rendered INSERT. SQL excerpt:\n"
        f"{sql[sql.find('INSERT'):sql.find('INSERT')+500]}"
    )


def test_slice_id_changes_with_different_bounds():
    """Different slice bounds must produce different slice_id values."""
    sql1 = render_sql("A", load_categories(),
                      slice_start="2015-02-18", slice_end="2016-01-01")
    sql2 = render_sql("A", load_categories(),
                      slice_start="2016-01-01", slice_end="2017-01-01")
    assert "'2015-02-18_2016-01-01' AS slice_id" in sql1
    assert "'2016-01-01_2017-01-01' AS slice_id" in sql2
    # They must differ
    assert "'2015-02-18_2016-01-01' AS slice_id" not in sql2


def test_make_slice_id_format():
    assert _make_slice_id("2015-02-18", "2016-01-01") == "2015-02-18_2016-01-01"
    assert _make_slice_id("2020-01-01", "2021-01-01") == "2020-01-01_2021-01-01"


# ---- item 3: manifest guard refuses an already-paid slice -------------------
def _make_tmp_manifest(immutable_through=None, segments=None):
    """Build a minimal manifest dict for testing."""
    return {
        "manifest_version": "1.0",
        "never_rebuy_rule": "test",
        "source_table": "gdelt-bq.gdeltv2.gkg_partitioned",
        "owned_table": "extreme-lattice-344211.qgi_gdelt.gkg_gpr_flags",
        "immutable_through": immutable_through,
        "segments_compiled": segments or [],
        "cost_to_date": {"tb_billed": 0.0, "usd_over_free_tier": 0.0},
    }


def test_manifest_guard_refuses_closed_slice():
    """A slice whose end-date <= immutable_through must be REFUSED."""
    manifest = _make_tmp_manifest(immutable_through="2016-01")
    # end-date 2016-01-01 is the first day of 2016-01; the last closed month
    # is 2016-01, so 2016-01-01 <= 2016-01-01 -> STOP
    try:
        check_manifest_allows_slice(manifest, "2016-01-01")
    except SystemExit as e:
        assert "STOP" in str(e), f"Expected STOP message, got: {e}"
    else:
        raise AssertionError("Expected SystemExit for a closed slice")


def test_manifest_guard_refuses_deep_history():
    """A clearly historical slice must be refused when ledger is set."""
    manifest = _make_tmp_manifest(immutable_through="2020-12")
    try:
        check_manifest_allows_slice(manifest, "2016-01-01")
    except SystemExit as e:
        assert "STOP" in str(e)
    else:
        raise AssertionError("Expected SystemExit for a deep-history slice")


def test_manifest_guard_allows_future_slice():
    """A slice whose end-date > immutable_through must be allowed."""
    manifest = _make_tmp_manifest(immutable_through="2015-12")
    # end 2016-01-01 is after immutable_through 2015-12 -> OK
    check_manifest_allows_slice(manifest, "2016-01-01")  # must not raise


def test_manifest_guard_allows_all_when_immutable_through_is_none():
    """With immutable_through=null (fresh manifest), all slices are allowed."""
    manifest = _make_tmp_manifest(immutable_through=None)
    check_manifest_allows_slice(manifest, "2016-01-01")  # must not raise


def test_manifest_guard_refuses_end_in_closed_range():
    """Slice ending well within the closed range must be refused."""
    manifest = _make_tmp_manifest(immutable_through="2020-12")
    try:
        check_manifest_allows_slice(manifest, "2019-01-01")  # deep inside
    except SystemExit as e:
        assert "STOP" in str(e)
    else:
        raise AssertionError("Expected SystemExit")


def test_load_manifest_raises_on_missing_file():
    """load_manifest must raise FileNotFoundError for a missing path."""
    try:
        load_manifest("/nonexistent/path/manifest.json")
    except FileNotFoundError as e:
        assert "STOP" in str(e)
    else:
        raise AssertionError("Expected FileNotFoundError")


def test_advance_manifest_appends_segment_and_bumps_immutable_through():
    """advance_manifest must append the segment and bump immutable_through."""
    manifest = _make_tmp_manifest(immutable_through=None)
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
        json.dump(manifest, f)
        tmp_path = f.name
    try:
        # Load the file we just wrote
        m = json.load(open(tmp_path, encoding="utf-8"))
        advance_manifest(m, "2015-02-18", "2016-01-01",
                         bytes_scanned_tb=0.25, cost_usd=0.0,
                         path=tmp_path)
        # Re-read from disk to verify persistence
        saved = json.load(open(tmp_path, encoding="utf-8"))
        assert saved["immutable_through"] == "2015-12", (
            f"Expected 2015-12, got {saved['immutable_through']}"
        )
        assert len(saved["segments_compiled"]) == 1
        seg = saved["segments_compiled"][0]
        assert seg["slice_id"] == "2015-02-18_2016-01-01"
        assert seg["bytes_scanned_tb"] == 0.25
    finally:
        os.unlink(tmp_path)


def test_advance_manifest_only_moves_immutable_forward():
    """Advancing with an older slice must not move immutable_through backward."""
    manifest = _make_tmp_manifest(immutable_through="2020-12")
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
        json.dump(manifest, f)
        tmp_path = f.name
    try:
        m = json.load(open(tmp_path, encoding="utf-8"))
        # An older slice that ends in 2016
        advance_manifest(m, "2015-02-18", "2016-01-01", path=tmp_path)
        saved = json.load(open(tmp_path, encoding="utf-8"))
        # Must stay at 2020-12, not go backward to 2015-12
        assert saved["immutable_through"] == "2020-12", (
            f"immutable_through moved backward: {saved['immutable_through']}"
        )
    finally:
        os.unlink(tmp_path)


# ---- item 4: incremental --month path renders a single-partition INSERT -----
def test_incremental_render_produces_insert_only():
    """--mode incremental must render an INSERT with NO CREATE TABLE."""
    sql = render_incremental_sql(load_categories(), "2026-06")
    assert "INSERT INTO" in sql
    assert "CREATE TABLE" not in sql, (
        "Incremental render must not include CREATE TABLE (table already exists)"
    )


def test_incremental_covers_exactly_one_month():
    """The incremental INSERT must bound _PARTITIONTIME to exactly one month."""
    sql = render_incremental_sql(load_categories(), "2026-06")
    # Should contain the first day of the month as the lower bound
    assert "2026-06-01" in sql
    # Should contain the first day of the NEXT month as the upper bound (exclusive)
    assert "2026-07-01" in sql
    # Must NOT scan before the month
    assert "2026-05" not in sql


def test_incremental_slice_id_matches_month_bounds():
    """The slice_id in the incremental INSERT must match the month's [start, end)."""
    sql = render_incremental_sql(load_categories(), "2026-06")
    assert "'2026-06-01_2026-07-01' AS slice_id" in sql, (
        f"incremental slice_id not found. SQL:\n{sql[:800]}"
    )


def test_incremental_december_rolls_to_next_year():
    """December must correctly roll the upper bound to January of the next year."""
    sql = render_incremental_sql(load_categories(), "2025-12")
    assert "2025-12-01" in sql
    assert "2026-01-01" in sql  # upper bound exclusive


def test_incremental_no_placeholders_left():
    """Incremental SQL must have no unrendered {{ }} placeholders."""
    sql = render_incremental_sql(load_categories(), "2026-06")
    leftover = re.findall(r"\{\{[A-Z][A-Z0-9_]*\}\}", sql)
    assert not leftover, f"Unrendered placeholders: {leftover}"


def test_incremental_has_partition_time_filter():
    """Incremental INSERT must have _PARTITIONTIME guards (cost driver)."""
    sql = render_incremental_sql(load_categories(), "2026-06")
    assert "_PARTITIONTIME >= TIMESTAMP(" in sql
    assert "_PARTITIONTIME <  TIMESTAMP(" in sql
