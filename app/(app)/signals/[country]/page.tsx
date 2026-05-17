import { loadCountryRisks, resolveCountryBySlug } from "@/lib/country-risks";
import { countrySlug } from "@/lib/slug";
import { CATEGORY_L1_MAP, L1_GROUPS, type L1Group } from "@/lib/category-taxonomy";
import { SignalsCountryDetail } from "@/components/signals/SignalsCountryDetail";
import type { CategoryScore } from "@/lib/country-risks";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

/**
 * #788 (Helena R5 2026-05-17) — when a user lands on `/signals/{slug}`
 * with a slug that is a known CATEGORY (not a country), the old
 * behavior was a misleading 404 titled "Country not found." The
 * `[country]` dynamic segment swallowed the category slug as if it
 * were a country. The disambiguation: if the slug resolves to no
 * country AND IS in CATEGORY_L1_MAP, redirect to `/signals` — the
 * cross-country aggregated view, which already ranks all 71
 * categories. This is closest to Helena's stated preference ("show
 * me all countries firing on that category") without building a new
 * route. Future: a `/signals?category={slug}` highlight could deep-
 * link to the row.
 */
function maybeCategoryRedirect(slug: string): string | null {
  const normalized = slug.toLowerCase().replace(/-/g, "_");
  return normalized in CATEGORY_L1_MAP ? "/signals" : null;
}

/**
 * /signals/[country] — Per-country watchlist for Family 3 of A3 merger brief.
 *
 * Build PR #3 of 5 (founder-gated cutover at PR #5):
 *   - PR #1: route scaffold + filter strip + 71-row table
 *   - PR #2: 5 firing now band + 8-domain activation strip
 *   - PR #3 (this): per-country watchlist with Ingrid lede + sortable
 *     category table + tier + lineage (skeleton) + alignment placeholder
 *   - PR #4: per-(country, recipe) leaf with split-render by lineage
 *   - PR #5 (founder-gated): cutover
 *
 * V1 /signals?country={slug} and V2 routes remain LIVE alongside this
 * merged preview until founder approval.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 3 — Signals / per-country composition)
 *
 * Note on `alignment`: the brief specifies an `[Illustrative placeholder
 * — pending Q4 2026 bake]` chip on the ALIGNMENT column until #463 ships
 * per-country alignment scores. For PR #3 we surface salience-z as the
 * alignment proxy (consistent with V1 buildSignals) and chip the column
 * header with `[Preview]` until the bake lands. No mock numbers introduced.
 */

interface Props {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const c = await resolveCountryBySlug(country).catch(() => null);
  if (!c) {
    // #788 — if the slug is a category, the page handler will redirect.
    // Use a non-misleading title that doesn't crash the metadata.
    if (maybeCategoryRedirect(country)) {
      return { title: "Signals — QGI Intelligence" };
    }
    return {
      title: "Country not found — QGI Intelligence",
    };
  }
  return {
    title: `What's firing on ${c.name} — Signals — QGI Intelligence`,
    description: `Per-country signals watchlist for ${c.name} — risk categories aggregated across all tier windows with lineage-aware vocabulary.`,
    // #699: explicit canonical.
    alternates: { canonical: `/signals/${country}` },
  };
}

export const revalidate = 3600;

export type SignalTier = "HIGH" | "MODERATE" | "INDICATIVE";

function tierForSalience(maxSalience: number): SignalTier {
  if (maxSalience >= 2.5) return "HIGH";
  if (maxSalience >= 1.0) return "MODERATE";
  return "INDICATIVE";
}

export interface CountrySignalRow {
  category: string;
  display_name: string;
  tier: SignalTier;
  /** Max salience for this category in this country across all tier windows. */
  salience: number;
  /** L1 group metadata; null when the category isn't in CATEGORY_L1_MAP. */
  l1: L1Group | null;
}

// Pre-render every country slug at build time. Unknown slugs fall to
// notFound() at runtime via resolveCountryBySlug returning null.
export async function generateStaticParams() {
  const data = await loadCountryRisks().catch(() => null);
  if (!data) return [];
  const slugs: { country: string }[] = [];
  for (const c of Object.values(data.countries)) {
    const slug = countrySlug(c.name);
    if (slug) slugs.push({ country: slug });
  }
  return slugs;
}

export default async function SignalsMergedCountryPage({ params }: Props) {
  const { country } = await params;
  // PR-iv (2026-05-15) — load full payload so we can surface the real bake
  // `generated_at` (Flavor A fix). resolveCountryBySlug runs against the
  // same in-memory cache so this isn't a duplicate file read.
  const data = await loadCountryRisks().catch(() => null);
  const c = await resolveCountryBySlug(country).catch(() => null);
  if (!c) {
    // #788 — category slug typed as a country slug → redirect to the
    // cross-country aggregated view.
    if (maybeCategoryRedirect(country)) redirect("/signals");
    notFound();
  }

  // Per-category max-salience for this country, deduped across the S/M/L/XL
  // tier windows (mirrors V1 buildSignals dedup pattern).
  const perCategoryBest = new Map<string, CategoryScore>();
  for (const tierBlock of Object.values(c.tiers ?? {})) {
    for (const cat of tierBlock.top_categories ?? []) {
      const sal = cat.salience_score ?? cat.z_score ?? 0;
      const existing = perCategoryBest.get(cat.category);
      const existingSal = existing
        ? (existing.salience_score ?? existing.z_score ?? 0)
        : -Infinity;
      if (sal > existingSal) perCategoryBest.set(cat.category, cat);
    }
  }

  const rows: CountrySignalRow[] = Array.from(perCategoryBest.values()).map(
    (cat): CountrySignalRow => {
      const sal = cat.salience_score ?? cat.z_score ?? 0;
      const mapping = CATEGORY_L1_MAP[cat.category];
      const l1 = mapping
        ? (L1_GROUPS.find((g) => g.code === mapping.group) ?? null)
        : null;
      return {
        category: cat.category,
        display_name: cat.category
          .replace(/_/g, " ")
          .replace(/\b\w/g, (ch) => ch.toUpperCase()),
        tier: tierForSalience(sal),
        salience: sal,
        l1,
      };
    }
  );

  // Default ordering: max salience desc (highest-firing first).
  rows.sort((a, b) => b.salience - a.salience);

  const tierCounts = { HIGH: 0, MODERATE: 0, INDICATIVE: 0 } as Record<
    SignalTier,
    number
  >;
  for (const r of rows) tierCounts[r.tier]++;

  // Real bake date — Flavor A fix (PR-iv). Falls back to request-time
  // if the load failed.
  const generatedDate = data?.generated_at
    ? data.generated_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <SignalsCountryDetail
      slug={country}
      countryName={c.name}
      alpha2={c.alpha_2}
      countryTier={c.overall_risk_tier as SignalTier}
      rows={rows}
      tierCounts={tierCounts}
      generatedDate={generatedDate}
      curated={c.curated}
    />
  );
}
