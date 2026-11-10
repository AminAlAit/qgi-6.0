"""
GH#261 PnN bimodal split.

The 2026-04-16 auto-remap defaulted ALL `privatization_and_nationalization`
events to canonical `economic_liberalization` (D4). About half of those are
actually `economic_nationalization` (D5).

Fix: regex the title + description for nationalization-direction tokens.
- Match "nationaliz", "expropriat", "renationaliz", "state takeover",
  "seiz(ed|ure)" -> reassign to `economic_nationalization` (D5).
- Otherwise: leave as `economic_liberalization` (D4).

Backups go to curated/_backup_pre_pnn_split/ before any write.

Usage:
  python _remap_pnn_bimodal.py            # dry run (default)
  python _remap_pnn_bimodal.py --apply    # actually write
"""
import argparse
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
CURATED = ROOT / "curated"
BACKUP_DIR = CURATED / "_backup_pre_pnn_split"

# Regex for nationalization-direction tokens (case-insensitive, word-boundary-aware)
NATIONALIZE_PATTERN = re.compile(
    r"\b("
    r"nationaliz|"
    r"renationaliz|"
    r"expropriat|"
    r"state\s+takeover|"
    r"state\s+control|"
    r"government\s+takeover|"
    r"seized\s+(by|the)|"
    r"seizure\s+of"
    r")",
    re.IGNORECASE,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually write changes")
    args = parser.parse_args()

    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print()

    if args.apply and not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        print(f"Created backup dir: {BACKUP_DIR}")

    files = sorted(CURATED.glob("*.json"))
    files_changed = 0
    total_d4_d5 = 0
    total_d4_kept = 0
    total_econ_lib_seen = 0
    examples_d4_to_d5 = []

    for path in files:
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

        file_changed = False
        for ev in events:
            if not isinstance(ev, dict):
                continue
            if ev.get("category") != "economic_liberalization":
                continue
            total_econ_lib_seen += 1
            text = (ev.get("title") or "") + " " + (ev.get("description") or "")
            if NATIONALIZE_PATTERN.search(text):
                ev["category"] = "economic_nationalization"
                if "type" in ev and ev["type"] == "economic_liberalization":
                    ev["type"] = "economic_nationalization"
                file_changed = True
                total_d4_d5 += 1
                if len(examples_d4_to_d5) < 20:
                    examples_d4_to_d5.append(
                        f"  [{path.stem}] {ev.get('year', '?')}: {ev.get('title', '')[:80]}"
                    )
            else:
                total_d4_kept += 1

        if file_changed:
            files_changed += 1
            if args.apply:
                backup_path = BACKUP_DIR / path.name
                shutil.copy2(path, backup_path)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Files scanned: {len(files)}")
    print(f"Files changed: {files_changed}")
    print(f"Total `economic_liberalization` events seen: {total_econ_lib_seen}")
    print(f"  -> reassigned to `economic_nationalization`: {total_d4_d5}")
    print(f"  -> kept as `economic_liberalization`: {total_d4_kept}")
    print()
    print("=== First 20 reassignments (for spot-check) ===")
    for ex in examples_d4_to_d5:
        print(ex)


if __name__ == "__main__":
    main()
