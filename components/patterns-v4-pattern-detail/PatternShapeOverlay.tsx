"use client";

/**
 * PatternShapeOverlay — shape overlay panel for the per-pattern detail page.
 *
 * Identical to PairShapeOverlayPanel but with the "benign" and "crisis"
 * axis labels removed per founder request.
 *
 * Kicker: SHAPE OVERLAY
 * Heading: "Indicator-composite trajectory, {startYear}–{endYear}"
 */

import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { pairDetailFlagFor } from "@/lib/te-mock/patterns-v4-pair-detail-mock";
import { familyColor } from "@/lib/te-mock/l1-families";

interface PatternShapeOverlayProps {
  countryA: string;
  countryB: string;
  startYear: number;
  endYear: number;
  compositeSeriesA: number[];
  compositeSeriesB: number[];
  dominantFamilyAId: string;
  dominantFamilyBId: string;
}

function seriesToPath(
  series: number[],
  svgWidth: number,
  svgHeight: number,
  minY: number,
  maxY: number
): string {
  if (series.length < 2) return "";
  const range = maxY - minY || 1;
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * svgWidth;
      const y = svgHeight - ((v - minY) / range) * svgHeight;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function decadeTicks(
  startYear: number,
  endYear: number,
  svgWidth: number
): { x: number; label: string }[] {
  const ticks: { x: number; label: string }[] = [];
  const firstDecade = Math.ceil(startYear / 10) * 10;
  const windowLen = endYear - startYear;
  for (let y = firstDecade; y <= endYear; y += 10) {
    const x = ((y - startYear) / windowLen) * svgWidth;
    ticks.push({ x, label: String(y) });
  }
  return ticks;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 90;
const CHART_PADDING_BOTTOM = 22;

export function PatternShapeOverlay({
  countryA,
  countryB,
  startYear,
  endYear,
  compositeSeriesA,
  compositeSeriesB,
  dominantFamilyAId,
  dominantFamilyBId,
}: PatternShapeOverlayProps) {
  const colorA = familyColor(dominantFamilyAId);
  const colorB = familyColor(dominantFamilyBId);
  const sameFamily = dominantFamilyAId === dominantFamilyBId;

  const all = [...compositeSeriesA, ...compositeSeriesB];
  const minY = Math.min(...all);
  const maxY = Math.max(...all);

  const pathA = seriesToPath(compositeSeriesA, SVG_WIDTH, SVG_HEIGHT, minY, maxY);
  const pathB = seriesToPath(compositeSeriesB, SVG_WIDTH, SVG_HEIGHT, minY, maxY);
  const ticks = decadeTicks(startYear, endYear, SVG_WIDTH);

  return (
    <div
      data-tour="pair-shape-overlay"
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "10px",
        padding: "20px 22px",
        marginBottom: "20px",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "14px",
          flexWrap: "wrap",
          gap: "10px",
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
            SHAPE OVERLAY
          </div>
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 700,
              margin: 0,
              color: "var(--qgi-text)",
            }}
          >
            Indicator-composite trajectory, {startYear}
            {"–"}
            {endYear}
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

      {/* Chart — NO benign/crisis labels */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT + CHART_PADDING_BOTTOM}`}
          style={{ width: "100%", minWidth: "320px", display: "block" }}
          aria-label={`Shape overlay: ${countryA} and ${countryB} indicator-composite trajectory ${startYear} to ${endYear}`}
          role="img"
        >
          {/* Zero guide line */}
          {minY < 0 && maxY > 0 && (
            <line
              x1={0}
              y1={SVG_HEIGHT - ((0 - minY) / (maxY - minY || 1)) * SVG_HEIGHT}
              x2={SVG_WIDTH}
              y2={SVG_HEIGHT - ((0 - minY) / (maxY - minY || 1)) * SVG_HEIGHT}
              stroke="var(--qgi-border)"
              strokeWidth={0.8}
              strokeDasharray="4 4"
            />
          )}

          {/* Series B */}
          <path
            d={pathB}
            fill="none"
            stroke={colorB}
            strokeWidth={1.8}
            strokeOpacity={sameFamily ? 0.6 : 1}
            strokeDasharray={sameFamily ? "6 3" : undefined}
          />

          {/* Series A */}
          <path
            d={pathA}
            fill="none"
            stroke={colorA}
            strokeWidth={1.8}
            strokeOpacity={1}
          />

          {/* Year tick marks */}
          {ticks.map((t) => (
            <g key={t.label}>
              <line
                x1={t.x}
                y1={SVG_HEIGHT}
                x2={t.x}
                y2={SVG_HEIGHT + 4}
                stroke="var(--qgi-text-dim)"
                strokeWidth={0.8}
              />
              <text
                x={t.x}
                y={SVG_HEIGHT + CHART_PADDING_BOTTOM - 2}
                fill="var(--qgi-text-dim)"
                fontSize={8}
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
              >
                {t.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <p
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          margin: "10px 0 0",
          fontStyle: "italic",
        }}
      >
        Both countries&apos; indicator-composite z-score over the shared calendar window.
      </p>
    </div>
  );
}
