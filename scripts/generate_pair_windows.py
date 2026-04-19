#!/usr/bin/env python3
"""
generate_pair_windows.py  —  Ticket #352

Runs two Athena queries against qgi_data.patterns and produces two artefacts:

1.  data/pair-windows/{country_a_id}.json   (one file per country_a_id)
      keyed by country_b_id, each value has
        - "top" : top-N windows for that pair (sorted by PPS desc)
        - "hist": length-histogram (length -> count)
      Schema matches what /api/patterns/windows/route.ts expects as the baked
      fallback.

2.  data/analogues.json                     (in place)
    data/analogues-enriched.json            (in place)
      Each analogue entry gets these extra fields so the "View pattern" link
      on PrecedentDetailClient can deep-link to S3 pattern detail:
        - best_pattern_length
        - best_pattern_start_a
        - best_pattern_start_b

One-shot script — run after any pipeline refresh that updates qgi_data.patterns.

Usage:

    export AWS_ACCESS_KEY_ID=...
    export AWS_SECRET_ACCESS_KEY=...
    export AWS_SESSION_TOKEN=...
    python qgi-ml/scripts/generate_pair_windows.py \
        --bucket qgi-data-lake-222222222222 \
        --region eu-central-1
"""
from __future__ import annotations
import argparse
import json
import time
import sys
import os
from pathlib import Path
from collections import defaultdict
import boto3

WORKGROUP = "QGI-Lambda-Workgroup"
DATABASE = "qgi_data"
TOP_N_PER_PAIR = 20

SQL_TOP_N = f"""
SELECT country_a_id, country_b_id, length, start_year_a, start_year_b,
       indicator_count, avg_correlation, pattern_power_score
FROM (
  SELECT country_a_id, country_b_id, length, start_year_a, start_year_b,
         indicator_count, avg_correlation, pattern_power_score,
         ROW_NUMBER() OVER (
           PARTITION BY country_a_id, country_b_id
           ORDER BY pattern_power_score DESC
         ) AS rn
  FROM {DATABASE}.patterns
)
WHERE rn <= {TOP_N_PER_PAIR}
"""

SQL_HIST = f"""
SELECT country_a_id, country_b_id, length, COUNT(*) AS cnt
FROM {DATABASE}.patterns
GROUP BY country_a_id, country_b_id, length
"""


def run_query(athena, sql: str, bucket: str, poll_seconds: float = 3.0) -> list[dict]:
    """Submit to Athena, poll, paginate results, return list of dicts."""
    print(f"[athena] submitting: {sql.strip().splitlines()[0][:80]}...")
    t0 = time.time()
    r = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": DATABASE},
        ResultConfiguration={"OutputLocation": f"s3://{bucket}/query_results/"},
        WorkGroup=WORKGROUP,
    )
    qid = r["QueryExecutionId"]
    while True:
        st = athena.get_query_execution(QueryExecutionId=qid)["QueryExecution"]["Status"]
        state = st["State"]
        if state == "SUCCEEDED":
            break
        if state in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"Athena {state}: {st.get('StateChangeReason', '?')}")
        time.sleep(poll_seconds)
    t_exec = time.time() - t0
    print(f"[athena] succeeded in {t_exec:.1f}s; paginating results ...")

    rows: list[dict] = []
    header: list[str] | None = None
    paginator = athena.get_paginator("get_query_results")
    for page_i, page in enumerate(paginator.paginate(QueryExecutionId=qid, PaginationConfig={"PageSize": 1000})):
        for row in page["ResultSet"]["Rows"]:
            vals = [c.get("VarCharValue", "") for c in row["Data"]]
            if header is None:
                header = vals
            else:
                rows.append(dict(zip(header, vals)))
        if page_i and page_i % 50 == 0:
            print(f"[athena] ... {len(rows):,} rows so far")
    print(f"[athena] done: {len(rows):,} rows total")
    return rows


