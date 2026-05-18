import { loadCountryRisks } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { BaseClient } from "./BaseClient";
import indexData from "@/data/indexes.json";
import taxonomyData from "@/data/taxonomy_hierarchy.json";
import type { IndexEntry, PatternRow, SignalRow } from "@/lib/types";
import { canonicalPairKey } from "@/lib/canonical-pair";

/**
 * PR-vi (2026-05-15) — Dashboard redesigned per JTBD Majles verdict.
 *
 * Dashboard is QGI's canonical front door — the "simple to use" landing
 * surface. The 4 family pages (/precedents, /countries, /signals,
 * /patterns) are the "deep to explore" surface beneath.
 *
 * Old `robots: noindex` removed: Dashboard is now indexable. The /base
 * legacy slug-route (if any) should redirect here or carry its own
 * noindex; this page is the canonical entry point.
 *
 * No new data loaders — every section reads from the existing baked
 * JSONs that the V3 family pages already use:
 *   - country-risks.json  → tier counts + watchlist + outliers + featured
 *   - ranking.json        → top pattern pairs
 *   - recipes-top50.json  → top convergences
 *   - ml-recipe-stack.json → Precedents card validated-count
 *
 * Added in this PR:
 *   - loadMlRecipeStack() call for the Precedents card
 *   - Server-side signals HIGH + MODERATE aggregation (mirrors logic
 *     from /signals/page.tsx; could be extracted to lib/ if a third
 *     consumer ever needs it)
 */
export const metadata = {
  title: "Dashboard — QGI Intelligence",
  description:
    "QGI command center. Consolidated view of countries, signals, patterns, and precedents — the front door to the deeper family pages.",
  // #699: explicit canonical (was inheriting "/" from root layout).
  alternates: { canonical: "/dashboard" },
};

// P1 from #699 audit: align with sibling V3 family pages' ISR cadence.
export const revalidate = 3600;

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
    // Dedupe by canonical (order-insensitive, numeric-padded) pair key,
    // keeping best PPS per pair. The key shape is the single source of
    // truth at `lib/canonical-pair.ts` — same helper used by /patterns
    // and /api/patterns/ranking. Per Opus-4.7 review on PR #100
    // (Findings 2.2 + 2.3): centralizing eliminated a three-way
    // divergence that produced the #777 "9 pairs vs 4 pairs" mismatch.
    const bestPerPair = new Map<string, PatternRow>();
    for (const row of results) {
      const key = canonicalPairKey(row);
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

/**
 * PR-vi — server-side signals aggregation for the four-family band.
 *
 * Mirrors `app/(app)/signals/page.tsx` buildSignals() logic: for each
 * country, dedupe per-category to the highest-salience entry across
 * S/M/L/XL windows; then count categories where max-salience-z >= 2.5
 * (HIGH rung) or 1.0..2.5 (MODERATE rung).
 *
 * Returns the two counts the Section 3 Signals card needs. The
 * `n_high < 3` fallback rule (E1) is applied at render time in
 * BaseClient — this function returns both counts unconditionally.
 *
 * 13 locked recipes per ML Stage 4 pre-registration (qgi-docs/internal/
 * ops/ml-track/FINAL-RESULTS.md). Update only if pre-registration is
 * revised by founder+ML-Opus.
 */
function aggregateSignalsTierCounts(
  risks: Awaited<ReturnType<typeof loadCountryRisks>> | null,
  lockedRecipeSlugs: ReadonlyArray<string>
): { n_high: number; n_moderate: number; n_total: number } {
  if (!risks) return { n_high: 0, n_moderate: 0, n_total: 0 };
  // #815 (2026-05-18) — match the /signals 4-only graduation: the
  // dashboard's "See all N risk recipes →" link points to /signals, so
  // its count must match what /signals actually surfaces. Pre-#815 this
  // aggregated across the full ~71-category bake, which produced an
  // n_total of 67-71 conflicting with the post-graduation /signals
  // showing 4. If the LOCKed list is unavailable (mlStack load failed),
  // fall back to no-filter so the dashboard degrades to pre-#815 shape
  // rather than displaying zeros.
  const lockedSet = lockedRecipeSlugs.length > 0 ? new Set(lockedRecipeSlugs) : null;
  const perCategory = new Map<string, number>();
  for (const country of Object.values(risks.countries)) {
    for (const tierBlock of Object.values(country.tiers ?? {})) {
      for (const c of tierBlock.top_categories ?? []) {
        if (lockedSet && !lockedSet.has(c.category)) continue;
        const sal = c.salience_score ?? c.z_score ?? 0;
        const prev = perCategory.get(c.category) ?? -Infinity;
        if (sal > prev) perCategory.set(c.category, sal);
      }
    }
  }
  let n_high = 0;
  let n_moderate = 0;
  for (const sal of perCategory.values()) {
    if (sal >= 2.5) n_high++;
    else if (sal >= 1.0) n_moderate++;
  }
  return { n_high, n_moderate, n_total: perCategory.size };
}

export default async function DashboardPage() {
  // Don't bring down the page if any single source 500s.
  const [risksResult, topPairsResult, topSignalsResult, mlStackResult] =
    await Promise.allSettled([
      loadCountryRisks(),
      fetchTopPairs(),
      fetchTopSignals(),
      loadMlRecipeStack(),
    ]);

  const risks = risksResult.status === "fulfilled" ? risksResult.value : null;
  const topPairs =
    topPairsResult.status === "fulfilled"
      ? topPairsResult.value
      : { pairs: [], totalUniquePairs: 0 };
  const topSignals =
    topSignalsResult.status === "fulfilled" ? topSignalsResult.value : [];
  const mlStack = mlStackResult.status === "fulfilled" ? mlStackResult.value : null;

  const indexes = indexData as IndexEntry[];

  // PR-4 (#752) — Top Convergences panel filters to LOCKed-only so it
  // never surfaces a recipe whose detail page has been retired (would
  // 308 to /precedents per #751).
  const lockedRecipeSlugs = mlStack?.metadata.top_4_recipes ?? [];

  // PR-vi Section 3 (Signals card) — server-side aggregation.
  // #815 (2026-05-18): now filtered to LOCKed recipes so the count
  // matches /signals after the 4-only graduation.
  const signalsTierCounts = aggregateSignalsTierCounts(risks, lockedRecipeSlugs);

  // PR-vi Section 3 (Precedents card) — counts.
  const mlValidatedCount = mlStack?.metadata.top_4_recipes.length ?? 0;
  // 13 locked recipes per ML Stage 4 pre-registration (qgi-docs/internal/
  // ops/ml-track/FINAL-RESULTS.md). Update only if pre-registration is
  // revised by founder+ML-Opus.
  const TOTAL_LOCKED = 13;

  return (
    <BaseClient
      risks={risks}
      indexes={indexes}
      topPairs={topPairs.pairs}
      totalUniquePairs={topPairs.totalUniquePairs}
      topSignals={topSignals}
      taxonomy={taxonomyData}
      // PR-vi Majles-verdict props
      signalsHighCount={signalsTierCounts.n_high}
      signalsModerateCount={signalsTierCounts.n_moderate}
      signalsTotalCount={signalsTierCounts.n_total}
      mlValidatedCount={mlValidatedCount}
      totalLocked={TOTAL_LOCKED}
      lockedRecipeSlugs={lockedRecipeSlugs}
    />
  );
}
