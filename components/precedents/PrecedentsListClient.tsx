"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function salienceColor(score: number): string {
  if (score >= 1.2) return "#f87171"; // red
  if (score >= 0.5) return "#fbbf24"; // amber
  return "#38bdf8"; // blue
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PrecedentsListClient({ rows }: { rows: PrecedentRow[] }) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<RiskTier | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("salience_desc");
  const [page, setPage] = useState(1);

  // Top 10 most common categories
  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat]) => cat);
  }, [rows]);

  // Tier counts (over total dataset, not filtered)
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: rows.length };
    for (const r of rows) {
      counts[r.riskTier] = (counts[r.riskTier] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  // Filter
  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.countryName.toLowerCase().includes(q) ||
          formatCategory(r.category).toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }
    if (tierFilter !== "ALL") {
      result = result.filter((r) => r.riskTier === tierFilter);
    }
    if (categoryFilter) {
      result = result.filter((r) => r.category === categoryFilter);
    }
    return result;
  }, [rows, search, tierFilter, categoryFilter]);

  // Sort
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Reset page when filters change
  const resetPage = () => setPage(1);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-xs tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Precedents Browser
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {rows.length.toLocaleString()}&nbsp;precedent combinations &middot; S-tier pattern windows &middot; V1.8.1 scoring
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Row 1: Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search country or category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className="px-4 py-2 rounded border text-sm flex-1 max-w-sm outline-none transition-colors focus:border-[var(--qgi-accent)]"
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

        {/* Row 2: Tier chips */}
        <div className="flex gap-2 flex-wrap">
          <FilterChip
            label={`All (${tierCounts.ALL ?? 0})`}
            active={tierFilter === "ALL"}
            onClick={() => {
              setTierFilter("ALL");
              resetPage();
            }}
          />
          {(["HIGH", "MODERATE", "INDICATIVE"] as RiskTier[]).map((tier) => (
            <FilterChip
              key={tier}
              label={`${tier} (${tierCounts[tier] ?? 0})`}
              active={tierFilter === tier}
              onClick={() => {
                setTierFilter(tier);
                resetPage();
              }}
              color={TIER_STYLES[tier].text}
            />
          ))}
        </div>

        {/* Row 3: Category chips */}
        <div className="flex gap-2 flex-wrap items-center">
          <span
            className="text-[10px] tracking-wider uppercase mr-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Category:
          </span>
          <FilterChip
            label="All"
            active={categoryFilter === null}
            onClick={() => {
              setCategoryFilter(null);
              resetPage();
            }}
          />
          {topCategories.map((cat) => (
            <FilterChip
              key={cat}
              label={formatCategory(cat)}
              active={categoryFilter === cat}
              onClick={() => {
                setCategoryFilter(categoryFilter === cat ? null : cat);
                resetPage();
              }}
            />
          ))}
        </div>
      </div>

      {/* Results count */}
      <div
        className="text-xs mb-4 flex items-center justify-between"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <span>
          Showing {((safePage - 1) * PAGE_SIZE) + 1}
          &ndash;
          {Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}
          {categoryFilter && (
            <span> &middot; {formatCategory(categoryFilter)}</span>
          )}
        </span>
        <span>
          Page {safePage} of {totalPages}
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Table header */}
        <div
          className="hidden md:grid items-center px-4 py-2.5 text-[10px] tracking-widest uppercase"
          style={{
            gridTemplateColumns: "2fr 2fr 100px 110px 80px 70px",
            color: "var(--qgi-text-dim)",
            borderBottom: "1px solid var(--qgi-border)",
            backgroundColor: "var(--qgi-surface-2)",
          }}
        >
          <span>Country</span>
          <span>Category</span>
          <span className="text-right">Salience</span>
          <span className="text-right">Recipes</span>
          <span className="text-right">Last Event</span>
          <span className="text-center">Tier</span>
        </div>

        {/* Table rows */}
        {paginated.map((row, idx) => {
          const tierStyle = TIER_STYLES[(row.riskTier as RiskTier)] ?? TIER_STYLES.INDICATIVE;
          const salColor = salienceColor(row.salienceScore);
          const isLast = idx === paginated.length - 1;

          return (
            <Link
              key={`${row.countryId}-${row.category}`}
              href={`/countries/${row.countryId}/${row.category}`}
              className="grid items-center px-4 py-3 transition-colors hover:bg-[var(--qgi-surface-2)] group"
              style={{
                gridTemplateColumns: "1fr",
                borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
              }}
            >
              {/* Mobile: stacked layout */}
              <div className="md:hidden flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <CountryFlag alpha2={row.alpha2} size={18} />
                  <span
                    className="text-sm font-semibold group-hover:text-[var(--qgi-accent)] transition-colors"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {row.countryName}
                  </span>
                  <span
                    className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: tierStyle.bg,
                      color: tierStyle.text,
                      border: `1px solid ${tierStyle.border}30`,
                    }}
                  >
                    {TIER_SHORT[(row.riskTier as RiskTier)] ?? "IND"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                  <span>{formatCategory(row.category)}</span>
                  <span className="font-data" style={{ color: salColor }}>
                    {row.salienceScore.toFixed(3)}
                  </span>
                  <span className="font-data">{row.recipeCount.toLocaleString()} prec.</span>
                  {row.lastEventYear && (
                    <span className="font-data">{row.lastEventYear}</span>
                  )}
                </div>
              </div>

              {/* Desktop: grid row */}
              <div
                className="hidden md:grid items-center"
                style={{
                  gridTemplateColumns: "2fr 2fr 100px 110px 80px 70px",
                }}
              >
                {/* Country */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <CountryFlag alpha2={row.alpha2} size={18} />
                  <span
                    className="text-sm truncate group-hover:text-[var(--qgi-accent)] transition-colors"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {row.countryName}
                  </span>
                </div>

                {/* Category */}
                <span
                  className="text-xs truncate"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {formatCategory(row.category)}
                </span>

                {/* Salience */}
                <span
                  className="text-right font-data text-sm font-semibold"
                  style={{ color: salColor }}
                >
                  {row.salienceScore.toFixed(3)}
                </span>

                {/* Recipe count */}
                <span
                  className="text-right font-data text-xs"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {row.recipeCount.toLocaleString()} prec.
                </span>

                {/* Last event year */}
                <span
                  className="text-right font-data text-xs"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {row.lastEventYear ?? "\u2014"}
                </span>

                {/* Tier badge */}
                <div className="flex justify-center">
                  <span
                    className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: tierStyle.bg,
                      color: tierStyle.text,
                      border: `1px solid ${tierStyle.border}30`,
                    }}
                  >
                    {TIER_SHORT[(row.riskTier as RiskTier)] ?? "IND"}
                  </span>
                </div>
              </div>
            </Link>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
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

          {/* Page numbers */}
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
                  color:
                    p === safePage ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

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
// Page number generation (shows first, last, current +/- 2, with ellipses)
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

  // Insert ellipses (-1) for gaps
  const result: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) {
      result.push(-1);
    }
    result.push(pages[i]);
  }
  return result;
}
