"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { countrySlug } from "@/lib/slug";
import type {
  PatternWindowTier,
  PatternsMergedRow,
} from "@/app/(app)/patterns-merged/page";

/**
 * Merged Patterns list shell — Build PR #1 of 5 (A3 Family 4 merger brief).
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 4 — Patterns)
 *
 * Scope of PR #1:
 *   - Foreign Affairs hero (eyebrow "156 countries · 13 locked recipes ·
 *     60 years of data" + H1 "Which economies walked the same path — and
 *     what happened next.")
 *   - "What this doesn't mean" 3-bullet callout (REQUIRED per brief)
 *   - Lloyd's-style methodology disclosure banner
 *   - Preset chip strip (4 chips folding V2-A tabs into URL-state filters):
 *     Currently firing · Top confidence · Country-tier shifts · Recently
 *     confirmed (rendered as chips; full URL-state wire-up lands in PR #2)
 *   - Filter strip (search + tier chips)
 *   - 5-col rows-layout table: PAIR · WINDOW · CORRELATION · PPS · LENGTH
 *
 * Deferred to PR #2: faceted left rail (7 categorical facets + slider group)
 * Deferred to PR #3: per-pattern detail /patterns-merged/[slug]
 * Deferred to PR #4: sparkline column + RCI dot + cross-family handoffs
 * Deferred to PR #5 (founder-gated): cutover
 */

const TIER_META: Record<
  PatternWindowTier,
  { label: string; color: string; bg: string; border: string; tooltip: string }
> = {
  "XL-win": {
    label: "XL-win",
    color: "#a78bfa",
    bg: "rgba(167, 139, 250, 0.10)",
    border: "rgba(167, 139, 250, 0.35)",
    tooltip:
      "XL window — pattern canonical_length > 40 years. The longest-horizon trajectory comparisons.",
  },
  "L-win": {
    label: "L-win",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.10)",
    border: "rgba(56, 189, 248, 0.35)",
    tooltip:
      "L window — pattern canonical_length 21–40 years. Multi-decade structural comparisons.",
  },
  "M-win": {
    label: "M-win",
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.10)",
    border: "rgba(34, 197, 94, 0.35)",
    tooltip:
      "M window — pattern canonical_length 9–20 years. Medium-horizon trajectory comparisons.",
  },
  "S-win": {
    label: "S-win",
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.10)",
    border: "rgba(251, 191, 36, 0.35)",
    tooltip:
      "S window — pattern canonical_length ≤ 8 years. Short-horizon trajectory comparisons.",
  },
};

const TIER_ORDER: Record<PatternWindowTier, number> = {
  "XL-win": 0,
  "L-win": 1,
  "M-win": 2,
  "S-win": 3,
};

type SortColumn =
  | "pattern_power_score"
  | "avg_correlation"
  | "pattern_length"
  | "window_tier";
type SortDir = "asc" | "desc";

function sortRows(
  rows: PatternsMergedRow[],
  col: SortColumn,
  dir: SortDir
): PatternsMergedRow[] {
  const arr = [...rows];
  const mul = dir === "asc" ? 1 : -1;
  switch (col) {
    case "pattern_power_score":
      arr.sort((a, b) => mul * (a.pattern_power_score - b.pattern_power_score));
      break;
    case "avg_correlation":
      arr.sort((a, b) => mul * (a.avg_correlation - b.avg_correlation));
      break;
    case "pattern_length":
      arr.sort((a, b) => mul * (a.pattern_length - b.pattern_length));
      break;
    case "window_tier":
      arr.sort((a, b) => mul * (TIER_ORDER[a.window_tier] - TIER_ORDER[b.window_tier]));
      break;
  }
  return arr;
}

const PRESET_CHIPS: ReadonlyArray<{
  id: string;
  label: string;
  tooltip: string;
}> = [
  {
    id: "currently-firing",
    label: "Currently firing",
    tooltip: "Patterns with a recent firing year (last 24 months).",
  },
  {
    id: "top-confidence",
    label: "Top confidence",
    tooltip:
      "Ranked by out-of-country discrimination score — the strictest validation gate.",
  },
  {
    id: "country-tier-shifts",
    label: "Country-tier shifts",
    tooltip:
      "Patterns associated with countries whose composite risk tier moved this quarter.",
  },
  {
    id: "recently-confirmed",
    label: "Recently confirmed",
    tooltip: "Patterns whose canonical analogue closed within the last 12 months.",
  },
];

