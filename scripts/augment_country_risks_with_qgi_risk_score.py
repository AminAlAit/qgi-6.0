#!/usr/bin/env python3
"""
Augment country-risks.json with QGI Risk Score (0-100 percentile rank).

#721 / Majles 2026-05-16 STEP 1 (custom local bake; no pipeline run).

The Majles ratified a bounded buyer-facing score that lives ALONGSIDE
the existing unbounded salience. Spec:
    qgi-docs/internal/ops/qgi-risk-score-majles-2026-05-16.md

Step 1 (this script): augment an existing country-risks.json without
re-running the scoring pipeline. Reads existing salience values,
computes the percentile rank across the bake's cohort, writes back the
augmented JSON.

Step 2 (deferred to one-shot pipeline run, see
qgi-docs/internal/ops/one-shot-pipeline-checklist.md): fold the
percentile rank emission into `generate_country_risks.py` natively so
each bake produces the field directly.

USAGE
    python augment_country_risks_with_qgi_risk_score.py \\
        --input  qgi-frontend/data/country-risks.json \\
        --output qgi-frontend/data/country-risks.json   # in-place

OUTPUT FIELDS (added per country)
    qgi_risk_score_0_100      int|null   0..100 percentile rank
                                          (null if coverage insufficient)
    qgi_risk_score_ci_low     int|null   95% bootstrap CI lower bound
    qgi_risk_score_ci_high    int|null   95% bootstrap CI upper bound
    coverage_flag             str        "ok" | "insufficient"

OUTPUT FIELDS (added at top level)
    qgi_risk_score_version    str        "v1"
    qgi_risk_score_cohort_n   int        countries in the rank cohort
    qgi_risk_score_method     str        "percentile-rank-of-max-salience"
    qgi_risk_score_baked_at   str        ISO8601 UTC

MAJLES DECISIONS HONORED (verbatim from the synthesis spec)
1. Range: 0-100 integer (8/8 unanimous)
2. Computation: empirical percentile rank — NOT a closed-form Φ transform
   (Roshani + Dmitri argued for statistical honesty; founder ratified)
3. Strict ordinal interpretation — NOT a probability. Code docstrings
   forbid the "% chance" reading.
4. Floors at 0 (never negative). Bake-script writes negative-salience
   countries as 0, but coverage_flag stays "ok" if recipe_count
   threshold is met.
5. Insufficient-data: null (NEVER coerced to 0 or 50). Marcus's veto.
6. Reference distribution: countries in current bake's cohort (all
   156 in this run; founder may later restrict to curated_only via
   --cohort=curated).
7. Bootstrap CI: 1000 bootstrap iterations resampling the cohort
   salience distribution with replacement; 95% percentile interval.
   Step 1 uses country-level resampling (not recipe-level — recipe
   data would require Athena access; deferred to Step 2 native bake).

LIMITATIONS (documented; filed as #721 acceptance follow-ups)
- Step 1 CI is country-cohort-resampling. Step 2 (native bake) will
  switch to recipe-level resampling per the Majles spec.
- min_recipe_count threshold (Majles config-key 5) is INTERPRETED as
  max(recipe_count across top_categories) — country's strongest
  recipe-cohort sample. A country with all-tier-blocks empty or with
  every category's recipe_count < 5 gets coverage_flag="insufficient".
"""

from __future__ import annotations

import argparse
import json
import math
import os
import pathlib
import random
import sys
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIN_RECIPE_COUNT = 5  # Majles V1.9.1 config key; insufficient-data threshold
BOOTSTRAP_ITERATIONS = 1000
CI_LOWER_PCT = 2.5
CI_UPPER_PCT = 97.5
BOOTSTRAP_SEED = 17  # deterministic — same seed as T12 canary chain


# ---------------------------------------------------------------------------
# Per-country max-salience extraction
# ---------------------------------------------------------------------------

def extract_max_salience(country: dict) -> tuple[float | None, int]:
    """Return (max_salience_score, max_recipe_count_across_categories).

    max_salience is the country's strongest signal across all tier windows
    (S/M/L/XL). max_recipe_count is the country's deepest recipe cohort
    (used for the coverage_flag threshold).

    Returns (None, 0) if no top_categories at all.
    """
    max_sal: float | None = None
    max_rc = 0
    tiers = country.get("tiers", {})
    for tier_block in tiers.values():
        for cat in tier_block.get("top_categories", []):
            sal = cat.get("salience_score")
            if sal is None:
                sal = cat.get("z_score")
            if sal is not None and (max_sal is None or sal > max_sal):
                max_sal = sal
            rc = cat.get("recipe_count", 0)
            if rc > max_rc:
                max_rc = rc
    return max_sal, max_rc


# ---------------------------------------------------------------------------
# Percentile rank + bootstrap CI
# ---------------------------------------------------------------------------

def percentile_rank(value: float, cohort: list[float]) -> int:
    """Empirical percentile rank of `value` in `cohort`.

    Uses the "fraction strictly below + half-tied" convention to handle
    duplicate salience values fairly. Result rounded to int in [0, 100].
    """
    if not cohort:
        return 0
    n_below = sum(1 for v in cohort if v < value)
    n_tied = sum(1 for v in cohort if v == value)
    rank = (n_below + 0.5 * n_tied) / len(cohort)
    pct = max(0, min(100, round(rank * 100)))
    return pct


