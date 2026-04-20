#!/usr/bin/env python3
"""
Phase 1 — FAOSTAT domain fetcher (one Fargate Spot task per FAOSTAT domain).

Sibling to batch/indicator-fetcher/src/fetch_one.py (the per-indicator
World Bank fetcher). FAOSTAT's bulk-download pattern is different:
each domain (FS, RL, RFB, TM, PP, Forestry, GT, QCL) exposes ONE ZIP
file containing all indicators, years, and countries in that domain.
Downloading 8 domain ZIPs is far more efficient than 15 per-indicator
API calls, which is why this fetcher is invoked per-domain, not
per-indicator.

## Inputs (env vars set by dispatcher, #240 Phase A)

- DOMAIN_CODE       — e.g., "FS" (Food Security). Drives the ZIP URL.
- INDICATORS_JSON   — JSON array of indicator specs in this domain:
  ``[{"id_string": "FA-01", "numeric_id": 59,
      "item_code": 21010, "element_code": 6121}, ...]``
  The fetcher filters the domain CSV to rows matching
  ``(item_code, element_code)`` per indicator and emits one Parquet
  per indicator id_string (matching the WB layout).
- RUN_ID            — Step Function execution ID, used for tracker rows.
- S3_BUCKET         — data-lake bucket.
- COUNTER_TABLE, TRACKER_TABLE, INDICATOR_VALUES_TABLE — DDB tables
  (same ones the WB fetcher writes to).

## Output layout (matches WB fetcher, so downstream Phase 2/3 are
blind to the source)

``s3://{BUCKET}/pipeline-A-indicator-extractor/output/parquet/{id_string}/year=YYYY/country=XXX/data.parquet``

One Parquet file per (indicator, year, country) partition. Keeps the
Glue table's partition key scheme identical to the WB side.

## Failure handling

- L1: 5 exponential-backoff retries on the domain ZIP download
- L2: Batch job retry (attempts=2, same as WB — timeouts aren't
  transient). Hard-killed tasks are caught by the #243 EventBridge
  failure-handler Lambda which writes FAILED tracker rows externally.
- L3: best-effort counter decrement on any uncaught exception so the
  Phase 1 checker doesn't hang waiting for a dead task.
- L4: per-indicator decrement (this task writes N tracker rows and
  decrements the counter by N — one per indicator in INDICATORS_JSON).

## Country code mapping

FAOSTAT uses its own "area code" numbering distinct from both UN M49
and ISO 3166. The mapping lives in ``qgi-data/registries/country-m49-map.csv``
which the fetcher reads from S3 at startup. Area codes that don't map
to a QGI canonical country (e.g., regional aggregates like "Africa")
are dropped.
"""

import json
import logging
import os
import random
import re
import sys
import time
import traceback
import zipfile
from decimal import Decimal
from io import BytesIO, StringIO

import boto3
import pandas as pd
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

REGION = os.environ.get("AWS_REGION", "eu-central-1")
BUCKET = os.environ["S3_BUCKET"]
RUN_ID = os.environ["RUN_ID"]
DOMAIN_CODE = os.environ["DOMAIN_CODE"]
INDICATORS_JSON_RAW = os.environ["INDICATORS_JSON"]

COUNTER_TABLE = os.environ.get("COUNTER_TABLE", "qgi-pipeline-a-counter")
TRACKER_TABLE = os.environ.get("TRACKER_TABLE", "qgi-indicator-updates")
INDICATOR_VALUES_TABLE = os.environ.get(
    "INDICATOR_VALUES_TABLE", "qgi-indicator-values"
)

