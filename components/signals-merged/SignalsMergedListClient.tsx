"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CountryFlag } from "@/components/design/CountryFlag";
import { countrySlug } from "@/lib/slug";
import { L1_GROUPS } from "@/lib/category-taxonomy";
import type { SignalRow, SignalTier } from "@/app/(app)/signals-merged/page";

/**
 * Merged Signals list shell — Build PR #1 of 5 (A3 Family 3 merger brief).
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 3 — Signals)
 *
 * Scope of PR #1:
 *   - H1 "Signals" + eyebrow "Currently firing — {date}" + 1-line metric
 *     strip (live tier counts)
 *   - Lloyd's-style methodology disclosure banner
 *   - Filter strip: search + tier buttons + domain multi-select + lineage
 *     filter + curated-only toggle (skeleton — lineage filtering arrives
 *     with the ML-recipe join in PR #4)
 *   - 71-row main table with 5 cols (CATEGORY · TIER · MAX SALIENCE ·
 *     COUNTRIES FIRING · TOP COUNTRIES)
 *
 * Deferred to PR #2: "5 firing now" curated band; full 7-col table
 * (LINEAGE pill, regional distribution sparkbar)
 * Deferred to PR #3: per-country watchlist /signals-merged/[country]
 * Deferred to PR #4: per-(country, recipe) leaf with split-render by lineage
 * Deferred to PR #5 (founder-gated): cutover
 */

const TIER_META: Record<
  SignalTier,
  { label: string; color: string; bg: string; border: string; tooltip: string }
> = {
  HIGH: {
    label: "HIGH",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.35)",
    tooltip:
      "Max-salience ≥ 2.5σ over baseline. Source: Signals engine V1 / quantity: max-salience-z. Threshold: max-salience-z ≥ 2.5.",
  },
  MODERATE: {
    label: "MODERATE",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
    tooltip:
      "Max-salience 1.0–2.5σ over baseline. Statistical aggregation, not ML-validated.",
  },
  INDICATIVE: {
    label: "INDICATIVE",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
    border: "rgba(56,189,248,0.35)",
    tooltip: "Max-salience below 1.0σ over baseline. Background-level firing.",
  },
};

const TIER_ORDER: Record<SignalTier, number> = {
  HIGH: 0,
  MODERATE: 1,
  INDICATIVE: 2,
};

type SortColumn = "tier" | "category" | "max_salience" | "firing_count";
type SortDir = "asc" | "desc";

function sortRows(rows: SignalRow[], col: SortColumn, dir: SortDir): SignalRow[] {
  const arr = [...rows];
  const mul = dir === "asc" ? 1 : -1;
  switch (col) {
    case "category":
      arr.sort((a, b) => mul * a.category.localeCompare(b.category));
      break;
    case "tier":
      arr.sort((a, b) => mul * (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]));
      break;
    case "max_salience":
      arr.sort((a, b) => mul * (a.max_salience - b.max_salience));
      break;
    case "firing_count":
      arr.sort((a, b) => mul * (a.firing_count - b.firing_count));
      break;
  }
  return arr;
}

