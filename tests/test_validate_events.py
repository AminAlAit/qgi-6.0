"""Tests for scripts/validate_events.py (#373 test coverage audit).

validate_events.py uses module-level global lists (errors, warnings) and counters.
Each test resets them via the _reset() helper to avoid cross-test contamination.

Covers:
- valid event passes with no errors
- missing required field (year / title / description / category) → error per field
- year out of range (below 1900, above 2030) → error
- year wrong type (string) → error
- empty title → error
- title that is not a string → error
- unknown (non-string) category → error (note: validate_events does NOT check against taxonomy)
- recency-bias warning: >35% of events post-2020 → warning, no error, exit 0
- multiple errors in one file are all surfaced (not just first)
- root not a list → error
- invalid JSON → error
- title exceeds MAX_TITLE_LENGTH → warning (not error)
- fewer than MIN_EVENTS_PER_COUNTRY → warning (not error)
- sources field: non-list → error; empty list → warning
- main() integration: valid directory exits 0, invalid exits 1
"""
import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import validate_events as ve  # noqa: E402


# ─── helpers ──────────────────────────────────────────────────────────────────

def _reset():
    """Reset module-level globals between tests."""
    ve.errors.clear()
    ve.warnings.clear()
    ve.total_files = 0
    ve.total_events = 0


def _write_events(path: Path, events: list):
    path.write_text(json.dumps(events, ensure_ascii=False), encoding="utf-8")


def _valid_event(**overrides):
    base = {
        "year": 2000,
        "title": "A valid event title",
        "description": "A valid description",
        "category": "elections_and_voting",
    }
    base.update(overrides)
    return base


# ─── valid event ──────────────────────────────────────────────────────────────

