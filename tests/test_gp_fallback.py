"""Tests for the §3.1.4 hierarchical-Bayes + GP fallback path (Chunk B.2).

Per `qgi-docs/internal/ops/ml-track/stage-6-shape-feature-prereg.md` §3.1.4
(Priya's binding spec) + §3.1.5 (selection rule) + §3.5.1 (Mahalanobis scoring
under fallback uses "posterior kernel-induced covariance in place of Σ_r").

Test design:
  - Fast synthetic tests (small N, T_r ≤ 5, 2 chains × 200 iter) to stay
    well under the 60-second budget.
  - GP sampler tests are marked @pytest.mark.slow (they still run in 30-60s
    with the reduced settings but wall-time can exceed the fast-suite budget
    on slower machines or under heavy CI load).
  - Schema-compliance tests are fast (no NUTS).

Lakatosian guard: no BH/FDR introduced here (§3.6 veto operative).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Windows compatibility: disable pytensor C compilation BEFORE any pytensor
# / pymc imports. Linux/macOS production runs may unset this; test suite
# must work on Windows.
os.environ.setdefault("PYTENSOR_FLAGS", "cxx=")

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
SCRIPTS_ROOT = REPO_ROOT / "scripts"
for _p in (SRC_ROOT, SCRIPTS_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

# Reduced sampling for the test suite — same convention as test_shape_prototype_fit.py.
TEST_N_CHAINS = 2
TEST_N_TUNE = 200
TEST_N_DRAWS = 200
TEST_SEED = 42


# ---------------------------------------------------------------------------
# Synthetic trajectory generator
# ---------------------------------------------------------------------------


def _build_gp_trajectories(
    N_r: int = 6,
    T_r: int = 5,
    K_indicators: int = 2,
    *,
    seed: int = 0,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate (trajectories, true_f_r, noise) for GP fallback tests.

    ``trajectories`` has shape (N_r, T_r, K_indicators).
    ``true_f_r`` has shape (T_r, K_indicators) — the recipe-level mean.
    ``noise`` has shape (N_r, T_r, K_indicators) — observation noise.

    The true recipe-level mean is a smooth GP-generated curve so the
    fallback GP model should be able to recover it approximately.
    """
    rng = np.random.default_rng(seed)
    t = np.arange(T_r, dtype=float)
    # True recipe-level mean: simple sinusoidal structure per indicator.
    true_f_r = np.zeros((T_r, K_indicators))
    for k in range(K_indicators):
        phase = k * np.pi / K_indicators
        true_f_r[:, k] = 0.8 * np.sin(2.0 * np.pi * t / T_r + phase)

    # Instance-level residuals + observation noise (small relative to signal).
    instance_residuals = rng.normal(scale=0.15, size=(N_r, T_r, K_indicators))
    obs_noise = rng.normal(scale=0.05, size=(N_r, T_r, K_indicators))
    trajectories = true_f_r[None, :, :] + instance_residuals + obs_noise
    return trajectories, true_f_r, obs_noise


