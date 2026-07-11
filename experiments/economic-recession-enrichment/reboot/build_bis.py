"""Build the two BIS bulk-pull indicators into the `panel_dir` layout:

  * `BIS.CREDIT_GAP.PRIV_NFC` -- Basel III credit-to-GDP GAP (one-sided HP-filter deviation
    from trend), private non-financial-sector borrowers, all-sector lenders (CG_DTYPE=A,
    TC_BORROWERS=P, TC_LENDERS=A) -- the standard Basel III series, NOT the raw credit level
    (raw credit/GDP was already tested and rejected in the prior cycle for being a
    development-level proxy; the GAP is orthogonal by construction -- a detrended deviation).
  * `BIS.SPP.REAL.YOY` -- BIS Selected Residential Property Prices, REAL (inflation-adjusted),
    year-on-year % change (VALUE=R, UNIT_MEASURE=771) -- the classic pre-crisis house-price
    boom/bust leading indicator.

Both source series are QUARTERLY SDMX bulk pulls; `annualize_quarterly` collapses to annual
via mean-of-available-quarters (see test docstring for rationale). Source pulls (curl, HTTP
200, confirmed 2026-07-11):
  Credit gap:    https://stats.bis.org/api/v1/data/BIS,WS_CREDIT_GAP,1.0/all?format=csv
  House prices:  https://data.bis.org/static/bulk/WS_SPP_csv_flat.zip
Host-testable: pandas + pyarrow only.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from crosswalk import iso2_to_country_id, country_id_to_display_name

BIS_CREDIT_GAP_ID = "BIS.CREDIT_GAP.PRIV_NFC"
BIS_HOUSE_PRICE_YOY_ID = "BIS.SPP.REAL.YOY"

PANEL_COLS = ["country", "year", "value"]


def annualize_quarterly(df: pd.DataFrame) -> pd.DataFrame:
    """`df` has (`country`, `time_period`, `value`) where `time_period` is "YYYY-Qn". Returns
    (`country`, `year`, `value`) with `value` = mean of the quarters present for that
    country-year (partial years included -- see module docstring)."""
    out = df.copy()
    out["year"] = out["time_period"].str.slice(0, 4).astype("int64")
    grouped = (
        out.groupby(["country", "year"], as_index=False)["value"]
        .mean()
        .sort_values(["country", "year"])
        .reset_index(drop=True)
    )
    return grouped[PANEL_COLS]


def _iso2_rows_to_country_col(df: pd.DataFrame, iso2_col: str) -> pd.DataFrame:
    df = df.copy()
    df["_cid"] = df[iso2_col].map(iso2_to_country_id)
    df = df[df["_cid"].notna()]
    df["country"] = df["_cid"].map(country_id_to_display_name)
    return df.drop(columns=["_cid"])


def build_credit_gap(raw_csv_path: Path) -> pd.DataFrame:
    raw = pd.read_csv(raw_csv_path)
    # CG_DTYPE hand-verified against the raw pull (2026-07-11, US/2007 spot check):
    # A = credit-to-GDP RATIO level (~165-170% for US/2007 -- NOT the gap), B = the HP-filter
    # TREND, C = the GAP itself (A - B, ~10-12pp for US/2007 -- matches the literature's
    # well-known pre-GFC US credit-gap reading). We want C.
    sel = raw[
        (raw["CG_DTYPE"] == "C") & (raw["TC_BORROWERS"] == "P") & (raw["TC_LENDERS"] == "A")
    ].copy()
    sel = _iso2_rows_to_country_col(sel, "BORROWERS_CTY")
    sel = sel.rename(columns={"TIME_PERIOD": "time_period", "OBS_VALUE": "value"})
    sel = sel.dropna(subset=["value"])
    return annualize_quarterly(sel[["country", "time_period", "value"]])


def build_house_price_yoy(raw_csv_path: Path) -> pd.DataFrame:
    raw = pd.read_csv(raw_csv_path)
    value_col = "VALUE:Value"
    unit_col = "UNIT_MEASURE:Unit of measure"
    ref_area_col = "REF_AREA:Reference area"
    sel = raw[
        raw[value_col].str.startswith("R:") & raw[unit_col].str.startswith("771:")
    ].copy()
    # REF_AREA is "CC: Country Name" (e.g. "US: United States") -- take the ISO2 prefix.
    sel["iso2"] = sel[ref_area_col].str.split(":").str[0].str.strip()
    sel = _iso2_rows_to_country_col(sel, "iso2")
    sel = sel.rename(
        columns={"TIME_PERIOD:Time period or range": "time_period", "OBS_VALUE:Observation Value": "value"}
    )
    sel = sel.dropna(subset=["value"])
    return annualize_quarterly(sel[["country", "time_period", "value"]])


def write_panel(panel: pd.DataFrame, panel_dir: Path, indicator_id: str) -> Path:
    out_dir = panel_dir / indicator_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{indicator_id}.parquet"
    panel.to_parquet(out_path, index=False)
    return out_path


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw-dir", type=Path, default=here / "raw")
    ap.add_argument("--panel-dir", type=Path, default=here / "panel_dir")
    args = ap.parse_args(argv)

    credit_panel = build_credit_gap(args.raw_dir / "bis_credit_gap.csv")
    out1 = write_panel(credit_panel, args.panel_dir, BIS_CREDIT_GAP_ID)
    print(f"[build_bis] {BIS_CREDIT_GAP_ID}: {len(credit_panel)} rows, "
          f"{credit_panel['country'].nunique()} countries -> {out1}")

    hp_panel = build_house_price_yoy(args.raw_dir / "bis_spp_extracted" / "WS_SPP_csv_flat.csv")
    out2 = write_panel(hp_panel, args.panel_dir, BIS_HOUSE_PRICE_YOY_ID)
    print(f"[build_bis] {BIS_HOUSE_PRICE_YOY_ID}: {len(hp_panel)} rows, "
          f"{hp_panel['country'].nunique()} countries -> {out2}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
