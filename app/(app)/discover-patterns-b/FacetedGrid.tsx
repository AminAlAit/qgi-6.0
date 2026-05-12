"use client";

/**
 * FacetedGrid — the Elif variant.
 *
 * Layout: three-column on wide screens.
 *   [Facet column 220px] | [Grid + header fills remaining width]
 *
 * The facet column is the information architecture. It makes the filter
 * state legible without a filter strip that collapses on mobile or a
 * drawer that hides the state.
 *
 * Grid cells use a 5-zone compact card:
 *   Zone 1 (top-left):  pair name + lead badge
 *   Zone 2 (top-right): tier chip + RCI dot
 *   Zone 3 (mid):       sparkline (7-point correlation trajectory)
 *   Zone 4 (bottom-left): PPS bar (normalized, no axis)
 *   Zone 5 (bottom-right): metadata density row
 *
 * Sparklines are rendered as inline SVG. No chartjunk. No axes.
 * The shape carries the message.
 */

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import type { PatternFacet, Tier, Architecture, RCI, SortKey } from "./types";

// ---------------------------------------------------------------------------
// Color constants — match design.ts palette
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<Tier, string> = {
  STRONG: "#22c55e",
  MODERATE: "#fbbf24",
  MARGINAL: "#a3a3a3",
};

const RCI_COLORS: Record<RCI, string> = {
  GREEN: "#22c55e",
  YELLOW: "#fbbf24",
  RED: "#f87171",
  INSUFFICIENT: "#4a6280",
};

const RCI_LABELS: Record<RCI, string> = {
  GREEN: "High confidence",
  YELLOW: "Moderate confidence",
  RED: "Low confidence — small-N",
  INSUFFICIENT: "Insufficient data",
};

// PPS bands: tuned to 0-2000 range of mock data
function ppsColor(pps: number): string {
  if (pps >= 1500) return "#f87171";
  if (pps >= 1000) return "#fb923c";
  if (pps >= 600) return "#fbbf24";
  return "#7a90a8";
}

// ---------------------------------------------------------------------------
// Facet definitions — what dimensions are available
// ---------------------------------------------------------------------------

const L1_CATEGORIES = [
  { key: "governance", label: "Governance" },
  { key: "economy", label: "Economy" },
  { key: "security", label: "Security" },
  { key: "trade", label: "Trade" },
  { key: "energy", label: "Energy" },
];

const TIERS: Tier[] = ["STRONG", "MODERATE", "MARGINAL"];

const ARCHITECTURES: Architecture[] = ["D2", "D5", "V1-statistical"];

const RCIS: RCI[] = ["GREEN", "YELLOW", "RED", "INSUFFICIENT"];

// Regions extracted from data — all unique region_a + region_b values
const REGIONS = [
  "East Asia",
  "Southeast Asia",
  "South Asia",
  "Western Europe",
  "Central Europe",
  "Northern Europe",
  "Eastern Europe",
  "Caucasus",
  "Middle East",
  "North Africa",
  "Sub-Saharan Africa",
  "East Africa",
  "Southern Africa",
  "Latin America",
  "Central America",
  "Anglosphere",
  "Central Asia",
];

