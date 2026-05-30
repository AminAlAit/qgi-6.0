/**
 * /patterns/pair/[slug] -- Pair overview page (demoted from /patterns/[slug]).
 *
 * Step 7 of the 2026-05-30 /patterns plan: the old per-pair detail page
 * (Pair profile / Window history / Other partners panels) moves here so
 * that /patterns/[slug] can serve the NEW per-pattern detail (hero + rhyme
 * line + sector breakdown + indicator grid).
 *
 * Slug format: {a-iso2}-{b-iso2}  (two ISO-2 codes, alphabetical, hyphen-separated).
 * Example: es-pt
 *
 * The old 5-component pattern slug pages (e.g. pt-es-1975-2024) are served
 * by /patterns/[slug]/page.tsx. "See all windows" link from pattern detail
 * points here using the two-segment slug.
 *
 * SYMMETRIC framing (Marcus, binding):
 *   - No leader/follower. No "leads", "follows", "ahead of", "behind".
 *   - No status chip on header.
 *   - Per-indicator timestamps = two facts. Never aggregated.
 *   - Title and description use ↔, never →.
 *
 * V4.1 quality bar:
 *   - No em-dashes in copy.
 *   - No engine vocabulary (cascade, Pearson, PPS, SCDI).
 *   - No banned vocab (leader, follower, phase shift, etc.).
 *   - HowToReadButton top-right via headerRightSlot.
 *   - Flags via FlagImg.
 *   - Family colors via familyColor().
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPair, getAllPairSlugs } from "@/lib/te-mock/patterns-v4-pair-detail-mock";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { PageLayout } from "@/components/patterns-v4/PageLayout";
import { PairHeader } from "@/components/patterns-v4-pair-detail/PairHeader";
import { PairSummaryPanel } from "@/components/patterns-v4-pair-detail/PairSummaryPanel";
import { PairShapeOverlayPanel } from "@/components/patterns-v4-pair-detail/PairShapeOverlayPanel";
import { PairIndicatorsPanel } from "@/components/patterns-v4-pair-detail/PairIndicatorsPanel";
import { PairDecadesPanel } from "@/components/patterns-v4-pair-detail/PairDecadesPanel";
import { PairTodayPanel } from "@/components/patterns-v4-pair-detail/PairTodayPanel";
import { PairHandoffsFooter } from "@/components/patterns-v4-pair-detail/PairHandoffsFooter";

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * Resolve a pair-overview slug ({a-iso2}-{b-iso2}) to the pair_id used
 * internally in the pair-detail mock. We try exact match first, then try
 * the catalogue's pair_id formats.
 *
 * The pair-overview slug is always exactly two segments: "es-pt", "ke-ug", etc.
 * The catalogue stores pairs as e.g. "pol-cze", "ken-uga" (three-char codes) OR
 * longer forms like "paraguay-south_korea-1963". We need to find the best match.
 *
 * Strategy: find any pair whose (country_a_iso | country_b_iso) match
 * the two ISO-2 codes in the overview slug.
 */
function resolvePairOverviewSlug(overviewSlug: string): string | null {
  const parts = overviewSlug.split("-");
  if (parts.length !== 2) return null;
  const [isoA, isoB] = parts;

  // getAllPairSlugs returns all known slugs; try each one via getPair and match isos.
  const allSlugs = getAllPairSlugs();
  for (const slug of allSlugs) {
    const pair = getPair(slug);
    if (!pair) continue;
    const a = pair.iso2A.toLowerCase();
    const b = pair.iso2B.toLowerCase();
    if (
      (a === isoA.toLowerCase() && b === isoB.toLowerCase()) ||
      (a === isoB.toLowerCase() && b === isoA.toLowerCase())
    ) {
      return slug;
    }
  }
  return null;
}

export async function generateStaticParams() {
  // Emit one pair-overview slug per unique pair (two-segment, alphabetical ISO-2).
  const allSlugs = getAllPairSlugs();
  const seen = new Set<string>();
  const params: { slug: string }[] = [];

  for (const s of allSlugs) {
    const pair = getPair(s);
    if (!pair) continue;
    const a = pair.iso2A.toLowerCase();
    const b = pair.iso2B.toLowerCase();
    const [first, second] = a < b ? [a, b] : [b, a];
    const overviewSlug = `${first}-${second}`;
    if (!seen.has(overviewSlug)) {
      seen.add(overviewSlug);
      params.push({ slug: overviewSlug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSlug = resolvePairOverviewSlug(slug);
  const pair = resolvedSlug ? getPair(resolvedSlug) : null;

  if (!pair) {
    return { title: "Pair not found · QG Intelligence" };
  }

  return {
    title: `${pair.countryA} ↔ ${pair.countryB} · All windows · QG Intelligence`,
    description: `All recorded windows of indicator co-movement between ${pair.countryA} and ${pair.countryB}.`,
    alternates: {
      canonical: `/patterns/pair/${slug}`,
    },
    robots: { index: false, follow: false },
  };
}

export default async function PairOverviewPage({ params }: Params) {
  const { slug } = await params;
  const resolvedSlug = resolvePairOverviewSlug(slug);
  const pair = resolvedSlug ? getPair(resolvedSlug) : null;
  if (!pair) notFound();

  return (
    <PageLayout>
      {/* §1 Header band */}
      <PairHeader
        countryA={pair.countryA}
        countryB={pair.countryB}
        iso2A={pair.iso2A}
        iso2B={pair.iso2B}
        startYear={pair.startYear}
        endYear={pair.endYear}
        windowLength={pair.windowLength}
        sharedIndicatorCount={pair.sharedIndicators.length}
        headerRightSlot={<HowToReadButton routeKey="patterns-v4-detail" />}
      />

      {/* §2 Strength + window summary */}
      <PairSummaryPanel
        catalogueRank={pair.catalogueRank}
        catalogueSize={pair.catalogueSize}
        startYear={pair.startYear}
        endYear={pair.endYear}
        windowLength={pair.windowLength}
        sharedIndicatorCount={pair.sharedIndicators.length}
        strongestDecade={pair.strongestDecade}
      />

      {/* §3 Shape overlay */}
      <PairShapeOverlayPanel
        countryA={pair.countryA}
        countryB={pair.countryB}
        startYear={pair.startYear}
        endYear={pair.endYear}
        compositeSeriesA={pair.compositeSeriesA}
        compositeSeriesB={pair.compositeSeriesB}
        dominantFamilyAId={pair.dominantFamilyA.l1_id}
        dominantFamilyBId={pair.dominantFamilyB.l1_id}
      />

      {/* §4 Shared indicators */}
      <PairIndicatorsPanel
        countryA={pair.countryA}
        countryB={pair.countryB}
        indicators={pair.sharedIndicators}
      />

      {/* §5 Decade by decade */}
      <PairDecadesPanel
        decadeBuckets={pair.decadeBuckets}
        dominantFamilyAId={pair.dominantFamilyA.l1_id}
        dominantFamilyBId={pair.dominantFamilyB.l1_id}
      />

      {/* §6 Both countries today */}
      <PairTodayPanel todayA={pair.todaySummaryA} todayB={pair.todaySummaryB} />

      {/* §7 Cross-family handoffs footer */}
      <PairHandoffsFooter
        countryA={pair.countryA}
        countryB={pair.countryB}
        iso2A={pair.iso2A}
        iso2B={pair.iso2B}
      />
    </PageLayout>
  );
}
