#!/usr/bin/env python3
"""
Events Ingestion Script — Converts legacy ChatGPT (.txt) and Sonnet (.json)
events into unified Parquet on S3, partitioned by country_id.

Usage:
    python ingest_events.py --bucket qgi-data-lake-222222222222 --region eu-central-1

Reads:
    - Legacy events:  qgi-4.0/data/events/*.txt
    - Sonnet events:  qgi-pipeline/data/events/batches/*.json
    - Countries CSV:  s3://{bucket}/pipeline-A-indicator-extractor/input/countries.csv

Writes:
    - s3://{bucket}/events/country_id={id}/events.parquet
    - s3://{bucket}/baselines/persistence.parquet
    - s3://{bucket}/baselines/base_rates.parquet
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

import boto3
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from io import BytesIO

# ─── Paths ────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
LEGACY_EVENTS_DIR = Path(r"/workspace/qgi\qgi-4.0\data\events")
SONNET_EVENTS_DIR = REPO_ROOT / "data" / "events" / "batches"

S3_EVENTS_PREFIX = "events/"
S3_BASELINES_PREFIX = "baselines/"
COUNTRIES_KEY = "pipeline-A-indicator-extractor/input/countries.csv"


# ─── Category Deduplication ───────────────────────────────────────────────
def normalize_category(cat: str) -> str:
    """Normalize event category: lowercase, strip whitespace, singularize simple plurals,
    collapse separators."""
    if not cat or not isinstance(cat, str):
        return "unknown"
    cat = cat.strip().lower()
    # Collapse separators: " & ", " / ", " and " -> "_"
    cat = re.sub(r'\s*[&/]\s*', '_', cat)
    cat = re.sub(r'\s+and\s+', '_', cat)
    # Replace spaces with underscores
    cat = re.sub(r'\s+', '_', cat)
    # Remove non-alphanumeric (except underscores)
    cat = re.sub(r'[^a-z0-9_]', '', cat)
    # Simple singularization: trailing 's' if word > 4 chars
    # Handles: reforms->reform, conflicts->conflict, elections->election
    if cat.endswith('s') and len(cat) > 4 and not cat.endswith('ss'):
        cat = cat[:-1]
    return cat


# ─── Load Countries Mapping ──────────────────────────────────────────────
def load_countries(s3_client, bucket: str) -> pd.DataFrame:
    """Load countries.csv from S3, build name->id lookup across all name columns."""
    obj = s3_client.get_object(Bucket=bucket, Key=COUNTRIES_KEY)
    df = pd.read_csv(obj['Body'])

    # Build lookup: every name variant -> numeric id
    name_cols = [c for c in df.columns if c.startswith('name_')]
    lookup = {}
    for _, row in df.iterrows():
        cid = int(row['id'])
        for col in name_cols:
            name = row[col]
            if pd.notna(name) and str(name).strip():
                lookup[str(name).strip().lower()] = cid
                # Also store the primary name for this id
                if col == 'name_1':
                    lookup[f"__primary_{cid}"] = str(name).strip()

    return df, lookup


def resolve_country_id(name: str, lookup: dict) -> tuple:
    """Resolve country name to (country_id, canonical_name). Returns (None, None) if not found."""
    if not name:
        return None, None
    key = name.strip().lower()

    # Direct match
    if key in lookup:
        cid = lookup[key]
        canonical = lookup.get(f"__primary_{cid}", name)
        return cid, canonical

    # Try common substitutions
    variants = [
        key.replace('ivory coast', "côte d'ivoire"),
        key.replace('cote d\'ivoire', "côte d'ivoire"),
        key.replace('türkiye', 'turkey'),
        key.replace('czech republic', 'czechia'),
        key.replace('south korea', 'korea, republic of'),
        key.replace('north korea', "korea, democratic people's republic of"),
        key.replace('usa', 'united states'),
        key.replace('uk', 'united kingdom'),
    ]
    for v in variants:
        if v in lookup:
            cid = lookup[v]
            canonical = lookup.get(f"__primary_{cid}", name)
            return cid, canonical

    return None, None


# ─── Parse Legacy Events ─────────────────────────────────────────────────
def parse_legacy_events(events_dir: Path) -> list:
    """Parse legacy pipe-delimited .txt files."""
    events = []
    if not events_dir.exists():
        print(f"WARNING: Legacy events dir not found: {events_dir}")
        return events

    for txt_file in sorted(events_dir.glob("*.txt")):
        for line in txt_file.read_text(encoding='utf-8', errors='replace').splitlines():
            line = line.strip()
            if not line or not line.startswith('.'):
                continue
            # Format: ". Country | Year | Category | Description"
            parts = line[1:].split('|')  # skip leading dot
            if len(parts) < 4:
                continue
            country = parts[0].strip()
            try:
                year = int(parts[1].strip())
            except ValueError:
                continue
            category = parts[2].strip()
            description = parts[3].strip()

            events.append({
                'country_name': country,
                'year': year,
                'title': category,  # Legacy doesn't have separate title
                'description': description,
                'category': category,
                'source': 'chatgpt'
            })

    print(f"Parsed {len(events)} legacy events from {events_dir}")
    return events


# ─── Parse Sonnet Events ─────────────────────────────────────────────────
def parse_sonnet_events(events_dir: Path) -> list:
    """Parse Sonnet JSON batch files."""
    events = []
    if not events_dir.exists():
        print(f"WARNING: Sonnet events dir not found: {events_dir}")
        return events

    for json_file in sorted(events_dir.glob("*.json")):
        try:
            data = json.loads(json_file.read_text(encoding='utf-8', errors='replace'))
            for entry in data:
                events.append({
                    'country_name': entry.get('country', ''),
                    'year': int(entry.get('year', 0)),
                    'title': entry.get('title', ''),
                    'description': entry.get('description', ''),
                    'category': entry.get('category', ''),
                    'source': 'sonnet'
                })
        except (json.JSONDecodeError, KeyError) as e:
            print(f"WARNING: Failed to parse {json_file.name}: {e}")

    print(f"Parsed {len(events)} Sonnet events from {events_dir}")
    return events


# ─── Compute Baselines ───────────────────────────────────────────────────
def compute_baselines(df: pd.DataFrame, bucket: str, s3_client) -> None:
    """Compute persistence and base rate baselines, upload to S3."""

    # 1. Persistence baseline: for each country-year, did last year's events repeat?
    persistence_rows = []
    for (cid, cat), group in df.groupby(['country_id', 'category_normalized']):
        years = sorted(group['year'].unique())
        for i, y in enumerate(years):
            if i > 0:
                prev_year = years[i - 1]
                persisted = (y - prev_year) == 1  # consecutive year = persistence hit
                persistence_rows.append({
                    'country_id': cid,
                    'category': cat,
                    'year': y,
                    'persisted': persisted
                })

    if persistence_rows:
        p_df = pd.DataFrame(persistence_rows)
        buf = BytesIO()
        p_df.to_parquet(buf, engine='pyarrow', compression='snappy', index=False)
        buf.seek(0)
        s3_client.put_object(
            Bucket=bucket,
            Key=f"{S3_BASELINES_PREFIX}persistence.parquet",
            Body=buf.getvalue()
        )
        hit_rate = p_df['persisted'].mean() * 100
        print(f"Persistence baseline: {hit_rate:.1f}% hit rate, {len(p_df)} rows -> S3")

    # 2. Base rates: frequency of each event category per country
    base_rates = df.groupby(['country_id', 'category_normalized']).agg(
        event_count=('year', 'count'),
        year_span=('year', lambda x: x.max() - x.min() + 1)
    ).reset_index()
    base_rates['annual_rate'] = base_rates['event_count'] / base_rates['year_span'].clip(lower=1)

    buf = BytesIO()
    base_rates.to_parquet(buf, engine='pyarrow', compression='snappy', index=False)
    buf.seek(0)
    s3_client.put_object(
        Bucket=bucket,
        Key=f"{S3_BASELINES_PREFIX}base_rates.parquet",
        Body=buf.getvalue()
    )
    print(f"Base rates: {len(base_rates)} country-category pairs -> S3")

    # 3. Global base rates
    global_rates = df.groupby('category_normalized').agg(
        total_events=('year', 'count'),
        countries=('country_id', 'nunique')
    ).reset_index()
    global_rates['global_annual_rate'] = global_rates['total_events'] / (
        df['year'].max() - df['year'].min() + 1
    ) / global_rates['countries'].clip(lower=1)

    buf = BytesIO()
    global_rates.to_parquet(buf, engine='pyarrow', compression='snappy', index=False)
    buf.seek(0)
    s3_client.put_object(
        Bucket=bucket,
        Key=f"{S3_BASELINES_PREFIX}global_rates.parquet",
        Body=buf.getvalue()
    )
    print(f"Global rates: {len(global_rates)} categories -> S3")


# ─── Main ────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Ingest events to S3 Parquet')
    parser.add_argument('--bucket', required=True, help='S3 bucket name')
    parser.add_argument('--region', default='eu-central-1')
    parser.add_argument('--role-arn', help='Cross-account role ARN to assume')
    parser.add_argument('--dry-run', action='store_true', help='Parse only, no upload')
    args = parser.parse_args()

    if args.role_arn:
        sts = boto3.client('sts', region_name=args.region)
        creds = sts.assume_role(RoleArn=args.role_arn, RoleSessionName='events-ingestion')['Credentials']
        s3_client = boto3.client('s3', region_name=args.region,
                                 aws_access_key_id=creds['AccessKeyId'],
                                 aws_secret_access_key=creds['SecretAccessKey'],
                                 aws_session_token=creds['SessionToken'])
    else:
        s3_client = boto3.client('s3', region_name=args.region)

    # 1. Load countries mapping
    print("Loading countries mapping...")
    countries_df, country_lookup = load_countries(s3_client, args.bucket)
    print(f"Loaded {len(countries_df)} countries with {len(country_lookup)} name variants")

    # 2. Parse all events
    legacy_events = parse_legacy_events(LEGACY_EVENTS_DIR)
    sonnet_events = parse_sonnet_events(SONNET_EVENTS_DIR)
    all_events = legacy_events + sonnet_events
    print(f"\nTotal events: {len(all_events)} ({len(legacy_events)} legacy + {len(sonnet_events)} Sonnet)")

    # 3. Build DataFrame and resolve country IDs
    df = pd.DataFrame(all_events)
    resolved = df['country_name'].apply(lambda n: resolve_country_id(n, country_lookup))
    df['country_id'] = resolved.apply(lambda x: x[0])
    df['country_name_canonical'] = resolved.apply(lambda x: x[1])

    # Report unresolved
    unresolved = df[df['country_id'].isna()]['country_name'].unique()
    if len(unresolved) > 0:
        print(f"\nWARNING: {len(unresolved)} unresolved country names:")
        for name in sorted(unresolved)[:20]:
            print(f"  - {name}")

    # Drop unresolved
    df = df.dropna(subset=['country_id'])
    df['country_id'] = df['country_id'].astype(int)

    # 4. Normalize categories
    df['category_normalized'] = df['category'].apply(normalize_category)

    # Use canonical name as country_name
    df['country_name'] = df['country_name_canonical']
    df = df.drop(columns=['country_name_canonical'])

    print(f"\nFinal dataset: {len(df)} events, {df['country_id'].nunique()} countries, "
          f"{df['category_normalized'].nunique()} unique categories")
    print(f"Sources: {df['source'].value_counts().to_dict()}")
    print(f"Year range: {df['year'].min()} - {df['year'].max()}")

    if args.dry_run:
        print("\n[DRY RUN] No upload performed.")
        print(f"\nTop 10 categories:")
        print(df['category_normalized'].value_counts().head(10).to_string())
        return

    # 5. Upload to S3 partitioned by country_id
    print(f"\nUploading to s3://{args.bucket}/{S3_EVENTS_PREFIX} ...")
    uploaded = 0
    for cid, group in df.groupby('country_id'):
        # Select columns for output
        out = group[['country_name', 'year', 'title', 'description',
                      'category', 'category_normalized', 'source']].copy()
        out['year'] = out['year'].astype('int16')

        buf = BytesIO()
        out.to_parquet(buf, engine='pyarrow', compression='snappy', index=False)
        buf.seek(0)

        key = f"{S3_EVENTS_PREFIX}country_id={int(cid)}/events.parquet"
        s3_client.put_object(Bucket=args.bucket, Key=key, Body=buf.getvalue())
        uploaded += 1

    print(f"Uploaded {uploaded} country partitions to S3")

    # 6. Compute baselines
    print("\nComputing baselines...")
    compute_baselines(df, args.bucket, s3_client)

    print("\n✓ Done!")


if __name__ == '__main__':
    main()
