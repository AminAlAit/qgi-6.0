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
        {/*  INDICATOR TRAJECTORY PLACEHOLDER                             */}
        {/* ============================================================ */}
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
            INDICATOR TRAJECTORIES &middot; TOP 6 INDICATORS &middot; 1990-2026
          </h2>
          <div
            className="flex items-center justify-center h-48 rounded-lg"
            style={{ backgroundColor: "var(--qgi-surface-2)", border: "1px dashed var(--qgi-border)" }}
          >
            <div className="text-center">
              <div className="text-sm mb-1" style={{ color: "var(--qgi-text-muted)" }}>
                Indicator trajectories will render here
              </div>
              <div className="text-[10px] tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
                Requires pipeline pre-compute of per-country indicator time series with event markers
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  PATTERN DENSITY TIMELINE PLACEHOLDER                         */}
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
            </h2>
            <span className="text-[11px] font-data" style={{ color: "var(--qgi-text-dim)" }}>
              12,408 patterns total
            </span>
          </div>
          <div
            className="flex items-center justify-center h-24 rounded-lg"
            style={{ backgroundColor: "var(--qgi-surface-2)", border: "1px dashed var(--qgi-border)" }}
          >
            <div className="text-center">
              <div className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
                Pattern density timeline will render here
              </div>
              <div className="text-[10px] tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
                Requires pattern_density_per_country.json from pipeline
              </div>
            </div>
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
