import "server-only";
import type {
  CountryRecipeScoresFile,
  RecipeAggregated,
  RecipesAggregatedFile,
} from "./recipes-aggregated";

/**
 * Server-only loaders for the recipes-aggregated dataset (#464 Week 2 mock).
 * Split from `lib/recipes-aggregated.ts` so client components can import
 * the types + URL helpers without bundling `fs/promises` (which Webpack /
 * Turbopack can't resolve in the browser bundle and 500s the route).
 *
 * The "server-only" import poisons this module for client use — any
 * accidental client import triggers a build-time error rather than a
 * runtime mystery.
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
