#!/usr/bin/env python3
"""
ingest_vdem.py — V-Dem Country-Year ingestion (#487, V-Dem #4 of 6 under #348).

Reads a V-Dem v15+ Country-Year CSV (downloaded manually from v-dem.net
because their site has a click-through), filters to the 12 curated
indicators (VD-01..VD-12 per `qgi-docs/methodology/indicator-catalog-detailed.md`),
applies the country-name mapping (`registries/vdem_country_map.yaml`),
pivots wide → long, and writes per-indicator parquet partitions to the
data lake's `pipeline-A-indicator-extractor/output/parquet/` location.

Each row in the output is `(country, year, value, provider='VDEM',
indicator_id=v2x_*)`. The `provider` column was added to
`qgi_data.indicators` in #485 — legacy WB/FAO rows are NULL there until
the next full pipeline regeneration.

Manual download flow (annual):
  1. Visit https://v-dem.net/data/the-v-dem-dataset/
  2. Click "Country-Year, Full+Others" to download (CSV or ZIP)
  3. Unzip if needed; pass the .csv path to this script via --vdem-csv-path

Usage:
  python qgi-data/scripts/ingest_vdem.py \\
      --vdem-csv-path /path/to/V-Dem-CY-Full+Others-v15.csv \\
      --bucket qgi-data-lake-222222222222 \\
      --workgroup QGI-Lambda-Workgroup \\
      --region eu-central-1 \\
      [--dry-run]   # validate transform, skip S3 writes
      [--repair]    # also run MSCK REPAIR TABLE qgi_data.indicators

Anti-patterns (per design doc qgi-docs/internal/design/v-dem-integration.md):
  - Don't make this a Lambda. Annual cadence — manual run is fine.
  - Don't fork into a separate qgi_data.indicators_vdem table — single table.
  - Don't pre-emptively ingest V-Dem indicators outside VD-01..VD-12.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import boto3
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import yaml


SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
COUNTRY_MAP_FILE = REPO_ROOT / "registries" / "vdem_country_map.yaml"

S3_PARQUET_PREFIX = "pipeline-A-indicator-extractor/output/parquet"

# 12 curated indicators per indicator-catalog-detailed.md (VD-01..VD-12).
# Order here matches the catalog. The numeric IDs (276..287) live in
# the indicator_map.csv in S3 (#486 ship); this script writes the
# string-id partitions so Athena's `qgi_data.indicators` partition key
# (which is string-typed) keys on these directly.
VDEM_INDICATORS = [
    "v2x_polyarchy",       # VD-01 Electoral Democracy Index
    "v2x_libdem",          # VD-02 Liberal Democracy Index
    "v2x_jucon",           # VD-03 Judicial Constraints on Executive
    "v2xlg_legcon",        # VD-04 Legislative Constraints on Executive
    "v2csreprss",          # VD-05 Civil Society Repression
    "v2cacamps",           # VD-06 Political Polarization
    "v2excrptps",          # VD-07 Executive Corruption
    "v2x_freexp_altinf",   # VD-08 Freedom of Expression
    "v2x_partip",          # VD-09 Political Participation
    "v2x_regime",          # VD-10 Regime Type (categorical 0-3)
    "v2stcapacity",        # VD-11 State Capacity
    "v2x_clphy",           # VD-12 Physical Violence Index
]


def load_country_map(path: Path) -> tuple[dict[str, str], set[str], set[str]]:
    """Returns (mappings: alpha-3 → qgi name, drop_set, watch_set)."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    mappings = {k: v for k, v in (raw.get("mappings") or {}).items()}
    drop = set((raw.get("drop") or {}).keys())
    watch = set((raw.get("watch") or {}).keys())
    return mappings, drop, watch


