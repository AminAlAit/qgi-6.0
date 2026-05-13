"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import type { RecipeAggregated } from "@/lib/recipes-aggregated";
import { getRecipeConfidence, type RciTier } from "@/lib/recipe-confidence";
import type { BuyerMlRecipe } from "@/lib/buyer-view";
import { getTierTooltip } from "@/components/precedents-merged/TierPillTooltip";

/**
 * Merged Precedents shell — Build PR #1 of 5 (A3 Family 1 merger brief).
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *
 * Scope of PR #1:
 *   - Soft-partition shell: 4 ML hero rows + methodology disclosure strip
 *     + 64-recipe statistical catalogue
 *   - 7-col sortable table (CATEGORY / DOMAIN / LINEAGE / TIER / INSTANCES
 *     / LENGTH / COVERAGE) — LINEAGE before TIER per Marcus
 *   - TIER = default sort desc; zone-respecting (heroes pinned above
 *     catalogue regardless of sort column); opt-in "Mix zones" toggle
 *   - Filter strip: search + domain chips (L1) + lineage chip (ML/Stat/All)
 *     + sort column dropdown + mix-zones toggle
 *
 * Deferred to PR #2: detail page (/precedents-merged/[slug]) — hero rows
 * currently link to /precedents-v2-b/[slug] (Lloyd's banner), catalogue
 * rows link to /precedents/[slug] (V1).
 *
 * Deferred to PR #3: click-to-expand 120w mechanism cell, "What we're still
 * testing" <details> collapsible, "How to read this" preamble + lede.
 *
 * Deferred to PR #4: ARIA, mobile, loading/empty states.
 */

// ---------------------------------------------------------------------------
// Tier mapping
// ---------------------------------------------------------------------------

/** ML hero rung order (brief: STRONG > MODERATE > MARGINAL). */
const ML_TIER_RANK: Record<BuyerMlRecipe["tier"], number> = {
  STRONG: 0,
  MODERATE: 1,
  MARGINAL: 2,
};

/** RCI → Stat-catalogue tier label per the brief tier-pill tooltip table:
 *   GREEN → HIGH (Stat), YELLOW → MODERATE (Stat),
 *   RED → LOW (Stat), INSUFFICIENT → INSUFFICIENT (Stat).
 */
const RCI_TO_STAT_TIER: Record<RciTier, string> = {
  GREEN: "HIGH",
  YELLOW: "MODERATE",
  RED: "LOW",
  INSUFFICIENT: "INSUFFICIENT",
};

const STAT_TIER_RANK: Record<string, number> = {
  HIGH: 0,
  MODERATE: 1,
  LOW: 2,
  INSUFFICIENT: 3,
};

const TIER_COLORS: Record<string, string> = {
  STRONG: "#22c55e",
  // ML MODERATE + Stat MODERATE share visual treatment intentionally; the
  // method pill in the column disambiguates the rubric.
  MODERATE: "#fbbf24",
  MARGINAL: "#a3a3a3",
  HIGH: "#34d399",
  LOW: "#f87171",
  INSUFFICIENT: "#7a90a8",
};

// ---------------------------------------------------------------------------
// Row shape (unified across hero + catalogue zones)
// ---------------------------------------------------------------------------

interface MergedRow {
  /** Stable id for keys + URL construction (matches recipe_id / event_category). */
  slug: string;
  display_name: string;
  /** L1 group code "A".."H". */
  l1_group: string;
  l1_short_label: string;
  l1_color: string;
  lineage: "ML" | "STAT";
  /** Tier label as rendered in the column (e.g. "STRONG", "HIGH", "INSUFFICIENT"). */
  tier_label: string;
  /** Rank within the lineage's rubric — used for sort. Lower = stronger. */
  tier_rank: number;
  tier_color: string;
  /** Catalogue metrics (joined for hero rows; native for catalogue rows). */
  total_instances: number;
  canonical_length: number;
  oecd_share: number;
  /** PR #3: distinct country pairs — surfaced inside expanded mechanism cell + "What we're still testing" entries. */
  n_distinct_country_pairs: number;
  /** PR #3: click-to-expand 120w mechanism prose.
   *  - Hero rows: from `BuyerMlRecipe.mechanism_narrative` (buyer-cleaned).
   *  - Catalogue rows: template-synthesized from recipe metadata.
   *  Per founder #683 decision: ship now with template fallback; #683 will
   *  upgrade hero prose to hand-curated 120w per Ingrid voice template. */
  mechanism_text: string;
  /** PR #2 shipped `/precedents-merged/[slug]` split-render — both lineages now
   *  route to the merged dossier. The "View dossier →" link inside the
   *  expanded mechanism cell uses this path. */
  detail_href: Route;
}

function formatCategory(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * PR #3 — spell out small numbers (≤10) for Ingrid voice copy. Brief register
 * is Foreign Affairs-style prose — numerals look like dashboard chrome inside
 * a sentence-flow paragraph. Falls back to numeric for larger values.
 */
function spellOutSmallNumber(n: number): string {
  const words = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ];
  return n >= 0 && n <= 10 ? words[n] : n.toLocaleString();
}

