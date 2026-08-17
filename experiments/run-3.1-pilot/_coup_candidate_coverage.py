"""Host-side (no Docker needed -- pure pandas) coverage check for military_coup
indicator-mechanism candidates against the CURRENT 207-event positives.csv.
Reports, per candidate: n_countries overlap with the 74 coup countries, and
coverage-at-the-positive-cells (t-1 non-null) -- the PLAN.md-style hard pre-gate
proxy. THROWAWAY diagnostic, not committed under test.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]

POS_CSV = ROOT / "data" / "shape_inputs_v2" / "military_coup" / "positives.csv"
PANEL_DIR = ROOT / "data" / "parquet_panels"

COUNTRY_NAME_OVERRIDES = {
    "democratic_republic_of_congo": "The Democratic Republic of the Congo",
    "guinea_bissau": "Guinea-Bissau",
    "republic_of_congo": "Republic of the Congo",
    "timor_leste": "Timor-Leste",
}


def normalize_country_id(country_id: str) -> str:
    if country_id in COUNTRY_NAME_OVERRIDES:
        return COUNTRY_NAME_OVERRIDES[country_id]
    return country_id.replace("_", " ").title()


pos = pd.read_csv(POS_CSV)
pos["country"] = pos["country_id"].apply(normalize_country_id)
pos = pos.rename(columns={"event_year": "year"})
coup_countries = set(pos["country"].unique())
print(f"n_events={len(pos)} n_countries={len(coup_countries)}")

CANDIDATES = [
    "MS.MIL.XPND.GD.ZS", "MS.MIL.XPND.ZS", "MS.MIL.TOTL.P1", "MS.MIL.TOTL.TF.ZS",
    "MS.MIL.MPRT.KD", "MS.MIL.XPRT.KD",
    "v2x_regime", "v2x_regime_amb", "OWID_REGIMETYPE", "OWID_AUTOCRATIZATION",
    "NY.GDP.MKTP.KD.ZG", "NY.GDP.PCAP.CD",
    "v2pepwrses", "v2pepwrsoc", "v2cacamps", "v2exl_legitlead",
    "v2exremhog", "UCDP_YEARS_SINCE_LAST_CONFLICT", "UCDP_SB_ONSET",
    "v2x_neopat", "v2stfisccap",
]

rows = []
for ind in CANDIDATES:
    p = PANEL_DIR / ind / f"{ind}.parquet"
    if not p.exists():
        rows.append({"indicator": ind, "status": "MISSING_PANEL"})
        continue
    df = pd.read_parquet(p)
    panel_countries = set(df["country"].unique())
    overlap = coup_countries & panel_countries
    # coverage at t-1 cell (the year immediately before the event)
    n_t1_covered = 0
    for _, r in pos.iterrows():
        c, y = r["country"], int(r["year"])
        v = df[(df["country"] == c) & (df["year"] == y - 1)]["value"]
        if len(v) and pd.notna(v.iloc[0]):
            n_t1_covered += 1
    rows.append({
        "indicator": ind,
        "n_countries_in_panel": len(panel_countries),
        "n_coup_countries_overlap": len(overlap),
        "coup_country_overlap_pct": round(100 * len(overlap) / len(coup_countries), 1),
        "n_events_t1_covered": n_t1_covered,
        "events_t1_coverage_pct": round(100 * n_t1_covered / len(pos), 1),
        "year_min": int(df["year"].min()), "year_max": int(df["year"].max()),
    })

out = pd.DataFrame(rows)
pd.set_option("display.width", 200)
pd.set_option("display.max_columns", None)
print(out.to_string(index=False))
