"""Backdating-proof variants of the OWID_AUTOCRATIZATION (V-Dem ERT `aut_ep`) signal --
PURE pandas/numpy panel-builder transforms (host-testable, no ML stack), matching the
existing project convention (`confound_missingness_placebo.build_has_data_dummy_panel` /
`permute_values_mask_preserved`).

## Why this file exists (the confound)

`OWID_AUTOCRATIZATION`'s raw value is V-Dem ERT's `aut_ep` binary column (see
`qgi-pipeline/batch/_enrichment_specs/specs-owid.json`: source
`vdeminstitute/ERT/master/inst/ert.csv`, column `aut_ep`). ERT's own published coding rule
(Maerz/Edgell/Wilson/Hellmeier/Lachapelle/Skaaning, V-Dem Working Paper -- "Episodes of
Regime Transformation") dates an autocratization episode's START at the first year
`v2x_polyarchy` declines, but an episode is only CONFIRMED once the decline cumulates to
>=0.1 on the polyarchy index -- a threshold that in practice is not crossed in the start
year itself, and stagnation of up to 5 years without a >=0.01 reversal still counts as
"ongoing". That means the value stamped at year t-1 in the panel we have can depend on
`v2x_polyarchy` observations at t, t+1, ... t+k -- i.e. the label is RETROSPECTIVELY
confirmed, not something a real-time observer standing at t-1 could have known. The raw
panel (`data/parquet_panels/OWID_AUTOCRATIZATION/OWID_AUTOCRATIZATION.parquet`) is just
`{country, year, value, is_predicted}` -- no episode-start/confirmation-date metadata is
carried through the fetch (`fetch_owid.py` / specs-owid.json pull `aut_ep` verbatim), so
there is no way to tell, from the panel alone, which flagged years were "obviously true by
t-1" vs "only true because of what happened at t or later." A worked example straight from
this repo's own panel: Chile's 1973 coup (`positives.csv` event_year=1973) has `aut_ep`
flip 0->1 exactly at 1972 (=event_year-1) and revert to 0 at 1975 -- a 3-year episode
(1972-1974) whose "start" sits one year before a coup most historians would say was already
brewing by 1970-71; the flag's specific timing is at least as consistent with "coded using
knowledge of 1973-74" as with "detected in real time in 1972."

## The three variants this file builds

(a) `shift_panel_forward` -- the SAME `aut_ep` flag, shifted so the feature pipeline reads
    it further in the past (t-2 .. t-5 instead of t-1). Pure calendar-arithmetic relabeling;
    introduces no new information, only removes recency. Orchestrated by
    `run_confound_variants.py`'s lag-variant loop.
(b) `build_cum_drop_panel` / `build_zscore_decline_panel` -- a REAL-TIME, leakage-safe
    reconstruction: a one-sided decline signal in a V-Dem continuous index (default
    `v2x_polyarchy`; also run against `v2x_libdem` / `v2x_regime`) built ONLY from
    observations at or before the row's own year. Because every downstream feature
    (`run_f_ml_1_poc.extract_features_for_indicator`) already restricts to
    `series.loc[year-window:year-1]`, a panel whose row at year t is a pure function of
    values at years <= t is automatically leakage-safe once fed through that pipeline --
    no additional shift is needed (unlike (a), which fixes a flag that IS partly
    future-derived).
(c) `build_strict_episode_panel` -- the SAME `aut_ep` flag, but zeroed out unless the
    episode's own start year (recovered by run-length analysis over the binary series --
    the first year of the contiguous 1-run containing this row) predates the row's year by
    >= `margin_years`. An episode that had already been running for >=2-3 years by t-1 is
    much less likely to have needed t/t+1/... to be confirmed. Verified on the Chile 1973
    worked example below (`margin_years=2` zeroes the suspicious 1972 flag).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

PANEL_COLS = ["country", "year", "value"]


def _clean(panel: pd.DataFrame) -> pd.DataFrame:
    """Drop null values, keep only the columns every downstream consumer needs."""
    return panel.dropna(subset=["value"])[PANEL_COLS].reset_index(drop=True)


# ============================================================================================
# (a) Lag-further variant: same flag, shifted calendar-years.
# ============================================================================================
def shift_panel_forward(panel: pd.DataFrame, shift_years: int) -> pd.DataFrame:
    """Return a panel where every row's `year` is incremented by `shift_years`, value
    unchanged. Feeding this into `extract_features_for_indicator` (which only ever reads
    `year-window : year-1` relative to the SAMPLE's event year) means the feature at
    event_year now reflects the ORIGINAL flag at `event_year - 1 - shift_years` -- i.e. the
    window is pushed strictly FURTHER into the past, never forward. `shift_years=0` is the
    identity (the existing t-1 baseline); `shift_years=1..4` implement t-2..t-5.
    `shift_years` must be >= 0 (this transform only removes recency, never adds future
    information -- a negative shift would do the opposite and is rejected)."""
    if shift_years < 0:
        raise ValueError(f"shift_panel_forward: shift_years must be >= 0, got {shift_years}")
    out = _clean(panel).copy()
    out["year"] = out["year"] + int(shift_years)
    return out.reset_index(drop=True)


# ============================================================================================
# (b) Leakage-safe real-time reconstruction of a one-sided polyarchy/libdem/regime decline.
# ============================================================================================
def build_cum_drop_panel(base_panel: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """Real-time one-sided decline: `value[t] = max(0, level[t-window] - level[t])` per
    country, i.e. how far the index has fallen from its level `window` years ago. Uses ONLY
    `level[t]` and `level[t-window]` -- both observable AT year t, never anything after t.
    Rows where either endpoint is missing are dropped (no interpolation, no fill)."""
    if window <= 0:
        raise ValueError(f"build_cum_drop_panel: window must be > 0, got {window}")
    clean = _clean(base_panel)
    rows: list[dict] = []
    for country, grp in clean.groupby("country"):
        s = grp.set_index("year")["value"].sort_index()
        s = s[~s.index.duplicated(keep="last")]
        for year, level_t in s.items():
            prior_year = year - window
            if prior_year in s.index:
                level_prior = s.loc[prior_year]
                rows.append({
                    "country": country, "year": int(year),
                    "value": float(max(0.0, level_prior - level_t)),
                })
    return pd.DataFrame(rows, columns=PANEL_COLS)


def build_zscore_decline_panel(base_panel: pd.DataFrame, roll_window: int = 10,
                                min_periods: int = 5) -> pd.DataFrame:
    """Real-time one-sided decline z-score: for each country's year-over-year change
    series, `value[t] = max(0, -change[t] / rolling_std)` where `rolling_std` is the
    trailing standard deviation of change over the `roll_window` years ENDING at t
    (inclusive) -- i.e. a function of changes observed AT OR BEFORE t only. Positive-only
    (a rise contributes 0, matching the "one-sided decline" spec); undefined
    (`rolling_std` too small a sample or exactly 0) rows are dropped rather than
    imputed."""
    if roll_window <= 1:
        raise ValueError(f"build_zscore_decline_panel: roll_window must be > 1, got {roll_window}")
    clean = _clean(base_panel)
    rows: list[dict] = []
    for country, grp in clean.groupby("country"):
        s = grp.set_index("year")["value"].sort_index()
        s = s[~s.index.duplicated(keep="last")]
        change = s.diff()  # change[t] = value[t] - value[t-1]; NaN for the first obs or a gap year
        roll_std = change.rolling(window=roll_window, min_periods=min_periods).std()
        for year in s.index:
            c = change.get(year)
            rs = roll_std.get(year)
            if c is None or rs is None or c != c or rs != rs or rs < 1e-9:
                continue
            z = max(0.0, float(-c) / float(rs))
            rows.append({"country": country, "year": int(year), "value": z})
    return pd.DataFrame(rows, columns=PANEL_COLS)


# ============================================================================================
# (c) Strict episode flag: only counts an episode once it predates the row by a safety margin.
# ============================================================================================
def build_strict_episode_panel(aut_ep_panel: pd.DataFrame, margin_years: int) -> pd.DataFrame:
    """Recover each contiguous run of `value==1` per country (a run breaks on a 0/missing
    year OR a gap in the calendar -- run-length analysis over the binary series is the only
    way to recover an episode's start year from this flag-only panel, which carries no
    explicit episode-id/start-year column). The row's own `year` counts as episode year 0,
    so a row `margin_years` or more years INTO its run (`year - episode_start >=
    margin_years`) keeps value=1; everything else (including every 0 row) is 0. This
    directly targets the retrospective-confirmation confound: an episode that had already
    been running for >=`margin_years` before this row is far less likely to have needed
    later years to be confirmed as "an episode" in the first place.

    Verified on Chile's 1973 coup (this repo's own panel): `aut_ep` flips on at 1972 and off
    at 1975 (episode_start=1972). At `margin_years=2`, the 1972 row (which is exactly
    event_year-1 for the 1973 coup) becomes 0 -- correctly flagged as too-fresh-to-trust.
    """
    if margin_years < 0:
        raise ValueError(f"build_strict_episode_panel: margin_years must be >= 0, got {margin_years}")
    clean = _clean(aut_ep_panel)
    rows: list[dict] = []
    for country, grp in clean.groupby("country"):
        g = grp.sort_values("year")
        years = g["year"].to_numpy()
        vals = g["value"].to_numpy()
        episode_start: int | None = None
        prev_year: int | None = None
        for y, v in zip(years, vals):
            is_one = v >= 0.5
            if is_one:
                if episode_start is None or prev_year is None or int(y) - int(prev_year) > 1:
                    episode_start = int(y)
                strict = 1.0 if (int(y) - episode_start) >= margin_years else 0.0
            else:
                episode_start = None
                strict = 0.0
            rows.append({"country": country, "year": int(y), "value": strict})
            prev_year = int(y)
    return pd.DataFrame(rows, columns=PANEL_COLS)