const RECENT_THRESHOLD = 2020; // "recent" = last_firing_year >= this

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "pps", label: "Confidence score" },
  { key: "avg_correlation", label: "Correlation" },
  { key: "instance_count", label: "Instances" },
  { key: "last_firing_year", label: "Last firing" },
  { key: "pattern_length", label: "Pattern length" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FacetedGrid({ patterns }: { patterns: PatternFacet[] }) {
  // --- Filter state ---
  const [selCategories, setSelCategories] = useState<Set<string>>(new Set());
  const [selTiers, setSelTiers] = useState<Set<Tier>>(new Set());
  const [selArchs, setSelArchs] = useState<Set<Architecture>>(new Set());
  const [selRCIs, setSelRCIs] = useState<Set<RCI>>(new Set());
  const [selRegions, setSelRegions] = useState<Set<string>>(new Set());
  const [recentOnly, setRecentOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("pps");

  // Toggle helper — generic
  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  const clearAll = useCallback(() => {
    setSelCategories(new Set());
    setSelTiers(new Set());
    setSelArchs(new Set());
    setSelRCIs(new Set());
    setSelRegions(new Set());
    setRecentOnly(false);
  }, []);

  const activeCount =
    selCategories.size +
    selTiers.size +
    selArchs.size +
    selRCIs.size +
    selRegions.size +
    (recentOnly ? 1 : 0);

  // --- Filtered + sorted results ---
  const filtered = useMemo(() => {
    let result = patterns;
    if (selCategories.size > 0)
      result = result.filter((p) => selCategories.has(p.l1_category));
    if (selTiers.size > 0) result = result.filter((p) => selTiers.has(p.tier));
    if (selArchs.size > 0) result = result.filter((p) => selArchs.has(p.architecture));
    if (selRCIs.size > 0) result = result.filter((p) => selRCIs.has(p.rci));
    if (selRegions.size > 0)
      result = result.filter(
        (p) => selRegions.has(p.region_a) || selRegions.has(p.region_b)
      );
    if (recentOnly) result = result.filter((p) => p.last_firing_year >= RECENT_THRESHOLD);
    return [...result].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [
    patterns,
    selCategories,
    selTiers,
    selArchs,
    selRCIs,
    selRegions,
    recentOnly,
    sortKey,
  ]);

  // Max PPS for bar normalization
  const maxPps = useMemo(() => Math.max(1, ...filtered.map((p) => p.pps)), [filtered]);

  // Count helpers for facet labels
  const countFor = useCallback(
    (predicate: (p: PatternFacet) => boolean) => patterns.filter(predicate).length,
    [patterns]
  );

  return (
    <div className="flex h-full overflow-hidden" style={{ color: "var(--qgi-text)" }}>
      {/* ================================================================ */}
      {/* FACET COLUMN                                                      */}
      {/* ================================================================ */}
      <aside
        className="shrink-0 overflow-y-auto border-r flex flex-col"
        style={{
          width: 216,
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 pt-5 pb-3 border-b shrink-0"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <div
            className="text-[9px] tracking-widest uppercase font-semibold mb-0.5"
            style={{ color: "var(--qgi-accent)" }}
          >
            Discover Patterns
          </div>
          <div className="text-[11px]" style={{ color: "var(--qgi-text-dim)" }}>
            V2.2 · Facets
          </div>
        </div>

        {/* Filter blocks */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Category */}
          <FacetBlock title="Category">
            {L1_CATEGORIES.map(({ key, label }) => {
              const n = countFor((p) => p.l1_category === key);
              return (
                <FacetChip
                  key={key}
                  label={label}
                  count={n}
                  active={selCategories.has(key)}
                  onToggle={() => toggle(selCategories, key, setSelCategories)}
                />
              );
            })}
          </FacetBlock>

          {/* Tier */}
          <FacetBlock title="Signal tier">
            {TIERS.map((tier) => {
              const n = countFor((p) => p.tier === tier);
              return (
                <FacetChip
                  key={tier}
                  label={tier}
                  count={n}
                  active={selTiers.has(tier)}
                  accentColor={TIER_COLORS[tier]}
                  onToggle={() => toggle(selTiers, tier, setSelTiers)}
                />
              );
            })}
          </FacetBlock>

          {/* Architecture */}
          <FacetBlock title="Architecture">
            {ARCHITECTURES.map((arch) => {
              const n = countFor((p) => p.architecture === arch);
              return (
                <FacetChip
                  key={arch}
                  label={arch}
                  count={n}
                  active={selArchs.has(arch)}
                  onToggle={() => toggle(selArchs, arch, setSelArchs)}
                />
              );
            })}
          </FacetBlock>

          {/* Confidence (RCI) */}
          <FacetBlock title="RCI confidence">
            {RCIS.map((rci) => {
              const n = countFor((p) => p.rci === rci);
              return (
                <FacetChip
                  key={rci}
                  label={rci}
                  count={n}
                  active={selRCIs.has(rci)}
                  accentColor={RCI_COLORS[rci]}
                  onToggle={() => toggle(selRCIs, rci, setSelRCIs)}
                />
              );
            })}
          </FacetBlock>

          {/* Region */}
          <FacetBlock title="Region">
            {REGIONS.map((region) => {
              const n = countFor((p) => p.region_a === region || p.region_b === region);
              if (n === 0) return null;
              return (
                <FacetChip
                  key={region}
                  label={region}
                  count={n}
                  active={selRegions.has(region)}
                  onToggle={() => toggle(selRegions, region, setSelRegions)}
                />
              );
            })}
          </FacetBlock>

          {/* Recent activity */}
          <FacetBlock title="Activity">
            <button
              onClick={() => setRecentOnly((v) => !v)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] transition-colors"
              style={{
                backgroundColor: recentOnly ? "var(--qgi-surface-2)" : "transparent",
                color: recentOnly ? "var(--qgi-text)" : "var(--qgi-text-muted)",
                border: `1px solid ${recentOnly ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
              }}
            >
              <span>Fired since {RECENT_THRESHOLD}</span>
              <span
                className="text-[10px] font-data"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {countFor((p) => p.last_firing_year >= RECENT_THRESHOLD)}
              </span>
            </button>
          </FacetBlock>
        </div>

        {/* Footer — clear all */}
        {activeCount > 0 && (
          <div
            className="px-4 py-3 border-t shrink-0"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <button
              onClick={clearAll}
              className="text-[10px] tracking-wider uppercase hover:underline w-full text-left"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Clear {activeCount} filter{activeCount !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </aside>

      {/* ================================================================ */}
      {/* GRID PANEL                                                        */}
      {/* ================================================================ */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* Grid header */}
        <div
          className="flex items-center justify-between gap-4 px-5 py-3 border-b shrink-0"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <div className="flex items-baseline gap-3">
            <span
              className="font-data text-sm font-semibold"
              style={{ color: "var(--qgi-text)" }}
            >
              {filtered.length}
            </span>
            <span
              className="text-[10px] tracking-wider uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {filtered.length === 1 ? "pattern" : "patterns"}
              {activeCount > 0 &&
                ` · ${activeCount} filter${activeCount !== 1 ? "s" : ""} active`}
            </span>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[9px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Sort
            </span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-[11px] rounded px-2 py-1 border outline-none cursor-pointer"
              style={{
                backgroundColor: "var(--qgi-bg)",
                borderColor: "var(--qgi-border)",
                color: "var(--qgi-text)",
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid body */}
        <div className="flex-1 p-4">
          {filtered.length === 0 ? (
            <EmptyState hasFilters={activeCount > 0} onClear={clearAll} />
          ) : (
            <div
              className="grid gap-3"
              style={{
                // Responsive: fill with minimum 260px columns
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {filtered.map((p) => (
                <PatternCard key={p.slug} pattern={p} maxPps={maxPps} />
              ))}
            </div>
          )}
        </div>

        {/* Footer nav — variant comparison */}
        <div
          className="px-5 py-3 border-t shrink-0 flex items-center gap-4 text-[11px]"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-dim)",
          }}
        >
          <span className="tracking-wider uppercase text-[9px]">V2 comparison</span>
          <Link
            href="/discover-patterns-a"
            className="hover:underline"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            ↔ V2.1 Tabs (Yuki)
          </Link>
          <Link
            href="/patterns"
            className="hover:underline"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            V1 Patterns
          </Link>
          <Link
            href="/patterns/ranking"
            className="hover:underline"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            V1 Ranking
          </Link>
          <span
            className="ml-auto text-[9px] italic"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            MOCK data · real integration in #648
          </span>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PatternCard — the small-multiples cell
// ---------------------------------------------------------------------------

function PatternCard({ pattern: p, maxPps }: { pattern: PatternFacet; maxPps: number }) {
  const tierColor = TIER_COLORS[p.tier];
  const rciColor = RCI_COLORS[p.rci];
  const barColor = ppsColor(p.pps);
  const barWidth = `${Math.min(100, (p.pps / maxPps) * 100)}%`;
  const corr = `${(p.avg_correlation * 100).toFixed(0)}%`;
  const lead = p.lead_years > 0 ? `+${p.lead_years}yr` : "concurrent";

  return (
    <Link
      href={`/discover-patterns-b/${p.slug}` as const}
      className="block rounded border transition-colors group"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
      prefetch={false}
    >
      <div className="p-3 flex flex-col gap-2">
        {/* Zone 1+2: header row */}
        <div className="flex items-start justify-between gap-2">
          {/* Pair name */}
          <div className="min-w-0">
            <div
              className="text-[12px] font-semibold leading-tight truncate group-hover:underline"
              style={{ color: "var(--qgi-text)" }}
            >
              {p.display_name}
            </div>
            <div
              className="text-[10px] mt-0.5 truncate"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {p.event_label} · <span className="font-data">{lead}</span>
            </div>
          </div>

          {/* Tier chip + RCI dot */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded"
              style={{
                color: tierColor,
                backgroundColor: `${tierColor}18`,
                border: `1px solid ${tierColor}40`,
              }}
            >
              {p.tier}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[9px]"
              style={{ color: rciColor }}
              title={RCI_LABELS[p.rci]}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: rciColor,
                }}
              />
              {p.rci}
            </span>
          </div>
        </div>

        {/* Zone 3: sparkline — 7-point correlation trajectory */}
        <Sparkline points={p.sparkline} color={barColor} />

        {/* Zone 4: PPS bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[9px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              PPS
            </span>
            <span
              className="font-data text-[11px] font-semibold"
              style={{ color: barColor }}
            >
              {p.pps.toLocaleString()}
            </span>
          </div>
          <div
            className="h-[4px] rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--qgi-surface-2)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: barWidth, backgroundColor: barColor }}
            />
          </div>
        </div>

        {/* Zone 5: metadata density row */}
        <div
          className="flex items-center gap-2 text-[10px] font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <span title="Average correlation">{corr} r</span>
          <Sep />
          <span title="Pattern length">{p.pattern_length} yr</span>
          <Sep />
          <span title="Number of SCDI indexes">{p.num_indexes} SCDIs</span>
          <Sep />
          <span title="Architecture" style={{ color: "var(--qgi-text-muted)" }}>
            {p.architecture}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — inline SVG, no axes, Tufte-idiomatic
// ---------------------------------------------------------------------------

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const W = 220;
  const H = 28;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(0.001, max - min);

  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map((v) => H - pad - ((v - min) / range) * (H - pad * 2));

  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");

  // Area fill path
  const areaPath = [
    `M ${xs[0]},${H - pad}`,
    ...xs.map((x, i) => `L ${x},${ys[i]}`),
    `L ${xs[xs.length - 1]},${H - pad}`,
    "Z",
  ].join(" ");

  const endX = xs[xs.length - 1];
  const endY = ys[ys.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Area fill */}
      <path d={areaPath} fill={`${color}18`} />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Terminal dot */}
      <circle cx={endX} cy={endY} r={2.5} fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Facet sub-components
// ---------------------------------------------------------------------------

function FacetBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[9px] tracking-widest uppercase font-semibold mb-2"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function FacetChip({
  label,
  count,
  active,
  accentColor,
  onToggle,
}: {
  label: string;
  count: number;
  active: boolean;
  accentColor?: string;
  onToggle: () => void;
}) {
  const color = accentColor ?? (active ? "var(--qgi-accent)" : undefined);
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between px-2 py-1.5 rounded text-[11px] w-full transition-colors text-left"
      style={{
        backgroundColor: active
          ? accentColor
            ? `${accentColor}18`
            : "var(--qgi-surface-2)"
          : "transparent",
        color: active ? (color ?? "var(--qgi-text)") : "var(--qgi-text-muted)",
        border: `1px solid ${active ? (accentColor ? `${accentColor}50` : "var(--qgi-border-active, var(--qgi-accent))") : "transparent"}`,
      }}
    >
      <span className="truncate">{label}</span>
      <span
        className="font-data text-[10px] shrink-0 ml-1"
        style={{
          color: active ? (color ?? "var(--qgi-text-dim)") : "var(--qgi-text-dim)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <span
        className="text-xs tracking-widest uppercase"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        No patterns match
      </span>
      {hasFilters && (
        <div className="flex flex-col items-center gap-2">
          <span
            className="text-[11px] text-center max-w-xs"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Your filters exclude all {32} patterns in this dataset. Try widening the tier
            or RCI filter first.
          </span>
          <button
            onClick={onClear}
            className="text-[11px] tracking-wider underline"
            style={{ color: "var(--qgi-accent)" }}
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

function Sep() {
  return (
    <span className="shrink-0" style={{ color: "var(--qgi-border)", fontSize: 10 }}>
      &middot;
    </span>
  );
}
