"""Unit tests for build_merged_panel.py (pure directory-union logic; stdlib-only, no ML stack
needed — runs on a plain host Python, unlike the full walk/dedup pipeline).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_merged_panel as bmp  # noqa: E402


def _write_panel(dir_: Path, ind: str, countries: list[str] | None = None) -> None:
    countries = countries or ["Alpha", "Beta"]
    rows = [
        {"country": c, "year": y, "value": float(y - 2000)}
        for c in countries
        for y in range(2000, 2010)
    ]
    d = dir_ / ind
    d.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_parquet(d / f"{ind}.parquet", index=False)


def test_list_indicator_ids_sorted_dirs_only(tmp_path):
    (tmp_path / "zzz").mkdir()
    (tmp_path / "aaa").mkdir()
    (tmp_path / "not_a_dir.txt").write_text("x", encoding="utf-8")
    assert bmp.list_indicator_ids(tmp_path) == ["aaa", "zzz"]


def test_merge_creates_union_of_both_sources(tmp_path):
    raw_dir = tmp_path / "raw"
    cand_dir = tmp_path / "cand"
    out_dir = tmp_path / "merged"
    _write_panel(raw_dir, "IND_A")
    _write_panel(raw_dir, "IND_B")
    _write_panel(cand_dir, "credit_gap_1s_fd")

    manifest = bmp.build_merged_panel_dir(raw_dir, cand_dir, out_dir)

    assert bmp.list_indicator_ids(out_dir) == ["IND_A", "IND_B", "credit_gap_1s_fd"]
    assert manifest["n_raw"] == 2
    assert manifest["n_candidates"] == 1
    assert manifest["n_total"] == 3
    assert manifest["sources"] == {
        "IND_A": "raw", "IND_B": "raw", "credit_gap_1s_fd": "candidate",
    }
    # Content survives the copy byte-for-byte (schema + values).
    df = pd.read_parquet(out_dir / "IND_A" / "IND_A.parquet")
    assert list(df.columns) == ["country", "year", "value"]
    assert len(df) == 20  # 2 countries x 10 years


def test_merge_raises_on_name_collision(tmp_path):
    raw_dir = tmp_path / "raw"
    cand_dir = tmp_path / "cand"
    out_dir = tmp_path / "merged"
    _write_panel(raw_dir, "shared_id")
    _write_panel(cand_dir, "shared_id")

    with pytest.raises(ValueError, match="[Cc]ollision"):
        bmp.build_merged_panel_dir(raw_dir, cand_dir, out_dir)


def test_merge_raises_on_missing_parquet_inside_a_listed_dir(tmp_path):
    raw_dir = tmp_path / "raw"
    cand_dir = tmp_path / "cand"
    out_dir = tmp_path / "merged"
    # A directory exists (so it's listed by list_indicator_ids) but the expected parquet
    # file inside it does not -- a malformed source panel must fail loud, not be skipped.
    (raw_dir / "broken_ind").mkdir(parents=True)
    (cand_dir).mkdir(parents=True)

    with pytest.raises(FileNotFoundError):
        bmp.build_merged_panel_dir(raw_dir, cand_dir, out_dir)


def test_merge_is_disjoint_source_agnostic_on_real_banking_layout(tmp_path):
    """Confirms the ACTUAL repo has zero collisions between the 248 raw panels and the 6
    banking-enrichment candidates -- this is the real precondition our full merge run depends
    on, verified once here rather than only discovered at run time."""
    qgi_ml_root = Path(__file__).resolve().parents[3]
    raw_dir = qgi_ml_root / "data" / "parquet_panels"
    cand_dir = qgi_ml_root / "experiments" / "banking-enrichment" / "p1" / "candidates"
    if not raw_dir.exists() or not cand_dir.exists():
        pytest.skip("real repo data dirs not present in this environment")
    raw_ids = set(bmp.list_indicator_ids(raw_dir))
    cand_ids = set(bmp.list_indicator_ids(cand_dir))
    collisions = raw_ids & cand_ids
    assert collisions == set(), f"unexpected name collision(s): {sorted(collisions)}"
    assert len(raw_ids) == 248
    assert len(cand_ids) == 6


def test_copy_indicator_subset_only_copies_requested_ids(tmp_path):
    source_dir = tmp_path / "source"
    out_dir = tmp_path / "subset"
    _write_panel(source_dir, "keep_1")
    _write_panel(source_dir, "keep_2")
    _write_panel(source_dir, "drop_me")

    copied = bmp.copy_indicator_subset(source_dir, ["keep_2", "keep_1"], out_dir)

    assert copied == ["keep_1", "keep_2"]
    assert bmp.list_indicator_ids(out_dir) == ["keep_1", "keep_2"]


def test_copy_indicator_subset_raises_on_missing_id(tmp_path):
    source_dir = tmp_path / "source"
    out_dir = tmp_path / "subset"
    _write_panel(source_dir, "present")

    with pytest.raises(FileNotFoundError):
        bmp.copy_indicator_subset(source_dir, ["present", "absent"], out_dir)
