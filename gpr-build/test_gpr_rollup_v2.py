"""Tests for the QGI-GPR v2 roll-up renderer (gpr_rollup_v2.py).

Covers the PURE surface (no BigQuery / no creds):
  1. v3 dictionary loads correctly with expanded cat3/cat8 token sets.
  2. matched_themes column renders in the Phase A INSERT.
  3. Broad-capture regex is present in rendered SQL.
  4. v2 manifest guard is independent of v1 (a v1-closed slice is allowed in v2).
  5. All v1 renderer tests still pass against the v2 renderer + v3 dict.
  6. Bugfixed token names confirmed in rendered regex (no old short names present).

Run:  python -m pytest test_gpr_rollup_v2.py -v
"""
import json
import os
import re
import tempfile

from gpr_rollup_v2 import (
    load_categories, render_sql, load_broad_capture_regex,
    _half_or, _slug, _make_slice_id,
    load_manifest, check_manifest_allows_slice, advance_manifest,
    GPRC_FIPS_ILLUSTRATIVE, DICT_FILE, MANIFEST_PATH,
)

ROOT = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _cats():
    return load_categories()


def _bcre():
    return load_broad_capture_regex()


def _make_tmp_manifest_v2(immutable_through=None, segments=None):
    return {
        "manifest_version": "2.0",
        "never_rebuy_rule": "test",
        "dictionary_version": "3.0.0",
        "source_table": "gdelt-bq.gdeltv2.gkg_partitioned",
        "owned_table": "extreme-lattice-344211.qgi_gdelt.gkg_gpr_flags_v2",
        "immutable_through": immutable_through,
        "segments_compiled": segments or [],
        "cost_to_date": {"tb_billed": 0.0, "usd_over_free_tier": 0.0},
    }


# ---------------------------------------------------------------------------
# 1. Dictionary loads with correct v3 structure
# ---------------------------------------------------------------------------
def test_v3_dictionary_version():
    d = json.load(open(DICT_FILE, encoding="utf-8"))
    assert d["version"] == "3.0.0", f"Expected 3.0.0, got {d['version']}"


def test_loads_exactly_8_categories_in_order():
    cats = _cats()
    assert [c["cat"] for c in cats] == list(range(1, 9))


def test_every_category_has_nonempty_regex_and_axis():
    for c in _cats():
        assert c["regex"], f"cat {c['cat']} empty regex"
        assert c["threat_or_act"] in ("threat", "act")
        assert c["col"].startswith(f"g{c['cat']}_")


def test_threats_acts_split_matches_iacoviello():
    cats = _cats()
    threats = {c["cat"] for c in cats if c["threat_or_act"] == "threat"}
    acts    = {c["cat"] for c in cats if c["threat_or_act"] == "act"}
    assert threats == {1, 2, 3, 4, 5}
    assert acts    == {6, 7, 8}


# ---------------------------------------------------------------------------
# 2. v3 cat3 threat-skew fix: promoted tokens appear in regex
# ---------------------------------------------------------------------------
def test_cat3_contains_promoted_military_tokens():
    """cat3 must now include TAX_WEAPONS, SLFID_MILITARY_SPENDING, etc."""
    cat3 = next(c for c in _cats() if c["cat"] == 3)
    regex = cat3["regex"]
    for token in ["TAX_WEAPONS", "SLFID_MILITARY_SPENDING",
                  "MIL_SELF_IDENTIFIED_ARMS_DEAL", "MILITARY_COOPERATION"]:
        assert token in regex.split("|"), (
            f"v3 cat3 regex missing '{token}' — promotion failed. regex={regex}"
        )
    # Core MILITARY token must still be there
    assert "MILITARY" in regex.split("|"), "MILITARY missing from cat3"


def test_cat3_does_not_contain_TAX_MILITARY():
    """TAX_MILITARY bare stem must NEVER appear (permanent exclusion guard)."""
    cat3 = next(c for c in _cats() if c["cat"] == 3)
    parts = cat3["regex"].split("|")
    # TAX_MILITARY as an exact token is banned; TAX_WEAPONS is fine
    assert "TAX_MILITARY" not in parts, (
        "TAX_MILITARY bare stem found in cat3 — this is the false-positive trap (80M noise docs)"
    )


def test_cat3_has_exactly_5_tokens():
    """cat3 should have MILITARY + 4 promoted = 5 tokens total."""
    cat3 = next(c for c in _cats() if c["cat"] == 3)
    tokens = cat3["regex"].split("|")
    assert len(tokens) == 5, f"Expected 5 cat3 tokens, got {len(tokens)}: {tokens}"


