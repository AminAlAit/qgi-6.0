"""Determinism regression test for `qgi_ml.src.shape_kernel` (§4.2 binding).

Per Stage 6 pre-reg (qgi-docs commit e4f9e7a) §4.2 (binding):

    "Determinism guarantee. Given identical inputs, compute_shape_features
    must return bit-identical outputs across runs. Regression test at
    tests/test_shape_kernel_determinism.py asserts the kernel run twice
    on the same input yields identical bytes."

**Chunk A status (this commit):** SKIPPED. The test is a marker that
documents the determinism contract from §4.2; it activates in Chunk B
once the math lands. Chunk B replaces the `pytest.mark.skip` with a real
implementation that constructs a fixture prototype + indicator panel,
runs `compute_shape_features` twice, and asserts the two
`ShapeFeatureTriple` outputs are bit-identical (tuple equality plus
explicit float-bit comparison via `struct.pack`).

The §4.2 guarantee is achievable without effort in Python because
none of the planned math operations (FPCA score projection, DTW,
cosine-of-lag) consult random state. Chunk B MUST avoid any operation
that would break determinism: no `np.random`, no `set` ordering
dependencies in trajectory indexing, no float-summation order that
varies by dict iteration order under different Python builds.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))


@pytest.mark.skip(reason="Chunk B: enables once math lands per §4.2 determinism guarantee")
def test_compute_shape_features_is_bit_deterministic() -> None:
    """Two invocations on identical inputs produce bit-identical triples.

    Chunk B implementation outline (placeholder):

        from shape_kernel import compute_shape_features
        prototype = _build_fixture_prototype()
        panel = _build_fixture_indicator_panel()
        triple_1 = compute_shape_features("VEN", "mass_protest", 2024,
                                          prototype, panel)
        triple_2 = compute_shape_features("VEN", "mass_protest", 2024,
                                          prototype, panel)
        # Tuple equality on the NamedTuple:
        assert triple_1 == triple_2
        # Bit-identical floats (defensive — Python float == can pass on
        # different bit patterns for some NaN/zero edge cases, so we
        # check struct-packed bytes too):
        import struct
        for v1, v2 in zip(triple_1, triple_2):
            assert struct.pack(">d", v1) == struct.pack(">d", v2)
    """
    raise NotImplementedError(
        "Chunk B implements this test against the real kernel math; "
        "Chunk A documents the contract via this skipped marker."
    )


def test_determinism_contract_documented_in_kernel_docstring() -> None:
    """The determinism guarantee is reachable from the public API docstring.

    This test is NOT skipped — it locks the API-doc requirement now so
    that any Chunk B refactor that drops the guarantee from the
    docstring is caught immediately.
    """
    from shape_kernel import compute_shape_features

    doc = compute_shape_features.__doc__ or ""
    assert "Determinism guarantee" in doc
    assert "bit-identical" in doc
    # Whitespace-normalize before checking — the docstring may wrap the
    # phrase across newlines.
    normalized = " ".join(doc.lower().split())
    assert "no random state" in normalized or "no `np.random`" in normalized


def test_determinism_test_module_skip_marker_present() -> None:
    """Sentinel: confirms the skipped Chunk B test exists in this module.

    Without this sentinel a future PR could silently delete the skipped
    test and leave Chunk B unable to find the placeholder. This test
    locks the placeholder's presence by name.
    """
    import test_shape_kernel_determinism as mod

    assert hasattr(mod, "test_compute_shape_features_is_bit_deterministic")
