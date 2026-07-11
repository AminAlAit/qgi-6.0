"""Tests for `wb_json_utils.wb_json_to_panel` -- the shared World-Bank-API-JSON -> canonical
(`country`, `year`, `value`) panel parser reused by every WB-sourced build_*.py script in this
reboot (GEM equity, WDI ToT, WDI export-commodity shares). Written before `wb_json_utils.py`.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from wb_json_utils import wb_json_to_panel

FIXTURE = [
    {"page": 1, "pages": 1, "per_page": 100, "total": 4},
    [
        {"countryiso3code": "USA", "date": "2019", "value": 101.5},
        {"countryiso3code": "USA", "date": "2018", "value": None},
        {"countryiso3code": "KOR", "date": "2019", "value": 87.2},
        # Aggregate/region rows (no matching crosswalk entry) must be dropped silently.
        {"countryiso3code": "AFE", "date": "2019", "value": 55.0},
    ],
]


def test_wb_json_to_panel_basic_shape(tmp_path: Path):
    p = tmp_path / "wb_test.json"
    p.write_text(json.dumps(FIXTURE), encoding="utf-8")
    panel = wb_json_to_panel(p)
    assert list(panel.columns) == ["country", "year", "value"]
    assert panel["year"].dtype == "int64"
    assert panel["value"].dtype == "float64"


def test_wb_json_to_panel_drops_null_values(tmp_path: Path):
    p = tmp_path / "wb_test.json"
    p.write_text(json.dumps(FIXTURE), encoding="utf-8")
    panel = wb_json_to_panel(p)
    # The USA/2018/None row must not appear.
    assert not ((panel["country"] == "United States") & (panel["year"] == 2018)).any()


def test_wb_json_to_panel_drops_rows_outside_crosswalk(tmp_path: Path):
    p = tmp_path / "wb_test.json"
    p.write_text(json.dumps(FIXTURE), encoding="utf-8")
    panel = wb_json_to_panel(p)
    # AFE (a WB region aggregate, not in the 106-country crosswalk) must be dropped.
    assert "Africa Eastern and Southern" not in panel["country"].tolist()
    assert len(panel) == 2  # USA/2019 + KOR/2019 survive


def test_wb_json_to_panel_maps_iso3_to_crosswalk_display_name(tmp_path: Path):
    p = tmp_path / "wb_test.json"
    p.write_text(json.dumps(FIXTURE), encoding="utf-8")
    panel = wb_json_to_panel(p)
    row = panel[(panel["country"] == "South Korea") & (panel["year"] == 2019)]
    assert len(row) == 1
    assert row["value"].iloc[0] == pytest.approx(87.2)


def test_wb_json_to_panel_empty_total_returns_empty_frame(tmp_path: Path):
    p = tmp_path / "wb_empty.json"
    p.write_text(json.dumps([{"page": 1, "pages": 1, "per_page": 100, "total": 0}, None]), encoding="utf-8")
    panel = wb_json_to_panel(p)
    assert panel.empty
    assert list(panel.columns) == ["country", "year", "value"]


def test_wb_json_to_panel_falls_back_to_country_id_when_iso3code_blank(tmp_path: Path):
    # The GEM (Global Economic Monitor, sourceid=15) API leaves `countryiso3code` BLANK on
    # every record and puts the ISO3 code in `country.id` instead (confirmed on the real
    # DSTKMKTXD pull, 2026-07-11) -- the parser must fall back to `country.id` when
    # `countryiso3code` is empty, rather than silently dropping the whole source.
    fixture = [
        {"page": 1, "pages": 1, "per_page": 100, "total": 1},
        [{"country": {"id": "USA", "value": "United States"}, "countryiso3code": "",
          "date": "2019", "value": 101.5}],
    ]
    p = tmp_path / "wb_gem_fixture.json"
    p.write_text(json.dumps(fixture), encoding="utf-8")
    panel = wb_json_to_panel(p)
    assert len(panel) == 1
    assert panel["country"].iloc[0] == "United States"


def test_wb_json_to_panel_no_duplicate_country_year_rows(tmp_path: Path):
    # WB sometimes returns duplicate rows across paginated pulls; the parser must not emit
    # dupes for a single-page fixture, and downstream screens assume (country, year) unique.
    p = tmp_path / "wb_test.json"
    p.write_text(json.dumps(FIXTURE), encoding="utf-8")
    panel = wb_json_to_panel(p)
    assert not panel.duplicated(subset=["country", "year"]).any()
