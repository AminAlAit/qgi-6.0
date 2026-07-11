"""Pure gate/verdict evaluators for the economic_recession OECD-SCOPED REBOOT battery
(2026-07-11). Host-testable (no ML stack) -- see test_battery_gates_reboot.py.

This cycle's acceptance bar is NOT the mass_protest 8-gate battery verbatim (that battery's
D1 checks a fixed known-good ANCHOR value with tolerance -- inapplicable here because the
whole point of guard #1 is that there IS no pre-existing scoped anchor to check against; we
compute it fresh and report it AS the deliverable). Three gates are NEW to this cycle and
have no existing pure-function home elsewhere in the repo:

  * `floor_gate_pass`      -- D7 minimum-effect-size floor (pre-reg's own hardened bar):
                               paired-bootstrap delta-AUC 95% CI-LOWER must clear +0.02, not
                               merely >0 (the baseline CI-lower is already close to chance,
                               so a CI-lower that merely clears 0 is not a meaningful win).
  * `era2008_verdict`      -- the task's MANDATORY 2008-concentration guard: genuine refits
                               (never a post-hoc subset) with-2008, without-2008, and
                               pre-2008-era-only. A candidate whose signal collapses to
                               chance once 2008 is excluded from TRAINING is rejected as a
                               pure global-shock time-effect (mirrors
                               `../gfc2008_prefilter.gfc2008_verdict`, extended with the
                               explicit pre-2008-era leg the task also mandates). The
                               pre-2008-era leg is advisory-only (does not force a REJECT) if
                               there are too few pre-2008 positives to bind -- same
                               data-starvation convention as
                               `mass-protest-enrichment/battery_gates.d7_gate_verdict`.
  * `lag_decay_verdict`    -- D4 coincident-vs-leading check (pre-reg: "must lift from
                               t-2/t-3, not just t-1"): a candidate whose AUC restricted to
                               t-2/t-3-only information collapses to chance is coincident,
                               not leading.

`placebo_near_null` / `orthogonality_pass` are thin, cycle-local re-expressions of patterns
already proven elsewhere (`mass-protest-enrichment/battery_gates.d2_placebo_near_null`,
`../d3_orthogonality_income_proxy.d3_verdict`'s orthogonality leg) -- reproduced here (not
imported) because this module must stay import-light (no sys.path reach into a sibling
experiment directory) per this cycle's own convention (see `oecd_scope.py`,
`screen_coverage_reboot.py`).
"""
from __future__ import annotations

from typing import Any

CHANCE_AUC = 0.50
DEFAULT_FLOOR = 0.02
DEFAULT_ORTHOGONALITY_R_THRESHOLD = 0.5
MIN_PRE2008_POS_FOR_BINDING = 8  # matches D7_MIN_POS_FOR_BINDING / mass-protest's advisory convention


def _is_num(x: Any) -> bool:
    return x is not None and x == x  # not None and not NaN


# ============================================================================================
# D7 (pre-reg numbering) -- minimum-effect-size floor: CI-lower must clear +0.02, not just 0.
# ============================================================================================
def floor_gate_pass(delta_ci_lo: float | None, floor: float = DEFAULT_FLOOR) -> bool:
    """Pass iff the paired-bootstrap delta-AUC 95% CI-lower is a genuine NUMBER and strictly
    exceeds `floor` (default +0.02). None/NaN (a degenerate or unavailable fit) fails closed."""
    if not _is_num(delta_ci_lo):
        return False
    return delta_ci_lo > floor


# ============================================================================================
# MANDATORY 2008-concentration era-decomposition (task's guard #2 / #1 expected failure mode).
# ============================================================================================
def era2008_verdict(
    auc_full: float | None,
    auc_excl_2008: float | None,
    auc_pre2008_era: float | None,
    n_pre2008_pos: int,
    chance: float = CHANCE_AUC,
    min_pre2008_pos: int = MIN_PRE2008_POS_FOR_BINDING,
) -> dict[str, Any]:
    """Genuine with-vs-without-2008 + pre-2008-era refits (never a post-hoc row subset of the
    same predictions -- see the orchestration side for the actual refit). Verdict precedence:

      1. `auc_excl_2008` unavailable (None/NaN, e.g. the 2008-excluded refit failed coverage
         or a degenerate single-class fold) -> INCONCLUSIVE_INSUFFICIENT_DATA.
      2. `auc_excl_2008 <= chance` -> REJECT_GFC2008_CONCENTRATED (the candidate carries NO
         signal once the global 2008 shock year is removed from TRAINING -- exactly the
         task's "#1 expected failure mode").
      3. `n_pre2008_pos < min_pre2008_pos` -> PASS_ERA_CHECK_PRE2008_ADVISORY_INSUFFICIENT
         (excl-2008 already cleared chance; too few pre-2008 positives to bind a second
         verdict on -- advisory-only, does not force a REJECT, same data-starvation
         convention as the D7 temporal hold-out gate elsewhere in the repo).
      4. `auc_pre2008_era` unavailable or `<= chance` -> REJECT_WORSE_THAN_CHANCE_PRE_2008
         (the task's explicit second failure mode: "worse than chance outside [2008] is a
         REJECT").
      5. else -> PASS_ERA_CHECK.
    """
    if not _is_num(auc_excl_2008):
        return {
            "verdict": "INCONCLUSIVE_INSUFFICIENT_DATA",
            "reject": False,
            "reason": "auc_excl_2008 unavailable (None/NaN)",
        }
    if auc_excl_2008 <= chance:
        return {
            "verdict": "REJECT_GFC2008_CONCENTRATED",
            "reject": True,
            "reason": f"auc_excl_2008={auc_excl_2008!r} <= chance={chance!r}",
        }
    if n_pre2008_pos < min_pre2008_pos:
        return {
            "verdict": "PASS_ERA_CHECK_PRE2008_ADVISORY_INSUFFICIENT",
            "reject": False,
            "reason": (
                f"n_pre2008_pos={n_pre2008_pos} < min_pre2008_pos={min_pre2008_pos} -> "
                "advisory-only, non-blocking (excl-2008 leg already cleared chance)"
            ),
        }
    if not _is_num(auc_pre2008_era) or auc_pre2008_era <= chance:
        return {
            "verdict": "REJECT_WORSE_THAN_CHANCE_PRE_2008",
            "reject": True,
            "reason": f"auc_pre2008_era={auc_pre2008_era!r} vs chance={chance!r}",
        }
    return {
        "verdict": "PASS_ERA_CHECK",
        "reject": False,
        "reason": (
            f"auc_full={auc_full!r} auc_excl_2008={auc_excl_2008!r} "
            f"auc_pre2008_era={auc_pre2008_era!r} all clear chance={chance!r}"
        ),
    }