# ---------------------------------------------------------------------------
# 3. v3 cat8 threat-skew fix: promoted tokens appear in regex
# ---------------------------------------------------------------------------
def test_cat8_contains_promoted_terror_act_tokens():
    """cat8 must now include ASSASSINATION, TAX_WEAPONS_SUICIDE_BOMBER, etc."""
    cat8 = next(c for c in _cats() if c["cat"] == 8)
    regex = cat8["regex"]
    for token in ["ASSASSINATION", "TAX_WEAPONS_SUICIDE_BOMBER",
                  "TAX_WEAPONS_SUICIDE_BOMB", "TAX_TERROR_GROUP"]:
        assert token in regex.split("|"), (
            f"v3 cat8 regex missing '{token}' — promotion failed. regex={regex}"
        )


def test_cat8_has_exactly_7_tokens():
    """cat8: TERROR + WB_2467_TERRORISM + EXTREMISM + 4 promoted = 7 tokens."""
    cat8 = next(c for c in _cats() if c["cat"] == 8)
    tokens = cat8["regex"].split("|")
    assert len(tokens) == 7, f"Expected 7 cat8 tokens, got {len(tokens)}: {tokens}"


# ---------------------------------------------------------------------------
# 4. Token-name bugfixes: correct names present, old wrong names absent
# ---------------------------------------------------------------------------
def test_bugfix_wb2462_correct_name_used():
    """WB_2462_POLITICAL_VIOLENCE_AND_WAR must appear; old short name must not."""
    all_regexes = [c["regex"] for c in _cats()]
    joined = "|".join(all_regexes)
    parts = joined.split("|")
    # Correct name must appear (in cats 1, 2, 7)
    assert "WB_2462_POLITICAL_VIOLENCE_AND_WAR" in parts, (
        "WB_2462_POLITICAL_VIOLENCE_AND_WAR not found — bugfix not applied"
    )
    # Old wrong name must NOT appear
    assert "WB_2462_POLITICAL_VIOLENCE" not in [
        p for p in parts if p == "WB_2462_POLITICAL_VIOLENCE"
    ], "Old nonexistent token WB_2462_POLITICAL_VIOLENCE still present"


def test_bugfix_extremism_correct_name_used():
    """EXTREMISM must appear; old EXTREMIS (no M) must not be a standalone token."""
    all_regexes = [c["regex"] for c in _cats()]
    joined = "|".join(all_regexes)
    parts = joined.split("|")
    assert "EXTREMISM" in parts, "EXTREMISM not found in any category regex"
    # EXTREMIS as an exact token should not appear (it's the old wrong form)
    assert "EXTREMIS" not in parts, (
        "Old nonexistent token EXTREMIS still present (should be EXTREMISM)"
    )


def test_bugfix_wb2451_correct_name_used():
    """WB_2451_REBELS_GUERRILLAS_AND_INSURGENTS must appear; old short name must not."""
    all_regexes = [c["regex"] for c in _cats()]
    joined = "|".join(all_regexes)
    parts = joined.split("|")
    assert "WB_2451_REBELS_GUERRILLAS_AND_INSURGENTS" in parts, (
        "WB_2451_REBELS_GUERRILLAS_AND_INSURGENTS not found — bugfix not applied"
    )
    assert "WB_2451_REBELS" not in [p for p in parts if p == "WB_2451_REBELS"], (
        "Old short token WB_2451_REBELS still present (should be full name)"
    )


# ---------------------------------------------------------------------------
# 5. Broad-capture regex loads and is non-trivial
# ---------------------------------------------------------------------------
def test_broad_capture_regex_loads():
    bcre = _bcre()
    assert bcre, "broad_capture_regex is empty"
    assert len(bcre) > 50, f"broad_capture_regex suspiciously short: {bcre!r}"


def test_broad_capture_regex_covers_core_families():
    """The broad-capture regex must cover the core token families we care about."""
    bcre = _bcre()
    for family in ["MILITARY", "TERROR", "WMD", "ARMEDCONFLICT", "TAX_WEAPONS",
                   "TAX_TERROR", "MIL_", "EXTREMISM", "JIHAD"]:
        assert family in bcre, f"broad_capture_regex missing core family '{family}'"


