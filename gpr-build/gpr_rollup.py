# Requires the `qgi-claude-readonly` BigQuery role (scoped at ML-Opus #648 /
# qgi-aws-tf#809). This script NEVER writes: Phase B is a read-only SELECT, and
# Phase A's CREATE/INSERT DDL is emitted as text for the FOUNDER to run with a
# write-capable role - this runner only renders SQL and (with creds) dry-runs the
# free byte estimate. Claude holds no creds; the founder executes.
"""Render + (founder-only) run the QGI-GPR per-(country, month) roll-up.

Single source of truth = gpr-theme-dictionary-v2.json. This runner loads the 8
GPR category theme-sets from the dictionary and renders gpr_rollup.sql's
{{ ... }} placeholders into executable SQL, so the dictionary and the SQL can
never drift apart (the prior gpr_monthly_country.sql hard-coded the regexes;
this path keeps them in ONE file).

SAFE BY DEFAULT (cost rule qgi-aws-tf#807 + Claude-no-AWS-creds qgi-aws-tf#809):
  * --dry_run is the DEFAULT. With creds it prints bytes-to-be-scanned (FREE -
    a BigQuery dry-run never executes or bills). Without creds it still renders
    the SQL and prints the exact FREE dry-run command for the founder to run.
  * A real query runs ONLY when BOTH --execute AND --confirm are passed. --execute
    alone refuses. --confirm is the founder's explicit cost-acknowledgement of the
    byte number, per #807 (Phase A is CAUTION: ack the single byte figure first).

MANIFEST LEDGER (never-query-twice guard):
  * gpr-build/data/gpr_manifest.json tracks every paid Phase A slice.
  * Before emitting any Phase A INSERT, the manifest is checked: any slice whose
    end-date <= immutable_through is REFUSED with a clear STOP message.
  * After a slice succeeds (founder confirms), call advance_manifest() to append
    the segment and bump immutable_through.

Mirrors the proven owned-table pattern in
  <USER_HOME>/qgi-gdelt-poc/seed_live_baseline.py  (bq dry-run bytes parse,
  --maximum_bytes_billed cap, owned-table read, FIPS->ISO3) and update_pulse.py.
Validation reuses the stdlib+xlrd helpers in qgi-ml/gpr-poc/validate_gpr_poc.py.

USAGE
  python gpr_rollup.py                                  # DRY RUN, Phase B: render + byte cmd, no query
  python gpr_rollup.py --phase B                        # steady-state owned-table read (GO)
  python gpr_rollup.py --phase A --slice 2015-02-18 2016-01-01   # one backfill slice (CAUTION)
  python gpr_rollup.py --print-sql                      # just print the rendered SQL and exit
  python gpr_rollup.py --phase B --execute --confirm    # FOUNDER ONLY: run for real (cost-ack)
  python gpr_rollup.py --mode incremental --month 2026-06   # single new monthly partition (cheap)

Stdlib only (json/argparse/os/re/subprocess). No pandas/numpy/scipy.
Tested: python -m pytest test_gpr_rollup.py -v  (pure render_sql / dictionary-load targets;
the bq subprocess path is a verbatim port of seed_live_baseline.bq_query and is
NOT exercised here - no creds).
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
SQL_TEMPLATE = os.path.join(ROOT, "gpr_rollup.sql")
DICT_FILE = os.path.join(ROOT, "gpr-theme-dictionary-v2.json")
MANIFEST_PATH = os.path.join(ROOT, "data", "gpr_manifest.json")

# --- creds-side config (founder confirms; ported verbatim from seed_live_baseline) ---
BQ = r"/workspace\google-cloud-sdk\bin\bq.cmd"
PROJECT = "extreme-lattice-344211"               # owned GCP project (same as live-pulse)
DATASET = "qgi_gdelt"
OWNED_TABLE = f"{DATASET}.gkg_gpr_flags"          # sibling of gkg_topic_flags
PUBLIC_GKG = "gdelt-bq.gdeltv2.gkg_partitioned"   # date-partitioned variant (has _PARTITIONTIME)
# Hard byte cap: a backstop that makes a runaway query FAIL rather than bill
# (qgi-aws-tf#807). With the 5-column projection + _PARTITIONTIME prune a yearly
# Phase-A slice should sit well under this.
MAX_BYTES = 200 * 10**9

# S3 durable export destinations (BQ = rebuildable cache; S3 = durable asset).
S3_BUCKET = "qgi-data-lake-222222222222"
S3_FLAGS_PREFIX = f"s3://{S3_BUCKET}/gdelt/gpr/flags"     # per-slice Parquet lands here
S3_MONTHLY_KEY = f"s3://{S3_BUCKET}/dashboard/gpr-monthly.json"

# Phase B country restriction for the replication phase. The 44 GPRC FIPS codes
# are ILLUSTRATIVE / verify-on-creds (KS=S.Korea, SF=S.Africa, SZ=Switzerland,
# GM=Germany, UP=Ukraine are easy to get wrong) - build the authoritative
# FIPS<->ISO3 map from a reference table before the real run. Empty => all countries.
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
    """Load the 8 GPR categories from dictionary v2 (the single source of truth).

    Per the v2 schema, each category carries:
      gkg_themes      - the confidence:"good" token list -> joined with '|' into
                        the RE2 family that the FROZEN P1 rollup actually uses.
      verify_on_creds - tokens NOT yet confirmed non-zero in GKG; INTENTIONALLY
                        excluded from the rendered regex so the first real
                        backfill uses only the proven core (the honest frozen P1
                        dictionary). Added in a later vintage after creds-side
                        enumeration of the TAX_* trees / WB_* node numbers.
      threat_or_act   - Iacoviello's orthogonal axis -> the threats/acts split.

    Returns them sorted by `cat` 1..8 with a derived `col` (gN_<slug>). Raises if
    the dictionary is malformed (missing cats / empty token list).
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
            # RE2 family = confident tokens only (verify_on_creds deliberately omitted).
            "regex": "|".join(tokens),
            "threat_or_act": toa,
            "col": f"g{c['cat']}_{_slug(c['name'])}",
        })
    return out


