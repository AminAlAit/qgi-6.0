"use client";

/**
 * EXAMPLE / PROTOTYPE: Patterns Detail V2
 * Demonstrates the redesigned patterns detail view from
 * ux-consult-patterns-detail-2026-04-16.md
 *
 * Hardcoded sample: Argentina 1995-2005 -> Brazil 1981-1991
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ------------------------------------------------------------------ */
/*  Sample data                                                        */
/* ------------------------------------------------------------------ */

const PATTERN = {
  // #12 fix: Brazil is the PREDICTOR (earlier window), Argentina FOLLOWS
  countryA: { name: "Brazil", alpha2: "BR", windowStart: 1981, windowEnd: 1991 },
  countryB: { name: "Argentina", alpha2: "AR", windowStart: 1995, windowEnd: 2005 },
  pps: 0.87,
  length: 11,
  avgCorrelation: 0.847,
  pValue: "< 0.001",
  indicatorCount: 8,
  lag: 14,
  eventB: {
    title: "Hyperinflation peak",
    date: "March 1990",
    description: "Brazilian inflation peaked at 6,821%/yr, triggering the Plano Collor currency freeze.",
  },
};

const NARRATIVE =
  "Brazil's 1981-1991 economic trajectory is the predictor: it ended in " +
  "March 1990 with hyperinflation peaking at 6,821%/yr. Argentina's 1995-2005 " +
  "window follows the same path across 8 indicators (avg r 0.847), led by Population, " +
  "Mortality, and Economic sector signals. Argentina is in equivalent year 7 of " +
  "Brazil's 11-year arc.";

const PPS_QUINTILES = [
  { label: "Very weak", min: 0, max: 0.5, color: "#4a6280" },
  { label: "Weak", min: 0.5, max: 0.65, color: "#7a90a8" },
  { label: "Moderate", min: 0.65, max: 0.75, color: "#fbbf24" },
  { label: "Strong", min: 0.75, max: 0.85, color: "#fb923c" },
  { label: "Very strong", min: 0.85, max: 1.0, color: "#f87171" },
];

const INDICATORS = [
  { name: "Population, total", sector: "Demographic", r: 0.94, sig: "***", n: 11 },
  { name: "Infant mortality rate", sector: "Health", r: 0.91, sig: "***", n: 11 },
  { name: "GDP per capita (current US$)", sector: "Economic", r: 0.89, sig: "***", n: 11 },
  { name: "Life expectancy at birth", sector: "Demographic", r: 0.87, sig: "***", n: 11 },
  { name: "GDP deflator (annual %)", sector: "Economic", r: 0.85, sig: "**", n: 11 },
  { name: "Mortality rate, under-5", sector: "Health", r: 0.83, sig: "**", n: 11 },
  { name: "Population growth (annual %)", sector: "Demographic", r: 0.79, sig: "**", n: 11 },
  { name: "Trade (% of GDP)", sector: "Trade", r: 0.76, sig: "*", n: 11 },
];

// Sample time-series data for expandable SCDI charts (hardcoded for prototype)
const SAMPLE_SERIES: Record<string, { a: number[]; b: number[] }> = {
  "Population, total": {
    a: [35.1, 35.5, 35.9, 36.3, 36.7, 37.0, 37.3, 37.6, 37.9, 38.2, 38.5],
    b: [124.1, 126.9, 129.8, 132.7, 135.6, 138.4, 141.2, 143.9, 146.6, 149.2, 151.8],
  },
  "Infant mortality rate": {
    a: [24.2, 23.0, 21.9, 20.9, 19.9, 19.0, 18.1, 17.3, 16.5, 15.7, 15.0],
    b: [91.5, 87.3, 83.3, 79.5, 75.9, 72.5, 69.2, 66.1, 63.2, 60.4, 57.8],
  },
  "GDP per capita (current US$)": {
    a: [7400, 7700, 8100, 7700, 7500, 7700, 2700, 2800, 3400, 3900, 4700],
    b: [1800, 1700, 1600, 1400, 1600, 1800, 2100, 2400, 2600, 2900, 3100],
  },
  "Life expectancy at birth": {
    a: [72.1, 72.4, 72.7, 73.0, 73.3, 73.6, 73.9, 74.2, 74.4, 74.6, 74.8],
    b: [62.7, 63.1, 63.5, 63.9, 64.3, 64.7, 65.1, 65.5, 65.9, 66.3, 66.7],
  },
  "GDP deflator (annual %)": {
    a: [3.4, 0.2, 0.9, 6.1, -1.2, -0.9, -1.1, 25.9, 13.4, 6.1, 4.7],
    b: [100, 110, 200, 1000, 2000, 230, 420, 1040, 1770, 6820, 440],
  },
  "Mortality rate, under-5": {
    a: [28.3, 26.8, 25.5, 24.2, 23.1, 22.0, 21.0, 20.0, 19.1, 18.2, 17.4],
    b: [110.5, 105.2, 100.3, 95.6, 91.3, 87.2, 83.3, 79.6, 76.1, 72.8, 69.6],
  },
  "Population growth (annual %)": {
    a: [1.2, 1.1, 1.1, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7],
    b: [2.3, 2.2, 2.1, 2.0, 1.9, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6],
  },
  "Trade (% of GDP)": {
    a: [19.2, 20.5, 21.8, 22.1, 18.9, 21.3, 22.5, 34.6, 30.2, 29.8, 32.5],
    b: [15.2, 16.8, 15.4, 18.7, 20.1, 19.3, 15.9, 13.4, 14.7, 12.3, 15.2],
  },
};

