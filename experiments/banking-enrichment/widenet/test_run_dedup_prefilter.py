"""Unit tests for run_dedup_prefilter.run_dedup's ORCHESTRATION logic.

The real dedup pass needs the full ML stack (run_f_ml_1_poc -> joblib/xgboost via
stability_select.correlation_dedup -> build_X_y) and only runs inside the pinned Docker image
(see run_dedup_prefilter.py's module docstring for the real invocation). This test instead
injects FAKE walk / stability_select modules so the orchestration itself -- which functions get
called, in what order, with what arguments, and how the report dict is assembled -- is verified
on a plain host Python with only pandas (no joblib/xgboost/sklearn needed).
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_dedup_prefilter as rdp  # noqa: E402


class _FakeWalk:
    """Records every call it receives so tests can assert on the exact call arguments."""

    pd = pd

    def __init__(self, panels_by_dir: dict[Path, dict[str, pd.DataFrame]],
                 univariate_scores: dict[str, float]):
        self._panels_by_dir = panels_by_dir
        self._univariate_scores = univariate_scores
        self.calls: list[tuple] = []

    def normalize_country_id(self, cid: str) -> str:
        return cid.replace("_", " ").title()

    def build_samples(self, pos, negatives_per_positive, seed):
        self.calls.append(("build_samples", negatives_per_positive, seed))
        # Minimal deterministic sample frame: just the positives, no negatives needed for
        # this orchestration-level test.
        out = pos[["country", "year", "label"]].copy()
        return out

    def list_candidate_indicators(self, panel_dir):
        return sorted(self._panels_by_dir[panel_dir].keys())

    def load_panel(self, ind, panel_dir):
        return self._panels_by_dir[panel_dir][ind]

    def univariate_loco_screen(self, samples, candidates, panels):
        self.calls.append(("univariate_loco_screen", tuple(candidates)))
        scores = {c: {"univariate_loco_auc": self._univariate_scores.get(c, 0.5)} for c in candidates}
        return list(candidates), scores


class _FakeStabilitySelect:
    ABS_R_THRESHOLD = 0.85
    DEDUP_WINDOW = 10
    DEDUP_MIN_COMMON = 30

    def __init__(self, survivors: list[str], cluster_map: dict[str, list[str]]):
        self._survivors = survivors
        self._cluster_map = cluster_map
        self.calls: list[tuple] = []

    def correlation_dedup(self, all_candidates, samples, panels, scores, abs_r=0.85):
        self.calls.append(("correlation_dedup", tuple(all_candidates), abs_r))
        return self._survivors, self._cluster_map


def _positives_csv(tmp_path) -> Path:
    p = tmp_path / "positives.csv"
    p.write_text(
        "country_id,event_year\nalbania,1997\nturkiye,2001\nbrazil,1994\n",
        encoding="utf-8",
    )
    return p


def _panel(countries, years=(2000, 2010)):
    rows = [{"country": c, "year": y, "value": float(y)} for c in countries for y in range(*years)]
    return pd.DataFrame(rows)


def test_run_dedup_report_shape_and_survivor_passthrough(tmp_path):
    panel_dir = tmp_path / "merged"
    panels = {
        "ind_a": _panel(["Albania", "Turkiye", "Brazil"]),
        "ind_b": _panel(["Albania", "Turkiye", "Brazil"]),  # near-dup of ind_a (fake dedup merges them)
        "ind_c": _panel(["Albania", "Turkiye", "Brazil"]),  # independent
    }
    walk = _FakeWalk({panel_dir: panels}, univariate_scores={"ind_a": 0.7, "ind_b": 0.6, "ind_c": 0.55})
    ss = _FakeStabilitySelect(
        survivors=["ind_a", "ind_c"],
        cluster_map={"ind_a": ["ind_a", "ind_b"], "ind_c": ["ind_c"]},
    )

    report = rdp.run_dedup(panel_dir, _positives_csv(tmp_path), walk, ss, seed=999)

    assert report["seed"] == 999
    assert report["n_candidates_before"] == 3
    assert report["n_survivors_after"] == 2
    assert report["survivors"] == ["ind_a", "ind_c"]
    assert report["n_clusters_total"] == 2
    assert report["n_nonsingleton_clusters"] == 1
    assert report["nonsingleton_cluster_map"] == {"ind_a": ["ind_a", "ind_b"]}
    assert report["abs_r_threshold"] == 0.85
    assert report["univariate_scores"] == {"ind_a": 0.7, "ind_b": 0.6, "ind_c": 0.55}

    # Orchestration order + argument passthrough (paranoid: seed/negatives-per-positive must
    # reach build_samples unchanged; correlation_dedup must see the FULL candidate pool, not a
    # pre-shrunk one -- dedup happens ONCE, on everything).
    assert walk.calls[0] == ("build_samples", rdp.NEGATIVES_PER_POSITIVE, 999)
    assert walk.calls[1] == ("univariate_loco_screen", ("ind_a", "ind_b", "ind_c"))
    assert ss.calls[0][1] == ("ind_a", "ind_b", "ind_c")


def test_run_dedup_seed_default_matches_module_constant(tmp_path):
    panel_dir = tmp_path / "merged"
    panels = {"only_ind": _panel(["Albania"])}
    walk = _FakeWalk({panel_dir: panels}, univariate_scores={})
    ss = _FakeStabilitySelect(survivors=["only_ind"], cluster_map={"only_ind": ["only_ind"]})

    report = rdp.run_dedup(panel_dir, _positives_csv(tmp_path), walk, ss)

    assert report["seed"] == rdp.SEED == 12345
    assert walk.calls[0] == ("build_samples", rdp.NEGATIVES_PER_POSITIVE, 12345)


def test_run_dedup_no_survivors_dropped_silently_all_candidates_accounted_for(tmp_path):
    """Every candidate must land in exactly one cluster (paranoid accounting check) -- the
    orchestration itself doesn't enforce this (that's correlation_dedup's own contract), but a
    report that silently lost an indicator would be a red flag worth catching here too."""
    panel_dir = tmp_path / "merged"
    panels = {f"ind_{i}": _panel(["Albania"]) for i in range(5)}
    walk = _FakeWalk({panel_dir: panels}, univariate_scores={})
    cluster_map = {"ind_0": ["ind_0", "ind_1", "ind_2"], "ind_3": ["ind_3"], "ind_4": ["ind_4"]}
    ss = _FakeStabilitySelect(survivors=["ind_0", "ind_3", "ind_4"], cluster_map=cluster_map)

    report = rdp.run_dedup(panel_dir, _positives_csv(tmp_path), walk, ss)

    all_members = sorted(m for members in report["cluster_map"].values() for m in members)
    assert all_members == sorted(panels)  # every original candidate appears exactly once
