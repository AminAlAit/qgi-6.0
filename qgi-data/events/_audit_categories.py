"""
Audit script: scans qgi-data/events/curated/*.json and reports
- All distinct categories used
- Which are CANONICAL (in taxonomy_hierarchy.json layer3) and which are NOT
- Per-file invalid count
Usage: python _audit_categories.py
"""
import json
import sys
from pathlib import Path
from collections import defaultdict, Counter

ROOT = Path(__file__).parent
TAX = ROOT / "taxonomy_hierarchy.json"
CURATED = ROOT / "curated"

with open(TAX, "r", encoding="utf-8") as f:
    tax = json.load(f)

CANONICAL = set()
for l1 in tax["layer1"]:
    for l2 in l1["layer2"]:
        for l3 in l2["layer3"]:
            CANONICAL.add(l3)

print(f"Canonical L3 categories: {len(CANONICAL)}")
print(f"Sample canonical: {sorted(CANONICAL)[:5]}")
print()

cat_counter: Counter[str] = Counter()
invalid_counter: Counter[str] = Counter()
files_with_invalid: dict[str, int] = {}
total_events = 0
total_invalid = 0

curated_files = sorted(CURATED.glob("*.json"))
print(f"Scanning {len(curated_files)} curated files...")

for path in curated_files:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  SKIP {path.name}: {e}")
        continue

    if isinstance(data, list):
        events = data
    elif isinstance(data, dict):
        events = data.get("events") or data.get("data") or []
    else:
        continue
    if not isinstance(events, list):
        continue

    file_invalid = 0
    for ev in events:
        if not isinstance(ev, dict):
            continue
        cat = ev.get("category") or ev.get("type") or ""
        if not cat:
            continue
        total_events += 1
        cat_counter[cat] += 1
        if cat not in CANONICAL:
            invalid_counter[cat] += 1
            file_invalid += 1
            total_invalid += 1
    if file_invalid > 0:
        files_with_invalid[path.name] = file_invalid

print()
print(f"Total events scanned: {total_events}")
print(f"Total invalid-category events: {total_invalid} ({100*total_invalid/max(total_events,1):.1f}%)")
print(f"Distinct invalid categories: {len(invalid_counter)}")
print(f"Files with at least one invalid event: {len(files_with_invalid)}")
print()
print("=== ALL INVALID categories (by event count) ===")
for cat, n in invalid_counter.most_common():
    print(f"  {n:5d}  {cat}")
print()
print("=== Files with >50 invalid events ===")
for fname, n in sorted(files_with_invalid.items(), key=lambda x: -x[1])[:30]:
    print(f"  {n:4d}  {fname}")
