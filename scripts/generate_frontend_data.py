#!/usr/bin/env python3
"""
Generate baked frontend JSON data from Athena pipeline outputs.
Run after each pipeline completion alongside generate_country_risks.py.

Produces:
  1. country-partners-index.json — partner lookup for /patterns S1 (GH#274)
  2. Extends country-risks.json with pattern_density + top_partners (GH#275)

Usage:
    python generate_frontend_data.py \
        --bucket qgi-data-lake-222222222222 \
        --region eu-central-1 \
        --frontend-dir ../qgi-frontend/data
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import boto3


def run_athena_query(athena, query: str, workgroup: str, database: str) -> str:
    """Submit Athena query and wait for results. Returns query execution ID."""
    resp = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={"Database": database},
        WorkGroup=workgroup,
    )
    qid = resp["QueryExecutionId"]
    while True:
        status = athena.get_query_execution(QueryExecutionId=qid)
        state = status["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED",):
            return qid
        if state in ("FAILED", "CANCELLED"):
            reason = status["QueryExecution"]["Status"].get("StateChangeReason", "")
            raise RuntimeError(f"Athena query {state}: {reason}")
        time.sleep(2)


def get_athena_results(athena, qid: str) -> list[dict]:
    """Fetch all rows from an Athena query result."""
    rows = []
    paginator = athena.get_paginator("get_query_results")
    for page in paginator.paginate(QueryExecutionId=qid):
        result_rows = page["ResultSet"]["Rows"]
        if not rows:
            # First page: first row is header
            headers = [col["VarCharValue"] for col in result_rows[0]["Data"]]
            data_rows = result_rows[1:]
        else:
            data_rows = result_rows
        for row in data_rows:
            values = [col.get("VarCharValue", "") for col in row["Data"]]
            rows.append(dict(zip(headers, values)))
    return rows


def generate_partners_index(athena, s3, bucket: str, workgroup: str, database: str, frontend_dir: Path):
    """GH#274: Generate country-partners-index.json for /patterns S1."""
    print("\n=== Generating country-partners-index.json (GH#274) ===")

    query = """
    SELECT
        country_a_id,
        country_b_id,
        count(*) as window_count,
        max(pattern_power_score) as best_pps,
        avg(avg_correlation) as mean_corr,
        min(length) as min_length,
        max(length) as max_length,
        count(DISTINCT length) as length_count
    FROM qgi_data.patterns
    GROUP BY country_a_id, country_b_id
    """

    print("  Running Athena query (scanning patterns table)...")
    qid = run_athena_query(athena, query, workgroup, database)
    print(f"  Query completed: {qid}")

    rows = get_athena_results(athena, qid)
    print(f"  Got {len(rows)} country pairs")

    # Load country names
    countries_file = frontend_dir / "countries.json"
    if countries_file.exists():
        with open(countries_file) as f:
            countries_list = json.load(f)
        id_to_name = {str(c["id"]): c["name"] for c in countries_list}
        id_to_alpha2 = {str(c["id"]): c.get("alpha_2", "") for c in countries_list}
    else:
        id_to_name = {}
        id_to_alpha2 = {}

    # Build index: {country_a_id -> [{partner_id, partner_name, alpha2, window_count, best_pps, mean_corr, lengths}]}
    index: dict[str, list] = {}
    for row in rows:
        a_id = row["country_a_id"]
        b_id = row["country_b_id"]
        if a_id not in index:
            index[a_id] = []
        index[a_id].append({
            "p": int(b_id),
            "n": id_to_name.get(b_id, f"Country {b_id}"),
            "a2": id_to_alpha2.get(b_id, ""),
            "w": int(row["window_count"]),
            "pps": round(float(row["best_pps"]), 2),
            "c": round(float(row["mean_corr"]), 3),
            "lmin": int(row["min_length"]),
            "lmax": int(row["max_length"]),
            "lc": int(row["length_count"]),
        })

    # Sort each country's partners by best_pps descending
    for a_id in index:
        index[a_id].sort(key=lambda x: x["pps"], reverse=True)

    out_path = frontend_dir / "country-partners-index.json"
    with open(out_path, "w") as f:
        json.dump(index, f, separators=(",", ":"))
    size_kb = os.path.getsize(out_path) / 1024
    print(f"  Wrote {out_path} ({size_kb:.0f} KB, {len(index)} countries)")


