"""Candidate screen: coverage-at-positive-cells (all 6 candidates) + D3 V-Dem orthogonality
(the 5 V-Dem candidates, via `d3_vdem_orthogonality.run_d3_for_candidate`).

Per PRE-REGISTRATION.md's acceptance bar, gates 1 (D1 coverage-matched baseline, of which
coverage survival is the first half) and 3 (D3, mandatory for the 5 V-Dem candidates) are
evaluated here as a pre-screen -- BEFORE the heavier greedy/incremental-lift evaluation
(out of this script's scope; this script answers "does the candidate even have enough
signal-bearing data, and is it collinear with what run-2 already uses").

Coverage-at-positive-cells: fraction of the 207 positive events that SURVIVE
`run_f_ml_1_poc.build_X_y` at the LOCKED honest-baseline window (25) -- i.e. the same window
the candidate will actually be evaluated at when combined with the run-2 5-driver set.
Docker-only (imports `run_f_ml_1_poc`).

D3: delegated to `d3_vdem_orthogonality.run_d3_for_candidate` (host-only; re-invoked here
so a single `results/candidate_screen_report.json` carries both gates per candidate).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
for _p in (HERE, SCRIPTS_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import d3_vdem_orthogonality as d3  # noqa: E402

SEED = 12345
RECIPE_ID = "military_coup"
LOCKED_WINDOW = 25  # the honest-baseline window (matches run-2's recomputed 0.652)

ALL_CANDIDATES = [
    "v2exl_legitlead", "v2pepwrses", "v2stcritapparm", "v2strenarm",
    "OWID_AUTOCRATIZATION", "NY.GDP.MKTP.KD.ZG",
]
VDEM_CANDIDATES = set(d3.FIVE_VDEM_CANDIDATES)

MIN_POS_COVERAGE = 0.50   # mirrors run_f_ml_1_poc.MIN_POS_SURVIVAL
MIN_POS_SURVIVE = 30      # mirrors run_f_ml_1_poc.MIN_EFFECTIVE_NPOS
MIN_COUNTRIES = 10        # mirrors run_f_ml_1_poc.MIN_SURVIVE_COUNTRIES

DEFAULT_PANEL_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
DEFAULT_POSITIVES_CSV = (
    QGI_ML_ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"
)


# ============================================================================================
# Pure verdict logic (host-testable).
# ============================================================================================
def coverage_verdict(
    pos_coverage: float, n_pos_survive: int, n_countries_survive: int,
    min_pos_coverage: float = MIN_POS_COVERAGE, min_pos_survive: int = MIN_POS_SURVIVE,
    min_countries: int = MIN_COUNTRIES,
) -> str:
    """`PASS` iff all three coverage thresholds clear; else `COVERAGE_FAIL`. Mirrors
    `run_f_ml_1_poc.coverage_gate_ok`'s positive-side + country-side thresholds (the
    negative-class threshold is not evaluated here since this screen concerns the 207
    positive events)."""
    if pos_coverage < min_pos_coverage:
        return "COVERAGE_FAIL"
    if n_pos_survive < min_pos_survive:
        return "COVERAGE_FAIL"
    if n_countries_survive < min_countries:
        return "COVERAGE_FAIL"
    return "PASS"


def combined_verdict(coverage_verdict_: str, d3_verdict_: str | None) -> str:
    """`SCREEN_PASS` iff coverage passes AND (no D3 gate applies OR D3 passes).
    `d3_verdict_=None` means the candidate is not a V-Dem candidate -- D3 is not mandated."""
    if coverage_verdict_ != "PASS":
        return "SCREEN_FAIL"
    if d3_verdict_ is not None and d3_verdict_ != "PASS_ORTHOGONAL":
        return "SCREEN_FAIL"
    return "SCREEN_PASS"


# ============================================================================================
# Orchestration (Docker-only for the coverage half; D3 half is host-safe but re-run here for
# a single consolidated report).
# ============================================================================================
def run_screen(
    candidates: list[str] = ALL_CANDIDATES,
    panel_dir: Path = DEFAULT_PANEL_DIR,
    positives_csv: Path = DEFAULT_POSITIVES_CSV,
    window: int = LOCKED_WINDOW,
    out_path: Path | None = None,
) -> dict[str, Any]:
    import pandas as pd

    import run_f_ml_1_poc as w  # noqa: E402  (heavy import; Docker-only)

    pos_df = pd.read_csv(positives_csv)
    pos_df["country"] = pos_df["country_id"].apply(w.normalize_country_id)
    pos_df = pos_df.rename(columns={"event_year": "year"})
    pos_df["label"] = 1
    samples = w.build_samples(pos_df, negatives_per_positive=3, seed=SEED)
    n_pos_total = int((samples["label"] == 1).sum())
    n_neg_total = int((samples["label"] == 0).sum())

    per_candidate: dict[str, Any] = {}
    for cand in candidates:
        panel = w.load_panel(cand, panel_dir)
        X, y, c, yr = w.build_X_y(samples, [cand], window, {cand: panel})
        n_pos_s = int((y == 1).sum()) if len(y) else 0
        n_neg_s = int((y == 0).sum()) if len(y) else 0
        n_c = int(len(set(c.tolist()))) if len(c) else 0
        pos_cov = n_pos_s / n_pos_total if n_pos_total else 0.0
        neg_cov = n_neg_s / n_neg_total if n_neg_total else 0.0
        cov_verdict = coverage_verdict(pos_cov, n_pos_s, n_c)

        d3_result = None
        if cand in VDEM_CANDIDATES:
            d3_result = d3.run_d3_for_candidate(
                cand, d3.RUN2_VDEM_BLOCK, panel_dir, positives_csv,
            )

        d3_verdict_ = d3_result["verdict"] if d3_result is not None else None
        per_candidate[cand] = {
            "candidate_id": cand,
            "window": window,
            "n_pos_total": n_pos_total,
            "n_pos_survive": n_pos_s,
            "pos_coverage": pos_cov,
            "n_neg_total": n_neg_total,
            "n_neg_survive": n_neg_s,
            "neg_coverage": neg_cov,
            "n_countries_survive": n_c,
            "coverage_verdict": cov_verdict,
            "is_vdem_candidate": cand in VDEM_CANDIDATES,
            "d3": d3_result,
            "screen_verdict": combined_verdict(cov_verdict, d3_verdict_),
        }

    out = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "window": window,
        "candidates": per_candidate,
        "survivors": [c for c, r in per_candidate.items() if r["screen_verdict"] == "SCREEN_PASS"],
        "rejected": [c for c, r in per_candidate.items() if r["screen_verdict"] == "SCREEN_FAIL"],
    }
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"[screen_candidates] wrote {out_path}")
    for c, r in per_candidate.items():
        d3_str = f" d3={r['d3']['verdict']}" if r["d3"] is not None else ""
        print(
            f"[screen_candidates] {c}: pos_coverage={r['pos_coverage']:.3f} "
            f"({r['n_pos_survive']}/{r['n_pos_total']}) countries={r['n_countries_survive']} "
            f"cov_verdict={r['coverage_verdict']}{d3_str} -> {r['screen_verdict']}"
        )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--panel-dir", type=Path, default=DEFAULT_PANEL_DIR)
    ap.add_argument("--positives-csv", type=Path, default=DEFAULT_POSITIVES_CSV)
    ap.add_argument("--window", type=int, default=LOCKED_WINDOW)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "candidate_screen_report.json")
    args = ap.parse_args(argv)
    run_screen(panel_dir=args.panel_dir, positives_csv=args.positives_csv,
               window=args.window, out_path=args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
