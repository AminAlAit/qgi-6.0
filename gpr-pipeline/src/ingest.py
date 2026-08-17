#!/usr/bin/env python3
"""
QGI-GPR weekly INGEST (Phase A) — extend gkg_gpr_flags_v2 forward one ISO week.

The ONLY billed step. Scans public GDELT GKG for the target week, flags the 8 GPR
categories (reusing the VALIDATED regexes from gpr_rollup_v2.load_categories -> the v3
dictionary, so the ingest is byte-identical to how the table was built), and APPENDS one
row per (doc, country, day) into the owned table.

Design (addresses the strict-purist review):
  * NO MERGE. Append-per-week, idempotency-guarded (skip a week already present) so we
    never scan the 2.6TB target table (the MERGE-on-partitioned-table cost landmine).
  * Every scan dry-runs FIRST; the write is hard-capped with --maximum_bytes_billed.
  * DRY-RUN by default. --execute performs the write (a BigQuery WRITE -> founder/WIF-SA
    only, per the GCP no-creds policy). This module NEVER writes without --execute.

Cost: ~3.22 GB / ~$0.02 per week (measured, column+partition-pruned).
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "gpr-build"))
import gpr_rollup_v2 as R2  # noqa: E402  (validated regex derivation + manifest ledger)

PROJECT = "extreme-lattice-344211"
OWNED = f"{PROJECT}.qgi_gdelt.gkg_gpr_flags_v2"
PUBLIC = "gdelt-bq.gdeltv2.gkg_partitioned"
BQ = os.environ.get("BQ_BIN", "bq")
WEEK_BYTES_CAP = 6_000_000_000        # ~6 GB hard cap per week (measured 3.22 GB)
MAX_WEEKS_PER_RUN = 8                  # bound catch-up cost even on a stale table
LAG_DAYS = 3                          # buffer for GDELT public-table ingestion lag before a week is "complete"


def _run(sql, dry_run=False, max_bytes=WEEK_BYTES_CAP, execute=False):
    sql = re.sub(r"\s+", " ", sql).strip()           # bq.cmd shim mangles multiline args
    cmd = [BQ, "query", "--use_legacy_sql=false", "--max_rows=1000000",
           f"--maximum_bytes_billed={max_bytes}"]
    if dry_run:
        out = subprocess.run(cmd + ["--dry_run", sql], capture_output=True, text=True)
        m = re.search(r"process\D*(\d{6,})\s*bytes", out.stdout + out.stderr)
        return int(m.group(1)) if m else -1
    if not execute:
        raise RuntimeError("refusing to run a non-dry-run query without execute=True")
    out = subprocess.run(cmd + ["--format=json", sql], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"bq failed (rc={out.returncode}): {(out.stderr or out.stdout)[:400]}")
    return json.loads(out.stdout) if out.stdout.strip() else []


def monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def flag_select(week_start: date, week_end: date, cats, broad, slice_id: str) -> str:
    """The Phase-A flagging SELECT for [week_start, week_end) — same CTE shape as
    gpr_rollup_v2.sql, using the validated per-category regexes."""
    flags = ",\n    ".join(f"REGEXP_CONTAINS(V2Themes, r'{c['regex']}') AS {c['col']}" for c in cats)
    or_list = " OR ".join(c["col"] for c in cats)
    logical_or = "".join(f"LOGICAL_OR({c['col']}) AS {c['col']}, " for c in cats)
    return f"""
WITH src AS (
  SELECT GKGRECORDID AS doc_id,
    PARSE_DATE('%Y%m%d', SUBSTR(CAST(DATE AS STRING), 1, 8)) AS event_date,
    REGEXP_EXTRACT_ALL(V2Locations, r'#([A-Z]{{2}})#') AS fips_list,
    V2Themes,
    SAFE_CAST(SPLIT(V2Tone, ',')[OFFSET(0)] AS FLOAT64) AS tone
  FROM `{PUBLIC}`
  WHERE _PARTITIONTIME >= TIMESTAMP('{week_start}') AND _PARTITIONTIME < TIMESTAMP('{week_end}')
    AND V2Locations IS NOT NULL AND V2Themes IS NOT NULL
),
flagged AS (
  SELECT doc_id, event_date, tone, fips AS country_code,
    {flags},
    ARRAY(SELECT t FROM UNNEST(SPLIT(V2Themes, ';')) AS t WHERE REGEXP_CONTAINS(t, r'{broad}')) AS matched_themes
  FROM src, UNNEST(fips_list) AS fips
)
SELECT doc_id, event_date, country_code, '{slice_id}' AS slice_id,
  {logical_or}
  LOGICAL_OR({or_list}) AS gpr_any,
  MAX(tone) AS tone,
  ANY_VALUE(matched_themes) AS matched_themes
