"""QGI live news-pulse poller — hourly Lambda.

Computes a *live* nowcast of the news layer that mirrors the monthly bake
(qgi-gdelt-poc/build_pressure.py) but runs every hour off the raw GDELT
GKG feed instead of the paid BigQuery rollup.

Each run:
  1. reads the cached 90-day daily-share BASELINE (mu/sigma per
     Country|Topic) from S3 — seeded once by seed_live_baseline.py;
  2. fetches ONLY the GKG 15-min files it does not already have (an in-S3
     rolling bucket cache makes this incremental — no file is ever bought
     twice; the most recent few hours are deliberately re-fetched because
     GDELT revises them for a short window);
  3. rolls the trailing 24h into a share-of-country-news per board topic;
  4. z-scores that share against the baseline and maps it to the SAME
     0-100 scale the board uses (50 = own normal, +-20 per sigma);
  5. writes dashboard/hf-pulse-live.json for the frontend to read at
     runtime.

Free by construction: GDELT raw files are public HTTP, boto3 is provided
by the python3.13 runtime, everything else is stdlib. The only AWS spend
is a few seconds of Lambda compute per run (perpetual free tier) and two
small S3 objects.

METHODOLOGY NOTES
- share = topic_docs / country_docs over the window (identical numerator
  and denominator definition to the BigQuery rollup: a doc counts once
  per country it mentions; a topic flag is a V2Themes regex match).
- The baseline mu/sigma are over *daily* shares (leave-one-out is
  inherent: the baseline is historical-only, today is never in it). The
  live window is a rolling 24h ~= one day, so the scales line up.
- SPARSITY SUPPRESSION: a Country|Topic whose window is too thin emits
  `null`, NEVER 0. Absence of news is not calm — it is unknown. The
  frontend renders null as "—", not as a quiet verdict.

The board-topic regexes below MUST stay in sync with the board subset of
qgi-gdelt-poc/topic_theme_patterns.json. test_lambda_function.py asserts
they match when that file is reachable.
"""

from __future__ import annotations  # so type hints don't gate on Py 3.10+

import csv
import io
import json
import os
import re
import zipfile
import urllib.request
from datetime import datetime, timedelta, timezone

# boto3 is provided by the python3.13 Lambda runtime. The import is guarded
# and the client is lazy so the pure logic below is unit-testable off-AWS
# (test_lambda_function.py imports this module without boto3 or a region).
try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:  # pragma: no cover - only in a bare test env
    boto3 = None
    ClientError = Exception

# --------------------------------------------------------------------------
# Configuration (overridable via Lambda env vars; defaults are production)
# --------------------------------------------------------------------------
BUCKET = os.environ.get("QGI_DATA_LAKE_BUCKET", "qgi-data-lake-222222222222")
BASELINE_KEY = os.environ.get("HF_BASELINE_KEY", "dashboard/hf-pulse-baseline.json")
BUCKETS_KEY = os.environ.get("HF_BUCKETS_KEY", "dashboard/hf-pulse-buckets.json")
LIVE_KEY = os.environ.get("HF_LIVE_KEY", "dashboard/hf-pulse-live.json")

# Rolling share window (how much trailing data defines "now").
WINDOW_HOURS = int(os.environ.get("HF_WINDOW_HOURS", "24"))
# How much history the bucket cache retains (>= WINDOW_HOURS so a slow run
# or a GDELT gap never starves the window).
CACHE_HOURS = int(os.environ.get("HF_CACHE_HOURS", "48"))
# The newest N hours are re-fetched every run because GDELT revises files
# for a short window after first publish. Older buckets are never re-bought.
REFETCH_RECENT_HOURS = int(os.environ.get("HF_REFETCH_RECENT_HOURS", "2"))
# Per-invocation hard cap on file fetches (cold-start backstop). Steady
# state is ~12 fetches/run; the cap only bites on a cold cache, which then
# fills over a few hours. Whatever is skipped is logged (never silent).
MAX_FETCH = int(os.environ.get("HF_MAX_FETCH", "60"))

# Sparsity floors over the whole window. Below either, the cell is null.
MIN_COUNTRY_DOCS = int(os.environ.get("HF_MIN_COUNTRY_DOCS", "200"))
MIN_TOPIC_DOCS = int(os.environ.get("HF_MIN_TOPIC_DOCS", "5"))