/**
 * PR #3: synthesize a Stat-catalogue mechanism cell from recipe data.
 * Template fallback per brief — catalogue rows ship with auto-generated
 * prose (NOT gated by #683). #683 hand-curates hero rows; catalogue rows
 * stay templated even post-#683 unless individually promoted.
 */
function buildStatMechanismText(recipe: RecipeAggregated): string {
  const top = recipe.indicator_fingerprint
    .slice(0, 3)
    .map((i) => i.indicator_name ?? `indicator ${i.indicator_id}`)
    .filter((s) => s && s !== "indicator undefined")
    .join(", ");
  const oecd = Math.round(recipe.coverage_bias_diagnostic.oecd_share * 100);
  const coverageNote =
    oecd > 50
      ? `Coverage skews toward OECD countries (${oecd}%); interpret with caution for non-OECD contexts.`
      : `Coverage is globally representative (${oecd}% OECD).`;
  const topPart = top
    ? `The most common indicator signals are ${top}.`
    : `The indicator fingerprint is still being characterized.`;
  return (
    `A ${recipe.canonical_length}-year pattern observed across ${recipe.total_instances.toLocaleString()} ` +
    `historical instances spanning ${recipe.n_distinct_country_pairs.toLocaleString()} distinct country pairs. ` +
    `${topPart} ${coverageNote} Statistical screen-positive — not yet ML-adjudicated.`
  );
}

function buildHeroRow(
  recipe: BuyerMlRecipe,
  agg: RecipeAggregated | undefined
): MergedRow | null {
  const mapping = CATEGORY_L1_MAP[recipe.recipe_id];
  const l1 = mapping ? L1_GROUPS.find((g) => g.code === mapping.group) : undefined;
  // Hero rows joined to their aggregated entry for unified metrics. If a hero
  // recipe lacks an aggregated entry, skip it (data-integrity invariant).
  if (!agg) return null;
  return {
    slug: recipe.recipe_id,
    display_name: recipe.display_name,
    l1_group: mapping?.group ?? "?",
    l1_short_label: l1?.shortLabel ?? "Other",
    l1_color: l1?.color ?? "#4a6280",
    lineage: "ML",
    tier_label: recipe.tier,
    tier_rank: ML_TIER_RANK[recipe.tier],
    tier_color: TIER_COLORS[recipe.tier] ?? "#7a90a8",
    total_instances: agg.total_instances,
    canonical_length: agg.canonical_length,
    oecd_share: agg.coverage_bias_diagnostic.oecd_share,
    n_distinct_country_pairs: agg.n_distinct_country_pairs,
    // Hero mechanism prose comes pre-cleaned via BuyerMlRecipe transform
    // (jargon-replaced + slug-rewritten). Falls back to the excerpt if the
    // full narrative is empty in this bake.
    mechanism_text:
      recipe.mechanism_narrative || recipe.mechanism_narrative_excerpt || "",
    // PR #2 ships /precedents-merged/[slug] split-render — route both lineages
    // there. V1 + V2-A + V2-B remain reachable independently until PR #5
    // cutover.
    detail_href: `/precedents-merged/${recipe.recipe_id}` as Route,
  };
}

function buildCatalogueRow(recipe: RecipeAggregated): MergedRow {
  const mapping = CATEGORY_L1_MAP[recipe.event_category];
  const l1 = mapping ? L1_GROUPS.find((g) => g.code === mapping.group) : undefined;
  const confidence = getRecipeConfidence(recipe.event_category);
  const statTier = RCI_TO_STAT_TIER[confidence.tier];
  return {
    slug: recipe.event_category,
    display_name: formatCategory(recipe.event_category),
    l1_group: mapping?.group ?? "?",
    l1_short_label: l1?.shortLabel ?? "Other",
    l1_color: l1?.color ?? "#4a6280",
    lineage: "STAT",
    tier_label: statTier,
    tier_rank: STAT_TIER_RANK[statTier] ?? 99,
    tier_color: TIER_COLORS[statTier] ?? "#7a90a8",
    total_instances: recipe.total_instances,
    canonical_length: recipe.canonical_length,
    oecd_share: recipe.coverage_bias_diagnostic.oecd_share,
    n_distinct_country_pairs: recipe.n_distinct_country_pairs,
    mechanism_text: buildStatMechanismText(recipe),
    detail_href: `/precedents-merged/${recipe.event_category}` as Route,
  };
}

// ---------------------------------------------------------------------------
// Sort + filter state
// ---------------------------------------------------------------------------

type SortColumn = "category" | "domain" | "tier" | "instances" | "length" | "coverage";

type SortDir = "asc" | "desc";

