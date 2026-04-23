"""Unit tests for generate_pair_windows.py pure functions.

Covers:
  - num()                        — number parser for Athena string cells
  - _slug()                      — name-to-slug normalizer
  - resolve_country_slug()       — slug resolver with overrides + "the_" strip
  - load_country_event_years()   — file-based event-year index builder

No AWS calls. Deterministic, offline-only.

#373 script test coverage audit.
"""
from __future__ import annotations

import json
import pathlib
import sys

import pytest

SCRIPTS_DIR = pathlib.Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import generate_pair_windows as gpw  # noqa: E402


# ===========================================================================
# num()
# ===========================================================================

class TestNum:

    def test_integer_string(self):
        assert gpw.num("42") == 42

    def test_float_string(self):
        result = gpw.num("3.14")
        assert abs(result - 3.14) < 1e-9

    def test_integer_looking_float_string(self):
        """'20.0' should parse to 20 (via int path after float fallback)."""
        result = gpw.num("20.0")
        # num tries int first → ValueError, then float → 20.0
        assert result == 20.0

    def test_empty_string_returns_none(self):
        assert gpw.num("") is None

    def test_none_returns_none(self):
        assert gpw.num(None) is None

    def test_non_numeric_string_returns_none(self):
        assert gpw.num("abc") is None

    def test_negative_integer(self):
        assert gpw.num("-7") == -7

    def test_zero_string(self):
        assert gpw.num("0") == 0


# ===========================================================================
# _slug()
# ===========================================================================

class TestSlug:

    def test_basic_lowercase(self):
        assert gpw._slug("France") == "france"

    def test_spaces_become_underscores(self):
        assert gpw._slug("United States") == "united_states"

    def test_apostrophe_removed(self):
        # _slug() removes ' entirely (not as a separator), so "d'Ivoire" → "divoire"
        assert gpw._slug("Cote d'Ivoire") == "cote_divoire"

    def test_comma_removed(self):
        assert gpw._slug("Korea, South") == "korea_south"

    def test_period_removed(self):
        # _slug() removes . entirely (not as a separator), so "U.S.A." → "usa"
        assert gpw._slug("U.S.A.") == "usa"

    def test_ampersand_becomes_and(self):
        assert gpw._slug("Bosnia & Herzegovina") == "bosnia_and_herzegovina"

    def test_leading_trailing_underscores_stripped(self):
        """Non-alphanumeric chars at boundaries don't leave dangling underscores."""
        result = gpw._slug("-Libya-")
        assert not result.startswith("_")
        assert not result.endswith("_")

    def test_none_returns_none(self):
        assert gpw._slug(None) is None

    def test_empty_string_returns_none_or_empty(self):
        """Empty string after slug processing should return None or ''."""
        result = gpw._slug("")
        # After strip("_"), empty string is falsy → treated as None by callers
        assert not result  # either None or ""

    def test_multi_space_collapses(self):
        """Multiple consecutive spaces collapse to a single underscore."""
        result = gpw._slug("Democratic  Republic")
        assert "__" not in result

    def test_special_chars_stripped(self):
        """Characters outside [a-z0-9] become underscores (then deduplicated)."""
        result = gpw._slug("Côte")
        # ô is outside [a-z0-9], becomes _ then trailing strip
        assert result == "c_te"


# ===========================================================================
# resolve_country_slug()
# ===========================================================================

class TestResolveCountrySlug:

    INDEX = {
        "france": {2019, 2005},
        "turkiye": {2016, 2023},
        "democratic_republic_of_congo": {1994, 2003},
        "republic_of_congo": {1997},
        "united_states": {2001, 2020},
    }

    def test_direct_match(self):
        assert gpw.resolve_country_slug("France", self.INDEX) == "france"

    def test_slug_override_turkey_to_turkiye(self):
        """'Turkey' must resolve via _SLUG_OVERRIDES to 'turkiye'."""
        # _SLUG_OVERRIDES maps turkey → turkiye
        result = gpw.resolve_country_slug("Turkey", self.INDEX)
        assert result == "turkiye"

    def test_slug_override_drc(self):
        """'Democratic Republic of the Congo' → override → 'democratic_republic_of_congo'."""
        result = gpw.resolve_country_slug("Democratic Republic of the Congo", self.INDEX)
        assert result == "democratic_republic_of_congo"

    def test_the_prefix_strip(self):
        """Names starting with 'the_' after slugging resolve after stripping prefix."""
        # Build a minimal index with a "the_"-prefixed entry stripped
        index = {"bahamas": {1973}}
        # "The Bahamas" → slug → "the_bahamas" → strip "the_" → "bahamas"
        result = gpw.resolve_country_slug("The Bahamas", index)
        assert result == "bahamas"

    def test_no_match_returns_none(self):
        """Unknown country returns None."""
        result = gpw.resolve_country_slug("Narnia", self.INDEX)
        assert result is None

    def test_none_name_returns_none(self):
        assert gpw.resolve_country_slug(None, self.INDEX) is None

    def test_empty_name_returns_none(self):
        assert gpw.resolve_country_slug("", self.INDEX) is None

    def test_override_target_not_in_index_returns_none(self):
        """Override maps to a slug not present in the index → still returns None."""
        # turkey → turkiye, but turkiye not in this index
        index = {"france": {2019}}
        result = gpw.resolve_country_slug("Turkey", index)
        assert result is None


