#!/usr/bin/env python3
"""
enrich_analogues_common_length.py — rebuild analogues-enriched.json so
that every analogue row for a given (subject, category) shares the SAME
pattern length L (#354, Sonnet Position C).

## The problem (see #354 body)

The prior enrichment picked each analogue's best-PPS window independently,
producing different lengths across the 5 rows of a single panel (Lebanon
civil_war: Rwanda 28yr, Syria 24yr, Pakistan 31yr, Myanmar 34yr, South
Sudan 61yr). The QGI pattern definition requires both windows of a pair
to share a length, so labeling all rows "Lebanon's current trajectory"
was mathematically false.

## The fix (Position C)

For each (subject, category):
  1. Read the top-5 analogues' best_pattern_length values.
  2. Pick L that MAXIMIZES coverage across those analogues within a
     tolerance of ±2 years (not the blind median — some analogues'
     best-lengths cluster in ranges where the median lies outside).
     Tie-break by sum of PPS across analogues.
  3. For each analogue, choose the highest-PPS pattern of length in
     [L-2, L+2] from pair-windows/{subject_id}.json[analogue_id].top.
     Prefer windows where `start_b <= event_year_b <= start_b + length`
     (event inside window).
  4. If an analogue has no pattern in [L-2, L+2], drop it from the panel.
     Downstream UI will show the surviving row count.
  5. Record `pair_length`, `pair_start_a`, `pair_start_b`,
     `event_in_window` per analogue. Add `canonical_length` to the
     (subject, category) block.

## Trade-offs (accepted per Sonnet review)

- Median L can miss — using coverage-max instead (variance from Sonnet's
  recipe, but closer to ground truth).
- Some analogues get dropped. Better than lying about Lebanon's window.
- Subject's start_year_a shifts slightly per row (each pair peaks at a
  slightly different subject-window position). Length is the invariant.

## Input / output

Input:
  qgi-frontend/data/pair-windows/{subject_id}.json   — per-pair window sets
  qgi-frontend/data/analogues-enriched.json          — existing enrichment (read subject metadata + event years)

Output (in-place rewrite):
  qgi-frontend/data/analogues-enriched.json
"""

import argparse
import json
from pathlib import Path


# Per-pair compact schema from generate_pair_windows.py:
#   l  = length
#   sa = start_year_a
#   sb = start_year_b
#   ic = indicator_count
#   ac = avg_correlation
#   pps = pattern_power_score


def best_common_length(
    pair_windows_by_analogue: dict[str, list[dict]],
    analogue_ids: list[int],
    length_tolerance: int = 2,
) -> int | None:
    """Pick L that maximizes coverage across the given analogues.

    For each candidate L (any length that appears in any analogue's top
    list), count how many analogues have at least one window at L ± tolerance.
    Pick L with max coverage. Break ties by sum of best-PPS within tolerance.
    Returns None if no analogue has any windows.
    """
    candidate_lengths: set[int] = set()
    for aid in analogue_ids:
        for w in pair_windows_by_analogue.get(str(aid), {}).get("top", []):
            if isinstance(w.get("l"), int):
                candidate_lengths.add(w["l"])

    if not candidate_lengths:
        return None

    def score_length(L: int) -> tuple[int, float]:
        """Return (coverage_count, sum_best_pps_within_tolerance)."""
        cov = 0
        total_pps = 0.0
        for aid in analogue_ids:
            windows = pair_windows_by_analogue.get(str(aid), {}).get("top", [])
            best = None
            for w in windows:
                if not isinstance(w.get("l"), int):
                    continue
                if abs(w["l"] - L) > length_tolerance:
                    continue
                if best is None or (w.get("pps") or 0) > (best.get("pps") or 0):
                    best = w
            if best is not None:
                cov += 1
                total_pps += best.get("pps") or 0
        return (cov, total_pps)

    best_L = max(candidate_lengths, key=score_length)
    return best_L


def pick_analogue_window(
    windows: list[dict],
    target_L: int,
    event_year_b: int | None,
    length_tolerance: int = 2,
) -> dict | None:
    """Select the best-PPS window within [L-tolerance, L+tolerance].

    Prefer windows where `start_b <= event_year_b <= start_b + length`
    (event inside window). Among those, pick highest PPS. If no window
    contains the event, fall back to highest PPS within tolerance
    regardless of event alignment.
    """
    eligible = [
        w for w in windows
        if isinstance(w.get("l"), int) and abs(w["l"] - target_L) <= length_tolerance
    ]
    if not eligible:
        return None

    def contains_event(w: dict) -> bool:
        if event_year_b is None:
            return False
        sb = w.get("sb")
        L = w.get("l")
        if sb is None or L is None:
            return False
        return sb <= event_year_b <= sb + L

    inside = [w for w in eligible if contains_event(w)]
    pool = inside if inside else eligible
    return max(pool, key=lambda w: w.get("pps") or 0)


