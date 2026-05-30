"use client";

/**
 * PatternIndicatorsGrouped — §5 Indicator detail, grouped by sector.
 *
 * Mirrors the /recipes page L1-family grouping idiom.
 *
 * - No sort chips. No direction chips. No URL state.
 * - Each sector is a section with a colored left border + header band.
 * - Within each section, SCDIs sorted by correlation desc.
 * - Hidden sectors (from pie chart toggle) collapse their entire section.
 * - Indicator cards are expandable: click to expand to ~4x size.
 * - Expanded card: larger sparkline with gridlines + axis labels.
 * - "Align to window" toggle in expanded card: OFF = calendar years, ON = Year 1..N.
 * - "r =" replaced with "correlation =".
 * - No direction badges.
 */

import { useState } from "react";
import type { PatternIndicator } from "@/lib/cascade-patterns/scdi-mock";
import { sectorColor } from "@/lib/cascade-patterns/sector-colors";
import { MUTED_GRAY, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { pairDetailFlagFor } from "@/lib/te-mock/patterns-v4-pair-detail-mock";

// ── Compact Sparkline ────────────────────────────────────────────────────────

function Sparkline({
  series,
  color,
  width = 120,
  height = 32,
}: {
  series: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const pad = 3;
  const path = series
    .map((v, i) => {
      const x = pad + (i / (series.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Expanded interactive sparkline with gridlines + axis ─────────────────────

function ExpandedSparkline({
  series,
  color,
  label,
  windowStart,
  useWindowRelative,
  length,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  seriesIndex,
}: {
  series: number[];
  color: string;
  label: string;
  windowStart: number;
  useWindowRelative: boolean;
  length: number;
  seriesIndex: number; // 0 = A, 1 = B (reserved for future per-side styling)
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const w = 260;
  const h = 80;
  const padLeft = 32;
  const padRight = 8;
  const padTop = 8;
  const padBot = 24;
  const innerW = w - padLeft - padRight;
  const innerH = h - padTop - padBot;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const n = series.length;

  const toX = (i: number) => padLeft + (i / (n - 1)) * innerW;
  const toY = (v: number) => padTop + (1 - (v - min) / range) * innerH;

  const path = series
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");

  // Tick positions: 0, mid, last.
  const xTicks = [0, Math.floor((n - 1) / 2), n - 1];
  const yTicks = [min, (min + max) / 2, max];

  const labelForX = (i: number) => {
    if (useWindowRelative) return `Y${i + 1}`;
    return String(windowStart + Math.round((i / (n - 1)) * (length - 1)));
  };

  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text-dim)",
          marginBottom: "4px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <FlagImg emoji={pairDetailFlagFor(label)} name={label} width={14} radius={1} />
        {label.slice(0, 14)}
      </div>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid lines */}
        {yTicks.map((v, gi) => {
          const y = toY(v);
          return (
            <g key={gi}>
              <line
                x1={padLeft}
                y1={y}
                x2={w - padRight}
                y2={y}
                stroke="var(--qgi-border)"
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 3}
                y={y + 3}
                fill="var(--qgi-text-dim)"
                fontSize={6}
                textAnchor="end"
                fontFamily="ui-monospace, monospace"
              >
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Series path */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hover dots */}
        {series.map((v, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(v)}
            r={hovered === i ? 4 : 0}
            fill={color}
            style={{ transition: "r 0.1s" }}
          />
        ))}

        {/* Invisible hover targets */}
        {series.map((v, i) => (
          <rect
            key={i}
            x={toX(i) - innerW / n / 2}
            y={padTop}
            width={innerW / n}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}

        {/* Hover tooltip */}
        {hovered !== null && (
          <g>
            <line
              x1={toX(hovered)}
              y1={padTop}
              x2={toX(hovered)}
              y2={padTop + innerH}
              stroke={color}
              strokeWidth={0.8}
              strokeOpacity={0.5}
            />
            <rect
              x={toX(hovered) - 22}
              y={padTop - 14}
              width={44}
              height={13}
              rx={3}
              fill="var(--qgi-surface)"
              stroke="var(--qgi-border)"
              strokeWidth={0.7}
            />
            <text
              x={toX(hovered)}
              y={padTop - 4}
              fill="var(--qgi-text)"
              fontSize={7}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {labelForX(hovered)}: {series[hovered].toFixed(2)}
            </text>
          </g>
        )}

        {/* X axis ticks */}
        {xTicks.map((i) => (
          <g key={i}>
            <line
              x1={toX(i)}
              y1={padTop + innerH}
              x2={toX(i)}
              y2={padTop + innerH + 3}
              stroke="var(--qgi-text-dim)"
              strokeWidth={0.7}
            />
            <text
              x={toX(i)}
              y={h - 4}
              fill="var(--qgi-text-dim)"
              fontSize={6}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {labelForX(i)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Single indicator card ────────────────────────────────────────────────────

function IndicatorCard({
  indicator,
  countryA,
  countryB,
  startA,
  startB,
  length,
}: {
  indicator: PatternIndicator;
  countryA: string;
  countryB: string;
  startA: number;
  startB: number;
  length: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [alignToWindow, setAlignToWindow] = useState(false);

  const stripeColor = sectorColor(indicator.sector);
  const t = Math.max(0, Math.min(1, (indicator.pearson_r - 0.6) / 0.4));
  const rColor = lerpHexToRgb(MUTED_GRAY, "#FFFFFF", t);
  const rGlow = confidenceGlow("#FFFFFF", t);
  const colorA = stripeColor;
  const colorB = `${stripeColor}88`;

  return (
    <div
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow 0.2s",
        boxShadow: expanded ? "0 4px 24px rgba(0,0,0,0.3)" : undefined,
        gridColumn: expanded ? "span 2" : undefined,
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div style={{ display: "flex", flex: 1 }}>
        {/* Accent stripe */}
        <div style={{ width: "3px", background: stripeColor, flexShrink: 0 }} />

        <div style={{ flex: 1, padding: expanded ? "16px 18px" : "12px 14px" }}>
          {/* Sector + name */}
          <div style={{ marginBottom: "8px" }}>
            <span
              style={{
                fontSize: "9px",
                fontFamily: "ui-monospace, monospace",
                color: stripeColor,
                letterSpacing: "1px",
                fontWeight: 600,
                textTransform: "uppercase" as const,
              }}
            >
              {indicator.sector}
            </span>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--qgi-text)",
                lineHeight: 1.35,
                marginTop: "2px",
              }}
            >
              {indicator.name}
            </div>
          </div>

          {!expanded ? (
            /* Compact view */
            <>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "ui-monospace, monospace",
                      color: "var(--qgi-text-dim)",
                      marginBottom: "2px",
                    }}
                  >
                    {countryA.slice(0, 12)}
                  </span>
                  <Sparkline series={indicator.series_a} color={colorA} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "ui-monospace, monospace",
                      color: "var(--qgi-text-dim)",
                      marginBottom: "2px",
                    }}
                  >
                    {countryB.slice(0, 12)}
                  </span>
                  <Sparkline series={indicator.series_b} color={colorB} />
                </div>
              </div>

              <span
                style={{
                  fontSize: "13px",
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 700,
                  color: rColor,
                  textShadow: rGlow || undefined,
                  letterSpacing: "0.3px",
                }}
              >
                correlation = {indicator.pearson_r.toFixed(2)}
              </span>
            </>
          ) : (
            /* Expanded view */
            <>
              {/* Align to window toggle */}
              <div style={{ marginBottom: "14px" }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setAlignToWindow((v) => !v)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "12px",
                    border: `1px solid ${alignToWindow ? stripeColor : "var(--qgi-border)"}`,
                    background: alignToWindow ? `${stripeColor}20` : "transparent",
                    color: alignToWindow ? stripeColor : "var(--qgi-text-muted)",
                    fontSize: "10px",
                    fontFamily: "ui-monospace, monospace",
                    cursor: "pointer",
                    fontWeight: alignToWindow ? 600 : 400,
                  }}
                >
                  Align to window: {alignToWindow ? "ON" : "OFF"}
                </button>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--qgi-text-dim)",
                    fontFamily: "ui-monospace, monospace",
                    marginLeft: "8px",
                  }}
                >
                  {alignToWindow
                    ? "x-axis = Year 1..N (both overlaid)"
                    : "x-axis = calendar years per country"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "20px",
                  marginBottom: "12px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExpandedSparkline
                  series={indicator.series_a}
                  color={colorA}
                  label={countryA}
                  windowStart={startA}
                  useWindowRelative={alignToWindow}
                  length={length}
                  seriesIndex={0}
                />
                <ExpandedSparkline
                  series={indicator.series_b}
                  color={colorB}
                  label={countryB}
                  windowStart={startB}
                  useWindowRelative={alignToWindow}
                  length={length}
                  seriesIndex={1}
                />
              </div>

              <span
                style={{
                  fontSize: "14px",
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 700,
                  color: rColor,
                  textShadow: rGlow || undefined,
                  letterSpacing: "0.3px",
                }}
              >
                correlation = {indicator.pearson_r.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main grouped component ────────────────────────────────────────────────────

interface PatternIndicatorsGroupedProps {
  indicators: PatternIndicator[];
  countryA: string;
  countryB: string;
  startA: number;
  startB: number;
  length: number;
  hiddenSectors: Set<string>;
}

export function PatternIndicatorsGrouped({
  indicators,
  countryA,
  countryB,
  startA,
  startB,
  length,
  hiddenSectors,
}: PatternIndicatorsGroupedProps) {
  // Group by sector, sort each group by correlation desc.
  const groups: { sector: string; items: PatternIndicator[] }[] = [];
  const seen = new Map<string, PatternIndicator[]>();
  for (const ind of indicators) {
    if (!seen.has(ind.sector)) seen.set(ind.sector, []);
    seen.get(ind.sector)!.push(ind);
  }
  // Order sectors by total count desc (same as pie).
  for (const [sector, items] of [...seen.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )) {
    groups.push({
      sector,
      items: [...items].sort((a, b) => b.pearson_r - a.pearson_r),
    });
  }

  const visibleGroups = groups.filter((g) => !hiddenSectors.has(g.sector));

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
        INDICATOR DETAIL
      </div>
      <h2
        style={{
          fontSize: "15px",
          fontWeight: 700,
          margin: "0 0 6px",
          color: "var(--qgi-text)",
        }}
      >
        Each signal, side by side
      </h2>
      <p
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          margin: "0 0 20px",
        }}
      >
        Click any indicator to expand its chart. Use the pie chart above to filter by
        category.
      </p>

      {visibleGroups.length === 0 && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            textAlign: "center",
            padding: "24px 0",
          }}
        >
          All categories are hidden. Click a slice in the pie chart to show them.
        </p>
      )}

      {/* Grouped sections */}
      {visibleGroups.map(({ sector, items }) => {
        const color = sectorColor(sector);
        return (
          <section key={sector} style={{ marginBottom: "24px" }}>
            {/* Section header — mirrors /recipes L1 band */}
            <header
              style={{
                display: "flex",
                gap: "14px",
                alignItems: "stretch",
                marginBottom: "12px",
              }}
            >
              <div style={{ width: "4px", background: color, borderRadius: "2px" }} />
              <div>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    margin: 0,
                    color: "var(--qgi-text)",
                  }}
                >
                  {sector}
                </h3>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--qgi-text-dim)",
                    marginTop: "2px",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {items.length} indicator{items.length !== 1 ? "s" : ""} &middot; sorted
                  by correlation
                </div>
              </div>
            </header>

            {/* Card grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "12px",
              }}
            >
              {items.map((indicator) => (
                <IndicatorCard
                  key={indicator.code}
                  indicator={indicator}
                  countryA={countryA}
                  countryB={countryB}
                  startA={startA}
                  startB={startB}
                  length={length}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