const SECTOR_COLORS: Record<string, string> = {
  Demographic: "#fbbf24",
  Health: "#fb923c",
  Economic: "#38bdf8",
  Trade: "#34d399",
};

const RELATED_PATTERNS = {
  samePredictor: [
    { a: "BR", b: "CL", aName: "Brazil", bName: "Chile", length: 8, pps: 0.81 },
    { a: "BR", b: "MX", aName: "Brazil", bName: "Mexico", length: 9, pps: 0.79 },
    { a: "BR", b: "CO", aName: "Brazil", bName: "Colombia", length: 7, pps: 0.72 },
  ],
  sameFollowing: [
    { a: "CO", b: "BR", aName: "Colombia", bName: "Brazil", length: 11, pps: 0.78 },
    { a: "VE", b: "BR", aName: "Venezuela", bName: "Brazil", length: 10, pps: 0.74 },
    { a: "PE", b: "BR", aName: "Peru", bName: "Brazil", length: 9, pps: 0.69 },
  ],
  similarMix: [
    { a: "TR", b: "ZA", aName: "Turkey", bName: "South Africa", length: 11, pps: 0.83 },
    { a: "EG", b: "NG", aName: "Egypt", bName: "Nigeria", length: 10, pps: 0.77 },
    { a: "PH", b: "ID", aName: "Philippines", bName: "Indonesia", length: 12, pps: 0.71 },
  ],
};

/* ------------------------------------------------------------------ */
/*  Timeline helper                                                    */
/* ------------------------------------------------------------------ */

const TIMELINE_START = 1978;
const TIMELINE_END = 2028;
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

function yearToPercent(year: number) {
  return ((year - TIMELINE_START) / TIMELINE_SPAN) * 100;
}

/* ------------------------------------------------------------------ */
/*  Sparkline bars generator                                           */
/* ------------------------------------------------------------------ */

