"""Tests for the QGI-GPR roll-up renderer (gpr_rollup.py).

Covers the PURE surface only (no BigQuery / no creds): dictionary load, SQL
render for both phases, the dictionary-driven threats/acts split, placeholder
completeness, and the country-filter toggle. The bq subprocess path is a
verbatim port of seed_live_baseline.bq_query and is NOT exercised here.

Run:  python -m pytest test_gpr_rollup.py -v
"""
import re

from gpr_rollup import (
    load_categories, render_sql, _half_or, _slug, GPRC_FIPS_ILLUSTRATIVE,
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
