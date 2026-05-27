"""post_pass_core.py — pure methodology-integrity logic for the recipe-fleet post-pass.

Consumed by lambda_function.py (which adds the S3 read of the 44 walk summaries + the
draft tracker/vintage writes). Kept pure + dependency-free so it is exhaustively testable.

Implements the trio's blocking conditions on the fan-out output:
  - confidence-tier classification (confidence-tier-policy.md / Marcus-Kwame-Ji-Hoon 2026-05-25)
  - FLEET-6 / Condition B: NO grandfathered tiers — every recipe's tier is re-derived from
    THIS run's result; tier TRANSITIONS (graduation OR slip, incl. LOCK→MARGINAL) are surfaced
    and require Majles sign-off; a prior tier is never carried forward.
  - FLEET-8 / Condition I: a one-page integrity attestation gating the tracker PR.
INCOMPLETE_CEILING_BELOW_FLOOR (FLEET-3 early-abort) is NOT auto-tiered — it routes to human.
"""
from __future__ import annotations

from typing import Any

# Display tiers (confidence-tier-policy.md).
VALIDATED = "validated"        # 🟢 LOCK — clears the F-ML-1 floor on all gates
DIRECTIONAL = "directional"    # 🟡 ran, ≥0.65, beats chance; missed graduation
EXPERIMENTAL = "experimental"  # 🟠 ran but < 0.65 / near chance / thin
QUEUED = "queued"              # ⚪ not yet run
HOLD = "hold_for_human"        # early-abort / ambiguous → human adjudication, never auto-tiered

DIRECTIONAL_FLOOR = 0.65       # 🟡 global-LOCO lower cut-line (criterion 1)
CHANCE_FLOOR = 0.50            # CI lower bound must clear chance (criterion 2)
PER_COHORT_MEDIAN_FLOOR = 0.55  # 🟡 per-cohort LOCO median floor (criterion 5)
HIGH_UNCERTAINTY_CI_WIDTH = 0.20  # 🟡 with this qualifier if CI is wider


