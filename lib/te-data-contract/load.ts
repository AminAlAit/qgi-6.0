/**
 * TE sample-10 loader module.
 *
 * Provides typed access to every file in `data/te-sample-10/`.
 * JSON imports are resolved at build-time by Next.js (resolveJsonModule: true).
 *
 * Runtime sanity checks: each loader verifies the shape is non-empty and
 * throws a contract-drift error rather than silently returning garbage data.
 *
 * The 10 sample recipe IDs are:
 *   banking_and_financial_crisis, bilateral_treaty, diplomatic_rupture,
 *   economic_liberalization, economic_nationalization,
 *   ethnic_and_communal_conflict, fiscal_policy_change, government_formation,
 *   migration_and_refugees, terrorist_attack
 */

import type { CardV3 } from "./card-v3";
import type { RecipeScoresFile } from "./scores";
import type { CountryIndex } from "./country-index";
import type { CurrentStateAnalogs } from "./analogs";
import type { ProgramFeed } from "./activity-feed";

// ─── Static JSON imports — each resolved at build time ─────────────────────
// Cards v3
import rawCard_banking_and_financial_crisis from "@/data/te-sample-10/cards-v3/banking_and_financial_crisis.card.json";
import rawCard_bilateral_treaty from "@/data/te-sample-10/cards-v3/bilateral_treaty.card.json";
import rawCard_diplomatic_rupture from "@/data/te-sample-10/cards-v3/diplomatic_rupture.card.json";
import rawCard_economic_liberalization from "@/data/te-sample-10/cards-v3/economic_liberalization.card.json";
import rawCard_economic_nationalization from "@/data/te-sample-10/cards-v3/economic_nationalization.card.json";
import rawCard_ethnic_and_communal_conflict from "@/data/te-sample-10/cards-v3/ethnic_and_communal_conflict.card.json";
import rawCard_fiscal_policy_change from "@/data/te-sample-10/cards-v3/fiscal_policy_change.card.json";
import rawCard_government_formation from "@/data/te-sample-10/cards-v3/government_formation.card.json";
import rawCard_migration_and_refugees from "@/data/te-sample-10/cards-v3/migration_and_refugees.card.json";
import rawCard_terrorist_attack from "@/data/te-sample-10/cards-v3/terrorist_attack.card.json";

// Scores
import rawScores_banking_and_financial_crisis from "@/data/te-sample-10/scores/banking_and_financial_crisis.scores.json";
import rawScores_bilateral_treaty from "@/data/te-sample-10/scores/bilateral_treaty.scores.json";
import rawScores_diplomatic_rupture from "@/data/te-sample-10/scores/diplomatic_rupture.scores.json";
import rawScores_economic_liberalization from "@/data/te-sample-10/scores/economic_liberalization.scores.json";
import rawScores_economic_nationalization from "@/data/te-sample-10/scores/economic_nationalization.scores.json";
import rawScores_ethnic_and_communal_conflict from "@/data/te-sample-10/scores/ethnic_and_communal_conflict.scores.json";
import rawScores_fiscal_policy_change from "@/data/te-sample-10/scores/fiscal_policy_change.scores.json";
import rawScores_government_formation from "@/data/te-sample-10/scores/government_formation.scores.json";
import rawScores_migration_and_refugees from "@/data/te-sample-10/scores/migration_and_refugees.scores.json";
import rawScores_terrorist_attack from "@/data/te-sample-10/scores/terrorist_attack.scores.json";

// Reference files
import rawCountryIndex from "@/data/te-sample-10/countries/country-index.json";
import rawAnalogs from "@/data/te-sample-10/analogs/current-state-analogs.json";
import rawActivityFeed from "@/data/te-sample-10/activity/program-feed.json";
import rawManifest from "@/data/te-sample-10/MANIFEST.json";

// ─── Type assertions ─────────────────────────────────────────────────────────
// JSON imports come in as `unknown`-like — we assert to the contract types.
// The sanity checks below validate the shape at runtime.

const CARD_MAP: Record<string, CardV3> = {
  banking_and_financial_crisis: rawCard_banking_and_financial_crisis as unknown as CardV3,
  bilateral_treaty: rawCard_bilateral_treaty as unknown as CardV3,
  diplomatic_rupture: rawCard_diplomatic_rupture as unknown as CardV3,
  economic_liberalization: rawCard_economic_liberalization as unknown as CardV3,
  economic_nationalization: rawCard_economic_nationalization as unknown as CardV3,
  ethnic_and_communal_conflict: rawCard_ethnic_and_communal_conflict as unknown as CardV3,
  fiscal_policy_change: rawCard_fiscal_policy_change as unknown as CardV3,
  government_formation: rawCard_government_formation as unknown as CardV3,
  migration_and_refugees: rawCard_migration_and_refugees as unknown as CardV3,
  terrorist_attack: rawCard_terrorist_attack as unknown as CardV3,
};