# FAOSTAT bulk-download URL template (updated 2026-04-20 Phase B smoke test).
#
# FAOSTAT retired ``https://bulks-faostat.fao.org/production/{DOMAIN_CODE}...``
# sometime after the original design — both the host and the filename
# prefix changed. The current (working) path is
# ``https://fenixservices.fao.org/faostat/static/bulkdownloads/{Domain_Full_Name}_E_All_Data_(Normalized).zip``
# where ``Domain_Full_Name`` is the human-readable domain name with
# underscores (e.g. ``Food_Security_Data``, not the short code ``FS``).
#
# We keep short codes in the XLSX and map to full names here. If a
# domain we haven't mapped yet is requested, the fetcher raises a
# descriptive error pointing at this block. To extend: append to
# ``_FAO_DOMAIN_FULL_NAMES`` — no code change elsewhere.
FAO_BULK_URL_TEMPLATE = os.environ.get(
    "FAO_BULK_URL_TEMPLATE",
    "https://fenixservices.fao.org/faostat/static/bulkdownloads/{domain_full}_E_All_Data_(Normalized).zip",
)

# Short domain code (as written in the XLSX) → full name used in the
# FAOSTAT bulk-download URL. Start small; extend as more FAO domains
# land in the catalog. Extracted from the FAOSTAT bulk-downloads page.
_FAO_DOMAIN_FULL_NAMES = {
    "FS":       "Food_Security_Data",       # Suite of Food Security Indicators
    # Future (verify at https://www.fao.org/faostat/en/#data before use):
    # "RL":     "Inputs_LandUse",
    # "RFB":    "FertilizersProduct",        # or Inputs_FertilizersArchive
    # "TM":     "Trade_DetailedTradeMatrix",
    # "PP":     "Prices",
    # "QCL":    "Production_Crops_Livestock",
    # "GT":     "Emissions_Totals",
    # "Forestry":"Forestry",
}

# Browser-like User-Agent — some FAOSTAT CDNs (and many other bulk hosts)
# block the default ``python-requests/X.Y.Z`` UA.
_HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; QGI-pipeline/1.0; +https://qgintelligence.com)",
}

JITTER_MIN_S = int(os.environ.get("JITTER_MIN_S", "60"))
JITTER_MAX_S = int(os.environ.get("JITTER_MAX_S", "300"))
MAX_FETCH_ATTEMPTS = int(os.environ.get("MAX_FETCH_ATTEMPTS", "5"))

S3_OUTPUT_PREFIX = "pipeline-A-indicator-extractor/output"
# Country code map lives in qgi-data-synced-to-S3 at a deterministic key
# so the fetcher doesn't need the qgi-data repo mounted. Produced by
# qgi-data/scripts/sync_curated_events.py (extended) — see #241.
COUNTRY_M49_MAP_KEY = "pipeline-A-indicator-extractor/input/country-m49-map.csv"


# ---------------------------------------------------------------------------
# Boto3 clients
# ---------------------------------------------------------------------------

s3 = boto3.client("s3", region_name=REGION)
dynamodb_resource = boto3.resource("dynamodb", region_name=REGION)

counter_table = dynamodb_resource.Table(COUNTER_TABLE)
tracker_table = dynamodb_resource.Table(TRACKER_TABLE)
indicator_values_table = dynamodb_resource.Table(INDICATOR_VALUES_TABLE)


# ---------------------------------------------------------------------------
# Country mapping
# ---------------------------------------------------------------------------


def load_country_map() -> dict[int, dict]:
    """Return ``{fao_area_code: {qgi_country_id, qgi_name, iso_alpha3}}``.

    Entries where fao_area_code is empty (Kosovo) are skipped because
    the lookup key wouldn't match anything in the FAOSTAT data anyway.
    """
    logger.info(f"Loading country map from s3://{BUCKET}/{COUNTRY_M49_MAP_KEY}")
    obj = s3.get_object(Bucket=BUCKET, Key=COUNTRY_M49_MAP_KEY)
    df = pd.read_csv(obj["Body"])
    out: dict[int, dict] = {}
    for _, row in df.iterrows():
        fao = row.get("fao_area_code")
        # Skip rows without a FAO code (Kosovo)
        if pd.isna(fao) or fao == "":
            continue
        out[int(fao)] = {
            "qgi_country_id": int(row["qgi_country_id"]),
            "qgi_name": str(row["qgi_name"]),
            "iso_alpha3": str(row.get("iso_alpha3") or ""),
        }
    logger.info(f"Loaded {len(out)} FAO→QGI country mappings")
    return out