def _per_cohort_median(result: dict[str, Any]) -> float | None:
    """Median per-cohort LOCO-AUC from the walk summary, or None if unavailable."""
    pc = result.get("per_cohort") or {}
    aucs = sorted(v.get("loco_auc") for v in pc.values() if v.get("loco_auc") is not None)
    if not aucs:
        return None
    n = len(aucs)
    return aucs[n // 2] if n % 2 else (aucs[n // 2 - 1] + aucs[n // 2]) / 2

# tier ordering for transition direction (higher index = stronger claim)
_RANK = {QUEUED: 0, HOLD: 0, EXPERIMENTAL: 1, DIRECTIONAL: 2, VALIDATED: 3}


def classify_tier(result: dict[str, Any] | None, *,
                  beats_baseline: bool | None = None) -> dict[str, Any]:
    """Map ONE recipe's walk result to a display tier. Pure. `result` is the
    f-ml-1-poc-summary.json dict (or None if the recipe never ran).

    The confidence-tier-policy 🟡 Directional bar has 5 criteria. This function checks:
      (1) global LOCO ≥ 0.65, (2) CI lower > 0.50 (beats chance), (5) per-cohort LOCO
      median ≥ 0.55 [from result.per_cohort]. Criterion (4) "beats the pre-registered
      naive/prior baseline" needs the recipe's floor (not in this summary), so the CALLER
      passes `beats_baseline`: explicit False DEMOTES to Experimental; None means
      "not asserted here" (the handler MUST assert it upstream before trusting Directional).
      Criterion (3) n_pos≥60 is the runnable gate already applied before the fan-out.

    Returns {tier, reason, flags:[...]} — flags may include 'high_uncertainty'.
    The early-abort verdict routes to HOLD (never auto-tiered); a true LOCK is the only
    path to VALIDATED."""
    if result is None:
        return {"tier": QUEUED, "reason": "not yet run", "flags": []}

    verdict = result.get("verdict")
    if verdict == "INCOMPLETE_CEILING_BELOW_FLOOR":
        return {"tier": HOLD, "reason": "early-abort (floor unreachable); human adjudication",
                "flags": ["incomplete"]}
    if verdict == "LOCK":
        return {"tier": VALIDATED, "reason": "clears the F-ML-1 LOCK floor (all gates)", "flags": []}

    g = result.get("global_loco", {}) or {}
    auc = g.get("auc")
    ci_lo = g.get("ci95_lo")
    ci_hi = g.get("ci95_hi")
    if auc is None:
        # ran but produced no scorable global LOCO (e.g. COVERAGE_FAIL pre-score)
        return {"tier": EXPERIMENTAL, "reason": f"{verdict}: no scorable LOCO", "flags": ["unscored"]}

    beats_chance = ci_lo is not None and ci_lo > CHANCE_FLOOR
    cohort_med = _per_cohort_median(result)
    cohort_ok = cohort_med is not None and cohort_med >= PER_COHORT_MEDIAN_FLOOR
    directional = (auc >= DIRECTIONAL_FLOOR and beats_chance and cohort_ok
                   and beats_baseline is not False)
    if directional:
        flags = []
        if ci_lo is not None and ci_hi is not None and (ci_hi - ci_lo) > HIGH_UNCERTAINTY_CI_WIDTH:
            flags.append("high_uncertainty")
        return {"tier": DIRECTIONAL,
                "reason": f"{verdict}: LOCO {auc:.4f} ≥ {DIRECTIONAL_FLOOR}, beats chance + cohort median; not validated",
                "flags": flags}
    return {"tier": EXPERIMENTAL,
            "reason": (f"{verdict}: fails a Directional criterion "
                       f"(auc {auc} / ci_lo {ci_lo} / cohort_median {cohort_med} / "
                       f"beats_baseline {beats_baseline})"),
            "flags": []}


def detect_transitions(prev_tiers: dict[str, str], this_tiers: dict[str, str]) -> list[dict]:
    """FLEET-6 / Condition B: compare each recipe's PREVIOUS-vintage tier to THIS run's
    freshly-derived tier. Returns the list of transitions (changed tier) — each a
    graduation (rank up) or slip (rank down). NEVER carries a prior tier forward; the
    prior is used ONLY to detect the change. Transitions require Majles sign-off."""
    transitions = []
    for recipe, new_tier in sorted(this_tiers.items()):
        old_tier = prev_tiers.get(recipe, QUEUED)
        if new_tier == old_tier:
            continue
        direction = "graduation" if _RANK[new_tier] > _RANK[old_tier] else "slip"
        transitions.append({
            "recipe_id": recipe,
            "from_tier": old_tier,
            "to_tier": new_tier,
            "direction": direction,
            # any tier TRANSITION (esp. a graduation or a slip out of Validated) is a public
            # truth-claim change → needs Majles sign-off before the tracker PR merges.
            "needs_majles_signoff": True,
        })
    return transitions


def build_integrity_attestation(*, conditions: dict[str, bool], transitions: list[dict],
                                 run_id: str, panel_fingerprint: str | None) -> dict[str, Any]:
    """FLEET-8 / Condition I: the one-page attestation that gates the tracker PR. The cycle
    must answer each blocking condition YES/NO; the PR may not merge unless all are YES and
    every tier transition has Majles sign-off. Pure — the caller supplies the condition
    booleans it asserted upstream."""
    required = ["floor_ordering_ok", "no_grandfathered_tiers", "bit_identical_walk",
                "no_poisoned_indicator_holds_bypassed"]
    all_yes = all(bool(conditions.get(k)) for k in required)
    pending = [t for t in transitions if t.get("needs_majles_signoff")]
    return {
        "run_id": run_id,
        "panel_fingerprint": panel_fingerprint,
        "conditions": {k: bool(conditions.get(k)) for k in required},
        "all_conditions_pass": all_yes,
        "tier_transitions": transitions,
        "transitions_pending_majles": pending,
        # the tracker PR is MERGE-BLOCKED unless every condition is YES AND no transition is
        # still awaiting Majles sign-off (Tariq Condition I — graduations/slips are public
        # truth-claims, never a cron side-effect).
        "tracker_pr_may_merge": all_yes and len(pending) == 0,
    }
