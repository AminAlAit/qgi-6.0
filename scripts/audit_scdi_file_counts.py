"""
audit_scdi_file_counts.py — count parquet files per country_a_id partition
under pipeline-B-scdi-finder/scdis/.

# THROWAWAY — run once during Phase 5 v0.0 to settle whether the spec's
# "1.65M files" estimate matches reality.

For each country_a_id={N}/ partition: paginated ListObjectsV2, count
parquet keys. Outputs:
  - Per-partition file count + cumulative total
  - Histogram bucketed by file-count magnitude
  - Top 10 partitions by file count
  - Sum + median + p90 + max for context

Cost: ~$0.0004 (1000 ListObjectsV2 calls × $0.005/1K = $0.005 absolute
maximum if every partition needed multiple pages; in practice <$0.001).

Usage:
  python scripts/audit_scdi_file_counts.py \\
      --bucket qgi-data-lake-222222222222
"""
from __future__ import annotations

import argparse
import statistics
import sys
import time

import boto3

DEFAULT_PREFIX = "pipeline-B-scdi-finder/scdis/"


def list_country_partitions(s3, bucket: str, prefix: str) -> list[int]:
    paginator = s3.get_paginator("list_objects_v2")
    cids = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter="/"):
        for cp in page.get("CommonPrefixes", []) or []:
            part = cp["Prefix"].rstrip("/").split("/")[-1]
            if part.startswith("country_a_id="):
                try:
                    cids.append(int(part.split("=", 1)[1]))
                except ValueError:
                    pass
    return sorted(cids)


def count_files_in_partition(s3, bucket: str, prefix: str, cid: int) -> int:
    paginator = s3.get_paginator("list_objects_v2")
    n = 0
    for page in paginator.paginate(
        Bucket=bucket, Prefix=f"{prefix}country_a_id={cid}/"
    ):
        n += page.get("KeyCount", 0)
    return n


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--prefix", default=DEFAULT_PREFIX)
    args = parser.parse_args()

    s3 = boto3.client("s3")
    print(f"Listing country partitions under s3://{args.bucket}/{args.prefix}")
    cids = list_country_partitions(s3, args.bucket, args.prefix)
    print(f"Found {len(cids)} partitions\n")

    counts: dict[int, int] = {}
    t0 = time.monotonic()
    for cid in cids:
        n = count_files_in_partition(s3, args.bucket, args.prefix, cid)
        counts[cid] = n
    elapsed = time.monotonic() - t0

    total = sum(counts.values())
    values = sorted(counts.values())
    median = statistics.median(values)
    p90 = values[int(len(values) * 0.9)] if values else 0
    p99 = values[int(len(values) * 0.99)] if values else 0
    mx = max(values) if values else 0
    mn = min(values) if values else 0

    print(f"Audit complete in {elapsed:.1f}s")
    print(f"\n--- Summary ---")
    print(f"  Partitions:        {len(cids)}")
    print(f"  Total files:       {total:,}")
    print(f"  Min:               {mn:,}")
    print(f"  Median:            {median:,.0f}")
    print(f"  p90:               {p90:,}")
    print(f"  p99:               {p99:,}")
    print(f"  Max:               {mx:,}")
    print(f"  Mean:              {total / len(cids):,.0f}")

    # Histogram
    buckets = [
        (0, 0, "empty"),
        (1, 10, "1-10"),
        (11, 100, "11-100"),
        (101, 1_000, "101-1K"),
        (1_001, 10_000, "1K-10K"),
        (10_001, 100_000, "10K-100K"),
        (100_001, 10**12, "100K+"),
    ]
    bucket_counts = [0] * len(buckets)
    for n in values:
        for i, (lo, hi, _) in enumerate(buckets):
            if lo <= n <= hi:
                bucket_counts[i] += 1
                break

    print(f"\n--- Histogram (partition file-count distribution) ---")
    print(f"  {'bucket':>10}  {'partitions':>12}  bar")
    print(f"  {'-' * 10}  {'-' * 12}  {'-' * 40}")
    max_bc = max(bucket_counts) or 1
    for (_, _, label), bc in zip(buckets, bucket_counts):
        bar = "#" * int(40 * bc / max_bc)
        print(f"  {label:>10}  {bc:>12}  {bar}")

    # Top 10 by file count
    top10 = sorted(counts.items(), key=lambda kv: -kv[1])[:10]
    print(f"\n--- Top 10 partitions by file count ---")
    print(f"  {'country_a_id':>14}  {'files':>12}")
    for cid, n in top10:
        print(f"  {cid:>14}  {n:>12,}")

    # Bottom 10
    bot10 = sorted(counts.items(), key=lambda kv: kv[1])[:10]
    print(f"\n--- Bottom 10 partitions by file count ---")
    print(f"  {'country_a_id':>14}  {'files':>12}")
    for cid, n in bot10:
        print(f"  {cid:>14}  {n:>12,}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