export function SignalsMergedListClient({
  signals,
  tierCounts,
  totalCountries,
  generatedDate,
}: {
  signals: SignalRow[];
  tierCounts: Record<SignalTier, number>;
  totalCountries: number;
  /** ISO yyyy-mm-dd, computed server-side for hydration stability. */
  generatedDate: string;
}) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"ALL" | SignalTier>("ALL");
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<SortColumn>("max_salience");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const domainCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of signals) {
      if (s.l1) c[s.l1.code] = (c[s.l1.code] ?? 0) + 1;
    }
    return c;
  }, [signals]);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.display_name.toLowerCase().includes(q) &&
          !s.category.toLowerCase().includes(q) &&
          !(s.l1?.label.toLowerCase().includes(q) ?? false)
        ) {
          return false;
        }
      }
      if (tierFilter !== "ALL" && s.tier !== tierFilter) return false;
      if (activeDomains.size > 0 && !(s.l1 && activeDomains.has(s.l1.code))) {
        return false;
      }
      return true;
    });
  }, [signals, search, tierFilter, activeDomains]);

  const sorted = useMemo(
    () => sortRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir]
  );

  const toggleDomain = (code: string) => {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const firingTotal = tierCounts.HIGH + tierCounts.MODERATE; // categories above background

  return (
    <div className="p-6 lg:p-8">
      {/* ============== Header ============== */}
      <div className="mb-5">
        <div
          className="text-[10px] tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Currently firing — {generatedDate}
        </div>
        <h1
          className="text-2xl font-semibold leading-snug"
          style={{ color: "var(--qgi-text)" }}
        >
          Signals
        </h1>
        <p
          className="text-xs mt-2 font-data tabular-nums"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {signals.length} categories tracked · {firingTotal} firing across{" "}
          {totalCountries} countries · v1.9.1 scoring
        </p>
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
          Signals shown are output from QGI&apos;s pattern-matching pipeline. Tier values
          (HIGH / MODERATE / INDICATIVE) reflect max-salience-z thresholds across firing
          countries — relative position, not a probabilistic forecast. Hover any tier
          badge for the rubric. Methodology and known limitations:{" "}
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

      {/* ============== Filter strip ============== */}
      <div
        role="group"
        aria-label="Filter by domain"
        className="flex gap-2 flex-wrap mb-3"
      >
        {L1_GROUPS.map((g) => {
          const active = activeDomains.has(g.code);
          const count = domainCounts[g.code] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={g.code}
              onClick={() => toggleDomain(g.code)}
              aria-pressed={active}
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

      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center flex-wrap">
        {/* Tier chip group — single-select */}
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
          placeholder="Search category or domain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded border text-sm flex-1 max-w-md outline-none transition-colors focus:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        />

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
            <option value="max_salience">Max salience</option>
            <option value="tier">Tier</option>
            <option value="firing_count">Firing count</option>
            <option value="category">Category (A→Z)</option>
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
          Showing {sorted.length} of {signals.length}
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
            gridTemplateColumns: "2fr 110px 90px 90px 1.5fr",
            color: "var(--qgi-text-dim)",
            borderBottom: "1px solid var(--qgi-border)",
            backgroundColor: "var(--qgi-surface-2)",
          }}
        >
          <span>Category</span>
          <span>Tier</span>
          <span className="text-right">Max salience</span>
          <span className="text-right">Firing</span>
          <span>Top countries</span>
        </div>

        {sorted.length === 0 ? (
          <div
            className="text-center py-12 text-sm"
            role="status"
            aria-live="polite"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            No signals match these filters.
          </div>
        ) : (
          sorted.map((s, idx) => (
            <SignalRowComponent
              key={s.category}
              row={s}
              isLast={idx === sorted.length - 1}
            />
          ))
        )}
      </div>

      <p className="text-[10px] mt-4 font-data" style={{ color: "var(--qgi-text-dim)" }}>
        V1.9.1 scoring · Max-salience-z thresholds: HIGH ≥ 2.5, MODERATE ≥ 1.0, INDICATIVE
        &lt; 1.0 ·{" "}
        <Link
          href={"/methodology" as Route}
          className="underline underline-offset-2 hover:text-[var(--qgi-text-muted)]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Methodology →
        </Link>
        {" · "}
        <span style={{ color: "var(--qgi-text-muted)" }}>
          Preview shell — V1 + V2-A + V2-B routes remain live until founder cutover.
        </span>
      </p>
    </div>
  );
}

function SignalRowComponent({ row, isLast }: { row: SignalRow; isLast: boolean }) {
  const meta = TIER_META[row.tier];
  // Detail-link routing until PR #3 lands /signals-merged/[country]:
  // for now point at the V1 signals master (filtered by recipe slug) so
  // the row remains clickable.
  const detailHref = `/signals?recipe=${row.category}` as Route;
  return (
    <Link
      href={detailHref}
      className="block transition-colors hover:bg-[var(--qgi-surface-2)] group"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${row.l1?.color ?? "var(--qgi-border)"}`,
      }}
    >
      {/* Mobile (compressed) */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text)" }}
          >
            {row.display_name}
          </span>
          {row.l1 && (
            <span
              className="text-[9px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded"
              style={{ color: row.l1.color, backgroundColor: `${row.l1.color}18` }}
            >
              {row.l1.shortLabel}
            </span>
          )}
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
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: "var(--qgi-text-muted)" }}>
            <span className="font-data" style={{ color: "var(--qgi-text)" }}>
              {row.max_salience.toFixed(2)}σ
            </span>{" "}
            max
          </span>
          <span style={{ color: "var(--qgi-text-muted)" }}>
            <span className="font-data" style={{ color: "var(--qgi-text)" }}>
              {row.firing_count}
            </span>{" "}
            countries
          </span>
        </div>
      </div>

      {/* Desktop 5-col grid */}
      <div
        className="hidden md:grid items-center px-4 py-3 gap-x-2"
        style={{ gridTemplateColumns: "2fr 110px 90px 90px 1.5fr" }}
      >
        {/* CATEGORY */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm truncate group-hover:text-[var(--qgi-accent)] transition-colors font-medium"
            style={{ color: "var(--qgi-text)" }}
          >
            {row.display_name}
          </span>
          {row.l1 && (
            <span
              className="text-[9px] tracking-widest uppercase font-medium px-1 rounded shrink-0"
              style={{ color: row.l1.color, backgroundColor: `${row.l1.color}18` }}
              title={row.l1.label}
            >
              {row.l1.shortLabel}
            </span>
          )}
        </div>

        {/* TIER */}
        <span>
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
        </span>

        {/* MAX SALIENCE */}
        <span
          className="text-right font-data text-[11px] tabular-nums"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {row.max_salience.toFixed(2)}σ
        </span>

        {/* FIRING COUNT */}
        <span
          className="text-right font-data text-[11px] tabular-nums"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {row.firing_count}
        </span>

        {/* TOP COUNTRIES */}
        <div className="flex items-center gap-2 min-w-0">
          {row.top_countries.slice(0, 3).map((c) => {
            const cslug = countrySlug(c.name) ?? c.alpha_2.toLowerCase();
            return (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 shrink-0"
                title={`${c.name}: ${c.salience.toFixed(2)}σ`}
              >
                <CountryFlag alpha2={c.alpha_2} size={12} />
                <span
                  className="text-[10px] truncate"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {cslug}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