def load_vdem_csv(path: Path) -> pd.DataFrame:
    """Read V-Dem CSV with only the columns we need.

    V-Dem v15+ uses 'country_text_id' (alpha-3) and 'year' as the row keys.
    We add the 12 indicator columns by name. Extras are dropped at read
    time to keep memory under ~50MB.
    """
    needed_cols = ["country_text_id", "year", "country_name"] + VDEM_INDICATORS
    print(f"[load] reading V-Dem CSV: {path}")
    df = pd.read_csv(path, usecols=needed_cols, low_memory=False)
    print(f"[load] {len(df):,} rows × {len(df.columns)} columns")
    print(f"[load] year range: {int(df['year'].min())}..{int(df['year'].max())}")
    print(f"[load] distinct countries: {df['country_text_id'].nunique()}")
    return df


def normalize_countries(df: pd.DataFrame, mappings: dict[str, str],
                        drop_set: set[str], watch_set: set[str]) -> pd.DataFrame:
    """Apply alpha-3 → qgi-canonical-name mapping; drop / warn per registry."""
    initial = len(df)

    # Drop list — silent
    df_drop = df[df["country_text_id"].isin(drop_set)]
    if not df_drop.empty:
        print(f"[normalize] DROP (historical entities): {df_drop['country_text_id'].value_counts().to_dict()}")
    df = df[~df["country_text_id"].isin(drop_set)].copy()

    # Watch list — warn
    df_watch = df[df["country_text_id"].isin(watch_set)]
    if not df_watch.empty:
        print(f"[normalize] WATCH (in V-Dem, not in qgi): "
              f"{df_watch['country_text_id'].value_counts().to_dict()}")
    df = df[~df["country_text_id"].isin(watch_set)].copy()

    # Unmapped — anything left that's NOT in mappings is a surprise
    unmapped_mask = ~df["country_text_id"].isin(mappings)
    if unmapped_mask.any():
        unmapped_codes = df.loc[unmapped_mask, "country_text_id"].value_counts()
        print(f"[normalize] WARN unmapped alpha-3 (will be dropped): {unmapped_codes.to_dict()}")
        df = df[~unmapped_mask].copy()

    # Apply the alpha-3 → qgi name mapping
    df["country"] = df["country_text_id"].map(mappings)
    final = len(df)
    print(f"[normalize] kept {final:,} / {initial:,} rows ({100*final/initial:.1f}%) after country filter")
    return df


def pivot_to_long(df: pd.DataFrame) -> pd.DataFrame:
    """Wide CSV → long format. Output columns:
        country (string), year (int32), value (float64), provider (string),
        indicator_id (string — partition key on Athena side).
    """
    keep = ["country", "year"] + VDEM_INDICATORS
    long_df = df[keep].melt(
        id_vars=["country", "year"], value_vars=VDEM_INDICATORS,
        var_name="indicator_id", value_name="value"
    )
    # Drop NULL values — V-Dem has many missing cells (e.g. state_capacity
    # only covers 180 countries). Aligns with how WB/FAO are stored too.
    before = len(long_df)
    long_df = long_df.dropna(subset=["value"]).copy()
    after = len(long_df)
    print(f"[pivot] {before:,} → {after:,} rows after dropping NULL values "
          f"(NULL share: {100*(before-after)/before:.1f}%)")

    long_df["year"] = long_df["year"].astype("int32")
    long_df["value"] = long_df["value"].astype("float64")
    long_df["provider"] = "VDEM"
    return long_df[["country", "year", "value", "provider", "indicator_id"]]


