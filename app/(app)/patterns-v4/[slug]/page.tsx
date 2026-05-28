/**
 * /patterns-v4/[slug] -- Pair detail page.
 *
 * SYMMETRIC framing (Marcus, binding):
 *   - No leader/follower. No "leads", "follows", "ahead of", "behind".
 *   - No status chip on header.
 *   - Per-indicator timestamps = two facts. Never aggregated.
 *   - Slug: {country-a-slug}-{country-b-slug}-{start-year},
 *     country-a-slug alphabetically first.
 *   - Title and description use ↔, never →.
 *
 * V4.1 quality bar:
 *   - No em-dashes in copy.
 *   - No engine vocabulary (cascade, Pearson, PPS, SCDI).
 *   - No banned vocab (leader, follower, phase shift, etc.).
 *   - No sparkline on today cards.
 *   - No status chip on pair header.
 *   - NEUTRAL_SLATE for magnitude bars.
 *   - HowToReadButton top-right via headerRightSlot.
 *   - Flags via FlagImg.
 *   - Family colors via familyColor().
 *
 * Sidebar: do NOT add a sidebar entry. Longest-prefix-wins via /patterns-v4.
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

export async function generateStaticParams() {
  return getAllPairSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const pair = getPair(slug);

  if (!pair) {
    return {
      title: "Pair not found · QG Intelligence",
    };
  }

  return {
    title: `${pair.countryA} ↔ ${pair.countryB}, ${pair.startYear}–${pair.endYear} · QG Intelligence`,
    description: `Two countries whose trajectories ran in parallel from ${pair.startYear} to ${pair.endYear}, decomposed indicator by indicator.`,
    alternates: {
      canonical: `/patterns-v4/${slug}`,
    },
    robots: { index: false, follow: false },
  };
}

export default async function PairDetailPage({ params }: Params) {
  const { slug } = await params;
  const pair = getPair(slug);
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