const SORT_COLUMNS: { value: SortColumn; label: string }[] = [
  { value: "tier", label: "Tier" },
  { value: "category", label: "Category (A→Z)" },
  { value: "instances", label: "Evidence depth (Instances)" },
  { value: "length", label: "Length" },
  { value: "coverage", label: "Coverage (OECD share)" },
];

function sortRows(rows: MergedRow[], col: SortColumn, dir: SortDir): MergedRow[] {
  const arr = [...rows];
  const mul = dir === "asc" ? 1 : -1;
  switch (col) {
    case "category":
      arr.sort((a, b) => mul * a.display_name.localeCompare(b.display_name));
      break;
    case "domain":
      arr.sort((a, b) => mul * a.l1_group.localeCompare(b.l1_group));
      break;
    case "tier":
      // Lower tier_rank = stronger; desc means "strongest first" = ascending rank.
      arr.sort((a, b) => -mul * (a.tier_rank - b.tier_rank));
      break;
    case "instances":
      arr.sort((a, b) => mul * (b.total_instances - a.total_instances));
      break;
    case "length":
      arr.sort((a, b) => mul * (b.canonical_length - a.canonical_length));
      break;
    case "coverage":
      // OECD share: low = broad coverage = "best" in the user-facing sense.
      arr.sort((a, b) => -mul * (b.oecd_share - a.oecd_share));
      break;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Coverage color (low OECD = broad → green; high OECD = narrow → red)
// ---------------------------------------------------------------------------
function coverageColor(oecd: number): string {
  if (oecd <= 0.2) return "#34d399";
  if (oecd <= 0.45) return "#fbbf24";
  return "#f87171";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PrecedentsMergedListClient({
  heroRecipes,
  heroAggregatedBySlug,
  catalogue,
  generatedAt,
  pipelineVersion,
  modelVersion,
  totalLocked,
}: {
  heroRecipes: BuyerMlRecipe[];
  heroAggregatedBySlug: Record<string, RecipeAggregated>;
  catalogue: RecipeAggregated[];
  generatedAt: string;
  pipelineVersion: string;
  modelVersion: string;
  totalLocked: number;
}) {
  // Build unified row arrays once.
  const heroRows = useMemo(
    () =>
      heroRecipes
        .map((r) => buildHeroRow(r, heroAggregatedBySlug[r.recipe_id]))
        .filter((r): r is MergedRow => r !== null),
    [heroRecipes, heroAggregatedBySlug]
  );
  const catalogueRows = useMemo(() => catalogue.map(buildCatalogueRow), [catalogue]);

  // Filter + sort state
  const [search, setSearch] = useState("");
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const [lineageFilter, setLineageFilter] = useState<"ALL" | "ML" | "STAT">("ALL");
  const [sortCol, setSortCol] = useState<SortColumn>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [mixZones, setMixZones] = useState(false);
  // PR #3 — click-to-expand state. Multiple rows can be expanded simultaneously
  // (set, not single-slug) so a reader can compare two mechanism cells without
  // collapsing one to read the other.
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  // PR #3 — "How to read this" preamble dismissibility. Session-scoped (no
  // localStorage in this PR; PR #4 adds persistence).
  const [preambleDismissed, setPreambleDismissed] = useState(false);

  const toggleExpanded = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // Apply filters
  const matchesFilters = (r: MergedRow): boolean => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.display_name.toLowerCase().includes(q) &&
        !r.l1_short_label.toLowerCase().includes(q) &&
        !r.slug.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (activeDomains.size > 0 && !activeDomains.has(r.l1_group)) return false;
    if (lineageFilter !== "ALL" && r.lineage !== lineageFilter) return false;
    return true;
  };

  const filteredHero = useMemo(
    () => heroRows.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroRows, search, activeDomains, lineageFilter]
  );
  const filteredCatalogue = useMemo(
    () => catalogueRows.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogueRows, search, activeDomains, lineageFilter]
  );

  // Effective mix-zones: tier sort forces zone-respecting regardless of toggle
  // state (Sonnet-review B1 invariant — see toggle render block for rationale).
  // The toggle is disabled in the UI when sortCol === "tier"; this derived
  // value is the belt-and-braces guard so a stale `mixZones=true` state
  // (from before the user switched to tier sort) still renders correctly.
  const effectiveMixZones = mixZones && sortCol !== "tier";

  const displayHero = useMemo(
    () => (effectiveMixZones ? [] : sortRows(filteredHero, sortCol, sortDir)),
    [filteredHero, sortCol, sortDir, effectiveMixZones]
  );
  const displayCatalogue = useMemo(
    () => (effectiveMixZones ? [] : sortRows(filteredCatalogue, sortCol, sortDir)),
    [filteredCatalogue, sortCol, sortDir, effectiveMixZones]
  );
  const displayMixed = useMemo(
    () =>
      effectiveMixZones
        ? sortRows([...filteredHero, ...filteredCatalogue], sortCol, sortDir)
        : [],
    [filteredHero, filteredCatalogue, sortCol, sortDir, effectiveMixZones]
  );

  // Counts for chips
  const domainCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of [...heroRows, ...catalogueRows]) {
      c[r.l1_group] = (c[r.l1_group] ?? 0) + 1;
    }
    return c;
  }, [heroRows, catalogueRows]);

  // PR #3 — "What we're still testing" candidate set. Brief: catalogue rows
  // where the predictive signal isn't there yet (LOW + INSUFFICIENT RCI tiers
  // are the screen-positive-but-not-validated cases). Collapsed by default.
  const stillTestingRows = useMemo(
    () =>
      catalogueRows
        .filter((r) => r.tier_label === "LOW" || r.tier_label === "INSUFFICIENT")
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [catalogueRows]
  );

  const toggleDomain = (code: string) => {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const totalRows = heroRows.length + catalogueRows.length;
  const visibleRows = effectiveMixZones
    ? displayMixed.length
    : displayHero.length + displayCatalogue.length;

  return (
    <div className="p-6 lg:p-8">
      {/* ============== Header ============== */}
      <div className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div
            className="text-[10px] tracking-widest uppercase mb-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Merged preview · cutover pending sign-off
          </div>
          <h1
            className="text-[11px] tracking-[0.15em] uppercase font-semibold"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Precedents
          </h1>
        </div>
        <span className="text-[11px] font-data" style={{ color: "var(--qgi-text-dim)" }}>
          v{pipelineVersion} · {heroRecipes.length} validated / {totalRows} total · model{" "}
          {modelVersion} · {totalLocked} adjudicated
        </span>
      </div>

      {/* ============== Lede (Ingrid, brief verbatim) ============== */}
      <Lede
        validatedCount={heroRecipes.length}
        statCount={catalogueRows.length}
        totalCount={totalRows}
      />

      {/* ============== "How to read this" preamble (dismissible) ============== */}
      {!preambleDismissed && (
        <HowToReadThis
          validatedCount={heroRecipes.length}
          statCount={catalogueRows.length}
          onDismiss={() => setPreambleDismissed(true)}
        />
      )}

      {/* ============== Filter strip ============== */}
      {/* Domain chips */}
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

      {/* Lineage + sort + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center flex-wrap">
        {/* Lineage chip group */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] tracking-widest uppercase mr-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Lineage
          </span>
          {(["ALL", "ML", "STAT"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setLineageFilter(f)}
              className="px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase font-data font-semibold transition-all"
              style={{
                backgroundColor:
                  lineageFilter === f
                    ? f === "ML"
                      ? "#818cf830"
                      : f === "STAT"
                        ? "#7a90a830"
                        : "var(--qgi-surface-2)"
                    : "transparent",
                color:
                  lineageFilter === f
                    ? f === "ML"
                      ? "#818cf8"
                      : f === "STAT"
                        ? "#94a3b8"
                        : "var(--qgi-text)"
                    : "var(--qgi-text-dim)",
                border: `1px solid ${
                  lineageFilter === f
                    ? f === "ML"
                      ? "#818cf880"
                      : f === "STAT"
                        ? "#94a3b880"
                        : "var(--qgi-accent)"
                    : "var(--qgi-border)"
                }`,
              }}
              title={
                f === "ML"
                  ? "Show only ML-validated hero recipes (4)"
                  : f === "STAT"
                    ? "Show only statistical catalogue recipes (64)"
                    : "Show all recipes (68)"
              }
            >
              {f === "ALL" ? "All" : f}
            </button>
          ))}
        </div>

        {/* Search */}
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

        {/* Sort column */}
        <div className="flex items-center gap-1.5">
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
            {SORT_COLUMNS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
              sortDir === "desc"
                ? "Descending — click to flip"
                : "Ascending — click to flip"
            }
          >
            {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>

        {/* Mix-zones toggle (opt-in).
            Sonnet-review B1 (2026-05-13): tier sort cannot mix zones because
            the ML and Stat rubrics are NOT comparable rank-by-rank — that's
            the whole point of the methodology disclosure strip. A MARGINAL
            (ML, 4-pillar adjudicated) is not the same rung as LOW (Stat,
            unadjudicated correlation). When sortCol === "tier", disable the
            toggle so the cross-rubric apples-to-oranges ordering can't be
            reached by accident. The brief's soft-partition only holds if
            this constraint is enforced. */}
        {(() => {
          const tierLocked = sortCol === "tier";
          const tierLockedTitle =
            "Tier sort respects per-lineage rubric (ML: STRONG/MODERATE/MARGINAL · Stat: HIGH/MODERATE/LOW/INSUFFICIENT). The two rubrics are not comparable rank-by-rank — pick a numeric column to mix zones.";
          const defaultTitle =
            "Off (default): heroes pinned above catalogue regardless of sort column. On: full numeric sort across all 68 rows.";
          return (
            <label
              className="flex items-center gap-2 text-[10px] tracking-wider"
              style={{
                color: tierLocked ? "var(--qgi-text-dim)" : "var(--qgi-text-muted)",
                cursor: tierLocked ? "not-allowed" : "pointer",
                opacity: tierLocked ? 0.55 : 1,
              }}
              title={tierLocked ? tierLockedTitle : defaultTitle}
            >
              <input
                type="checkbox"
                checked={!tierLocked && mixZones}
                disabled={tierLocked}
                onChange={(e) => setMixZones(e.target.checked)}
              />
              Mix zones
            </label>
          );
        })()}

        <span
          className="text-xs font-data ml-auto"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Showing {visibleRows} of {totalRows}
        </span>
      </div>

      {/* ============== Table ============== */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <TableHeader />

        {effectiveMixZones ? (
          // Mix-zones: heroes interleaved by sort; visual differentiation still
          // applied per-row via lineage.
          <>
            {displayMixed.length === 0 ? (
              <EmptyState />
            ) : (
              displayMixed.map((row, idx) => (
                <Fragment key={`${row.lineage}-${row.slug}`}>
                  <RecipeRowComponent
                    row={row}
                    isLast={
                      idx === displayMixed.length - 1 && !expandedSlugs.has(row.slug)
                    }
                    hero={row.lineage === "ML"}
                    expanded={expandedSlugs.has(row.slug)}
                    onToggle={() => toggleExpanded(row.slug)}
                  />
                  {expandedSlugs.has(row.slug) && (
                    <ExpandedMechanismCell
                      row={row}
                      isLast={idx === displayMixed.length - 1}
                    />
                  )}
                </Fragment>
              ))
            )}
          </>
        ) : (
          // Zone-respecting default: hero zone → disclosure strip → catalogue.
          <>
            {/* Hero zone (4 ML-validated rows) */}
            {displayHero.length > 0 && (
              <>
                <ZoneHeader
                  label={`Hero · ${displayHero.length} ML-validated`}
                  accent="#22c55e"
                />
                {displayHero.map((row, idx) => {
                  const isLastInZone = idx === displayHero.length - 1;
                  const isExpanded = expandedSlugs.has(row.slug);
                  return (
                    <Fragment key={`hero-${row.slug}`}>
                      <RecipeRowComponent
                        row={row}
                        isLast={false}
                        hero
                        // Keep the divider when expanded (mechanism cell sits below
                        // the row inside the same zone); drop it on the last hero
                        // row only when NOT expanded (the disclosure strip's own
                        // top-border takes over).
                        showBottomBorder={!isLastInZone || isExpanded}
                        expanded={isExpanded}
                        onToggle={() => toggleExpanded(row.slug)}
                      />
                      {isExpanded && <ExpandedMechanismCell row={row} isLast={false} />}
                    </Fragment>
                  );
                })}
              </>
            )}

            {/* Methodology disclosure strip (always renders if either zone has visible rows) */}
            {(displayHero.length > 0 || displayCatalogue.length > 0) && (
              <DisclosureStrip />
            )}

            {/* Catalogue zone (remaining stat-only rows) */}
            {displayCatalogue.length > 0 && (
              <>
                <ZoneHeader
                  label={`Catalogue · ${displayCatalogue.length} statistical`}
                  accent="#94a3b8"
                />
                {displayCatalogue.map((row, idx) => {
                  const isLastInZone = idx === displayCatalogue.length - 1;
                  const isExpanded = expandedSlugs.has(row.slug);
                  return (
                    <Fragment key={`cat-${row.slug}`}>
                      <RecipeRowComponent
                        row={row}
                        isLast={isLastInZone && !isExpanded}
                        expanded={isExpanded}
                        onToggle={() => toggleExpanded(row.slug)}
                      />
                      {isExpanded && (
                        <ExpandedMechanismCell row={row} isLast={isLastInZone} />
                      )}
                    </Fragment>
                  );
                })}
              </>
            )}

            {displayHero.length === 0 && displayCatalogue.length === 0 && <EmptyState />}
          </>
        )}
      </div>

      {/* ============== "What we're still testing" (Ingrid + Sipho) ============== */}
      {stillTestingRows.length > 0 && <WhatWereStillTesting rows={stillTestingRows} />}

      {/* ============== Footer ============== */}
      <p className="text-[10px] mt-4 font-data" style={{ color: "var(--qgi-text-dim)" }}>
        Generated {new Date(generatedAt).toLocaleString()} · pipeline {pipelineVersion}
        {" · "}
        <span style={{ color: "var(--qgi-text-muted)" }}>
          Preview shell — V1 + V2-A + V2-B routes remain live until founder cutover (PR
          #5).
        </span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TableHeader() {
  return (
    <div
      className="hidden md:grid items-center px-4 py-2.5 text-[10px] tracking-widest uppercase"
      style={{
        gridTemplateColumns: "2fr 1fr 60px 130px 110px 90px 90px",
        color: "var(--qgi-text-dim)",
        borderBottom: "1px solid var(--qgi-border)",
        backgroundColor: "var(--qgi-surface-2)",
      }}
    >
      <span>Category</span>
      <span>Domain</span>
      {/* LINEAGE precedes TIER per Marcus's routing-then-validation order */}
      <span>Lineage</span>
      <span>Tier</span>
      <span className="text-right">Instances</span>
      <span className="text-right">Length</span>
      <span className="text-right">Coverage</span>
    </div>
  );
}

function ZoneHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-[9px] tracking-widest uppercase"
      style={{
        color: "var(--qgi-text-dim)",
        backgroundColor: "var(--qgi-surface-2)",
        borderBottom: "1px solid var(--qgi-border)",
        borderTop: "1px solid var(--qgi-border)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 4,
          height: 12,
          backgroundColor: accent,
          borderRadius: 2,
        }}
      />
      {label}
    </div>
  );
}

/**
 * Methodology disclosure strip (Sipho voice — brief: 35-word copy with
 * amber treatment, sits between the hero and catalogue zones).
 */
function DisclosureStrip() {
  return (
    <div
      className="px-4 py-3 text-xs leading-relaxed border-y"
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
        className="font-semibold tracking-wide uppercase text-[10px] mr-2"
        style={{ color: "rgba(245, 158, 11, 0.95)" }}
      >
        Methodology disclosure
      </span>
      The 4 above passed ML adjudication: blind walk-forward backtest, calibration audit,
      4-pillar lock rubric. The 64 below are statistical correlations that have{" "}
      <strong>not</strong> been adjudicated yet — promotion candidates, not verified
      predictions.{" "}
      {/* Brief cross-family handoff: "See related ranked patterns →" → /patterns
          (Family 4 brief locked /patterns?sort=loco_auc, was /patterns/ranking). */}
      <Link
        href={"/patterns?sort=loco_auc" as Route}
        className="underline underline-offset-2 hover:text-[var(--qgi-text)] transition-colors"
        style={{ color: "rgba(245, 158, 11, 0.95)" }}
      >
        See related ranked patterns →
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-sm" style={{ color: "var(--qgi-text-dim)" }}>
      No recipes match your filters.
    </div>
  );
}

function RecipeRowComponent({
  row,
  isLast,
  hero = false,
  showBottomBorder = true,
  expanded = false,
  onToggle,
}: {
  row: MergedRow;
  isLast: boolean;
  hero?: boolean;
  showBottomBorder?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const covColor = coverageColor(row.oecd_share);
  const lineageColors =
    row.lineage === "ML"
      ? { bg: "#818cf830", fg: "#818cf8", border: "#818cf880" }
      : { bg: "#94a3b820", fg: "#94a3b8", border: "#94a3b880" };

  const borderBottom = isLast
    ? "none"
    : showBottomBorder
      ? "1px solid var(--qgi-border)"
      : "none";

  // PR #3: row is a clickable trigger that toggles the inline mechanism
  // cell. The detail-page link moves inside ExpandedMechanismCell ("View
  // dossier →"). aria-expanded + aria-controls wire to the cell's id.
  //
  // PR #3 Sonnet review B1 fix: <button> cannot contain <div> per the HTML
  // spec (button is phrasing content; the row's mobile + desktop layouts use
  // block-level divs). The brief's ARIA section prescribed the right shape:
  // role="button" + tabIndex={0} + keydown handler on a <div> wrapper, which
  // supports the same a11y semantics without violating the content model.
  const panelId = `mechanism-${row.lineage}-${row.slug}`;
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle?.();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      aria-expanded={expanded}
      aria-controls={panelId}
      className="block w-full text-left transition-colors hover:bg-[var(--qgi-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)] group cursor-pointer"
      style={{
        borderBottom,
        borderLeft: hero ? "3px solid #22c55e" : `3px solid ${row.l1_color}`,
        backgroundColor: hero ? "rgba(34, 197, 94, 0.04)" : "transparent",
      }}
    >
      {/* Mobile (compressed) */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm group-hover:text-[var(--qgi-accent)] transition-colors ${
              hero ? "font-semibold" : "font-medium"
            }`}
            style={{ color: "var(--qgi-text)" }}
          >
            {row.display_name}
          </span>
          <span
            className="text-[9px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${row.l1_color}18`,
              color: row.l1_color,
            }}
          >
            {row.l1_short_label}
          </span>
          <span
            className="text-[9px] tracking-wider uppercase font-data font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: lineageColors.bg,
              color: lineageColors.fg,
              border: `1px solid ${lineageColors.border}`,
            }}
          >
            {row.lineage}
          </span>
          <TierPill
            label={row.tier_label}
            method={row.lineage === "ML" ? "ML" : "Stat"}
            color={row.tier_color}
          />
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
            <span className="font-data" style={{ color: covColor }}>
              {Math.round(row.oecd_share * 100)}%
            </span>
          </span>
        </div>
      </div>

      {/* Desktop 7-col grid */}
      <div
        className="hidden md:grid items-center px-4"
        style={{
          gridTemplateColumns: "2fr 1fr 60px 130px 110px 90px 90px",
          // Brief: hero row height +4px relative to catalogue rows.
          paddingTop: hero ? 14 : 12,
          paddingBottom: hero ? 14 : 12,
        }}
      >
        {/* CATEGORY */}
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className={`text-sm truncate group-hover:text-[var(--qgi-accent)] transition-colors ${
              hero ? "font-semibold" : "font-normal"
            }`}
            style={{ color: "var(--qgi-text)" }}
          >
            {row.display_name}
          </span>
        </div>

        {/* DOMAIN */}
        <span
          className="text-[11px] tracking-wider uppercase font-medium"
          style={{ color: row.l1_color }}
        >
          {row.l1_short_label}
        </span>

        {/* LINEAGE (44px fixed-width pill per brief; 60px col includes padding) */}
        <span>
          <span
            className="inline-block text-[9px] tracking-wider uppercase font-data font-semibold px-1.5 py-0.5 rounded text-center"
            style={{
              backgroundColor: lineageColors.bg,
              color: lineageColors.fg,
              border: `1px solid ${lineageColors.border}`,
              width: 44,
            }}
            title={
              row.lineage === "ML"
                ? "ML-adjudicated: walk-forward backtest + calibration audit + 4-pillar lock rubric"
                : "Statistical correlation: not yet adjudicated; promotion candidate"
            }
          >
            {row.lineage}
          </span>
        </span>

        {/* TIER (method pill) */}
        <span>
          <TierPill
            label={row.tier_label}
            method={row.lineage === "ML" ? "ML" : "Stat"}
            color={row.tier_color}
          />
        </span>

        {/* INSTANCES */}
        <span
          className="text-right font-data text-base font-bold"
          style={{ color: "var(--qgi-text)" }}
        >
          {row.total_instances.toLocaleString()}
        </span>

        {/* LENGTH */}
        <span
          className="text-right font-data text-sm"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {row.canonical_length}y
        </span>

        {/* COVERAGE */}
        <span className="text-right font-data text-sm" style={{ color: covColor }}>
          {Math.round(row.oecd_share * 100)}%
        </span>
      </div>
    </div>
  );
}

