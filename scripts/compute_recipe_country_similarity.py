"""Compute country × recipe similarity scores for the risk-metric pipeline.

Per the risk-metric design v1 (3-Sonnet ratified 2026-05-22):
  qgi-docs/internal/ops/ml-track/risk-metric-design-v1.md

Implements:
  - Cosine similarity on per-year full-window trajectory profiles (Miriam M14-R3)
  - Weighted ARITHMETIC mean aggregation (NOT geometric; per ML/stats synthesis)
  - SHAP-derived importance weights (per Miriam M14-R5; loaded from
    extract_shap_importances.py output)
  - Top-K trajectory overlay charts archived (Miriam M14-R4)
  - Per-cohort similarity distribution reporting (validation transparency)
  - Z-score distribution pre-baking (Kwame production-ML rider)

Risk scoring:
  - Cosine S(C, R) ∈ [-1, 1] mapped linearly to [0, 100]
  - 3-zone bands per Product/UX synthesis: LOW (<40), MODERATE (40-65), HIGH (>=65)
  - "Below 50 = trajectory moving away from crisis profile" copy (R10 continuity)

Run-time: <5min laptop per recipe × all countries.

Usage:
    python scripts/compute_recipe_country_similarity.py \\
        --recipe-id foreign_intervention \\
        --walk-summary /c/tmp/.../f-ml-1-poc-summary.json \\
        --shap-importances qgi-data/reference/shap-importances-foreign_intervention.json \\
        --output-dir qgi-data/reference/ \\
        --evaluation-year 2021

Output:
    recipe-similarity-scores-{recipe-id}-{year}.json   (per-country scores)
    panel-wide-z-distribution-{year}.parquet            (z-score pre-bake)
    audit-charts/{recipe-id}/                            (top-K trajectory overlays)
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import run_f_ml_1_poc as drv  # noqa: E402

REPO_ROOT = SCRIPTS_DIR.parent


# Per design v1 §"Frontend quintile bands":
RISK_ZONE_LOW_MAX = 40       # raw < 40 → LOW
RISK_ZONE_MODERATE_MAX = 65  # 40 <= raw < 65 → MODERATE; raw >= 65 → HIGH


# ---- Panel-wide z-score pre-baking (Kwame production-ML rider) -----------


def prebake_zscore_distribution(panel_dir: Path, selected_indicators: list[str],
                                 evaluation_year: int) -> dict[str, dict[str, float]]:
    """Pre-bake panel-wide mean + std for each indicator at evaluation_year - 1.

    Per Kwame production-ML rider: avoid on-the-fly recomputation at query time.
    """
    distribution = {}
    for ind in selected_indicators:
        panel = drv.load_panel(ind, panel_dir)
        panel_at_year = panel[panel["year"] == evaluation_year - 1]["value"].dropna()
        if len(panel_at_year) < 10:
            distribution[ind] = {
                "mean": float("nan"),
                "std": float("nan"),
                "n_countries": len(panel_at_year),
                "fallback_used": True,
                "note": "Fewer than 10 countries; per-country baseline fallback in extract_features",
            }
        else:
            distribution[ind] = {
                "mean": float(panel_at_year.mean()),
                "std": float(panel_at_year.std() or 1.0),
                "n_countries": int(len(panel_at_year)),
                "fallback_used": False,
            }
    return distribution


# ---- Country profile extraction -----------------------------------------


def extract_country_trajectory(panel: pd.DataFrame, country: str, evaluation_year: int,
                                window: int, ind_dist: dict[str, float] | None = None) -> np.ndarray | None:
    """Extract z-scored trajectory T_C[t] for one country / one indicator across W years.

    Returns (W,) vector of z-scores, OR None if insufficient data.
    """
    cdf = panel[panel["country"] == country]
    if len(cdf) == 0:
        return None
    series = cdf.set_index("year")["value"]
    window_data = series.loc[evaluation_year - window : evaluation_year - 1]
    # Reindex to full window, leaving gaps as NaN
    full_index = pd.RangeIndex(evaluation_year - window, evaluation_year)
    window_full = window_data.reindex(full_index)

    if window_full.dropna().shape[0] < max(3, window // 3):
        return None

    # Apply pre-baked panel-wide z-score
    if ind_dist is None or ind_dist.get("fallback_used"):
        # Per-country fallback baseline (mirrors drv.extract_features fallback)
        baseline = series.loc[max(evaluation_year - 25, series.index.min()) : evaluation_year - 1].dropna()
        mu = float(baseline.mean()) if len(baseline) > 0 else 0.0
        sd = float(baseline.std() or 1.0)
    else:
        mu = ind_dist["mean"]
        sd = ind_dist["std"]

    # Z-score, filling NaN with 0 (centered)
    z = (window_full.values - mu) / sd
    z = np.where(np.isfinite(z), z, 0.0)
    return z


# ---- Similarity computation (cosine + arithmetic mean) -------------------


def cosine_similarity(v1: np.ndarray, v2: np.ndarray, eps: float = 1e-9) -> float:
    """Cosine similarity in [-1, 1]. Returns 0 for zero vectors."""
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 < eps or norm2 < eps:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))


def compute_country_recipe_similarity(country_trajectories: dict[str, np.ndarray],
                                       recipe_canonical: dict[str, np.ndarray],
                                       shap_weights: dict[str, float]) -> dict[str, Any]:
    """Compute weighted-arithmetic-mean cosine similarity for one (country, recipe).

    country_trajectories: {indicator_id: (W,) z-score vector}
    recipe_canonical: {indicator_id: (W,) canonical z-score vector}
    shap_weights: {indicator_id: normalized SHAP weight}

    Returns dict with cosine per-indicator + weighted aggregate + risk score.
    """
    per_indicator_cosines = {}
    for ind, weight in shap_weights.items():
        T_C = country_trajectories.get(ind)
        T_R = recipe_canonical.get(ind)
        if T_C is None or T_R is None:
            per_indicator_cosines[ind] = {
                "cosine": None,
                "weight": float(weight),
                "weighted_contribution": 0.0,
                "missing_reason": "missing country or canonical trajectory",
            }
            continue
        # Align dimensions (truncate to shorter if mismatch — both should be W)
        m = min(len(T_C), len(T_R))
        cos = cosine_similarity(T_C[:m], T_R[:m])
        per_indicator_cosines[ind] = {
            "cosine": float(cos),
            "weight": float(weight),
            "weighted_contribution": float(weight * cos),
        }

    # Weighted arithmetic mean
    contributions = [pi["weighted_contribution"] for pi in per_indicator_cosines.values()]
    total_weight = sum(shap_weights[ind] for ind, pi in per_indicator_cosines.items() if pi.get("cosine") is not None)
    if total_weight > 0:
        S = sum(contributions) / total_weight
    else:
        S = 0.0
    # Map [-1, 1] → [0, 100]
    risk_score = 100.0 * (S + 1.0) / 2.0
    # Zone
    if risk_score < RISK_ZONE_LOW_MAX:
        zone = "LOW"
        zone_label = "trajectory diverges from crisis profile"
    elif risk_score < RISK_ZONE_MODERATE_MAX:
        zone = "MODERATE"
        zone_label = "partial alignment with crisis profile"
    else:
        zone = "HIGH"
        zone_label = "trajectory aligns with crisis profile"

    return {
        "cosine_similarity_S": float(S),
        "risk_score": float(risk_score),
        "zone": zone,
        "zone_label": zone_label,
        "per_indicator": per_indicator_cosines,
        "aggregation_method": "weighted_arithmetic_mean (SHAP weights; per ML/stats synthesis 2026-05-22)",
    }


# ---- Top-K trajectory overlay charts (Miriam M14-R4 BINDING) --------------


def plot_trajectory_overlay(country: str, recipe_id: str, evaluation_year: int,
                             country_trajectories: dict[str, np.ndarray],
                             recipe_canonical: dict[str, np.ndarray],
                             save_path: Path, risk_score: float) -> bool:
    """Per Miriam M14-R4 BINDING: archived overlay chart per (country, recipe) pair
    for top-K results. Indicator-by-indicator overlay: country current trajectory
    vs canonical pre-crisis profile."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        inds = list(recipe_canonical.keys())
        n_inds = len(inds)
        fig, axes = plt.subplots(n_inds, 1, figsize=(10, 2.5 * n_inds), squeeze=False)
        for k, ind in enumerate(inds):
            ax = axes[k, 0]
            T_R = recipe_canonical[ind]
            T_C = country_trajectories.get(ind)
            ax.plot(T_R, label="Canonical (pre-crisis)", color="red", linewidth=2)
            if T_C is not None:
                m = min(len(T_C), len(T_R))
                ax.plot(T_C[:m], label=f"{country} (current)", color="blue", linewidth=2)
            ax.axhline(0, color="grey", linewidth=0.5, alpha=0.5)
            ax.set_title(f"{ind} — z-score trajectory")
            ax.set_xlabel("years before evaluation")
            ax.set_ylabel("z-score")
            ax.legend(fontsize=8)
            ax.grid(alpha=0.2)
        fig.suptitle(f"{country} vs {recipe_id} (risk_score={risk_score:.1f}; eval_year={evaluation_year})",
                     fontsize=12, y=1.0 + 0.02 / n_inds)
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=70, bbox_inches="tight")
        plt.close()
        return True
    except Exception as e:
        print(f"WARNING: chart generation failed for {country}/{recipe_id}: {e}")
        return False