def num(s):
    """Parse number string. Handles empty → None."""
    if s is None or s == "":
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--bucket", required=True, help="S3 bucket for Athena query results (e.g. qgi-data-lake-222222222222)")
    p.add_argument("--region", default="eu-central-1")
    p.add_argument("--pair-windows-dir", default=None,
                   help="Output dir for per-country_a JSON files. Default: qgi-frontend/data/pair-windows/")
    p.add_argument("--analogues-path", default=None,
                   help="Path to analogues.json to enrich in-place. Default: qgi-frontend/data/analogues.json")
    p.add_argument("--analogues-enriched-path", default=None,
                   help="Path to analogues-enriched.json. Default: qgi-frontend/data/analogues-enriched.json")
    p.add_argument("--dry-run", action="store_true", help="Run queries + compute, but do not write files")
    args = p.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    pair_windows_dir = Path(args.pair_windows_dir or (repo_root / "qgi-frontend" / "data" / "pair-windows"))
    analogues_path = Path(args.analogues_path or (repo_root / "qgi-frontend" / "data" / "analogues.json"))
    analogues_enriched_path = Path(args.analogues_enriched_path or (repo_root / "qgi-frontend" / "data" / "analogues-enriched.json"))

    print(f"repo_root             = {repo_root}")
    print(f"pair_windows_dir      = {pair_windows_dir}")
    print(f"analogues_path        = {analogues_path}")
    print(f"enriched analogues    = {analogues_enriched_path}")
    print(f"dry_run               = {args.dry_run}")

    athena = boto3.client("athena", region_name=args.region)

    # ============================
    # Query 1: top-N windows per pair
    # ============================
    print("\n=== Query 1: top-N windows per pair ===")
    top_rows = run_query(athena, SQL_TOP_N, args.bucket)

    # Build per-country_a structure
    out: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"top": [], "hist": {}}))
    best_per_pair: dict[tuple[str, str], dict] = {}

    for r in top_rows:
        ca = str(r.get("country_a_id"))
        cb = str(r.get("country_b_id"))
        l = num(r.get("length"))
        sa = num(r.get("start_year_a"))
        sb = num(r.get("start_year_b"))
        ic = num(r.get("indicator_count"))
        ac = num(r.get("avg_correlation"))
        pps = num(r.get("pattern_power_score"))
        if None in (l, sa, sb, ic, ac, pps):
            continue
        entry = {"l": int(l), "sa": int(sa), "sb": int(sb), "ic": int(ic),
                 "ac": float(ac), "pps": float(pps)}
        out[ca][cb]["top"].append(entry)

    # Sort each top list DESC by pps (paranoia — should already be DESC from SQL)
    for ca, partners in out.items():
        for cb, data in partners.items():
            data["top"].sort(key=lambda x: -x["pps"])
            if data["top"]:
                best_per_pair[(ca, cb)] = data["top"][0]

    print(f"[agg] unique country_a values: {len(out)}")
    print(f"[agg] unique (a,b) pairs:     {len(best_per_pair)}")

    # ============================
    # Query 2: length histograms
    # ============================
    print("\n=== Query 2: length histograms ===")
    hist_rows = run_query(athena, SQL_HIST, args.bucket)
    for r in hist_rows:
        ca = str(r.get("country_a_id"))
        cb = str(r.get("country_b_id"))
        l = num(r.get("length"))
        cnt = num(r.get("cnt"))
        if None in (l, cnt):
            continue
        out[ca][cb]["hist"][str(int(l))] = int(cnt)

    # ============================
    # Write pair-windows files
    # ============================
    if args.dry_run:
        print("\n[DRY] would write", len(out), "pair-windows JSON files")
    else:
        pair_windows_dir.mkdir(parents=True, exist_ok=True)
        for ca, partners in out.items():
            path = pair_windows_dir / f"{ca}.json"
            with path.open("w", encoding="utf-8") as f:
                # compact encoding; these are data files, not meant for humans
                json.dump(dict(partners), f, separators=(",", ":"))
        print(f"\n[write] pair-windows: {len(out)} files -> {pair_windows_dir}")

    # ============================
    # Enrich analogues.json
    # ============================
    if analogues_path.exists():
        with analogues_path.open("r", encoding="utf-8") as f:
            analogues = json.load(f)
        enriched = 0
        total = 0
        for ca, cats in analogues.items():
            for cat, entries in cats.items():
                for entry in entries:
                    total += 1
                    key = (str(ca), str(entry.get("country_b_id")))
                    best = best_per_pair.get(key)
                    if best:
                        entry["best_pattern_length"] = best["l"]
                        entry["best_pattern_start_a"] = best["sa"]
                        entry["best_pattern_start_b"] = best["sb"]
                        enriched += 1
        print(f"\n[analogues] enriched {enriched}/{total} entries in {analogues_path}")
        if not args.dry_run:
            with analogues_path.open("w", encoding="utf-8") as f:
                json.dump(analogues, f, indent=2)
    else:
        print(f"[analogues] file not found: {analogues_path}")

    # ============================
    # Enrich analogues-enriched.json (has extra nested structure: .countries[ca][cat] = {subject, analogues[]})
    # ============================
    if analogues_enriched_path.exists():
        with analogues_enriched_path.open("r", encoding="utf-8") as f:
            enriched_doc = json.load(f)
        enriched2 = 0
        total2 = 0
        countries_map = enriched_doc.get("countries", {})
        for ca, cats in countries_map.items():
            for cat, section in cats.items():
                analogues_list = section.get("analogues", [])
                for entry in analogues_list:
                    total2 += 1
                    key = (str(ca), str(entry.get("country_b_id")))
                    best = best_per_pair.get(key)
                    if best:
                        entry["best_pattern_length"] = best["l"]
                        entry["best_pattern_start_a"] = best["sa"]
                        entry["best_pattern_start_b"] = best["sb"]
                        enriched2 += 1
        print(f"[analogues-enriched] enriched {enriched2}/{total2} entries in {analogues_enriched_path}")
        if not args.dry_run:
            with analogues_enriched_path.open("w", encoding="utf-8") as f:
                json.dump(enriched_doc, f, indent=2)
    else:
        print(f"[analogues-enriched] file not found: {analogues_enriched_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
