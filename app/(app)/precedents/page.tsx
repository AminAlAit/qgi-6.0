import {
  loadRecipesAggregated,
  loadCountryRecipeScores,
} from "@/lib/recipes-aggregated-loader";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { toBuyerViewList } from "@/lib/buyer-view";
import { PrecedentsMergedListClient } from "@/components/precedents/PrecedentsMergedListClient";
import type { Metadata } from "next";

/**
 * /precedents — #748 PR-1 (#749), 2026-05-17.
 *
 * Per the revised merger brief
 * `qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-17-precedents-revised.md`,
 * this loader now passes ONLY the LOCKed ML hero recipes to the client.
 * The statistical catalogue is removed from view per the founder's L10525
 * directive ("All other recipes/precedents, other than those 4 must be
 * removed from view"). The catalogue's retirement note lives at
 * `/methodology#catalogue-retirement` (added in PR-3).
 *
 * Sequenced PRs:
 *   - PR-2 (#750) — merged dossier template at /precedents/[slug]
 *   - PR-3 (#751) — retired-slug redirects + sitemap/robots cleanup
 *   - PR-4 (#752) — internal-link sweep + blog/nav consistency
 */

export const metadata: Metadata = {
  title: "Precedents · QG Intelligence",
  description:
    "The recipes the model can predict above chance — each adjudicated end-to-end through blind walk-forward backtest, calibration audit, and the four-pillar lock rubric.",
  alternates: { canonical: "/precedents" },
};

export const revalidate = 3600;

export default async function PrecedentsMergedPage() {
  let aggregated;
  let mlStack;
  try {
    [aggregated, mlStack] = await Promise.all([
      loadRecipesAggregated(),
      loadMlRecipeStack(),
    ]);
  } catch (err) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Precedents
        </h1>
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            Data not available: {(err as Error).message}
          </p>
        </div>
      </div>
    );
  }

  // Buyer-view the full ML stack first (slug map built once); then keep
  // only the LOCKed top-4. The 4-row constraint is enforced by the bake's
  // `metadata.top_4_recipes` allowlist — adding a fifth requires a new
  // bake AND a re-convening of the Family 1 Majles to ratify the new
  // dossier layout.
  const buyerStack = toBuyerViewList(mlStack.recipes);
  const heroRecipes = buyerStack.filter((r) =>
    mlStack.metadata.top_4_recipes.includes(r.recipe_id)
  );

  // Lookup the matching aggregated entries for the 4 LOCKed slugs. Hero
  // recipes WITHOUT an aggregated counterpart are a data-integrity bug
  // (LOCK promotion is gated on the stat substrate) — surface as a
  // skipped row in the client rather than crash the page.
  const aggregatedBySlug = new Map(aggregated.recipes.map((r) => [r.event_category, r]));
  const heroAggregatedBySlug: Record<string, (typeof aggregated.recipes)[number]> = {};
  for (const r of heroRecipes) {
    const agg = aggregatedBySlug.get(r.recipe_id);
    if (agg) heroAggregatedBySlug[r.recipe_id] = agg;
  }

  // Cross-family firing-count: how many countries are currently flagged on
  // each LOCKed recipe in the latest score bake. Surfaced inline next to
  // the recipe name as a "· {n} firing" pill. Loads with graceful fallback
  // (empty map) so the page renders even if the score file is missing.
  const scoresFile = await loadCountryRecipeScores().catch(() => null);
  const firingCountByMlSlug: Record<string, number> = {};
  if (scoresFile) {
    for (const r of heroRecipes) {
      let count = 0;
      for (const byRecipe of Object.values(scoresFile.scores)) {
        if (typeof byRecipe[r.recipe_id] === "number") count++;
      }
      firingCountByMlSlug[r.recipe_id] = count;
    }
  }

  return (
    <PrecedentsMergedListClient
      heroRecipes={heroRecipes}
      heroAggregatedBySlug={heroAggregatedBySlug}
      generatedAt={aggregated.generated_at}
      pipelineVersion={aggregated.pipeline_version}
      modelVersion={heroRecipes[0]?.model_version ?? "v1.0"}
      firingCountByMlSlug={firingCountByMlSlug}
    />
  );
}
