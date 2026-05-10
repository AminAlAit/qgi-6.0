"""Regression tests locking the in-sample F2 anomaly state for the 2 hybrid
recipes flagged in `stage-2-hybrid-d2-d5-walk-methodology-prereg.md` and the
Stage 5 paper Section 4 (qgi-docs PR #50).

Two recipes earn their hybrid tier via LOCO under D5-assigned architecture
but FAIL in-sample F2 under D5:
  - `epidemic_and_pandemic` (STRONG tier via LOCO 0.8824; in-sample F2 fails)
  - `territorial_disputes` (MODERATE tier via LOCO 0.6780; in-sample F2 fails;
    additionally, predictions collapse to near-zero — see Stage 5 paper)

The hybrid pre-reg F-H-1 places production predictions on the assigned
architecture but does NOT explicitly resolve which F-rule set applies
under hybrid (D2 walk's F1+F2 vs D5 walk's F-D5-x). This is a flagged
Majles agenda item; pending resolution, the dispatch table marks both
recipes with `f_rule_anomaly: true` and Stage 5 disclosure treats them
as composite-signal only.

These tests lock the disclosed state so that a future model retrain
or pipeline change cannot accidentally "fix" the anomaly without
explicit Majles re-pre-registration.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pytest
from sklearn.metrics import roc_auc_score

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from cohort_calibration import compute_ece  # noqa: E402
from hybrid_dispatch import load_dispatch  # noqa: E402


# D5 canonical predictions path (qgi-data PR #32 commit e19da56; local mirror in qgi-ml)
D5_PREDICTIONS_LOCAL = REPO_ROOT / "results" / "d5_multitask_2026_05_07" / "predictions.json"
# qgi-data canonical mirror used by Stage 5 paper for buyer disclosure
D5_PREDICTIONS_QGI_DATA = REPO_ROOT.parent / "qgi-data" / "reference" / "d5-d7-beta-validation-results-2026-05-07.json"


def _load_d5_predictions() -> list[dict]:
    """Load D5 predictions from the qgi-data canonical mirror (preferred)
    or the qgi-ml local copy as fallback."""
    for p in (D5_PREDICTIONS_QGI_DATA, D5_PREDICTIONS_LOCAL):
        if p.exists():
            payload = json.loads(p.read_text(encoding="utf-8"))
            return payload.get("predictions", payload if isinstance(payload, list) else [])
    pytest.skip(f"D5 predictions JSON not found at {D5_PREDICTIONS_QGI_DATA} or {D5_PREDICTIONS_LOCAL}")


def _bootstrap_auc_ci(probs: np.ndarray, labels: np.ndarray, n_boot: int = 200, seed: int = 0) -> tuple[float, float, float]:
    """Bootstrap AUC + 95% CI; matches the convention used in the walk reports."""
    point = roc_auc_score(labels, probs)
    rng = np.random.default_rng(seed)
    aucs = []
    for _ in range(n_boot):
        idx = rng.integers(0, len(labels), size=len(labels))
        if labels[idx].sum() in (0, len(idx)):
            continue
        try:
            aucs.append(roc_auc_score(labels[idx], probs[idx]))
        except Exception:
            continue
    lo = float(np.percentile(aucs, 2.5)) if aucs else float("nan")
    hi = float(np.percentile(aucs, 97.5)) if aucs else float("nan")
    return point, lo, hi


# ---- Dispatch table: f_rule_anomaly flag is locked in ------------------------


def test_dispatch_marks_epidemic_and_pandemic_as_f_rule_anomaly():
    """The dispatch JSON marks epidemic_and_pandemic with f_rule_anomaly=true.

    Pending Majles clarification on hybrid F-rule applicability, this flag
    is the binding contract for downstream Stage 4 production-walk code.
    """
    dispatch = load_dispatch()
    a = dispatch.assignment_for("epidemic_and_pandemic")
    assert a.f_rule_anomaly is True, (
        "epidemic_and_pandemic must be flagged f_rule_anomaly=True in the "
        "dispatch table until Majles resolves the hybrid F-rule applicability "
        "ambiguity. If you're seeing this fail, a model update or dispatch "
        "edit may have removed the flag without re-pre-registration."
    )


def test_dispatch_marks_territorial_disputes_as_f_rule_anomaly():
    dispatch = load_dispatch()
    a = dispatch.assignment_for("territorial_disputes")
    assert a.f_rule_anomaly is True, (
        "territorial_disputes must be flagged f_rule_anomaly=True in the "
        "dispatch table until Majles resolves the hybrid F-rule applicability "
        "ambiguity."
    )


def test_dispatch_exactly_two_f_rule_anomalies():
    """Exactly 2 recipes have f_rule_anomaly=True per the Stage 5 paper finding.

    Also asserts the locked_recipes() count is the expected 14 — this guards
    against a silent regression where a recipe is moved out of the LOCKED set
    (and therefore out of `locked_recipes()`), which would let an
    f_rule_anomaly count change pass undetected.
    """
    dispatch = load_dispatch()
    locked = dispatch.locked_recipes()
    assert len(locked) == 14, (
        f"Expected 14 LOCKED recipes per hybrid pre-reg; got {len(locked)}. "
        f"A recipe being moved out of the LOCKED set would let the "
        f"f_rule_anomaly count silently pass even if a new anomaly is "
        f"introduced. Any change to the LOCKED set requires Majles "
        f"re-pre-registration."
    )
    anomalies = [r for r in locked if dispatch.has_f_rule_anomaly(r)]
    assert sorted(anomalies) == ["epidemic_and_pandemic", "territorial_disputes"], (
        f"Expected exactly 2 f_rule_anomaly recipes (epidemic_and_pandemic + "
        f"territorial_disputes); got {sorted(anomalies)}. Any change to this "
        f"set requires Majles re-pre-registration."
    )


def test_dispatch_negative_lock_human_rights_violation_no_anomaly():
    """Negative lock: human_rights_violation has n_pos_loco=1 + D5-assigned
    but f_rule_anomaly is False (in-sample F2 passes for this recipe under D5).

    Per Sonnet PR #42 review N4: without this negative lock, a future JSON
    edit flipping human_rights_violation's f_rule_anomaly to True would not
    be caught by the count test alone (which expects 2 anomalies; 3 would
    fail loudly, but a 2-flip swap would not).
    """
    dispatch = load_dispatch()
    a = dispatch.assignment_for("human_rights_violation")
    # Confirm the structural setup that makes this a meaningful negative lock
    assert a.architecture == "D5"
    assert a.n_pos_loco == 1
    assert a.advisory_only is True  # n_pos=1 → ADVISORY-ONLY
    # The negative lock itself
    assert a.f_rule_anomaly is False, (
        "human_rights_violation must NOT be flagged f_rule_anomaly per "
        "Stage 5 paper finding (in-sample F2 passes under D5 with AUC 0.8378). "
        "If you're seeing this fail, a JSON edit may have incorrectly added "
        "the flag — requires Majles re-pre-registration."
    )


# ---- Empirical state: in-sample F2 fails for these 2 recipes ----------------


def test_epidemic_and_pandemic_in_sample_f2_fails_under_d5():
    """Documented Stage 5 finding: epidemic_and_pandemic in-sample F2 fails
    under D5 (AUC < 0.57; CI does not exclude 0.5). Locks this state until
    Majles resolves.
    """
    preds = _load_d5_predictions()
    rps = [p for p in preds if p["recipe_id"] == "epidemic_and_pandemic"]
    if not rps:
        pytest.skip("epidemic_and_pandemic not in D5 predictions")
    probs = np.array([p["predicted_probability"] for p in rps])
    labels = np.array([p["label"] for p in rps])
    n_pos = int(labels.sum())
    auc, ci_lo, ci_hi = _bootstrap_auc_ci(probs, labels)

    # Documented values from Stage 5 paper tear-sheet
    assert n_pos == 2, f"expected n_pos_test=2; got {n_pos}"
    # F2 fails on point estimate
    assert auc < 0.57, (
        f"epidemic_and_pandemic in-sample F2 AUC = {auc:.4f}; expected < 0.57. "
        f"If F2 now passes, the documented F-rule anomaly status is invalidated "
        f"and the Stage 5 paper + dispatch flag require update via Majles."
    )
    # F2 fails on CI lower bound (CI does not exclude 0.5)
    assert ci_lo <= 0.5, (
        f"epidemic_and_pandemic in-sample F2 CI lower = {ci_lo:.4f}; expected <= 0.5. "
        f"If CI now excludes 0.5, the F-rule anomaly is partially resolved; "
        f"Stage 5 disclosure needs Majles update."
    )


def test_territorial_disputes_in_sample_f2_fails_under_d5():
    """Documented Stage 5 finding: territorial_disputes in-sample F2 fails
    under D5 (AUC < 0.57; CI does not exclude 0.5). Predictions collapse
    to near-zero per Stage 5 paper Section 4.
    """
    preds = _load_d5_predictions()
    rps = [p for p in preds if p["recipe_id"] == "territorial_disputes"]
    if not rps:
        pytest.skip("territorial_disputes not in D5 predictions")
    probs = np.array([p["predicted_probability"] for p in rps])
    labels = np.array([p["label"] for p in rps])
    n_pos = int(labels.sum())
    auc, ci_lo, ci_hi = _bootstrap_auc_ci(probs, labels)

    assert n_pos == 2
    assert auc < 0.57, (
        f"territorial_disputes in-sample F2 AUC = {auc:.4f}; expected < 0.57."
    )
    assert ci_lo <= 0.5

    # Stage 5 paper explicitly documents that predictions collapse to near-zero
    # for this recipe under D5 (max ~1.91e-6; both positives at exactly 0.0).
    # Lock this state — a future change that produces meaningful probabilities
    # would partially resolve the anomaly and require Majles update.
    assert probs.max() < 1e-3, (
        f"territorial_disputes D5 predictions max = {probs.max():.2e}; expected "
        f"< 1e-3 per Stage 5 paper (predictions collapse to near-zero under D5). "
        f"If max prob is now >= 1e-3, the documented 'degenerate output' anomaly "
        f"is partially resolved; Stage 5 disclosure needs Majles update."
    )


def test_epidemic_and_pandemic_loco_strong_tier_via_dispatch():
    """The hybrid tier (STRONG) for epidemic_and_pandemic rests on LOCO,
    not in-sample F2. Confirm dispatch encodes this."""
    dispatch = load_dispatch()
    a = dispatch.assignment_for("epidemic_and_pandemic")
    assert a.tier == "STRONG"
    assert a.loco_auc >= 0.75  # STRONG tier threshold
    # Also confirm ADVISORY-ONLY (separate F-H-3 flag; this recipe carries both)
    assert a.advisory_only is True


def test_territorial_disputes_loco_moderate_tier_via_dispatch():
    """territorial_disputes MODERATE via LOCO; dispatch reflects this."""
    dispatch = load_dispatch()
    a = dispatch.assignment_for("territorial_disputes")
    assert a.tier == "MODERATE"
    assert 0.60 <= a.loco_auc < 0.75  # MODERATE tier range
    # Not ADVISORY-ONLY (n_pos_loco=2 escapes F-H-3 operative carveout)
    assert a.advisory_only is False
    # But IS flagged for f_rule_anomaly
    assert a.f_rule_anomaly is True


# ---- F1 (calibration) still passes — these are F2-only anomalies -------------


def test_epidemic_and_pandemic_f1_still_passes_under_d5():
    """The F-rule anomaly is F2-only (discrimination); F1 (calibration) still
    passes. Locks this state to ensure future model updates don't
    accidentally regress F1 calibration on these recipes."""
    preds = _load_d5_predictions()
    rps = [p for p in preds if p["recipe_id"] == "epidemic_and_pandemic"]
    if not rps:
        pytest.skip("epidemic_and_pandemic not in D5 predictions")
    probs = np.array([p["predicted_probability"] for p in rps])
    labels = np.array([p["label"] for p in rps])
    ece = compute_ece(probs, labels, n_bins=10)
    assert ece <= 0.08, (
        f"epidemic_and_pandemic in-sample F1 ECE = {ece:.4f}; expected <= 0.08. "
        f"F1 must continue to pass even though F2 fails (anomaly is F2-only)."
    )


def test_territorial_disputes_f1_uninformative_under_degenerate_predictions():
    """F1 ECE is UNINFORMATIVE for territorial_disputes under D5.

    Per Sonnet PR #42 review B1: when predictions collapse to ~0 across all
    test cells (territorial_disputes D5: max prob 1.91e-6; both positives at
    exactly 0.0), the ECE statistic is vacuously low — every observation
    falls into the first bin (lo=0.0), so ECE ≈ |observed_rate − 0| =
    n_pos/n ≈ 0.003. This passes ECE ≤ 0.08 trivially but tells you nothing
    about calibration quality.

    A Stage 4 reader could misread "F1 passes" as a genuine calibration
    green light. To avoid that misleading framing, this test does NOT assert
    a numerical ECE bound. Instead it documents the degenerate state as the
    Stage 5 paper does: ECE is technically below threshold but the
    discrimination metric (test_territorial_disputes_in_sample_f2_fails_
    under_d5) is the operative falsification disclosure.

    The degenerate-predictions lock is in
    test_territorial_disputes_in_sample_f2_fails_under_d5 (asserts
    probs.max() < 1e-3). That test is the operative lock on the disclosed
    state.
    """
    preds = _load_d5_predictions()
    rps = [p for p in preds if p["recipe_id"] == "territorial_disputes"]
    if not rps:
        pytest.skip("territorial_disputes not in D5 predictions")
    probs = np.array([p["predicted_probability"] for p in rps])
    # Just confirm the degenerate state; do NOT assert on ECE
    assert probs.max() < 1e-3, (
        "territorial_disputes D5 predictions should be degenerate (near-zero); "
        "if max prob is meaningful, the disclosed state has changed."
    )
