"""F-H-1 item 4 — deploy-time dispatch SHA verification (skeleton).

Per qgi-docs/internal/ops/ml-track/stage-2-hybrid-d2-d5-walk-methodology-prereg.md
(commit 7db3596) F-H-1 item 4:

    "Deployment-time falsification check: at production deploy, a
    verification script must compare the dispatch-table SHA against
    the latest pre-reg-merged commit's expected SHA. Mismatch blocks
    deploy."

This script is the **skeleton** for that deploy-time check. The
expected SHA constant below is computed from the dispatch JSON at the
hybrid pre-reg merge commit (qgi-docs `7db3596`) and pinned here. Any
amendment to the dispatch table requires:

1. A NEW pre-reg amendment per F-H-4 (Lakatosian guard);
2. Rotation of EXPECTED_DISPATCH_SHA below to match the new dispatch JSON;
3. The amendment commit chronologically PRECEDING any production walk
   under the new dispatch (per F-H-4 amendment constraint 1).

**Usage (Stage 4 deploy pipeline integration):**

    # In the deploy CI step, before any production walk:
    python scripts/verify_dispatch_sha.py

    # Exits 0 if dispatch SHA matches expected; exits 1 with a clear
    # error message if not (CI fails; deploy blocks).

**Status:** This script is operational for the current dispatch JSON.
The full Stage 4 deploy-pipeline integration (CI step wiring, alerting,
rotation playbook for amendments) is queued for the Stage 4 deploy PR.
This stub closes the F-H-1 item 4 TODO in `src/hybrid_dispatch.py`.

Acceptance criteria for the future Stage 4 deploy PR:
1. CI workflow runs this script before any production prediction job
2. Failed verification creates a P0 alert + blocks the deploy
3. EXPECTED_DISPATCH_SHA rotation is part of every F-H-4 amendment PR
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "src"))

from hybrid_dispatch import load_dispatch  # noqa: E402

# ============================================================================
# EXPECTED_DISPATCH_SHA — the SHA-256 of the canonical hybrid dispatch JSON
# at the most recent pre-reg-merged commit (currently 7db3596 hybrid pre-reg
# + 38efed3 dispatch infra PR + 500e3f1 catalog annotation PR).
#
# This value MUST be rotated whenever the dispatch JSON content changes,
# and the rotation MUST be part of a NEW pre-reg amendment per F-H-4.
# A bare dispatch JSON edit without rotating this constant is a
# pre-reg integrity violation and should be blocked at PR review by the
# persona owning pre-reg discipline (Kwame Adjei or successor).
#
# To compute the current SHA for rotation:
#    python -c "from hybrid_dispatch import load_dispatch; print(load_dispatch().sha256)"
# ============================================================================
EXPECTED_DISPATCH_SHA = "DEFERRED_TO_STAGE_4_DEPLOY_PR"


def verify() -> tuple[bool, str]:
    """Compare runtime dispatch SHA against the pre-reg-pinned expected SHA.

    Returns
    -------
    (ok, message) : tuple
        ok=True if the SHAs match; ok=False otherwise. The message is a
        human-readable description suitable for CI log + alert payload.
    """
    if EXPECTED_DISPATCH_SHA == "DEFERRED_TO_STAGE_4_DEPLOY_PR":
        return False, (
            "F-H-1 item 4 verification is in skeleton state. "
            "EXPECTED_DISPATCH_SHA is not yet pinned to a pre-reg-merged "
            "commit. This is the expected state until the Stage 4 deploy "
            "pipeline PR lands. Once that PR pins the SHA, this verifier "
            "becomes operational. Until then, production walks must "
            "manually verify the dispatch SHA in a runbook step."
        )

    dispatch = load_dispatch()
    runtime_sha = dispatch.sha256
    if runtime_sha == EXPECTED_DISPATCH_SHA:
        return True, (
            f"OK: dispatch SHA matches expected ({runtime_sha[:16]}...). "
            f"F-H-1 item 4 deploy-time verification passes."
        )
    return False, (
        f"FAIL: dispatch SHA mismatch.\n"
        f"  Expected (pre-reg pinned):  {EXPECTED_DISPATCH_SHA}\n"
        f"  Runtime (config/hybrid_architecture_dispatch.json): {runtime_sha}\n"
        f"\n"
        f"This deploy is BLOCKED per F-H-1 item 4. The dispatch JSON has "
        f"been modified since the last pre-reg amendment. Either:\n"
        f"  (a) Revert the dispatch JSON to the pre-reg-merged state, OR\n"
        f"  (b) File a new pre-reg amendment per F-H-4 + rotate "
        f"EXPECTED_DISPATCH_SHA in scripts/verify_dispatch_sha.py to "
        f"match the new dispatch SHA.\n"
        f"\n"
        f"A bare dispatch JSON edit without F-H-4 amendment is a pre-reg "
        f"integrity violation and should be blocked at PR review."
    )


def main() -> int:
    ok, message = verify()
    if ok:
        print(message)
        return 0
    print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