# ---------------------------------------------------------------------------
# FAOSTAT download + extract
# ---------------------------------------------------------------------------


def _jitter_sleep() -> None:
    """Random 60-300s sleep before the HTTP call. Matches the WB fetcher's
    rate-limiting-via-distribution pattern. FAOSTAT doesn't rate-limit
    as aggressively as WB but the pattern keeps the 8 parallel domain
    tasks from hitting the CDN at the exact same second."""
    jitter = random.uniform(JITTER_MIN_S, JITTER_MAX_S)
    logger.info(f"Jitter sleep {jitter:.1f}s before domain download")
    time.sleep(jitter)


def fetch_domain_csv(domain_code: str) -> bytes:
    """Download the FAOSTAT domain ZIP and return the extracted CSV bytes.

    FAOSTAT bulk ZIPs contain at least one main CSV (we select the first
    non-flags .csv in the ZIP via a heuristic — the filename prefix
    matches the full domain name, not the short code). Returns the raw
    CSV bytes (may be large — 50-200MB).
    """
    domain_full = _FAO_DOMAIN_FULL_NAMES.get(domain_code)
    if domain_full is None:
        raise RuntimeError(
            f"Unknown FAOSTAT domain {domain_code!r}. Add it to "
            f"_FAO_DOMAIN_FULL_NAMES in fetch_domain.py — see the "
            f"comment above that dict for the FAOSTAT URL convention."
        )
    url = FAO_BULK_URL_TEMPLATE.format(domain_full=domain_full)
    logger.info(
        f"Downloading FAOSTAT domain {domain_code} (full={domain_full!r}) from {url}"
    )
    last_exc: Exception | None = None
    for attempt in range(1, MAX_FETCH_ATTEMPTS + 1):
        try:
            # 5-minute timeout — large ZIPs on the FAO CDN can be slow.
            # The Fargate task has a 60-min overall timeout so this is
            # conservatively inside that budget.
            resp = requests.get(url, timeout=300, headers=_HTTP_HEADERS)
            resp.raise_for_status()
            logger.info(
                f"Downloaded {len(resp.content):,} bytes in attempt {attempt}"
            )
            with zipfile.ZipFile(BytesIO(resp.content)) as zf:
                # Heuristic: pick the *.csv that's NOT a flags-only file.
                # FAOSTAT bulk ZIPs sometimes include a separate flags CSV
                # (e.g., FS_E_Flags.csv) we don't need.
                csv_names = [
                    n for n in zf.namelist()
                    if n.lower().endswith(".csv") and "_flag" not in n.lower()
                ]
                if not csv_names:
                    raise RuntimeError(
                        f"No main CSV found in {domain_code} ZIP. "
                        f"Contents: {zf.namelist()}"
                    )
                csv_name = csv_names[0]
                logger.info(f"Extracting {csv_name} from ZIP")
                return zf.read(csv_name)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            backoff = min(60, 2 ** attempt)
            logger.warning(
                f"Attempt {attempt}/{MAX_FETCH_ATTEMPTS} failed: {exc}. "
                f"Backing off {backoff}s"
            )
            time.sleep(backoff)
    raise RuntimeError(
        f"FAOSTAT download for {domain_code} failed after "
        f"{MAX_FETCH_ATTEMPTS} attempts: {last_exc}"
    )


# ---------------------------------------------------------------------------
# Indicator extraction + write
# ---------------------------------------------------------------------------


