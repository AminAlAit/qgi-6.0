"""Render + (founder-only) run the QGI-GPR v2 per-(country, month) roll-up.

Single source of truth = gpr-theme-dictionary-v3.json.
Target table         = qgi_gdelt.gkg_gpr_flags_v2  (NEW; never touches v1 gkg_gpr_flags).
SQL template         = gpr_rollup_v2.sql            (adds matched_themes ARRAY<STRING>).
Manifest ledger      = data/gpr_manifest_v2.json    (independent v2 ledger).

KEY DIFFERENCE vs gpr_rollup.py:
  * Loads gpr-theme-dictionary-v3.json (threat-skew-fixed token set + bugfixed names).
  * Renders {{BROAD_CAPTURE_REGEX}} into the matched_themes ARRAY extraction in Phase A.
  * Writes to gkg_gpr_flags_v2, reads v2 manifest — no interference with v1.

SAFE BY DEFAULT (cost rule qgi-aws-tf#807 + Claude-no-AWS-creds qgi-aws-tf#809):
  * --dry_run is the DEFAULT. With creds it prints bytes-to-be-scanned (FREE).
  * A real query runs ONLY when BOTH --execute AND --confirm are passed.

USAGE
  python gpr_rollup_v2.py                                  # DRY RUN Phase B
  python gpr_rollup_v2.py --phase A --slice 2015-02-18 2026-06-02  # full backfill render
  python gpr_rollup_v2.py --print-sql                      # print rendered SQL and exit
  python gpr_rollup_v2.py --phase B --execute --confirm    # FOUNDER ONLY: real run

Stdlib only (json/argparse/os/re/subprocess/shutil/datetime). No pandas/numpy/scipy.
Tests: python -m pytest test_gpr_rollup_v2.py -v
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.abspath(__file__))
SQL_TEMPLATE   = os.path.join(ROOT, "gpr_rollup_v2.sql")
DICT_FILE      = os.path.join(ROOT, "gpr-theme-dictionary-v3.json")
MANIFEST_PATH  = os.path.join(ROOT, "data", "gpr_manifest_v2.json")

BQ      = r"/workspace\google-cloud-sdk\bin\bq.cmd"
PROJECT = "extreme-lattice-344211"
DATASET = "qgi_gdelt"
OWNED_TABLE_V2 = f"{DATASET}.gkg_gpr_flags_v2"
PUBLIC_GKG     = "gdelt-bq.gdeltv2.gkg_partitioned"
MAX_BYTES      = 200 * 10**9

S3_BUCKET         = "qgi-data-lake-222222222222"
S3_FLAGS_V2_PREFIX = f"s3://{S3_BUCKET}/gdelt/gpr/flags_v2"
S3_MONTHLY_V2_KEY  = f"s3://{S3_BUCKET}/dashboard/gpr-monthly-v2.json"

GPRC_FIPS_ILLUSTRATIVE = [
    "AR", "AS", "BE", "BR", "CA", "SZ", "CI", "CH", "CO", "GM", "DA", "EG", "SP",
    "FI", "FR", "UK", "HK", "HU", "ID", "IN", "IS", "IT", "JA", "KS", "MX", "MY",
    "NL", "NO", "PE", "RP", "PL", "PO", "RS", "SA", "SW", "TH", "TS", "TU", "TW",
    "UP", "US", "VE", "VM", "SF",
]


# ----------------------------------------------------------------------------
# Dictionary load + SQL render (PURE - the unit-test surface)
# ----------------------------------------------------------------------------
def _slug(name: str) -> str:
    """'Military Buildups' -> 'military_buildups' for column names."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def load_categories(dict_path: str = DICT_FILE) -> list[dict]:
    """Load the 8 GPR categories from dictionary v3 (threat-skew-fixed + bugfixed).

    Identical contract to gpr_rollup.load_categories() but reads v3 dict.
    Returns categories sorted by `cat` 1..8 with derived `col` (gN_<slug>).
    Raises ValueError if the dictionary is malformed.
    """
    d = json.load(open(dict_path, encoding="utf-8"))
    cats = sorted(d["categories"], key=lambda c: c["cat"])
    nums = [c["cat"] for c in cats]
    if nums != list(range(1, 9)):
        raise ValueError(f"dictionary must define cats 1..8, got {nums}")
    out = []
    for c in cats:
        tokens = c.get("gkg_themes") or []
        if not tokens:
            raise ValueError(f"cat {c['cat']} ({c.get('name')}) has no gkg_themes tokens")
        toa = c.get("threat_or_act")
        if toa not in ("threat", "act"):
            raise ValueError(f"cat {c['cat']} threat_or_act must be threat|act, got {toa!r}")
        out.append({
            "cat": c["cat"],
            "name": c["name"],
            "tokens": tokens,
            "regex": "|".join(tokens),
            "threat_or_act": toa,
            "col": f"g{c['cat']}_{_slug(c['name'])}",
        })
    return out


