"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { RciBadge } from "@/components/design/RciBadge";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import { precedentSlugUrl, type RecipeAggregated } from "@/lib/recipes-aggregated";
import {
  getRecipeConfidence,
  type RciTier,
  type RecipeConfidenceEntry,
} from "@/lib/recipe-confidence";

/**
 * #464 — Recipe-aggregate precedents browser. One row per L3 category;
 * row count is the count of historical pair-instances backing the
 * recipe (post-bullet-6 dedup, per #458). Click-through goes to
 * /precedents/{slug} for the full Level-4 Recipe view.
 *
 * V1.x's per-(country, category) browser was the wrong unit per Agent D's
 * memo — those drilldowns now live on /signals/{country}/{slug}.
 *
 * #481 follow-up (2026-04-27, founder direction): RCI surfaced as a
 * Confidence column + tier filter chips + new default sort. Founder
 * scans the index to triage which recipes to investigate; "should I
 * trust this recipe" needs to be answerable at-a-glance, not only on
 * the slug page. Sort by confidence is now the default; INSUFFICIENT
 * rows fall to the bottom; total_instances is the secondary tie-break.
 */

type SortOption =
  | "confidence_desc"
  | "confidence_asc"
  | "instances_desc"
  | "instances_asc"
  | "alpha_asc"
  | "alpha_desc";

interface EnrichedRecipe extends RecipeAggregated {
  l1Group: string;
  l1Label: string;
  l1ShortLabel: string;
  l1Color: string;
  // #481 follow-up: RCI fields denormalised into the row so we don't
  // re-look up per render. The full confidence entry is also carried
  // so the row's <RciBadge> gets the diagnostic tooltip without an
  // extra getRecipeConfidence() call.
  tier: RciTier;
  rci: number | null;
  confidenceEntry: RecipeConfidenceEntry;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "confidence_desc", label: "Confidence (high to low)" },
  { value: "confidence_asc", label: "Confidence (low to high)" },
  { value: "instances_desc", label: "Evidence depth (high to low)" },
  { value: "instances_asc", label: "Evidence depth (low to high)" },
  { value: "alpha_asc", label: "Category (A-Z)" },
  { value: "alpha_desc", label: "Category (Z-A)" },
];

// Tier-order map keeps GREEN at the top, INSUFFICIENT at the bottom of
// the confidence sort. This is the founder's "INSUFFICIENT rows fall
// to the bottom otherwise the page leads with grays" rule.
//
// PR #10 review follow-up: the confidence sort relies on
// `Array.prototype.sort` being stable to preserve the within-tier order
// when secondary keys (rci, total_instances) tie. Stable sort has been
// guaranteed by the spec since ECMAScript 2019 (Chrome 70+, Firefox 70+,
// Safari 12+, Node 12+) — every browser/runtime QGI supports. Documented
// here so future contributors don't reach for a sort-stability polyfill.
const TIER_ORDER: Record<RciTier, number> = {
  GREEN: 0,
  YELLOW: 1,
  RED: 2,
  INSUFFICIENT: 3,
};

// Tier filter strip — same pattern as the domain strip, but for RCI
// confidence. Order in the array is the order on screen.
const TIER_FILTERS: { tier: RciTier; label: string; color: string }[] = [
  { tier: "GREEN", label: "High", color: "#34d399" },
  { tier: "YELLOW", label: "Moderate", color: "#fbbf24" },
  { tier: "RED", label: "Low", color: "#f87171" },
  { tier: "INSUFFICIENT", label: "Insufficient", color: "#7a90a8" },
];

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function enrich(recipe: RecipeAggregated): EnrichedRecipe {
  const mapping = CATEGORY_L1_MAP[recipe.event_category];
  const l1 = mapping ? L1_GROUPS.find((g) => g.code === mapping.group) : undefined;
  const confidenceEntry = getRecipeConfidence(recipe.event_category);
  return {
    ...recipe,
    l1Group: mapping?.group ?? "?",
    l1Label: mapping?.label ?? "Uncategorized",
    l1ShortLabel: l1?.shortLabel ?? "Other",
    l1Color: l1?.color ?? "#4a6280",
    tier: confidenceEntry.tier,
    rci: confidenceEntry.rci,
    confidenceEntry,
  };
}

