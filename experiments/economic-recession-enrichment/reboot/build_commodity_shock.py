"""Build the commodity-shock INTERACTION indicator: `COMMODITY_SHOCK.EXPORT_WEIGHTED`.

Per the task spec: the World Bank Pink Sheet's global commodity price index has NO
cross-sectional variation (it's one number per year, same for every country) -- it must be
interacted with each country's export-commodity composition to produce a country-varying
signal. This module builds:

  1. `build_global_subindex_yoy` -- YoY % growth of three Pink Sheet REAL sub-indices
     (Energy, Metals & Minerals, Agriculture) from `CMO-Historical-Data-Annual.xlsx`'s
     "Annual Indices (Real)" sheet (real 2010=100, 1960-present). One row per year, no
     country dimension.
  2. `build_export_shares` -- each country's export-commodity composition (% of merchandise
     exports) from three WDI series: `TX.VAL.FUEL.ZS.UN` (fuel), `TX.VAL.MMTL.ZS.UN`
     (ores & metals), `TX.VAL.AGRI.ZS.UN` (agricultural raw materials).
  3. `build_commodity_shock` -- the interaction itself:
       value[c, t] = (fuel_share[c, t-1] / 100)  * energy_yoy[t]
                   + (metals_share[c, t-1] / 100) * metals_yoy[t]
                   + (agri_share[c, t-1] / 100)   * agri_yoy[t]
     Uses the export share from t-1 (LAGGED one year, `shift`/`year - 1` in the merge --
     leakage-safe: the weighting reflects the country's PRE-EXISTING export structure, not
     the crisis year's own trade collapse) interacted with the CONTEMPORANEOUS global price
     shock (which is exogenous to any single country by construction -- it's a global
     index). A row is emitted only where at least one of the three share/price pairs is
     available (missing sub-shares default to 0 contribution, matching "this country simply
     doesn't export that commodity class").

Source pulls (curl, HTTP 200, confirmed 2026-07-11):
  Pink Sheet: https://thedocs.worldbank.org/en/doc/.../CMO-Historical-Data-Annual.xlsx
  WDI shares: https://api.worldbank.org/v2/country/all/indicator/TX.VAL.{FUEL,MMTL,AGRI}.ZS.UN
Host-testable: pandas + pyarrow + openpyxl only.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from wb_json_utils import wb_json_to_panel

COMMODITY_SHOCK_ID = "COMMODITY_SHOCK.EXPORT_WEIGHTED"

# Column offsets in the "Annual Indices (Real)" sheet's 2-row merged header (hand-verified
# against the real raw pull, 2026-07-11): col 0 = Year, col 2 = Energy, col 4 = Agriculture,
# col 14 = Metals & Minerals.
_YEAR_COL = 0
_ENERGY_COL = 2
_AGRI_COL = 4
_METALS_COL = 14
_DATA_START_ROW = 9  # first row of actual year/value data (rows 0-8 are title/header)


def build_global_subindex_yoy(xlsx_path: Path) -> pd.DataFrame:
    raw = pd.read_excel(xlsx_path, sheet_name="Annual Indices (Real)", header=None)
    data = raw.iloc[_DATA_START_ROW:, [_YEAR_COL, _ENERGY_COL, _AGRI_COL, _METALS_COL]].copy()
    data.columns = ["year", "energy", "agri", "metals"]
    data = data.dropna(subset=["year"])
    data["year"] = data["year"].astype("int64")
    data = data.sort_values("year").reset_index(drop=True)
    for col in ["energy", "agri", "metals"]:
        data[col] = data[col].astype("float64")
        data[f"{col}_yoy"] = data[col].pct_change() * 100.0
    return data[["year", "energy_yoy", "metals_yoy", "agri_yoy"]]


def build_export_shares(fuel_json: Path, metals_json: Path, agri_json: Path) -> pd.DataFrame:
    fuel = wb_json_to_panel(fuel_json).rename(columns={"value": "fuel_share"})
    metals = wb_json_to_panel(metals_json).rename(columns={"value": "metals_share"})
    agri = wb_json_to_panel(agri_json).rename(columns={"value": "agri_share"})
    merged = fuel.merge(metals, on=["country", "year"], how="outer").merge(
        agri, on=["country", "year"], how="outer"
    )
    return merged.sort_values(["country", "year"]).reset_index(drop=True)


def build_commodity_shock(
    xlsx_path: Path, fuel_json: Path, metals_json: Path, agri_json: Path
) -> pd.DataFrame:
    global_yoy = build_global_subindex_yoy(xlsx_path)
    shares = build_export_shares(fuel_json, metals_json, agri_json)

    # Lag the export-composition weight by one year: a share observed at year Y becomes the
    # weight applied to the price shock at year Y+1 (leakage-safe -- see module docstring).
    lagged = shares.copy()
    lagged["year"] = lagged["year"] + 1
    lagged = lagged.rename(
        columns={"fuel_share": "fuel_share_t1", "metals_share": "metals_share_t1", "agri_share": "agri_share_t1"}
    )

    merged = lagged.merge(global_yoy, on="year", how="inner")
    # A country contributes 0 from any sub-commodity class it has no export-share data for
    # (genuinely doesn't export it, or the WDI series doesn't cover it) -- NOT dropped
    # entirely, since the other two classes may still carry signal.
    for share_col, yoy_col in [
        ("fuel_share_t1", "energy_yoy"),
        ("metals_share_t1", "metals_yoy"),
        ("agri_share_t1", "agri_yoy"),
    ]:
        merged[f"_contrib_{share_col}"] = (merged[share_col].fillna(0.0) / 100.0) * merged[yoy_col]

    # A row requires at least one real (non-imputed-zero) share observation, else it's a
    # meaningless 0.0 from an entirely-missing country-year, not a genuine "no exposure".
    has_any_share = merged[["fuel_share_t1", "metals_share_t1", "agri_share_t1"]].notna().any(axis=1)
    merged = merged[has_any_share].copy()

    merged["value"] = (
        merged["_contrib_fuel_share_t1"] + merged["_contrib_metals_share_t1"] + merged["_contrib_agri_share_t1"]
    )
    out = merged[["country", "year", "value"]].dropna(subset=["value"])
    return out.sort_values(["country", "year"]).reset_index(drop=True)


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

    panel = build_commodity_shock(
        args.raw_dir / "CMO-Historical-Data-Annual.xlsx",
        args.raw_dir / "wb_fuel_share_all.json",
        args.raw_dir / "wb_metals_share_all.json",
        args.raw_dir / "wb_agri_share_all.json",
    )
    out_path = write_panel(panel, args.panel_dir, COMMODITY_SHOCK_ID)
    print(f"[build_commodity_shock] {COMMODITY_SHOCK_ID}: {len(panel)} rows, "
          f"{panel['country'].nunique()} countries -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
