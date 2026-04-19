"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskTier = "HIGH" | "MODERATE" | "INDICATIVE";

interface PrecedentRow {
  countryId: string;
  countryName: string;
  alpha2: string;
  curated: boolean;
  riskTier: string;
  category: string;
  salienceScore: number;
  zScore: number;
  recipeCount: number;
  lastEventYear: number | null;
}

/** Enriched row with L1 taxonomy info */
interface EnrichedRow extends PrecedentRow {
  l1Group: string;
  l1Label: string;
  l1ShortLabel: string;
  l1Color: string;
}

type SortOption =
  | "salience_desc"
  | "salience_asc"
  | "recipe_desc"
  | "recipe_asc"
  | "country_asc"
  | "country_desc"
  | "category_asc"
  | "category_desc"
  | "year_desc"
  | "year_asc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

const TIER_SHORT: Record<RiskTier, string> = {
  HIGH: "HIGH",
  MODERATE: "MOD",
  INDICATIVE: "IND",
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "salience_desc", label: "Salience (high to low)" },
  { value: "salience_asc", label: "Salience (low to high)" },
  { value: "recipe_desc", label: "Recipe count (high to low)" },
  { value: "recipe_asc", label: "Recipe count (low to high)" },
  { value: "country_asc", label: "Country (A-Z)" },
  { value: "country_desc", label: "Country (Z-A)" },
  { value: "category_asc", label: "Category (A-Z)" },
  { value: "category_desc", label: "Category (Z-A)" },
  { value: "year_desc", label: "Last event (newest)" },
  { value: "year_asc", label: "Last event (oldest)" },
];

/** Salience band color */
function salienceColor(score: number): string {
  if (score >= 1.2) return "#f87171"; // red — high signal
  if (score >= 0.5) return "#fbbf24"; // amber — moderate
  return "#38bdf8"; // blue — baseline
}

