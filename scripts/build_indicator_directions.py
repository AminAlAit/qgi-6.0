"""
build_indicator_directions.py — generator for indicator-directions.json.

Parses the two cross-Opus working drafts (cascade-side + ML-side) and
emits the canonical {api_code -> direction} JSON that
validate_weight_matrix.py v4 consumes in arms A and B (signed scoring).

Schema (matches load_direction_annotations contract):
  {"schema_version": N,
   "generated": "ISO 8601 UTC",
   "directions": [
     {"api_code": "v2x_libdem", "direction": +1, "tag": "[lit-only]",
      "justification": "first ~250 chars from working draft", "source": "cascade"},
     ...
   ]}

Inputs:
  - qgi-docs/internal/ops/cascade-track/catalog-direction-annotation-cascade-side.md
  - qgi-docs/internal/ops/ml-track/catalog-direction-annotation-ml-side.md

Output:
  - qgi-data/reference/indicator-directions.json

Conflict resolution policy (per Lane B sector split + R2):
  If the same api_code appears in both files with different directions,
  cascade wins by default (cascade owns macro/economic + governance per
  the 2026-05-10 sector split). If cascade has direction:0 and ML has a
  non-zero direction with the same api_code, the api_code is flagged as
  a Majles candidate and emitted with cascade's direction:0 — the
  literature default holds per R1.

Determinism: same input MDs → byte-identical output JSON. Sorted by
api_code; no wall-clock fields in `directions[]` rows; only the
top-level `generated` field carries a timestamp.

Usage:
  python qgi-ml/scripts/build_indicator_directions.py
  python qgi-ml/scripts/build_indicator_directions.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve()
ROOT = SCRIPT_PATH.parents[2]

CASCADE_DRAFT = (
    ROOT / "qgi-docs" / "internal" / "ops" / "cascade-track"
    / "catalog-direction-annotation-cascade-side.md"
)
ML_DRAFT = (
    ROOT / "qgi-docs" / "internal" / "ops" / "ml-track"
    / "catalog-direction-annotation-ml-side.md"
)
OUTPUT_JSON = ROOT / "qgi-data" / "reference" / "indicator-directions.json"

SCHEMA_VERSION = 1

# Catalog-row regex. Two accepted patterns:
#   1. | **WB-NN API.CODE** (Name, range) | **±1/0** | justification | `[tag]` |
#   2. | **API.CODE** (Name, range) | **±1/0** | justification | `[tag]` |
# Cascade uses pattern 1 for V-Dem (VD-NN v2x_xxx) + WGI (CC.EST without
# catalog prefix on the V-Dem-style indicators, but WGI ones use bare
# pattern 2: e.g. "**CC.EST** (Control of Corruption, ...)").
# ML uses pattern 1 for WB-NN coded indicators (e.g. WB-03 SM.POP.REFG.OR)
# and pattern 2 for indicators referenced bare (e.g. SE.ADT.LITR.ZS).
#
# Catalog-code (optional): [A-Z]{2,3}-[A-Z0-9]+  (e.g., VD-01, WB-P5, FA-01)
# API code: any token of [A-Za-z0-9_.] characters
ROW_RE = re.compile(
    # opening pipe, ** marker
    r"^\|\s*\*\*"
    # optional catalog code + space (group 1: catalog_code, may be None)
    r"(?:([A-Z]{2,3}-[A-Z0-9P]+)\s+)?"
    # api_code (group 2)
    r"([A-Za-z0-9_.]+)"
    # ** marker close + optional " (..." annotation
    r"\*\*\s*(?:\([^)]*\))?"
    # separator pipe + direction (group 3: -1/+1/0)
    r"\s*\|\s*\*\*([+\-]?[01])\*\*"
    # separator pipe + justification (group 4) — non-greedy up to next |
    r"\s*\|\s*([^|]*?)"
    # final pipe + tag column (group 5).
    # Cascade uses `[lit-only]`-style backtick markers; ML uses free
    # text (e.g., "High confidence (...)"). Accept either; strip
    # bracket-decoration on emit so the consumer sees a consistent
    # tag-string format.
    r"\s*\|\s*(.*?)\s*\|?\s*$",
)


def _normalize_tag(raw_tag: str) -> str:
    """Strip bracket/backtick decoration from a tag column value.

    Cascade tags: `[lit-only]` (backtick + brackets). ML tags: free
    text like "High confidence (...)". Returns the inner content for
    cascade, the raw string for ML — both as plain strings safe to
    embed in JSON.
    """
    t = raw_tag.strip().rstrip("|").strip()
    # Backtick-bracket pattern → strip both
    m = re.match(r"^`?\[([^]]+)\]`?$", t)
    if m:
        return f"[{m.group(1)}]"
    return t


def parse_draft(path: Path, source_label: str) -> list[dict]:
    """Extract direction-annotation rows from a working-draft markdown.

    Returns a list of {api_code, direction, tag, justification, source}.
    Rows that don't match the canonical pattern are skipped silently
    (e.g., header/divider/explanatory rows). Caller can compare count
    against the draft's claimed-indicator-count to detect drift.
    """
    if not path.exists():
        print(f"[WARN] working draft not found: {path}", file=sys.stderr)
        return []

    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        catalog_code, api_code, sign, justification, tag = m.groups()
        # Normalize "+1"/"−1"/"0" → int. Note: ROW_RE matches "1", "-1", "+1"
        # via the [+\-]?[01] pattern. Map to int directly.
        if sign == "0":
            direction = 0
        elif sign == "1" or sign == "+1":
            direction = 1
        elif sign == "-1":
            direction = -1
        else:
            # Should not reach here given the regex, but defensive.
            print(f"[WARN] unparseable sign {sign!r} for {api_code}; skipped",
                  file=sys.stderr)
            continue
        # Truncate justification to a manageable size (full prose lives in
        # the working drafts; the JSON is for machine consumption + audit
        # trail).
        just = justification.strip()
        if len(just) > 300:
            just = just[:297] + "..."
        rows.append({
            "api_code": api_code,
            "direction": direction,
            "tag": _normalize_tag(tag),
            "justification": just,
            "source": source_label,
            "catalog_code": catalog_code,  # may be None for bare-pattern rows
        })
    return rows


def merge_with_conflict_resolution(
    cascade_rows: list[dict], ml_rows: list[dict],
) -> tuple[list[dict], list[dict]]:
    """Merge cascade + ML rows; cascade wins on conflict per Lane B R2.

    Returns (merged_rows, conflicts) where:
      - merged_rows: deduped + sorted by api_code; ready for JSON emit
      - conflicts: list of {api_code, cascade_direction, ml_direction,
                            resolved_to, reason} for the audit trail

    Conflict resolution:
      1. Same api_code in both files with same direction → emit once
         (source="cascade" wins, ML row dropped)
      2. Same api_code with DIFFERENT directions → cascade wins; emit
         cascade's direction; flag in conflicts list with reason
      3. Cascade has direction:0 + ML has non-zero (the v2cseeorgs
         pattern) → cascade's direction:0 wins per R1 mixed-lit
         fallback; flag in conflicts list as a Majles candidate
    """
    by_api: dict[str, dict] = {}
    conflicts: list[dict] = []

    # Insert cascade first (always wins on conflict)
    for row in cascade_rows:
        by_api[row["api_code"]] = row

    # Then ML — log appropriately if api_code already present from cascade.
    # T4 strict review fix: split overlaps into two semantic buckets:
    #  - sign_conflicts: cascade ±1 vs ML ∓1 (R2: cascade wins)
    #  - deferral_overrides: cascade 0 (Majles-deferred) vs ML ±1
    #    (R1: cascade's mixed-lit fallback wins; ML's non-zero is the
    #    unresolved evidence, not "wrong")
    # Conflating these in one `conflicts` list mislabeled R1 deferrals
    # as R2 conflicts and made the audit trail harder to read at Majles.
    for row in ml_rows:
        api = row["api_code"]
        if api in by_api:
            c_row = by_api[api]
            if c_row["direction"] == row["direction"]:
                # Same sign — cascade-source win is silent
                continue
            entry = {
                "api_code": api,
                "cascade_direction": c_row["direction"],
                "cascade_tag": c_row["tag"],
                "ml_direction": row["direction"],
                "ml_tag": row["tag"],
                "resolved_to": c_row["direction"],
                "resolved_source": "cascade",
            }
            if c_row["direction"] == 0 and row["direction"] != 0:
                # R1 deferral: cascade explicitly chose direction:0 because
                # the literature is mixed. ML's non-zero is not "wrong" —
                # it's the unresolved evidence cascade is deferring on.
                entry["conflict_type"] = "deferral"
                entry["reason"] = (
                    "Lane B R1 (mixed-lit fallback): cascade explicitly "
                    "marked direction:0 (Majles-deferred); ML's non-zero "
                    "sign is unresolved evidence, not a contradiction. "
                    "Majles re-decides when ML cites conflicting external "
                    "literature."
                )
            else:
                # R2 sign conflict: cascade ±1 vs ML ∓1 (genuine contradiction)
                entry["conflict_type"] = "sign"
                entry["reason"] = (
                    "Lane B R2: cascade's literature default wins on "
                    "cross-Opus sign conflicts. ML-Opus may escalate to "
                    "Majles with conflicting external evidence; until then, "
                    "cascade's sign holds."
                )
            conflicts.append(entry)
            continue
        by_api[api] = row

    merged = sorted(by_api.values(), key=lambda r: r["api_code"])
    return merged, conflicts


def emit_json(
    rows: list[dict], conflicts: list[dict], cascade_n: int, ml_n: int,
) -> dict:
    """Build the output JSON object matching load_direction_annotations()
    expected schema."""
    # Strip the `catalog_code` field from emitted rows — it's a working
    # provenance breadcrumb but not part of the loader contract.
    directions = [
        {
            "api_code": r["api_code"],
            "direction": r["direction"],
            "tag": r["tag"],
            "justification": r["justification"],
            "source": r["source"],
        }
        for r in rows
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "method": (
            "Parses cascade-side + ML-side working drafts at "
            "qgi-docs/internal/ops/{cascade,ml}-track/"
            "catalog-direction-annotation-{cascade,ml}-side.md and emits "
            "{api_code -> direction} for the indicators with literature-"
            "defensible signs. Cascade wins on sign conflicts per "
            "Lane B R1+R2 (cross-opus-chat.md 2026-05-10)."
        ),
        "source_drafts": {
            # POSIX-forward-slash paths for cross-platform diff-stability:
            # without .as_posix() the JSON has Windows backslashes on
            # Windows runs and forward slashes on Linux CI, which produces
            # noisy diffs every regeneration (T2 strict review fix).
            "cascade": CASCADE_DRAFT.relative_to(ROOT).as_posix(),
            "ml": ML_DRAFT.relative_to(ROOT).as_posix(),
        },
        "row_counts": {
            "cascade_rows_parsed": cascade_n,
            "ml_rows_parsed": ml_n,
            "merged_rows": len(directions),
            "conflicts_resolved": len(conflicts),
        },
        "conflicts": conflicts,
        "directions": directions,
    }


def main(dry_run: bool = False) -> int:
    print(f"[1] Parsing cascade draft: {CASCADE_DRAFT.relative_to(ROOT)}")
    cascade_rows = parse_draft(CASCADE_DRAFT, source_label="cascade")
    print(f"    parsed {len(cascade_rows)} rows")

    print(f"[2] Parsing ML draft: {ML_DRAFT.relative_to(ROOT)}")
    ml_rows = parse_draft(ML_DRAFT, source_label="ml-opus")
    print(f"    parsed {len(ml_rows)} rows")

    print(f"[3] Merging with Lane B conflict resolution (cascade wins)")
    merged, conflicts = merge_with_conflict_resolution(cascade_rows, ml_rows)
    print(f"    merged {len(merged)} rows ({len(conflicts)} conflicts resolved)")

    if conflicts:
        print(f"\n[!] Sign conflicts (cascade default wins):")
        for c in conflicts:
            print(f"    {c['api_code']}: cascade={c['cascade_direction']:+d} "
                  f"({c['cascade_tag']}); ml={c['ml_direction']:+d} "
                  f"({c['ml_tag']}) → resolved {c['resolved_to']:+d}")

    # Sanity: every row has a direction in {-1, 0, +1}; non-empty api_code
    for r in merged:
        assert r["direction"] in (-1, 0, 1), f"bad direction in {r}"
        assert r["api_code"], f"empty api_code in {r}"

    payload = emit_json(merged, conflicts, len(cascade_rows), len(ml_rows))

    if dry_run:
        print(f"\n[DRY-RUN] would write {len(merged)} directions to "
              f"{OUTPUT_JSON.relative_to(ROOT)}")
        print(json.dumps(
            {"directions": payload["directions"][:3], "total": len(merged)},
            indent=2,
        ))
        return 0

    print(f"\n[4] Writing {OUTPUT_JSON.relative_to(ROOT)}")
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"    wrote {len(merged)} directions "
          f"({sum(1 for r in merged if r['direction'] == 1)} +1, "
          f"{sum(1 for r in merged if r['direction'] == -1)} -1, "
          f"{sum(1 for r in merged if r['direction'] == 0)} direction:0)")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true",
                   help="parse + merge but do not write the JSON")
    args = p.parse_args()
    sys.exit(main(dry_run=args.dry_run))