export function PatternsMergedListClient({
  rows,
  tierCounts,
  uniquePairCount,
  yearRange,
  generatedDate,
}: {
  rows: PatternsMergedRow[];
  tierCounts: Record<PatternWindowTier, number>;
  uniquePairCount: number;
  yearRange: { first: number; last: number };
  generatedDate: string;
}) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"ALL" | PatternWindowTier>("ALL");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("pattern_power_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.country_a.toLowerCase().includes(q) &&
          !r.country_b.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (tierFilter !== "ALL" && r.window_tier !== tierFilter) return false;
      return true;
    });
  }, [rows, search, tierFilter]);

  const sorted = useMemo(
    () => sortRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir]
  );

  return (
    <div className="p-6 lg:p-8">
      {/* ============== Header ============== */}
      <div className="mb-5">
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          156 countries · 13 locked recipes · 60 years of data
        </div>
        <h1
          className="text-2xl font-semibold leading-snug max-w-[68ch]"
          style={{ color: "var(--qgi-text)" }}
        >
          Which economies walked the same path — and what happened next.
        </h1>
        <p
          className="text-xs mt-3 font-data tabular-nums"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {rows.length} pattern instances · {uniquePairCount} unique pairs · windows
          covering {yearRange.first}–{yearRange.last}
        </p>
      </div>

      {/* ============== "What this doesn't mean" callout (REQUIRED) ============== */}
      <div
        role="note"
        aria-label="What this doesn't mean"
        className="mb-4 rounded-lg border p-4"
        style={{
          backgroundColor: "rgba(251, 191, 36, 0.06)",
          borderColor: "rgba(251, 191, 36, 0.25)",
          borderLeftWidth: 2,
          borderLeftStyle: "solid",
          borderLeftColor: "rgba(251, 191, 36, 0.6)",
          color: "var(--qgi-text-muted)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="font-semibold tracking-wide uppercase text-[10px]"
            style={{ color: "rgba(251, 191, 36, 0.95)" }}
          >
            What this doesn&apos;t mean
          </span>
          <span
            className="text-[9px] tracking-widest uppercase font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              color: "var(--qgi-text-muted)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            [Worked example]
          </span>
        </div>
        <ul
          className="text-xs leading-relaxed space-y-1 list-disc pl-5 max-w-[68ch]"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          <li>This is not a prediction of when the next case will occur.</li>
          <li>This is not a forecast for either country on its own.</li>
          <li>
            Shared trajectory is not causation — these economies walked similar paths, not
            the same one.
          </li>
        </ul>
      </div>

      {/* ============== Lloyd's methodology disclosure banner ============== */}
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
          Patterns shown are output from QGI&apos;s pattern-matching pipeline. Pattern
          Power Score (PPS) is a composite of correlation strength + persistence + breadth
          — not a predictive probability. Window-tier labels (S-win / M-win / L-win /
          XL-win) reflect canonical pattern length only. Methodology and known
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

      {/* ============== Preset chip strip (V2-A tabs folded — URL-state stub) ============== */}
      <div
        role="group"
        aria-label="Quick presets"
        className="flex gap-2 flex-wrap mb-4 overflow-x-auto"
      >
        <span
          className="text-[9px] tracking-widest uppercase self-center"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Quick presets
        </span>
        {PRESET_CHIPS.map((c) => {
          const active = activePreset === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActivePreset(active ? null : c.id)}
              aria-pressed={active}
              title={c.tooltip}
              className="px-3 py-1.5 rounded-full text-[10px] tracking-wider uppercase font-data font-semibold border whitespace-nowrap transition-all"
              style={{
                backgroundColor: active ? "rgba(99, 102, 241, 0.15)" : "transparent",
                borderColor: active ? "rgba(99, 102, 241, 0.35)" : "var(--qgi-border)",
                color: active ? "#a5b4fc" : "var(--qgi-text-muted)",
              }}
            >
              {c.label}
            </button>
          );
        })}
        {activePreset && (
          <span
            className="text-[9px] tracking-widest uppercase self-center"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            (Preview — facet rail lands in PR #2)
          </span>
        )}
      </div>

      {/* ============== Filter strip ============== */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center flex-wrap">
        <div
          role="radiogroup"
          aria-label="Filter by window tier"
          className="flex items-center gap-1.5"
        >
          <span
            className="text-[9px] tracking-widest uppercase mr-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Window
          </span>
          {(["ALL", "XL-win", "L-win", "M-win", "S-win"] as const).map((t) => {
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
                        ? "var(--qgi-text-muted)"
                        : "var(--qgi-border)"
                  }`,
                }}
              >
                {t === "ALL" ? "ALL" : meta?.label}
                {t !== "ALL" && (
                  <span className="ml-1.5 text-[9px] opacity-70">{tierCounts[t]}</span>
                )}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          aria-label="Search country pair"
          placeholder="Search country pair..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-md border bg-transparent text-xs flex-1 min-w-0"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        />

        <div className="flex items-center gap-1">
          <span
            className="text-[9px] tracking-widest uppercase mr-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Sort
          </span>
          <select
            value={sortCol}
            onChange={(e) => setSortCol(e.target.value as SortColumn)}
            className="px-2 py-1.5 rounded border bg-transparent text-[11px]"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-muted)",
            }}
          >
            <option value="pattern_power_score">Pattern Power Score</option>
            <option value="avg_correlation">Correlation</option>
            <option value="pattern_length">Pattern length</option>
            <option value="window_tier">Window tier</option>
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
                ? "Ascending — click to flip to descending"
                : "Descending — click to flip to ascending"
            }
            aria-label={
              sortDir === "asc"
                ? "Sort direction ascending; click to flip to descending"
                : "Sort direction descending; click to flip to ascending"
            }
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <span className="text-xs font-data" style={{ color: "var(--qgi-text-dim)" }}>
          Showing {sorted.length} of {rows.length}
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
        <div
          className="hidden md:grid items-center px-4 py-2.5 text-[10px] tracking-widest uppercase gap-x-2"
          style={{
            gridTemplateColumns: "2.5fr 90px 100px 110px 90px",
            color: "var(--qgi-text-dim)",
            borderBottom: "1px solid var(--qgi-border)",
            backgroundColor: "var(--qgi-surface-2)",
          }}
        >
          <span>Country pair</span>
          <span>Window</span>
          <span className="text-right">Correlation</span>
          <span className="text-right">Power</span>
          <span className="text-right">Length</span>
        </div>

        {sorted.length === 0 ? (
          <div
            className="text-center py-12 text-sm"
            role="status"
            aria-live="polite"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            <p className="mb-3">No patterns match these filters.</p>
            {(search || tierFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearch("");
                  setTierFilter("ALL");
                }}
                className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border"
                style={{
                  borderColor: "var(--qgi-border)",
                  color: "var(--qgi-text-muted)",
                }}
              >
                Clear all filters →
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
            {sorted.map((row, idx) => (
              <PatternRowComponent key={row.row_key} row={row} rank={idx + 1} />
            ))}
          </ul>
        )}
      </div>

      <p
        className="mt-3 text-[10px] tracking-widest uppercase text-center"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        V1.9.1 scoring · Generated {generatedDate} ·{" "}
        <Link href={"/methodology" as Route} className="underline underline-offset-2">
          Methodology →
        </Link>
      </p>
    </div>
  );
}

function PatternRowComponent({ row, rank }: { row: PatternsMergedRow; rank: number }) {
  const meta = TIER_META[row.window_tier];
  const aSlug = countrySlug(row.country_a) ?? row.country_a.toLowerCase();
  const bSlug = countrySlug(row.country_b) ?? row.country_b.toLowerCase();
  // PR #3 will introduce /patterns-merged/[slug] detail pages; for now we
  // route to V1 /patterns?focus={a}-{b}-{startA} as a stub.
  const detailHref = `/patterns?focus=${aSlug}-${bSlug}` as Route;
  return (
    <li>
      <Link
        href={detailHref}
        className="px-4 py-3 grid items-center gap-x-2 transition-colors hover:bg-[color:var(--qgi-surface-2)]"
        style={{
          gridTemplateColumns: "2.5fr 90px 100px 110px 90px",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[9px] tracking-widest uppercase font-data tabular-nums w-6"
            style={{
              color: rank <= 3 ? "rgba(245, 158, 11, 0.85)" : "var(--qgi-text-dim)",
            }}
          >
            #{rank}
          </span>
          <span
            className="text-xs font-medium truncate"
            style={{ color: "var(--qgi-text)" }}
            title={row.country_a}
          >
            {row.country_a}
          </span>
          <span
            className="text-[10px]"
            style={{ color: "var(--qgi-text-dim)" }}
            aria-hidden="true"
          >
            →
          </span>
          <span
            className="text-xs font-medium truncate"
            style={{ color: "var(--qgi-text)" }}
            title={row.country_b}
          >
            {row.country_b}
          </span>
          <span
            className="text-[10px] font-data tabular-nums whitespace-nowrap"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {row.start_year_a}–{row.start_year_b}
          </span>
        </div>

        <div
          className="text-[10px] tracking-wider uppercase font-semibold font-data text-center px-2 py-1 rounded w-fit"
          title={meta.tooltip}
          style={{
            backgroundColor: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
          }}
        >
          {meta.label}
        </div>

        <div
          className="text-right text-sm font-data tabular-nums"
          style={{ color: "var(--qgi-text)" }}
          title={`Pearson correlation across ${row.num_indexes} shared indicators.`}
        >
          {(row.avg_correlation * 100).toFixed(1)}%
        </div>

        <div
          className="text-right text-sm font-data tabular-nums"
          style={{ color: "var(--qgi-text)" }}
          title="Pattern Power Score — composite of correlation, persistence, and breadth."
        >
          {row.pattern_power_score.toFixed(0)}
        </div>

        <div
          className="text-right text-sm font-data tabular-nums"
          style={{ color: "var(--qgi-text-muted)" }}
          title={`Pattern length in years (${row.pattern_length}-year window).`}
        >
          {row.pattern_length}y
        </div>
      </Link>
    </li>
  );
}
