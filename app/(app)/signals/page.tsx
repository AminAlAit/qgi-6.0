import { loadCountryRisks } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { CATEGORY_L1_MAP, L1_GROUPS, type L1Group } from "@/lib/category-taxonomy";
import { SignalsMergedListClient } from "@/components/signals/SignalsMergedListClient";
import type { CategoryScore } from "@/lib/country-risks";
import type { Metadata } from "next";

/**
 * /signals — Preview-only route for A3 merger brief Family 3.
 *
 * Build PR #2 of 5 (incremental cadence, founder-gated cutover at PR #5):
 *   - PR #1: route scaffold + Lloyd's banner + filter strip + 71-row
 *     aggregated table with tier vocabulary unified to HIGH/MODERATE/INDICATIVE
 *   - PR #2 (this): "5 firing now" curated band + 8-domain activation
 *     strip rendered above the master list
 *   - PR #3: per-country watchlist /signals/[country]
 *   - PR #4: per-(country, recipe) leaf with split-render by lineage
 *   - PR #5 (founder-gated): kill 4 V2 routes + /signals/country picker;
 *     alias /signals → /signals canonical
 *
 * V1 (/signals) + V2-A (/signals-v2a) + V2-B (/signals-v2b) remain LIVE
 * alongside the merged preview so the founder can compare side-by-side
 * until cutover.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 3 — Signals section)
 *
 * Tier vocabulary: brief 7th-vote unified CRITICAL/ELEVATED/BASELINE →
 * HIGH/MODERATE/INDICATIVE for Countries + Signals. Thresholds preserved
 * from V1 buildSignals (salience ≥ 2.5 = HIGH, ≥ 1.0 = MODERATE, else
 * INDICATIVE). Per-family source quantity disclosed via tier-pill hover
 * tooltip (Sipho's "vocabulary belongs to QUANTITY not page" rule).
 */

export const metadata: Metadata = {
  title: "Signals · QGI Intelligence",
  description:
    "ML-validated risk recipes tracked across 156 countries — each adjudicated through blind walk-forward backtest and the QGI four-pillar lock rubric. Tier vocabulary: HIGH / MODERATE / INDICATIVE.",
  // #699: explicit canonical (was inheriting "/" from root layout).
  alternates: { canonical: "/signals" },
};

export const revalidate = 3600;

export type SignalTier = "HIGH" | "MODERATE" | "INDICATIVE";

/** Brief 7th-vote: unified tier rung. V1 thresholds preserved. */
function tierForSalience(maxSalience: number): SignalTier {
  if (maxSalience >= 2.5) return "HIGH";
  if (maxSalience >= 1.0) return "MODERATE";
  return "INDICATIVE";
}

export interface SignalRow {
  category: string;
  display_name: string;
  tier: SignalTier;
  /** Per-category max salience across all firing countries. */
  max_salience: number;
  /** Mean salience across firing countries. */
  avg_salience: number;
  /** Number of countries with non-zero salience for this category. */
  firing_count: number;
  /** Top-3 countries by salience. */
  top_countries: Array<{ id: string; name: string; alpha_2: string; salience: number }>;
  /** L1 group metadata; null when category isn't in CATEGORY_L1_MAP. */
  l1: L1Group | null;
}