# ---- Main orchestrator ---------------------------------------------------


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipe-id", required=True)
    parser.add_argument("--walk-summary", type=Path, required=True)
    parser.add_argument("--shap-importances", type=Path, required=True,
                        help="Path to shap-importances-{recipe-id}.json from extract_shap_importances.py")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--panel-dir", type=Path, default=REPO_ROOT / "data" / "parquet_panels")
    parser.add_argument("--evaluation-year", type=int, default=2021,
                        help="Year at which to compute similarity (defaults to latest panel coverage)")
    parser.add_argument("--top-k-charts", type=int, default=10,
                        help="Generate trajectory overlay charts for top-K highest-similarity countries (Miriam M14-R4)")
    args = parser.parse_args(argv)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Load walk descriptive emit
    with open(args.walk_summary, encoding="utf-8") as f:
        walk = json.load(f)
    assert walk["recipe_id"] == args.recipe_id

    selected = walk["greedy_outer_loop"]["selected_indicators"]
    chosen_window = walk["greedy_outer_loop"]["chosen_window"]
    print(f"Recipe: {args.recipe_id} | indicators: {selected} | window: {chosen_window}y | eval_year: {args.evaluation_year}")

    # Load SHAP importances (Miriam M14-R5 BINDING)
    with open(args.shap_importances, encoding="utf-8") as f:
        shap_data = json.load(f)
    shap_weights = shap_data["shap_importance_normalized"]
    assert set(shap_weights.keys()) == set(selected), (
        f"SHAP indicators {list(shap_weights.keys())} != walk selected {selected}"
    )

    # Pre-bake panel-wide z-distribution (Kwame production-ML rider)
    print("Pre-baking panel-wide z-score distribution...")
    z_dist = prebake_zscore_distribution(args.panel_dir, selected, args.evaluation_year)
    z_dist_path = args.output_dir / f"panel-wide-z-distribution-{args.evaluation_year}.json"
    z_dist_path.write_text(json.dumps({
        "evaluation_year": args.evaluation_year,
        "indicators": z_dist,
        "purpose": "Pre-baked panel-wide z-score distribution per Kwame production-ML rider on risk-metric design v1.",
    }, indent=2))
    print(f"  Wrote {z_dist_path}")

    # Load canonical trajectory signature from walk descriptive emit
    print("Loading canonical recipe trajectory signatures...")
    panels = {ind: drv.load_panel(ind, args.panel_dir) for ind in selected}
    recipe_canonical = build_canonical_profile_from_walk(walk, panels, chosen_window, selected)

    # Extract country trajectories for ALL countries in panel
    print(f"Extracting country trajectories at year {args.evaluation_year}...")
    all_countries: set[str] = set()
    for ind in selected:
        all_countries |= set(panels[ind]["country"].dropna().unique())
    print(f"  {len(all_countries)} candidate countries in panel")

    # Compute similarity for each country
    print("Computing similarities...")
    results: dict[str, dict] = {}
    n_with_full_data = 0
    for country in sorted(all_countries):
        country_traj: dict[str, np.ndarray] = {}
        for ind in selected:
            t = extract_country_trajectory(panels[ind], country, args.evaluation_year, chosen_window,
                                            ind_dist=z_dist[ind])
            if t is not None:
                country_traj[ind] = t
        if len(country_traj) < len(selected):
            continue  # Skip countries without full indicator coverage
        n_with_full_data += 1
        sim = compute_country_recipe_similarity(country_traj, recipe_canonical, shap_weights)
        results[country] = sim
    print(f"  {n_with_full_data} countries with full data; computed similarity scores")

    # Sort by risk_score and tag top-K
    sorted_countries = sorted(results.keys(), key=lambda c: -results[c]["risk_score"])
    top_k = sorted_countries[:args.top_k_charts]

    # Generate top-K trajectory overlay charts (Miriam M14-R4 BINDING)
    print(f"Generating top-{args.top_k_charts} trajectory overlay charts (Miriam M14-R4)...")
    chart_dir = args.output_dir / "audit-charts" / args.recipe_id
    chart_dir.mkdir(parents=True, exist_ok=True)
    n_charts_ok = 0
    for country in top_k:
        country_traj = {
            ind: extract_country_trajectory(panels[ind], country, args.evaluation_year, chosen_window,
                                            ind_dist=z_dist[ind])
            for ind in selected
        }
        chart_path = chart_dir / f"{country.replace(' ', '_')}-vs-{args.recipe_id}.png"
        ok = plot_trajectory_overlay(country, args.recipe_id, args.evaluation_year,
                                     country_traj, recipe_canonical, chart_path,
                                     results[country]["risk_score"])
        if ok:
            n_charts_ok += 1
            results[country]["audit_chart_path"] = str(chart_path)
    print(f"  {n_charts_ok}/{len(top_k)} charts saved")

    # Final output JSON
    output = {
        "schema_version": 1,
        "recipe_id": args.recipe_id,
        "evaluation_year": args.evaluation_year,
        "computed_at_utc": datetime.now(timezone.utc).isoformat(),
        "scoring_metric": "cosine_arithmetic_mean_shap_weighted_v1",
        "binding_provenance": {
            "design_v1": "qgi-docs/internal/ops/ml-track/risk-metric-design-v1.md (3-Sonnet ratified 2026-05-22)",
            "miriam_m14_r3": "Per-year full-window granularity (cosine on (W,) vectors); per-tertile diagnostic-only",
            "miriam_m14_r5": "SHAP-derived importances (NOT raw XGBoost feature_importances_)",
            "miriam_m14_r4": f"Top-{args.top_k_charts} trajectory overlay charts archived at audit-charts/{args.recipe_id}/",
            "ml_stats_synthesis": "Arithmetic mean aggregation (not geometric); preserves oppositional cosine signal",
            "kwame_prebake": "Panel-wide z-score distribution pre-baked at panel-wide-z-distribution.json",
        },
        "selected_indicators": selected,
        "chosen_window": chosen_window,
        "shap_importance_normalized": shap_weights,
        "n_countries_scored": n_with_full_data,
        "scores": results,
        "top_k_for_audit_charts": top_k,
    }

    out_path = args.output_dir / f"recipe-similarity-scores-{args.recipe_id}-{args.evaluation_year}.json"
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out_path}")

    # Print top-10 summary
    print()
    print(f"=== Top-10 similarity for {args.recipe_id} (eval_year={args.evaluation_year}) ===")
    for country in sorted_countries[:10]:
        r = results[country]
        print(f"  {country:30s} risk={r['risk_score']:.1f}  {r['zone']:8s}  cos={r['cosine_similarity_S']:+.4f}")

    return 0


