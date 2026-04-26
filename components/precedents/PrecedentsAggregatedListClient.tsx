"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import { precedentSlugUrl, type RecipeAggregated } from "@/lib/recipes-aggregated";

/**
 * #464 — Recipe-aggregate precedents browser. One row per L3 category;
 * row count is the count of historical pair-instances backing the
 * recipe (post-bullet-6 dedup, per #458). Click-through goes to
 * /precedents/{slug} for the full Level-4 Recipe view.
 *
 * V1.x's per-(country, category) browser was the wrong unit per Agent D's
 * memo — those drilldowns now live on /signals/{country}/{slug}.
 */

type SortOption = "instances_desc" | "instances_asc" | "alpha_asc" | "alpha_desc";

interface EnrichedRecipe extends RecipeAggregated {
  l1Group: string;
  l1Label: string;
  l1ShortLabel: string;
  l1Color: string;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "instances_desc", label: "Evidence depth (high to low)" },
  { value: "instances_asc", label: "Evidence depth (low to high)" },
  { value: "alpha_asc", label: "Category (A-Z)" },
  { value: "alpha_desc", label: "Category (Z-A)" },
];

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function enrich(recipe: RecipeAggregated): EnrichedRecipe {
  const mapping = CATEGORY_L1_MAP[recipe.event_category];
  const l1 = mapping ? L1_GROUPS.find((g) => g.code === mapping.group) : undefined;
  return {
    ...recipe,
    l1Group: mapping?.group ?? "?",
    l1Label: mapping?.label ?? "Uncategorized",
    l1ShortLabel: l1?.shortLabel ?? "Other",
    l1Color: l1?.color ?? "#4a6280",
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

  const maxInstances = useMemo(
    () => Math.max(...enriched.map((r) => r.total_instances), 1),
    [enriched]
  );

  const [search, setSearch] = useState("");
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("instances_desc");

  const domainCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of enriched) c[r.l1Group] = (c[r.l1Group] ?? 0) + 1;
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
    return result;
  }, [enriched, search, activeDomains]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
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
      <div className="flex gap-2 flex-wrap mb-4">
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
            gridTemplateColumns: "2fr 1fr 110px 110px 90px",
            color: "var(--qgi-text-dim)",
            borderBottom: "1px solid var(--qgi-border)",
            backgroundColor: "var(--qgi-surface-2)",
          }}
        >
          <span>Category</span>
          <span>Domain</span>
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
            maxInstances={maxInstances}
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

function InstanceBar({
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

function RecipeRow({
  row,
  maxInstances,
  isLast,
}: {
  row: EnrichedRecipe;
  maxInstances: number;
  isLast: boolean;
}) {
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
        <InstanceBar
          value={row.total_instances}
          max={maxInstances}
          color={row.l1Color}
          width={180}
        />
      </div>

      {/* Desktop */}
      <div
        className="hidden md:grid items-center px-4 py-3"
        style={{ gridTemplateColumns: "2fr 1fr 110px 110px 90px" }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="text-sm font-semibold truncate group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text)" }}
          >
            {formatCategory(row.event_category)}
          </span>
          <InstanceBar
            value={row.total_instances}
            max={maxInstances}
            color={row.l1Color}
            width={120}
          />
        </div>
        <span
          className="text-[11px] tracking-wider uppercase font-medium"
          style={{ color: row.l1Color }}
        >
          {row.l1ShortLabel}
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
