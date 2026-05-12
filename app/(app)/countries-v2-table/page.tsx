/**
 * /countries-v2-table — Dense analyst table variant (Sard Majles S-Country 2026-05-02)
 *
 * Design: Elif Şahin-Moreau (Tufte data-ink, small-multiples) +
 *         Rodrigo Vasconcelos-Kwok (FT/Bloomberg terminal density)
 *
 * Approach: 156-row sortable/filterable table, 1 row per country.
 * Columns: Country, Tier, Top category, Activity, ML coverage, Trend, Updated.
 * Sort: header click = single-column sort; shift-click = multi-column sort.
 * Filter: tier button-group, region select, ML coverage threshold, activity threshold.
 * Tier color on the tier cell only; everything else monochrome.
 * Per-row click → /countries-v2-table/[country] (dense dossier).
 *
 * Power-user assumption. No tooltips on obvious columns.
 * Small-multiples sparklines for the trend column (Tufte school).
 *
 * Data source: country-risks.json (156 countries) + mock overlays.
 * Implementation status: MOCK FILL — pre-decision preview.
 *
 * Cross-decision dependencies (locked Phase 3 + 4):
 *   - Composite tier = max(L1) badge (NOT manufactured OVR)
 *   - Per-L1 percentile micro-bars per Sard S-Country direction
 *   - ML coverage = count of 13 LOCKed recipes with measured AHI (MOCK: 0-4)
 *   - Calibration intervals: /countries/[id] only, not browse surface
 *   - No demographic-3 column (suppressed Phase 5 Stage A)
 */
import { Suspense } from "react";
import { getCountriesSortedByRisk } from "@/lib/country-risks";
import { CountriesV2TableClient } from "@/components/countries-v2-table/CountriesV2TableClient";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Countries V2 — Table — QGI Intelligence",
  description:
    "Dense analyst table — 156 countries, sortable by tier, ML coverage, activity, and trend. Tufte small-multiples variant.",
  robots: { index: false, follow: false },
};

export default async function CountriesV2TablePage() {
  let countries: Awaited<ReturnType<typeof getCountriesSortedByRisk>> = [];
  let loadError: string | null = null;

  try {
    countries = await getCountriesSortedByRisk();
  } catch (err) {
    loadError = (err as Error).message;
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Countries V2 — Table
        </h1>
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
            Country data unavailable: {loadError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <CountriesV2TableClient countries={countries} />
    </Suspense>
  );
}