# ============================================================================================
# D4 (pre-reg numbering) -- coincident-vs-leading lag-decay.
# ============================================================================================
def lag_decay_verdict(
    auc_t1_only: float | None, auc_t2t3_only: float | None, chance: float = CHANCE_AUC,
) -> dict[str, Any]:
    """Pass ("PASS_LEADING") iff the t-2/t-3-only fit ALSO clears chance -- i.e. the signal is
    not purely a t-1 (coincident) artifact. `auc_t2t3_only` unavailable -> INCONCLUSIVE.
    `auc_t1_only` is carried through for reporting/diagnostic only (a t-1-only AUC below
    chance is unusual but does not itself gate -- the pre-reg's bar is specifically about
    whether the LEADING (t-2/t-3) legs carry signal, not whether t-1 is stronger than t-2/t-3,
    which is the expected/benign lag-decay shape for any genuine leading indicator)."""
    if not _is_num(auc_t2t3_only):
        return {
            "verdict": "INCONCLUSIVE_INSUFFICIENT_DATA", "reject": False,
            "reason": "auc_t2t3_only unavailable (None/NaN)",
        }
    if auc_t2t3_only <= chance:
        return {
            "verdict": "REJECT_COINCIDENT_ONLY", "reject": True,
            "reason": f"auc_t2t3_only={auc_t2t3_only!r} <= chance={chance!r} (t-1 only)",
        }
    return {
        "verdict": "PASS_LEADING", "reject": False,
        "reason": f"auc_t1_only={auc_t1_only!r} auc_t2t3_only={auc_t2t3_only!r}",
    }


# ============================================================================================
# Placebo near-null (has-data dummy + values-scrambled permutation) -- reproduces
# mass-protest-enrichment/battery_gates.d2_placebo_near_null's logic (not imported; see
# module docstring for why).
# ============================================================================================
def placebo_near_null(delta_ci_lo: float | None) -> bool:
    """A placebo is near-null iff its delta-vs-baseline CI-lower does NOT clear 0 (no
    significant positive lift). None/NaN fails closed (an unavailable placebo fit is not
    'presumably fine')."""
    if not _is_num(delta_ci_lo):
        return False
    return delta_ci_lo <= 0.0


def placebo_gate_pass(dummy_delta_ci_lo: float | None, permuted_delta_ci_lo: float | None) -> bool:
    return placebo_near_null(dummy_delta_ci_lo) and placebo_near_null(permuted_delta_ci_lo)


# ============================================================================================
# Orthogonality vs run-2 drivers -- reproduces
# ../d3_orthogonality_income_proxy.py's orthogonality leg's threshold logic (not imported;
# see module docstring).
# ============================================================================================
def orthogonality_pass(multiple_r: float | None, threshold: float = DEFAULT_ORTHOGONALITY_R_THRESHOLD) -> bool:
    """Pass iff the candidate's multiple-R regressed on the run-2 driver block is BELOW
    `threshold` (default 0.5, the charter's canonical |rho|<0.5 bar) -- i.e. the candidate is
    not just a re-expression of the existing drivers. NaN/None fails closed."""
    if not _is_num(multiple_r):
        return False
    return multiple_r < threshold


# ============================================================================================
# D5 (pre-reg numbering) -- per-country breadth: a strict majority of countries with both
# classes represented in their own held-out LOCO fold must clear chance.
# ============================================================================================
def per_country_gate_pass(per_country_auc: dict[str, float], chance: float = CHANCE_AUC) -> bool:
    if not per_country_auc:
        return False
    n = len(per_country_auc)
    n_above = sum(1 for v in per_country_auc.values() if v >= chance)
    return n_above > n / 2.0
