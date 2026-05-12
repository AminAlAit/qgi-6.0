"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { CountryRisk, RiskTier, CategoryScore } from "@/lib/country-risks";
import { TOTAL_COUNTRIES } from "@/lib/site-stats";
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
  trajectoryData?: TrajectoryData | null;
  densityData?: PatternDensityData | null;
  twins?: Array<{
    partner_id: number;
    partner_name: string;
    alpha2: string;
    pattern_count: number;
    mean_corr: number;
    best_pps: number;
  }> | null;
}

export function CountryProfileClient({
  countryId,
  country,
  generatedAt,
  version,
  events = [],
  l1Scores = null,
  l2Scores = null,
  trajectoryData = null,
  densityData = null,
  twins = null,
}: Props) {
  const router = useRouter();
  const [showAllIndicators, setShowAllIndicators] = useState(false);
  const [activeTier, setActiveTier] = useState<string>("S");
  const [precedentsTableOpen, setPrecedentsTableOpen] = useState(false);
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
          <CountryFlag alpha2={country.alpha_2} size={36} countryName={country.name} />
          <div>
            <h1 className="text-2xl font-semibold">{country.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
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
              {/* T21 #314 (Santiago s2): recipe-depth disclosure — surfaces
                  the underlying pattern evidence volume so Venezuela's
                  ~1.5k precedents aren't visually equivalent to Colombia's
                  15k+ when reading a country's tier. */}
              {(() => {
                const recipeCount = Object.values(country.tiers ?? {}).reduce(
                  (sum, tb) =>
                    sum +
                    (tb.top_categories ?? []).reduce(
                      (s, c) => s + (c.recipe_count ?? 0),
                      0
                    ),
                  0
                );
                if (recipeCount === 0) return null;
                const depthLabel =
                  recipeCount >= 5000
                    ? "robust"
                    : recipeCount >= 1500
                      ? "moderate"
                      : "sparse";
                const depthColor =
                  depthLabel === "robust"
                    ? "var(--qgi-success)"
                    : depthLabel === "moderate"
                      ? "var(--qgi-amber)"
                      : "var(--qgi-text-dim)";
                return (
                  <span
                    className="text-[10px] tracking-wider font-data flex items-center gap-1"
                    style={{ color: "var(--qgi-text-dim)" }}
                    title={`${recipeCount.toLocaleString()} precedent matches across all pattern-length tiers. Interpret HIGH tiers with higher confidence when evidence volume is 'robust'; 'sparse' evidence means fewer historical analogues support the score.`}
                  >
                    Pattern depth:{" "}
                    <span style={{ color: depthColor }}>
                      {recipeCount.toLocaleString()} ({depthLabel})
                    </span>
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="text-right text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
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

      {/* ─── L1 vs World Median (from Country V2) ────────────────────── */}
      {l1Scores && Object.values(l1Scores).some((v) => v > 0) && (
        <section
          className="rounded-lg border p-5 mb-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <h2
            className="text-xs tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            L1 vs World Median
            <InfoTooltip
              text={`Compares this country's risk score in each domain against the median (middle value) across all ${TOTAL_COUNTRIES} countries. Red bars mean this country scores HIGHER than most countries in that domain — a stronger risk signal. Green bars mean LOWER than most — less anomalous. The further the bar extends, the more this country deviates from what's typical globally.`}
            />
          </h2>
          <div className="space-y-1.5">
            {L1_CATEGORIES.map((cat) => {
              const score = l1Scores[cat.id] ?? 0;
              const delta = score - L1_WORLD_MEDIAN;
              const maxBar = 0.5; // max possible delta for bar scaling
              const pct = Math.min(100, (Math.abs(delta) / maxBar) * 100);
              return (
                <div key={cat.id} className="flex items-center gap-2">
                  <span
                    className="text-[10px] w-16 text-right font-data truncate"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {cat.short}
                  </span>
                  <div
                    className="flex-1 h-3 rounded-sm relative"
                    style={{ backgroundColor: "var(--qgi-surface-2)" }}
                  >
                    <div
                      className="absolute h-full rounded-sm"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: delta >= 0 ? "#f8717180" : "#34d39980",
                        left: delta >= 0 ? 0 : undefined,
                        right: delta < 0 ? 0 : undefined,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] w-10 text-right font-data"
                    style={{ color: delta >= 0 ? "#f87171" : "#34d399" }}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Risk Fingerprint Radar + Structural Twins (V2 promoted) ── */}
      <div
        className={`grid grid-cols-1 ${twins && twins.length > 0 ? "lg:grid-cols-2" : ""} gap-6 mb-6`}
      >
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
                  <div
                    className="w-4 h-0.5 border-t border-dashed"
                    style={{ borderColor: "#4a6280" }}
                  />
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

        {/* Right column: Structural Twins when available */}
        {twins && twins.length > 0 && (
          <section
            className="rounded-lg border p-6 mb-4"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold mb-4"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              STRUCTURAL TWINS &middot; TOP {twins.length}
              <InfoTooltip text="Countries whose economic indicator trajectories most closely parallel this country across all pattern tiers." />
            </h2>
            <div className="space-y-3">
              {twins.map((twin, i) => (
                <Link
                  key={twin.partner_id}
                  href={`/countries/${twin.partner_id}`}
                  className="flex items-center gap-4 p-3 rounded-lg transition-colors hover:opacity-80"
                  style={{
                    backgroundColor:
                      i === 0 ? "rgba(56, 189, 248, 0.06)" : "var(--qgi-surface-2)",
                    border: `1px solid ${i === 0 ? "rgba(56, 189, 248, 0.2)" : "transparent"}`,
                  }}
                >
                  <CountryFlag alpha2={twin.alpha2} size={22} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{twin.partner_name}</div>
                    <div
                      className="text-[10px] tracking-wider"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {twin.pattern_count.toLocaleString()} patterns &middot;{" "}
                      {(twin.mean_corr * 100).toFixed(0)}% avg corr
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-data text-lg font-bold"
                      style={{ color: "var(--qgi-accent)" }}
                    >
                      {twin.best_pps.toFixed(0)}
                    </div>
                    <div
                      className="text-[9px] tracking-widest"
                      style={{ color: "var(--qgi-text-dim)" }}
                      title="Pattern Power Score — strength + persistence + breadth"
                    >
                      SCORE
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ─── Risk Breakdown by Category (always full width) ───────── */}
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
          <InfoTooltip text="Categories ranked by salience score — combining statistical signal strength with event consequence. Higher salience = stronger signal." />
        </h2>
        <div className="space-y-2">
          {categoryZScores
            .filter((c) => c.salience >= 0)
            .slice(0, 10)
            .map(({ category, salience, recipe_count }) => (
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
          <p className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
            No scored categories available.
          </p>
        )}
      </section>

      {/* ─── Indicator Trajectories (V2 promoted) ────────────────── */}
      {trajectoryData && (
        <section
          className="rounded-lg border p-6 mb-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              INDICATOR TRAJECTORIES &middot;{" "}
              {showAllIndicators ? `ALL ${trajectoryData.indicators.length}` : "TOP 3"}{" "}
              INDICATORS &middot; {trajectoryData.years[0]}-
              {trajectoryData.years[trajectoryData.years.length - 1]}
              <InfoTooltip text="Shows the raw economic story of this country over decades. Each line is a key indicator normalized to 0-100. Red vertical markers show major geopolitical events. Click legend items to show/hide." />
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAllIndicators((v) => !v)}
                className="px-2.5 py-1 rounded text-[9px] tracking-wider uppercase transition-colors"
                style={{
                  backgroundColor: showAllIndicators
                    ? "rgba(56, 189, 248, 0.15)"
                    : "rgba(122, 144, 168, 0.1)",
                  color: showAllIndicators ? "#38bdf8" : "#7a90a8",
                  border: `1px solid ${showAllIndicators ? "rgba(56, 189, 248, 0.3)" : "rgba(122, 144, 168, 0.2)"}`,
                }}
              >
                {showAllIndicators ? "Top 3" : `All ${trajectoryData.indicators.length}`}
              </button>
              <span className="text-[9px]" style={{ color: "var(--qgi-text-dim)" }}>
                Normalized 0-100 &middot; hover for raw
              </span>
            </div>
          </div>
          <TrajectoryChartWithLabels
            trajData={trajectoryData}
            showAll={showAllIndicators}
            /* T4 #297: header says "Top 3" but the set selected indices
               0, 1, 3 (i.e. 1st, 2nd, 4th). Corrected to 0, 1, 2. */
            defaultVisibleIndices={new Set([0, 1, 2])}
          />
        </section>
      )}

      {/* ─── Pattern Density Timeline (V2 promoted) ───────────────── */}
      {densityData && (
        <section
          className="rounded-lg border p-6 mb-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              PATTERN DENSITY (by year)
              <InfoTooltip text="Shows when QGI found structural similarity between this country and others. Clusters of pattern starts indicate periods of high structural alignment." />
            </h2>
            <span
              className="text-[11px] font-data"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {densityData.total.toLocaleString()} patterns total
            </span>
          </div>
          <div
            className="text-[10px] tracking-wider mb-3"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Years with more pattern starts = more structural similarity to other
            countries&apos; trajectories.
          </div>
          <div className="h-[240px]">
            <ReactECharts
              option={patternDensityOption(densityData)}
              style={{ height: "100%", width: "100%" }}
              opts={{ renderer: "svg" }}
            />
          </div>
        </section>
      )}

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
                  activeTier === tier ? `${TIER_COLORS[tier]}20` : "transparent",
                borderColor:
                  activeTier === tier ? TIER_COLORS[tier] : "var(--qgi-border)",
                color: activeTier === tier ? TIER_COLORS[tier] : "var(--qgi-text-muted)",
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
          <p className="text-sm py-4" style={{ color: "var(--qgi-text-dim)" }}>
            No precedent data for this tier.
          </p>
        )}
      </section>

      {/* ─── Full Precedent Table (collapsed by default, V2 ported) ── */}
      {(() => {
        const allPrecedents = getAllPrecedents(country);
        if (allPrecedents.length === 0) return null;
        return (
          <section
            className="rounded-lg overflow-hidden mb-6"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <button
              onClick={() => setPrecedentsTableOpen(!precedentsTableOpen)}
              className="w-full flex items-center justify-between p-5 transition-colors"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              <span className="text-[11px] tracking-widest uppercase font-semibold">
                FULL PRECEDENT TABLE ({allPrecedents.length} categories)
              </span>
              <span className="text-sm">{precedentsTableOpen ? "\u25B2" : "\u25BC"}</span>
            </button>
            {precedentsTableOpen && (
              <div className="px-5 pb-5">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ color: "var(--qgi-text-dim)" }}>
                      <th className="text-left py-2 tracking-widest font-normal">
                        CATEGORY
                      </th>
                      <th className="text-center py-2 tracking-widest font-normal">
                        TIER
                      </th>
                      <th className="text-right py-2 tracking-widest font-normal">
                        SALIENCE
                      </th>
                      <th className="text-right py-2 tracking-widest font-normal">
                        RECIPES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPrecedents.map((p) => (
                      <tr
                        key={`${p.tier}-${p.category}`}
                        className="border-t cursor-pointer transition-colors hover:bg-[var(--qgi-surface-2)]"
                        style={{ borderColor: "var(--qgi-border)" }}
                        onClick={() =>
                          router.push(
                            `/countries/${countryId}/${encodeURIComponent(p.category)}`
                          )
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(
                              `/countries/${countryId}/${encodeURIComponent(p.category)}`
                            );
                          }
                        }}
                      >
                        <td className="py-2" style={{ color: "var(--qgi-text)" }}>
                          {formatCategory(p.category)}
                        </td>
                        <td
                          className="py-2 text-center font-data font-bold"
                          style={{
                            color: TIER_COLORS[p.tier] ?? "var(--qgi-text-muted)",
                          }}
                        >
                          {p.tier}
                        </td>
                        <td
                          className="py-2 text-right font-data"
                          style={{ color: "var(--qgi-text)" }}
                        >
                          {p.salience.toFixed(2)}
                        </td>
                        <td
                          className="py-2 text-right font-data"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          {p.recipes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}

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
        QGI surfaces economically-grounded risk candidates that analysts should examine.
        Risk tiers reflect historical precedent density, not probability forecasts.
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
  const color = salience >= 1.2 ? "#f87171" : salience >= 0.5 ? "#fbbf24" : "#38bdf8";

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-40 shrink-0 text-xs truncate"
        style={{ color: "var(--qgi-text)" }}
      >
        {formatCategory(category)}
      </div>
      <div
        className="flex-1 h-5 relative rounded overflow-hidden"
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
    salience >= 1.2 ? "#f87171" : salience >= 0.5 ? "#fbbf24" : "var(--qgi-text)";

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
      <td className="py-2 font-data text-xs" style={{ color: "var(--qgi-text-dim)" }}>
        {rank}
      </td>
      <td className="py-2 text-xs">{formatCategory(cat.category)}</td>
      <td className="py-2 font-data text-xs text-right" style={{ color: sColor }}>
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
// Indicator Trajectory Chart (V2 promoted)
// ---------------------------------------------------------------------------

const INDICATOR_COLORS = [
  "#38bdf8",
  "#34d399",
  "#f87171",
  "#fbbf24",
  "#a78bfa",
  "#fb923c",
];

function normalizeMinMax(data: (number | null)[]): (number | null)[] {
  const nums = data.filter((v): v is number => v !== null && !isNaN(v));
  if (nums.length === 0) return data.map(() => null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return data.map((v) => (v === null ? null : 50));
  return data.map((v) => (v === null ? null : ((v - min) / (max - min)) * 100));
}

interface TrajectoryIndicator {
  name: string;
  data: (number | null)[];
  unit: string;
  /** First year where is_predicted = true. When present, data from this year
   *  onward is rendered with a dashed line at lower opacity. */
  predicted_from?: number;
}

interface TrajectoryData {
  years: number[];
  indicators: TrajectoryIndicator[];
  events: { year: number; label: string }[];
}

function indicatorTrajectoryOption(
  trajData: TrajectoryData,
  showAll: boolean,
  defaultVisibleIndices: Set<number>
) {
  const legendSelected: Record<string, boolean> = {};
  trajData.indicators.forEach((ind, i) => {
    legendSelected[ind.name] = showAll || defaultVisibleIndices.has(i);
    // predicted series hidden from legend but follows the same show/hide state
    if (ind.predicted_from !== undefined) {
      legendSelected[`${ind.name} (predicted)`] = showAll || defaultVisibleIndices.has(i);
    }
  });
  legendSelected["World median"] = true;

  const areaAlpha = "0F";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: any[] = [];

  // For tooltip: map predicted series names back to original indicator
  const predictedSeriesNameMap: Record<string, string> = {};

  trajData.indicators.forEach((ind, i) => {
    const color = INDICATOR_COLORS[i % INDICATOR_COLORS.length];
    const z = defaultVisibleIndices.has(i) ? 3 : 1;

    // T4 #297 HIGH fix (2026-04-19): do NOT coerce nulls to 0 before
    // normalizing. `normalizeMinMax` already passes nulls through and ECharts
    // with `connectNulls: false` renders gaps correctly. Coercing nulls to 0
    // produced false zero-dips for sparse indicators (Lebanon Inflation
    // 49/67 null years became a floor of 0, not a gap).
    const normalizedAll = normalizeMinMax(ind.data);

    if (ind.predicted_from === undefined) {
      // No predicted split — single solid series
      series.push({
        name: ind.name,
        type: "line",
        data: normalizedAll,
        smooth: true,
        lineStyle: { width: 1.5, color },
        itemStyle: { color },
        areaStyle: { color: color + areaAlpha, origin: "start" },
        symbol: "none",
        emphasis: { lineStyle: { width: 2.5 } },
        z,
      });
    } else {
      // Split into historical (solid) + predicted (dashed, lower opacity)
      const splitIdx = trajData.years.indexOf(ind.predicted_from);

      // Historical portion: up to (including) the transition point so lines join
      const historicalData = normalizedAll.map((v, yi) => (yi <= splitIdx ? v : null));
      // Predicted portion: from the transition point onward (null before)
      const predictedData = normalizedAll.map((v, yi) => (yi >= splitIdx ? v : null));

      series.push({
        name: ind.name,
        type: "line",
        data: historicalData,
        smooth: true,
        lineStyle: { width: 1.5, color },
        itemStyle: { color },
        areaStyle: { color: color + areaAlpha, origin: "start" },
        symbol: "none",
        emphasis: { lineStyle: { width: 2.5 } },
        z,
        connectNulls: false,
      });

      const predictedSeriesName = `${ind.name} (predicted)`;
      predictedSeriesNameMap[predictedSeriesName] = ind.name;
      series.push({
        name: predictedSeriesName,
        type: "line",
        data: predictedData,
        smooth: true,
        lineStyle: { width: 1.5, color, type: "dashed" as const, opacity: 0.5 },
        itemStyle: { color, opacity: 0.5 },
        areaStyle: { color: "transparent" },
        symbol: "none",
        emphasis: { lineStyle: { width: 2.5 } },
        z,
        connectNulls: false,
        // "predicted" annotation at the transition point
        markPoint: {
          silent: true,
          data:
            splitIdx >= 0
              ? [
                  {
                    coord: [String(ind.predicted_from), normalizedAll[splitIdx]],
                    symbol: "circle",
                    symbolSize: 6,
                    itemStyle: { color, borderColor: color, opacity: 0.5 },
                    label: {
                      show: true,
                      formatter: "predicted",
                      position: "top" as const,
                      fontSize: 9,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#7a90a8",
                      distance: 4,
                    },
                  },
                ]
              : [],
        },
      });
    }
  });

  series.push({
    name: "World median",
    type: "line",
    data: trajData.years.map(() => 50),
    smooth: false,
    lineStyle: { width: 1, color: "#4a628060", type: [4, 4] as unknown as string },
    itemStyle: { color: "#4a628060" },
    symbol: "none",
    z: 0,
  });

  // Pick 5 maximally-spaced events across the full timeline to prevent
  // label clustering when all curated events are recent.
  const topEvents = pickSpreadEvents(trajData.events, 5);
  const markLines = topEvents.map((e) => ({
    xAxis: String(e.year),
    lineStyle: { color: "#f87171", width: 1.5, type: "solid" as const },
    label: { show: false },
  }));

  return {
    backgroundColor: "transparent",
    grid: { top: 55, right: 20, bottom: 30, left: 45 },
    legend: {
      top: 0,
      left: "center",
      textStyle: {
        color: "#7a90a8",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      itemWidth: 18,
      itemHeight: 2,
      itemGap: 12,
      selected: legendSelected,
      // Hide the "(predicted)" series from the legend — they inherit visibility
      // from their parent series via the legendSelected map but don't need
      // separate legend entries.
      formatter: (name: string) => (name.endsWith(" (predicted)") ? "" : name),
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: {
        color: "#e2e8f0",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      formatter: (
        params: Array<{
          seriesName: string;
          value: number;
          dataIndex: number;
          color: string;
        }>
      ) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const year = trajData.years[params[0].dataIndex];
        let html = `<div style="font-weight:600;margin-bottom:4px">${year}</div>`;
        // Deduplicate — predicted series shares the name with historical series
        const seenNames = new Set<string>();
        params.forEach((p) => {
          if (p.seriesName === "World median") return;
          // Resolve predicted series back to original name
          const originalName = predictedSeriesNameMap[p.seriesName] ?? p.seriesName;
          if (seenNames.has(originalName)) return;
          seenNames.add(originalName);
          const raw = trajData.indicators.find((r) => r.name === originalName);
          const rawVal = raw ? raw.data[p.dataIndex] : p.value;
          const unit = raw ? raw.unit : "";
          const isPredicted =
            raw?.predicted_from !== undefined &&
            trajData.years[p.dataIndex] >= (raw.predicted_from ?? Infinity);
          const formatted =
            typeof rawVal === "number" && rawVal > 1000
              ? rawVal.toLocaleString()
              : typeof rawVal === "number"
                ? rawVal.toFixed(1)
                : rawVal;
          const predLabel = isPredicted
            ? ' <span style="opacity:0.6;font-size:9px">(predicted)</span>'
            : "";
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color}">\u25CF ${originalName}${predLabel}</span><span style="font-weight:600">${formatted} ${unit}</span></div>`;
        });
        return html;
      },
    },
    xAxis: {
      type: "category",
      data: trajData.years.map(String),
      axisLine: { lineStyle: { color: "#243347" } },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        interval: 4,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLine: { show: false },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      splitLine: { lineStyle: { color: "#243347", width: 1 } },
    },
    series: series.map((s, i) => ({
      ...s,
      ...(i === 0 ? { markLine: { silent: true, symbol: "none", data: markLines } } : {}),
    })),
  };
}

function TrajectoryChartWithLabels({
  trajData,
  showAll,
  defaultVisibleIndices,
}: {
  trajData: TrajectoryData;
  showAll: boolean;
  defaultVisibleIndices: Set<number>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instRef = useRef<any>(null);
  const [labelPositions, setLabelPositions] = useState<
    { year: number; label: string; x: number; y: number }[]
  >([]);

  const onChartReady = useCallback(
    (inst: unknown) => {
      instRef.current = inst;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ecInst = inst as any;
      const eventsToShow = pickSpreadEvents(trajData.events, 5);
      const positions = eventsToShow.map((e) => {
        const px = ecInst.convertToPixel({ xAxisIndex: 0 }, String(e.year));
        const gridRect = ecInst
          .getModel()
          .getComponent("grid", 0)
          .coordinateSystem.getRect();
        return { year: e.year, label: e.label, x: px as number, y: gridRect.y as number };
      });
      setLabelPositions(positions);
    },
    [trajData.events]
  );

  return (
    <div className="relative h-[480px]">
      <ReactECharts
        option={indicatorTrajectoryOption(trajData, showAll, defaultVisibleIndices)}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
        onChartReady={onChartReady}
      />
      {labelPositions.map((lp) => (
        <div
          key={lp.year}
          style={{
            position: "absolute",
            right: `calc(100% - ${lp.x - 3}px)`,
            top: lp.y - 2,
            transform: "rotate(-90deg)",
            transformOrigin: "top right",
            color: "#f87171",
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {lp.label}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pattern Density Chart (V2 promoted)
// ---------------------------------------------------------------------------

interface PatternDensityData {
  years: number[];
  counts: number[];
  total: number;
}

function patternDensityOption(densityData: PatternDensityData) {
  return {
    backgroundColor: "transparent",
    grid: { top: 15, right: 15, bottom: 30, left: 40 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: {
        color: "#e2e8f0",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      formatter: (params: Array<{ value: number; dataIndex: number }>) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const yr = densityData.years[params[0].dataIndex];
        return `<div style="font-weight:600">${yr}</div><div>${params[0].value} pattern starts</div>`;
      },
    },
    xAxis: {
      type: "category",
      data: densityData.years.map(String),
      axisLine: { lineStyle: { color: "#243347" } },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        interval: 4,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      splitLine: { lineStyle: { color: "#243347", width: 1 } },
    },
    series: [
      {
        type: "bar",
        data: densityData.counts,
        itemStyle: { color: "#fbbf24", borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 10,
        emphasis: { itemStyle: { color: "#fcd34d" } },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * From a list of events, pick up to `n` events that are maximally spread
 * across the year range, so chart labels never cluster.
 *
 * Algorithm:
 *   1. Sort events by year ascending.
 *   2. If ≤ n events, return all (nothing to trim).
 *   3. Always keep the first (oldest) and last (newest) events.
 *   4. Divide the year range into (n-1) equal buckets; pick one representative
 *      event per bucket — the one whose year falls closest to the bucket
 *      midpoint. Deduplication ensures the first/last are not selected twice.
 *
 * Returns events sorted by year ascending so callers iterate chronologically.
 */
function pickSpreadEvents(
  events: { year: number; label: string }[],
  n: number
): { year: number; label: string }[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.year - b.year);
  if (sorted.length <= n) return sorted;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Edge: n === 1
  if (n === 1) return [first];
  // Edge: n === 2
  if (n === 2) return [first, last];

  const yearMin = first.year;
  const yearMax = last.year;
  const span = yearMax - yearMin;

  // The inner slots (excluding first and last) fill (n-2) bucket midpoints.
  const innerCount = n - 2;
  const bucketSize = span / (innerCount + 1);

  const selected: { year: number; label: string }[] = [first];

  for (let i = 1; i <= innerCount; i++) {
    const targetYear = yearMin + i * bucketSize;
    // Find the event closest to this target year, excluding already-selected years.
    const selectedYears = new Set(selected.map((e) => e.year));
    let best: { year: number; label: string } | null = null;
    let bestDist = Infinity;
    for (const e of sorted) {
      if (selectedYears.has(e.year)) continue;
      if (e.year === last.year) continue; // reserved for last slot
      const dist = Math.abs(e.year - targetYear);
      if (dist < bestDist) {
        bestDist = dist;
        best = e;
      }
    }
    if (best) selected.push(best);
  }

  selected.push(last);

  // Return sorted by year for consistent rendering order.
  return selected.sort((a, b) => a.year - b.year);
}

function getCategoryBreakdown(
  country: CountryRisk
): Array<{ category: string; salience: number; z_score: number; recipe_count: number }> {
  const catMap: Record<string, { sSum: number; zSum: number; rSum: number; n: number }> =
    {};
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

/**
 * Flatten all tier top_categories into a single sorted list for the
 * Full Precedent Table. Each entry keeps its tier label (S/M/L/XL) and
 * is sorted by salience descending.
 */
function getAllPrecedents(
  country: CountryRisk
): Array<{ category: string; tier: string; salience: number; recipes: number }> {
  const rows: Array<{
    category: string;
    tier: string;
    salience: number;
    recipes: number;
  }> = [];
  for (const [tierKey, tierData] of Object.entries(country.tiers)) {
    for (const cat of tierData.top_categories) {
      rows.push({
        category: cat.category,
        tier: tierKey,
        salience: cat.salience_score ?? cat.z_score,
        recipes: cat.recipe_count,
      });
    }
  }
  return rows.sort((a, b) => b.salience - a.salience);
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
