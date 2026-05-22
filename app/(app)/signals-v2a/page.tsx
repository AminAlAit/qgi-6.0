import { getCountriesSortedByRisk } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { SignalsV2List } from "@/components/signals-v2/SignalsV2List";
import { toBuyerViewList } from "@/lib/buyer-view";
import type { Metadata } from "next";

/**
 * /signals-v2a — Tufte-style variant of the V2 ML signals index.
 *
 * MVP-shallow scope (#655 founder pick 2026-05-12): country picker grid.
 * Each card links to the (country, default-recipe) detail page. Default
 * recipe is `civil_war_and_insurgency` — the only STRONG + risk_elevation
 * recipe in the top-4. Per-(country, recipe) firing scores arrive in a
 * future bake.
 */

export const metadata: Metadata = {
  title: "Signals V2 (Tufte) · QG Intelligence",
  description:
    "Pick a country to view the top-4 LOCKed ML recipes against that country's context. Tufte variant; Lloyd's banner variant at /signals-v2b.",
  alternates: { canonical: "https://qgintelligence.com/signals-v2a" },
  openGraph: {
    title: "Signals V2 (Tufte) · QG Intelligence",
    description:
      "Pick a country to view the top-4 LOCKed ML recipes against that country's context.",
    url: "https://qgintelligence.com/signals-v2a",
    siteName: "QG Intelligence",
    type: "website",
  },
};

// civil_war_and_insurgency is the only STRONG-tier risk_elevation recipe in
// the top-4 (post-KI-2 + #656). Default cards link there; users navigate to
// the other 3 via the recipe-switcher on the detail page.
const DEFAULT_RECIPE_SLUG = "civil_war_and_insurgency";

export default async function SignalsV2APage() {
  try {
    const [stack, countries] = await Promise.all([
      loadMlRecipeStack(),
      getCountriesSortedByRisk(),
    ]);
    const buyerStack = toBuyerViewList(stack.recipes);
    const topRecipes = buyerStack.filter((r) =>
      stack.metadata.top_4_recipes.includes(r.recipe_id)
    );
    const modelVersion = topRecipes[0]?.model_version ?? "v1.0";
    return (
      <SignalsV2List
        countries={countries}
        topRecipes={topRecipes}
        caveatStyle="tufte"
        generatedAt={stack.metadata.generated_at}
        modelVersion={modelVersion}
        defaultRecipeSlug={DEFAULT_RECIPE_SLUG}
      />
    );
  } catch (err) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Signals V2 (Tufte)
        </h1>
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            Signals data not available: {(err as Error).message}
          </p>
        </div>
      </div>
    );
  }
}
