import { loadCountryRisks } from "@/lib/country-risks";
import { BaseClient } from "./BaseClient";
import indexData from "@/data/indexes.json";
import taxonomyData from "@/data/taxonomy_hierarchy.json";
import type { IndexEntry, PatternRow, SignalRow } from "@/lib/types";

// T19 #312: /dashboard is a redirect alias for /base — public via SKIP_AUTH
// for now, but not the canonical landing for outside visitors. Explicitly
// de-indexed so search engines surface /base instead.
export const metadata = {
  title: "Dashboard — QGI Intelligence",
  description:
    "QGI command center. Situation summary, watchlist, signal landscape, and data foundation.",
  robots: { index: false, follow: true },
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
    // T13 #306 HIGH fix: minimal shape guard before cast so a malformed
    // ranking.json (empty file, error payload) doesn't ripple into the UI
    // as a cryptic crash. The cast is still a lie — a proper Zod schema
    // would validate every row — but this bounds the blast radius.
    const json: unknown = JSON.parse(raw);
    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as { results?: unknown }).results)
    ) {
      console.warn("[dashboard] ranking.json missing or malformed `results` array");
      return { pairs: [], totalUniquePairs: 0 };
    }
    const results: PatternRow[] = (json as { results: PatternRow[] }).results;
    // Dedupe by pair, keep best PPS per pair.
    //
    // T2 #295 + Sonnet P1-4 fix (2026-04-19): coerce to a zero-padded
    // numeric string for key comparison. Bare `String()` produces
    // `"10" < "2"` (lexicographic — "1" < "2"), which orders pairs
    // differently from any caller that compares numerically. Pad to 6
    // digits so lex-order matches numeric-order for all WB country IDs.
    const padKey = (v: string | number | undefined, fallback: string) => {
      const n = Number(v);
      return Number.isFinite(n) ? String(n).padStart(6, "0") : String(v ?? fallback);
    };
    const bestPerPair = new Map<string, PatternRow>();
    for (const row of results) {
      const a = padKey(row.country_a_id, row.country_a);
      const b = padKey(row.country_b_id, row.country_b);
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
  } catch (err) {
    // T2 #295 fix: log so we don't debug a silent "no pairs" in prod.
    console.error("[dashboard] fetchTopPairs failed:", err);
    return { pairs: [], totalUniquePairs: 0 };
  }
}

/**
 * Load top-50 convergence signals from baked recipes-top50.json.
 * This is the real convergence/signal data with event categories,
 * lead times, and convergence scores.
 */
async function fetchTopSignals(): Promise<SignalRow[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "recipes-top50.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json: unknown = JSON.parse(raw);
    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as { results?: unknown }).results)
    ) {
      console.warn("[dashboard] recipes-top50.json missing or malformed `results` array");
      return [];
    }
    return (json as { results: SignalRow[] }).results;
  } catch (err) {
    console.error("[dashboard] fetchTopSignals failed:", err);
    return [];
  }
}

export default async function BasePage() {
  // Don't bring down the page if any single source 500s.
  const [risksResult, topPairsResult, topSignalsResult] = await Promise.allSettled([
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
