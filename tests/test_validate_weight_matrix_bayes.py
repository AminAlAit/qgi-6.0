"""
Unit tests for the Phase 5 v0.2 Path B evaluator scaffold.

Scope: the parts of `validate_weight_matrix_bayes.py` that are safely
testable without invoking PyMC's heavy MCMC machinery — module imports,
constants, the synthetic-data generator, the CellsArray dataclass + its
provenance hash, the prep-helper stub's error contract, and the CLI
argument plumbing.

The smoke test (`run_smoke_test()`) is exercised end-to-end by the
`--smoke` CLI in CI / the PR description, not by pytest — it requires
pymc / numpyro / arviz which live in `requirements-path-b.txt`, not in
the default `requirements.txt`. Per Ji-Hoon #21 §3.1 sign-off, sampling
config + diagnostic verification is the integration-level contract.

Author: Claude Opus 4.7 (1M context) — T12 day-1 scaffold (#676)
Generated: 2026-05-14
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import numpy as np
import pytest


_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "validate_weight_matrix_bayes.py"
_spec = importlib.util.spec_from_file_location("validate_weight_matrix_bayes", _SCRIPT)
mod = importlib.util.module_from_spec(_spec)
sys.modules["validate_weight_matrix_bayes"] = mod
_spec.loader.exec_module(mod)


# ===========================================================================
# Constants — ratified at T10 commit ca77505 + 2026-05-14 trio sign-off.
# These tests pin the constants AT the values the spec ratified. Any future
# change here MUST come paired with a Majles re-convening; the test failure
# is the canary.
# ===========================================================================

def test_priors_locked_at_ratified_values():
    assert mod.TAU_ARM_PRIOR_SCALE == 0.05, "spec §2.1"
    assert mod.HALF_CAUCHY_SCALE == 0.05, "spec §2.2"
    assert mod.MU_PRIOR_CENTER == 0.30, "spec §2.4 — deliberately mis-centered"
    assert mod.MU_PRIOR_SCALE == 0.05, "spec §2.4"


def test_sampling_config_locked_at_ratified_values():
    assert mod.N_CHAINS == 4, "spec §3.1"
    assert mod.N_TUNE == 1000, "spec §3.1"
    assert mod.N_DRAWS == 2000, "spec §3.1"
    assert mod.TARGET_ACCEPT == 0.95, "spec §3.1"
    assert mod.MAX_TREEDEPTH == 12, "spec §3.1"


def test_diagnostic_thresholds_locked_at_ratified_values():
    assert mod.R_HAT_THRESHOLD == 1.01, "Ji-Hoon §3.1"
    assert mod.N_EFF_THRESHOLD == 400, "Ji-Hoon §3.1"
    assert mod.DIVERGENCE_THRESHOLD_PCT == 0.001, "Ji-Hoon §3.1 (< 0.1 %)"
    assert mod.E_BFMI_THRESHOLD == 0.3, "Ji-Hoon §3.1"


def test_chain_seeds_are_at_least_n_chains():
    assert len(mod.CHAIN_SEEDS) >= mod.N_CHAINS, "need one seed per chain"


def test_schema_version_starts_at_one():
    """Path B is a distinct output family from Path A (rule v2 verdicts);
    the schema versions are independent and Path B starts at v1."""
    assert mod.PATH_B_SCHEMA_VERSION == 1


# ===========================================================================
# make_synthetic_cells — shape, dtype, NaN structure
# ===========================================================================

def test_synthetic_cells_default_shape():
    cells = mod.make_synthetic_cells()
    assert cells.auc.shape == (4, 30, 12), "default n_countries=30, n_categories=12, 4 arms"
    assert cells.n_arms == 4
    assert cells.n_countries == 30
    assert cells.n_categories == 12
    assert cells.n_sectors == 4


def test_synthetic_cells_custom_shape():
    cells = mod.make_synthetic_cells(n_countries=10, n_categories=8, n_sectors=2)
    assert cells.auc.shape == (4, 10, 8)
    assert cells.n_sectors == 2


def test_synthetic_cells_arm_labels_are_abcd():
    cells = mod.make_synthetic_cells()
    assert cells.arm_labels == ["A", "B", "C", "D"]


def test_synthetic_cells_has_nan_at_missing_rate():
    """Default missing_rate=0.30 should drop roughly 30% of cells to NaN.
    Stochastic but with seed=42 fixed; tolerate a wide envelope."""
    cells = mod.make_synthetic_cells(missing_rate=0.30, seed=42)
    n_nan = int(np.sum(np.isnan(cells.auc)))
    total = cells.auc.size
    nan_frac = n_nan / total
    assert 0.20 < nan_frac < 0.40, f"expected ~30% NaN; got {nan_frac:.3f}"


def test_synthetic_cells_zero_missing_rate_no_nan():
    cells = mod.make_synthetic_cells(missing_rate=0.0)
    assert not np.any(np.isnan(cells.auc))


def test_synthetic_cells_sector_idx_in_range():
    cells = mod.make_synthetic_cells(n_categories=12, n_sectors=4)
    assert cells.sector_idx_for_category.shape == (12,)
    assert cells.sector_idx_for_category.min() >= 0
    assert cells.sector_idx_for_category.max() < 4


def test_synthetic_cells_dgp_tau_recoverable_direction():
    """The planted ground truth has tau_arm = (+0.04, +0.02, -0.01, 0.0),
    so the raw cell means should show A > D in expectation."""
    cells = mod.make_synthetic_cells(missing_rate=0.0, seed=42)
    arm_means = np.nanmean(cells.auc, axis=(1, 2))
    a_minus_d = arm_means[0] - arm_means[3]
    assert a_minus_d > 0.01, f"DGP plants +0.04 A-D swing; got {a_minus_d:.4f}"


def test_synthetic_cells_seed_reproducible():
    c1 = mod.make_synthetic_cells(seed=42)
    c2 = mod.make_synthetic_cells(seed=42)
    np.testing.assert_array_equal(c1.auc, c2.auc, "same seed → identical cells")


def test_synthetic_cells_different_seeds_differ():
    c1 = mod.make_synthetic_cells(seed=42, missing_rate=0.0)
    c2 = mod.make_synthetic_cells(seed=43, missing_rate=0.0)
    assert not np.array_equal(c1.auc, c2.auc), "different seeds → different cells"


# ===========================================================================
# CellsArray.sha256_provenance — reproducibility hash (§3.4)
# ===========================================================================

def test_sha256_provenance_deterministic_same_input():
    c1 = mod.make_synthetic_cells(seed=42)
    c2 = mod.make_synthetic_cells(seed=42)
    assert c1.sha256_provenance() == c2.sha256_provenance()


def test_sha256_provenance_differs_on_different_data():
    c1 = mod.make_synthetic_cells(seed=42)
    c2 = mod.make_synthetic_cells(seed=43)
    assert c1.sha256_provenance() != c2.sha256_provenance()


def test_sha256_provenance_sensitive_to_label_order():
    """Swapping arm labels should change the hash (label ordering is
    load-bearing for downstream posterior interpretation)."""
    cells = mod.make_synthetic_cells(seed=42)
    h_original = cells.sha256_provenance()
    cells.arm_labels = ["D", "C", "B", "A"]
    h_swapped = cells.sha256_provenance()
    assert h_original != h_swapped


def test_sha256_provenance_hex_string_length():
    cells = mod.make_synthetic_cells()
    h = cells.sha256_provenance()
    assert len(h) == 64, "SHA-256 hex digest is 64 chars"
    assert all(c in "0123456789abcdef" for c in h)


# ===========================================================================
# prep_cells_from_arm_jsons — stub error contract
# ===========================================================================

def test_prep_helper_raises_when_arm_json_missing(tmp_path):
    """The day-1 scaffold's stub should raise FileNotFoundError when
    per-arm JSONs aren't on disk, before reaching the NotImplementedError."""
    fake_paths = {arm: tmp_path / f"phase4-validation-arm{arm}.json"
                  for arm in ("A", "B", "C", "D")}
    with pytest.raises(FileNotFoundError, match="Missing per-arm JSONs"):
        mod.prep_cells_from_arm_jsons(fake_paths)


