#!/usr/bin/env python3
"""
apply_fleet_honesty_corrections.py — patch the 34 fleet-honesty confidence
numbers into the te-fleet-run-2 cards.

Source of truth: scripts/fleet-honesty-corrections.json (a copy of the ML
session's qgi-ml/experiments/fleet-honesty-audit/results/corrections.json —
34 entries, keyed by trend slug). For each trend it sets, in
data/te-fleet-run-2/cards-v3/<trend>.card.json:

    stats.loco_auc              = honest_loco_auc
    stats.ci95_lo / ci95_hi     = honest_ci95_lo / honest_ci95_hi
    stats.ci80_lo / ci80_hi     = honest_ci80_lo / honest_ci80_hi
    greedy_walk.final_global_auc = honest_loco_auc   (kept consistent with stats)

`stats.n_bootstrap` and everything else are left untouched. Only those 6 numeric
fields change per card — the script asserts that.

These cards are gitignored, checksum-verified S3 artifacts (see
data/build-manifest.json). To actually ship, the patched cards must be uploaded
to S3 (frontend-data/te-fleet-run-2/) and the manifest regenerated — this script
only prepares/patches the LOCAL copies so the change can be reviewed and the
manifest regenerated. Re-runnable and idempotent.

Usage:
    python scripts/apply_fleet_honesty_corrections.py            # apply
    python scripts/apply_fleet_honesty_corrections.py --dry-run  # report only
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORRECTIONS = ROOT / "scripts" / "fleet-honesty-corrections.json"
CARDS_DIR = ROOT / "data" / "te-fleet-run-2" / "cards-v3"

# Spot-checks straight from the handoff §3 table — a tripwire against a bad source.
EXPECTED = {
    "monetary_policy_change": 0.617,
    "currency_crisis": 0.7546,
    "banking_and_financial_crisis": 0.6381,
    "government_formation": 0.5489,
    "military_coup": 0.6516,
}

FIELDS = {
    "loco_auc": "honest_loco_auc",
    "ci95_lo": "honest_ci95_lo",
    "ci95_hi": "honest_ci95_hi",
    "ci80_lo": "honest_ci80_lo",
    "ci80_hi": "honest_ci80_hi",
}


def main() -> int:
    dry = "--dry-run" in sys.argv
    corrections = json.loads(CORRECTIONS.read_text(encoding="utf-8"))

    # Verify the spot-checks before touching anything.
    for slug, want in EXPECTED.items():
        got = corrections[slug]["honest_loco_auc"]
        if abs(got - want) > 1e-9:
            print(f"ABORT: {slug} honest={got} != expected {want}")
            return 1

    changed, skipped = [], []
    for slug, corr in corrections.items():
        card_path = CARDS_DIR / f"{slug}.card.json"
        if not card_path.exists():
            print(f"ABORT: missing card {card_path.name}")
            return 1
        text = card_path.read_text(encoding="utf-8")
        card = json.loads(text)
        before = json.loads(text)  # deep copy for the change-set assertion

        old_auc = card["stats"]["loco_auc"]
        honest = corr["honest_loco_auc"]
        for card_key, corr_key in FIELDS.items():
            card["stats"][card_key] = corr[corr_key]
        card["greedy_walk"]["final_global_auc"] = honest

        # Assert ONLY the 6 intended leaf values changed — nothing else drifted.
        diffs = _diff_leaves(before, card)
        expected_paths = {
            "stats.loco_auc",
            "stats.ci95_lo",
            "stats.ci95_hi",
            "stats.ci80_lo",
            "stats.ci80_hi",
            "greedy_walk.final_global_auc",
        }
        unexpected = set(diffs) - expected_paths
        if unexpected:
            print(f"ABORT: {slug} would change unexpected fields: {sorted(unexpected)}")
            return 1

        # No-op if already at the honest value (idempotent re-run).
        if not diffs:
            skipped.append(slug)
            continue

        out = json.dumps(card, indent=2, ensure_ascii=False)
        if not dry:
            card_path.write_text(out, encoding="utf-8")
        changed.append((slug, old_auc, honest, corr.get("fragile", False)))

    changed.sort(key=lambda r: r[2])  # worst honest number first
    print(f"{'trend':38} {'shipped':>8} → {'honest':>7}  {'Δ':>7}  fragile")
    print("-" * 74)
    for slug, old, new, frag in changed:
        print(f"{slug:38} {old:8.3f} → {new:7.4f}  {new-old:+7.3f}  {'FRAGILE' if frag else ''}")
    print("-" * 74)
    print(f"{'APPLIED' if not dry else 'DRY-RUN'}: {len(changed)} cards patched, "
          f"{len(skipped)} already-correct.")
    if len(changed) + len(skipped) != 34:
        print(f"WARN: expected 34 corrections, saw {len(changed)+len(skipped)}")
        return 1
    return 0


def _diff_leaves(a, b, prefix=""):
    """Return the set of dotted leaf-paths whose value differs between a and b."""
    out = set()
    if isinstance(a, dict) and isinstance(b, dict):
        for k in a.keys() | b.keys():
            out |= _diff_leaves(a.get(k), b.get(k), f"{prefix}{k}." if False else (f"{prefix}.{k}" if prefix else k))
    elif a != b:
        out.add(prefix)
    return out


if __name__ == "__main__":
    sys.exit(main())
