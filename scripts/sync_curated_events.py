#!/usr/bin/env python3
"""
Sync curated events JSONs and TRACKING.md to S3 (#141, follow-up to curation work).

This is the SOURCE-OF-TRUTH sync — fast, no Athena, no Parquet rebuild.
Use this after every `clean and verify the events of [country]` pass to push
the local curated/{country}.json up to S3 so other machines / CI / Lambdas can read it.

Bidirectional:
  --upload   (default) push local → S3
  --download         pull S3 → local (for fresh clones / new dev machines)

The pipeline's heavy ingest_events.py reads the SAME local curated/ directory
on its next run and rebuilds Parquet from there. Run that separately when you
want the Athena `qgi_data.events` table updated.

Usage:
    python sync_curated_events.py --bucket qgi-data-lake-222222222222
    python sync_curated_events.py --bucket qgi-data-lake-222222222222 --download
    python sync_curated_events.py --bucket qgi-data-lake-222222222222 --dry-run

S3 layout:
    s3://{bucket}/events-source/curated/{country}.json
    s3://{bucket}/events-source/TRACKING.md
"""
import argparse
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
CURATED_DIR = REPO_ROOT / "events" / "curated"
TRACKING_FILE = REPO_ROOT / "data" / "events" / "TRACKING.md"

S3_PREFIX = "events-source/curated/"
S3_TRACKING_KEY = "events-source/TRACKING.md"


def upload(s3, bucket: str, dry_run: bool) -> None:
    """Push local curated/ + TRACKING.md to S3."""
    if not CURATED_DIR.exists():
        print(f"ERROR: {CURATED_DIR} does not exist")
        sys.exit(1)

    files = sorted(CURATED_DIR.glob("*.json"))
    print(f"Uploading {len(files)} curated event files to s3://{bucket}/{S3_PREFIX}")

    for f in files:
        key = f"{S3_PREFIX}{f.name}"
        if dry_run:
            print(f"  [dry-run] {f.name} -> s3://{bucket}/{key}")
            continue
        s3.upload_file(
            str(f), bucket, key,
            ExtraArgs={'ContentType': 'application/json'},
        )
        print(f"  ✓ {f.name}")

    if TRACKING_FILE.exists():
        if dry_run:
            print(f"  [dry-run] TRACKING.md -> s3://{bucket}/{S3_TRACKING_KEY}")
        else:
            s3.upload_file(
                str(TRACKING_FILE), bucket, S3_TRACKING_KEY,
                ExtraArgs={'ContentType': 'text/markdown'},
            )
            print(f"  ✓ TRACKING.md")
    else:
        print(f"  WARNING: {TRACKING_FILE} not found, skipping")

    print(f"Done. Uploaded {len(files)} files{' (dry-run)' if dry_run else ''}.")


def download(s3, bucket: str, dry_run: bool) -> None:
    """Pull S3 → local curated/ + TRACKING.md (for fresh clones)."""
    CURATED_DIR.mkdir(parents=True, exist_ok=True)

    paginator = s3.get_paginator('list_objects_v2')
    keys = []
    for page in paginator.paginate(Bucket=bucket, Prefix=S3_PREFIX):
        for obj in page.get('Contents', []):
            if obj['Key'].endswith('.json'):
                keys.append(obj['Key'])

    print(f"Downloading {len(keys)} curated files from s3://{bucket}/{S3_PREFIX}")
    for key in keys:
        filename = key.rsplit('/', 1)[-1]
        local = CURATED_DIR / filename
        if dry_run:
            print(f"  [dry-run] s3://{bucket}/{key} -> {local}")
            continue
        s3.download_file(bucket, key, str(local))
        print(f"  ✓ {filename}")

    # Tracking file
    if dry_run:
        print(f"  [dry-run] s3://{bucket}/{S3_TRACKING_KEY} -> {TRACKING_FILE}")
    else:
        try:
            s3.download_file(bucket, S3_TRACKING_KEY, str(TRACKING_FILE))
            print(f"  ✓ TRACKING.md")
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                print(f"  WARNING: TRACKING.md not in S3 yet, skipping")
            else:
                raise

    print(f"Done. Downloaded {len(keys)} files{' (dry-run)' if dry_run else ''}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--bucket', required=True, help='S3 bucket name (e.g. qgi-data-lake-222222222222)')
    parser.add_argument('--region', default='eu-central-1')
    parser.add_argument('--role-arn', help='Optional cross-account role to assume')
    parser.add_argument('--download', action='store_true', help='Pull S3 -> local instead of pushing')
    parser.add_argument('--dry-run', action='store_true', help='Show what would happen without doing it')
    args = parser.parse_args()

    if args.role_arn:
        sts = boto3.client('sts', region_name=args.region)
        creds = sts.assume_role(RoleArn=args.role_arn, RoleSessionName='curated-events-sync')['Credentials']
        s3 = boto3.client(
            's3', region_name=args.region,
            aws_access_key_id=creds['AccessKeyId'],
            aws_secret_access_key=creds['SecretAccessKey'],
            aws_session_token=creds['SessionToken'],
        )
    else:
        s3 = boto3.client('s3', region_name=args.region)

    if args.download:
        download(s3, args.bucket, args.dry_run)
    else:
        upload(s3, args.bucket, args.dry_run)


if __name__ == '__main__':
    main()
