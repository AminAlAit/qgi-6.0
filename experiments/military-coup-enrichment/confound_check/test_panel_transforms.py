"""Host-testable unit tests for `panel_transforms.py` (pure pandas/numpy, no ML stack).
Run: python -m pytest experiments/military-coup-enrichment/confound_check/test_panel_transforms.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import panel_transforms as pt  # noqa: E402


def _panel(rows: list[tuple[str, int, float]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["country", "year", "value"])


# ============================================================================================
# shift_panel_forward
# ============================================================================================
class TestShiftPanelForward:
    def test_shift_zero_is_identity(self):
        p = _panel([("A", 2000, 1.0), ("A", 2001, 0.0)])
        out = pt.shift_panel_forward(p, 0)
        pd.testing.assert_frame_equal(out.sort_values("year").reset_index(drop=True),
                                       p.sort_values("year").reset_index(drop=True))

    def test_shift_moves_years_forward_preserves_values(self):
        p = _panel([("A", 2000, 1.0), ("A", 2001, 0.0)])
        out = pt.shift_panel_forward(p, 3)
        got = dict(zip(out["year"], out["value"]))
        assert got == {2003: 1.0, 2004: 0.0}

    def test_shift_pushes_window_further_into_the_past(self):
        """The whole point: extract_features_for_indicator reads year-1 and earlier.
        Querying the SHIFTED panel at some event_year for `year-1` must resolve to the
        ORIGINAL panel's `event_year - 1 - shift` -- strictly further back, never forward."""
        p = _panel([("A", 1970, 1.0)])
        shifted = pt.shift_panel_forward(p, shift_years=4)
        # event_year - 1 == 1974 in the shifted panel maps back to original year 1970.
        row = shifted[(shifted["country"] == "A") & (shifted["year"] == 1974)]
        assert len(row) == 1
        assert row["value"].iloc[0] == 1.0

    def test_negative_shift_rejected(self):
        p = _panel([("A", 2000, 1.0)])
        with pytest.raises(ValueError):
            pt.shift_panel_forward(p, -1)

    def test_drops_null_values(self):
        p = pd.DataFrame({"country": ["A", "A"], "year": [2000, 2001], "value": [1.0, None]})
        out = pt.shift_panel_forward(p, 1)
        assert len(out) == 1
        assert out["year"].iloc[0] == 2001


# ============================================================================================
# build_cum_drop_panel
# ============================================================================================
class TestBuildCumDropPanel:
    def test_basic_decline_detected(self):
        p = _panel([("A", 2000, 0.8), ("A", 2005, 0.3)])
        out = pt.build_cum_drop_panel(p, window=5)
        row = out[(out["country"] == "A") & (out["year"] == 2005)]
        assert row["value"].iloc[0] == pytest.approx(0.5)

    def test_one_sided_rise_clips_to_zero(self):
        p = _panel([("A", 2000, 0.3), ("A", 2005, 0.8)])
        out = pt.build_cum_drop_panel(p, window=5)
        row = out[(out["country"] == "A") & (out["year"] == 2005)]
        assert row["value"].iloc[0] == 0.0

    def test_missing_prior_year_dropped_not_imputed(self):
        p = _panel([("A", 2005, 0.3)])  # no 2000 observation
        out = pt.build_cum_drop_panel(p, window=5)
        assert out.empty

    def test_only_uses_data_at_or_before_t_no_future_year_present_in_computation(self):
        """A decline visible only via a LATER year (2010) must not appear at year 2005."""
        p = _panel([("A", 2000, 0.8), ("A", 2005, 0.75), ("A", 2010, 0.1)])
        out = pt.build_cum_drop_panel(p, window=5)
        row_2005 = out[(out["country"] == "A") & (out["year"] == 2005)]
        # decline from 2000->2005 is tiny (0.05), NOT the eventual 2000->2010 collapse.
        assert row_2005["value"].iloc[0] == pytest.approx(0.05)

    def test_invalid_window_rejected(self):
        p = _panel([("A", 2000, 0.8)])
        with pytest.raises(ValueError):
            pt.build_cum_drop_panel(p, window=0)


