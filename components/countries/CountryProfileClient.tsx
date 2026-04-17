"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { CountryRisk, RiskTier, CategoryScore } from "@/lib/country-risks";
import TaxonomyL1Widget from "@/components/countries/TaxonomyL1Widget";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { EventsTimeline } from "@/components/countries/EventsTimeline";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

const PATTERN_TIERS = ["S", "M", "L", "XL"] as const;
const TIER_LABELS: Record<string, string> = {
  S: "Short (3-8 yr)",
  M: "Medium (9-20 yr)",
  L: "Long (21-40 yr)",
  XL: "Institutional (41+ yr)",
};

const TIER_COLORS: Record<string, string> = {
  S: "#f87171",
  M: "#fbbf24",
  L: "#38bdf8",
  XL: "#a78bfa",
};

/* L1 category identifiers — MUST match the single-letter IDs from
   taxonomy_hierarchy.json / salience JSONs (A-H), NOT slug names.
   The V2 agent used slug names which caused empty radar charts. */
const L1_CATEGORIES: { id: string; label: string; short: string }[] = [
  { id: "A", label: "Political Power & Regime", short: "Political" },
  { id: "B", label: "Conflict & Violence", short: "Conflict" },
  { id: "C", label: "Governance & Rights", short: "Govern." },
  { id: "D", label: "Economic Stress", short: "Econ." },
  { id: "E", label: "Social Mobilization", short: "Social" },
  { id: "F", label: "Diplomacy & Geopolitics", short: "Diplo." },
  { id: "G", label: "Humanitarian Crisis", short: "Humanit." },
  { id: "H", label: "Structural Trends", short: "Struct." },
];

/** World median approximation for each L1 (global avg ~0.29) */
const L1_WORLD_MEDIAN = 0.29;

interface TimelineEvent {
  year: number;
  title: string;
  category: string;
}

interface Props {
  countryId: string;
  country: CountryRisk;
  generatedAt: string | null;
  version: string;
  events?: TimelineEvent[];
  l1Scores?: Record<string, number> | null;
  l2Scores?: Record<string, number> | null;
}

