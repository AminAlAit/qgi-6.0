"use client";

/**
 * PatternCompositeTrajectory — composite rhyme line + per-category composites.
 *
 * Main chart always uses window-relative Year 1..N axis (no toggle).
 * Calendar offset is already visible in the Segment Timeline panel above.
 * Per-category composite subplots also use Year 1..N.
 *
 * Kicker: COMPOSITE TRAJECTORY
 * Heading: "Indicator-composite trajectory"
 * Subtitle: plain-English description, keeps z-score, no em-dash.
 */

import { useMemo } from "react";
import type { PatternIndicator } from "@/lib/cascade-patterns/scdi-mock";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { pairDetailFlagFor } from "@/lib/te-mock/patterns-v4-pair-detail-mock";
import { familyColor } from "@/lib/te-mock/l1-families";
import { sectorColor } from "@/lib/cascade-patterns/sector-colors";

interface PatternCompositeTrajectoryProps {
  countryA: string;
  countryB: string;
  length: number;
  /** Calendar start year of country A's window. */
  startA: number;
  /** Calendar end year of country A's window. */
  endA: number;
  /** Calendar start year of country B's window. */
  startB: number;
  /** Calendar end year of country B's window. */
  endB: number;
  compositeA: number[];
  compositeB: number[];
  indicators: PatternIndicator[];
  dominantFamilyAId: string;
  dominantFamilyBId: string;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 80;
const AXIS_PAD = 22;
// Horizontal padding inside the SVG so first/last labels don't clip.
const X_PAD = 28;
const SUB_HEIGHT = 50;

function buildPath(series: number[], drawW: number, h: number): string {
  if (series.length < 2) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  return series
    .map((v, i) => {
      const x = X_PAD + (i / (series.length - 1)) * drawW;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * MiniChart — SVG sparkline with axis labels.
 *
 * xMode "relative" (default): Year 1..N ticks. Both series plotted in the
 *   same X space so they overlay regardless of calendar offset.
 * xMode "calendar": each series plotted at its own calendar start position
 *   on a shared axis from calMin to calMax, so a 7-year offset is visible.
 */
function MiniChart({
  seriesA,
  seriesB,
  colorA,
  colorB,
  w = SVG_WIDTH,
  h = SVG_HEIGHT,
  length,
  xMode = "relative",
  startA,
  startB,
  calMin,
  calMax,
}: {
  seriesA: number[];
  seriesB: number[];
  colorA: string;
  colorB: string;
  w?: number;
  h?: number;
  length: number;
  xMode?: "relative" | "calendar";
  /** Calendar start year of A (required for xMode "calendar"). */
  startA?: number;
  /** Calendar start year of B (required for xMode "calendar"). */
  startB?: number;
  /** Axis minimum year (required for xMode "calendar"). */
  calMin?: number;
  /** Axis maximum year (required for xMode "calendar"). */
  calMax?: number;
}) {
  const sameColor = colorA === colorB;
  // Total viewBox width includes horizontal padding on both sides.
  const totalW = w + X_PAD * 2;
  // Inner draw area width.
  const drawW = w;

  // Build paths.
  let pathA = "";
  let pathB = "";

  if (
    xMode === "calendar" &&
    calMin != null &&
    calMax != null &&
    startA != null &&
    startB != null
  ) {
    const calSpan = calMax - calMin || 1;
    // Map a (startYear, seriesIndex) to an x coordinate in the viewBox.
    const calX = (startYear: number, i: number) =>
      X_PAD + ((startYear - calMin + i) / calSpan) * drawW;

    const minAll = Math.min(...seriesA, ...seriesB);
    const maxAll = Math.max(...seriesA, ...seriesB);
    const range = maxAll - minAll || 1;
    const yOf = (v: number) => h - ((v - minAll) / range) * h;

    pathA = seriesA
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"} ${calX(startA, i).toFixed(1)} ${yOf(v).toFixed(1)}`
      )
      .join(" ");
    pathB = seriesB
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"} ${calX(startB, i).toFixed(1)} ${yOf(v).toFixed(1)}`
      )
      .join(" ");
  } else {
    // Relative mode: both series share the same X space.
    pathA = buildPath(seriesA, drawW, h);
    pathB = buildPath(seriesB, drawW, h);
  }

  // Axis ticks.
  const ticks: Array<{ x: number; label: string }> = [];

  if (xMode === "calendar" && calMin != null && calMax != null) {
    const calSpan = calMax - calMin || 1;
    // Decade ticks on the calendar axis.
    const firstDecade = Math.ceil(calMin / 10) * 10;
    for (let y = firstDecade; y <= calMax; y += 10) {
      const x = X_PAD + ((y - calMin) / calSpan) * drawW;
      ticks.push({ x, label: String(y) });
    }
  } else {
    // Year 1, midpoint, Year N.
    const mid = Math.floor((length - 1) / 2);
    [0, mid, length - 1].forEach((i) => {
      const x = X_PAD + (i / (length - 1)) * drawW;
      const label =
        i === 0 ? "Year 1" : i === length - 1 ? `Year ${length}` : `Year ${i + 1}`;
      ticks.push({ x, label });
    });
  }

  return (
    <svg
      viewBox={`0 0 ${totalW} ${h + AXIS_PAD}`}
      style={{ width: "100%", display: "block" }}
      aria-hidden="true"
    >
      {/* Zero guide (relative mode only — calendar mode has heterogeneous ranges) */}
      {xMode === "relative" &&
        (() => {
          const all = [...seriesA, ...seriesB];
          const min = Math.min(...all);
          const max = Math.max(...all);
          if (min < 0 && max > 0) {
            const y = h - ((0 - min) / (max - min || 1)) * h;
            return (
              <line
                x1={X_PAD}
                y1={y}
                x2={X_PAD + drawW}
                y2={y}
                stroke="var(--qgi-border)"
                strokeWidth={0.6}
                strokeDasharray="3 3"
              />
            );
          }
          return null;
        })()}

      {/* B drawn first so A is on top */}
      <path
        d={pathB}
        fill="none"
        stroke={colorB}
        strokeWidth={1.6}
        strokeOpacity={sameColor ? 0.55 : 1}
        strokeDasharray={sameColor ? "5 3" : undefined}
      />
      <path d={pathA} fill="none" stroke={colorA} strokeWidth={1.6} strokeOpacity={1} />

      {/* Axis ticks + labels */}
      {ticks.map(({ x, label }) => (
        <g key={label}>
          <line
            x1={x}
            y1={h}
            x2={x}
            y2={h + 4}
            stroke="var(--qgi-text-dim)"
            strokeWidth={0.7}
          />
          <text
            x={x}
            y={h + AXIS_PAD - 3}
            fill="var(--qgi-text-dim)"
            fontSize={7}
            fontFamily="ui-monospace, monospace"
            textAnchor="middle"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function PatternCompositeTrajectory({
  countryA,
  countryB,
  length,
  // startA/endA/startB/endB kept in interface so caller API is stable; main chart is always
  // window-relative (Year 1..N). Calendar offset is shown in the Segment Timeline above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startA: _startA,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  endA: _endA,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startB: _startB,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  endB: _endB,
  compositeA,
  compositeB,
  indicators,
  dominantFamilyAId,
  dominantFamilyBId,
}: PatternCompositeTrajectoryProps) {
  const colorA = familyColor(dominantFamilyAId);
  const colorB = familyColor(dominantFamilyBId);
  const sameFamily = dominantFamilyAId === dominantFamilyBId;

  // Per-category composites: only categories with >=2 indicators.
  const categoryComposites = useMemo(() => {
    const byCategory: Record<string, PatternIndicator[]> = {};
    for (const ind of indicators) {
      if (!byCategory[ind.sector]) byCategory[ind.sector] = [];
      byCategory[ind.sector].push(ind);
    }
    return Object.entries(byCategory)
      .filter(([, inds]) => inds.length >= 2)
      .map(([sector, inds]) => {
        const n = inds[0].series_a.length;
        const compA = Array.from({ length: n }, (_, i) => {
          const sum = inds.reduce((acc, ind) => acc + (ind.series_a[i] ?? 0), 0);
          return Math.round((sum / inds.length) * 100) / 100;
        });
        const compB = Array.from({ length: n }, (_, i) => {
          const sum = inds.reduce((acc, ind) => acc + (ind.series_b[i] ?? 0), 0);
          return Math.round((sum / inds.length) * 100) / 100;
        });
        return { sector, count: inds.length, compA, compB };
      })
      .sort((a, b) => b.count - a.count);
  }, [indicators]);

  return (
    <div
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "10px",
        padding: "20px 22px",
        marginBottom: "20px",
      }}
    >
      {/* Header row: kicker + h2 + legend */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "6px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1.6px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "4px",
              fontWeight: 600,
            }}
          >
            COMPOSITE TRAJECTORY
          </div>
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 700,
              margin: 0,
              color: "var(--qgi-text)",
            }}
          >
            Indicator-composite trajectory
          </h2>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {[
            { name: countryA, color: colorA, dashed: false },
            { name: countryB, color: colorB, dashed: sameFamily },
          ].map(({ name, color, dashed }) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width={28} height={10} aria-hidden style={{ flexShrink: 0 }}>
                <line
                  x1={0}
                  y1={5}
                  x2={28}
                  y2={5}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={dashed ? "5 3" : undefined}
                  strokeOpacity={dashed ? 0.6 : 1}
                />
              </svg>
              <FlagImg
                emoji={pairDetailFlagFor(name)}
                name={name}
                width={14}
                radius={1}
              />
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--qgi-text-muted)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Subtitle — plain-English, keeps z-score, no em-dash */}
      <p
        style={{
          fontSize: "12px",
          color: "var(--qgi-text-muted)",
          margin: "0 0 14px",
          lineHeight: 1.6,
          maxWidth: "640px",
        }}
      >
        One line per country, blending all {indicators.length} of its indicators into a
        single trace. Each indicator is put on a z-score scale first, so a slow-moving
        measure and a volatile one count equally, then they are averaged together. Both
        lines run from Year 1 to Year {length} so the shared shape stands out clearly.
        Where the two lines rise and fall in step, the countries were moving alike.
      </p>

      {/* Main chart — always window-relative Year 1..N */}
      <div style={{ width: "100%" }}>
        <div style={{ overflowX: "auto" }}>
          <MiniChart
            seriesA={compositeA}
            seriesB={compositeB}
            colorA={colorA}
            colorB={colorB}
            length={length}
            w={SVG_WIDTH}
            h={SVG_HEIGHT}
            xMode="relative"
          />
        </div>
      </div>

      {/* Per-category composites */}
      {categoryComposites.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          {/* "BY CATEGORY" as h2 — same size/weight as panel h2 */}
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 700,
              margin: "0 0 14px",
              color: "var(--qgi-text)",
            }}
          >
            By category
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "14px",
            }}
          >
            {categoryComposites.map(({ sector, count, compA, compB }) => {
              const sColor = sectorColor(sector);
              return (
                <div
                  key={sector}
                  style={{
                    background: "var(--qgi-bg)",
                    border: "1px solid var(--qgi-border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: sColor,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "10px",
                        fontFamily: "ui-monospace, monospace",
                        color: sColor,
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                      }}
                    >
                      {sector}
                    </span>
                    <span
                      style={{
                        fontSize: "9px",
                        fontFamily: "ui-monospace, monospace",
                        color: "var(--qgi-text-dim)",
                      }}
                    >
                      {count} indicators
                    </span>
                  </div>
                  <MiniChart
                    seriesA={compA}
                    seriesB={compB}
                    colorA={sColor}
                    colorB={`${sColor}80`}
                    length={length}
                    w={280}
                    h={SUB_HEIGHT}
                    xMode="relative"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
