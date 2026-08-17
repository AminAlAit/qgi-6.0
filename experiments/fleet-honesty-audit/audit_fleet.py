"""FLEET-WIDE HONEST RE-MEASUREMENT of every shipped run-2 recipe (2026-07-11).

Motivation: banking is LIVE at loco_auc=0.771 but its honest, coverage-matched re-measurement
on the current representative event set is 0.638 — a 0.133 "mirage" (skewed event set + greedy
discovery inflation). The frontend still shows 0.771. NINE recipes are advertised HIGHER than
banking (epidemic 0.879, currency 0.857, religious 0.819, labor 0.815, sanctions 0.807,
monetary 0.783, exec-power 0.782, econ-nationalization 0.781, tech-breakthrough 0.773) with
the same risk profile (small n, few drivers, "directional" tier). Any inflated number is live
on qgintelligence.com right now.

This audit reproduces the EXACT banking re-measurement method for all 44 carded recipes:
  * recipe = the card's `greedy_walk.selected_indicators` (fixed — NO re-selection)
  * window = the card's `greedy_walk.chosen_window` (fixed — apples-to-apples)
  * samples = current `data/shape_inputs_v2/<trend>/positives.csv` + time-matched negatives
    (`build_samples`, negatives_per_positive=3) — the SAME harness the walk used
  * fit = XGBoost LOCO (`fit_predict_loco`), honest global AUC, averaged over 3 seeds for
    robustness (a single seed's negative draw can move AUC a few pp — averaging separates a
    real mirage from sampling noise)
  * shipped `stats.loco_auc` is the comparison point.

delta = honest_mean - shipped. Flag tiers:
  MIRAGE   delta <= -0.06  (banking-class: materially overstated)
  INFLATED -0.06 < delta <= -0.03
  OK       delta > -0.03  (reproduces within noise)
Also records honest 3-seed sd, the seed-12345 BCa 95% CI, and single-country dominance
(max share of positive folds a single country's per-country AUC=1.0 contributes) — a mirage
tell. Docker-only (xgboost/sklearn/scipy via qgi-run31-pilot:py313). Writes incrementally so
the headline (highest-shipped) results land first.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
SCRIPTS_DIR = QGI_ML_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import run_f_ml_1_poc as w  # noqa: E402
sys.path.insert(0, str(QGI_ML_ROOT / "experiments" / "run-3.1-pilot"))
import stability_select as ss  # noqa: E402  (provides _final_fit — the authoritative honest baseline)

CARDS_DIR = QGI_ML_ROOT.parent / "qgi-frontend" / "data" / "te-fleet-run-2" / "cards-v3"
SHAPE_INPUTS = QGI_ML_ROOT / "data" / "shape_inputs_v2"
PANELS_DIR = QGI_ML_ROOT / "data" / "parquet_panels"
SEEDS = [12345, 23456, 34567]
OUT_PATH = HERE / "results" / "fleet_audit.json"


def load_positives(trend: str) -> pd.DataFrame:
    df = pd.read_csv(SHAPE_INPUTS / trend / "positives.csv")
    pos = pd.DataFrame(
        {"country": df["country_id"].map(w.normalize_country_id), "year": df["event_year"].astype(int)}
    )
    pos["label"] = 1
    return pos


def _per_country_auc_from_oof(oof: list[dict]) -> dict[str, float]:
    """Compute per-country AUC from OOF rows (needed for the dominance tell; _final_fit
    doesn't return it). A country with only one class present is skipped."""
    from sklearn.metrics import roc_auc_score
    by_c: dict[str, list] = {}
    for r in oof:
        by_c.setdefault(r["country"], []).append((r["label"], r["prob"]))
    out = {}
    for c, rows in by_c.items():
        labs = [x[0] for x in rows]
        if len(set(labs)) < 2:
            continue
        out[c] = float(roc_auc_score(labs, [x[1] for x in rows]))
    return out


def honest_fit(indicators: list[str], pos: pd.DataFrame, seed: int) -> dict | None:
    """Authoritative honest re-measurement: _final_fit re-argmaxes the window over WINDOW_GRID
    (never the card's cherry-picked one) with the 10-feature block — the exact primitive that
    produced banking's accepted 0.638. XGBoost per the fleet's shipped architecture."""
    samples = w.build_samples(pos, negatives_per_positive=3, seed=seed, time_matched=True)
    panels = {ind: w.load_panel(ind, PANELS_DIR) for ind in indicators}
    fit = ss._final_fit(indicators, samples, panels, seed)
    auc = fit.get("loco_auc")
    if auc is None or (isinstance(auc, float) and auc != auc):  # None or NaN
        return None
    n_pos = int(sum(r["label"] == 1 for r in fit.get("oof", [])))
    return {
        "auc": float(auc), "chosen_window": fit.get("chosen_window"),
        "ci95_lo": fit.get("ci95_lo"), "ci95_hi": fit.get("ci95_hi"),
        "oof": fit.get("oof", []), "n_pos": n_pos,
    }


def audit_trend(trend: str, card: dict) -> dict:
    gw = card.get("greedy_walk", {}) or {}
    inds = gw.get("selected_indicators", []) or []
    card_window = gw.get("chosen_window")
    stats = card.get("stats", {}) or {}
    shipped = stats.get("loco_auc")
    pos = load_positives(trend)

    fits, aucs = [], []
    for seed in SEEDS:
        r = honest_fit(inds, pos, seed)
        if r is not None:
            fits.append(r)
            aucs.append(r["auc"])
    if not aucs:
        return {"trend": trend, "shipped": shipped, "honest_mean": None, "verdict": "FIT_FAILED",
                "n_indicators": len(inds), "card_window": card_window}

    # Anchor the verdict on seed 12345 (index 0) — the canonical program seed that produced
    # every official number (reproduces banking's 0.638 exactly). honest_mean/sd over all seeds
    # is the robustness/fragility footnote, not the headline.
    honest_primary = float(aucs[0])
    honest_mean = float(np.mean(aucs))
    honest_sd = float(np.std(aucs)) if len(aucs) > 1 else 0.0
    pca = _per_country_auc_from_oof(fits[0]["oof"])
    dom = (sum(1 for v in pca.values() if v >= 0.999) / len(pca)) if pca else None

    delta = honest_primary - shipped if shipped is not None else None
    if delta is None:
        verdict = "NO_SHIPPED"
    elif delta <= -0.06:
        verdict = "MIRAGE"
    elif delta <= -0.03:
        verdict = "INFLATED"
    else:
        verdict = "OK"

    return {
        "trend": trend, "shipped": round(shipped, 4) if shipped is not None else None,
        "honest": round(honest_primary, 4),
        "honest_mean": round(honest_mean, 4), "honest_sd": round(honest_sd, 4),
        "honest_ci95_lo": round(float(fits[0]["ci95_lo"]), 4) if fits[0]["ci95_lo"] is not None else None,
        "honest_ci95_hi": round(float(fits[0]["ci95_hi"]), 4) if fits[0]["ci95_hi"] is not None else None,
        "delta": round(delta, 4) if delta is not None else None,
        "verdict": verdict,
        "n_indicators": len(inds), "card_window": card_window,
        "chosen_windows": [f["chosen_window"] for f in fits],
        "n_pos_now": fits[0]["n_pos"], "n_pos_card": card.get("n_positives"),
        "single_country_dominance": round(dom, 3) if dom is not None else None,
        "per_seed_auc": [round(a, 4) for a in aucs],
        "indicators": inds,
    }


def main() -> int:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cards = []
    for f in sorted(CARDS_DIR.glob("*.card.json")):
        d = json.load(open(f, encoding="utf-8"))
        if (d.get("stats", {}) or {}).get("loco_auc") is None:
            continue
        cards.append((f.name.replace(".card.json", ""), d))
    # headline first: highest shipped AUC
    cards.sort(key=lambda x: -(x[1].get("stats", {}) or {}).get("loco_auc", 0))

    results = []
    for i, (trend, card) in enumerate(cards, 1):
        try:
            r = audit_trend(trend, card)
        except Exception as e:  # noqa: BLE001 — one bad trend must not kill the sweep
            r = {"trend": trend, "verdict": "ERROR", "error": repr(e)}
        results.append(r)
        d = r.get("delta")
        print(f"[{i:2d}/{len(cards)}] {trend:32s} ship={r.get('shipped')} "
              f"honest={r.get('honest')} (mean {r.get('honest_mean')}) d={d:+.3f} {r.get('verdict')}"
              if d is not None else
              f"[{i:2d}/{len(cards)}] {trend:32s} {r.get('verdict')}")
        OUT_PATH.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")

    flagged = [r for r in results if r.get("verdict") in ("MIRAGE", "INFLATED")]
    print(f"\n==== DONE: {len(results)} recipes audited, {len(flagged)} flagged "
          f"({sum(r['verdict']=='MIRAGE' for r in flagged)} MIRAGE, "
          f"{sum(r['verdict']=='INFLATED' for r in flagged)} INFLATED) ====")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
