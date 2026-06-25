"""UCDP conflict fetcher (enrichment stage 2).

One Fargate task per UC-xx indicator. Pulls the UCDP Georeferenced Event Dataset
(GED) REST API (ucdpapi.pcr.uu.se, no auth, CC BY 4.0) and aggregates event-level
fatalities to (canonical country, year, value).

SCOPE: this plugin covers the two GED-derived indicators that map cleanly by
country NAME:
  UC-01 battle-related deaths  = sum(best) where type_of_violence == 1 (state-based)
  UC-04 one-sided violence     = sum(best) where type_of_violence == 3
UC-02 (active conflict count) and UC-03 (conflict onset) come from the UCDP/PRIO
Armed Conflict Dataset, which is keyed by Gleditsch-Ward numeric codes -> they
need a gw->canonical crosswalk and are intentionally DEFERRED (left as
status=candidate in the registry) until that crosswalk lands.

Country mapping: GED returns a `country` NAME; we map it to canonical name_1 via
the shared name-alias map plus a small UCDP-specific override set (UCDP appends
historical names like "DR Congo (Zaire)"). Unmapped countries are dropped+logged.

NOTE: confirm the GED API version + field names (`best`, `type_of_violence`,
`country`, `year`) with one live smoke before the production run; the parse logic
is unit-tested against a representative payload.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, "/app")
import qgi_fetcher_base as base  # noqa: E402

GED_VERSION = os.environ.get("UCDP_GED_VERSION", "24.1")
GED_URL = f"https://ucdpapi.pcr.uu.se/api/gedevents/{GED_VERSION}"

# id_string -> type_of_violence code aggregated from GED
SPECS: dict[str, int] = {
    "UC-01": 1,   # state-based (battle-related deaths)
    "UC-04": 3,   # one-sided violence
}

# UCDP country names that differ from QGI canonical / its aliases. Extend as the
# live smoke surfaces unmapped names (they are logged + dropped, never silent).
UCDP_NAME_OVERRIDES: dict[str, str] = {
    "DR Congo (Zaire)": "The Democratic Republic of the Congo",
    "Myanmar (Burma)": "Myanmar",
    "Russia (Soviet Union)": "Russia",
    "Yemen (North Yemen)": "Yemen",
    "Serbia (Yugoslavia)": "Serbia",
    "Cambodia (Kampuchea)": "Cambodia",
    "Zimbabwe (Rhodesia)": "Zimbabwe",
    "Madagascar (Malagasy)": "Madagascar",
    "United States of America": "United States",
    "Ivory Coast": "Cote d'Ivoire",
    "Kingdom of eSwatini (Swaziland)": "Eswatini",
}


def build_name_map(alias_map: dict[str, str]) -> dict[str, str]:
    """Merge the shared alias->name_1 map with UCDP-specific overrides."""
    m = dict(alias_map)
    m.update(UCDP_NAME_OVERRIDES)
    return m


def parse_ged_records(records: list[dict], tov: int, name_map: dict[str, str]) -> pd.DataFrame:
    """PURE: GED events -> DataFrame[country, year, value] = sum(best) for the given
    type_of_violence, grouped by (canonical country, year). Unmapped countries dropped."""
    rows = []
    for rec in records:
        if int(rec.get("type_of_violence", 0)) != tov:
            continue
        name = name_map.get(str(rec.get("country") or "").strip())
        if not name:
            continue
        year = rec.get("year")
        if year in (None, ""):
            continue
        try:
            best = float(rec.get("best") or 0)
        except (TypeError, ValueError):
            continue
        rows.append({"country": name, "year": int(year), "value": best})
    if not rows:
        return pd.DataFrame(columns=["country", "year", "value"])
    return pd.DataFrame(rows).groupby(["country", "year"], as_index=False)["value"].sum()


def fetch_ged_records() -> list[dict]:
    """Paginated GET of the full GED event list."""
    import requests
    out: list[dict] = []
    page = 0
    while True:
        resp = requests.get(GED_URL, timeout=180, params={"pagesize": 1000, "page": page})
        resp.raise_for_status()
        body = resp.json()
        batch = body.get("Result", [])
        out.extend(batch)
        total = int(body.get("TotalPages", 1))
        if page >= total - 1 or not batch:
            break
        page += 1
    base.logger.info(f"UCDP GED v{GED_VERSION}: {len(out)} events over {page + 1} page(s)")
    return out


# GED is one dataset for all type_of_violence -> cache the download across specs
# within a single task (a task usually fetches one indicator, but be safe).
_ged_cache: list[dict] | None = None


def fetch_one(spec: dict) -> pd.DataFrame:
    global _ged_cache
    iid = spec["id_string"]
    if iid not in SPECS:
        raise ValueError(f"UCDP plugin covers {sorted(SPECS)}; {iid!r} is deferred "
                         f"(needs the ACD + gw->canonical crosswalk)")
    if _ged_cache is None:
        _ged_cache = fetch_ged_records()
    name_map = build_name_map(base.load_name_alias_map())
    return parse_ged_records(_ged_cache, SPECS[iid], name_map)


if __name__ == "__main__":
    base.run_fetcher("UCDP", fetch_one)
