"""Exact per-recipe confusion-matrix / operating-point reporting from persisted OOF predictions.

Built for the External Domain Advisor review (professor-prep). The June sheet
(`qgi-docs/internal/ml-track/professor-prep/QGI-TE-per-recipe-metrics.pdf`) gave one
confusion matrix per recipe at a single 0.50 threshold, and its PR-AUC was *derived from
pooled reliability bins* rather than per-instance scores. This module removes both
limitations: given the raw out-of-fold rows a walk already produces
(`[{country, year, prob, label}]` — the `oof` field returned by
`run-3.1-pilot/stability_select._final_fit` and written into every experiment report), it
computes

  * the confusion matrix at ANY threshold, plus a full threshold sweep;
  * EXACT ROC-AUC and PR-AUC (average precision) from per-instance scores;
  * decision-relevant top-k precision (precision@5/10/20% of the ranked list) — the
    "what if someone acts on a high score" question;
  * per-cohort confusion matrices (fragile-state / mid-tier / stable-democracy) via
    `qgi-data/reference/cohort-assignments.json`;
  * per-country breakdown, so single-country dominance is visible.

Everything here is pure and host-runnable (numpy/sklearn only, no xgboost/Docker): it
consumes predictions, it does not fit models. Re-walking the fleet to regenerate OOF for
all 42 recipes needs the Docker ML image + `qgi-ml/data/parquet_panels/` restored from S3;
this module is the reporting half and is ready for that input.

PROVENANCE WARNING (read before quoting any number this produces): an OOF file carries the
AUC of whatever configuration produced it. Several persisted `*.run2.json` files are at the
run-2 *card* window and therefore reproduce the pre-correction, window-optimistic numbers
that the 2026-07-12 fleet honesty audit superseded (e.g. banking 0.771 -> honest 0.638).
`summarize()` echoes the file's own AUC so the provenance travels with the report; it is the
caller's job not to present a superseded configuration as current.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score

HERE = Path(__file__).resolve().parent
QGI_ML_ROOT = HERE.parents[1]
QGI_DATA_ROOT = QGI_ML_ROOT.parent / "qgi-data"
DEFAULT_COHORT_PATH = QGI_DATA_ROOT / "reference" / "cohort-assignments.json"

OofRows = Sequence[dict[str, Any]]

# The sheet's operating point, plus the sweep an ML reviewer actually asks for.
DEFAULT_SWEEP = (0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90)
DEFAULT_TOP_K_FRACTIONS = (0.05, 0.10, 0.20)


# ---------------------------------------------------------------------------------------
# Core confusion arithmetic (pure; no sklearn needed here so the semantics stay auditable)
# ---------------------------------------------------------------------------------------
def confusion_at(oof: OofRows, threshold: float) -> dict[str, Any]:
    """Confusion matrix + the standard derived rates at `threshold`.

    Positive prediction is `prob >= threshold` (inclusive), matching the sheet's ">= 0.5"
    convention. Rates that are undefined at this threshold (e.g. precision with zero
    predicted positives) return None rather than 0.0 — a precision of "no positives
    predicted" is not a precision of zero, and silently reporting 0.0 would understate.
    """
    tp = fp = fn = tn = 0
    for r in oof:
        pred = float(r["prob"]) >= threshold
        pos = int(r["label"]) == 1
        if pred and pos:
            tp += 1
        elif pred and not pos:
            fp += 1
        elif not pred and pos:
            fn += 1
        else:
            tn += 1

    n = tp + fp + fn + tn
    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    specificity = tn / (tn + fp) if (tn + fp) else None
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and (precision + recall) > 0
        else None
    )
    balanced_acc = (
        (recall + specificity) / 2 if recall is not None and specificity is not None else None
    )
    # MCC: the honest single-number summary for imbalanced binary problems.
    denom = float((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
    mcc = ((tp * tn - fp * fn) / np.sqrt(denom)) if denom > 0 else None

    return {
        "threshold": round(float(threshold), 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn, "n": n,
        "predicted_positive": tp + fp,
        "precision": _r(precision), "recall": _r(recall), "specificity": _r(specificity),
        "f1": _r(f1), "balanced_accuracy": _r(balanced_acc),
        "accuracy": _r((tp + tn) / n) if n else None,
        "mcc": _r(float(mcc)) if mcc is not None else None,
    }


def _r(x: float | None, nd: int = 4) -> float | None:
    return None if x is None else round(float(x), nd)


def threshold_sweep(oof: OofRows, grid: Iterable[float] = DEFAULT_SWEEP) -> list[dict[str, Any]]:
    """Confusion matrix at each threshold in `grid` — shows the precision/recall trade the
    single-threshold sheet hides."""
    return [confusion_at(oof, t) for t in grid]


def best_threshold(oof: OofRows, metric: str = "f1") -> dict[str, Any]:
    """The operating point maximizing `metric` over the observed score set.

    Candidate thresholds are the distinct predicted scores themselves (the only points where
    the confusion matrix can change), so this is exact rather than grid-approximate.
    """
    if metric not in {"f1", "mcc", "balanced_accuracy"}:
        raise ValueError(f"best_threshold: unsupported metric {metric!r}")
    cands = sorted({float(r["prob"]) for r in oof})
    best: dict[str, Any] | None = None
    for t in cands:
        c = confusion_at(oof, t)
        if c[metric] is None:
            continue
        if best is None or c[metric] > best[metric]:
            best = c
    return best if best is not None else confusion_at(oof, 0.5)


# ---------------------------------------------------------------------------------------
# Exact ranking metrics (the sheet's PR-AUC was bin-derived; these are per-instance)
# ---------------------------------------------------------------------------------------
def ranking_metrics(oof: OofRows) -> dict[str, Any]:
    y = np.array([int(r["label"]) for r in oof])
    p = np.array([float(r["prob"]) for r in oof])
    base = float(y.mean()) if y.size else 0.0
    out: dict[str, Any] = {
        "n": int(y.size), "n_pos": int(y.sum()), "n_neg": int((1 - y).sum()),
        "base_rate": _r(base),
        "brier": _r(float(np.mean((p - y) ** 2))) if y.size else None,
    }
    # Both AUCs are undefined with a single class present; report None, never a fake 0.5.
    if y.size and 0 < y.sum() < y.size:
        out["roc_auc_exact"] = _r(float(roc_auc_score(y, p)))
        out["pr_auc_exact"] = _r(float(average_precision_score(y, p)))
        out["pr_auc_lift_over_base"] = _r(float(average_precision_score(y, p)) / base) if base else None
    else:
        out["roc_auc_exact"] = None
        out["pr_auc_exact"] = None
        out["pr_auc_lift_over_base"] = None
    return out


def top_k_precision(
    oof: OofRows, fractions: Iterable[float] = DEFAULT_TOP_K_FRACTIONS
) -> list[dict[str, Any]]:
    """Precision among the highest-scoring k% — what a user acting on the top of the
    ranking would actually experience. Lift is vs the base rate (1.0 = no better than
    picking at random)."""
    rows = sorted(oof, key=lambda r: -float(r["prob"]))
    n = len(rows)
    y_all = np.array([int(r["label"]) for r in rows])
    base = float(y_all.mean()) if n else 0.0
    out = []
    for frac in fractions:
        k = max(1, int(round(n * frac)))
        hits = int(sum(int(r["label"]) for r in rows[:k]))
        prec = hits / k
        out.append({
            "fraction": frac, "k": k, "hits": hits,
            "precision_at_k": _r(prec),
            "lift_over_base": _r(prec / base) if base else None,
        })
    return out


# ---------------------------------------------------------------------------------------
# Cohort + country breakdowns
# ---------------------------------------------------------------------------------------
def load_cohort_assignments(path: Path = DEFAULT_COHORT_PATH) -> dict[str, dict[str, str]]:
    return json.loads(Path(path).read_text(encoding="utf-8"))["assignments"]


def cohort_of(
    assignments: dict[str, dict[str, str]], country: str, year: int
) -> str:
    """Cohort at the scored year. Unknown country/year resolves to 'unassigned' rather than
    raising: a reporting layer must never drop rows silently OR crash on one gap — the
    unassigned bucket is reported explicitly so the denominator stays visible."""
    years = assignments.get(country)
    if not years:
        return "unassigned"
    return years.get(str(year), "unassigned")


def by_cohort(
    oof: OofRows, assignments: dict[str, dict[str, str]], threshold: float = 0.5
) -> dict[str, Any]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    for r in oof:
        c = cohort_of(assignments, str(r["country"]), int(r["year"]))
        buckets.setdefault(c, []).append(r)
    out = {}
    for cohort, rows in sorted(buckets.items()):
        entry = confusion_at(rows, threshold)
        entry.update(ranking_metrics(rows))
        out[cohort] = entry
    return out


def by_country(oof: OofRows, threshold: float = 0.5, top: int = 15) -> list[dict[str, Any]]:
    """Per-country confusion, ordered by positive count — makes single-country dominance
    (the civil_war/Syria, humanitarian/Venezuela concentration risk) directly visible."""
    buckets: dict[str, list[dict[str, Any]]] = {}
    for r in oof:
        buckets.setdefault(str(r["country"]), []).append(r)
    rows = []
    for country, rs in buckets.items():
        entry = {"country": country}
        entry.update(confusion_at(rs, threshold))
        entry["n_pos"] = sum(1 for r in rs if int(r["label"]) == 1)
        rows.append(entry)
    rows.sort(key=lambda e: (-e["n_pos"], e["country"]))
    return rows[:top]


# ---------------------------------------------------------------------------------------
# Report assembly
# ---------------------------------------------------------------------------------------
def summarize(
    oof: OofRows,
    *,
    recipe: str,
    source_file: str | None = None,
    source_meta: dict[str, Any] | None = None,
    threshold: float = 0.5,
    assignments: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Full per-recipe report. `source_meta` should carry the walk's own headline
    (loco_auc / chosen_window / selected_set) so the configuration travels with the numbers
    — see this module's PROVENANCE WARNING."""
    report: dict[str, Any] = {
        "recipe": recipe,
        "source_file": source_file,
        "source_reported": {
            k: (source_meta or {}).get(k)
            for k in ("arm", "loco_auc", "ci95_lo", "ci95_hi", "chosen_window",
                      "selected_set", "n_pos", "seed_base")
        },
        "ranking": ranking_metrics(oof),
        "confusion_at_threshold": confusion_at(oof, threshold),
        "threshold_sweep": threshold_sweep(oof),
        "best_f1_operating_point": best_threshold(oof, "f1"),
        "best_mcc_operating_point": best_threshold(oof, "mcc"),
        "top_k_precision": top_k_precision(oof),
        "by_country_top15": by_country(oof, threshold),
    }
    if assignments is not None:
        report["by_cohort"] = by_cohort(oof, assignments, threshold)
    return report


