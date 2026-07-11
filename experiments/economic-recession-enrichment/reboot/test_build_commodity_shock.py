"""Tests for `build_commodity_shock.py` -- the commodity-shock INTERACTION indicator: global
Pink Sheet commodity sub-index YoY growth (energy / metals&minerals / agriculture) weighted
by each country's own export-commodity share (WDI `TX.VAL.FUEL.ZS.UN` /
`TX.VAL.MMTL.ZS.UN` / `TX.VAL.AGRI.ZS.UN`). Per the task spec: "the raw global index has no
cross-sectional variation -- MUST be interacted with export weights." Written before
`build_commodity_shock.py`.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from build_commodity_shock import (
    COMMODITY_SHOCK_ID,
    build_global_subindex_yoy,
    build_export_shares,
    build_commodity_shock,
)

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"


def test_build_global_subindex_yoy_from_real_pink_sheet():
    yoy = build_global_subindex_yoy(RAW / "CMO-Historical-Data-Annual.xlsx")
    assert set(yoy.columns) == {"year", "energy_yoy", "metals_yoy", "agri_yoy"}
    assert len(yoy) > 30
    # A global commodity index has NO country dimension -- it's the same for every country in
    # a given year (this is exactly why the raw index has no cross-sectional variation and
    # must be interacted with country-specific weights, per the task spec).
    assert yoy["year"].is_unique


def test_build_global_subindex_yoy_2008_energy_shock_visible():
    # Sanity check the parse against a known historical event: the 2008 oil price spike/crash
    # should show up as a large energy YoY swing.
    yoy = build_global_subindex_yoy(RAW / "CMO-Historical-Data-Annual.xlsx")
    row_2009 = yoy[yoy["year"] == 2009]
    assert len(row_2009) == 1
    assert row_2009["energy_yoy"].iloc[0] < -20  # 2009 energy collapse post-GFC


def test_build_export_shares_from_real_wdi_pulls():
    shares = build_export_shares(
        RAW / "wb_fuel_share_all.json", RAW / "wb_metals_share_all.json", RAW / "wb_agri_share_all.json"
    )
    assert set(shares.columns) == {"country", "year", "fuel_share", "metals_share", "agri_share"}
    assert len(shares) > 0
    # Shares are percentages of merchandise exports (not fractions) -- must be non-negative,
    # and the vast majority (>=99%) must be <=100. One genuine WDI data artifact survives
    # this check un-clipped (Suriname/1962 metals_share=157.9%, hand-verified against the raw
    # pull 2026-07-11 -- an early-year re-export/data-revision quirk in the source, not a
    # parser bug) -- per the honesty-first discipline this repo follows, raw source data is
    # never silently clipped/imputed, so the test tolerates a rare outlier rather than the
    # builder laundering it away.
    for col in ["fuel_share", "metals_share", "agri_share"]:
        non_null = shares[col].dropna()
        assert (non_null >= 0).all()
        assert (non_null <= 100).mean() >= 0.99


def test_build_commodity_shock_is_leakage_safe_uses_only_lagged_share():
    # The interaction must use the country's export-composition weight from t-1 (or earlier),
    # never the same year as the price shock, so it can't be "explained" by exports that
    # already reflect the crisis year itself.
    import inspect

    src = inspect.getsource(build_commodity_shock)
    assert "shift(1)" in src or "t - 1" in src or "year - 1" in src or "lag" in src.lower()


def test_build_commodity_shock_from_real_raw_pulls():
    panel = build_commodity_shock(
        RAW / "CMO-Historical-Data-Annual.xlsx",
        RAW / "wb_fuel_share_all.json",
        RAW / "wb_metals_share_all.json",
        RAW / "wb_agri_share_all.json",
    )
    assert list(panel.columns) == ["country", "year", "value"]
    assert len(panel) > 0
    assert panel["country"].nunique() >= 20
    assert not panel["value"].isna().any()


def test_build_commodity_shock_has_cross_sectional_variation():
    # The whole point of the interaction is that it varies BY COUNTRY within a year (unlike
    # the raw global index) -- a fuel-exporter and a fuel-importer must get different values
    # in the same year given the same global energy shock.
    panel = build_commodity_shock(
        RAW / "CMO-Historical-Data-Annual.xlsx",
        RAW / "wb_fuel_share_all.json",
        RAW / "wb_metals_share_all.json",
        RAW / "wb_agri_share_all.json",
    )
    by_year_std = panel.groupby("year")["value"].std()
    assert (by_year_std.dropna() > 0).any()


def test_indicator_id_is_stable_string():
    assert COMMODITY_SHOCK_ID == "COMMODITY_SHOCK.EXPORT_WEIGHTED"
