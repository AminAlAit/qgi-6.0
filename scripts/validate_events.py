#!/usr/bin/env python3
"""
CI validation for curated event JSON files.

Runs on every push to qgi-data. Fails if any event file violates the
canonical schema (same rules as jordan.json, the reference file).

Exit code 0 = all valid, 1 = validation errors found.
"""
import json
import sys
from pathlib import Path

EVENTS_DIR = Path(__file__).resolve().parent.parent / "events" / "curated"
ALLOWED_YEAR_RANGE = (1900, 2030)  # Events can predate WB indicator data (1960+)
MAX_TITLE_LENGTH = 120

# Count thresholds
MIN_EVENTS_PER_COUNTRY = 10
MAX_RECENCY_RATIO = 0.35  # max fraction of events in 2020-2030 window

errors = []
warnings = []
total_files = 0
total_events = 0


def validate_file(path: Path):
    global total_events
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"{path.name}: invalid JSON — {e}")
            return

    if not isinstance(data, list):
        errors.append(f"{path.name}: root must be a JSON array, got {type(data).__name__}")
        return

    if len(data) < MIN_EVENTS_PER_COUNTRY:
        warnings.append(f"{path.name}: only {len(data)} events (min recommended: {MIN_EVENTS_PER_COUNTRY})")

    recent_count = 0
    for i, event in enumerate(data):
        prefix = f"{path.name}[{i}]"

        if not isinstance(event, dict):
            errors.append(f"{prefix}: event must be a dict")
            continue

        # Required fields
        for key in ("year", "title", "description", "category"):
            if key not in event:
                errors.append(f"{prefix}: missing required field '{key}'")

        # Year
        year = event.get("year")
        if year is not None:
            if not isinstance(year, int):
                errors.append(f"{prefix}: 'year' must be int, got {type(year).__name__}")
            elif not (ALLOWED_YEAR_RANGE[0] <= year <= ALLOWED_YEAR_RANGE[1]):
                errors.append(f"{prefix}: year {year} outside {ALLOWED_YEAR_RANGE}")
            if isinstance(year, int) and 2020 <= year <= 2030:
                recent_count += 1

        # Title
        title = event.get("title")
        if title is not None:
            if not isinstance(title, str) or len(title) == 0:
                errors.append(f"{prefix}: 'title' must be non-empty string")
            elif len(title) > MAX_TITLE_LENGTH:
                warnings.append(f"{prefix}: title exceeds {MAX_TITLE_LENGTH} chars ({len(title)})")

        # Category
        category = event.get("category")
        if category is not None and not isinstance(category, str):
            errors.append(f"{prefix}: 'category' must be string")

        # Sources (optional but recommended)
        sources = event.get("sources")
        if sources is not None:
            if not isinstance(sources, list):
                errors.append(f"{prefix}: 'sources' must be a list")
            elif len(sources) == 0:
                warnings.append(f"{prefix}: 'sources' is empty")

        total_events += 1

    # Recency bias check
    if len(data) > 0 and recent_count / len(data) > MAX_RECENCY_RATIO:
        warnings.append(
            f"{path.name}: {recent_count}/{len(data)} events ({recent_count/len(data)*100:.0f}%) "
            f"are 2020-2030 — possible recency bias (threshold: {MAX_RECENCY_RATIO*100:.0f}%)"
        )


def main():
    global total_files
    if not EVENTS_DIR.exists():
        print(f"ERROR: events directory not found: {EVENTS_DIR}")
        sys.exit(1)

    json_files = sorted(EVENTS_DIR.glob("*.json"))
    if not json_files:
        print(f"ERROR: no JSON files found in {EVENTS_DIR}")
        sys.exit(1)

    for path in json_files:
        total_files += 1
        validate_file(path)

    # Report
    print(f"Validated {total_files} files, {total_events} events total.")

    if warnings:
        print(f"\n{len(warnings)} warnings:")
        for w in warnings:
            print(f"  WARNING: {w}")

    if errors:
        print(f"\n{len(errors)} ERRORS:")
        for e in errors:
            print(f"  ERROR: {e}")
        sys.exit(1)
    else:
        print("\nAll files valid.")
        sys.exit(0)


if __name__ == "__main__":
    main()
