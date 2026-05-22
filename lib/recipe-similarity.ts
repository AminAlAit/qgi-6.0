/**
 * Types and loader for recipe similarity artifacts — the V1 risk-metric
 * pipeline output (Miriam M14-R5 BINDING, 3-Sonnet ratified 2026-05-22).
 *
 * Four artifacts per recipe, baked by qgi-ml/scripts/:
 *   - shap-importances-{recipe_id}.json           → ShapImportances
 *   - recipe-similarity-scores-{recipe_id}-{year}.json → SimilarityScoresFile
 *   - similarity-validations-{recipe_id}.json     → SimilarityValidations
 *   - panel-wide-z-distribution-{year}.json       → PanelWideZDistribution
 *
 * Files are committed to qgi-frontend/data/risk-metric/ at build time
 * (same pattern as data/country-risks.json). No S3 fetch at runtime.
 *
 * Schema mirrors the exact JSON shapes produced by qgi-data#56.
 * Keep in sync if the bake script schema evolves; increment schema_version
 * if breaking changes occur.
 */
import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types — match qgi-data#56 artifact shapes exactly
// ---------------------------------------------------------------------------

/** Normalized SHAP importance weight for one indicator (0..1). */
export interface ShapIndicatorWeight {
  last_z: number;
  mean_z: number;
  std_z: number;
  slope: number;
  accel: number;
  tertile1_mean: number;
  tertile2_mean: number;
  tertile3_mean: number;
}

/** Normalized SHAP importance weights for each indicator. */
export interface RecipeShapWeights {
  recipe_id: string;
  computed_at_utc: string;
  seed_used: number;
  chosen_window_from_walk: number;
  binding_rider_provenance: string;
  selected_indicators: string[];
  shap_importance_raw: Record<string, number>;
  /** Binding weights (normalized to sum 1.0). Use these, not raw. */
  shap_importance_normalized: Record<string, number>;
  shap_direction_signs: Record<string, number>;
  per_feature_breakdown: Record<string, ShapIndicatorWeight>;
  n_samples_for_shap: number;
  n_positives_in_sample: number;
  n_negatives_in_sample: number;
  shap_method: string;
  model_refit: string;
}

/** Per-indicator contribution within one country's similarity score. */
export interface PerIndicatorContribution {
  cosine: number;
  weight: number;
  weighted_contribution: number;
}

/** Similarity score entry for one country. */
export interface RecipeSimilarityScore {
  cosine_similarity_S: number;
  /** 0–100 risk score derived from cosine_similarity_S. */
  risk_score: number;
  zone: "HIGH" | "MODERATE" | "LOW";
  zone_label: string;
  per_indicator: Record<string, PerIndicatorContribution>;
  aggregation_method: string;
  /** Optional: path to audit chart PNG (may be absent for non-top-K countries). */
  audit_chart_path?: string;
}

/** Full similarity scores file for one recipe+year. */
export interface SimilarityScoresFile {
  schema_version: number;
  recipe_id: string;
  evaluation_year: number;
  computed_at_utc: string;
  scoring_metric: string;
  selected_indicators: string[];
  chosen_window: number;
  shap_importance_normalized: Record<string, number>;
  n_countries_scored: number;
  scores: Record<string, RecipeSimilarityScore>;
  /** Top-K country list for audit chart overlay. */
  top_k_for_audit_charts?: string[];
}

/** Cohort distribution summary for Validation 3. */
export interface CohortDistribution {
  n: number;
  median?: number;
  mean?: number;
  q25?: number;
  q75?: number;
  max?: number;
  min?: number;
}

/** Per-event entry in Validation 4 OOT holdout. */
export interface OotEventDetail {
  country: string;
  event_year: number;
  risk_score: number;
  zone: "HIGH" | "MODERATE" | "LOW";
  high_threshold_pass: boolean;
}

