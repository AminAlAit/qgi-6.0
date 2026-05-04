"""Feature engineering pipeline for ML-Opus.

Stage 0 deliverable per qgi-docs/internal/ops/ml-track/stage-0-pre-registration.md.

All functions operate on a LONG-format panel DataFrame with columns:
    country     str       country slug (snake_case)
    year        int       calendar year
    indicator_id str       catalog code OR provider API code
    value       float     numeric reading (NaN allowed)

Long format is canonical because it matches qgi-ml/data/all_104_panels.parquet
and the per-indicator parquet outputs from pipeline-A-indicator-extractor.
The single exception is multiple_imputation_mice, which requires WIDE format
(one row per (country, year), one column per indicator) and is a sklearn
operation. pivot_to_wide() / pivot_to_long() bridge between the two.

Functions:
    read_indicators(indicator_ids, panel_dir)    long DataFrame
    pivot_to_wide(long_df)                       wide DataFrame
    pivot_to_long(wide_df)                       long DataFrame
    first_difference(long_df, indicator_ids)     long with values shifted to dy
    rolling_zscore(long_df, window_years)        long with values normalized
    momentum(long_df, lookback_years)            long YoY-change of rolling mean
    cross_indicator_ratios(long_df, pairs)       long with derived ratio rows
    missingness_indicators(long_df, indicator_ids)  long with binary missing flags
    multiple_imputation_mice(wide_df, n_iter)    wide with MICE-imputed values

Design notes:
    - first_difference / rolling_zscore / momentum apply Tariq's I5-related
      transforms at the feature level. Apply them BEFORE training; do not
      embed them in the cascade pipeline (per founder constraint #2 -- ML
      pipeline must remain source-agnostic).
    - missingness_indicators is Roshani's MNAR mitigation -- the FACT of
      absence is informative, encode it as a feature.
    - multiple_imputation_mice covers the imputation path Roshani named in
      DECISION v3 Section 5; sklearn IterativeImputer is the implementation.
    - All transforms preserve the (country, year, indicator_id, value)
      schema so they compose. The first year of any country-indicator has
      NaN value after first_difference; downstream models must handle.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd


# Required panel columns (canonical long format)
REQUIRED_COLS = ("country", "year", "indicator_id", "value")

# Suffix conventions for derived indicators
SUFFIX_FIRSTDIFF = "__diff"
SUFFIX_ZSCORE = "__zscore"
SUFFIX_MOMENTUM = "__momentum"
SUFFIX_RATIO_SEP = "__div__"
SUFFIX_MISSING = "__missing"


# ---------- Validation helper ----------


def _check_long_schema(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise ValueError(
            f"long-format panel DataFrame missing required columns: {missing}; "
            f"got {list(df.columns)}"
        )


# ---------- I/O ----------


def read_indicators(
    indicator_ids: Iterable[str],
    panel_dir: Path,
) -> pd.DataFrame:
    """Read per-indicator parquets into a single long-format panel.

    Reads from `<panel_dir>/<indicator_id>/<indicator_id>.parquet` for each
    requested indicator. Missing files are silently skipped (production
    pipelines may not have ingested every catalog code yet); a warning column
    is NOT added to keep the schema clean.

    The pipeline-A-indicator-extractor convention is one parquet per indicator
    with at least the columns (country, year, indicator_id, value). Files that
    don't carry indicator_id will have it back-filled from the path.
    """
    panel_dir = Path(panel_dir)
    if not panel_dir.is_dir():
        raise NotADirectoryError(f"panel_dir does not exist: {panel_dir}")
    frames: list[pd.DataFrame] = []
    for iid in indicator_ids:
        p = panel_dir / iid / f"{iid}.parquet"
        if not p.is_file():
            continue
        df = pd.read_parquet(p)
        if "indicator_id" not in df.columns:
            df = df.assign(indicator_id=iid)
        _check_long_schema(df)
        frames.append(df[list(REQUIRED_COLS)])
    if not frames:
        return pd.DataFrame(columns=list(REQUIRED_COLS))
    return pd.concat(frames, ignore_index=True)


def pivot_to_wide(long_df: pd.DataFrame) -> pd.DataFrame:
    """Convert long (country, year, indicator_id, value) to wide.

    Wide format: one row per (country, year), one column per indicator_id.
    Missing observations become NaN. Used as input to MICE imputation and
    most sklearn-style trainers.
    """
    _check_long_schema(long_df)
    if long_df.empty:
        return pd.DataFrame()
    wide = long_df.pivot_table(
        index=["country", "year"],
        columns="indicator_id",
        values="value",
        aggfunc="first",  # duplicate (country, year, ind) is a data bug; keep first
    ).reset_index()
    wide.columns.name = None  # drop the "indicator_id" axis label
    return wide


def pivot_to_long(wide_df: pd.DataFrame) -> pd.DataFrame:
    """Inverse of pivot_to_wide. Drops NaN values in the long output."""
    if wide_df.empty:
        return pd.DataFrame(columns=list(REQUIRED_COLS))
    if not {"country", "year"}.issubset(wide_df.columns):
        raise ValueError(
            f"wide DataFrame must contain country + year; got {list(wide_df.columns)}"
        )
    indicator_cols = [c for c in wide_df.columns if c not in ("country", "year")]
    long = wide_df.melt(
        id_vars=["country", "year"],
        value_vars=indicator_cols,
        var_name="indicator_id",
        value_name="value",
    )
    return long.dropna(subset=["value"]).reset_index(drop=True)


# ---------- Transforms (long format) ----------


def first_difference(
    long_df: pd.DataFrame,
    indicator_ids: Iterable[str] | None = None,
) -> pd.DataFrame:
    """Per-country per-indicator first-difference (delta(t) = v(t) - v(t-1)).

    If indicator_ids is None, applies to ALL indicators in the panel. If a
    specific list, only those indicators get differenced; others pass through
    unchanged. Each differenced indicator is renamed `<id>__diff` and the
    first-year row of each country gets NaN value.
    """
    _check_long_schema(long_df)
    if long_df.empty:
        return long_df.copy()
    target_ids = set(indicator_ids) if indicator_ids is not None else set(long_df["indicator_id"].unique())
    out = long_df.copy()
    target_mask = out["indicator_id"].isin(target_ids)
    target = out.loc[target_mask].copy()
    other = out.loc[~target_mask].copy()
    target = target.sort_values(["country", "indicator_id", "year"])
    target["value"] = target.groupby(["country", "indicator_id"])["value"].diff()
    target["indicator_id"] = target["indicator_id"] + SUFFIX_FIRSTDIFF
    return pd.concat([other, target], ignore_index=True)


def rolling_zscore(
    long_df: pd.DataFrame,
    window_years: int = 3,
    indicator_ids: Iterable[str] | None = None,
) -> pd.DataFrame:
    """Per-country per-indicator rolling Z-score.

    For each (country, indicator), compute rolling mean and std over the
    most recent `window_years` years (inclusive of current year) and emit
    z = (value - mean) / std. Emits a derived indicator named `<id>__zscore`.
    Years with fewer than 2 prior observations get NaN.
    """
    if window_years < 2:
        raise ValueError(f"window_years must be >= 2; got {window_years}")
    _check_long_schema(long_df)
    if long_df.empty:
        return long_df.copy()
    target_ids = set(indicator_ids) if indicator_ids is not None else set(long_df["indicator_id"].unique())
    target = long_df.loc[long_df["indicator_id"].isin(target_ids)].copy()
    other = long_df.loc[~long_df["indicator_id"].isin(target_ids)].copy()
    target = target.sort_values(["country", "indicator_id", "year"])
    grp = target.groupby(["country", "indicator_id"])["value"]
    rolling_mean = grp.transform(lambda s: s.rolling(window_years, min_periods=2).mean())
    rolling_std = grp.transform(lambda s: s.rolling(window_years, min_periods=2).std())
    z = (target["value"] - rolling_mean) / rolling_std
    # Replace inf/-inf (zero std → divide by zero) with NaN — informative absence
    target["value"] = z.replace([float("inf"), float("-inf")], pd.NA)
    target["indicator_id"] = target["indicator_id"] + SUFFIX_ZSCORE
    return pd.concat([other, target], ignore_index=True)


def momentum(
    long_df: pd.DataFrame,
    lookback_years: int = 5,
    indicator_ids: Iterable[str] | None = None,
) -> pd.DataFrame:
    """Year-on-year change in `lookback_years`-window rolling mean.

    Captures medium-term trend acceleration / deceleration. Differs from
    first_difference (raw YoY) in smoothing the baseline. Output indicator
    suffix `__momentum`.
    """
    if lookback_years < 2:
        raise ValueError(f"lookback_years must be >= 2; got {lookback_years}")
    _check_long_schema(long_df)
    if long_df.empty:
        return long_df.copy()
    target_ids = set(indicator_ids) if indicator_ids is not None else set(long_df["indicator_id"].unique())
    target = long_df.loc[long_df["indicator_id"].isin(target_ids)].copy()
    other = long_df.loc[~long_df["indicator_id"].isin(target_ids)].copy()
    target = target.sort_values(["country", "indicator_id", "year"])
    grp = target.groupby(["country", "indicator_id"])["value"]
    rolling_mean = grp.transform(lambda s: s.rolling(lookback_years, min_periods=2).mean())
    target["value"] = rolling_mean.groupby(target["country"], group_keys=False).diff()
    target["indicator_id"] = target["indicator_id"] + SUFFIX_MOMENTUM
    return pd.concat([other, target], ignore_index=True)


def cross_indicator_ratios(
    long_df: pd.DataFrame,
    indicator_pairs: list[tuple[str, str]],
) -> pd.DataFrame:
    """Compute pairwise A/B ratios as derived indicators.

    For each (numerator_id, denominator_id) in indicator_pairs, joins the
    panel on (country, year) and emits a derived indicator named
    `<num_id>__div__<den_id>`. NaN where either operand is NaN or the
    denominator is zero.

    Only theoretically motivated pairs should be passed (e.g., debt/GDP,
    refugees/population) -- this function does not validate semantics.
    """
    _check_long_schema(long_df)
    if not indicator_pairs:
        return long_df.copy()
    if long_df.empty:
        return long_df.copy()
    out_frames: list[pd.DataFrame] = [long_df.copy()]
    wide = pivot_to_wide(long_df)
    for num_id, den_id in indicator_pairs:
        if num_id not in wide.columns or den_id not in wide.columns:
            continue  # silently skip pairs missing from panel
        ratio_id = f"{num_id}{SUFFIX_RATIO_SEP}{den_id}"
        num = pd.to_numeric(wide[num_id], errors="coerce")
        # np.nan (not pd.NA) so the division produces a float Series, not a
        # nullable-numeric Series that fails .astype(float) downstream.
        den = pd.to_numeric(wide[den_id], errors="coerce").replace(0, np.nan)
        ratio_series = num / den
        derived = pd.DataFrame({
            "country": wide["country"],
            "year": wide["year"],
            "indicator_id": ratio_id,
            "value": ratio_series.astype(float),
        })
        out_frames.append(derived)
    return pd.concat(out_frames, ignore_index=True)


def missingness_indicators(
    long_df: pd.DataFrame,
    indicator_ids: Iterable[str] | None = None,
    full_country_year_grid: bool = True,
) -> pd.DataFrame:
    """Emit binary missingness flags per indicator (Roshani's MNAR mitigation).

    Encodes the FACT of absence as informative. For each requested indicator,
    emit a row per (country, year) with value=1.0 if the original observation
    was missing in that cell, else value=0.0. Derived indicator name is
    `<id>__missing`.

    full_country_year_grid: if True (default), considers the cross-product of
    all observed (country, year) pairs as the universe -- so a country-year
    with no row at all for the indicator counts as "missing". If False, only
    flags rows already present with NaN value.
    """
    _check_long_schema(long_df)
    if long_df.empty:
        return long_df.copy()
    universe_ids = set(indicator_ids) if indicator_ids is not None else set(long_df["indicator_id"].unique())
    out_frames: list[pd.DataFrame] = [long_df.copy()]
    if full_country_year_grid:
        country_years = long_df[["country", "year"]].drop_duplicates()
    for iid in universe_ids:
        ind_rows = long_df.loc[long_df["indicator_id"] == iid, ["country", "year", "value"]]
        if full_country_year_grid:
            merged = country_years.merge(ind_rows, on=["country", "year"], how="left")
        else:
            merged = ind_rows.copy()
        # Missing if value is NaN
        flag = merged["value"].isna().astype(float)
        derived = pd.DataFrame({
            "country": merged["country"],
            "year": merged["year"],
            "indicator_id": f"{iid}{SUFFIX_MISSING}",
            "value": flag,
        })
        out_frames.append(derived)
    return pd.concat(out_frames, ignore_index=True)


# ---------- MICE imputation (wide format; sklearn lazy-imported) ----------


def multiple_imputation_mice(
    wide_df: pd.DataFrame,
    n_iter: int = 10,
    random_state: int = 0,
) -> pd.DataFrame:
    """Multivariate imputation by chained equations on a wide panel.

    Wraps sklearn.experimental.enable_iterative_imputer + IterativeImputer.
    Imputes NaN values across all numeric indicator columns iteratively,
    using each column's relationship to the others.

    Returns a wide DataFrame of the same shape with NaN values replaced.
    Non-numeric columns (country) are preserved untouched; year is preserved.

    Per Roshani's binding requirement (DECISION v3 Section 5): MICE is one
    of the three MNAR mitigation paths. Apply BEFORE training, after the
    missingness_indicators features have been computed (so the binary "fact
    of absence" is preserved as a separate feature).
    """
    if wide_df.empty:
        return wide_df.copy()
    try:
        from sklearn.experimental import enable_iterative_imputer  # noqa: F401
        from sklearn.impute import IterativeImputer
    except ImportError as err:  # pragma: no cover - exercised manually
        raise RuntimeError(
            "scikit-learn is required for MICE; install with `pip install scikit-learn`."
        ) from err
    if "country" not in wide_df.columns or "year" not in wide_df.columns:
        raise ValueError("wide_df must contain 'country' and 'year' columns")
    indicator_cols = [c for c in wide_df.columns if c not in ("country", "year")]
    if not indicator_cols:
        return wide_df.copy()
    imputer = IterativeImputer(max_iter=n_iter, random_state=random_state)
    imputed = imputer.fit_transform(wide_df[indicator_cols])
    out = wide_df.copy()
    out[indicator_cols] = imputed
    return out
