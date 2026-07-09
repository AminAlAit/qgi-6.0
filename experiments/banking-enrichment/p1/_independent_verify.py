"""Independent re-run of P2, from a fresh reviewer script, NOT reusing p2_evaluate.py verbatim
(re-typed calls to the same underlying functions, to catch any copy/paste sleight of hand)."""
import sys, json
from pathlib import Path
ROOT = Path("/work/qgi-ml")
PILOT_DIR = ROOT / "experiments" / "run-3.1-pilot"
sys.path.insert(0, str(PILOT_DIR))
sys.path.insert(0, str(ROOT / "scripts"))

import stability_select as ss
import score_pilot as sp
import run_f_ml_1_poc as w

SEED = 12345
POSITIVES_CSV = ROOT / "data" / "shape_inputs_v2" / "banking_and_financial_crisis" / "positives.csv"
PANEL_DIR = ROOT / "data" / "parquet_panels"
CAND_DIR = ROOT / "experiments" / "banking-enrichment" / "p1" / "candidates"
BASELINE_DRIVERS = ["NV.SRV.TOTL.ZS", "v2x_gender", "MS.MIL.XPND.GD.ZS"]

pos = ss._load_positives(POSITIVES_CSV)
print("n positive event rows in positives.csv:", len(pos))
samples = w.build_samples(pos, negatives_per_positive=ss.NEGATIVES_PER_POSITIVE, seed=SEED)
print("n_pos in samples:", int((samples["label"]==1).sum()), "n total samples:", len(samples))

panels_base = {ind: w.load_panel(ind, PANEL_DIR) for ind in BASELINE_DRIVERS}
baseline_fit = ss._final_fit(BASELINE_DRIVERS, samples, panels_base, SEED)
print("BASELINE loco_auc:", repr(baseline_fit["loco_auc"]), "window:", baseline_fit["chosen_window"])
print("BASELINE ci95:", baseline_fit["ci95_lo"], baseline_fit["ci95_hi"])
assert abs(baseline_fit["loco_auc"] - 0.7707246376811594) < 1e-9, "BASELINE MISMATCH"
print("BASELINE REPRODUCED EXACTLY: OK")

# candidate
panels = dict(panels_base)
panels["credit_growth_3y_fd"] = w.load_panel("credit_growth_3y_fd", CAND_DIR)
recipe_set = BASELINE_DRIVERS + ["credit_growth_3y_fd"]
fit = ss._final_fit(recipe_set, samples, panels, SEED)
print("CANDIDATE loco_auc:", repr(fit["loco_auc"]), "window:", fit["chosen_window"])
print("CANDIDATE ci95:", fit["ci95_lo"], fit["ci95_hi"])

pi_ = sp.pair_oof(fit["oof"], baseline_fit["oof"])
delta = sp.paired_bootstrap_delta_auc(
    pi_["probs_a"], pi_["probs_b"], pi_["labels"],
    countries=pi_["countries"], b_eval=1000, seed=SEED,
)
print("DELTA point:", repr(delta["point"]))
print("DELTA CI95:", delta["ci95_lo"], delta["ci95_hi"])
print("DELTA p_value:", delta["p_value"])
print("n_pairs:", delta["n_pairs"], "n_clusters:", delta["n_clusters"])

# Sanity: unpaired direct AUC on full OOF sets (not paired) - sanity check magnitude
import numpy as np
def raw_auc(oof):
    probs = np.array([r["prob"] for r in oof])
    labels = np.array([r["label"] for r in oof])
    order = np.argsort(probs)
    ranks = np.empty(len(probs))
    ranks[order] = np.arange(1, len(probs)+1)
    n_pos = labels.sum(); n_neg = len(labels)-n_pos
    if n_pos==0 or n_neg==0: return float('nan')
    r_pos = ranks[labels==1].sum()
    return (r_pos - n_pos*(n_pos+1)/2) / (n_pos*n_neg)

print("RAW (unpaired) baseline AUC on full OOF:", raw_auc(baseline_fit["oof"]), "n=", len(baseline_fit["oof"]))
print("RAW (unpaired) candidate AUC on full OOF:", raw_auc(fit["oof"]), "n=", len(fit["oof"]))

# Per-window AUC for both arms (sanity: is baseline's window=25 pick genuinely the argmax,
# or a fluke of a degenerate small sample at that window?)
print("\n--- per-window AUC scan (baseline drivers) ---")
for win in w.WINDOW_GRID:
    X, y, c, yr = w.build_X_y(samples, BASELINE_DRIVERS, win, panels_base)
    if len(X) < 30 or len(np.unique(y)) < 2:
        print(f"  win={win}: skipped (n={len(X)})")
        continue
    res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
    print(f"  win={win}: auc={res['global_auc']:.4f} n={len(X)}")

print("\n--- per-window AUC scan (candidate recipe_set) ---")
for win in w.WINDOW_GRID:
    X, y, c, yr = w.build_X_y(samples, recipe_set, win, panels)
    if len(X) < 30 or len(np.unique(y)) < 2:
        print(f"  win={win}: skipped (n={len(X)})")
        continue
    res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
    print(f"  win={win}: auc={res['global_auc']:.4f} n={len(X)}")
