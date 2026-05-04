#!/usr/bin/env python3
"""
ML Validation Framework Scaffolding (Stage 0 v1)
=================================================

Implements the v1 subset of the validation framework specified in
qgi-docs/internal/ops/ml-track/07-validation-framework.md:

    Component 1 — OOS-by-time AUC + bootstrap 95% CI (PRIMARY metric)
    Component 3 — Calibration audit per recipe + ECE post-Beta
    Component 4 — Brier score decomposition (reliability/resolution/uncertainty)
    Component 6 — Anchor-case battery (pass/fail per case)

Components 2, 5, 7, 8, 9 are Stage 2 / Stage 3 extensions and are NOT
implemented here — they require richer per-cohort data and the full
modular architecture.

Stage 0 deliverable per qgi-docs/internal/ops/ml-track/stage-0-pre-registration.md.
The orchestrator + the pure computation functions are usable independently;
Stage 1 wires real model artifacts + test predictions through them.

Inputs (CLI):
    --metadata    qgi-ml/src/ml_registry.ModelMetadata JSON (from registry)
    --predictions test-set predictions JSON (schema below)
    --anchors     qgi-data/reference/anchor-case-battery.json
    --output      output validation report JSON (defaults to stdout)

Predictions JSON schema (v1):
    {
      "schema_version": 1,
      "model_metadata_uri": "s3://...",
      "predictions": [
        {"country": "...", "year": ...,
         "recipe_id": "...", "predicted_probability": 0.0-1.0, "label": 0|1},
        ...
      ]
    }

Output JSON schema (v1) -- emitted to args.output:
    {
      "schema_version": 1,
      "validation_run_id": "...",
      "generated_at_utc": "...",
      "model_metadata_uri": "...",
      "validation_script_fingerprint": {file_sha256, git_commit_sha, git_dirty, ...},
      "components": {
        "oos_by_time": {"per_recipe": {<recipe>: {auc_point, auc_ci_95, n}}},
        "calibration":  {"per_recipe": {<recipe>: {ece, n_bins, reliability_diagram}}},
        "brier":        {"per_recipe": {<recipe>: {reliability, resolution, uncertainty, brier_score}}},
        "anchor_battery": {"active": [{...}], "deferred": [{...}]}
      }
    }

Per-recipe blocks key on recipe_id present in predictions.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
import sys
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ANCHORS = REPO_ROOT / "qgi-data" / "reference" / "anchor-case-battery.json"

# Lazy import of ml_registry for fingerprint helper
_SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))


# ---------- AUC + bootstrap CI (Component 1) ----------


def compute_auc(predictions: np.ndarray, labels: np.ndarray) -> float:
    """ROC-AUC computed via the rank statistic.

    Returns NaN if labels contain only one class (AUC undefined).
    Self-contained -- avoids the sklearn dep in this hot path.
    """
    predictions = np.asarray(predictions, dtype=float)
    labels = np.asarray(labels, dtype=int)
    if predictions.shape != labels.shape:
        raise ValueError(f"shape mismatch: predictions {predictions.shape} vs labels {labels.shape}")
    n_pos = int((labels == 1).sum())
    n_neg = int((labels == 0).sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    # Rank-statistic AUC: average rank of positives among all observations.
    # Equivalent to Mann-Whitney U / (n_pos * n_neg).
    order = np.argsort(predictions, kind="mergesort")
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(1, len(predictions) + 1)
    # Average ranks of tied predictions (standard convention)
    sorted_preds = predictions[order]
    i = 0
    while i < len(sorted_preds):
        j = i
        while j + 1 < len(sorted_preds) and sorted_preds[j + 1] == sorted_preds[i]:
            j += 1
        if j > i:
            mean_rank = ranks[order[i:j + 1]].mean()
            ranks[order[i:j + 1]] = mean_rank
        i = j + 1
    sum_ranks_pos = ranks[labels == 1].sum()
    auc = (sum_ranks_pos - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)
    return float(auc)


def bootstrap_auc_ci(
    predictions: np.ndarray,
    labels: np.ndarray,
    n_bootstrap: int = 1000,
    confidence: float = 0.95,
    seed: int = 0,
) -> dict[str, Any]:
    """Bootstrap 95% CI on AUC via resampling with replacement.

    Returns {auc_point, auc_ci_low, auc_ci_high, n, n_bootstrap, n_valid_resamples}.
    """
    predictions = np.asarray(predictions, dtype=float)
    labels = np.asarray(labels, dtype=int)
    n = len(predictions)
    point = compute_auc(predictions, labels)
    if not (0.0 <= confidence < 1.0):
        raise ValueError(f"confidence must be in [0, 1); got {confidence}")
    rng = np.random.default_rng(seed)
    aucs: list[float] = []
    for _ in range(n_bootstrap):
        idx = rng.integers(0, n, size=n)
        a = compute_auc(predictions[idx], labels[idx])
        if not math.isnan(a):
            aucs.append(a)
    if not aucs:
        ci_low = ci_high = float("nan")
    else:
        lo_pct = (1 - confidence) / 2 * 100
        hi_pct = (1 + confidence) / 2 * 100
        ci_low = float(np.percentile(aucs, lo_pct))
        ci_high = float(np.percentile(aucs, hi_pct))
    return {
        "auc_point": point,
        "auc_ci_low": ci_low,
        "auc_ci_high": ci_high,
        "confidence": confidence,
        "n": n,
        "n_bootstrap": n_bootstrap,
        "n_valid_resamples": len(aucs),
    }


# ---------- Calibration / ECE (Component 3) ----------


def compute_ece_and_reliability(
    predictions: np.ndarray,
    labels: np.ndarray,
    n_bins: int = 10,
) -> dict[str, Any]:
    """Expected Calibration Error + reliability diagram (decile bucketing).

    ECE = sum_b (n_b / N) * |observed_rate_b - predicted_mean_b|
    """
    predictions = np.asarray(predictions, dtype=float)
    labels = np.asarray(labels, dtype=int)
    if predictions.size == 0:
        return {"ece": float("nan"), "n_bins": n_bins, "reliability_diagram": []}
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    bins: list[dict[str, Any]] = []
    ece_acc = 0.0
    n = len(predictions)
    for k in range(n_bins):
        lo, hi = edges[k], edges[k + 1]
        # Upper edge inclusive on the last bin so 1.0 lands somewhere
        if k == n_bins - 1:
            mask = (predictions >= lo) & (predictions <= hi)
        else:
            mask = (predictions >= lo) & (predictions < hi)
        n_b = int(mask.sum())
        if n_b == 0:
            bins.append({
                "bin": k, "edge_low": float(lo), "edge_high": float(hi),
                "n": 0, "predicted_mean": None, "observed_rate": None,
            })
            continue
        pred_mean = float(predictions[mask].mean())
        obs_rate = float(labels[mask].mean())
        bins.append({
            "bin": k, "edge_low": float(lo), "edge_high": float(hi),
            "n": n_b, "predicted_mean": pred_mean, "observed_rate": obs_rate,
        })
        ece_acc += (n_b / n) * abs(obs_rate - pred_mean)
    return {"ece": float(ece_acc), "n_bins": n_bins, "reliability_diagram": bins}


# ---------- Brier decomposition (Component 4) ----------


def compute_brier_decomposition(
    predictions: np.ndarray,
    labels: np.ndarray,
    n_bins: int = 10,
) -> dict[str, Any]:
    """Decompose Brier score into reliability / resolution / uncertainty.

    BS = uncertainty - resolution + reliability
    Where:
      uncertainty = p * (1 - p), p = base rate
      resolution  = sum_b (n_b/N) * (predicted_mean_b - p)^2
      reliability = sum_b (n_b/N) * (predicted_mean_b - observed_rate_b)^2
    """
    predictions = np.asarray(predictions, dtype=float)
    labels = np.asarray(labels, dtype=int)
    if predictions.size == 0:
        return {
            "brier_score": float("nan"), "uncertainty": float("nan"),
            "resolution": float("nan"), "reliability": float("nan"), "n_bins": n_bins,
        }
    n = len(predictions)
    base_rate = float(labels.mean())
    brier_score = float(((predictions - labels) ** 2).mean())
    uncertainty = base_rate * (1 - base_rate)
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    resolution_acc = 0.0
    reliability_acc = 0.0
    for k in range(n_bins):
        lo, hi = edges[k], edges[k + 1]
        if k == n_bins - 1:
            mask = (predictions >= lo) & (predictions <= hi)
        else:
            mask = (predictions >= lo) & (predictions < hi)
        n_b = int(mask.sum())
        if n_b == 0:
            continue
        pred_mean = float(predictions[mask].mean())
        obs_rate = float(labels[mask].mean())
        resolution_acc += (n_b / n) * (pred_mean - base_rate) ** 2
        reliability_acc += (n_b / n) * (pred_mean - obs_rate) ** 2
    return {
        "brier_score": brier_score,
        "uncertainty": uncertainty,
        "resolution": float(resolution_acc),
        "reliability": float(reliability_acc),
        "n_bins": n_bins,
        "base_rate": base_rate,
    }


# ---------- Anchor battery (Component 6) ----------


def evaluate_anchor_case(
    case: dict[str, Any],
    predictions: list[dict[str, Any]],
) -> dict[str, Any]:
    """Evaluate a single anchor case.

    For point cases (single recipe + country): compute the country's
    percentile rank within that recipe's prediction distribution and check
    whether it falls in expected_rank_band.

    For sentinel cases (recipe_sentinel + resolves_to_layer1): a placeholder
    result indicating the test is composable but requires layer1 lookup
    (Stage 1 will populate this based on the recipe-rubric output).

    Returns:
      {case_id, country, recipe_or_sentinel, status: PASS/FAIL/SKIPPED,
       observed_percentile (if PASS/FAIL), expected_rank_band, reason}
    """
    case_id = case["id"]
    country = case["country"]
    expected_band = case.get("expected_rank_band")
    if "recipe" in case:
        recipe = case["recipe"]
        year_window = case.get("year_window")
        relevant = [p for p in predictions if p.get("recipe_id") == recipe]
        if year_window is not None:
            lo, hi = year_window
            relevant = [p for p in relevant if lo <= p.get("year", -1) <= hi]
        if not relevant:
            return {
                "case_id": case_id, "country": country, "recipe": recipe,
                "status": "SKIPPED",
                "reason": "no predictions for this recipe (or window)",
            }
        country_rows = [p for p in relevant if p.get("country") == country]
        if not country_rows:
            return {
                "case_id": case_id, "country": country, "recipe": recipe,
                "status": "SKIPPED",
                "reason": f"no predictions for country {country!r} in this recipe (or window)",
            }
        sorted_preds = sorted(p["predicted_probability"] for p in relevant)
        country_prob = country_rows[0]["predicted_probability"]
        # Percentile rank: fraction of countries with strictly lower probability
        n_below = sum(1 for v in sorted_preds if v < country_prob)
        n_total = len(sorted_preds)
        percentile = n_below / n_total if n_total > 0 else float("nan")
        # Pass if within expected_rank_band
        pass_fail = (
            "PASS" if expected_band[0] <= percentile <= expected_band[1] else "FAIL"
        )
        return {
            "case_id": case_id, "country": country, "recipe": recipe,
            "status": pass_fail,
            "observed_percentile": percentile,
            "country_prob": country_prob,
            "expected_rank_band": expected_band,
            "n_total": n_total,
        }
    # Sentinel case: requires Layer-1 recipe lookup. Stage 1 fills in the
    # mapping from layer1_id -> [recipe_id, ...] using the rubric output.
    return {
        "case_id": case_id, "country": country,
        "recipe_sentinel": case.get("recipe_sentinel"),
        "resolves_to_layer1": case.get("resolves_to_layer1"),
        "status": "DEFERRED_TO_STAGE_1",
        "reason": "sentinel case requires Layer-1 recipe lookup; orchestrator wires this in Stage 1",
    }


def evaluate_anchor_battery(
    predictions: list[dict[str, Any]],
    anchor_battery: dict[str, Any],
) -> dict[str, Any]:
    """Evaluate the full anchor battery (active + deferred from JSON)."""
    active_results = [
        evaluate_anchor_case(c, predictions)
        for c in anchor_battery.get("active_cases", [])
    ]
    deferred_results = [
        {
            "case_id": c["id"], "country": c["country"], "recipe": c.get("recipe"),
            "status": "DEFERRED_BY_HARD_GATE",
            "reason": c.get("deferred_reason", "deferred per anchor JSON"),
        }
        for c in anchor_battery.get("deferred_cases", [])
    ]
    return {
        "active": active_results,
        "deferred": deferred_results,
        "n_active": len(active_results),
        "n_active_pass": sum(1 for r in active_results if r.get("status") == "PASS"),
        "n_active_fail": sum(1 for r in active_results if r.get("status") == "FAIL"),
        "n_active_skipped": sum(1 for r in active_results if r.get("status") == "SKIPPED"),
        "n_active_deferred_to_stage_1": sum(
            1 for r in active_results if r.get("status") == "DEFERRED_TO_STAGE_1"
        ),
        "n_deferred_by_hard_gate": len(deferred_results),
    }


# ---------- Orchestrator ----------


def run_validation(
    predictions: list[dict[str, Any]],
    anchor_battery: dict[str, Any] | None = None,
    n_bootstrap: int = 1000,
    n_bins: int = 10,
    seed: int = 0,
    model_metadata_uri: str | None = None,
    validation_script_fingerprint: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compute all v1 components and return the report payload."""
    # Group predictions by recipe_id
    by_recipe: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for p in predictions:
        rid = p.get("recipe_id")
        if rid is not None:
            by_recipe[rid].append(p)
    oos_per_recipe: dict[str, Any] = {}
    cal_per_recipe: dict[str, Any] = {}
    brier_per_recipe: dict[str, Any] = {}
    for rid, rows in by_recipe.items():
        preds = np.array([r["predicted_probability"] for r in rows], dtype=float)
        labels = np.array([r["label"] for r in rows], dtype=int)
        oos_per_recipe[rid] = bootstrap_auc_ci(preds, labels, n_bootstrap=n_bootstrap, seed=seed)
        cal_per_recipe[rid] = compute_ece_and_reliability(preds, labels, n_bins=n_bins)
        brier_per_recipe[rid] = compute_brier_decomposition(preds, labels, n_bins=n_bins)
    anchor_results = (
        evaluate_anchor_battery(predictions, anchor_battery)
        if anchor_battery is not None else None
    )
    return {
        "schema_version": 1,
        "validation_run_id": _generate_validation_run_id(),
        "generated_at_utc": _dt.datetime.now(tz=_dt.timezone.utc).isoformat(),
        "model_metadata_uri": model_metadata_uri,
        "validation_script_fingerprint": validation_script_fingerprint,
        "n_predictions": len(predictions),
        "n_recipes": len(by_recipe),
        "params": {"n_bootstrap": n_bootstrap, "n_bins": n_bins, "seed": seed},
        "components": {
            "oos_by_time": {"per_recipe": oos_per_recipe},
            "calibration": {"per_recipe": cal_per_recipe},
            "brier": {"per_recipe": brier_per_recipe},
            "anchor_battery": anchor_results,
        },
        "components_implemented_v1": [1, 3, 4, 6],
        "components_deferred": {
            "stage_2_or_3": [2, 5, 7, 8, 9],
            "rationale": "Stage 1 v0 baseline minimum is components 1+3+4+6 per Stage 0 spec",
        },
    }


