/**
 * Per-pattern dossier — /discover-patterns-a/[slug]
 *
 * Server component. Reads slug from params, looks up in mock data.
 * Shows: pattern identity, canonical stats, historical instances,
 * top countries, confidence trajectory, interpretation note.
 *
 * MOCK: all data from data/discover-patterns-mock.json + inline stubs.
 * Real integration: replace getPatternBySlug with an Athena / DynamoDB query.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { CountryFlag } from "@/components/design/CountryFlag";
import { SECTOR_COLORS, TIER_COLORS, TIER_LABELS } from "@/lib/design";
import type { PatternTier } from "@/lib/dashboard-cache";
import patternsData from "@/data/discover-patterns-mock.json";
import type { MockPattern } from "../DiscoverPatternsTabs";

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------
function getPatternBySlug(slug: string): MockPattern | undefined {
  return (patternsData.patterns as MockPattern[]).find((p) => p.slug === slug);
}

// MOCK: synthetic historical instances for the firing timeline
function mockHistoricalInstances(p: MockPattern) {
  // MOCK: generate plausible instances based on canonical length + category
  const instances = [];
  const baseYear = p.start_year_a;
  const step = Math.max(3, Math.floor(p.canonical_length / 4));
  for (let i = 0; i < 4; i++) {
    const yearA = baseYear + i * step;
    const yearB = yearA + p.lead_years;
    instances.push({
      country_a: p.country_a,
      country_b: p.country_b,
      country_a_code: p.country_a_code,
      country_b_code: p.country_b_code,
      start_year_a: yearA,
      start_year_b: yearB,
      avg_correlation: p.avg_correlation - i * 0.015,
      pps: p.pps - i * 120,
      confirmed: i < 3,
    });
  }
  return instances;
}

// MOCK: per-region firing count
function mockRegionBreakdown(p: MockPattern) {
  return [
    { region: p.region, count: 4, pct: 44 },
    { region: "Europe", count: 3, pct: 33 },
    { region: "Latin America", count: 2, pct: 22 },
  ];
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pattern = getPatternBySlug(slug);
  if (!pattern) return { title: "Pattern not found — QGI" };
  return {
    title: `${pattern.display_name} — QGI Patterns`,
    description: `Historical instances, confidence data, and top firing countries for the ${pattern.display_name} pattern.`,
    robots: { index: false, follow: false },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pattern = getPatternBySlug(slug);
  if (!pattern) notFound();

  const instances = mockHistoricalInstances(pattern);
  const regions = mockRegionBreakdown(pattern);

  const catColor = SECTOR_COLORS[pattern.category] ?? SECTOR_COLORS.Other;
  const tierKey: PatternTier =
    pattern.tier === "S" ||
    pattern.tier === "M" ||
    pattern.tier === "L" ||
    pattern.tier === "XL"
      ? pattern.tier
      : "M";
  const tierColor = TIER_COLORS[tierKey];
  const tierLabel = TIER_LABELS[tierKey];

  const hintConfig: Record<string, { label: string; color: string; blurb: string }> = {
    risk_elevation: {
      label: "Risk elevation",
      color: "#f87171",
      blurb:
        "When this pattern fires, historical precedent shows elevated probability of adverse risk events in the following 12-36 months. Use as a primary signal input, not a standalone conclusion.",
    },
    stabilisation: {
      label: "Stabilisation signal",
      color: "#34d399",
      blurb:
        "Countries matching this trajectory have historically shown resilience improvements. Suitable for adjusting risk premiums downward in the relevant category — with appropriate discount for lag time.",
    },
    volatility_flag: {
      label: "Volatility flag",
      color: "#fbbf24",
      blurb:
        "Transition period with elevated variance. Outcomes bifurcate sharply. Recommend widening confidence intervals on any premium built from this signal.",
    },
  };
  const hint = hintConfig[pattern.interpretation_hint] ?? hintConfig.risk_elevation;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* ================================================================== */}
      {/* BREADCRUMB + BACK                                                    */}
      {/* ================================================================== */}
      <nav
        className="flex items-center gap-2 text-[10px] tracking-widest uppercase mb-6"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <Link
          href={"/discover-patterns-a" as Route}
          className="hover:text-[var(--qgi-text)] transition-colors"
        >
          Discover Patterns
        </Link>
        <span>/</span>
        <span style={{ color: "var(--qgi-text-muted)" }}>{pattern.category}</span>
      </nav>

      {/* ================================================================== */}
      {/* HEADER                                                               */}
      {/* ================================================================== */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="inline-flex items-center rounded font-data font-semibold tracking-wider px-2 py-0.5 text-[10px]"
            style={{
              color: catColor,
              backgroundColor: `${catColor}18`,
              border: `1px solid ${catColor}40`,
            }}
          >
            {pattern.category}
          </span>
          <span
            className="inline-flex items-center rounded font-data tracking-wider px-2 py-0.5 text-[10px]"
            style={{
              color: tierColor,
              backgroundColor: `${tierColor}18`,
              border: `1px solid ${tierColor}40`,
            }}
            title={tierLabel}
          >
            {pattern.tier} · {tierLabel}
          </span>
          {pattern.predicted && (
            <span
              className="inline-flex items-center gap-1 font-data font-semibold text-[10px] tracking-wider uppercase"
              style={{ color: "var(--qgi-amber)" }}
            >
              &#9650; Currently firing
            </span>
          )}
          {/* MOCK banner */}
          <span
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: "#fbbf2420",
              color: "#fbbf24",
              border: "1px solid #fbbf2440",
            }}
          >
            PREVIEW
          </span>
        </div>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          {pattern.display_name}
        </h1>

        {/* Canonical pair */}
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Canonical pair
          </span>
          <CountryFlag alpha2={pattern.country_a_code} size={13} />
          <span className="font-data" style={{ color: "var(--qgi-country-a)" }}>
            {pattern.country_a}
          </span>
          <span style={{ color: "var(--qgi-text-dim)" }}>&#8594;</span>
          <CountryFlag alpha2={pattern.country_b_code} size={13} />
          <span className="font-data" style={{ color: "var(--qgi-country-b)" }}>
            {pattern.country_b}
          </span>
          <span
            className="ml-2 font-data text-[10px]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {pattern.start_year_a}–{pattern.start_year_b} · {pattern.canonical_length} yr
            window
          </span>
        </div>
      </header>

      {/* ================================================================== */}
      {/* STAT CARDS ROW                                                        */}
      {/* ================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Out-of-country"
          value={pattern.loco_auc.toFixed(3)}
          sub="held-out validation"
          color={
            pattern.loco_auc >= 0.8
              ? "#34d399"
              : pattern.loco_auc >= 0.7
                ? "#fbbf24"
                : "#7a90a8"
          }
        />
        <StatCard
          label="Avg correlation"
          value={`${(pattern.avg_correlation * 100).toFixed(0)}%`}
          sub={
            pattern.avg_correlation >= 0.85
              ? "S-tier"
              : pattern.avg_correlation >= 0.7
                ? "A-tier"
                : "B-tier"
          }
          color={
            pattern.avg_correlation >= 0.85
              ? "#34d399"
              : pattern.avg_correlation >= 0.7
                ? "#38bdf8"
                : "#fbbf24"
          }
        />
        <StatCard
          label="Lead time"
          value={`+${pattern.lead_years} yr`}
          sub="Predictive window"
          color="var(--qgi-amber)"
        />
        <StatCard
          label="Pattern length"
          value={`${pattern.canonical_length} yr`}
          sub={tierLabel}
          color={tierColor}
        />
      </div>

      {/* ================================================================== */}
      {/* INTERPRETATION NOTE                                                  */}
      {/* ================================================================== */}
      <section
        className="rounded-lg p-5 mb-8 border-l-4"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: `1px solid var(--qgi-border)`,
          borderLeftColor: hint.color,
          borderLeftWidth: 4,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-data font-semibold tracking-wider uppercase"
            style={{ color: hint.color }}
          >
            {hint.label}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
          {hint.blurb}
        </p>
      </section>

      {/* ================================================================== */}
      {/* TWO-COLUMN LAYOUT: instances + region breakdown                      */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left (3/5): historical instances */}
        <div className="lg:col-span-3">
          <h2
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Historical instances
            <span
              className="ml-2 text-[9px] font-data normal-case tracking-normal"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              (preview — 4 synthetic windows)
            </span>
          </h2>
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            {/* Column headers */}
            <div
              className="grid text-[9px] tracking-[0.12em] uppercase px-4 py-2 border-b"
              style={{
                gridTemplateColumns: "1fr 80px 80px 80px",
                color: "var(--qgi-text-dim)",
                borderColor: "var(--qgi-border)",
                backgroundColor: "var(--qgi-surface)",
              }}
            >
              <span>Pair</span>
              <span className="text-right">Years</span>
              <span className="text-right">Corr</span>
              <span className="text-right">Status</span>
            </div>
            {instances.map((inst, i) => (
              <div
                key={i}
                className="grid items-center px-4 py-2.5 border-b text-xs"
                style={{
                  gridTemplateColumns: "1fr 80px 80px 80px",
                  borderColor: "var(--qgi-border)",
                  backgroundColor: i % 2 === 0 ? "transparent" : "var(--qgi-surface)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  <CountryFlag alpha2={inst.country_a_code} size={11} />
                  <span
                    className="font-data text-[11px]"
                    style={{ color: "var(--qgi-country-a)" }}
                  >
                    {inst.country_a}
                  </span>
                  <span style={{ color: "var(--qgi-text-dim)", fontSize: 10 }}>→</span>
                  <CountryFlag alpha2={inst.country_b_code} size={11} />
                  <span
                    className="font-data text-[11px]"
                    style={{ color: "var(--qgi-country-b)" }}
                  >
                    {inst.country_b}
                  </span>
                </div>
                <span
                  className="text-right font-data text-[10px]"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {inst.start_year_a}–{inst.start_year_b}
                </span>
                <span
                  className="text-right font-data text-[10px]"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {(inst.avg_correlation * 100).toFixed(0)}%
                </span>
                <span className="text-right">
                  <span
                    className="font-data text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: inst.confirmed ? "#34d399" : "#fbbf24" }}
                  >
                    {inst.confirmed ? "Confirmed" : "Candidate"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right (2/5): region breakdown + top countries */}
        <div className="lg:col-span-2">
          <h2
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Region distribution
          </h2>
          <div
            className="rounded-lg border p-4 mb-4"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            {regions.map((r) => (
              <div key={r.region} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {r.region}
                  </span>
                  <span
                    className="font-data text-[11px]"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {r.pct}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--qgi-surface-2)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.pct}%`,
                      backgroundColor: catColor,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <h2
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Top firing countries
          </h2>
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            {pattern.top_countries.slice(0, 3).map((country, i) => (
              <div key={country} className="flex items-center gap-2 mb-2 last:mb-0">
                <span
                  className="font-data text-[10px] w-4 text-right shrink-0"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  #{i + 1}
                </span>
                <CountryFlag alpha2={pattern.top_country_codes[i]} size={13} />
                <span
                  className="text-[12px] font-data"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {country}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* FOOTER ACTIONS                                                        */}
      {/* ================================================================== */}
      <div
        className="flex items-center gap-4 pt-5 border-t text-sm"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <Link
          href={"/discover-patterns-a" as Route}
          className="text-[11px] tracking-wider hover:text-[var(--qgi-text)] transition-colors"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          ← Back to Discover Patterns
        </Link>
        <Link
          href={"/patterns" as Route}
          className="text-[11px] tracking-wider hover:text-[var(--qgi-text)] transition-colors"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V1 patterns explorer →
        </Link>
        <Link
          href={"/patterns/ranking" as Route}
          className="text-[11px] tracking-wider hover:text-[var(--qgi-text)] transition-colors"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Pattern ranking →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
      }}
    >
      <div className="font-data text-xl font-semibold mb-1" style={{ color }}>
        {value}
      </div>
      <div
        className="text-[11px] font-medium mb-0.5"
        style={{ color: "var(--qgi-text)" }}
      >
        {label}
      </div>
      <div className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
        {sub}
      </div>
    </div>
  );
}
