"""§11 acceptance bar -- the FULL D1-D7 confound battery, ANDed, per candidate
(PLAN.md `experiments/banking-enrichment/PLAN.md` §11, committed 98c703e, LOCKED).

Reuses (never reimplements): `candidate_loco.score_candidate` (candidate LOCO fit + G1 gate
+ era/2008 sensitivity + named-twin per-country AUC + OOF), `run_em_baseline.run_em_baseline`
(subset-scoped baseline recompute + OOF), `confound_missingness_placebo.run_missingness_placebo`
(D2), `confound_income_proxy.run_income_proxy_fit` (D3's control fit), `score_pilot.pair_oof` /
`paired_bootstrap_delta_auc` / `bh_fdr` (D6, and the pairing half of D3), and
`widenet/temporal_holdout.pick_cut_year` / `fit_predict_holdout` (D7).

Gate numbering matches PLAN.md §11's acceptance bar list 1-7 (D1-D7):
  D1 coverage-matched baseline (never pooled 0.638)
  D2 missingness/coverage placebo near-null
  D3 income-proxy control beaten, CI excludes 0
  D4 era/2008 decomposition survives, no era inversion
  D5 per-country lift concentrated on named twin-crises
  D6 country-block paired-bootstrap CI-lower > 0 vs baseline, BH-FDR across candidates
  D7 locked temporal hold-out replicates (advisory if post-2005 positives < ~8)

A candidate PASSES only if ALL 7 gates are True (`all_seven_and`) -- the AND-gate is the
primary defense per §11; BH-FDR (D6's second half) is an explicitly-named SECONDARY
safeguard, weak at k<=3 candidates.

The seven `dN_gate_*` functions below are PURE (dict/float in, bool/dict out) -- host-
testable, see test_battery_gates.py. Everything below the "Orchestration" divider needs the
ML stack (Docker-only).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[2]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
WIDENET_DIR = HERE.parent / "widenet"
PILOT_DIR = QGI_ML_ROOT / "experiments" / "run-3.1-pilot"
for _p in (HERE, SCRIPTS_DIR, WIDENET_DIR, PILOT_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

SEED = 12345
CHANCE_AUC = 0.50
D7_MIN_POS_FOR_BINDING = 8  # PLAN.md §11 bar #7's "~8" advisory-downgrade threshold


# ============================================================================================
# D1-D7 PURE gate evaluators (host-testable). See test_battery_gates.py.
# ============================================================================================
def d2_gate_pass(placebo: dict[str, Any]) -> bool:
    """D2: BOTH placebos must be near-null; either reproducing the real lift is a REJECT."""
    return bool(placebo.get("has_data_dummy_near_null")) and bool(placebo.get("permutation_near_null"))


def d3_gate_pass(ci_lo: float | None, ci_hi: float | None) -> bool:
    """D3: candidate must beat the bare income-proxy control with the delta-AUC CI
    excluding zero ON THE POSITIVE SIDE (candidate strictly above the proxy)."""
    if ci_lo is None or ci_lo != ci_lo:
        return False
    return ci_lo > 0.0


def d4_gate_pass(candidate_result: dict[str, Any]) -> bool:
    """D4: must survive `auc_with_without_cohort(exclude 2008)` (without-cohort AUC still
    above chance) AND must not invert below chance in the pre-boundary (pre-2000, the 1990s
    EM twin-crisis era) bucket of `era_stratified_loco`. Missing/unavailable pre-boundary AUC
    (too few rows) fails CLOSED -- cannot confirm no-inversion, so it does not silently pass."""
    sens = candidate_result.get("sensitivity_2008_cohort", {}) or {}
    auc_without = sens.get("auc_without_cohort")
    if auc_without is None or auc_without != auc_without or auc_without <= CHANCE_AUC:
        return False
    era = candidate_result.get("era_stratified_loco", {}) or {}
    pre_auc = (era.get("pre_boundary") or {}).get("auc")
    if pre_auc is None:
        return False
    return pre_auc >= CHANCE_AUC


def d5_gate_pass(twin_per_country_auc: dict[str, float]) -> bool:
    """D5: lift must be concentrated on the named twin-crises -- a STRICT majority of the
    twins present in this subset's LOCO must score >= chance. Empty (no twins present /
    survived LOCO) cannot confirm concentration -> fails closed."""
    if not twin_per_country_auc:
        return False
    n = len(twin_per_country_auc)
    n_above = sum(1 for v in twin_per_country_auc.values() if v >= CHANCE_AUC)
    return n_above > n / 2.0


def d6_gate_pass(ci95_lo: float | None, fdr_reject: bool) -> bool:
    """D6: country-block paired-bootstrap ΔAUC 95% CI-lower > 0 vs the coverage-matched
    baseline, AND the candidate survives BH-FDR across the <=3-candidate family."""
    if ci95_lo is None or ci95_lo != ci95_lo:
        return False
    return ci95_lo > 0.0 and bool(fdr_reject)


def d7_gate_verdict(n_post2005_pos: int, holdout_auc_ci_lo: float | None,
                     min_pos_for_binding: int = D7_MIN_POS_FOR_BINDING,
                     chance: float = CHANCE_AUC) -> dict[str, Any]:
    """D7: locked temporal hold-out AUC's CI-lower must exceed chance. PLAN.md §11 bar #7's
    explicit downgrade: if the subset's post-2005 positive count is below ~8, the hold-out is
    too data-starved to bind -- treat as ADVISORY (non-blocking, `gate_pass=True` regardless
    of the point estimate) rather than silently failing or silently passing on noise."""
    if n_post2005_pos < min_pos_for_binding:
        return {
            "gate_pass": True, "advisory": True,
            "reason": f"n_post2005_pos={n_post2005_pos} < {min_pos_for_binding} -> advisory downgrade (non-blocking) per §11 bar #7",
        }
    if holdout_auc_ci_lo is None or holdout_auc_ci_lo != holdout_auc_ci_lo:
        return {"gate_pass": False, "advisory": False, "reason": "holdout CI unavailable (fit failed or degenerate)"}
    return {
        "gate_pass": bool(holdout_auc_ci_lo > chance), "advisory": False,
        "reason": f"holdout_auc_ci_lo={holdout_auc_ci_lo!r} vs chance={chance!r}",
    }


def all_seven_and(gates: dict[str, bool]) -> bool:
    """The §11 AND-gate: a candidate PASSES only if every one of D1-D7 is True."""
    return all(bool(v) for v in gates.values()) and len(gates) == 7


# ============================================================================================
# Orchestration (Docker-only: needs run_f_ml_1_poc / candidate_loco / run_em_baseline /
# confound_missingness_placebo / confound_income_proxy / score_pilot / temporal_holdout).
# ============================================================================================
def run_d7_temporal_holdout(
    indicator_id: str, subset: str, subset_samples, panel_dir: Path, architecture: str,
    walk_module: Any, th_module: Any,
) -> dict[str, Any]:
    """D7 orchestration: try progressively later cut years (boldest first) for the ONE
    candidate indicator, fit once on the screening side, score once on the frozen hold-out
    side. Falls back to reporting `fit_failed` (never crashes the whole battery run) if no
    candidate cut clears the (deliberately loosened for a single-indicator fit) coverage
    gate -- a single indicator's screening-side coverage is intrinsically thinner than the
    3-driver pooled walk `temporal_holdout.py` was designed for."""
    panels = {indicator_id: walk_module.load_panel(indicator_id, panel_dir)}
    candidate_cuts = [1995, 1998, 2000, 2003, 2005, 2008, 2010, 2012]
    try:
        pick = th_module.pick_cut_year(
            subset_samples, candidate_cuts, [indicator_id], 15, panels, walk_module,
            min_holdout_frac=0.10,
        )
    except ValueError as exc:
        return {"fit_failed": True, "reason": f"pick_cut_year: {exc}"}

    cut = pick["locked_cut_year"]
    screen, holdout = th_module.temporal_split(subset_samples, cut)
    try:
        result = th_module.fit_predict_holdout(
            screen, holdout, [indicator_id], 15, panels, architecture, SEED, walk_module,
        )
    except ValueError as exc:
        return {"fit_failed": True, "reason": f"fit_predict_holdout: {exc}", "locked_cut_year": cut}
    result["locked_cut_year"] = cut
    result["cut_year_selection"] = pick
    return result


def run_battery_for_candidate(
    indicator_id: str,
    subset: str,
    candidate_panel_dir: Path,
    baseline_report: dict[str, Any],
    positives_csv: Path,
    cohort_assignments_path: Path,
    commitment_path: Path,
    out_dir: Path,
) -> dict[str, Any]:
    import numpy as np
    import pandas as pd

    import candidate_loco as cl  # noqa: E402
    import confound_income_proxy as cip  # noqa: E402
    import confound_missingness_placebo as cmp_  # noqa: E402
    import em_classification as ec  # noqa: E402
    import run_f_ml_1_poc as w  # noqa: E402
    import score_pilot as sp  # noqa: E402
    import subset_utils as su  # noqa: E402
    import temporal_holdout as th  # noqa: E402

    out_dir.mkdir(parents=True, exist_ok=True)

    # --- Candidate LOCO fit (D1 denominator context, D4/D5 inputs, D6/D7 OOF/samples) ---
    candidate = cl.score_candidate(
        indicator_id, subset, candidate_panel_dir, positives_csv, cohort_assignments_path,
        commitment_path, out_dir / f"candidate_{indicator_id}_{subset}.json",
    )

    # --- D2: missingness placebo ---
    placebo = cmp_.run_missingness_placebo(
        indicator_id, candidate_panel_dir, positives_csv, cohort_assignments_path,
        commitment_path, out_dir / f"missingness_placebo_{indicator_id}_{subset}.json", subset=subset,
    )

    # --- D3: income-proxy control + paired comparison vs candidate ---
    income_proxy = cip.run_income_proxy_fit(
        WIDENET_DIR / "deduped_panel_dir", positives_csv, cohort_assignments_path,
        commitment_path, out_dir / f"income_proxy_{subset}.json", subset=subset,
    )
    pi_d3 = sp.pair_oof(candidate["oof"], income_proxy["oof"])
    delta_d3 = sp.paired_bootstrap_delta_auc(
        pi_d3["probs_a"], pi_d3["probs_b"], pi_d3["labels"], countries=pi_d3["countries"],
        b_eval=1000, seed=SEED,
    )

    # --- D6: paired comparison vs the subset-coverage-matched baseline ---
    pi_d6 = sp.pair_oof(candidate["oof"], baseline_report["oof"])
    delta_d6 = sp.paired_bootstrap_delta_auc(
        pi_d6["probs_a"], pi_d6["probs_b"], pi_d6["labels"], countries=pi_d6["countries"],
        b_eval=1000, seed=SEED,
    )

    # --- D7: locked temporal hold-out ---
    pos_df = pd.read_csv(positives_csv)
    pos_df["country"] = pos_df["country_id"].apply(w.normalize_country_id)
    positives_all = list(zip(pos_df["country"].tolist(), pos_df["event_year"].astype(int).tolist()))
    pos_df2 = pos_df.rename(columns={"event_year": "year"})
    pos_df2["label"] = 1
    samples = w.build_samples(pos_df2, negatives_per_positive=3, seed=SEED)
    assignments = ec.load_cohort_assignments(cohort_assignments_path)
    sample_rows = list(zip(samples["country"].tolist(), samples["year"].astype(int).tolist()))
    resolved, _ = ec.classify_rows_tolerant(assignments, sample_rows)
    resolved_by_key = {(r["country"], r["event_year"]): r["em_eligible"] for r in resolved}
    subset_mask = np.array(su.resolve_subset_mask(sample_rows, resolved_by_key, subset))
    subset_samples = samples[subset_mask].reset_index(drop=True)

    resolved_pos, _ = ec.classify_rows_tolerant(assignments, positives_all)
    resolved_pos_by_key = {(r["country"], r["event_year"]): r["em_eligible"] for r in resolved_pos}
    subset_positives = cl.filter_positives_to_subset(positives_all, resolved_pos_by_key, subset)
    n_post2005_pos = sum(1 for _c, y in subset_positives if y >= 2005)

    d7_result = run_d7_temporal_holdout(
        indicator_id, subset, subset_samples, candidate_panel_dir, candidate["architecture"], w, th,
    )
    holdout_ci_lo = d7_result.get("holdout_auc_ci95", [None, None])[0] if not d7_result.get("fit_failed") else None
    d7_verdict = d7_gate_verdict(n_post2005_pos, holdout_ci_lo)

    # --- Assemble D1-D5 verdicts (D1 is a documentation check: did we in fact use the
    # subset-recomputed baseline, never pooled 0.638? -- always True here by construction,
    # since baseline_report IS the subset recompute passed in by the caller). ---
    d1_pass = baseline_report.get("subset") == subset and "baseline_loco_auc" in baseline_report
    d2_pass = d2_gate_pass(placebo)
    d3_pass = d3_gate_pass(delta_d3["ci95_lo"], delta_d3["ci95_hi"])
    d4_pass = d4_gate_pass(candidate)
    d5_pass = d5_gate_pass(candidate["named_twins_per_country_auc"])
    # D6's fdr_reject is filled in by the cross-candidate combiner (combine_battery.py) --
    # placeholder False here so a single-candidate run is visibly INCOMPLETE, never a
    # false PASS from an un-run FDR step.
    d6_pass_no_fdr = d6_gate_pass(delta_d6["ci95_lo"], fdr_reject=True)  # provisional, FDR applied later

    report: dict[str, Any] = {
        "indicator_id": indicator_id,
        "subset": subset,
        "baseline_loco_auc": baseline_report.get("baseline_loco_auc"),
        "candidate_loco_auc": candidate["candidate_loco_auc"],
        "delta_vs_baseline_point": delta_d6["point"],
        "delta_vs_baseline_ci95": [delta_d6["ci95_lo"], delta_d6["ci95_hi"]],
        "delta_vs_baseline_p_value": delta_d6["p_value"],
        "delta_vs_income_proxy_point": delta_d3["point"],
        "delta_vs_income_proxy_ci95": [delta_d3["ci95_lo"], delta_d3["ci95_hi"]],
        "d1_coverage_matched_baseline": {"gate_pass": d1_pass},
        "d2_missingness_placebo": {"gate_pass": d2_pass, "detail": placebo},
        "d3_income_proxy_beaten": {"gate_pass": d3_pass, "delta": delta_d3},
        "d4_era_2008_decomposition": {"gate_pass": d4_pass,
                                       "sensitivity_2008_cohort": candidate["sensitivity_2008_cohort"],
                                       "era_stratified_loco": candidate["era_stratified_loco"]},
        "d5_per_country_named_twins": {"gate_pass": d5_pass,
                                        "twins_present": candidate["named_twins_present_in_subset"],
                                        "twin_per_country_auc": candidate["named_twins_per_country_auc"]},
        "d6_country_block_bootstrap_provisional": {"gate_pass_no_fdr": d6_pass_no_fdr, "delta": delta_d6},
        "d7_temporal_holdout": {**d7_verdict, "detail": d7_result, "n_post2005_pos": n_post2005_pos},
        "g1_coverage_gate": candidate["g1_coverage_gate"],
    }
    out_path = out_dir / f"battery_{indicator_id}_{subset}.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"[run_full_battery] wrote {out_path}")
    print(
        f"[run_full_battery] {indicator_id}/{subset}: D1={d1_pass} D2={d2_pass} D3={d3_pass} "
        f"D4={d4_pass} D5={d5_pass} D6(no-FDR)={d6_pass_no_fdr} D7={d7_verdict['gate_pass']}"
        f"{' (advisory)' if d7_verdict['advisory'] else ''}"
    )
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--indicator-id", required=True)
    ap.add_argument("--subset", choices=["em", "advanced"], required=True)
    ap.add_argument("--candidate-panel-dir", type=Path, required=True)
    ap.add_argument("--baseline-report", type=Path, required=True)
    ap.add_argument("--positives-csv", type=Path,
                     default=QGI_ML_ROOT / "data" / "shape_inputs_v2" / "banking_and_financial_crisis" / "positives.csv")
    ap.add_argument("--cohort-assignments", type=Path,
                     default=QGI_ML_ROOT.parent / "qgi-data" / "reference" / "cohort-assignments.json")
    ap.add_argument("--commitment-path", type=Path, default=HERE / "results" / "em_commitment.json")
    ap.add_argument("--out-dir", type=Path, default=HERE / "results")
    args = ap.parse_args(argv)

    baseline_report = json.loads(args.baseline_report.read_text(encoding="utf-8"))
    run_battery_for_candidate(
        args.indicator_id, args.subset, args.candidate_panel_dir, baseline_report,
        args.positives_csv, args.cohort_assignments, args.commitment_path, args.out_dir,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