function SparklinePlaceholder({ seed, count }: { seed: number; count: number }) {
  return (
    <div className="flex items-end gap-px h-16 w-full px-1">
      {Array.from({ length: count }, (_, j) => {
        const h = 12 + Math.sin((j * 1.1 + seed) * 0.8) * 18 + ((j * 7 + seed * 13) % 11);
        return (
          <div
            key={j}
            className="flex-1 rounded-t"
            style={{
              height: `${Math.max(4, h)}px`,
              backgroundColor: "var(--qgi-country-a)",
              opacity: 0.3 + (j / count) * 0.5,
            }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PatternV2Page() {
  // PPS gauge position
  const gaugePct = PATTERN.pps * 100;
  // #13: expandable SCDI — click a card to show the full line chart inline
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  // #2: per-card align toggle — when ON shows "Year 1..11", when OFF shows actual calendar years
  const [scdiAligned, setScdiAligned] = useState(true);

  return (
    <div
      className="min-h-screen p-6 lg:p-10"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ---- Prototype badge ---- */}
        <div
          className="inline-block px-3 py-1 rounded text-[10px] tracking-widest uppercase"
          style={{
            backgroundColor: "rgba(251, 191, 36, 0.15)",
            color: "#fbbf24",
            border: "1px solid rgba(251, 191, 36, 0.3)",
          }}
        >
          UX PROTOTYPE -- NOT LIVE DATA
        </div>

        {/* ============================================================ */}
        {/*  HERO PATTERN CARD                                            */}
        {/* ============================================================ */}
        <section
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          {/* ---- Row 1: Identity + PPS Gauge ---- */}
          <div className="p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
              {/* Country A */}
              <div className="flex items-center gap-4">
                <CountryFlag alpha2={PATTERN.countryA.alpha2} size={36} />
                <div>
                  <div className="text-lg font-semibold" style={{ color: "var(--qgi-country-a)" }}>
                    {PATTERN.countryA.name.toUpperCase()}
                  </div>
                  <div className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                    {PATTERN.countryA.windowStart} &mdash; {PATTERN.countryA.windowEnd}
                  </div>
                  <div
                    className="text-[10px] tracking-widest uppercase mt-0.5"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    PREDICTOR
                  </div>
                </div>
              </div>

              {/* Center: PPS gauge + stats */}
              <div className="flex flex-col items-center gap-3 px-4 lg:px-8">
                <div className="flex items-center gap-2 text-[10px] tracking-widest" style={{ color: "var(--qgi-text-dim)" }}>
                  <span>&larr; {PATTERN.lag}yr lag &rarr;</span>
                </div>

                {/* PPS gauge bar */}
                <div className="w-full max-w-xs">
                  <div className="flex rounded-full h-4 overflow-hidden relative">
                    {PPS_QUINTILES.map((q) => (
                      <div
                        key={q.label}
                        className="h-full"
                        style={{
                          width: `${(q.max - q.min) * 100}%`,
                          backgroundColor: q.color,
                          opacity: 0.35,
                        }}
                      />
                    ))}
                    {/* Marker */}
                    <div
                      className="absolute top-0 h-full w-1 rounded"
                      style={{
                        left: `${gaugePct}%`,
                        backgroundColor: "#fff",
                        transform: "translateX(-50%)",
                        boxShadow: "0 0 6px rgba(255,255,255,0.5)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[8px] tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
                    <span>0</span>
                    <span>0.5</span>
                    <span>1.0</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="font-data text-3xl font-bold" style={{ color: "#f87171" }}>
                    {PATTERN.pps.toFixed(2)}
                  </div>
                  <div className="text-[9px] tracking-widest uppercase" style={{ color: "var(--qgi-text-dim)" }}>
                    PPS -- Very Strong
                  </div>
                </div>

                <div
                  className="flex gap-4 text-[10px] font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  <span>{PATTERN.length}yrs</span>
                  <span>&middot;</span>
                  <span>{PATTERN.indicatorCount} indicators</span>
                  <span>&middot;</span>
                  <span>avg r {PATTERN.avgCorrelation.toFixed(3)}</span>
                  <span>&middot;</span>
                  <span>p{PATTERN.pValue}</span>
                </div>
              </div>

              {/* Country B */}
              <div className="flex items-center gap-4 lg:justify-end">
                <div className="text-right">
                  <div className="text-lg font-semibold" style={{ color: "var(--qgi-country-b)" }}>
                    {PATTERN.countryB.name.toUpperCase()}
                  </div>
                  <div className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                    {PATTERN.countryB.windowStart} &mdash; {PATTERN.countryB.windowEnd}
                  </div>
                  <div
                    className="text-[10px] tracking-widest uppercase mt-0.5"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    FOLLOWING
                  </div>
                </div>
                <CountryFlag alpha2={PATTERN.countryB.alpha2} size={36} />
              </div>
            </div>
          </div>

          {/* ---- Row 2: Timeline ribbon ---- */}
          <div
            className="px-6 lg:px-8 py-5"
            style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
          >
            <div className="relative h-20">
              {/* Timeline axis */}
              <div
                className="absolute top-1/2 left-0 right-0 h-px"
                style={{ backgroundColor: "var(--qgi-border)" }}
              />

              {/* Year labels */}
              {[1980, 1990, 2000, 2010, 2020].map((y) => (
                <div
                  key={y}
                  className="absolute bottom-0 text-[9px] font-data -translate-x-1/2"
                  style={{ left: `${yearToPercent(y)}%`, color: "var(--qgi-text-dim)" }}
                >
                  {y}
                </div>
              ))}

              {/* Predictor bar (top) — countryA = Brazil 1981-1991 */}
              <div
                className="absolute h-5 rounded"
                style={{
                  left: `${yearToPercent(PATTERN.countryA.windowStart)}%`,
                  width: `${yearToPercent(PATTERN.countryA.windowEnd) - yearToPercent(PATTERN.countryA.windowStart)}%`,
                  top: "8px",
                  backgroundColor: "var(--qgi-country-a)",
                  opacity: 0.6,
                }}
              />
              <div
                className="absolute text-[9px] font-data -translate-x-1/2"
                style={{
                  left: `${yearToPercent((PATTERN.countryA.windowStart + PATTERN.countryA.windowEnd) / 2)}%`,
                  top: "10px",
                  color: "#fff",
                }}
              >
                {PATTERN.countryA.alpha2} {PATTERN.countryA.windowStart}-{PATTERN.countryA.windowEnd}
              </div>

              {/* Event marker — hyperinflation at end of predictor window.
                  Both triangle + label centered on the 1990 axis position. */}
              <div
                className="absolute flex flex-col items-center"
                style={{
                  left: `${yearToPercent(1990)}%`,
                  top: "26px",
                  transform: "translateX(-50%)",
                }}
              >
                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent" style={{ borderTopColor: "#f87171" }} />
                <div
                  className="text-[8px] tracking-wider mt-0.5 whitespace-nowrap"
                  style={{ color: "#f87171" }}
                >
                  Hyperinflation 1990
                </div>
              </div>

              {/* Following bar (bottom) — countryB = Argentina 1995-2005 */}
              <div
                className="absolute h-5 rounded"
                style={{
                  left: `${yearToPercent(PATTERN.countryB.windowStart)}%`,
                  width: `${yearToPercent(PATTERN.countryB.windowEnd) - yearToPercent(PATTERN.countryB.windowStart)}%`,
                  top: "48px",
                  backgroundColor: "var(--qgi-country-b)",
                  opacity: 0.6,
                }}
              />
              <div
                className="absolute text-[9px] font-data -translate-x-1/2"
                style={{
                  left: `${yearToPercent((PATTERN.countryB.windowStart + PATTERN.countryB.windowEnd) / 2)}%`,
                  top: "50px",
                  color: "#fff",
                }}
              >
                {PATTERN.countryB.alpha2} {PATTERN.countryB.windowStart}-{PATTERN.countryB.windowEnd}
              </div>

              {/* Today marker */}
              <div
                className="absolute"
                style={{
                  left: `${yearToPercent(2026)}%`,
                  top: "0",
                  bottom: "0",
                  width: "1px",
                  backgroundColor: "#34d399",
                }}
              />
              <div
                className="absolute text-[8px] tracking-wider -translate-x-1/2"
                style={{
                  left: `${yearToPercent(2026)}%`,
                  top: "0",
                  color: "#34d399",
                }}
              >
                today
              </div>
            </div>
          </div>

          {/* ---- Row 3: Narrative ---- */}
          <div className="p-6 lg:p-8">
            <p
              className="text-sm leading-relaxed"
              style={{
                borderLeft: "3px solid var(--qgi-accent)",
                paddingLeft: "16px",
                color: "var(--qgi-text)",
              }}
            >
              {NARRATIVE}
            </p>
            <div className="flex gap-3 mt-4">
              {["View methodology", "Export pattern"].map((label) => (
                <button
                  key={label}
                  className="px-4 py-2 rounded text-[11px] tracking-wider transition-colors"
                  style={{
                    backgroundColor: "var(--qgi-surface-2)",
                    color: "var(--qgi-text-muted)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  MAIN BODY: Charts grid + Related patterns                    */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* ---- Left: Charts + table ---- */}
          <div className="space-y-6">
            {/* Toolbar */}
            <div
              className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
              style={{
                backgroundColor: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              <div className="flex gap-1 text-[10px] tracking-widest">
                {["SMALL MULTIPLES", "DETAIL"].map((v, i) => (
                  <button
                    key={v}
                    className="px-3 py-1.5 rounded"
                    style={{
                      backgroundColor: i === 0 ? "var(--qgi-accent-glow)" : "transparent",
                      color: i === 0 ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                      border: `1px solid ${i === 0 ? "rgba(56,189,248,0.3)" : "var(--qgi-border)"}`,
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex gap-2">
                {Object.keys(SECTOR_COLORS).map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded text-[9px] tracking-wider"
                    style={{
                      backgroundColor: `${SECTOR_COLORS[s]}18`,
                      color: SECTOR_COLORS[s],
                      border: `1px solid ${SECTOR_COLORS[s]}33`,
                    }}
                  >
                    {s.toUpperCase()}
                  </span>
                ))}
              </div>
              <button
                className="px-3 py-1.5 rounded text-[10px] tracking-wider"
                style={{
                  backgroundColor: "var(--qgi-surface-2)",
                  color: "var(--qgi-text-muted)",
                  border: "1px solid var(--qgi-border)",
                }}
              >
                Export CSV
              </button>
            </div>

            {/* Small multiples grid (4x2) — click to expand inline (#13) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {INDICATORS.map((ind, i) => {
                const isExpanded = expandedIndex === ind.name;
                const series = SAMPLE_SERIES[ind.name];
                return (
                  <div
                    key={ind.name}
                    className={`rounded-lg p-3 cursor-pointer transition-all hover:border-[var(--qgi-accent)] ${
                      isExpanded ? "col-span-2 lg:col-span-4" : ""
                    }`}
                    style={{
                      backgroundColor: `${SECTOR_COLORS[ind.sector]}08`,
                      border: isExpanded
                        ? `1px solid ${SECTOR_COLORS[ind.sector]}66`
                        : "1px solid var(--qgi-border)",
                    }}
                    onClick={() =>
                      setExpandedIndex(isExpanded ? null : ind.name)
                    }
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="text-[9px] tracking-wider truncate"
                        style={{ color: "var(--qgi-text-muted)" }}
                        title={ind.name}
                      >
                        {ind.name}
                      </div>
                      <span
                        className="text-[9px] ml-2 shrink-0"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        {isExpanded ? "click to collapse" : "click to expand"}
                      </span>
                    </div>

                    {isExpanded && series ? (
                      /* Full line chart when expanded */
                      <div>
                        {/* #2/#3: Align toggle (styled as a switch, not a checkbox) */}
                        <div className="flex items-center gap-3 mb-2" onClick={(e) => e.stopPropagation()}>
                          {/* Toggle switch */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setScdiAligned(!scdiAligned); }}
                            className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                            style={{
                              backgroundColor: scdiAligned ? "var(--qgi-accent)" : "var(--qgi-border)",
                            }}
                          >
                            <div
                              className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                              style={{ left: scdiAligned ? "calc(100% - 14px)" : "2px" }}
                            />
                          </button>
                          <span className="text-[9px] tracking-wider" style={{ color: scdiAligned ? "var(--qgi-accent)" : "var(--qgi-text-dim)" }}>
                            {scdiAligned ? "Aligned (Year 1-11)" : "Calendar years"}
                          </span>
                          {!scdiAligned && (
                            <span className="text-[8px]" style={{ color: "var(--qgi-text-dim)" }}>
                              {PATTERN.countryA.name} {PATTERN.countryA.windowStart}&ndash;{PATTERN.countryA.windowEnd}
                              &ensp;|&ensp;
                              {PATTERN.countryB.name} {PATTERN.countryB.windowStart}&ndash;{PATTERN.countryB.windowEnd}
                              &ensp;({PATTERN.lag}yr lag)
                            </span>
                          )}
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
                              data: [PATTERN.countryA.name, PATTERN.countryB.name],
                              top: 0,
                              right: 8,
                              textStyle: { color: "#7a90a8", fontSize: 9 },
                              itemWidth: 12,
                              itemHeight: 2,
                            },
                            grid: { top: 30, right: 12, bottom: scdiAligned ? 24 : 40, left: 48 },
                            xAxis: {
                              type: "category",
                              data: scdiAligned
                                ? Array.from({ length: PATTERN.length }, (_, j) => `Year ${j + 1}`)
                                : Array.from({ length: PATTERN.length }, (_, j) =>
                                    // Show predictor year on top, follower year below
                                    `${PATTERN.countryA.windowStart + j}\n${PATTERN.countryB.windowStart + j}`
                                  ),
                              axisLine: { lineStyle: { color: "#243347" } },
                              axisLabel: {
                                color: "#4a6280",
                                fontSize: 8,
                                rotate: 0,
                                interval: scdiAligned ? "auto" : 1,
                                lineHeight: 12,
                              },
                            },
                            yAxis: {
                              type: "value",
                              scale: true,
                              axisLine: { lineStyle: { color: "#243347" } },
                              splitLine: {
                                lineStyle: { color: "#1a2a3a" },
                              },
                              axisLabel: { color: "#4a6280", fontSize: 9 },
                            },
                            series: [
                              {
                                name: PATTERN.countryA.name,
                                type: "line",
                                data: series.a,
                                lineStyle: { color: "#38bdf8", width: 2 },
                                itemStyle: { color: "#38bdf8" },
                                symbol: "circle",
                                symbolSize: 4,
                              },
                              {
                                name: PATTERN.countryB.name,
                                type: "line",
                                data: series.b,
                                lineStyle: { color: "#fb923c", width: 2 },
                                itemStyle: { color: "#fb923c" },
                                symbol: "circle",
                                symbolSize: 4,
                              },
                            ],
                          }}
                          style={{ height: "100%", width: "100%" }}
                          notMerge
                        />
                      </div>
                      </div>
                    ) : (
                      /* Sparkline when collapsed */
                      <div
                        className="mb-2 rounded"
                        style={{ backgroundColor: "var(--qgi-surface)" }}
                      >
                        <SparklinePlaceholder
                          seed={i * 3 + 1}
                          count={PATTERN.length}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div
                        className="w-1 h-3 rounded-full"
                        style={{
                          backgroundColor: SECTOR_COLORS[ind.sector],
                        }}
                      />
                      <span
                        className="font-data text-[10px]"
                        style={{ color: "var(--qgi-text-muted)" }}
                      >
                        r={ind.r.toFixed(2)} {ind.sig}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Indicators table */}
            <div
              className="rounded-xl p-5 overflow-x-auto"
              style={{
                backgroundColor: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              <h3
                className="text-[11px] tracking-widest uppercase font-semibold mb-3"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                INDICATORS
                <InfoTooltip text="Co-correlated indicators driving this pattern. R = Pearson correlation coefficient. N = observation count. Significance: *** p<0.001, ** p<0.01, * p<0.05" />
              </h3>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ color: "var(--qgi-text-dim)" }}>
                    <th className="text-left py-2 tracking-widest w-6"></th>
                    <th className="text-left py-2 tracking-widest">INDICATOR</th>
                    <th className="text-left py-2 tracking-widest">SECTOR</th>
                    <th className="text-right py-2 tracking-widest">STATS</th>
                  </tr>
                </thead>
                <tbody>
                  {INDICATORS.map((ind) => (
                    <tr key={ind.name} className="border-t hover:bg-[var(--qgi-surface-2)]" style={{ borderColor: "var(--qgi-border)" }}>
                      <td className="py-2">
                        <div
                          className="w-1 h-4 rounded-full"
                          style={{ backgroundColor: SECTOR_COLORS[ind.sector] }}
                        />
                      </td>
                      <td className="py-2" style={{ color: "var(--qgi-text)" }}>{ind.name}</td>
                      <td className="py-2" style={{ color: SECTOR_COLORS[ind.sector] }}>{ind.sector}</td>
                      <td className="py-2 text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                        r={ind.r.toFixed(2)} {ind.sig} (n={ind.n})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- Right: Related patterns sidebar ---- */}
          <div className="space-y-4">
            {(
              [
                { title: "SAME PREDICTOR", subtitle: `${PATTERN.countryA.name} \u2192 others`, items: RELATED_PATTERNS.samePredictor },
                { title: "SAME FOLLOWING", subtitle: `others \u2192 ${PATTERN.countryB.name}`, items: RELATED_PATTERNS.sameFollowing },
                { title: "SIMILAR MIX", subtitle: "ECON + POP + HEALTH", items: RELATED_PATTERNS.similarMix },
              ] as const
            ).map((group) => (
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
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={`${item.a}-${item.b}`}
                      className="flex items-center gap-2 p-2 rounded transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                    >
                      <div className="flex items-center gap-1 shrink-0">
                        <CountryFlag alpha2={item.a} size={14} />
                        <span className="text-[9px]" style={{ color: "var(--qgi-text-dim)" }}>&rarr;</span>
                        <CountryFlag alpha2={item.b} size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-data truncate" style={{ color: "var(--qgi-text)" }}>
                          {item.aName} &rarr; {item.bName}
                        </div>
                        <div className="text-[9px]" style={{ color: "var(--qgi-text-dim)" }}>
                          {item.length}y
                        </div>
                      </div>
                      <div
                        className="font-data text-xs font-bold shrink-0"
                        style={{ color: "var(--qgi-accent)" }}
                      >
                        {item.pps.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/*  METHODOLOGY FOOTER                                           */}
        {/* ============================================================ */}
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
          moderate &lt;0.75 / strong &lt;0.85 / very strong &ge;0.85 &middot;
          Last updated 2026-04-13
        </footer>
      </div>
    </div>
  );
}