def bootstrap_ci(
    value: float,
    cohort: list[float],
    iterations: int = BOOTSTRAP_ITERATIONS,
    seed: int = BOOTSTRAP_SEED,
) -> tuple[int, int]:
    """Bootstrap 95% CI on percentile rank.

    Resamples the cohort with replacement `iterations` times; for each
    bootstrap sample, recomputes the percentile rank of `value` against
    the resampled cohort; returns the 2.5th and 97.5th percentiles of
    the bootstrap rank distribution.

    Deterministic via fixed seed (BOOTSTRAP_SEED).
    """
    if len(cohort) < 2:
        return 0, 100
    rng = random.Random(seed)
    n = len(cohort)
    ranks: list[int] = []
    for _ in range(iterations):
        resample = [cohort[rng.randint(0, n - 1)] for _ in range(n)]
        ranks.append(percentile_rank(value, resample))
    ranks.sort()
    lower_idx = max(0, int(math.floor(iterations * CI_LOWER_PCT / 100)))
    upper_idx = min(iterations - 1, int(math.ceil(iterations * CI_UPPER_PCT / 100)))
    return ranks[lower_idx], ranks[upper_idx]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True, help="Path to existing country-risks.json")
    ap.add_argument("--output", required=True, help="Path to write augmented JSON")
    ap.add_argument(
        "--cohort",
        choices=["all", "curated"],
        default="all",
        help="Rank cohort: 'all' (default) or 'curated' (curated=True only)",
    )
    args = ap.parse_args()

    in_path = pathlib.Path(args.input)
    out_path = pathlib.Path(args.output)
    if not in_path.exists():
        print(f"ERROR: input file not found: {in_path}", file=sys.stderr)
        return 1

    with open(in_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    countries: dict[str, dict] = data["countries"]
    print(f"Loaded {len(countries)} countries from {in_path}")
    print(f"Bake version: {data.get('version', 'n/a')} · generated_at: {data.get('generated_at', 'n/a')}")

    # ---------- Pass 1: extract max salience + coverage flag per country -----
    salience_by_id: dict[str, float] = {}
    coverage_flag_by_id: dict[str, str] = {}
    for cid, c in countries.items():
        max_sal, max_rc = extract_max_salience(c)
        if max_sal is None or max_rc < MIN_RECIPE_COUNT:
            coverage_flag_by_id[cid] = "insufficient"
            continue
        # Apply the Majles "negative salience clamps to 0" rule.
        salience_by_id[cid] = max(0.0, max_sal)
        coverage_flag_by_id[cid] = "ok"

    # ---------- Pass 2: build the rank cohort -------------------------------
    if args.cohort == "curated":
        cohort_ids = [cid for cid in salience_by_id if countries[cid].get("curated")]
    else:
        cohort_ids = list(salience_by_id.keys())
    cohort_salience = [salience_by_id[cid] for cid in cohort_ids]
    cohort_n = len(cohort_salience)
    print(f"Cohort: {args.cohort} (N={cohort_n}); insufficient: {sum(1 for v in coverage_flag_by_id.values() if v == 'insufficient')}")

    # ---------- Pass 3: compute risk score + CI per country -----------------
    for cid, c in countries.items():
        flag = coverage_flag_by_id[cid]
        if flag == "insufficient":
            c["qgi_risk_score_0_100"] = None
            c["qgi_risk_score_ci_low"] = None
            c["qgi_risk_score_ci_high"] = None
            c["coverage_flag"] = "insufficient"
            continue
        sal = salience_by_id[cid]
        score = percentile_rank(sal, cohort_salience)
        ci_low, ci_high = bootstrap_ci(sal, cohort_salience)
        c["qgi_risk_score_0_100"] = score
        c["qgi_risk_score_ci_low"] = ci_low
        c["qgi_risk_score_ci_high"] = ci_high
        c["coverage_flag"] = "ok"

    # ---------- Pass 4: top-level metadata ----------------------------------
    data["qgi_risk_score_version"] = "v1"
    data["qgi_risk_score_cohort_n"] = cohort_n
    data["qgi_risk_score_method"] = "percentile-rank-of-max-salience"
    data["qgi_risk_score_baked_at"] = datetime.now(timezone.utc).isoformat()

    # ---------- Pass 5: write back ------------------------------------------
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2 if os.environ.get("QGI_PRETTY") else None)
    print(f"Augmented JSON written to {out_path}")

    # ---------- Sanity report ------------------------------------------------
    scores = [c.get("qgi_risk_score_0_100") for c in countries.values()]
    scored = [s for s in scores if s is not None]
    if scored:
        print(f"Score distribution (n={len(scored)}):")
        print(f"  min: {min(scored)} · max: {max(scored)} · median: {sorted(scored)[len(scored)//2]}")
        print(f"  >= 80: {sum(1 for s in scored if s >= 80)} countries")
        print(f"  50-79: {sum(1 for s in scored if 50 <= s < 80)} countries")
        print(f"  20-49: {sum(1 for s in scored if 20 <= s < 50)} countries")
        print(f"  <  20: {sum(1 for s in scored if s < 20)} countries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