export function PrecedentsAggregatedListClient({
  recipes,
  generatedAt,
  pipelineVersion,
}: {
  recipes: RecipeAggregated[];
  generatedAt: string;
  pipelineVersion: string;
}) {
  const enriched = useMemo(() => recipes.map(enrich), [recipes]);

  // #568 (2026-05-02): maxInstances was only used to feed the InstanceBar
  // ratio. Bar removed, so the prop and the memo go too.

  const [search, setSearch] = useState("");
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const [activeTiers, setActiveTiers] = useState<Set<RciTier>>(new Set());
  // #481 follow-up: confidence_desc is the new default. "Should I trust
  // this recipe" beats "how much evidence backs this recipe" as the
  // first question users ask on this page (founder, 2026-04-27).
  const [sortBy, setSortBy] = useState<SortOption>("confidence_desc");

  const domainCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of enriched) c[r.l1Group] = (c[r.l1Group] ?? 0) + 1;
    return c;
  }, [enriched]);

  const tierCounts = useMemo(() => {
    const c: Record<RciTier, number> = {
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
      INSUFFICIENT: 0,
    };
    for (const r of enriched) c[r.tier] += 1;
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.event_category.toLowerCase().includes(q) ||
          formatCategory(r.event_category).toLowerCase().includes(q) ||
          r.l1Label.toLowerCase().includes(q) ||
          r.l1ShortLabel.toLowerCase().includes(q)
      );
    }
    if (activeDomains.size > 0) {
      result = result.filter((r) => activeDomains.has(r.l1Group));
    }
    if (activeTiers.size > 0) {
      result = result.filter((r) => activeTiers.has(r.tier));
    }
    return result;
  }, [enriched, search, activeDomains, activeTiers]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "confidence_desc":
        // Tier-major (GREEN above INSUFFICIENT), RCI numeric desc within
        // tier when both rows have a value, total_instances desc as the
        // final tie-break. Stable for tier-bucket grouping in the UI.
        arr.sort((a, b) => {
          const tierDelta = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
          if (tierDelta !== 0) return tierDelta;
          if (a.rci !== null && b.rci !== null && a.rci !== b.rci) {
            return b.rci - a.rci;
          }
          return b.total_instances - a.total_instances;
        });
        break;
      case "confidence_asc":
        arr.sort((a, b) => {
          const tierDelta = TIER_ORDER[b.tier] - TIER_ORDER[a.tier];
          if (tierDelta !== 0) return tierDelta;
          if (a.rci !== null && b.rci !== null && a.rci !== b.rci) {
            return a.rci - b.rci;
          }
          return a.total_instances - b.total_instances;
        });
        break;
      case "instances_desc":
        arr.sort((a, b) => b.total_instances - a.total_instances);
        break;
      case "instances_asc":
        arr.sort((a, b) => a.total_instances - b.total_instances);
        break;
      case "alpha_asc":
        arr.sort((a, b) => a.event_category.localeCompare(b.event_category));
        break;
      case "alpha_desc":
        arr.sort((a, b) => b.event_category.localeCompare(a.event_category));
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  const toggleDomain = (code: string) => {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleTier = (tier: RciTier) => {
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h1
            className="text-[11px] tracking-[0.15em] uppercase font-semibold"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Precedents
          </h1>
          <span
            className="text-[11px] font-data"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {enriched.length.toLocaleString()} recipes
            <span className="mx-2 opacity-50">|</span>v{pipelineVersion}
          </span>
        </div>
        <p className="text-xs mt-1 max-w-2xl" style={{ color: "var(--qgi-text-muted)" }}>
          One row per event category. Each row is a Level-4 Recipe — the aggregate
          fingerprint across every historical pair that produced this kind of outcome.
          Click through for the indicator fingerprint, length distribution, and
          currently-flagged countries.
        </p>
      </div>

      {/* Domain filter strip */}
      <div className="flex gap-2 flex-wrap mb-3">
        {L1_GROUPS.map((g) => {
          const active = activeDomains.has(g.code);
          const count = domainCounts[g.code] ?? 0;
          if (count === 0) return null;
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
            onClick={() => setActiveDomains(new Set())}
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

      {/* #481 follow-up: tier filter strip — quick triage for "show
          only the recipes worth trusting." Sits beneath the domain
          strip so domain + tier compose multiplicatively (intersection,
          not union). Chip count uses the unfiltered tier population so
          the strip's labels remain stable while the user is filtering.
          Within the tier axis itself, multiple active chips behave as
          OR (a row passes if its tier is in `activeTiers`).

          PR #10 review follow-up: the strip header gets an InfoTooltip
          for parity with the Confidence column header. Touch-device
          users without hover get the same explanation either way. */}
      <div
        className="flex items-center gap-2 mb-1 text-[10px] tracking-widest uppercase"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Filter by confidence
        <InfoTooltip text="How well each recipe's historical track record supports flagging countries today — combines backtest accuracy on holdout data, sample size, and indicator coverage. Tap or hover any chip to filter; multiple chips compose as OR within this strip." />
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {TIER_FILTERS.map((t) => {
          const active = activeTiers.has(t.tier);
          const count = tierCounts[t.tier];
          if (count === 0) return null;
          return (
            <button
              key={t.tier}
              onClick={() => toggleTier(t.tier)}
              className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-all"
              style={{
                backgroundColor: active ? `${t.color}18` : "transparent",
                borderColor: active ? t.color : "var(--qgi-border)",
                color: active ? t.color : "var(--qgi-text-muted)",
              }}
              title={`${t.label} confidence (${count} recipes)`}
            >
              {t.label} ({count})
            </button>
          );
        })}
        {activeTiers.size > 0 && (
          <button
            onClick={() => setActiveTiers(new Set())}
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

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search categories or domains..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded border text-sm flex-1 max-w-md outline-none transition-colors focus:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
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
        <span
          className="text-xs font-data self-center"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Showing {sorted.length.toLocaleString()} of {enriched.length.toLocaleString()}
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
        {/* Column headers (desktop) */}
        <div
          className="hidden md:grid items-center px-4 py-2.5 text-[10px] tracking-widest uppercase"
          style={{
            gridTemplateColumns: "2fr 1fr 130px 110px 110px 90px",
            color: "var(--qgi-text-dim)",
            borderBottom: "1px solid var(--qgi-border)",
            backgroundColor: "var(--qgi-surface-2)",
          }}
        >
          <span>Category</span>
          <span>Domain</span>
          <span className="flex items-center gap-1">
            Confidence
            <InfoTooltip text="How well this recipe's historical track record supports flagging countries today — combines backtest accuracy on holdout data, sample size, and indicator coverage. Hover any badge for diagnostic numbers." />
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            Instances
            <InfoTooltip text="Number of historical country-pair instances backing this recipe (post-dedup, per #458 bullet 6)." />
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            Length
            <InfoTooltip text="Canonical pattern length (median across instances), in years." />
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            Coverage
            <InfoTooltip text="OECD share of contributing pairs. Lower = more representative of the Global South." />
          </span>
        </div>

        {/* Rows */}
        {sorted.map((row, idx) => (
          <RecipeRow
            key={row.event_category}
            row={row}
            isLast={idx === sorted.length - 1}
          />
        ))}

        {sorted.length === 0 && (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            No recipes match your filters.
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-[10px] mt-4 font-data" style={{ color: "var(--qgi-text-dim)" }}>
        Generated {new Date(generatedAt).toLocaleString()} · pipeline {pipelineVersion}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

// #568 (2026-05-02): InstanceBar removed entirely. Post-V-Dem the
// value/maxInstances ratio collapsed near zero across all categories
// (one outlier dominating, rest invisible). Founder direction: remove.
// Numbers cells now carry the same instance-count info more legibly.

function RecipeRow({ row, isLast }: { row: EnrichedRecipe; isLast: boolean }) {
  const oecd = row.coverage_bias_diagnostic.oecd_share;
  // Coverage colour: low oecd = green (broad), high = amber (narrow)
  const coverageColor = oecd <= 0.2 ? "#3FBF8F" : oecd <= 0.45 ? "#fbbf24" : "#f87171";

  return (
    <Link
      href={precedentSlugUrl(row.event_category)}
      className="block transition-colors hover:bg-[var(--qgi-surface-2)] group"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${row.l1Color}`,
      }}
    >
      {/* Mobile */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text)" }}
          >
            {formatCategory(row.event_category)}
          </span>
          <span
            className="text-[9px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${row.l1Color}18`,
              color: row.l1Color,
            }}
          >
            {row.l1ShortLabel}
          </span>
          {/* #481 follow-up: confidence chip on mobile too — same
              decision-relevant signal that desktop gets via the column. */}
          <RciBadge entry={row.confidenceEntry} size="xs" />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: "var(--qgi-text-muted)" }}>
            <span className="font-data" style={{ color: "var(--qgi-text)" }}>
              {row.total_instances.toLocaleString()}
            </span>{" "}
            instances
          </span>
          <span style={{ color: "var(--qgi-text-muted)" }}>
            <span className="font-data" style={{ color: "var(--qgi-text)" }}>
              {row.canonical_length}y
            </span>{" "}
            length
          </span>
          <span style={{ color: "var(--qgi-text-muted)" }}>
            OECD{" "}
            <span className="font-data" style={{ color: coverageColor }}>
              {Math.round(oecd * 100)}%
            </span>
          </span>
        </div>
        {/* #568 (2026-05-02): InstanceBar removed. Post-V-Dem the
            value/maxInstances ratio went near-zero across all categories
            (one outlier dragging the bar's visual contrast to noise).
            Founder direction: remove rather than keep visually
            insignificant chrome. Numbers above carry the same info. */}
      </div>

      {/* Desktop */}
      <div
        className="hidden md:grid items-center px-4 py-3"
        style={{ gridTemplateColumns: "2fr 1fr 130px 110px 110px 90px" }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="text-sm font-semibold truncate group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text)" }}
          >
            {formatCategory(row.event_category)}
          </span>
          {/* #568 (2026-05-02): InstanceBar removed. Post-V-Dem the bar
              ratio went near-zero across all categories — visually noise
              without information. Numbers cell on the right carries the
              same instance count more legibly. */}
        </div>
        <span
          className="text-[11px] tracking-wider uppercase font-medium"
          style={{ color: row.l1Color }}
        >
          {row.l1ShortLabel}
        </span>
        {/* #481 follow-up: Confidence cell. Hover surfaces the
            diagnostic tooltip (Holdout AUC + 95% CI, sample size,
            MNAR flag count) without leaking the RCI numeric value
            or formula — per #482 vague-public direction. */}
        <span>
          <RciBadge entry={row.confidenceEntry} size="xs" />
        </span>
        <span
          className="text-right font-data text-base font-bold"
          style={{ color: "var(--qgi-text)" }}
        >
          {row.total_instances.toLocaleString()}
        </span>
        <span
          className="text-right font-data text-sm"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {row.canonical_length}y
        </span>
        <span className="text-right font-data text-sm" style={{ color: coverageColor }}>
          {Math.round(oecd * 100)}%
        </span>
      </div>
    </Link>
  );
}
