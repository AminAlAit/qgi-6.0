"""Unit tests for src/feature_engineering.py.

Stage 0 deliverable per qgi-docs/internal/ops/ml-track/stage-0-pre-registration.md.

Synthesizes a tiny long-format panel and exercises every transform:
read_indicators, pivot_to_wide / pivot_to_long, first_difference,
rolling_zscore, momentum, cross_indicator_ratios, missingness_indicators,
multiple_imputation_mice.
"""
from __future__ import annotations

import math
import pathlib
import sys

import pandas as pd
import pytest

SRC_DIR = pathlib.Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC_DIR))

import feature_engineering as fe  # noqa: E402


# ---------- Schema validation ----------


def test_check_long_schema_rejects_missing_columns():
    df = pd.DataFrame({"country": ["x"], "year": [2020]})
    with pytest.raises(ValueError, match="missing required columns"):
        fe._check_long_schema(df)


def test_check_long_schema_accepts_canonical_columns():
    df = pd.DataFrame(columns=list(fe.REQUIRED_COLS))
    fe._check_long_schema(df)  # no exception


# ---------- read_indicators ----------


def _write_indicator_parquet(panel_dir: pathlib.Path, indicator_id: str, rows: list[dict]):
    sub = panel_dir / indicator_id
    sub.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_parquet(sub / f"{indicator_id}.parquet")


def test_read_indicators_reads_parquets_and_concatenates(tmp_path):
    _write_indicator_parquet(tmp_path, "WB-01", [
        {"country": "atlantis", "year": 2020, "indicator_id": "WB-01", "value": 1.0},
        {"country": "atlantis", "year": 2021, "indicator_id": "WB-01", "value": 2.0},
    ])
    _write_indicator_parquet(tmp_path, "VD-01", [
        {"country": "atlantis", "year": 2020, "indicator_id": "VD-01", "value": 0.5},
    ])
    df = fe.read_indicators(["WB-01", "VD-01"], tmp_path)
    assert len(df) == 3
    assert set(df["indicator_id"]) == {"WB-01", "VD-01"}


def test_read_indicators_silently_skips_missing(tmp_path):
    _write_indicator_parquet(tmp_path, "WB-01", [
        {"country": "x", "year": 2020, "indicator_id": "WB-01", "value": 1.0},
    ])
    df = fe.read_indicators(["WB-01", "NON-EXISTENT"], tmp_path)
    assert len(df) == 1
    assert df["indicator_id"].iloc[0] == "WB-01"


def test_read_indicators_backfills_indicator_id_from_path(tmp_path):
    """If a parquet file lacks indicator_id col, it's inferred from the dirname."""
    sub = tmp_path / "WB-99"
    sub.mkdir()
    df = pd.DataFrame([
        {"country": "x", "year": 2020, "value": 1.0},  # no indicator_id col
    ])
    df.to_parquet(sub / "WB-99.parquet")
    out = fe.read_indicators(["WB-99"], tmp_path)
    assert (out["indicator_id"] == "WB-99").all()


def test_read_indicators_returns_empty_when_no_matches(tmp_path):
    df = fe.read_indicators(["NOPE"], tmp_path)
    assert df.empty
    assert list(df.columns) == list(fe.REQUIRED_COLS)


def test_read_indicators_raises_on_missing_dir(tmp_path):
    with pytest.raises(NotADirectoryError):
        fe.read_indicators(["WB-01"], tmp_path / "no_such_dir")


# ---------- pivot helpers ----------


def _sample_long():
    return pd.DataFrame([
        {"country": "atlantis", "year": 2020, "indicator_id": "A", "value": 1.0},
        {"country": "atlantis", "year": 2020, "indicator_id": "B", "value": 2.0},
        {"country": "atlantis", "year": 2021, "indicator_id": "A", "value": 3.0},
        {"country": "atlantis", "year": 2021, "indicator_id": "B", "value": 4.0},
        {"country": "rapture", "year": 2020, "indicator_id": "A", "value": 5.0},
    ])


def test_pivot_to_wide_one_row_per_country_year():
    long = _sample_long()
    wide = fe.pivot_to_wide(long)
    assert len(wide) == 3  # (atlantis,2020), (atlantis,2021), (rapture,2020)
    assert set(wide.columns) >= {"country", "year", "A", "B"}


def test_pivot_round_trip_preserves_non_null_data():
    long = _sample_long()
    wide = fe.pivot_to_wide(long)
    long2 = fe.pivot_to_long(wide)
    # Sort both for comparison; pivot_to_long drops NaN values
    a = long.sort_values(["country", "year", "indicator_id"]).reset_index(drop=True)
    b = long2.sort_values(["country", "year", "indicator_id"]).reset_index(drop=True)
    pd.testing.assert_frame_equal(a, b, check_dtype=False)


def test_pivot_to_wide_handles_empty_input():
    df = pd.DataFrame(columns=list(fe.REQUIRED_COLS))
    out = fe.pivot_to_wide(df)
    assert out.empty