def load_oof_file(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Read a walk/experiment report; return (oof rows, metadata-without-oof)."""
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    oof = d.get("oof") or []
    meta = {k: v for k, v in d.items() if k != "oof"}
    return oof, meta


def main(argv: list[str] | None = None) -> int:
    import argparse

    ap = argparse.ArgumentParser(description="Exact confusion-matrix report from persisted OOF rows.")
    ap.add_argument("oof_files", nargs="+", type=Path,
                    help="experiment report JSONs containing an `oof` array")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--cohorts", type=Path, default=DEFAULT_COHORT_PATH)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "confusion_report.json")
    args = ap.parse_args(argv)

    assignments = load_cohort_assignments(args.cohorts) if args.cohorts.exists() else None
    if assignments is None:
        print(f"[confusion_report] WARNING: no cohort file at {args.cohorts} — skipping cohort split")

    reports = []
    for f in args.oof_files:
        oof, meta = load_oof_file(f)
        if not oof:
            print(f"[confusion_report] SKIP {f.name}: no `oof` array")
            continue
        recipe = str(meta.get("recipe_id") or meta.get("indicator_id") or f.stem)
        rep = summarize(oof, recipe=recipe, source_file=str(f), source_meta=meta,
                        threshold=args.threshold, assignments=assignments)
        reports.append(rep)
        c = rep["confusion_at_threshold"]
        rk = rep["ranking"]
        print(f"[{recipe}] n={rk['n']} pos={rk['n_pos']} base={rk['base_rate']} "
              f"| ROC {rk['roc_auc_exact']} PR {rk['pr_auc_exact']} "
              f"| @{args.threshold}: tp={c['tp']} fp={c['fp']} fn={c['fn']} tn={c['tn']} "
              f"P={c['precision']} R={c['recall']} F1={c['f1']}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(reports, indent=2, default=str), encoding="utf-8")
    print(f"[confusion_report] wrote {args.out} ({len(reports)} recipes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
