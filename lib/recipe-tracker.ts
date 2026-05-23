/**
 * Types and loader for data/recipe-tracker.json — the recipe status board.
 *
 * Schema: recipe-tracker-v1. 71 recipes across 8 L1 families.
 * Server-side only — reads the baked snapshot at SSR/build time.
 *
 * Status values and their visual tiers:
 *   graduated          → GRADUATED (1 recipe, foreign_intervention)
 *   live_legacy        → IN VALIDATION (4 recipes, on dashboard via earlier pathway)
 *   walked_no_graduation → IN VALIDATION (2 recipes, F-ML-1 walked, did not clear gates)
 *   queued             → QUEUED (64 recipes)
 */
import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecipeStatus =
  | "graduated"
  | "live_legacy"
  | "walked_no_graduation"
  | "queued";

export interface RecipeStats {
  loco_auc?: number;
  v1_separation_pp?: number;
  v4_oot_recall?: number;
  window_y?: number;
  n_indicators?: number;
  n_countries_scored?: number;
  blog_url?: string;
  verdict?: string;
}

export interface Recipe {
  recipe_id: string;
  label: string;
  l1_id: string;
  l1_label: string;
  l1_color: string;
  l2_label: string;
  status: RecipeStatus;
  stats: RecipeStats | null;
}

export interface RecipeTrackerData {
  generated: string;
  schema: string;
  n_recipes: number;
  status_counts: Record<string, number>;
  recipes: Recipe[];
}

export interface RecipeFamily {
  l1_id: string;
  l1_label: string;
  l1_color: string;
  recipes: Recipe[];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const TRACKER_FILE = path.join(process.cwd(), "data", "recipe-tracker.json");

let _cache: RecipeTrackerData | null = null;

/**
 * Load the recipe tracker data. Throws if the file is missing or malformed.
 * Cached in-process after the first read.
 */
export async function loadRecipeTracker(): Promise<RecipeTrackerData> {
  if (_cache !== null) return _cache;
  const raw = await fs.readFile(TRACKER_FILE, "utf-8");
  const parsed = JSON.parse(raw) as RecipeTrackerData;
  if (!parsed.recipes || !Array.isArray(parsed.recipes)) {
    throw new Error("recipe-tracker.json malformed: missing recipes array");
  }
  if (parsed.schema !== "recipe-tracker-v1") {
    throw new Error(
      `recipe-tracker.json schema '${parsed.schema}' unsupported; expected 'recipe-tracker-v1'`
    );
  }
  _cache = parsed;
  return parsed;
}

/**
 * Group recipes by L1 family, preserving the canonical L1 order (A–H).
 */
export function groupByFamily(recipes: Recipe[]): RecipeFamily[] {
  const map = new Map<string, RecipeFamily>();
  for (const recipe of recipes) {
    const existing = map.get(recipe.l1_id);
    if (existing) {
      existing.recipes.push(recipe);
    } else {
      map.set(recipe.l1_id, {
        l1_id: recipe.l1_id,
        l1_label: recipe.l1_label,
        l1_color: recipe.l1_color,
        recipes: [recipe],
      });
    }
  }
  // Sort by l1_id (A–H) to guarantee canonical order
  return Array.from(map.values()).sort((a, b) => a.l1_id.localeCompare(b.l1_id));
}

/**
 * Map a recipe status to its visual tier label.
 */
export function tierLabel(status: RecipeStatus): string {
  switch (status) {
    case "graduated":
      return "Graduated";
    case "live_legacy":
    case "walked_no_graduation":
      return "In Validation";
    case "queued":
      return "Queued";
  }
}
