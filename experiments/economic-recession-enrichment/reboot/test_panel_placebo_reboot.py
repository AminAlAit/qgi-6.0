from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

import panel_placebo_reboot as pp


def _panel():
    return pd.DataFrame({
        "country": ["A", "A", "B", "B", "C"],
        "year": [2000, 2001, 2000, 2001, 2000],
        "value": [1.0, np.nan, 3.0, 4.0, np.nan],
    })


def test_build_has_data_dummy_panel_drops_nulls_and_fills_constant():
    dummy = pp.build_has_data_dummy_panel(_panel())
    assert len(dummy) == 3  # 2 NaN rows dropped
    assert (dummy["value"] == 1.0).all()
    assert set(zip(dummy["country"], dummy["year"])) == {("A", 2000), ("B", 2000), ("B", 2001)}


def test_build_has_data_dummy_panel_custom_fill_value():
    dummy = pp.build_has_data_dummy_panel(_panel(), fill_value=42.0)
    assert (dummy["value"] == 42.0).all()


def test_permute_values_mask_preserved_keeps_same_cells():
    permuted = pp.permute_values_mask_preserved(_panel(), seed=1)
    orig_cells = {("A", 2000), ("B", 2000), ("B", 2001)}
    assert set(zip(permuted["country"], permuted["year"])) == orig_cells


def test_permute_values_mask_preserved_shuffles_values():
    permuted = pp.permute_values_mask_preserved(_panel(), seed=1)
    assert sorted(permuted["value"].tolist()) == [1.0, 3.0, 4.0]


def test_permute_values_mask_preserved_deterministic_for_seed():
    a = pp.permute_values_mask_preserved(_panel(), seed=7)
    b = pp.permute_values_mask_preserved(_panel(), seed=7)
    pd.testing.assert_frame_equal(a.reset_index(drop=True), b.reset_index(drop=True))


def test_assert_mask_preserved_passes_for_own_transforms():
    panel = _panel()
    pp.assert_mask_preserved(panel, pp.build_has_data_dummy_panel(panel))
    pp.assert_mask_preserved(panel, pp.permute_values_mask_preserved(panel, seed=3))


def test_assert_mask_preserved_raises_on_dropped_cell():
    panel = _panel()
    dummy = pp.build_has_data_dummy_panel(panel)
    truncated = dummy.iloc[1:].reset_index(drop=True)
    with pytest.raises(AssertionError):
        pp.assert_mask_preserved(panel, truncated)


def test_assert_mask_preserved_raises_on_added_cell():
    panel = _panel()
    dummy = pp.build_has_data_dummy_panel(panel)
    extra = pd.concat(
        [dummy, pd.DataFrame({"country": ["Z"], "year": [1999], "value": [1.0]})], ignore_index=True,
    )
    with pytest.raises(AssertionError):
        pp.assert_mask_preserved(panel, extra)
