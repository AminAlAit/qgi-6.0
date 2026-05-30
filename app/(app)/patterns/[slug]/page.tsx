/**
 * /patterns/[slug] -- unified per-pattern + pair-overview page.
 *
 * Slug dispatch:
 *   2 parts  ({a-iso}-{b-iso})          → pair-overview view
 *   4 parts  ({a}-{b}-{year}-{year})    → aligned per-pattern detail
 *   5 parts  ({a}-{b}-{y}-{y}-{len})   → offset per-pattern detail
 *   else                                → notFound()
 *
 * Per-pattern sections (V4.1 full rebuild 2026-05-30):
 *   §1  Hero             — 64px flags, h1 country names, Average correlation
 *                          badge, NO vintage stamp, tier as "short/medium/long term"
 *   §2  Segment timeline — two calendar tracks showing window span + offset
 *   §3  Shape overlay    — PairShapeOverlayPanel (benign/crisis labels removed)
 *   §4  Composite traj   — Year 1..N axis (window-relative), per-category subplots
 *   §5  Composition+Grid — pie chart (interactive toggle) + grouped indicator grid
 *   §6  Footer           — "See all windows for these countries" link to /{a}-{b}
 *
 * Pair-overview sections: reuses existing pair-overview sub-components.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import {
  getPatternIndicators,
  getMockedPatternSlugs,
  getPatternMeta,
  getAllPatternMeta,
  isOffsetSlug,
} from "@/lib/cascade-patterns/scdi-mock";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { PageLayout } from "@/components/patterns-v4/PageLayout";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { PatternShapeOverlay } from "@/components/patterns-v4-pattern-detail/PatternShapeOverlay";
import { PatternSegmentTimeline } from "@/components/patterns-v4-pattern-detail/PatternSegmentTimeline";
import { PatternCompositeTrajectory } from "@/components/patterns-v4-pattern-detail/PatternCompositeTrajectory";
import { PatternCompositionSection } from "@/components/patterns-v4-pattern-detail/PatternCompositionSection";
import { pairDetailFlagFor } from "@/lib/te-mock/patterns-v4-pair-detail-mock";
import { NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";

// Pair-overview imports (used when 2-segment slug is detected).
import { getPair, getAllPairSlugs } from "@/lib/te-mock/patterns-v4-pair-detail-mock";
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

// ── Slug classification ─────────────────────────────────────────────────────

type SlugType = "pair-overview" | "aligned" | "offset" | "unknown";

function classifySlug(slug: string): SlugType {
  const parts = slug.split("-");
  // Pair-overview: exactly two ISO-2 codes, each 2-3 chars, no digits.
  if (parts.length === 2 && parts.every((p) => /^[a-z]{2,3}$/.test(p)))
    return "pair-overview";
  // Aligned: 4 parts, last two are 4-digit years.
  if (parts.length === 4 && /^\d{4}$/.test(parts[2]) && /^\d{4}$/.test(parts[3]))
    return "aligned";
  // Offset: 5 parts, last three encode years+length.
  if (parts.length === 5 && /^\d{4}$/.test(parts[2]) && /^\d{4}$/.test(parts[3]))
    return "offset";
  return "unknown";
}

// ── Pair-overview resolution ────────────────────────────────────────────────

function resolvePairOverviewSlug(overviewSlug: string): string | null {
  const parts = overviewSlug.split("-");
  if (parts.length !== 2) return null;
  const [isoA, isoB] = parts;
  const allSlugs = getAllPairSlugs();
  for (const s of allSlugs) {
    const pair = getPair(s);
    if (!pair) continue;
    const a = pair.iso2A.toLowerCase();
    const b = pair.iso2B.toLowerCase();
    if (
      (a === isoA.toLowerCase() && b === isoB.toLowerCase()) ||
      (a === isoB.toLowerCase() && b === isoA.toLowerCase())
    ) {
      return s;
    }
  }
  return null;
}

// ── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const patternParams = getMockedPatternSlugs().map((slug) => ({ slug }));

  // Also emit pair-overview slugs.
  const allSlugs = getAllPairSlugs();
  const seen = new Set<string>();
  const pairParams: { slug: string }[] = [];
  for (const s of allSlugs) {
    const pair = getPair(s);
    if (!pair) continue;
    const a = pair.iso2A.toLowerCase();
    const b = pair.iso2B.toLowerCase();
    const [first, second] = a < b ? [a, b] : [b, a];
    const overviewSlug = `${first}-${second}`;
    if (!seen.has(overviewSlug)) {
      seen.add(overviewSlug);
      pairParams.push({ slug: overviewSlug });
    }
  }

  return [...patternParams, ...pairParams];
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const kind = classifySlug(slug);

  if (kind === "pair-overview") {
    const resolvedSlug = resolvePairOverviewSlug(slug);
    const pair = resolvedSlug ? getPair(resolvedSlug) : null;
    if (!pair) return { title: "Not found · QG Intelligence" };
    return {
      title: `${pair.countryA} ↔ ${pair.countryB} · All windows · QG Intelligence`,
      description: `All recorded windows of indicator co-movement between ${pair.countryA} and ${pair.countryB}.`,
      alternates: { canonical: `/patterns/${slug}` },
      robots: { index: false, follow: false },
    };
  }

  const meta = getPatternMeta(slug);
  if (!meta) return { title: "Pattern not found · QG Intelligence" };

  return {
    title: `${meta.a_name} ↔ ${meta.b_name}, ${meta.start_year}–${meta.end_year} · QG Intelligence`,
    description: `How ${meta.a_name} and ${meta.b_name} moved together from ${meta.start_year} to ${meta.end_year}: ${meta.num_indicators} shared indicators, average correlation ${meta.avg_correlation.toFixed(2)}.`,
    alternates: { canonical: `/patterns/${slug}` },
    robots: { index: false, follow: false },
  };
}

// ── Tier label ────────────────────────────────────────────────────────────────

function tierLabel(tier: string): string {
  switch (tier) {
    case "XL":
    case "L":
      return "long term";
    case "M":
      return "medium term";
    case "S":
    default:
      return "short pattern";
  }
}

// ── Build composite series ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildComposite(series: number[][], length: number): number[] {
  if (series.length === 0) {
    return Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return Math.round(Math.sin(t * Math.PI * 2) * 0.9 * 100) / 100;
    });
  }
  const n = series[0].length;
  return Array.from({ length: n }, (_, i) => {
    const sum = series.reduce((acc, s) => acc + (s[i] ?? 0), 0);
    return Math.round((sum / series.length) * 100) / 100;
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function UnifiedPatternPage({ params }: Params) {
  const { slug } = await params;
  const kind = classifySlug(slug);

  if (kind === "unknown") notFound();

  // ── Pair-overview branch ─────────────────────────────────────────────────
  if (kind === "pair-overview") {
    const resolvedSlug = resolvePairOverviewSlug(slug);
    const pair = resolvedSlug ? getPair(resolvedSlug) : null;
    if (!pair) notFound();

    return (
      <PageLayout>
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
        <PairSummaryPanel
          catalogueRank={pair.catalogueRank}
          catalogueSize={pair.catalogueSize}
          startYear={pair.startYear}
          endYear={pair.endYear}
          windowLength={pair.windowLength}
          sharedIndicatorCount={pair.sharedIndicators.length}
          strongestDecade={pair.strongestDecade}
        />
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
        <PairIndicatorsPanel
          countryA={pair.countryA}
          countryB={pair.countryB}
          indicators={pair.sharedIndicators}
        />
        <PairDecadesPanel
          decadeBuckets={pair.decadeBuckets}
          dominantFamilyAId={pair.dominantFamilyA.l1_id}
          dominantFamilyBId={pair.dominantFamilyB.l1_id}
        />
        <PairTodayPanel todayA={pair.todaySummaryA} todayB={pair.todaySummaryB} />
        <PairHandoffsFooter
          countryA={pair.countryA}
          countryB={pair.countryB}
          iso2A={pair.iso2A}
          iso2B={pair.iso2B}
        />
      </PageLayout>
    );
  }

  // ── Per-pattern branch ───────────────────────────────────────────────────
  const indicators = getPatternIndicators(slug);
  const meta = getPatternMeta(slug);
  if (!indicators || !meta) notFound();

  const compositeA = buildComposite(
    indicators.map((i) => i.series_a),
    meta.length
  );
  const compositeB = buildComposite(
    indicators.map((i) => i.series_b),
    meta.length
  );

  // Pair footer: two-segment alphabetical slug.
  const [iA, iB] =
    meta.a_iso2 < meta.b_iso2 ? [meta.a_iso2, meta.b_iso2] : [meta.b_iso2, meta.a_iso2];
  const pairOverviewSlug = `${iA}-${iB}`;

  // Window bounds per country.
  const startA = meta.start_year;
  const endA = meta.start_year + meta.length;
  const startB = meta.start_year_b ?? meta.start_year;
  const endB = startB + meta.length;
  const isOffset = isOffsetSlug(slug);

  // Count all windows for this pair.
  const allMeta = getAllPatternMeta();
  const windowCount = allMeta.filter((m) => {
    const [a, b] = m.a_iso2 < m.b_iso2 ? [m.a_iso2, m.b_iso2] : [m.b_iso2, m.a_iso2];
    return `${a}-${b}` === pairOverviewSlug;
  }).length;

  // Dominant family IDs for color (use Economic / Governance as plausible defaults).
  const dominantFamilyAId = "E";
  const dominantFamilyBId = "F";

  return (
    <PageLayout>
      {/* ── §1 Hero ─────────────────────────────────────────────────────── */}
      <div
        data-tour="pattern-detail-hero"
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "10px",
          padding: "28px 28px 28px",
          marginBottom: "20px",
        }}
      >
        {/* Breadcrumb row + HowToReadButton */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <Link
              href={"/patterns" as Route}
              style={{ color: "var(--qgi-accent)", textDecoration: "none" }}
            >
              Patterns
            </Link>
            <span style={{ color: "var(--qgi-text-dim)" }}>/</span>
            <span style={{ color: "var(--qgi-text)" }}>
              {meta.a_name} ↔ {meta.b_name}
            </span>
          </div>
          <HowToReadButton routeKey="patterns-v4-detail" />
        </div>

        {/* ── Country identity row ───────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {/* Country A block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FlagImg
              emoji={pairDetailFlagFor(meta.a_name)}
              name={meta.a_name}
              width={64}
              radius={5}
            />
            <span
              style={{
                fontSize: "clamp(18px, 3vw, 26px)",
                fontWeight: 800,
                color: "var(--qgi-text)",
                lineHeight: 1.1,
                textAlign: "center",
              }}
            >
              {meta.a_name}
            </span>
          </div>

          {/* Separator */}
          <span
            style={{
              fontSize: "clamp(22px, 4vw, 36px)",
              color: "var(--qgi-text-dim)",
              fontWeight: 300,
              flexShrink: 0,
            }}
          >
            ↔
          </span>

          {/* Country B block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FlagImg
              emoji={pairDetailFlagFor(meta.b_name)}
              name={meta.b_name}
              width={64}
              radius={5}
            />
            <span
              style={{
                fontSize: "clamp(18px, 3vw, 26px)",
                fontWeight: 800,
                color: "var(--qgi-text)",
                lineHeight: 1.1,
                textAlign: "center",
              }}
            >
              {meta.b_name}
            </span>
          </div>

          {/* Pattern context (offset vs aligned) */}
          {isOffset && meta.start_year_b !== undefined ? (
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--qgi-text-muted)",
                  fontFamily: "ui-monospace, monospace",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  {meta.a_name}: {startA}
                  {" → "}
                  {endA} ({meta.length} y)
                </div>
                <div>
                  {meta.b_name}: {startB}
                  {" → "}
                  {endB} ({meta.length} y)
                </div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--qgi-accent)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.3px",
                }}
              >
                {Math.abs(meta.offset_years ?? 0)}-year offset &middot;{" "}
                {meta.num_indicators} shared indicators &middot;{" "}
                <span
                  style={{
                    background: "var(--qgi-bg)",
                    border: "1px solid var(--qgi-border)",
                    borderRadius: "4px",
                    padding: "1px 6px",
                    fontSize: "10px",
                  }}
                >
                  {tierLabel(meta.tier)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ marginLeft: "auto" }}>
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--qgi-text-muted)",
                  fontFamily: "ui-monospace, monospace",
                  marginBottom: "4px",
                }}
              >
                {meta.start_year}
                {"–"}
                {meta.end_year} &middot; {meta.length} years &middot;{" "}
                {meta.num_indicators} shared indicators
              </div>
              <span
                style={{
                  background: "var(--qgi-bg)",
                  border: "1px solid var(--qgi-border)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontFamily: "ui-monospace, monospace",
                  color: "var(--qgi-text-muted)",
                }}
              >
                {tierLabel(meta.tier)}
              </span>
            </div>
          )}
        </div>

        {/* ── Average correlation badge + bar ───────── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: "4px",
              background: "var(--qgi-bg)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "6px",
              padding: "8px 16px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontFamily: "ui-monospace, monospace",
                color: "var(--qgi-text-dim)",
                letterSpacing: "1.2px",
                fontWeight: 600,
                marginRight: "6px",
              }}
            >
              AVG CORRELATION
            </span>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--qgi-accent)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {meta.avg_correlation.toFixed(2)}
            </span>
          </div>

          {/* Progress bar (avg_correlation 0.6-1.0 → 0-100%) */}
          <div
            style={{
              flex: "0 0 160px",
              height: "8px",
              background: "var(--qgi-border)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(((meta.avg_correlation - 0.6) / 0.4) * 100)}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${NEUTRAL_SLATE}80, var(--qgi-accent))`,
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── §2 Segment timeline ──────────────────────────────────────────── */}
      <PatternSegmentTimeline
        countryA={meta.a_name}
        countryB={meta.b_name}
        startA={startA}
        endA={endA}
        startB={startB}
        endB={endB}
      />

      {/* ── §3 Shape overlay (benign/crisis labels removed) ──────────────── */}
      <PatternShapeOverlay
        countryA={meta.a_name}
        countryB={meta.b_name}
        startYear={meta.start_year}
        endYear={meta.end_year}
        compositeSeriesA={compositeA}
        compositeSeriesB={compositeB}
        dominantFamilyAId={dominantFamilyAId}
        dominantFamilyBId={dominantFamilyBId}
      />

      {/* ── §4 Composite trajectory (Year 1..N axis) ─────────────────────── */}
      <PatternCompositeTrajectory
        countryA={meta.a_name}
        countryB={meta.b_name}
        length={meta.length}
        compositeA={compositeA}
        compositeB={compositeB}
        indicators={indicators}
        dominantFamilyAId={dominantFamilyAId}
        dominantFamilyBId={dominantFamilyBId}
      />

      {/* ── §5 Composition pie + grouped indicator grid ──────────────────── */}
      <PatternCompositionSection
        indicators={indicators}
        countryA={meta.a_name}
        countryB={meta.b_name}
        startA={startA}
        startB={startB}
        length={meta.length}
      />

      {/* ── §6 Footer ────────────────────────────────────────────────────── */}
      <div
        style={{
          fontSize: "11px",
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text-dim)",
          letterSpacing: "0.3px",
          paddingTop: "14px",
          borderTop: "1px solid var(--qgi-border)",
          marginTop: "8px",
        }}
      >
        {windowCount} window{windowCount !== 1 ? "s" : ""} on record for these countries.{" "}
        <Link
          href={`/patterns/${pairOverviewSlug}` as Route}
          style={{ color: "var(--qgi-accent)", textDecoration: "none" }}
        >
          See all windows for these countries &rarr;
        </Link>
      </div>
    </PageLayout>
  );
}