/**
 * PR #3 — Lede paragraph (Ingrid voice, brief verbatim).
 *
 * Brief copy at qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 * §"Lede (Ingrid)". Numbers ({validatedCount} / {statCount} / {totalCount})
 * substitute live counts so the prose stays honest if the recipe count
 * drifts between bakes — brief locked the SHAPE, not literal "72/4/68".
 */
function Lede({
  validatedCount,
  statCount,
  totalCount,
}: {
  validatedCount: number;
  statCount: number;
  totalCount: number;
}) {
  return (
    <section className="mb-4 max-w-[68ch]">
      <p className="text-base leading-relaxed" style={{ color: "var(--qgi-text)" }}>
        A precedent is a previous event that resembles a current one closely enough to
        inform a forecast. This page catalogues {totalCount.toLocaleString()} of them:{" "}
        {validatedCount} validated recipes the model can predict above chance, and{" "}
        {statCount.toLocaleString()} statistical patterns it has identified but cannot yet
        predict reliably. The difference matters and we explain it.
      </p>
    </section>
  );
}

/**
 * PR #3 — "How to read this" preamble (Ingrid voice, brief verbatim).
 * Dismissible. Session-scoped state in PR #3; PR #4 adds localStorage
 * persistence per Tomás hard requirement.
 */
