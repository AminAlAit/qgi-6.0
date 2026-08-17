"""ADVERSARIAL VERIFICATION of the fleet audit's flagged mirages (2026-07-12).

The audit says 34/42 live recipes are overstated. Before recommending 34 live-number
corrections, prove each flag is a REAL mirage, not an artifact of the re-measurement method.
Three independent checks per flagged trend (seed 12345, current event set):

  1. WINDOW-FRAGILITY PROOF — sweep ALL 9 windows (WINDOW_GRID) and record the AUC curve.
     The shipped `final_global_auc` should be UNREACHABLE at every window on current data
     (its own cherry-picked window included). `reproduces_at_any_window` = shipped <= max+0.01.
     If a shipped number IS reproducible at some window, it is NOT a mirage — flag for review.
  2. PANEL INTEGRITY — every recipe indicator's panel must load with real (non-empty,
     not-all-NaN) data. A silently empty panel would fake a low honest AUC (false mirage).
  3. HONEST-NUMBER BREADTH — per-country AUC at the honest best window: the honest number must
     rest on many countries, not 2-3 lucky folds (a mirage tell that would also discredit the
     honest replacement). Records n_countries and the share at AUC>=0.999.

Resumable (skips trends already in the output). Single seed (12345 — the canonical anchor).
Docker-only. Writes results/mirage_verification.json.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
sys.path.insert(0, str(QGI_ML_ROOT / "scripts"))
sys.path.insert(0, str(HERE))
import run_f_ml_1_poc as w  # noqa: E402
import audit_fleet as af  # noqa: E402

SEED = 12345
OUT = HERE / "results" / "mirage_verification.json"


def _per_country_auc(oof_probs, oof_labels, oof_countries):
    from sklearn.metrics import roc_auc_score
    by_c: dict = {}
    for p, l, c in zip(oof_probs, oof_labels, oof_countries):
        by_c.setdefault(str(c), []).append((int(l), float(p)))
    out = {}
    for c, rows in by_c.items():
        labs = [x[0] for x in rows]
        if len(set(labs)) >= 2:
            out[c] = float(roc_auc_score(labs, [x[1] for x in rows]))
    return out


def verify(trend: str, card: dict) -> dict:
    gw = card.get("greedy_walk", {}) or {}
    inds = gw.get("selected_indicators", []) or []
    shipped_window = gw.get("chosen_window")
    shipped = (card.get("stats", {}) or {}).get("loco_auc")
    pos = af.load_positives(trend)
    samples = w.build_samples(pos, negatives_per_positive=3, seed=SEED, time_matched=True)

    # panel integrity
    panel_diag = {}
    panels = {}
    for ind in inds:
        p = w.load_panel(ind, af.PANELS_DIR)
        panels[ind] = p
        n = len(p)
        nn = float(p["value"].notna().mean()) if n and "value" in p.columns else 0.0
        panel_diag[ind] = {"rows": int(n), "pct_nonnull": round(nn, 3)}
    panel_ok = all(d["rows"] > 0 and d["pct_nonnull"] > 0 for d in panel_diag.values())

    # window sweep
    curve = {}
    best = None  # (auc, win, res)
    for win in w.WINDOW_GRID:
        X, y, c, yr = w.build_X_y(samples, inds, win, panels)
        if len(X) < 30 or len(np.unique(y)) < 2:
            curve[win] = None
            continue
        res = w.fit_predict_loco(X, y, c, yr, architecture="XGBoost", seed=SEED)
        auc = float(res["global_auc"])
        curve[win] = round(auc, 4)
        if best is None or auc > best[0]:
            best = (auc, win, res)

    honest_max = round(best[0], 4) if best else None
    best_window = best[1] if best else None
    auc_at_shipped_window = curve.get(shipped_window)
    reproduces = (shipped is not None and honest_max is not None and shipped <= honest_max + 0.01)

    # breadth of the honest number at its best window
    breadth = {}
    if best:
        res = best[2]
        pca = _per_country_auc(res["probs"], res["labels"], res["countries"])
        if pca:
            breadth = {
                "n_countries": len(pca),
                "share_auc_1": round(sum(v >= 0.999 for v in pca.values()) / len(pca), 3),
                "median_country_auc": round(float(np.median(list(pca.values()))), 3),
            }

    return {
        "trend": trend, "shipped": round(shipped, 4) if shipped else None,
        "shipped_window": shipped_window,
        "honest_max_over_windows": honest_max, "best_window": best_window,
        "auc_at_shipped_window": auc_at_shipped_window,
        "shipped_minus_honestmax": round(shipped - honest_max, 4) if (shipped and honest_max) else None,
        "reproduces_at_any_window": bool(reproduces),
        "window_curve": curve,
        "panel_ok": bool(panel_ok), "panel_diag": panel_diag,
        "honest_breadth": breadth,
        "n_indicators": len(inds), "indicators": inds,
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    audit = json.loads((HERE / "results" / "fleet_audit.json").read_text(encoding="utf-8"))
    flagged = [r["trend"] for r in audit if r.get("verdict") in ("MIRAGE", "INFLATED")]
    existing = []
    if OUT.is_file():
        existing = json.loads(OUT.read_text(encoding="utf-8"))
    done = {r["trend"] for r in existing}
    todo = [t for t in flagged if t not in done]

    cards = {}
    for t in todo:
        cards[t] = json.load(open(af.CARDS_DIR / f"{t}.card.json", encoding="utf-8"))
    # worst-first by audit delta
    delta_by = {r["trend"]: r.get("delta", 0) for r in audit}
    todo.sort(key=lambda t: delta_by.get(t, 0))

    results = list(existing)
    print(f"verifying {len(todo)} flagged trends (of {len(flagged)}); {len(done)} already done")
    for i, t in enumerate(todo, 1):
        try:
            r = verify(t, cards[t])
        except Exception as e:  # noqa: BLE001
            r = {"trend": t, "error": repr(e)}
        results.append(r)
        print(f"[{i}/{len(todo)}] {t:30s} shipped={r.get('shipped')} "
              f"honest_max={r.get('honest_max_over_windows')} "
              f"reproduces={r.get('reproduces_at_any_window')} panel_ok={r.get('panel_ok')}")
        OUT.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")

    confirmed = [r for r in results if r.get("reproduces_at_any_window") is False]
    survivors = [r for r in results if r.get("reproduces_at_any_window") is True]
    bad_panels = [r["trend"] for r in results if r.get("panel_ok") is False]
    print(f"\n==== VERIFICATION DONE ====")
    print(f"confirmed mirages (shipped unreachable at any window): {len(confirmed)}")
    print(f"NOT confirmed (shipped reproduces somewhere — review): {len(survivors)} "
          f"{[r['trend'] for r in survivors]}")
    print(f"panel-integrity failures (would fake a mirage): {bad_panels or 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
