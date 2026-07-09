"""P2 evaluation driver: run-2 baseline reproduction + candidate LOCO-AUC + paired bootstrap.

Runs inside qgi-run31-pilot:py313. Reuses stability_select._final_fit and
score_pilot.pair_oof / paired_bootstrap_delta_auc VERBATIM (no reimplementation).
Seed = 12345 throughout.

Writes p2_results.json under experiments/banking-enrichment/p1/results/.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path("/work/qgi-ml")
PILOT_DIR = ROOT / "experiments" / "run-3.1-pilot"
SCRIPTS_DIR = ROOT / "scripts"
sys.path.insert(0, str(PILOT_DIR))
sys.path.insert(0, str(SCRIPTS_DIR))

import stability_select as ss  # noqa: E402
import score_pilot as sp  # noqa: E402
import run_f_ml_1_poc as w  # noqa: E402

SEED = 12345
RECIPE_ID = "banking_and_financial_crisis"
BASELINE_DRIVERS = ["NV.SRV.TOTL.ZS", "v2x_gender", "MS.MIL.XPND.GD.ZS"]
EXPECTED_BASELINE_AUC = 0.7707246376811594

PANEL_DIR = ROOT / "data" / "parquet_panels"
POSITIVES_CSV = ROOT / "data" / "shape_inputs_v2" / RECIPE_ID / "positives.csv"
CANDIDATES_DIR = ROOT / "experiments" / "banking-enrichment" / "p1" / "candidates"
RESULTS_DIR = ROOT / "experiments" / "banking-enrichment" / "p1" / "results"

# Candidates that passed BOTH P1 gates (G1 coverage + G2 orthogonality).
CANDIDATES_BOTH_GATES = ["credit_growth_3y_fd"]

# Twin-crisis EM countries named in the task brief (normalized to the panel's Title Case).
TWIN_CRISIS_EM_NOTE_LIST = {
    "Mexico": 1994,
    "Indonesia": 1997,
    "South Korea": 1997,
    "Thailand": 1997,
    "Turkey": 2001,
    "Argentina": 2001,
}


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    pos = ss._load_positives(POSITIVES_CSV)
    samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
    n_pos = int((samples["label"] == 1).sum())
    positive_countries = sorted(
        samples.loc[samples["label"] == 1, "country"].unique().tolist()
    )

    # --- (1) reproduce run-2 baseline ------------------------------------------------------
    panels_base = {ind: w.load_panel(ind, PANEL_DIR) for ind in BASELINE_DRIVERS}
    baseline_fit = ss._final_fit(BASELINE_DRIVERS, samples, panels_base, SEED)
    baseline_auc = baseline_fit["loco_auc"]
    reproduced = bool(abs(baseline_auc - EXPECTED_BASELINE_AUC) < 1e-9)

    out: dict = {
        "seed": SEED,
        "recipe_id": RECIPE_ID,
        "n_pos_samples": n_pos,
        "n_pos_events_csv": int(len(pos)),
        "positive_countries_in_samples": positive_countries,
        "twin_crisis_em_note_list_actually_in_positives": sorted(
            c for c in TWIN_CRISIS_EM_NOTE_LIST if c in positive_countries
        ),
        "twin_crisis_em_note_list_absent_from_positives": sorted(
            c for c in TWIN_CRISIS_EM_NOTE_LIST if c not in positive_countries
        ),
        "baseline": {
            "drivers": BASELINE_DRIVERS,
            "loco_auc": baseline_auc,
            "expected_loco_auc": EXPECTED_BASELINE_AUC,
            "reproduced_exactly": reproduced,
            "ci95_lo": baseline_fit["ci95_lo"],
            "ci95_hi": baseline_fit["ci95_hi"],
            "chosen_window": baseline_fit["chosen_window"],
        },
        "candidates": {},
    }

    print(f"[baseline] loco_auc={baseline_auc!r} expected={EXPECTED_BASELINE_AUC!r} "
          f"reproduced={reproduced}", flush=True)

    for cid in CANDIDATES_BOTH_GATES:
        panels = dict(panels_base)
        panels[cid] = w.load_panel(cid, CANDIDATES_DIR)
        recipe_set = BASELINE_DRIVERS + [cid]
        fit = ss._final_fit(recipe_set, samples, panels, SEED)

        pi_ = sp.pair_oof(fit["oof"], baseline_fit["oof"])
        delta = sp.paired_bootstrap_delta_auc(
            pi_["probs_a"], pi_["probs_b"], pi_["labels"],
            countries=pi_["countries"], b_eval=1000, seed=SEED,
        )

        # Per-country diagnostic: mean signed prob delta (candidate - baseline) on POSITIVE
        # rows only, keyed by country, to see where the paired-bootstrap lift concentrates.
        # Build a per-(country,year) lookup from the paired rows (already restricted to the
        # intersection of both arms' OOF, which is what the paired ΔAUC itself is computed on).
        per_country_pos_delta: dict[str, list[float]] = {}
        for k in range(pi_["n_pairs"]):
            if pi_["labels"][k] != 1:
                continue
            c = pi_["countries"][k]
            d = pi_["probs_a"][k] - pi_["probs_b"][k]  # candidate - baseline
            per_country_pos_delta.setdefault(c, []).append(d)
        per_country_summary = {
            c: {"n": len(v), "mean_prob_delta": sum(v) / len(v)}
            for c, v in sorted(per_country_pos_delta.items())
        }

        out["candidates"][cid] = {
            "recipe_set": recipe_set,
            "loco_auc": fit["loco_auc"],
            "ci95_lo": fit["ci95_lo"],
            "ci95_hi": fit["ci95_hi"],
            "chosen_window": fit["chosen_window"],
            "n_oof_rows": len(fit["oof"]),
            "delta_auc": delta,
            "pairing": {
                "n_pairs": pi_["n_pairs"],
                "n_a": pi_["n_a"],
                "n_b": pi_["n_b"],
                "label_mismatches": pi_["label_mismatches"],
                "n_clusters_countries": delta["n_clusters"],
            },
            "per_country_positive_prob_delta_candidate_minus_baseline": per_country_summary,
        }
        print(
            f"[{cid}] loco_auc={fit['loco_auc']!r} dAUC_point={delta['point']!r} "
            f"CI95=[{delta['ci95_lo']!r},{delta['ci95_hi']!r}] p={delta['p_value']!r} "
            f"n_clusters={delta['n_clusters']}",
            flush=True,
        )

    out_path = RESULTS_DIR / "p2_results.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"[p2_evaluate] wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
