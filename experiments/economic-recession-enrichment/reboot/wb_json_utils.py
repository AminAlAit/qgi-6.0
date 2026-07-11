"""Shared parser: raw World Bank API JSON (`api.worldbank.org/v2/country/all/indicator/<ID>`,
`format=json`) -> canonical (`country`, `year`, `value`) panel, scoped to the 106-country
economic_recession crosswalk. Reused by every WB-sourced `build_*.py` in this reboot (GEM
equity, WDI Terms-of-Trade, WDI export-commodity shares for the commodity-shock interaction).

Deliberately maps on `countryiso3code` -> `crosswalk.iso3_to_country_id` ->
`crosswalk.CROSSWALK[...]["country_name"]` rather than trusting WB's own `country.value`
field (see `crosswalk.py`'s docstring: WB's raw names disagree with this project's
`normalize_country_id` convention on several countries -- e.g. "Cote d'Ivoire" vs "Ivory
Coast"). Any row whose iso3 isn't in the crosswalk (WB region/income aggregates like "AFE",
"World", "OECD members") is dropped silently -- it is out of scope, not a data error.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from crosswalk import iso3_to_country_id, country_id_to_display_name

PANEL_COLS = ["country", "year", "value"]


def wb_json_to_panel(json_path: Path) -> pd.DataFrame:
    raw = json.loads(Path(json_path).read_text(encoding="utf-8"))
    meta = raw[0] if raw else {}
    records = raw[1] if len(raw) > 1 and raw[1] else []

    rows: list[dict[str, object]] = []
    for rec in records:
        if rec.get("value") is None:
            continue
        iso3 = rec.get("countryiso3code") or ""
        if not iso3:
            # Some WB sub-APIs (e.g. GEM/sourceid=15, used for DSTKMKTXD) leave
            # `countryiso3code` blank and put the ISO3 code in `country.id` instead
            # (confirmed on the real DSTKMKTXD pull, 2026-07-11).
            iso3 = (rec.get("country") or {}).get("id", "")
        cid = iso3_to_country_id(iso3)
        if cid is None:
            continue  # out-of-crosswalk aggregate/region row, or unrecognized code
        rows.append(
            {
                "country": country_id_to_display_name(cid),
                "year": int(rec["date"]),
                "value": float(rec["value"]),
            }
        )

    panel = pd.DataFrame(rows, columns=PANEL_COLS)
    if panel.empty:
        return panel.astype({"year": "int64", "value": "float64"})
    panel = panel.drop_duplicates(subset=["country", "year"], keep="first")
    panel = panel.sort_values(["country", "year"]).reset_index(drop=True)
    panel["year"] = panel["year"].astype("int64")
    panel["value"] = panel["value"].astype("float64")
    return panel