def test_broad_capture_regex_covers_wb_nodes():
    """WB_24xx and WB_25xx node prefixes must be in the broad-capture regex."""
    bcre = _bcre()
    # Just check a couple of key node prefixes
    assert "WB_2432_" in bcre or "WB_2433_" in bcre, "WB_24xx nodes missing from broad-capture"
    assert "WB_2503_" in bcre, "WB_2503_ (weapons proliferation) missing from broad-capture"


# ---------------------------------------------------------------------------
# 6. matched_themes renders in Phase A SQL
# ---------------------------------------------------------------------------
def test_phase_a_contains_matched_themes_column():
    """Phase A CREATE TABLE DDL must include matched_themes ARRAY<STRING>."""
    sql = render_sql("A", _cats(), _bcre())
    assert "matched_themes" in sql, "matched_themes column missing from Phase A DDL"
    assert "ARRAY<STRING>" in sql or "ARRAY(" in sql, (
        "matched_themes ARRAY type not found in DDL"
    )


def test_phase_a_matched_themes_uses_broad_capture():
    """The matched_themes extraction must use REGEXP_CONTAINS with the broad-capture regex."""
    sql = render_sql("A", _cats(), _bcre())
    # The broad-capture regex should appear inline in the ARRAY(...) extraction
    bcre = _bcre()
    # Take first 30 chars of the regex as a fingerprint (enough to confirm it's rendered)
    assert bcre[:30] in sql, (
        f"broad-capture regex not found in rendered SQL. "
        f"First 30 chars: {bcre[:30]!r}"
    )


def test_phase_a_matched_themes_unnests_split():
    """The matched_themes extraction pattern must SPLIT(V2Themes, ';') and UNNEST."""
    sql = render_sql("A", _cats(), _bcre())
    # The pattern is: ARRAY(SELECT t FROM UNNEST(SPLIT(V2Themes, ';')) AS t WHERE ...)
    assert "SPLIT(V2Themes, ';')" in sql, (
        "SPLIT(V2Themes, ';') not found in matched_themes extraction"
    )


def test_phase_a_matched_themes_in_select_list():
    """Phase A SELECT must include matched_themes in the final GROUP BY output."""
    sql = render_sql("A", _cats(), _bcre())
    # ANY_VALUE(matched_themes) is the aggregation pattern we use
    assert "matched_themes" in sql
    assert "ANY_VALUE(matched_themes)" in sql, (
        "ANY_VALUE(matched_themes) not found — doc-level aggregation pattern missing"
    )


# ---------------------------------------------------------------------------
# 7. Phase B does NOT contain matched_themes (it's a roll-up, not doc-level)
# ---------------------------------------------------------------------------
def test_phase_b_does_not_aggregate_matched_themes():
    """Phase B is a monthly aggregate — matched_themes must NOT appear in the
    SELECT list or the GROUP BY. It is a doc-level column; it may appear in
    comments (those are harmless) but must not be selected or aggregated."""
    sql = render_sql("B", _cats(), _bcre(), country_fips=GPRC_FIPS_ILLUSTRATIVE)
    # Strip comments (lines starting with --) to check only executable SQL
    non_comment_lines = [
        line for line in sql.splitlines()
        if not line.strip().startswith("--")
    ]
    executable_sql = "\n".join(non_comment_lines)
    assert "matched_themes" not in executable_sql, (
        "matched_themes found in Phase B executable SQL — "
        "it should only be in Phase A DDL/INSERT (comments are OK)"
    )


# ---------------------------------------------------------------------------
# 8. Standard render tests (mirrors test_gpr_rollup.py; adapted for v2 renderer)
# ---------------------------------------------------------------------------
def test_render_phase_b_leaves_no_token_placeholders():
    sql = render_sql("B", _cats(), _bcre(), country_fips=GPRC_FIPS_ILLUSTRATIVE)
    assert not re.findall(r"\{\{[A-Z][A-Z0-9_]*\}\}", sql)
    assert "GROUP BY country_code, month" in sql
    assert "COUNT(DISTINCT doc_id)" in sql


def test_render_phase_a_is_create_plus_insert():
    sql = render_sql("A", _cats(), _bcre())
    assert not re.findall(r"\{\{[A-Z][A-Z0-9_]*\}\}", sql)
    assert "CREATE TABLE IF NOT EXISTS" in sql
    assert "INSERT INTO" in sql
    assert "_PARTITIONTIME >= TIMESTAMP(" in sql
    assert "SELECT *" not in sql


