import { PatternsMergedListClient } from "@/components/patterns/PatternsMergedListClient";
import type { PatternRow } from "@/lib/types";
import type { Metadata } from "next";
import { canonicalPairKey } from "@/lib/canonical-pair";

/**
 * /patterns — Preview-only route for A3 merger brief Family 4.
 *
 * Build PR #2 of 5 (incremental cadence, founder-gated cutover at PR #5):
 *   - PR #1: route scaffold + Foreign Affairs lede + "What this doesn't
 *     mean" callout + Lloyd's banner + preset chips + 5-col rows-layout
 *     table over the top patterns
 *   - PR #2 (this): persistent left facet rail (Window-tier moved from
 *     filter strip + Country multi-select + Architecture/RCI/L1/Region/
 *     Falsification-status preview-placeholder facets) + 6-tier
 *     vocabulary disclosure strip
 *   - PR #3: per-pattern detail page /patterns/[slug]
 *   - PR #4: flagship section (sparkline column + RCI dot per row + cross-
 *     family handoffs)
 *   - PR #5 (founder-gated): kill 2 V2 routes (V2-A + V2-B) + /patterns/
 *     ranking; alias /patterns → /patterns canonical
 *
 * V1 /patterns + V2-A /patterns-v2a + V2-B /patterns-v2b
 * remain LIVE alongside the merged preview so the founder can compare
 * side-by-side until cutover.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 4 — Patterns section lines ~1052-1290)
 *
 * Tier vocabulary on Patterns is the WIDEST of the 4 families — 6 distinct
 * tier systems (PPS-band, CorrTier S/A/B/C, Pattern-window S/M/L/XL-win,
 * Evidence-strength STRONG/MODERATE/MARGINAL, RCI GREEN/YELLOW/RED/INSUFF,
 * Country-tier HIGH/MODERATE/INDICATIVE). PR #1 surfaces the
 * Pattern-window vocabulary on the table; the full disclosure-strip lands
 * in PR #2 alongside the facet rail.
 */

export const metadata: Metadata = {
  title: "Patterns — QGI Intelligence",
  description:
    "Country-pair pattern instances aggregated across 156 countries × 13 locked recipes × 60 years of data.",
  // #699: explicit canonical (was inheriting "/" from root layout).
  alternates: { canonical: "/patterns" },
};

export const revalidate = 3600;

export type PatternWindowTier = "S-win" | "M-win" | "L-win" | "XL-win";

/** Map raw `pattern_tier` from ranking.json to brief-aligned cross-family vocab. */
function mapPatternTier(raw: string | undefined): PatternWindowTier {
  if (raw === "XL") return "XL-win";
  if (raw === "L") return "L-win";
  if (raw === "M") return "M-win";
  return "S-win";
}

export interface PatternsMergedRow extends PatternRow {
  /** Brief-renamed Pattern-window vocab — S-win/M-win/L-win/XL-win. */
  window_tier: PatternWindowTier;
  /** Server-derived stable key for React lists. */
  row_key: string;
}

interface RankingPayload {
  results: PatternRow[];
  generated_at?: string;
}

async function loadRanking(): Promise<RankingPayload> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "ranking.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json: unknown = JSON.parse(raw);
    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as { results?: unknown }).results)
    ) {
      return { results: [] };
    }
    return {
      results: (json as { results: PatternRow[] }).results,
      generated_at: (json as { generated_at?: string }).generated_at,
    };
  } catch {
    return { results: [] };
  }
}

export default async function PatternsMergedPage() {
  const payload = await loadRanking();
  const raw = payload.results;
  // PR #2: still capped at 250; virtual-scroll over the full ranking is
  // deferred to PR #4 alongside the grid layout toggle.
  const rows: PatternsMergedRow[] = raw.slice(0, 250).map((p, i) => ({
    ...p,
    window_tier: mapPatternTier(p.pattern_tier),
    row_key: `${p.country_a}-${p.country_b}-${p.start_year_a}-${i}`,
  }));

  // Tier counts for the metric strip.
  const tierCounts: Record<PatternWindowTier, number> = {
    "S-win": 0,
    "M-win": 0,
    "L-win": 0,
    "XL-win": 0,
  };
  for (const r of rows) tierCounts[r.window_tier]++;

  // Unique pair count over the FULL `payload.results` corpus, using the
  // canonical (sorted, numeric-padded) pair key from
  // `lib/canonical-pair.ts`. Same helper used by `/dashboard` and
  // `/api/patterns/ranking` so all three surfaces report identical
  // counts. Per Opus-4.7 review on PR #100 (Findings 2.2 + 2.3):
  // centralizing this eliminated a three-way divergence that produced
  // the #777 mismatch Marcus surfaced ("9 pairs" on /dashboard vs
  // "4 unique pairs" here).
  const uniquePairs = new Set<string>();
  for (const r of payload.results) {
    uniquePairs.add(canonicalPairKey(r));
  }

  // Earliest + latest start years across the surfaced window (server-derived
  // for the eyebrow line so it stays hydration-stable).
  let firstYear = Infinity;
  let lastYear = -Infinity;
  for (const r of rows) {
    firstYear = Math.min(firstYear, r.start_year_a, r.start_year_b);
    lastYear = Math.max(
      lastYear,
      r.start_year_a + r.pattern_length,
      r.start_year_b + r.pattern_length
    );
  }
  if (firstYear === Infinity) {
    firstYear = 1960;
    lastYear = 2026;
  }

  // PR-iv (2026-05-15) — surface the real bake date from ranking.json
  // (Flavor A fix). Falls back to request-time if the payload lacks the
  // timestamp (older bakes pre-#430).
  const generatedDate = payload.generated_at
    ? payload.generated_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // PR #2 — country list for the multi-select facet. Sorted by frequency
  // desc so the heaviest-firing countries surface first in the dropdown.
  const countryFreq = new Map<string, number>();
  for (const r of rows) {
    countryFreq.set(r.country_a, (countryFreq.get(r.country_a) ?? 0) + 1);
    countryFreq.set(r.country_b, (countryFreq.get(r.country_b) ?? 0) + 1);
  }
  const countryOptions: Array<{ name: string; count: number }> = Array.from(
    countryFreq.entries()
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <PatternsMergedListClient
      rows={rows}
      tierCounts={tierCounts}
      uniquePairCount={uniquePairs.size}
      yearRange={{ first: firstYear, last: lastYear }}
      generatedDate={generatedDate}
      countryOptions={countryOptions}
    />
  );
}