# ---------- first_difference ----------


def test_first_difference_per_country_indicator():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 10.0},
        {"country": "x", "year": 2021, "indicator_id": "A", "value": 13.0},
        {"country": "x", "year": 2022, "indicator_id": "A", "value": 15.0},
    ])
    out = fe.first_difference(long, indicator_ids=["A"])
    diffed = out[out["indicator_id"] == "A__diff"].sort_values("year")
    assert pd.isna(diffed.iloc[0]["value"])  # first year NaN
    assert diffed.iloc[1]["value"] == 3.0
    assert diffed.iloc[2]["value"] == 2.0


def test_first_difference_resets_per_country():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 10.0},
        {"country": "x", "year": 2021, "indicator_id": "A", "value": 13.0},
        {"country": "y", "year": 2020, "indicator_id": "A", "value": 100.0},
        {"country": "y", "year": 2021, "indicator_id": "A", "value": 105.0},
    ])
    out = fe.first_difference(long, indicator_ids=["A"])
    diffed = out[out["indicator_id"] == "A__diff"]
    # Each country's 2020 row should be NaN (first observation)
    nan_2020 = diffed[diffed["year"] == 2020]["value"]
    assert nan_2020.isna().all()


def test_first_difference_passes_through_non_targeted_indicators():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 1.0},
        {"country": "x", "year": 2020, "indicator_id": "B", "value": 5.0},
        {"country": "x", "year": 2021, "indicator_id": "A", "value": 2.0},
        {"country": "x", "year": 2021, "indicator_id": "B", "value": 7.0},
    ])
    out = fe.first_difference(long, indicator_ids=["A"])
    # B passes through unchanged
    b_rows = out[out["indicator_id"] == "B"]
    assert len(b_rows) == 2
    assert set(b_rows["value"]) == {5.0, 7.0}


def test_first_difference_default_applies_to_all_indicators():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 1.0},
        {"country": "x", "year": 2021, "indicator_id": "A", "value": 2.0},
        {"country": "x", "year": 2020, "indicator_id": "B", "value": 5.0},
        {"country": "x", "year": 2021, "indicator_id": "B", "value": 8.0},
    ])
    out = fe.first_difference(long)
    assert "A__diff" in set(out["indicator_id"])
    assert "B__diff" in set(out["indicator_id"])


# ---------- rolling_zscore ----------


def test_rolling_zscore_normalizes_within_country():
    long = pd.DataFrame([
        {"country": "x", "year": 2018, "indicator_id": "A", "value": 1.0},
        {"country": "x", "year": 2019, "indicator_id": "A", "value": 2.0},
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 3.0},
        {"country": "x", "year": 2021, "indicator_id": "A", "value": 4.0},
    ])
    out = fe.rolling_zscore(long, window_years=3)
    z = out[out["indicator_id"] == "A__zscore"].sort_values("year")
    # 2018: NaN (need >=2 obs); 2019 onward: z computed
    assert pd.isna(z.iloc[0]["value"])
    assert pd.notna(z.iloc[1]["value"])  # 2019: 2 obs available
    assert pd.notna(z.iloc[3]["value"])


def test_rolling_zscore_zero_std_yields_nan_not_inf():
    """Constant series should produce NaN (not inf) due to inf replacement."""
    long = pd.DataFrame([
        {"country": "x", "year": 2018, "indicator_id": "A", "value": 5.0},
        {"country": "x", "year": 2019, "indicator_id": "A", "value": 5.0},
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 5.0},
    ])
    out = fe.rolling_zscore(long, window_years=3)
    z = out[out["indicator_id"] == "A__zscore"]
    # All NaN: no variance -> std=0 -> z is inf -> replaced with NaN
    assert z["value"].isna().all() or all(pd.isna(v) or v == 0 for v in z["value"])


def test_rolling_zscore_rejects_window_below_2():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 1.0},
    ])
    with pytest.raises(ValueError):
        fe.rolling_zscore(long, window_years=1)


# ---------- momentum ----------


def test_momentum_emits_yoy_change_in_rolling_mean():
    long = pd.DataFrame([
        {"country": "x", "year": 2018, "indicator_id": "A", "value": 1.0},
        {"country": "x", "year": 2019, "indicator_id": "A", "value": 2.0},
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 3.0},
        {"country": "x", "year": 2021, "indicator_id": "A", "value": 4.0},
    ])
    out = fe.momentum(long, lookback_years=2)
    m = out[out["indicator_id"] == "A__momentum"].sort_values("year")
    # 2018: NaN (need >=2 obs); 2019 onward: rolling-mean YoY change
    # Rolling-mean(2): 2018=NaN, 2019=1.5, 2020=2.5, 2021=3.5
    # Diff: 2018=NaN, 2019=NaN, 2020=1.0, 2021=1.0
    assert pd.isna(m.iloc[0]["value"])
    # 2020 should be diff(2.5 - 1.5) = 1.0
    val_2020 = m[m["year"] == 2020]["value"].iloc[0]
    assert math.isclose(val_2020, 1.0, abs_tol=1e-9)