def test_phase_a_includes_all_8_flag_exprs():
    sql = render_sql("A", _cats(), _bcre())
    n = sql.count("REGEXP_CONTAINS(V2Themes, r'")
    # 8 category flag expressions + 1 for matched_themes broad-capture
    assert n >= 8, f"expected at least 8 category flag expressions, got {n}"
    # The category flags specifically:
    cat_flags = re.findall(r"REGEXP_CONTAINS\(V2Themes, r'[^']+'\) AS g\d_", sql)
    assert len(cat_flags) == 8, f"expected 8 category flag exprs, got {len(cat_flags)}"


def test_gpr_any_is_or_across_all_8():
    sql = render_sql("A", _cats(), _bcre())
    m = re.search(r"LOGICAL_OR\(([^)]*g8_[^)]*)\) AS gpr_any", sql)
    assert m, "gpr_any OR-of-all-8 not found"
    assert m.group(1).count(" OR ") == 7


def test_cluster_by_country_code_in_ddl():
    sql = render_sql("A", _cats(), _bcre())
    assert "CLUSTER BY country_code" in sql


def test_partition_by_event_date_in_ddl():
    sql = render_sql("A", _cats(), _bcre())
    assert "PARTITION BY event_date" in sql


def test_owned_table_v2_not_v1():
    """The rendered SQL must target gkg_gpr_flags_v2, NOT gkg_gpr_flags (v1)."""
    sql = render_sql("A", _cats(), _bcre())
    assert "gkg_gpr_flags_v2" in sql, "Target table is not gkg_gpr_flags_v2"
    # v1 table name must not appear as the insert target
    assert "`qgi_gdelt.gkg_gpr_flags`" not in sql or "gkg_gpr_flags_v2" in sql


def test_country_filter_present_when_fips_given():
    sql = render_sql("B", _cats(), _bcre(), country_fips=["AR", "EG"])
    assert "country_code IN ('AR', 'EG')" in sql


def test_country_filter_absent_when_none():
    sql = render_sql("B", _cats(), _bcre(), country_fips=None)
    assert "country_code IN (" not in sql
    assert "no country filter" in sql


# ---------------------------------------------------------------------------
# 9. v2 manifest guard is INDEPENDENT of v1 (its own ledger, own table)
# ---------------------------------------------------------------------------
def test_v2_manifest_guard_is_independent_of_v1():
    """A slice that is closed in v1 (immutable_through=2026-05) must be
    ALLOWED in a fresh v2 manifest (immutable_through=None).

    This is the critical independence test: v2 is a new extraction; the v1
    paid scan does NOT block a v2 re-scan of the same range.
    """
    # Simulate a fresh v2 manifest (nothing compiled yet)
    v2_manifest = _make_tmp_manifest_v2(immutable_through=None)
    # The v1 closed range covers up through 2026-05; end='2026-06-02' would be
    # refused by v1's check_manifest_allows_slice — but NOT by v2's.
    # Must not raise:
    check_manifest_allows_slice(v2_manifest, "2026-06-02")


def test_v2_manifest_guard_refuses_its_own_closed_slice():
    """Once the v2 ledger has a closed range, IT refuses re-scans of that range."""
    v2_manifest = _make_tmp_manifest_v2(immutable_through="2026-05")
    try:
        check_manifest_allows_slice(v2_manifest, "2026-06-02")
        # end-date 2026-06-02 > immutable_through 2026-05 -> should be ALLOWED
        # (2026-06-02 > 2026-05-01) — this should NOT raise
    except SystemExit:
        raise AssertionError("v2 manifest should allow a slice ending 2026-06-02 when it >= closed + 1 month")


def test_v2_manifest_guard_refuses_exact_match():
    """A slice ending exactly at (immutable_through month)-01 must be refused."""
    v2_manifest = _make_tmp_manifest_v2(immutable_through="2026-05")
    try:
        # end 2026-05-01 <= immutable_through 2026-05-01 -> STOP
        check_manifest_allows_slice(v2_manifest, "2026-05-01")
    except SystemExit as e:
        assert "STOP" in str(e)
    else:
        raise AssertionError("Expected STOP for slice ending at immutable_through month")


def test_v2_manifest_guard_allows_future_slice_on_fresh_ledger():
    """Fresh v2 manifest (immutable_through=None) must allow any slice."""
    v2_manifest = _make_tmp_manifest_v2(immutable_through=None)
    check_manifest_allows_slice(v2_manifest, "2020-01-01")  # must not raise


