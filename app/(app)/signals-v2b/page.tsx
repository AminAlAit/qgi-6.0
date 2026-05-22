import { getCountriesSortedByRisk } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { SignalsV2List } from "@/components/signals-v2/SignalsV2List";
import { toBuyerViewList } from "@/lib/buyer-view";
import type { Metadata } from "next";

/**
 * /signals-v2b — Lloyd's-style variant of the V2 ML signals index.
 *
 * Identical data + structure to /signals-v2a; caveats on detail pages
 * render as full-width banners instead of footnotes.
 */

export const metadata: Metadata = {
  title: "Signals V2 (Lloyd's) · QG Intelligence",
  description:
    "Pick a country to view the top-4 LOCKed ML recipes against that country's context. Lloyd's variant; Tufte footnote variant at /signals-v2a.",
  alternates: { canonical: "https://qgintelligence.com/signals-v2b" },
  openGraph: {
    title: "Signals V2 (Lloyd's) · QG Intelligence",
    description:
      "Pick a country to view the top-4 LOCKed ML recipes against that country's context.",
    url: "https://qgintelligence.com/signals-v2b",
    siteName: "QG Intelligence",
    type: "website",
  },
};

const DEFAULT_RECIPE_SLUG = "civil_war_and_insurgency";

export default async function SignalsV2BPage() {
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
        caveatStyle="lloyds"
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
          Signals V2 (Lloyd&apos;s)
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
