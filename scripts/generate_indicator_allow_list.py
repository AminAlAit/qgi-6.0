"""
generate_indicator_allow_list.py — derive the canonical numeric-ID
allow-list for the recipe-engine fingerprint filter (#591 Option D).

# THROWAWAY in spirit (one-shot generator) but committed and re-runnable:
# regenerate when the catalog markdown is updated (e.g., FAOSTAT/ILOSTAT
# bring-up adds new entries with API codes).

Approach:
  1. Parse qgi-docs/methodology/indicator-catalog-detailed.md — extract
     all rows of the form `| <prefix>-<NN> | <api_code> | ... |` where
     <api_code> is a parseable indicator-system code (matches WB or VD
     id_string conventions). Currently this surfaces 61 of 142 catalog
     entries (WB-22 + VD-39); the other 81 (FA/IL/GD/UC/UN/UD/OE/OW/ID)
     have descriptive names instead of API codes because their providers
     are not yet ingested.

  2. Read indicator_map.csv (S3 source-of-truth: pipeline-A-indicator-
     extractor/input/indicator_map.csv) — id_string -> numeric_id.

  3. Inner-join: catalog API code -> numeric_id. Today this yields 61
     numeric_ids (every WB+VD catalog code is in the map). Future
     ingestion of FAOSTAT/ILOSTAT/UCDP/etc. will grow this number.

  4. Write qgi-data/reference/indicator-allow-list.json with metadata
     + sorted/deduped allow-list.

Determinism: parser only accepts strict regex matches; sorted output;
no random / wall-clock ordering. Two invocations on the same inputs
produce byte-identical JSON.

Standing-rule callout: this script is read-only against S3
(GetObject on indicator_map.csv) and writes only a local file. No
founder approval needed.

Usage:
  # Default — write to qgi-data/reference/indicator-allow-list.json
  python qgi-ml/scripts/generate_indicator_allow_list.py \\
      --bucket qgi-data-lake-222222222222

  # Dry-run (print to stdout, no write):
  python qgi-ml/scripts/generate_indicator_allow_list.py \\
      --bucket qgi-data-lake-222222222222 --dry-run
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3

CATALOG_REL_PATH = "qgi-docs/methodology/indicator-catalog-detailed.md"
ALLOW_LIST_REL_PATH = "qgi-data/reference/indicator-allow-list.json"
INDICATOR_MAP_S3_KEY = "pipeline-A-indicator-extractor/input/indicator_map.csv"

# Strict catalog-row regex. Captures:
#   group 1: catalog code (e.g. WB-01, VD-12)
#   group 2: API code (column 2, must match WB-style dotted code OR
#            V-Dem-style snake_case identifier — both restricted to
#            [A-Za-z0-9._] which excludes spaces / parens / commas
#            present in descriptive UCDP/GDELT/etc. names)
CATALOG_ROW_RE = re.compile(
    r"^\| ([A-Z]+-[A-Z0-9]+) \| ([A-Za-z0-9._]+) \|"
)

# Repo-root anchor: this script lives at qgi-ml/scripts/, so root is parents[2].
SCRIPT_PATH = Path(__file__).resolve()
REPO_ROOT = SCRIPT_PATH.parents[2]


def parse_catalog(catalog_path: Path) -> list[tuple[str, str]]:
    """Return [(catalog_code, api_code), ...] sorted by catalog_code.

    Only rows where column 2 is a clean API code are returned. Rows
    where column 2 is a descriptive name (UCDP, GDELT, etc.) are
    filtered by the regex.
    """
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catalog not found at {catalog_path}")
    rows: list[tuple[str, str]] = []
    with catalog_path.open(encoding="utf-8") as fh:
        for line in fh:
            m = CATALOG_ROW_RE.match(line)
            if m:
                rows.append((m.group(1), m.group(2)))
    rows.sort(key=lambda r: r[0])
    return rows


def fetch_indicator_map(bucket: str) -> dict[str, int]:
    """Read indicator_map.csv from S3 and return {id_string: numeric_id}."""
    s3 = boto3.client("s3")
    obj = s3.get_object(Bucket=bucket, Key=INDICATOR_MAP_S3_KEY)
    raw = obj["Body"].read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(raw))
    out: dict[str, int] = {}
    for row in reader:
        try:
            out[row["id_string"].strip()] = int(row["numeric_id"])
        except (ValueError, KeyError):
            continue
    return out


def build_allow_list(
    catalog: list[tuple[str, str]], id_to_num: dict[str, int]
) -> tuple[list[int], list[tuple[str, str]], list[tuple[str, str]]]:
    """Return (sorted_numeric_ids, resolved_pairs, unresolved_pairs).

    resolved_pairs = catalog rows whose API code IS in indicator_map.
    unresolved_pairs = catalog rows whose API code is NOT in indicator_map
        (these are catalog entries waiting on provider ingestion).
    """
    resolved: list[tuple[str, str]] = []
    unresolved: list[tuple[str, str]] = []
    nums: set[int] = set()
    for cat_code, api_code in catalog:
        if api_code in id_to_num:
            resolved.append((cat_code, api_code))
            nums.add(id_to_num[api_code])
        else:
            unresolved.append((cat_code, api_code))
    return sorted(nums), resolved, unresolved


def build_json_payload(
    bucket: str,
    catalog_rows_total: int,
    resolved: list[tuple[str, str]],
    unresolved: list[tuple[str, str]],
    numeric_ids: list[int],
    catalog_sha256: str,
) -> dict:
    """Build the deterministic JSON payload."""
    return {
        "schema_version": 1,
        "generator": "qgi-ml/scripts/generate_indicator_allow_list.py",
        "purpose": (
            "Allow-list of indicator numeric_ids permitted in "
            "qgi_data.recipes_aggregated.indicator_fingerprint. Read by "
            "pipeline-recipe-engine-finalize Lambda's "
            "write_recipes_aggregated_table() per #591 Option D. "
            "The catalog IS the contract: every new indicator must be "
            "curated into qgi-docs/methodology/indicator-catalog-detailed.md "
            "with a parseable API code before its numeric_id appears here."
        ),
        "sources": {
            "catalog_markdown": CATALOG_REL_PATH,
            "catalog_sha256": catalog_sha256,
            "indicator_map_s3_key": (
                f"s3://{bucket}/{INDICATOR_MAP_S3_KEY}"
            ),
        },
        "counts": {
            "catalog_entries_total": catalog_rows_total,
            "catalog_entries_with_api_code": len(resolved) + len(unresolved),
            "catalog_entries_resolved_to_numeric_id": len(resolved),
            "catalog_entries_pending_ingestion": len(unresolved),
            "numeric_ids_in_allow_list": len(numeric_ids),
        },
        "resolved": [
            {"catalog_code": cc, "api_code": ac, "numeric_id": None}
            for cc, ac in resolved
        ],
        "unresolved_pending_ingestion": [
            {"catalog_code": cc, "api_code": ac} for cc, ac in unresolved
        ],
        "allow_list_numeric_ids": numeric_ids,
    }


def fill_resolved_numeric_ids(payload: dict, id_to_num: dict[str, int]) -> None:
    """Populate the numeric_id field on each resolved entry post-build."""
    for entry in payload["resolved"]:
        entry["numeric_id"] = id_to_num[entry["api_code"]]


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--bucket", required=True,
                        help="S3 bucket containing indicator_map.csv")
    parser.add_argument("--catalog-path", default=str(REPO_ROOT / CATALOG_REL_PATH),
                        help="Path to indicator-catalog-detailed.md")
    parser.add_argument("--output-path", default=str(REPO_ROOT / ALLOW_LIST_REL_PATH),
                        help="Path to write indicator-allow-list.json")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print to stdout instead of writing.")
    args = parser.parse_args()

    catalog_path = Path(args.catalog_path)
    print(f"Reading catalog: {catalog_path}", file=sys.stderr)
    raw_catalog_bytes = catalog_path.read_bytes()
    catalog_sha256 = hashlib.sha256(raw_catalog_bytes).hexdigest()

    catalog = parse_catalog(catalog_path)
    print(f"  parsed {len(catalog)} rows with parseable API codes "
          "(of 142 total catalog entries)", file=sys.stderr)

    print(f"Fetching indicator_map: s3://{args.bucket}/{INDICATOR_MAP_S3_KEY}",
          file=sys.stderr)
    id_to_num = fetch_indicator_map(args.bucket)
    print(f"  loaded {len(id_to_num)} id_string -> numeric_id rows",
          file=sys.stderr)

    numeric_ids, resolved, unresolved = build_allow_list(catalog, id_to_num)

    # Total catalog entries (all 142) — count rows of `| <prefix>-<NN> |`.
    total_re = re.compile(r"^\| [A-Z]+-[A-Z0-9]+ \|")
    catalog_total = sum(1 for line in catalog_path.read_text(encoding="utf-8")
                        .splitlines() if total_re.match(line))

    payload = build_json_payload(
        bucket=args.bucket,
        catalog_rows_total=catalog_total,
        resolved=resolved,
        unresolved=unresolved,
        numeric_ids=numeric_ids,
        catalog_sha256=catalog_sha256,
    )
    fill_resolved_numeric_ids(payload, id_to_num)

    rendered = json.dumps(payload, indent=2, sort_keys=False) + "\n"

    print(f"\n--- Summary ---", file=sys.stderr)
    print(f"  Catalog entries (total):           {catalog_total}", file=sys.stderr)
    print(f"  Catalog with parseable API code:   {len(catalog)}", file=sys.stderr)
    print(f"  Resolved to numeric_id:            {len(resolved)}", file=sys.stderr)
    print(f"  Pending provider ingestion:        {len(unresolved)}", file=sys.stderr)
    print(f"  Allow-list numeric_ids (unique):   {len(numeric_ids)}", file=sys.stderr)

    if args.dry_run:
        print(rendered)
        return 0

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(rendered, encoding="utf-8")
    print(f"\nWrote {output_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
