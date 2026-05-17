"""Shape-feature kernel module (Stage 6 §4.2 binding API).

Per `qgi-docs/internal/ops/ml-track/stage-6-shape-feature-prereg.md`
(commit e4f9e7a) §4.2: this module exposes a deterministic public API
``compute_shape_features(country_id, recipe_id, year, shape_prototype,
indicator_panel)`` returning a `ShapeFeatureTriple` of three scalars per
``(country, recipe, year)``. The triple is fed **only** into the
per-recipe head as input features. It is NOT fed into the loss function,
NOT propagated through gradient reversal, NOT absorbed into the shared
backbone embedding, and NOT backpropagated into the prototype parameters
(prototypes are pinned artifacts, not learned weights at training time).

**Chunk A scope (this commit):** type signatures + exception classes +
``NotImplementedError`` body. The math implementation (Mahalanobis-derived
similarity scalar from the posterior-mean prototype, DTW distance + phase
alignment) is Chunk B. The §4.2 binding contract documented here is
final; Chunk B implements within this contract, it does not amend it.

Authority lineage:
    North Star (2026-05-17)
      → DECISION §3 Layers 1-2 + Layer 7 (2026-05-17)
        → modular architecture spec `06-modular-architecture.md` (2026-05-04)
          → Stage 6 pre-reg §4 (commit e4f9e7a)
            → this module.
"""
from __future__ import annotations

from typing import NamedTuple, TYPE_CHECKING

if TYPE_CHECKING:
    # pandas import is type-only in Chunk A to keep the skeleton
    # importable without the runtime dependency. Chunk B imports
    # pandas eagerly when the math lands.
    import pandas as pd  # noqa: F401

    from shape_prototype_dispatch import ShapePrototype


# ---- Exceptions (binding API per §4.2) --------------------------------------


class ShapePrototypeMissingError(RuntimeError):
    """Raised when ``compute_shape_features`` is called for a recipe without a prototype.

    The orchestrator MUST check ``ShapePrototypeDispatch.has_prototype(recipe_id)``
    before calling the kernel and route to ingredient+length fallback when
    False. This exception is the kernel's defensive backstop.
    """


class SubstrateInsufficientError(RuntimeError):
    """Raised when the country's indicator panel cannot support the shape kernel.

    Triggered when either:
      (a) the country's available trajectory is shorter than the recipe's
          ``canonical_length_T_point`` (cannot align), OR
      (b) the country's panel fails the Tariq G1-G4 substrate gates for
          this `(country, recipe, year)` triple (per-query substrate check
          distinct from the per-recipe prototype-fit substrate audit in §4.3).

    Per §4.2 binding contract this routes to ingredient+length fallback at
    the head input layer (the head receives a sentinel "shape unavailable"
    marker rather than a triple).
    """


# ---- Output type (binding per §4.2) -----------------------------------------


class ShapeFeatureTriple(NamedTuple):
    """The deterministic shape-feature output per ``(country, recipe, year)``.

    All three outputs are **scalars** — not vectors, not posterior samples.
    Per §4.2 binding contract:

    - ``shape_similarity_scalar`` ∈ [0, 1]
        Mahalanobis-distance-derived posterior-mean similarity. 1 = perfect
        match against the prototype's posterior-mean trajectory. Computed
        from the posterior-mean prototype $\\bar{\\mu}_r = \\mathbb{E}_{\\pi_r}[\\mu_r]$;
        per-draw posterior samples are NOT propagated into the head as features.

    - ``shape_dtw_score`` ∈ [0, ∞)
        DTW (Dynamic Time Warping) distance between the country's z-scored
        trajectory and the prototype's posterior-mean trajectory. Lower =
        better alignment.

    - ``shape_phase_alignment`` ∈ [-1, 1]
        The cosine of the lag at which DTW achieves its minimum.
        Captures whether the country is "leading" or "lagging" the canonical
        movement.

    The §3↔§4 reconciliation contract (binding, verbatim from §4.2):

        "shape_similarity_scalar is computed from the posterior-mean
        prototype $\\bar{\\mu}_r = \\mathbb{E}_{\\pi_r}[\\mu_r]$ (per-draw
        posterior samples are NOT propagated into the head as features);
        uncertainty from prototype parameter variance ($\\Sigma_r$
        posterior + $\\bar{\\mu}_r$ posterior covariance) propagates
        downstream through the bootstrap-CI harness on head outputs per
        §4.6, which resamples training rows + (where prototype N is
        sufficient) prototype draws to produce 80% + 95% credible
        intervals on head probability outputs per R3. shape_dtw_score and
        shape_phase_alignment are likewise computed against the
        posterior-mean trajectory. The prototype carries the posterior
        uncertainty (§3); the kernel emits three scalars per (country,
        recipe, year); the head's CI captures the propagated uncertainty.
        This is the binding contract between §3 (Bayesian posterior shape
        object) and §4 (scalar kernel API) — no per-draw shape posteriors
        are ever exposed to the head's forward pass."

    This NamedTuple is intentionally not a frozen dataclass: pickling,
    JSON-serialization via ``._asdict()``, and tuple-unpacking are all
    first-class downstream consumer affordances (the bootstrap-CI harness
    in §4.6 unpacks the triple positionally; the prediction-JSON writer
    in §4.5 serializes via ``_asdict``).
    """

    shape_similarity_scalar: float
    shape_dtw_score: float
    shape_phase_alignment: float