def _generate_validation_run_id() -> str:
    return _dt.datetime.now(tz=_dt.timezone.utc).strftime("%Y-%m-%dT%H%M%SZ_validation")


# ---------- CLI ----------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--predictions", type=Path, required=True,
                        help="JSON file with predictions (schema v1)")
    parser.add_argument("--anchors", type=Path, default=DEFAULT_ANCHORS,
                        help=f"anchor-case-battery JSON (default: {DEFAULT_ANCHORS})")
    parser.add_argument("--metadata", type=Path, default=None,
                        help="model metadata URI/path (recorded in report)")
    parser.add_argument("--output", type=Path, default=None,
                        help="output JSON path (default: stdout)")
    parser.add_argument("--n-bootstrap", type=int, default=1000)
    parser.add_argument("--n-bins", type=int, default=10)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)

    pred_payload = json.loads(args.predictions.read_text(encoding="utf-8"))
    predictions = pred_payload["predictions"]
    anchors = json.loads(args.anchors.read_text(encoding="utf-8")) if args.anchors.exists() else None
    model_metadata_uri = pred_payload.get("model_metadata_uri")
    if args.metadata:
        model_metadata_uri = str(args.metadata)
    fingerprint = None
    try:
        from ml_registry import fingerprint_validation_script
        fingerprint = asdict(fingerprint_validation_script(Path(__file__)))
    except Exception:
        pass

    report = run_validation(
        predictions=predictions,
        anchor_battery=anchors,
        n_bootstrap=args.n_bootstrap,
        n_bins=args.n_bins,
        seed=args.seed,
        model_metadata_uri=model_metadata_uri,
        validation_script_fingerprint=fingerprint,
    )
    out = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(out, encoding="utf-8")
        print(f"wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
