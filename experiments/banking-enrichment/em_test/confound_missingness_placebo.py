"""§11 acceptance bar #2 -- the missingness/coverage placebo (test-first; write BEFORE the
2nd/candidate scoring pass runs). Two independent placebos, per PLAN.md §11:

  (a) a bare "has-IDS-data" DUMMY -- same (country, year) cells the real indicator has data
      for, value replaced by a constant. If a "lift" survives on a dummy carrying NO
      information beyond "this country/year reported to the source dataset at all", the
      real indicator's apparent signal is just proxying which countries structurally HAVE
      IDS/reserves data (i.e. "is EM" itself, by construction -- the exact confound §10 #3
      names: advanced economies have 0% IDS/reserves data BY CONSTRUCTION).
  (b) a VALUES-SCRAMBLED, MASK-PRESERVED permutation -- the same cells carry data, but the
      magnitudes are shuffled panel-wide (breaking any real value<->label relationship)
      while the coverage/censoring pattern (which rows even reach build_X_y) stays
      identical. If a lift survives THIS, it isn't the indicator's values driving it either
      -- it's something about which rows survive at all (echoes placebo (a) from a
      different angle).

Both placebos are run through the IDENTICAL `run_f_ml_1_poc.build_X_y` /
`fit_predict_loco` pipeline as the real candidate, on the IDENTICAL EM-eligible subset
(`em_classification.classify_rows_tolerant`) and the LOCKED window=15 -- never a bespoke
scoring path that could silently make a placebo look better or worse than the real fit.
EXPECTED: both score near-null (~0.50-0.55 AUC). Reproducing the real candidate's lift on
either placebo is a REJECT per §11's AND-gate.

`build_has_data_dummy_panel` / `permute_values_mask_preserved` / `assert_mask_preserved` are
PURE pandas/numpy (host-testable, see test_confound_missingness_placebo.py). The scoring
entrypoint (`run_missingness_placebo`) needs `run_f_ml_1_poc` (Docker-only).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
WIDENET_DIR = HERE.parent / "widenet"
for _p in (HERE, SCRIPTS_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import em_classification as ec  # noqa: E402
import subset_utils as su  # noqa: E402

SEED = 12345
LOCKED_WINDOW = 15  # same lock as run_em_baseline.py -- apples-to-apples, no fresh argmax
DEFAULT_PANEL_DIR = WIDENET_DIR / "deduped_panel_dir"
DEFAULT_POSITIVES_CSV = ec.DEFAULT_POSITIVES_CSV
DEFAULT_COHORT_ASSIGNMENTS = ec.DEFAULT_COHORT_ASSIGNMENTS_PATH
DEFAULT_COMMITMENT_PATH = HERE / "results" / "em_commitment.json"
NEAR_NULL_BAND = (0.50, 0.55)  # PLAN.md §11 bar #2's explicit expected band


# ============================================================================================
# Pure transforms (pandas/numpy only -- host-testable, no ML stack).
# ============================================================================================
def build_has_data_dummy_panel(panel: pd.DataFrame, fill_value: float = 1.0) -> pd.DataFrame:
    """Placebo (a): same (country, year) coverage mask as `panel`, `value` replaced by the
    constant `fill_value` everywhere data was present. Null cells are dropped (they carry
    no coverage signal either way) -- matching `load_panel`'s downstream `.dropna()`
    convention in `extract_features_for_indicator`."""
    dummy = panel.dropna(subset=["value"]).copy()
    dummy["value"] = float(fill_value)
    return dummy.reset_index(drop=True)


def permute_values_mask_preserved(panel: pd.DataFrame, seed: int) -> pd.DataFrame:
    """Placebo (b): keep the EXACT set of (country, year) cells that have data (the
    coverage mask), but shuffle the VALUES panel-wide (across countries/years, not
    within-country) with a seeded RNG. Deterministic for a given seed; breaks any genuine
    value<->label relationship while leaving the censoring pattern -- which rows even
    survive `build_X_y`'s window/coverage requirement -- untouched."""
    non_null = panel.dropna(subset=["value"]).reset_index(drop=True)
    rng = np.random.default_rng(seed)
    shuffled_values = rng.permutation(non_null["value"].to_numpy())
    out = non_null.copy()
    out["value"] = shuffled_values
    return out


def assert_mask_preserved(original: pd.DataFrame, transformed: pd.DataFrame) -> None:
    """Sanity guard: `transformed` must cover EXACTLY the same (country, year) cells as
    `original`'s non-null rows -- no cell added, none dropped. Raises AssertionError
    (with the symmetric-difference for debugging) if the masks diverge."""
    orig_cells = set(zip(original.dropna(subset=["value"])["country"], original.dropna(subset=["value"])["year"]))
    new_cells = set(zip(transformed["country"], transformed["year"]))
    if orig_cells != new_cells:
        missing = orig_cells - new_cells
        added = new_cells - orig_cells
        raise AssertionError(
            f"assert_mask_preserved: coverage mask changed -- missing={missing!r} added={added!r}"
        )


