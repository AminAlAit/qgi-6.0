"use client";

/**
 * DualTimeline — the "highest credibility per hour" visualization from the
 * #122 spec. A single horizontal timeline with both countries' pattern
 * windows overlaid, the predictor's historical event marked, the "you are
 * here" tick at the current year, and the implied prediction window for
 * the following country clearly annotated.
 *
 * Reference:
 *
 *   Predictor (Japan):   [========PATTERN========] [EVENT ✦]
 *   Following (Turkey):         [========PATTERN========]
 *                                                 ^ NOW
 *                                                 Implied: ✦ 2026-2029
 *
 * Pure SVG — no chart library. Responsive to container width via viewBox.
 * All colors consumed from lib/design.ts tokens (#126).
 */

import type { SignalRow } from "@/lib/types";

interface Props {
  signal: SignalRow;
}

export function DualTimeline({ signal }: Props) {
  const currentYear = new Date().getFullYear();

  // Axis range: pad 2 years on either side of the extreme observed years
  const allYears = [
    signal.start_year_a,
    signal.end_year_a,
    signal.event_year_a,
    signal.start_year_b,
    signal.end_year_b,
    signal.event_year_b,
    currentYear,
  ];
  const minYear = Math.min(...allYears) - 2;
  const maxYear = Math.max(...allYears, currentYear + 5) + 1;

  // Implied prediction window in country A, based on the predictor's lead time
  // from the pattern's end to the historical event. Falls back to
  // median_lead_time_b when the signal carries it (post-#134).
  const leadYears =
    (signal.median_lead_time ?? null) !== null
      ? signal.median_lead_time!
      : signal.event_year_b - signal.end_year_b;
  const impliedEventYearA = signal.end_year_a + leadYears;

  // Geometry
  const width = 920;
  const height = 220;
  const marginLeft = 140; // room for labels
  const marginRight = 32;
  const innerWidth = width - marginLeft - marginRight;
  const rowHeightA = 40;
  const rowHeightB = 90;
  const barHeight = 14;

  const xOf = (year: number) =>
    marginLeft + ((year - minYear) / (maxYear - minYear)) * innerWidth;

  // Year ticks every 5 years, rounded
  const firstTick = Math.ceil(minYear / 5) * 5;
  const ticks: number[] = [];
  for (let y = firstTick; y <= maxYear; y += 5) ticks.push(y);

  // Tokens (mirrors lib/design.ts — inlined because SVG `style` doesn't
  // reference CSS vars consistently across browsers in all contexts)
  const COLOR_PREDICTOR = "#fb923c"; // country B / precedent (orange)
  const COLOR_FOLLOWING = "#38bdf8"; // country A / active (cyan)
  const COLOR_EVENT = "#f87171";     // event marker (red)
  const COLOR_NOW = "#34d399";       // "you are here" (emerald)
  const COLOR_IMPLIED = "#fbbf24";   // implied prediction (amber)
  const COLOR_GRID = "#243347";
  const COLOR_AXIS = "#4a6280";
  const COLOR_LABEL = "#7a90a8";

  return (
    <div
      className="rounded border p-4"
      style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
    >
      <div className="text-[9px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--qgi-text-dim)" }}>
        Pattern Analogy Timeline
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ maxHeight: 240 }}
      >
        {/* Year grid lines */}
        {ticks.map((y) => (
          <line
            key={`grid-${y}`}
            x1={xOf(y)}
            x2={xOf(y)}
            y1={28}
            y2={height - 32}
            stroke={COLOR_GRID}
            strokeDasharray="2 4"
          />
        ))}

        {/* ────── Predictor row (country B / precedent) ────── */}
        <text
          x={marginLeft - 12}
          y={rowHeightA + barHeight / 2 + 4}
          fontSize="11"
          fontFamily="monospace"
          textAnchor="end"
          fill={COLOR_PREDICTOR}
        >
          {signal.country_b_name}
        </text>

        {/* Pattern window bar */}
        <rect
          x={xOf(signal.start_year_b)}
          y={rowHeightA}
          width={xOf(signal.end_year_b) - xOf(signal.start_year_b)}
          height={barHeight}
          fill={COLOR_PREDICTOR}
          fillOpacity={0.3}
          stroke={COLOR_PREDICTOR}
          strokeWidth={1}
          rx={2}
        />
        <text
          x={(xOf(signal.start_year_b) + xOf(signal.end_year_b)) / 2}
          y={rowHeightA - 4}
          fontSize="9"
          fontFamily="monospace"
          textAnchor="middle"
          fill={COLOR_PREDICTOR}
        >
          {signal.start_year_b}–{signal.end_year_b}
        </text>

        {/* Event marker in B */}
        <g transform={`translate(${xOf(signal.event_year_b)}, ${rowHeightA + barHeight / 2})`}>
          <circle r={7} fill={COLOR_EVENT} />
          <text
            x={0}
            y={-12}
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
            fill={COLOR_EVENT}
          >
            ✦ {signal.event_year_b}
          </text>
        </g>

        {/* ────── Following row (country A / active) ────── */}
        <text
          x={marginLeft - 12}
          y={rowHeightB + barHeight / 2 + 4}
          fontSize="11"
          fontFamily="monospace"
          textAnchor="end"
          fill={COLOR_FOLLOWING}
        >
          {signal.country_a_name}
        </text>

        {/* Pattern window bar */}
        <rect
          x={xOf(signal.start_year_a)}
          y={rowHeightB}
          width={xOf(signal.end_year_a) - xOf(signal.start_year_a)}
          height={barHeight}
          fill={COLOR_FOLLOWING}
          fillOpacity={0.3}
          stroke={COLOR_FOLLOWING}
          strokeWidth={1}
          rx={2}
        />
        <text
          x={(xOf(signal.start_year_a) + xOf(signal.end_year_a)) / 2}
          y={rowHeightB - 4}
          fontSize="9"
          fontFamily="monospace"
          textAnchor="middle"
          fill={COLOR_FOLLOWING}
        >
          {signal.start_year_a}–{signal.end_year_a}
        </text>

        {/* Implied prediction window — amber band from end_year_a to implied event */}
        {impliedEventYearA > signal.end_year_a && (
          <>
            <rect
              x={xOf(signal.end_year_a)}
              y={rowHeightB}
              width={xOf(impliedEventYearA) - xOf(signal.end_year_a)}
              height={barHeight}
              fill={COLOR_IMPLIED}
              fillOpacity={0.15}
              stroke={COLOR_IMPLIED}
              strokeWidth={1}
              strokeDasharray="3 3"
              rx={2}
            />
            <g
              transform={`translate(${xOf(impliedEventYearA)}, ${rowHeightB + barHeight / 2})`}
            >
              <circle r={6} fill={COLOR_IMPLIED} fillOpacity={0.4} stroke={COLOR_IMPLIED} />
              <text
                x={8}
                y={4}
                fontSize="9"
                fontFamily="monospace"
                textAnchor="start"
                fill={COLOR_IMPLIED}
              >
                IMPLIED ✦ ~{impliedEventYearA}
              </text>
            </g>
          </>
        )}

        {/* "You are here" marker at current year */}
        <line
          x1={xOf(currentYear)}
          x2={xOf(currentYear)}
          y1={24}
          y2={height - 28}
          stroke={COLOR_NOW}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
        <g transform={`translate(${xOf(currentYear)}, ${height - 26})`}>
          <polygon points="0,-6 -5,-14 5,-14" fill={COLOR_NOW} />
          <text
            x={0}
            y={10}
            fontSize="9"
            fontFamily="monospace"
            textAnchor="middle"
            fill={COLOR_NOW}
          >
            NOW ({currentYear})
          </text>
        </g>

        {/* X-axis */}
        <line
          x1={marginLeft}
          x2={width - marginRight}
          y1={height - 42}
          y2={height - 42}
          stroke={COLOR_AXIS}
          strokeWidth={1}
        />
        {ticks.map((y) => (
          <g key={`tick-${y}`} transform={`translate(${xOf(y)}, ${height - 42})`}>
            <line x1={0} x2={0} y1={0} y2={4} stroke={COLOR_AXIS} />
            <text x={0} y={16} fontSize="9" fontFamily="monospace" textAnchor="middle" fill={COLOR_LABEL}>
              {y}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 items-center mt-3 flex-wrap text-[9px] font-data tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
        <LegendDot color={COLOR_PREDICTOR} label="PRECEDENT PATTERN" />
        <LegendDot color={COLOR_EVENT} label="HISTORICAL EVENT" />
        <LegendDot color={COLOR_FOLLOWING} label="ACTIVE PATTERN" />
        <LegendDot color={COLOR_IMPLIED} label="IMPLIED FORECAST" dashed />
        <LegendDot color={COLOR_NOW} label="CURRENT YEAR" dashed />
      </div>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{
          width: 14,
          height: 3,
          backgroundColor: dashed ? "transparent" : color,
          borderTop: dashed ? `1.5px dashed ${color}` : "none",
        }}
      />
      {label}
    </span>
  );
}
