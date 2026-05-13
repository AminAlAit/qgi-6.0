import { loadRecipesAggregated } from "@/lib/recipes-aggregated-loader";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { toBuyerViewList } from "@/lib/buyer-view";
import { PrecedentsMergedListClient } from "@/components/precedents-merged/PrecedentsMergedListClient";
import type { Metadata } from "next";

/**
 * /precedents-merged — Preview-only route for A3 merger brief Family 1.
 *
 * Build PR #1 of 5 (incremental cadence, founder-gated cutover at PR #5):
 *   - PR #1 (this): route scaffold + data layer + soft-partition + filter strip + 7-col sortable table
 *   - PR #2: detail page (/precedents-merged/[slug]) with split-render by lineage
 *   - PR #3: click-to-expand mechanism cell + "What we're still testing" collapsible
 *   - PR #4: ARIA + mobile + loading/empty states + follow-up tickets
 *   - PR #5 (founder-gated): kill V1 + 4 V2 routes; alias /precedents-merged → /precedents canonical
 *
 * V1 (/precedents) + V2-A (/precedents-v2-a) + V2-B (/precedents-v2-b) stay
 * alive until PR #5 lands so the founder can preview the merged shell live
 * alongside the existing surfaces before cutover.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 * Detail-link strategy until PR #2 ships:
 *   - ML hero rows → /precedents-v2-b/[slug] (Lloyd's banner — Phase A2 polished)
 *   - Stat catalogue rows → /precedents/[slug] (V1 detail)
 *   - Replaced in PR #2 with /precedents-merged/[slug] split-render
 */

export const metadata: Metadata = {
  title: "Precedents — Merged Preview — QGI Intelligence",
  description:
    "Preview of the merged Precedents shell — 4 ML-validated hero recipes + methodology disclosure strip + 64-recipe statistical catalogue. Cutover from V1 + V2 routes pending founder sign-off.",
  robots: { index: false, follow: false }, // preview only — not indexed
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
          Precedents — Merged Preview
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

  // Buyer-view the full stack first (slug map built once); then partition.
  const buyerStack = toBuyerViewList(mlStack.recipes);
  const heroRecipes = buyerStack.filter((r) =>
    mlStack.metadata.top_4_recipes.includes(r.recipe_id)
  );

  // Catalogue = aggregated recipes whose event_category is NOT in the ML
  // hero top-4 set. Brief: each event_category appears in exactly one zone.
  // Hero rows are joined to their aggregated entry below for INSTANCES /
  // LENGTH / COVERAGE so the 7-col table has uniform metrics across zones.
  const heroSlugs = new Set(heroRecipes.map((r) => r.recipe_id));
  const catalogue = aggregated.recipes.filter((r) => !heroSlugs.has(r.event_category));
  // Lookup map for hero-row aggregated joins.
  const aggregatedBySlug = new Map(aggregated.recipes.map((r) => [r.event_category, r]));

  return (
    <PrecedentsMergedListClient
      heroRecipes={heroRecipes}
      heroAggregatedBySlug={Object.fromEntries(
        heroRecipes
          .map((r) => {
            const agg = aggregatedBySlug.get(r.recipe_id);
            return agg ? [r.recipe_id, agg] : null;
          })
          .filter(
            (kv): kv is [string, (typeof aggregated.recipes)[number]] => kv !== null
          )
      )}
      catalogue={catalogue}
      generatedAt={aggregated.generated_at}
      pipelineVersion={aggregated.pipeline_version}
      modelVersion={heroRecipes[0]?.model_version ?? "v1.0"}
      // Total adjudicated recipes in the current ML dispatch. Hardcoded here
      // until #643 bake exposes `metadata.n_total_validated` (the same TODO
      // that lives on /precedents-v2-{a,b}/page.tsx). Post-KI-2 amendment
      // 2026-05-11: 13 LOCKed.
      totalLocked={13}
    />
  );
}