def test_prep_helper_raises_not_implemented_when_arm_jsons_present(tmp_path):
    """When all 4 per-arm JSONs exist, the stub raises NotImplementedError
    pointing at the T12 trio's real-data PR."""
    fake_paths = {}
    for arm in ("A", "B", "C", "D"):
        p = tmp_path / f"phase4-validation-arm{arm}.json"
        p.write_text("{}", encoding="utf-8")
        fake_paths[arm] = p
    with pytest.raises(NotImplementedError, match="stub in the day-1 scaffold"):
        mod.prep_cells_from_arm_jsons(fake_paths)


# ===========================================================================
# load_l1_mapping — fallback behavior
# ===========================================================================

def test_load_l1_mapping_returns_empty_when_file_missing(monkeypatch, tmp_path):
    """When the L1 mapping JSON doesn't exist, the helper returns {}
    (not an error) so smoke tests don't depend on it."""
    monkeypatch.setattr(mod, "L1_MAPPING_JSON", tmp_path / "nonexistent.json")
    result = mod.load_l1_mapping()
    assert result == {}


def test_load_l1_mapping_loads_existing_file(monkeypatch, tmp_path):
    p = tmp_path / "l1.json"
    p.write_text('{"mapping": {"cat_01": "sec_0", "cat_02": "sec_1"}}', encoding="utf-8")
    monkeypatch.setattr(mod, "L1_MAPPING_JSON", p)
    result = mod.load_l1_mapping()
    assert result == {"cat_01": "sec_0", "cat_02": "sec_1"}


# ===========================================================================
# CLI — argument parsing without invoking PyMC
# ===========================================================================

def test_cli_requires_one_mode():
    """Argparse should reject calls with neither --smoke nor --prep-only."""
    with pytest.raises(SystemExit):
        mod._main([])


def test_cli_rejects_both_modes():
    with pytest.raises(SystemExit):
        mod._main(["--smoke", "--prep-only"])
