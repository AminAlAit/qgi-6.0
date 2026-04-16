"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CountryRisk, RiskTier } from "@/lib/country-risks";
import { CountryFlag } from "@/components/design/CountryFlag";

interface CountryEntry {
  id: string;
  name: string;
  alpha_2: string;
  curated: boolean;
  overall_risk_tier: RiskTier;
  tiers: CountryRisk["tiers"];
}

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

const TIER_FILTERS: RiskTier[] = ["HIGH", "MODERATE", "INDICATIVE"];

export function CountriesClient({ countries }: { countries: CountryEntry[] }) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<RiskTier | "ALL">("ALL");

  const filtered = useMemo(() => {
    let result = countries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.alpha_2.toLowerCase().includes(q)
      );
    }
    if (tierFilter !== "ALL") {
      result = result.filter((c) => c.overall_risk_tier === tierFilter);
    }
    return result;
  }, [countries, search, tierFilter]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: countries.length };
    for (const c of countries) {
      counts[c.overall_risk_tier] = (counts[c.overall_risk_tier] ?? 0) + 1;
    }
    return counts;
  }, [countries]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xs tracking-widest uppercase mb-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Country Intelligence Browser
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {countries.length}&nbsp;countries analyzed &middot; Risk tiers based
            on historical precedent matching
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <input
          type="text"
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded border text-sm flex-1 max-w-xs outline-none transition-colors focus:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        />

        {/* Tier filter chips */}
        <div className="flex gap-2">
          <FilterChip
            label={`All (${tierCounts.ALL ?? 0})`}
            active={tierFilter === "ALL"}
            onClick={() => setTierFilter("ALL")}
          />
          {TIER_FILTERS.map((tier) => (
            <FilterChip
              key={tier}
              label={`${tier} (${tierCounts[tier] ?? 0})`}
              active={tierFilter === tier}
              onClick={() => setTierFilter(tier)}
              color={TIER_STYLES[tier].text}
            />
          ))}
        </div>
      </div>

      {/* Country Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((country) => (
          <CountryCard key={country.id} country={country} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          No countries match your search.
        </div>
      )}
    </div>
  );
}

function CountryCard({ country }: { country: CountryEntry }) {
  const router = useRouter();
  const style = TIER_STYLES[country.overall_risk_tier];

  // Get top category from S-tier (shortest patterns, most actionable)
  const topCats = country.tiers?.S?.top_categories ?? [];
  const topCat = topCats[0];

  // Card area navigates to precedent detail (country + category); the country
  // name still navigates to the country profile. Two destinations from one card
  // means we can't use nested <a> (invalid HTML / hydration error). Use a div
  // with role="link" + onClick for the card, and a real <Link> for the name.
  const cardHref = topCat
    ? `/countries/${country.id}/${encodeURIComponent(topCat.category)}`
    : `/countries/${country.id}`;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(cardHref)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(cardHref);
        }
      }}
      className="block rounded-lg border p-4 transition-all cursor-pointer hover:border-[var(--qgi-accent)] hover:bg-[var(--qgi-surface-2)]"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <CountryFlag alpha2={country.alpha_2} size={20} />
          <Link
            href={`/countries/${country.id}`}
            className="text-sm font-medium truncate hover:text-[var(--qgi-accent)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {country.name}
          </Link>
        </div>
        <span
          className="text-[9px] tracking-widest font-semibold px-1.5 py-0.5 rounded shrink-0"
          style={{
            backgroundColor: style.bg,
            color: style.text,
            border: `1px solid ${style.border}30`,
          }}
        >
          {country.overall_risk_tier}
        </span>
      </div>

      {topCat ? (
        <>
          <div
            className="text-xs truncate mb-1"
            style={{ color: "var(--qgi-text)" }}
          >
            {formatCategory(topCat.category)}
          </div>
          <div
            className="font-data text-[11px]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {topCat.recipe_count} precedent windows &middot; salience={topCat.salience_score?.toFixed(1) ?? topCat.z_score.toFixed(1)}
          </div>
        </>
      ) : (
        <div
          className="text-xs"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          No scored categories
        </div>
      )}

      {country.curated && (
        <div
          className="mt-2 text-[9px] tracking-wider uppercase"
          style={{ color: "var(--qgi-success)" }}
        >
          Verified events
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors"
      style={{
        backgroundColor: active
          ? color
            ? `${color}20`
            : "var(--qgi-accent-glow)"
          : "transparent",
        borderColor: active
          ? color ?? "var(--qgi-accent)"
          : "var(--qgi-border)",
        color: active ? color ?? "var(--qgi-accent)" : "var(--qgi-text-muted)",
      }}
    >
      {label}
    </button>
  );
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
