"""Level + 3y-acceleration/deceleration transforms for the economic_recession enrichment
cycle's two lead candidates (PRE-REGISTRATION.md, committed 703e440):

  * `FD.AST.PRVT.GD.ZS` (private-credit/GDP) -- level + 3y-ACCELERATION.
      Rationale: a credit boom that is ACCELERATING (not just high) is the classic
      pre-crisis leading signal (Schularick-Taylor credit-boom literature); the level alone
      is already tested elsewhere, the acceleration transform targets the SHAPE.
  * `FM.LBL.BMNY.GD.ZS` (M2/GDP) -- level + 3y-DECELERATION.
      Rationale: a slowdown in monetary aggregate growth ahead of a downturn (direction
      flagged INCONCLUSIVE in the pre-reg -- tested here, not assumed).

Two representations per candidate:
  * LEVEL   -- the raw World-Bank series itself, unchanged (an identity pass-through;
              `build_level_panel` exists mainly so the pipeline has one canonical "clean the
              raw panel" step matching every other transform's calling convention -- the level
              candidate can equally be screened directly off the raw
              `data/parquet_panels/<id>/<id>.parquet` file with the SAME indicator id, no
              materialization needed).
  * 3y-ACCEL/DECEL -- a REAL-TIME, leakage-safe second difference on a 3-year lag:
      accel3[t] = (level[t] - level[t-3]) - (level[t-3] - level[t-6])
                = level[t] - 2*level[t-3] + level[t-6]
      decel3[t] = -accel3[t]
    Uses ONLY level observations AT OR BEFORE t (t, t-3, t-6) -- by construction it cannot
    depend on any future value. A row is emitted at year t only when ALL THREE anchor years
    are present in the source panel (no interpolation, no fill -- a genuine gap is a genuine
    gap). `decel3` is `accel3` negated so a POSITIVE decel3 value reads as "decelerating"
    (concave/slowing) and a POSITIVE accel3 value reads as "accelerating" (convex/speeding
    up) -- symmetric definitions, direction determined empirically downstream (pre-reg:
    M2/GDP's direction is explicitly flagged inconclusive, not assumed here).

Host-testable: pandas + numpy + pyarrow only (no ML stack for the transform math itself).
Structural sibling of `experiments/military-coup-enrichment/confound_check/panel_transforms.py`
(same `_clean` / per-country-groupby / leakage-safe-by-construction conventions) and
`experiments/military-coup-enrichment/build_coup_trap.py` (same `write_panels` production
panel_dir layout).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

PANEL_COLS = ["country", "year", "value"]

CREDIT_INDICATOR_ID = "FD.AST.PRVT.GD.ZS"
M2_INDICATOR_ID = "FM.LBL.BMNY.GD.ZS"
CREDIT_ACCEL_ID = "FD.AST.PRVT.GD.ZS__accel3"
M2_DECEL_ID = "FM.LBL.BMNY.GD.ZS__decel3"

DEFAULT_LAG = 3


def _clean(panel: pd.DataFrame) -> pd.DataFrame:
    """Drop null values, keep only the canonical (country, year, value) columns -- matches
    `panel_transforms._clean`'s convention in the military_coup confound-check module."""
    return panel.dropna(subset=["value"])[PANEL_COLS].reset_index(drop=True)


# ============================================================================================
# LEVEL -- identity pass-through.
# ============================================================================================
def build_level_panel(panel: pd.DataFrame) -> pd.DataFrame:
    """The raw series, cleaned to the canonical schema. No transform is applied -- this is
    the LEVEL representation. Provided mainly so the level candidate goes through the same
    `_clean` convention as every derived transform; downstream screens may equally read the
    raw `data/parquet_panels/<id>/<id>.parquet` file directly under the SAME indicator id."""
    return _clean(panel)


# ============================================================================================
# 3y-ACCELERATION -- real-time, leakage-safe second difference on a `lag`-year spacing.
# ============================================================================================
def build_3y_acceleration_panel(panel: pd.DataFrame, lag: int = DEFAULT_LAG) -> pd.DataFrame:
    """`accel3[t] = level[t] - 2*level[t-lag] + level[t-2*lag]` per country -- the change in
    the `lag`-year change (a second difference). Emits a row at year t only when level[t],
    level[t-lag], AND level[t-2*lag] are ALL present in the source panel (exact-year lookups,
    no interpolation/fill). Uses ONLY observations at or before t -- leakage-safe by
    construction (see `test_acceleration_is_leakage_safe_uses_only_past_and_present`)."""
    if lag <= 0:
        raise ValueError(f"build_3y_acceleration_panel: lag must be > 0, got {lag}")
    clean = _clean(panel)
    rows: list[dict] = []
    for country, grp in clean.groupby("country"):
        s = grp.set_index("year")["value"].sort_index()
        s = s[~s.index.duplicated(keep="last")]
        for year in s.index:
            y_mid = year - lag
            y_far = year - 2 * lag
            if y_mid in s.index and y_far in s.index:
                accel = float(s.loc[year] - 2.0 * s.loc[y_mid] + s.loc[y_far])
                rows.append({"country": country, "year": int(year), "value": accel})
    return pd.DataFrame(rows, columns=PANEL_COLS)


def build_3y_deceleration_panel(panel: pd.DataFrame, lag: int = DEFAULT_LAG) -> pd.DataFrame:
    """`decel3 = -accel3` -- a positive value reads as "decelerating" (concave/slowing)
    rather than "accelerating" (convex/speeding up). Same leakage-safety and anchor-year
    requirements as `build_3y_acceleration_panel` (implemented via that function, negated --
    never a parallel reimplementation that could silently drift)."""
    accel = build_3y_acceleration_panel(panel, lag=lag)
    out = accel.copy()
    out["value"] = -out["value"]
    return out


# ============================================================================================
# write_panels -- production panel_dir layout (verbatim pattern from build_coup_trap.py).
# ============================================================================================
def write_panels(frames: dict[str, pd.DataFrame], out_dir: str | Path) -> list[Path]:
    """Write each `{name: df}` to `out_dir/<name>/<name>.parquet`, matching the layout
    `scripts/run_f_ml_1_poc.load_panel` reads. Returns the list of written paths."""
    out_dir = Path(out_dir)
    written: list[Path] = []
    for name, df in frames.items():
        ind_dir = out_dir / name
        ind_dir.mkdir(parents=True, exist_ok=True)
        path = ind_dir / f"{name}.parquet"
        df.to_parquet(path, index=False)
        written.append(path)
    return written


# ============================================================================================
# CLI -- materialize the credit-accel3 and M2-decel3 derived panels from the real data lake.
# ============================================================================================
def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    qgi_ml_root = here.parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=qgi_ml_root / "data" / "parquet_panels")
    ap.add_argument("--out-dir", type=Path, default=here / "credit_m2_panel_dir")
    ap.add_argument("--lag", type=int, default=DEFAULT_LAG)
    args = ap.parse_args(argv)

    credit_panel = pd.read_parquet(args.panel_dir / CREDIT_INDICATOR_ID / f"{CREDIT_INDICATOR_ID}.parquet")
    m2_panel = pd.read_parquet(args.panel_dir / M2_INDICATOR_ID / f"{M2_INDICATOR_ID}.parquet")

    frames = {
        CREDIT_ACCEL_ID: build_3y_acceleration_panel(credit_panel, lag=args.lag),
        M2_DECEL_ID: build_3y_deceleration_panel(m2_panel, lag=args.lag),
    }
    written = write_panels(frames, args.out_dir)
    for name, path in zip(frames, written):
        print(f"[credit_m2_transforms] {name}: {len(frames[name])} rows -> {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
