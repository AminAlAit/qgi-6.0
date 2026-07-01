"""run-3.1 pilot — run-2 BASELINE arm.

Produces ``results/{recipe_id}.run2.json`` for each pilot recipe: the run-2
RECORDED selected indicator set, fit on the SAME canonical samples / LOCO folds
as the stability arms and — critically — through the *IDENTICAL* final-fit path
(``stability_select._final_fit``: argmax over ``WINDOW_GRID``, NOT a fixed
window). Reusing the exact final-fit procedure is what makes the paired ΔAUC in
``score_pilot`` a like-with-like comparison of run-3.1 vs run-2 on identical
country folds (PRE-REGISTRATION.md §5; INTEGRATION-SPEC.md §7 "baseline
selected_set … run through §3 on the SAME canonical samples").

The run-2 sets below are the recorded run-2 selections (build brief). This module
does NOT re-select; it only re-fits the frozen set so its OOF/CI live in the same
frame as the arms.

Frozen INTER-MODULE CONTRACT written here (consumed by score_pilot.py)::

    {recipe_id, arm:"run2", selected_set, loco_auc, ci95_lo, ci95_hi,
     oof:[{country, year, prob, label}], n_pos}

Everything heavy is imported from the production walk via ``stability_select``
(never reimplemented). Deterministic: seed base 12345. Python 3.13.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

# Reuse the stability arm's walk loader, positives loader, the shared
# argmax-over-WINDOW_GRID final-fit, and the seed/negatives constants so the
# baseline fits through the byte-identical path the arms use.
import stability_select as ss

__all__ = ["RUN2_SELECTED_SETS", "run_baseline"]

# Run-2 recorded selected indicator sets (build brief; the pre-registered baseline).
RUN2_SELECTED_SETS: dict[str, list[str]] = {
    "civil_war_and_insurgency": ["v2x_clpriv", "v2x_rule", "v2pepwrort"],
    "executive_power_consolidation": [
        "v2csprtcpt", "v2jureform", "v2pepwrort", "v2cltort", "v2x_rule",
        "NY.GNP.PCAP.CD", "v2xel_frefair", "v2csreprss", "v2psprlnks",
    ],
    "military_coup": [
        "SP.DYN.LE00.IN", "v2excrptps", "v2cltort", "v2xel_frefair", "v2x_clpol",
    ],
    "banking_and_financial_crisis": [
        "NV.SRV.TOTL.ZS", "v2x_gender", "MS.MIL.XPND.GD.ZS",
    ],
    "territorial_disputes": [
        "NY.GNP.PCAP.CD", "v2x_neopat", "SM.POP.NETM", "AG.PRD.FOOD.XD", "v2pepwrsoc",
    ],
}


def run_baseline(
    recipe_id: str,
    panel_dir: str | Path,
    positives_csv: str | Path,
    cohort_sidecar: str | Path | None = None,
    out_dir: str | Path | None = None,
    seed_base: int = ss.DEFAULT_SEED_BASE,
    git_commit: str | None = None,
) -> dict[str, Any]:
    """Fit run-2's recorded set for one recipe and write the frozen-contract JSON.

    Parameters
    ----------
    recipe_id : one of the 5 pilot recipes (key of ``RUN2_SELECTED_SETS``).
    cohort_sidecar : accepted for interface parity but NOT USED (per
        INTEGRATION-SPEC §4 the pilot's critical path needs zero cohort data —
        mirrors ``stability_select.run_arm``).
    seed_base : canonical seed (12345) — SAME as the arms so ``build_samples``
        yields identical folds and the paired ΔAUC is paired on identical folds.

    Returns the result dict (also written to ``{out_dir}/{recipe_id}.run2.json``).
    """
    if recipe_id not in RUN2_SELECTED_SETS:
        raise KeyError(
            f"unknown recipe_id {recipe_id!r}; expected one of "
            f"{sorted(RUN2_SELECTED_SETS)}"
        )
    panel_dir = Path(panel_dir)
    positives_csv = Path(positives_csv)
    out_dir = Path(out_dir) if out_dir is not None else (Path(__file__).resolve().parent / "results")
    out_dir.mkdir(parents=True, exist_ok=True)

    selected_set = list(RUN2_SELECTED_SETS[recipe_id])
    w = ss._walk()

    # Canonical samples: SAME loader / seed / negatives as the arms → identical folds.
    pos = ss._load_positives(positives_csv)
    samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=seed_base)
    n_pos = int((samples["label"] == 1).sum())

    # Only the selected set's panels are needed by _final_fit's build_X_y.
    panels = {ind: w.load_panel(ind, panel_dir) for ind in selected_set}

    # IDENTICAL final-fit path the arms use: argmax over WINDOW_GRID (no fixed window).
    fit = ss._final_fit(selected_set, samples, panels, seed_base)

    resolved_commit = git_commit or os.environ.get("GIT_COMMIT", "UNKNOWN")
    result: dict[str, Any] = {
        "recipe_id": recipe_id,
        "arm": "run2",
        "selected_set": selected_set,
        "loco_auc": fit["loco_auc"],
        "ci95_lo": fit["ci95_lo"],
        "ci95_hi": fit["ci95_hi"],
        "oof": fit["oof"],
        "n_pos": n_pos,
        # Non-contract provenance (harmless extra keys for downstream readers).
        "chosen_window": fit["chosen_window"],
        "final_indicator_count": len(selected_set),
        "git_commit": resolved_commit,
        "seed_base": seed_base,
    }

    out_path = out_dir / f"{recipe_id}.run2.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


# ============================================================================================
# CLI (real-walk entry point; NOT exercised by the mocked unit test).
# ============================================================================================
def _default_panel_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "parquet_panels"


def _default_positives_csv(recipe_id: str) -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "data" / "shape_inputs_v2" / recipe_id / "positives.csv"
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="run-3.1 pilot run-2 baseline fitter")
    # Accept both the walk-style (--recipe-id / --out-dir) and the run_pilot.sh
    # aliases (--recipe / --results-dir) so the orchestrator works either way.
    ap.add_argument("--recipe-id", "--recipe", dest="recipe_id", required=True)
    ap.add_argument("--panel-dir", default=None)
    ap.add_argument("--positives-csv", default=None)
    ap.add_argument("--cohort-sidecar", default=None, help="accepted but unused (pilot needs none)")
    ap.add_argument("--out-dir", "--results-dir", dest="out_dir", default=None)
    ap.add_argument("--seed-base", type=int, default=ss.DEFAULT_SEED_BASE)
    ap.add_argument("--git-commit", default=None)
    args = ap.parse_args(argv)

    panel_dir = Path(args.panel_dir) if args.panel_dir else _default_panel_dir()
    positives_csv = (
        Path(args.positives_csv) if args.positives_csv else _default_positives_csv(args.recipe_id)
    )
    out_dir = Path(args.out_dir) if args.out_dir else (Path(__file__).resolve().parent / "results")

    result = run_baseline(
        recipe_id=args.recipe_id,
        panel_dir=panel_dir,
        positives_csv=positives_csv,
        cohort_sidecar=args.cohort_sidecar,
        out_dir=out_dir,
        seed_base=args.seed_base,
        git_commit=args.git_commit,
    )
    print(
        f"[{result['recipe_id']}.run2] selected_set={result['selected_set']} "
        f"loco_auc={result['loco_auc']} ci95=[{result['ci95_lo']}, {result['ci95_hi']}] "
        f"n_pos={result['n_pos']}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
