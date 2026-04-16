"use client";

import Link from "next/link";
import type { CountryRisk, RiskTier, CategoryScore } from "@/lib/country-risks";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

const PATTERN_TIERS = ["S", "M", "L", "XL"] as const;
const TIER_LABELS: Record<string, string> = {
  S: "Short-term (3–8 years)",
  M: "Medium-term (9–20 years)",
  L: "Long-term (21–40 years)",
  XL: "Institutional (41+ years)",
};

const TIER_COLORS: Record<string, string> = {
  S: "#f87171",
  M: "#fbbf24",
  L: "#38bdf8",
  XL: "#a78bfa",
};

interface Props {
  countryId: string;
  country: CountryRisk;
  category: string;
  generatedAt: string | null;
  version: string;
}

export function PrecedentDetailClient({
  countryId,
  country,
  category,
  generatedAt,
  version,
}: Props) {
  const style = TIER_STYLES[country.overall_risk_tier];
  const catLabel = formatCategory(category);

  // Gather this category's data across all tiers
  const tierBreakdown = PATTERN_TIERS.map((tier) => {
    const cats = country.tiers?.[tier]?.top_categories ?? [];
    const match = cats.find((c) => c.category === category);
    return { tier, match };
  });

  // Overall stats for this category
  const allMatches = tierBreakdown
    .map((t) => t.match)
    .filter((m): m is CategoryScore => m != null);
  const totalRecipes = allMatches.reduce((s, m) => s + m.recipe_count, 0);
  const avgSalience =
    allMatches.length > 0
      ? allMatches.reduce((s, m) => s + (m.salience_score ?? m.z_score), 0) / allMatches.length
      : 0;
  const maxSalience = Math.max(...allMatches.map((m) => m.salience_score ?? m.z_score), 0);

  const salienceColor =
    maxSalience >= 1.2 ? "#f87171" : maxSalience >= 0.5 ? "#fbbf24" : "#38bdf8";

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: "var(--qgi-text-dim)" }}>
        <Link
          href="/countries"
          className="tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
        >
          Countries
        </Link>
        <span>/</span>
        <Link
          href={`/countries/${countryId}`}
          className="tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
        >
          {country.name}
        </Link>
        <span>/</span>
        <span style={{ color: "var(--qgi-text-muted)" }}>{catLabel}</span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <CountryFlag alpha2={country.alpha_2} size={32} />
            <h1 className="text-2xl font-semibold">{country.name}</h1>
            <span
              className="text-[10px] tracking-widest font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: style.bg,
                color: style.text,
                border: `1px solid ${style.border}40`,
              }}
            >
              {country.overall_risk_tier}
            </span>
          </div>
          <h2
            className="text-lg font-medium"
            style={{ color: salienceColor }}
          >
            {catLabel}
          </h2>
        </div>
        <div
          className="text-right text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <div>Scoring: {version}</div>
          {generatedAt && <div>Updated: {generatedAt.slice(0, 10)}</div>}
        </div>
      </div>

      {/* ─── Plain-English Summary ──────────────────────────────── */}
      <div
        className="rounded-lg border-l-2 pl-4 py-3 mb-6"
        style={{
          borderColor: salienceColor,
          backgroundColor: `${salienceColor}15`,
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {generatePrecedentSummary(country, category, totalRecipes, allMatches)}
        </p>
      </div>

      {/* ─── Key Metrics — #10: (i) tooltips ──────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard
          value={totalRecipes.toLocaleString()}
          label="Precedent Windows"
          note="Historical trajectory matches"
          tooltip="Count of historical pattern windows in QGI's database where another country's trajectory in this category preceded a similar event. Higher = more historical grounding for the current signal."
        />
        <MetricCard
          value={maxSalience.toFixed(2)}
          label="Peak Salience"
          note={maxSalience >= 1.2 ? "High signal" : maxSalience >= 0.5 ? "Moderate signal" : "Weak signal"}
          color={salienceColor}
          tooltip="Highest salience score among all matched precedents. Combines statistical signal strength (z-score), event consequence (drama tier), and rank-fusion across categories. Range typically 0-3."
        />
        <MetricCard
          value={allMatches.length.toString()}
          label="Active Tiers"
          note={`of 4 pattern length tiers`}
          tooltip="Which pattern-length tiers (S=3-8 yr, M=9-20 yr, L=21-40 yr, XL=41+ yr) have at least one precedent for this country/category. More active tiers = signal robust across multiple time horizons."
        />
        <MetricCard
          value={allMatches[0]?.last_event_year?.toString() ?? "\u2014"}
          label="Last Event Year"
          note="Most recent matching event"
          tooltip="Year of the most recent verified event in this category for this country. Helps gauge whether the signal is grounded in recent history (high recency weight) vs distant past (decayed weight)."
        />
      </div>

      {/* ─── Per-Tier Breakdown ─────────────────────────────────── */}
      <section
        className="rounded-lg border p-6 mb-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h3
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Signal by Pattern Length Tier
        </h3>
        <p
          className="text-xs mb-4 leading-relaxed"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Different pattern lengths capture different dynamics. Short patterns (3–8 years)
          detect policy cycles and fiscal crises. Long patterns (21+ years) detect
          structural and institutional trajectories.
        </p>
        <div className="space-y-3">
          {tierBreakdown.map(({ tier, match }) => (
            <TierRow key={tier} tier={tier} match={match} />
          ))}
        </div>
      </section>

      {/* ─── What This Means ────────────────────────────────────── */}
      <section
        className="rounded-lg border p-6 mb-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h3
          className="text-xs tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          What This Means
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          QGI found {totalRecipes.toLocaleString()} historical cases where other countries&apos;
          economic indicators followed a trajectory that subsequently led to a{" "}
          <strong style={{ color: "var(--qgi-text)" }}>{catLabel.toLowerCase()}</strong> event.{" "}
          {country.name}&apos;s current indicator trajectory matches these historical patterns.
        </p>
        <p
          className="text-sm leading-relaxed mt-3"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          This does not mean {country.name} will experience {catLabel.toLowerCase()}.
          It means the economic conditions that historically preceded such events in other
          countries are present in {country.name}&apos;s current data. Analysts should
          examine the underlying evidence and apply domain expertise.
        </p>
      </section>

      {/* ─── Evidence Links ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link
          href={`/signals/country?country=${encodeURIComponent(country.name)}`}
          className="block rounded-lg border p-4 text-center transition-colors hover:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
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
          className="block rounded-lg border p-4 text-center transition-colors hover:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
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

      {/* ─── Honest framing ─────────────────────────────────────── */}
      <p
        className="text-[10px] leading-relaxed text-center"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        QGI surfaces economically-grounded risk candidates that analysts should
        examine. Risk tiers reflect historical precedent density, not probability forecasts.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierRow({ tier, match }: { tier: string; match: CategoryScore | undefined }) {
  const color = TIER_COLORS[tier];
  const label = TIER_LABELS[tier];

  if (!match) {
    return (
      <div className="flex items-center gap-4">
        <div
          className="w-6 text-center text-xs font-bold"
          style={{ color }}
        >
          {tier}
        </div>
        <div className="flex-1">
          <div className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            {label}
          </div>
        </div>
        <div className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
          No signal
        </div>
      </div>
    );
  }

  const salience = match.salience_score ?? match.z_score;
  const barWidth = Math.max(Math.min((salience / 3) * 100, 100), 3);

  return (
    <div className="flex items-center gap-4">
      <div
        className="w-6 text-center text-xs font-bold"
        style={{ color }}
      >
        {tier}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs" style={{ color: "var(--qgi-text)" }}>
            {label}
          </div>
          <div className="font-data text-[10px]" style={{ color: "var(--qgi-text-muted)" }}>
            {match.recipe_count.toLocaleString()} precedents &middot; salience={salience.toFixed(2)}
          </div>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--qgi-surface-2)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${barWidth}%`,
              backgroundColor: `${color}90`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  value,
  label,
  note,
  color,
  tooltip,
}: {
  value: string;
  label: string;
  note: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div
      className="rounded-lg border p-3 text-center"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div
        className="font-data text-xl font-bold"
        style={{ color: color ?? "var(--qgi-accent)" }}
      >
        {value}
      </div>
      <div className="text-xs font-medium mt-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
        {note}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePrecedentSummary(
  country: CountryRisk,
  category: string,
  totalRecipes: number,
  matches: CategoryScore[]
): string {
  const catLabel = formatCategory(category);
  const maxSalience = Math.max(...matches.map((m) => m.salience_score ?? m.z_score), 0);

  const intensity =
    maxSalience >= 1.5
      ? "strong"
      : maxSalience >= 1.0
        ? "elevated"
        : maxSalience >= 0.5
          ? "moderate"
          : "weak";

  const tiersActive = matches.length;
  const tierDesc =
    tiersActive === 4
      ? "across all four pattern length tiers (short, medium, long, and institutional)"
      : tiersActive === 1
        ? "in one pattern length tier"
        : `across ${tiersActive} pattern length tiers`;

  let summary = `${country.name} shows ${intensity} signals for ${catLabel.toLowerCase()}. `;
  summary += `${totalRecipes.toLocaleString()} historical precedent windows were identified ${tierDesc}. `;
  summary += `This means ${country.name}'s economic indicators are following trajectories that, in other countries, preceded ${catLabel.toLowerCase()} events.`;

  if (matches[0]?.last_event_year) {
    summary += ` The most recent matching event in the curated database was in ${matches[0].last_event_year}.`;
  }

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
