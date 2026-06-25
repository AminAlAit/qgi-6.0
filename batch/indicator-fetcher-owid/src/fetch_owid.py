"""OWID GitHub-raw CSV fetcher (enrichment stage 2).

One Fargate task handles OW-xx indicators sourced from OWID's publicly hosted
GitHub CSV files (raw.githubusercontent.com/owid/..., CC BY 4.0, no auth).

The dispatcher sends INDICATORS_JSON with the relevant specs; the base harness
iterates them.  Each indicator downloads its own small CSV (they are different
repos / files) so there is no bulk-cache pattern here — each CSV is fetched
independently.

Country-code column in OWID CSVs is typically 'Code' (ISO alpha-3); rows where
Code is empty or starts with 'OWID_' are continental/regional aggregates and
are dropped.

INDICATORS WIRED:
    OW-01  Polity V score (-10 to 10)
           Source: Center for Systemic Peace, Polity 5 dataset via OWID.
           URL:    https://ourworldindata.org/grapher/democracy-index-polity.csv
                   ?v=1&csvType=full&useColumnShortNames=false
           Columns: Entity (name), Code (ISO-3), Year, Democracy (polity score)
           NOTE: Data series is static after 2018 — Polity5 ceased updates.
                 Any year after 2018 will be absent from the source; this is
                 NOT a bug.  The recipe fleet uses the full 1800-2018 history.

    OW-04  CO2 emissions annual growth rate (%, excl. land-use change)
           Source: Global Carbon Project (2025) via OWID.
           URL:    https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv
           Columns: country (name), iso_code (ISO-3), year, co2_growth_prct
           NOTE: WB already carries the CO2 LEVEL (EN.ATM.CO2E.KT).  This is the
                 YoY percentage GROWTH RATE.  If co2_growth_prct is present in the
                 source (Global Carbon Budget publishes it directly), we use it as-is.
                 If for any reason it is missing, the pure parse function computes it
                 from the 'co2' (level) column as a fallback — see FALLBACK note in
                 parse_owid_records.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

# Shared base is COPYed next to this script in the image (see Dockerfile).
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, "/app")
import qgi_fetcher_base as base  # noqa: E402

# ---------------------------------------------------------------------------
# Configuration — one entry per OW-xx indicator
# ---------------------------------------------------------------------------

# Each spec carries:
#   url        : raw CSV URL (GitHub or OWID grapher)
#   code_col   : ISO-3 column name in that CSV
#   name_col   : country-name column (used for logging only; not mapped from here)
#   year_col   : year column name
#   value_col  : column to extract as the indicator value
#   agg        : aggregation method for annual roll-up ("mean" or "sum");
#                both OWID sources here are already annual so this is a safety
#                dedup for the parse function.
#   fallback_level_col : (optional) if value_col is NaN compute YoY % change
#                        from this column instead.

SPECS: dict[str, dict] = {
    "OW-01": {
        "url": (
            "https://ourworldindata.org/grapher/democracy-index-polity.csv"
            "?v=1&csvType=full&useColumnShortNames=false"
        ),
        "code_col": "Code",
        "name_col": "Entity",
        "year_col": "Year",
        "value_col": "Democracy",
        "agg": "mean",
        # NOTE: static after 2018 — Polity5 project discontinued.
    },
    "OW-04": {
        "url": "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv",
        "code_col": "iso_code",
        "name_col": "country",
        "year_col": "year",
        "value_col": "co2_growth_prct",
        "agg": "mean",
        "fallback_level_col": "co2",  # if co2_growth_prct absent, derive from level
    },
}


# ---------------------------------------------------------------------------
# Pure transform (unit-tested, no network / no AWS)
# ---------------------------------------------------------------------------

def parse_owid_records(
    raw_df: pd.DataFrame,
    value_col: str,
    iso3_map: dict[str, str],
    *,
    code_col: str = "Code",
    year_col: str = "Year",
    agg: str = "mean",
    fallback_level_col: str | None = None,
) -> pd.DataFrame:
    """PURE: OWID raw DataFrame -> DataFrame[country, year, value].

    Parameters
    ----------
    raw_df            : the raw CSV loaded into a DataFrame (all columns present).
    value_col         : name of the column to use as the indicator value.
    iso3_map          : {ISO3_UPPER: canonical name_1} from the shared base.
    code_col          : name of the ISO-3 column in raw_df (default 'Code').
    year_col          : name of the year column in raw_df (default 'Year').
    agg               : 'mean' or 'sum' for the per-(country,year) roll-up.
    fallback_level_col: if value_col is entirely missing or all-NaN AND this is
                        set, compute annual YoY % change from this column instead.
                        Used for OW-04 as a safety net.

    Returns
    -------
    DataFrame[country, year, value]
        - country  : canonical name_1 string
        - year     : int
        - value    : float
    Rows whose ISO-3 code is empty or starts with 'OWID_' (aggregates/continents)
    are dropped before mapping.  Rows that don't resolve to a canonical name are
    also dropped.
    """
    df = raw_df.copy()

    # --- 1. drop aggregate / continent rows --------------------------------
    code_series = df[code_col].astype(str).str.strip()
    mask_keep = (
        code_series.ne("")
        & code_series.ne("nan")
        & ~code_series.str.startswith("OWID_")
    )
    df = df[mask_keep].copy()
    if df.empty:
        return pd.DataFrame(columns=["country", "year", "value"])

    # --- 2. resolve ISO-3 -> canonical name --------------------------------
    df["_iso"] = df[code_col].astype(str).str.strip().str.upper()
    df["_country"] = df["_iso"].map(iso3_map)
    df = df.dropna(subset=["_country"])
    if df.empty:
        return pd.DataFrame(columns=["country", "year", "value"])

    # --- 3. resolve value column (with fallback to YoY % growth) ----------
    if value_col not in df.columns or df[value_col].isna().all():
        if fallback_level_col and fallback_level_col in df.columns:
            base.logger.warning(
                f"parse_owid_records: '{value_col}' missing/all-NaN; "
                f"computing YoY % change from '{fallback_level_col}'"
            )
            df = df.sort_values(["_country", year_col])
            df["_level"] = pd.to_numeric(df[fallback_level_col], errors="coerce")
            df[value_col] = (
                df.groupby("_country")["_level"]
                .pct_change() * 100.0
            )
        else:
            base.logger.warning(
                f"parse_owid_records: '{value_col}' not found and no fallback"
            )
            return pd.DataFrame(columns=["country", "year", "value"])

    # --- 4. coerce year + value, drop NaNs ---------------------------------
    df["_year"] = pd.to_numeric(df[year_col], errors="coerce")
    df["_value"] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=["_year", "_value"])
    df["_year"] = df["_year"].astype(int)

    # --- 5. aggregate per (country, year) ----------------------------------
    grp = df.groupby(["_country", "_year"], as_index=False)["_value"]
    result = grp.mean() if agg == "mean" else grp.sum()
    result = result.rename(columns={"_country": "country", "_year": "year", "_value": "value"})
    return result[["country", "year", "value"]].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Network I/O (lazy import of requests)
# ---------------------------------------------------------------------------

def _fetch_csv(url: str) -> pd.DataFrame:
    """Download a CSV from a URL and return as a DataFrame. Lazy-imports requests."""
    import requests  # lazy — keeps the module importable without requests installed

    base.logger.info(f"OWID: downloading {url}")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    import io
    df = pd.read_csv(io.StringIO(resp.text))
    base.logger.info(f"OWID: {len(df)} rows x {len(df.columns)} cols")
    return df


# ---------------------------------------------------------------------------
# fetch_one (called by the harness for each spec)
# ---------------------------------------------------------------------------

def fetch_one(spec: dict) -> pd.DataFrame | None:
    iid = spec["id_string"]
    if iid not in SPECS:
        raise ValueError(f"unknown OWID indicator {iid!r}")

    cfg = SPECS[iid]
    iso3_map = base.load_iso3_country_map()
    raw_df = _fetch_csv(cfg["url"])

    df = parse_owid_records(
        raw_df=raw_df,
        value_col=cfg["value_col"],
        iso3_map=iso3_map,
        code_col=cfg["code_col"],
        year_col=cfg["year_col"],
        agg=cfg["agg"],
        fallback_level_col=cfg.get("fallback_level_col"),
    )
    if df.empty:
        base.logger.warning(f"{iid}: no rows parsed from OWID source")
        return None
    return df


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    base.run_fetcher("OWID", fetch_one)