def generate_pattern_density(athena, workgroup: str, database: str) -> dict:
    """GH#275: Query pattern density by year per country."""
    print("\n=== Generating pattern density data (GH#275) ===")

    query = """
    SELECT country_a_id, start_year_a as year, count(*) as cnt
    FROM qgi_data.patterns
    GROUP BY country_a_id, start_year_a
    ORDER BY country_a_id, start_year_a
    """

    print("  Running Athena query...")
    qid = run_athena_query(athena, query, workgroup, database)
    rows = get_athena_results(athena, qid)
    print(f"  Got {len(rows)} density rows")

    # Build {country_id -> {years: [...], counts: [...], total: N}}
    density: dict[str, dict] = {}
    for row in rows:
        cid = row["country_a_id"]
        if cid not in density:
            density[cid] = {"years": [], "counts": [], "total": 0}
        density[cid]["years"].append(int(row["year"]))
        cnt = int(row["cnt"])
        density[cid]["counts"].append(cnt)
        density[cid]["total"] += cnt

    print(f"  Pattern density computed for {len(density)} countries")
    return density


def generate_structural_twins(athena, workgroup: str, database: str) -> dict:
    """GH#275: Query top 5 structural twins per country from patterns table."""
    print("\n=== Generating structural twins data (GH#275) ===")

    query = """
    SELECT country_a_id, country_b_id, count(*) as pattern_count,
           avg(avg_correlation) as mean_corr,
           max(pattern_power_score) as best_pps
    FROM qgi_data.patterns
    GROUP BY country_a_id, country_b_id
    """

    print("  Running Athena query...")
    qid = run_athena_query(athena, query, workgroup, database)
    rows = get_athena_results(athena, qid)
    print(f"  Got {len(rows)} pair rows")

    # Build top 5 per country
    pairs: dict[str, list] = {}
    for row in rows:
        a_id = row["country_a_id"]
        if a_id not in pairs:
            pairs[a_id] = []
        pairs[a_id].append({
            "partner_id": int(row["country_b_id"]),
            "pattern_count": int(row["pattern_count"]),
            "mean_corr": round(float(row["mean_corr"]), 3),
            "best_pps": round(float(row["best_pps"]), 2),
        })

    twins: dict[str, list] = {}
    for a_id, partner_list in pairs.items():
        partner_list.sort(key=lambda x: x["pattern_count"], reverse=True)
        twins[a_id] = partner_list[:5]

    print(f"  Structural twins computed for {len(twins)} countries")
    return twins


