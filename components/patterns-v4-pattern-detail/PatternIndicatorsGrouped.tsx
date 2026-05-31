"use client";

/**
 * PatternIndicatorsGrouped — §5 Indicator detail, grouped by sector.
 *
 * - Category filter chips live at the TOP of this panel (collocated with
 *   the SCDIs they affect). No need to scroll to the pie chart above.
 * - Expanded SCDI card: both countries overlaid on ONE plot, not two separate.
 * - "Align" toggle: ON = Year 1..N shared axis; OFF = calendar years.
 *   Tooltip explains the behaviour; label itself is just "Align".
 * - "correlation =" not "r =".
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

// ── Overlaid expanded chart — both countries on one plot ──────────────────────

function OverlaidExpandedChart({
  seriesA,
  seriesB,
  colorA,
  colorB,
  labelA,
  labelB,
  windowStartA,
  windowStartB,
  useWindowRelative,
  length,
}: {
  seriesA: number[];
  seriesB: number[];
  colorA: string;
  colorB: string;
  labelA: string;
  labelB: string;
  windowStartA: number;
  windowStartB: number;
  useWindowRelative: boolean;
  length: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const w = 460;
  const h = 90;
  const padLeft = 32;
  const padRight = 8;
  const padTop = 8;
  const padBot = 24;
  const innerW = w - padLeft - padRight;
  const innerH = h - padTop - padBot;

  // Two render modes:
  //   ALIGN ON  (useWindowRelative=true): both traces stretch across the full
  //     width on a shared Year 1..N axis — overlaid so the rhyme is visible.
  //   ALIGN OFF (calendar mode): each trace sits at its REAL calendar position.
  //     For an offset pattern (e.g. Serbia 2000, Myanmar 2007) the two segments
  //     are visibly displaced by the offset across a shared union calendar axis.
  const nA = seriesA.length;
  const nB = seriesB.length;
  const n = Math.max(nA, nB);

  // Calendar spans of each country's window and their union.
  const endA = windowStartA + length - 1;
  const endB = windowStartB + length - 1;
  const unionStart = Math.min(windowStartA, windowStartB);
  const unionEnd = Math.max(endA, endB);
  const unionSpan = unionEnd - unionStart || 1;

  // Shared y scale across both series.
  const allVals = [...seriesA, ...seriesB];
  const minY = Math.min(...allVals);
  const maxY = Math.max(...allVals);
  const rangeY = maxY - minY || 1;

  // Per-series x mapping. Aligned → index fraction; calendar → year fraction
  // within the union range (so an offset start shifts the whole trace right).
  const xFrac = (i: number, count: number, start: number) => {
    if (useWindowRelative) return count > 1 ? i / (count - 1) : 0.5;
    const year = start + (count > 1 ? (i / (count - 1)) * (length - 1) : 0);
    return (year - unionStart) / unionSpan;
  };
  const toXA = (i: number) => padLeft + xFrac(i, nA, windowStartA) * innerW;
  const toXB = (i: number) => padLeft + xFrac(i, nB, windowStartB) * innerW;
  const toY = (v: number) => padTop + (1 - (v - minY) / rangeY) * innerH;

  const buildPath = (series: number[], toXfn: (i: number) => number) =>
    series
      .map((v, i) => `${i === 0 ? "M" : "L"} ${toXfn(i).toFixed(1)} ${toY(v).toFixed(1)}`)
      .join(" ");

  const pathA = buildPath(seriesA, toXA);
  const pathB = buildPath(seriesB, toXB);

  const yTicks = [minY, (minY + maxY) / 2, maxY];

  // X-axis ticks: Year 1..N when aligned, union calendar years when not.
  const xAxisTicks: { frac: number; label: string }[] = useWindowRelative
    ? [
        { frac: 0, label: "Y1" },
        { frac: 0.5, label: `Y${Math.round(n / 2)}` },
        { frac: 1, label: `Y${n}` },
      ]
    : [
        { frac: 0, label: String(unionStart) },
        { frac: 0.5, label: String(Math.round((unionStart + unionEnd) / 2)) },
        { frac: 1, label: String(unionEnd) },
      ];

  // Hover tooltip label for an index into series A.
  const labelForX = (i: number) =>
    useWindowRelative
      ? `Y${i + 1}`
      : String(windowStartA + Math.round((i / Math.max(1, nA - 1)) * (length - 1)));

  return (
    <div>
      {/* Legend row */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "6px",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: labelA, color: colorA, dashed: false },
          { label: labelB, color: colorB, dashed: true },
        ].map(({ label, color, dashed }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <svg width={22} height={8} aria-hidden style={{ flexShrink: 0 }}>
              <line
                x1={0}
                y1={4}
                x2={22}
                y2={4}
                stroke={color}
                strokeWidth={1.8}
                strokeDasharray={dashed ? "4 2" : undefined}
                strokeOpacity={dashed ? 0.7 : 1}
              />
            </svg>
            <FlagImg
              emoji={pairDetailFlagFor(label)}
              name={label}
              width={13}
              radius={1}
            />
            <span
              style={{
                fontSize: "10px",
                fontFamily: "ui-monospace, monospace",
                color: "var(--qgi-text-dim)",
              }}
            >
              {label.slice(0, 14)}
              {!useWindowRelative && (
                <span style={{ color: "var(--qgi-text-dim)", marginLeft: "4px" }}>
                  ({label === labelA ? windowStartA : windowStartB})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: "block", overflow: "visible", maxWidth: "100%" }}
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

        {/* Zero guide */}
        {minY < 0 && maxY > 0 && (
          <line
            x1={padLeft}
            y1={toY(0)}
            x2={w - padRight}
            y2={toY(0)}
            stroke="var(--qgi-border)"
            strokeWidth={0.7}
            strokeDasharray="2 2"
          />
        )}

        {/* Series B (dashed, drawn first so A is on top) */}
        <path
          d={pathB}
          fill="none"
          stroke={colorB}
          strokeWidth={1.8}
          strokeOpacity={0.7}
          strokeDasharray="5 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Series A */}
        <path
          d={pathA}
          fill="none"
          stroke={colorA}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hover dots for A */}
        {seriesA.map((v, i) => (
          <circle
            key={i}
            cx={toXA(i)}
            cy={toY(v)}
            r={hovered === i ? 3.5 : 0}
            fill={colorA}
            style={{ transition: "r 0.1s" }}
          />
        ))}

        {/* Invisible hover targets (indexed on series A) */}
        {seriesA.map((_, i) => (
          <rect
            key={i}
            x={toXA(i) - innerW / nA / 2}
            y={padTop}
            width={innerW / nA}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}

        {/* Hover tooltip */}
        {hovered !== null && hovered < seriesA.length && (
          <g>
            <line
              x1={toXA(hovered)}
              y1={padTop}
              x2={toXA(hovered)}
              y2={padTop + innerH}
              stroke="var(--qgi-text-dim)"
              strokeWidth={0.7}
              strokeOpacity={0.5}
            />
            <rect
              x={toXA(hovered) - 28}
              y={padTop - 14}
              width={56}
              height={13}
              rx={3}
              fill="var(--qgi-surface)"
              stroke="var(--qgi-border)"
              strokeWidth={0.7}
            />
            <text
              x={toXA(hovered)}
              y={padTop - 4}
              fill="var(--qgi-text)"
              fontSize={7}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {labelForX(hovered)}: A {seriesA[hovered]?.toFixed(1)} / B{" "}
              {seriesB[hovered]?.toFixed(1)}
            </text>
          </g>
        )}

        {/* X axis ticks. textAnchor clamps at the edges so the first/last
            labels never clip outside the SVG box. */}
        {xAxisTicks.map((tick, ti) => {
          const x = padLeft + tick.frac * innerW;
          const anchor =
            ti === 0 ? "start" : ti === xAxisTicks.length - 1 ? "end" : "middle";
          return (
            <g key={ti}>
              <line
                x1={x}
                y1={padTop + innerH}
                x2={x}
                y2={padTop + innerH + 3}
                stroke="var(--qgi-text-dim)"
                strokeWidth={0.7}
              />
              <text
                x={x}
                y={h - 4}
                fill="var(--qgi-text-dim)"
                fontSize={6}
                textAnchor={anchor}
                fontFamily="ui-monospace, monospace"
              >
                {tick.label}
              </text>
            </g>
          );
        })}
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
  isOffset,
}: {
  indicator: PatternIndicator;
  countryA: string;
  countryB: string;
  startA: number;
  startB: number;
  length: number;
  /** When false (same start year for both countries), no align toggle is shown
   *  and the chart always renders the overlaid Year 1..N view. */
  isOffset: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // Align toggle state: only meaningful when isOffset=true. For non-offset
  // patterns the chart always renders window-relative (useWindowRelative=true).
  const [align, setAlign] = useState(false);

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
            /* Compact view — two tiny sparklines side by side */
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
            /* Expanded view — single overlaid chart */
            <>
              {/* Align toggle — only shown for offset patterns (different start years).
                  Non-offset patterns always render the overlaid Year 1..N view. */}
              {isOffset && (
                <div
                  style={{ marginBottom: "14px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setAlign((v) => !v)}
                    title={
                      align
                        ? "Both series on shared Year 1..N axis. Click to switch to calendar years."
                        : "Each country on its own calendar-year axis. Click to align both to Year 1..N."
                    }
                    style={{
                      padding: "3px 12px",
                      borderRadius: "12px",
                      border: `1px solid ${align ? stripeColor : "var(--qgi-border)"}`,
                      background: align ? `${stripeColor}20` : "transparent",
                      color: align ? stripeColor : "var(--qgi-text-muted)",
                      fontSize: "10px",
                      fontFamily: "ui-monospace, monospace",
                      cursor: "pointer",
                      fontWeight: align ? 600 : 400,
                    }}
                  >
                    Align
                  </button>
                </div>
              )}

              <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: "12px" }}>
                <OverlaidExpandedChart
                  seriesA={indicator.series_a}
                  seriesB={indicator.series_b}
                  colorA={colorA}
                  colorB={colorB}
                  labelA={countryA}
                  labelB={countryB}
                  windowStartA={startA}
                  windowStartB={startB}
                  useWindowRelative={isOffset ? align : true}
                  length={length}
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

interface SectorMeta {
  sector: string;
  count: number;
  color: string;
}

interface PatternIndicatorsGroupedProps {
  indicators: PatternIndicator[];
  countryA: string;
  countryB: string;
  startA: number;
  startB: number;
  length: number;
  hiddenSectors: Set<string>;
  onToggle: (sector: string) => void;
  sectors: SectorMeta[];
  /** True when the two countries have different start years (offset pattern).
   *  When false, each SCDI card shows no align toggle and always uses the
   *  overlaid Year 1..N view. */
  isOffset: boolean;
}

export function PatternIndicatorsGrouped({
  indicators,
  countryA,
  countryB,
  startA,
  startB,
  length,
  hiddenSectors,
  onToggle,
  sectors,
  isOffset,
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
          margin: "0 0 10px",
          color: "var(--qgi-text)",
        }}
      >
        Each signal, side by side
      </h2>

      {/* ── Inline category filter chips ──────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginBottom: "20px",
        }}
      >
        {sectors.map(({ sector, count, color }) => {
          const hidden = hiddenSectors.has(sector);
          return (
            <button
              key={sector}
              onClick={() => onToggle(sector)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 9px",
                borderRadius: "12px",
                border: `1px solid ${hidden ? "var(--qgi-border)" : color + "60"}`,
                background: hidden ? "transparent" : `${color}18`,
                color: hidden ? "var(--qgi-text-dim)" : color,
                fontSize: "10px",
                fontFamily: "ui-monospace, monospace",
                fontWeight: hidden ? 400 : 600,
                cursor: "pointer",
                opacity: hidden ? 0.55 : 1,
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: hidden ? "var(--qgi-border)" : color,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {sector}
              <span style={{ fontSize: "9px", opacity: 0.75 }}>{count}</span>
            </button>
          );
        })}
      </div>

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
          All categories hidden. Click a chip above to show them.
        </p>
      )}

      {/* Grouped sections */}
      {visibleGroups.map(({ sector, items }) => {
        const color = sectorColor(sector);
        return (
          <section key={sector} style={{ marginBottom: "24px" }}>
            {/* Section header */}
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
                  isOffset={isOffset}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