# ---- Public API (binding per §4.2) ------------------------------------------


def compute_shape_features(
    country_id: str,
    recipe_id: str,
    year: int,
    shape_prototype: "ShapePrototype",
    indicator_panel: "pd.DataFrame",
) -> ShapeFeatureTriple:
    """Compute the deterministic shape-feature triple for one (country, recipe, year).

    **Determinism guarantee (binding per §4.2):** given identical inputs,
    this function MUST return bit-identical outputs across runs. No random
    state is consulted inside the function body once Chunk B lands the
    math (FPCA scoring + DTW + phase-cosine are all deterministic given
    the pinned prototype and z-scoring rule). The regression test at
    ``tests/test_shape_kernel_determinism.py`` asserts the kernel run
    twice on the same input yields identical bytes; that test is skipped
    in Chunk A and activates in Chunk B.

    **§3↔§4 reconciliation (binding contract).** The shape prototype
    carries the full Bayesian posterior (≥1000 samples per §3.1.1); this
    kernel emits three scalars computed against the posterior-mean
    prototype $\\bar{\\mu}_r$. Per-draw posterior samples are NEVER
    propagated into the head's forward pass as features. Uncertainty from
    the prototype's posterior parameter variance propagates downstream
    through the §4.6 bootstrap-CI harness on head outputs (R3-binding
    80% + 95% credible intervals on head probability outputs).

    **R3 (Bayesian-only downstream).** The scalar API is consistent with
    R3 because the head returns calibrated probabilities + credible
    intervals; the kernel is one upstream of the Bayesian boundary.
    Beta calibration on head outputs (§4.6) is the single calibration
    step; there is NO isotonic-on-the-kernel layer.

    **R4 (laptop-scale only).** No AWS calls. ``indicator_panel`` is the
    caller's responsibility to load from the cached parquet snapshot
    pinned in the shape prototype's ``training_data_snapshot_sha256``;
    callers MUST verify panel provenance before invoking this kernel.

    Args:
        country_id: ISO-3 country code (e.g., "VEN").
        recipe_id: Recipe ID from the LOCKED set
            (e.g., "mass_protest"). Must match the recipe ID embedded in
            ``shape_prototype``.
        year: Query year ($\\hat{t}$). The aligned trajectory window is
            ``[year - canonical_length_T_point, year - 1]`` per §3.2.1
            end-alignment ($t=0$ lock).
        shape_prototype: The pinned canonical shape prototype loaded via
            ``ShapePrototypeDispatch.prototype_for(recipe_id)``. Carries
            the FPCA posterior summary + canonical length + G1-G4 audit.
            Orchestrator MUST verify ``substrate_audit.all_pass`` before
            calling (kernel raises ``SubstrateInsufficientError`` if not).
        indicator_panel: pandas DataFrame containing the country's
            indicator-level data for the recipe's ``indicator_ids``,
            covering at minimum the alignment window. Long-format
            ``(country_id, year, indicator_id, value)`` is the expected
            shape; Chunk B fixes the exact column contract.

    Returns:
        ShapeFeatureTriple of three scalars per the binding §4.2 ranges.

    Raises:
        ShapePrototypeMissingError: if ``shape_prototype`` is None or its
            ``recipe_id`` does not match ``recipe_id`` arg.
        SubstrateInsufficientError: if the country's available panel is
            shorter than ``canonical_length_T_point`` OR fails per-query
            G1-G4 substrate gates for this ``(country, recipe, year)``.

    Notes:
        Implementation reference (non-binding, per §4.2):
          - ``shape_similarity_scalar``: Mahalanobis-distance-derived
            similarity in [0, 1].
          - ``shape_dtw_score``: DTW distance, country z-scored vs
            prototype posterior-mean.
          - ``shape_phase_alignment``: cosine of the DTW minimum lag.

        Chunk B implements per Stage 6 §3 (Priya's FPCA math) + §4.2
        (Ji-Hoon's API contract). The implementation MUST satisfy the
        determinism guarantee above and the §3↔§4 reconciliation
        contract; Chunk B's PR review (Sonnet, expert-strict-pragmatic-
        purist persona per `feedback_sonnet_reviewer_persona.md`)
        verifies both before merge.
    """
    raise NotImplementedError(
        "Chunk B: math implementation per Stage 6 §3 + §4.2. "
        "This is the Chunk A skeleton; the binding API contract above is "
        "final and will not be amended by Chunk B."
    )
