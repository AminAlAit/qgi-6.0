"""
spot_check_scdi_compaction.py — Step 4 distributional spot-checks for
single-country smoke compaction.

# THROWAWAY — run once after Step 3 verify passes; before Step 5.

For one country_a_id, runs 3 paired Athena queries against:
  - qgi_data.scdis (source)
  - scdis_compacted_smoke_verify (compacted, temp table)

Compares each aggregate row-by-row. Per Phase 5 v0.0 spec acceptance
criterion: ANY deviation > 0.1% in ANY aggregate halts.

Aggregates checked (from phase-5-v0.0.md Step 4):
  Q1: AVG(correlation), AVG(length), COUNT(*)
  Q2: COUNT(*) per indicator_numeric_id
  Q3: MIN(start_year_a), MAX(start_year_a), AVG(length)

Cost: ~$0.001 (6 small Athena queries, partition-pruned to one country).

Usage:
  python scripts/spot_check_scdi_compaction.py \\
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
TOLERANCE = 0.001  # 0.1%


def athena_query(client, workgroup: str, sql: str) -> list[list[str]]:
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


def rel_delta(src: float, tgt: float) -> float:
    """Relative deviation. Returns 0 if both are 0; abs(t-s)/abs(s) otherwise."""
    if src == 0 and tgt == 0:
        return 0.0
    if src == 0:
        return float("inf")
    return abs(tgt - src) / abs(src)


def fmt_pct(x: float) -> str:
    if x == float("inf"):
        return "  inf%"
    return f"{x * 100:>6.4f}%"


def check_aggregate(name: str, src_val: str, tgt_val: str,
                    is_int: bool, breaches: list) -> None:
    s = float(src_val) if src_val else 0.0
    t = float(tgt_val) if tgt_val else 0.0
    delta = rel_delta(s, t)
    breach = delta > TOLERANCE
    sfmt = f"{int(s):>14,}" if is_int else f"{s:>14.6f}"
    tfmt = f"{int(t):>14,}" if is_int else f"{t:>14.6f}"
    marker = "FAIL" if breach else "ok"
    print(f"  {name:<28}  {sfmt}  {tfmt}  {fmt_pct(delta)}  {marker}")
    if breach:
        breaches.append((name, s, t, delta))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--country-id", type=int, required=True)
    parser.add_argument("--workgroup", default="QGI-Lambda-Workgroup")
    parser.add_argument("--target-prefix", default=DEFAULT_TARGET_PREFIX)
    args = parser.parse_args()

    client = boto3.client("athena")
    tgt_location = f"s3://{args.bucket}/{args.target_prefix}"
    cid = args.country_id
    breaches: list = []

    print(f"[setup] Dropping any prior temp table {GLUE_DB}.{TEMP_TABLE}")
    try:
        athena_query(client, args.workgroup,
                     f"DROP TABLE IF EXISTS {GLUE_DB}.{TEMP_TABLE}")
    except Exception as exc:
        print(f"  warning: drop failed (continuing): {exc}")

    try:
        print(f"[setup] Creating temp table -> {tgt_location}")
        athena_query(client, args.workgroup, f"""
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
        """)
        athena_query(client, args.workgroup,
                     f"MSCK REPAIR TABLE {GLUE_DB}.{TEMP_TABLE}")

        # ---- Q1: scalar aggregates ----
        print(f"\n[Q1] AVG(correlation), AVG(length), COUNT(*) "
              f"WHERE country_a_id={cid}")
        q1_src = athena_query(client, args.workgroup,
            f"SELECT AVG(correlation), AVG(length), COUNT(*) "
            f"FROM qgi_data.scdis WHERE country_a_id={cid}")[0]
        q1_tgt = athena_query(client, args.workgroup,
            f"SELECT AVG(correlation), AVG(length), COUNT(*) "
            f"FROM {GLUE_DB}.{TEMP_TABLE} WHERE country_a_id={cid}")[0]
        print(f"  {'aggregate':<28}  {'source':>14}  {'compacted':>14}  "
              f"{'rel_delta':>7}  status")
        print(f"  {'-' * 28}  {'-' * 14}  {'-' * 14}  {'-' * 7}  ------")
        check_aggregate("AVG(correlation)", q1_src[0], q1_tgt[0], False, breaches)
        check_aggregate("AVG(length)", q1_src[1], q1_tgt[1], False, breaches)
        check_aggregate("COUNT(*)", q1_src[2], q1_tgt[2], True, breaches)

        # ---- Q2: per-indicator stratum ----
        print(f"\n[Q2] COUNT(*) per indicator_numeric_id WHERE country_a_id={cid}")
        q2_src = athena_query(client, args.workgroup,
            f"SELECT indicator_numeric_id, COUNT(*) FROM qgi_data.scdis "
            f"WHERE country_a_id={cid} GROUP BY indicator_numeric_id "
            f"ORDER BY indicator_numeric_id")
        q2_tgt = athena_query(client, args.workgroup,
            f"SELECT indicator_numeric_id, COUNT(*) FROM {GLUE_DB}.{TEMP_TABLE} "
            f"WHERE country_a_id={cid} GROUP BY indicator_numeric_id "
            f"ORDER BY indicator_numeric_id")
        src_map = {int(r[0]): int(r[1]) for r in q2_src}
        tgt_map = {int(r[0]): int(r[1]) for r in q2_tgt}
        all_ids = sorted(set(src_map) | set(tgt_map))
        print(f"  Indicators present: source={len(src_map)}, "
              f"compacted={len(tgt_map)}, union={len(all_ids)}")
        # Only print breaches & non-matching strata explicitly; print
        # summary line for matches.
        matched = 0
        for ind in all_ids:
            s = src_map.get(ind, 0)
            t = tgt_map.get(ind, 0)
            d = rel_delta(s, t)
            if d > TOLERANCE:
                check_aggregate(f"  ind={ind} COUNT(*)", str(s), str(t),
                                True, breaches)
            else:
                matched += 1
        print(f"  {matched}/{len(all_ids)} indicator strata match within "
              f"{TOLERANCE * 100:.1f}% tolerance")

        # ---- Q3: temporal coverage ----
        print(f"\n[Q3] MIN/MAX(start_year_a), AVG(length) "
              f"WHERE country_a_id={cid}")
        q3_src = athena_query(client, args.workgroup,
            f"SELECT MIN(start_year_a), MAX(start_year_a), AVG(length) "
            f"FROM qgi_data.scdis WHERE country_a_id={cid}")[0]
        q3_tgt = athena_query(client, args.workgroup,
            f"SELECT MIN(start_year_a), MAX(start_year_a), AVG(length) "
            f"FROM {GLUE_DB}.{TEMP_TABLE} WHERE country_a_id={cid}")[0]
        print(f"  {'aggregate':<28}  {'source':>14}  {'compacted':>14}  "
              f"{'rel_delta':>7}  status")
        print(f"  {'-' * 28}  {'-' * 14}  {'-' * 14}  {'-' * 7}  ------")
        check_aggregate("MIN(start_year_a)", q3_src[0], q3_tgt[0], True, breaches)
        check_aggregate("MAX(start_year_a)", q3_src[1], q3_tgt[1], True, breaches)
        check_aggregate("AVG(length)", q3_src[2], q3_tgt[2], False, breaches)

    finally:
        print(f"\n[teardown] Dropping temp table {GLUE_DB}.{TEMP_TABLE}")
        try:
            athena_query(client, args.workgroup,
                         f"DROP TABLE IF EXISTS {GLUE_DB}.{TEMP_TABLE}")
        except Exception as exc:
            print(f"  warning: drop failed: {exc}")

    if breaches:
        print(f"\nFAIL: {len(breaches)} aggregate(s) breach the "
              f"{TOLERANCE * 100:.1f}% tolerance. HALT — investigate before "
              f"Glue swap.")
        for name, s, t, d in breaches:
            print(f"  {name}: src={s} tgt={t} rel_delta={d:.6f}")
        return 1

    print(f"\nPASS: all aggregates within {TOLERANCE * 100:.1f}% tolerance "
          f"for country_a_id={cid}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
