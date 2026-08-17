"""Tests for build_oecd_rates.py — the OECD yield-curve panel builder."""
from __future__ import annotations

import pandas as pd
import pytest

import build_oecd_rates as m
from crosswalk import country_id_to_display_name


def _raw_row(ref_area, year, measure, value, freq="A", unit="PA"):
    return {
        "DATAFLOW": "OECD.SDD.STES:DSD_STES@DF_FINMARK(4.0)",
        "REF_AREA": ref_area, "FREQ": freq, "MEASURE": measure, "UNIT_MEASURE": unit,
        "ACTIVITY": "_Z", "ADJUSTMENT": "_Z", "TRANSFORMATION": "_Z", "TIME_HORIZ": "_Z",
        "METHODOLOGY": "N", "TIME_PERIOD": year, "OBS_VALUE": value, "OBS_STATUS": "A",
        "UNIT_MULT": 0, "DECIMALS": 2, "BASE_PER": "",
    }


@pytest.fixture
def raw_csv(tmp_path):
    rows = [
        # USA 2000: long 6.0, short 6.5 -> spread -0.5 (inverted)
        _raw_row("USA", 2000, "IRLT", 6.0), _raw_row("USA", 2000, "IR3TIB", 6.5),
        # USA 2001: long 5.0, short 3.5 -> spread +1.5
        _raw_row("USA", 2001, "IRLT", 5.0), _raw_row("USA", 2001, "IR3TIB", 3.5),
        # JPN 2000: only long leg -> term_spread must be NaN (dropped), IRLT kept
        _raw_row("JPN", 2000, "IRLT", 1.7),
        # EA20 aggregate: must be dropped by crosswalk (not a roster country)
        _raw_row("EA20", 2000, "IRLT", 5.5), _raw_row("EA20", 2000, "IR3TIB", 4.5),
        # a monthly row that must be ignored (FREQ=M)
        _raw_row("USA", 2002, "IRLT", 9.9, freq="M"),
        _raw_row("USA", 2002, "IR3TIB", 1.0, freq="M"),
        # a non-PA unit that must be ignored
        _raw_row("USA", 2003, "IRLT", 8.8, unit="IX"),
    ]
    p = tmp_path / "rates.csv"
    pd.DataFrame(rows).to_csv(p, index=False)
    return p


def test_term_spread_is_long_minus_short(raw_csv):
    panels = m.build_panels(raw_csv)
    ts = panels[m.TERM_SPREAD_ID]
    usa = country_id_to_display_name("united_states")
    got = dict(zip(zip(ts["country"], ts["year"]), ts["value"]))
    assert got[(usa, 2000)] == pytest.approx(-0.5)
    assert got[(usa, 2001)] == pytest.approx(1.5)


def test_term_spread_requires_both_legs(raw_csv):
    """JPN 2000 has only the long leg -> no term_spread row, but IRLT level is kept."""
    panels = m.build_panels(raw_csv)
    jpn = country_id_to_display_name("japan")
    ts = panels[m.TERM_SPREAD_ID]
    assert ((ts["country"] == jpn) & (ts["year"] == 2000)).sum() == 0
    irlt = panels[m.IRLT_ID]
    assert ((irlt["country"] == jpn) & (irlt["year"] == 2000)).sum() == 1


def test_ea20_aggregate_dropped(raw_csv):
    panels = m.build_panels(raw_csv)
    for pid in (m.TERM_SPREAD_ID, m.IRLT_ID, m.IR3TIB_ID):
        # EA20 maps to no roster country -> must be entirely absent
        assert not panels[pid]["country"].str.contains("EA20", case=False).any()


def test_monthly_and_nonpa_rows_ignored(raw_csv):
    """FREQ=M and UNIT_MEASURE!=PA rows must never enter the annual panel."""
    panels = m.build_panels(raw_csv)
    usa = country_id_to_display_name("united_states")
    irlt = panels[m.IRLT_ID]
    usa_years = set(irlt.loc[irlt["country"] == usa, "year"])
    assert 2002 not in usa_years  # monthly
    assert 2003 not in usa_years  # non-PA


def test_panels_have_canonical_columns(raw_csv):
    panels = m.build_panels(raw_csv)
    for pid, panel in panels.items():
        assert list(panel.columns) == m.PANEL_COLS
        assert panel["value"].notna().all()
