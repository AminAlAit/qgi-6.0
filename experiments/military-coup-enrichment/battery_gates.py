"""D1-D7 PURE gate evaluators for the military_coup 7-gate battery (dict/float in,
bool/dict out) -- host-testable, see test_battery_gates.py. Everything below the
"Orchestration reuse" divider needs `score_pilot` (pure stdlib, still host-importable).

Gate numbering matches PRE-REGISTRATION.md's acceptance bar #1-7:
  D1 coverage-matched baseline -- judged vs the recomputed 0.652 honest baseline (row-aligned
     re-fit, never the stale 0.677 anchor).
  D2 missingness placebo -- has-data dummy AND values-scrambled permutation score near-null
     (neither shows a significant "lift" over baseline); PLUS, for NY.GDP.MKTP.KD.ZG only, the
     GDP-growth-missingness-vs-coup-proneness check (the banking "has-data != regime" lesson).
  D3 V-Dem-family orthogonality (HARDENED) -- MANDATORY for the 5 V-Dem candidates; confirmed
     via d3_vdem_orthogonality.py (imported, never recomputed here). N/A (auto-pass) for
     NY.GDP.MKTP.KD.ZG, which is not a V-Dem series.
  D4 incremental lift OVER the coup-trap-alone baseline (0.4916 CI [0.4483,0.5360]).
  D5 per-country decomposition -- lift lands on real coup countries, not 2-3 lucky folds.
  D6 country-block paired-bootstrap CI-lower > 0 vs the recomputed 0.652 baseline, BH-FDR
     across the 6-candidate family (secondary safeguard per the pre-reg).
  D7 locked temporal hold-out replicates (chance-floor CI-lower check; advisory downgrade if
     the post-cut positive count is too small to bind).
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))

CHANCE_AUC = 0.50
HONEST_BASELINE_ANCHOR = 0.652
D1_TOLERANCE = 0.03  # row-aligned re-fit must reproduce the recomputed 0.652 within this band
GDP_MISSINGNESS_R_THRESHOLD = 0.30  # |point-biserial r| above this = has-data proxies label
D7_MIN_POS_FOR_BINDING = 8  # matches banking em_test's own advisory-downgrade threshold


def _is_num(x: Any) -> bool:
    return x is not None and x == x  # not None and not NaN


# ============================================================================================
# D1 -- coverage-matched, row-aligned baseline re-fit.
# ============================================================================================
def d1_gate_pass(
    baseline_loco_auc: float | None,
    anchor: float = HONEST_BASELINE_ANCHOR,
    tolerance: float = D1_TOLERANCE,
) -> bool:
    """D1 passes iff the row-aligned re-fit of run-2's 5 drivers reproduces the recomputed
    honest baseline (0.652) within `tolerance` -- i.e. the candidate is being judged against
    the CORRECT, freshly-refit denominator, not a stale scalar (0.677) or a coverage-truncated
    fit that happens to drift far from the known-good anchor."""
    if not _is_num(baseline_loco_auc):
        return False
    return abs(baseline_loco_auc - anchor) <= tolerance


# ============================================================================================
# D2 -- missingness placebo (both must be near-null) + GDP-growth-specific check.
# ============================================================================================
def d2_placebo_near_null(delta_ci_lo: float | None) -> bool:
    """A placebo (has-data dummy or values-scrambled permutation) is near-null iff its delta
    vs baseline does NOT show a significant positive lift, i.e. the CI-lower does not clear 0.
    `None`/NaN CI-lower (a degenerate/failed fit) is treated as near-null-FAILED (fails
    closed -- an unavailable placebo fit cannot be waved through as 'presumably fine')."""
    if not _is_num(delta_ci_lo):
        return False
    return delta_ci_lo <= 0.0


def d2_gate_pass(
    dummy_delta_ci_lo: float | None,
    permuted_delta_ci_lo: float | None,
    gdp_missingness_r: float | None = None,
    gdp_r_threshold: float = GDP_MISSINGNESS_R_THRESHOLD,
) -> bool:
    """D2 passes iff BOTH placebos are near-null AND (for NY.GDP.MKTP.KD.ZG, where
    `gdp_missingness_r` is supplied) the has-data/label point-biserial correlation does not
    exceed the threshold. `gdp_missingness_r=None` (non-GDP candidates) skips that sub-check."""
    if not (d2_placebo_near_null(dummy_delta_ci_lo) and d2_placebo_near_null(permuted_delta_ci_lo)):
        return False
    if gdp_missingness_r is not None:
        if not _is_num(gdp_missingness_r):
            return False
        if abs(gdp_missingness_r) > gdp_r_threshold:
            return False
    return True


# ============================================================================================
# D3 -- V-Dem orthogonality (confirmation of the already-run screen).
# ============================================================================================
def d3_gate_pass(d3_verdict: str | None) -> bool:
    """`d3_verdict=None` means the candidate is not a V-Dem series (e.g. NY.GDP.MKTP.KD.ZG) --
    D3 does not apply, auto-pass. Otherwise pass iff the verdict is exactly PASS_ORTHOGONAL."""
    if d3_verdict is None:
        return True
    return d3_verdict == "PASS_ORTHOGONAL"


# ============================================================================================
# D4 -- incremental lift over the coup-trap-alone baseline.
# ============================================================================================
def d4_gate_pass(delta_vs_couptrap_ci_lo: float | None) -> bool:
    """D4 passes iff the candidate recipe's (run-2 5 drivers + candidate) paired-bootstrap
    delta AUC vs the coup-trap-alone baseline has CI-lower strictly > 0."""
    if not _is_num(delta_vs_couptrap_ci_lo):
        return False
    return delta_vs_couptrap_ci_lo > 0.0


# ============================================================================================
# D5 -- per-country decomposition.
# ============================================================================================
def d5_gate_pass(per_country_auc: dict[str, float]) -> bool:
    """D5 passes iff a STRICT majority of countries with both classes represented in their
    own held-out LOCO fold score AUC >= chance -- the lift is broad-based, not the artifact of
    2-3 lucky folds. Empty input (no country has both classes) cannot confirm breadth -> fails
    closed."""
    if not per_country_auc:
        return False
    n = len(per_country_auc)
    n_above = sum(1 for v in per_country_auc.values() if v >= CHANCE_AUC)
    return n_above > n / 2.0


# ============================================================================================
# D6 -- country-block paired-bootstrap CI-lower > 0 vs baseline, ANDed with BH-FDR survival.
# ============================================================================================
def d6_gate_pass(ci95_lo: float | None, fdr_reject: bool) -> bool:
    if not _is_num(ci95_lo):
        return False
    return ci95_lo > 0.0 and bool(fdr_reject)


# ============================================================================================
# D7 -- locked temporal hold-out (advisory downgrade on data starvation).
# ============================================================================================
def d7_gate_verdict(
    n_holdout_pos: int,
    holdout_auc_ci_lo: float | None,
    min_pos_for_binding: int = D7_MIN_POS_FOR_BINDING,
    chance: float = CHANCE_AUC,
) -> dict[str, Any]:
    if n_holdout_pos < min_pos_for_binding:
        return {
            "gate_pass": True, "advisory": True,
            "reason": (f"n_holdout_pos={n_holdout_pos} < {min_pos_for_binding} -> advisory "
                       "downgrade (non-blocking), too data-starved to bind"),
        }
    if not _is_num(holdout_auc_ci_lo):
        return {"gate_pass": False, "advisory": False,
                "reason": "holdout CI unavailable (fit failed or degenerate)"}
    return {
        "gate_pass": bool(holdout_auc_ci_lo > chance), "advisory": False,
        "reason": f"holdout_auc_ci_lo={holdout_auc_ci_lo!r} vs chance={chance!r}",
    }


# ============================================================================================
# Overall AND-gate.
# ============================================================================================
def all_seven_and(gates: dict[str, bool]) -> bool:
    return len(gates) == 7 and all(bool(v) for v in gates.values())


# ============================================================================================
# Orchestration reuse: joint BH-FDR combine across the candidate family (D6's second half).
# Needs `score_pilot` (pure stdlib, host-importable without the ML stack).
# ============================================================================================
def combine_with_fdr(
    per_candidate_d6_pvalue: dict[str, float], fdr_q: float = 0.10,
) -> dict[str, dict[str, Any]]:
    """Apply Benjamini-Hochberg FDR jointly across every candidate's D6 paired-bootstrap
    p-value (`score_pilot.bh_fdr`, imported -- never reimplemented). NaN/None p-values are
    treated as p=1.0 (never rejected) rather than crashing the combine. Returns
    `{candidate_id: {"p_value", "p_adjusted", "reject"}}`, order-preserving on the input dict's
    iteration order (Python 3.7+ dict order)."""
    import score_pilot as sp  # noqa: E402  (pure stdlib)

    ids = list(per_candidate_d6_pvalue.keys())
    raw = [per_candidate_d6_pvalue[i] for i in ids]
    safe = [p if _is_num(p) else 1.0 for p in raw]
    reject_flags, adj_p = sp.bh_fdr(safe, fdr_q)
    return {
        ids[i]: {"p_value": raw[i], "p_adjusted": adj_p[i], "reject": reject_flags[i]}
        for i in range(len(ids))
    }
