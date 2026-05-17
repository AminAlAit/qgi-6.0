import type { PatternRow } from "@/lib/types";

/**
 * Cross-family Pattern-window tier vocabulary — S-win/M-win/L-win/
 * XL-win. Source of truth lives here (not in the page or the client
 * component) so `lib/` can stand alone and downstream consumers don't
 * import from app-router or `"use client"` modules.
 */
export type PatternWindowTier = "S-win" | "M-win" | "L-win" | "XL-win";

/**
 * #781 — initial filter state seeded from URL on the server. The
 * client component uses these for `useState` initializers.
 */
export interface PatternsInitialFilters {
  search: string;
  /** Country names — seeded from CSV `country=` and numeric
   *  `country_a` / `country_b` mapped to names server-side. */
  countryFilter: string[];
  tierFilter: PatternWindowTier[];
}

/**
 * #781 — URL → initial filter resolver for `/patterns`.
 *
 * Lives in `lib/` so the page component (which can only export the
 * App-Router-sanctioned exports — `default`, `metadata`, etc.) doesn't
 * have to inline this and Vitest can exercise it directly.
 *
 * Schemes honored (all optional):
 *   - `q`         — search seed.
 *   - `country`   — comma-separated country NAMES → countryFilter.
 *   - `country_a` — numeric WB ID; looked up against `rows` to map id
 *                   → name; folded into countryFilter.
 *   - `country_b` — same.
 *   - `tier`      — comma-separated window tiers (S-win/M-win/L-win/
 *                   XL-win); invalid values dropped silently.
 *
 * Karl Henriksen / Eurasia Group (persona-test Round 4 2026-05-17)
 * hit this: `/patterns?country_a=31&country_b=208…` URLs constructed
 * by `dashboard/BaseClient.tsx`, `countries-v1/PrecedentDetailClient
 * .tsx`, `charts/PatternScatter.tsx`, and the V1 ranking page landed
 * on the unfiltered default list because the V3 route ignored URL
 * params entirely.
 */
const WINDOW_TIERS: ReadonlySet<PatternWindowTier> = new Set([
  "S-win",
  "M-win",
  "L-win",
  "XL-win",
]);

export type PatternsSearchParams = {
  q?: string | string[];
  country?: string | string[];
  country_a?: string | string[];
  country_b?: string | string[];
  tier?: string | string[];
};

function firstOf(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function resolvePatternsInitialFilters(
  params: PatternsSearchParams,
  rows: ReadonlyArray<
    Pick<PatternRow, "country_a" | "country_b" | "country_a_id" | "country_b_id">
  >
): PatternsInitialFilters {
  const search = firstOf(params.q) ?? "";

  const countryFilter = new Set<string>();
  const countryCsv = firstOf(params.country);
  if (countryCsv) {
    for (const raw of countryCsv.split(",")) {
      const name = raw.trim();
      if (name) countryFilter.add(name);
    }
  }
  const ca = firstOf(params.country_a);
  const cb = firstOf(params.country_b);
  if (ca || cb) {
    for (const r of rows) {
      const aId = r.country_a_id != null ? String(r.country_a_id) : "";
      const bId = r.country_b_id != null ? String(r.country_b_id) : "";
      if (ca && (aId === ca || bId === ca)) {
        countryFilter.add(aId === ca ? r.country_a : r.country_b);
      }
      if (cb && (aId === cb || bId === cb)) {
        countryFilter.add(aId === cb ? r.country_a : r.country_b);
      }
    }
  }

  const tierFilter: PatternWindowTier[] = [];
  const tierCsv = firstOf(params.tier);
  if (tierCsv) {
    for (const raw of tierCsv.split(",")) {
      const t = raw.trim() as PatternWindowTier;
      if (WINDOW_TIERS.has(t)) tierFilter.push(t);
    }
  }

  return {
    search,
    countryFilter: Array.from(countryFilter),
    tierFilter,
  };
}
