"use client";

/**
 * PatternCompositionPie — interactive pie chart for the COMPOSITION panel.
 *
 * Replaces the chip-strip sector breakdown. Clicking a slice toggles that
 * sector off/on. Toggle state is lifted via onToggle so the parent can
 * pass it to PatternIndicatorsGrouped.
 *
 * Kicker: COMPOSITION
 * Heading: "What drove the resemblance"
 */

import { useMemo } from "react";
import type { PatternIndicator } from "@/lib/cascade-patterns/scdi-mock";
import { sectorColor } from "@/lib/cascade-patterns/sector-colors";

interface PatternCompositionPieProps {
  indicators: PatternIndicator[];
  /** Set of sectors that are currently HIDDEN (greyed out). */
  hiddenSectors: Set<string>;
  onToggle: (sector: string) => void;
}

const PIE_R = 80;
const PIE_CX = 110;
const PIE_CY = 100;

interface Slice {
  sector: string;
  count: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToXY(cx, cy, r, startAngle);
  const end = polarToXY(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function PatternCompositionPie({
  indicators,
  hiddenSectors,
  onToggle,
}: PatternCompositionPieProps) {
  const slices: Slice[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ind of indicators) {
      counts[ind.sector] = (counts[ind.sector] ?? 0) + 1;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // 2026-05-30: use reduce instead of mutating `let angle` outside .map
    // (React rule: no variable reassignment inside render).
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .reduce<Slice[]>((acc, [sector, count]) => {
        const sweep = (count / total) * 360;
        const startAngle = acc.length ? acc[acc.length - 1].endAngle : 0;
        acc.push({
          sector,
          count,
          startAngle,
          endAngle: startAngle + sweep,
          color: sectorColor(sector),
        });
        return acc;
      }, []);
  }, [indicators]);

  const svgWidth = 220;
  const svgHeight = 200;

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
          fontSize: "9px",
          letterSpacing: "1.6px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "6px",
          fontWeight: 600,
        }}
      >
        COMPOSITION
      </div>
      <h2
        style={{
          fontSize: "15px",
          fontWeight: 700,
          margin: "0 0 4px",
          color: "var(--qgi-text)",
        }}
      >
        What drove the resemblance
      </h2>
      <p
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          margin: "0 0 16px",
        }}
      >
        Click a category to show or hide its indicators. Filter chips also appear at the
        top of the indicator grid below.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        {/* Pie chart SVG */}
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ flexShrink: 0, cursor: "pointer" }}
          aria-label="Indicator composition by sector"
        >
          {slices.map((slice) => {
            const hidden = hiddenSectors.has(slice.sector);
            // For a full circle (only 1 slice), draw circle instead of arc.
            const isFull = slices.length === 1;
            const d = isFull
              ? `M ${PIE_CX} ${PIE_CY - PIE_R} A ${PIE_R} ${PIE_R} 0 1 1 ${PIE_CX - 0.01} ${PIE_CY - PIE_R} Z`
              : describeArc(PIE_CX, PIE_CY, PIE_R, slice.startAngle, slice.endAngle);
            return (
              <path
                key={slice.sector}
                d={d}
                fill={hidden ? "var(--qgi-border)" : slice.color}
                fillOpacity={hidden ? 1 : 0.85}
                stroke="var(--qgi-surface)"
                strokeWidth={2}
                style={{ transition: "fill 0.2s, fill-opacity 0.2s", cursor: "pointer" }}
                onClick={() => onToggle(slice.sector)}
                role="button"
                aria-label={`Toggle ${slice.sector}`}
              />
            );
          })}
        </svg>

        {/* Legend — counts sit immediately after their label, not pushed to edge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {slices.map((slice) => {
            const hidden = hiddenSectors.has(slice.sector);
            return (
              <button
                key={slice.sector}
                onClick={() => onToggle(slice.sector)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "3px 0",
                  textAlign: "left",
                  opacity: hidden ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: hidden ? "var(--qgi-border)" : slice.color,
                    flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "ui-monospace, monospace",
                    color: hidden ? "var(--qgi-text-dim)" : "var(--qgi-text)",
                    fontWeight: 500,
                  }}
                >
                  {slice.sector}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--qgi-text-dim)",
                  }}
                >
                  {slice.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
