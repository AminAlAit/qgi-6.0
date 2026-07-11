"""Pure panel-placebo transforms for the economic_recession OECD-SCOPED REBOOT battery
(2026-07-11). Reproduces (not imports) the two proven placebo transforms from
`banking-enrichment/em_test/confound_missingness_placebo.py` -- reproduced rather than
imported because that module's orchestration entrypoint pulls in `em_classification` /
`subset_utils` (banking/EM-specific hard dependencies this cycle has no use for); this
cycle's own convention (see `oecd_scope.py`, `screen_coverage_reboot.py`) is to stay
import-light. Both functions are byte-identical in behavior to the originals -- see
test_panel_placebo_reboot.py.

  (a) has-data DUMMY: same (country, year) cells the real indicator has data for, value
      replaced by a constant. If a "lift" survives on a dummy carrying NO information beyond
      "this country/year has a reported value for this indicator", the apparent signal is
      just proxying coverage structure (e.g. "is OECD" / "has BIS reporting"), not the
      indicator's actual values.
  (b) VALUES-SCRAMBLED, MASK-PRESERVED permutation: the same cells carry data, but the
      magnitudes are shuffled panel-wide (breaking any real value<->label relationship)
      while the coverage/censoring pattern stays identical.

Host-only: pandas + numpy.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def build_has_data_dummy_panel(panel: pd.DataFrame, fill_value: float = 1.0) -> pd.DataFrame:
    """Same (country, year) coverage mask as `panel`, `value` replaced by the constant
    `fill_value` everywhere data was present. Null cells are dropped (they carry no coverage
    signal either way) -- matches `extract_features_for_indicator`'s downstream `.dropna()`
    convention."""
    dummy = panel.dropna(subset=["value"]).copy()
    dummy["value"] = float(fill_value)
    return dummy.reset_index(drop=True)


def permute_values_mask_preserved(panel: pd.DataFrame, seed: int) -> pd.DataFrame:
    """Keep the EXACT set of (country, year) cells that have data (the coverage mask), but
    shuffle the VALUES panel-wide (across countries/years, not within-country) with a seeded
    RNG. Deterministic for a given seed; breaks any genuine value<->label relationship while
    leaving the censoring pattern untouched."""
    non_null = panel.dropna(subset=["value"]).reset_index(drop=True)
    rng = np.random.default_rng(seed)
    shuffled_values = rng.permutation(non_null["value"].to_numpy())
    out = non_null.copy()
    out["value"] = shuffled_values
    return out


def assert_mask_preserved(original: pd.DataFrame, transformed: pd.DataFrame) -> None:
    """Sanity guard: `transformed` must cover EXACTLY the same (country, year) cells as
    `original`'s non-null rows -- no cell added, none dropped."""
    orig_cells = set(zip(original.dropna(subset=["value"])["country"], original.dropna(subset=["value"])["year"]))
    new_cells = set(zip(transformed["country"], transformed["year"]))
    if orig_cells != new_cells:
        missing = orig_cells - new_cells
        added = new_cells - orig_cells
        raise AssertionError(
            f"assert_mask_preserved: coverage mask changed -- missing={missing!r} added={added!r}"
        )
