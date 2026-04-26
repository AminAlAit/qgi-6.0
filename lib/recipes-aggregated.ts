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

// ---------------------------------------------------------------------------
// Country-recipe scores (mock for #463) — same file as the recipe types so
// callers usually wanting both don't have to import twice.
// ---------------------------------------------------------------------------

export interface CountryRecipeScoresFile {
  generated_at: string;
  schema_version: number;
  pipeline_version: string;
  /** country slug → { event_category → similarity score [0..1] } */
  scores: Record<string, Record<string, number>>;
}

// Loader functions live in `./recipes-aggregated-loader.ts` — that module
// is poisoned with `import "server-only"` so client components can import
// the types + URL helpers below without bundling `fs/promises` (which
// Webpack / Turbopack can't resolve in the browser bundle and 500s the
// route). See #470 follow-up; bug introduced by the original #464 PR.

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