def load_broad_capture_regex(dict_path: str = DICT_FILE) -> str:
    """Load the broad-capture regex from the v3 dictionary.

    This regex is used to populate matched_themes ARRAY<STRING> in Phase A.
    It is the single source of truth for the future-proofing superset.
    """
    d = json.load(open(dict_path, encoding="utf-8"))
    try:
        regex = d["broad_capture_regex"]["regex"]
    except KeyError:
        raise ValueError("v3 dictionary missing broad_capture_regex.regex field")
    if not regex:
        raise ValueError("v3 dictionary has an empty broad_capture_regex.regex")
    return regex


def _half_or(cats: list[dict], threat_or_act: str) -> str:
    """'gA_x OR gB_x OR ...' over the categories on one Iacoviello axis."""
    half = [c["col"] for c in cats if c["threat_or_act"] == threat_or_act]
    if not half:
        raise ValueError(f"no categories classified {threat_or_act!r}")
    return " OR ".join(half)


def _make_slice_id(slice_start: str, slice_end: str) -> str:
    return f"{slice_start}_{slice_end}"


def render_sql(
    phase: str,
    cats: list[dict],
    broad_capture_regex: str,
    *,
    slice_start: str = "2015-02-18",
    slice_end: str = "2026-06-02",
    month_start: str = "2015-02-01",
    country_fips: list[str] | None = None,
) -> str:
    """Render gpr_rollup_v2.sql's placeholders. PURE.

    Adds the {{BROAD_CAPTURE_REGEX}} substitution on top of the v1 renderer's
    placeholder set. All other placeholder semantics are identical.
    """
    tmpl = open(SQL_TEMPLATE, encoding="utf-8").read()

    flag_exprs = ",\n    ".join(
        f"REGEXP_CONTAINS(V2Themes, r'{c['regex']}') AS {c['col']}" for c in cats
    )
    or_list    = " OR ".join(c["col"] for c in cats)
    logical_or = "".join(f"LOGICAL_OR({c['col']}) AS {c['col']},\n  " for c in cats)
    col_ddl    = "".join(f"{c['col']:<35} BOOL,\n  " for c in cats)
    countif    = "".join(f"COUNTIF({c['col']}) AS {c['col']},\n  " for c in cats)

    if country_fips:
        fips_in = ", ".join(f"'{f}'" for f in country_fips)
        country_filter = f"AND country_code IN ({fips_in})"
    else:
        country_filter = "-- (no country filter: all countries)"

    slice_id = _make_slice_id(slice_start, slice_end)

    subs = {
        "{{CAT_FLAG_EXPRS}}":    flag_exprs,
        "{{CAT_OR_LIST}}":       or_list,
        "{{CAT_LOGICAL_OR}}":    logical_or,
        "{{CAT_COL_DDL}}":       col_ddl,
        "{{CAT_COUNTIF}}":       countif,
        "{{THREATS_OR}}":        _half_or(cats, "threat"),
        "{{ACTS_OR}}":           _half_or(cats, "act"),
        "{{COUNTRY_FILTER}}":    country_filter,
        "{{PARTITION_START}}":   f"'{slice_start}'",
        "{{PARTITION_END}}":     f"'{slice_end}'",
        "{{SLICE_ID}}":          f"'{slice_id}'",
        "{{MONTH_START}}":       f"'{month_start}'",
        "{{OWNED_TABLE_V2}}":    OWNED_TABLE_V2,
        "{{PUBLIC_GKG}}":        PUBLIC_GKG,
        "{{BROAD_CAPTURE_REGEX}}": broad_capture_regex,
    }
    for k, v in subs.items():
        tmpl = tmpl.replace(k, v)

    leftover = sorted(set(re.findall(r"\{\{[A-Z][A-Z0-9_]*\}\}", tmpl)))
    if leftover:
        raise ValueError(f"unrendered placeholders remain: {leftover}")

    return _extract_phase(tmpl, phase)


