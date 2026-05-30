/**
 * patterns-data — server-side loaders for the /patterns cascade catalogue.
 *
 * Data sources (all on disk in data/):
 *   - data/ranking.json          — top-1000 algorithmic pair windows (2026-04-30)
 *   - data/country-partners-index.json — 215-country partner index (best PPS per pair)
 *   - data/cascade-patterns-featured.json — 12 hand-curated featured pairs (Selene Rao)
 *
 * Cascade-era only. No TE / Analogues mixing.
 *
 * 2026-05-30
 */

import rankingRaw from "@/data/ranking.json";
import partnersIndexRaw from "@/data/country-partners-index.json";
import featuredRaw from "@/data/cascade-patterns-featured.json";

// ---------------------------------------------------------------------------
// Raw JSON shape types
// ---------------------------------------------------------------------------

interface RankingResult {
  country_a: string;
  country_b: string;
  country_a_id: string;
  country_b_id: string;
  start_year_a: number;
  start_year_b: number;
  pattern_length: number;
  avg_correlation: number;
  pattern_power_score: number;
  num_indexes: number;
  pattern_tier: string;
  predicted: boolean;
}

interface PartnerEntry {
  p: number;
  n: string;
  a2: string;
  w: number;
  pps: number;
  c: number;
  lmin: number;
  lmax: number;
  lc: number;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CatalogueEntry {
  /** Deterministic slug: "{country_a_id}-{country_b_id}" (lower id first) */
  slug: string;
  country_a: string;
  country_a_id: string;
  country_a_a2: string;
  country_b: string;
  country_b_id: string;
  country_b_a2: string;
  /** Pattern Power Score — raw algorithmic score (not normalised to %) */
  pps: number;
  /** Pearson correlation of best window */
  corr: number;
  /** Length of best shared window in years */
  window_length: number;
  /** Start year for country_a in best window */
  start_year_a: number;
  /** Start year for country_b in best window */
  start_year_b: number;
  /** Pattern tier: XL | L | M | S */
  tier: string;
  /** Index count in best window */
  num_indexes: number;
  /** Whether this pair has an active 2026 early-warning signal */
  predicted: boolean;
}

export interface FeaturedPair {
  slug: string;
  country_a: string;
  country_a_id: string;
  country_a_a2: string;
  country_b: string;
  country_b_id: string;
  country_b_a2: string;
  pps: number;
  corr: number;
  best_length: number;
  best_start_a: number;
  best_start_b: number;
  best_corr?: number;
  best_pps?: number;
  note: string;
}

export interface CatalogueVintage {
  label: string;
  produced_at_utc: string;
}

// ---------------------------------------------------------------------------
// ID → alpha-2 lookup (built from partners index, lazily)
// ---------------------------------------------------------------------------

let _idToA2Cache: Map<string, string> | null = null;
let _idToNameCache: Map<string, string> | null = null;

function buildIdMaps() {
  if (_idToA2Cache) return;
  _idToA2Cache = new Map();
  _idToNameCache = new Map();
  const rawIdx = partnersIndexRaw as Record<string, PartnerEntry[]>;
  for (const partners of Object.values(rawIdx)) {
    for (const p of partners) {
      _idToA2Cache!.set(String(p.p), p.a2);
      _idToNameCache!.set(String(p.p), p.n);
    }
  }
}

export function idToA2(id: string): string {
  buildIdMaps();
  return _idToA2Cache!.get(id) ?? "";
}

// ---------------------------------------------------------------------------
// Catalogue loader — deduplicates ranking.json to one entry per pair
// ---------------------------------------------------------------------------

let _catalogueCache: CatalogueEntry[] | null = null;

export function getCatalogue(): CatalogueEntry[] {
  if (_catalogueCache) return _catalogueCache;

  const raw = rankingRaw as unknown as {
    generated_at: string;
    limit: number;
    results: RankingResult[];
  };

  // Deduplicate: keep the highest-PPS window per country_a + country_b pair
  const best = new Map<string, RankingResult>();
  for (const r of raw.results) {
    const key = [r.country_a, r.country_b].sort().join("|||");
    const existing = best.get(key);
    if (!existing || r.pattern_power_score > existing.pattern_power_score) {
      best.set(key, r);
    }
  }

  const entries: CatalogueEntry[] = [];
  for (const r of best.values()) {
    // Canonical ordering: lower numeric ID first
    const idA = parseInt(r.country_a_id);
    const idB = parseInt(r.country_b_id);
    const [caName, cbName, caId, cbId] =
      idA <= idB
        ? [r.country_a, r.country_b, r.country_a_id, r.country_b_id]
        : [r.country_b, r.country_a, r.country_b_id, r.country_a_id];

    entries.push({
      slug: `${caId}-${cbId}`,
      country_a: caName,
      country_a_id: caId,
      country_a_a2: idToA2(caId),
      country_b: cbName,
      country_b_id: cbId,
      country_b_a2: idToA2(cbId),
      pps: r.pattern_power_score,
      corr: r.avg_correlation,
      window_length: r.pattern_length,
      start_year_a: r.start_year_a,
      start_year_b: r.start_year_b,
      tier: r.pattern_tier,
      num_indexes: r.num_indexes,
      predicted: r.predicted,
    });
  }

  // Sort by PPS descending
  entries.sort((a, b) => b.pps - a.pps);
  _catalogueCache = entries;
  return entries;
}

// ---------------------------------------------------------------------------
// Partners index — build a flat ranked list usable for search
// ---------------------------------------------------------------------------

let _partnersCache: CatalogueEntry[] | null = null;

export function getPartnersIndex(): CatalogueEntry[] {
  if (_partnersCache) return _partnersCache;

  buildIdMaps();
  const rawIdx = partnersIndexRaw as Record<string, PartnerEntry[]>;
  const seen = new Set<string>();
  const entries: CatalogueEntry[] = [];

  for (const [keyId, partners] of Object.entries(rawIdx)) {
    for (const p of partners) {
      const idA = parseInt(keyId);
      const idB = p.p;
      const [caId, cbId] = idA <= idB ? [keyId, String(idB)] : [String(idB), keyId];
      const slug = `${caId}-${cbId}`;
      if (seen.has(slug)) continue;
      seen.add(slug);

      const caName = _idToNameCache!.get(caId) ?? `Country-${caId}`;
      const cbName = p.n;

      entries.push({
        slug,
        country_a: caName,
        country_a_id: caId,
        country_a_a2: _idToA2Cache!.get(caId) ?? "",
        country_b: cbName,
        country_b_id: cbId,
        country_b_a2: p.a2,
        pps: p.pps,
        corr: p.c,
        window_length: p.lc,
        start_year_a: 0,
        start_year_b: 0,
        tier: p.pps >= 1000 ? "XL" : p.pps >= 500 ? "L" : p.pps >= 200 ? "M" : "S",
        num_indexes: 0,
        predicted: false,
      });
    }
  }

  entries.sort((a, b) => b.pps - a.pps);
  _partnersCache = entries;
  return entries;
}

// ---------------------------------------------------------------------------
// Featured pairs
// ---------------------------------------------------------------------------

export function getFeaturedPairs(): FeaturedPair[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = featuredRaw as any;

  return (raw.pairs ?? []) as FeaturedPair[];
}

// ---------------------------------------------------------------------------
// Vintage
// ---------------------------------------------------------------------------

export function getCascadeVintage(): CatalogueVintage {
  const raw = rankingRaw as unknown as { generated_at: string };
  const dt = raw.generated_at ?? "2026-04-30T08:57:39Z";
  const d = new Date(dt);
  const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return { label, produced_at_utc: dt };
}

// ---------------------------------------------------------------------------
// Per-pair detail from pair-windows
// ---------------------------------------------------------------------------

import type { PairWindowRecord } from "@/lib/cascade-patterns/pair-windows";

export type { PairWindowRecord };

/** Get the canonical pair from the catalogue or partners index by slug */
export function getPairBySlug(slug: string): CatalogueEntry | null {
  const catalogue = getCatalogue();
  const found = catalogue.find((e) => e.slug === slug);
  if (found) return found;
  // Fall back to partners index
  const idx = getPartnersIndex();
  return idx.find((e) => e.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Tier counts — pre-computed from the full partners index corpus
// ---------------------------------------------------------------------------

export interface TierCounts {
  XL: number;
  L: number;
  M: number;
  S: number;
}

let _tierCountsCache: TierCounts | null = null;

export function getTierCounts(): TierCounts {
  if (_tierCountsCache) return _tierCountsCache;
  const idx = getPartnersIndex();
  const counts: TierCounts = { XL: 0, L: 0, M: 0, S: 0 };
  for (const e of idx) {
    const t = e.tier as keyof TierCounts;
    if (t in counts) counts[t]++;
  }
  _tierCountsCache = counts;
  return counts;
}

// ---------------------------------------------------------------------------
// Country names — sorted list of all 215 country names for the search filter
// ---------------------------------------------------------------------------

let _countryNamesCache: string[] | null = null;

export function getCountryNames(): string[] {
  if (_countryNamesCache) return _countryNamesCache;
  const idx = getPartnersIndex();
  const names = new Set<string>();
  for (const e of idx) {
    names.add(e.country_a);
    names.add(e.country_b);
  }
  _countryNamesCache = Array.from(names).sort();
  return _countryNamesCache;
}