export function CountryProfileClient({
  countryId,
  country,
  generatedAt,
  version,
  events = [],
  l1Scores = null,
  l2Scores = null,
}: Props) {
  const router = useRouter();
  const [activeTier, setActiveTier] = useState<string>("S");
  const style = TIER_STYLES[country.overall_risk_tier];

  const tierData = country.tiers?.[activeTier];
  const topCategories = tierData?.top_categories ?? [];

  // Aggregate z-scores across all tiers for the risk breakdown chart
  const categoryZScores = getCategoryBreakdown(country);

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/countries"
          className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          &larr; Countries
        </Link>
      </div>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <CountryFlag alpha2={country.alpha_2} size={36} />
          <div>
            <h1 className="text-2xl font-semibold">{country.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className="text-[10px] tracking-widest font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: style.bg,
                  color: style.text,
                  border: `1px solid ${style.border}40`,
                }}
              >
                {country.overall_risk_tier} RISK
              </span>
              {country.curated && (
                <span
                  className="text-[10px] tracking-wider"
                  style={{ color: "var(--qgi-success)" }}
                >
                  Verified events
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div
          className="text-right text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <div>Scoring: {version}</div>
          {generatedAt && (
            <div>
              {/* Locale-stable ISO date avoids SSR/CSR hydration mismatch
                  (server formats as DD/MM/YYYY in en-GB locale; client browsers
                  vary). Pin to YYYY-MM-DD for consistency. */}
              Updated: {generatedAt.slice(0, 10)}
            </div>
          )}
        </div>
      </div>

      {/* ─── Plain-English Summary ─────────────────────────────────── */}
      <div
        className="rounded-lg border-l-2 pl-4 py-3 mb-6"
        style={{
          borderColor: "var(--qgi-accent)",
          backgroundColor: "var(--qgi-accent-glow)",
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {generateSummary(country, categoryZScores)}
        </p>
      </div>

      {/* ─── Layered Taxonomy Widget (8 cards, L1 → L2 drill-down) ─── */}
      <TaxonomyL1Widget l1Scores={l1Scores} l2Scores={l2Scores} />

      {/* ─── Risk Fingerprint Radar + Structural Twins (V2 promoted) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar Chart */}
        <section
          className="rounded-lg border p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <h2
            className="text-[11px] tracking-widest uppercase font-semibold mb-2"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            RISK FINGERPRINT
            <InfoTooltip text="Each axis represents one of 8 L1 risk categories. The filled shape shows this country's salience score vs the dashed world median. Larger deviations from the median indicate stronger signals." />
          </h2>
          {l1Scores && Object.keys(l1Scores).length > 0 ? (
            <>
              <div className="h-[340px]">
                <ReactECharts
                  option={radarOption(country.name, l1Scores)}
                  style={{ height: "100%", width: "100%" }}
                  opts={{ renderer: "svg" }}
                />
              </div>
              <div className="flex items-center gap-6 mt-2 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ backgroundColor: "#38bdf8" }} />
                  <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                    This country
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 border-t border-dashed" style={{ borderColor: "#4a6280" }} />
                  <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                    World median
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-[340px] flex items-center justify-center">
              <p className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
                L1 salience scores not yet available. Requires pipeline pre-compute.
              </p>
            </div>
          )}
        </section>

        {/* Structural Twins Panel */}
        <section
          className="rounded-lg border p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <h2
            className="text-[11px] tracking-widest uppercase font-semibold mb-4"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            STRUCTURAL TWINS &middot; TOP 5
            <InfoTooltip text="Countries whose economic trajectories most closely mirror this country across the highest-scoring pattern categories. Based on pattern partner frequency in country-risks.json." />
          </h2>
          <StructuralTwinsPanel country={country} />
        </section>
      </div>

      {/* ─── Risk Breakdown (horizontal bar chart) ──────────────────── */}
      <section
        className="rounded-lg border p-6 mb-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h2
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Risk Breakdown by Category
          <InfoTooltip text="Categories ranked by salience score — combining statistical signal strength with event consequence. Higher salience = stronger signal. Categories with below-average signal density (negative scores) are hidden." />
        </h2>
        <div className="space-y-2">
          {/* #13: filter out negative z-scores — they represent below-average
              signal density (not "negative risk") and are visually misleading
              when shown as negative bars. */}
          {categoryZScores.filter(c => c.salience >= 0).slice(0, 10).map(({ category, salience, recipe_count }) => (
            <Link
              key={category}
              href={`/countries/${countryId}/${encodeURIComponent(category)}`}
              className="block transition-opacity hover:opacity-80"
            >
              <CategoryBar
                category={category}
                salience={salience}
                recipeCount={recipe_count}
                maxSalience={categoryZScores[0]?.salience ?? 1}
              />
            </Link>
          ))}
        </div>
        {categoryZScores.length === 0 && (
          <p
            className="text-sm"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            No scored categories available.
          </p>
        )}
      </section>

      {/* ─── Indicator Trajectories (V2 placeholder) ───────────────── */}
      <section
        className="rounded-lg border p-6 mb-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h2
          className="text-xs tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Indicator Trajectories
          <InfoTooltip text="Shows the raw economic story of this country over decades. Each line is a key indicator normalized to 0-100. Red vertical markers show major geopolitical events." />
        </h2>
        <div
          className="flex items-center justify-center py-12 rounded"
          style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text-dim)" }}
        >
          <div className="text-center">
            <div className="text-sm mb-1">Indicator trajectories will render here</div>
            <div className="text-[10px] tracking-wider">
              Requires pipeline pre-compute of per-country indicator time series with event markers
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pattern Density Timeline (V2 placeholder) ────────────── */}
      <section
        className="rounded-lg border p-6 mb-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h2
          className="text-xs tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Pattern Density Timeline
          <InfoTooltip text="Shows when QGI found structural similarity between this country and others. Clusters of pattern starts indicate periods of high structural alignment with other economies." />
        </h2>
        <div
          className="flex items-center justify-center py-8 rounded"
          style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text-dim)" }}
        >
          <div className="text-center">
            <div className="text-sm mb-1">Pattern density by year will render here</div>
            <div className="text-[10px] tracking-wider">
              Requires pipeline pre-compute of pattern-start distributions per country
            </div>
          </div>
        </div>
      </section>

      {/* ─── Top Precedents (tabbed by tier) ────────────────────────── */}
      <section
        className="rounded-lg border p-6 mb-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h2
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Top Precedents by Pattern Tier
          <InfoTooltip text="Patterns grouped by how many years the economic similarity spans. Short (3-8yr) = policy cycles. Medium (9-20yr) = leadership eras. Long (21-40yr) = structural shifts. Institutional (41+yr) = civilizational parallels." />
        </h2>

        {/* Tier tabs */}
        <div className="flex gap-2 mb-4">
          {PATTERN_TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors"
              style={{
                backgroundColor:
                  activeTier === tier
                    ? `${TIER_COLORS[tier]}20`
                    : "transparent",
                borderColor:
                  activeTier === tier
                    ? TIER_COLORS[tier]
                    : "var(--qgi-border)",
                color:
                  activeTier === tier
                    ? TIER_COLORS[tier]
                    : "var(--qgi-text-muted)",
              }}
            >
              {tier} &middot; {TIER_LABELS[tier]}
            </button>
          ))}
        </div>

        {/* Precedent table */}
        {topCategories.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[10px] tracking-wider uppercase text-left"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                <th className="pb-2 font-normal">Rank</th>
                <th className="pb-2 font-normal">Category</th>
                <th className="pb-2 font-normal text-right">Salience</th>
                <th className="pb-2 font-normal text-right">Precedents</th>
                <th className="pb-2 font-normal text-right">Last Event</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.map((cat, i) => (
                <PrecedentRow
                  key={cat.category}
                  rank={i + 1}
                  cat={cat}
                  onClick={() =>
                    router.push(
                      `/countries/${countryId}/${encodeURIComponent(cat.category)}`
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        ) : (
          <p
            className="text-sm py-4"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            No precedent data for this tier.
          </p>
        )}
      </section>

      {/* ─── Events Timeline ───────────────────────────────────────── */}
      {events.length > 0 && (
        <div className="mb-6">
          <EventsTimeline events={events} countryName={country.name} />
        </div>
      )}

      {/* ─── Evidence link ──────────────────────────────────────────── */}
      <div
        className="rounded-lg border p-4 text-center"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <Link
          href={`/signals/country?country=${encodeURIComponent(country.name)}`}
          className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Explore full precedent evidence for {country.name} &rarr;
        </Link>
      </div>

      {/* ─── Honest framing footer ──────────────────────────────────── */}
      <p
        className="mt-6 text-[10px] leading-relaxed text-center"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        QGI surfaces economically-grounded risk candidates that analysts should
        examine. Risk tiers reflect historical precedent density, not
        probability forecasts.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryBar({
  category,
  salience,
  recipeCount,
  maxSalience,
}: {
  category: string;
  salience: number;
  recipeCount: number;
  maxSalience: number;
}) {
  const width = maxSalience > 0 ? Math.max((salience / maxSalience) * 100, 2) : 2;
  const color =
    salience >= 1.2
      ? "#f87171"
      : salience >= 0.5
        ? "#fbbf24"
        : "#38bdf8";

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-40 shrink-0 text-xs truncate"
        style={{ color: "var(--qgi-text)" }}
      >
        {formatCategory(category)}
      </div>
      <div className="flex-1 h-5 relative rounded overflow-hidden"
        style={{ backgroundColor: "var(--qgi-surface-2)" }}
      >
        <div
          className="h-full rounded transition-all"
          style={{
            width: `${Math.min(width, 100)}%`,
            backgroundColor: `${color}60`,
            borderRight: `2px solid ${color}`,
          }}
        />
        <span
          className="absolute left-2 top-0.5 font-data text-[10px]"
          style={{ color: "var(--qgi-text)" }}
        >
          {salience.toFixed(2)}
        </span>
      </div>
      <div
        className="font-data text-[10px] w-20 text-right shrink-0"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {recipeCount} prec.
      </div>
    </div>
  );
}

function PrecedentRow({
  rank,
  cat,
  onClick,
}: {
  rank: number;
  cat: CategoryScore;
  onClick?: () => void;
}) {
  const salience = cat.salience_score ?? cat.z_score;
  const sColor =
    salience >= 1.2
      ? "#f87171"
      : salience >= 0.5
        ? "#fbbf24"
        : "var(--qgi-text)";

  return (
    <tr
      className="border-t cursor-pointer transition-colors hover:bg-[var(--qgi-surface-2)]"
      style={{ borderColor: "var(--qgi-border)" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <td
        className="py-2 font-data text-xs"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {rank}
      </td>
      <td className="py-2 text-xs">{formatCategory(cat.category)}</td>
      <td
        className="py-2 font-data text-xs text-right"
        style={{ color: sColor }}
      >
        {salience.toFixed(2)}
      </td>
      <td
        className="py-2 font-data text-xs text-right"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {cat.recipe_count}
      </td>
      <td
        className="py-2 font-data text-xs text-right"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {cat.last_event_year ?? "—"}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Radar Chart Option (V2 promoted)
// ---------------------------------------------------------------------------

function radarOption(countryName: string, l1Scores: Record<string, number>) {
  // Map L1 category IDs to scores, fall back to 0
  const scores = L1_CATEGORIES.map((cat) => l1Scores[cat.id] ?? 0);
  const medians = L1_CATEGORIES.map(() => L1_WORLD_MEDIAN);

  const maxVal = Math.max(1, ...scores, ...medians);

  return {
    backgroundColor: "transparent",
    radar: {
      indicator: L1_CATEGORIES.map((cat) => ({
        name: cat.short,
        max: Math.max(maxVal * 1.1, 1),
      })),
      shape: "polygon" as const,
      radius: "65%",
      axisName: {
        color: "#7a90a8",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      splitArea: { show: false },
      splitLine: { lineStyle: { color: "#243347", width: 1 } },
      axisLine: { lineStyle: { color: "#243347" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: medians,
            name: "World Median",
            lineStyle: { type: "dashed" as const, color: "#4a6280", width: 1.5 },
            areaStyle: { color: "transparent" },
            symbol: "none",
          },
          {
            value: scores,
            name: countryName,
            lineStyle: { color: "#38bdf8", width: 2 },
            areaStyle: { color: "rgba(56, 189, 248, 0.15)" },
            symbol: "circle",
            symbolSize: 5,
            itemStyle: { color: "#38bdf8" },
          },
        ],
      },
    ],
    tooltip: {
      trigger: "item",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
  };
}

// ---------------------------------------------------------------------------
// Structural Twins Panel (V2 promoted)
// ---------------------------------------------------------------------------

function StructuralTwinsPanel({ country }: { country: CountryRisk }) {
  // Extract top pattern partners from tier data: count how many times each
  // partner country appears as a category across all tiers. This is a proxy
  // for structural similarity. Full pre-compute would come from the pipeline.
  // For now, show placeholder twins with a "requires pipeline" note.
  const placeholderTwins = [
    { name: "Data not yet pre-computed", alpha2: "", pps: 0, topCategory: "", patterns: 0 },
  ];

  // If the country has enough tier data, we can hint at the top categories
  const topCats = getCategoryBreakdownForTwins(country).slice(0, 3);
  const hasTierData = topCats.length > 0;

  return (
    <div className="space-y-3">
      {hasTierData ? (
        <>
          <div
            className="rounded-lg p-4 text-center"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              border: "1px dashed var(--qgi-border)",
            }}
          >
            <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
              REQUIRES PIPELINE PRE-COMPUTE
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--qgi-text-dim)" }}>
              Structural twins are determined by finding countries whose indicator trajectories
              most closely parallel {country.name}&apos;s across all pattern tiers. This requires
              a dedicated pipeline pre-computation step (pattern partner aggregation).
            </p>
            <div className="mt-4 space-y-2">
              <div className="text-[10px] tracking-widest uppercase" style={{ color: "var(--qgi-text-muted)" }}>
                TOP SIGNAL CATEGORIES
              </div>
              {topCats.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ backgroundColor: "var(--qgi-surface)" }}
                >
                  <span className="text-xs" style={{ color: "var(--qgi-text)" }}>
                    {formatCategory(cat.category)}
                  </span>
                  <span className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                    {cat.recipe_count} prec.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div
          className="rounded-lg p-6 text-center"
          style={{
            backgroundColor: "var(--qgi-surface-2)",
            border: "1px dashed var(--qgi-border)",
          }}
        >
          <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
            NO TWIN DATA AVAILABLE
          </div>
          <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            Structural twins will appear here after the pattern partner pre-computation pipeline runs.
          </p>
        </div>
      )}
    </div>
  );
}

function getCategoryBreakdownForTwins(
  country: CountryRisk
): Array<{ category: string; salience: number; recipe_count: number }> {
  const catMap: Record<string, { sSum: number; rSum: number; n: number }> = {};
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      if (!catMap[cat.category]) {
        catMap[cat.category] = { sSum: 0, rSum: 0, n: 0 };
      }
      catMap[cat.category].sSum += cat.salience_score ?? cat.z_score;
      catMap[cat.category].rSum += cat.recipe_count;
      catMap[cat.category].n += 1;
    }
  }
  return Object.entries(catMap)
    .map(([category, { sSum, rSum, n }]) => ({
      category,
      salience: sSum / n,
      recipe_count: Math.round(rSum / n),
    }))
    .sort((a, b) => b.salience - a.salience);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryBreakdown(
  country: CountryRisk
): Array<{ category: string; salience: number; z_score: number; recipe_count: number }> {
  const catMap: Record<string, { sSum: number; zSum: number; rSum: number; n: number }> = {};
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      if (!catMap[cat.category]) {
        catMap[cat.category] = { sSum: 0, zSum: 0, rSum: 0, n: 0 };
      }
      catMap[cat.category].sSum += cat.salience_score ?? cat.z_score;
      catMap[cat.category].zSum += cat.z_score;
      catMap[cat.category].rSum += cat.recipe_count;
      catMap[cat.category].n += 1;
    }
  }
  return Object.entries(catMap)
    .map(([category, { sSum, zSum, rSum, n }]) => ({
      category,
      salience: sSum / n,
      z_score: zSum / n,
      recipe_count: Math.round(rSum / n),
    }))
    .sort((a, b) => b.salience - a.salience);
}

