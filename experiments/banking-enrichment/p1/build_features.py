"""P1 — build derived candidate feature panels for the banking-enrichment screen.

Builds the CREDIT-mechanism and EXTERNAL-FRAGILITY-mechanism candidates named in the
banking-enrichment brief (`experiments/banking-enrichment/PLAN.md` §3), one parquet panel
per candidate, in the SAME (country, year, value) schema the production panels at
`data/parquet_panels/<ID>/<ID>.parquet` use (verified against `NV.SRV.TOTL.ZS` — see
`screen.py`'s docstring for the schema check). This lets a candidate that clears both P1
gates be dropped straight into `data/parquet_panels/` later with zero transformation.

Outputs are written under THIS experiment's own directory
(`experiments/banking-enrichment/p1/candidates/<ID>/<ID>.parquet`), NOT into the production
`data/parquet_panels/` tree — P1 is screening only; nothing here is wired into the walk / the
AUC gate yet (that is a later, separate step per PLAN.md §6, gated on a candidate passing
BOTH G1 and G2 first).

============================================================================================
LEAKAGE GUARANTEE (read this before touching the trend/gap math)
============================================================================================
Every derived value written to a candidate panel at (country, year=Y) is a function of ONLY
that country's raw-series observations at years <= Y. Concretely:

  * The one-sided credit-gap (C1) trend at year Y is computed by re-solving the (two-sided,
    within-window) HP filter on the series TRUNCATED to [.., Y] and reading off the LAST
    point of the fitted trend. Nothing at year Y+1, Y+2, ... ever enters that solve. This is
    the textbook "one-sided" / "real-time" HP filter (BIS credit-gap methodology): a fresh
    HP fit every period on an ever-growing sample, never a single whole-sample fit sliced
    after the fact. A conventional (whole-series) HP filter is BANNED here for exactly that
    reason — its trend at Y depends on data through the end of the sample, i.e. the future.
  * The 3-year growth (C2) at year Y is `level_Y - level_{Y-3}` (or the log-ratio): only Y
    and Y-3, both <= Y.
  * The external-fragility ratios (C3, C4) at year Y are point-in-time ratios of two raw
    series both observed at year Y (no smoothing/filtering at all, so no leakage vector).

We do NOT additionally pre-shift these panels by one year before writing them. That is
deliberate, not an oversight: the production walk's own feature extractor
(`run_f_ml_1_poc.extract_features_for_indicator`) ALREADY windows every indicator panel — for
a sample at (country, year=t) it reads `series.loc[t-window : t-1]`, i.e. it can only ever see
values through t-1. Combined with the "each panel value at Y uses only data <= Y" guarantee
above, a model trained to predict a crisis at year t therefore only ever touches gap_{t-1},
gap_{t-2}, ... — never gap_t and never anything from year >= t. Pre-shifting the panel here
as well would double-lag it for no benefit (and would silently disagree with how every OTHER
production indicator panel is stored). `screen.py`'s G1 gate checks coverage at EXACTLY the
two years the model will actually consume (event_year-1, event_year-2), which is the correct,
non-redundant place to verify the lag empirically.

Run inside the pinned pilot image (has numpy/pandas/scipy/pyarrow; zero pip installs):
    docker run --rm -v <repo>/qgi-ml:/work/qgi-ml qgi-run31-pilot:py313 bash -c \
        "cd /work/qgi-ml/experiments/banking-enrichment/p1 && python build_features.py"

World Bank API pulls (FS.AST.PRVT.GD.ZS, DT.DOD.DSTC.IR.ZS) are cached to
`raw_pulls/<INDICATOR>.parquet` on first run — re-run is fully offline after that.
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
from scipy.sparse import diags, csc_matrix
from scipy.sparse.linalg import spsolve

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
CANDIDATES_DIR = HERE / "candidates"
RAW_PULLS_DIR = HERE / "raw_pulls"

WB_API_BASE = "https://api.worldbank.org/v2"
HP_LAMBDA = 1600.0  # annual-data smoothing constant for the long (credit-cycle) trend;
# see BUILD NOTES at the bottom of this file for the literature justification.
MIN_PRIOR_YEARS = 5  # gap requires >= 5 PRIOR observations before year Y else NaN at Y
GROWTH_HORIZON = 3   # C2: level_Y - level_{Y-GROWTH_HORIZON}

# --------------------------------------------------------------------------------------------
# WB raw country display-name -> production-panel country name.
#
# Built by diffing the WB `/v2/country` metadata (all 217 non-aggregate economies) against the
# existing `NV.SRV.TOTL.ZS` production panel's country set (203 countries; the most complete
# locally cached panel) and hand-resolving every genuine rename (as opposed to a country that
# is simply absent from that particular indicator's WB series, which is not a naming issue).
# Verified 2026-07-10 (see the recon transcript in the PR description / session notes) — every
# entry below is a same-country rename, not a guess.
# --------------------------------------------------------------------------------------------
WB_NAME_TO_PANEL_NAME: dict[str, str] = {
    "Bahamas, The": "Bahamas",
    "Brunei Darussalam": "Brunei",
    "Congo, Dem. Rep.": "The Democratic Republic of the Congo",
    "Congo, Rep.": "Republic of the Congo",
    "Cote d'Ivoire": "Ivory Coast",
    "Curacao": "Curaçao",
    "Egypt, Arab Rep.": "Egypt",
    "Gambia, The": "The Gambia",
    "Hong Kong SAR, China": "Hong Kong",
    "Iran, Islamic Rep.": "Iran",
    "Korea, Dem. People's Rep.": "North Korea",
    "Korea, Rep.": "South Korea",
    "Kyrgyz Republic": "Kyrgyzstan",
    "Lao PDR": "Laos",
    "Macao SAR, China": "Macao",
    "Micronesia, Fed. Sts.": "Micronesia",
    "Puerto Rico (US)": "Puerto Rico",
    "Russian Federation": "Russia",
    "Slovak Republic": "Slovakia",
    "St. Kitts and Nevis": "Saint Kitts and Nevis",
    "St. Lucia": "Saint Lucia",
    "St. Vincent and the Grenadines": "Saint Vincent and the Grenadines",
    "Syrian Arab Republic": "Syria",
    "Venezuela, RB": "Venezuela",
    "Viet Nam": "Vietnam",
    "West Bank and Gaza": "Palestine",
    "Yemen, Rep.": "Yemen",
}


# ============================================================================================
# I/O helpers
# ============================================================================================
def load_local_panel(indicator_id: str) -> pd.DataFrame:
    """Load an already-cached production panel (country, year, value)."""
    path = PANEL_DIR / indicator_id / f"{indicator_id}.parquet"
    df = pd.read_parquet(path)
    return df[["country", "year", "value"]].copy()


def pull_wb_indicator(indicator_id: str, date_range: str = "1960:2024") -> pd.DataFrame:
    """Pull one WB indicator for ALL non-aggregate economies via the public REST API (no
    wbgapi dependency — plain urllib, cached to `raw_pulls/<indicator_id>.parquet` so a
    re-run of this script is fully offline). Renames WB's country display names to the
    production-panel convention via `WB_NAME_TO_PANEL_NAME` (identity for the ~190
    countries whose WB name already matches).
    """
    cache_path = RAW_PULLS_DIR / f"{indicator_id}.parquet"
    if cache_path.exists():
        print(f"[pull] {indicator_id}: using cached {cache_path}")
        return pd.read_parquet(cache_path)

    print(f"[pull] {indicator_id}: fetching from World Bank API ({date_range})...")
    url = (
        f"{WB_API_BASE}/country/all/indicator/{indicator_id}"
        f"?format=json&per_page=20000&date={date_range}"
    )
    with urllib.request.urlopen(url, timeout=60) as resp:
        payload = json.loads(resp.read())
    meta, rows = payload
    if not rows:
        raise RuntimeError(f"WB API returned zero rows for {indicator_id} (meta={meta})")

    # Drop WB's regional/income-group aggregates (not real countries); WB flags these with an
    # empty adminregion/region for aggregates, which the country-metadata endpoint labels
    # "Aggregates" — cheaper to just filter by the well-known aggregate iso3 prefix used
    # throughout this payload (2-letter WB region codes like "ZH", "1W", "EU", ...) vs a real
    # ISO3 alpha-3 country code (always 3 letters, never starting with a digit).
    recs = []
    for r in rows:
        iso3 = r.get("countryiso3code") or ""
        if len(iso3) != 3 or not iso3.isalpha():
            continue  # aggregate / malformed row
        val = r.get("value")
        if val is None:
            continue
        name = r["country"]["value"]
        recs.append(
            {
                "country": WB_NAME_TO_PANEL_NAME.get(name, name),
                "year": int(r["date"]),
                "value": float(val),
            }
        )
    df = pd.DataFrame.from_records(recs).sort_values(["country", "year"]).reset_index(drop=True)
    RAW_PULLS_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache_path, index=False)
    print(f"[pull] {indicator_id}: {len(df)} rows, {df['country'].nunique()} countries -> cached")
    return df


def write_candidate(candidate_id: str, df: pd.DataFrame) -> Path:
    """Write a derived candidate panel to `candidates/<id>/<id>.parquet` in the production
    (country: str, year: int64, value: float64) schema, dropping NaN rows (NaN = "no
    observation that year", exactly how the production panels represent missingness — a
    sparse frame, not a dense one with explicit NaN rows)."""
    out = df.dropna(subset=["value"]).copy()
    out["country"] = out["country"].astype(str)
    out["year"] = out["year"].astype("int64")
    out["value"] = out["value"].astype("float64")
    out = out.sort_values(["country", "year"]).reset_index(drop=True)
    out_dir = CANDIDATES_DIR / candidate_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{candidate_id}.parquet"
    out.to_parquet(out_path, index=False)
    print(f"[write] {candidate_id}: {len(out)} rows, {out['country'].nunique()} countries -> {out_path}")
    return out_path


# ============================================================================================
# One-sided (real-time) HP filter — the leakage-safe credit-gap trend.
# ============================================================================================
def _hp_trend_full_sample(y: np.ndarray, lam: float) -> np.ndarray:
    """Standard (whole-sample) HP filter trend of a 1-D series via the sparse penalized
    least-squares solve `(I + lam * D'D) trend = y`, D = second-difference operator. This is
    the two-sided filter — NEVER call it on data the caller doesn't want the trend to "see".
    `_one_sided_hp_gap` below calls this on a TRUNCATED prefix each period, which is what
    makes the overall construction one-sided; this helper itself is just the linear-algebra
    primitive, agnostic to how much data it's handed.
    """
    n = len(y)
    if n < 3:
        return y.astype(float).copy()
    d2 = diags([1.0, -2.0, 1.0], [0, 1, 2], shape=(n - 2, n))
    penalty = lam * (d2.T @ d2)
    A = csc_matrix(np.eye(n)) + penalty
    trend = spsolve(A, y)
    return np.asarray(trend, dtype=float)


def one_sided_gap(series: pd.Series, lam: float = HP_LAMBDA, min_prior: int = MIN_PRIOR_YEARS) -> pd.Series:
    """Compute the ONE-SIDED (real-time) HP-filter gap of a single country's year-indexed
    series: `gap[Y] = level[Y] - trend[Y]`, where `trend[Y]` is the terminal point of an HP
    filter fit ONLY on `series[.. Y]` (never anything after Y). Re-solved from scratch every
    period (BIS "recursive" / "real-time" credit-gap methodology) — this is what makes the
    trend leakage-free by construction, unlike slicing a single whole-sample HP fit.

    `series` must already be sorted by year with a year index and no duplicate years (gaps in
    the year index — missing years — are fine and simply excluded from that country's prefix).
    Requires >= `min_prior` observations strictly BEFORE year Y (i.e. at least `min_prior + 1`
    total observations through Y) or the gap at Y is NaN.
    """
    years = series.index.to_numpy()
    vals = series.to_numpy(dtype=float)
    gap = np.full(len(vals), np.nan, dtype=float)
    for i in range(len(vals)):
        if i < min_prior:  # fewer than min_prior PRIOR observations
            continue
        prefix = vals[: i + 1]  # years[0..i], i.e. only data <= years[i] -- the leakage guard
        trend_prefix = _hp_trend_full_sample(prefix, lam)
        gap[i] = prefix[-1] - trend_prefix[-1]
    return pd.Series(gap, index=years)


def build_credit_gap(raw: pd.DataFrame, candidate_id: str) -> pd.DataFrame:
    """C1: one-sided credit-to-GDP gap, built per-country (each country's HP recursion is
    independent — no cross-country leakage vector either)."""
    out_rows = []
    for country, g in raw.groupby("country", sort=False):
        g = g.dropna(subset=["value"]).drop_duplicates(subset=["year"]).sort_values("year")
        if len(g) < MIN_PRIOR_YEARS + 1:
            continue
        s = pd.Series(g["value"].to_numpy(), index=g["year"].to_numpy())
        gap = one_sided_gap(s)
        for yr, v in gap.items():
            if v == v:  # not NaN
                out_rows.append({"country": country, "year": int(yr), "value": float(v)})
    df = pd.DataFrame.from_records(out_rows)
    print(f"[build] {candidate_id}: {len(df)} gap rows from {raw['country'].nunique()} raw countries")
    return df


def build_credit_growth(raw: pd.DataFrame, candidate_id: str, horizon: int = GROWTH_HORIZON,
                          log_ratio: bool = False) -> pd.DataFrame:
    """C2: horizon-year change of a level series, `level_Y - level_{Y-horizon}` (or the
    log-ratio `log(level_Y / level_{Y-horizon})` when `log_ratio=True`). No filter of any
    kind -> leakage-proof by construction (uses exactly two observed points, both <= Y)."""
    out_rows = []
    for country, g in raw.groupby("country", sort=False):
        g = g.dropna(subset=["value"]).drop_duplicates(subset=["year"]).sort_values("year")
        s = pd.Series(g["value"].to_numpy(), index=g["year"].to_numpy())
        for yr in s.index:
            prior_yr = yr - horizon
            if prior_yr not in s.index:
                continue
            lvl_now, lvl_prior = s.loc[yr], s.loc[prior_yr]
            if log_ratio:
                if lvl_now <= 0 or lvl_prior <= 0:
                    continue
                val = float(np.log(lvl_now / lvl_prior))
            else:
                val = float(lvl_now - lvl_prior)
            out_rows.append({"country": country, "year": int(yr), "value": val})
    df = pd.DataFrame.from_records(out_rows)
    print(f"[build] {candidate_id}: {len(df)} growth rows from {raw['country'].nunique()} raw countries")
    return df


def build_ratio(num: pd.DataFrame, den: pd.DataFrame, candidate_id: str,
                  transform: Callable[[float, float], float] | None = None) -> pd.DataFrame:
    """Point-in-time ratio of two raw series aligned on (country, year); no smoothing, so no
    leakage vector beyond "value observed at year Y" (which is already the convention every
    other production panel uses)."""
    merged = num.merge(den, on=["country", "year"], suffixes=("_num", "_den"))
    merged = merged.dropna(subset=["value_num", "value_den"])
    merged = merged[merged["value_den"] != 0]
    if transform is None:
        merged["value"] = merged["value_num"] / merged["value_den"]
    else:
        merged["value"] = merged.apply(lambda r: transform(r["value_num"], r["value_den"]), axis=1)
    df = merged[["country", "year", "value"]].replace([np.inf, -np.inf], np.nan).dropna()
    print(f"[build] {candidate_id}: {len(df)} ratio rows")
    return df


# ============================================================================================
# Orchestration
# ============================================================================================
def main() -> int:
    CANDIDATES_DIR.mkdir(parents=True, exist_ok=True)
    RAW_PULLS_DIR.mkdir(parents=True, exist_ok=True)

    # ---- raw inputs -------------------------------------------------------------------
    fd_raw = load_local_panel("FD.AST.PRVT.GD.ZS")   # bank credit / GDP (local cache)
    fs_raw = pull_wb_indicator("FS.AST.PRVT.GD.ZS")  # total financial-system credit / GDP
    dstc_raw = pull_wb_indicator("DT.DOD.DSTC.IR.ZS")  # short-term debt % of total reserves
    m2_gdp_raw = load_local_panel("FM.LBL.BMNY.GD.ZS")  # M2 / GDP (%)
    gdp_usd_raw = load_local_panel("NY.GDP.MKTP.CD")    # GDP, current US$
    reserves_usd_raw = load_local_panel("FI.RES.TOTL.CD")  # total reserves, current US$

    written: dict[str, Path] = {}

    # ---- CREDIT mechanism ---------------------------------------------------------------
    written["credit_gap_1s_fd"] = write_candidate(
        "credit_gap_1s_fd", build_credit_gap(fd_raw, "credit_gap_1s_fd")
    )
    written["credit_gap_1s_fs"] = write_candidate(
        "credit_gap_1s_fs", build_credit_gap(fs_raw, "credit_gap_1s_fs")
    )
    written["credit_growth_3y_fd"] = write_candidate(
        "credit_growth_3y_fd", build_credit_growth(fd_raw, "credit_growth_3y_fd")
    )
    written["credit_growth_3y_fs"] = write_candidate(
        "credit_growth_3y_fs", build_credit_growth(fs_raw, "credit_growth_3y_fs")
    )

    # ---- EXTERNAL-FRAGILITY mechanism ----------------------------------------------------
    # C3: short-term external debt / reserves. WB already publishes this exact
    # Guidotti-Greenspan ratio as DT.DOD.DSTC.IR.ZS (%) -- no reconstruction needed, so we
    # just rename/write it directly (still point-in-time, no leakage).
    written["stdebt_reserves"] = write_candidate(
        "stdebt_reserves", dstc_raw.rename(columns={"value": "value"})
    )

    # C4: M2 / reserves, UNIT-HARMONIZED. FM.LBL.BMNY.GD.ZS is M2 as a % of GDP; reserves
    # (FI.RES.TOTL.CD) are levels in current US$. Convert M2 to current US$ via GDP (current
    # US$, also a level) BEFORE forming the ratio, so both sides of the ratio are in the same
    # unit (current US$) at the same point in time:
    #     M2_usd[Y]  = (M2_pct_gdp[Y] / 100) * GDP_usd[Y]
    #     m2_reserves[Y] = M2_usd[Y] / reserves_usd[Y]
    m2_pct = m2_gdp_raw.rename(columns={"value": "m2_pct_gdp"})
    gdp = gdp_usd_raw.rename(columns={"value": "gdp_usd"})
    m2_usd = m2_pct.merge(gdp, on=["country", "year"]).dropna()
    m2_usd["value"] = (m2_usd["m2_pct_gdp"] / 100.0) * m2_usd["gdp_usd"]
    m2_usd = m2_usd[["country", "year", "value"]]
    written["m2_reserves"] = write_candidate(
        "m2_reserves", build_ratio(m2_usd, reserves_usd_raw, "m2_reserves")
    )

    print("\n[done] candidates written:")
    for cid, path in written.items():
        print(f"  {cid} -> {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# ============================================================================================
# BUILD NOTES
# ============================================================================================
# HP_LAMBDA=1600: the credit-to-GDP gap literature (Basel III countercyclical buffer, BIS
# working papers Drehmann/Tsatsaronis) uses lambda=400,000 on QUARTERLY data to isolate a
# long (financial) cycle rather than the short business cycle a standard lambda=1600
# quarterly filter targets. Converting a quarterly lambda to an annual one scales
# approximately by the 4th power of the frequency ratio (Ravn & Uhlig 2002): 1600 (annual,
# business-cycle) is the direct annual analogue of the STANDARD 1600 (quarterly,
# business-cycle) constant most commonly cited for annual macro series, and is the
# conservative, well-precedented choice here given our short (<=65-year) per-country
# annual series can't support the very long trend a BIS-equivalent annual lambda
# (400000 / 4**4 ~= 1600) would target anyway at this sample length -- the two
# literature-motivated choices coincide at 1600 for annual data, which is why it's used
# unmodified rather than re-derived per series.
