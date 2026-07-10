"""Unit tests for confound_missingness_placebo.py (PLAN.md §11 acceptance bar #2:
"Missingness/coverage placebo -- a bare 'has-IDS-data' dummy AND a values-scrambled
(mask-preserved) permutation must each score near-null (~0.50-0.55); if either reproduces
the lift -> reject").

`build_has_data_dummy_panel` / `permute_values_mask_preserved` / `assert_mask_preserved` are
PURE pandas/numpy transforms -- no sklearn/xgboost/joblib -- so this file runs on plain host
Python, no Docker required. The orchestration entrypoint (`run_missingness_placebo`, which
calls `fit_predict_loco`) is exercised only inside Docker, same DI split as the rest of
`em_test/` and `widenet/`.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import confound_missingness_placebo as cmp  # noqa: E402


def _panel(rows: list[tuple[str, int, float | None]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["country", "year", "value"])


# ============================================================================================
# build_has_data_dummy_panel
# ============================================================================================
def test_has_data_dummy_drops_null_rows():
    panel = _panel([("Mexico", 1993, 1.5), ("Mexico", 1994, None), ("Brazil", 1994, 3.2)])
    dummy = cmp.build_has_data_dummy_panel(panel)
    assert set(zip(dummy["country"], dummy["year"])) == {("Mexico", 1993), ("Brazil", 1994)}


def test_has_data_dummy_sets_constant_value():
    panel = _panel([("Mexico", 1993, 1.5), ("Brazil", 1994, 3.2)])
    dummy = cmp.build_has_data_dummy_panel(panel, fill_value=1.0)
    assert (dummy["value"] == 1.0).all()


def test_has_data_dummy_custom_fill_value():
    panel = _panel([("Mexico", 1993, 1.5)])
    dummy = cmp.build_has_data_dummy_panel(panel, fill_value=7.0)
    assert dummy["value"].iloc[0] == 7.0


def test_has_data_dummy_preserves_mask_vs_original():
    panel = _panel([("Mexico", 1993, 1.5), ("Mexico", 1994, None), ("Brazil", 1994, 3.2)])
    dummy = cmp.build_has_data_dummy_panel(panel)
    cmp.assert_mask_preserved(panel, dummy)  # must not raise


def test_has_data_dummy_all_null_yields_empty_panel():
    panel = _panel([("Mexico", 1993, None), ("Mexico", 1994, None)])
    dummy = cmp.build_has_data_dummy_panel(panel)
    assert len(dummy) == 0


# ============================================================================================
# permute_values_mask_preserved
# ============================================================================================
def _big_panel(n: int = 30) -> pd.DataFrame:
    rng = np.random.default_rng(0)
    rows = [(f"C{i}", 1990 + i, float(rng.normal())) for i in range(n)]
    rows.append(("Nullville", 2020, None))  # one null cell -- must stay excluded/null
    return _panel(rows)


def test_permute_values_mask_preserved_keeps_same_cells():
    panel = _big_panel()
    permuted = cmp.permute_values_mask_preserved(panel, seed=1)
    cmp.assert_mask_preserved(panel, permuted)


def test_permute_values_mask_preserved_is_a_value_permutation():
    panel = _big_panel()
    permuted = cmp.permute_values_mask_preserved(panel, seed=1)
    orig_non_null = panel.dropna(subset=["value"])["value"].sort_values().to_numpy()
    perm_values = permuted["value"].sort_values().to_numpy()
    np.testing.assert_allclose(orig_non_null, perm_values)


def test_permute_values_mask_preserved_actually_shuffles():
    panel = _big_panel()
    permuted = cmp.permute_values_mask_preserved(panel, seed=1)
    # Align on (country, year) and compare row-for-row -- with 30 distinct floats, an
    # unshuffled (identity) permutation is astronomically unlikely from a real shuffle.
    merged = panel.dropna(subset=["value"]).merge(
        permuted, on=["country", "year"], suffixes=("_orig", "_perm")
    )
    assert not np.allclose(merged["value_orig"].to_numpy(), merged["value_perm"].to_numpy())


def test_permute_values_mask_preserved_seed_is_deterministic():
    panel = _big_panel()
    a = cmp.permute_values_mask_preserved(panel, seed=42)
    b = cmp.permute_values_mask_preserved(panel, seed=42)
    pd.testing.assert_frame_equal(
        a.sort_values(["country", "year"]).reset_index(drop=True),
        b.sort_values(["country", "year"]).reset_index(drop=True),
    )


def test_permute_values_mask_preserved_different_seeds_usually_differ():
    panel = _big_panel()
    a = cmp.permute_values_mask_preserved(panel, seed=1)
    b = cmp.permute_values_mask_preserved(panel, seed=2)
    a_sorted = a.sort_values(["country", "year"]).reset_index(drop=True)
    b_sorted = b.sort_values(["country", "year"]).reset_index(drop=True)
    assert not np.allclose(a_sorted["value"].to_numpy(), b_sorted["value"].to_numpy())


# ============================================================================================
# assert_mask_preserved
# ============================================================================================
def test_assert_mask_preserved_raises_on_dropped_cell():
    panel = _panel([("Mexico", 1993, 1.5), ("Brazil", 1994, 3.2)])
    tampered = panel.iloc[[0]].copy()  # dropped the Brazil row
    with pytest.raises(AssertionError):
        cmp.assert_mask_preserved(panel, tampered)


def test_assert_mask_preserved_raises_on_added_cell():
    panel = _panel([("Mexico", 1993, 1.5)])
    tampered = pd.concat([panel, _panel([("Brazil", 1994, 9.9)])], ignore_index=True)
    with pytest.raises(AssertionError):
        cmp.assert_mask_preserved(panel, tampered)
