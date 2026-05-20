import { PatternsMergedListClient } from "@/components/patterns/PatternsMergedListClient";
import type { PatternRow } from "@/lib/types";
import type { Metadata } from "next";
import { canonicalPairKey } from "@/lib/canonical-pair";
import { loadCountryRisks } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import {
  resolvePatternsInitialFilters,
  type PatternsSearchParams,
  type PatternWindowTier,
} from "@/lib/patterns-initial-filters";
import {
  computePatternTrajectory,
  type PatternTrajectory,
  type VerifiedEvent,
} from "@/lib/pattern-trajectory";

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

// #781: `searchParams`-reading makes this segment dynamic; the prior
// `revalidate = 3600` ISR setting was a no-op once URL state landed.
// Pattern data is read from a bundled JSON, so the per-request cost is
// a local `fs.readFile` — acceptable for the analyst-facing surface.

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
  /** T1 (#59) — leader terminating event + follower arc position. */
  trajectory: PatternTrajectory;
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

/**
 * T1 (#59) — load the verified-events corpus once per request and return
 * a country-indexed Map for O(1) lookup during row enrichment. Empty Map
 * fallback on failure mirrors `loadRanking()` — the page degrades to the
 * missing-event state ("No verified event on record") rather than failing.
 */
async function loadVerifiedEventsByCountry(): Promise<Map<string, VerifiedEvent[]>> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "verified-events.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json: unknown = JSON.parse(raw);
    if (!Array.isArray(json)) return new Map();
    const byCountry = new Map<string, VerifiedEvent[]>();
    for (const item of json as VerifiedEvent[]) {
      if (!item || typeof item.country !== "string" || typeof item.year !== "number") {
        continue;
      }
      const key = item.country.toLowerCase();
      const bucket = byCountry.get(key);
      if (bucket) bucket.push(item);
      else byCountry.set(key, [item]);
    }
    return byCountry;
  } catch {
    return new Map();
  }
}

interface PageProps {
  searchParams: Promise<PatternsSearchParams>;
}

export default async function PatternsMergedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // T1 (#59) — kick off events load in parallel with ranking; both are
  // independent fs reads and we need both before the row map below.
  // #849 — also load ml recipe stack to build lockedRecipeSet for falsification
  // anchor link guard (prevents 404s for non-LOCKed categories).
  const [payload, eventsByCountry, mlStack] = await Promise.all([
    loadRanking(),
    loadVerifiedEventsByCountry(),
    loadMlRecipeStack().catch(() => null),
  ]);
  // #849 — set of the 4 LOCKed ML recipe category slugs; only these have
  // live signals leaves. All others render as plain text (no dead link).
  const lockedRecipeSet: ReadonlySet<string> = new Set(
    mlStack?.metadata.top_4_recipes ?? []
  );
  const raw = payload.results;

  // Gates-doc Rank 4 / face-validity-debt #718 (Marcus R3, Dmitri R3):
  // /patterns previously rendered 250 instance rows but only ~9 unique
  // country pairs (Paraguay→South Korea ×8 of the top 8 was the canonical
  // example). Sliding-window duplicates dominate the visible window.
  // Marcus: "board slide quest dead on arrival."
  //
  // Display-level dedupe: keep ONE row per canonical country pair —
  // specifically the highest-PPS window for that pair. The raw bake is
  // unchanged (#718 root-cause is in ranking.json's emission); the
  // visible rendering now collapses sliding-window duplicates to one
  // best-window row per pair. After the dedupe we still cap at 250 so
  // the page doesn't grow unboundedly when the bake fixes ship.
  const bestByPair = new Map<string, PatternRow>();
  for (const p of raw) {
    const key = canonicalPairKey(p);
    const existing = bestByPair.get(key);
    if (!existing || p.pattern_power_score > existing.pattern_power_score) {
      bestByPair.set(key, p);
    }
  }
  const dedupedRaw = Array.from(bestByPair.values())
    .sort((a, b) => b.pattern_power_score - a.pattern_power_score)
    .slice(0, 250);

  const rows: PatternsMergedRow[] = dedupedRaw.map((p, i) => ({
    ...p,
    window_tier: mapPatternTier(p.pattern_tier),
    row_key: `${p.country_a}-${p.country_b}-${p.start_year_a}-${i}`,
    // T1 (#59) — Phase B trajectory: derive the leader's terminating event
    // (country_a, end_year_a) from `verified-events.json` and compute the
    // follower's elapsed position. Pre-sliced by country to avoid scanning
    // the full corpus once per row.
    trajectory: computePatternTrajectory(
      p,
      eventsByCountry.get(p.country_a.toLowerCase()) ?? []
    ),
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
  //
  // Post-pair-dedupe (Rank 4 / #718, 2026-05-18): this loop iterates the
  // DEDUPED `rows` rather than `payload.results`. The semantic is now
  // "countries with the most unique partner pairs" (each country can
  // contribute at most once per pair), not "countries with the most raw
  // windows in the bake." After #718 ships and the sliding-window bloat
  // is fixed upstream, the two would converge anyway. Switch back to
  // `payload.results` if data-richness sort is preferred over partner-
  // diversity sort.
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

  // #781 — pass the FULL corpus (`payload.results`) not the sliced
  // top-250 `rows`. Otherwise a `?country_a=NN` ID for a country
  // outside the visible window silently drops to no-match.
  //
  // #786(b) — build an alpha_2 → country-name map from the country-
  // risks bake so URLs like `?country_a=TR` resolve to "Turkiye".
  // Karl (Eurasia R5) shared URLs in ISO-code form; the V3 list
  // silently no-op'd. Fail-safe: if the load throws or the bake
  // doesn't carry alpha_2, the alpha2 path is skipped and behavior
  // falls back to numeric-ID resolution.
  const countryRisks = await loadCountryRisks().catch(() => null);
  const alpha2ToName = countryRisks
    ? new Map(
        Object.values(countryRisks.countries).map((c) => [c.alpha_2, c.name] as const)
      )
    : undefined;
  const initialFilters = resolvePatternsInitialFilters(
    params,
    payload.results,
    alpha2ToName
  );

  return (
    <PatternsMergedListClient
      rows={rows}
      tierCounts={tierCounts}
      uniquePairCount={uniquePairs.size}
      yearRange={{ first: firstYear, last: lastYear }}
      generatedDate={generatedDate}
      countryOptions={countryOptions}
      initialFilters={initialFilters}
      lockedRecipeSet={lockedRecipeSet}
    />
  );
}
