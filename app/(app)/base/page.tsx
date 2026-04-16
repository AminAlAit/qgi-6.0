import { loadCountryRisks } from "@/lib/country-risks";
import { BaseClient } from "./BaseClient";
import indexData from "@/data/indexes.json";
import type { IndexEntry, PatternRow } from "@/lib/types";

export const metadata = {
  title: "Base — QGI Intelligence",
  description:
    "QGI command center. A glance at top-risk countries, dominant signals, top pattern pairs, and the data footprint.",
};

/**
 * Server-side fetch of the deduped pattern ranking.
 * Reuses the same /api/patterns/ranking endpoint that the Ranking page uses,
 * which now dedupes by (country_a, country_b) keeping the best window per pair.
 */
async function fetchTopPairs(): Promise<{
  pairs: PatternRow[];
  totalUniquePairs: number;
}> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/patterns/ranking?limit=5`, {
      headers: { Authorization: "Bearer __ssr__" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return { pairs: [], totalUniquePairs: 0 };
    const json = await res.json();
    return {
      pairs: json.results ?? [],
      totalUniquePairs: json.total_unique_pairs ?? 0,
    };
  } catch {
    return { pairs: [], totalUniquePairs: 0 };
  }
}

export default async function BasePage() {
  // Don't bring down the page if any single source 500s.
  const [risksResult, topPairsResult] = await Promise.allSettled([
    loadCountryRisks(),
    fetchTopPairs(),
  ]);

  const risks = risksResult.status === "fulfilled" ? risksResult.value : null;
  const topPairs =
    topPairsResult.status === "fulfilled"
      ? topPairsResult.value
      : { pairs: [], totalUniquePairs: 0 };

  const indexes = indexData as IndexEntry[];

  return (
    <BaseClient
      risks={risks}
      indexes={indexes}
      topPairs={topPairs.pairs}
      totalUniquePairs={topPairs.totalUniquePairs}
    />
  );
}
