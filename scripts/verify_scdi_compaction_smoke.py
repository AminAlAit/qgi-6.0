"""
verify_scdi_compaction_smoke.py — single-country Step 3 smoke verify.

# THROWAWAY — run once after compact_scdi_prefix.py --country-id N writes a
# new partition under scdis-compacted/. Confirms Athena can read the new
# file as a Hive partition AND that the row count matches the source.

Why this exists separately from verify_scdi_compaction.py: that script
runs an unfiltered COUNT(*) GROUP BY country_a_id across both tables,
which costs ~$0.75 (1.65M parquet footers on the source side). For the
smoke step with only one partition compacted, the unfiltered query
would report ~199 expected mismatches and waste $0.75 to teach us
nothing new. This variant filters both sides to a single country_a_id,
keeping cost to ~$0.005-0.01.

Usage:
  python scripts/verify_scdi_compaction_smoke.py \\
      --bucket qgi-data-lake-222222222222 \\
      --country-id 10
"""
from __future__ import annotations

import argparse
import sys
import time

import boto3

GLUE_DB = "qgi_data"
TEMP_TABLE = "scdis_compacted_smoke_verify"
DEFAULT_TARGET_PREFIX = "pipeline-B-scdi-finder/scdis-compacted/"


def athena_query(client, workgroup: str, sql: str) -> list[list[str]]:
    """Run a query in the given workgroup, block until done, return rows
    (excluding header) as list of cell-string lists.

    Workgroup must have EnforceWorkGroupConfiguration=true with an
    OutputLocation set (true for QGI-Lambda-Workgroup in staging).
    """
    qid = client.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": GLUE_DB},
        WorkGroup=workgroup,
    )["QueryExecutionId"]
    while True:
        time.sleep(1.5)
        s = client.get_query_execution(QueryExecutionId=qid)["QueryExecution"]
        state = s["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
    if state != "SUCCEEDED":
        reason = s["Status"].get("StateChangeReason", "")
        raise RuntimeError(f"Athena query {qid} {state}: {reason}\nSQL: {sql[:300]}")

    rows: list[list[str]] = []
    paginator = client.get_paginator("get_query_results")
    is_first = True
    for page in paginator.paginate(QueryExecutionId=qid):
        for row in page["ResultSet"]["Rows"]:
            if is_first:
                is_first = False
                continue
            rows.append([col.get("VarCharValue", "") for col in row["Data"]])
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--country-id", type=int, required=True)
    parser.add_argument("--workgroup", default="QGI-Lambda-Workgroup")
    parser.add_argument("--target-prefix", default=DEFAULT_TARGET_PREFIX)
    args = parser.parse_args()

    client = boto3.client("athena")
    tgt_location = f"s3://{args.bucket}/{args.target_prefix}"
    cid = args.country_id

    print(f"[1/5] Dropping any prior temp table {GLUE_DB}.{TEMP_TABLE}")
    try:
        athena_query(client, args.workgroup,
                     f"DROP TABLE IF EXISTS {GLUE_DB}.{TEMP_TABLE}")
    except Exception as exc:
        print(f"  warning: drop failed (continuing): {exc}")

    src_count = -1
    tgt_count = -1
    try:
        print(f"[2/5] Creating temp table {GLUE_DB}.{TEMP_TABLE} -> {tgt_location}")
        # Schema mirrors production scdis Glue table.
        create_sql = f"""
        CREATE EXTERNAL TABLE {GLUE_DB}.{TEMP_TABLE} (
            country_b_id          smallint,
            length                smallint,
            start_year_a          smallint,
            start_year_b          smallint,
            correlation           float,
            indicator_numeric_id  smallint,
            contains_predicted    boolean
        )
        PARTITIONED BY (country_a_id smallint)
        STORED AS PARQUET
        LOCATION '{tgt_location}'
        TBLPROPERTIES ('parquet.compress' = 'SNAPPY')
        """
        athena_query(client, args.workgroup, create_sql)
        athena_query(client, args.workgroup,
                     f"MSCK REPAIR TABLE {GLUE_DB}.{TEMP_TABLE}")

        print(f"[3/5] COUNT(*) source qgi_data.scdis WHERE country_a_id={cid}")
        src_rows = athena_query(
            client, args.workgroup,
            f"SELECT COUNT(*) FROM qgi_data.scdis WHERE country_a_id={cid}"
        )
        src_count = int(src_rows[0][0])

        print(f"[4/5] COUNT(*) compacted {GLUE_DB}.{TEMP_TABLE} WHERE country_a_id={cid}")
        tgt_rows = athena_query(
            client, args.workgroup,
            f"SELECT COUNT(*) FROM {GLUE_DB}.{TEMP_TABLE} WHERE country_a_id={cid}"
        )
        tgt_count = int(tgt_rows[0][0])
    finally:
        print(f"[5/5] Dropping temp table {GLUE_DB}.{TEMP_TABLE}")
        try:
            athena_query(client, args.workgroup,
                         f"DROP TABLE IF EXISTS {GLUE_DB}.{TEMP_TABLE}")
        except Exception as exc:
            print(f"  warning: drop failed: {exc}")

    print(f"\n  country_a_id={cid}")
    print(f"  source   COUNT(*): {src_count:>14,}")
    print(f"  compacted COUNT(*): {tgt_count:>14,}")
    if src_count == tgt_count and src_count > 0:
        print(f"\nPASS: row counts match. Athena reads compacted partition correctly.")
        return 0
    elif src_count == 0:
        print(f"\nFAIL: source table has 0 rows for country_a_id={cid}. "
              "Wrong country id or source prefix?")
        return 1
    else:
        print(f"\nFAIL: row count mismatch (delta={tgt_count - src_count}). "
              "DO NOT proceed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
