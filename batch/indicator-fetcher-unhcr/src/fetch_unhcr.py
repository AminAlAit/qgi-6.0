"""UNHCR population fetcher (enrichment stage 2 reference plugin).

One Fargate task per UN-xx indicator (dispatcher sends INDICATOR_ID). Pulls the
UNHCR population REST API (api.unhcr.org/population/v1/, no auth, CC BY 4.0),
aggregates to (canonical country, year, value), and hands the frame to the shared
base which writes parquet-completed + DDB + tracker + counter.

Country codes in the API are ISO alpha-3 -> mapped to canonical name_1 via the
shared country-m49-map (iso_alpha3 column).

NOTE: endpoint paths + JSON field names below follow the documented v1 API; run
ONE live smoke per indicator on AWS before the production fetch to confirm the
field names (the parse logic is unit-tested against a representative payload).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

# Shared base is COPYed next to this script in the image (see Dockerfile).
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, "/app")
import qgi_fetcher_base as base  # noqa: E402

UNHCR_BASE = "https://api.unhcr.org/population/v1"
YEAR_FROM = 1990

# id_string -> {endpoint, value (JSON numeric field), country (which ISO field to group by)}
SPECS: dict[str, dict[str, str]] = {
    "UN-01": {"endpoint": "population", "value": "refugees", "country": "coo_iso"},   # by origin
    "UN-02": {"endpoint": "population", "value": "refugees", "country": "coa_iso"},   # by asylum
    "UN-03": {"endpoint": "asylum-applications", "value": "applied", "country": "coo_iso"},
    "UN-04": {"endpoint": "population", "value": "idps", "country": "coa_iso"},
    "UN-05": {"endpoint": "solutions", "value": "voluntary_returns", "country": "coo_iso"},
    "UN-06": {"endpoint": "population", "value": "stateless", "country": "coa_iso"},
}


def parse_unhcr_records(records: list[dict], cfg: dict[str, str],
                        iso3_map: dict[str, str]) -> pd.DataFrame:
    """PURE: UNHCR JSON records -> DataFrame[country, year, value].

    Sums the configured value field by (canonical country, year). Rows whose
    ISO3 doesn't resolve to a canonical name are dropped (regional aggregates,
    unknown codes). Missing/blank values count as 0 within a present row.
    """
    cfield, vfield = cfg["country"], cfg["value"]
    rows = []
    for rec in records:
        iso = str(rec.get(cfield) or "").strip().upper()
        name = iso3_map.get(iso)
        if not name:
            continue
        year = rec.get("year")
        if year in (None, ""):
            continue
        raw = rec.get(vfield)
        try:
            val = float(raw) if raw not in (None, "") else 0.0
        except (TypeError, ValueError):
            continue
        rows.append({"country": name, "year": int(year), "value": val})
    if not rows:
        return pd.DataFrame(columns=["country", "year", "value"])
    return (pd.DataFrame(rows).groupby(["country", "year"], as_index=False)["value"].sum())


def fetch_unhcr_raw(endpoint: str) -> list[dict]:
    """Paginated GET of the UNHCR population API. Returns the flat item list."""
    import requests
    items: list[dict] = []
    page = 1
    while True:
        resp = requests.get(f"{UNHCR_BASE}/{endpoint}/", timeout=120, params={
            "yearFrom": YEAR_FROM, "limit": 10000, "page": page, "coa_all": "true", "coo_all": "true"})
        resp.raise_for_status()
        body = resp.json()
        batch = body.get("items", body if isinstance(body, list) else [])
        items.extend(batch)
        total_pages = body.get("maxPages") or body.get("totalPages") or 1
        if page >= int(total_pages) or not batch:
            break
        page += 1
    base.logger.info(f"UNHCR {endpoint}: {len(items)} records over {page} page(s)")
    return items


def fetch_one(spec: dict) -> pd.DataFrame:
    iid = spec["id_string"]
    if iid not in SPECS:
        raise ValueError(f"unknown UNHCR indicator {iid!r}")
    cfg = SPECS[iid]
    raw = fetch_unhcr_raw(cfg["endpoint"])
    return parse_unhcr_records(raw, cfg, base.load_iso3_country_map())


if __name__ == "__main__":
    base.run_fetcher("UNHCR", fetch_one)