def enrich(
    pair_windows_dir: Path,
    enriched_path: Path,
    length_tolerance: int = 2,
) -> int:
    with open(enriched_path, encoding="utf-8") as f:
        payload = json.load(f)

    countries = payload.get("countries", {})
    canonical_lengths: dict[tuple[str, str], int] = {}
    stats = {
        "subjects_processed": 0,
        "categories_processed": 0,
        "analogues_kept": 0,
        "analogues_dropped": 0,
        "events_in_window": 0,
        "events_outside_window": 0,
    }

    for subject_id, categories in countries.items():
        pw_path = pair_windows_dir / f"{subject_id}.json"
        if not pw_path.exists():
            # No pair-window data for this subject — leave categories as-is.
            continue
        with open(pw_path, encoding="utf-8") as f:
            pair_windows = json.load(f)

        stats["subjects_processed"] += 1

        for category, block in categories.items():
            analogues = block.get("analogues", [])
            if not analogues:
                continue
            stats["categories_processed"] += 1

            analogue_ids = [a.get("country_b_id") for a in analogues if a.get("country_b_id") is not None]

            L = best_common_length(pair_windows, analogue_ids, length_tolerance)
            if L is None:
                # Nothing to enrich.
                continue
            canonical_lengths[(subject_id, category)] = L
            block["canonical_length"] = L

            rebuilt: list[dict] = []
            for a in analogues:
                aid = a.get("country_b_id")
                if aid is None:
                    continue
                windows = pair_windows.get(str(aid), {}).get("top", [])
                chosen = pick_analogue_window(
                    windows, L, a.get("event_year_b"), length_tolerance
                )
                if chosen is None:
                    stats["analogues_dropped"] += 1
                    continue
                # Keep every upstream field + overwrite the window fields
                # with the length-L pick.
                eyb = a.get("event_year_b")
                sb = chosen.get("sb")
                L_chosen = chosen.get("l")
                event_in_window = (
                    eyb is not None
                    and sb is not None
                    and L_chosen is not None
                    and sb <= eyb <= sb + L_chosen
                )
                if event_in_window:
                    stats["events_in_window"] += 1
                else:
                    stats["events_outside_window"] += 1
                a_new = dict(a)
                a_new["pair_length"] = L_chosen
                a_new["pair_start_a"] = chosen.get("sa")
                a_new["pair_start_b"] = sb
                a_new["pair_pps"] = chosen.get("pps")
                a_new["pair_avg_corr"] = chosen.get("ac")
                a_new["event_in_window"] = event_in_window
                # Legacy fields kept for backwards-compatibility during the
                # frontend rollout (widget will be updated to read the new
                # fields); remove in a follow-up once the widget lands.
                rebuilt.append(a_new)
                stats["analogues_kept"] += 1
            block["analogues"] = rebuilt

    # Note the algorithm version so downstream consumers can detect + fail
    # loudly if they read an old-shape file.
    payload["enrichment_algorithm"] = "common-length-v1 (#354, 2026-04-19)"
    payload["enrichment_length_tolerance"] = length_tolerance

    with open(enriched_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"\n== Enrichment stats ==")
    for k, v in stats.items():
        print(f"  {k:<30} {v}")
    print(f"\nCanonical length distribution (top 10):")
    length_counts: dict[int, int] = {}
    for L in canonical_lengths.values():
        length_counts[L] = length_counts.get(L, 0) + 1
    for L, count in sorted(length_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  L={L:>3}: {count} (subject, category) pairs")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pair-windows-dir",
        type=Path,
        default=Path("qgi-frontend/data/pair-windows"),
    )
    parser.add_argument(
        "--enriched",
        type=Path,
        default=Path("qgi-frontend/data/analogues-enriched.json"),
    )
    parser.add_argument("--tolerance", type=int, default=2)
    args = parser.parse_args()
    return enrich(args.pair_windows_dir, args.enriched, args.tolerance)


if __name__ == "__main__":
    raise SystemExit(main())
