"""Build the two direct-pass-through World Bank API indicators into the `panel_dir` layout:

  * `DSTKMKTXD`       -- GEM stock-market total-return index (equity mechanism).
  * `TT.PRI.MRCH.XD.WD` -- WDI net barter Terms-of-Trade index (near-universal ToT lever).

Both are raw WB series -- no derived transform, just `wb_json_to_panel` + write. Source pulls
(curl, HTTP 200, confirmed 2026-07-11):
  DSTKMKTXD:        https://api.worldbank.org/v2/country/all/indicator/DSTKMKTXD
  TT.PRI.MRCH.XD.WD: https://api.worldbank.org/v2/country/all/indicator/TT.PRI.MRCH.XD.WD
Host-testable: pandas + pyarrow only.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from wb_json_utils import wb_json_to_panel

GEM_EQUITY_ID = "DSTKMKTXD"
TOT_ID = "TT.PRI.MRCH.XD.WD"


def build_indicator(raw_json_path: Path) -> pd.DataFrame:
    return wb_json_to_panel(raw_json_path)


def write_panel(panel: pd.DataFrame, panel_dir: Path, indicator_id: str) -> Path:
    out_dir = panel_dir / indicator_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{indicator_id}.parquet"
    panel.to_parquet(out_path, index=False)
    return out_path


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw-dir", type=Path, default=here / "raw")
    ap.add_argument("--panel-dir", type=Path, default=here / "panel_dir")
    args = ap.parse_args(argv)

    for indicator_id, raw_file in [
        (GEM_EQUITY_ID, "wb_gem_equity_all.json"),
        (TOT_ID, "wb_tot_all.json"),
    ]:
        panel = build_indicator(args.raw_dir / raw_file)
        out_path = write_panel(panel, args.panel_dir, indicator_id)
        print(f"[build_wb_direct] {indicator_id}: {len(panel)} rows, "
              f"{panel['country'].nunique()} countries -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