def test_momentum_rejects_lookback_below_2():
    long = pd.DataFrame([{"country": "x", "year": 2020, "indicator_id": "A", "value": 1.0}])
    with pytest.raises(ValueError):
        fe.momentum(long, lookback_years=1)


# ---------- cross_indicator_ratios ----------


def test_cross_indicator_ratios_emits_derived_ratios():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "DEBT", "value": 100.0},
        {"country": "x", "year": 2020, "indicator_id": "GDP", "value": 50.0},
    ])
    out = fe.cross_indicator_ratios(long, indicator_pairs=[("DEBT", "GDP")])
    ratio_rows = out[out["indicator_id"] == "DEBT__div__GDP"]
    assert len(ratio_rows) == 1
    assert ratio_rows.iloc[0]["value"] == 2.0


def test_cross_indicator_ratios_zero_denominator_yields_nan():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 5.0},
        {"country": "x", "year": 2020, "indicator_id": "B", "value": 0.0},
    ])
    out = fe.cross_indicator_ratios(long, indicator_pairs=[("A", "B")])
    ratio = out[out["indicator_id"] == "A__div__B"]
    assert ratio["value"].isna().all()


def test_cross_indicator_ratios_missing_pair_silently_skipped():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 1.0},
    ])
    out = fe.cross_indicator_ratios(long, indicator_pairs=[("A", "MISSING_B")])
    # No A__div__MISSING_B row should appear
    assert "A__div__MISSING_B" not in set(out["indicator_id"])


def test_cross_indicator_ratios_empty_pairs_returns_input_copy():
    long = _sample_long()
    out = fe.cross_indicator_ratios(long, indicator_pairs=[])
    pd.testing.assert_frame_equal(
        long.sort_values(["country", "year", "indicator_id"]).reset_index(drop=True),
        out.sort_values(["country", "year", "indicator_id"]).reset_index(drop=True),
    )


# ---------- missingness_indicators ----------


def test_missingness_indicators_flags_absent_country_year_cells():
    """Country x has indicator A in 2020 but NOT 2021. The 2021 cell is missing."""
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 1.0},
        {"country": "x", "year": 2021, "indicator_id": "B", "value": 2.0},  # other ind
    ])
    out = fe.missingness_indicators(long, indicator_ids=["A"])
    miss = out[out["indicator_id"] == "A__missing"]
    # Country x has 2 distinct (country, year) pairs in panel: 2020 + 2021
    assert len(miss) == 2
    # 2020: A present -> missing=0
    # 2021: A absent (only B present) -> missing=1
    miss_by_year = dict(zip(miss["year"], miss["value"]))
    assert miss_by_year[2020] == 0.0
    assert miss_by_year[2021] == 1.0


def test_missingness_indicators_default_covers_all_indicators():
    long = pd.DataFrame([
        {"country": "x", "year": 2020, "indicator_id": "A", "value": 1.0},
        {"country": "x", "year": 2020, "indicator_id": "B", "value": 2.0},
    ])
    out = fe.missingness_indicators(long)
    assert "A__missing" in set(out["indicator_id"])
    assert "B__missing" in set(out["indicator_id"])


# ---------- multiple_imputation_mice ----------


def test_mice_imputes_missing_values():
    """Smoke test: MICE reduces NaN count on a simple wide panel."""
    try:
        import sklearn  # noqa: F401
    except ImportError:
        pytest.skip("sklearn not installed")
    import numpy as np
    wide = pd.DataFrame({
        "country": ["x", "x", "x", "y", "y", "y"],
        "year": [2018, 2019, 2020, 2018, 2019, 2020],
        "A": [1.0, 2.0, 3.0, 10.0, 20.0, 30.0],
        "B": [2.0, 4.0, np.nan, 20.0, np.nan, 60.0],  # 2 NaN
    })
    out = fe.multiple_imputation_mice(wide, n_iter=5, random_state=0)
    # Shape preserved
    assert out.shape == wide.shape
    # No NaN remain in indicator columns
    assert not out["B"].isna().any()
    # country + year preserved
    assert list(out["country"]) == list(wide["country"])
    assert list(out["year"]) == list(wide["year"])


def test_mice_handles_empty_input():
    out = fe.multiple_imputation_mice(pd.DataFrame(), n_iter=5)
    assert out.empty


def test_mice_raises_without_country_year():
    try:
        import sklearn  # noqa: F401
    except ImportError:
        pytest.skip("sklearn not installed")
    bad = pd.DataFrame({"A": [1.0, 2.0]})
    with pytest.raises(ValueError, match="country.*year"):
        fe.multiple_imputation_mice(bad)