def generate_pair_windows(athena, workgroup: str, database: str, frontend_dir: Path, limit: int | None = None):
    """GH#281: Pre-compute per-pair pattern windows as baked JSON files.

    Writes one file per predictor country to
    frontend_dir/pair-windows/{country_a_id}.json

    Each file is keyed by country_b_id and contains:
      "top"  — up to 200 windows sorted by pps desc
                (keys: l, sa, sb, ic, ac, pps)
      "hist" — {length: window_count} frequency map

    Args:
        limit: if set, appends LIMIT <n> to the query (useful for local
               testing against the full table without scanning 2 B rows).
    """
    print("\n=== Generating pair-windows files (GH#281) ===")

    limit_clause = f"\nLIMIT {limit}" if limit else ""
    query = f"""
    SELECT country_a_id, country_b_id, length, start_year_a, start_year_b,
           indicator_count, avg_correlation, pattern_power_score
    FROM qgi_data.patterns
    ORDER BY country_a_id, country_b_id, pattern_power_score DESC{limit_clause}
    """

    print("  Running Athena query (large scan — may take several minutes)...")
    qid = run_athena_query(athena, query, workgroup, database)
    print(f"  Query completed: {qid}. Streaming results...")

    out_dir = frontend_dir / "pair-windows"
    out_dir.mkdir(parents=True, exist_ok=True)

    TOP_N = 200
    current_a_id: str | None = None
    # {country_b_id: [window dicts]}
    pairs_buf: dict[str, list[dict]] = {}
    files_written = 0
    total_rows = 0

    def flush(a_id: str, buf: dict[str, list[dict]]) -> None:
        output: dict[str, dict] = {}
        for b_id, windows in buf.items():
            hist: dict[str, int] = {}
            for w in windows:
                if w["l"] is not None:
                    k = str(w["l"])
                    hist[k] = hist.get(k, 0) + 1
            output[b_id] = {"top": windows, "hist": hist}
        path = out_dir / f"{a_id}.json"
        with open(path, "w") as fp:
            json.dump(output, fp, separators=(",", ":"))

    # Paginate results
    headers = None
    next_token = None
    paginator = athena.get_paginator("get_query_results")
    pages = paginator.paginate(QueryExecutionId=qid, PaginationConfig={"PageSize": 1000})

    for page in pages:
        page_rows = page["ResultSet"]["Rows"]
        if headers is None:
            headers = [col["VarCharValue"] for col in page_rows[0]["Data"]]
            data_rows = page_rows[1:]
        else:
            data_rows = page_rows

        for raw in data_rows:
            cells = raw.get("Data", [])
            row = {headers[i]: cells[i].get("VarCharValue", "") if i < len(cells) else "" for i in range(len(headers))}
            total_rows += 1

            a_id = row["country_a_id"]
            b_id = row["country_b_id"]

            if current_a_id is not None and a_id != current_a_id:
                flush(current_a_id, pairs_buf)
                files_written += 1
                pairs_buf = {}

            current_a_id = a_id

            pair_list = pairs_buf.setdefault(b_id, [])
            if len(pair_list) < TOP_N:
                try:
                    pair_list.append({
                        "l":   int(float(row["length"])) if row["length"] else None,
                        "sa":  int(float(row["start_year_a"])) if row["start_year_a"] else None,
                        "sb":  int(float(row["start_year_b"])) if row["start_year_b"] else None,
                        "ic":  int(float(row["indicator_count"])) if row["indicator_count"] else None,
                        "ac":  round(float(row["avg_correlation"]), 3) if row["avg_correlation"] else 0.0,
                        "pps": round(float(row["pattern_power_score"]), 2) if row["pattern_power_score"] else 0.0,
                    })
                except (ValueError, TypeError):
                    pass

        if total_rows % 500_000 == 0 and total_rows > 0:
            print(f"    {total_rows:,} rows processed, {files_written} files written")

    if current_a_id is not None and pairs_buf:
        flush(current_a_id, pairs_buf)
        files_written += 1

    total_kb = sum(f.stat().st_size for f in out_dir.glob("*.json")) / 1024
    print(f"  Wrote {files_written} files to {out_dir}/ ({total_rows:,} rows, {total_kb:.0f} KB total)")


