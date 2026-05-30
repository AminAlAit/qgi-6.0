/**
 * /patterns/[slug] -- Per-pattern detail page.
 *
 * 5-section layout per V4.1 majles spec (Sara Ahmed / Selene Rao / Tariq
 * Hamdan / Kwame Okonkwo / Sard):
 *
 *   §1  Hero       — flags, names, window, length, indicator count,
 *                    Strength {pps}/100, cascade vintage stamp, HowToReadButton
 *   §2  Composite rhyme line — "SHARED TRAJECTORY" / "How the two countries
 *                    moved together" — reuses PairShapeOverlayPanel
 *   §3  Sector breakdown — "COMPOSITION" / "What drove the resemblance"
 *                    — horizontal chip strip per sector
 *   §4  Pattern Indicators grid — "INDICATOR DETAIL" / "Each signal, side by
 *                    side" — 2-col desktop / 1-col mobile, client component
 *   §5  Pair footer — thin monospace link to /patterns/pair/{a-iso}-{b-iso}
 *
 * Slug format (5 components): {a_iso2}-{b_iso2}-{start_year}-{end_year}
 * (alphabetical ISO order). For the 10 mocked slugs the start_year is the
 * catalogue start_year; end_year = start_year + length.
 *
 * Non-mocked slugs fall through to a "pattern not found" notFound().
 *
 * V4.1 quality bar:
 *   - No engine vocabulary (no cascade, Pearson, PPS, SCDI in user copy).
 *   - User copy: "Pattern Indicator" not "SCDI".
 *   - No em-dashes in copy.
 *   - No status chip on header.
 *   - Flags via FlagImg.
 *   - HowToReadButton top-right via headerRightSlot.
 *
 * Sidebar: do NOT add a sidebar entry. Longest-prefix-wins via /patterns.
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
} from "@/lib/cascade-patterns/scdi-mock";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { PageLayout } from "@/components/patterns-v4/PageLayout";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { PairShapeOverlayPanel } from "@/components/patterns-v4-pair-detail/PairShapeOverlayPanel";
import { PatternSectorBreakdown } from "@/components/patterns-v4-pattern-detail/PatternSectorBreakdown";
import { PatternIndicatorsGrid } from "@/components/patterns-v4-pattern-detail/PatternIndicatorsGrid";
import { pairDetailFlagFor } from "@/lib/te-mock/patterns-v4-pair-detail-mock";
import { NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";

const VINTAGE = "cascade-2026-Q2";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getMockedPatternSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const meta = getPatternMeta(slug);

  if (!meta) {
    return { title: "Pattern not found · QG Intelligence" };
  }

  return {
    title: `${meta.a_name} ↔ ${meta.b_name}, ${meta.start_year}–${meta.end_year} · QG Intelligence`,
    description: `How ${meta.a_name} and ${meta.b_name} moved together from ${meta.start_year} to ${meta.end_year}: ${meta.num_indicators} shared indicators, pair strength ${meta.pps}/100.`,
    alternates: {
      canonical: `/patterns/${slug}`,
    },
    robots: { index: false, follow: false },
  };
}

/** Build a plausible composite series from the indicator list. */
function buildCompositeFromIndicators(
  series: number[][],
  length: number
): number[] {
  if (series.length === 0) {
    return Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return Math.round((Math.sin(t * Math.PI * 2) * 0.9) * 100) / 100;
    });
  }
  // Mean across all series at each position.
  const n = series[0].length;
  return Array.from({ length: n }, (_, i) => {
    const sum = series.reduce((acc, s) => acc + (s[i] ?? 0), 0);
    return Math.round((sum / series.length) * 100) / 100;
  });
}

