/**
 * recipe-canonical-shape — the recipe's canonical per-indicator movement
 * shape (the path a country must trace to score high), sourced from the
 * methodology bake's `trajectory_alignment`.
 *
 * IMPORTANT: the current live scoring vintage (te-fleet-run-1) does NOT bake
 * a per-indicator canonical shape into its cards. The te-sample-10 vintage
 * did, for the 10 sample recipes, and its indicator sets line up with the
 * fleet country paths. We read the canonical shape from there so the
 * country-vs-canonical overlay can render with real data for those recipes.
 * For every other recipe the overlay falls back to the country's own path
 * and a "canonical shape pending this vintage" note. Backend ask to bake the
 * per-indicator canonical shape across the full fleet:
 *   qgi-docs/internal/ops/recipe-canonical-shape-request-2026-05-31.md
 */
import card_banking from "@/data/te-sample-10/cards-v3/banking_and_financial_crisis.card.json";
import card_bilateral from "@/data/te-sample-10/cards-v3/bilateral_treaty.card.json";
import card_diplomatic from "@/data/te-sample-10/cards-v3/diplomatic_rupture.card.json";
import card_econlib from "@/data/te-sample-10/cards-v3/economic_liberalization.card.json";
import card_econnat from "@/data/te-sample-10/cards-v3/economic_nationalization.card.json";
import card_ethnic from "@/data/te-sample-10/cards-v3/ethnic_and_communal_conflict.card.json";
import card_fiscal from "@/data/te-sample-10/cards-v3/fiscal_policy_change.card.json";
import card_govform from "@/data/te-sample-10/cards-v3/government_formation.card.json";
import card_migration from "@/data/te-sample-10/cards-v3/migration_and_refugees.card.json";
import card_terror from "@/data/te-sample-10/cards-v3/terrorist_attack.card.json";

interface TrajectoryAlignment {
  window_years: number;
  indicators: Array<{
    code: string;
    shape: { mean: number[]; p25: number[]; p75: number[] };
  }>;
}

const CARDS: Record<string, { trajectory_alignment?: TrajectoryAlignment }> = {
  banking_and_financial_crisis: card_banking as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  bilateral_treaty: card_bilateral as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  diplomatic_rupture: card_diplomatic as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  economic_liberalization: card_econlib as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  economic_nationalization: card_econnat as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  ethnic_and_communal_conflict: card_ethnic as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  fiscal_policy_change: card_fiscal as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  government_formation: card_govform as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  migration_and_refugees: card_migration as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
  terrorist_attack: card_terror as unknown as {
    trajectory_alignment?: TrajectoryAlignment;
  },
};

export interface CanonicalShape {
  /** mean trajectory across the canonical window (z-scored, length = window). */
  mean: number[];
  p25: number[];
  p75: number[];
}

export interface RecipeCanonical {
  windowYears: number;
  byCode: Map<string, CanonicalShape>;
}

/**
 * Canonical per-indicator shape for a recipe, or null when no canonical-shape
 * bake exists for it in any available vintage.
 */
export function getRecipeCanonical(recipeId: string): RecipeCanonical | null {
  const ta = CARDS[recipeId]?.trajectory_alignment;
  if (!ta || !Array.isArray(ta.indicators) || ta.indicators.length === 0) return null;
  return {
    windowYears: ta.window_years,
    byCode: new Map(ta.indicators.map((i) => [i.code, i.shape])),
  };
}
