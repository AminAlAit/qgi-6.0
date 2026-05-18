"""Helper functions for the shape-prototype fitter (Stage 6 §3 binding math).

Per `qgi-docs/internal/ops/ml-track/stage-6-shape-feature-prereg.md` §3
(Priya, the math primitive). This module holds pure functions —
basis construction, indicator-level normalization, FPCA in the Sobolev
metric, M_r selection, and diagnostic gates — that are independently
unit-testable. The end-to-end fitter is in `scripts/fit_shape_prototype.py`
and composes these primitives.

All functions are deterministic (no random state). The only stochastic
piece of the pipeline is the PyMC NUTS sampler inside the fitter, which is
seeded explicitly per recipe at fit time.

Authority lineage:
    North Star (2026-05-17)
      -> DECISION (2026-05-17, R3 + R4 binding)
        -> Stage 6 §3 (Priya, Bayesian FPCA + hierarchical Bayes)
          -> this module.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final

import numpy as np
from numpy.polynomial.legendre import leggauss
from scipy.interpolate import BSpline
from scipy.linalg import eigh


# Per §3.1.2 binding: cubic B-spline with K_basis = 8 interior knots.
K_BASIS_INTERIOR_KNOTS: Final[int] = 8
SPLINE_DEGREE: Final[int] = 3  # cubic

# Per §3.1.2 binding: M_r in {3, 4} with floor 3 and ceiling 4.
M_R_FLOOR: Final[int] = 3
M_R_CEILING: Final[int] = 4
M_R_VARIANCE_TARGET: Final[float] = 0.80

# Per §3.1.5: scree elbow operationalization — ratio of (M_r+1)-th to M_r-th
# eigenvalue <= 0.4 signals an elbow.
SCREE_ELBOW_RATIO: Final[float] = 0.4

# Per §3.1.3 sampler diagnostic gates.
RHAT_GATE: Final[float] = 1.01
ESS_GATE: Final[int] = 400
TARGET_ACCEPT_DEFAULT: Final[float] = 0.95
TARGET_ACCEPT_REFIT: Final[float] = 0.99
MAX_TREEDEPTH: Final[int] = 12

# Per §3.5.4 LOIO calibration gate.
LOIO_COVERAGE_GATE: Final[float] = 0.70
LOIO_NOMINAL_LEVEL: Final[float] = 0.80


# ---- Basis construction (§3.1.2) --------------------------------------------


def build_cubic_bspline_basis(
    T_r: int,
    *,
    n_interior_knots: int = K_BASIS_INTERIOR_KNOTS,
) -> tuple[np.ndarray, np.ndarray]:
    """Construct a cubic B-spline basis matrix and Sobolev penalty matrix.

    Per §3.1.2 binding (Ramsay & Silverman ch. 8): K_basis = 8 interior knots
    on [-T_r, 0]. This implementation uses **equispaced (uniform-fraction)
    knot placement**, which equals data-quantile placement only on the
    integer grid ``t in {-T_r, ..., -1}`` (the production trajectory grid;
    on that grid uniform-fraction == empirical-quantile by construction).
    If irregular sampling is ever introduced (e.g. monthly or event-time
    grids), this implementation MUST be revisited and the quantile route
    re-derived. An assertion at function entry pins the integer-grid
    invariant.

    The Sobolev penalty matrix R is computed as the **analytic integral**
    per Priya's adjudication of Sonnet B2 (2026-05-17):
    ``R_{ij} = ∫ φ_i''(t) φ_j''(t) dt`` over [-T_r, 0] via
    ``scipy.interpolate.BSpline.derivative(2)`` plus 8-point Gauss-Legendre
    quadrature on each knot subinterval. This matches the canonical
    Ramsay & Silverman §5.5 definition by direct citation; the prior
    finite-difference proxy diverged from the analytic integral at the
    production scale (T_r ∈ [4, 8]).

    Args:
        T_r: Canonical length (number of integer year offsets in the
            trajectory window, t in {-T_r, ..., -1}). MUST be an integer >= 4.
        n_interior_knots: Per spec, 8. Exposed for testability but spec-binding.

    Returns:
        (Phi, R) where:
          Phi: (T_r, n_interior_knots) evaluated basis matrix. Row i is
            phi_1..phi_K evaluated at t = -T_r + i.
          R: (n_interior_knots, n_interior_knots) Sobolev penalty matrix
            (analytic integral of second-derivative outer products via
            Gauss-Legendre quadrature); the metric used in FPCA's Sobolev
            inner product.

    Raises:
        ValueError: if T_r < 4 (basis cannot interpolate fewer than 4 points
            with a cubic spline + 8 interior knots while remaining stable).
        AssertionError: if T_r is not an integer (uniform-fraction knots
            equal quantile knots only on the integer grid; non-integer T_r
            invalidates the binding equivalence and must trigger a spec
            revisit).
    """
    # Per B1 (Sonnet review 2026-05-17): pin the integer-grid invariant.
    # Uniform-fraction knot placement equals empirical-quantile placement
    # iff the sampling grid is integer-spaced; production trajectories use
    # ``t in {-T_r, ..., -1}`` with unit step. Any deviation invalidates
    # the docstring's binding equivalence.
    assert isinstance(T_r, (int, np.integer)) and not isinstance(T_r, bool), (
        f"T_r must be an integer (uniform-fraction == quantile knots only on "
        f"the integer grid); got type {type(T_r).__name__}={T_r!r}."
    )
    if T_r < 4:
        raise ValueError(
            f"T_r={T_r} is too short for cubic spline basis; minimum is 4. "
            f"Per Stage 6 §3.2 this should fall to the §3.1.4 hierarchical "
            f"Bayes + GP fallback path."
        )
    if n_interior_knots < 4:
        raise ValueError(
            f"n_interior_knots={n_interior_knots} below spec minimum 4"
        )

    # Evaluation grid: integer year offsets in [-T_r, -1].
    t_grid = np.arange(-T_r, 0, dtype=float)  # length T_r

    # Equispaced (uniform-fraction) interior knots on (-T_r, 0). Use linspace
    # on fractions 1/(K+1), ..., K/(K+1) for evenly-spaced positions,
    # deterministic across calls. On the integer grid t in {-T_r, ..., -1}
    # this coincides with empirical-quantile knot placement; see docstring
    # B1 note on irregular-grid divergence.
    quantile_positions = np.linspace(
        1.0 / (n_interior_knots + 1),
        n_interior_knots / (n_interior_knots + 1),
        n_interior_knots,
    )
    interior_knots = -T_r + quantile_positions * T_r  # in (-T_r, 0)

    # Augmented knot vector for cubic B-spline: replicate boundary knots
    # SPLINE_DEGREE+1 times to clamp endpoints.
    boundary_lo = np.full(SPLINE_DEGREE + 1, -T_r, dtype=float)
    boundary_hi = np.full(SPLINE_DEGREE + 1, -1e-9, dtype=float)
    # Use -1e-9 (not 0.0) so that the right-endpoint sample at t=-1 is
    # strictly inside the support [-T_r, 0); BSpline is right-open by default.
    full_knots = np.concatenate([boundary_lo, interior_knots, boundary_hi])

    # The cubic B-spline has n_interior_knots basis functions when the knot
    # vector has length n_interior_knots + 2*(SPLINE_DEGREE+1). With clamped
    # boundaries plus interior knots, the count of B-spline basis functions is
    # len(full_knots) - SPLINE_DEGREE - 1.
    n_basis = len(full_knots) - SPLINE_DEGREE - 1

    # Build identity-coefficient basis functions and evaluate at t_grid.
    Phi = np.zeros((T_r, n_basis), dtype=float)
    for j in range(n_basis):
        coeffs = np.zeros(n_basis, dtype=float)
        coeffs[j] = 1.0
        spline = BSpline(full_knots, coeffs, SPLINE_DEGREE, extrapolate=False)
        Phi[:, j] = spline(t_grid)

    # Replace NaN (out-of-support) with 0 (occurs only at the open right
    # boundary). Then truncate Phi to exactly n_interior_knots basis columns
    # via the central (highest-mass) columns to honor the spec's K_basis = 8.
    Phi = np.nan_to_num(Phi, nan=0.0)

    # Reduce to the central n_interior_knots columns. The clamped cubic
    # B-spline with K interior knots produces K + SPLINE_DEGREE + 1 basis
    # functions; we keep the "interior" central K of those by dropping the
    # outermost (SPLINE_DEGREE+1)//2 on each side. This gives a stable
    # K-column basis that integrates well on the bounded support.
    drop_per_side = (n_basis - n_interior_knots) // 2
    if n_basis > n_interior_knots:
        Phi = Phi[:, drop_per_side : drop_per_side + n_interior_knots]

    # Renormalize each basis column to unit L2-norm on the discrete grid,
    # for numerical conditioning. This is a standard FPCA preprocessing
    # step and does not change the span of the basis.
    col_norms = np.linalg.norm(Phi, axis=0)
    col_norms = np.where(col_norms < 1e-12, 1.0, col_norms)
    Phi = Phi / col_norms[np.newaxis, :]

    # Penalty matrix R: analytic integral R_{ij} = ∫ φ_i''(t) φ_j''(t) dt
    # over [-T_r, 0] per §3.1.2 binding (Ramsay & Silverman §5.5, ch. 8).
    # Implemented via scipy.interpolate.BSpline.derivative(2) plus 8-point
    # Gauss-Legendre quadrature on each knot subinterval. This is exact for
    # polynomials up to degree 15; cubic-spline second derivatives are
    # piecewise linear, so 2-point would suffice — 8-point is for robustness
    # at corner cases. Per Priya's B2 adjudication (2026-05-17): this
    # replaces the prior finite-difference proxy that diverged from the
    # cited R&S canonical definition at production scale.
    R = np.zeros((Phi.shape[1], Phi.shape[1]), dtype=float)
    # Build the n_basis_full second-derivative B-splines once.
    second_derivs: list[BSpline] = []
    n_basis_full = len(full_knots) - SPLINE_DEGREE - 1
    for j in range(n_basis_full):
        coeffs = np.zeros(n_basis_full, dtype=float)
        coeffs[j] = 1.0
        spl = BSpline(full_knots, coeffs, SPLINE_DEGREE, extrapolate=False)
        second_derivs.append(spl.derivative(2))
    # Apply same central-trim as Phi for index consistency.
    if n_basis_full > n_interior_knots:
        second_derivs = second_derivs[drop_per_side : drop_per_side + n_interior_knots]
    # Account for the L2-renormalization applied to Phi: the basis functions
    # φ_j used in the analytic integral are the SAME functions whose discrete
    # evaluations were L2-normalized in Phi. To keep R consistent with that
    # scaling, divide each second-derivative spline output by the same col_norm.
    inv_col_norms = 1.0 / col_norms  # broadcast factor per basis column

    # Gauss-Legendre 8-point quadrature per knot subinterval.
    gl_nodes, gl_weights = leggauss(8)
    # Unique sorted break points inside [-T_r, 0).
    break_points = np.unique(full_knots)
    break_points = break_points[(break_points >= -T_r) & (break_points < 0)]
    if break_points.size == 0 or break_points[0] > -T_r:
        break_points = np.concatenate([[-T_r], break_points])
    if break_points[-1] < -1e-9:
        break_points = np.concatenate([break_points, [-1e-9]])

    for k_seg in range(len(break_points) - 1):
        a, b = float(break_points[k_seg]), float(break_points[k_seg + 1])
        if b - a <= 0.0:
            continue
        half = 0.5 * (b - a)
        mid = 0.5 * (b + a)
        pts = mid + half * gl_nodes  # mapped quadrature nodes
        wts = half * gl_weights
        # Evaluate all kept second-derivative basis functions at pts and
        # apply the same L2 renormalization Phi used.
        D2_vals = np.zeros((len(pts), len(second_derivs)), dtype=float)
        for j, spl_dd in enumerate(second_derivs):
            D2_vals[:, j] = np.nan_to_num(spl_dd(pts), nan=0.0)
        D2_vals = D2_vals * inv_col_norms[np.newaxis, :]
        # Accumulate the outer-product integral.
        R += (D2_vals * wts[:, np.newaxis]).T @ D2_vals

    # Symmetrize + add tiny ridge for positive-definiteness in the eigendecomp
    # used by FPCA.
    R = 0.5 * (R + R.T) + 1e-8 * np.eye(R.shape[0])

    return Phi, R


def project_to_basis_coefficients(
    trajectory: np.ndarray,
    Phi: np.ndarray,
) -> np.ndarray:
    """Least-squares projection of a trajectory onto the spline basis.

    Args:
        trajectory: (T_r,) array of evaluated function values (must match
            Phi's row count).
        Phi: (T_r, K_basis) evaluated basis matrix from build_cubic_bspline_basis.

    Returns:
        beta: (K_basis,) basis-coefficient vector.

    Raises:
        ValueError: if trajectory and Phi rows disagree.
    """
    trajectory = np.asarray(trajectory, dtype=float)
    if trajectory.shape[0] != Phi.shape[0]:
        raise ValueError(
            f"trajectory length {trajectory.shape[0]} does not match basis "
            f"rows {Phi.shape[0]}"
        )
    # OLS in Phi-coefficient space. Phi is full column rank by construction.
    beta, _, _, _ = np.linalg.lstsq(Phi, trajectory, rcond=None)
    return beta


# ---- Indicator-level normalization (§3.2.2) ---------------------------------


@dataclass(frozen=True)
class NormalizationResult:
    """Result of per-country indicator-level z-scoring.

    Carries the normalized trajectory plus the baseline statistics for
    audit / provenance.
    """

    y_normalized: np.ndarray  # (T_r,) normalized trajectory
    baseline_mean: float
    baseline_sd: float
    baseline_n_years: int  # actual count of pre-window years available
    floored: bool  # True if sigma_floor was applied (near-constant series)


def per_country_z_score(
    raw_trajectory: np.ndarray,
    pre_window_baseline: np.ndarray,
    *,
    median_sd_for_floor: float | None = None,
) -> NormalizationResult:
    """Apply per-country indicator-level normalization per §3.2.2.

    Computes 20-year (or shorter, if pre_window_baseline is shorter) pre-event
    mean and SD; z-scores the alignment window against those statistics; applies
    the sigma_min floor when the country's pre-window SD is degenerate.

    Args:
        raw_trajectory: (T_r,) array of raw observed values in the alignment
            window t in {-T_r, ..., -1}.
        pre_window_baseline: (<=20,) array of raw observed values in the
            pre-window window t in {-T_r-20, ..., -T_r-1}. May be shorter if
            the country has fewer pre-window years.
        median_sd_for_floor: Optional cross-country median SD for this
            indicator (computed at fit time across all training countries).
            When provided, sigma_min = 1e-3 * median_sd_for_floor per §3.2.2.
            When None, sigma_min defaults to 1e-6 (kernel-time fallback when
            the prototype carries the median for floor computation).

    Returns:
        NormalizationResult dataclass.

    Raises:
        ValueError: if pre_window_baseline has zero length.
    """
    raw_trajectory = np.asarray(raw_trajectory, dtype=float)
    pre_window_baseline = np.asarray(pre_window_baseline, dtype=float)
    if pre_window_baseline.size == 0:
        raise ValueError(
            "pre_window_baseline must have at least 1 year; per §3.2.2 "
            "instances with <20 pre-window years carry the BASELINE_TOO_SHORT "
            "flag and are dropped from training. Kernel-time queries with "
            "insufficient baseline should raise SubstrateInsufficientError."
        )

    baseline_mean = float(np.mean(pre_window_baseline))
    baseline_sd = float(np.std(pre_window_baseline, ddof=1)) if pre_window_baseline.size >= 2 else 0.0

    if median_sd_for_floor is not None and median_sd_for_floor > 0:
        sigma_floor = 1e-3 * median_sd_for_floor
    else:
        sigma_floor = 1e-6

    floored = baseline_sd < sigma_floor
    effective_sd = max(baseline_sd, sigma_floor)

    y_normalized = (raw_trajectory - baseline_mean) / effective_sd

    return NormalizationResult(
        y_normalized=y_normalized,
        baseline_mean=baseline_mean,
        baseline_sd=baseline_sd,
        baseline_n_years=int(pre_window_baseline.size),
        floored=floored,
    )


# ---- FPCA in the Sobolev metric (§3.1.2) ------------------------------------


@dataclass(frozen=True)
class FPCAResult:
    """FPCA decomposition result.

    Per §3.1.2 binding: M_r in {3, 4} selected by cumulative variance >= 0.80
    with floor 3, ceiling 4. If selection fails, ``selected_M_r`` is None and
    the caller routes to the §3.1.4 fallback.
    """

    V: np.ndarray  # (K_basis * K_indicators, M_max) principal directions
    eigenvalues: np.ndarray  # full eigenvalue spectrum (descending)
    cumulative_variance: np.ndarray  # cumulative fraction of variance explained
    scores: np.ndarray  # (N_r, M_max) per-instance scores onto V
    beta_mean: np.ndarray  # mean basis-coefficient vector across instances
    selected_M_r: int | None  # chosen M_r in {3, 4} or None if fit fails
    selection_reason: str  # human-readable reason for selection / failure
    scree_ratio_at_selected: float  # (M_r+1)-th / M_r-th eigenvalue ratio


def fit_fpca(
    beta_matrix: np.ndarray,
    R: np.ndarray,
    *,
    M_max: int = M_R_CEILING,
) -> FPCAResult:
    """Fit FPCA on basis coefficients with the Sobolev inner-product metric.

    Per §3.1.2 binding equation: scores s_c = V_r^T R (beta_c - bar_beta_r).
    The FPCA is computed by solving the generalized eigenvalue problem

        Cov(beta) v = lambda R v

    where R is the **positive-definite metric** (the Sobolev penalty matrix,
    NOT its inverse). Under this convention ``scipy.linalg.eigh(cov, R)``
    returns eigenvectors V satisfying ``V^T R V = I`` (R-orthonormality),
    and the per-instance scores ``s_c = V^T R (beta_c - bar_beta_r)`` are
    consistent with that normalization. Per Sonnet B3 (2026-05-17) the
    earlier docstring stated ``R^{-1}`` which was wrong; implementation
    was already correct.

    Args:
        beta_matrix: (N_r, K_basis * K_indicators) stacked per-instance
            basis coefficients. Row c is instance c's flattened coefficient
            vector across K_indicators indicators.
        R: (K_basis * K_indicators, K_basis * K_indicators) Sobolev penalty
            matrix (block-diagonal across indicators with identical per-
            indicator R blocks).
        M_max: Hard ceiling on number of FPCA components retained. Default
            equals spec ceiling 4.

    Returns:
        FPCAResult dataclass.

    Raises:
        ValueError: if beta_matrix has fewer than 2 rows (FPCA undefined).
    """
    if beta_matrix.shape[0] < 2:
        raise ValueError(
            f"FPCA requires N_r >= 2 instances; got {beta_matrix.shape[0]}. "
            f"Per §3.1.5 sparse recipes route to the §3.1.4 GP fallback."
        )
    if R.shape[0] != beta_matrix.shape[1]:
        raise ValueError(
            f"R dim {R.shape} mismatches beta width {beta_matrix.shape[1]}"
        )

    # Center.
    beta_mean = np.mean(beta_matrix, axis=0)
    beta_centered = beta_matrix - beta_mean[np.newaxis, :]

    # Covariance in coefficient space.
    N_r = beta_matrix.shape[0]
    cov = (beta_centered.T @ beta_centered) / max(N_r - 1, 1)
    cov = 0.5 * (cov + cov.T)  # symmetrize

    # Generalized eigenproblem: cov v = lambda R v (R as positive-definite
    # metric, NOT its inverse — see docstring B3 correction).
    # scipy.linalg.eigh(A, B) solves A v = lambda B v; here A=cov, B=R.
    # Returned eigenvectors V satisfy V^T R V = I.
    # eigh returns eigenvalues ascending; reverse for descending.
    try:
        eigvals_asc, eigvecs_asc = eigh(cov, R)
    except np.linalg.LinAlgError as exc:
        raise ValueError(f"FPCA generalized eigendecomposition failed: {exc}") from exc

    # Descending order.
    idx = np.argsort(eigvals_asc)[::-1]
    eigvals = eigvals_asc[idx]
    eigvecs = eigvecs_asc[:, idx]

    # Clip negative eigenvalues that arise from numerical noise to 0.
    eigvals = np.clip(eigvals, a_min=0.0, a_max=None)

    total_var = float(np.sum(eigvals))
    if total_var <= 0:
        cumvar = np.zeros_like(eigvals)
    else:
        cumvar = np.cumsum(eigvals) / total_var

    # Retain leading M_max directions.
    M_max_eff = min(M_max, eigvecs.shape[1])
    V = eigvecs[:, :M_max_eff]

    # Per-instance scores: s_c = V^T R (beta_c - bar_beta_r).
    scores = beta_centered @ R @ V

    # M_r selection rule (§3.1.2 + §3.1.5):
    #   1. smallest M_r >= floor with cumulative variance >= target,
    #   2. with hard ceiling M_max,
    #   3. scree elbow at chosen M_r per §3.1.5 operationalization
    #      (eigval[M_r+1] / eigval[M_r] <= 0.4).
    selected: int | None = None
    reason = "no_candidate_satisfies_variance_target"
    for candidate_M in range(M_R_FLOOR, M_max_eff + 1):
        # Cumulative variance is 1-indexed via the index candidate_M - 1.
        cum_at_candidate = cumvar[candidate_M - 1] if candidate_M - 1 < len(cumvar) else 0.0
        if cum_at_candidate >= M_R_VARIANCE_TARGET:
            selected = candidate_M
            reason = f"M_r={candidate_M} reaches cumulative variance {cum_at_candidate:.4f} >= {M_R_VARIANCE_TARGET}"
            break

    scree_ratio = 0.0
    if selected is not None:
        next_eig = eigvals[selected] if selected < len(eigvals) else 0.0
        curr_eig = eigvals[selected - 1] if selected - 1 < len(eigvals) else 1e-12
        scree_ratio = float(next_eig / max(curr_eig, 1e-12))
        # §3.1.5 scree elbow check is INFORMATIONAL at primary selection;
        # the fitter logs scree_ratio but uses cumulative variance as the
        # binding rule (§3.1.2 takes precedence over the §3.1.5 elbow heuristic
        # when both fire).

    return FPCAResult(
        V=V,
        eigenvalues=eigvals,
        cumulative_variance=cumvar,
        scores=scores,
        beta_mean=beta_mean,
        selected_M_r=selected,
        selection_reason=reason,
        scree_ratio_at_selected=scree_ratio,
    )


# ---- Diagnostic gates (§3.1.3 + §3.5.4) -------------------------------------


@dataclass(frozen=True)
class SamplerDiagnostics:
    """NUTS sampler diagnostic gates per §3.1.3."""

    rhat_max: float
    ess_min: float
    n_divergences: int
    rhat_gate_pass: bool
    ess_gate_pass: bool
    divergence_gate_pass: bool

    @property
    def all_pass(self) -> bool:
        return self.rhat_gate_pass and self.ess_gate_pass and self.divergence_gate_pass


def evaluate_sampler_diagnostics(
    rhat_values: np.ndarray | list[float],
    ess_values: np.ndarray | list[float],
    n_divergences: int,
) -> SamplerDiagnostics:
    """Evaluate the three §3.1.3 sampler gates.

    Per §3.1.3 binding:
      - All R-hat <= 1.01
      - Effective sample size >= 400 on every parameter
      - Zero divergent transitions after warmup
        (single divergence => refit at target_accept=0.99;
         persistent divergences => fallback per §3.1.4)
    """
    rhat_arr = np.asarray(rhat_values, dtype=float)
    ess_arr = np.asarray(ess_values, dtype=float)
    rhat_max = float(np.nanmax(rhat_arr)) if rhat_arr.size > 0 else 0.0
    ess_min = float(np.nanmin(ess_arr)) if ess_arr.size > 0 else 0.0
    return SamplerDiagnostics(
        rhat_max=rhat_max,
        ess_min=ess_min,
        n_divergences=int(n_divergences),
        rhat_gate_pass=rhat_max <= RHAT_GATE,
        ess_gate_pass=ess_min >= ESS_GATE,
        divergence_gate_pass=n_divergences == 0,
    )


def loio_coverage(
    held_out_log_predictive: np.ndarray | list[float],
    nominal_level: float = LOIO_NOMINAL_LEVEL,
) -> float:
    """Compute mean LOIO posterior-predictive coverage at nominal level.

    Per §3.5.4 binding: the fraction of held-out instances whose true label's
    posterior-predictive density falls inside the central `nominal_level`
    interval of the predicted distribution.

    Args:
        held_out_log_predictive: (N_r,) array of per-instance booleans (or
            0/1 floats) where True/1 indicates the held-out instance's
            label was covered by its LOIO predicted central interval.
        nominal_level: nominal coverage level (default 0.80 per §3.5.4).

    Returns:
        Mean coverage as a float in [0, 1].
    """
    coverage = np.asarray(held_out_log_predictive, dtype=float)
    if coverage.size == 0:
        return 0.0
    if not 0.0 <= nominal_level <= 1.0:
        raise ValueError(f"nominal_level must be in [0,1]; got {nominal_level}")
    return float(np.mean(coverage))


# ---- DTW (deterministic, used by kernel) ------------------------------------


def dtw_distance(
    a: np.ndarray,
    b: np.ndarray,
) -> tuple[float, int]:
    """Compute Dynamic Time Warping distance + minimum-lag index.

    Used by the shape kernel (§4.2) to score `shape_dtw_score` and
    `shape_phase_alignment`. Deterministic; no random state.

    Args:
        a: (T_a,) array (the country's z-scored trajectory).
        b: (T_b,) array (the prototype's posterior-mean trajectory).

    Returns:
        (distance, optimal_lag) where:
          distance: scalar DTW distance.
          optimal_lag: signed integer lag (b shifted by this much relative
            to a) at which the warping path's final alignment lands; the
            kernel converts this to a [-1, 1] phase-alignment cosine.

    Raises:
        ValueError: if either input is empty.
    """
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    if a.size == 0 or b.size == 0:
        raise ValueError("DTW inputs must be non-empty")

    n, m = a.shape[0], b.shape[0]
    # Cost matrix with +inf padding for clean recurrence.
    D = np.full((n + 1, m + 1), np.inf, dtype=float)
    D[0, 0] = 0.0
    for i in range(1, n + 1):
        ai = a[i - 1]
        for j in range(1, m + 1):
            cost = abs(ai - b[j - 1])
            D[i, j] = cost + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])

    distance = float(D[n, m])

    # Recover the warping path to extract the dominant lag.
    i, j = n, m
    path_lags: list[int] = []
    while i > 0 and j > 0:
        path_lags.append(j - i)
        # Move to predecessor with min cost. Per N3 (Sonnet 2026-05-17):
        # np.argmin is clearer than list.sort on the hot path.
        cand_costs = np.array(
            [D[i - 1, j - 1], D[i - 1, j], D[i, j - 1]], dtype=float
        )
        cand_indices = (
            (i - 1, j - 1),
            (i - 1, j),
            (i, j - 1),
        )
        choice = int(np.argmin(cand_costs))
        i, j = cand_indices[choice]

    if path_lags:
        # Use the median lag along the warping path as the representative
        # offset (robust to single-step path noise).
        optimal_lag = int(np.median(path_lags))
    else:
        optimal_lag = 0

    return distance, optimal_lag


# ---- GP fallback constants (§3.1.4 binding) ---------------------------------

# Same NUTS gate constants apply to the GP fallback (§3.1.3 imported by
# §3.1.4 by reference).  No additional constants needed; the GP model
# uses the same RHAT_GATE / ESS_GATE / TARGET_ACCEPT_DEFAULT values.

# Placeholder sentinel values for schema fields that are FPCA-specific
# but required by the indicator_signature schema even in fallback entries.
# The schema's ``fpca_component_scores`` is defined as "LKJ posterior mean
# of μ_r in FPCA score space"; for the GP fallback there is no FPCA score
# space, so we emit an empty list (valid JSON array of numbers, passes
# schema's ``type: array, items: number``).
GP_FALLBACK_FPCA_SCORES_SENTINEL: list[float] = []
GP_FALLBACK_FPCA_CUMVAR_SENTINEL: float = 0.0
GP_FALLBACK_FPCA_BASIS_LABEL: str = "gp_fallback_no_fpca_basis"


# ---- §3.1.4 GP Fallback models -----------------------------------------------


@dataclass(frozen=True)
class GPFallbackPosterior:
    """Posterior summary from the §3.1.4 hierarchical Bayes + GP fallback fit.

    Carries:
      - per-indicator posterior mean trajectory (recipe-level GP mean f_r^(k))
      - per-indicator posterior covariance diagonal (time-diagonal of the
        posterior covariance of f_r^(k); this is the "posterior kernel-induced
        covariance" §3.5.1 refers to for Mahalanobis scoring under fallback)
      - sampler diagnostics for the gate evaluation
    """

    posterior_mean_trajectories: list[np.ndarray]  # one per indicator, (T_r,)
    posterior_cov_diags: list[np.ndarray]  # one per indicator, (T_r,)
    sampler_diagnostics: "SamplerDiagnostics"
    idata: object  # arviz InferenceData; TYPE_CHECKING only, avoid circular import


def build_gp_fallback_model(
    trajectories: np.ndarray,
    K_indicators: int,
    T_r: int,
) -> "pm.Model":
    """Construct the PyMC model for the §3.1.4 hierarchical-Bayes + GP fallback.

    Per §3.1.4 binding spec:

        y_c^(k)(t) = f_r^(k)(t) + g_c^(k)(t) + ε_c,t^(k)

        f_r^(k)  ~ GP(0, κ_recipe^(k)(t, t'))      — recipe-level functional mean
        g_c^(k)  ~ GP(0, κ_instance^(k)(t, t'))    — instance-level residual
        ε_c,t^(k) ~ N(0, σ_ε²)                     — observation noise

    Squared-exponential kernels:
        κ_recipe^(k)(t,t')   = α_k² exp(-(t-t')²/(2ℓ_k²))
        κ_instance^(k)(t,t') = α_inst_k² exp(-(t-t')²/(2ℓ_inst_k²))
                                (same form, smaller amplitude prior)

    Hyperpriors per Priya §3.1.4:
        α_k      ~ HalfCauchy(0, 1)
        ℓ_k      ~ InvGamma(2, 1)          — avoids zero length-scales
        σ_ε      ~ HalfCauchy(0, 0.5)

    The instance-level residual GPs share the same prior form but with a
    smaller amplitude prior (HalfCauchy(0, 0.5)) to enforce shrinkage:
    recipe-level mean should dominate the instance-level residual for the
    canonical shape to generalize across instances.

    Args:
        trajectories: (N_r, T_r, K_indicators) array of normalized trajectories.
            Axis 0 = instances, axis 1 = time steps, axis 2 = indicators.
            The time axis runs over integer offsets {-T_r, ..., -1} (aliased to
            indices 0, 1, ..., T_r-1 for zero-based array indexing).
        K_indicators: number of key indicators (axis-2 extent of trajectories).
        T_r: canonical length (number of integer time steps).

    Returns:
        A PyMC Model object; caller must invoke pm.sample() within a ``with
        model:`` block or use pm.sample(model=model).

    Raises:
        ImportError: if pymc is not installed (this function imports lazily so
            the rest of the module does not pay the PyMC import cost).
        ValueError: if trajectories.shape does not match (*, T_r, K_indicators).
    """
    import os

    if "PYTENSOR_FLAGS" not in os.environ:
        os.environ["PYTENSOR_FLAGS"] = "cxx="

    import pymc as pm

    if trajectories.ndim != 3:
        raise ValueError(
            f"trajectories must be 3-D (N_r, T_r, K_indicators); got shape {trajectories.shape}"
        )
    N_r, T_r_actual, K_actual = trajectories.shape
    if T_r_actual != T_r or K_actual != K_indicators:
        raise ValueError(
            f"trajectories shape {trajectories.shape} does not match "
            f"(N_r={N_r}, T_r={T_r}, K_indicators={K_indicators})"
        )

    # Integer time grid 0..T_r-1 (represents year offsets -T_r..-1 normalised
    # to a 0-based index for the covariance algebra; distances are scale-free
    # in the SE kernel so the offset choice does not affect the posterior shape).
    t_grid = np.arange(T_r, dtype=float)  # (T_r,)

    # Precompute squared distances matrix: D2[i,j] = (t_i - t_j)^2.
    t_col = t_grid[:, None]  # (T_r, 1)
    t_row = t_grid[None, :]  # (1, T_r)
    D2 = (t_col - t_row) ** 2  # (T_r, T_r)

    with pm.Model() as model:  # noqa: SIM117
        for k in range(K_indicators):
            obs_k = trajectories[:, :, k]  # (N_r, T_r)

            # --- Recipe-level GP prior (§3.1.4 binding) ---
            alpha_k = pm.HalfCauchy(f"alpha_recipe_{k}", beta=1.0)
            ell_k = pm.InverseGamma(f"ell_recipe_{k}", alpha=2.0, beta=1.0)
            # Squared-exponential kernel matrix for recipe-level GP.
            # Shape: (T_r, T_r); each entry = α_k² exp(-D2/(2ℓ_k²)).
            K_recipe = alpha_k**2 * pm.math.exp(-D2 / (2.0 * ell_k**2))
            # Add tiny jitter for numerical stability (standard GP practice).
            K_recipe_jittered = K_recipe + 1e-6 * np.eye(T_r)
            # Recipe-level GP mean (one draw per time step).
            f_r_k = pm.MvNormal(
                f"f_r_{k}",
                mu=np.zeros(T_r),
                cov=K_recipe_jittered,
                shape=(T_r,),
            )

            # --- Observation noise (§3.1.4 binding, post-F-H-4-A1) ---
            # Instance-level GP g_c^(k) removed per F-H-4-A1 amendment
            # (qgi-docs 2026-05-18, 8-seat ratified 8/8 APPROVE).
            # Substrate justification: PyTensor Python-mode kernel argument
            # limit at K_indicators=5 × 7 vars = 35 scalars exceeds fusion
            # capacity under PYTENSOR_FLAGS=cxx= pin (Windows constraint).
            # Instance-level variation now absorbed into sigma_eps
            # (homoskedastic per indicator). §3.5.1 posterior_cov_diag
            # contract preserved (still from f_r_k NUTS posterior draws).
            # Restoration path: if Linux/WSL2 substrate enables C compiler,
            # restore g_c^(k) per pre-amendment §3.1.4 + retract F-H-4-A1.
            sigma_eps = pm.HalfCauchy(f"sigma_eps_{k}", beta=0.5)

            # --- Likelihood ---
            # y_c^(k)(t) = f_r^(k)(t) + ε_c,t^(k)  (post-F-H-4-A1)
            mu_obs = f_r_k[None, :]  # (1, T_r) broadcast over N_r instances
            pm.Normal(
                f"obs_{k}",
                mu=mu_obs,
                sigma=sigma_eps,
                observed=obs_k,
            )

    return model


def fit_gp_fallback(
    trajectories: np.ndarray,
    K_indicators: int,
    T_r: int,
    *,
    n_chains: int = 4,
    n_tune: int = 1000,
    n_draws: int = 1000,
    target_accept: float = TARGET_ACCEPT_DEFAULT,
    seed: int = 12345,
) -> "GPFallbackPosterior":
    """Run the §3.1.4 GP fallback NUTS sampler and return posterior summary.

    Same MCMC acceptance gates apply as §3.1.3 (imported by reference):
      - All R-hat ≤ 1.01 across all α_k, ℓ_k, σ_ε, f_r_k parameters
      - ESS ≥ 400 on every parameter
      - Zero divergent transitions after warmup
        (single divergence → caller must refit at target_accept=0.99)
        (persistent divergences → caller must raise; fallback's fallback
         does not exist per scope guardrails)

    Args:
        trajectories: (N_r, T_r, K_indicators) normalized trajectory array.
        K_indicators: number of key indicators.
        T_r: canonical length.
        n_chains: number of HMC chains.
        n_tune: warmup iterations per chain.
        n_draws: post-warmup sampling iterations per chain.
        target_accept: NUTS target acceptance rate.
        seed: master random seed.

    Returns:
        GPFallbackPosterior with posterior mean trajectories + cov diags +
        sampler diagnostics.
    """
    import os

    if "PYTENSOR_FLAGS" not in os.environ:
        os.environ["PYTENSOR_FLAGS"] = "cxx="

    import arviz as az
    import pymc as pm

    model = build_gp_fallback_model(trajectories, K_indicators, T_r)

    with model:
        idata = pm.sample(
            draws=n_draws,
            tune=n_tune,
            chains=n_chains,
            target_accept=target_accept,
            nuts={"max_treedepth": MAX_TREEDEPTH},
            random_seed=seed,
            progressbar=False,
            compute_convergence_checks=False,
            cores=1,
        )

    # --- Collect diagnostic variable names ---
    # Post-F-H-4-A1: instance-level GP hyperpriors (alpha_inst / ell_inst) and
    # the g_c tensor are removed from the model (qgi-docs 2026-05-18 amendment,
    # 8-seat ratified 8/8). Only recipe-level GP hyperpriors + sigma_eps + f_r_k
    # are gated for R-hat / ESS convergence.
    diag_var_names = []
    for k in range(K_indicators):
        diag_var_names.extend([
            f"alpha_recipe_{k}",
            f"ell_recipe_{k}",
            f"sigma_eps_{k}",
        ])
        # f_r_{k} is a vector variable; include it for R-hat / ESS.
        diag_var_names.append(f"f_r_{k}")

    summary = az.summary(idata, var_names=diag_var_names, kind="diagnostics")
    rhat_values = summary["r_hat"].values
    ess_values = summary["ess_bulk"].values
    n_divergences = int(idata.sample_stats["diverging"].sum().values)
    diagnostics = evaluate_sampler_diagnostics(rhat_values, ess_values, n_divergences)

    # --- Extract posterior mean trajectories + posterior covariance diag ---
    posterior_mean_trajectories: list[np.ndarray] = []
    posterior_cov_diags: list[np.ndarray] = []

    for k in range(K_indicators):
        # f_r_{k} has shape (chain, draw, T_r) in the posterior.
        f_r_draws = idata.posterior[f"f_r_{k}"].values  # (chains, draws, T_r)
        f_r_flat = f_r_draws.reshape(-1, T_r)  # (total_draws, T_r)

        # Posterior mean trajectory (§3.1.4: "joint posterior over recipe-level
        # functional means").
        mean_traj = f_r_flat.mean(axis=0)  # (T_r,)
        posterior_mean_trajectories.append(mean_traj)

        # Posterior covariance diagonal — the "posterior kernel-induced covariance"
        # per §3.5.1: "uses posterior kernel-induced covariance in place of Σ_r".
        # This is the empirical posterior covariance of f_r^(k)(t) across all
        # posterior draws, evaluated on the diagonal (per-time-step variance).
        # NOT the empirical variance of the training trajectories — it is the
        # Bayesian posterior covariance of the recipe-level GP mean, which
        # captures kernel-induced correlation structure learned from data
        # (matching the Chunk B Priya adjudication precedent from B5: posterior
        # source, not sample-variance).
        cov_matrix = np.cov(f_r_flat.T)  # (T_r, T_r) posterior covariance
        if T_r == 1:
            cov_diag = np.array([float(np.var(f_r_flat))])
        else:
            cov_diag = np.diag(cov_matrix)  # (T_r,) diagonal
        cov_diag = np.maximum(cov_diag, 0.0)  # defensive floor at 0
        posterior_cov_diags.append(cov_diag)

    return GPFallbackPosterior(
        posterior_mean_trajectories=posterior_mean_trajectories,
        posterior_cov_diags=posterior_cov_diags,
        sampler_diagnostics=diagnostics,
        idata=idata,
    )


def extract_gp_posterior_signature(
    gp_posterior: GPFallbackPosterior,
    T_r: int,
    K_indicators: int,
    indicator_ids: list[str],
) -> list[dict]:
    """Return per-indicator signature dicts for the lock JSON from a GP posterior.

    Per §3.1.4 fallback and §4.3 schema binding, each indicator signature must
    carry the standard fields that the shape kernel (§4.2) and the dispatch
    loader expect:

      - ``posterior_mean_trajectory``: posterior mean of f_r^(k)(t) at integer
        time points {-T_r, ..., -1} (stored as 0-based indices but semantically
        the pre-event trajectory offsets).
      - ``posterior_cov_diag``: diagonal of the posterior covariance over
        f_r^(k)(t) — the "posterior kernel-induced covariance" §3.5.1 refers
        to for Mahalanobis scoring under fallback.
      - ``fit_method``: "hierarchical_bayes_gp_fallback" (binding sentinel
        that allows the kernel to distinguish FPCA vs GP paths).
      - FPCA sentinel fields (``fpca_component_scores``, ``fpca_basis``,
        ``fpca_cumulative_variance_explained``) with GP-fallback placeholder
        values — required by the indicator_signature schema; consumers MUST
        check ``fit_method == "hierarchical_bayes_gp_fallback"`` before
        interpreting FPCA fields.

    Per B5 lesson (Sonnet 2026-05-17, Priya adjudication Option C):
    ``posterior_cov_diag`` here is the empirical Bayesian posterior covariance
    diagonal of f_r^(k)(t) across MCMC draws — NOT the empirical variance of
    the training trajectories. The kernel's Mahalanobis computation
    (§3.5.1 → §4.2) uses this as the denominator for shape-distance per time
    step, consistent with the FPCA-path's LKJ-back-projected Σ_r.

    Args:
        gp_posterior: GPFallbackPosterior from fit_gp_fallback.
        T_r: canonical length (must match gp_posterior array shapes).
        K_indicators: number of indicators.
        indicator_ids: ordered list of indicator IDs (same order as trajectories
            axis 2 passed to fit_gp_fallback).

    Returns:
        List of per-indicator signature dicts (one per indicator) in the order
        of indicator_ids. Each dict matches the ``indicator_signature`` schema
        in ``shape-prototypes.lock.schema.json``.

    Raises:
        ValueError: if lengths do not match expectations.
    """
    if len(gp_posterior.posterior_mean_trajectories) != K_indicators:
        raise ValueError(
            f"GP posterior has {len(gp_posterior.posterior_mean_trajectories)} "
            f"mean trajectories but K_indicators={K_indicators}"
        )
    if len(indicator_ids) != K_indicators:
        raise ValueError(
            f"indicator_ids length {len(indicator_ids)} != K_indicators={K_indicators}"
        )

    signatures: list[dict] = []
    for k, iid in enumerate(indicator_ids):
        mean_traj = np.asarray(gp_posterior.posterior_mean_trajectories[k], dtype=float)
        cov_diag = np.asarray(gp_posterior.posterior_cov_diags[k], dtype=float)

        if mean_traj.shape[0] != T_r:
            raise ValueError(
                f"indicator {iid!r}: posterior_mean_trajectory length "
                f"{mean_traj.shape[0]} != T_r={T_r}"
            )
        if cov_diag.shape[0] != T_r:
            raise ValueError(
                f"indicator {iid!r}: posterior_cov_diag length "
                f"{cov_diag.shape[0]} != T_r={T_r}"
            )

        sig = {
            # FPCA sentinel fields required by indicator_signature schema.
            # These are meaningless for the GP path; consumers must inspect
            # ``fit_method`` at the recipe level to know which path was used.
            "fpca_component_scores": GP_FALLBACK_FPCA_SCORES_SENTINEL,
            "fpca_cumulative_variance_explained": GP_FALLBACK_FPCA_CUMVAR_SENTINEL,
            "fpca_basis": GP_FALLBACK_FPCA_BASIS_LABEL,
            # GP-specific posterior fields (the load-bearing data for §3.5.1).
            "posterior_mean_trajectory": [float(x) for x in mean_traj.tolist()],
            "posterior_cov_diag": [float(x) for x in np.maximum(cov_diag, 0.0).tolist()],
            # Provenance tag — parallel to the FPCA path's "posterior_mean_lkj_back_projected".
            "cov_diag_source": "posterior_gp_f_r_empirical_cov_diag",
            # F-H-4-A1 amendment provenance (qgi-docs 2026-05-18, 8-seat ratified).
            # Instance-level GP g_c^(k) removed from §3.1.4 model per substrate
            # constraint (PyTensor Python-mode kernel arg limit). Restoration
            # path: WSL/Linux substrate → retract F-H-4-A1 + restore g_c^(k).
            "gp_fallback_variant": "v2_no_instance_gp",
            "gp_fallback_amendment": "F-H-4-A1",
        }
        signatures.append(sig)

    return signatures


def phase_alignment_cosine(
    lag: int,
    *,
    max_lag: int,
) -> float:
    """Convert a DTW optimal lag to a [-1, 1] phase-alignment cosine.

    Per §4.2 binding: shape_phase_alignment in [-1, 1] where 1 = no lag
    (perfectly in-phase) and -1 = anti-phase. The cosine map below is
    monotone decreasing in |lag| from 1 (at lag=0) to -1 (at lag = max_lag).

    Args:
        lag: signed integer lag from dtw_distance().
        max_lag: scale (typically T_r) over which the cosine spans [1, -1].

    Returns:
        Phase-alignment cosine in [-1, 1].
    """
    if max_lag <= 0:
        return 1.0 if lag == 0 else 0.0
    # Clamp lag to [-max_lag, max_lag].
    clamped = max(-max_lag, min(max_lag, lag))
    return float(np.cos(np.pi * clamped / max_lag))