function HowToReadThis({
  validatedCount,
  statCount,
  onDismiss,
}: {
  validatedCount: number;
  statCount: number;
  onDismiss: () => void;
}) {
  return (
    <section
      className="mb-6 max-w-[68ch] rounded-lg border p-4 relative"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
      aria-label="How to read this page"
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ color: "var(--qgi-text-dim)" }}
        aria-label="Dismiss preamble"
        title="Hide for this session"
      >
        Dismiss ×
      </button>
      <div
        className="text-[10px] tracking-widest uppercase mb-2 font-semibold"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        How to read this
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
        {/* PR #3 Sonnet review wording fix: brief copy is "The four cards
            below" — restored verbatim (spell-out small numbers via helper)
            and dropped the "above the methodology disclosure" qualifier I
            had added. */}
        The {spellOutSmallNumber(validatedCount)}{" "}
        {validatedCount === 1 ? "card" : "cards"} below are the recipes we underwrite.
        Click any row to see the mechanism — what&apos;s actually happening when these
        patterns appear. Beneath them sits the full catalogue:{" "}
        {statCount.toLocaleString()} additional patterns we&apos;ve measured but
        haven&apos;t validated. Sort, filter, compare. The table is where you go to
        understand what we&apos;re still working on.
      </p>
    </section>
  );
}