FROM flagged
GROUP BY doc_id, event_date, country_code
""".strip()


def insert_sql(select_sql: str, cats) -> str:
    cols = ["doc_id", "event_date", "country_code", "slice_id"] + [c["col"] for c in cats] + ["gpr_any", "tone", "matched_themes"]
    return f"INSERT INTO `{OWNED}` ({', '.join(cols)})\n{select_sql}"


def table_max_date() -> date:
    sql = (f"SELECT MAX(partition_id) mx FROM `{PROJECT}.qgi_gdelt.INFORMATION_SCHEMA.PARTITIONS` "
           f"WHERE table_name='gkg_gpr_flags_v2' AND total_rows > 0 "
           f"AND partition_id NOT IN ('__NULL__','__UNPARTITIONED__')")
    rows = _run(sql, execute=True, max_bytes=100_000_000)
    return datetime.strptime(rows[0]["mx"], "%Y%m%d").date()


def week_present(week_start: date) -> bool:
    """Idempotency: is this ISO week FULLY present (all 7 daily partitions)? (free metadata read)
    Requiring all 7 days (not just any) so a partially-landed week is never silently marked done."""
    we = week_start + timedelta(days=7)
    sql = (f"SELECT COUNT(DISTINCT partition_id) n FROM `{PROJECT}.qgi_gdelt.INFORMATION_SCHEMA.PARTITIONS` "
           f"WHERE table_name='gkg_gpr_flags_v2' AND partition_id >= '{week_start:%Y%m%d}' "
           f"AND partition_id < '{we:%Y%m%d}' AND total_rows > 0")
    return int(_run(sql, execute=True, max_bytes=100_000_000)[0]["n"]) == 7


def rows_present(week_start: date) -> bool:
    """Row-level double-insert backstop (partition-pruned, cheap): does the owned table already
    hold ANY row for this week? Used right before an INSERT so a retry/concurrent run cannot
    double a week's gpr_share (the COUNTIF(gpr_any) numerator is not distinct-safe)."""
    we = week_start + timedelta(days=7)
    sql = (f"SELECT COUNT(1) n FROM `{OWNED}` "
           f"WHERE event_date >= DATE '{week_start}' AND event_date < DATE '{we}'")
    return int(_run(sql, execute=True, max_bytes=1_000_000_000)[0]["n"]) > 0


def target_weeks(as_of: date):
    """Complete ISO weeks NOT yet in the table, from table-max forward, bounded, lag-buffered."""
    mx = table_max_date()
    if mx != monday(mx) + timedelta(days=6):   # tail must land on a Sunday (a complete week)
        raise SystemExit(f"STOP: table tail {mx} is not a Sunday (incomplete week boundary). "
                         f"A prior backfill ended off-boundary; fix the tail before weekly ingest.")
    cutoff = as_of - timedelta(days=LAG_DAYS)               # don't touch a week until GDELT has settled
    latest_complete = monday(cutoff) - timedelta(days=7)
    start = monday(mx) + timedelta(days=7)                  # first week after the table's coverage
    weeks, w = [], start
    while w <= latest_complete and len(weeks) < MAX_WEEKS_PER_RUN:
        if not week_present(w):
            weeks.append(w)
        w += timedelta(days=7)
    return weeks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", default=date.today().isoformat())
    ap.add_argument("--weeks", nargs="*", help="explicit ISO-week Mondays YYYY-MM-DD (else auto-detect missing)")
    ap.add_argument("--execute", action="store_true", help="PERFORM the write (WIF service account / founder only)")
    a = ap.parse_args()
    cats, broad = R2.load_categories(), R2.load_broad_capture_regex()

    if a.weeks:
        weeks = [monday(date.fromisoformat(w)) for w in a.weeks]
    else:
        weeks = target_weeks(date.fromisoformat(a.as_of))
    if not weeks:
        print("table already current — no weeks to ingest."); return 0

    total_bytes = 0
    for ws in weeks:
        we = ws + timedelta(days=7)
        if week_present(ws):
            print(f"  {ws} already present — skip (idempotent)"); continue
        sel = flag_select(ws, we, cats, broad, f"weekly_{ws:%Y%m%d}")
        ins = insert_sql(sel, cats)
        est = _run(ins, dry_run=True)
        total_bytes += max(est, 0)
        gb = est / 1e9 if est > 0 else -1
        over = est > WEEK_BYTES_CAP
        print(f"  week {ws}: dry-run {gb:.2f} GB (~${gb/1000*6.25:.4f}){'  OVER CAP!' if over else ''}")
        if a.execute and over:
            print(f"    -> ABORT week {ws}: exceeds {WEEK_BYTES_CAP/1e9:.0f} GB cap")
        elif a.execute:
            if rows_present(ws):   # row-level backstop: never double-insert a week
                print(f"    -> SKIP week {ws}: rows already present (double-insert guard)")
            else:
                _run(ins, execute=True)
                print(f"    -> INSERTED week {ws}")
    print(f"\n{len(weeks)} week(s), total dry-run {total_bytes/1e9:.2f} GB (~${total_bytes/1e12*6.25:.4f})"
          f"{'  [DRY RUN — no write]' if not a.execute else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
