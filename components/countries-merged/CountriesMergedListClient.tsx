"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CountryFlag } from "@/components/design/CountryFlag";
import { countrySlug } from "@/lib/slug";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import type { CountryRisk, RiskTier } from "@/lib/country-risks.schema";
import { WATCH_COUNTRIES } from "@/components/countries-merged/mockWatchCountries";

/**
 * Merged Countries list shell — Build PR #1 of 5 (A3 Family 2 merger brief).
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 2 — Countries section)
 *
 * Scope of PR #1:
 *   - H1 + 1-line metric strip with live counts (Ingrid voice, brief verbatim)
 *   - Lloyd's-style methodology disclosure banner (sticky)
 *   - "What this doesn't mean" 3-bullet callout (Ingrid, brief verbatim)
 *   - Filter strip: search + tier buttons + curated-only toggle
 *   - 3-col sortable table: COUNTRY / TIER / TOP CATEGORY
 *     (7-col expansion with MOCK chips lands in PR #2)
 *
 * Deferred to PR #2: "5 countries to watch" Lloyd's banner; Domain
 * sparkbar column; ML coverage column (n/13 + methodology pill); Trend
 * 6q sparkline column; Updated column. All MOCK-chipped per Sipho.
 *
 * Deferred to PR #3: detail page /countries-merged/[iso] with 2-col 3:2
 * layout, 8-row L1 small-multiples table, ML recipe coverage matrix.
 *
 * Deferred to PR #4: ARIA, mobile rules, loading/empty states, structural
 * peers section, events density-strip, inline country-name links carried
 * from Precedents PR #4.5.
 */

// ---------------------------------------------------------------------------
// Tier display
// ---------------------------------------------------------------------------

const TIER_META: Record<
  RiskTier,
  { label: string; color: string; bg: string; border: string; tooltip: string }
> = {
  HIGH: {
    label: "HIGH",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.35)",
    tooltip:
      "Top 20% of 156 scored countries. Composite of 71 risk-category z-scores, aggregated via max(L1) per V1.9.1 methodology. Reflects structural conditions visible in indicator data — relative position, not predictive forecast.",
  },
  MODERATE: {
    label: "MODERATE",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
    tooltip:
      "Middle band (next 30% after HIGH). At least one L1 risk dimension elevated relative to global norms. Warrants monitoring; does not indicate acute risk across the board.",
  },
  INDICATIVE: {
    label: "INDICATIVE",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
    border: "rgba(56,189,248,0.35)",
    tooltip:
      "Background level (bottom 50%). Categories scored and tracked; no single dimension currently elevated enough to move composite above MODERATE. Tier is the most stable rung.",
  },
};

const TIER_ORDER: Record<RiskTier, number> = { HIGH: 0, MODERATE: 1, INDICATIVE: 2 };

// ---------------------------------------------------------------------------
// Top category extraction (highest-salience across all tiers)
// ---------------------------------------------------------------------------

function topCategoryLabel(country: CountryRisk): string {
  let best = { label: "—", score: -Infinity };
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories.slice(0, 3)) {
      const score = cat.salience_score ?? cat.z_score ?? -Infinity;
      if (score > best.score) best = { label: cat.category, score };
    }
  }
  // Slug → "Title Case" for display.
  return best.label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Row shape (PR #2: extended to 7 cols with Domain sparkbar + 3 MOCK fields)
// ---------------------------------------------------------------------------

interface CountryRow {
  id: string;
  name: string;
  alpha_2: string;
  curated: boolean;
  tier: RiskTier;
  top_category: string;
  slug: string;
  /** PR #2: 8-cell L1 domain profile. Boolean-coded for sparkbar — cell is
   *  filled when the country has ≥1 top_category mapping to that L1 group.
   *  Index 0..7 corresponds to L1_GROUPS A..H. REAL data (computed from
   *  country.tiers); no MOCK chip needed on this column. */
  domain_profile: boolean[];
  /** PR #2 MOCK: ML coverage out of 13 validated recipes. Deterministic
   *  per-country seeding (sums char codes of id) so SSR matches CSR.
   *  Upgrades to real when per-country AHI bake ships (qgi-ml #648 sibling). */
  ml_coverage: number;
  /** PR #2 MOCK: 6-quarter trend snapshot as relative deltas (negative =
   *  improving). Deterministic seed. Upgrades to real when per-quarter
   *  score history bake ships. */
  trend_6q: number[];
  /** PR #2 MOCK: last-updated date for the country's data row.
   *  Deterministic per-country (YYYY-MM-DD format). */
  updated: string;
}

// PR #2 — deterministic seeded RNG so MOCK values are stable between SSR
// and CSR (avoids hydration mismatch on dates / sparklines).
function seededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = Math.imul(16807, h) | 0;
    return (h >>> 0) / 0xffffffff;
  };
}

