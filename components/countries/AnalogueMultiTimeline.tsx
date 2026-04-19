"use client";

/**
 * AnalogueMultiTimeline — multi-row shared-axis timeline showing the subject
 * country's pattern extending to the present + each of its top-5 analogues'
 * patterns ending at their historical event of the same category.
 *
 * Analytical point: "These N analogues all experienced this event. The subject
 * country's trajectory resembles theirs — and its pattern is still unfolding."
 *
 * Reference spec — ticket #293 (refined 2026-04-18):
 *
 *   Syria (121)      ├──── SUBJECT PATTERN ────────────────────┤ NOW 2026
 *   Rwanda           ├─── ANALOGUE PATTERN ───┤ ★ 1994
 *   Syria            ├─── ANALOGUE PATTERN ───┤ ★ 2007
 *   ...
 *
 * Data source: `data/analogues-enriched.json` — produced by `.tmp/decisions-form/_enrich_analogues.py`
 * which reads `qgi-data/events/curated/*.json` directly and picks the median-year
 * event of the matching category as each analogue's "signature event".
 *
 * Pattern windows are now REAL (from `qgi_data.patterns` via #352 Athena
 * regeneration, 2026-04-19). Each analogue entry has `best_pattern_start_b` +
 * `best_pattern_length` — the actual best-PPS pattern window for that pair.
 * Event marker years are also REAL (from qgi-data curated events).
 *
 * If an analogue lacks `best_pattern_*` fields (legacy data snapshot or a
 * country missing from the pair-windows regen), the component falls back to
 * a 15-year lookback approximation for that single row.
 */

import type { AnalogueEnrichedEntry, AnalogueEnrichedSubject } from "@/lib/types";

interface Props {
  subject: AnalogueEnrichedSubject;
  analogues: AnalogueEnrichedEntry[];
  /** Category slug — used in the legend text. */
  category: string;
  /** Label form of the category for display (e.g., "Civil War & Insurgency"). */
  categoryLabel: string;
  /** Approximated lookback window in years (default 15). */
  patternWindowYears?: number;
}

const DEFAULT_PATTERN_WINDOW = 15;
const CURRENT_YEAR = new Date().getFullYear();

// Colors — match lib/design.ts tokens
const COLOR_SUBJECT = "#38bdf8"; // cyan — the active/subject country
const COLOR_ANALOGUE = "#fb923c"; // orange — historical analogues
const COLOR_EVENT = "#f87171"; // red — the event marker
const COLOR_NOW = "#34d399"; // emerald — "you are here"
const COLOR_GRID = "#243347";
const COLOR_AXIS = "#4a6280";
const COLOR_LABEL = "#7a90a8";

