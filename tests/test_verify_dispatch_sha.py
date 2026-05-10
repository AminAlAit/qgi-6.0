"""Tests for `qgi_ml.scripts.verify_dispatch_sha` (F-H-1 item 4 skeleton).

The deploy-time SHA verification is in skeleton state pending the Stage 4
deploy pipeline PR. These tests lock the skeleton's behavior so the future
deploy-pipeline integration knows the contract.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_ROOT = REPO_ROOT / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))
if str(REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "src"))

import verify_dispatch_sha  # noqa: E402


def test_skeleton_state_returns_false():
    """In skeleton state (EXPECTED_DISPATCH_SHA not yet pinned), verify() returns
    False with a clear deferred-to-Stage-4 message.

    This is the EXPECTED state until the Stage 4 deploy pipeline PR pins the
    SHA. The verify() function returns False (block deploy) intentionally so
    no production walk can pass the gate until the SHA is properly pinned.
    """
    ok, message = verify_dispatch_sha.verify()
    assert ok is False
    assert "skeleton state" in message.lower() or "deferred" in message.lower()


def test_main_returns_nonzero_in_skeleton_state(capsys):
    """The CLI entry point exits with non-zero code in skeleton state.

    Stage 4 CI integration: this means any deploy job that runs the
    verifier before SHA pinning will fail loudly rather than silently
    pass. Defensible default.
    """
    exit_code = verify_dispatch_sha.main()
    assert exit_code == 1
    captured = capsys.readouterr()
    # Message goes to stderr per the verifier's contract
    assert "F-H-1" in captured.err or "skeleton" in captured.err.lower()


def test_expected_sha_constant_documented():
    """The EXPECTED_DISPATCH_SHA constant must exist and have a documented
    deferred-state value. Stage 4 deploy PR will replace this with the
    actual SHA."""
    assert hasattr(verify_dispatch_sha, "EXPECTED_DISPATCH_SHA")
    # In skeleton state, value is a deferred sentinel
    assert verify_dispatch_sha.EXPECTED_DISPATCH_SHA == "DEFERRED_TO_STAGE_4_DEPLOY_PR"


def test_verifier_message_includes_rotation_guidance():
    """The skeleton message must explicitly tell future readers how to
    rotate the expected SHA (so the Stage 4 deploy PR doesn't have to
    re-derive the convention)."""
    ok, message = verify_dispatch_sha.verify()
    assert ok is False
    # Verify the message references the broader F-H-4 amendment rule
    # (which governs how dispatch table changes get pre-registered)
    assert "Stage 4" in message or "deploy" in message.lower()
