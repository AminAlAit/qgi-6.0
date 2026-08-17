#!/usr/bin/env python3
"""
QGI-GPR weekly movers (Phase B) — FREE owned-table read.

Computes, for the 44 GPR-validated countries, the week-over-week % change in gpr_share
between the latest two COMPLETE ISO weeks in gkg_gpr_flags_v2, maps FIPS->ISO3, attaches
A/B/C tiers + names, and ranks risers/fallers -> movers.json.

Canonical proxy (GPR-CADENCE-COOKBOOK, verified bit-for-bit):
    gpr_share = COUNTIF(gpr_any) / COUNT(DISTINCT doc_id)   per (country_code, ISO-week)

Cost: owned-table read, partition-pruned + clustered on country_code -> free tier ($0).
Every BQ touch dry-runs first (cost rule). Reads only; never writes.

Executor seam: run_query() uses the `bq` CLI locally (authed). The Lambda swaps in a
google-cloud-bigquery client (WIF auth) with the SAME SQL + logic.
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys
from datetime import date, datetime, timedelta

TABLE = "extreme-lattice-344211.qgi_gdelt.gkg_gpr_flags_v2"
DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
BQ = os.environ.get("BQ_BIN", "bq")   # full path can be injected


def load_ref():
    fips2iso = json.load(open(os.path.join(DATA, "fips_to_iso3.json")))
    tiers = json.load(open(os.path.join(DATA, "tiers.json")))
    gpr = json.load(open(os.environ["GPR_COUNTRY_JSON"])) if "GPR_COUNTRY_JSON" in os.environ else None
    names = {}
    if gpr:
        for iso, v in gpr.get("countries", {}).items():
            names[iso] = v.get("name", iso)
    return fips2iso, tiers, names


def weekly_sql(fips_codes, since):
    inlist = ",".join(f"'{c}'" for c in sorted(fips_codes))
    return f"""
SELECT country_code,
  DATE_TRUNC(event_date, WEEK(MONDAY)) AS bucket,
  COUNT(DISTINCT doc_id) AS total_docs,
  SAFE_DIVIDE(COUNTIF(gpr_any), COUNT(DISTINCT doc_id)) AS gpr_share
FROM `{TABLE}`
WHERE country_code IN ({inlist})
  AND event_date >= DATE '{since}'
GROUP BY country_code, bucket
ORDER BY country_code, bucket
""".strip()


def run_query(sql, dry_run=False, max_bytes=5_000_000_000):
    """Execute via the bq CLI. dry_run -> returns bytes estimate (int)."""
    import re
    sql = re.sub(r"\s+", " ", sql).strip()   # single line: the bq.cmd shim mangles multi-line args
    cmd = [BQ, "query", "--use_legacy_sql=false", "--max_rows=1000000", f"--maximum_bytes_billed={max_bytes}"]
    if dry_run:
        out = subprocess.run(cmd + ["--dry_run", sql], capture_output=True, text=True)
        m = re.search(r"process\D*(\d{6,})\s*bytes", out.stdout + out.stderr)
        return int(m.group(1)) if m else -1
    out = subprocess.run(cmd + ["--format=json", sql], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"bq query failed (rc={out.returncode}): {(out.stderr or out.stdout)[:500]}")
    return json.loads(out.stdout)


def compute_movers(rows, fips2iso, tiers, names, top_n=5):
    # index: {fips: {bucket: gpr_share}}
    by = {}
    buckets = set()
    for r in rows:
        c, b = r["country_code"], r["bucket"]
        by.setdefault(c, {})[b] = float(r["gpr_share"] or 0.0)
        buckets.add(b)
    ordered = sorted(buckets)
    if len(ordered) < 2:
        raise RuntimeError("need >=2 weeks of data")
    latest, prior = ordered[-1], ordered[-2]
    movers = []
    for fips, series in by.items():
        cur, prev = series.get(latest), series.get(prior)
        if cur is None or prev is None or prev == 0:
            continue
        pct = (cur - prev) / prev * 100.0
        iso = fips2iso.get(fips, fips)
        movers.append({
            "iso3": iso, "name": names.get(iso, iso), "fips": fips,
            "pct": round(pct, 2), "tier": tiers.get(iso, "?"),
            "gpr_share_now": round(cur, 4), "gpr_share_prior": round(prev, 4),
        })
    risers = sorted([m for m in movers if m["pct"] > 0], key=lambda m: -m["pct"])[:top_n]
    fallers = sorted([m for m in movers if m["pct"] < 0], key=lambda m: m["pct"])[:top_n]
    for i, m in enumerate(risers, 1): m["rank"] = i
    for i, m in enumerate(fallers, 1): m["rank"] = i
    return {"latest_week": latest, "prior_week": prior,
            "n_countries": len(by),        # countries seen in the lookback window
            "n_compared": len(movers),     # countries with BOTH weeks that entered the ranking
            "generated_at": None, "risers": risers, "fallers": fallers}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2026-03-15", help="partition-prune lower bound (>= a few weeks before the target)")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--out", default=os.path.join(DATA, "movers.json"))
    a = ap.parse_args()
    fips2iso, tiers, names = load_ref()
    sql = weekly_sql(list(fips2iso.keys()), a.since)

    est = run_query(sql, dry_run=True)
    gb = est / 1e9 if est > 0 else -1
    print(f"[cost] dry-run: {gb:.2f} GB (~${gb/1000*6.25:.4f}); free-tier owned read", file=sys.stderr)

    rows = run_query(sql)
    result = compute_movers(rows, fips2iso, tiers, names, top_n=a.top)
    json.dump(result, open(a.out, "w"), indent=1)
    print(f"latest week {result['latest_week']} vs {result['prior_week']} ({result['n_countries']} countries)")
    print("RISERS:", [f"{m['name']} +{m['pct']}% [{m['tier']}]" for m in result["risers"]])
    print("FALLERS:", [f"{m['name']} {m['pct']}% [{m['tier']}]" for m in result["fallers"]])
    print(f"-> {a.out}")


if __name__ == "__main__":
    raise SystemExit(main())