def extract_indicator(
    df_domain: pd.DataFrame,
    indicator_spec: dict,
    country_map: dict[int, dict],
) -> pd.DataFrame:
    """Filter the domain-wide CSV to one indicator's rows and attach
    QGI country IDs. Returns a DataFrame with columns:
    ``(country_id, country_name, year, value)``.

    ``indicator_spec`` must have item + element codes. Both short
    (``item_code`` / ``element_code``) and XLSX-native long
    (``fao_item_code`` / ``fao_element_code``) keys are accepted —
    dispatcher pass-through preserves the XLSX column names verbatim,
    so the long form is what arrives in practice. The short form is
    retained for hand-authored smoke tests and legacy payloads.
    """
    def _coerce(spec: dict, *candidates: str) -> int:
        for key in candidates:
            if key in spec and spec[key] is not None:
                return int(spec[key])
        raise KeyError(
            f"Indicator {spec.get('id_string','?')!r} missing required "
            f"FAOSTAT code: tried {candidates}. Keys present: {list(spec)}"
        )

    item_code = _coerce(indicator_spec, "item_code", "fao_item_code")
    element_code = _coerce(indicator_spec, "element_code", "fao_element_code")

    # Compare as strings. FAOSTAT item codes are a mix of pure ints
    # ("21010") and int-with-letter-suffix ("210401M", "210400TSUB"),
    # so pandas loads the column as `object` dtype. An `int == object`
    # comparison silently returns all-False rather than raising, which
    # bit us during the #241 Phase B smoke test (every indicator looked
    # like "0 rows matched"). Coercing both sides to str gives reliable
    # equality and will still work if we later add string-coded
    # indicators in the catalog.
    item_code_s = str(item_code)
    element_code_s = str(element_code)
    subset = df_domain[
        (df_domain["Item Code"].astype(str) == item_code_s)
        & (df_domain["Element Code"].astype(str) == element_code_s)
    ].copy()

    if subset.empty:
        logger.warning(
            f"Indicator {indicator_spec['id_string']} (item={item_code}, "
            f"element={element_code}) returned 0 rows from domain CSV"
        )
        return pd.DataFrame(columns=["country_id", "country_name", "year", "value"])

    # Map FAOSTAT "Area Code" to QGI country_id. Drop unmapped rows
    # (regional aggregates, USSR pre-1991, etc.).
    def _mapper(area_code):
        entry = country_map.get(int(area_code)) if pd.notna(area_code) else None
        return entry

    subset["_qgi"] = subset["Area Code"].apply(_mapper)
    before = len(subset)
    subset = subset[subset["_qgi"].notna()]
    after = len(subset)
    if before != after:
        logger.info(
            f"  Dropped {before - after} rows with unmapped FAO area codes "
            f"(regional aggregates, etc.)"
        )

    subset["country_id"] = subset["_qgi"].apply(lambda x: x["qgi_country_id"])
    subset["country_name"] = subset["_qgi"].apply(lambda x: x["qgi_name"])

    # Year normalization.
    #
    # FAOSTAT domains mix two year encodings:
    #   * single year: ``Year`` = "2023", ``Year Code`` = 2023
    #   * 3-year average (FS, some others): ``Year`` = "2000-2002"
    #     (range string, not int-castable), ``Year Code`` = 20002002
    #     (concat of start+end).
    # We use ``Year Code`` as the authoritative numeric year because
    # it's always integer-castable. For ranges we take the END year
    # (the last 4 digits) — that matches FAOSTAT's convention of
    # labelling 3-year averages by their terminal year, and keeps
    # the Parquet partition layout (``year=YYYY``) stable across
    # single-year and range indicators.
    def _end_year_from_code(yc):
        s = str(int(yc))  # "20002002" or "2023"
        return int(s[-4:])
    subset["year"] = subset["Year Code"].apply(_end_year_from_code)
    subset = subset.rename(columns={"Value": "value"})

    # Value coercion to numeric.
    #
    # FAOSTAT ``Value`` cells contain a mix of:
    #   * pure numerics ("87", "29.5") — the common case
    #   * below-detection-limit sentinels ("<0.1", "<0.5") — LEFT-
    #     CENSORED observations. Dropping them silently removes
    #     food-secure countries (Norway, Japan, Singapore) from the
    #     SCDI graph — a reporting bias the three expert reviewers
    #     (UN/MIT/TUM) all flagged as unacceptable. Epidemiology
    #     convention: impute as half the detection limit (0.1 -> 0.05).
    #   * suppression sentinels ("...", "..") — MNAR (Missing Not At
    #     Random, typically low-capacity statistical systems or
    #     confidentiality). Drop with a separate counter so the ops
    #     report can distinguish data gaps from censoring.
    #   * unknown flag characters — anything else non-numeric. Drop
    #     and log so a future FAOSTAT schema change does not
    #     silently evaporate rows.
    #
    # Without this block every Parquet's ``value`` column is written
    # as object (string) dtype, which Phase 2 SCDI cannot compute
    # Pearson on. Blocker for the #241 Phase B full pipeline run.
    raw = subset["value"].astype(str)

    # Pass 1: below-detection ("<0.1") -> half-limit ("0.05"). Do this
    # BEFORE numeric coercion so these cells survive as real floats.
    _BELOW_DETECT = raw.str.match(r"^\s*<\s*\d+\.?\d*\s*$", na=False)
    if _BELOW_DETECT.any():
        def _half_limit(s: str) -> str:
            m = re.match(r"^\s*<\s*(\d+\.?\d*)\s*$", s)
            return str(float(m.group(1)) / 2.0) if m else s
        subset.loc[_BELOW_DETECT, "value"] = (
            raw[_BELOW_DETECT].apply(_half_limit)
        )

    # Pass 2: identify suppression and unknown tokens BEFORE coercion
    # so we can count them distinctly for ops reporting.
    numeric = pd.to_numeric(subset["value"], errors="coerce")
    _NUMERIC_OK = numeric.notna()
    _SUPPRESSED = (
        ~_NUMERIC_OK
        & raw.str.match(r"^\s*\.{2,3}\s*$", na=False)
    )
    _UNKNOWN = ~_NUMERIC_OK & ~_SUPPRESSED

    n_below_detect = int(_BELOW_DETECT.sum())
    n_suppressed = int(_SUPPRESSED.sum())
    n_unknown = int(_UNKNOWN.sum())
    logger.info(
        f"  Value coercion: {n_below_detect} '<X' -> X/2; "
        f"{n_suppressed} suppressed ('...') dropped; "
        f"{n_unknown} unknown-flag rows dropped; "
        f"{int(_NUMERIC_OK.sum())} rows retained as numeric"
    )
    if n_unknown:
        # Log up to 5 examples so a schema change is discoverable.
        examples = raw[_UNKNOWN].drop_duplicates().head(5).tolist()
        logger.warning(
            f"  Unknown non-numeric tokens in Value column "
            f"(first 5 distinct): {examples}"
        )

    # Force float64 always — pandas would infer int64 if all remaining
    # values happen to be integer-valued (e.g., Avg Dietary Energy Supply
    # Adequacy is whole percentages). WB fetcher writes float64 for every
    # indicator. Keeping both providers on the same Parquet ``value``
    # dtype lets Athena UNION WB and FAOSTAT rows in a single Glue
    # partitioned table without schema-evolution compromises.
    subset["value"] = numeric.astype("float64")
    subset = subset.dropna(subset=["value"])
    return subset[["country_id", "country_name", "year", "value"]]