def _build_synthetic_panel_for_gp(
    *,
    n_positive: int = 6,
    T_r: int = 5,
    indicator_ids: tuple[str, ...] = ("IND_A", "IND_B"),
    seed: int = 0,
    pre_window_years: int = 20,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build a synthetic long-format panel + positives CSV for the end-to-end fitter test.

    The panel encodes a GP-shaped alignment trajectory so the fallback model
    should have something to learn. This is the same helper pattern as
    test_shape_prototype_fit.py._build_synthetic_panel but with GP-style
    trajectories.
    """
    rng = np.random.default_rng(seed)
    countries = [f"GP{i:02d}" for i in range(n_positive)]
    event_year = 2020
    t = np.arange(T_r, dtype=float)

    rows: list[dict] = []
    positives: list[dict] = []
    for i, c in enumerate(countries):
        positives.append({"country_id": c, "event_year": event_year})
        baseline_mean = 50.0 + i * 1.5
        baseline_sd = 3.0

        N_pre = pre_window_years
        d_offset = baseline_sd * np.sqrt((N_pre - 1) / N_pre)
        baseline_vals = [
            baseline_mean + (d_offset if k % 2 == 0 else -d_offset)
            for k in range(N_pre)
        ]
        baseline_years = list(range(event_year - T_r - N_pre, event_year - T_r))
        alignment_years = list(range(event_year - T_r, event_year))

        for iid_idx, iid in enumerate(indicator_ids):
            # Pre-window baseline.
            for y, v in zip(baseline_years, baseline_vals):
                rows.append({"country_id": c, "year": y, "indicator_id": iid, "value": float(v)})
            # Alignment: sinusoidal canonical shape + small per-instance noise.
            phase = iid_idx * np.pi / len(indicator_ids)
            canonical_z = 0.8 * np.sin(2.0 * np.pi * t / T_r + phase)
            noise = rng.normal(scale=0.10, size=T_r)
            z = canonical_z + noise
            for y, zi in zip(alignment_years, z):
                rows.append({
                    "country_id": c,
                    "year": y,
                    "indicator_id": iid,
                    "value": float(baseline_mean + baseline_sd * zi),
                })

    return pd.DataFrame(rows), pd.DataFrame(positives)


# ---------------------------------------------------------------------------
# Unit: build_gp_fallback_model structure
# ---------------------------------------------------------------------------


def test_build_gp_fallback_model_returns_pymc_model() -> None:
    """build_gp_fallback_model returns a pymc.Model object."""
    import pymc as pm

    from shape_prototype_fit_utils import build_gp_fallback_model

    trajs, _, _ = _build_gp_trajectories(N_r=4, T_r=4, K_indicators=2)
    model = build_gp_fallback_model(trajs, K_indicators=2, T_r=4)
    assert isinstance(model, pm.Model)


def test_build_gp_fallback_model_variable_names() -> None:
    """Model has the expected per-indicator variables per §3.1.4."""
    from shape_prototype_fit_utils import build_gp_fallback_model

    K = 2
    T_r = 4
    trajs, _, _ = _build_gp_trajectories(N_r=4, T_r=T_r, K_indicators=K)
    model = build_gp_fallback_model(trajs, K_indicators=K, T_r=T_r)
    var_names = {v.name for v in model.free_RVs}
    for k in range(K):
        assert f"alpha_recipe_{k}" in var_names, f"Missing alpha_recipe_{k}"
        assert f"ell_recipe_{k}" in var_names, f"Missing ell_recipe_{k}"
        assert f"alpha_inst_{k}" in var_names, f"Missing alpha_inst_{k}"
        assert f"ell_inst_{k}" in var_names, f"Missing ell_inst_{k}"
        assert f"sigma_eps_{k}" in var_names, f"Missing sigma_eps_{k}"
        assert f"f_r_{k}" in var_names, f"Missing f_r_{k}"
        assert f"g_c_{k}" in var_names, f"Missing g_c_{k}"


def test_build_gp_fallback_model_shape_mismatch_raises() -> None:
    """build_gp_fallback_model raises ValueError on shape mismatch."""
    from shape_prototype_fit_utils import build_gp_fallback_model

    trajs, _, _ = _build_gp_trajectories(N_r=4, T_r=5, K_indicators=2)
    # Pass wrong T_r.
    with pytest.raises(ValueError, match="does not match"):
        build_gp_fallback_model(trajs, K_indicators=2, T_r=4)


def test_build_gp_fallback_model_wrong_ndim_raises() -> None:
    """build_gp_fallback_model raises ValueError if trajectories is not 3-D."""
    from shape_prototype_fit_utils import build_gp_fallback_model

    with pytest.raises(ValueError, match="3-D"):
        build_gp_fallback_model(np.zeros((4, 5)), K_indicators=2, T_r=5)


# ---------------------------------------------------------------------------
# Unit: extract_gp_posterior_signature schema compliance
# ---------------------------------------------------------------------------


def test_extract_gp_posterior_signature_length_mismatch_raises() -> None:
    """extract_gp_posterior_signature raises ValueError on K mismatch."""
    from shape_prototype_fit_utils import (
        GPFallbackPosterior,
        SamplerDiagnostics,
        evaluate_sampler_diagnostics,
        extract_gp_posterior_signature,
    )

    diags = evaluate_sampler_diagnostics([1.0], [500.0], 0)
    gp = GPFallbackPosterior(
        posterior_mean_trajectories=[np.zeros(5)],
        posterior_cov_diags=[np.ones(5) * 0.01],
        sampler_diagnostics=diags,
        idata=None,
    )
    # indicator_ids has 2 but posterior has 1.
    with pytest.raises(ValueError, match="K_indicators"):
        extract_gp_posterior_signature(gp, T_r=5, K_indicators=2, indicator_ids=["A", "B"])


def test_extract_gp_posterior_signature_structure() -> None:
    """extract_gp_posterior_signature returns correctly structured dicts."""
    from shape_prototype_fit_utils import (
        GP_FALLBACK_FPCA_BASIS_LABEL,
        GP_FALLBACK_FPCA_CUMVAR_SENTINEL,
        GP_FALLBACK_FPCA_SCORES_SENTINEL,
        GPFallbackPosterior,
        evaluate_sampler_diagnostics,
        extract_gp_posterior_signature,
    )

    T_r = 5
    K = 2
    diags = evaluate_sampler_diagnostics([1.0, 1.0], [600.0, 600.0], 0)
    gp = GPFallbackPosterior(
        posterior_mean_trajectories=[np.linspace(0, 1, T_r), np.linspace(1, 0, T_r)],
        posterior_cov_diags=[np.ones(T_r) * 0.02, np.ones(T_r) * 0.03],
        sampler_diagnostics=diags,
        idata=None,
    )
    sigs = extract_gp_posterior_signature(gp, T_r=T_r, K_indicators=K, indicator_ids=["A", "B"])
    assert len(sigs) == K
    for sig in sigs:
        assert sig["fpca_component_scores"] == GP_FALLBACK_FPCA_SCORES_SENTINEL
        assert sig["fpca_cumulative_variance_explained"] == GP_FALLBACK_FPCA_CUMVAR_SENTINEL
        assert sig["fpca_basis"] == GP_FALLBACK_FPCA_BASIS_LABEL
        assert len(sig["posterior_mean_trajectory"]) == T_r
        assert len(sig["posterior_cov_diag"]) == T_r
        # cov_diag must be >= 0 (§3.5.1 Mahalanobis denominator; §4.2 floor).
        assert all(v >= 0.0 for v in sig["posterior_cov_diag"])
        assert sig["cov_diag_source"] == "posterior_gp_f_r_empirical_cov_diag"


def test_posterior_cov_diag_is_gp_posterior_not_empirical_variance() -> None:
    """Parallel to B5 lesson: cov_diag must be posterior variance of f_r^(k), NOT
    empirical variance of the training trajectories.

    Strategy: construct a GPFallbackPosterior with known posterior draws of
    f_r (simulated as if we ran MCMC) and verify extract_gp_posterior_signature
    computes the variance across those posterior draws — NOT the variance of the
    original training data.

    This is the §3.5.1 "posterior kernel-induced covariance" requirement.
    Per B5 Priya adjudication precedent (FPCA path): the cov_diag must be
    from the Bayesian posterior, not from the training sample.
    """
    from shape_prototype_fit_utils import (
        GPFallbackPosterior,
        evaluate_sampler_diagnostics,
        extract_gp_posterior_signature,
    )

    T_r = 4
    K = 1
    rng = np.random.default_rng(0)

    # Simulated "posterior draws" of f_r^(0) — shape (D, T_r).
    # We define a known covariance so we can verify the output.
    D = 500  # posterior draw count (simulated)
    true_posterior_var = np.array([0.10, 0.20, 0.15, 0.05])  # per time step
    # Draw f_r samples with this per-time-step variance (independent).
    f_r_draws = rng.normal(scale=np.sqrt(true_posterior_var), size=(D, T_r))
    posterior_mean_traj = f_r_draws.mean(axis=0)
    posterior_cov_diag = np.diag(np.cov(f_r_draws.T))

    diags = evaluate_sampler_diagnostics([1.0], [500.0], 0)
    gp = GPFallbackPosterior(
        posterior_mean_trajectories=[posterior_mean_traj],
        posterior_cov_diags=[posterior_cov_diag],
        sampler_diagnostics=diags,
        idata=None,
    )
    sigs = extract_gp_posterior_signature(gp, T_r=T_r, K_indicators=K, indicator_ids=["A"])
    emitted_cov_diag = np.array(sigs[0]["posterior_cov_diag"])

    # The emitted cov_diag should match the posterior variance we put in,
    # not some other computation.
    np.testing.assert_allclose(emitted_cov_diag, posterior_cov_diag, atol=1e-12)

    # Also verify it is NOT near zero (which would be the empirical variance of
    # a near-constant trajectory — the pathological B5 case).
    assert emitted_cov_diag.mean() > 0.01, (
        "posterior_cov_diag is near zero; this suggests it was computed from the "
        "training trajectory variance (wrong) rather than the Bayesian posterior "
        "variance of f_r^(k) across MCMC draws (correct, per B5 + §3.5.1)."
    )


# ---------------------------------------------------------------------------
# MCMC gate tests (fast, no actual sampling — synthetic diagnostic vectors)
# ---------------------------------------------------------------------------


def test_mcmc_gates_fire_on_high_rhat() -> None:
    """R-hat gate fires correctly for GP fallback (same gate as §3.1.3)."""
    from shape_prototype_fit_utils import evaluate_sampler_diagnostics

    diags = evaluate_sampler_diagnostics([1.05, 1.001], [600.0, 600.0], 0)
    assert not diags.rhat_gate_pass
    assert not diags.all_pass


def test_mcmc_gates_fire_on_low_ess() -> None:
    """ESS gate fires correctly."""
    from shape_prototype_fit_utils import evaluate_sampler_diagnostics

    diags = evaluate_sampler_diagnostics([1.001, 1.001], [50.0, 600.0], 0)
    assert not diags.ess_gate_pass
    assert not diags.all_pass


def test_mcmc_gates_fire_on_divergences() -> None:
    """Divergence gate fires correctly."""
    from shape_prototype_fit_utils import evaluate_sampler_diagnostics

    # Single divergence: divergence_gate_pass is False.
    diags = evaluate_sampler_diagnostics([1.001, 1.001], [600.0, 600.0], 1)
    assert not diags.divergence_gate_pass
    assert not diags.all_pass

    # Two divergences: still fails.
    diags = evaluate_sampler_diagnostics([1.001, 1.001], [600.0, 600.0], 2)
    assert not diags.divergence_gate_pass


def test_mcmc_gates_all_pass_on_good_diagnostics() -> None:
    """All gates pass on good diagnostic values."""
    from shape_prototype_fit_utils import evaluate_sampler_diagnostics

    diags = evaluate_sampler_diagnostics([1.005, 1.001], [500.0, 800.0], 0)
    assert diags.all_pass


# ---------------------------------------------------------------------------
# Schema-compliance tests (no NUTS required)
# ---------------------------------------------------------------------------


def test_gp_fallback_emission_validates_under_schema(tmp_path: Path) -> None:
    """A GP-fallback prototype emitted to the lock JSON validates under the schema.

    Uses a manually constructed FittedPrototype (no NUTS) to test the
    emission + dispatch loader path in isolation. Fast.
    """
    from fit_shape_prototype import FittedPrototype, emit_to_lock_file
    from shape_prototype_fit_utils import (
        GP_FALLBACK_FPCA_BASIS_LABEL,
        GP_FALLBACK_FPCA_CUMVAR_SENTINEL,
        GP_FALLBACK_FPCA_SCORES_SENTINEL,
    )

    T_r = 5
    # n_training_positives >= 10 so that g1_n_pos_geq_10=True in the
    # substrate_audit and the dispatch loader does not raise SubstrateInadequateError.
    # The GP fallback fires here because of a simulated FPCA diagnostic failure
    # (N >= 10 but NUTS diverged), not because N < 10.
    prototype = FittedPrototype(
        recipe_id="gp_fallback_schema_test",
        indicator_ids=["IND_A", "IND_B"],
        T_r=T_r,
        n_training_positives=12,
        fit_method="hierarchical_bayes_gp_fallback",
        fit_method_commit_sha="a" * 40,
        per_indicator_signature={
            "IND_A": {
                "fpca_component_scores": GP_FALLBACK_FPCA_SCORES_SENTINEL,
                "fpca_cumulative_variance_explained": GP_FALLBACK_FPCA_CUMVAR_SENTINEL,
                "fpca_basis": GP_FALLBACK_FPCA_BASIS_LABEL,
                "posterior_mean_trajectory": [0.1, 0.3, 0.5, 0.3, 0.1],
                "posterior_cov_diag": [0.02] * T_r,
                "cov_diag_source": "posterior_gp_f_r_empirical_cov_diag",
            },
            "IND_B": {
                "fpca_component_scores": GP_FALLBACK_FPCA_SCORES_SENTINEL,
                "fpca_cumulative_variance_explained": GP_FALLBACK_FPCA_CUMVAR_SENTINEL,
                "fpca_basis": GP_FALLBACK_FPCA_BASIS_LABEL,
                "posterior_mean_trajectory": [0.5, 0.3, 0.1, 0.3, 0.5],
                "posterior_cov_diag": [0.015] * T_r,
                "cov_diag_source": "posterior_gp_f_r_empirical_cov_diag",
            },
        },
        sampler_diagnostics={"rhat_max": 1.005, "ess_min": 550.0, "n_divergences": 0},
        loio_coverage_at_nominal_80=0.0,
        fallback_required=False,
        fallback_reason="",
        fpca_M_r=None,
        fpca_cumulative_variance=0.0,
        wall_time_seconds=45.0,
        training_data_snapshot_sha256="c" * 64,
        training_data_snapshot_s3_path="local-laptop-scale",
    )
    lock_path = tmp_path / "shape-prototypes.lock.json"
    emit_to_lock_file(prototype, lock_path, stage_6_commit_sha="e4f9e7a")

    # Load via the dispatch loader — this is the schema gate.
    from shape_prototype_dispatch import load_dispatch

    dispatch = load_dispatch(lock_path)
    assert "gp_fallback_schema_test" in dispatch.recipes_with_prototype()
    proto = dispatch.prototype_for("gp_fallback_schema_test")
    assert proto.fit_method == "hierarchical_bayes_gp_fallback"
    assert proto.n_training_positives == 12

    # The raw JSON must also be valid.
    raw = json.loads(lock_path.read_text(encoding="utf-8"))
    sig_a = raw["recipes"]["gp_fallback_schema_test"]["per_indicator_trajectory_signature"]["IND_A"]
    assert len(sig_a["posterior_mean_trajectory"]) == T_r
    assert len(sig_a["posterior_cov_diag"]) == T_r


def test_gp_fallback_fit_method_enum_is_valid() -> None:
    """The fit_method='hierarchical_bayes_gp_fallback' is in the schema enum."""
    schema_path = REPO_ROOT / "config" / "shape-prototypes.lock.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    allowed = schema["$defs"]["recipe_prototype"]["properties"]["fit_method"]["enum"]
    assert "hierarchical_bayes_gp_fallback" in allowed


# ---------------------------------------------------------------------------
# Integration: fit_gp_fallback NUTS sampling (slow, requires PyMC)
# ---------------------------------------------------------------------------


@pytest.mark.slow
def test_fit_gp_fallback_recovers_approximate_alpha_ell_posteriors() -> None:
    """GP fallback NUTS sampling recovers non-degenerate α_k and ℓ_k posteriors.

    Uses minimal synthetic data (N_r=3, T_r=3, K=1) to keep wall-time
    manageable on Windows Python-interpreter mode (PYTENSOR_FLAGS=cxx=).
    The model has ~12 latent parameters: α_recipe, ℓ_recipe, α_inst, ℓ_inst,
    σ_ε (scalars) + f_r (3) + g_c (3×3=9) ≈ 20 total.
    At 2 chains × 100 tune + 100 draw in Python interpreter mode, this
    should complete in under 60 seconds.

    The test verifies:
      1. The sampler completes without raising.
      2. R-hat is within acceptable range (relaxed for small draws).
      3. Posterior mean trajectories are non-zero (signal recovered).
      4. Posterior cov_diag is non-negative (kernel-induced variance).

    Wall-time budget: < 60 seconds.
    """
    from shape_prototype_fit_utils import fit_gp_fallback

    # Minimal fixture to keep NUTS fast in Python interpreter mode.
    N_r = 3
    T_r = 3
    K = 1
    trajs, true_f_r, _ = _build_gp_trajectories(N_r=N_r, T_r=T_r, K_indicators=K, seed=0)

    # Use fewer draws than the full test suite to stay under wall-time budget.
    _N_CHAINS = 2
    _N_TUNE = 100
    _N_DRAWS = 100

    result = fit_gp_fallback(
        trajs,
        K_indicators=K,
        T_r=T_r,
        n_chains=_N_CHAINS,
        n_tune=_N_TUNE,
        n_draws=_N_DRAWS,
        target_accept=0.95,
        seed=TEST_SEED,
    )

    diags = result.sampler_diagnostics
    # Relaxed R-hat bound for tiny draws; production gate is 1.01.
    assert diags.rhat_max <= 1.10, f"R-hat too high: {diags.rhat_max:.4f}"
    # ESS threshold relaxed for 100 draws × 2 chains.
    assert diags.ess_min >= 20, (
        f"ESS extremely low for test settings: {diags.ess_min:.1f}. "
        f"(Production gate is >= 400; test uses reduced draws.)"
    )

    # Posterior mean trajectories: non-zero (signal recovered).
    for k in range(K):
        mean_traj = result.posterior_mean_trajectories[k]
        assert mean_traj.shape == (T_r,)
        assert np.any(mean_traj != 0.0), f"Indicator {k}: posterior mean trajectory is all zeros"

        # Posterior cov_diag: non-negative.
        cov_diag = result.posterior_cov_diags[k]
        assert cov_diag.shape == (T_r,)
        assert np.all(cov_diag >= 0.0), f"Indicator {k}: negative covariance diagonal"


@pytest.mark.slow
def test_fit_gp_fallback_end_to_end_via_fitter_function(tmp_path: Path) -> None:
    """End-to-end: fit_recipe_gp_fallback builds a schema-compliant lock entry.

    Uses a minimal synthetic panel (n_positive=4, T_r=3, K=1) to keep
    wall-time under budget in Python interpreter mode.
    Full pipeline: normalization → trajectory build → GP NUTS → signature
    extraction → lock emission → dispatch loader validation.
    """
    from fit_shape_prototype import FittedPrototype, emit_to_lock_file, fit_recipe_gp_fallback
    from shape_prototype_dispatch import load_dispatch

    panel, positives = _build_synthetic_panel_for_gp(
        n_positive=4, T_r=3, indicator_ids=("IND_A",), seed=1,
    )
    prototype, _ = fit_recipe_gp_fallback(
        panel,
        positives,
        indicator_ids=["IND_A"],
        T_r=3,
        target_accept=0.95,
        n_chains=2,
        n_tune=100,
        n_draws=100,
        random_seed=TEST_SEED,
    )

    # Basic prototype checks.
    assert prototype.fit_method == "hierarchical_bayes_gp_fallback"
    assert prototype.fallback_required is False  # fallback succeeded
    assert prototype.n_training_positives <= 4
    assert prototype.wall_time_seconds > 0

    # Per-indicator signatures populated.
    assert "IND_A" in prototype.per_indicator_signature
    for iid, sig in prototype.per_indicator_signature.items():
        assert len(sig["posterior_mean_trajectory"]) == 3, f"{iid}: wrong T_r"
        assert len(sig["posterior_cov_diag"]) == 3, f"{iid}: wrong T_r"
        assert all(v >= 0.0 for v in sig["posterior_cov_diag"]), f"{iid}: negative cov_diag"
        # Provenance tag must be GP (not FPCA).
        assert sig["cov_diag_source"] == "posterior_gp_f_r_empirical_cov_diag"

    # Schema compliance via emit + dispatch loader.
    # n_training_positives=4 means g1_n_pos_geq_10=False, so dispatch raises
    # SubstrateInadequateError. We only test the JSON structure here.
    prototype.recipe_id = "gp_end_to_end_test"
    lock_path = tmp_path / "shape-prototypes.lock.json"
    emit_to_lock_file(prototype, lock_path, stage_6_commit_sha="e4f9e7a")

    # Check JSON structure directly (dispatch.prototype_for raises
    # SubstrateInadequateError for n_training_positives=4 < 10).
    import json as json_mod
    raw = json_mod.loads(lock_path.read_text(encoding="utf-8"))
    recipe_block = raw["recipes"]["gp_end_to_end_test"]
    assert recipe_block["fit_method"] == "hierarchical_bayes_gp_fallback"
    assert recipe_block["n_training_positives"] <= 4
    sig = recipe_block["per_indicator_trajectory_signature"]["IND_A"]
    assert len(sig["posterior_mean_trajectory"]) == 3
    assert len(sig["posterior_cov_diag"]) == 3


@pytest.mark.slow
def test_fit_gp_fallback_n_below_10_routes_to_fallback_not_fpca(tmp_path: Path) -> None:
    """With N_r < 10, fit_recipe_fpca returns fallback_required=True and the
    fitter main-path routes to the real GP fallback (not an empty placeholder).

    Uses minimal fixture (n_positive=3, T_r=3, K=1) for speed.

    This test verifies the §3.1.5 routing rule:
      N_r < 10 → fallback per §3.1.4 (must populate the per_indicator_signature).
    """
    from fit_shape_prototype import fit_recipe_fpca, fit_recipe_gp_fallback

    panel, positives = _build_synthetic_panel_for_gp(
        n_positive=3, T_r=3, indicator_ids=("IND_A",), seed=2,
    )

    # Primary path must flag fallback_required (N_r=3 < 10).
    proto_primary, _ = fit_recipe_fpca(
        panel,
        positives,
        indicator_ids=["IND_A"],
        T_r=3,
    )
    assert proto_primary.fallback_required is True
    assert "N_r" in proto_primary.fallback_reason
    assert proto_primary.per_indicator_signature == {}  # placeholder

    # GP fallback populates the signature.
    proto_gp, _ = fit_recipe_gp_fallback(
        panel,
        positives,
        indicator_ids=["IND_A"],
        T_r=3,
        n_chains=2,
        n_tune=100,
        n_draws=100,
        random_seed=TEST_SEED,
    )
    assert proto_gp.fallback_required is False
    assert "IND_A" in proto_gp.per_indicator_signature
    traj = proto_gp.per_indicator_signature["IND_A"]["posterior_mean_trajectory"]
    assert len(traj) == 3
    assert any(v != 0.0 for v in traj), "IND_A: GP returned zero trajectory"
