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

    Per §3.1.2 binding: K_basis = 8 interior knots placed at quantiles of
    [-T_r, 0]. Returns the evaluated basis matrix Phi (T_r x K_basis) and
    the second-derivative penalty matrix R used as the Sobolev inner-product
    metric for FPCA.

    Args:
        T_r: Canonical length (number of integer year offsets in the
            trajectory window, t in {-T_r, ..., -1}).
        n_interior_knots: Per spec, 8. Exposed for testability but spec-binding.

    Returns:
        (Phi, R) where:
          Phi: (T_r, n_interior_knots) evaluated basis matrix. Row i is
            phi_1..phi_K evaluated at t = -T_r + i.
          R: (n_interior_knots, n_interior_knots) penalty matrix
            (integral of second-derivative outer products); the metric
            used in FPCA's Sobolev inner product.

    Raises:
        ValueError: if T_r < 4 (basis cannot interpolate fewer than 4 points
            with a cubic spline + 8 interior knots while remaining stable).
    """
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

    # Quantile-spaced interior knots on (-T_r, 0). Use linspace on quantiles
    # 1/(K+1), ..., K/(K+1) for evenly-spaced quantile positions, deterministic
    # across calls.
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

    # Penalty matrix R: second-difference proxy (discrete second-derivative
    # in coefficient space). For cubic splines the integrated squared second
    # derivative reduces to a banded matrix; we use the second-difference
    # form Phi^T D2^T D2 Phi as a stable, dimensionally-correct proxy on the
    # integer grid (Ramsay & Silverman ch. 5, equation 5.13 discrete form).
    D2 = np.zeros((Phi.shape[0] - 2, Phi.shape[0]))
    for i in range(D2.shape[0]):
        D2[i, i] = 1.0
        D2[i, i + 1] = -2.0
        D2[i, i + 2] = 1.0
    R = Phi.T @ (D2.T @ D2) @ Phi

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
    Cov(beta) v = lambda R^-1 v which under the Sobolev metric reduces to a
    standard eigenvalue problem after a whitening transform with R^{1/2}.

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

    # Generalized eigenproblem: cov v = lambda R^{-1} v
    # <=> R^{1/2} cov R^{1/2} (R^{-1/2} v) = lambda (R^{-1/2} v).
    # Use scipy.linalg.eigh with R as the metric to solve directly.
    # eigh(A, B) returns eigenvalues ascending; reverse for descending.
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
        # Move to predecessor with min cost.
        candidates = [
            (D[i - 1, j - 1], i - 1, j - 1),
            (D[i - 1, j], i - 1, j),
            (D[i, j - 1], i, j - 1),
        ]
        candidates.sort(key=lambda c: c[0])
        _, i, j = candidates[0]

    if path_lags:
        # Use the median lag along the warping path as the representative
        # offset (robust to single-step path noise).
        optimal_lag = int(np.median(path_lags))
    else:
        optimal_lag = 0

    return distance, optimal_lag


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