def _half_or(cats: list[dict], threat_or_act: str) -> str:
    """'gA_x OR gB_x OR ...' over the categories on one side of Iacoviello's axis.

    The split is read from the dictionary's per-category `threat_or_act` field
    (threats = cats 1-5, acts = cats 6-8 in the v2 dict), not hardcoded here -
    so the SQL follows the dictionary if the classification ever changes.
    """
    half = [c["col"] for c in cats if c["threat_or_act"] == threat_or_act]
    if not half:
        raise ValueError(f"no categories classified {threat_or_act!r}")
    return " OR ".join(half)


def _make_slice_id(slice_start: str, slice_end: str) -> str:
    """Build the manifest audit tag: 'YYYY-MM-DD_YYYY-MM-DD'."""
    return f"{slice_start}_{slice_end}"


def render_sql(
    phase: str,
    cats: list[dict],
    *,
    slice_start: str = "2015-02-18",
    slice_end: str = "2016-01-01",
    month_start: str = "2015-02-01",
    country_fips: list[str] | None = None,
) -> str:
    """Render gpr_rollup.sql's placeholders from the loaded categories. PURE.

    `country_fips` None or [] => no Phase-B country filter (all countries).
    Returns the full rendered template; the caller splits Phase A / Phase B by
    statement if it wants to run them separately.

    The `slice_id` value (manifest audit tag) is derived from slice_start +
    slice_end and injected into the Phase A INSERT as a string literal.
    """
    tmpl = open(SQL_TEMPLATE, encoding="utf-8").read()

    flag_exprs = ",\n    ".join(
        f"REGEXP_CONTAINS(V2Themes, r'{c['regex']}') AS {c['col']}" for c in cats
    )
    or_list = " OR ".join(c["col"] for c in cats)
    logical_or = "".join(f"LOGICAL_OR({c['col']}) AS {c['col']},\n  " for c in cats)
    col_ddl = "".join(f"{c['col']:<28} BOOL,\n  " for c in cats)
    countif = "".join(f"COUNTIF({c['col']}) AS {c['col']},\n  " for c in cats)

    if country_fips:
        fips_in = ", ".join(f"'{f}'" for f in country_fips)
        country_filter = f"AND country_code IN ({fips_in})"
    else:
        country_filter = "-- (no country filter: all countries)"

    slice_id = _make_slice_id(slice_start, slice_end)

    subs = {
        "{{CAT_FLAG_EXPRS}}": flag_exprs,
        "{{CAT_OR_LIST}}": or_list,
        "{{CAT_LOGICAL_OR}}": logical_or,
        "{{CAT_COL_DDL}}": col_ddl,
        "{{CAT_COUNTIF}}": countif,
        "{{THREATS_OR}}": _half_or(cats, "threat"),
        "{{ACTS_OR}}": _half_or(cats, "act"),
        "{{COUNTRY_FILTER}}": country_filter,
        "{{PARTITION_START}}": f"'{slice_start}'",
        "{{PARTITION_END}}": f"'{slice_end}'",
        "{{SLICE_ID}}": f"'{slice_id}'",
        "{{MONTH_START}}": f"'{month_start}'",
        "{{OWNED_TABLE}}": OWNED_TABLE,
        "{{PUBLIC_GKG}}": PUBLIC_GKG,
    }
    for k, v in subs.items():
        tmpl = tmpl.replace(k, v)

    # Flag only genuine UPPER_SNAKE token placeholders left unrendered; the
    # template's header prose mentions "{{ ... }}" descriptively, which is not a token.
    leftover = sorted(set(re.findall(r"\{\{[A-Z][A-Z0-9_]*\}\}", tmpl)))
    if leftover:
        raise ValueError(f"unrendered placeholders remain: {leftover}")

    # The renderer returns BOTH phases; pull out the one the caller asked for so
    # the printed/dry-run SQL is the single statement that will actually run.
    return _extract_phase(tmpl, phase)