def test_valid_event_no_errors(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    _write_events(f, [_valid_event() for _ in range(12)])  # 12 >= MIN_EVENTS_PER_COUNTRY
    ve.validate_file(f)
    assert ve.errors == []


# ─── missing required fields ──────────────────────────────────────────────────

@pytest.mark.parametrize("missing_field", ["year", "title", "description", "category"])
def test_missing_required_field_raises_error(tmp_path, missing_field):
    _reset()
    event = _valid_event()
    del event[missing_field]
    f = tmp_path / "country.json"
    _write_events(f, [event] * 12)
    ve.validate_file(f)
    assert any(missing_field in e for e in ve.errors), (
        f"Expected error about missing '{missing_field}' but got: {ve.errors}"
    )


# ─── year validation ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("bad_year", [1899, 2031, 0, -500])
def test_year_out_of_range(tmp_path, bad_year):
    _reset()
    f = tmp_path / "country.json"
    _write_events(f, [_valid_event(year=bad_year)] * 12)
    ve.validate_file(f)
    assert any(str(bad_year) in e for e in ve.errors), (
        f"Expected error mentioning year {bad_year} but got: {ve.errors}"
    )


def test_year_wrong_type_string(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    _write_events(f, [_valid_event(year="2000")] * 12)
    ve.validate_file(f)
    assert any("year" in e for e in ve.errors)


# ─── title validation ─────────────────────────────────────────────────────────

def test_empty_title_fails(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    _write_events(f, [_valid_event(title="")] * 12)
    ve.validate_file(f)
    assert any("title" in e for e in ve.errors)


def test_title_not_a_string_fails(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    _write_events(f, [_valid_event(title=42)] * 12)
    ve.validate_file(f)
    assert any("title" in e for e in ve.errors)


def test_title_over_max_length_is_warning_not_error(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    long_title = "A" * (ve.MAX_TITLE_LENGTH + 1)
    _write_events(f, [_valid_event(title=long_title)] * 12)
    ve.validate_file(f)
    assert ve.errors == []
    assert any("title" in w or "chars" in w for w in ve.warnings)


# ─── category validation ──────────────────────────────────────────────────────

def test_category_non_string_fails(tmp_path):
    """validate_events checks that category IS a string; non-string → error."""
    _reset()
    f = tmp_path / "country.json"
    _write_events(f, [_valid_event(category=99)] * 12)
    ve.validate_file(f)
    assert any("category" in e for e in ve.errors)


# ─── recency bias ─────────────────────────────────────────────────────────────

def test_recency_bias_warning_at_threshold(tmp_path):
    """File where >35% of events are 2020-2030 → warning, but no error."""
    _reset()
    f = tmp_path / "country.json"

    # Build: 36 recent out of 100 total = 36% > 35% threshold
    events = [_valid_event(year=2021)] * 36 + [_valid_event(year=1990)] * 64
    _write_events(f, events)
    ve.validate_file(f)

    assert ve.errors == []
    assert any("2020" in w or "recency" in w.lower() or "%" in w for w in ve.warnings), (
        f"Expected recency-bias warning but got: {ve.warnings}"
    )


def test_no_recency_warning_below_threshold(tmp_path):
    """File where exactly 35% (at boundary) events are recent → no recency warning."""
    _reset()
    f = tmp_path / "country.json"
    # Exactly 35 recent + 65 old = 35% which does NOT exceed MAX_RECENCY_RATIO (strict >)
    events = [_valid_event(year=2021)] * 35 + [_valid_event(year=1990)] * 65
    _write_events(f, events)
    ve.validate_file(f)
    recency_warnings = [w for w in ve.warnings if "2020" in w or "recency" in w.lower() or "%" in w]
    assert recency_warnings == []


# ─── multiple errors in one file ─────────────────────────────────────────────

def test_multiple_errors_all_surfaced(tmp_path):
    """Multiple invalid events → all errors collected, not just the first."""
    _reset()
    f = tmp_path / "country.json"
    events = [
        _valid_event(year=1800),         # bad year
        _valid_event(title=""),          # empty title
        _valid_event(year="not-an-int"), # bad year type
    ] * 4  # >= MIN_EVENTS_PER_COUNTRY
    _write_events(f, events)
    ve.validate_file(f)

    # There should be multiple distinct errors
    assert len(ve.errors) >= 3, f"Expected >=3 errors, got {len(ve.errors)}: {ve.errors}"


# ─── root structure ───────────────────────────────────────────────────────────

def test_root_not_a_list_is_error(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    f.write_text(json.dumps({"events": []}), encoding="utf-8")
    ve.validate_file(f)
    assert any("array" in e or "list" in e for e in ve.errors)


def test_invalid_json_is_error(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    f.write_text("{not valid json", encoding="utf-8")
    ve.validate_file(f)
    assert any("JSON" in e or "json" in e for e in ve.errors)


# ─── count warnings ──────────────────────────────────────────────────────────

def test_fewer_than_min_events_is_warning(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    _write_events(f, [_valid_event()] * (ve.MIN_EVENTS_PER_COUNTRY - 1))
    ve.validate_file(f)
    assert ve.errors == []
    assert any(str(ve.MIN_EVENTS_PER_COUNTRY) in w or "min" in w.lower() for w in ve.warnings)


# ─── sources field validation ─────────────────────────────────────────────────

def test_sources_non_list_is_error(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    event = _valid_event()
    event["sources"] = "https://example.com"  # string, not list
    _write_events(f, [event] * 12)
    ve.validate_file(f)
    assert any("sources" in e for e in ve.errors)


def test_sources_empty_list_is_warning(tmp_path):
    _reset()
    f = tmp_path / "country.json"
    event = _valid_event()
    event["sources"] = []
    _write_events(f, [event] * 12)
    ve.validate_file(f)
    assert ve.errors == []
    assert any("sources" in w for w in ve.warnings)


# ─── main() integration ───────────────────────────────────────────────────────

def test_main_exits_0_on_valid_directory(tmp_path, monkeypatch):
    _reset()
    events_dir = tmp_path / "curated"
    events_dir.mkdir()
    _write_events(events_dir / "country.json", [_valid_event() for _ in range(12)])

    monkeypatch.setattr(ve, "EVENTS_DIR", events_dir)
    # Reset globals before main resets them (main does NOT reset — it accumulates)
    ve.errors.clear()
    ve.warnings.clear()
    ve.total_files = 0
    ve.total_events = 0

    with pytest.raises(SystemExit) as exc_info:
        ve.main()
    assert exc_info.value.code == 0


def test_main_exits_1_on_invalid_events(tmp_path, monkeypatch):
    _reset()
    events_dir = tmp_path / "curated"
    events_dir.mkdir()
    _write_events(events_dir / "country.json", [_valid_event(year=1800)] * 12)

    monkeypatch.setattr(ve, "EVENTS_DIR", events_dir)
    ve.errors.clear()
    ve.warnings.clear()
    ve.total_files = 0
    ve.total_events = 0

    with pytest.raises(SystemExit) as exc_info:
        ve.main()
    assert exc_info.value.code == 1


def test_main_exits_1_when_no_json_files(tmp_path, monkeypatch):
    _reset()
    events_dir = tmp_path / "curated"
    events_dir.mkdir()
    # No JSON files

    monkeypatch.setattr(ve, "EVENTS_DIR", events_dir)
    ve.errors.clear()
    ve.warnings.clear()
    ve.total_files = 0
    ve.total_events = 0

    with pytest.raises(SystemExit) as exc_info:
        ve.main()
    assert exc_info.value.code == 1
