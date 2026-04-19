"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import type { Region } from "@/lib/regions";
import { REGIONS } from "@/lib/regions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignalCountry {
  id: string;
  name: string;
  alpha_2: string;
  salience: number;
  recipes: number;
  curated: boolean;
  region: Region | "Unknown";
}

interface Signal {
  category: string;
  countries: SignalCountry[];
  totalRecipes: number;
  avgSalience: number;
  maxSalience: number;
  l1Domain: { code: string; label: string; shortLabel: string; color: string } | null;
  tier: "CRITICAL" | "ELEVATED" | "BASELINE";
  regionalDistribution: Record<string, number>;
}

interface DomainActivation {
  code: string;
  label: string;
  shortLabel: string;
  color: string;
  signalCount: number;
  countryCount: number;
}

interface Meta {
  totalSignals: number;
  totalCountries: number;
  tierCounts: { CRITICAL: number; ELEVATED: number; BASELINE: number };
  domainActivation: DomainActivation[];
  version: string;
  generatedAt: string;
  curatedCount: number;
}

type SortBy = "severity" | "spread" | "volume";

// ---------------------------------------------------------------------------
// Tier styling
// ---------------------------------------------------------------------------

const TIER_STYLES = {
  CRITICAL: {
    color: "#f87171",
    borderWidth: 4,
    bgWash: "rgba(248,113,113,0.04)",
    dot: "#f87171",
    label: "CRITICAL",
  },
  ELEVATED: {
    color: "#fbbf24",
    borderWidth: 3,
    bgWash: "rgba(251,191,36,0.04)",
    dot: "#fbbf24",
    label: "ELEVATED",
  },
  BASELINE: {
    color: "#4a6280",
    borderWidth: 2,
    bgWash: "transparent",
    dot: "#38bdf8",
    label: "BASELINE",
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// ThreatStrip
// ---------------------------------------------------------------------------

function ThreatStrip({
  domainActivation,
  activeDomains,
  onToggleDomain,
}: {
  domainActivation: DomainActivation[];
  activeDomains: Set<string>;
  onToggleDomain: (code: string) => void;
}) {
  const totalCount = domainActivation.reduce((s, d) => s + d.countryCount, 0);
  if (totalCount === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] tracking-widest uppercase font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Domain Activation
        </span>
        <InfoTooltip text="Proportional bar showing which L1 taxonomy domains have the most active signals. Width = relative country count. Click a segment to filter." />
      </div>
      {/* Proportional bar */}
      <div
        className="flex h-10 rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        {domainActivation.map((d) => {
          const pct = (d.countryCount / totalCount) * 100;
          if (pct < 1) return null;
          const isActive = activeDomains.size === 0 || activeDomains.has(d.code);
          return (
            <button
              key={d.code}
              onClick={() => onToggleDomain(d.code)}
              className="relative flex items-center justify-center transition-opacity cursor-pointer overflow-hidden"
              style={{
                width: `${pct}%`,
                minWidth: 28,
                backgroundColor: `${d.color}${isActive ? "30" : "10"}`,
                borderRight: "1px solid var(--qgi-bg)",
                opacity: isActive ? 1 : 0.35,
              }}
              title={`${d.label}: ${d.signalCount} signals, ${d.countryCount} country activations`}
            >
              <span
                className="font-data text-[10px] font-bold tracking-wider truncate px-1"
                style={{ color: d.color }}
              >
                {d.code}
              </span>
            </button>
          );
        })}
      </div>
      {/* Domain chips below the bar */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {domainActivation.map((d) => {
          const isActive = activeDomains.size === 0 || activeDomains.has(d.code);
          return (
            <button
              key={d.code}
              onClick={() => onToggleDomain(d.code)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-data tracking-wider border transition-all cursor-pointer"
              style={{
                backgroundColor: isActive ? `${d.color}18` : "transparent",
                borderColor: isActive ? `${d.color}50` : "var(--qgi-border)",
                color: isActive ? d.color : "var(--qgi-text-dim)",
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              {d.shortLabel}
              <span style={{ color: "var(--qgi-text-dim)" }}>{d.signalCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlobalPulseBar
// ---------------------------------------------------------------------------

function GlobalPulseBar({
  meta,
  filteredCount,
  activeTier,
  onSetTier,
}: {
  meta: Meta;
  filteredCount: number;
  activeTier: string | null;
  onSetTier: (tier: string | null) => void;
}) {
  const tierEntries: Array<{ key: string; count: number; color: string; label: string }> =
    [
      {
        key: "CRITICAL",
        count: meta.tierCounts.CRITICAL,
        color: "#f87171",
        label: "CRITICAL",
      },
      {
        key: "ELEVATED",
        count: meta.tierCounts.ELEVATED,
        color: "#fbbf24",
        label: "ELEVATED",
      },
      {
        key: "BASELINE",
        count: meta.tierCounts.BASELINE,
        color: "#38bdf8",
        label: "BASELINE",
      },
    ];

  return (
    <div
      className="rounded-lg border px-4 py-3 mb-4"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Signal count */}
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1 h-6 rounded-full"
            style={{ backgroundColor: "var(--qgi-accent)" }}
          />
          <span className="text-sm font-medium">
            {filteredCount === meta.totalSignals
              ? `${meta.totalSignals} active signals`
              : `${filteredCount} of ${meta.totalSignals} signals`}
          </span>
          <span className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
            across {meta.totalCountries} countries
          </span>
        </div>

        {/* Tier buttons */}
        <div className="flex items-center gap-3">
          {tierEntries.map((t) => {
            const isActive = activeTier === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onSetTier(isActive ? null : t.key)}
                className="flex items-center gap-1.5 text-[11px] font-data tracking-wider cursor-pointer transition-opacity"
                style={{
                  color: isActive ? t.color : "var(--qgi-text-muted)",
                  opacity: activeTier && !isActive ? 0.4 : 1,
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.count} {t.label}
              </button>
            );
          })}
        </div>

        {/* Metadata */}
        <div
          className="flex items-center gap-3 ml-auto text-[10px] font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <span>Scoring: {meta.version}</span>
          <span>{meta.curatedCount} curated</span>
          <span>Updated: {formatDate(meta.generatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter / Sort Bar
// ---------------------------------------------------------------------------

function FilterSortBar({
  search,
  onSearch,
  sortBy,
  onSortBy,
  activeTier,
  onSetTier,
  activeRegion,
  onSetRegion,
  activeDomains,
  onClearDomains,
}: {
  search: string;
  onSearch: (v: string) => void;
  sortBy: SortBy;
  onSortBy: (v: SortBy) => void;
  activeTier: string | null;
  onSetTier: (v: string | null) => void;
  activeRegion: string | null;
  onSetRegion: (v: string | null) => void;
  activeDomains: Set<string>;
  onClearDomains: () => void;
}) {
  const sortOptions: Array<{ value: SortBy; label: string }> = [
    { value: "severity", label: "By Severity" },
    { value: "spread", label: "By Spread" },
    { value: "volume", label: "By Volume" },
  ];

  const hasActiveFilters = activeTier || activeRegion || activeDomains.size > 0 || search;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Search signals..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="px-3 py-1.5 rounded border text-sm flex-1 min-w-[180px] max-w-xs outline-none transition-colors focus:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        />

        {/* Tier filter */}
        <select
          value={activeTier ?? ""}
          onChange={(e) => onSetTier(e.target.value || null)}
          className="px-3 py-1.5 rounded border text-[11px] font-data tracking-wider uppercase outline-none cursor-pointer"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-muted)",
          }}
        >
          <option value="">All Tiers</option>
          <option value="CRITICAL">Critical</option>
          <option value="ELEVATED">Elevated</option>
          <option value="BASELINE">Baseline</option>
        </select>

        {/* Region filter */}
        <select
          value={activeRegion ?? ""}
          onChange={(e) => onSetRegion(e.target.value || null)}
          className="px-3 py-1.5 rounded border text-[11px] font-data tracking-wider outline-none cursor-pointer"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-muted)",
          }}
        >
          <option value="">All Regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Sort segmented control */}
        <div
          className="flex rounded border overflow-hidden ml-auto"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortBy(opt.value)}
              className="px-3 py-1.5 text-[10px] tracking-wider uppercase font-data transition-colors cursor-pointer"
              style={{
                backgroundColor:
                  sortBy === opt.value ? "var(--qgi-accent-glow)" : "transparent",
                color:
                  sortBy === opt.value ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
                borderRight: "1px solid var(--qgi-border)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className="text-[10px] font-data"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Active:
          </span>
          {activeDomains.size > 0 && (
            <FilterChip
              label={`${activeDomains.size} domain${activeDomains.size > 1 ? "s" : ""}`}
              onClear={onClearDomains}
            />
          )}
          {activeTier && (
            <FilterChip label={`Tier: ${activeTier}`} onClear={() => onSetTier(null)} />
          )}
          {activeRegion && (
            <FilterChip
              label={`Region: ${activeRegion}`}
              onClear={() => onSetRegion(null)}
            />
          )}
          {search && <FilterChip label={`"${search}"`} onClear={() => onSearch("")} />}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-data border"
      style={{
        backgroundColor: "var(--qgi-surface-2)",
        borderColor: "var(--qgi-border)",
        color: "var(--qgi-text-muted)",
      }}
    >
      {label}
      <button
        onClick={onClear}
        className="ml-0.5 hover:text-[var(--qgi-text)] cursor-pointer"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        x
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// SalienceBar
// ---------------------------------------------------------------------------

function SalienceBar({
  value,
  max,
  color,
  width = 120,
}: {
  value: number;
  max: number;
  color: string;
  width?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden"
      style={{ width, backgroundColor: `${color}15` }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalRow
// ---------------------------------------------------------------------------

function SignalRow({
  signal,
  rank,
  globalMaxSalience,
  isExpanded,
  onToggle,
  activeRegion,
}: {
  signal: Signal;
  rank: number;
  globalMaxSalience: number;
  isExpanded: boolean;
  onToggle: () => void;
  activeRegion: string | null;
}) {
  const style = TIER_STYLES[signal.tier];
  const domainColor = signal.l1Domain?.color ?? "#4a6280";
  const topCountries = signal.countries.slice(0, 6);
  const overflowCount = signal.countries.length - 6;

  // When a region filter is active, show filtered count
  const regionFilteredCountries = activeRegion
    ? signal.countries.filter((c) => c.region === activeRegion)
    : signal.countries;

  return (
    <div
      className="rounded-lg border transition-colors overflow-hidden"
      style={{
        borderColor: "var(--qgi-border)",
        borderLeftWidth: style.borderWidth,
        borderLeftColor: domainColor,
        backgroundColor: style.bgWash,
      }}
    >
      {/* Main row -- clickable */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--qgi-surface)]"
      >
        {/* Top line: rank, name, salience bar, salience value */}
        <div className="flex items-center gap-3 mb-1.5">
          {/* Rank + tier dot */}
          <div className="flex items-center gap-1.5 shrink-0 w-12">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: style.dot }}
            />
            <span className="font-data text-sm font-bold" style={{ color: style.color }}>
              #{rank}
            </span>
          </div>

          {/* Category name */}
          <span className="text-sm font-medium flex-1 truncate">
            {formatCategory(signal.category)}
          </span>

          {/* Salience bar + value */}
          <div className="flex items-center gap-2 shrink-0">
            <SalienceBar
              value={signal.maxSalience}
              max={globalMaxSalience}
              color={style.color}
              width={100}
            />
            <span
              className="font-data text-sm font-bold tabular-nums w-8 text-right"
              style={{ color: style.color }}
            >
              {signal.maxSalience.toFixed(1)}
            </span>
          </div>

          {/* Expand arrow */}
          <span
            className="text-[10px] shrink-0 transition-transform"
            style={{
              color: "var(--qgi-text-dim)",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▼
          </span>
        </div>

        {/* Second line: domain badge + stats */}
        <div className="flex items-center gap-3 pl-12">
          {/* L1 domain badge */}
          {signal.l1Domain && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-data tracking-wider uppercase"
              style={{
                backgroundColor: `${domainColor}18`,
                color: domainColor,
                border: `1px solid ${domainColor}30`,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: domainColor }}
              />
              {signal.l1Domain.shortLabel}
            </span>
          )}

          {/* Stats */}
          <span
            className="text-[10px] font-data"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {activeRegion
              ? `${regionFilteredCountries.length} of ${signal.countries.length} countries`
              : `${signal.countries.length} countries`}
          </span>
          <span
            className="text-[10px] font-data"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            ·
          </span>
          <span
            className="text-[10px] font-data"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {signal.totalRecipes.toLocaleString()} precedent windows
          </span>
          <span
            className="text-[10px] font-data"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            ·
          </span>
          <span
            className="text-[10px] font-data"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            avg {signal.avgSalience.toFixed(1)}
          </span>
        </div>

        {/* Third line: country flag strip */}
        <div className="flex items-center gap-1.5 pl-12 mt-2">
          {topCountries.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-0.5"
              title={`${c.name} (${c.salience.toFixed(1)})`}
            >
              <CountryFlag alpha2={c.alpha_2} size={12} />
              <span
                className="text-[9px] font-data"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {c.alpha_2}
              </span>
            </span>
          ))}
          {overflowCount > 0 && (
            <span
              className="text-[9px] font-data"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              +{overflowCount} more
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && <ExpandedContent signal={signal} activeRegion={activeRegion} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpandedContent (country list + regional breakdown)
// ---------------------------------------------------------------------------

function ExpandedContent({
  signal,
  activeRegion,
}: {
  signal: Signal;
  activeRegion: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const countries = activeRegion
    ? signal.countries.filter((c) => c.region === activeRegion)
    : signal.countries;
  const signalMaxSalience = signal.maxSalience;
  const displayedCountries = showAll ? countries : countries.slice(0, 10);
  const hasMore = countries.length > 10;

  const style = TIER_STYLES[signal.tier];

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: "var(--qgi-border)" }}>
      {/* Country list header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-data tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Top Countries ({countries.length})
        </span>
      </div>

      {/* Country rows */}
      <div className="space-y-0.5">
        {displayedCountries.map((country, idx) => {
          const cTier =
            country.salience >= 2.5
              ? "CRITICAL"
              : country.salience >= 1.0
                ? "ELEVATED"
                : "BASELINE";
          const cStyle = TIER_STYLES[cTier];
          return (
            <Link
              key={country.id}
              href={`/countries/${country.id}/${encodeURIComponent(signal.category)}`}
              className="flex items-center gap-3 py-1.5 px-2 rounded transition-colors hover:bg-[var(--qgi-surface-2)]"
            >
              <span
                className="text-[10px] font-data w-5 text-right shrink-0"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {idx + 1}.
              </span>
              <CountryFlag alpha2={country.alpha_2} size={14} />
              <span className="text-xs flex-1 truncate">{country.name}</span>
              {country.curated && (
                <span
                  className="text-[8px] font-data tracking-wider uppercase px-1 rounded"
                  style={{
                    backgroundColor: "var(--qgi-accent-glow)",
                    color: "var(--qgi-accent)",
                  }}
                >
                  curated
                </span>
              )}
              <span
                className="text-[9px] font-data shrink-0"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {country.region}
              </span>
              <SalienceBar
                value={country.salience}
                max={signalMaxSalience}
                color={cStyle.color}
                width={80}
              />
              <span
                className="font-data text-xs font-bold tabular-nums w-7 text-right shrink-0"
                style={{ color: cStyle.color }}
              >
                {country.salience.toFixed(1)}
              </span>
              <span
                className="text-[9px] font-data shrink-0 w-14 text-right"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {country.recipes.toLocaleString()} prec
              </span>
            </Link>
          );
        })}
      </div>

      {/* Show all toggle */}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-[10px] font-data tracking-wider uppercase cursor-pointer transition-colors"
          style={{ color: "var(--qgi-accent)" }}
        >
          Show all {countries.length} countries
        </button>
      )}
      {hasMore && showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-2 text-[10px] font-data tracking-wider uppercase cursor-pointer transition-colors"
          style={{ color: "var(--qgi-accent)" }}
        >
          Show top 10 only
        </button>
      )}

      {/* Regional breakdown */}
      {!activeRegion && Object.keys(signal.regionalDistribution).length > 0 && (
        <div className="mt-3 pt-2 border-t" style={{ borderColor: "var(--qgi-border)" }}>
          <span
            className="text-[10px] font-data tracking-widest uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Regional Breakdown
          </span>
          <div className="flex flex-wrap gap-3 mt-1">
            {Object.entries(signal.regionalDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([region, count]) => (
                <span
                  key={region}
                  className="text-[10px] font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {region}: <span className="font-bold">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SignalsBrowseClient({
  signals,
  meta,
}: {
  signals: Signal[];
  meta: Meta;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("severity");
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);

  const toggleDomain = useCallback((code: string) => {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const clearDomains = useCallback(() => {
    setActiveDomains(new Set());
  }, []);

  const filtered = useMemo(() => {
    let result = signals;

    // Domain filter
    if (activeDomains.size > 0) {
      result = result.filter((s) => s.l1Domain && activeDomains.has(s.l1Domain.code));
    }

    // Tier filter
    if (activeTier) {
      result = result.filter((s) => s.tier === activeTier);
    }

    // Region filter: keep signals that have at least one country in the selected region
    if (activeRegion) {
      result = result.filter((s) => s.countries.some((c) => c.region === activeRegion));
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => formatCategory(s.category).toLowerCase().includes(q));
    }

    // Sort
    switch (sortBy) {
      case "spread":
        result = [...result].sort((a, b) => b.countries.length - a.countries.length);
        break;
      case "volume":
        result = [...result].sort((a, b) => b.totalRecipes - a.totalRecipes);
        break;
      default:
        result = [...result].sort((a, b) => b.maxSalience - a.maxSalience);
    }

    return result;
  }, [signals, search, sortBy, activeDomains, activeTier, activeRegion]);

  const globalMaxSalience = useMemo(
    () => Math.max(...signals.map((s) => s.maxSalience), 1),
    [signals]
  );

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Page header */}
      <div className="mb-5">
        <h1
          className="text-xs tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Signals
        </h1>
        <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
          Early-warning radar. Active risk archetypes ranked by salience, grouped by
          taxonomy domain.
        </p>
      </div>

      {/* ThreatStrip */}
      <ThreatStrip
        domainActivation={meta.domainActivation}
        activeDomains={activeDomains}
        onToggleDomain={toggleDomain}
      />

      {/* GlobalPulseBar */}
      <GlobalPulseBar
        meta={meta}
        filteredCount={filtered.length}
        activeTier={activeTier}
        onSetTier={setActiveTier}
      />

      {/* Filter / Sort Bar */}
      <FilterSortBar
        search={search}
        onSearch={setSearch}
        sortBy={sortBy}
        onSortBy={setSortBy}
        activeTier={activeTier}
        onSetTier={setActiveTier}
        activeRegion={activeRegion}
        onSetRegion={setActiveRegion}
        activeDomains={activeDomains}
        onClearDomains={clearDomains}
      />

      {/* Signal List */}
      <div className="space-y-2">
        {filtered.map((signal, idx) => (
          <SignalRow
            key={signal.category}
            signal={signal}
            rank={idx + 1}
            globalMaxSalience={globalMaxSalience}
            isExpanded={expandedSignal === signal.category}
            onToggle={() =>
              setExpandedSignal(
                expandedSignal === signal.category ? null : signal.category
              )
            }
            activeRegion={activeRegion}
          />
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div
          className="text-center py-16 text-sm"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          No signals match your filters.
        </div>
      )}
    </div>
  );
}
