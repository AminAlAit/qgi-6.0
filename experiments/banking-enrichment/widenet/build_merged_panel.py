"""Build the MERGED (raw ∪ derived-candidates) panel_dir for the banking wide-net
re-selection run (PLAN.md §10 item 1 / run-3.1 banking wide-net fix #4, 2026-07-10).

`run_f_ml_1_poc.list_candidate_indicators(panel_dir)` / `load_panel(id, panel_dir)` operate on
a plain directory of `<id>/<id>.parquet` subdirs (see scripts/run_f_ml_1_poc.py lines ~283-294).
This module builds ONE physical directory that is the union of:
  * the 248 raw indicator panels at `data/parquet_panels/`
  * the 6 derived transform candidates at `experiments/banking-enrichment/p1/candidates/`
(both already in the identical (country: str, year: int64, value: float64) schema — verified
in `p1/build_features.py::write_candidate`), so the merged pool is exactly the "250+6" pool the
banking wide-net plan calls for (PLAN.md §10.1).

Deliberately STDLIB-ONLY (pathlib + shutil + json; no pandas/numpy/joblib import) so this half
of the pipeline is testable on a plain host Python with zero ML-stack installs — the real
correlation-dedup pass (which DOES need the full stack: pandas + run_f_ml_1_poc + XGBoost-free
LOCO screening) lives in `run_dedup_prefilter.py` and only runs inside the pinned Docker image.

`copy_indicator_subset` is the second reusable primitive: given an already-merged directory and
a subset of indicator ids (e.g. the correlation-dedup survivors), physically materializes a
THIRD directory containing only those ids. This lets the eventual `run_f_ml_1_poc.py` CLI
invocation simply point `--panel-dir` at the deduped subset — no CLI/argparse changes needed
(fix #2 keeps the CLI untouched; this script does the pre-filtering entirely at the
directory level, exactly the "physical panel_dir restriction" pattern `stability_select`'s
`run31` arm achieves in-process for its per-resample subset).

Physical copy (not symlink): parquet panels are tiny (~10MB total for 254 indicators) and a
copy is portable across the Windows bind-mount + Linux container boundary this pipeline runs
across (Docker Desktop's file-sharing layer does not reliably support symlinks created from
inside the container back onto a Windows host mount).
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


def list_indicator_ids(panel_dir: Path) -> list[str]:
    """Verbatim copy of `run_f_ml_1_poc.list_candidate_indicators` (same one-liner; kept
    dependency-free here rather than importing run_f_ml_1_poc, which pulls in joblib/xgboost
    at module import time). If that function's directory-listing logic ever changes, update
    this copy too — see `p1/screen.py`'s `normalize_country_id` for the same low-drift-risk
    pattern used elsewhere in this experiment."""
    return sorted(p.name for p in panel_dir.iterdir() if p.is_dir())


def build_merged_panel_dir(raw_dir: Path, candidates_dir: Path, out_dir: Path) -> dict[str, Any]:
    """Union `raw_dir` + `candidates_dir` into `out_dir`, one `<id>/<id>.parquet` per indicator.

    Raises:
        ValueError: `raw_dir` and `candidates_dir` share an indicator id (the union assumes
            disjoint namespaces; a real production/derived-candidate name collision must be
            resolved by the caller BEFORE merging, never silently overwritten-in-place).
        FileNotFoundError: a listed subdirectory does not contain the expected
            `<id>/<id>.parquet` (a malformed source panel — fail loud, never skip silently).

    Returns the manifest dict (also useful for a paranoid post-hoc audit of provenance).
    """
    raw_ids = list_indicator_ids(raw_dir)
    cand_ids = list_indicator_ids(candidates_dir)
    collisions = sorted(set(raw_ids) & set(cand_ids))
    if collisions:
        raise ValueError(
            f"Name collision between raw panel_dir ({raw_dir}) and candidates_dir "
            f"({candidates_dir}): {collisions}. The merge assumes disjoint indicator ids; "
            "resolve the collision before merging (never silently overwrite)."
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = {
        "raw_dir": str(raw_dir),
        "candidates_dir": str(candidates_dir),
        "out_dir": str(out_dir),
        "sources": {},
    }
    for source_label, source_dir, ids in (
        ("raw", raw_dir, raw_ids),
        ("candidate", candidates_dir, cand_ids),
    ):
        for ind in ids:
            src = source_dir / ind / f"{ind}.parquet"
            if not src.exists():
                raise FileNotFoundError(
                    f"expected parquet at {src} for indicator {ind!r} (source={source_label}) "
                    "-- malformed source panel, refusing to silently skip it"
                )
            dst_dir = out_dir / ind
            dst_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst_dir / f"{ind}.parquet")
            manifest["sources"][ind] = source_label

    manifest["n_raw"] = len(raw_ids)
    manifest["n_candidates"] = len(cand_ids)
    manifest["n_total"] = len(raw_ids) + len(cand_ids)
    return manifest


def copy_indicator_subset(source_dir: Path, ids: list[str], out_dir: Path) -> list[str]:
    """Materialize a THIRD directory containing only `ids` (must all already exist as
    `<id>/<id>.parquet` under `source_dir`). Used to turn a correlation-dedup survivor list
    into a physical `--panel-dir` for the production CLI, with zero CLI/argparse changes.

    Raises FileNotFoundError (never silently drops an id) if any requested id is missing from
    `source_dir`. Returns the sorted list of ids actually copied (== sorted(ids) on success).
    """
    missing = [i for i in ids if not (source_dir / i / f"{i}.parquet").exists()]
    if missing:
        raise FileNotFoundError(
            f"copy_indicator_subset: {len(missing)} requested id(s) missing from {source_dir}: "
            f"{sorted(missing)}"
        )
    out_dir.mkdir(parents=True, exist_ok=True)
    for ind in ids:
        dst_dir = out_dir / ind
        dst_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_dir / ind / f"{ind}.parquet", dst_dir / f"{ind}.parquet")
    return sorted(ids)


# ============================================================================================
# CLI
# ============================================================================================
def _default_paths() -> dict[str, Path]:
    qgi_ml_root = Path(__file__).resolve().parents[3]
    here = Path(__file__).resolve().parent
    return {
        "raw_dir": qgi_ml_root / "data" / "parquet_panels",
        "candidates_dir": here.parent / "p1" / "candidates",
        "out_dir": here / "merged_panel_dir",
        "manifest_path": here / "merged_panel_manifest.json",
    }


def main() -> int:
    paths = _default_paths()
    manifest = build_merged_panel_dir(paths["raw_dir"], paths["candidates_dir"], paths["out_dir"])
    paths["manifest_path"].write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(
        f"[build_merged_panel] {manifest['n_raw']} raw + {manifest['n_candidates']} candidate "
        f"= {manifest['n_total']} indicators -> {paths['out_dir']}"
    )
    print(f"[build_merged_panel] wrote {paths['manifest_path']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