/**
 * PR #3 — Expanded mechanism cell. Sits inline below the row when expanded.
 * Brief: full-width 120-word mechanism prose (Ingrid voice template — 3
 * movements). Hero rows get hand-curated prose post-#683; catalogue rows
 * ship with template fallback per founder #683 decision.
 *
 * Deferred to a future PR:
 *   - Inline country-name links inside the mechanism prose (brief: country
 *     names always linked per style-guide rule)
 *   - "{n} countries firing now →" pill (brief: ML rows only)
 */
function ExpandedMechanismCell({ row, isLast }: { row: MergedRow; isLast: boolean }) {
  const panelId = `mechanism-${row.lineage}-${row.slug}`;
  return (
    <div
      id={panelId}
      role="region"
      aria-label={`Mechanism for ${row.display_name}`}
      className="px-6 py-5"
      style={{
        backgroundColor: "var(--qgi-surface-2)",
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft:
          row.lineage === "ML" ? "3px solid #22c55e" : `3px solid ${row.l1_color}`,
      }}
    >
      <div
        className="text-[10px] tracking-widest uppercase mb-2"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Mechanism · {row.display_name}
      </div>
      <p
        className="text-sm leading-relaxed max-w-[68ch]"
        style={{ color: "var(--qgi-text)" }}
      >
        {row.mechanism_text || (
          <span style={{ color: "var(--qgi-text-dim)", fontStyle: "italic" }}>
            Mechanism prose is being curated for this recipe; expected with the next bake.
          </span>
        )}
      </p>
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <Link
          href={row.detail_href}
          className="text-[11px] tracking-wider uppercase hover:text-[var(--qgi-accent)] transition-colors font-semibold"
          style={{ color: "var(--qgi-accent)" }}
        >
          View dossier →
        </Link>
        <span className="text-[10px] font-data" style={{ color: "var(--qgi-text-dim)" }}>
          {row.lineage === "ML"
            ? "Hand-curated prose ships with #683 bake; current text is the buyer-cleaned excerpt."
            : "Auto-generated from recipe data; #683 may upgrade if this recipe is promoted to the ML hero zone."}
        </span>
      </div>
    </div>
  );
}

