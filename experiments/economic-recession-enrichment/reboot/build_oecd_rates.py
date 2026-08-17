"""Build the OECD SDMX interest-rate indicators into the `panel_dir` layout — the
YIELD-CURVE candidate the prior reboot cycle could NOT source (OECD `sdmx.oecd.org` was
Cloudflare-JS-walled to every headless client; pulled 2026-07-11 via a real browser that
solved the challenge, then bulk-fetched same-origin from the cleared page — see
`raw/oecd_finmark_rates.csv`, 3383 obs, 47 REF_AREAs, 1950-2025).

Source dataflow: `OECD.SDD.STES,DSD_STES@DF_FINMARK` (Financial market), annual (FREQ=A),
UNIT_MEASURE=PA (percent per annum). Measures used:
  * IRLT   — Long-term interest rates (10-yr government bond yields)
  * IR3TIB — Short-term interest rates (3-month interbank)

Three panels are written:
  * `OECD.TERM_SPREAD`  — IRLT - IR3TIB, the classic yield-curve slope (inversion => recession
                          risk). THE headline candidate. Requires BOTH legs in a country-year
                          (intersection coverage — reported honestly by the screen).
  * `OECD.IRLT`         — long-rate level (secondary; carries the level, not the slope).
  * `OECD.IR3TIB`       — short-rate level (secondary; monetary-tightening proxy).

`country` is re-derived from `crosswalk.iso3_to_country_id` + `country_id_to_display_name`
(the SAME convention every `build_*.py` in this dir uses) so all panels + the coverage screen
join on ONE country key, independent of OECD's own REF_AREA naming. EA20 (Euro-area
aggregate) and any REF_AREA absent from the 106-country roster are dropped by the crosswalk.

Host-testable: pandas + pyarrow only.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from crosswalk import iso3_to_country_id, country_id_to_display_name

TERM_SPREAD_ID = "OECD.TERM_SPREAD"
IRLT_ID = "OECD.IRLT"
IR3TIB_ID = "OECD.IR3TIB"

PANEL_COLS = ["country", "year", "value"]


def _load_annual_rates(raw_csv_path: Path) -> pd.DataFrame:
    """Return a tidy (`iso3`, `year`, `IRLT`, `IR3TIB`) wide frame from the raw SDMX CSV.

    Filters to FREQ=A + UNIT_MEASURE=PA (percent per annum) so we never mix the annual level
    with any monthly/index rows, then pivots MEASURE to columns. A country-year keeps whichever
    legs are present; TERM_SPREAD (built downstream) is non-null only where BOTH legs exist."""
    raw = pd.read_csv(raw_csv_path)
    sel = raw[
        (raw["FREQ"] == "A")
        & (raw["UNIT_MEASURE"] == "PA")
        & (raw["MEASURE"].isin(["IRLT", "IR3TIB"]))
    ].copy()
    sel = sel.dropna(subset=["OBS_VALUE"])
    sel["year"] = sel["TIME_PERIOD"].astype(int)
    wide = (
        sel.pivot_table(
            index=["REF_AREA", "year"], columns="MEASURE", values="OBS_VALUE", aggfunc="mean"
        )
        .reset_index()
        .rename(columns={"REF_AREA": "iso3"})
    )
    for col in ("IRLT", "IR3TIB"):
        if col not in wide.columns:
            wide[col] = pd.NA
    return wide[["iso3", "year", "IRLT", "IR3TIB"]]


def _iso3_to_country_col(df: pd.DataFrame) -> pd.DataFrame:
    """Map iso3 -> roster country_id -> display name; drop unmapped (EA20, non-roster)."""
    df = df.copy()
    df["_cid"] = df["iso3"].map(iso3_to_country_id)
    df = df[df["_cid"].notna()].copy()
    df["country"] = df["_cid"].map(country_id_to_display_name)
    return df.drop(columns=["_cid", "iso3"])


def build_panels(raw_csv_path: Path) -> dict[str, pd.DataFrame]:
    wide = _iso3_to_country_col(_load_annual_rates(raw_csv_path))
    wide["term_spread"] = wide["IRLT"] - wide["IR3TIB"]

    def _panel(value_col: str) -> pd.DataFrame:
        out = wide[["country", "year", value_col]].rename(columns={value_col: "value"})
        out = out.dropna(subset=["value"])
        return (
            out.groupby(["country", "year"], as_index=False)["value"].mean()
            .sort_values(["country", "year"])
            .reset_index(drop=True)[PANEL_COLS]
        )

    return {
        TERM_SPREAD_ID: _panel("term_spread"),
        IRLT_ID: _panel("IRLT"),
        IR3TIB_ID: _panel("IR3TIB"),
    }


def write_panel(panel: pd.DataFrame, panel_dir: Path, indicator_id: str) -> Path:
    out_dir = panel_dir / indicator_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{indicator_id}.parquet"
    panel.to_parquet(out_path, index=False)
    return out_path


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw-csv", type=Path, default=here / "raw" / "oecd_finmark_rates.csv")
    ap.add_argument("--panel-dir", type=Path, default=here / "panel_dir")
    args = ap.parse_args(argv)

    panels = build_panels(args.raw_csv)
    for indicator_id, panel in panels.items():
        out = write_panel(panel, args.panel_dir, indicator_id)
        print(
            f"[build_oecd_rates] {indicator_id}: {len(panel)} rows, "
            f"{panel['country'].nunique()} countries, "
            f"{int(panel['year'].min())}-{int(panel['year'].max())} -> {out}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