const SCORES_MAP: Record<string, RecipeScoresFile> = {
  banking_and_financial_crisis:
    rawScores_banking_and_financial_crisis as unknown as RecipeScoresFile,
  bilateral_treaty: rawScores_bilateral_treaty as unknown as RecipeScoresFile,
  diplomatic_rupture: rawScores_diplomatic_rupture as unknown as RecipeScoresFile,
  economic_liberalization:
    rawScores_economic_liberalization as unknown as RecipeScoresFile,
  economic_nationalization:
    rawScores_economic_nationalization as unknown as RecipeScoresFile,
  ethnic_and_communal_conflict:
    rawScores_ethnic_and_communal_conflict as unknown as RecipeScoresFile,
  fiscal_policy_change: rawScores_fiscal_policy_change as unknown as RecipeScoresFile,
  government_formation: rawScores_government_formation as unknown as RecipeScoresFile,
  migration_and_refugees: rawScores_migration_and_refugees as unknown as RecipeScoresFile,
  terrorist_attack: rawScores_terrorist_attack as unknown as RecipeScoresFile,
};

// ─── Sanity check helpers ─────────────────────────────────────────────────────

function assertNonEmpty(val: unknown, ctx: string): void {
  if (typeof val !== "object" || val === null) {
    throw new Error(`contract drift: ${ctx} is not an object`);
  }
}

function assertArrayNonEmpty(arr: unknown[], ctx: string): void {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`contract drift: ${ctx} is empty or not an array`);
  }
}

// ─── Public loaders ───────────────────────────────────────────────────────────

/**
 * Load a single card by recipe_id.
 * Throws if the recipe_id is not in the sample-10 set.
 */
export function loadCardV3(recipeId: string): CardV3 {
  const card = CARD_MAP[recipeId];
  if (!card) {
    throw new Error(`contract drift: no card for recipe_id "${recipeId}" in sample-10`);
  }
  assertNonEmpty(card, `card[${recipeId}]`);
  assertNonEmpty(card.greedy_walk, `card[${recipeId}].greedy_walk`);
  return card;
}

/**
 * Load per-country scores for a recipe.
 * Throws if the recipe_id is not in the sample-10 set.
 */
export function loadScores(recipeId: string): RecipeScoresFile {
  const scores = SCORES_MAP[recipeId];
  if (!scores) {
    throw new Error(`contract drift: no scores for recipe_id "${recipeId}" in sample-10`);
  }
  assertNonEmpty(scores, `scores[${recipeId}]`);
  assertArrayNonEmpty(scores.scores, `scores[${recipeId}].scores`);
  return scores;
}

/** Load the country index. */
export function loadCountryIndex(): CountryIndex {
  const idx = rawCountryIndex as unknown as CountryIndex;
  assertNonEmpty(idx, "country-index");
  assertArrayNonEmpty(idx.countries, "country-index.countries");
  return idx;
}

/** Load the current-state analogs. */
export function loadAnalogs(): CurrentStateAnalogs {
  const data = rawAnalogs as unknown as CurrentStateAnalogs;
  assertNonEmpty(data, "analogs");
  assertArrayNonEmpty(data.entries, "analogs.entries");
  return data;
}

/** Load the program activity feed. */
export function loadActivityFeed(): ProgramFeed {
  const feed = rawActivityFeed as unknown as ProgramFeed;
  assertNonEmpty(feed, "activity-feed");
  assertArrayNonEmpty(feed.events, "activity-feed.events");
  return feed;
}

/** Load all 10 cards at once — returns the full map. */
export function loadAllCards(): Record<string, CardV3> {
  // Validate all cards are accessible
  for (const id of Object.keys(CARD_MAP)) {
    assertNonEmpty(CARD_MAP[id], `card[${id}]`);
  }
  return CARD_MAP;
}

/** Load all 10 scores files at once. */
export function loadAllScores(): Record<string, RecipeScoresFile> {
  for (const id of Object.keys(SCORES_MAP)) {
    assertNonEmpty(SCORES_MAP[id], `scores[${id}]`);
  }
  return SCORES_MAP;
}

/** Vintage stamp from the MANIFEST. */
export function loadVintage(): string {
  return (rawManifest as { produced_at_utc: string }).produced_at_utc;
}

export const SAMPLE_10_RECIPE_IDS = Object.keys(CARD_MAP) as string[];
