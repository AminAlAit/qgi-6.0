"use client";

/**
 * CountriesV2TableClient — Dense analyst table for /countries-v2-table
 *
 * Design: Elif Şahin-Moreau + Rodrigo Vasconcelos-Kwok
 * Density-first, terminal-grade. No hand-holding.
 *
 * Sortable on every column. Shift-click for multi-column sort.
 * Filterable: tier, region, ML coverage min, activity min.
 * Sparkline trend column (Tufte small-multiples).
 * Tier color on tier cell only — rest monochrome.
 *
 * MOCK data: activity (events last 12 mo), ML coverage (0–4 recipes),
 *            trend (5 quarterly deltas), region. All tagged // MOCK.
 */

import { useMemo, useReducer } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
import { countrySlug } from "@/lib/slug";
import type { CountryRisk, RiskTier } from "@/lib/country-risks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CountryEntry {
  id: string;
  name: string;
  alpha_2: string;
  curated: boolean;
  overall_risk_tier: RiskTier;
  tiers: CountryRisk["tiers"];
}

type ColId = "name" | "tier" | "top_cat" | "activity" | "ml_cov" | "trend" | "updated";

interface SortSpec {
  col: ColId;
  dir: "asc" | "desc";
}

interface FilterState {
  tier: RiskTier | "ALL";
  region: string;
  mlCovMin: number;
  activityMin: number;
  query: string;
}

// ---------------------------------------------------------------------------
// Mock data generation (deterministic on country id for stable SSR → CSR)
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random seeded on a string */
function seededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(16807, h) | 0;
    return (h >>> 0) / 0xffffffff;
  };
}

/** MOCK: activity count (events last 12 months, 0–48) */
function mockActivity(id: string, tier: RiskTier): number {
  const rng = seededRng(`act:${id}`);
  const base = tier === "HIGH" ? 18 : tier === "MODERATE" ? 9 : 3;
  return Math.round(base + rng() * base * 1.5);
}

/** MOCK: ML coverage (0–4 LOCKed recipes measured for this country) */
function mockMlCoverage(id: string): number {
  const rng = seededRng(`ml:${id}`);
  return Math.floor(rng() * 5); // 0–4
}

/** MOCK: trend sparkline — 6 quarterly risk scores (0–100) */
function mockTrend(id: string, tier: RiskTier): number[] {
  const rng = seededRng(`trend:${id}`);
  const base = tier === "HIGH" ? 70 : tier === "MODERATE" ? 45 : 25;
  const pts: number[] = [];
  let v = base + (rng() - 0.5) * 20;
  for (let i = 0; i < 6; i++) {
    v = Math.max(0, Math.min(100, v + (rng() - 0.5) * 12));
    pts.push(Math.round(v));
  }
  return pts;
}

/** MOCK: region assignment */
const REGIONS: Record<string, string> = {};
const REGION_LIST = [
  "Sub-Saharan Africa",
  "Middle East & N. Africa",
  "Europe",
  "Asia-Pacific",
  "South Asia",
  "Americas",
  "Central Asia",
];
function mockRegion(id: string): string {
  if (REGIONS[id]) return REGIONS[id];
  const rng = seededRng(`region:${id}`);
  const r = REGION_LIST[Math.floor(rng() * REGION_LIST.length)];
  REGIONS[id] = r;
  return r;
}

/** MOCK: last updated date (within past 18 months) */
function mockUpdated(id: string): string {
  const rng = seededRng(`upd:${id}`);
  const daysAgo = Math.floor(rng() * 540);
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tier display
// ---------------------------------------------------------------------------

const TIER_META: Record<
  RiskTier,
  { label: string; color: string; bg: string; border: string }
> = {
  HIGH: {
    label: "HIGH",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.35)",
  },
  MODERATE: {
    label: "MOD",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
  },
  INDICATIVE: {
    label: "IND",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
    border: "rgba(56,189,248,0.35)",
  },
};

const TIER_ORDER: Record<RiskTier, number> = { HIGH: 0, MODERATE: 1, INDICATIVE: 2 };

