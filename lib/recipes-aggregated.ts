/**
 * Loader + types for `data/recipes-aggregated-mock.json` (#464 Week 2).
 *
 * Mirror of the future `qgi_data.recipes_aggregated` Glue table per
 * #462. When real data lands in Week 3, swap `loadRecipesAggregated()`
 * to read from S3/Athena and the route handlers don't need to change.
 *
 * We intentionally don't go through Zod here — the file is hand-curated
 * for the mock, and once the pipeline produces it the validation layer
 * will be added in the same PR that wires up the Athena loader.
 */
import type { Route } from "next";

export interface LengthBucket {
  length: number;
  count: number;
}

export interface IndicatorFingerprintEntry {
  indicator_id: number;
  indicator_name: string;
  /** Share of recipes-in-category that include this indicator (0..1). */
  frequency: number;
  /** 95% CI lower bound for frequency. */
  ci_lower: number;
  /** 95% CI upper bound for frequency. */
  ci_upper: number;
  /** Average |Pearson| across the recipes that contain this indicator. */
  avg_corr_magnitude: number;
}

export interface RegionShare {
  region: string;
  share: number;
}

export interface CoverageBiasDiagnostic {
  n_pairs: number;
  oecd_share: number;
  regional_concentration: RegionShare[];
}

export interface RecipeAggregated {
  /** L3 taxonomy slug — primary key for the table. */
  event_category: string;
  canonical_length: number;
  length_distribution: LengthBucket[];
  indicator_fingerprint: IndicatorFingerprintEntry[];
  coverage_bias_diagnostic: CoverageBiasDiagnostic;
  total_instances: number;
  n_distinct_country_pairs: number;
  last_recomputed_at: string;
  contains_predicted: boolean;
}

export interface RecipesAggregatedFile {
  generated_at: string;
  schema_version: number;
  pipeline_version: string;
  recipes: RecipeAggregated[];
}

/**
 * Load the recipes-aggregated dataset. In Week 2 this reads from the
 * baked mock JSON. In Week 3 a parallel branch will read from
 * `s3://qgi-data-lake/.../recipes_aggregated/` and merge.
 */
export async function loadRecipesAggregated(): Promise<RecipesAggregatedFile> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "data", "recipes-aggregated-mock.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as RecipesAggregatedFile;
}

export async function loadRecipeBySlug(slug: string): Promise<RecipeAggregated | null> {
  const data = await loadRecipesAggregated();
  return data.recipes.find((r) => r.event_category === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Country-recipe scores (mock for #463) — co-located here because the same
// caller usually wants both. Real loader will likewise read from S3.
// ---------------------------------------------------------------------------

export interface CountryRecipeScoresFile {
  generated_at: string;
  schema_version: number;
  pipeline_version: string;
  /** country slug → { event_category → similarity score [0..1] } */
  scores: Record<string, Record<string, number>>;
}

export async function loadCountryRecipeScores(): Promise<CountryRecipeScoresFile> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "data", "country-recipe-scores-mock.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as CountryRecipeScoresFile;
}

export async function getCountrySignals(
  countrySlug: string
): Promise<Array<{ event_category: string; score: number }>> {
  const data = await loadCountryRecipeScores();
  const entry = data.scores[countrySlug];
  if (!entry) return [];
  return Object.entries(entry)
    .map(([event_category, score]) => ({ event_category, score }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// URL helpers — keep typed-routes happy in callers.
// ---------------------------------------------------------------------------

/** Canonical /precedents/{slug} URL. */
export function precedentSlugUrl(slug: string): Route {
  return `/precedents/${slug}` as Route;
}

/** Canonical /signals/{country} URL. */
export function signalCountryUrl(countrySlug: string): Route {
  return `/signals/${countrySlug}` as Route;
}

/** Canonical /signals/{country}/{slug} URL. */
export function signalCountryRecipeUrl(countrySlug: string, recipeSlug: string): Route {
  return `/signals/${countrySlug}/${recipeSlug}` as Route;
}
