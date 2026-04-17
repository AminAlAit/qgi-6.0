"use client";

/**
 * PatternsClient V2 — Promoted from prototype to official.
 *
 * Two views:
 *   1. Landing (S0): Top global pairs table from ranking cache
 *   2. Detail: V2 hero card + timeline ribbon + expandable SCDI cards + align toggle
 *
 * The cascade filter remains available for manual pattern discovery.
 * Clicking a row in the S0 table navigates to the detail view.
 */

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { CascadeFilter, type PatternSelection } from "@/components/patterns/CascadeFilter";
import { ScdiTable } from "@/components/patterns/ScdiTable";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import {
  TRANSFORMATION_LABELS,
  type Transformation,
} from "@/lib/transforms";
import { sectorColor } from "@/lib/design";
import type { PatternRow } from "@/lib/types";
import countriesList from "@/data/countries.json";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

// IndexChart kept available for potential future per-indicator deep-dive
// const IndexChart = dynamic(
//   () => import("@/components/patterns/IndexChart").then((m) => m.IndexChart),
//   { ssr: false }
// );

/* ------------------------------------------------------------------ */
/*  Country lookup                                                     */
/* ------------------------------------------------------------------ */

const ALPHA2_MAP: Record<string, string> = {};
const NAME_TO_ALPHA2: Record<string, string> = {};
for (const c of countriesList as Array<{ id: string; name: string; alpha_2: string }>) {
  ALPHA2_MAP[c.id] = c.alpha_2;
  NAME_TO_ALPHA2[c.name] = c.alpha_2;
}

function getAlpha2(idOrName: string | undefined, name: string): string {
  if (idOrName && ALPHA2_MAP[idOrName]) return ALPHA2_MAP[idOrName];
  if (NAME_TO_ALPHA2[name]) return NAME_TO_ALPHA2[name];
  return "";
}

/* ------------------------------------------------------------------ */
/*  PPS color helpers                                                  */
/* ------------------------------------------------------------------ */

const PPS_QUINTILES = [
  { label: "Very weak", min: 0, max: 0.5, color: "#4a6280" },
  { label: "Weak", min: 0.5, max: 0.65, color: "#7a90a8" },
  { label: "Moderate", min: 0.65, max: 0.75, color: "#fbbf24" },
  { label: "Strong", min: 0.75, max: 0.85, color: "#fb923c" },
  { label: "Very strong", min: 0.85, max: 1.0, color: "#f87171" },
];

function ppsLabel(pps: number): string {
  if (pps >= 0.85) return "Very Strong";
  if (pps >= 0.75) return "Strong";
  if (pps >= 0.65) return "Moderate";
  if (pps >= 0.5) return "Weak";
  return "Very Weak";
}

function ppsColor(pps: number): string {
  if (pps >= 0.85) return "#f87171";
  if (pps >= 0.75) return "#fb923c";
  if (pps >= 0.65) return "#fbbf24";
  if (pps >= 0.5) return "#7a90a8";
  return "#4a6280";
}

function rawPpsColor(pps: number): string {
  if (pps >= 1500) return "#f87171";
  if (pps >= 1000) return "#fb923c";
  if (pps >= 500) return "#fbbf24";
  return "#7a90a8";
}

function corrColor(r: number): string {
  if (r >= 0.90) return "#f87171";
  if (r >= 0.85) return "#fb923c";
  if (r >= 0.80) return "#fbbf24";
  return "#7a90a8";
}

/* ------------------------------------------------------------------ */
/*  Sector colors for SCDI cards                                       */
/* ------------------------------------------------------------------ */

const SECTOR_COLORS: Record<string, string> = {
  Demographic: "#fbbf24",
  Health: "#fb923c",
  Economic: "#38bdf8",
  Trade: "#34d399",
  Education: "#a78bfa",
  Infrastructure: "#f472b6",
  Environment: "#22d3ee",
};

function getSectorColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? sectorColor(sector) ?? "#7a90a8";
}

/* ------------------------------------------------------------------ */
/*  Pattern detail type                                                */
/* ------------------------------------------------------------------ */

interface PatternDetail {
  metadata: Record<string, string>;
  scdis: {
    index_name: string;
    sector: string;
    org: string;
    correlation: number;
    predicted: boolean;
    values_a: number[];
    values_b: number[];
  }[];
}

/* ------------------------------------------------------------------ */
/*  Timeline helpers                                                   */
/* ------------------------------------------------------------------ */