// ---------------------------------------------------------------------------
// ML coverage dots
// ---------------------------------------------------------------------------
function MlCoverageDots({ count }: { count: number }) {
  return (
    <span className="flex gap-[3px] items-center">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: i < count ? "#38bdf8" : "var(--qgi-border)",
          }}
        />
      ))}
      <span
        className="font-data ml-1 text-[10px]"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {count}/4
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sparkline (Tufte small-multiples — SVG micro-chart, no axes, no labels)
// ---------------------------------------------------------------------------
function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const W = 52;
  const H = 16;
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
  const trendColor =
    last > prev + 3 ? "#f87171" : last < prev - 3 ? "#34d399" : "#7a90a8";
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke={trendColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={1.6} fill={trendColor} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Top category extractor
// ---------------------------------------------------------------------------
function topCategory(country: CountryEntry): string {
  let best = { label: "—", score: -999 };
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories.slice(0, 3)) {
      const score = cat.salience_score ?? cat.z_score;
      if (score > best.score) best = { label: cat.category, score };
    }
  }
  return best.label;
}

// ---------------------------------------------------------------------------
// Sort reducer
// ---------------------------------------------------------------------------
function toggleSort(prev: SortSpec[], col: ColId, shift: boolean): SortSpec[] {
  if (!shift) {
    const existing = prev.find((s) => s.col === col);
    if (existing && existing.dir === "desc") return [{ col, dir: "asc" }];
    if (existing && existing.dir === "asc") return [];
    return [{ col, dir: "desc" }];
  }
  // Multi-column: toggle or append
  const idx = prev.findIndex((s) => s.col === col);
  if (idx === -1) return [...prev, { col, dir: "desc" }];
  const updated = [...prev];
  if (updated[idx].dir === "desc") {
    updated[idx] = { col, dir: "asc" };
    return updated;
  }
  updated.splice(idx, 1);
  return updated;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CountriesV2TableClient({ countries }: { countries: CountryEntry[] }) {
  const [sorts, setSorts] = useReducer(
    (prev: SortSpec[], action: { col: ColId; shift: boolean }) =>
      toggleSort(prev, action.col, action.shift),
    [{ col: "tier", dir: "desc" }]
  );

  const [filter, setFilter] = useReducer(
    (prev: FilterState, patch: Partial<FilterState>) => ({ ...prev, ...patch }),
    { tier: "ALL", region: "ALL", mlCovMin: 0, activityMin: 0, query: "" }
  );

  // Augment each country with mock fields
  const augmented = useMemo(
    () =>
      countries.map((c) => ({
        ...c,
        topCat: topCategory(c),
        activity: mockActivity(c.id, c.overall_risk_tier), // MOCK
        mlCov: mockMlCoverage(c.id), // MOCK
        trend: mockTrend(c.id, c.overall_risk_tier), // MOCK
        region: mockRegion(c.id), // MOCK
        updated: mockUpdated(c.id), // MOCK
      })),
    [countries]
  );

  const regions = useMemo(
    () => ["ALL", ...Array.from(new Set(augmented.map((c) => c.region))).sort()],
    [augmented]
  );

  const filtered = useMemo(() => {
    return augmented.filter((c) => {
      if (filter.tier !== "ALL" && c.overall_risk_tier !== filter.tier) return false;
      if (filter.region !== "ALL" && c.region !== filter.region) return false;
      if (c.mlCov < filter.mlCovMin) return false;
      if (c.activity < filter.activityMin) return false;
      if (filter.query) {
        const q = filter.query.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.alpha_2.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [augmented, filter]);

  const sorted = useMemo(() => {
    if (!sorts.length) return filtered;
    return [...filtered].sort((a, b) => {
      for (const { col, dir } of sorts) {
        let diff = 0;
        switch (col) {
          case "name":
            diff = a.name.localeCompare(b.name);
            break;
          case "tier":
            diff = TIER_ORDER[a.overall_risk_tier] - TIER_ORDER[b.overall_risk_tier];
            break;
          case "top_cat":
            diff = a.topCat.localeCompare(b.topCat);
            break;
          case "activity":
            diff = a.activity - b.activity;
            break;
          case "ml_cov":
            diff = a.mlCov - b.mlCov;
            break;
          case "trend": {
            const aLast = a.trend[a.trend.length - 1] ?? 0;
            const bLast = b.trend[b.trend.length - 1] ?? 0;
            diff = aLast - bLast;
            break;
          }
          case "updated":
            diff = a.updated.localeCompare(b.updated);
            break;
        }
        if (diff !== 0) return dir === "desc" ? -diff : diff;
      }
      return 0;
    });
  }, [filtered, sorts]);

  const sortIndicator = (col: ColId): string => {
    const idx = sorts.findIndex((s) => s.col === col);
    if (idx === -1) return "";
    const s = sorts[idx];
    const prefix = sorts.length > 1 ? `${idx + 1}` : "";
    return prefix + (s.dir === "desc" ? " ↓" : " ↑");
  };

  const colHeader = (col: ColId, label: string, align?: "right") => (
    <th
      className={`px-3 py-2 text-[10px] tracking-widest uppercase cursor-pointer select-none whitespace-nowrap${align === "right" ? " text-right" : ""}`}
      style={{
        color: sorts.some((s) => s.col === col)
          ? "var(--qgi-text)"
          : "var(--qgi-text-dim)",
        borderBottom: "1px solid var(--qgi-border)",
      }}
      onClick={(e) => setSorts({ col, shift: e.shiftKey })}
      title="Click to sort · Shift+click for multi-column"
    >
      {label}
      {sortIndicator(col) && (
        <span className="ml-1 font-data" style={{ color: "var(--qgi-accent)" }}>
          {sortIndicator(col)}
        </span>
      )}
    </th>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[10px] tracking-widest uppercase mb-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            V2 design exploration · Sibling A (table)
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--qgi-text)" }}>
            Country risk table
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--qgi-text-dim)" }}>
            {sorted.length} of {augmented.length} countries ·{" "}
            <span style={{ color: "var(--qgi-text-muted)" }}>
              activity + ML coverage + trend are MOCK data
            </span>
          </p>
        </div>
        <div className="flex gap-3 text-[11px]" style={{ color: "var(--qgi-text-dim)" }}>
          <Link href="/countries" style={{ color: "var(--qgi-text-dim)" }}>
            ← V1 cards
          </Link>
          <span>·</span>
          <Link href="/countries-v2-narrative" style={{ color: "var(--qgi-text-dim)" }}>
            V2 narrative →
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Filter bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="mb-4 flex flex-wrap gap-3 items-center p-3 rounded-lg border"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search country…"
          value={filter.query}
          onChange={(e) => setFilter({ query: e.target.value })}
          className="font-data text-xs rounded px-2 py-1 outline-none"
          style={{
            backgroundColor: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            color: "var(--qgi-text)",
            width: 140,
          }}
        />

        {/* Tier buttons */}
        <div className="flex gap-1">
          {(["ALL", "HIGH", "MODERATE", "INDICATIVE"] as const).map((t) => {
            const active = filter.tier === t;
            const meta = t !== "ALL" ? TIER_META[t] : null;
            return (
              <button
                key={t}
                onClick={() => setFilter({ tier: t })}
                className="font-data text-[10px] px-2 py-1 rounded tracking-wide transition-colors"
                style={{
                  border: `1px solid ${active && meta ? meta.border : "var(--qgi-border)"}`,
                  backgroundColor: active && meta ? meta.bg : "transparent",
                  color: active && meta ? meta.color : "var(--qgi-text-muted)",
                }}
              >
                {t === "ALL"
                  ? "ALL"
                  : t === "MODERATE"
                    ? "MOD"
                    : t === "INDICATIVE"
                      ? "IND"
                      : t}
              </button>
            );
          })}
        </div>

        {/* Region */}
        <select
          value={filter.region}
          onChange={(e) => setFilter({ region: e.target.value })}
          className="font-data text-[10px] rounded px-2 py-1 outline-none"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            color: "var(--qgi-text-muted)",
          }}
        >
          {regions.map((r) => (
            <option key={r} value={r}>
              {r === "ALL" ? "All regions" : r}
            </option>
          ))}
        </select>

        {/* ML coverage min */}
        <label
          className="flex items-center gap-1 text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          ML cov ≥
          <select
            value={filter.mlCovMin}
            onChange={(e) => setFilter({ mlCovMin: Number(e.target.value) })}
            className="font-data rounded px-1 py-1 outline-none ml-1"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              color: "var(--qgi-text-muted)",
              fontSize: 10,
            }}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Activity min */}
        <label
          className="flex items-center gap-1 text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Activity ≥
          <select
            value={filter.activityMin}
            onChange={(e) => setFilter({ activityMin: Number(e.target.value) })}
            className="font-data rounded px-1 py-1 outline-none ml-1"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              color: "var(--qgi-text-muted)",
              fontSize: 10,
            }}
          >
            {[0, 5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Reset */}
        {(filter.tier !== "ALL" ||
          filter.region !== "ALL" ||
          filter.mlCovMin > 0 ||
          filter.activityMin > 0 ||
          filter.query) && (
          <button
            onClick={() =>
              setFilter({
                tier: "ALL",
                region: "ALL",
                mlCovMin: 0,
                activityMin: 0,
                query: "",
              })
            }
            className="text-[10px] px-2 py-1 rounded"
            style={{
              color: "var(--qgi-text-dim)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            Reset
          </button>
        )}

        {sorts.length > 1 && (
          <span className="text-[10px] ml-auto" style={{ color: "var(--qgi-text-dim)" }}>
            Multi-sort active — shift+click to add/remove columns
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Table                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="rounded-lg border overflow-x-auto"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <table className="w-full border-collapse text-xs" style={{ minWidth: 820 }}>
          <thead>
            <tr style={{ backgroundColor: "var(--qgi-surface)" }}>
              {colHeader("name", "Country")}
              {colHeader("tier", "Tier")}
              {colHeader("top_cat", "Top category")}
              {colHeader("activity", "Activity (12m)", "right")}
              {colHeader("ml_cov", "ML cov")}
              {colHeader("trend", "Trend (6q)")}
              {colHeader("updated", "Updated")}
              <th
                className="px-3 py-2 text-[10px] tracking-widest uppercase"
                style={{
                  color: "var(--qgi-text-dim)",
                  borderBottom: "1px solid var(--qgi-border)",
                }}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const href = `/countries-v2-table/${countrySlug(c.name) ?? c.id}`;
              const tierMeta = TIER_META[c.overall_risk_tier];
              const trendLast = c.trend[c.trend.length - 1] ?? 50;
              const trendPrev = c.trend[c.trend.length - 2] ?? trendLast;
              const trendDelta = trendLast - trendPrev;
              return (
                <tr
                  key={c.id}
                  style={{
                    borderTop: i === 0 ? undefined : "1px solid var(--qgi-border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                  }}
                  className="transition-colors hover:bg-[var(--qgi-surface)]"
                  onClick={() => (window.location.href = href)}
                >
                  {/* Country */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CountryFlag alpha2={c.alpha_2} size={14} ariaHidden />
                      <span
                        className="font-semibold leading-tight"
                        style={{ color: "var(--qgi-text)" }}
                      >
                        {c.name}
                      </span>
                      {!c.curated && (
                        <span
                          className="font-data text-[9px] px-1 rounded"
                          style={{
                            color: "var(--qgi-text-dim)",
                            border: "1px solid var(--qgi-border)",
                          }}
                        >
                          uncurated
                        </span>
                      )}
                    </div>
                    <div
                      className="font-data text-[9px] mt-0.5 ml-5"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {c.region} {/* MOCK */}
                    </div>
                  </td>

                  {/* Tier */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className="font-data font-semibold tracking-wider px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        color: tierMeta.color,
                        backgroundColor: tierMeta.bg,
                        border: `1px solid ${tierMeta.border}`,
                      }}
                    >
                      {tierMeta.label}
                    </span>
                  </td>

                  {/* Top category */}
                  <td className="px-3 py-2 max-w-[180px]">
                    <span
                      className="truncate block text-[11px]"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {c.topCat}
                    </span>
                  </td>

                  {/* Activity (12m) — MOCK */}
                  <td className="px-3 py-2 text-right">
                    <span
                      className="font-data tabular-nums text-[11px]"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {c.activity}
                    </span>
                  </td>

                  {/* ML coverage — MOCK */}
                  <td className="px-3 py-2">
                    <MlCoverageDots count={c.mlCov} />
                  </td>

                  {/* Trend sparkline — MOCK */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Sparkline data={c.trend} />
                      <span
                        className="font-data text-[10px] tabular-nums"
                        style={{
                          color:
                            trendDelta > 3
                              ? "#f87171"
                              : trendDelta < -3
                                ? "#34d399"
                                : "var(--qgi-text-dim)",
                        }}
                      >
                        {trendDelta > 0 ? "+" : ""}
                        {trendDelta}
                      </span>
                    </div>
                  </td>

                  {/* Updated — MOCK */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className="font-data text-[10px]"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {c.updated}
                    </span>
                  </td>

                  {/* Drill-in arrow */}
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={href as "/countries-v2-table/[country]"}
                      className="text-[10px]"
                      style={{ color: "var(--qgi-text-dim)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-xs"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  No countries match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="mt-8 pt-5 text-[10px] border-t"
        style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
      >
        <p>
          Risk tiers from V1.9.1 scoring · Composite = max(L1) per Phase 3 decision ·{" "}
          <span style={{ color: "var(--qgi-text-muted)" }}>
            Activity, ML coverage, Trend, Region: MOCK DATA (pre-integration)
          </span>{" "}
          · Click any row for full dossier ·{" "}
          <Link href="/methodology" style={{ color: "var(--qgi-text-dim)" }}>
            Methodology →
          </Link>
        </p>
      </footer>
    </div>
  );
}
