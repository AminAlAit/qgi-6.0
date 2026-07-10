"""Tests for credit_m2_transforms.py -- level + 3y-acceleration/deceleration transforms for
the economic_recession enrichment cycle's two candidates:
  * FD.AST.PRVT.GD.ZS (private-credit/GDP): level + 3y-acceleration.
  * FM.LBL.BMNY.GD.ZS (M2/GDP): level + 3y-deceleration.

Per PRE-REGISTRATION.md (committed 703e440). Host-testable: pandas + numpy + pyarrow only
(no ML stack needed for the transform math itself).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import credit_m2_transforms as t  # noqa: E402

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
REAL_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"


def _toy_panel(country: str, years: list[int], values: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"country": [country] * len(years), "year": years, "value": values})


# ============================================================================================
# build_level_panel -- identity pass-through (drops nulls, keeps the 3 canonical columns).
# ============================================================================================
def test_level_panel_is_identity_on_clean_data():
    panel = _toy_panel("Chile", [2000, 2001, 2002], [10.0, 11.0, 12.0])
    out = t.build_level_panel(panel)
    assert list(out["value"]) == [10.0, 11.0, 12.0]
    assert list(out["year"]) == [2000, 2001, 2002]


def test_level_panel_drops_null_values():
    panel = pd.DataFrame({"country": ["Chile", "Chile"], "year": [2000, 2001],
                           "value": [10.0, np.nan]})
    out = t.build_level_panel(panel)
    assert len(out) == 1
    assert out.iloc[0]["year"] == 2000


def test_level_panel_keeps_only_canonical_columns():
    panel = pd.DataFrame({"country": ["Chile"], "year": [2000], "value": [10.0],
                           "provider": ["WB"]})
    out = t.build_level_panel(panel)
    assert list(out.columns) == ["country", "year", "value"]


# ============================================================================================
# build_3y_acceleration_panel -- accel3[t] = level[t] - 2*level[t-3] + level[t-6]
# (the change in the 3-year change; a second difference on a 3-year lag).
# ============================================================================================
def test_acceleration_formula_on_linear_series_is_zero():
    """A perfectly linear series has constant slope -> zero second difference (no
    acceleration) at every interior point where all three anchors exist."""
    years = list(range(2000, 2013))
    values = [float(y - 2000) * 2.0 for y in years]  # linear: value = 2*(year-2000)
    panel = _toy_panel("Chile", years, values)
    out = t.build_3y_acceleration_panel(panel)
    row = out[out["year"] == 2012]
    assert len(row) == 1
    assert row.iloc[0]["value"] == pytest.approx(0.0, abs=1e-9)


def test_acceleration_formula_on_quadratic_series_is_nonzero_and_correct_sign():
    """A convex (accelerating) series should yield a POSITIVE accel3 value."""
    years = list(range(2000, 2013))
    values = [float((y - 2000) ** 2) for y in years]  # convex: value = (year-2000)^2
    panel = _toy_panel("Chile", years, values)
    out = t.build_3y_acceleration_panel(panel)
    row = out[out["year"] == 2012]
    level = {y: v for y, v in zip(years, values)}
    expected = level[2012] - 2 * level[2009] + level[2006]
    assert row.iloc[0]["value"] == pytest.approx(expected)
    assert expected > 0  # convex series -> positive acceleration, sanity check on the fixture


def test_acceleration_requires_all_three_anchor_years():
    """A row is only emitted at year t if level[t], level[t-3], and level[t-6] are ALL
    present -- a genuine gap must not be silently imputed or dropped-in as zero."""
    panel = _toy_panel("Chile", [2000, 2003, 2006, 2009], [1.0, 2.0, 3.0, 4.0])
    # 2009 - 6 = 2003 (present), 2009 - 3 = 2006 (present) -> should compute
    # 2006 - 6 = 2000 (present), 2006 - 3 = 2003 (present) -> should compute
    # 2003: 2003-6=1997 (absent) -> should NOT compute
    out = t.build_3y_acceleration_panel(panel)
    computed_years = sorted(out["year"].tolist())
    assert 2003 not in computed_years
    assert 2006 in computed_years
    assert 2009 in computed_years


def test_acceleration_is_leakage_safe_uses_only_past_and_present():
    """accel3 at year t must never change if a FUTURE year's value changes -- it is a pure
    function of level at {t, t-3, t-6}."""
    years = list(range(2000, 2013))
    values = [float((y - 2000) ** 2) for y in years]
    panel_a = _toy_panel("Chile", years, values)
    out_a = t.build_3y_acceleration_panel(panel_a)
    val_at_2012_a = out_a[out_a["year"] == 2012].iloc[0]["value"]

    # Mutate years AFTER the anchor set used for t=2009 (accel3[2009] depends only on
    # {2009, 2006, 2003}) -- 2012, 2011, 2010 are all strictly later than every anchor used
    # to compute accel3[2009], so the t=2009 result must be UNCHANGED.
    values_mutated_future = list(values)
    values_mutated_future[years.index(2012)] = 99999.0
    values_mutated_future[years.index(2011)] = -99999.0
    values_mutated_future[years.index(2010)] = 12345.0
    panel_b = _toy_panel("Chile", years, values_mutated_future)
    out_b = t.build_3y_acceleration_panel(panel_b)
    val_at_2009_a = out_a[out_a["year"] == 2009].iloc[0]["value"]
    val_at_2009_b = out_b[out_b["year"] == 2009].iloc[0]["value"]
    assert val_at_2009_a == pytest.approx(val_at_2009_b)
    # accel3[2012] DOES legitimately change (2012 is itself one of its own anchors) --
    # confirms the mutation actually took effect and this isn't a vacuous no-op test.
    val_at_2012_b = out_b[out_b["year"] == 2012].iloc[0]["value"]
    assert val_at_2012_b == pytest.approx(
        99999.0 - 2 * values[years.index(2009)] + values[years.index(2006)]
    )
    assert val_at_2012_a != pytest.approx(val_at_2012_b)


def test_acceleration_is_per_country_no_cross_country_leakage():
    panel = pd.concat([
        _toy_panel("Chile", list(range(2000, 2013)), [float((y - 2000) ** 2) for y in range(2000, 2013)]),
        _toy_panel("Peru", list(range(2000, 2013)), [1000.0] * 13),  # constant -> zero accel
    ], ignore_index=True)
    out = t.build_3y_acceleration_panel(panel)
    peru_row = out[(out["country"] == "Peru") & (out["year"] == 2012)]
    assert peru_row.iloc[0]["value"] == pytest.approx(0.0)
    chile_row = out[(out["country"] == "Chile") & (out["year"] == 2012)]
    assert chile_row.iloc[0]["value"] != pytest.approx(0.0)


def test_acceleration_lag_is_parameterized():
    """A different `lag` still applies the same second-difference formula, just at a
    different spacing -- exercised at lag=2 for coverage of the general case."""
    years = list(range(2000, 2013))
    values = [float(y - 2000) for y in years]  # linear -> zero accel regardless of lag
    panel = _toy_panel("Chile", years, values)
    out = t.build_3y_acceleration_panel(panel, lag=2)
    row = out[out["year"] == 2012]
    assert row.iloc[0]["value"] == pytest.approx(0.0, abs=1e-9)


def test_acceleration_rejects_nonpositive_lag():
    with pytest.raises(ValueError):
        t.build_3y_acceleration_panel(_toy_panel("Chile", [2000], [1.0]), lag=0)


# ============================================================================================
# build_3y_deceleration_panel -- decel3 = -accel3 (positive value = decelerating).
# ============================================================================================
def test_deceleration_is_negation_of_acceleration():
    years = list(range(2000, 2013))
    values = [float((y - 2000) ** 2) for y in years]
    panel = _toy_panel("Chile", years, values)
    accel = t.build_3y_acceleration_panel(panel)
    decel = t.build_3y_deceleration_panel(panel)
    merged = accel.merge(decel, on=["country", "year"], suffixes=("_accel", "_decel"))
    assert len(merged) > 0
    for _, row in merged.iterrows():
        assert row["value_decel"] == pytest.approx(-row["value_accel"])


def test_deceleration_positive_when_series_decelerates():
    """A CONCAVE series (decelerating growth) should yield a POSITIVE decel3 value."""
    years = list(range(2000, 2013))
    values = [-float((y - 2000) ** 2) for y in years]  # concave
    panel = _toy_panel("Chile", years, values)
    out = t.build_3y_deceleration_panel(panel)
    row = out[out["year"] == 2012]
    assert row.iloc[0]["value"] > 0


# ============================================================================================
# write_panels -- production panel_dir layout (mirrors build_coup_trap.write_panels).
# ============================================================================================
def test_write_panels_produces_expected_layout(tmp_path):
    frames = {
        "FD.AST.PRVT.GD.ZS__accel3": _toy_panel("Chile", [2009], [1.0]),
        "FM.LBL.BMNY.GD.ZS__decel3": _toy_panel("Chile", [2009], [2.0]),
    }
    written = t.write_panels(frames, tmp_path)
    assert len(written) == 2
    for name in frames:
        p = tmp_path / name / f"{name}.parquet"
        assert p.is_file()
        assert p in written
        df = pd.read_parquet(p)
        assert list(df.columns) == ["country", "year", "value"]


# ============================================================================================
# End-to-end sanity on REAL panel data (host-only, no Docker).
# ============================================================================================
@pytest.mark.parametrize("indicator_id,builder_name", [
    ("FD.AST.PRVT.GD.ZS", "build_3y_acceleration_panel"),
    ("FM.LBL.BMNY.GD.ZS", "build_3y_deceleration_panel"),
])
def test_real_panel_transform_produces_nonempty_output(indicator_id, builder_name):
    panel_path = REAL_PANEL_DIR / indicator_id / f"{indicator_id}.parquet"
    if not panel_path.is_file():
        pytest.skip("real panel data not present in this checkout")
    panel = pd.read_parquet(panel_path)
    builder = getattr(t, builder_name)
    out = builder(panel)
    assert len(out) > 0
    assert list(out.columns) == ["country", "year", "value"]
    assert out["value"].notna().all()


def test_credit_and_m2_candidate_ids_match_pre_registration():
    assert t.CREDIT_INDICATOR_ID == "FD.AST.PRVT.GD.ZS"
    assert t.M2_INDICATOR_ID == "FM.LBL.BMNY.GD.ZS"
    assert t.CREDIT_ACCEL_ID == "FD.AST.PRVT.GD.ZS__accel3"
    assert t.M2_DECEL_ID == "FM.LBL.BMNY.GD.ZS__decel3"