export function AnalogueMultiTimeline({
  subject,
  analogues,
  // category prop reserved for future per-category filtering — suppress lint.
  category: _category,
  categoryLabel,
  patternWindowYears = DEFAULT_PATTERN_WINDOW,
}: Props) {
  // Filter to analogues that have an event year (from qgi-data enrichment)
  const withEvents = analogues.filter(
    (a) => a.event_year_b !== null && a.event_year_b !== undefined
  );
  const withoutEvents = analogues.filter(
    (a) => a.event_year_b === null || a.event_year_b === undefined
  );

  // Helper — resolve each analogue's pattern [start, end] (real if #352 fields
  // present, else 15-yr approximation ending at the event year).
  const resolveAnaloguePattern = (a: (typeof analogues)[number]) => {
    if (a.best_pattern_start_b !== undefined && a.best_pattern_length !== undefined) {
      return {
        start: a.best_pattern_start_b,
        end: a.best_pattern_start_b + a.best_pattern_length,
        isReal: true,
      };
    }
    const ey = a.event_year_b ?? CURRENT_YEAR;
    return { start: ey - patternWindowYears, end: ey, isReal: false };
  };

  // Whether every analogue has real pattern data (controls the "approx" disclaimer)
  const allReal = withEvents.every(
    (a) => a.best_pattern_start_b !== undefined && a.best_pattern_length !== undefined
  );

  // Compute axis range — include event markers + every pattern window + padding
  const allYears: number[] = [CURRENT_YEAR];
  allYears.push(CURRENT_YEAR - patternWindowYears); // subject pattern start approx
  if (
    subject.subject_event_year_a !== null &&
    subject.subject_event_year_a !== undefined
  ) {
    allYears.push(subject.subject_event_year_a);
  }
  withEvents.forEach((a) => {
    const pw = resolveAnaloguePattern(a);
    allYears.push(pw.start, pw.end);
    if (a.event_year_b !== null && a.event_year_b !== undefined) {
      allYears.push(a.event_year_b);
    }
  });

  const minYear = Math.min(...allYears) - 3;
  const maxYear = Math.max(...allYears) + 3;

  // Geometry
  const width = 960;
  const marginLeft = 160;
  const marginRight = 40;
  const marginTop = 44;
  const rowHeight = 44;
  const barHeight = 14;
  const innerWidth = width - marginLeft - marginRight;
  const rowCount = 1 + withEvents.length + (withoutEvents.length > 0 ? 1 : 0); // subject + analogues + optional "pending" row
  const height = marginTop + rowCount * rowHeight + 84; // + legend + x-axis area

  const xOf = (year: number) =>
    marginLeft + ((year - minYear) / (maxYear - minYear)) * innerWidth;
  const yOf = (rowIdx: number) => marginTop + rowIdx * rowHeight;

  // Year ticks every 10 years
  const firstTick = Math.ceil(minYear / 10) * 10;
  const ticks: number[] = [];
  for (let y = firstTick; y <= maxYear; y += 10) ticks.push(y);

  const subjectStart = CURRENT_YEAR - patternWindowYears;

  return (
    <div
      className="rounded border p-4"
      style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div
          className="text-[10px] tracking-[0.15em] uppercase font-mono"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Analogue Timeline — {categoryLabel}
        </div>
        <div
          className="text-[9px] tracking-[0.1em] uppercase font-mono"
          style={{ color: "var(--qgi-text-muted)" }}
          title="Analogue pattern windows from qgi_data.patterns (best-PPS per pair). Event markers from qgi-data/events/curated/. Subject window is a 15-year recent-trajectory approximation."
        >
          {allReal
            ? "Patterns real (qgi_data.patterns) · Events real (qgi-data)"
            : "Windows ≈ 15yr fallback · Events real (qgi-data)"}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ maxHeight: Math.max(320, height) }}
        role="img"
        aria-label={`Timeline comparing ${subject.country_name}'s pattern to ${withEvents.length} historical analogues that experienced ${categoryLabel}. Subject pattern extends to ${CURRENT_YEAR}; analogue patterns end at their historical event.`}
      >
        {/* Year grid lines */}
        {ticks.map((y) => (
          <line
            key={`grid-${y}`}
            x1={xOf(y)}
            x2={xOf(y)}
            y1={marginTop - 10}
            y2={height - 60}
            stroke={COLOR_GRID}
            strokeDasharray="2 4"
          />
        ))}

        {/* ────── Subject row ────── */}
        <g transform={`translate(0, ${yOf(0)})`}>
          <text
            x={marginLeft - 12}
            y={barHeight / 2 + 5}
            fontSize="12"
            fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
            fontWeight={700}
            textAnchor="end"
            fill={COLOR_SUBJECT}
          >
            {subject.country_name?.toUpperCase()}
          </text>
          <text
            x={marginLeft - 12}
            y={barHeight / 2 + 20}
            fontSize="9"
            fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
            textAnchor="end"
            fill={COLOR_LABEL}
            letterSpacing="0.1em"
          >
            SUBJECT
          </text>

          {/* Subject pattern bar — extends to NOW, no event marker */}
          <rect
            x={xOf(subjectStart)}
            y={0}
            width={xOf(CURRENT_YEAR) - xOf(subjectStart)}
            height={barHeight}
            fill={COLOR_SUBJECT}
            fillOpacity={0.18}
            stroke={COLOR_SUBJECT}
            strokeWidth={1.5}
            rx={3}
          />
          <text
            x={(xOf(subjectStart) + xOf(CURRENT_YEAR)) / 2}
            y={-4}
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            textAnchor="middle"
            fill={COLOR_SUBJECT}
          >
            ~{subjectStart}–{CURRENT_YEAR}
          </text>

          {/* NOW marker at the right end of the subject bar */}
          <g transform={`translate(${xOf(CURRENT_YEAR)}, ${barHeight / 2})`}>
            <circle
              r={5}
              fill={COLOR_NOW}
              fillOpacity={0.2}
              stroke={COLOR_NOW}
              strokeWidth={1.5}
            />
            <text
              x={8}
              y={4}
              fontSize="9.5"
              fontFamily="ui-monospace, monospace"
              fill={COLOR_NOW}
              fontWeight={600}
            >
              NOW ({CURRENT_YEAR})
            </text>
          </g>
        </g>

        {/* ────── Analogue rows ────── */}
        {withEvents.map((a, i) => {
          const rowIdx = i + 1;
          const eventYear = a.event_year_b as number;
          const pw = resolveAnaloguePattern(a);
          const patternStart = pw.start;
          const patternEnd = pw.end;
          return (
            <g
              key={`analogue-${a.country_b_id}`}
              transform={`translate(0, ${yOf(rowIdx)})`}
            >
              <text
                x={marginLeft - 12}
                y={barHeight / 2 + 5}
                fontSize="11"
                fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
                textAnchor="end"
                fill={COLOR_ANALOGUE}
              >
                {a.country_b_name}
              </text>
              <text
                x={marginLeft - 12}
                y={barHeight / 2 + 18}
                fontSize="8.5"
                fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
                textAnchor="end"
                fill={COLOR_LABEL}
                letterSpacing="0.08em"
              >
                corr {(a.mean_corr * 100).toFixed(0)}% · pps {a.best_pps.toFixed(0)}
              </text>

              {/* Analogue pattern bar — real window from qgi_data.patterns (#352) */}
              <rect
                x={xOf(patternStart)}
                y={0}
                width={xOf(patternEnd) - xOf(patternStart)}
                height={barHeight}
                fill={COLOR_ANALOGUE}
                fillOpacity={0.22}
                stroke={COLOR_ANALOGUE}
                strokeWidth={1}
                rx={2}
              />
              <text
                x={(xOf(patternStart) + xOf(patternEnd)) / 2}
                y={-4}
                fontSize="8.5"
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
                fill={COLOR_ANALOGUE}
                fillOpacity={0.85}
              >
                {pw.isReal ? "" : "~"}
                {patternStart}–{patternEnd}
              </text>

              {/* Event marker (★) at event_year_b — real historical event */}
              <g transform={`translate(${xOf(eventYear)}, ${barHeight / 2})`}>
                <polygon
                  points={starPoints(0, 0, 8, 4, 5)}
                  fill={COLOR_EVENT}
                  stroke={COLOR_EVENT}
                  strokeWidth={1.5}
                />
              </g>
              <text
                x={xOf(eventYear) + 12}
                y={barHeight / 2 + 4}
                fontSize="9.5"
                fontFamily="ui-monospace, monospace"
                fill={COLOR_EVENT}
                fontWeight={600}
              >
                ★ {eventYear}
              </text>
            </g>
          );
        })}

        {/* Pending-data row for analogues without event info (rare; <3%) */}
        {withoutEvents.length > 0 &&
          (() => {
            const rowIdx = 1 + withEvents.length;
            return (
              <g transform={`translate(0, ${yOf(rowIdx)})`}>
                <text
                  x={marginLeft - 12}
                  y={barHeight / 2 + 5}
                  fontSize="11"
                  fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
                  textAnchor="end"
                  fill={COLOR_LABEL}
                >
                  {withoutEvents.length} analogue{withoutEvents.length > 1 ? "s" : ""}
                </text>
                <text
                  x={marginLeft - 12}
                  y={barHeight / 2 + 18}
                  fontSize="8.5"
                  fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
                  textAnchor="end"
                  fill={COLOR_LABEL}
                  letterSpacing="0.08em"
                >
                  event data pending
                </text>
                <rect
                  x={marginLeft}
                  y={4}
                  width={innerWidth}
                  height={barHeight - 8}
                  fill="transparent"
                  stroke={COLOR_LABEL}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  rx={2}
                />
              </g>
            );
          })()}

        {/* X-axis */}
        <g transform={`translate(0, ${height - 70})`}>
          <line
            x1={marginLeft}
            x2={width - marginRight}
            y1={0}
            y2={0}
            stroke={COLOR_AXIS}
            strokeWidth={1}
          />
          {ticks.map((y) => (
            <g key={`tick-${y}`} transform={`translate(${xOf(y)}, 0)`}>
              <line x1={0} x2={0} y1={0} y2={5} stroke={COLOR_AXIS} />
              <text
                x={0}
                y={18}
                fontSize="10"
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
                fill={COLOR_LABEL}
              >
                {y}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Legend */}
      <div
        className="flex gap-4 items-center mt-3 flex-wrap text-[10px] font-mono tracking-wider"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <LegendEntry
          color={COLOR_SUBJECT}
          label={`${subject.country_name?.toUpperCase() ?? "SUBJECT"} — PATTERN STILL UNFOLDING`}
        />
        <LegendEntry color={COLOR_ANALOGUE} label="ANALOGUE — PATTERN ENDED AT EVENT" />
        <LegendEntry
          color={COLOR_EVENT}
          label={`★ ${categoryLabel.toUpperCase()} (REAL EVENT YEAR)`}
          isStar
        />
        <LegendEntry color={COLOR_NOW} label={`NOW · ${CURRENT_YEAR}`} isDashed />
      </div>
    </div>
  );
}

function starPoints(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  points: number
): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    pts.push(
      `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`
    );
  }
  return pts.join(" ");
}

function LegendEntry({
  color,
  label,
  isStar,
  isDashed,
}: {
  color: string;
  label: string;
  isStar?: boolean;
  isDashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {isStar ? (
        <svg width={14} height={14} viewBox="-7 -7 14 14" aria-hidden="true">
          <polygon points={starPoints(0, 0, 6, 3, 5)} fill={color} />
        </svg>
      ) : (
        <span
          className="inline-block"
          style={{
            width: 14,
            height: 3,
            backgroundColor: isDashed ? "transparent" : color,
            borderTop: isDashed ? `1.5px dashed ${color}` : "none",
          }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