def write_parquet(
    df_indicator: pd.DataFrame,
    indicator_spec: dict,
) -> int:
    """Partition by (year, country_id) and write one Parquet per partition.

    Layout matches the WB fetcher output exactly so Phase 2's Glue
    crawler + SCDI finder are indifferent to the source provider.
    Returns the number of Parquet objects written.
    """
    id_string = indicator_spec["id_string"]
    written = 0
    for (year, country_id), grp in df_indicator.groupby(["year", "country_id"]):
        if grp.empty:
            continue
        key = (
            f"{S3_OUTPUT_PREFIX}/parquet/{id_string}/"
            f"year={int(year)}/country={int(country_id)}/data.parquet"
        )
        # pandas → in-memory Parquet bytes → S3
        buf = BytesIO()
        grp[["value"]].to_parquet(buf, index=False)
        buf.seek(0)
        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=buf.read(),
            ContentType="application/octet-stream",
        )
        written += 1
    return written


# ---------------------------------------------------------------------------
# DynamoDB status writes
# ---------------------------------------------------------------------------


def write_tracker_row(indicator_id: str, status: str, **kwargs) -> None:
    """One row per (run_id, indicator_id) — same shape as WB side so the
    Phase 6 reporter can uniformly enumerate Phase 1 results."""
    item = {
        "run_id": RUN_ID,
        "indicator_id": indicator_id,
        "status": status,
        "provider": "FAOSTAT",
        "updated_at": Decimal(str(time.time())),
    }
    item.update(kwargs)
    tracker_table.put_item(Item=item)