# ============================================================================================
# build_zscore_decline_panel
# ============================================================================================
class TestBuildZscoreDeclinePanel:
    def test_stable_series_no_signal(self):
        # Constant series -> change is always 0 -> rolling_std is 0 -> rows dropped.
        p = _panel([("A", y, 0.5) for y in range(2000, 2015)])
        out = pt.build_zscore_decline_panel(p, roll_window=5, min_periods=3)
        assert out.empty or (out["value"] == 0.0).all()

    def test_sharp_decline_scores_positive(self):
        vals = [0.5] * 10 + [0.5, 0.4, 0.3, 0.2, 0.1]  # small noise then a sharp multi-year drop
        p = _panel([("A", 2000 + i, v) for i, v in enumerate(vals)])
        out = pt.build_zscore_decline_panel(p, roll_window=5, min_periods=3)
        last_year = 2000 + len(vals) - 1
        row = out[(out["country"] == "A") & (out["year"] == last_year)]
        assert not row.empty
        assert row["value"].iloc[0] > 0.0

    def test_rise_clips_to_zero(self):
        vals = [0.3] * 10 + [0.3, 0.4, 0.5, 0.6, 0.7]  # rising, not declining
        p = _panel([("A", 2000 + i, v) for i, v in enumerate(vals)])
        out = pt.build_zscore_decline_panel(p, roll_window=5, min_periods=3)
        last_year = 2000 + len(vals) - 1
        row = out[(out["country"] == "A") & (out["year"] == last_year)]
        if not row.empty:
            assert row["value"].iloc[0] == 0.0

    def test_causal_no_future_leak(self):
        """Two panels identical through year Y, diverging only AFTER Y, must produce the
        IDENTICAL value at year Y (the defining leakage-safety property)."""
        common = [0.5, 0.5, 0.5, 0.45, 0.3, 0.2]
        p_a = _panel([("A", 2000 + i, v) for i, v in enumerate(common + [0.1, 0.05])])
        p_b = _panel([("A", 2000 + i, v) for i, v in enumerate(common + [0.9, 0.9])])
        out_a = pt.build_zscore_decline_panel(p_a, roll_window=5, min_periods=3)
        out_b = pt.build_zscore_decline_panel(p_b, roll_window=5, min_periods=3)
        y_cut = 2000 + len(common) - 1
        va = out_a[out_a["year"] == y_cut]["value"]
        vb = out_b[out_b["year"] == y_cut]["value"]
        assert len(va) == len(vb) == 1
        assert va.iloc[0] == pytest.approx(vb.iloc[0])

    def test_invalid_roll_window_rejected(self):
        p = _panel([("A", 2000, 0.5)])
        with pytest.raises(ValueError):
            pt.build_zscore_decline_panel(p, roll_window=1)


# ============================================================================================
# build_strict_episode_panel
# ============================================================================================
class TestBuildStrictEpisodePanel:
    def test_chile_1973_worked_example(self):
        """From the repo's own OWID_AUTOCRATIZATION panel: Chile aut_ep flips on at 1972,
        off at 1975 (episode 1972-1974). At margin_years=2 the 1972 row (== event_year-1 for
        the 1973 coup) must be zeroed -- too fresh to trust; 1974 (2 years into the episode)
        must survive."""
        p = _panel([
            ("Chile", 1970, 0.0), ("Chile", 1971, 0.0),
            ("Chile", 1972, 1.0), ("Chile", 1973, 1.0), ("Chile", 1974, 1.0),
            ("Chile", 1975, 0.0), ("Chile", 1976, 0.0),
        ])
        out = pt.build_strict_episode_panel(p, margin_years=2)
        by_year = dict(zip(out["year"], out["value"]))
        assert by_year[1972] == 0.0  # 0 years into the episode -- zeroed
        assert by_year[1973] == 0.0  # 1 year into the episode -- still zeroed
        assert by_year[1974] == 1.0  # 2 years into the episode -- survives
        assert by_year[1975] == 0.0  # episode over

    def test_margin_zero_is_identity_on_the_binary_flag(self):
        p = _panel([("A", 2000, 0.0), ("A", 2001, 1.0), ("A", 2002, 1.0)])
        out = pt.build_strict_episode_panel(p, margin_years=0)
        by_year = dict(zip(out["year"], out["value"]))
        assert by_year == {2000: 0.0, 2001: 1.0, 2002: 1.0}

    def test_gap_year_restarts_the_run(self):
        # 1 for 3 straight years, then a MISSING year (not a 0 -- a gap in the panel), then 1
        # again should be treated as a NEW episode (run-length can't bridge a data gap).
        p = _panel([
            ("A", 2000, 1.0), ("A", 2001, 1.0), ("A", 2002, 1.0),
            ("A", 2004, 1.0), ("A", 2005, 1.0), ("A", 2006, 1.0),
        ])
        out = pt.build_strict_episode_panel(p, margin_years=2)
        by_year = dict(zip(out["year"], out["value"]))
        assert by_year[2002] == 1.0  # 2 years into the FIRST run
        assert by_year[2004] == 0.0  # 0 years into the NEW (post-gap) run
        assert by_year[2006] == 1.0  # 2 years into the new run

    def test_multiple_separate_episodes_each_get_own_start(self):
        p = _panel([
            ("A", 2000, 1.0), ("A", 2001, 1.0), ("A", 2002, 0.0),
            ("A", 2003, 0.0), ("A", 2004, 1.0), ("A", 2005, 1.0), ("A", 2006, 1.0),
        ])
        out = pt.build_strict_episode_panel(p, margin_years=2)
        by_year = dict(zip(out["year"], out["value"]))
        assert by_year[2000] == 0.0  # 0 yrs into episode 1 -- zeroed
        assert by_year[2001] == 0.0  # 1 yr into episode 1 -- zeroed (episode 1 too short to ever pass)
        assert by_year[2004] == 0.0  # 0 yrs into episode 2 -- zeroed
        assert by_year[2005] == 0.0  # 1 yr into episode 2 -- zeroed
        assert by_year[2006] == 1.0  # 2 yrs into episode 2 -- survives

    def test_negative_margin_rejected(self):
        p = _panel([("A", 2000, 1.0)])
        with pytest.raises(ValueError):
            pt.build_strict_episode_panel(p, margin_years=-1)

    def test_output_is_binary(self):
        p = _panel([("A", 2000, 1.0), ("A", 2001, 1.0), ("A", 2002, 0.0)])
        out = pt.build_strict_episode_panel(p, margin_years=1)
        assert set(out["value"].unique()) <= {0.0, 1.0}