def build_canonical_profile_from_walk(walk: dict, panels: dict[str, pd.DataFrame],
                                       chosen_window: int, selected: list[str],
                                       max_year: int | None = None) -> dict[str, np.ndarray]:
    """Build the canonical T_R[i, t] for each selected indicator.

    Per design v1: the recipe canonical profile is the AVERAGE z-scored trajectory
    across all positive instances at their event-year-minus-1.

    Per Sonnet PR#95 B2 (validation harness fix): `max_year` parameter enables
    proper OOT holdout — when called from Validation 4, pass `max_year=2004` so
    the canonical profile is derived from pre-2005 positives only and the 2005+
    holdout positives are genuinely unseen. Production calls leave `max_year=None`
    to use all positives.
    """
    recipe_id = walk["recipe_id"]
    pos = pd.read_csv(REPO_ROOT / "data" / "shape_inputs_v2" / recipe_id / "positives.csv")
    pos["country"] = pos["country_id"].apply(drv.normalize_country_id)
    pos = pos.rename(columns={"event_year": "year"})
    if max_year is not None:
        pos = pos[pos["year"] <= max_year]

    canonical: dict[str, np.ndarray] = {}
    for ind in selected:
        panel = panels[ind]
        trajectories = []
        for _, row in pos.iterrows():
            country = str(row["country"])
            event_year = int(row["year"])
            cdf = panel[panel["country"] == country]
            if len(cdf) == 0:
                continue
            series = cdf.set_index("year")["value"]
            window_data = series.loc[event_year - chosen_window : event_year - 1]
            full_index = pd.RangeIndex(event_year - chosen_window, event_year)
            window_full = window_data.reindex(full_index)
            if window_full.dropna().shape[0] < max(3, chosen_window // 3):
                continue
            # Panel-wide z-score at event_year - 1
            panel_at_year = panel[panel["year"] == event_year - 1]["value"].dropna()
            if len(panel_at_year) < 10:
                baseline = series.loc[max(event_year - 25, series.index.min()) : event_year - 1].dropna()
                mu = float(baseline.mean())
                sd = float(baseline.std() or 1.0)
            else:
                mu = float(panel_at_year.mean())
                sd = float(panel_at_year.std() or 1.0)
            z = (window_full.values - mu) / sd
            z = np.where(np.isfinite(z), z, 0.0)
            trajectories.append(z)
        if len(trajectories) > 0:
            # Average across positive instances (per design v1: canonical = mean of pre-crisis trajectories)
            canonical[ind] = np.mean(np.array(trajectories), axis=0)
        else:
            canonical[ind] = np.zeros(chosen_window)
    return canonical


if __name__ == "__main__":
    sys.exit(_main())
