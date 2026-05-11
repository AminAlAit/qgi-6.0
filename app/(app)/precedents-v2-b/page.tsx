import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { PrecedentsV2List } from "@/components/precedents-v2/PrecedentsV2List";
import type { Metadata } from "next";

/**
 * /precedents-v2-b — Lloyd's-style variant of the V2 ML precedents index.
 *
 * Identical data + structure to /precedents-v2-a; caveats render as
 * full-width banners (Lloyd's actuarial readability) instead of footnotes.
 *
 * Reads `data/ml-recipe-stack.json` (#643 bake output) at SSR time.
 */

export const metadata: Metadata = {
  title: "Precedents V2 (Lloyd's) — QGI Intelligence",
  description:
    "Top-4 ML-derived precedent recipes with banner-style buyer-disclosure caveats. Lloyd's variant of the V2 precedents browser; Tufte footnote variant at /precedents-v2-a.",
  alternates: { canonical: "https://qgintelligence.com/precedents-v2-b" },
  openGraph: {
    title: "Precedents V2 (Lloyd's) — QGI Intelligence",
    description:
      "Top-4 ML-derived precedent recipes with banner-style buyer-disclosure caveats.",
    url: "https://qgintelligence.com/precedents-v2-b",
    siteName: "QGI Intelligence",
    type: "website",
  },
};

export default async function PrecedentsV2BPage() {
  try {
    const stack = await loadMlRecipeStack();
    const topFour = stack.recipes.filter((r) =>
      stack.metadata.top_4_recipes.includes(r.recipe_id)
    );
    const modelVersion = topFour[0]?.model_version ?? "v1.0";
    // TODO(qgi-ml bake): see /precedents-v2-a/page.tsx — replace this
    // hardcoded value with stack.metadata.n_total_locked once the bake
    // exposes it.
    const totalLocked = 13;
    return (
      <PrecedentsV2List
        recipes={topFour}
        caveatStyle="lloyds"
        generatedAt={stack.metadata.generated_at}
        modelVersion={modelVersion}
        totalLocked={totalLocked}
      />
    );
  } catch (err) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Precedents V2 (Lloyd&apos;s)
        </h1>
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            ML recipe stack not available: {(err as Error).message}
          </p>
        </div>
      </div>
    );
  }
}