def generate_analogues(athena, workgroup: str, database: str, frontend_dir: Path, id_to_name: dict, id_to_alpha2: dict):
    """GH#280: Generate analogues.json — top 5 historical analogues per (country, category)."""
    print("\n=== Generating analogues.json (GH#280) ===")

    query = """
    WITH ranked AS (
        SELECT
            country_a_id,
            event_category,
            country_b_id,
            country_b_name,
            COUNT(*) AS recipe_count,
            AVG(avg_correlation) AS mean_corr,
            MAX(pps) AS best_pps,
            AVG(median_lead_time_b) AS avg_lead_years,
            ROW_NUMBER() OVER (
                PARTITION BY country_a_id, event_category
                ORDER BY COUNT(*) DESC, MAX(pps) DESC
            ) AS rn
        FROM qgi_data.recipes
        GROUP BY country_a_id, event_category, country_b_id, country_b_name
    )
    SELECT country_a_id, event_category, country_b_id, country_b_name,
           recipe_count, mean_corr, best_pps, avg_lead_years
    FROM ranked
    WHERE rn <= 5
    ORDER BY country_a_id, event_category, rn
    """

    print("  Running Athena query (scanning recipes table)...")
    qid = run_athena_query(athena, query, workgroup, database)
    rows = get_athena_results(athena, qid)
    print(f"  Got {len(rows)} analogue rows")

    # Build nested structure: {country_a_id: {event_category: [analogues]}}
    data: dict[str, dict[str, list]] = {}
    for row in rows:
        a_id = row["country_a_id"]
        cat = row["event_category"]
        b_id = row["country_b_id"]
        if a_id not in data:
            data[a_id] = {}
        if cat not in data[a_id]:
            data[a_id][cat] = []
        data[a_id][cat].append({
            "country_b_id": int(b_id),
            "country_b_name": row.get("country_b_name") or id_to_name.get(b_id, f"Country {b_id}"),
            "alpha2": id_to_alpha2.get(b_id, ""),
            "recipe_count": int(row["recipe_count"]),
            "mean_corr": round(float(row["mean_corr"]), 3),
            "best_pps": round(float(row["best_pps"]), 1),
            "avg_lead_years": round(float(row["avg_lead_years"]), 1) if row.get("avg_lead_years") else None,
        })

    out = frontend_dir / "analogues.json"
    with open(out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size_kb = os.path.getsize(out) / 1024
    total_countries = len(data)
    total_categories = sum(len(cats) for cats in data.values())
    print(f"  Wrote {out} ({size_kb:.0f} KB, {total_countries} countries, {total_categories} country-category pairs)")


def main():
    parser = argparse.ArgumentParser(description="Generate baked frontend JSON data")
    parser.add_argument("--bucket", required=True, help="S3 data lake bucket")
    parser.add_argument("--region", default="eu-central-1")
    parser.add_argument("--frontend-dir", required=True, help="Path to qgi-frontend/data/")
    parser.add_argument("--workgroup", default="QGI-Lambda-Workgroup")
    parser.add_argument("--database", default="qgi_data")
    parser.add_argument("--skip-partners", action="store_true", help="Skip partners index")
    parser.add_argument("--skip-density", action="store_true", help="Skip pattern density")
    parser.add_argument("--skip-twins", action="store_true", help="Skip structural twins")
    parser.add_argument("--skip-analogues", action="store_true", help="Skip analogues")
    parser.add_argument("--skip-pair-windows", action="store_true", help="Skip pair windows pre-compute")
    parser.add_argument("--pair-windows-limit", type=int, default=None,
                        help="LIMIT rows for pair-windows query (local testing only)")
    args = parser.parse_args()

    frontend_dir = Path(args.frontend_dir)
    if not frontend_dir.exists():
        print(f"ERROR: Frontend data dir not found: {frontend_dir}")
        sys.exit(1)

    athena = boto3.client("athena", region_name=args.region)
    s3 = boto3.client("s3", region_name=args.region)

    # GH#274: Partners index
    if not args.skip_partners:
        generate_partners_index(athena, s3, args.bucket, args.workgroup, args.database, frontend_dir)

    # GH#275: Pattern density + structural twins → embed in country-risks.json
    density = {}
    twins = {}

    if not args.skip_density:
        density = generate_pattern_density(athena, args.workgroup, args.database)

    if not args.skip_twins:
        twins = generate_structural_twins(athena, args.workgroup, args.database)

    # Load country names for twin enrichment
    countries_file = frontend_dir / "countries.json"
    id_to_name = {}
    id_to_alpha2 = {}
    if countries_file.exists():
        with open(countries_file) as f:
            for c in json.load(f):
                id_to_name[str(c["id"])] = c["name"]
                id_to_alpha2[str(c["id"])] = c.get("alpha_2", "")

    # Enrich twins with names
    for cid in twins:
        for t in twins[cid]:
            pid = str(t["partner_id"])
            t["partner_name"] = id_to_name.get(pid, f"Country {pid}")
            t["alpha2"] = id_to_alpha2.get(pid, "")

    # GH#281: Pair windows (per-country baked files)
    if not args.skip_pair_windows:
        generate_pair_windows(
            athena, args.workgroup, args.database, frontend_dir,
            limit=args.pair_windows_limit,
        )

    # GH#280: Analogues
    if not args.skip_analogues:
        generate_analogues(athena, args.workgroup, args.database, frontend_dir, id_to_name, id_to_alpha2)

    # Write density and twins as separate files (cleaner than modifying country-risks.json)
    if density:
        out = frontend_dir / "pattern-density.json"
        with open(out, "w") as f:
            json.dump(density, f, separators=(",", ":"))
        size_kb = os.path.getsize(out) / 1024
        print(f"\n  Wrote {out} ({size_kb:.0f} KB)")

    if twins:
        out = frontend_dir / "structural-twins.json"
        with open(out, "w") as f:
            json.dump(twins, f, separators=(",", ":"))
        size_kb = os.path.getsize(out) / 1024
        print(f"  Wrote {out} ({size_kb:.0f} KB)")

    print("\n✓ Done!")


if __name__ == "__main__":
    main()