/** PR #2 — build the 8-cell L1 domain profile from country.tiers. REAL
 *  data; sparkbar cell is filled if the country has ≥1 top_category whose
 *  CATEGORY_L1_MAP entry resolves to that L1 group. */
function buildDomainProfile(country: CountryRisk): boolean[] {
  const hit: Record<string, boolean> = {};
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      const mapping = CATEGORY_L1_MAP[cat.category];
      if (mapping) hit[mapping.group] = true;
    }
  }
  return L1_GROUPS.map((g) => Boolean(hit[g.code]));
}

function buildRow(c: { id: string } & CountryRisk): CountryRow | null {
  const slug = countrySlug(c.name);
  if (!slug) return null;
  // MOCK seeds use the country id so the same row gets identical values
  // across re-renders + SSR ↔ CSR. Replace these blocks when real bakes ship.
  const rngMl = seededRng(`ml:${c.id}`);
  const ml_coverage = Math.floor(rngMl() * 14); // 0..13 inclusive
  const rngTrend = seededRng(`trend:${c.id}`);
  const trend_6q = Array.from({ length: 6 }, () => Math.round((rngTrend() - 0.5) * 40));
  // Deterministic MOCK date — fully seeded (no Date.now() reference so SSR
  // and CSR produce identical strings, avoiding hydration mismatches).
  // Range: 2024-01-01 .. 2026-12-31 (1095 days). Upgrades to real when the
  // pipeline ships per-country last-recomputed timestamps.
  const rngUpd = seededRng(`upd:${c.id}`);
  const dayOffset = Math.floor(rngUpd() * 1095);
  const base = new Date("2024-01-01T00:00:00Z").getTime();
  const updated = new Date(base + dayOffset * 86400000).toISOString().slice(0, 10);
  return {
    id: c.id,
    name: c.name,
    alpha_2: c.alpha_2,
    curated: c.curated,
    tier: c.overall_risk_tier as RiskTier,
    top_category: topCategoryLabel(c),
    slug,
    domain_profile: buildDomainProfile(c),
    ml_coverage,
    trend_6q,
    updated,
  };
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortColumn = "name" | "tier" | "top_category";
type SortDir = "asc" | "desc";

function sortRows(rows: CountryRow[], col: SortColumn, dir: SortDir): CountryRow[] {
  const mul = dir === "asc" ? 1 : -1;
  const arr = [...rows];
  switch (col) {
    case "name":
      arr.sort((a, b) => mul * a.name.localeCompare(b.name));
      break;
    case "tier":
      arr.sort((a, b) => mul * (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]));
      break;
    case "top_category":
      arr.sort((a, b) => mul * a.top_category.localeCompare(b.top_category));
      break;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CountriesMergedListClient({
  countries,
  tierCounts,
}: {
  countries: Array<{ id: string } & CountryRisk>;
  tierCounts: Record<RiskTier, number>;
}) {
  // Unified row array — built once.
  const rows = useMemo(
    () => countries.map(buildRow).filter((r): r is CountryRow => r !== null),
    [countries]
  );

  // Filter + sort state
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"ALL" | RiskTier>("ALL");
  const [curatedOnly, setCuratedOnly] = useState(false);
  const [sortCol, setSortCol] = useState<SortColumn>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.alpha_2.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (tierFilter !== "ALL" && r.tier !== tierFilter) return false;
      if (curatedOnly && !r.curated) return false;
      return true;
    });
  }, [rows, search, tierFilter, curatedOnly]);

  const sorted = useMemo(
    () => sortRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir]
  );

  const totalCount = rows.length;
  const visibleCount = sorted.length;

  return (
    <div className="p-6 lg:p-8">
      {/* ============== Header ============== */}
      <div className="mb-5">
        <div
          className="text-[10px] tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Merged preview · cutover pending sign-off
        </div>
        <h1
          className="text-2xl font-semibold leading-snug"
          style={{ color: "var(--qgi-text)" }}
        >
          {/* Brief Ingrid verbatim (Family 2 §"Header"). */}
          {totalCount.toLocaleString()} countries, scored across 71 risk dimensions.
        </h1>
        <p
          className="text-xs mt-2 font-data tabular-nums"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {totalCount.toLocaleString()} countries · 71 dimensions ·{" "}
          <span style={{ color: TIER_META.HIGH.color }}>{tierCounts.HIGH} HIGH</span> ·{" "}
          <span style={{ color: TIER_META.MODERATE.color }}>
            {tierCounts.MODERATE} MODERATE
          </span>{" "}
          ·{" "}
          <span style={{ color: TIER_META.INDICATIVE.color }}>
            {tierCounts.INDICATIVE} INDICATIVE
          </span>
        </p>
      </div>

      {/* ============== Lloyd's methodology disclosure banner ============== */}
      <LloydsBanner />

      {/* ============== "What this doesn't mean" callout ============== */}
      <WhatThisDoesntMean />

      {/* ============== Filter strip ============== */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center flex-wrap">
        {/* Tier chip group — single-select radio pattern */}
        <div
          role="radiogroup"
          aria-label="Filter by tier"
          className="flex items-center gap-1.5"
        >
          <span
            className="text-[9px] tracking-widest uppercase mr-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Tier
          </span>
          {(["ALL", "HIGH", "MODERATE", "INDICATIVE"] as const).map((t) => {
            const active = tierFilter === t;
            const meta = t !== "ALL" ? TIER_META[t] : null;
            return (
              <button
                key={t}
                role="radio"
                aria-checked={active}
                onClick={() => setTierFilter(t)}
                className="px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase font-data font-semibold transition-all"
                style={{
                  backgroundColor: active && meta ? meta.bg : "transparent",
                  color: active && meta ? meta.color : "var(--qgi-text-muted)",
                  border: `1px solid ${
                    active && meta
                      ? meta.border
                      : active
                        ? "var(--qgi-accent)"
                        : "var(--qgi-border)"
                  }`,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded border text-sm flex-1 max-w-md outline-none transition-colors focus:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        />

        {/* Curated-only toggle */}
        <label
          className="flex items-center gap-2 text-[10px] tracking-wider cursor-pointer"
          style={{ color: "var(--qgi-text-muted)" }}
          title="Show only countries with a curated event history"
        >
          <input
            type="checkbox"
            checked={curatedOnly}
            onChange={(e) => setCuratedOnly(e.target.checked)}
          />
          Curated only
        </label>

        {/* Sort */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span
            className="text-[9px] tracking-widest uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Sort
          </span>
          <select
            value={sortCol}
            onChange={(e) => setSortCol(e.target.value as SortColumn)}
            className="px-3 py-2 rounded border text-xs outline-none cursor-pointer"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-muted)",
            }}
          >
            <option value="tier">Tier</option>
            <option value="name">Country (A→Z)</option>
            <option value="top_category">Top category</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="px-2 py-2 rounded border text-[10px] tracking-wider font-data"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-muted)",
              minWidth: 36,
            }}
            title={
              sortDir === "asc"
                ? "Ascending — click to flip"
                : "Descending — click to flip"
            }
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <span className="text-xs font-data" style={{ color: "var(--qgi-text-dim)" }}>
          Showing {visibleCount} of {totalCount}
        </span>
      </div>

      {/* ============== "5 countries to watch" curated band (PR #2) ============== */}
      <WatchBand />

      {/* ============== Table ============== */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Column headers (desktop, 7-col per brief Family 2). MOCK chip on
            cols where the underlying data isn't piped through yet (ML cov,
            Trend, Updated). Per Sipho: per-column chips, not just footer. */}
        <div
          className="hidden md:grid items-center px-4 py-2.5 text-[10px] tracking-widest uppercase gap-x-2"
          style={{
            gridTemplateColumns: "2fr 110px 1fr 96px 88px 88px 88px",
            color: "var(--qgi-text-dim)",
            borderBottom: "1px solid var(--qgi-border)",
            backgroundColor: "var(--qgi-surface-2)",
          }}
        >
          <span>Country</span>
          <span>Tier</span>
          <span>Top category</span>
          <span title="L1 risk-domain footprint — sparkbar shows which of the 8 L1 groups have at least one top-category firing">
            Domains
          </span>
          <span title="ML coverage: number of validated recipes with measured anchor stability for this country (out of 13). Preview values until per-country anchor-stability bake ships.">
            ML cov <PreviewHeaderChip />
          </span>
          <span title="6-quarter trend snapshot. Preview values until per-quarter score-history bake ships.">
            Trend <PreviewHeaderChip />
          </span>
          <span title="Last-recomputed date. Preview values until pipeline ships per-country timestamps.">
            Updated <PreviewHeaderChip />
          </span>
        </div>

        {/* Rows */}
        {sorted.length === 0 ? (
          <EmptyState
            search={search}
            tierFilter={tierFilter}
            curatedOnly={curatedOnly}
            onClearSearch={() => setSearch("")}
            onClearTier={() => setTierFilter("ALL")}
            onClearCurated={() => setCuratedOnly(false)}
          />
        ) : (
          sorted.map((row, idx) => (
            <CountryRowComponent
              key={row.id}
              row={row}
              isLast={idx === sorted.length - 1}
            />
          ))
        )}
      </div>

      {/* ============== Footer ============== */}
      <p className="text-[10px] mt-4 font-data" style={{ color: "var(--qgi-text-dim)" }}>
        {/* Brief Family 2 footer text. */}
        Risk tiers from V1.9.1 scoring · Composite = max(L1) per Phase 3 decision · Click
        any row for the full dossier ·{" "}
        <Link
          href={"/methodology" as Route}
          className="underline underline-offset-2 hover:text-[var(--qgi-text-muted)]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Methodology →
        </Link>
        {" · "}
        <span style={{ color: "var(--qgi-text-muted)" }}>
          Preview shell — V1 + V2-Table + V2-Narrative remain live until founder cutover
          (PR #5).
        </span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Lloyd's-style methodology disclosure (brief Family 2 §"Lloyd's disclosure
 * banner"). Sticky at top of master list on first paint (dismissible in
 * PR #4 via localStorage). For PR #1 it just renders inline.
 */
function LloydsBanner() {
  return (
    <div
      role="note"
      aria-label="Methodology disclosure"
      className="mb-5 rounded-lg border p-4"
      style={{
        backgroundColor: "rgba(245, 158, 11, 0.06)",
        borderColor: "rgba(245, 158, 11, 0.25)",
        borderLeftWidth: 2,
        borderLeftStyle: "solid",
        borderLeftColor: "rgba(245, 158, 11, 0.6)",
        color: "var(--qgi-text-muted)",
      }}
    >
      <span
        className="font-semibold tracking-wide uppercase text-[10px] mr-2 block mb-1"
        style={{ color: "rgba(245, 158, 11, 0.95)" }}
      >
        Methodology disclosure
      </span>
      <p className="text-xs leading-relaxed max-w-[68ch]">
        Country tiers (HIGH / MODERATE / INDICATIVE) reflect composite risk z-scores from
        V1.9.1 methodology — relative position within the 156-country panel, not
        predictive forecast. Hover any tier badge for the rubric. Methodology and known
        limitations:{" "}
        <Link
          href={"/methodology" as Route}
          className="underline underline-offset-2"
          style={{ color: "var(--qgi-text)" }}
        >
          /methodology
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * "What this doesn't mean" callout (Ingrid voice, brief Family 2 §"Voice
 * templates"). 3 bullets, ≤15 words each, present-tense declarative.
 *
 * Brief uses {country} / {bad-outcome} / {year} placeholders — on the
 * master list (not per-country page) we use the universal panel-scope
 * phrasing instead. Per-country phrasing lands inside the detail page
 * in PR #3.
 */
function WhatThisDoesntMean() {
  return (
    <div
      role="note"
      aria-label="What tier does not mean"
      className="mb-5 rounded-lg p-4 max-w-[68ch]"
      style={{
        backgroundColor: "rgba(251, 191, 36, 0.08)",
        border: "1px solid rgba(251, 191, 36, 0.30)",
      }}
    >
      <div
        className="text-[10px] tracking-widest uppercase font-semibold mb-2"
        style={{ color: "rgba(251, 191, 36, 0.95)" }}
      >
        What this doesn&apos;t mean
      </div>
      <ul
        className="text-xs leading-relaxed list-disc pl-5 space-y-1"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        <li>Tier is not a forecast that any country will collapse in the next year.</li>
        <li>Tier is not a comment on the legitimacy of any government.</li>
        <li>
          Tier is a structural-pattern reading; outcomes depend on choices not yet made.
        </li>
      </ul>
    </div>
  );
}

function EmptyState({
  search,
  tierFilter,
  curatedOnly,
  onClearSearch,
  onClearTier,
  onClearCurated,
}: {
  search: string;
  tierFilter: "ALL" | RiskTier;
  curatedOnly: boolean;
  onClearSearch: () => void;
  onClearTier: () => void;
  onClearCurated: () => void;
}) {
  const parts: string[] = [];
  if (tierFilter !== "ALL") parts.push(`tier=${tierFilter}`);
  if (curatedOnly) parts.push("curated=only");
  if (search) parts.push(`search="${search}"`);
  const summary = parts.length > 0 ? parts.join(" · ") : "(no filters)";
  return (
    <div className="text-center py-12 px-4" role="status" aria-live="polite">
      <p className="text-sm mb-2" style={{ color: "var(--qgi-text)" }}>
        No countries match these filters.
      </p>
      <p className="text-[11px] font-data mb-4" style={{ color: "var(--qgi-text-dim)" }}>
        Active: {summary}
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {tierFilter !== "ALL" && (
          <button
            type="button"
            onClick={onClearTier}
            className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
          >
            Clear tier filter →
          </button>
        )}
        {curatedOnly && (
          <button
            type="button"
            onClick={onClearCurated}
            className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
          >
            Show all countries →
          </button>
        )}
        {search && (
          <button
            type="button"
            onClick={onClearSearch}
            className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
          >
            Clear search →
          </button>
        )}
      </div>
    </div>
  );
}

function CountryRowComponent({ row, isLast }: { row: CountryRow; isLast: boolean }) {
  const meta = TIER_META[row.tier];
  // PR #3 shipped /countries-merged/[iso] split-render — route rows there.
  // V1 /countries/[iso] remains reachable until PR #5 cutover via the
  // sidebar V1 entry + the detail-page footer cross-link.
  const detailHref = `/countries-merged/${row.slug}` as Route;
  return (
    <Link
      href={detailHref}
      className="block transition-colors hover:bg-[var(--qgi-surface-2)] group"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${meta.color}`,
      }}
    >
      {/* Mobile (compressed) */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <CountryFlag alpha2={row.alpha_2} size={14} />
          <span
            className="text-sm font-medium group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text)" }}
          >
            {row.name}
          </span>
          {!row.curated && (
            <span
              className="font-data text-[9px] tracking-wide uppercase px-1 rounded"
              style={{
                color: "var(--qgi-text-dim)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              uncurated
            </span>
          )}
          <TierPill meta={meta} />
        </div>
        <div className="text-[11px] truncate" style={{ color: "var(--qgi-text-muted)" }}>
          {row.top_category}
        </div>
      </div>

      {/* Desktop 7-col grid (PR #2 expansion). gridTemplateColumns mirrors
          the table-header spec — verbatim so the columns align across the
          fixed header strip and per-row strips. */}
      <div
        className="hidden md:grid items-center px-4 py-3 gap-x-2"
        style={{
          gridTemplateColumns: "2fr 110px 1fr 96px 88px 88px 88px",
        }}
      >
        {/* COUNTRY */}
        <div className="flex items-center gap-2 min-w-0">
          <CountryFlag alpha2={row.alpha_2} size={14} />
          <span
            className="text-sm truncate group-hover:text-[var(--qgi-accent)] transition-colors font-medium"
            style={{ color: "var(--qgi-text)" }}
          >
            {row.name}
          </span>
          {!row.curated && (
            <span
              className="font-data text-[9px] tracking-wide uppercase px-1 py-0.5 rounded shrink-0"
              style={{
                color: "var(--qgi-text-dim)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              uncurated
            </span>
          )}
        </div>

        {/* TIER */}
        <span>
          <TierPill meta={meta} />
        </span>

        {/* TOP CATEGORY */}
        <span className="text-[12px] truncate" style={{ color: "var(--qgi-text-muted)" }}>
          {row.top_category}
        </span>

        {/* DOMAINS — 8-cell L1 sparkbar (REAL data) */}
        <DomainSparkbar profile={row.domain_profile} />

        {/* ML COV — n/13 + 4-dot meter (MOCK) */}
        <MlCoverageCell count={row.ml_coverage} />

        {/* TREND 6Q — micro-sparkline (MOCK) */}
        <TrendSparkline data={row.trend_6q} />

        {/* UPDATED — date (MOCK) */}
        <span
          className="text-[10px] font-data tabular-nums whitespace-nowrap text-right"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {row.updated}
        </span>
      </div>
    </Link>
  );
}

function TierPill({ meta }: { meta: (typeof TIER_META)[RiskTier] }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-data font-semibold tracking-wider uppercase"
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
      }}
      title={meta.tooltip}
    >
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PR #2 sub-components — sparkbar, ML cov meter, trend sparkline, MOCK chip
// ---------------------------------------------------------------------------

/**
 * 8-cell L1 domain footprint sparkbar. Each cell maps to an L1 group (A..H)
 * and is filled when the country has at least one top_category in that
 * group. REAL data (not MOCK) — derived from country.tiers at row build.
 */
function DomainSparkbar({ profile }: { profile: boolean[] }) {
  return (
    <div
      className="flex items-center gap-[2px]"
      role="img"
      aria-label="L1 domain footprint"
      title={L1_GROUPS.map((g, i) => `${g.shortLabel}${profile[i] ? "" : " ·"}`).join(
        " / "
      )}
    >
      {L1_GROUPS.map((g, i) => (
        <span
          key={g.code}
          style={{
            display: "inline-block",
            width: 8,
            height: 14,
            borderRadius: 1,
            backgroundColor: profile[i] ? g.color : "var(--qgi-border)",
            opacity: profile[i] ? 0.9 : 0.35,
          }}
        />
      ))}
    </div>
  );
}

/**
 * ML coverage meter — `N / 13` text + 4-dot density meter. MOCK for PR #2
 * (deterministic seed per country); upgrades to real when the per-country
 * AHI bake ships.
 *
 * The dot meter is rounded to a 0-4 bucket so the column scans visually
 * at table density. Brief uses n/13 denominator with methodology pill on
 * hover — we mirror that in the title attribute.
 */
function MlCoverageCell({ count }: { count: number }) {
  // Bucket 0-13 into 0-4 dots so the visual density scales without 13
  // separate dots per row (illegible at table density).
  const buckets = Math.max(0, Math.min(4, Math.round((count / 13) * 4)));
  return (
    <span
      className="inline-flex items-center gap-1 justify-end"
      title={`${count} of 13 validated recipes measured. Denominator: validated set v2026-05-11. Pipeline: ml-recipe-stack.json. Preview values until per-country anchor-stability bake ships.`}
    >
      <span
        className="font-data text-[10px] tabular-nums"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {count}/13
      </span>
      <span aria-hidden="true" className="flex gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 5,
              height: 5,
              borderRadius: "50%",
              backgroundColor: i < buckets ? "#38bdf8" : "var(--qgi-border)",
              opacity: i < buckets ? 0.95 : 0.55,
            }}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Trend 6-quarter micro-sparkline. MOCK for PR #2 (deterministic seed).
 * Each value is a relative delta — negative = improving (lower risk),
 * positive = deteriorating. Path is drawn without axes (Tufte; the shape
 * is the message). Color-coded by terminal delta.
 */
function TrendSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-right">—</span>;
  const W = 56;
  const H = 14;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => (i / (data.length - 1)) * W);
  const ys = data.map((v) => H - ((v - min) / range) * H);
  const d = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const last = data[data.length - 1];
  const prev = data[data.length - 2] ?? last;
  const delta = last - prev;
  const color = delta > 3 ? "#f87171" : delta < -3 ? "#34d399" : "#94a3b8";
  return (
    <span
      className="inline-flex items-center gap-1 justify-end"
      title={`6-quarter trend (preview values). Terminal delta: ${delta > 0 ? "+" : ""}${delta}.`}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        style={{ display: "block", overflow: "visible", flexShrink: 0 }}
      >
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={1.6} fill={color} />
      </svg>
    </span>
  );
}

/**
 * Inline column-header MOCK chip per Sipho's mandate (Family 2 §"Per-column
 * MOCK tags" — REQUIRED, not footer-only). Sits inline next to the column
 * label so the trial-period state is impossible to miss.
 */
function PreviewHeaderChip() {
  return (
    <span
      className="ml-1 font-data text-[8px] tracking-widest uppercase px-1 py-0.5 rounded font-semibold"
      style={{
        color: "rgba(251, 191, 36, 0.95)",
        backgroundColor: "rgba(251, 191, 36, 0.12)",
        border: "1px solid rgba(251, 191, 36, 0.30)",
      }}
      title="Column populated with deterministic preview values until production data bake ships. See per-cell hover for provenance."
      aria-label="Preview data — provisional until production bake"
    >
      Preview
    </span>
  );
}

/**
 * "5 countries to watch this week" curated band (brief Family 2). Pinned
 * above the main table with `[Editor's pick · week of {date}]` eyebrow
 * per Sipho's mandate ("PR #4 should adopt Editor's pick label" — applied
 * here in PR #2 since the band ships with this PR).
 *
 * Mock-curated for PR #2 (Syria/Iran/Venezuela/Germany/Georgia) — full
 * editorial pipeline lands when qgi-data ships a curated weekly file.
 * Production criteria per brief: tier change this quarter OR
 * driving-category z-score moved >0.5.
 */
function WatchBand() {
  // Render the brief's locked tier-movement badge format for entries where
  // current_tier differs from previous_tier. Color flows from the current
  // tier (where the country lives now), not from the previous.
  const weekOf = "13 May 2026"; // updated weekly by editorial bake
  return (
    <section
      aria-label="5 countries to watch this week"
      className="mb-5 rounded-lg border overflow-hidden"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
        borderTopWidth: 2,
        borderTopStyle: "solid",
        borderTopColor: "rgba(56, 189, 248, 0.7)",
      }}
    >
      <header
        className="flex items-baseline gap-3 px-4 py-2.5 flex-wrap"
        style={{
          backgroundColor: "rgba(56, 189, 248, 0.06)",
          borderBottom: "1px solid var(--qgi-border)",
        }}
      >
        <span
          className="font-semibold tracking-widest uppercase text-[10px]"
          style={{ color: "rgba(56, 189, 248, 0.95)" }}
        >
          Editor&apos;s pick · week of {weekOf}
        </span>
        <h2 className="text-sm font-semibold" style={{ color: "var(--qgi-text)" }}>
          5 countries to watch
        </h2>
        <span
          className="text-[10px] font-data ml-auto"
          style={{ color: "var(--qgi-text-dim)" }}
          title="Selection criteria: tier change this quarter OR driving-category z-score moved >0.5. Hand-selected for preview; weekly editorial pipeline ships in a future bake."
        >
          Preview · hand-selected
        </span>
      </header>

      <ul className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
        {WATCH_COUNTRIES.map((c) => {
          const meta = TIER_META[c.current_tier];
          const tierMoved = c.previous_tier && c.previous_tier !== c.current_tier;
          return (
            <li key={c.slug}>
              <Link
                href={`/countries/${c.slug}` as Route}
                className="block px-4 py-3 transition-colors hover:bg-[var(--qgi-surface-2)]"
              >
                <div className="flex items-center gap-3 flex-wrap mb-1.5">
                  <CountryFlag alpha2={c.alpha_2} size={14} />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {c.display_name}
                  </span>
                  <TierPill meta={meta} />
                  {tierMoved && (
                    <span
                      className="font-data text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: meta.color,
                        backgroundColor: meta.bg,
                        border: `1px solid ${meta.border}`,
                      }}
                      title={`Tier moved from ${c.previous_tier} to ${c.current_tier}`}
                    >
                      {c.previous_tier} → {c.current_tier}
                    </span>
                  )}
                  <span
                    className="font-data text-[9px] tracking-wide uppercase ml-auto"
                    style={{ color: "var(--qgi-text-dim)" }}
                    title="ML recipes with measured anchor stability for this country (preview values)"
                  >
                    ML {c.ml_coverage}/13
                  </span>
                </div>
                <p
                  className="text-[12px] leading-relaxed mb-2 max-w-[80ch]"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {c.movement}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  {c.driving_categories.map((cat) => (
                    <span
                      key={cat}
                      className="font-data text-[9px] tracking-wide uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: "var(--qgi-text-muted)",
                        border: "1px solid var(--qgi-border)",
                        backgroundColor: "var(--qgi-surface-2)",
                      }}
                    >
                      {cat.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
