"""Tests for `build_wb_direct.py` -- materializes the two direct-pass-through World Bank
API indicators (GEM equity `DSTKMKTXD`, WDI Terms-of-Trade `TT.PRI.MRCH.XD.WD`) from the raw
JSON pulls in `raw/` into the `panel_dir/<indicator_id>/<indicator_id>.parquet` layout (same
convention as `credit_m2_transforms.py`'s `write_panels`). Written before `build_wb_direct.py`.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from build_wb_direct import GEM_EQUITY_ID, TOT_ID, build_indicator, write_panel

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"


@pytest.mark.parametrize(
    "indicator_id,raw_file",
    [
        (GEM_EQUITY_ID, "wb_gem_equity_all.json"),
        (TOT_ID, "wb_tot_all.json"),
    ],
)
def test_build_indicator_from_real_raw_pull(indicator_id, raw_file):
    panel = build_indicator(RAW / raw_file)
    assert list(panel.columns) == ["country", "year", "value"]
    assert len(panel) > 0
    assert panel["country"].nunique() >= 20  # sanity: real multi-country pull, not a stub
    assert not panel["value"].isna().any()


def test_write_panel_creates_panel_dir_layout(tmp_path: Path):
    df = pd.DataFrame({"country": ["United States"], "year": [2019], "value": [101.5]})
    out_dir = tmp_path / "panel_dir"
    write_panel(df, out_dir, "TEST.ID")
    out_path = out_dir / "TEST.ID" / "TEST.ID.parquet"
    assert out_path.is_file()
    round_trip = pd.read_parquet(out_path)
    assert round_trip.equals(df)


def test_gem_equity_covers_expected_country_scale():
    # Task spec: GEM equity ~30 countries 1995 -> 76 by 2019 (roster estimate; real count may
    # differ once scoped to the 106-country crosswalk -- this just checks it's in a sane
    # ballpark, not a hard equality, per the "real N not roster estimate" mandate.
    panel = build_indicator(RAW / "wb_gem_equity_all.json")
    assert 10 <= panel["country"].nunique() <= 60


def test_tot_covers_near_universal_scale():
    # Task spec: WDI ToT ~105 countries -- "the near-universal lever".
    panel = build_indicator(RAW / "wb_tot_all.json")
    assert panel["country"].nunique() >= 60