def upload_per_indicator_parquet(df: pd.DataFrame, bucket: str, region: str,
                                 dry_run: bool) -> dict[str, int]:
    """Group by indicator_id, write each as parquet to its own partition.

    Path: s3://{bucket}/pipeline-A-indicator-extractor/output/parquet/
          indicator_id={ind}/{ind}.parquet

    Existing parquet at the same key is OVERWRITTEN (idempotent re-runs).
    Other indicators (WB, FAO) live in their own partitions and are not
    touched.
    """
    s3 = boto3.client("s3", region_name=region)
    counts: dict[str, int] = {}
    for ind, sub in df.groupby("indicator_id"):
        key = f"{S3_PARQUET_PREFIX}/indicator_id={ind}/{ind}.parquet"
        # Drop the partition column before writing (Athena reads it from path)
        write_df = sub.drop(columns=["indicator_id"]).reset_index(drop=True)
        # Schema: country (string), year (int32), value (float64), provider (string)
        table = pa.Table.from_pandas(write_df, preserve_index=False)
        if dry_run:
            print(f"[upload] DRY {key}: {len(write_df):,} rows (skipped)")
        else:
            buf = pa.BufferOutputStream()
            pq.write_table(table, buf, compression="snappy")
            s3.put_object(Bucket=bucket, Key=key, Body=buf.getvalue().to_pybytes())
            print(f"[upload] s3://{bucket}/{key}: {len(write_df):,} rows")
        counts[ind] = len(write_df)
    return counts


def repair_table(bucket: str, workgroup: str, region: str) -> None:
    """Athena MSCK REPAIR TABLE — registers the new partitions in Glue."""
    ath = boto3.client("athena", region_name=region)
    sql = "MSCK REPAIR TABLE qgi_data.indicators"
    print(f"[repair] {sql}")
    r = ath.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": "qgi_data"},
        WorkGroup=workgroup,
        ResultConfiguration={"OutputLocation": f"s3://{bucket}/query_results/"},
    )
    qid = r["QueryExecutionId"]
    while True:
        time.sleep(2)
        s = ath.get_query_execution(QueryExecutionId=qid)["QueryExecution"]["Status"]
        if s["State"] in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
    if s["State"] != "SUCCEEDED":
        raise RuntimeError(f"MSCK REPAIR {s['State']}: {s.get('StateChangeReason', '?')}")
    print("[repair] OK")


def main() -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--vdem-csv-path", type=Path, required=True,
                   help="Path to a manually-downloaded V-Dem Country-Year CSV "
                        "(v15 or later).")
    p.add_argument("--bucket", required=True, help="S3 data lake bucket")
    p.add_argument("--workgroup", default="QGI-Lambda-Workgroup")
    p.add_argument("--region", default="eu-central-1")
    p.add_argument("--country-map", type=Path, default=COUNTRY_MAP_FILE,
                   help="Override the V-Dem country map YAML path "
                        "(default: qgi-data/registries/vdem_country_map.yaml)")
    p.add_argument("--dry-run", action="store_true",
                   help="Validate transform end-to-end without S3 writes or MSCK")
    p.add_argument("--repair", action="store_true",
                   help="After successful upload, run MSCK REPAIR TABLE qgi_data.indicators")
    args = p.parse_args()

    if not args.vdem_csv_path.exists():
        print(f"[error] V-Dem CSV not found: {args.vdem_csv_path}", file=sys.stderr)
        return 1
    if not args.country_map.exists():
        print(f"[error] country map not found: {args.country_map}", file=sys.stderr)
        return 1

    mappings, drop_set, watch_set = load_country_map(args.country_map)
    print(f"[init] country map: {len(mappings)} mappings, {len(drop_set)} drop, {len(watch_set)} watch")

    df = load_vdem_csv(args.vdem_csv_path)
    df = normalize_countries(df, mappings, drop_set, watch_set)
    long_df = pivot_to_long(df)

    counts = upload_per_indicator_parquet(long_df, args.bucket, args.region, args.dry_run)
    print(f"\n[summary] per-indicator row counts:")
    for ind in VDEM_INDICATORS:
        print(f"  {ind:25s} {counts.get(ind, 0):>7,d} rows")

    if args.repair and not args.dry_run:
        repair_table(args.bucket, args.workgroup, args.region)

    if args.dry_run:
        print("\n[dry-run] no writes performed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
