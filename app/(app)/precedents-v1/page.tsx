import { loadRecipesAggregated } from "@/lib/recipes-aggregated-loader";
import { PrecedentsAggregatedListClient } from "@/components/precedents-v1/PrecedentsAggregatedListClient";
import type { Metadata } from "next";

/**
 * #464 — Precedents index, REFACTORED for V2.0.
 *
 * Old page (V1.x) listed ~hundreds of country-category precedent rows.
 * Per Agent D's UX architecture memo + 2026-04-25 Majles Decision 4
 * (11-0 unanimous), precedents are now the *Level-4 Recipe* aggregate:
 * one row per L3 category, sorted by total_instances desc. The
 * country-vs-recipe leaf moves to /signals/{country}/{slug}.
 *
 * Week 2: reads from `data/recipes-aggregated-mock.json`. Week 3 swaps
 * to the real `qgi_data.recipes_aggregated` table (#462).
 */

export const metadata: Metadata = {
  title: "Precedents — QGI Intelligence",
  description:
    "Browse the 71 historical recipes — one per event category — ranked by the depth of historical evidence backing each pattern.",
  alternates: { canonical: "https://qgintelligence.com/precedents-v1" },
  openGraph: {
    title: "Precedents — QGI Intelligence",
    description:
      "Browse the 71 historical recipes — one per event category — ranked by the depth of historical evidence backing each pattern.",
    url: "https://qgintelligence.com/precedents-v1",
    siteName: "QGI Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Precedents — QGI Intelligence",
    description:
      "Browse the 71 historical recipes — one per event category — ranked by the depth of historical evidence backing each pattern.",
  },
};

export default async function PrecedentsPage() {
  let data;
  try {
    data = await loadRecipesAggregated();
  } catch (err) {
    return (
      <div className="p-8">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Precedents
        </h1>
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            Aggregated recipe data not available: {(err as Error).message}
          </p>
        </div>
      </div>
    );
  }

  // Sort by total_instances desc, then alphabetical for ties.
  const sorted = [...data.recipes].sort((a, b) => {
    const diff = b.total_instances - a.total_instances;
    if (diff !== 0) return diff;
    return a.event_category.localeCompare(b.event_category);
  });

  return (
    <PrecedentsAggregatedListClient
      recipes={sorted}
      generatedAt={data.generated_at}
      pipelineVersion={data.pipeline_version}
    />
  );
}