# Frontend staleness contract: generated_at older than this => not "Live".
STALE_AFTER_HOURS = int(os.environ.get("HF_STALE_AFTER_HOURS", "2"))

# GDELT serves the raw files over HTTPS with a valid cert; prefer it so the
# trailing-window fetches can't be MITM-tampered in transit (the parser
# ingests attacker-influenceable text — counts only, but hygiene still holds).
GDELT_BASE = "https://data.gdeltproject.org/gdeltv2"
LASTUPDATE_URL = f"{GDELT_BASE}/lastupdate.txt"

# GKG 2.1 column indices (0-based).
C_THEMES, C_LOC = 8, 10

# Board topics — the founder-ratified six. Order is fixed: it indexes the
# compact bucket arrays [total, T01, T02, T03, T05, T06, T07].
BOARD = ["T01", "T02", "T03", "T05", "T06", "T07"]
TOPIC_PATTERNS = {
    "T01": r"ELECTION|DEMOCRACY|CONSTITUTIONAL",
    "T02": (
        r"ARMEDCONFLICT|WB_2462_POLITICAL_VIOLENCE|WB_2433_CONFLICT_AND_VIOLENCE"
        r"|WB_2468_CONVENTIONAL_WAR|WB_2451_REBELS|UNGP_CRIME_VIOLENCE|VIOLENT_UNREST"
    ),
    "T03": r"TERROR|EXTREMIS|WB_2467_TERRORISM",
    "T05": r"PROTEST|STRIKE|DEMONSTRAT|\bRIOT",
    "T06": (
        r"ECON_INFLATION|ECON_DEBT|ECON_CENTRALBANK|ECON_CURRENCY_EXCHANGE_RATE"
        r"|ECON_INTEREST_RATES|EPU_CATS_MONETARY_POLICY|WB_318_FINANCIAL_ARCHITECTURE"
        r"|BANKRUPT|RECESSION|WB_442_INFLATION"
    ),
    "T07": r"SANCTIONS|WB_698_TRADE|WB_775_TRADE_POLICY|EMBARGO|TARIFF|FOREIGNINVEST",
}
TOPIC_RE = {t: re.compile(p) for t, p in TOPIC_PATTERNS.items()}

# The 12 PoC countries: FIPS 10-4 (GDELT) -> ISO3 (frontend cell keys).
FIPS_TO_ISO3 = {
    "LE": "LBN", "EG": "EGY", "IR": "IRN", "PK": "PAK", "SU": "SDN", "NI": "NGA",
    "VE": "VEN", "AR": "ARG", "TS": "TUN", "BM": "MMR", "TH": "THA", "BG": "BGD",
}

csv.field_size_limit(10_000_000)

_s3 = None


def _client():
    """Lazy S3 client — created on first use so import stays AWS-free."""
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


# --------------------------------------------------------------------------
# Pure helpers (no AWS, no network — unit-tested directly)
# --------------------------------------------------------------------------
def z_to_100(z: float) -> int:
    """Identical mapping to build_pressure.py: 50 = own mean, +-20 / sigma."""
    return max(2, min(100, round(50 + 20 * z)))


def select_fetch(wanted, buckets, recent_cut, max_fetch):
    """Slots to fetch this run: uncached ones + the revised recent window.

    Honors "never fetch data we already have" — a cached slot is re-fetched
    ONLY if it falls inside the recent (GDELT-revises) window. Returns
    (to_fetch newest-first, skipped_count) with the cold-start cap applied.
    """
    to_fetch = [s for s in wanted if s not in buckets or s >= recent_cut]
    to_fetch.sort(reverse=True)  # newest first — most useful if capped
    skipped = 0
    if len(to_fetch) > max_fetch:
        skipped = len(to_fetch) - max_fetch
        to_fetch = to_fetch[:max_fetch]
    return to_fetch, skipped


def roll_window(buckets, win_stamps):
    """Sum the compact [total, *board] vectors over the in-window slots."""
    agg = {iso3: [0, 0, 0, 0, 0, 0, 0] for iso3 in FIPS_TO_ISO3.values()}
    for stamp, per_country in buckets.items():
        if stamp not in win_stamps:
            continue
        for iso3, vec in per_country.items():
            a = agg.get(iso3)
            if a is None:
                continue
            for i in range(7):
                a[i] += vec[i]
    return agg