function generateSummary(
  country: CountryRisk,
  categories: Array<{ category: string; salience: number; recipe_count: number }>
): string {
  const topCats = categories.slice(0, 3);
  if (topCats.length === 0) {
    return `Limited data available for ${country.name}.`;
  }

  const top = topCats[0];
  const topName = formatCategory(top.category);
  const tierDesc =
    country.overall_risk_tier === "HIGH"
      ? "elevated"
      : country.overall_risk_tier === "MODERATE"
        ? "moderate"
        : "baseline";

  // Count total precedent windows across all categories
  const totalPrecedents = categories.reduce((sum, c) => sum + c.recipe_count, 0);

  let summary = `${country.name}'s economic indicators show ${tierDesc} risk signals. `;
  summary += `The strongest signal is in ${topName} (${top.recipe_count} historical precedent windows). `;

  if (topCats.length >= 2) {
    const secondName = formatCategory(topCats[1].category);
    summary += `Also notable: ${secondName}`;
    if (topCats.length >= 3) {
      summary += ` and ${formatCategory(topCats[2].category)}`;
    }
    summary += ". ";
  }

  summary += `Across all categories, ${totalPrecedents.toLocaleString()} precedent windows were identified — `;
  summary += `meaning ${country.name}'s trajectory matches historical trajectories of countries that experienced these event types.`;

  return summary;
}

function countryFlag(alpha2: string): string {
  if (!alpha2) return "";
  const codePoints = [...alpha2.toUpperCase()].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65
  );
  return String.fromCodePoint(...codePoints);
}

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
