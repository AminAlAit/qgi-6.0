"""Tests for `screen_coverage_reboot.py` -- runs the SAME D1 coverage-at-positive-cells gate
(>=80% non-null at t-1 AND t-2 over the ACTUAL 250 recession event-years, per
`screen_coverage.py`) against the 5 new reboot candidates. Reuses `screen_coverage.py`'s own
`coverage_at_positive_cells_t1_and_t2` / `d1_verdict` / `_load_positives` functions verbatim
(imported, not re-implemented) so the gate is byte-identical to the one that produced the
prior cycle's 0.547 ceiling finding -- only the candidate panels + panel_dir are new. Written
before `screen_coverage_reboot.py`.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from screen_coverage_reboot import CANDIDATES, run_screen_all, run_screen_scoped

HERE = Path(__file__).resolve().parent
PANEL_DIR = HERE / "panel_dir"
POSITIVES_CSV = HERE.parents[2] / "data" / "shape_inputs_v2" / "economic_recession" / "positives.csv"


def test_candidates_list_has_all_5_reboot_indicators():
    assert set(CANDIDATES) == {
        "BIS.CREDIT_GAP.PRIV_NFC",
        "BIS.SPP.REAL.YOY",
        "DSTKMKTXD",
        "TT.PRI.MRCH.XD.WD",
        "COMMODITY_SHOCK.EXPORT_WEIGHTED",
    }


def test_run_screen_all_against_real_panels_and_positives(tmp_path: Path):
    out = run_screen_all(panel_dir=PANEL_DIR, positives_csv=POSITIVES_CSV, out_path=tmp_path / "report.json")
    assert out["n_positive_events"] == 250
    assert set(out["candidates"].keys()) == set(CANDIDATES)
    for cid, r in out["candidates"].items():
        assert r["verdict"] in {"PASS_COVERAGE", "FAIL_COVERAGE", "MISSING_PANEL"}
        if r["verdict"] != "MISSING_PANEL":
            assert 0.0 <= r["t1_and_t2_coverage_pct"] <= 100.0


def test_report_has_survivors_rejected_missing_partition():
    out = run_screen_all(panel_dir=PANEL_DIR, positives_csv=POSITIVES_CSV, out_path=None)
    all_flagged = set(out["survivors"]) | set(out["rejected"]) | set(out["missing_panel"])
    assert all_flagged == set(CANDIDATES)
    # No candidate double-counted across buckets.
    assert len(out["survivors"]) + len(out["rejected"]) + len(out["missing_panel"]) == len(CANDIDATES)


def test_oecd_scoped_subset_reported_for_survivors():
    # The task requires the SURVIVING OECD-scoped country/event subset to be reported, not
    # just a pass/fail verdict -- this is the "real N" the task asks for.
    out = run_screen_all(panel_dir=PANEL_DIR, positives_csv=POSITIVES_CSV, out_path=None)
    assert "oecd_scoped_subset" in out
    scoped = out["oecd_scoped_subset"]
    assert "event_years" in scoped and "countries" in scoped
    assert isinstance(scoped["event_years"], list)
    assert isinstance(scoped["countries"], list)


def test_run_screen_scoped_restricts_to_oecd_positives_before_gating():
    # The real methodological test: run the SAME D1 gate, but with the denominator restricted
    # to the ex-ante OECD-scoped positives (oecd_scope.py), not the full 250-event set. This
    # is expected to show materially HIGHER coverage than the global screen (these are
    # OECD-targeted indicators), and is the actual number the reboot's pre-registration must
    # be judged against.
    out_global = run_screen_all(panel_dir=PANEL_DIR, positives_csv=POSITIVES_CSV, out_path=None)
    out_scoped = run_screen_scoped(panel_dir=PANEL_DIR, positives_csv=POSITIVES_CSV, out_path=None)
    assert out_scoped["n_positive_events"] < out_global["n_positive_events"]
    assert out_scoped["n_positive_events"] > 0
    for cid in CANDIDATES:
        g = out_global["candidates"][cid]
        s = out_scoped["candidates"][cid]
        if g["verdict"] != "MISSING_PANEL" and s["verdict"] != "MISSING_PANEL":
            # Scoped coverage must be >= global coverage (same panel, smaller/aligned
            # denominator of exactly the countries the indicator was built for) -- a
            # regression here would mean the scoping logic is broken, not a real finding.
            assert s["t1_and_t2_coverage_pct"] >= g["t1_and_t2_coverage_pct"]


def test_run_screen_scoped_reports_which_candidates_clear_80pct():
    out_scoped = run_screen_scoped(panel_dir=PANEL_DIR, positives_csv=POSITIVES_CSV, out_path=None)
    assert "survivors" in out_scoped
    # Every survivor must actually have >=80% scoped coverage (no off-by-one in the wiring).
    for cid in out_scoped["survivors"]:
        assert out_scoped["candidates"][cid]["t1_and_t2_coverage_pct"] >= 80.0