def compute_cells(agg, stats):
    """Z-score each Country|Topic against the baseline; sparsity ⇒ null."""
    cells = {}
    for iso3, vec in agg.items():
        total = vec[0]
        for i, topic in enumerate(BOARD, start=1):
            key = f"{iso3}|{topic}"
            stat = stats.get(key)
            num = vec[i]
            if stat is None or total < MIN_COUNTRY_DOCS or num < MIN_TOPIC_DOCS:
                cells[key] = {"pulse": None, "docs": num, "total": total}
                continue
            share = num / total
            sigma = max(float(stat["sigma"]), 1e-9)
            z = (share - float(stat["mu"])) / sigma
            cells[key] = {
                "pulse": z_to_100(z),
                "z": round(z, 2),
                "docs": num,
                "total": total,
            }
    return cells


# --------------------------------------------------------------------------
# S3 + network helpers
# --------------------------------------------------------------------------
def _get_json(key: str):
    """Read+parse a JSON object, or None if it genuinely does not exist yet.

    A MISSING key (NoSuchKey/404) is a normal first-run state -> None. ANY
    other error (IAM deny, wrong bucket/region, throttle, network) is re-raised
    so the invocation FAILS and lands on the DLQ + alarm, rather than silently
    degrading to a "seeding" marker every hour with nobody paged.
    """
    s3 = _client()
    try:
        resp = s3.get_object(Bucket=BUCKET, Key=key)
        return json.loads(resp["Body"].read())
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404"):
            return None  # object not written yet — normal first-run state
        raise  # NoSuchBucket / AccessDenied / throttle / network -> fail + DLQ


def _put_json(key: str, obj) -> None:
    _client().put_object(
        Bucket=BUCKET,
        Key=key,
        Body=json.dumps(obj, separators=(",", ":")).encode("utf-8"),
        ContentType="application/json",
        CacheControl="no-cache",
    )


def _latest_stamp() -> datetime:
    """Newest 15-min GKG slot, parsed from lastupdate.txt (UTC)."""
    txt = urllib.request.urlopen(LASTUPDATE_URL, timeout=30).read().decode()
    name = txt.splitlines()[0].split("/")[-1].split(".")[0]  # YYYYMMDDHHMMSS
    # GDELT stamps are UTC; tag it so any future tz-aware arithmetic is safe.
    return datetime.strptime(name, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)


def _window_stamps(t0: datetime, hours: int):
    """Descending 15-min stamps covering the trailing `hours` from t0."""
    n = hours * 4
    return [(t0 - timedelta(minutes=15 * i)).strftime("%Y%m%d%H%M%S") for i in range(n)]


def _count_file(stamp: str):
    """Fetch + parse one GKG file -> compact [total, *board] per ISO3.

    Returns None on a fetch/parse miss (GDELT has occasional gaps); the
    caller treats a miss as "no bucket for this slot".
    """
    url = f"{GDELT_BASE}/{stamp}.gkg.csv.zip"
    try:
        raw = urllib.request.urlopen(url, timeout=45).read()
        zf = zipfile.ZipFile(io.BytesIO(raw))
        name = zf.namelist()[0]
    except Exception:  # noqa: BLE001
        return None

    # iso3 -> [total, t01, t02, t03, t05, t06, t07]
    counts = {iso3: [0, 0, 0, 0, 0, 0, 0] for iso3 in FIPS_TO_ISO3.values()}
    with zf.open(name) as fh:
        reader = csv.reader(
            io.TextIOWrapper(fh, encoding="utf-8", errors="replace"), delimiter="\t"
        )
        for row in reader:
            if len(row) <= C_LOC:
                continue
            # Distinct country codes this doc attributes to (field index 2 of
            # each ';'-separated V2Locations entry). NB: GDELT geolocation uses
            # FIPS 10-4 here, NOT ISO 3166-1 (so Lebanon=LE, Sudan=SU, Myanmar=BM,
            # Tunisia=TS, Nigeria=NI). FIPS_TO_ISO3 is keyed on those FIPS codes,
            # which MUST match the baseline's country_code (built from the same
            # GDELT field) or a country would silently score null. One count/country.
            fips_set = set()
            for loc in row[C_LOC].split(";"):
                f = loc.split("#")
                if len(f) > 2 and f[2] in FIPS_TO_ISO3:
                    fips_set.add(f[2])
            if not fips_set:
                continue
            themes = row[C_THEMES]
            hits = [1 if TOPIC_RE[t].search(themes) else 0 for t in BOARD]
            for fips in fips_set:
                vec = counts[FIPS_TO_ISO3[fips]]
                vec[0] += 1
                for i, h in enumerate(hits, start=1):
                    vec[i] += h
    # Drop empty countries to keep the cache small.
    return {iso3: vec for iso3, vec in counts.items() if vec[0] > 0}


