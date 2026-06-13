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

Stdlib only (json/argparse/os/re/subprocess). No pandas/numpy/scipy.
Tested: python -m pytest tests/ -v  (pure render_sql / dictionary-load targets;
the bq subprocess path is a verbatim port of seed_live_baseline.bq_query and is
NOT exercised here - no creds).
"""
import argparse
import json
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.abspath(__file__))
SQL_TEMPLATE = os.path.join(ROOT, "gpr_rollup.sql")
DICT_FILE = os.path.join(ROOT, "gpr-theme-dictionary-v2.json")

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
# bq dry-run byte estimate (verbatim port of seed_live_baseline.bq_query)
# ----------------------------------------------------------------------------
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
    env["CLOUDSDK_PYTHON"] = (
        r"/workspace\google-cloud-sdk\platform\bundledpython\python.exe"
    )
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
    args = ap.parse_args()

    cats = load_categories()
    country_fips = None if args.all_countries else GPRC_FIPS_ILLUSTRATIVE
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
    # Dry-run estimate first (free), print it, THEN the founder wires the real run.
    gb = bq_dry_run_bytes(sql)
    usd = max(0.0, gb / 1000) * 6.25  # on-demand; first 1 TB/month free
    print(f"dry-run estimate : {gb:,.2f} GB  (~${usd:.2f} at $6.25/TB before the 1 TB free tier)")
    print("(--execute --confirm given) proceeding to real run…")
    # Phase B is a read-only SELECT: port seed_live_baseline.bq_query(csv_out=...)
    # to land the CSV here, then run validate against gpr_export.xls. Phase A's
    # CREATE/INSERT needs a WRITE-capable role (NOT qgi-claude-readonly) and is
    # left for the founder to execute deliberately.
    raise SystemExit(
        "STOP: real execution is intentionally not wired in this PRE-CREDS scaffold. "
        "Founder: for Phase B, port seed_live_baseline.bq_query(csv_out=...) to write "
        "the rollup CSV; for Phase A, run the rendered CREATE/INSERT with a write role."
    )


if __name__ == "__main__":
    main()