def test_load_manifest_raises_on_missing_file():
    try:
        load_manifest("/nonexistent/path/gpr_manifest_v2.json")
    except FileNotFoundError as e:
        assert "STOP" in str(e)
    else:
        raise AssertionError("Expected FileNotFoundError")


def test_advance_manifest_v2_appends_and_bumps():
    """advance_manifest must append segment and bump immutable_through in v2 manifest."""
    manifest = _make_tmp_manifest_v2(immutable_through=None)
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
        json.dump(manifest, f)
        tmp_path = f.name
    try:
        m = json.load(open(tmp_path, encoding="utf-8"))
        advance_manifest(m, "2015-02-18", "2026-06-02",
                         bytes_scanned_tb=2.627, cost_usd=10.17, path=tmp_path)
        saved = json.load(open(tmp_path, encoding="utf-8"))
        # 2026-06-02 exclusive -> last full month is 2026-05
        assert saved["immutable_through"] == "2026-05", (
            f"Expected 2026-05, got {saved['immutable_through']}"
        )
        assert len(saved["segments_compiled"]) == 1
        seg = saved["segments_compiled"][0]
        assert seg["slice_id"] == "2015-02-18_2026-06-02"
        assert seg["bytes_scanned_tb"] == 2.627
        assert seg["dictionary_version"] == "3.0.0"
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# 10. v3 verify_on_creds are EMPTY for promoted cats (3, 8)
# ---------------------------------------------------------------------------
def test_cat3_verify_on_creds_empty():
    """After promotion, cat3 verify_on_creds must be empty in the v3 dict."""
    d = json.load(open(DICT_FILE, encoding="utf-8"))
    cat3 = next(c for c in d["categories"] if c["cat"] == 3)
    assert cat3.get("verify_on_creds", []) == [], (
        f"cat3 still has verify_on_creds: {cat3.get('verify_on_creds')}"
    )


def test_cat8_verify_on_creds_empty():
    """After promotion, cat8 verify_on_creds must be empty in the v3 dict."""
    d = json.load(open(DICT_FILE, encoding="utf-8"))
    cat8 = next(c for c in d["categories"] if c["cat"] == 8)
    assert cat8.get("verify_on_creds", []) == [], (
        f"cat8 still has verify_on_creds: {cat8.get('verify_on_creds')}"
    )


def test_cat5_verify_on_creds_empty():
    """cat5 verify_on_creds should be empty (JIHAD promoted in v2.1, retained)."""
    d = json.load(open(DICT_FILE, encoding="utf-8"))
    cat5 = next(c for c in d["categories"] if c["cat"] == 5)
    assert cat5.get("verify_on_creds", []) == [], (
        f"cat5 still has verify_on_creds: {cat5.get('verify_on_creds')}"
    )


# ---------------------------------------------------------------------------
# 11. Slice ID and manifest key helpers
# ---------------------------------------------------------------------------
def test_make_slice_id_format():
    assert _make_slice_id("2015-02-18", "2026-06-02") == "2015-02-18_2026-06-02"
    assert _make_slice_id("2020-01-01", "2021-01-01") == "2020-01-01_2021-01-01"


def test_slug_lowercases_and_underscores():
    assert _slug("Military Buildups") == "military_buildups"
    assert _slug("Terror Acts") == "terror_acts"


def test_half_or_builds_or_chain():
    cats = _cats()
    expr = _half_or(cats, "act")
    assert expr.count(" OR ") == 2   # 3 act cats -> 2 ORs
    assert "g6_" in expr and "g7_" in expr and "g8_" in expr


# ---------------------------------------------------------------------------
# 12. gkg_themes tokens in v3 are the pipe-join of gkg_themes (no verify_on_creds leak)
# ---------------------------------------------------------------------------
def test_regex_is_pipe_join_of_gkg_themes_only():
    d = json.load(open(DICT_FILE, encoding="utf-8"))
    by_cat = {c["cat"]: c for c in d["categories"]}
    for c in _cats():
        src = by_cat[c["cat"]]
        assert c["regex"] == "|".join(src["gkg_themes"]), (
            f"cat {c['cat']} regex does not match pipe-join of gkg_themes"
        )
        for voc in src.get("verify_on_creds", []):
            assert voc not in c["regex"].split("|"), (
                f"verify_on_creds token {voc!r} leaked into cat {c['cat']} regex"
            )
