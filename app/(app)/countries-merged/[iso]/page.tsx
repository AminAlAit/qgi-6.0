import { resolveCountryBySlug } from "@/lib/country-risks";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import { CountryMergedDetail } from "@/components/countries-merged/CountryMergedDetail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /countries-merged/[iso] — Detail page for the merged Countries shell.
 *
 * Build PR #3 of 5 (A3 Family 2). Brief:
 *   qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 2 — Countries §"Detail page composition")
 *
 * Scope of PR #3:
 *   - Hero (flag + name + tier pill + top-line)
 *   - Lloyd's tier banner
 *   - Section 1 "What's happening here" (Ingrid template; preview-template
 *     fallback for ~140 unauthored countries)
 *   - Section 2 "What this doesn't mean" 3-bullet callout (country-specific)
 *   - Section 3 — L1 risk profile (8-row small-multiples; Elif fold of
 *     V1 8 cards + V2-narrative 3-categories-driving)
 *   - Cross-family handoffs footer (Precedents + Signals + Patterns)
 *
 * Deferred to PR #4:
 *   - ML recipe coverage matrix (13 LOCKed × 6 cols, Marcus flagship)
 *   - Structural peers section
 *   - Indicator trajectories small-multiples grid
 *   - Recent events density-strip + 12-month default + year drawer
 *   - Top Precedents (S-win/M-win/L-win/XL-win)
 *   - Risk fingerprint radar (collapsed Section 9)
 *   - Full ARIA + mobile rules + loading/empty states
 *
 * V1 (/countries/[iso]) + V2-Table + V2-Narrative detail pages remain
 * reachable until PR #5 cutover.
 */

interface Props {
  params: Promise<{ iso: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { iso } = await params;
  const c = await resolveCountryBySlug(iso).catch(() => null);
  if (!c) {
    return {
      title: "Country not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${c.name} · Tier ${c.overall_risk_tier} — Merged Preview — QGI Intelligence`,
    description: `Country risk profile for ${c.name}: Tier ${c.overall_risk_tier} (${c.curated ? "curated" : "uncurated"} event history). Merged preview shell — Family 2 build phase.`,
    robots: { index: false, follow: false }, // preview only
  };
}

export const revalidate = 3600;

// Pre-render every country slug at build time. Unknown slugs fall to
// notFound() at runtime via resolveCountryBySlug returning null.
export async function generateStaticParams() {
  const { loadCountryRisks } = await import("@/lib/country-risks");
  const { countrySlug } = await import("@/lib/slug");
  const data = await loadCountryRisks().catch(() => null);
  if (!data) return [];
  const slugs: { iso: string }[] = [];
  for (const c of Object.values(data.countries)) {
    const slug = countrySlug(c.name);
    if (slug) slugs.push({ iso: slug });
  }
  return slugs;
}

export default async function CountryMergedDetailPage({ params }: Props) {
  const { iso } = await params;
  const country = await resolveCountryBySlug(iso).catch(() => null);
  if (!country) notFound();

  // Per-L1 max salience for the country (REAL data — drives the Section 3
  // 8-row small-multiples table). Aggregates across all tier windows
  // (S/M/L/XL) and takes the max salience per L1 group, so the row reflects
  // the country's strongest signal in that L1 — not an average.
  const l1Salience: Record<string, number> = {};
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      const mapping = CATEGORY_L1_MAP[cat.category];
      if (!mapping) continue;
      const score = cat.salience_score ?? cat.z_score ?? 0;
      const prev = l1Salience[mapping.group] ?? -Infinity;
      if (score > prev) l1Salience[mapping.group] = score;
    }
  }

  // Top-3 categories overall (for hero top-line + the "3 categories driving"
  // accent on the L1 table). De-dupes per-category so the same recipe doesn't
  // appear twice from the S and M tier windows.
  const seenCats = new Set<string>();
  const topCategories: Array<{
    category: string;
    salience_score: number;
    l1_group: string | null;
  }> = [];
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      if (seenCats.has(cat.category)) continue;
      seenCats.add(cat.category);
      topCategories.push({
        category: cat.category,
        salience_score: cat.salience_score ?? cat.z_score ?? 0,
        l1_group: CATEGORY_L1_MAP[cat.category]?.group ?? null,
      });
    }
  }
  topCategories.sort((a, b) => b.salience_score - a.salience_score);
  const top3 = topCategories.slice(0, 3);

  // The L1 row list — fixed A..H order so the page reads as a stable
  // taxonomy (per Elif's small-multiples grid principle).
  const l1Rows = L1_GROUPS.map((g) => ({
    code: g.code,
    label: g.label,
    shortLabel: g.shortLabel,
    color: g.color,
    salience: l1Salience[g.code] ?? null,
  }));

  return (
    <CountryMergedDetail
      iso={iso}
      name={country.name}
      alpha_2={country.alpha_2}
      curated={country.curated}
      tier={country.overall_risk_tier}
      l1Rows={l1Rows}
      top3={top3}
    />
  );
}