function yearToPercent(year: number, start: number, end: number): number {
  return ((year - start) / (end - start)) * 100;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function PatternsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial: Partial<PatternSelection> = {
    country_a: searchParams.get("country_a") ?? undefined,
    country_b: searchParams.get("country_b") ?? undefined,
    length: searchParams.get("length") ? Number(searchParams.get("length")) : undefined,
    start_a: searchParams.get("start_a") ? Number(searchParams.get("start_a")) : undefined,
    start_b: searchParams.get("start_b") ? Number(searchParams.get("start_b")) : undefined,
  };

  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transformation, setTransformation] = useState<Transformation>("raw");
  const [align, setAlign] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(true);
  const [showTable, setShowTable] = useState(true);

  // S0 landing: top pairs from ranking cache
  const [topPairs, setTopPairs] = useState<PatternRow[]>([]);
  const [landingLoading, setLandingLoading] = useState(true);

  // V2 detail: expandable SCDI card
  const [expandedScdi, setExpandedScdi] = useState<string | null>(null);
  // V2 detail: align toggle for SCDI charts
  const [scdiAligned, setScdiAligned] = useState(true);

  const startsDiffer =
    detail != null &&
    Number(detail.metadata.start_year_a) !== Number(detail.metadata.start_year_b);
  const effectiveAlign = align || startsDiffer;

  const [cascadeExpanded, setCascadeExpanded] = useState(true);
  const hasDetail = detail != null && !loading;

  // Fetch top pairs for S0 landing — dedup to show unique pairs
  useEffect(() => {
    async function fetchTopPairs() {
      try {
        const res = await fetch("/api/patterns/ranking?page=1&limit=1000", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const raw: PatternRow[] = data.results ?? [];
          // Dedup: keep best PPS per pair, show top 10 unique
          const bestPerPair = new Map<string, PatternRow>();
          for (const row of raw) {
            const a = row.country_a_id ?? row.country_a;
            const b = row.country_b_id ?? row.country_b;
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            const existing = bestPerPair.get(key);
            if (!existing || row.pattern_power_score > existing.pattern_power_score) {
              bestPerPair.set(key, row);
            }
          }
          const deduped = Array.from(bestPerPair.values())
            .sort((a, b) => b.pattern_power_score - a.pattern_power_score)
            .slice(0, 10);
          setTopPairs(deduped);
        }
      } catch {
        // Non-critical — landing will show empty state
      } finally {
        setLandingLoading(false);
      }
    }
    fetchTopPairs();
  }, []);

  const onSelect = useCallback(
    async (sel: PatternSelection) => {
      const qs = new URLSearchParams({
        country_a: sel.country_a,
        country_b: sel.country_b,
        length: String(sel.length),
        start_a: String(sel.start_a),
        start_b: String(sel.start_b),
      });
      router.replace(`/patterns?${qs.toString()}`, { scroll: false });

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/patterns/detail?country_a=${encodeURIComponent(sel.country_a)}&country_b=${encodeURIComponent(sel.country_b)}&start_a=${sel.start_a}&start_b=${sel.start_b}&length=${sel.length}`,
          { headers: { Authorization: "Bearer __client__" } }
        );
        if (!res.ok) {
          if (res.status === 500 || res.status === 504) {
            throw new Error(
              "Pattern detail data isn't available right now (per-pattern detail is fetched live and is currently being pre-computed for cache). Try Ranking for a pre-computed top-50 view, or check back after the next monthly pipeline run."
            );
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data: PatternDetail = await res.json();
        setDetail(data);
        setSelectedIndex(null);
        setExpandedScdi(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pattern");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  function navigateToPattern(p: PatternRow) {
    const qs = new URLSearchParams({
      country_a: p.country_a_id ?? p.country_a,
      country_b: p.country_b_id ?? p.country_b,
      length: String(p.pattern_length),
      start_a: String(p.start_year_a),
      start_b: String(p.start_year_b),
    });
    router.push(`/patterns?${qs}`);
  }

  const isEarlyWarning =
    detail !== null &&
    Number(detail.metadata.start_year_b) < Number(detail.metadata.start_year_a) &&
    Number(detail.metadata.start_year_a) + Number(detail.metadata.pattern_length) >=
      new Date().getFullYear() - 2;

  const visibleScdis = selectedIndex
    ? detail?.scdis.filter((s) => s.index_name === selectedIndex) ?? []
    : detail?.scdis ?? [];

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel -- cascade filter */}
      {hasDetail && !cascadeExpanded ? (
        <div
          className="w-10 shrink-0 border-r flex flex-col items-center pt-3"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <button
            onClick={() => setCascadeExpanded(true)}
            className="text-[9px] tracking-wider writing-mode-vertical px-1 py-3 rounded transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              color: "var(--qgi-text-dim)",
              writingMode: "vertical-lr",
              transform: "rotate(180deg)",
            }}
            title="Expand filter panel"
          >
            Change pattern &rsaquo;
          </button>
        </div>
      ) : (
        <div
          className={`${hasDetail ? "w-52" : "w-64"} shrink-0 border-r flex flex-col overflow-y-auto transition-all`}
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <div
            className="text-[9px] tracking-[0.25em] uppercase px-4 py-2.5 border-b flex items-center justify-between"
            style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
          >
            <span>Discover Patterns</span>
            {hasDetail && (
              <button
                onClick={() => setCascadeExpanded(false)}
                className="text-[9px] hover:text-[var(--qgi-accent)]"
                title="Collapse filter panel"
              >
                &lsaquo;
              </button>
            )}
          </div>
          <CascadeFilter initial={initial} onSelect={onSelect} />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* ============================================================ */}
        {/*  S0 LANDING -- shown when no pattern is loaded               */}
        {/* ============================================================ */}
        {!detail && !loading && !error && (
          <div className="p-6 space-y-6">
            {/* Summary card */}
            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              <h2
                className="text-sm tracking-widest uppercase mb-2"
                style={{ color: "var(--qgi-text)" }}
              >
                PATTERNS PORTAL
              </h2>
              <p
                className="text-xs leading-relaxed max-w-2xl"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                Explore structural similarities between countries across
                economic indicators and decades of data. Start by
                selecting a Predictor Country in the sidebar, or browse the
                top-ranked pattern pairs below.
              </p>
              <div
                className="flex gap-4 mt-3 text-[10px] font-data tracking-wider"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                <span>214 countries</span>
                <span>&middot;</span>
                <span>2.01B patterns</span>
                <span>&middot;</span>
                <span>{topPairs.length > 0 ? `${topPairs.length} ranked pairs in cache` : "Loading..."}</span>
              </div>
            </div>

            {/* Top pairs table */}
            {landingLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="font-data text-xs animate-pulse" style={{ color: "var(--qgi-text-dim)" }}>
                  Loading top pairs...
                </span>
              </div>
            ) : topPairs.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-xs tracking-widest uppercase"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    TOP GLOBAL PAIRS
                    <InfoTooltip text="Top 10 pattern pairs ranked by Pattern Power Score (PPS), drawn from the pre-computed ranking cache." />
                  </h3>
                  <a
                    href="/patterns/ranking"
                    className="text-[10px] tracking-wider transition-colors hover:underline"
                    style={{ color: "var(--qgi-accent)" }}
                  >
                    View full ranking &rarr;
                  </a>
                </div>

                <div
                  className="rounded-lg overflow-hidden border"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    borderColor: "var(--qgi-border)",
                  }}
                >
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        className="border-b text-[10px] tracking-widest uppercase"
                        style={{
                          borderColor: "var(--qgi-border)",
                          color: "var(--qgi-text-dim)",
                        }}
                      >
                        <th className="px-3 py-2.5 text-left w-8">#</th>
                        <th className="px-3 py-2.5 text-left">
                          PAIR
                          <InfoTooltip text="Predictor country followed by Following country." />
                        </th>
                        <th className="px-3 py-2.5 text-right">YRS</th>
                        <th className="px-3 py-2.5 text-right">IDX</th>
                        <th className="px-3 py-2.5 text-right">CORR</th>
                        <th className="px-3 py-2.5 text-left pl-6">
                          PPS
                          <InfoTooltip text="Pattern Power Score -- composite strength metric." />
                        </th>
                        <th className="px-3 py-2.5 text-right">LEAD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPairs.map((row, i) => {
                        const alpha2A = getAlpha2(row.country_a_id, row.country_a);
                        const alpha2B = getAlpha2(row.country_b_id, row.country_b);
                        const lead = row.start_year_b - row.start_year_a;
                        const maxPps = topPairs[0]?.pattern_power_score ?? 1;
                        const pct = Math.min(100, (row.pattern_power_score / maxPps) * 100);
                        return (
                          <tr
                            key={`${row.country_a_id}-${row.country_b_id}-${row.start_year_a}-${i}`}
                            onClick={() => navigateToPattern(row)}
                            className="border-b transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                            style={{ borderColor: "var(--qgi-border)" }}
                          >
                            <td className="px-3 py-2.5 font-data" style={{ color: "var(--qgi-text-dim)" }}>
                              {i + 1}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <CountryFlag alpha2={alpha2A} size={16} />
                                <span className="font-data text-xs" style={{ color: "var(--qgi-country-a)" }}>
                                  {row.country_a}
                                </span>
                                <span style={{ color: "var(--qgi-text-dim)" }}>&rarr;</span>
                                <CountryFlag alpha2={alpha2B} size={16} />
                                <span className="font-data text-xs" style={{ color: "var(--qgi-country-b)" }}>
                                  {row.country_b}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                              {row.pattern_length}
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                              {row.num_indexes}
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: corrColor(row.avg_correlation) }}>
                              {(row.avg_correlation * 100).toFixed(0)}%
                            </td>
                            <td className="px-3 py-2.5 pl-6">
                              <div className="flex items-center gap-2">
                                <div className="h-2 rounded-full" style={{ width: "80px", backgroundColor: "var(--qgi-surface-2)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: rawPpsColor(row.pattern_power_score) }} />
                                </div>
                                <span className="font-data text-xs" style={{ color: rawPpsColor(row.pattern_power_score) }}>
                                  {Math.round(row.pattern_power_score)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: lead > 0 ? "var(--qgi-success)" : "var(--qgi-text-dim)" }}>
                              {lead === 0 ? "sync" : lead > 0 ? `+${lead}yr` : `${lead}yr`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p
                  className="mt-3 text-[10px] tracking-wider"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Click any row to view full pattern detail, or use the sidebar to discover patterns manually.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <span className="text-[10px] tracking-[0.25em] uppercase" style={{ color: "var(--qgi-text-dim)" }}>
                  Patterns Portal
                </span>
                <p className="text-sm text-center max-w-sm" style={{ color: "var(--qgi-text-dim)" }}>
                  Select a Predictor Country and follow the steps to discover a geopolitical pattern.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <span className="font-data text-xs animate-pulse" style={{ color: "var(--qgi-text-dim)" }}>
              Loading pattern...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-8 max-w-2xl">
            <div
              className="rounded-lg border-l-2 p-4"
              style={{
                borderColor: "var(--qgi-amber)",
                backgroundColor: "var(--qgi-surface)",
              }}
            >
              <div className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: "var(--qgi-amber)" }}>
                Pattern detail unavailable
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/*  V2 PATTERN DETAIL VIEW                                      */}
        {/* ============================================================ */}
        {detail && !loading && (() => {
          const meta = detail.metadata;
          const countryA = meta.country_a;
          const countryB = meta.country_b;
          const startA = Number(meta.start_year_a);
          const startB = Number(meta.start_year_b);
          const len = Number(meta.pattern_length);
          const endA = startA + len - 1;
          const endB = startB + len - 1;
          const avgCorr = Number(meta.avg_correlation);
          const ppsRaw = Number(meta.pattern_power_score);
          const numIdx = Number(meta.num_indexes);
          const lag = startB - startA;
          const alpha2A = getAlpha2(undefined, countryA);
          const alpha2B = getAlpha2(undefined, countryB);

          // For the PPS gauge (0-1 scale for normalized, raw otherwise)
          const isNormalized = ppsRaw <= 1;
          const gaugePct = isNormalized ? ppsRaw * 100 : Math.min(100, (ppsRaw / 2000) * 100);
          const ppsDisplay = isNormalized ? ppsRaw.toFixed(2) : Math.round(ppsRaw).toLocaleString();
          const ppsLbl = isNormalized ? ppsLabel(ppsRaw) : (ppsRaw >= 1500 ? "Very Strong" : ppsRaw >= 1000 ? "Strong" : ppsRaw >= 500 ? "Moderate" : "Weak");
          const ppsClr = isNormalized ? ppsColor(ppsRaw) : rawPpsColor(ppsRaw);

          // Timeline bounds
          const allYears = [startA, endA, startB, endB, new Date().getFullYear()];
          const timelineStart = Math.min(...allYears) - 3;
          const timelineEnd = Math.max(...allYears) + 3;

          // Sector breakdown
          const sectorCounts: Record<string, number> = {};
          for (const s of detail.scdis) {
            sectorCounts[s.sector] = (sectorCounts[s.sector] ?? 0) + 1;
          }

          return (
            <div className="p-6 space-y-6">
              {/* === HERO PATTERN CARD === */}
              <section
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: "var(--qgi-surface)",
                  border: "1px solid var(--qgi-border)",
                }}
              >
                {/* Early Warning Banner */}
                {isEarlyWarning && (
                  <div
                    className="flex items-center gap-3 px-6 py-2.5 text-xs font-semibold"
                    style={{ backgroundColor: "rgba(248, 113, 113, 0.12)", borderBottom: "1px solid #f87171" }}
                  >
                    <span style={{ color: "#f87171" }}>EARLY WARNING SIGNAL</span>
                    <span style={{ color: "var(--qgi-text-muted)", fontWeight: 400 }}>
                      Predictor country is currently in its historical window
                    </span>
                  </div>
                )}

                {/* Row 1: Identity + PPS Gauge */}
                <div className="p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                    {/* Country A */}
                    <div className="flex items-center gap-4">
                      <CountryFlag alpha2={alpha2A} size={36} />
                      <div>
                        <div className="text-lg font-semibold" style={{ color: "var(--qgi-country-a)" }}>
                          {countryA.toUpperCase()}
                        </div>
                        <div className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                          {startA} &mdash; {endA}
                        </div>
                        <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
                          PREDICTOR
                        </div>
                      </div>
                    </div>

                    {/* Center: PPS gauge + stats */}
                    <div className="flex flex-col items-center gap-3 px-4 lg:px-8">
                      {lag !== 0 && (
                        <div className="flex items-center gap-2 text-[10px] tracking-widest" style={{ color: "var(--qgi-text-dim)" }}>
                          <span>&larr; {Math.abs(lag)}yr lag &rarr;</span>
                        </div>
                      )}

                      {/* PPS gauge bar */}
                      <div className="w-full max-w-xs">
                        <div className="flex rounded-full h-4 overflow-hidden relative">
                          {isNormalized ? (
                            PPS_QUINTILES.map((q) => (
                              <div key={q.label} className="h-full" style={{ width: `${(q.max - q.min) * 100}%`, backgroundColor: q.color, opacity: 0.35 }} />
                            ))
                          ) : (
                            [
                              { min: 0, max: 500, color: "#4a6280" },
                              { min: 500, max: 1000, color: "#fbbf24" },
                              { min: 1000, max: 1500, color: "#fb923c" },
                              { min: 1500, max: 2000, color: "#f87171" },
                            ].map((q) => (
                              <div key={q.min} className="h-full" style={{ width: `${((q.max - q.min) / 2000) * 100}%`, backgroundColor: q.color, opacity: 0.35 }} />
                            ))
                          )}
                          <div
                            className="absolute top-0 h-full w-1 rounded"
                            style={{ left: `${gaugePct}%`, backgroundColor: "#fff", transform: "translateX(-50%)", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }}
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="font-data text-3xl font-bold" style={{ color: ppsClr }}>
                          {ppsDisplay}
                        </div>
                        <div className="text-[9px] tracking-widest uppercase" style={{ color: "var(--qgi-text-dim)" }}>
                          PPS -- {ppsLbl}
                        </div>
                      </div>

                      <div className="flex gap-4 text-[10px] font-data" style={{ color: "var(--qgi-text-muted)" }}>
                        <span>{len}yrs</span>
                        <span>&middot;</span>
                        <span>{numIdx} indicators</span>
                        <span>&middot;</span>
                        <span>avg r {avgCorr.toFixed(3)}</span>
                      </div>
                    </div>

                    {/* Country B */}
                    <div className="flex items-center gap-4 lg:justify-end">
                      <div className="text-right">
                        <div className="text-lg font-semibold" style={{ color: "var(--qgi-country-b)" }}>
                          {countryB.toUpperCase()}
                        </div>
                        <div className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                          {startB} &mdash; {endB}
                        </div>
                        <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
                          FOLLOWING
                        </div>
                      </div>
                      <CountryFlag alpha2={alpha2B} size={36} />
                    </div>
                  </div>
                </div>

                {/* Row 2: Timeline ribbon */}
                <div className="px-6 lg:px-8 py-5" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                  <div className="relative h-20">
                    <div className="absolute top-1/2 left-0 right-0 h-px" style={{ backgroundColor: "var(--qgi-border)" }} />

                    {/* Year labels */}
                    {Array.from(
                      new Set(
                        [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030]
                          .filter((y) => y >= timelineStart && y <= timelineEnd)
                      )
                    ).map((y) => (
                      <div
                        key={y}
                        className="absolute bottom-0 text-[9px] font-data -translate-x-1/2"
                        style={{ left: `${yearToPercent(y, timelineStart, timelineEnd)}%`, color: "var(--qgi-text-dim)" }}
                      >
                        {y}
                      </div>
                    ))}

                    {/* Predictor bar (top) */}
                    <div
                      className="absolute h-5 rounded"
                      style={{
                        left: `${yearToPercent(startA, timelineStart, timelineEnd)}%`,
                        width: `${yearToPercent(endA, timelineStart, timelineEnd) - yearToPercent(startA, timelineStart, timelineEnd)}%`,
                        top: "8px",
                        backgroundColor: "var(--qgi-country-a)",
                        opacity: 0.6,
                      }}
                    />
                    <div
                      className="absolute text-[9px] font-data -translate-x-1/2"
                      style={{ left: `${yearToPercent((startA + endA) / 2, timelineStart, timelineEnd)}%`, top: "10px", color: "#fff" }}
                    >
                      {alpha2A} {startA}-{endA}
                    </div>

                    {/* Following bar (bottom) */}
                    <div
                      className="absolute h-5 rounded"
                      style={{
                        left: `${yearToPercent(startB, timelineStart, timelineEnd)}%`,
                        width: `${yearToPercent(endB, timelineStart, timelineEnd) - yearToPercent(startB, timelineStart, timelineEnd)}%`,
                        top: "48px",
                        backgroundColor: "var(--qgi-country-b)",
                        opacity: 0.6,
                      }}
                    />
                    <div
                      className="absolute text-[9px] font-data -translate-x-1/2"
                      style={{ left: `${yearToPercent((startB + endB) / 2, timelineStart, timelineEnd)}%`, top: "50px", color: "#fff" }}
                    >
                      {alpha2B} {startB}-{endB}
                    </div>

                    {/* Today marker */}
                    {(() => {
                      const today = new Date().getFullYear();
                      if (today >= timelineStart && today <= timelineEnd) {
                        return (
                          <>
                            <div
                              className="absolute"
                              style={{ left: `${yearToPercent(today, timelineStart, timelineEnd)}%`, top: "0", bottom: "0", width: "1px", backgroundColor: "#34d399" }}
                            />
                            <div
                              className="absolute text-[8px] tracking-wider -translate-x-1/2"
                              style={{ left: `${yearToPercent(today, timelineStart, timelineEnd)}%`, top: "0", color: "#34d399" }}
                            >
                              today
                            </div>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Row 3: Action buttons */}
                <div className="p-6 lg:p-8 flex gap-3">
                  {["View methodology", "View ranking"].map((label) => (
                    <a
                      key={label}
                      href={label === "View methodology" ? "/methodology" : "/patterns/ranking"}
                      className="px-4 py-2 rounded text-[11px] tracking-wider transition-colors"
                      style={{
                        backgroundColor: "var(--qgi-surface-2)",
                        color: "var(--qgi-text-muted)",
                        border: "1px solid var(--qgi-border)",
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </section>

              {/* === MAIN BODY: Charts + table (left) + Related patterns (right) === */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
                {/* ---- Left column: toolbar + charts + table ---- */}
                <div className="space-y-6">
                  {/* === TOOLBAR === */}
                  <div
                    className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
                    style={{
                      backgroundColor: "var(--qgi-surface)",
                      border: "1px solid var(--qgi-border)",
                    }}
                  >
                    {/* Transformation selector */}
                    <select
                      value={transformation}
                      onChange={(e) => setTransformation(e.target.value as Transformation)}
                      className="text-[10px] rounded border px-2 py-1 bg-transparent outline-none focus:border-[var(--qgi-accent)]"
                      style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
                    >
                      {Object.entries(TRANSFORMATION_LABELS).map(([k, v]) => (
                        <option key={k} value={k} style={{ backgroundColor: "#162032" }}>
                          {v}
                        </option>
                      ))}
                    </select>

                    {/* Align toggle -- V2 style (switch, not checkbox) */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => !startsDiffer && setAlign(!effectiveAlign)}
                        className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                        style={{
                          backgroundColor: effectiveAlign ? "var(--qgi-accent)" : "var(--qgi-border)",
                          opacity: startsDiffer ? 0.6 : 1,
                          cursor: startsDiffer ? "default" : "pointer",
                        }}
                        title={startsDiffer ? "Auto-aligned: windows at different calendar years" : "Align to Year 1, Year 2, ..."}
                      >
                        <div
                          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                          style={{ left: effectiveAlign ? "calc(100% - 14px)" : "2px" }}
                        />
                      </button>
                      <span className="text-[10px] tracking-wider" style={{ color: effectiveAlign ? "var(--qgi-accent)" : "var(--qgi-text-dim)" }}>
                        {effectiveAlign ? "Aligned (Year 1-N)" : "Calendar years"}
                        {startsDiffer && <span style={{ color: "var(--qgi-amber)" }}> (auto)</span>}
                      </span>
                    </div>

                    <div className="flex-1" />

                    {/* Sector chips */}
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).map(([s]) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded text-[9px] tracking-wider"
                          style={{
                            backgroundColor: `${getSectorColor(s)}18`,
                            color: getSectorColor(s),
                            border: `1px solid ${getSectorColor(s)}33`,
                          }}
                        >
                          {s.toUpperCase()}
                        </span>
                      ))}
                    </div>

                    {/* Section toggles */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTable(!showTable)}
                        className="text-[10px] tracking-wider px-2 py-1 rounded border"
                        style={{
                          borderColor: showTable ? "var(--qgi-accent)" : "var(--qgi-border)",
                          color: showTable ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                        }}
                      >
                        TABLE
                      </button>
                      <button
                        onClick={() => setShowCharts(!showCharts)}
                        className="text-[10px] tracking-wider px-2 py-1 rounded border"
                        style={{
                          borderColor: showCharts ? "var(--qgi-accent)" : "var(--qgi-border)",
                          color: showCharts ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                        }}
                      >
                        CHARTS
                      </button>
                    </div>
                  </div>

                  {/* === V2 EXPANDABLE SCDI CARDS === */}
                  {showCharts && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {detail.scdis.map((s, i) => {
                        const isExpanded = expandedScdi === s.index_name;
                        const sc = getSectorColor(s.sector);
                        return (
                          <div
                            key={s.index_name}
                            className={`rounded-lg p-3 cursor-pointer transition-all hover:border-[var(--qgi-accent)] ${isExpanded ? "col-span-2 lg:col-span-4" : ""}`}
                            style={{
                              backgroundColor: `${sc}08`,
                              border: isExpanded ? `1px solid ${sc}66` : "1px solid var(--qgi-border)",
                            }}
                            onClick={() => setExpandedScdi(isExpanded ? null : s.index_name)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[9px] tracking-wider truncate" style={{ color: "var(--qgi-text-muted)" }} title={s.index_name}>
                                {s.index_name}
                              </div>
                              <span className="text-[9px] ml-2 shrink-0" style={{ color: "var(--qgi-text-dim)" }}>
                                {isExpanded ? "collapse" : "expand"}
                              </span>
                            </div>

                            {isExpanded ? (
                              <div>
                                {/* Align toggle for SCDI chart */}
                                <div className="flex items-center gap-3 mb-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setScdiAligned(!scdiAligned); }}
                                    className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                                    style={{ backgroundColor: scdiAligned ? "var(--qgi-accent)" : "var(--qgi-border)" }}
                                  >
                                    <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform" style={{ left: scdiAligned ? "calc(100% - 14px)" : "2px" }} />
                                  </button>
                                  <span className="text-[9px] tracking-wider" style={{ color: scdiAligned ? "var(--qgi-accent)" : "var(--qgi-text-dim)" }}>
                                    {scdiAligned ? `Aligned (Year 1-${len})` : "Calendar years"}
                                  </span>
                                </div>
                                <div className="h-48 mb-2">
                                  <ReactECharts
                                    option={{
                                      backgroundColor: "transparent",
                                      tooltip: {
                                        trigger: "axis",
                                        backgroundColor: "#1e2d42",
                                        borderColor: "#243347",
                                        textStyle: { color: "#e2e8f0", fontSize: 10 },
                                      },
                                      legend: {
                                        data: [countryA, countryB],
                                        top: 0, right: 8,
                                        textStyle: { color: "#7a90a8", fontSize: 9 },
                                        itemWidth: 12, itemHeight: 2,
                                      },
                                      grid: { top: 30, right: 12, bottom: 24, left: 48 },
                                      xAxis: scdiAligned
                                        ? {
                                            type: "category" as const,
                                            data: Array.from({ length: len }, (_, j) => `Year ${j + 1}`),
                                            axisLine: { lineStyle: { color: "#243347" } },
                                            axisLabel: { color: "#4a6280", fontSize: 9 },
                                          }
                                        : {
                                            type: "value" as const,
                                            min: Math.min(startA, startB) - 1,
                                            max: Math.max(endA, endB) + 1,
                                            axisLine: { lineStyle: { color: "#243347" } },
                                            axisLabel: { color: "#4a6280", fontSize: 9, formatter: (v: number) => String(Math.round(v)) },
                                            splitLine: { show: false },
                                          },
                                      yAxis: {
                                        type: "value",
                                        scale: true,
                                        axisLine: { lineStyle: { color: "#243347" } },
                                        splitLine: { lineStyle: { color: "#1a2a3a" } },
                                        axisLabel: { color: "#4a6280", fontSize: 9 },
                                      },
                                      series: scdiAligned
                                        ? [
                                            { name: countryA, type: "line", data: s.values_a, lineStyle: { color: "#38bdf8", width: 2 }, itemStyle: { color: "#38bdf8" }, symbol: "circle", symbolSize: 4 },
                                            { name: countryB, type: "line", data: s.values_b, lineStyle: { color: "#fb923c", width: 2 }, itemStyle: { color: "#fb923c" }, symbol: "circle", symbolSize: 4 },
                                          ]
                                        : [
                                            { name: countryA, type: "line", data: s.values_a.map((v, j) => [startA + j, v]), lineStyle: { color: "#38bdf8", width: 2 }, itemStyle: { color: "#38bdf8" }, symbol: "circle", symbolSize: 4 },
                                            { name: countryB, type: "line", data: s.values_b.map((v, j) => [startB + j, v]), lineStyle: { color: "#fb923c", width: 2 }, itemStyle: { color: "#fb923c" }, symbol: "circle", symbolSize: 4 },
                                          ],
                                    }}
                                    style={{ height: "100%", width: "100%" }}
                                    notMerge
                                  />
                                </div>
                              </div>
                            ) : (
                              /* Sparkline when collapsed */
                              <div className="mb-2 rounded" style={{ backgroundColor: "var(--qgi-surface)" }}>
                                <div className="flex items-end gap-px h-16 w-full px-1">
                                  {Array.from({ length: Math.min(len, 20) }, (_, j) => {
                                    const h = 12 + Math.sin((j * 1.1 + i) * 0.8) * 18 + ((j * 7 + i * 13) % 11);
                                    return (
                                      <div
                                        key={j}
                                        className="flex-1 rounded-t"
                                        style={{ height: `${Math.max(4, h)}px`, backgroundColor: "var(--qgi-country-a)", opacity: 0.3 + (j / len) * 0.5 }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="w-1 h-3 rounded-full" style={{ backgroundColor: sc }} />
                              <span className="font-data text-[10px]" style={{ color: "var(--qgi-text-muted)" }}>
                                r={s.correlation.toFixed(2)} {s.correlation >= 0.85 ? "***" : s.correlation >= 0.75 ? "**" : "*"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* === SCDI TABLE === */}
                  {showTable && (
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        backgroundColor: "var(--qgi-surface)",
                        border: "1px solid var(--qgi-border)",
                      }}
                    >
                      <div className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b" style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}>
                        Indicator Matches ({detail.scdis.length})
                      </div>
                      <ScdiTable
                        scdis={detail.scdis}
                        onRowSelect={(name) => setSelectedIndex(selectedIndex === name ? null : name)}
                        selectedIndex={selectedIndex}
                      />
                    </div>
                  )}
                </div>

                {/* ---- Right column: Related Patterns sidebar ---- */}
                <div className="space-y-4">
                  {([
                    {
                      title: "SAME PREDICTOR",
                      subtitle: `${countryA} \u2192 others`,
                    },
                    {
                      title: "SAME FOLLOWING",
                      subtitle: `others \u2192 ${countryB}`,
                    },
                    {
                      title: "SIMILAR MIX",
                      subtitle: Object.entries(sectorCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([s]) => s.toUpperCase())
                        .join(" + "),
                    },
                  ] as const).map((group) => (
                    <div
                      key={group.title}
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: "var(--qgi-surface)",
                        border: "1px solid var(--qgi-border)",
                      }}
                    >
                      <div className="mb-3">
                        <div
                          className="text-[10px] tracking-widest uppercase font-semibold"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          {group.title}
                        </div>
                        <div className="text-[9px] tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
                          {group.subtitle}
                        </div>
                      </div>
                      <div
                        className="rounded-lg p-3 text-center"
                        style={{
                          backgroundColor: "var(--qgi-surface-2)",
                          border: "1px dashed var(--qgi-border)",
                        }}
                      >
                        <p className="text-[10px] leading-relaxed" style={{ color: "var(--qgi-text-dim)" }}>
                          Related patterns will appear here once the pipeline pre-computes partner indexes.
                        </p>
                        <a
                          href="/patterns/ranking"
                          className="text-[9px] tracking-wider mt-2 inline-block underline"
                          style={{ color: "var(--qgi-accent)" }}
                        >
                          Browse ranking &rarr;
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* === METHODOLOGY FOOTER === */}
              <footer
                className="rounded-lg p-4 text-[10px] tracking-wider leading-relaxed"
                style={{
                  backgroundColor: "var(--qgi-surface)",
                  color: "var(--qgi-text-dim)",
                  border: "1px solid var(--qgi-border)",
                }}
              >
                V1.8.1 z-score + RRF &middot; Pearson r &ge; 0.65 &middot;
                &plusmn;15% event window &middot; PPS quintiles: very weak &lt;0.50 / weak &lt;0.65 /
                moderate &lt;0.75 / strong &lt;0.85 / very strong &ge;0.85
              </footer>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