# ============================================================================================
# Orchestration (Docker-only: run_f_ml_1_poc.build_X_y / fit_predict_loco / bca_bootstrap_auc_ci).
# ============================================================================================
def run_missingness_placebo(
    indicator_id: str,
    panel_dir: Path = DEFAULT_PANEL_DIR,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    cohort_assignments_path: Path = DEFAULT_COHORT_ASSIGNMENTS,
    commitment_path: Path = DEFAULT_COMMITMENT_PATH,
    out_path: Path | None = None,
    subset: str = "em",
) -> dict[str, Any]:
    """Fit BOTH placebos for `indicator_id` (e.g. `stdebt_reserves`) through the identical
    build_X_y/fit_predict_loco pipeline, on the identical `subset` ("em" or "advanced")
    subset, window locked to 15. Architecture: for subset="em" read from the binding §11
    commitment (never re-derived); for subset="advanced" (§11 Step 3's secondary/non-gating
    track) independently derived from em_commitment.json's n_pos_advanced via the same
    binding rule."""
    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)

    if not commitment_path.exists():
        raise FileNotFoundError(f"{commitment_path} not found -- run em_classification.py first")
    commitment = json.loads(commitment_path.read_text(encoding="utf-8"))
    if subset == "em":
        architecture = commitment["architecture"]
    elif subset == "advanced":
        architecture = ec.select_architecture(commitment["n_pos_advanced"])
    else:
        raise ValueError(f"run_missingness_placebo: subset must be 'em' or 'advanced', got {subset!r}")

    pos_df = pd.read_csv(positives_csv)
    pos_df["country"] = pos_df["country_id"].apply(w.normalize_country_id)
    pos_df = pos_df.rename(columns={"event_year": "year"})
    pos_df["label"] = 1
    samples = w.build_samples(pos_df, negatives_per_positive=3, seed=SEED)

    assignments = ec.load_cohort_assignments(cohort_assignments_path)
    rows = list(zip(samples["country"].tolist(), samples["year"].astype(int).tolist()))
    resolved, _unresolved = ec.classify_rows_tolerant(assignments, rows)
    resolved_by_key = {(r["country"], r["event_year"]): r["em_eligible"] for r in resolved}
    subset_mask = np.array(su.resolve_subset_mask(rows, resolved_by_key, subset))
    em_samples = samples[subset_mask].reset_index(drop=True)

    real_panel = w.load_panel(indicator_id, panel_dir)
    dummy_panel = build_has_data_dummy_panel(real_panel)
    permuted_panel = permute_values_mask_preserved(real_panel, seed=SEED)
    assert_mask_preserved(real_panel, dummy_panel)
    assert_mask_preserved(real_panel, permuted_panel)

    def _fit(panel: pd.DataFrame) -> dict[str, Any]:
        panels = {indicator_id: panel}
        X, y, c, yr = w.build_X_y(em_samples, [indicator_id], LOCKED_WINDOW, panels)
        if len(X) == 0 or len(np.unique(y)) < 2:
            return {"loco_auc": float("nan"), "ci95_lo": None, "ci95_hi": None, "n_rows": int(len(X))}
        res = w.fit_predict_loco(X, y, c, yr, architecture=architecture, seed=SEED)
        ci = w.bca_bootstrap_auc_ci(res["probs"], res["labels"], seed=SEED)
        return {
            "loco_auc": float(res["global_auc"]),
            "ci95_lo": float(ci["ci95_lo"]),
            "ci95_hi": float(ci["ci95_hi"]),
            "n_rows": int(len(X)),
            "n_pos": int((y == 1).sum()),
        }

    dummy_result = _fit(dummy_panel)
    permuted_result = _fit(permuted_panel)

    def _near_null(auc: float) -> bool:
        return auc == auc and NEAR_NULL_BAND[0] - 0.05 <= auc <= NEAR_NULL_BAND[1] + 0.05  # small slack for CI noise

    out = {
        "seed": SEED,
        "indicator_id": indicator_id,
        "subset": subset,
        "window_locked": LOCKED_WINDOW,
        "architecture": architecture,
        "near_null_band": list(NEAR_NULL_BAND),
        "has_data_dummy": dummy_result,
        "values_scrambled_permutation": permuted_result,
        "has_data_dummy_near_null": _near_null(dummy_result["loco_auc"]),
        "permutation_near_null": _near_null(permuted_result["loco_auc"]),
    }
    if out_path is not None:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[confound_missingness_placebo] wrote {out_path}")
    print(
        f"[confound_missingness_placebo] {indicator_id}: "
        f"dummy_auc={dummy_result['loco_auc']!r} permuted_auc={permuted_result['loco_auc']!r}"
    )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--indicator-id", required=True, help="e.g. stdebt_reserves or m2_reserves")
    ap.add_argument("--panel-dir", type=Path, default=DEFAULT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--cohort-assignments", type=Path, default=DEFAULT_COHORT_ASSIGNMENTS)
    ap.add_argument("--commitment-path", type=Path, default=DEFAULT_COMMITMENT_PATH)
    ap.add_argument("--subset", choices=["em", "advanced"], default="em")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)
    out = args.out or (HERE / "results" / f"missingness_placebo_{args.indicator_id}_{args.subset}.json")
    run_missingness_placebo(
        args.indicator_id, args.panel_dir, args.positives_csv, args.cohort_assignments,
        args.commitment_path, out, subset=args.subset,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
