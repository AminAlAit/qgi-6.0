"""UNDP HDR bulk-CSV fetcher (enrichment stage 2).

One Fargate task handles all 7 UD-xx indicators from a single bulk CSV download.
The dispatcher sends INDICATORS_JSON with all 7 specs; the base harness iterates
them after a single jitter.  The CSV is fetched ONCE per task invocation (module-
level cache) and melted from wide to long before per-indicator filtering.

Source:  UNDP Human Development Reports Data Center
URL:     UNDP_CSV_URL env var (default = HDR25 composite time-series CSV)
License: CC BY 3.0 IGO  <https://hdr.undp.org/copyright-and-terms-use>
Country codes: iso3 column (ISO alpha-3) -> canonical name_1 via shared map.

INDICATORS WIRED (column prefix in the CSV):
    UD-01  hdi_   Human Development Index
    UD-02  ihdi_  Inequality-adjusted HDI
    UD-03  gii_   Gender Inequality Index
    UD-04  mpi_   Multidimensional Poverty Index (scaffolded — not in HDR25
                  composite CSV; will return empty; see UNCERTAINTIES below)
    UD-05  mys_   Mean Years of Schooling
    UD-06  eys_   Expected Years of Schooling
    UD-07  gdi_   Gender Development Index

NOTE (UD-04 / MPI): The HDR25 composite time-series CSV does NOT include MPI
columns.  MPI is published separately as a cross-sectional XLSX with no year
column before 2000 and no machine-readable time-series bulk file as of 2026-06.
The spec entry is scaffolded so the harness writes SKIPPED with zero rows until
a future MPI time-series URL is confirmed.  Smoke-test on AWS before first fleet
run to validate all other 6 prefixes.
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pandas as pd

# Shared base is COPYed next to this script in the image (see Dockerfile).
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, "/app")
import qgi_fetcher_base as base  # noqa: E402

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

UNDP_CSV_URL_DEFAULT = (
    "https://hdr.undp.org/sites/default/files/2025_HDR/"
    "HDR25_Composite_indices_complete_time_series.csv"
)

# id_string -> column prefix in the wide CSV
INDICATOR_PREFIX: dict[str, str] = {
    "UD-01": "hdi_",
    "UD-02": "ihdi_",
    "UD-03": "gii_",
    "UD-04": "mpi_",   # scaffolded — not present in HDR25 CSV; yields SKIPPED
    "UD-05": "mys_",
    "UD-06": "eys_",
    "UD-07": "gdi_",
}

# Module-level cache: (csv_url -> wide DataFrame) to avoid re-downloading
# within a single task when the harness calls fetch_one multiple times.
_wide_df_cache: dict[str, pd.DataFrame] = {}


# ---------------------------------------------------------------------------
# Pure transform (unit-tested, no network / no AWS)
# ---------------------------------------------------------------------------

def parse_undp_wide(
    wide_df: pd.DataFrame,
    col_prefix: str,
    iso3_map: dict[str, str],
) -> pd.DataFrame:
    """PURE: melt one indicator prefix from the UNDP wide DataFrame.

    Parameters
    ----------
    wide_df:    the raw wide CSV as a DataFrame (contains iso3, country, and
                columns like hdi_1990, hdi_1991 … gdi_2023 …)
    col_prefix: e.g. "hdi_"  (the metric prefix including trailing underscore)
    iso3_map:   {ISO3_UPPER: canonical name_1}

    Returns
    -------
    DataFrame[country, year, value] — annual; rows without ISO3 resolution or
    with non-numeric values are dropped.  If the prefix is absent from the
    CSV the frame is empty (SKIPPED path in the harness).
    """
    # Identify value columns that match the prefix + a 4-digit year suffix.
    # We exclude gender-disaggregated variants (e.g. hdi_f_1990, hdi_m_1990)
    # so that only the aggregate column is kept.
    value_cols = [
        c for c in wide_df.columns
        if c.startswith(col_prefix)
        and c[len(col_prefix):].isdigit()
        and len(c[len(col_prefix):]) == 4
    ]
    if not value_cols:
        return pd.DataFrame(columns=["country", "year", "value"])

    # Resolve iso3 -> canonical name
    iso3_col = "iso3" if "iso3" in wide_df.columns else wide_df.columns[0]
    id_cols = [iso3_col]
    subset = wide_df[id_cols + value_cols].copy()
    subset["_name"] = (
        subset[iso3_col]
        .astype(str)
        .str.strip()
        .str.upper()
        .map(iso3_map)
    )
    subset = subset.dropna(subset=["_name"])

    # Melt wide -> long
    melted = subset.melt(
        id_vars=["_name"],
        value_vars=value_cols,
        var_name="_col",
        value_name="value",
    )
    melted["year"] = (
        melted["_col"].str[len(col_prefix):].astype(int)
    )
    melted = melted.rename(columns={"_name": "country"})
    melted["value"] = pd.to_numeric(melted["value"], errors="coerce")
    melted = melted.dropna(subset=["value"])

    # Annual mean per (country, year) — handles any accidental duplicates
    result = (
        melted.groupby(["country", "year"], as_index=False)["value"]
        .mean()
    )
    return result[["country", "year", "value"]].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Network I/O (lazy import of requests)
# ---------------------------------------------------------------------------

def _load_wide_df() -> pd.DataFrame:
    """Download (or return cached) the UNDP composite-indices wide CSV."""
    url = os.environ.get("UNDP_CSV_URL", UNDP_CSV_URL_DEFAULT)
    if url in _wide_df_cache:
        base.logger.info(f"UNDP CSV: using cached wide DataFrame ({url})")
        return _wide_df_cache[url]

    import requests  # lazy — keeps the module importable without requests

    base.logger.info(f"UNDP CSV: downloading {url}")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    base.logger.info(
        f"UNDP CSV: {len(df)} rows x {len(df.columns)} cols from {url}"
    )
    _wide_df_cache[url] = df
    return df


# ---------------------------------------------------------------------------
# fetch_one (called by the harness for each spec)
# ---------------------------------------------------------------------------

def fetch_one(spec: dict) -> pd.DataFrame | None:
    iid = spec["id_string"]
    if iid not in INDICATOR_PREFIX:
        raise ValueError(f"unknown UNDP indicator {iid!r}")

    col_prefix = INDICATOR_PREFIX[iid]
    iso3_map = base.load_iso3_country_map()
    wide_df = _load_wide_df()

    df = parse_undp_wide(wide_df, col_prefix, iso3_map)
    if df.empty:
        base.logger.warning(
            f"{iid}: no rows parsed for prefix={col_prefix!r} "
            f"(expected for UD-04/mpi_ — see module docstring)"
        )
        return None
    return df


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    base.run_fetcher("UNDP", fetch_one)
