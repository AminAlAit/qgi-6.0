"""D1 -- coverage-at-positive-cells screen for the economic_recession OECD-SCOPED REBOOT
(2026-07-11). Runs the SAME gate as the parent cycle's `screen_coverage.py`
(`>= 80% non-null at t-1 AND t-2 over the ACTUAL 250 recession event-years`) against the 5
new sourced candidates: BIS Basel-III credit-to-GDP gap, BIS real house-price YoY, WB GEM
equity, WDI Terms-of-Trade, and the export-weighted commodity-shock interaction.

Reuses `screen_coverage.py`'s `coverage_at_positive_cells_t1_and_t2`, `d1_verdict`, and
`_load_positives` VERBATIM (imported from the parent experiment dir, not re-implemented) so
this is genuinely the same gate that produced the prior cycle's 0.547-ceiling finding --
only the candidate set + panel_dir are new. Per the task mandate ("this is the real N, not
the roster estimate"), the report also lists the ACTUAL surviving (country, event_year) pairs
per candidate and the union across every PASS_COVERAGE candidate (`oecd_scoped_subset`).

Host-only: pandas + pyarrow. No joblib/xgboost/sklearn/scipy.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

_HERE = Path(__file__).resolve().parent
_PARENT_EXPERIMENT_DIR = _HERE.parent  # economic-recession-enrichment/ (has screen_coverage.py)
if str(_PARENT_EXPERIMENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_EXPERIMENT_DIR))

from screen_coverage import (  # noqa: E402  (path-injected import, see above)
    DEFAULT_THRESHOLD,
    _load_positives,
    coverage_at_positive_cells_t1_and_t2,
    d1_verdict,
    normalize_country_id,
    value_at_year,
)
from oecd_scope import filter_positives_to_oecd_scope  # noqa: E402

CANDIDATES = [
    "BIS.CREDIT_GAP.PRIV_NFC",
    "BIS.SPP.REAL.YOY",
    "DSTKMKTXD",
    "TT.PRI.MRCH.XD.WD",
    "COMMODITY_SHOCK.EXPORT_WEIGHTED",
]


def _load_positives_oecd_scoped(positives_csv: Path) -> pd.DataFrame:
    """Same output shape as `screen_coverage._load_positives` (`country`, `year`, normalized
    via `normalize_country_id`) but the underlying `positives.csv` rows are first restricted
    to `oecd_scope.OECD_SCOPED_COUNTRY_IDS` -- the ex-ante criterion, applied BEFORE
    normalization/lookup so it can never accidentally admit a non-scoped country via a name
    collision."""
    raw = pd.read_csv(positives_csv)
    scoped_raw = filter_positives_to_oecd_scope(raw)
    return pd.DataFrame(
        {
            "country": scoped_raw["country_id"].apply(normalize_country_id),
            "year": scoped_raw["event_year"].astype(int),
        }
    )


def _load_panel(panel_dir: Path, indicator_id: str) -> pd.DataFrame:
    return pd.read_parquet(panel_dir / indicator_id / f"{indicator_id}.parquet")


def _covered_events(panel: pd.DataFrame, positives: pd.DataFrame) -> list[dict[str, Any]]:
    """The actual (country, event_year) rows with a non-null value at BOTH t-1 AND t-2 --
    the real surviving event set the task mandates reporting (not just the aggregate %)."""
    covered = []
    for _, r in positives.iterrows():
        country, event_year = str(r["country"]), int(r["year"])
        has_t1 = value_at_year(panel, country, event_year - 1) is not None
        has_t2 = value_at_year(panel, country, event_year - 2) is not None
        if has_t1 and has_t2:
            covered.append({"country": country, "event_year": event_year})
    return covered


def screen_candidate(
    indicator_id: str, panel_dir: Path, positives: pd.DataFrame, threshold: float = DEFAULT_THRESHOLD
) -> dict[str, Any]:
    panel_path = panel_dir / indicator_id / f"{indicator_id}.parquet"
    if not panel_path.is_file():
        return {"indicator_id": indicator_id, "verdict": "MISSING_PANEL", "threshold": threshold}
    panel = _load_panel(panel_dir, indicator_id)
    stats = coverage_at_positive_cells_t1_and_t2(panel, positives)
    verdict = d1_verdict(stats["t1_and_t2_coverage_pct"], threshold=threshold)
    covered = _covered_events(panel, positives)
    return {
        "indicator_id": indicator_id,
        **stats,
        "verdict": verdict,
        "threshold": threshold,
        "panel_country_count": int(panel["country"].nunique()),
        "covered_events": covered,
    }


def _run_screen(
    positives: pd.DataFrame,
    candidates: list[str],
    panel_dir: Path,
    threshold: float,
    out_path: Path | None,
    label: str,
) -> dict[str, Any]:
    results: dict[str, Any] = {}
    for ind in candidates:
        results[ind] = screen_candidate(ind, panel_dir, positives, threshold=threshold)

    survivors = [c for c, r in results.items() if r["verdict"] == "PASS_COVERAGE"]
    rejected = [c for c, r in results.items() if r["verdict"] == "FAIL_COVERAGE"]
    missing = [c for c, r in results.items() if r["verdict"] == "MISSING_PANEL"]

    # The real, surviving OECD-scoped subset: the UNION of (country, event_year) pairs
    # covered by ANY PASS_COVERAGE candidate (a joint recipe could opportunistically draw on
    # whichever surviving driver has data for a given event) -- reported as both the raw
    # event-year list and the distinct country set, per the task's "real N, not roster
    # estimate" mandate.
    union_events: set[tuple[str, int]] = set()
    for c in survivors:
        for ev in results[c]["covered_events"]:
            union_events.add((ev["country"], ev["event_year"]))
    scoped_countries = sorted({c for c, _ in union_events})
    scoped_event_years = sorted(union_events, key=lambda x: (x[0], x[1]))

    out = {
        "label": label,
        "n_positive_events": len(positives),
        "threshold": threshold,
        "candidates": results,
        "survivors": survivors,
        "rejected": rejected,
        "missing_panel": missing,
        "oecd_scoped_subset": {
            "countries": scoped_countries,
            "n_countries": len(scoped_countries),
            "event_years": [{"country": c, "event_year": y} for c, y in scoped_event_years],
            "n_events": len(scoped_event_years),
        },
    }
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[screen_coverage_reboot:{label}] wrote {out_path}")
    for c, r in results.items():
        if r["verdict"] == "MISSING_PANEL":
            print(f"[screen_coverage_reboot:{label}] {c}: MISSING_PANEL")
        else:
            print(
                f"[screen_coverage_reboot:{label}] {c}: t1={r['t1_coverage_pct']}% t2={r['t2_coverage_pct']}% "
                f"t1&t2={r['t1_and_t2_coverage_pct']}% verdict={r['verdict']} "
                f"panel_countries={r['panel_country_count']}"
            )
    print(
        f"[screen_coverage_reboot:{label}] scoped subset (union of survivors): "
        f"{len(scoped_countries)} countries, {len(scoped_event_years)} events "
        f"(of {len(positives)} positives screened)"
    )
    return out


def run_screen_all(
    candidates: list[str] = CANDIDATES,
    panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    threshold: float = DEFAULT_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    """The GLOBAL screen: gate against ALL 250 positives / 106 countries (no scoping) -- the
    TRUE, honest coverage number these OECD-targeted indicators achieve on the full
    universal event set (expected to be low; these mechanisms structurally don't exist for
    most non-OECD countries)."""
    panel_dir = panel_dir or (_HERE / "panel_dir")
    positives_csv = positives_csv or (
        _HERE.parents[2] / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"
    )
    positives = _load_positives(positives_csv)
    return _run_screen(positives, candidates, panel_dir, threshold, out_path, label="global")


def run_screen_scoped(
    candidates: list[str] = CANDIDATES,
    panel_dir: Path | None = None,
    positives_csv: Path | None = None,
    threshold: float = DEFAULT_THRESHOLD,
    out_path: Path | None = None,
) -> dict[str, Any]:
    """The SCOPED screen: gate against ONLY the ex-ante OECD/advanced-economy positives
    (`oecd_scope.OECD_SCOPED_COUNTRY_IDS`) -- the actual test the reboot's pre-registration
    must be judged against, since these are OECD-targeted indicators by mechanism."""
    panel_dir = panel_dir or (_HERE / "panel_dir")
    positives_csv = positives_csv or (
        _HERE.parents[2] / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"
    )
    positives = _load_positives_oecd_scoped(positives_csv)
    return _run_screen(positives, candidates, panel_dir, threshold, out_path, label="oecd_scoped")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=None)
    ap.add_argument("--positives-csv", type=Path, default=None)
    ap.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument("--out-global", type=Path, default=_HERE / "results" / "d1_reboot_coverage_screen_global.json")
    ap.add_argument("--out-scoped", type=Path, default=_HERE / "results" / "d1_reboot_coverage_screen_scoped.json")
    args = ap.parse_args(argv)
    run_screen_all(
        panel_dir=args.panel_dir, positives_csv=args.positives_csv, threshold=args.threshold, out_path=args.out_global
    )
    run_screen_scoped(
        panel_dir=args.panel_dir, positives_csv=args.positives_csv, threshold=args.threshold, out_path=args.out_scoped
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
