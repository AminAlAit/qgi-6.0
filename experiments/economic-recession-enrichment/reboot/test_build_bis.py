"""Tests for `build_bis.py` -- parses the two BIS bulk pulls (Basel III credit-to-GDP GAP
SDMX CSV, residential-property-price bulk CSV) and annualizes each quarterly series into the
`panel_dir` layout. Written before `build_bis.py`.

Both BIS series are QUARTERLY; the task's panel_dir layout is annual (matches every other
indicator in the repo). Annualization = mean of the available quarters within a calendar
year (no interpolation across years, no requirement that all 4 quarters be present -- a
partial-year mean is still informative and consistent with how the rest of this repo treats
"a value exists at year t" as "at least one observation exists at year t", not "a complete
year exists").
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from build_bis import (
    BIS_CREDIT_GAP_ID,
    BIS_HOUSE_PRICE_YOY_ID,
    annualize_quarterly,
    build_credit_gap,
    build_house_price_yoy,
)

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"


def test_annualize_quarterly_averages_within_year():
    df = pd.DataFrame(
        {
            "country": ["United States"] * 4 + ["Japan"] * 2,
            "time_period": ["2019-Q1", "2019-Q2", "2019-Q3", "2019-Q4", "2020-Q1", "2020-Q2"],
            "value": [1.0, 2.0, 3.0, 4.0, 10.0, 20.0],
        }
    )
    out = annualize_quarterly(df)
    assert list(out.columns) == ["country", "year", "value"]
    us_2019 = out[(out["country"] == "United States") & (out["year"] == 2019)]["value"].iloc[0]
    assert us_2019 == pytest.approx(2.5)
    jp_2020 = out[(out["country"] == "Japan") & (out["year"] == 2020)]["value"].iloc[0]
    assert jp_2020 == pytest.approx(15.0)


def test_annualize_quarterly_partial_year_still_emits_a_value():
    df = pd.DataFrame({"country": ["X"], "time_period": ["2001-Q3"], "value": [7.0]})
    out = annualize_quarterly(df)
    assert len(out) == 1
    assert out["value"].iloc[0] == pytest.approx(7.0)


def test_build_credit_gap_from_real_raw_pull():
    panel = build_credit_gap(RAW / "bis_credit_gap.csv")
    assert list(panel.columns) == ["country", "year", "value"]
    assert len(panel) > 0
    # Task spec: BIS credit-to-GDP gap ~32-44 countries.
    assert 25 <= panel["country"].nunique() <= 45
    assert not panel["value"].isna().any()


def test_build_credit_gap_filters_to_basel_iii_actual_series():
    # The raw CSV carries 3 CG_DTYPE variants (A/B/C) x TC_BORROWERS/TC_LENDERS combos --
    # the builder must select exactly the Basel III standard series (private non-financial
    # sector borrowers, all-sector lenders, dtype=A "actual" HP-filter gap), not silently
    # average across incompatible definitions.
    panel = build_credit_gap(RAW / "bis_credit_gap.csv")
    # US credit gap should be a plausible percentage-point figure, not a raw credit level
    # (raw private credit/GDP for the US is ~150-200%; a HP-filter GAP is a signed
    # single/double-digit deviation from trend).
    us = panel[(panel["country"] == "United States") & (panel["year"] == 2007)]
    assert len(us) == 1
    assert -50 < us["value"].iloc[0] < 50


def test_build_house_price_yoy_from_real_raw_pull():
    panel = build_house_price_yoy(RAW / "bis_spp_extracted" / "WS_SPP_csv_flat.csv")
    assert list(panel.columns) == ["country", "year", "value"]
    assert len(panel) > 0
    # Task spec: BIS residential property prices ~40 countries.
    assert 30 <= panel["country"].nunique() <= 45
    assert not panel["value"].isna().any()


def test_build_house_price_yoy_excludes_aggregates_and_uses_real_series():
    panel = build_house_price_yoy(RAW / "bis_spp_extracted" / "WS_SPP_csv_flat.csv")
    # "Advanced economies", "Euro area", "World", EM aggregate rows must not leak in as
    # pseudo-countries (they aren't in the crosswalk so wb_json_to_panel-style filtering
    # would drop them anyway, but this asserts the intent explicitly).
    assert "Advanced Economies" not in panel["country"].tolist()
    assert "Euro Area" not in panel["country"].tolist()
    # A YoY-%-change series should have a plausible range (not a raw index level ~100+).
    assert panel["value"].abs().median() < 50


def test_indicator_ids_are_stable_strings():
    assert BIS_CREDIT_GAP_ID == "BIS.CREDIT_GAP.PRIV_NFC"
    assert BIS_HOUSE_PRICE_YOY_ID == "BIS.SPP.REAL.YOY"
