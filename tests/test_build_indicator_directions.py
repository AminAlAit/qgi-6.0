"""Unit tests for build_indicator_directions.py.

Covers the regex row-parser, tag normalization, conflict resolution
(cascade wins per Lane B R2), and the emit-JSON shape. The generator
script is a one-shot data-massage tool, but it's the load-bearing
input for arms A/B of Phase 5 v0.1a so the parser correctness matters.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "build_indicator_directions.py"
_spec = importlib.util.spec_from_file_location("build_indicator_directions", _SCRIPT)
mod = importlib.util.module_from_spec(_spec)
sys.modules["build_indicator_directions"] = mod
_spec.loader.exec_module(mod)


# ===========================================================================
# Row regex: cascade-style rows (backtick-bracket tags)
# ===========================================================================

def test_row_re_cascade_vdem_style():
    """Cascade V-Dem rows: `| **VD-NN api_code** (Name, range) | **+1** | text | `[tag]` |`"""
    line = (
        "| **VD-01 v2x_polyarchy** (Electoral Democracy Index, 0-1) | **+1** | "
        "Justification text. | `[lit-only]` |"
    )
    m = mod.ROW_RE.match(line)
    assert m is not None
    catalog, api, sign, just, tag = m.groups()
    assert catalog == "VD-01"
    assert api == "v2x_polyarchy"
    assert sign == "+1"
    assert "Justification" in just
    assert "lit-only" in tag


def test_row_re_cascade_wgi_bare_style():
    """WGI rows have NO catalog code: `| **CC.EST** (Name, range) | **+1** | ... | `[tag]` |`"""
    line = "| **CC.EST** (Control of Corruption, point estimate) | **+1** | text. | `[lit-only]` |"
    m = mod.ROW_RE.match(line)
    assert m is not None
    catalog, api, sign, *_ = m.groups()
    assert catalog is None
    assert api == "CC.EST"
    assert sign == "+1"


def test_row_re_cascade_negative_one():
    """Negative signs parse correctly."""
    line = "| **GC.DOD.TOTL.GD.ZS** (Govt debt, % GDP) | **-1** | text. | `[lit-only]` |"
    m = mod.ROW_RE.match(line)
    assert m is not None
    _, api, sign, *_ = m.groups()
    assert api == "GC.DOD.TOTL.GD.ZS"
    assert sign == "-1"


def test_row_re_cascade_zero_direction():
    """direction:0 rows parse correctly."""
    line = (
        "| **VD-10 v2x_regime** (Regime Type, 0-3 categorical) | **0** | "
        "Categorical: text. | `[no lit, direction: 0]` |"
    )
    m = mod.ROW_RE.match(line)
    assert m is not None
    _, _, sign, _, tag = m.groups()
    assert sign == "0"
    assert "no lit" in tag


# ===========================================================================
# Row regex: ML-style rows (free-text tags, NO backticks)
# ===========================================================================

def test_row_re_ml_wb_coded_style():
    """ML rows with WB catalog code: `| **WB-NN API.CODE** (Name) | **+1** | text | High confidence (...). |`"""
    line = (
        "| **WB-03 SM.POP.REFG.OR** (Refugees by country of origin) | **+1** | "
        "Justification text. | High confidence (UCDP/UNHCR literature). |"
    )
    m = mod.ROW_RE.match(line)
    assert m is not None
    catalog, api, sign, just, tag = m.groups()
    assert catalog == "WB-03"
    assert api == "SM.POP.REFG.OR"
    assert sign == "+1"
    assert "High confidence" in tag


def test_row_re_ml_bare_api_code_style():
    """ML rows without catalog code: `| **API.CODE** (Name) | **-1** | text | text. |`"""
    line = (
        "| **SE.ADT.LITR.ZS** (Adult literacy rate) | **-1** | Higher literacy = stable. | "
        "High confidence; SHAP consistently negative. |"
    )
    m = mod.ROW_RE.match(line)
    assert m is not None
    catalog, api, sign, *_ = m.groups()
    assert catalog is None
    assert api == "SE.ADT.LITR.ZS"
    assert sign == "-1"


def test_row_re_skips_non_matching_lines():
    """Header/separator/explanation lines must NOT match."""
    non_matches = [
        "| Indicator | Direction | Justification (literature) | Tag |",
        "|---|---|---|---|",
        "## Sub-batch 1 - V-Dem governance + civil liberties (39 indicators)",
        "Per Lane B R1 (locked 2026-05-10): every signed indicator cites.",
    ]
    for line in non_matches:
        assert mod.ROW_RE.match(line) is None, f"unexpectedly matched: {line!r}"


# ===========================================================================
# Tag normalization
# ===========================================================================

def test_normalize_tag_backtick_bracket():
    """Cascade-style `[lit-only]` → [lit-only] (no backticks in JSON)."""
    assert mod._normalize_tag("`[lit-only]`") == "[lit-only]"
    assert mod._normalize_tag("`[no lit, direction: 0]`") == "[no lit, direction: 0]"


def test_normalize_tag_free_text_passthrough():
    """ML free-text tags pass through unchanged."""
    raw = "High confidence (UCDP/UNHCR literature; surfaces in civil_war heads)."
    assert mod._normalize_tag(raw) == raw


def test_normalize_tag_strips_trailing_pipe():
    """Tag column captured up to but not including the closing pipe."""
    assert mod._normalize_tag("`[lit-only]` |") == "[lit-only]"


# ===========================================================================
# Conflict resolution (Lane B R2: cascade wins)
# ===========================================================================

def test_merge_no_conflict_same_sign_cascade_wins_source():
    """Same api_code, same direction → emit once with cascade source."""
    cascade = [{"api_code": "X", "direction": 1, "tag": "[lit-only]",
                "justification": "c", "source": "cascade", "catalog_code": None}]
    ml = [{"api_code": "X", "direction": 1, "tag": "High conf",
           "justification": "m", "source": "ml-opus", "catalog_code": None}]
    merged, conflicts = mod.merge_with_conflict_resolution(cascade, ml)
    assert len(merged) == 1
    assert merged[0]["source"] == "cascade"
    assert len(conflicts) == 0


def test_merge_conflict_different_sign_cascade_wins():
    """Same api_code, DIFFERENT NON-ZERO directions → R2 sign_conflict;
    cascade wins."""
    cascade = [{"api_code": "X", "direction": 1, "tag": "[lit-only]",
                "justification": "c", "source": "cascade", "catalog_code": None}]
    ml = [{"api_code": "X", "direction": -1, "tag": "High conf",
           "justification": "m", "source": "ml-opus", "catalog_code": None}]
    merged, conflicts = mod.merge_with_conflict_resolution(cascade, ml)
    assert len(merged) == 1
    assert merged[0]["direction"] == 1  # cascade wins
    assert len(conflicts) == 1
    assert conflicts[0]["api_code"] == "X"
    assert conflicts[0]["resolved_to"] == 1
    assert conflicts[0]["resolved_source"] == "cascade"
    # T4 strict review fix: conflict_type discriminator
    assert conflicts[0]["conflict_type"] == "sign"
    assert "R2" in conflicts[0]["reason"]


def test_merge_conflict_cascade_zero_vs_ml_nonzero():
    """Cascade direction:0 (Majles-deferred) + ML +1 → R1 deferral_override
    (semantically distinct from R2 sign conflict per T4 strict review)."""
    cascade = [{"api_code": "v2cseeorgs", "direction": 0,
                "tag": "[no lit, direction: 0]", "justification": "deferred",
                "source": "cascade", "catalog_code": "VD-24"}]
    ml = [{"api_code": "v2cseeorgs", "direction": 1, "tag": "High conf",
           "justification": "Putnam mechanism", "source": "ml-opus",
           "catalog_code": None}]
    merged, conflicts = mod.merge_with_conflict_resolution(cascade, ml)
    assert len(merged) == 1
    assert merged[0]["direction"] == 0
    assert len(conflicts) == 1
    assert conflicts[0]["resolved_to"] == 0
    # T4: deferral, NOT sign conflict
    assert conflicts[0]["conflict_type"] == "deferral"
    assert "R1" in conflicts[0]["reason"]
    assert "Majles" in conflicts[0]["reason"]


def test_emit_json_source_drafts_uses_posix_paths():
    """T2 strict review fix: source_drafts paths use forward slashes
    (POSIX), not Windows backslashes, for cross-platform diff stability."""
    rows = [{"api_code": "X", "direction": 1, "tag": "[lit-only]",
             "justification": "j", "source": "cascade", "catalog_code": None}]
    payload = mod.emit_json(rows, conflicts=[], cascade_n=1, ml_n=0)
    assert "\\" not in payload["source_drafts"]["cascade"], (
        f"backslashes in source_drafts: {payload['source_drafts']!r}"
    )
    assert "\\" not in payload["source_drafts"]["ml"]
    # Sanity: paths should start with the qgi-docs/internal/ops prefix
    assert payload["source_drafts"]["cascade"].startswith("qgi-docs/")
    assert payload["source_drafts"]["ml"].startswith("qgi-docs/")


def test_merge_disjoint_keys_concatenates():
    """Cascade has X, ML has Y → both emitted, sorted by api_code."""
    cascade = [{"api_code": "X", "direction": 1, "tag": "[lit-only]",
                "justification": "c", "source": "cascade", "catalog_code": None}]
    ml = [{"api_code": "Y", "direction": -1, "tag": "High conf",
           "justification": "m", "source": "ml-opus", "catalog_code": None}]
    merged, conflicts = mod.merge_with_conflict_resolution(cascade, ml)
    assert len(merged) == 2
    assert [r["api_code"] for r in merged] == ["X", "Y"]
    assert len(conflicts) == 0


# ===========================================================================
# parse_draft end-to-end
# ===========================================================================

def test_parse_draft_returns_empty_on_missing_file(tmp_path):
    """Missing draft → empty list, no crash."""
    out = mod.parse_draft(tmp_path / "nope.md", source_label="test")
    assert out == []


def test_parse_draft_extracts_multiple_rows(tmp_path):
    """Multi-row markdown parses cleanly."""
    md = tmp_path / "draft.md"
    md.write_text(
        "# Header\n"
        "| **VD-01 v2x_polyarchy** (Electoral Democracy, 0-1) | **+1** | "
        "Justification 1. | `[lit-only]` |\n"
        "| **GC.DOD.TOTL.GD.ZS** (Govt debt, % GDP) | **-1** | "
        "Justification 2. | `[lit-only]` |\n"
        "| **WB-03 SM.POP.REFG.OR** (Refugees) | **+1** | Justification 3. | "
        "High confidence (UCDP). |\n",
        encoding="utf-8",
    )
    rows = mod.parse_draft(md, source_label="test")
    assert len(rows) == 3
    assert rows[0]["api_code"] == "v2x_polyarchy"
    assert rows[0]["direction"] == 1
    assert rows[1]["api_code"] == "GC.DOD.TOTL.GD.ZS"
    assert rows[1]["direction"] == -1
    assert rows[2]["api_code"] == "SM.POP.REFG.OR"
    # ML free-text tag preserved
    assert "High confidence" in rows[2]["tag"]


# ===========================================================================
# emit_json shape
# ===========================================================================

def test_emit_json_schema_matches_loader_contract():
    """Output JSON must have: schema_version, generated, directions list
    with {api_code, direction, tag, justification, source} per row.
    Matches load_direction_annotations() expected schema."""
    rows = [{"api_code": "X", "direction": 1, "tag": "[lit-only]",
             "justification": "j", "source": "cascade", "catalog_code": None}]
    payload = mod.emit_json(rows, conflicts=[], cascade_n=1, ml_n=0)
    assert payload["schema_version"] == 1
    assert "generated" in payload
    assert "directions" in payload
    assert len(payload["directions"]) == 1
    d = payload["directions"][0]
    assert d["api_code"] == "X"
    assert d["direction"] == 1
    assert d["tag"] == "[lit-only]"
    assert d["source"] == "cascade"
    # catalog_code is provenance — not in the emitted row
    assert "catalog_code" not in d


def test_emit_json_includes_conflicts_audit_trail():
    """Conflicts list surfaces in the output for audit visibility."""
    conflicts = [{"api_code": "X", "cascade_direction": 1, "ml_direction": -1,
                  "resolved_to": 1, "resolved_source": "cascade",
                  "reason": "R2 fallback"}]
    payload = mod.emit_json([], conflicts, cascade_n=0, ml_n=1)
    assert payload["conflicts"] == conflicts
    assert payload["row_counts"]["conflicts_resolved"] == 1


def test_emit_json_row_counts():
    """row_counts shows parsed-input + merged-output sizes for sanity."""
    rows = [{"api_code": f"X{i}", "direction": 1, "tag": "[lit-only]",
             "justification": "j", "source": "cascade", "catalog_code": None}
            for i in range(3)]
    payload = mod.emit_json(rows, conflicts=[], cascade_n=2, ml_n=1)
    assert payload["row_counts"]["cascade_rows_parsed"] == 2
    assert payload["row_counts"]["ml_rows_parsed"] == 1
    assert payload["row_counts"]["merged_rows"] == 3


# ===========================================================================
# Output loads cleanly via the validate_weight_matrix.py loader
# ===========================================================================

def test_generator_output_is_loadable_by_validate_weight_matrix(tmp_path):
    """End-to-end: generator output must be parsable by
    load_direction_annotations() — the consumer's loader contract."""
    # Build a fixture output via the generator
    rows = [{"api_code": "v2x_libdem", "direction": 1, "tag": "[lit-only]",
             "justification": "j", "source": "cascade", "catalog_code": None},
            {"api_code": "GC.DOD.TOTL.GD.ZS", "direction": -1, "tag": "[lit-only]",
             "justification": "j", "source": "cascade", "catalog_code": None}]
    payload = mod.emit_json(rows, conflicts=[], cascade_n=2, ml_n=0)
    out_path = tmp_path / "indicator-directions.json"
    out_path.write_text(json.dumps(payload), encoding="utf-8")

    # Load the consumer-side loader and verify it parses correctly
    _vwm_path = Path(__file__).resolve().parent.parent / "scripts" / "validate_weight_matrix.py"
    _spec = importlib.util.spec_from_file_location("vwm", _vwm_path)
    vwm = importlib.util.module_from_spec(_spec)
    sys.modules["vwm"] = vwm
    _spec.loader.exec_module(vwm)

    result = vwm.load_direction_annotations(path=out_path)
    assert result == {"v2x_libdem": 1, "GC.DOD.TOTL.GD.ZS": -1}