def _stale_marker(status: str, extra: dict | None = None) -> dict:
    """A live.json that carries no fresh cells (seeding / warming / no data).

    The frontend's staleness gate falls back to the monthly verdict when it
    sees an empty `cells` map or an old generated_at.
    """
    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": status,
        "source": "GDELT GKG raw (live)",
        "window_hours": WINDOW_HOURS,
        "stale_after_hours": STALE_AFTER_HOURS,
        "cells": {},
    }
    if extra:
        out.update(extra)
    return out


# --------------------------------------------------------------------------
# Handler
# --------------------------------------------------------------------------
def lambda_handler(event, context):  # noqa: ARG001
    baseline = _get_json(BASELINE_KEY)
    if not baseline or not baseline.get("stats"):
        # No baseline yet — emit a clean "seeding" marker and stop. The
        # frontend keeps showing the monthly verdict. Founder runs
        # seed_live_baseline.py once to populate the baseline.
        msg = "baseline missing; run seed_live_baseline.py"
        print(f"SEEDING: {msg}")
        _put_json(LIVE_KEY, _stale_marker("seeding", {"note": msg}))
        return {"status": "seeding", "note": msg}

    stats = baseline["stats"]

    # --- incremental fetch -------------------------------------------------
    cache = _get_json(BUCKETS_KEY) or {}
    buckets = cache.get("buckets", {})

    t0 = _latest_stamp()
    wanted = _window_stamps(t0, CACHE_HOURS)
    recent_cut = (t0 - timedelta(hours=REFETCH_RECENT_HOURS)).strftime("%Y%m%d%H%M%S")
    to_fetch, skipped = select_fetch(wanted, buckets, recent_cut, MAX_FETCH)

    fetched = 0
    for stamp in to_fetch:
        result = _count_file(stamp)
        if result is not None:
            buckets[stamp] = result
            fetched += 1

    # Prune anything older than the cache horizon, then persist the cache.
    keep = set(wanted)
    buckets = {s: v for s, v in buckets.items() if s in keep}
    _put_json(
        BUCKETS_KEY,
        {
            "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "newest": t0.strftime("%Y%m%d%H%M%S"),
            "buckets": buckets,
        },
    )
    if skipped:
        print(f"NOTE: cold cache — fetched {fetched}, deferred {skipped} files to next run")

    if not buckets:
        print("WARMING: bucket cache empty after fetch")
        _put_json(LIVE_KEY, _stale_marker("warming"))
        return {"status": "warming"}

    # --- roll the trailing WINDOW_HOURS, then z-score each cell -----------
    win_stamps = set(_window_stamps(t0, WINDOW_HOURS))
    agg = roll_window(buckets, win_stamps)
    cells = compute_cells(agg, stats)

    live = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "live",
        "source": "GDELT GKG raw (live)",
        "vintage": baseline.get("vintage"),
        "baseline_built": baseline.get("built"),
        "window_hours": WINDOW_HOURS,
        "stale_after_hours": STALE_AFTER_HOURS,
        "newest_file": t0.strftime("%Y%m%d%H%M%S"),
        "files_in_window": sum(1 for s in buckets if s in win_stamps),
        "cells": cells,
    }
    _put_json(LIVE_KEY, live)

    live_cells = sum(1 for c in cells.values() if c.get("pulse") is not None)
    print(
        f"OK: wrote {LIVE_KEY} — {live_cells}/{len(cells)} cells live, "
        f"{live['files_in_window']} files in {WINDOW_HOURS}h window, "
        f"fetched {fetched} this run"
    )
    return {
        "status": "live",
        "live_cells": live_cells,
        "total_cells": len(cells),
        "fetched": fetched,
        "files_in_window": live["files_in_window"],
    }
