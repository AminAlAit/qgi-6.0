"""
Unit tests for the HAC p-value correction in scdi_finder.py (#364).

Validates the effective-n degrees-of-freedom adjustment that the
Phase 2 SCDI finder applies for FAOSTAT ``3yr_avg`` indicators to
account for residual autocorrelation in first-differenced
overlapping-window series. Three expert reviewers (UN/MIT/TUM) +
Final Sonnet consensus: first-differencing alone is insufficient;
p-values need Newey-West / HAC correction. The closed-form
approximation used here is MIT reviewer's conservative bound.
"""
import importlib.util
from pathlib import Path

import numpy as np
import pytest

# Scipy is required in the prod container but may be missing from the
# local dev environment. If absent, skip the whole module.
pytest.importorskip("scipy")

_SCDI_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "batch"
    / "scdi-finder"
    / "src"
    / "scdi_finder.py"
)


def _load_scdi_finder():
    """Import the scdi_finder module directly, bypassing the
    main() entry point (which reads env vars + S3)."""
    spec = importlib.util.spec_from_file_location(
        "scdi_finder", str(_SCDI_PATH)
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------- #
# effective_df_for_source_type                                            #
# ---------------------------------------------------------------------- #


def test_effective_df_annual_unchanged():
    """For source_type='annual' (WB default), df = n-2 (unchanged)."""
    mod = _load_scdi_finder()
    for n in [5, 10, 20, 30, 50]:
        df = mod.effective_df_for_source_type(np.array([n]), "annual")
        assert df[0] == max(n - 2, 1), f"annual df@n={n}: expected {n-2}, got {df[0]}"


def test_effective_df_3yr_avg_applies_hac_penalty():
    """For source_type='3yr_avg', effective n = (n-1)/3 → df = n_eff - 2.
    Floors at n_eff=3 (df=1) for very short series."""
    mod = _load_scdi_finder()
    # At n=20: n_eff = 19/3 ≈ 6.33 → df ≈ 4.33
    df = mod.effective_df_for_source_type(np.array([20]), "3yr_avg")
    assert 4.0 < df[0] < 4.5
    # At n=10: n_eff = 3/3 = 3 → df = 1 (floored)
    df = mod.effective_df_for_source_type(np.array([10]), "3yr_avg")
    assert df[0] == 1.0
    # At n=3: n_eff = 3 → df = 1 (floor)
    df = mod.effective_df_for_source_type(np.array([3]), "3yr_avg")
    assert df[0] == 1.0


def test_effective_df_vectorizes_over_array():
    """Input can be a numpy array; output shape matches."""
    mod = _load_scdi_finder()
    ns = np.array([5, 10, 20, 30])
    df = mod.effective_df_for_source_type(ns, "3yr_avg")
    assert df.shape == ns.shape


# ---------------------------------------------------------------------- #
# pearson_pvalues_vectorized with source_type                             #
# ---------------------------------------------------------------------- #


def test_pearson_pvalues_backward_compat_default_is_annual():
    """Omitting source_type must behave identically to 'annual' →
    backward-compat with every existing WB-only caller."""
    mod = _load_scdi_finder()
    r = np.array([0.5, 0.7, 0.9])
    n = np.array([20, 20, 20])
    p_default = mod.pearson_pvalues_vectorized(r, n)
    p_annual = mod.pearson_pvalues_vectorized(r, n, source_type="annual")
    np.testing.assert_array_equal(p_default, p_annual)


def test_pearson_pvalues_3yr_avg_produces_larger_p_than_annual():
    """For the same (r, n), a 3yr_avg indicator should produce a
    LARGER p-value than an annual indicator — because effective df
    is smaller, the t-statistic has a heavier-tailed distribution,
    so the tail probability is higher."""
    mod = _load_scdi_finder()
    r = np.array([0.6])
    n = np.array([20])
    p_annual = mod.pearson_pvalues_vectorized(r, n, source_type="annual")
    p_3yr = mod.pearson_pvalues_vectorized(r, n, source_type="3yr_avg")
    assert p_3yr[0] > p_annual[0]


def test_pearson_pvalues_3yr_avg_r_0p6_n_20_is_not_significant():
    """At r=0.6, n=20, a standard Pearson would call this highly
    significant (p < 0.05). Under HAC-adjusted 3yr_avg (effective
    df ≈ 4.33), the same correlation should NOT pass p<0.05 — that's
    the whole point of the correction: prevent spurious SCDIs from
    autocorrelation residue."""
    mod = _load_scdi_finder()
    r = np.array([0.6])
    n = np.array([20])
    p_annual = mod.pearson_pvalues_vectorized(r, n, source_type="annual")
    p_3yr = mod.pearson_pvalues_vectorized(r, n, source_type="3yr_avg")
    assert p_annual[0] < 0.05, f"Expected annual to flag r=0.6 @ n=20; got p={p_annual[0]}"
    assert p_3yr[0] > 0.05, f"HAC should NOT flag r=0.6 @ n=20 for 3yr_avg; got p={p_3yr[0]}"


def test_pearson_pvalues_3yr_avg_r_0p9_still_significant():
    """Very high r should still survive HAC — the correction should
    suppress spurious correlations, not kill real ones."""
    mod = _load_scdi_finder()
    r = np.array([0.95])
    n = np.array([25])  # 3yr_avg @ n=25 → df ≈ 6
    p_3yr = mod.pearson_pvalues_vectorized(r, n, source_type="3yr_avg")
    assert p_3yr[0] < 0.05, f"Expected r=0.95 @ n=25 to survive HAC; got p={p_3yr[0]}"


def test_pearson_pvalues_monotonic_in_r_under_hac():
    """Monotonicity: as |r| increases (holding n + source_type fixed),
    p-value must strictly decrease. A correlation-size monotonicity
    bug would silently corrupt BH-FDR ranking."""
    mod = _load_scdi_finder()
    n = np.full(5, 20)
    rs = np.array([0.3, 0.5, 0.7, 0.85, 0.95])
    p_annual = mod.pearson_pvalues_vectorized(rs, n, source_type="annual")
    p_3yr = mod.pearson_pvalues_vectorized(rs, n, source_type="3yr_avg")
    # Both sequences must be strictly decreasing
    assert np.all(np.diff(p_annual) < 0)
    assert np.all(np.diff(p_3yr) < 0)
