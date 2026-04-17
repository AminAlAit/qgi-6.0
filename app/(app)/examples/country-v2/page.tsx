"use client";

/**
 * EXAMPLE / PROTOTYPE: Country Profile V2
 * Demonstrates the redesigned country profile from
 * ux-consult-country-profile-2026-04-16.md
 *
 * Hardcoded sample: Russia
 */

import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import dynamic from "next/dynamic";
import { useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ------------------------------------------------------------------ */
/*  Sample data                                                        */
/* ------------------------------------------------------------------ */

const COUNTRY = {
  name: "Russian Federation",
  alpha2: "RU",
  tier: "HIGH RISK",
  eventCount: 60,
  curated: true,
  scoringVersion: "V1.8.1",
  lastUpdated: "2026-04-13",
};

const L1_SCORES: { id: string; label: string; short: string; score: number; worldMedian: number }[] = [
  { id: "conflict", label: "Conflict & Security", short: "Conflict", score: 0.82, worldMedian: 0.32 },
  { id: "governance", label: "Governance & Institutions", short: "Govern.", score: 0.58, worldMedian: 0.28 },
  { id: "diplomacy", label: "Diplomacy & Geopolitics", short: "Diplo.", score: 0.71, worldMedian: 0.25 },
  { id: "economy", label: "Economic & Financial Stress", short: "Econ.", score: 0.45, worldMedian: 0.35 },
  { id: "demography", label: "Demography & Migration", short: "Demog.", score: 0.33, worldMedian: 0.30 },
  { id: "climate", label: "Climate & Environment", short: "Climate", score: 0.22, worldMedian: 0.27 },
  { id: "health", label: "Public Health", short: "Health", score: 0.38, worldMedian: 0.29 },
  { id: "rights", label: "Human Rights & Social", short: "Rights", score: 0.65, worldMedian: 0.31 },
];

const TWINS = [
  { name: "China", alpha2: "CN", pps: 0.81, topCategory: "political_repression", patterns: 24 },
  { name: "Iran", alpha2: "IR", pps: 0.78, topCategory: "sanctions_regime", patterns: 21 },
  { name: "Turkey", alpha2: "TR", pps: 0.72, topCategory: "military_expenditure", patterns: 18 },
  { name: "India", alpha2: "IN", pps: 0.68, topCategory: "population_dynamics", patterns: 16 },
  { name: "Brazil", alpha2: "BR", pps: 0.64, topCategory: "economic_volatility", patterns: 14 },
];

const SUMMARY_TEXT =
  "Russia's profile reads as conflict + governance with mass-protest pressure. " +
  "Signal-strongest in Civil War (top 3% of countries) and Diplomacy (top 8%). " +
  "Not unusual on Demography. 3 categories worsening since last update.";

/* ------------------------------------------------------------------ */
/*  Radar chart option                                                 */
/* ------------------------------------------------------------------ */

function radarOption() {
  const indicators = L1_SCORES.map((s) => ({
    name: s.short,
    max: 1,
  }));

  return {
    backgroundColor: "transparent",
    radar: {
      indicator: indicators,
      shape: "polygon",
      radius: "65%",
      axisName: {
        color: "#7a90a8",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      splitArea: { show: false },
      splitLine: { lineStyle: { color: "#243347", width: 1 } },
      axisLine: { lineStyle: { color: "#243347" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: L1_SCORES.map((s) => s.worldMedian),
            name: "World Median",
            lineStyle: { type: "dashed", color: "#4a6280", width: 1.5 },
            areaStyle: { color: "transparent" },
            symbol: "none",
          },
          {
            value: L1_SCORES.map((s) => s.score),
            name: "Russia",
            lineStyle: { color: "#38bdf8", width: 2 },
            areaStyle: { color: "rgba(56, 189, 248, 0.15)" },
            symbol: "circle",
            symbolSize: 5,
            itemStyle: { color: "#38bdf8" },
          },
        ],
      },
    ],
    tooltip: {
      trigger: "item",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Indicator trajectory chart data + option                           */
/* ------------------------------------------------------------------ */

const TRAJECTORY_YEARS = [
  1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999,
  2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009,
  2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
  2020, 2021, 2022, 2023, 2024, 2025,
];

// Raw data for Russia (approximate real values)
const RAW_INDICATORS: { name: string; data: number[]; unit: string }[] = [
  {
    name: "GDP per capita (USD)",
    unit: "USD",
    data: [
      3000, 2800, 2100, 1900, 1800, 2100, 2600, 2700, 1500, 1300,
      1800, 2100, 2400, 2900, 4100, 5300, 6900, 9100, 11600, 8600,
      10700, 14300, 15400, 15900, 14100, 9300, 8700, 10700, 11300, 11600,
      10100, 12200, 10600, 11400, 12100, 11500,
    ],
  },
  {
    name: "Military spending (% GDP)",
    unit: "%",
    data: [
      4.0, 3.8, 4.5, 4.2, 3.8, 3.5, 3.5, 3.6, 3.3, 3.4,
      3.7, 3.8, 4.0, 3.9, 3.5, 3.6, 3.5, 3.5, 3.5, 4.2,
      3.8, 3.7, 3.8, 3.9, 4.1, 4.5, 5.4, 4.2, 3.9, 3.9,
      4.3, 4.1, 4.1, 5.5, 5.9, 5.5,
    ],
  },
  {
    name: "Life expectancy (years)",
    unit: "years",
    data: [
      69.2, 69.0, 67.9, 65.1, 64.0, 64.5, 65.9, 66.5, 67.0, 65.9,
      65.3, 65.2, 65.0, 64.8, 65.3, 65.4, 66.7, 67.6, 67.9, 68.7,
      68.9, 69.8, 70.2, 70.8, 70.9, 71.4, 71.7, 72.7, 72.9, 73.3,
      71.3, 70.1, 72.4, 73.1, 73.4, 73.6,
    ],
  },
  {
    name: "Inflation rate (%)",
    unit: "%",
    data: [
      5.0, 93.0, 1526.0, 875.0, 311.0, 198.0, 47.7, 14.8, 27.7, 85.7,
      20.8, 21.5, 15.8, 13.7, 10.9, 12.7, 9.7, 9.0, 14.1, 11.7,
      6.9, 8.4, 5.1, 6.8, 7.8, 15.5, 7.0, 3.7, 2.9, 4.5,
      3.4, 6.7, 13.7, 5.9, 7.4, 6.0,
    ],
  },
  {
    name: "Trade (% GDP)",
    unit: "%",
    data: [
      30, 32, 38, 40, 42, 45, 43, 44, 55, 60,
      55, 53, 51, 50, 48, 50, 48, 45, 47, 42,
      44, 45, 44, 43, 42, 40, 38, 42, 44, 43,
      38, 43, 36, 38, 40, 39,
    ],
  },
  {
    name: "Population (millions)",
    unit: "M",
    data: [
      148.3, 148.6, 148.5, 148.3, 148.0, 147.6, 147.1, 146.7, 146.3, 145.9,
      145.5, 145.1, 144.7, 144.3, 143.8, 143.5, 143.0, 142.8, 142.7, 142.7,
      142.8, 143.0, 143.2, 143.3, 146.3, 146.3, 146.4, 146.5, 146.6, 146.7,
      146.2, 145.6, 144.2, 143.9, 143.7, 143.5,
    ],
  },
];

// Min-max normalize each series to 0-100
function normalizeMinMax(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (max === min) return data.map(() => 50);
  return data.map((v) => ((v - min) / (max - min)) * 100);
}

const INDICATOR_COLORS = ["#38bdf8", "#34d399", "#f87171", "#fbbf24", "#a78bfa", "#fb923c"];

// #2: Restored original longer/more telling event names (owner preferred them)
const EVENT_MARKERS: { year: number; label: string }[] = [
  { year: 1991, label: "USSR collapse" },
  { year: 1998, label: "Financial crisis" },
  { year: 2008, label: "Georgia war" },
  { year: 2014, label: "Crimea annexation" },
  { year: 2022, label: "Ukraine invasion" },
];

/** Indices of the 3 most volatile indicators (GDP, Military, Inflation) */
const DEFAULT_VISIBLE_INDICES = new Set([0, 1, 3]);

function indicatorTrajectoryOption(showAll: boolean) {
  // Build legend.selected — top 3 visible by default, rest hidden unless showAll
  const legendSelected: Record<string, boolean> = {};
  RAW_INDICATORS.forEach((ind, i) => {
    legendSelected[ind.name] = showAll || DEFAULT_VISIBLE_INDICES.has(i);
  });
  legendSelected["World median"] = true;

  // Area fill colors at 6% opacity for subtle shape distinction
  const areaAlpha = "0F"; // hex ~6%

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: any[] = RAW_INDICATORS.map((ind, i) => ({
    name: ind.name,
    type: "line",
    data: normalizeMinMax(ind.data),
    smooth: true,
    lineStyle: { width: 1.5, color: INDICATOR_COLORS[i] },
    itemStyle: { color: INDICATOR_COLORS[i] },
    areaStyle: { color: INDICATOR_COLORS[i] + areaAlpha, origin: "start" },
    symbol: "none",
    emphasis: { lineStyle: { width: 2.5 } },
    z: DEFAULT_VISIBLE_INDICES.has(i) ? 3 : 1,
  }));

  // World median reference line — subtle
  series.push({
    name: "World median",
    type: "line",
    data: TRAJECTORY_YEARS.map(() => 50),
    smooth: false,
    lineStyle: { width: 1, color: "#4a628060", type: [4, 4] as unknown as string },
    itemStyle: { color: "#4a628060" },
    symbol: "none",
    emphasis: { lineStyle: { width: 1 } },
    z: 0,
  });

  // Event marker lines — vertical labels, short text
  // Event labels anchored to BOTTOM of the chart, running upward.
  // This keeps them far away from the legend at the top.
  const markLines = EVENT_MARKERS.map((e) => ({
    xAxis: String(e.year),
    lineStyle: { color: "#f8717130", width: 1, type: "solid" as const },
    label: {
      formatter: e.label,
      position: "insideStartTop" as const,
      color: "#f87171aa",
      fontSize: 9,
      fontFamily: "'JetBrains Mono', monospace",
      rotate: -90,
      distance: 4,
    },
  }));

  return {
    backgroundColor: "transparent",
    grid: { top: 55, right: 20, bottom: 35, left: 45 },
    legend: {
      top: 0,
      left: "center",
      textStyle: { color: "#7a90a8", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
      itemWidth: 18,
      itemHeight: 2,
      itemGap: 12,
      selected: legendSelected,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      formatter: (params: Array<{ seriesName: string; value: number; dataIndex: number; color: string }>) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const year = TRAJECTORY_YEARS[params[0].dataIndex];
        let html = `<div style="font-weight:600;margin-bottom:4px">${year}</div>`;
        params.forEach((p) => {
          if (p.seriesName === "World median") return;
          const raw = RAW_INDICATORS.find((r) => r.name === p.seriesName);
          const rawVal = raw ? raw.data[p.dataIndex] : p.value;
          const unit = raw ? raw.unit : "";
          const formatted = typeof rawVal === "number" && rawVal > 1000
            ? rawVal.toLocaleString()
            : typeof rawVal === "number"
              ? rawVal.toFixed(1)
              : rawVal;
          html += `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color}">\u25CF ${p.seriesName}</span><span style="font-weight:600">${formatted} ${unit}</span></div>`;
        });
        return html;
      },
    },
    xAxis: {
      type: "category",
      data: TRAJECTORY_YEARS.map(String),
      axisLine: { lineStyle: { color: "#243347" } },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        interval: 4,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLine: { show: false },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        formatter: "{value}",
      },
      splitLine: { lineStyle: { color: "#243347", width: 1 } },
    },
    series: series.map((s, i) => ({
      ...s,
      // Attach markLine only to the first series to avoid duplicates
      ...(i === 0
        ? {
            markLine: {
              silent: true,
              symbol: "none",
              data: markLines,
            },
          }
        : {}),
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Pattern density chart data + option                                */
/* ------------------------------------------------------------------ */

function generatePatternDensityData(): { year: number; count: number }[] {
  const data: { year: number; count: number }[] = [];
  const rng = (min: number, max: number, seed: number) =>
    min + Math.round((Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 1) * (max - min));

  for (let y = 1962; y <= 2020; y++) {
    let min: number, max: number;
    if (y <= 1970) { min = 2; max = 3; }
    else if (y <= 1980) { min = 5; max = 8; }
    else if (y <= 1990) { min = 3; max = 5; }
    else if (y <= 2000) { min = 1; max = 2; }
    else if (y <= 2010) { min = 4; max = 6; }
    else { min = 3; max = 4; }
    data.push({ year: y, count: rng(min, max, y) });
  }
  return data;
}

const PATTERN_DENSITY_DATA = generatePatternDensityData();

function patternDensityOption() {
  return {
    backgroundColor: "transparent",
    grid: { top: 15, right: 15, bottom: 30, left: 40 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      formatter: (params: Array<{ value: number; dataIndex: number }>) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const d = PATTERN_DENSITY_DATA[params[0].dataIndex];
        return `<div style="font-weight:600">${d.year}</div><div>${d.count} pattern starts</div>`;
      },
    },
    xAxis: {
      type: "category",
      data: PATTERN_DENSITY_DATA.map((d) => String(d.year)),
      axisLine: { lineStyle: { color: "#243347" } },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        interval: 4,
        rotate: 0,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: {
        color: "#7a90a8",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      splitLine: { lineStyle: { color: "#243347", width: 1 } },
    },
    series: [
      {
        type: "bar",
        data: PATTERN_DENSITY_DATA.map((d) => d.count),
        itemStyle: { color: "#fbbf24", borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 10,
        emphasis: { itemStyle: { color: "#fcd34d" } },
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Precedents table (collapsed)                                       */
/* ------------------------------------------------------------------ */

const SAMPLE_PRECEDENTS = [
  { category: "Civil War & Insurgency", tier: "S", salience: 2.41, recipes: 34 },
  { category: "Political Repression", tier: "S", salience: 2.18, recipes: 28 },
  { category: "Military Conflict", tier: "M", salience: 1.92, recipes: 22 },
  { category: "Sanctions Regime", tier: "S", salience: 1.87, recipes: 19 },
  { category: "Diplomatic Isolation", tier: "M", salience: 1.73, recipes: 15 },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CountryV2Page() {
  const [precedentsOpen, setPrecedentsOpen] = useState(false);
  const [showAllIndicators, setShowAllIndicators] = useState(false);

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
        {/*  HERO BAR                                                     */}
        {/* ============================================================ */}
        <section
          className="rounded-xl p-6 lg:p-8"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          {/* Top row: identity + meta */}
          <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <CountryFlag alpha2={COUNTRY.alpha2} size={44} />
              <div>
                <h1 className="text-2xl font-semibold tracking-wide">
                  {COUNTRY.name.toUpperCase()}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className="px-2.5 py-1 rounded text-[10px] tracking-widest font-semibold"
                    style={{
                      backgroundColor: "rgba(248, 113, 113, 0.15)",
                      color: "#f87171",
                      border: "1px solid rgba(248, 113, 113, 0.3)",
                    }}
                  >
                    {COUNTRY.tier}
                  </span>
                  {COUNTRY.curated && (
                    <span className="text-[10px] tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
                      Verified events &middot; {COUNTRY.eventCount} events curated
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right text-[10px] tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
              Scoring: {COUNTRY.scoringVersion}
              <br />
              Updated: {COUNTRY.lastUpdated}
            </div>
          </div>

          {/* Dynamic summary */}
          <div
            className="p-4 rounded-lg text-sm leading-relaxed mb-6"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              borderLeft: "3px solid var(--qgi-accent)",
            }}
          >
            {SUMMARY_TEXT}
          </div>

          {/* L1 comparison strip */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] tracking-widest uppercase"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                L1 vs world median
              </span>
              <InfoTooltip text="Each bar shows this country's L1 salience score relative to the world median. Longer bars = more anomalous." />
            </div>
            <div className="space-y-1.5">
              {L1_SCORES.map((s) => {
                const delta = s.score - s.worldMedian;
                const barPct = Math.min(Math.abs(delta) / 0.6, 1) * 100;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span
                      className="w-16 text-[10px] tracking-wider text-right truncate"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {s.short}
                    </span>
                    <div className="flex-1 h-3.5 rounded relative" style={{ backgroundColor: "var(--qgi-surface-2)" }}>
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: delta > 0 ? "#f87171" : "#34d399",
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span
                      className="font-data text-[11px] w-12"
                      style={{ color: delta > 0 ? "#f87171" : "#34d399" }}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  ROW 1: Radar + Structural Twins (2-col)                     */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ---- Risk Fingerprint Radar ---- */}
          <section
            className="rounded-xl p-6"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold mb-2"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              RISK FINGERPRINT
            </h2>
            <div className="h-[340px]">
              <ReactECharts
                option={radarOption()}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "svg" }}
              />
            </div>
            <div className="flex items-center gap-6 mt-2 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: "#38bdf8" }} />
                <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                  This country
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t border-dashed" style={{ borderColor: "#4a6280" }} />
                <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                  World median
                </span>
              </div>
            </div>
          </section>

          {/* ---- Structural Twins Panel ---- */}
          <section
            className="rounded-xl p-6"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold mb-4"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              STRUCTURAL TWINS &middot; TOP 5
            </h2>

            <div className="space-y-3">
              {TWINS.map((twin, i) => (
                <div
                  key={twin.alpha2}
                  className="flex items-center gap-4 p-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: i === 0 ? "rgba(56, 189, 248, 0.06)" : "var(--qgi-surface-2)",
                    border: `1px solid ${i === 0 ? "rgba(56, 189, 248, 0.2)" : "transparent"}`,
                  }}
                >
                  <CountryFlag alpha2={twin.alpha2} size={22} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{twin.name}</div>
                    <div className="text-[10px] tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
                      {twin.topCategory.replace(/_/g, " ")} &middot; {twin.patterns} patterns
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-data text-lg font-bold"
                      style={{ color: "var(--qgi-accent)" }}
                    >
                      {twin.pps.toFixed(2)}
                    </div>
                    <div className="text-[9px] tracking-widest" style={{ color: "var(--qgi-text-dim)" }}>
                      PPS
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ============================================================ */}
        {/*  INDICATOR TRAJECTORIES                                       */}
        {/* ============================================================ */}
        <section
          className="rounded-xl p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              INDICATOR TRAJECTORIES &middot; {showAllIndicators ? "ALL 6" : "TOP 3"} INDICATORS &middot; 1990-2025
              <InfoTooltip text="Shows the raw economic story of this country over 35 years. Each line is a key indicator normalized to 0-100. Red vertical markers show major geopolitical events. Click legend items to show/hide individual series. An analyst can instantly see how indicators responded to real-world shocks (e.g. GDP crashed in 1998, military spending spiked in 2022)." />
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAllIndicators((v) => !v)}
                className="px-2.5 py-1 rounded text-[9px] tracking-wider uppercase transition-colors"
                style={{
                  backgroundColor: showAllIndicators ? "rgba(56, 189, 248, 0.15)" : "rgba(122, 144, 168, 0.1)",
                  color: showAllIndicators ? "#38bdf8" : "#7a90a8",
                  border: `1px solid ${showAllIndicators ? "rgba(56, 189, 248, 0.3)" : "rgba(122, 144, 168, 0.2)"}`,
                }}
              >
                {showAllIndicators ? "Top 3" : "All 6"}
              </button>
              <span className="text-[9px]" style={{ color: "var(--qgi-text-dim)" }}>
                Normalized 0-100 &middot; hover for raw
              </span>
            </div>
          </div>
          <div className="h-[420px]">
            <ReactECharts
              option={indicatorTrajectoryOption(showAllIndicators)}
              style={{ height: "100%", width: "100%" }}
              opts={{ renderer: "svg" }}
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  PATTERN DENSITY TIMELINE                                     */}
        {/* ============================================================ */}
        <section
          className="rounded-xl p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <h2
              className="text-[11px] tracking-widest uppercase font-semibold"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              PATTERN DENSITY (by year)
              <InfoTooltip text="Shows when QGI found structural similarity between this country and others. A cluster of pattern starts in one decade means many countries' trajectories aligned with this country during that period. Sparse years mean the country was structurally unique. It's a meta-signal about how 'pattern-rich' each era was." />
            </h2>
            <span className="text-[11px] font-data" style={{ color: "var(--qgi-text-dim)" }}>
              12,408 patterns total
            </span>
          </div>
          <div className="text-[10px] tracking-wider mb-3" style={{ color: "var(--qgi-text-dim)" }}>
            Years with more pattern starts = more structural similarity to other countries&apos; trajectories.
          </div>
          <div className="h-[240px]">
            <ReactECharts
              option={patternDensityOption()}
              style={{ height: "100%", width: "100%" }}
              opts={{ renderer: "svg" }}
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  PRECEDENTS TABLE (collapsed by default)                      */}
        {/* ============================================================ */}
        <section
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <button
            onClick={() => setPrecedentsOpen(!precedentsOpen)}
            className="w-full flex items-center justify-between p-5 transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            <span className="text-[11px] tracking-widest uppercase font-semibold">
              FULL PRECEDENT TABLE ({SAMPLE_PRECEDENTS.length} categories)
            </span>
            <span className="text-sm">{precedentsOpen ? "\u25B2" : "\u25BC"}</span>
          </button>
          {precedentsOpen && (
            <div className="px-5 pb-5">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ color: "var(--qgi-text-dim)" }}>
                    <th className="text-left py-2 tracking-widest">CATEGORY</th>
                    <th className="text-center py-2 tracking-widest">TIER</th>
                    <th className="text-right py-2 tracking-widest">SALIENCE</th>
                    <th className="text-right py-2 tracking-widest">RECIPES</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_PRECEDENTS.map((p) => (
                    <tr key={p.category} className="border-t" style={{ borderColor: "var(--qgi-border)" }}>
                      <td className="py-2" style={{ color: "var(--qgi-text)" }}>{p.category}</td>
                      <td className="py-2 text-center font-data font-bold" style={{ color: p.tier === "S" ? "#f87171" : "#fbbf24" }}>
                        {p.tier}
                      </td>
                      <td className="py-2 text-right font-data" style={{ color: "var(--qgi-text)" }}>
                        {p.salience.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                        {p.recipes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
          V1.8.1 z-score + RRF &middot; 126 countries scored &middot; 88 curated &middot;
          Pattern correlation Pearson r &ge; 0.65 &middot; Salience &gt; 1.2 = high-signal &middot;
          Last updated {COUNTRY.lastUpdated}
        </footer>
      </div>
    </div>
  );
}