def _extract_phase(rendered: str, phase: str) -> str:
    """Split the rendered template at the Phase B header; return one phase."""
    marker = "-- PHASE B  -"
    idx = rendered.find(marker)
    if idx == -1:
        raise ValueError("could not locate Phase B marker in rendered SQL")
    if phase == "B":
        body = rendered[idx:]
        end = body.find("\nORDER BY country_code, month;")
        return body[:end + len("\nORDER BY country_code, month;")] if end != -1 else body
    a_start = rendered.find("CREATE TABLE IF NOT EXISTS")
    return rendered[a_start:idx].rstrip()


# ----------------------------------------------------------------------------
# Manifest ledger (v2 — independent of v1 gpr_manifest.json)
# ----------------------------------------------------------------------------
def load_manifest(path: str = MANIFEST_PATH) -> dict:
    """Load the v2 GPR backfill manifest. Raises FileNotFoundError if missing."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"STOP: v2 manifest ledger not found at {path}. "
            "Create it (see gpr-build/data/gpr_manifest_v2.json) before any Phase A."
        )
    return json.load(open(path, encoding="utf-8"))


def check_manifest_allows_slice(manifest: dict, slice_end: str) -> None:
    """Refuse any slice already covered by the v2 closed ledger.

    Identical logic to gpr_rollup.check_manifest_allows_slice but reads
    the v2 manifest (gpr_manifest_v2.json). The v1 manifest (gpr_manifest.json)
    is NOT consulted here — v1 and v2 are independent tables and independent
    ledgers. A v1 closed-through date does NOT block a v2 slice.
    """
    it = manifest.get("immutable_through")
    if it is None:
        return
    it_date  = dt.date.fromisoformat(it + "-01")
    end_date = dt.date.fromisoformat(slice_end)
    if end_date <= it_date:
        raise SystemExit(
            f"\nSTOP — ALREADY PAID FOR (v2 ledger).\n"
            f"  Slice end ({slice_end}) <= immutable_through ({it}).\n"
            f"  This date range is in the v2 closed ledger. Re-scanning would be a duplicate spend.\n"
            f"  Read from qgi_gdelt.gkg_gpr_flags_v2 or the S3 Parquet exports instead.\n"
            f"  Segments already compiled: {[s.get('slice_id') for s in manifest.get('segments_compiled', [])]}"
        )


def advance_manifest(
    manifest: dict,
    slice_start: str,
    slice_end: str,
    bytes_scanned_tb: float = 0.0,
    cost_usd: float = 0.0,
    s3_parquet_key: str | None = None,
    path: str = MANIFEST_PATH,
) -> None:
    """Append a compiled v2 segment and bump immutable_through."""
    end_date = dt.date.fromisoformat(slice_end)
    last_month_date = (end_date.replace(day=1) - dt.timedelta(days=1))
    new_immutable   = f"{last_month_date.year:04d}-{last_month_date.month:02d}"

    current_it = manifest.get("immutable_through")
    if current_it is None or new_immutable > current_it:
        manifest["immutable_through"] = new_immutable

    slice_id = _make_slice_id(slice_start, slice_end)
    segment = {
        "slice_id":              slice_id,
        "slice_start":           slice_start,
        "slice_end_exclusive":   slice_end,
        "immutable_through":     new_immutable,
        "dictionary_version":    manifest.get("dictionary_version", "3.0.0"),
        "bytes_scanned_tb":      round(bytes_scanned_tb, 4),
        "cost_usd_over_free_tier": round(cost_usd, 4),
        "compiled_utc_date":     dt.date.today().isoformat(),
        "source_table":          manifest.get("source_table", PUBLIC_GKG),
        "owned_table":           manifest.get("owned_table", f"{PROJECT}.{OWNED_TABLE_V2}"),
    }
    if s3_parquet_key:
        segment["s3_parquet_key"] = s3_parquet_key

    manifest.setdefault("segments_compiled", []).append(segment)

    cost_tracker = manifest.setdefault("cost_to_date", {})
    cost_tracker["month"] = dt.date.today().strftime("%Y-%m")
    cost_tracker["tb_billed"] = round(cost_tracker.get("tb_billed", 0.0) + bytes_scanned_tb, 4)
    cost_tracker["usd_over_free_tier"] = round(
        cost_tracker.get("usd_over_free_tier", 0.0) + cost_usd, 4
    )

    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(manifest, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"  v2 manifest: immutable_through -> {manifest['immutable_through']}")
    print(f"  v2 manifest: segment '{slice_id}' appended -> {path}")


# ----------------------------------------------------------------------------
# bq dry-run byte estimate (verbatim port of gpr_rollup.py / seed_live_baseline)
# ----------------------------------------------------------------------------
def _discover_cloudsdk_python() -> str:
    bundled = r"/workspace\google-cloud-sdk\platform\bundledpython\python.exe"
    if os.path.exists(bundled):
        return bundled
    for candidate in ("python3.12", "python3", "python"):
        found = shutil.which(candidate)
        if found:
            return found
    return sys.executable


def bq_dry_run_bytes(sql: str) -> float:
    """Return the GB BigQuery WOULD scan for this SQL. FREE — never bills."""
    env = dict(os.environ)
    env["CLOUDSDK_PYTHON"] = _discover_cloudsdk_python()
    cmd = [
        BQ, "query", "--use_legacy_sql=false", f"--project_id={PROJECT}",
        f"--maximum_bytes_billed={MAX_BYTES}", "--dry_run",
        sql.replace("\n", " "),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(f"bq dry-run failed:\n{r.stderr[:2000]}")
    out = r.stdout + r.stderr
    m = re.search(r"([\d,]+) bytes", out)
    return int(m.group(1).replace(",", "")) / 1e9 if m else float("nan")


def bq_execute(sql: str) -> str:
    """Run a BigQuery SQL statement (non-dry-run). FOUNDER ONLY."""
    env = dict(os.environ)
    env["CLOUDSDK_PYTHON"] = _discover_cloudsdk_python()
    cmd = [
        BQ, "query", "--use_legacy_sql=false", f"--project_id={PROJECT}",
        f"--maximum_bytes_billed={MAX_BYTES}",
        sql.replace("\n", " "),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=7200)
    if r.returncode != 0:
        raise RuntimeError(f"bq execute failed:\n{r.stderr[:2000]}")
    return r.stdout + r.stderr


def free_dry_run_cmd(sql: str) -> str:
    """The exact FREE command the founder can paste to estimate bytes."""
    return (
        f'"{BQ}" query --use_legacy_sql=false --project_id={PROJECT} '
        f"--maximum_bytes_billed={MAX_BYTES} --dry_run "
        f'"{sql.replace(chr(10), " ")}"'
    )


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--phase", choices=["A", "B"], default="B",
                    help="A = raw-GKG backfill into gkg_gpr_flags_v2 (CAUTION); B = owned-table roll-up (GO, default)")
    ap.add_argument("--slice", nargs=2, metavar=("START", "END"),
                    default=["2015-02-18", "2026-06-02"],
                    help="Phase A _PARTITIONTIME slice bounds (YYYY-MM-DD), end exclusive. Default = full backfill.")
    ap.add_argument("--all-countries", action="store_true",
                    help="Phase B: roll up ALL countries (default restricts to the 44 GPRC FIPS).")
    ap.add_argument("--print-sql", action="store_true",
                    help="render the SQL, print it, and exit (no creds, no query).")
    ap.add_argument("--dry_run", action="store_true", default=True,
                    help="(default) estimate bytes only; never executes or bills.")
    ap.add_argument("--execute", action="store_true",
                    help="FOUNDER ONLY: intent to run for real. Requires --confirm too.")
    ap.add_argument("--confirm", action="store_true",
                    help="FOUNDER cost-ack of the byte number (#807). Required with --execute.")
    ap.add_argument("--upload", action="store_true",
                    help="Phase B --execute path: also upload the monthly rollup to S3.")
    args = ap.parse_args()

    cats  = load_categories()
    bcre  = load_broad_capture_regex()
    country_fips = None if args.all_countries else GPRC_FIPS_ILLUSTRATIVE

    sql = render_sql(
        args.phase, cats, bcre,
        slice_start=args.slice[0], slice_end=args.slice[1],
        country_fips=(None if args.phase == "A" else country_fips),
    )

    if args.phase == "A":
        label = (f"PHASE A  (raw GKG {args.slice[0]}..{args.slice[1]})  "
                 f"-> gkg_gpr_flags_v2  — CAUTION: raw scan + WRITE")
    else:
        label = "PHASE B  (owned v2 table roll-up)  — GO: free-tier owned read"
    print(label)
    print("-" * min(len(label), 80))
    print("v3 dictionary loaded from gpr-theme-dictionary-v3.json")
    print("(frozen P3 regex = confirmed gkg_themes only; threat-skew-fixed + token-name-bugfixed):")
    for c in cats:
        print(f"  g{c['cat']} [{c['threat_or_act']:<6}] {c['col']:<35} <- {c['regex']}")
    print(f"\nbroad-capture regex (matched_themes column): {bcre[:80]}...")
    print()
    print("rendered SQL:")
    print(sql)
    print()

    if args.print_sql:
        return

    if args.phase == "A":
        manifest = load_manifest()
        check_manifest_allows_slice(manifest, args.slice[1])
        print(f"v2 manifest check: slice {args.slice[0]}..{args.slice[1]} not in closed ledger — OK")

    if not args.execute:
        print("DEFAULT = DRY RUN. No query executed, no bytes billed.")
        print("Founder, estimate bytes for FREE (a dry-run never bills), then decide:\n")
        print("  " + free_dry_run_cmd(sql))
        print("\nReview the 'will process N bytes' line. To run for real:")
        print("  python gpr_rollup_v2.py --phase A --slice ... --execute --confirm")
        if args.phase == "A":
            print("Phase A is CAUTION: ack the single byte figure before --confirm.")
        return

    if args.execute and not args.confirm:
        raise SystemExit(
            "REFUSED: --execute requires --confirm (the explicit #807 cost-ack). "
            "Re-run --dry_run, read the byte number, then add --confirm."
        )

    gb  = bq_dry_run_bytes(sql)
    usd = max(0.0, gb / 1000) * 6.25
    print(f"dry-run estimate : {gb:,.2f} GB  (~${usd:.2f} at $6.25/TB before the 1 TB free tier)")
    print("(--execute --confirm given) proceeding to real run…")

    if args.phase == "A":
        manifest = load_manifest()
        check_manifest_allows_slice(manifest, args.slice[1])
        bq_execute(sql)
        print(f"  Phase A INSERT complete for slice {args.slice[0]}..{args.slice[1]}")

        slice_id   = _make_slice_id(args.slice[0], args.slice[1])
        s3_dest    = f"{S3_FLAGS_V2_PREFIX}/gkg_gpr_flags_v2_{slice_id}.parquet/"
        tb         = gb / 1000
        advance_manifest(manifest, args.slice[0], args.slice[1],
                         bytes_scanned_tb=tb, cost_usd=usd, s3_parquet_key=s3_dest)

    elif args.phase == "B":
        csv_out = os.path.join(ROOT, "data", "gpr_monthly_v2.csv")
        os.makedirs(os.path.dirname(csv_out), exist_ok=True)
        env = dict(os.environ)
        env["CLOUDSDK_PYTHON"] = _discover_cloudsdk_python()
        cmd = [
            BQ, "query", "--use_legacy_sql=false", f"--project_id={PROJECT}",
            f"--maximum_bytes_billed={MAX_BYTES}",
            "--format=csv", "--max_rows=10000000",
            sql.replace("\n", " "),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=3600)
        if r.returncode != 0:
            raise RuntimeError(f"Phase B bq failed:\n{r.stderr[:2000]}")
        with open(csv_out, "w", encoding="utf-8", newline="") as f:
            f.write(r.stdout)
        print(f"  Phase B v2 rollup written -> {csv_out}")

        if args.upload:
            subprocess.run(
                ["aws", "s3", "cp", csv_out, S3_MONTHLY_V2_KEY,
                 "--content-type", "application/json"],
                check=True,
            )
            print(f"  uploaded -> {S3_MONTHLY_V2_KEY}")
        else:
            print(f"\nS3 upload gated behind --execute --confirm --upload.")
            print(f"Founder: aws s3 cp {csv_out} {S3_MONTHLY_V2_KEY}")


if __name__ == "__main__":
    main()