/** Salience band name for screen readers */
function salienceBand(score: number): string {
  if (score >= 1.5) return "hero";
  if (score >= 0.5) return "standard";
  return "muted";
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Enrich rows with L1 taxonomy
// ---------------------------------------------------------------------------

function enrichRows(rows: PrecedentRow[]): EnrichedRow[] {
  return rows.map((r) => {
    const mapping = CATEGORY_L1_MAP[r.category];
    const l1 = mapping ? L1_GROUPS.find((g) => g.code === mapping.group) : undefined;
    return {
      ...r,
      l1Group: mapping?.group ?? "?",
      l1Label: mapping?.label ?? "Uncategorized",
      l1ShortLabel: l1?.shortLabel ?? "Other",
      l1Color: l1?.color ?? "#4a6280",
    };
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PrecedentsListClient({ rows }: { rows: PrecedentRow[] }) {
  // Enrich once
  const enriched = useMemo(() => enrichRows(rows), [rows]);

  // Aggregates
  const maxSalience = useMemo(
    () => Math.max(...enriched.map((r) => r.salienceScore), 0.01),
    [enriched]
  );

  // State
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<RiskTier | "ALL">("ALL");
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("salience_desc");
  const [page, setPage] = useState(1);

  // ── Briefing strip data ────────────────────────────────────────────
  const briefing = useMemo(() => {
    const topSalience = [...enriched].sort(
      (a, b) => b.salienceScore - a.salienceScore
    )[0];
    const topRecipes = [...enriched].sort((a, b) => b.recipeCount - a.recipeCount)[0];
    const topRecent = [...enriched]
      .filter((r) => r.lastEventYear != null)
      .sort((a, b) => (b.lastEventYear ?? 0) - (a.lastEventYear ?? 0))[0];
    return { topSalience, topRecipes, topRecent };
  }, [enriched]);

  // ── Domain counts (over full dataset) ──────────────────────────────
  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of enriched) {
      counts[r.l1Group] = (counts[r.l1Group] ?? 0) + 1;
    }
    return counts;
  }, [enriched]);

  // ── Tier counts (over full dataset) ────────────────────────────────
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: enriched.length };
    for (const r of enriched) {
      counts[r.riskTier] = (counts[r.riskTier] ?? 0) + 1;
    }
    return counts;
  }, [enriched]);

  // ── Filter pipeline ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = enriched;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.countryName.toLowerCase().includes(q) ||
          formatCategory(r.category).toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.l1Label.toLowerCase().includes(q) ||
          r.l1ShortLabel.toLowerCase().includes(q)
      );
    }

    // Tier
    if (tierFilter !== "ALL") {
      result = result.filter((r) => r.riskTier === tierFilter);
    }

    // Domain
    if (activeDomains.size > 0) {
      result = result.filter((r) => activeDomains.has(r.l1Group));
    }

    return result;
  }, [enriched, search, tierFilter, activeDomains]);

  // ── Sort ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "salience_desc":
        arr.sort((a, b) => b.salienceScore - a.salienceScore);
        break;
      case "salience_asc":
        arr.sort((a, b) => a.salienceScore - b.salienceScore);
        break;
      case "recipe_desc":
        arr.sort((a, b) => b.recipeCount - a.recipeCount);
        break;
      case "recipe_asc":
        arr.sort((a, b) => a.recipeCount - b.recipeCount);
        break;
      case "country_asc":
        arr.sort((a, b) => a.countryName.localeCompare(b.countryName));
        break;
      case "country_desc":
        arr.sort((a, b) => b.countryName.localeCompare(a.countryName));
        break;
      case "category_asc":
        arr.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case "category_desc":
        arr.sort((a, b) => b.category.localeCompare(a.category));
        break;
      case "year_desc":
        arr.sort((a, b) => (b.lastEventYear ?? 0) - (a.lastEventYear ?? 0));
        break;
      case "year_asc":
        arr.sort((a, b) => (a.lastEventYear ?? 9999) - (b.lastEventYear ?? 9999));
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  // ── Pagination ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  // Domain chip toggle
  const toggleDomain = (code: string) => {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
    resetPage();
  };

  return (
    <div className="p-6 lg:p-8">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-[11px] tracking-[0.15em] uppercase font-semibold"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Precedents Browser
          </h1>
          <span
            className="text-[11px] font-data"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {enriched.length.toLocaleString()} signals monitored
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--qgi-text-muted)" }}>
          Intelligence feed &mdash; all country-category pairs ranked by salience
        </p>
      </div>

      {/* ── Briefing strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <BriefingCard
          label="Highest Salience"
          row={briefing.topSalience}
          metric={briefing.topSalience?.salienceScore.toFixed(3) ?? "--"}
          sub={`${(briefing.topSalience?.recipeCount ?? 0).toLocaleString()} precedents`}
        />
        <BriefingCard
          label="Deepest Evidence"
          row={briefing.topRecipes}
          metric={`${(briefing.topRecipes?.recipeCount ?? 0).toLocaleString()}`}
          sub={`salience ${(briefing.topRecipes?.salienceScore ?? 0).toFixed(3)}`}
        />
        <BriefingCard
          label="Most Recent Event"
          row={briefing.topRecent}
          metric={String(briefing.topRecent?.lastEventYear ?? "--")}
          sub={`salience ${(briefing.topRecent?.salienceScore ?? 0).toFixed(3)}`}
        />
      </div>

      {/* ── L1 Domain filter strip ────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-4">
        {L1_GROUPS.map((g) => {
          const active = activeDomains.has(g.code);
          const count = domainCounts[g.code] ?? 0;
          return (
            <button
              key={g.code}
              onClick={() => toggleDomain(g.code)}
              className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-all"
              style={{
                backgroundColor: active ? `${g.color}18` : "transparent",
                borderColor: active ? g.color : "var(--qgi-border)",
                color: active ? g.color : "var(--qgi-text-muted)",
              }}
            >
              {g.shortLabel} ({count})
            </button>
          );
        })}
        {activeDomains.size > 0 && (
          <button
            onClick={() => {
              setActiveDomains(new Set());
              resetPage();
            }}
            className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors"
            style={{
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-dim)",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search country, category, or domain..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className="px-4 py-2 rounded border text-sm flex-1 max-w-md outline-none transition-colors focus:border-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          />

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortOption);
              resetPage();
            }}
            className="px-3 py-2 rounded border text-xs outline-none cursor-pointer"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-muted)",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tier segmented control */}
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            {(["ALL", "HIGH", "MODERATE", "INDICATIVE"] as const).map((tier) => {
              const active = tierFilter === tier;
              const hexColor =
                tier === "ALL" ? "#38bdf8" : TIER_STYLES[tier as RiskTier].text;
              const cssColor =
                tier === "ALL" ? "var(--qgi-accent)" : TIER_STYLES[tier as RiskTier].text;
              const count =
                tier === "ALL" ? (tierCounts.ALL ?? 0) : (tierCounts[tier] ?? 0);
              return (
                <button
                  key={tier}
                  onClick={() => {
                    setTierFilter(tier === "ALL" ? "ALL" : tier);
                    resetPage();
                  }}
                  className="px-3 py-1.5 text-[10px] tracking-wider uppercase font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? `${hexColor}15` : "transparent",
                    color: active ? cssColor : "var(--qgi-text-dim)",
                    borderRight: "1px solid var(--qgi-border)",
                  }}
                >
                  {tier === "ALL" ? "ALL" : TIER_SHORT[tier as RiskTier]}{" "}
                  <span style={{ opacity: 0.7 }}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Running count */}
          <span className="text-xs font-data" style={{ color: "var(--qgi-text-dim)" }}>
            Showing {sorted.length.toLocaleString()} of {enriched.length.toLocaleString()}
            {activeDomains.size > 0 && (
              <span>
                {" "}
                &middot;{" "}
                {[...activeDomains]
                  .map((c) => L1_GROUPS.find((g) => g.code === c)?.shortLabel ?? c)
                  .join(", ")}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ── Feed ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Column headers (desktop) */}
        <div
          className="hidden md:grid items-center px-4 py-2.5 text-[10px] tracking-widest uppercase"
          style={{
            gridTemplateColumns: "2fr 2fr 100px 110px 80px 70px",
            color: "var(--qgi-text-dim)",
            borderBottom: "1px solid var(--qgi-border)",
            backgroundColor: "var(--qgi-surface-2)",
          }}
        >
          <span className="flex items-center gap-1">Country</span>
          <span className="flex items-center gap-1">Category</span>
          <span className="text-right flex items-center justify-end gap-1">
            Salience
            <InfoTooltip text="Composite score measuring how strongly a category's statistical patterns stand out for this country. Higher = more signal." />
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            Precedents
            <InfoTooltip text="Number of historical pattern windows (indicator-pair correlations) supporting this signal." />
          </span>
          <span className="text-right">Last Event</span>
          <span className="text-center">Tier</span>
        </div>

        {/* Rows */}
        {paginated.map((raw, idx) => {
          const row = raw as EnrichedRow;
          const band = salienceBand(row.salienceScore);
          const isLast = idx === paginated.length - 1;

          if (band === "hero") {
            return (
              <HeroRow
                key={`${row.countryId}-${row.category}`}
                row={row}
                maxSalience={maxSalience}
                isLast={isLast}
              />
            );
          }
          if (band === "standard") {
            return (
              <StandardRow
                key={`${row.countryId}-${row.category}`}
                row={row}
                maxSalience={maxSalience}
                isLast={isLast}
              />
            );
          }
          return (
            <MutedRow
              key={`${row.countryId}-${row.category}`}
              row={row}
              isLast={isLast}
            />
          );
        })}

        {paginated.length === 0 && (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            No precedents match your filters.
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs font-data" style={{ color: "var(--qgi-text-dim)" }}>
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <PaginationButton
              label="First"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
            />
            <PaginationButton
              label="Prev"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
            />

            {getPageNumbers(safePage, totalPages).map((p, i) =>
              p === -1 ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 text-xs"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="px-3 py-1.5 rounded text-xs font-data border transition-colors"
                  style={{
                    backgroundColor:
                      p === safePage ? "var(--qgi-accent-glow)" : "transparent",
                    borderColor:
                      p === safePage ? "var(--qgi-accent)" : "var(--qgi-border)",
                    color: p === safePage ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
                  }}
                >
                  {p}
                </button>
              )
            )}

            <PaginationButton
              label="Next"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
            />
            <PaginationButton
              label="Last"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing card
// ---------------------------------------------------------------------------

function BriefingCard({
  label,
  row,
  metric,
  sub,
}: {
  label: string;
  row: EnrichedRow | undefined;
  metric: string;
  sub: string;
}) {
  if (!row) return null;

  const salColor = salienceColor(row.salienceScore);

  return (
    <Link
      href={`/countries/${row.countryId}/${row.category}`}
      className="rounded-lg border p-4 transition-colors hover:border-[var(--qgi-accent)] group"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
        borderLeft: `3px solid ${salColor}`,
      }}
    >
      <div
        className="text-[10px] tracking-[0.1em] uppercase mb-2 font-medium"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <CountryFlag alpha2={row.alpha2} size={16} />
        <span
          className="text-sm font-semibold truncate group-hover:text-[var(--qgi-accent)] transition-colors"
          style={{ color: "var(--qgi-text)" }}
        >
          {row.countryName}
        </span>
      </div>
      <div className="text-xs truncate mb-2" style={{ color: "var(--qgi-text-muted)" }}>
        {formatCategory(row.category)}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-data text-2xl font-bold" style={{ color: salColor }}>
          {metric}
        </span>
        <span className="font-data text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
          {sub}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Salience bar
// ---------------------------------------------------------------------------

function SalienceBar({
  value,
  max,
  color,
  width = 80,
}: {
  value: number;
  max: number;
  color: string;
  width?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div
      className="rounded-full overflow-hidden"
      style={{
        width,
        height: 3,
        backgroundColor: "var(--qgi-surface-2)",
      }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero row (salience >= 1.5)
// ---------------------------------------------------------------------------

function HeroRow({
  row,
  maxSalience,
  isLast,
}: {
  row: EnrichedRow;
  maxSalience: number;
  isLast: boolean;
}) {
  const salColor = salienceColor(row.salienceScore);
  const tierStyle = TIER_STYLES[row.riskTier as RiskTier] ?? TIER_STYLES.INDICATIVE;

  return (
    <Link
      href={`/countries/${row.countryId}/${row.category}`}
      className="block transition-colors hover:bg-[var(--qgi-surface-2)] group"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${salColor}`,
        backgroundColor: `${salColor}08`,
      }}
    >
      {/* Mobile layout */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <CountryFlag alpha2={row.alpha2} size={20} />
          <span
            className="text-sm font-semibold group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text)" }}
          >
            {row.countryName}
          </span>
          <span
            className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded ml-auto"
            style={{
              backgroundColor: tierStyle.bg,
              color: tierStyle.text,
              border: `1px solid ${tierStyle.border}30`,
            }}
          >
            {TIER_SHORT[row.riskTier as RiskTier] ?? "IND"}
          </span>
        </div>
        <div className="text-[13px]" style={{ color: "var(--qgi-text-muted)" }}>
          {formatCategory(row.category)}
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] tracking-wider uppercase font-medium"
            style={{ color: `${row.l1Color}cc` }}
          >
            {row.l1ShortLabel}
          </span>
          <span className="font-data text-base font-bold" style={{ color: salColor }}>
            {row.salienceScore.toFixed(3)}
          </span>
          <span className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
            {row.recipeCount.toLocaleString()} prec.
          </span>
          {row.lastEventYear && (
            <span className="font-data text-xs" style={{ color: "var(--qgi-text-dim)" }}>
              {row.lastEventYear}
            </span>
          )}
        </div>
        <SalienceBar
          value={row.salienceScore}
          max={maxSalience}
          color={salColor}
          width={160}
        />
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block px-4 py-3">
        {/* Line 1: Country + Tier */}
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: "2fr 2fr 100px 110px 80px 70px",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CountryFlag alpha2={row.alpha2} size={20} />
            <span
              className="text-sm font-semibold truncate group-hover:text-[var(--qgi-accent)] transition-colors"
              style={{ color: "var(--qgi-text)" }}
            >
              {row.countryName}
            </span>
          </div>
          <span
            className="text-[13px] truncate"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {formatCategory(row.category)}
          </span>
          <span
            className="text-right font-data text-base font-bold"
            style={{ color: salColor }}
          >
            {row.salienceScore.toFixed(3)}
          </span>
          <span
            className="text-right font-data text-xs"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {row.recipeCount.toLocaleString()} prec.
          </span>
          <span
            className="text-right font-data text-xs"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {row.lastEventYear ?? "\u2014"}
          </span>
          <div className="flex justify-center">
            <span
              className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded"
              style={{
                backgroundColor: tierStyle.bg,
                color: tierStyle.text,
                border: `1px solid ${tierStyle.border}30`,
              }}
            >
              {TIER_SHORT[row.riskTier as RiskTier] ?? "IND"}
            </span>
          </div>
        </div>
        {/* Line 2: L1 label + salience bar */}
        <div className="flex items-center gap-3 mt-1.5 ml-[38px]">
          <span
            className="text-[10px] tracking-wider uppercase font-medium"
            style={{ color: `${row.l1Color}cc` }}
          >
            {row.l1ShortLabel}
          </span>
          <SalienceBar
            value={row.salienceScore}
            max={maxSalience}
            color={salColor}
            width={100}
          />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Standard row (salience 0.5 -- 1.49)
// ---------------------------------------------------------------------------

function StandardRow({
  row,
  maxSalience,
  isLast,
}: {
  row: EnrichedRow;
  maxSalience: number;
  isLast: boolean;
}) {
  const salColor = salienceColor(row.salienceScore);
  const tierStyle = TIER_STYLES[row.riskTier as RiskTier] ?? TIER_STYLES.INDICATIVE;

  return (
    <Link
      href={`/countries/${row.countryId}/${row.category}`}
      className="block transition-colors hover:bg-[var(--qgi-surface-2)] group"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: `2px solid ${salColor}`,
      }}
    >
      {/* Mobile layout */}
      <div className="md:hidden px-4 py-2.5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <CountryFlag alpha2={row.alpha2} size={18} />
          <span
            className="text-[13px] font-medium group-hover:text-[var(--qgi-accent)] transition-colors truncate"
            style={{ color: "var(--qgi-text)" }}
          >
            {row.countryName}
          </span>
          <span
            className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded ml-auto"
            style={{
              backgroundColor: tierStyle.bg,
              color: tierStyle.text,
              border: `1px solid ${tierStyle.border}30`,
            }}
          >
            {TIER_SHORT[row.riskTier as RiskTier] ?? "IND"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: "var(--qgi-text-muted)" }}>
            {formatCategory(row.category)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] tracking-wider uppercase"
            style={{ color: `${row.l1Color}cc` }}
          >
            {row.l1ShortLabel}
          </span>
          <span
            className="font-data text-[13px] font-semibold"
            style={{ color: salColor }}
          >
            {row.salienceScore.toFixed(3)}
          </span>
          <span
            className="font-data text-[11px]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {row.recipeCount.toLocaleString()} prec.
          </span>
          {row.lastEventYear && (
            <span
              className="font-data text-[11px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {row.lastEventYear}
            </span>
          )}
        </div>
      </div>

      {/* Desktop layout: 2-line row */}
      <div className="hidden md:block px-4 py-2.5">
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: "2fr 2fr 100px 110px 80px 70px",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CountryFlag alpha2={row.alpha2} size={18} />
            <span
              className="text-[13px] font-medium truncate group-hover:text-[var(--qgi-accent)] transition-colors"
              style={{ color: "var(--qgi-text)" }}
            >
              {row.countryName}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs truncate" style={{ color: "var(--qgi-text-muted)" }}>
              {formatCategory(row.category)}
            </span>
          </div>
          <span
            className="text-right font-data text-[13px] font-semibold"
            style={{ color: salColor }}
          >
            {row.salienceScore.toFixed(3)}
          </span>
          <span
            className="text-right font-data text-[11px]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {row.recipeCount.toLocaleString()} prec.
          </span>
          <span
            className="text-right font-data text-[11px]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {row.lastEventYear ?? "\u2014"}
          </span>
          <div className="flex justify-center">
            <span
              className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded"
              style={{
                backgroundColor: tierStyle.bg,
                color: tierStyle.text,
                border: `1px solid ${tierStyle.border}30`,
              }}
            >
              {TIER_SHORT[row.riskTier as RiskTier] ?? "IND"}
            </span>
          </div>
        </div>
        {/* Line 2: L1 label + bar */}
        <div className="flex items-center gap-3 mt-1 ml-[36px]">
          <span
            className="text-[10px] tracking-wider uppercase"
            style={{ color: `${row.l1Color}99` }}
          >
            {row.l1ShortLabel}
          </span>
          <SalienceBar
            value={row.salienceScore}
            max={maxSalience}
            color={salColor}
            width={80}
          />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Muted row (salience < 0.5)
// ---------------------------------------------------------------------------

function MutedRow({ row, isLast }: { row: EnrichedRow; isLast: boolean }) {
  const tierStyle = TIER_STYLES[row.riskTier as RiskTier] ?? TIER_STYLES.INDICATIVE;

  return (
    <Link
      href={`/countries/${row.countryId}/${row.category}`}
      className="block transition-colors hover:bg-[var(--qgi-surface-2)] group"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: "1px solid var(--qgi-border)",
        opacity: 0.7,
      }}
    >
      {/* Mobile layout */}
      <div className="md:hidden px-4 py-2 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <CountryFlag alpha2={row.alpha2} size={16} />
          <span
            className="text-xs truncate group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {row.countryName}
          </span>
          <span className="text-[11px] truncate" style={{ color: "var(--qgi-text-dim)" }}>
            {formatCategory(row.category)}
          </span>
          <span
            className="font-data text-xs ml-auto"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {row.salienceScore.toFixed(3)}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-7">
          <span
            className="text-[9px] tracking-wider uppercase"
            style={{ color: `${row.l1Color}88` }}
          >
            {row.l1ShortLabel}
          </span>
        </div>
      </div>

      {/* Desktop layout: compact */}
      <div className="hidden md:block px-4 py-2">
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: "2fr 2fr 100px 110px 80px 70px",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CountryFlag alpha2={row.alpha2} size={16} />
            <span
              className="text-xs truncate group-hover:text-[var(--qgi-accent)] transition-colors"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              {row.countryName}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[11px] truncate"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {formatCategory(row.category)}
            </span>
          </div>
          <span
            className="text-right font-data text-xs"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {row.salienceScore.toFixed(3)}
          </span>
          <span
            className="text-right font-data text-[11px]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {row.recipeCount.toLocaleString()} prec.
          </span>
          <span
            className="text-right font-data text-[11px]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {row.lastEventYear ?? "\u2014"}
          </span>
          <div className="flex justify-center">
            <span
              className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded"
              style={{
                backgroundColor: tierStyle.bg,
                color: tierStyle.text,
                border: `1px solid ${tierStyle.border}30`,
              }}
            >
              {TIER_SHORT[row.riskTier as RiskTier] ?? "IND"}
            </span>
          </div>
        </div>
        {/* Subline: L1 label */}
        <div className="ml-[34px] mt-0.5">
          <span
            className="text-[9px] tracking-wider uppercase"
            style={{ color: `${row.l1Color}66` }}
          >
            {row.l1ShortLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Pagination button
// ---------------------------------------------------------------------------

function PaginationButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        backgroundColor: "transparent",
        borderColor: "var(--qgi-border)",
        color: disabled ? "var(--qgi-text-dim)" : "var(--qgi-text-muted)",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page number generation
// ---------------------------------------------------------------------------

function getPageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: number[] = [];
  const addPage = (p: number) => {
    if (p >= 1 && p <= total && !pages.includes(p)) pages.push(p);
  };

  addPage(1);
  addPage(2);
  for (let i = current - 1; i <= current + 1; i++) addPage(i);
  addPage(total - 1);
  addPage(total);

  pages.sort((a, b) => a - b);

  const result: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) {
      result.push(-1);
    }
    result.push(pages[i]);
  }
  return result;
}
