"use client";

/**
 * PatternCompositeTrajectory — composite rhyme line + per-category composites.
 *
 * The overall composite uses Year 1..N on the x-axis (window-relative) so
 * both countries' series overlay correctly even for offset patterns. The
 * calendar-year offset is shown in the segment timeline panel above.
 *
 * Per-category composite subplots are shown below the main chart, one per
 * category that has >=2 indicators in this pattern. Laid out in a 2-column
 * responsive grid.
 *
 * Kicker: COMPOSITE TRAJECTORY
 * Heading: "Indicator-composite trajectory · Year 1 → Year N"
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
  compositeA: number[];
  compositeB: number[];
  indicators: PatternIndicator[];
  dominantFamilyAId: string;
  dominantFamilyBId: string;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 80;
const AXIS_PAD = 20;
const SUB_HEIGHT = 50;

function buildPath(series: number[], w: number, h: number): string {
  if (series.length < 2) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function MiniChart({
  seriesA,
  seriesB,
  colorA,
  colorB,
  w = SVG_WIDTH,
  h = SVG_HEIGHT,
  length,
  xAxisStyle = "years",
}: {
  seriesA: number[];
  seriesB: number[];
  colorA: string;
  colorB: string;
  w?: number;
  h?: number;
  length: number;
  xAxisStyle?: "years";
}) {
  const pathA = buildPath(seriesA, w, h);
  const pathB = buildPath(seriesB, w, h);
  const sameColor = colorA === colorB;

  // Year tick marks: Year 1, Year N, midpoint.
  const tickPositions = [0, Math.floor((length - 1) / 2), length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h + AXIS_PAD}`}
      style={{ width: "100%", display: "block" }}
      aria-hidden="true"
    >
      {/* Zero guide */}
      {(() => {
        const all = [...seriesA, ...seriesB];
        const min = Math.min(...all);
        const max = Math.max(...all);
        if (min < 0 && max > 0) {
          const y = h - ((0 - min) / (max - min || 1)) * h;
          return (
            <line
              x1={0}
              y1={y}
              x2={w}
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

      {/* Year axis ticks */}
      {tickPositions.map((i) => {
        const x = (i / (length - 1)) * w;
        const label =
          i === 0 ? "Year 1" : i === length - 1 ? `Year ${length}` : `Year ${i + 1}`;
        return (
          <g key={i}>
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
              y={h + AXIS_PAD - 2}
              fill="var(--qgi-text-dim)"
              fontSize={7}
              fontFamily="ui-monospace, monospace"
              textAnchor="middle"
            >
              {xAxisStyle === "years" ? label : `${i + 1}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PatternCompositeTrajectory({
  countryA,
  countryB,
  length,
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
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "14px",
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
            Indicator-composite trajectory &middot; Year 1 &rarr; Year {length}
          </h2>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {[
            { name: countryA, color: colorA, dashed: false },
            { name: countryB, color: sameFamily ? colorB : colorB, dashed: sameFamily },
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

      {/* Main chart */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <MiniChart
          seriesA={compositeA}
          seriesB={compositeB}
          colorA={colorA}
          colorB={colorB}
          length={length}
          w={SVG_WIDTH}
          h={SVG_HEIGHT}
        />
      </div>

      <p
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          margin: "8px 0 0",
          fontStyle: "italic",
        }}
      >
        Both countries&apos; indicator-composite z-score normalized to the shared window
        length. Year 1 = each country&apos;s start year.
      </p>

      {/* Per-category composites */}
      {categoryComposites.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1.2px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "12px",
              fontWeight: 600,
            }}
          >
            BY CATEGORY
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
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