def _extract_phase(rendered: str, phase: str) -> str:
    """Split the rendered template at the Phase B header; return one phase.

    Phase A = the CREATE + INSERT DDL (founder runs with a write role).
    Phase B = the single read-only SELECT roll-up.
    """
    marker = "-- PHASE B  -"
    idx = rendered.find(marker)
    if idx == -1:
        raise ValueError("could not locate Phase B marker in rendered SQL")
    if phase == "B":
        # the SELECT ... ; statement (strip the trailing banner comment)
        body = rendered[idx:]
        end = body.find("\nORDER BY country_code, month;")
        return body[:end + len("\nORDER BY country_code, month;")] if end != -1 else body
    # phase A: everything from the first CREATE up to the Phase B marker
    a_start = rendered.find("CREATE TABLE IF NOT EXISTS")
    return rendered[a_start:idx].rstrip()


# ----------------------------------------------------------------------------
# Manifest ledger (never-query-twice guard)
# ----------------------------------------------------------------------------
def load_manifest(path: str = MANIFEST_PATH) -> dict:
    """Load the GPR backfill manifest. Raises if file is missing (safety: create it first)."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"STOP: manifest ledger not found at {path}. "
            "Create it (see gpr-build/data/gpr_manifest.json in the repo) before running any Phase A."
        )
    return json.load(open(path, encoding="utf-8"))


def check_manifest_allows_slice(manifest: dict, slice_end: str) -> None:
    """Refuse any slice already covered by the closed ledger.

    A slice is already paid for if its end-date <= immutable_through.
    slice_end is 'YYYY-MM-DD' (exclusive upper bound of the slice).
    immutable_through is 'YYYY-MM' or null.

    Raises SystemExit with a STOP message if the slice is already closed.
    """
    it = manifest.get("immutable_through")
    if it is None:
        return  # nothing compiled yet — all slices are allowed
    # Convert immutable_through 'YYYY-MM' to 'YYYY-MM-01' for comparison
    it_date = dt.date.fromisoformat(it + "-01")
    end_date = dt.date.fromisoformat(slice_end)
    if end_date <= it_date:
        raise SystemExit(
            f"\nSTOP — ALREADY PAID FOR.\n"
            f"  Slice end ({slice_end}) <= immutable_through ({it}).\n"
            f"  This date range is in the closed ledger. Re-scanning it would be a duplicate spend.\n"
            f"  Read from the owned BQ table or S3 Parquet exports instead.\n"
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
    """Append a compiled segment and bump immutable_through. Called after a slice INSERT succeeds.

    slice_end is 'YYYY-MM-DD' (exclusive). immutable_through is bumped to the
    last COMPLETE month covered by this slice (slice_end's month minus 1, since
    slice_end is exclusive and may be the first day of a month).
    """
    end_date = dt.date.fromisoformat(slice_end)
    # The slice covers up to (but not including) slice_end; the last full month
    # is the month before slice_end's month.
    last_month_date = (end_date.replace(day=1) - dt.timedelta(days=1))
    new_immutable = f"{last_month_date.year:04d}-{last_month_date.month:02d}"

    # Only advance immutable_through if this slice closes further than what's recorded.
    current_it = manifest.get("immutable_through")
    if current_it is None or new_immutable > current_it:
        manifest["immutable_through"] = new_immutable

    slice_id = _make_slice_id(slice_start, slice_end)
    segment = {
        "slice_id": slice_id,
        "slice_start": slice_start,
        "slice_end_exclusive": slice_end,
        "immutable_through": new_immutable,
        "bytes_scanned_tb": round(bytes_scanned_tb, 4),
        "cost_usd_over_free_tier": round(cost_usd, 4),
        "compiled_utc_date": dt.date.today().isoformat(),
        "source_table": manifest.get("source_table", PUBLIC_GKG),
        "owned_table": manifest.get("owned_table", f"{PROJECT}.{OWNED_TABLE}"),
    }
    if s3_parquet_key:
        segment["s3_parquet_key"] = s3_parquet_key

    manifest.setdefault("segments_compiled", []).append(segment)

    # Update cost tracker
    cost_tracker = manifest.setdefault("cost_to_date", {})
    cost_tracker["month"] = dt.date.today().strftime("%Y-%m")
    cost_tracker["tb_billed"] = round(
        cost_tracker.get("tb_billed", 0.0) + bytes_scanned_tb, 4
    )
    cost_tracker["usd_over_free_tier"] = round(
        cost_tracker.get("usd_over_free_tier", 0.0) + cost_usd, 4
    )

    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(manifest, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"  manifest: immutable_through -> {manifest['immutable_through']}")
    print(f"  manifest: segment '{slice_id}' appended -> {path}")


# ----------------------------------------------------------------------------
# Incremental monthly INSERT (cheap upkeep after backfill)
# ----------------------------------------------------------------------------
def render_incremental_sql(cats: list[dict], month: str) -> str:
    """Render a single-partition INSERT for ONE new monthly partition.

    `month` is 'YYYY-MM'. The INSERT covers _PARTITIONTIME for that calendar
    month only: [YYYY-MM-01, YYYY-MM+1-01). This is the cheap monthly upkeep
    path after the one-time backfill is complete — it never rescans history.

    Returns the Phase A INSERT SQL only (no CREATE TABLE — the table already exists).
    """
    # Parse month into start/end date bounds
    y, m = int(month[:4]), int(month[5:7])
    slice_start = f"{y:04d}-{m:02d}-01"
    m_next = m + 1
    y_next = y + (1 if m_next > 12 else 0)
    m_next = (m_next - 1) % 12 + 1
    slice_end = f"{y_next:04d}-{m_next:02d}-01"

    # Render the full Phase A SQL then strip the CREATE TABLE block — only
    # the INSERT is needed for the incremental path (table already exists).
    full_sql = render_sql(
        "A", cats,
        slice_start=slice_start,
        slice_end=slice_end,
    )
    # Drop everything before the INSERT INTO line
    insert_idx = full_sql.find("INSERT INTO")
    if insert_idx == -1:
        raise ValueError("could not find INSERT INTO in rendered Phase A SQL")
    insert_sql = full_sql[insert_idx:]
    header = (
        f"-- INCREMENTAL MONTHLY INSERT for {month}\n"
        f"-- Covers _PARTITIONTIME [{slice_start}, {slice_end})\n"
        f"-- slice_id = '{_make_slice_id(slice_start, slice_end)}'\n"
        f"-- Run AFTER checking gpr_manifest.json: never re-insert a closed month.\n\n"
    )
    return header + insert_sql


# ----------------------------------------------------------------------------
# bq dry-run byte estimate (verbatim port of seed_live_baseline.bq_query)
# ----------------------------------------------------------------------------
def _discover_cloudsdk_python() -> str:
    """Find a usable Python interpreter for the Cloud SDK.

    The old hardcoded bundledpython path is wrong for this machine (the bundled
    Python may not exist or may be the wrong version). We try, in order:
      1. The bundled path (preserved for machines where it exists).
      2. `python3.12` on PATH (this machine's canonical interpreter per the
         CLOUDSDK_PYTHON=python3.12 note in the requirements).
      3. `python3` on PATH.
      4. `python` on PATH.
    Falls back to the first one found; returns the path as a string.
    """
    bundled = r"/workspace\google-cloud-sdk\platform\bundledpython\python.exe"
    if os.path.exists(bundled):
        return bundled
    for candidate in ("python3.12", "python3", "python"):
        found = shutil.which(candidate)
        if found:
            return found
    # Last resort: return the current interpreter
    return sys.executable


def bq_dry_run_bytes(sql: str) -> float:
    """Return the GB BigQuery WOULD scan. FREE - a dry-run never executes/bills.

    Where the byte estimate comes from: `bq query --dry_run` asks the BigQuery
    server to PLAN (not run) the query and report total bytes it would process;
    bq prints a line like "Query successfully validated. ... will process
    N bytes ...". We regex the first `([\\d,]+) bytes` out of that line, divide
    by 1e9 for GB, and apply the on-demand $6.25/TB rate (the first 1 TB/month
    is free). NOT exercised in CI (no creds); the founder runs it.
    """
    env = dict(os.environ)
    env["CLOUDSDK_PYTHON"] = _discover_cloudsdk_python()
    cmd = [
        BQ, "query", "--use_legacy_sql=false", f"--project_id={PROJECT}",
        f"--maximum_bytes_billed={MAX_BYTES}", "--dry_run",
        sql.replace("\n", " "),   # Windows .cmd mangles embedded newlines
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(f"bq dry-run failed:\n{r.stderr[:2000]}")
    out = r.stdout + r.stderr
    m = re.search(r"([\d,]+) bytes", out)
    return int(m.group(1).replace(",", "")) / 1e9 if m else float("nan")


def bq_execute(sql: str) -> str:
    """Run a BigQuery SQL statement (non-dry-run). Returns stdout+stderr.

    Called ONLY when --execute AND --confirm are both passed.
    Uses the same CLOUDSDK_PYTHON discovery as bq_dry_run_bytes.
    NOT exercised in CI (no creds).
    """
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


def export_slice_to_s3(slice_start: str, slice_end: str) -> str:
    """Export a slice's rows from the owned BQ table to S3 as Parquet.

    Strategy: BigQuery's EXPORT DATA AS PARQUET supports GCS as a destination
    but NOT S3 directly. We therefore use a two-hop approach:
      1. BQ EXPORT DATA -> GCS (gs://qgi-gdelt-gpr-export/flags/<slice_id>/*.parquet)
      2. gsutil rsync GCS -> local temp, then aws s3 cp to S3.

    An alternative is `bq extract` (same GCS hop required). Direct BQ->S3 export
    is NOT supported natively as of 2026; GCS is the mandatory intermediate.

    This function emits the three commands as a shell script (string) for the
    founder to review and run — it does NOT execute them.

    The S3 key pattern:
      s3://qgi-data-lake-222222222222/gdelt/gpr/flags/gkg_gpr_flags_<slice_id>.parquet/

    Returns the S3 key prefix for this slice (for the manifest).
    """
    slice_id = _make_slice_id(slice_start, slice_end)
    gcs_tmp = f"gs://qgi-gdelt-gpr-export/flags/{slice_id}/"
    local_tmp = os.path.join(ROOT, "data", "export_tmp", slice_id)
    s3_dest = f"{S3_FLAGS_PREFIX}/gkg_gpr_flags_{slice_id}.parquet/"

    export_sql = (
        f"EXPORT DATA OPTIONS("
        f"uri='{gcs_tmp}*.parquet', format='PARQUET', overwrite=true) AS "
        f"SELECT * FROM `{PROJECT}.{OWNED_TABLE}` "
        f"WHERE event_date >= DATE('{slice_start}') AND event_date < DATE('{slice_end}')"
    )

    script = (
        f"# --- S3 export for slice {slice_id} ---\n"
        f"# Step 1: export from BQ to GCS (BQ cannot write directly to S3)\n"
        f'bq query --use_legacy_sql=false --project_id={PROJECT} "{export_sql.replace(chr(10), " ")}"\n\n'
        f"# Step 2: sync GCS -> local temp\n"
        f'gsutil -m rsync -r "{gcs_tmp}" "{local_tmp}"\n\n'
        f"# Step 3: upload local -> S3\n"
        f'aws s3 cp "{local_tmp}" "{s3_dest}" --recursive --content-type application/octet-stream\n\n'
        f"# Step 4: clean up local temp and GCS temp\n"
        f'rm -rf "{local_tmp}"\n'
        f'gsutil -m rm -r "{gcs_tmp}"\n'
    )
    return script, s3_dest


def export_monthly_rollup_to_s3(csv_path: str, execute: bool = False) -> None:
    """Upload the Phase B monthly roll-up JSON/CSV to S3 (the durable frontend asset).

    Mirrors seed_live_baseline.py's --upload pattern.
    Gate: only uploads when `execute=True` (the founder's --execute --confirm is the cost-ack).
    """
    if not execute:
        print(f"\nS3 upload gated behind --execute --confirm.")
        print(f"Founder: aws s3 cp {csv_path} {S3_MONTHLY_KEY}")
        return
    print(f"\nuploading Phase B rollup -> {S3_MONTHLY_KEY}")
    subprocess.run(
        ["aws", "s3", "cp", csv_path, S3_MONTHLY_KEY,
         "--content-type", "application/json"],
        check=True,
    )
    print("  uploaded.")


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
                    help="A = raw-GKG backfill DDL (CAUTION); B = owned-table read (GO, default)")
    ap.add_argument("--slice", nargs=2, metavar=("START", "END"),
                    default=["2015-02-18", "2016-01-01"],
                    help="Phase A _PARTITIONTIME slice bounds (YYYY-MM-DD), end exclusive.")
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
    ap.add_argument("--mode", choices=["backfill", "incremental"], default="backfill",
                    help="backfill = historical slices (default); incremental = single new month.")
    ap.add_argument("--month", metavar="YYYY-MM",
                    help="--mode incremental: the new month to insert (e.g. 2026-06).")
    args = ap.parse_args()

    cats = load_categories()
    country_fips = None if args.all_countries else GPRC_FIPS_ILLUSTRATIVE

    # --- incremental mode: single-partition upkeep after backfill ---
    if args.mode == "incremental":
        if not args.month:
            raise SystemExit("--mode incremental requires --month YYYY-MM")
        if not re.match(r"^\d{4}-\d{2}$", args.month):
            raise SystemExit(f"--month must be YYYY-MM, got {args.month!r}")
        sql = render_incremental_sql(cats, args.month)
        print(f"INCREMENTAL INSERT  for {args.month}  - CAUTION: raw scan + WRITE (small)")
        print("-" * 60)
        print(sql)
        if args.print_sql:
            return
        if not args.execute:
            print("\nDEFAULT = DRY RUN. No query executed. Founder: add --execute --confirm.")
            print("Estimate bytes FREE:\n  " + free_dry_run_cmd(sql))
        elif not args.confirm:
            raise SystemExit(
                "REFUSED: --execute requires --confirm (the explicit #807 cost-ack)."
            )
        else:
            gb = bq_dry_run_bytes(sql)
            usd = max(0.0, gb / 1000) * 6.25
            print(f"dry-run: {gb:,.2f} GB  (~${usd:.2f}) — proceeding…")
            bq_execute(sql)
            print("  incremental INSERT done.")
        return

    # --- standard backfill or Phase B path ---
    sql = render_sql(
        args.phase, cats,
        slice_start=args.slice[0], slice_end=args.slice[1],
        country_fips=(None if args.phase == "A" else country_fips),
    )

    if args.phase == "A":
        label = f"PHASE A  (raw GKG {args.slice[0]}..{args.slice[1]})  - CAUTION: raw scan + WRITE"
    else:
        label = "PHASE B  (owned-table roll-up)  - GO: free-tier owned read"
    print(label)
    print("-" * len(label))
    print("categories loaded from gpr-theme-dictionary-v2.json "
          "(frozen P1 regex = confident gkg_themes only; verify_on_creds excluded):")
    for c in cats:
        print(f"  g{c['cat']} [{c['threat_or_act']:<6}] {c['col']:<28} <- {c['regex']}")
    print()
    print("rendered SQL:")
    print(sql)
    print()

    if args.print_sql:
        return

    # --- manifest guard for Phase A ---
    if args.phase == "A":
        manifest = load_manifest()
        check_manifest_allows_slice(manifest, args.slice[1])
        print(f"manifest check: slice {args.slice[0]}..{args.slice[1]} not in closed ledger — OK")

    # --- the guard: a real run needs BOTH --execute AND --confirm ---
    if not args.execute:
        print("DEFAULT = DRY RUN. No query executed, no bytes billed.")
        print("Founder, estimate bytes for FREE (a dry-run never bills), then decide:\n")
        print("  " + free_dry_run_cmd(sql))
        print("\nReview the 'will process N bytes' line. To run for real you must pass")
        print("BOTH --execute AND --confirm (the --confirm flag is your #807 cost-ack).")
        if args.phase == "A":
            print("Phase A is CAUTION: ack the single byte figure before --confirm.")
        return

    if args.execute and not args.confirm:
        raise SystemExit(
            "REFUSED: --execute requires --confirm (the explicit #807 cost-ack of the "
            "byte estimate). Re-run --dry_run, read the byte number, then add --confirm."
        )

    # --execute AND --confirm: founder, with the qgi-claude-readonly creds.
    # Dry-run estimate first (free), print it, THEN run.
    gb = bq_dry_run_bytes(sql)
    usd = max(0.0, gb / 1000) * 6.25  # on-demand; first 1 TB/month free
    print(f"dry-run estimate : {gb:,.2f} GB  (~${usd:.2f} at $6.25/TB before the 1 TB free tier)")
    print("(--execute --confirm given) proceeding to real run…")

    if args.phase == "A":
        # Re-load manifest before execution (guard re-check after dry-run)
        manifest = load_manifest()
        check_manifest_allows_slice(manifest, args.slice[1])
        bq_execute(sql)
        print(f"  Phase A INSERT complete for slice {args.slice[0]}..{args.slice[1]}")

        # S3 export: emit the script for founder review (does not run aws commands)
        slice_script, s3_dest = export_slice_to_s3(args.slice[0], args.slice[1])
        print("\n--- S3 export script (review and run manually) ---")
        print(slice_script)
        print("--- end S3 export script ---\n")

        # Advance the ledger
        tb = gb / 1000
        advance_manifest(
            manifest,
            args.slice[0], args.slice[1],
            bytes_scanned_tb=tb,
            cost_usd=usd,
            s3_parquet_key=s3_dest,
        )

    elif args.phase == "B":
        csv_out = os.path.join(ROOT, "data", "gpr_monthly.csv")
        os.makedirs(os.path.dirname(csv_out), exist_ok=True)

        # Run Phase B: owned-table read -> CSV
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
        print(f"  Phase B rollup written -> {csv_out}")

        # S3 upload (mirrors seed_live_baseline --upload)
        export_monthly_rollup_to_s3(csv_out, execute=args.upload)


if __name__ == "__main__":
    main()
