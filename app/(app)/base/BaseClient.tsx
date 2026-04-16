"use client";

/**
 * BASE — QGI command center.
 *
 * Replaces the legacy /dashboard view (#248). Goals:
 *  - Top selection in the sidebar (it's where users should land first).
 *  - "Sample of everything" — one panel per other section, plus a small
 *    methodology footprint block.
 *  - No scatter plot ("so what?" feedback from owner).
 *  - Re-uses the existing Index Catalogue + Sector Rose components, since
 *    those are still useful in this context as a methodology footprint.
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CountryFlag } from "@/components/design/CountryFlag";
import { IndexCatalogue } from "@/components/dashboard/IndexCatalogue";
import type { IndexEntry, PatternRow } from "@/lib/types";
import type { CountryRisksData, RiskTier } from "@/lib/country-risks";

const SectorRose = dynamic(
  () => import("@/components/charts/SectorRose").then((m) => m.SectorRose),
  { ssr: false }
);

interface Props {
  risks: CountryRisksData | null;
  indexes: IndexEntry[];
  topPairs: PatternRow[];
  totalUniquePairs: number;
}

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

export function BaseClient({ risks, indexes, topPairs, totalUniquePairs }: Props) {
  const router = useRouter();
  const [activeSector, setActiveSector] = useState<string | null>(null);

  // ── Derive hero metrics ─────────────────────────────────────────
  const stats = useMemo(() => {
    if (!risks) {
      return {
        total: 0,
        curated: 0,
        high: 0,
        moderate: 0,
        indicative: 0,
        version: "—",
        generatedAt: null as string | null,
      };
    }
    const counts = { HIGH: 0, MODERATE: 0, INDICATIVE: 0 } as Record<RiskTier, number>;
    for (const c of Object.values(risks.countries)) {
      counts[c.overall_risk_tier] = (counts[c.overall_risk_tier] ?? 0) + 1;
    }
    return {
      total: risks.total_countries ?? Object.keys(risks.countries).length,
      curated: risks.curated_country_count ?? 0,
      high: counts.HIGH,
      moderate: counts.MODERATE,
      indicative: counts.INDICATIVE,
      version: risks.version ?? "—",
      generatedAt: risks.generated_at ?? null,
    };
  }, [risks]);

  // ── Top 5 high-risk countries by max-salience-in-S-tier ─────────
  const topCountries = useMemo(() => {
    if (!risks) return [];
    const rows: Array<{
      id: string;
      name: string;
      alpha_2: string;
      tier: RiskTier;
      topCategory: string | null;
      topSalience: number;
      curated: boolean;
    }> = [];
    for (const [id, country] of Object.entries(risks.countries)) {
      if (country.overall_risk_tier !== "HIGH") continue;
      const cats = country.tiers?.S?.top_categories ?? [];
      const top = cats[0];
      const salience = top
        ? top.salience_score ?? top.z_score ?? 0
        : 0;
      rows.push({
        id,
        name: country.name,
        alpha_2: country.alpha_2,
        tier: country.overall_risk_tier,
        topCategory: top?.category ?? null,
        topSalience: salience,
        curated: country.curated,
      });
    }
    return rows
      .sort((a, b) => b.topSalience - a.topSalience)
      .slice(0, 6);
  }, [risks]);

  // ── Top 5 dominant signals (categories) by total recipe count ───
  const topSignals = useMemo(() => {
    if (!risks) return [];
    const map: Record<
      string,
      { category: string; recipes: number; countries: number; topCountry: string }
    > = {};
    for (const country of Object.values(risks.countries)) {
      const cats = country.tiers?.S?.top_categories ?? [];
      for (const cat of cats) {
        if (!map[cat.category]) {
          map[cat.category] = {
            category: cat.category,
            recipes: 0,
            countries: 0,
            topCountry: country.name,
          };
        }
        map[cat.category].recipes += cat.recipe_count;
        map[cat.category].countries += 1;
      }
    }
    return Object.values(map)
      .sort((a, b) => b.recipes - a.recipes)
      .slice(0, 6);
  }, [risks]);

  // ── Sector counts for SectorRose (re-used from old dashboard) ───
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const idx of indexes) {
      counts[idx.sector] = (counts[idx.sector] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [indexes]);

  function navigateToPair(p: PatternRow) {
    const qs = new URLSearchParams({
      country_a: p.country_a_id ?? p.country_a,
      country_b: p.country_b_id ?? p.country_b,
      length: String(p.pattern_length),
      start_a: String(p.start_year_a),
      start_b: String(p.start_year_b),
    });
    router.push(`/patterns?${qs}`);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Hero strip ────────────────────────────────────────────── */}
      <div
        className="px-6 py-5 border-b shrink-0"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <h1
              className="text-[10px] tracking-[0.3em] uppercase mb-1"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Base &middot; QGI Command Center
            </h1>
            <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
              A glance at top-risk countries, dominant signals, top pattern
              pairs, and the data footprint &mdash; one click from any deeper view.
            </p>
          </div>
          <div className="text-right text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
            <div>
              Scoring <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>{stats.version}</span>
            </div>
            {stats.generatedAt && (
              <div>
                Updated <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>{stats.generatedAt.slice(0, 10)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Counts strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Countries" value={stats.total.toLocaleString()} sub={`${stats.curated} curated`} />
          <Stat label="Indicators" value={indexes.length.toLocaleString()} sub="across providers" />
          <Stat label="Pattern pairs" value={totalUniquePairs.toLocaleString()} sub="deduped, top 1000" />
          <Stat
            label="High-risk"
            value={stats.high.toLocaleString()}
            sub={`${stats.moderate} moderate · ${stats.indicative} indicative`}
            color="#f87171"
          />
        </div>
      </div>

      {/* ── 3-column "Intelligence at a Glance" ───────────────────── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-px shrink-0"
        style={{ backgroundColor: "var(--qgi-border)" }}
      >
        {/* Top Countries */}
        <Section
          title="Top High-Risk Countries"
          subtitle="By S-tier (3-8 yr) salience"
          href="/countries"
          hrefLabel="All countries →"
        >
          {topCountries.length === 0 ? (
            <Empty msg="No country risk data" />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
              {topCountries.map((c) => {
                const style = TIER_STYLES[c.tier];
                return (
                  <li key={c.id}>
                    <Link
                      href={`/countries/${c.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--qgi-surface-2)]"
                    >
                      <CountryFlag alpha2={c.alpha_2} size={16} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs font-medium truncate"
                          style={{ color: "var(--qgi-text)" }}
                        >
                          {c.name}
                        </div>
                        {c.topCategory && (
                          <div
                            className="text-[10px] truncate"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            {formatCategory(c.topCategory)}
                          </div>
                        )}
                      </div>
                      <span
                        className="text-[9px] tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}30`,
                        }}
                      >
                        {c.topSalience.toFixed(2)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Top Signals */}
        <Section
          title="Dominant Signals"
          subtitle="Categories by precedent density"
          href="/signals-browse"
          hrefLabel="All signals →"
        >
          {topSignals.length === 0 ? (
            <Empty msg="No signals data" />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
              {topSignals.map((s) => (
                <li key={s.category}>
                  <Link
                    href={`/signals-browse?category=${encodeURIComponent(s.category)}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--qgi-surface-2)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--qgi-text)" }}
                      >
                        {formatCategory(s.category)}
                      </div>
                      <div
                        className="text-[10px]"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        {s.countries} {s.countries === 1 ? "country" : "countries"}
                      </div>
                    </div>
                    <span
                      className="font-data text-[10px] shrink-0"
                      style={{ color: "var(--qgi-amber)" }}
                    >
                      {s.recipes.toLocaleString()} prec.
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Top Pattern Pairs */}
        <Section
          title="Top Pattern Pairs"
          subtitle="Deduped: best window per pair"
          href="/patterns/ranking"
          hrefLabel="Full ranking →"
        >
          {topPairs.length === 0 ? (
            <Empty msg="Pattern data unavailable" />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
              {topPairs.slice(0, 6).map((p, i) => (
                <li key={`${p.country_a}-${p.country_b}-${i}`}>
                  <button
                    onClick={() => navigateToPair(p)}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--qgi-surface-2)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--qgi-text)" }}
                      >
                        <span style={{ color: "var(--qgi-country-a)" }}>{p.country_a}</span>
                        <span className="mx-1.5" style={{ color: "var(--qgi-text-dim)" }}>→</span>
                        <span style={{ color: "var(--qgi-country-b)" }}>{p.country_b}</span>
                      </div>
                      <div
                        className="text-[10px]"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        {p.pattern_length}-yr window &middot; corr {(p.avg_correlation * 100).toFixed(0)}%
                      </div>
                    </div>
                    <span
                      className="font-data text-[10px] font-semibold shrink-0"
                      style={{ color: "var(--qgi-amber)" }}
                    >
                      PPS {p.pattern_power_score.toFixed(0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── Methodology footprint ─────────────────────────────────── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-px flex-1 min-h-0"
        style={{ backgroundColor: "var(--qgi-border)" }}
      >
        {/* Index catalogue (2/3 width) */}
        <div
          className="lg:col-span-2 flex flex-col min-h-0"
          style={{ backgroundColor: "var(--qgi-bg)" }}
        >
          <div
            className="text-[9px] tracking-[0.25em] uppercase px-4 py-2.5 border-b shrink-0 flex items-center justify-between"
            style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
          >
            <div>
              Indicator Catalogue
              {activeSector && (
                <span style={{ color: "var(--qgi-accent)" }}>
                  {" "}— {activeSector}
                  <button
                    onClick={() => setActiveSector(null)}
                    className="ml-2 text-[9px]"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    ✕ clear
                  </button>
                </span>
              )}
            </div>
            <Link
              href="/methodology#data-sources"
              className="text-[9px] tracking-wider transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Methodology →
            </Link>
          </div>
          <div className="flex-1 overflow-hidden">
            <IndexCatalogue indexes={indexes} activeSector={activeSector} />
          </div>
        </div>

        {/* Sector rose (1/3 width) */}
        <div
          className="flex flex-col min-h-0"
          style={{ backgroundColor: "var(--qgi-bg)" }}
        >
          <div
            className="text-[9px] tracking-[0.25em] uppercase px-4 py-2.5 border-b shrink-0"
            style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
          >
            Indicators by Sector
          </div>
          <div className="flex-1">
            <SectorRose
              data={sectorCounts}
              activeSector={activeSector}
              onSectorClick={setActiveSector}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div>
      <div
        className="text-[9px] tracking-[0.2em] uppercase mb-0.5"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
      <div
        className="font-data text-xl font-semibold"
        style={{ color: color ?? "var(--qgi-accent)" }}
      >
        {value}
      </div>
      <div className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
        {sub}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ backgroundColor: "var(--qgi-bg)" }}>
      <div
        className="px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <div className="flex items-baseline justify-between">
          <div
            className="text-[9px] tracking-[0.25em] uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {title}
          </div>
          <Link
            href={href}
            className="text-[9px] tracking-wider transition-colors hover:text-[var(--qgi-accent)]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {hrefLabel}
          </Link>
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
          {subtitle}
        </div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div
      className="flex items-center justify-center py-10 text-[10px] tracking-wider"
      style={{ color: "var(--qgi-text-dim)" }}
    >
      {msg}
    </div>
  );
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