/** Full validation results for one recipe. */
export interface RecipeValidationResults {
  schema_version: number;
  recipe_id: string;
  evaluation_year: number;
  computed_at_utc: string;
  hard_gates_pass: {
    v1_positive_recall: boolean;
    v4_oot_holdout: boolean;
  };
  all_hard_gates_pass: boolean;
  production_graduation_eligible: boolean;
  validations: {
    v1: {
      name: string;
      n_positive_evaluated: number;
      n_positive_skipped_partial_coverage: number;
      n_non_event_sampled: number;
      median_similarity_positive_at_eventY_minus_1?: number;
      "median_similarity_positive_at_eventY-1"?: number;
      median_similarity_non_event: number;
      separation_percentile_points: number;
      hard_gate_threshold: number;
      hard_gate_pass: boolean;
      m8_r3_publication_anchor?: string;
    };
    v2: {
      name: string;
      n_matched_pairs: number;
      pearson_correlation: number;
      spearman_correlation: number;
      interpretation: string;
    };
    v3: {
      name: string;
      evaluation_year: number;
      cohort_distributions: Record<string, CohortDistribution>;
      interpretation: string;
    };
    v4: {
      name: string;
      oot_split_year: number;
      n_holdout_positives: number;
      n_holdout_skipped_partial_coverage: number;
      n_at_or_above_high_threshold: number;
      high_threshold_value: number;
      recall_at_high_threshold: number;
      hard_gate_threshold: number;
      hard_gate_pass: boolean;
      interpretation: string;
      per_event_details?: OotEventDetail[];
    };
  };
}

/** Pre-baked panel-wide z-score distribution. */
export interface PanelWideZDistribution {
  evaluation_year: number;
  computed_at_utc: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Loaders — reads from data/risk-metric/ at SSR time
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data", "risk-metric");

let _shapCache: Map<string, RecipeShapWeights> = new Map();
let _scoresCache: Map<string, SimilarityScoresFile> = new Map();
let _validationsCache: Map<string, RecipeValidationResults> = new Map();

/**
 * Load SHAP importances for a recipe.
 * Throws if file missing — callers should catch and surface notFound().
 */
export async function loadShapWeights(recipeId: string): Promise<RecipeShapWeights> {
  const cached = _shapCache.get(recipeId);
  if (cached) return cached;
  const file = path.join(DATA_DIR, `shap-importances-${recipeId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  const parsed = JSON.parse(raw) as RecipeShapWeights;
  _shapCache.set(recipeId, parsed);
  return parsed;
}

/**
 * Load similarity scores for a recipe+year.
 * Defaults to the latest baked year (2021 for V1).
 */
export async function loadSimilarityScores(
  recipeId: string,
  year = 2021
): Promise<SimilarityScoresFile> {
  const key = `${recipeId}-${year}`;
  const cached = _scoresCache.get(key);
  if (cached) return cached;
  const file = path.join(DATA_DIR, `recipe-similarity-scores-${recipeId}-${year}.json`);
  const raw = await fs.readFile(file, "utf-8");
  const parsed = JSON.parse(raw) as SimilarityScoresFile;
  _scoresCache.set(key, parsed);
  return parsed;
}

/**
 * Load validation results for a recipe.
 */
export async function loadSimilarityValidations(
  recipeId: string
): Promise<RecipeValidationResults> {
  const cached = _validationsCache.get(recipeId);
  if (cached) return cached;
  const file = path.join(DATA_DIR, `similarity-validations-${recipeId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  const parsed = JSON.parse(raw) as RecipeValidationResults;
  _validationsCache.set(recipeId, parsed);
  return parsed;
}

/**
 * Return all scored countries grouped and sorted by zone for a recipe+year.
 * HIGH desc, MODERATE desc, LOW desc — within each zone sorted by risk_score.
 */
export function groupCountriesByZone(scores: SimilarityScoresFile): {
  high: Array<{ name: string } & RecipeSimilarityScore>;
  moderate: Array<{ name: string } & RecipeSimilarityScore>;
  low: Array<{ name: string } & RecipeSimilarityScore>;
} {
  const high: Array<{ name: string } & RecipeSimilarityScore> = [];
  const moderate: Array<{ name: string } & RecipeSimilarityScore> = [];
  const low: Array<{ name: string } & RecipeSimilarityScore> = [];

  for (const [name, entry] of Object.entries(scores.scores)) {
    const row = { name, ...entry };
    if (entry.zone === "HIGH") high.push(row);
    else if (entry.zone === "MODERATE") moderate.push(row);
    else low.push(row);
  }

  const byScoreDesc = (a: { risk_score: number }, b: { risk_score: number }) =>
    b.risk_score - a.risk_score;

  high.sort(byScoreDesc);
  moderate.sort(byScoreDesc);
  low.sort(byScoreDesc);

  return { high, moderate, low };
}

/**
 * Test-only: clear singleton caches between tests.
 */
export function _resetRecipeSimilarityCaches(): void {
  _shapCache = new Map();
  _scoresCache = new Map();
  _validationsCache = new Map();
}