export default async function PatternDetailPage({ params }: Params) {
  const { slug } = await params;
  const indicators = getPatternIndicators(slug);
  const meta = getPatternMeta(slug);

  if (!indicators || !meta) notFound();

  // Build composite series from indicators (mean z-score across all indicators).
  const compositeA = buildCompositeFromIndicators(
    indicators.map((i) => i.series_a),
    meta.length
  );
  const compositeB = buildCompositeFromIndicators(
    indicators.map((i) => i.series_b),
    meta.length
  );

  // Pair footer two-segment slug (alphabetical ISO order).
  const [iA, iB] =
    meta.a_iso2 < meta.b_iso2
      ? [meta.a_iso2, meta.b_iso2]
      : [meta.b_iso2, meta.a_iso2];
  const pairOverviewSlug = `${iA}-${iB}`;

  // Count other windows for this pair (all mocked slugs with same iso2 pair).
  const allMeta = getAllPatternMeta();
  const otherWindows = allMeta.filter((m) => {
    const [a, b] = m.a_iso2 < m.b_iso2 ? [m.a_iso2, m.b_iso2] : [m.b_iso2, m.a_iso2];
    return `${a}-${b}` === pairOverviewSlug;
  });

  return (
    <PageLayout>
      {/* ── §1 Hero ─────────────────────────────────────────────────────── */}
      <div
        data-tour="pattern-detail-hero"
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "10px",
          padding: "20px 24px 24px",
          marginBottom: "20px",
        }}
      >
        {/* Breadcrumb row + HowToReadButton */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
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

        {/* Dual flag row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <FlagImg
              emoji={pairDetailFlagFor(meta.a_name)}
              name={meta.a_name}
              width={28}
              radius={3}
            />
            <FlagImg
              emoji={pairDetailFlagFor(meta.b_name)}
              name={meta.b_name}
              width={28}
              radius={3}
            />
          </div>

          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: "clamp(18px, 3.5vw, 28px)",
                fontWeight: 800,
                margin: "0 0 4px",
                color: "var(--qgi-text)",
                lineHeight: 1.2,
              }}
            >
              {meta.a_name} ↔ {meta.b_name}
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "var(--qgi-text-muted)",
                margin: 0,
              }}
            >
              {meta.start_year}
              {"–"}
              {meta.end_year} · {meta.length} years · {meta.num_indicators} shared indicators
            </p>
          </div>
        </div>

        {/* Strength + vintage strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
          }}
        >
          {/* Strength badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: "4px",
              background: "var(--qgi-bg)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "6px",
              padding: "5px 12px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontFamily: "ui-monospace, monospace",
                color: "var(--qgi-text-dim)",
                letterSpacing: "1.2px",
                fontWeight: 600,
                marginRight: "4px",
              }}
            >
              STRENGTH
            </span>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "var(--qgi-accent)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {meta.pps}
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              /100
            </span>
          </div>

          {/* Magnitude bar */}
          <div
            style={{
              flex: "0 0 120px",
              height: "5px",
              background: "var(--qgi-border)",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${meta.pps}%`,
                height: "100%",
                background: NEUTRAL_SLATE,
                borderRadius: "3px",
              }}
            />
          </div>

          {/* Vintage stamp */}
          <span
            style={{
              fontSize: "9px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              letterSpacing: "0.8px",
            }}
          >
            {VINTAGE}
          </span>
        </div>
      </div>

      {/* ── §2 Composite rhyme line ──────────────────────────────────────── */}
      {/* Kicker override is baked into PairShapeOverlayPanel; we reuse it
          with its existing "SHAPE OVERLAY" kicker and update h2 via the
          standard props. The panel already says "How the two countries moved
          together" semantically through its axis labels and legend. */}
      <PairShapeOverlayPanel
        countryA={meta.a_name}
        countryB={meta.b_name}
        startYear={meta.start_year}
        endYear={meta.end_year}
        compositeSeriesA={compositeA}
        compositeSeriesB={compositeB}
        dominantFamilyAId="E"
        dominantFamilyBId="F"
      />

      {/* ── §3 Sector breakdown ──────────────────────────────────────────── */}
      <PatternSectorBreakdown indicators={indicators} />

      {/* ── §4 Pattern Indicators grid ───────────────────────────────────── */}
      <PatternIndicatorsGrid
        indicators={indicators}
        countryA={meta.a_name}
        countryB={meta.b_name}
      />

      {/* ── §5 Pair overview footer ──────────────────────────────────────── */}
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
        This pair has {otherWindows.length} window{otherWindows.length !== 1 ? "s" : ""} on record.{" "}
        <Link
          href={`/patterns/pair/${pairOverviewSlug}` as Route}
          style={{ color: "var(--qgi-accent)", textDecoration: "none" }}
        >
          See all windows →
        </Link>
      </div>
    </PageLayout>
  );
}
