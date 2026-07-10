"""Row-aligned baseline harness for the banking wide-net re-selection run (fix #5, 2026-07-10).

Reuses (never reimplements):
  * stability_select._final_fit -- recomputes BOTH the run-2 baseline drivers AND the
    wide-net's greedy-selected candidate set on the IDENTICAL sample draw (seed=12345, same
    build_samples call), each against the NEW 10-feature block (run-3.1 banking wide-net
    fix #1) -- a fair apples-to-apples comparison, never a bare scalar (e.g. the stale 0.638)
    compared to a freshly-computed 10-feature candidate.
  * score_pilot.pair_oof + score_pilot.paired_bootstrap_delta_auc -- country-CLUSTER paired
    bootstrap CI on delta AUC = AUC(candidate) - AUC(baseline), per PLAN.md §6 acceptance
    criterion #1 ("country-block paired-bootstrap ΔAUC 95% CI lower bound > 0 vs run-2").

Mirrors experiments/banking-enrichment/p1/p2_evaluate.py's proven pattern (baseline_fit,
candidate fit, pair_oof, paired_bootstrap_delta_auc) -- extended to consume a wide-net greedy
walk's OWN selected set + chosen window (read from run_f_ml_1_poc.py's `greedy-result.json`,
written under `--output-dir`) instead of a single hand-picked candidate.

Both arms load candidate panels from the MERGED panel_dir (`widenet/merged_panel_dir/` --
raw + derived, 254 indicators) so ANY selected indicator, raw or one of the 6 derived banking
transforms, resolves uniformly and BOTH arms run through the identical build_X_y /
extract_features_for_indicator code path for every driver -- "row-aligned" in the strongest
sense (same samples AND same feature-extraction code), not merely the same sample draw.

PAIRING-COVERAGE PARANOIA (fix #5's explicit ask): `pair_oof` pairs on the (country, year)
INTERSECTION of both arms' OOF rows. If the candidate set's coverage differs sharply from the
baseline's -- exactly the failure mode that hit run-3.1's own banking arm (0 paired rows; see
PLAN.md's postmortem link) -- the paired comparison silently shrinks to whatever both arms
happen to share. `pairing_diagnostics` below flags that condition explicitly rather than
letting a technically-valid-but-tiny `n_pairs` pass unnoticed.

Run inside the pinned Docker image, AFTER the greedy walk (`run_f_ml_1_poc.py --output-dir X`)
has produced `X/greedy-result.json`:

    MSYS_NO_PATHCONV=1 docker run --rm \\
      -v <repo>/qgi-ml:/work/qgi-ml -v <repo>/qgi-data:/work/qgi-data \\
      -w /work/qgi-ml qgi-run31-pilot:py313 \\
      python experiments/banking-enrichment/widenet/baseline_harness.py --greedy-result-dir <X>
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
for _p in (SCRIPTS_DIR, PILOT_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

SEED = 12345
RECIPE_ID = "banking_and_financial_crisis"
BASELINE_DRIVERS = ["NV.SRV.TOTL.ZS", "v2x_gender", "MS.MIL.XPND.GD.ZS"]  # run-2's own drivers

MERGED_PANEL_DIR = HERE / "merged_panel_dir"
POSITIVES_CSV = QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"
GREEDY_RESULT_NAME = "greedy-result.json"


# ============================================================================================
# Pure helpers (stdlib-only; unit-tested on host, no ML stack needed).
# ============================================================================================
def load_selected_set(greedy_result_path: Path) -> tuple[list[str], int | None, bool]:
    """Read a `run_f_ml_1_poc.py` `greedy-result.json` (schema: `_write_json_atomic`'s
    envelope with a `result` key holding `greedy_outer_loop`'s output dict) and return
    `(selected_indicators, chosen_window, early_abort_floor_unreachable)`.

    Raises FileNotFoundError if the path doesn't exist, and ValueError if the greedy walk
    selected NOTHING (an empty `selected_indicators` -- a candidate fit against zero drivers
    is meaningless; fail loud rather than silently comparing the baseline to an empty set).
    """
    if not greedy_result_path.exists():
        raise FileNotFoundError(
            f"{greedy_result_path} not found -- run the greedy walk "
            "(scripts/run_f_ml_1_poc.py --output-dir ...) first"
        )
    data = json.loads(greedy_result_path.read_text(encoding="utf-8"))
    result = data["result"]
    selected = list(result["selected_indicators"])
    if not selected:
        raise ValueError(
            f"{greedy_result_path}: greedy walk selected an empty indicator set -- "
            "nothing to compare against the baseline"
        )
    return selected, result.get("chosen_window"), bool(result.get("early_abort_floor_unreachable"))


def pairing_diagnostics(pairing: dict[str, Any], min_pair_fraction: float = 0.5) -> dict[str, Any]:
    """Flag a severe (candidate vs baseline) OOF-coverage mismatch from a `pair_oof` output
    dict (`{"n_pairs", "n_a", "n_b", ...}`). `pair_fraction_of_a/b` = what fraction of each
    arm's own OOF rows survived into the paired intersection; `severe_coverage_mismatch` is
    True when either fraction falls below `min_pair_fraction` (default 0.50) -- catching both
    the "zero paired rows" collapse (run-3.1's own banking-arm postmortem) and a milder but
    still-suspicious coverage divergence.
    """
    n_pairs = pairing.get("n_pairs", 0)
    n_a = pairing.get("n_a", 0)
    n_b = pairing.get("n_b", 0)
    frac_a = (n_pairs / n_a) if n_a else 0.0
    frac_b = (n_pairs / n_b) if n_b else 0.0
    return {
        "pair_fraction_of_a": frac_a,
        "pair_fraction_of_b": frac_b,
        "severe_coverage_mismatch": (frac_a < min_pair_fraction) or (frac_b < min_pair_fraction),
        "min_pair_fraction_threshold": min_pair_fraction,
    }


# ============================================================================================
# Orchestration (real ML stack; Docker-only; reuses already-unit-tested library functions --
# same precedent as p1/p2_evaluate.py, which has no dedicated test file for its own main()).
# ============================================================================================
def run_harness(greedy_result_dir: Path, out_path: Path | None = None) -> dict[str, Any]:
    import run_f_ml_1_poc as w  # noqa: E402
    import stability_select as ss  # noqa: E402
    import score_pilot as sp  # noqa: E402

    selected, chosen_window, early_abort = load_selected_set(
        greedy_result_dir / GREEDY_RESULT_NAME
    )

    pos = ss._load_positives(POSITIVES_CSV)
    samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
    n_pos = int((samples["label"] == 1).sum())

    all_ids = sorted(set(BASELINE_DRIVERS) | set(selected))
    panels = {ind: w.load_panel(ind, MERGED_PANEL_DIR) for ind in all_ids}

    baseline_fit = ss._final_fit(BASELINE_DRIVERS, samples, panels, SEED)
    candidate_fit = ss._final_fit(selected, samples, panels, SEED)

    pi_ = sp.pair_oof(candidate_fit["oof"], baseline_fit["oof"])
    diag = pairing_diagnostics(
        {"n_pairs": pi_["n_pairs"], "n_a": pi_["n_a"], "n_b": pi_["n_b"]}
    )
    delta = sp.paired_bootstrap_delta_auc(
        pi_["probs_a"], pi_["probs_b"], pi_["labels"],
        countries=pi_["countries"], b_eval=1000, seed=SEED,
    )

    out: dict[str, Any] = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "n_pos_samples": n_pos,
        "baseline": {
            "drivers": BASELINE_DRIVERS,
            "loco_auc": baseline_fit["loco_auc"],
            "ci95_lo": baseline_fit["ci95_lo"],
            "ci95_hi": baseline_fit["ci95_hi"],
            "chosen_window": baseline_fit["chosen_window"],
        },
        "candidate": {
            "selected_indicators": selected,
            "chosen_window_from_greedy": chosen_window,
            "chosen_window_from_final_fit": candidate_fit["chosen_window"],
            "early_abort_floor_unreachable": early_abort,
            "loco_auc": candidate_fit["loco_auc"],
            "ci95_lo": candidate_fit["ci95_lo"],
            "ci95_hi": candidate_fit["ci95_hi"],
        },
        "pairing": {
            "n_pairs": pi_["n_pairs"], "n_a": pi_["n_a"], "n_b": pi_["n_b"],
            "label_mismatches": pi_["label_mismatches"], **diag,
        },
        "delta_auc": delta,
        "accepted_ci_lower_gt_0": bool(delta["ci95_lo"] == delta["ci95_lo"] and delta["ci95_lo"] > 0.0),
    }

    if diag["severe_coverage_mismatch"]:
        print(
            f"[baseline_harness] WARNING severe OOF coverage mismatch: "
            f"pair_fraction_of_a={diag['pair_fraction_of_a']:.3f} "
            f"pair_fraction_of_b={diag['pair_fraction_of_b']:.3f} "
            f"(n_pairs={pi_['n_pairs']}, n_a={pi_['n_a']}, n_b={pi_['n_b']}) "
            "-- the paired ΔAUC may be computed on a shrunken, unrepresentative subset. "
            "See run-3.1's own banking-arm postmortem (0 paired rows) before trusting this CI.",
            file=sys.stderr,
        )
    if early_abort:
        print(
            "[baseline_harness] WARNING greedy walk ended via floor-aware early-abort "
            "(early_abort_floor_unreachable=True) -- the selected set is a PARTIAL walk, "
            "not a converged one. Treat this comparison as diagnostic, not final.",
            file=sys.stderr,
        )

    if out_path is not None:
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[baseline_harness] wrote {out_path}")
    print(
        f"[baseline_harness] baseline={baseline_fit['loco_auc']!r} "
        f"candidate={candidate_fit['loco_auc']!r} "
        f"dAUC_point={delta['point']!r} CI95=[{delta['ci95_lo']!r},{delta['ci95_hi']!r}] "
        f"p={delta['p_value']!r} accepted={out['accepted_ci_lower_gt_0']}"
    )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--greedy-result-dir", type=Path, required=True,
                     help="the run_f_ml_1_poc.py --output-dir that holds greedy-result.json")
    ap.add_argument("--out", type=Path, default=HERE / "results" / "baseline_harness_report.json")
    args = ap.parse_args(argv)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    run_harness(args.greedy_result_dir, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
