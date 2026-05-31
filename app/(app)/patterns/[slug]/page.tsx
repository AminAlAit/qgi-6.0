/**
 * /patterns/[slug] — per-pattern detail page.
 *
 * Slug dispatch:
 *   2 parts  ({a-iso}-{b-iso})          → notFound() — pair-overview retired 2026-05-31
 *   4 parts  ({a}-{b}-{year}-{year})    → aligned per-pattern detail
 *   5 parts  ({a}-{b}-{y}-{y}-{len})   → offset per-pattern detail
 *   else                                → notFound()
 *
 * Per-pattern sections (V4.1 rebuild 2026-05-31):
 *   §1  Hero             — flag + name blocks filling panel width; stats integrated
 *   §2  Segment timeline — two calendar tracks showing window span + offset
 *   §4  Composite traj   — Year 1..N axis (window-relative), per-category subplots
 *   §5  Composition+Grid — category chips inline + grouped indicator grid
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import {
  getPatternIndicators,
  getMockedPatternSlugs,
  getPatternMeta,
  isOffsetSlug,
} from "@/lib/cascade-patterns/scdi-mock";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { PageLayout } from "@/components/patterns-v4/PageLayout";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { PatternSegmentTimeline } from "@/components/patterns-v4-pattern-detail/PatternSegmentTimeline";
import { PatternCompositeTrajectory } from "@/components/patterns-v4-pattern-detail/PatternCompositeTrajectory";
import { PatternCompositionSection } from "@/components/patterns-v4-pattern-detail/PatternCompositionSection";
import { pairDetailFlagFor } from "@/lib/te-mock/patterns-v4-pair-detail-mock";
import { NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";

interface Params {
  params: Promise<{ slug: string }>;
}

// ── Slug classification ─────────────────────────────────────────────────────

type SlugType = "aligned" | "offset" | "unknown";

function classifySlug(slug: string): SlugType {
  const parts = slug.split("-");
  // Aligned: 4 parts, last two are 4-digit years.
  if (parts.length === 4 && /^\d{4}$/.test(parts[2]) && /^\d{4}$/.test(parts[3]))
    return "aligned";
  // Offset: 5 parts, last three encode years+length.
  if (parts.length === 5 && /^\d{4}$/.test(parts[2]) && /^\d{4}$/.test(parts[3]))
    return "offset";
  return "unknown";
}

// ── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  return getMockedPatternSlugs().map((slug) => ({ slug }));
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const meta = getPatternMeta(slug);
  if (!meta) return { title: "Pattern not found · QG Intelligence" };

  return {
    title: `${meta.a_name} and ${meta.b_name}, ${meta.start_year}–${meta.end_year} · QG Intelligence`,
    description: `How ${meta.a_name} and ${meta.b_name} moved together from ${meta.start_year} to ${meta.end_year}: ${meta.num_indicators} shared indicators, average correlation ${meta.avg_correlation.toFixed(2)}.`,
    alternates: { canonical: `/patterns/${slug}` },
    robots: { index: false, follow: false },
  };
}

// ── MetricPill — hero stat display ────────────────────────────────────────────

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "1.2px",
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text-dim)",
          fontWeight: 600,
          textTransform: "uppercase",
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--qgi-text)",
          lineHeight: 1.1,
          letterSpacing: "-0.3px",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
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
  // Window bounds per country.
  const startA = meta.start_year;
  const endA = meta.start_year + meta.length;
  const startB = meta.start_year_b ?? meta.start_year;
  const endB = startB + meta.length;
  const isOffset = isOffsetSlug(slug);

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
          padding: "24px 28px",
          marginBottom: "20px",
        }}
      >
        {/* Breadcrumb row + HowToReadButton */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "22px",
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
              {meta.a_name} and {meta.b_name}
            </span>
          </div>
          <HowToReadButton routeKey="patterns-v4-detail" />
        </div>

        {/* ── Main hero body: two country blocks + stats in one row ─────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: "0 20px",
          }}
        >
          {/* Country A block */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <FlagImg
              emoji={pairDetailFlagFor(meta.a_name)}
              name={meta.a_name}
              width={56}
              radius={5}
            />
            <span
              style={{
                fontSize: "clamp(20px, 2.6vw, 32px)",
                fontWeight: 800,
                color: "var(--qgi-text)",
                lineHeight: 1.1,
              }}
            >
              {meta.a_name}
            </span>
          </div>

          {/* Centre stats column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              padding: "0 24px",
            }}
          >
            {/* Avg correlation */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "9px",
                  letterSpacing: "1.4px",
                  fontFamily: "ui-monospace, monospace",
                  color: "var(--qgi-text-dim)",
                  fontWeight: 600,
                  marginBottom: "2px",
                }}
              >
                AVG CORRELATION
              </div>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "var(--qgi-accent)",
                  fontFamily: "ui-monospace, monospace",
                  lineHeight: 1,
                }}
              >
                {meta.avg_correlation.toFixed(2)}
              </div>
            </div>

            {/* Correlation bar */}
            <div
              style={{
                width: "120px",
                height: "6px",
                background: "var(--qgi-border)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round(((meta.avg_correlation - 0.6) / 0.4) * 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${NEUTRAL_SLATE}80, var(--qgi-accent))`,
                  borderRadius: "3px",
                }}
              />
            </div>

            {/* Core metrics: length · offset · indicators — hero anchors */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "16px",
                marginTop: "4px",
              }}
            >
              {isOffset && meta.start_year_b !== undefined ? (
                <>
                  <MetricPill label="length" value={`${meta.length} years`} />
                  <MetricPill
                    label="offset"
                    value={`${Math.abs(meta.offset_years ?? 0)}-year offset`}
                  />
                  <MetricPill
                    label="indicators"
                    value={`${meta.num_indicators} indicators`}
                  />
                </>
              ) : (
                <>
                  <MetricPill
                    label="window"
                    value={`${meta.start_year}–${meta.end_year}`}
                  />
                  <MetricPill label="length" value={`${meta.length} years`} />
                  <MetricPill
                    label="indicators"
                    value={`${meta.num_indicators} indicators`}
                  />
                </>
              )}
            </div>
          </div>

          {/* Country B block — right-aligned */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              justifyContent: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: "clamp(20px, 2.6vw, 32px)",
                fontWeight: 800,
                color: "var(--qgi-text)",
                lineHeight: 1.1,
                textAlign: "right",
              }}
            >
              {meta.b_name}
            </span>
            <FlagImg
              emoji={pairDetailFlagFor(meta.b_name)}
              name={meta.b_name}
              width={56}
              radius={5}
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

      {/* ── §4 Composite trajectory ──────────────────────────────────────── */}
      <PatternCompositeTrajectory
        countryA={meta.a_name}
        countryB={meta.b_name}
        length={meta.length}
        startA={startA}
        endA={endA}
        startB={startB}
        endB={endB}
        compositeA={compositeA}
        compositeB={compositeB}
        indicators={indicators}
        dominantFamilyAId={dominantFamilyAId}
        dominantFamilyBId={dominantFamilyBId}
      />

      {/* ── §5 Composition + grouped indicator grid ──────────────────────── */}
      <PatternCompositionSection
        indicators={indicators}
        countryA={meta.a_name}
        countryB={meta.b_name}
        startA={startA}
        startB={startB}
        length={meta.length}
        isOffset={isOffset}
      />
    </PageLayout>
  );
}
