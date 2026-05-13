import { loadCountryRisks } from "@/lib/country-risks";
import { CATEGORY_L1_MAP, L1_GROUPS, type L1Group } from "@/lib/category-taxonomy";
import { SignalsMergedListClient } from "@/components/signals-merged/SignalsMergedListClient";
import type { CategoryScore } from "@/lib/country-risks";
import type { Metadata } from "next";

/**
 * /signals-merged — Preview-only route for A3 merger brief Family 3.
 *
 * Build PR #1 of 5 (incremental cadence, founder-gated cutover at PR #5):
 *   - PR #1 (this): route scaffold + Lloyd's banner + filter strip + 71-row
 *     aggregated table with tier vocabulary unified to HIGH/MODERATE/INDICATIVE
 *   - PR #2: "5 firing now" curated band + domain activation strip
 *   - PR #3: per-country watchlist /signals-merged/[country]
 *   - PR #4: per-(country, recipe) leaf with split-render by lineage
 *   - PR #5 (founder-gated): kill 4 V2 routes + /signals/country picker;
 *     alias /signals-merged → /signals canonical
 *
 * V1 (/signals) + V2-A (/signals-v2-a) + V2-B (/signals-v2-b) remain LIVE
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
  title: "Signals — Merged Preview — QGI Intelligence",
  description:
    "Preview of the merged Signals shell — 71 risk categories aggregated across 156 countries with lineage-aware tier vocabulary. Cutover from V1 + V2 routes pending founder sign-off.",
  robots: { index: false, follow: false }, // preview only — not indexed
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
  let loadError: string | null = null;

  try {
    const data = await loadCountryRisks();
    totalCountries = Object.keys(data.countries).length;

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
          Signals — Merged Preview
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

  return (
    <SignalsMergedListClient
      signals={signals}
      tierCounts={tierCounts}
      totalCountries={totalCountries}
    />
  );
}
