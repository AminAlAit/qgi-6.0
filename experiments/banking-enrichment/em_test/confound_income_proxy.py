"""§11 acceptance bar #3 -- the income-proxy control (test-first; write BEFORE the 2nd/
candidate scoring pass runs). stdebt_reserves / m2_reserves must "beat a bare GNI-per-capita
fit (NY.GNP.PCAP.CD, already in panel), CI excluding zero, within the EM subsample" (PLAN.md
§11). This module fits the bare GNI-per-capita control through the IDENTICAL
`run_f_ml_1_poc.build_X_y` / `fit_predict_loco` pipeline, on the IDENTICAL EM-eligible
subset (`em_classification.classify_rows_tolerant`) and the LOCKED window=15 -- never a
bespoke scoring path -- so a later candidate-vs-control paired bootstrap (reusing
`score_pilot.pair_oof` / `paired_bootstrap_delta_auc`, exactly as `widenet/baseline_harness.py`
does for candidate-vs-baseline) is a fair, row-aligned comparison.

Why this control matters: if stdebt_reserves/m2_reserves' apparent EM-subset lift is really
just "this country is poor" (external-fragility data structurally correlates with GNI per
capita -- low-income countries are more likely to be IDS reporters AND more likely to have
low reserves AND more likely to be poor, a triple confound), a bare wealth proxy fit through
the SAME pipeline should already capture most of that lift. The candidate must clear it with
a CI that excludes zero, not merely land on a similar point estimate.

`ci_excludes_zero` / `indicator_available_in_panel_dir` are PURE (host-testable, no ML
stack). The scoring entrypoint (`run_income_proxy_fit`) needs `run_f_ml_1_poc` (Docker-only).
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
LOCKED_WINDOW = 15  # same lock as run_em_baseline.py / confound_missingness_placebo.py
INCOME_PROXY_INDICATOR_ID = "NY.GNP.PCAP.CD"  # WB GNI per capita, Atlas method -- already in panel
DEFAULT_PANEL_DIR = WIDENET_DIR / "deduped_panel_dir"
DEFAULT_POSITIVES_CSV = ec.DEFAULT_POSITIVES_CSV
DEFAULT_COHORT_ASSIGNMENTS = ec.DEFAULT_COHORT_ASSIGNMENTS_PATH
DEFAULT_COMMITMENT_PATH = HERE / "results" / "em_commitment.json"


# ============================================================================================
# Pure helpers (host-testable, no ML stack).
# ============================================================================================
def ci_excludes_zero(lo: float | None, hi: float | None) -> bool:
    """True iff the interval [lo, hi] does NOT contain 0 (strict -- a bound sitting exactly
    on zero does NOT count as excluding it). NaN/None bounds (an unstable/degenerate CI,
    e.g. single-class fold) return False -- never silently pass an invalid interval.
    Raises ValueError on an inverted interval (lo > hi is a caller bug, not a valid CI)."""
    if lo is None or hi is None:
        return False
    if lo != lo or hi != hi:  # NaN guard (matches score_pilot._is_num's convention)
        return False
    if lo > hi:
        raise ValueError(f"ci_excludes_zero: inverted interval lo={lo!r} > hi={hi!r}")
    return lo > 0.0 or hi < 0.0


def indicator_available_in_panel_dir(panel_dir: Path, indicator_id: str) -> bool:
    """True iff `panel_dir/<indicator_id>/<indicator_id>.parquet` exists -- a pure
    filesystem check, no parquet parsing (host-testable without pyarrow/pandas parquet
    engines installed)."""
    return (Path(panel_dir) / indicator_id / f"{indicator_id}.parquet").is_file()


# ============================================================================================
# Orchestration (Docker-only: run_f_ml_1_poc.build_X_y / fit_predict_loco / bca_bootstrap_auc_ci).
# ============================================================================================
def run_income_proxy_fit(
    panel_dir: Path = DEFAULT_PANEL_DIR,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    cohort_assignments_path: Path = DEFAULT_COHORT_ASSIGNMENTS,
    commitment_path: Path = DEFAULT_COMMITMENT_PATH,
    out_path: Path | None = None,
    subset: str = "em",
) -> dict[str, Any]:
    """Fit the bare `NY.GNP.PCAP.CD` control through build_X_y/fit_predict_loco on the
    identical `subset` ("em" or "advanced") subset, window locked to 15. Architecture: for
    subset="em" read from the binding §11 commitment (never re-derived); for
    subset="advanced" independently derived from em_commitment.json's n_pos_advanced via the
    same binding rule. Returns the OOF predictions too (`oof`), so a later candidate-vs-
    control paired bootstrap (`score_pilot.pair_oof` + `paired_bootstrap_delta_auc`) can
    consume them directly, row-aligned."""
    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)

    if not commitment_path.exists():
        raise FileNotFoundError(f"{commitment_path} not found -- run em_classification.py first")
    commitment = json.loads(commitment_path.read_text(encoding="utf-8"))
    if subset == "em":
        architecture = commitment["architecture"]
    elif subset == "advanced":
        architecture = ec.select_architecture(commitment["n_pos_advanced"])
    else:
        raise ValueError(f"run_income_proxy_fit: subset must be 'em' or 'advanced', got {subset!r}")

    if not indicator_available_in_panel_dir(panel_dir, INCOME_PROXY_INDICATOR_ID):
        raise FileNotFoundError(
            f"{INCOME_PROXY_INDICATOR_ID} not found under {panel_dir} -- income-proxy control "
            "requires the GNI-per-capita panel to be present"
        )

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

    panels = {INCOME_PROXY_INDICATOR_ID: w.load_panel(INCOME_PROXY_INDICATOR_ID, panel_dir)}
    X, y, c, yr = w.build_X_y(em_samples, [INCOME_PROXY_INDICATOR_ID], LOCKED_WINDOW, panels)
    if len(X) == 0 or len(np.unique(y)) < 2:
        raise ValueError(
            "income-proxy build_X_y produced no usable rows or a single class on the EM subset"
        )
    res = w.fit_predict_loco(X, y, c, yr, architecture=architecture, seed=SEED)
    ci = w.bca_bootstrap_auc_ci(res["probs"], res["labels"], seed=SEED)

    out: dict[str, Any] = {
        "seed": SEED,
        "indicator_id": INCOME_PROXY_INDICATOR_ID,
        "subset": subset,
        "window_locked": LOCKED_WINDOW,
        "architecture": architecture,
        "n_rows": int(len(X)),
        "n_pos": int((y == 1).sum()),
        "loco_auc": float(res["global_auc"]),
        "ci95_lo": float(ci["ci95_lo"]),
        "ci95_hi": float(ci["ci95_hi"]),
        "oof": [
            {"country": str(res["countries"][k]), "year": int(res["years"][k]),
             "prob": float(res["probs"][k]), "label": int(res["labels"][k])}
            for k in range(len(res["probs"]))
        ],
    }
    if out_path is not None:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[confound_income_proxy] wrote {out_path}")
    print(
        f"[confound_income_proxy] {INCOME_PROXY_INDICATOR_ID}: loco_auc={out['loco_auc']!r} "
        f"CI95=[{out['ci95_lo']!r},{out['ci95_hi']!r}]"
    )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=DEFAULT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--cohort-assignments", type=Path, default=DEFAULT_COHORT_ASSIGNMENTS)
    ap.add_argument("--commitment-path", type=Path, default=DEFAULT_COMMITMENT_PATH)
    ap.add_argument("--subset", choices=["em", "advanced"], default="em")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)
    out = args.out or (HERE / "results" / f"income_proxy_report_{args.subset}.json")
    run_income_proxy_fit(
        args.panel_dir, args.positives_csv, args.cohort_assignments, args.commitment_path,
        out, subset=args.subset,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
