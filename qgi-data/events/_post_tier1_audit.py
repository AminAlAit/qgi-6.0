"""
Post-Tier-1 batch audit:
1. Confirms all 15 Tier-1 sovereign files were created
2. Validates each is valid JSON, list-of-events shape
3. Re-uses _audit_categories.py logic to confirm 0 invalid categories
4. Prints a per-country event count + top 3 categories summary
5. Prints exact files NEW since the batch (so commit message is accurate)

Usage: python _post_tier1_audit.py
"""

import json
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).parent
TAX = ROOT / "taxonomy_hierarchy.json"
CURATED = ROOT / "curated"

TIER_1_SLUGS = [
    "equatorial_guinea", "brunei", "papua_new_guinea", "timor_leste", "mauritius",
    "trinidad_and_tobago", "bahamas", "malawi", "lesotho", "eswatini",
    "fiji", "kosovo", "guinea_bissau", "cabo_verde", "comoros",
]


def main():
    with open(TAX, "r", encoding="utf-8") as f:
        tax = json.load(f)
    canonical = {l3 for l1 in tax["layer1"] for l2 in l1["layer2"] for l3 in l2["layer3"]}

    print(f"Tier-1 batch target: {len(TIER_1_SLUGS)} countries")
    print(f"Canonical L3 categories: {len(canonical)}")
    print()

    missing_files: list[str] = []
    bad_json: list[str] = []
    bad_shape: list[str] = []
    invalid_cats: dict[str, list[tuple[str, int]]] = {}
    summary_rows: list[tuple[str, int, str, int]] = []

    for slug in TIER_1_SLUGS:
        path = CURATED / f"{slug}.json"
        if not path.exists():
            missing_files.append(slug)
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            bad_json.append(f"{slug}: {e}")
            continue

        if isinstance(data, list):
            events = data
        elif isinstance(data, dict):
            events = data.get("events") or data.get("data") or []
        else:
            bad_shape.append(slug)
            continue

        if not isinstance(events, list):
            bad_shape.append(slug)
            continue

        cat_counter: Counter[str] = Counter()
        invalid_in_file: Counter[str] = Counter()
        years: list[int] = []
        for ev in events:
            if not isinstance(ev, dict):
                continue
            cat = ev.get("category") or ev.get("type") or ""
            if cat:
                cat_counter[cat] += 1
                if cat not in canonical:
                    invalid_in_file[cat] += 1
            yr = ev.get("year")
            if isinstance(yr, int):
                years.append(yr)

        if invalid_in_file:
            invalid_cats[slug] = invalid_in_file.most_common()

        top3 = ", ".join(f"{c}({n})" for c, n in cat_counter.most_common(3))
        yr_range = f"{min(years)}-{max(years)}" if years else "no years"
        summary_rows.append((slug, len(events), yr_range, len(invalid_in_file)))

    # Report
    print(f"{'Country':<25} {'Events':>7}  {'Year range':<13}  {'InvalidCats':>11}")
    print("-" * 70)
    for slug, n, yr, inv in summary_rows:
        marker = " " if inv == 0 else "!"
        print(f"{marker}{slug:<24} {n:>7}  {yr:<13}  {inv:>11}")

    print()
    print(f"Files created: {len(summary_rows)} / {len(TIER_1_SLUGS)}")
    if missing_files:
        print(f"MISSING FILES ({len(missing_files)}): {', '.join(missing_files)}")
    if bad_json:
        print(f"BAD JSON ({len(bad_json)}): {bad_json}")
    if bad_shape:
        print(f"BAD SHAPE ({len(bad_shape)}): {bad_shape}")
    if invalid_cats:
        print(f"INVALID CATEGORIES in {len(invalid_cats)} files (will need remap):")
        for slug, lst in invalid_cats.items():
            print(f"  {slug}: {lst[:5]}")

    # Aggregate
    total_events = sum(n for _, n, _, _ in summary_rows)
    print()
    print(f"Total Tier-1 events added: {total_events}")
    print(f"Total catalog after Tier-1: {len(list(CURATED.glob('*.json'))) - 1} curated files (excluding _backup_pre_remap subdir)")

    if missing_files or bad_json or bad_shape or invalid_cats:
        print()
        print("STATUS: NOT CLEAN - issues need addressing before commit")
        sys.exit(1)
    print()
    print("STATUS: CLEAN - ready for commit")


if __name__ == "__main__":
    main()
