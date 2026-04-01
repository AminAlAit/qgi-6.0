"""
Phase 1.5 — Indicator Completion

Runs after Phase 1 (ingest) and before Phase 2 (Batch SCDI).

For every indicator in the data lake, and for every country within that
indicator, this Lambda detects gaps between the last real data year and the
current year, then self-predicts the missing values using Holt-Winters
exponential smoothing (ETS).

The completed series is written to a separate S3 prefix
(output/csv-completed/) so the raw worker output is never modified.
scdi-finder reads from csv-completed/.

Output schema: country, year, value, is_predicted
  is_predicted=False  → original World Bank value
  is_predicted=True   → ETS forecast

Rules:
  - Skip country if fewer than MIN_HISTORY real data points
  - Skip country if gap > MAX_FORECAST_YEARS
  - If skipped, the raw series is copied as-is with is_predicted=False
"""

import os
import io
import gzip
import logging
import datetime
import boto3
import numpy as np
import pandas as pd

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

S3_BUCKET         = os.environ["S3_BUCKET"]
INPUT_PREFIX      = os.environ["INPUT_PREFIX"]   # pipeline-A-indicator-extractor/output/csv
OUTPUT_PREFIX     = os.environ["OUTPUT_PREFIX"]  # pipeline-A-indicator-extractor/output/csv-completed
INDICATOR_MAP_KEY = os.environ["INDICATOR_MAP_KEY"]  # pipeline-A-indicator-extractor/input/indicator_map.csv

MIN_HISTORY        = 5   # minimum real data points required to attempt forecasting
MAX_FORECAST_YEARS = 5   # refuse to extrapolate more than 5 years forward


def _current_year() -> int:
    return datetime.datetime.utcnow().year


def _list_indicator_ids() -> list[str]:
    """Returns all indicator IDs that have a csv.gz file under INPUT_PREFIX."""
    paginator = s3.get_paginator("list_objects_v2")
    ids = []
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=INPUT_PREFIX + "/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".csv.gz"):
                # key shape: {INPUT_PREFIX}/{id}/{id}.csv.gz
                parts = key.split("/")
                if len(parts) >= 2:
                    ids.append(parts[-2])
    return ids


def _read_csv_gz(key: str) -> pd.DataFrame:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
    return pd.read_csv(io.BytesIO(obj["Body"].read()), compression="gzip")


def _write_csv_gz(df: pd.DataFrame, key: str) -> None:
    buf = gzip.compress(df.to_csv(index=False).encode("utf-8"), mtime=0)
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=buf)


def _ets_forecast(series: pd.Series, n_steps: int) -> list[float]:
    """
    Holt-Winters double exponential smoothing (additive trend, no seasonality).
    Pure numpy implementation — no statsmodels dependency.
    Grid-searches alpha/beta to minimise in-sample SSE.
    """
    y = np.array(series, dtype=float)
    n = len(y)

    best_sse = float("inf")
    best_alpha = 0.3
    best_beta = 0.1

    for alpha in np.arange(0.05, 1.0, 0.05):
        for beta in np.arange(0.01, 0.5, 0.05):
            l = y[0]
            b = y[1] - y[0] if n > 1 else 0.0
            sse = 0.0
            for t in range(1, n):
                l_prev, b_prev = l, b
                l = alpha * y[t] + (1 - alpha) * (l_prev + b_prev)
                b = beta * (l - l_prev) + (1 - beta) * b_prev
                sse += (y[t] - (l_prev + b_prev)) ** 2
            if sse < best_sse:
                best_sse = sse
                best_alpha, best_beta = alpha, beta

    # Final fit with best params
    l = y[0]
    b = y[1] - y[0] if n > 1 else 0.0
    for t in range(1, n):
        l_prev, b_prev = l, b
        l = best_alpha * y[t] + (1 - best_alpha) * (l_prev + b_prev)
        b = best_beta * (l - l_prev) + (1 - best_beta) * b_prev

    return [float(l + h * b) for h in range(1, n_steps + 1)]


def _complete_indicator(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a raw indicator DataFrame (country, year, value) and returns
    a completed DataFrame (country, year, value, is_predicted).
    """
    current_year = _current_year()
    completed_parts = []

    for country, group in df.groupby("country"):
        group = group.sort_values("year").copy()
        group["is_predicted"] = False

        last_real_year = int(group["year"].max())
        gap = current_year - last_real_year

        if gap <= 0:
            # Already has current year data — no completion needed
            completed_parts.append(group)
            continue

        if gap > MAX_FORECAST_YEARS:
            logger.warning(
                f"  {country}: gap={gap} > MAX_FORECAST_YEARS={MAX_FORECAST_YEARS}, skipping forecast"
            )
            completed_parts.append(group)
            continue

        real_values = group["value"].dropna()
        if len(real_values) < MIN_HISTORY:
            logger.warning(
                f"  {country}: only {len(real_values)} real points < MIN_HISTORY={MIN_HISTORY}, skipping forecast"
            )
            completed_parts.append(group)
            continue

        try:
            forecasts = _ets_forecast(real_values, gap)
        except Exception as e:
            logger.warning(f"  {country}: ETS failed ({e}), skipping forecast")
            completed_parts.append(group)
            continue

        predicted_rows = pd.DataFrame({
            "country":      [country] * gap,
            "year":         list(range(last_real_year + 1, current_year + 1)),
            "value":        forecasts,
            "is_predicted": [True] * gap,
        })

        completed_parts.append(pd.concat([group, predicted_rows], ignore_index=True))

    if not completed_parts:
        return df.assign(is_predicted=False)

    return pd.concat(completed_parts, ignore_index=True).sort_values(["country", "year"])


def lambda_handler(event, context):
    indicator_ids = _list_indicator_ids()
    logger.info(f"Found {len(indicator_ids)} indicator files to complete")

    stats = {"completed": 0, "skipped": 0, "failed": 0}

    for indicator_id in indicator_ids:
        input_key  = f"{INPUT_PREFIX}/{indicator_id}/{indicator_id}.csv.gz"
        output_key = f"{OUTPUT_PREFIX}/{indicator_id}/{indicator_id}.csv.gz"

        try:
            df = _read_csv_gz(input_key)
            logger.info(f"Processing {indicator_id}: {len(df)} rows, {df['country'].nunique()} countries")

            completed = _complete_indicator(df)
            _write_csv_gz(completed, output_key)

            added = len(completed) - len(df)
            logger.info(f"  → wrote {len(completed)} rows (+{added} predicted) to {output_key}")
            stats["completed"] += 1

        except Exception as e:
            logger.error(f"Failed to complete {indicator_id}: {e}", exc_info=True)
            stats["failed"] += 1

    logger.info(f"Phase 1.5 complete: {stats}")
    return {
        "status": "Complete",
        "indicators_completed": stats["completed"],
        "indicators_failed":    stats["failed"],
    }