def decrement_counter(by: int = 1) -> None:
    """Decrement ``qgi-pipeline-a-counter[run_id].pending`` by N.

    The dispatcher seeded ``pending=N`` where N is the total number of
    INDICATORS across ALL providers (not domains). So for FAOSTAT, a
    domain task that successfully emits 6 indicators decrements by 6.
    """
    counter_table.update_item(
        Key={"run_id": RUN_ID},
        UpdateExpression="ADD pending :neg",
        ExpressionAttributeValues={":neg": Decimal(-by)},
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    indicators = json.loads(INDICATORS_JSON_RAW)
    logger.info(
        f"FAOSTAT fetcher: domain={DOMAIN_CODE}, "
        f"indicators={[i['id_string'] for i in indicators]}"
    )

    _jitter_sleep()

    try:
        csv_bytes = fetch_domain_csv(DOMAIN_CODE)
    except Exception as exc:  # noqa: BLE001
        # Download failed after all retries. Write FAILED rows for every
        # indicator in this batch + decrement counter by their count so
        # the Phase 1 checker advances.
        logger.error(f"Domain fetch failed: {exc}\n{traceback.format_exc()}")
        for ind in indicators:
            write_tracker_row(ind["id_string"], "FAILED", error=str(exc)[:500])
        decrement_counter(by=len(indicators))
        return 1

    # Parse the CSV once and reuse across indicators in this domain.
    # FAOSTAT files use latin-1 encoding for some historical entries
    # (e.g., São Tomé e Príncipe).
    try:
        df_domain = pd.read_csv(StringIO(csv_bytes.decode("latin-1")))
    except Exception as exc:  # noqa: BLE001
        logger.error(f"CSV parse failed: {exc}")
        for ind in indicators:
            write_tracker_row(ind["id_string"], "FAILED", error=str(exc)[:500])
        decrement_counter(by=len(indicators))
        return 1

    country_map = load_country_map()

    for ind in indicators:
        try:
            df_ind = extract_indicator(df_domain, ind, country_map)
            written = write_parquet(df_ind, ind)
            write_tracker_row(
                ind["id_string"],
                "SUCCESS" if written > 0 else "EMPTY",
                rows=Decimal(len(df_ind)),
                parquet_files=Decimal(written),
            )
            logger.info(
                f"  {ind['id_string']}: {len(df_ind)} rows, "
                f"{written} Parquet partitions"
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                f"Indicator {ind['id_string']} failed: {exc}\n"
                f"{traceback.format_exc()}"
            )
            write_tracker_row(ind["id_string"], "FAILED", error=str(exc)[:500])

    # Decrement counter by the full batch size at the end (one atomic op).
    decrement_counter(by=len(indicators))

    return 0


if __name__ == "__main__":
    sys.exit(main())