/**
 * PR #3 — "What we're still testing" `<details>` collapsed by default.
 * Brief: "These are patterns where the statistical signal is real but the
 * predictive signal isn't yet." Per-recipe entries — 3 sentences (what /
 * what's wrong / what would unblock), italicised recipe name, Granta
 * register.
 *
 * Filter: catalogue rows where tier ∈ {LOW, INSUFFICIENT} — the
 * screen-positive-but-not-validated cases that justify being listed here.
 * Sorted alphabetically (deterministic).
 */
function WhatWereStillTesting({ rows }: { rows: MergedRow[] }) {
  return (
    <details
      // PR #3 Sonnet review B2 fix: `group` class enables `group-open:` on
      // descendants (Tailwind reads the [open] attribute via the group).
      className="group mt-8 rounded-lg border"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <summary
        className="cursor-pointer px-5 py-3 text-[10px] tracking-widest uppercase font-semibold flex items-center gap-2"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <span
          className="transition-transform inline-block group-open:rotate-90"
          aria-hidden="true"
        >
          ▶
        </span>
        What we&apos;re still testing
        <span
          className="font-data ml-2 normal-case tracking-normal"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          ({rows.length} {rows.length === 1 ? "recipe" : "recipes"})
        </span>
      </summary>
      <div
        className="px-5 pb-5 pt-2 text-sm leading-relaxed max-w-[68ch]"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        <p className="mb-4">
          These are patterns where the statistical signal is real but the predictive
          signal isn&apos;t yet — usually because the country sample is thin, the
          historical window misses a regime change, or the indicator set we&apos;re
          matching against is incomplete. We list them publicly because withholding them
          would misrepresent what the model knows.
        </p>
        {rows.map((row) => (
          <p key={row.slug} className="mb-3 last:mb-0">
            <em style={{ color: "var(--qgi-text)" }}>{row.display_name}.</em>{" "}
            {row.total_instances.toLocaleString()} historical instances across{" "}
            {row.n_distinct_country_pairs.toLocaleString()} distinct country pairs, but
            confidence sits at {row.tier_label.toLowerCase()} — the statistical screen
            passes, the predictive screen does not. Until we have enough confirmed
            positives in a held-out cohort to backtest this fingerprint, it stays in this
            section.
          </p>
        ))}
      </div>
    </details>
  );
}

function TierPill({
  label,
  method,
  color,
}: {
  label: string;
  method: "ML" | "Stat";
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-data font-semibold tracking-wider uppercase"
      style={{
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}40`,
      }}
      // PR #2 follow-up F1: wire to Sipho's verbatim 7-rung tooltip copy
      // module instead of a generic placeholder. getTierTooltip resolves the
      // MODERATE collision via method suffix.
      title={getTierTooltip(label, method)}
    >
      {label}
      <span
        className="ml-0.5 opacity-70 normal-case tracking-normal"
        style={{ fontSize: 8 }}
      >
        ({method})
      </span>
    </span>
  );
}
