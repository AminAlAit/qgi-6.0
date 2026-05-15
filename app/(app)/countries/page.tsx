import { getCountriesSortedByRisk } from "@/lib/country-risks";
import { CountriesMergedListClient } from "@/components/countries/CountriesMergedListClient";
import type { Metadata } from "next";

/**
 * /countries — Preview-only route for A3 merger brief Family 2.
 *
 * Build PR #1 of 5 (incremental cadence, founder-gated cutover at PR #5):
 *   - PR #1 (this): route scaffold + Lloyd's banner + filter strip + main table
 *   - PR #2: "5 countries to watch" curated band + 7-col MOCK-chipped table
 *     (Domain sparkbar / ML cov / Trend / Updated)
 *   - PR #3: detail page (/countries/[iso]) with 2-col 3:2 layout,
 *     8-row L1 small-multiples table, ML recipe coverage matrix
 *   - PR #4: ARIA + mobile + loading/empty states + inline country-name
 *     links carried from Precedents PR #4.5 + structural peers + events
 *   - PR #5 (founder-gated): kill V1 + 2 V2 routes; alias merged → canonical
 *
 * V1 (/countries) + V2-Table (/countries-v2-table) + V2-Narrative
 * (/countries-v2-narrative) remain LIVE alongside the merged preview so
 * the founder can compare side-by-side until cutover.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 2 — Countries section)
 */

export const metadata: Metadata = {
  title: "Countries — Merged Preview — QGI Intelligence",
  description:
    "Preview of the merged Countries shell — 156-country risk browser with Lloyd's-style methodology disclosure + Ingrid voice copy. Cutover from V1 + 2 V2 routes pending founder sign-off.",
};

export const revalidate = 3600;

export default async function CountriesMergedPage() {
  let countries: Awaited<ReturnType<typeof getCountriesSortedByRisk>> = [];
  let loadError: string | null = null;
  try {
    countries = await getCountriesSortedByRisk();
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
          Countries — Merged Preview
        </h1>
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            Country data not available: {loadError}
          </p>
        </div>
      </div>
    );
  }

  // Tier counts feed the brief-locked metric strip ("156 countries · 71 dimensions
  // · 27 HIGH · 48 MODERATE · 81 INDICATIVE"). Computed server-side so the
  // SSR HTML carries them; client doesn't recompute on every filter change.
  const tierCounts = { HIGH: 0, MODERATE: 0, INDICATIVE: 0 };
  for (const c of countries) tierCounts[c.overall_risk_tier]++;

  return <CountriesMergedListClient countries={countries} tierCounts={tierCounts} />;
}
