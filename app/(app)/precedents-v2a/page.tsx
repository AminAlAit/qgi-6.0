import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { PrecedentsV2List } from "@/components/precedents-v2/PrecedentsV2List";
import { toBuyerViewList } from "@/lib/buyer-view";
import type { Metadata } from "next";

/**
 * /precedents-v2a — Tufte-style variant of the V2 ML precedents index.
 *
 * Per resurfacing plan Q4 + Q21 (4 distinct V2 routes; both list + detail
 * variants in both Tufte and Lloyd's caveat styles), this page renders the
 * top-4 LOCKed ML recipes with footnote-style caveats. Sister page at
 * `/precedents-v2b` renders the same data with full-width banner caveats.
 *
 * Reads `data/ml-recipe-stack.json` (#643 bake output) at SSR time.
 */

export const metadata: Metadata = {
  title: "Precedents V2 (Tufte) · QG Intelligence",
  description:
    "Top-4 ML-derived precedent recipes with footnote-style buyer-disclosure caveats. Tufte variant of the V2 precedents browser; Lloyd's banner variant at /precedents-v2b.",
  alternates: { canonical: "https://qgintelligence.com/precedents-v2a" },
  openGraph: {
    title: "Precedents V2 (Tufte) · QG Intelligence",
    description:
      "Top-4 ML-derived precedent recipes with footnote-style buyer-disclosure caveats.",
    url: "https://qgintelligence.com/precedents-v2a",
    siteName: "QG Intelligence",
    type: "website",
  },
};

export default async function PrecedentsV2APage() {
  try {
    const stack = await loadMlRecipeStack();
    // Transform RAW recipes through buyer-view so prose is jargon-clean,
    // indicator IDs friendly, and the type system rejects raw at component
    // boundaries. `toBuyerViewList` builds the slug map from the full stack
    // before mapping so cross-recipe references in prose rewrite correctly.
    const buyerStack = toBuyerViewList(stack.recipes);
    const topFour = buyerStack.filter((r) =>
      stack.metadata.top_4_recipes.includes(r.recipe_id)
    );
    // model_version is per-recipe but identical across the top-4 in the
    // current bake (all share dispatch_sha). Take the first.
    const modelVersion = topFour[0]?.model_version ?? "v1.0";
    // TODO(qgi-ml bake): expose `n_total_validated` in stack.metadata so the
    // list copy stays honest when future amendments change the total.
    const totalLocked = 13;
    return (
      <PrecedentsV2List
        recipes={topFour}
        caveatStyle="tufte"
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
          Precedents V2 (Tufte)
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