export default async function SignalsMergedPage() {
  let signals: SignalRow[] = [];
  let totalCountries = 0;
  let bakeGeneratedAt: string | null = null;
  let loadError: string | null = null;

  try {
    // #815 (2026-05-18) — /signals graduation: mirror the /precedents 4-only
    // graduation. Only ML-LOCKed recipes (those in mlStack.metadata.top_4_recipes)
    // are surfaced on this index. Non-LOCKed categories continue to live in the
    // bake (and on /countries/[iso] "what's happening here" prose) — they're
    // just unreachable from this index. Single source of truth for the LOCKed
    // set is data/ml-recipe-stack.json (40+ usages across the codebase).
    //
    // mlStack load uses .catch() so a transient fetch failure degrades to
    // an empty filter (0 rows shown, friendly empty state) rather than
    // blanking the entire index. Mirrors the dashboard/page.tsx fallback
    // posture. Sonnet PR #123 F1.
    const [data, mlStack] = await Promise.all([
      loadCountryRisks(),
      loadMlRecipeStack().catch(() => null),
    ]);
    totalCountries = Object.keys(data.countries).length;
    bakeGeneratedAt = data.generated_at ?? null;
    const lockedRecipeSet = new Set(mlStack?.metadata.top_4_recipes ?? []);

    // Aggregation mirrors V1's buildSignals(): for each country, dedupe
    // per-category to the highest-salience entry across all tier windows,
    // then aggregate per-category across countries.
    const signalMap = new Map<
      string,
      {
        category: string;
        countries: SignalRow["top_countries"];
        totalSal: number;
        maxSal: number;
      }
    >();
    for (const [id, country] of Object.entries(data.countries)) {
      const perCategoryBest = new Map<string, CategoryScore>();
      for (const tierBlock of Object.values(country.tiers ?? {})) {
        for (const c of tierBlock.top_categories ?? []) {
          // #815 graduation gate — drop non-LOCKed categories at the
          // innermost loop so downstream aggregation, FiringNowBand,
          // DomainActivationStrip, and tierCounts all derive from the
          // 4-recipe view without further filtering.
          if (!lockedRecipeSet.has(c.category)) continue;
          const sal = c.salience_score ?? c.z_score ?? 0;
          const existing = perCategoryBest.get(c.category);
          const existingSal = existing
            ? (existing.salience_score ?? existing.z_score ?? 0)
            : -Infinity;
          if (sal > existingSal) perCategoryBest.set(c.category, c);
        }
      }
      for (const cat of perCategoryBest.values()) {
        const sal = cat.salience_score ?? cat.z_score ?? 0;
        let entry = signalMap.get(cat.category);
        if (!entry) {
          entry = {
            category: cat.category,
            countries: [],
            totalSal: 0,
            maxSal: 0,
          };
          signalMap.set(cat.category, entry);
        }
        entry.countries.push({
          id,
          name: country.name,
          alpha_2: country.alpha_2,
          salience: sal,
        });
        entry.totalSal += sal;
        if (sal > entry.maxSal) entry.maxSal = sal;
      }
    }

    signals = Array.from(signalMap.values()).map((s): SignalRow => {
      s.countries.sort((a, b) => b.salience - a.salience);
      const mapping = CATEGORY_L1_MAP[s.category];
      const l1 = mapping
        ? (L1_GROUPS.find((g) => g.code === mapping.group) ?? null)
        : null;
      return {
        category: s.category,
        display_name: s.category
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        tier: tierForSalience(s.maxSal),
        max_salience: s.maxSal,
        avg_salience: s.countries.length > 0 ? s.totalSal / s.countries.length : 0,
        firing_count: s.countries.length,
        top_countries: s.countries.slice(0, 3),
        l1,
      };
    });
    // Sort by max salience desc — default order brings the most-elevated
    // categories to the top.
    signals.sort((a, b) => b.max_salience - a.max_salience);
  } catch (err) {
    loadError = (err as Error).message;
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Signals
        </h1>
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            Signal data not available: {loadError}
          </p>
        </div>
      </div>
    );
  }

  // Tier counts for the metric strip ("{n} of 71 categories firing").
  const tierCounts = { HIGH: 0, MODERATE: 0, INDICATIVE: 0 } as Record<
    SignalTier,
    number
  >;
  for (const s of signals) tierCounts[s.tier]++;

  // PR-iv (2026-05-15) — surface the real bake `generated_at` from
  // country-risks.json (Flavor A fix). Falls back to request-time if
  // the load failed pre-snapshot. Anchored to revalidate=3600 so the
  // date refreshes hourly along with the underlying snapshot.
  const generatedDate = bakeGeneratedAt
    ? bakeGeneratedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // PR #2 — Domain activation strip data. For each of the 8 L1 groups,
  // count: (a) how many categories with tier ≥ MODERATE belong to that
  // L1; (b) the unique-country set those firing categories cover. REAL
  // data — no preview chip on this widget.
  const domainActivation: Array<{
    code: string;
    label: string;
    shortLabel: string;
    color: string;
    n_categories: number;
    n_countries: number;
  }> = L1_GROUPS.map((g) => {
    const firingForGroup = signals.filter(
      (s) => s.l1?.code === g.code && (s.tier === "HIGH" || s.tier === "MODERATE")
    );
    const countrySet = new Set<string>();
    for (const s of firingForGroup) {
      for (const c of s.top_countries) countrySet.add(c.id);
    }
    return {
      code: g.code,
      label: g.label,
      shortLabel: g.shortLabel,
      color: g.color,
      n_categories: firingForGroup.length,
      n_countries: countrySet.size,
    };
  });

  return (
    <SignalsMergedListClient
      signals={signals}
      tierCounts={tierCounts}
      totalCountries={totalCountries}
      generatedDate={generatedDate}
      domainActivation={domainActivation}
    />
  );
}
