/**
 * /patterns/[slug] — per-pattern detail (real, zero-mock).
 *
 * 2026-06-04 (founder): wire the per-pattern page to REAL cascade data. The
 * earlier version redirected to /patterns because the only detail source was
 * mock SCDIs. We now render straight from the real catalogue entry
 * (getPairBySlug -> country-partners-index.json / ranking.json): the two
 * countries, their Pearson correlation over the best shared window, the window
 * length + start years, indicator count, PPS, and tier. No mock series.
 *
 * The indicator-LEVEL breakdown (which specific indicators ran in parallel,
 * with their z-scored series) needs the cascade SCDI bake (pattern-scdis.json),
 * which has not landed yet — that one section renders an honest "coming with
 * the next data release" note rather than fabricated data (zero-mocks rule).
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getPairBySlug } from "@/lib/cascade-patterns/patterns-data";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";

interface Params {
  params: Promise<{ slug: string }>;
}

const TIER_LABEL: Record<string, string> = {
  XL: "long term",
  L: "long term",
  M: "medium term",
  S: "short pattern",
};
const TIER_COLOR: Record<string, string> = {
  XL: "#6C77E8",
  L: "#3FA9F5",
  M: "#3FBF8F",
  S: "#8A7A6E",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const pair = getPairBySlug(slug);
  return {
    title: pair
      ? `${pair.country_a} & ${pair.country_b} · Pattern · QG Intelligence`
      : "Pattern not found · QG Intelligence",
    description: pair
      ? `${pair.country_a} and ${pair.country_b}: a ${pair.window_length}-year structural parallel (correlation ${pair.corr.toFixed(2)}).`
      : "Pattern not found.",
  };
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "1.4px",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text-dim)",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--qgi-text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{ fontSize: "11px", color: "var(--qgi-text-muted)", marginTop: "4px" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export default async function PatternDetailPage({ params }: Params) {
  const { slug } = await params;
  const pair = getPairBySlug(slug);
  if (!pair) notFound();

  const tier = pair.tier;
  const tierColor = TIER_COLOR[tier] ?? "#9ab0c4";
  const tierLabel = TIER_LABEL[tier] ?? tier.toLowerCase();
  const years =
    pair.start_year_a > 0
      ? pair.start_year_a === pair.start_year_b
        ? `from ${pair.start_year_a}`
        : `${pair.country_a} ${pair.start_year_a} · ${pair.country_b} ${pair.start_year_b}`
      : "best shared window";

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "24px 24px 64px" }}>
        <Link
          href={"/patterns" as Route}
          style={{
            fontSize: "12px",
            color: "var(--qgi-text-muted)",
            textDecoration: "none",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          ← All patterns
        </Link>

        {/* Header: the pair */}
        <header style={{ margin: "16px 0 28px" }}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              marginBottom: "10px",
            }}
          >
            Structural pattern
          </div>
          <h1
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
              fontSize: "clamp(22px, 3.5vw, 34px)",
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <FlagImg
                emoji={flagFor(pair.country_a)}
                name={pair.country_a}
                width={26}
                radius={3}
              />
              {pair.country_a}
            </span>
            <span style={{ color: "var(--qgi-accent)", fontWeight: 400 }}>≈</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <FlagImg
                emoji={flagFor(pair.country_b)}
                name={pair.country_b}
                width={26}
                radius={3}
              />
              {pair.country_b}
            </span>
          </h1>
        </header>

        {/* Real metrics from the catalogue entry */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <Metric
            label="Avg correlation"
            value={pair.corr.toFixed(3)}
            sub="Pearson r over the window"
          />
          <Metric label="Shared window" value={`${pair.window_length}y`} sub={years} />
          {pair.num_indexes > 0 && (
            <Metric label="Indicators in parallel" value={String(pair.num_indexes)} />
          )}
          <Metric
            label="Pattern power"
            value={String(Math.round(pair.pps))}
            sub="ranking score"
          />
          <Metric label="Tier" value={tierLabel} />
        </div>

        {/* Plain-English reading */}
        <section
          style={{
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderLeft: `3px solid ${tierColor}`,
            borderRadius: "8px",
            padding: "16px 18px",
            marginBottom: "20px",
            fontSize: "14px",
            lineHeight: 1.65,
            color: "var(--qgi-text)",
          }}
        >
          Over a {pair.window_length}-year window, {pair.country_a} and {pair.country_b}
          &apos;s indicator-composite histories ran in close parallel
          {pair.num_indexes > 0 ? ` across ${pair.num_indexes} indicators` : ""} (Pearson
          r = {pair.corr.toFixed(3)}). This is structural resemblance, not a forecast: it
          says the two countries moved alike over the shared window, nothing about what
          either does next.
        </section>

        {/* Honest pending section — no mock */}
        <section
          style={{
            border: "1px dashed var(--qgi-border)",
            borderRadius: "8px",
            padding: "16px 18px",
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.4px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              marginBottom: "8px",
            }}
          >
            Indicator-level breakdown
          </div>
          The per-indicator detail for this pair (which specific indicators tracked
          together, with their aligned series) is computed by the cascade SCDI batch and
          lands with the next data release. We show it here only once it is real.
        </section>

        <footer
          style={{
            marginTop: "32px",
            paddingTop: "16px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Structural resemblance across the shared window. Not a forecast.
        </footer>
      </div>
    </div>
  );
}
