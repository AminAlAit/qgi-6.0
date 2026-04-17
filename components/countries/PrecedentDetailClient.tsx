"use client";

import Link from "next/link";
import type { CountryRisk, RiskTier, CategoryScore } from "@/lib/country-risks";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import {
  CATEGORY_L1_MAP,
  L1_GROUPS,
} from "@/lib/category-taxonomy";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.15)", text: "#f87171", border: "rgba(248, 113, 113, 0.3)" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.15)", text: "#fbbf24", border: "rgba(251, 191, 36, 0.3)" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.15)", text: "#38bdf8", border: "rgba(56, 189, 248, 0.3)" },
};

const PATTERN_TIERS = ["S", "M", "L", "XL"] as const;
const TIER_LABELS: Record<string, string> = {
  S: "Short (3-8yr)",
  M: "Medium (9-20yr)",
  L: "Long (21-40yr)",
  XL: "Institutional (41+yr)",
};

const TIER_COLORS: Record<string, string> = {
  S: "#f87171",
  M: "#fbbf24",
  L: "#38bdf8",
  XL: "#a78bfa",
};

const SAMPLE_LEAD_TIME_BINS = [
  { years: "1y", count: 42, pct: 22 },
  { years: "2y", count: 58, pct: 31 },
  { years: "3y", count: 39, pct: 21 },
  { years: "4y", count: 27, pct: 14 },
  { years: "5y", count: 14, pct: 8 },
  { years: "6+", count: 7, pct: 4 },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  countryId: string;
  country: CountryRisk;
  category: string;
  generatedAt: string | null;
  version: string;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function PrecedentDetailClient({
  countryId,
  country,
  category,
  generatedAt,
  version,
}: Props) {
  const tierStyle = TIER_STYLES[country.overall_risk_tier];
  const catLabel = formatCategory(category);

  // L1 taxonomy lookup
  const l1Mapping = CATEGORY_L1_MAP[category];
  const l1Group = l1Mapping
    ? L1_GROUPS.find((g) => g.code === l1Mapping.group)
    : undefined;
  const l1Eyebrow = l1Group
    ? `L1-${l1Group.code} ${l1Group.label}`
    : "Uncategorized";

  // Gather this category's data across all tiers
  const tierBreakdown = PATTERN_TIERS.map((tier) => {
    const cats = country.tiers?.[tier]?.top_categories ?? [];
    const match = cats.find((c) => c.category === category);
    return { tier, match };
  });

  const allMatches = tierBreakdown
    .map((t) => t.match)
    .filter((m): m is CategoryScore => m != null);
  const totalRecipes = allMatches.reduce((s, m) => s + m.recipe_count, 0);
  const maxSalience = Math.max(...allMatches.map((m) => m.salience_score ?? m.z_score), 0);

  const salienceColor =
    maxSalience >= 1.2 ? "#f87171" : maxSalience >= 0.5 ? "#fbbf24" : "#38bdf8";
  const signalLabel =
    maxSalience >= 1.2 ? "high-density" : maxSalience >= 0.5 ? "elevated" : "baseline";

  const activeTierCount = allMatches.length;
  const lastEventYear = allMatches.reduce<number | null>((best, m) => {
    if (m.last_event_year == null) return best;
    if (best == null) return m.last_event_year;
    return m.last_event_year > best ? m.last_event_year : best;
  }, null);

  // Build tier-breakdown bar data
  const tierBarData = tierBreakdown
    .filter((t) => t.match != null)
    .map((t) => ({
      tier: t.tier,
      label: TIER_LABELS[t.tier],
      count: t.match!.recipe_count,
      salience: t.match!.salience_score ?? t.match!.z_score,
      color: TIER_COLORS[t.tier],
    }));
  const maxTierCount = Math.max(...tierBarData.map((t) => t.count), 1);

  return (
    <div
      className="min-h-screen p-6 lg:p-10"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ---- Breadcrumb ---- */}
        <div
          className="text-[11px] tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <Link
            href="/countries"
            className="transition-colors hover:text-[var(--qgi-accent)]"
          >
            Countries
          </Link>
          {" / "}
          <Link
            href={`/countries/${countryId}`}
            className="transition-colors hover:text-[var(--qgi-accent)]"
          >
            {country.name}
          </Link>
          {" / "}
          {l1Group && (
            <>
              <span>{l1Group.label}</span>
              {" / "}
            </>
          )}
          <span style={{ color: "var(--qgi-text-muted)" }}>{catLabel}</span>
        </div>

        {/* ============================================================ */}
        {/*  HERO HEADER                                                 */}
        {/* ============================================================ */}
        <section
          className="rounded-xl p-6 lg:p-8"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            {/* Left: identity */}
            <div className="flex items-center gap-4">
              <CountryFlag alpha2={country.alpha_2} size={40} />
              <div>
                <div
                  className="text-[10px] tracking-widest uppercase mb-1"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {l1Eyebrow}
                </div>
                <h1 className="text-2xl font-semibold tracking-wide">
                  {country.name.toUpperCase()}
                </h1>
                <div
                  className="text-sm mt-1"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {catLabel}
                </div>
              </div>
            </div>

            {/* Right: tier badge + salience score */}
            <div className="flex items-center gap-6">
              <span
                className="px-3 py-1.5 rounded text-[11px] tracking-widest font-semibold"
                style={{
                  backgroundColor: tierStyle.bg,
                  color: tierStyle.text,
                  border: `1px solid ${tierStyle.border}`,
                }}
              >
                {country.overall_risk_tier}
              </span>
              <div className="text-right">
                <div
                  className="font-data text-3xl font-bold"
                  style={{ color: salienceColor }}
                >
                  {maxSalience.toFixed(2)}
                </div>
                <div
                  className="text-[10px] tracking-wider"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  SALIENCE
                </div>
              </div>
            </div>
          </div>

          {/* ---- Narrative lede ---- */}
          <div
            className="mt-6 p-5 rounded-lg text-sm leading-relaxed"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              borderLeft: "3px solid var(--qgi-accent)",
              color: "var(--qgi-text)",
            }}
          >
            {generateNarativeLede(country, category, catLabel, totalRecipes, activeTierCount, maxSalience, salienceColor, signalLabel, lastEventYear)}
          </div>

          {/* ---- Actions rail ---- */}
          <div className="mt-5 flex flex-wrap gap-3">
            {["Download CSV", "Share card", "Open patterns view"].map(
              (action) => (
                <button
                  key={action}
                  className="px-4 py-2 rounded text-[11px] tracking-wider transition-colors"
                  style={{
                    backgroundColor: "var(--qgi-surface-2)",
                    color: "var(--qgi-text-muted)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  {action}
                </button>
              )
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/*  KEY METRICS ROW                                              */}
        {/* ============================================================ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Precedent Windows"
            value={totalRecipes.toLocaleString()}
            tooltip="Total number of historical analogue patterns linking this country to others in this category."
          />
          <MetricCard
            label="Peak Salience"
            value={maxSalience.toFixed(2)}
            color={salienceColor}
            tooltip="Maximum salience score across all pattern tiers. Scores above 1.2 are considered high-signal."
          />
          <MetricCard
            label="Active Tiers"
            value={`${activeTierCount} / 4`}
            tooltip="Number of pattern-length tiers (S/M/L/XL) with at least one active precedent window."
          />
          <MetricCard
            label="Last Event Year"
            value={lastEventYear?.toString() ?? "\u2014"}
            tooltip="Most recent curated event year among the top analogues for this category."
          />
        </section>

        {/* ============================================================ */}
        {/*  TOP 5 HISTORICAL ANALOGUES                                   */}
        {/* ============================================================ */}
        <AnaloguesTwinsPanel
          category={category}
          countryName={country.name}
          totalRecipes={totalRecipes}
          tierBreakdown={tierBreakdown}
        />

        {/* ============================================================ */}
        {/*  TIER BREAKDOWN BARS                                          */}
        {/* ============================================================ */}
        <section
          className="rounded-xl p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <h2
            className="text-[11px] tracking-widest uppercase font-semibold mb-5"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            PATTERN LENGTH DISTRIBUTION
            <InfoTooltip text="Distribution of pattern lengths (in years) across all precedent windows for this country/category. Short patterns (3-8yr) detect policy cycles; long patterns (21+yr) detect structural trajectories. A wide spread means the signal is robust across time horizons." />
          </h2>

          <div className="space-y-3">
            {PATTERN_TIERS.map((tier) => {
              const bar = tierBarData.find((b) => b.tier === tier);
              const color = TIER_COLORS[tier];
              const label = TIER_LABELS[tier];

              if (!bar) {
                return (
                  <div key={tier} className="flex items-center gap-4">
                    <span
                      className="w-6 text-center font-data text-xs font-bold"
                      style={{ color }}
                    >
                      {tier}
                    </span>
                    <span
                      className="w-32 text-[10px] tracking-wider"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {label}
                    </span>
                    <div
                      className="flex-1 h-5 rounded"
                      style={{ backgroundColor: "var(--qgi-surface-2)" }}
                    />
                    <span
                      className="font-data text-xs w-16 text-right"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      --
                    </span>
                    <span
                      className="font-data text-xs w-14 text-right"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      --
                    </span>
                  </div>
                );
              }

              return (
                <div key={tier} className="flex items-center gap-4">
                  <span
                    className="w-6 text-center font-data text-xs font-bold"
                    style={{ color: bar.color }}
                  >
                    {bar.tier}
                  </span>
                  <span
                    className="w-32 text-[10px] tracking-wider"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {bar.label}
                  </span>
                  <div
                    className="flex-1 h-5 rounded relative"
                    style={{ backgroundColor: "var(--qgi-surface-2)" }}
                  >
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(bar.count / maxTierCount) * 100}%`,
                        backgroundColor: bar.color,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span
                    className="font-data text-xs w-16 text-right"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {bar.count.toLocaleString()} prec.
                  </span>
                  <span
                    className="font-data text-xs w-14 text-right"
                    style={{ color: bar.color }}
                  >
                    {bar.salience.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="mt-4 text-[10px] tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Click a tier to filter the analogues panel above
          </div>
        </section>

        {/* ============================================================ */}
        {/*  LEAD-TIME DISTRIBUTION                                       */}
        {/* ============================================================ */}
        <section
          className="rounded-xl p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <div className="flex items-baseline justify-between mb-5">
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              LEAD-TIME DISTRIBUTION
              <InfoTooltip text="How many years before the actual event did the analogue pattern start flagging? Longer lead times = more advance warning, but also more false-positive risk. Currently showing sample distribution -- will use real data after pipeline pre-compute." />
            </h2>
            <span
              className="text-[11px] tracking-wider italic"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              &ldquo;How early did QGI flag?&rdquo;
            </span>
          </div>

          <div className="space-y-2">
            {SAMPLE_LEAD_TIME_BINS.map((b) => (
              <div key={b.years} className="flex items-center gap-3">
                <span
                  className="font-data text-xs w-8 text-right"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {b.years}
                </span>
                <div
                  className="flex-1 h-5 rounded relative"
                  style={{ backgroundColor: "var(--qgi-surface-2)" }}
                >
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${b.pct * 3.2}%`,
                      backgroundColor: "var(--qgi-accent)",
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span
                  className="font-data text-xs w-8 text-right"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {b.count}
                </span>
              </div>
            ))}
          </div>

          <div
            className="mt-5 text-sm leading-relaxed"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Median lead: <strong style={{ color: "var(--qgi-text)" }}>2 years</strong>.
            Of the analogue patterns,{" "}
            <strong style={{ color: "var(--qgi-text)" }}>74%</strong> led the event by
            3 years or less.
          </div>

          <div
            className="mt-3 text-[10px] tracking-wider italic"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Sample distribution -- requires pipeline pre-compute for real values
          </div>
        </section>

        {/* ============================================================ */}
        {/*  METHODOLOGY FOOTER                                           */}
        {/* ============================================================ */}
        <footer
          className="rounded-lg p-4 text-[10px] tracking-wider leading-relaxed"
          style={{
            backgroundColor: "var(--qgi-surface)",
            color: "var(--qgi-text-dim)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          {version} z-score + RRF &middot; Pattern correlation Pearson r &ge;
          0.65 &middot; &plusmn;15% event window &middot; Salience &gt; 1.2
          considered &ldquo;high-signal&rdquo; &middot; Event source:
          qgi-data/curated
          {generatedAt && (
            <>
              {" "}
              &middot; Last updated {generatedAt.slice(0, 10)}
            </>
          )}
        </footer>

        {/* ---- Evidence links ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/signals/country?country=${encodeURIComponent(country.name)}`}
            className="block rounded-lg p-4 text-center transition-colors hover:border-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <div
              className="text-xs tracking-wider uppercase mb-1"
              style={{ color: "var(--qgi-accent)" }}
            >
              View Full Precedent Evidence
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              All active signals for {country.name} with indicator details
            </div>
          </Link>
          <Link
            href={`/countries/${countryId}`}
            className="block rounded-lg p-4 text-center transition-colors hover:border-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <div
              className="text-xs tracking-wider uppercase mb-1"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Back to {country.name} Profile
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              See all risk categories for this country
            </div>
          </Link>
        </div>

        {/* ---- Honest framing ---- */}
        <p
          className="text-[10px] leading-relaxed text-center"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          QGI surfaces economically-grounded risk candidates that analysts should
          examine. Risk tiers reflect historical precedent density, not
          probability forecasts.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/* ---- Metric Card (V2 style: left-aligned, large value) ---------- */

function MetricCard({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip: string;
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
      }}
    >
      <div className="flex items-center gap-1 mb-2">
        <span
          className="text-[10px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {label}
        </span>
        <InfoTooltip text={tooltip} />
      </div>
      <div
        className="font-data text-2xl font-bold"
        style={{ color: color ?? "var(--qgi-text)" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ---- Analogues Twins Panel (placeholder with V2 card layout) ---- */

function AnaloguesTwinsPanel({
  category,
  countryName,
  totalRecipes,
  tierBreakdown,
}: {
  category: string;
  countryName: string;
  totalRecipes: number;
  tierBreakdown: { tier: string; match: CategoryScore | undefined }[];
}) {
  const activeTiers = tierBreakdown.filter((t) => t.match != null);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className="text-[11px] tracking-widest uppercase font-semibold"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          TOP 5 HISTORICAL ANALOGUES
          <InfoTooltip text="Countries whose economic trajectories most closely preceded events in this category. Each card shows a country that experienced a similar event after following a parallel indicator trajectory. Requires pipeline pre-compute for full data." />
        </h2>
        <span
          className="text-[11px] font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {totalRecipes.toLocaleString()} total precedent windows
        </span>
      </div>

      {/* 5 placeholder cards matching V2 card layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: `1px solid ${i === 0 ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
            }}
          >
            {/* Country identity placeholder */}
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full"
                style={{ backgroundColor: "var(--qgi-surface-2)" }}
              />
              <div>
                <div
                  className="text-xs font-semibold"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Analogue #{i + 1}
                </div>
                <div
                  className="text-[10px] font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  ----
                </div>
              </div>
            </div>

            {/* Sparkline placeholder */}
            <div
              className="h-10 rounded flex items-end gap-px px-1"
              style={{ backgroundColor: "var(--qgi-surface-2)" }}
            >
              {Array.from({ length: 8 }, (_, j) => (
                <div
                  key={j}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${6 + Math.sin(j * 0.8 + i) * 8}px`,
                    backgroundColor: "var(--qgi-border)",
                    opacity: 0.3,
                  }}
                />
              ))}
            </div>

            {/* Event marker placeholder */}
            <div
              className="text-[10px] text-center tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              EVENT ----
            </div>

            {/* Stats placeholders */}
            <div
              className="space-y-1 text-[11px] font-data"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              <div className="flex justify-between">
                <span>Match</span>
                <span>--</span>
              </div>
              <div className="flex justify-between">
                <span>Lead</span>
                <span>--</span>
              </div>
              <div className="flex justify-between">
                <span>Length</span>
                <span>--</span>
              </div>
              <div className="flex justify-between">
                <span>Indic.</span>
                <span>--</span>
              </div>
            </div>

            {/* Divider */}
            <div
              className="pt-2 mt-auto border-t text-center"
              style={{ borderColor: "var(--qgi-border)" }}
            >
              <span
                className="text-[10px] tracking-widest"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Pending
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pre-compute note */}
      <div
        className="mt-4 p-3 rounded-lg text-center"
        style={{
          backgroundColor: "var(--qgi-surface-2)",
          border: "1px dashed var(--qgi-border)",
        }}
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          REQUIRES PIPELINE PRE-COMPUTE
        </div>
        <p
          className="text-[10px] max-w-2xl mx-auto"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Analogue cards will populate once the pattern partner aggregation
          pipeline pre-computes the top-5 historical analogues for {countryName}{" "}
          in {formatCategory(category).toLowerCase()}.
        </p>
        {activeTiers.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {activeTiers.map(({ tier, match }) => (
              <span
                key={tier}
                className="px-3 py-1 rounded text-[10px] font-data"
                style={{
                  backgroundColor: `${TIER_COLORS[tier]}20`,
                  color: TIER_COLORS[tier],
                  border: `1px solid ${TIER_COLORS[tier]}40`,
                }}
              >
                {tier}: {match!.recipe_count.toLocaleString()} precedents
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateNarativeLede(
  country: CountryRisk,
  category: string,
  catLabel: string,
  totalRecipes: number,
  activeTierCount: number,
  maxSalience: number,
  salienceColor: string,
  signalLabel: string,
  lastEventYear: number | null,
): React.ReactElement {
  const intensity =
    maxSalience >= 1.5
      ? "strong"
      : maxSalience >= 1.0
        ? "elevated"
        : maxSalience >= 0.5
          ? "moderate"
          : "weak";

  const tierDesc =
    activeTierCount === 4
      ? "across all four pattern length tiers"
      : activeTierCount === 1
        ? "in one pattern length tier"
        : `across ${activeTierCount} pattern length tiers`;

  return (
    <>
      {country.name}&apos;s indicators show {intensity} {catLabel.toLowerCase()}{" "}
      signals with {totalRecipes.toLocaleString()} historical precedent windows{" "}
      {tierDesc}.
      {lastEventYear && (
        <>
          {" "}
          The most recent matching event in the curated database was in{" "}
          {lastEventYear}.
        </>
      )}{" "}
      QGI flags this as a{" "}
      <strong style={{ color: salienceColor }}>{signalLabel}</strong> signal.
    </>
  );
}

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
