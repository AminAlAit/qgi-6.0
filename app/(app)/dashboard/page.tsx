import { loadCountryRisks } from "@/lib/country-risks";
import { BaseClient } from "./BaseClient";
import indexData from "@/data/indexes.json";
import taxonomyData from "@/data/taxonomy_hierarchy.json";
import type { IndexEntry, PatternRow, SignalRow } from "@/lib/types";

export const metadata = {
  title: "Dashboard — QGI Intelligence",
  description:
    "QGI command center. Situation summary, watchlist, signal landscape, and data foundation.",
};

/**
 * Load top pattern pairs directly from baked ranking.json.
 * No API call needed — the file is in data/.
 */
async function fetchTopPairs(): Promise<{
  pairs: PatternRow[];
  totalUniquePairs: number;
}> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "ranking.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw);
    const results: PatternRow[] = json.results ?? [];
    // Dedupe by pair, keep best PPS per pair
    const bestPerPair = new Map<string, PatternRow>();
    for (const row of results) {
      const a = row.country_a_id ?? row.country_a;
      const b = row.country_b_id ?? row.country_b;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const existing = bestPerPair.get(key);
      if (!existing || row.pattern_power_score > existing.pattern_power_score) {
        bestPerPair.set(key, row);
      }
    }
    const deduped = Array.from(bestPerPair.values())
      .sort((a, b) => b.pattern_power_score - a.pattern_power_score)
      .slice(0, 5);
    return { pairs: deduped, totalUniquePairs: bestPerPair.size };
  } catch {
    return { pairs: [], totalUniquePairs: 0 };
  }
}

/**
 * Load top-50 convergence signals from baked early-warning.json.
 * Falls back to empty if file missing.
 */
async function fetchTopSignals(): Promise<SignalRow[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "early-warning.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw);
    return (json.results ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      start_year_a: Number(r.start_year_a),
      start_year_b: Number(r.start_year_b),
      pattern_length: Number(r.pattern_length),
    })) as SignalRow[];
  } catch {
    return [];
  }
}

export default async function BasePage() {
  // Don't bring down the page if any single source 500s.
  const [risksResult, topPairsResult, topSignalsResult] =
    await Promise.allSettled([
      loadCountryRisks(),
      fetchTopPairs(),
      fetchTopSignals(),
    ]);

  const risks = risksResult.status === "fulfilled" ? risksResult.value : null;
  const topPairs =
    topPairsResult.status === "fulfilled"
      ? topPairsResult.value
      : { pairs: [], totalUniquePairs: 0 };
  const topSignals =
    topSignalsResult.status === "fulfilled" ? topSignalsResult.value : [];

  const indexes = indexData as IndexEntry[];

  return (
    <BaseClient
      risks={risks}
      indexes={indexes}
      topPairs={topPairs.pairs}
      totalUniquePairs={topPairs.totalUniquePairs}
      topSignals={topSignals}
      taxonomy={taxonomyData}
    />
  );
}