# ===========================================================================
# load_country_event_years()
# ===========================================================================

class TestLoadCountryEventYears:

    def test_basic_load(self, tmp_path):
        """Valid curated file produces correct year set."""
        events = [
            {"year": 1994, "title": "Genocide", "category": "civil_war_and_insurgency"},
            {"year": 2003, "title": "Peace", "category": "elections_and_voting"},
        ]
        (tmp_path / "rwanda.json").write_text(json.dumps(events), encoding="utf-8")
        index = gpw.load_country_event_years(tmp_path)
        assert "rwanda" in index
        assert 1994 in index["rwanda"]
        assert 2003 in index["rwanda"]

    def test_missing_directory_returns_empty(self, tmp_path):
        """A non-existent directory returns {} gracefully."""
        missing = tmp_path / "does_not_exist"
        result = gpw.load_country_event_years(missing)
        assert result == {}

    def test_files_starting_with_underscore_skipped(self, tmp_path):
        """_backup_*.json files must be skipped."""
        (tmp_path / "_backup_france.json").write_text(
            json.dumps([{"year": 2020, "title": "x", "category": "y"}]), encoding="utf-8"
        )
        index = gpw.load_country_event_years(tmp_path)
        assert "_backup_france" not in index

    def test_years_below_event_floor_excluded(self, tmp_path):
        """Years before EVENT_YEAR_FLOOR (1950) must be excluded."""
        events = [
            {"year": 1940, "title": "Pre-WWII", "category": "civil_war_and_insurgency"},
            {"year": 1960, "title": "Post-1950", "category": "civil_war_and_insurgency"},
        ]
        (tmp_path / "germany.json").write_text(json.dumps(events), encoding="utf-8")
        index = gpw.load_country_event_years(tmp_path)
        assert 1940 not in index.get("germany", set())
        assert 1960 in index.get("germany", set())

    def test_years_above_current_year_excluded(self, tmp_path):
        """Years > CURRENT_YEAR must be excluded."""
        future_year = gpw.CURRENT_YEAR + 10
        events = [
            {"year": future_year, "title": "Future", "category": "elections_and_voting"},
            {"year": 2020, "title": "Valid", "category": "elections_and_voting"},
        ]
        (tmp_path / "brazil.json").write_text(json.dumps(events), encoding="utf-8")
        index = gpw.load_country_event_years(tmp_path)
        assert future_year not in index.get("brazil", set())
        assert 2020 in index.get("brazil", set())

    def test_events_missing_year_field_skipped(self, tmp_path):
        """Events without a 'year' field must be silently skipped."""
        events = [
            {"title": "No year here", "category": "elections_and_voting"},
            {"year": 2015, "title": "Valid", "category": "elections_and_voting"},
        ]
        (tmp_path / "chile.json").write_text(json.dumps(events), encoding="utf-8")
        index = gpw.load_country_event_years(tmp_path)
        assert index["chile"] == {2015}

    def test_non_int_year_skipped(self, tmp_path):
        """Non-integer year values must be skipped."""
        events = [
            {"year": "unknown", "title": "Bad", "category": "elections_and_voting"},
            {"year": 2010, "title": "Valid", "category": "elections_and_voting"},
        ]
        (tmp_path / "peru.json").write_text(json.dumps(events), encoding="utf-8")
        index = gpw.load_country_event_years(tmp_path)
        assert "unknown" not in str(index.get("peru", set()))
        assert 2010 in index.get("peru", set())

    def test_invalid_json_skipped_gracefully(self, tmp_path):
        """Files with invalid JSON must not crash the loader."""
        (tmp_path / "bad.json").write_text("{not valid json", encoding="utf-8")
        (tmp_path / "good.json").write_text(
            json.dumps([{"year": 2000, "title": "ok", "category": "x"}]), encoding="utf-8"
        )
        index = gpw.load_country_event_years(tmp_path)
        assert "bad" not in index
        assert "good" in index

    def test_country_with_no_valid_years_excluded(self, tmp_path):
        """A file where all events have invalid years must not appear in the index."""
        events = [
            {"year": None, "title": "A"},
            {"year": "bad", "title": "B"},
        ]
        (tmp_path / "nowhere.json").write_text(json.dumps(events), encoding="utf-8")
        index = gpw.load_country_event_years(tmp_path)
        assert "nowhere" not in index

    def test_multiple_files_produce_independent_sets(self, tmp_path):
        """Each country file produces an independent year set."""
        (tmp_path / "france.json").write_text(
            json.dumps([{"year": 1968, "title": "May 68", "category": "x"}]), encoding="utf-8"
        )
        (tmp_path / "spain.json").write_text(
            json.dumps([{"year": 1975, "title": "Franco dies", "category": "x"}]), encoding="utf-8"
        )
        index = gpw.load_country_event_years(tmp_path)
        assert index["france"] == {1968}
        assert index["spain"] == {1975}
