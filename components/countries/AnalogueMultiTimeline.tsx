"use client";

import { useState } from "react";

/**
 * AnalogueMultiTimeline — multi-row shared-axis timeline showing the subject
 * country's pattern extending to the present + each of its top-5 analogues'
 * patterns ending at their historical event of the same category.
 *
 * Analytical point: "These N analogues all experienced this event. The subject
 * country's trajectory resembles theirs — and its pattern is still unfolding."
 *
 * Reference spec — ticket #293 (refined 2026-04-19 per #354v2):
 *
 *   Syria (121)      ├──── SUBJECT PATTERN ────────────────────┤ NOW 2026
 *   Rwanda           ├─── ANALOGUE PATTERN ───◆ 1994
 *   Syria            ├─── ANALOGUE PATTERN ───◆ 2007
 *   ...
 *
 * Diamond (◆) marks the event year and sits at the analogue pattern's
 * RIGHT edge by construction — the enrichment forces `pair_start_b +
 * pair_length ≈ event_year_b` so the pattern-precedes-event visual
 * narrative holds without drift.
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
  /**
   * #354: canonical pattern length L for this (subject, category).
   * All analogue rows should use `pair_length ≈ L ± 2`. When not provided
   * (legacy data or a row missing from the enrichment), falls back to the
   * patternWindowYears approximation.
   */
  canonicalLength?: number;
  /** Pre-#354 legacy fallback window (default 15 years). */
  patternWindowYears?: number;
  /**
   * #354: count of analogues that were dropped because no length-L
   * pattern existed for them. Surfaced in a footnote when > 0 so users
   * know the panel isn't cherry-picked.
   */
  droppedCount?: number;
  /** #354: total analogues originally available (before length-L filter). */
  originalCount?: number;
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
  canonicalLength,
  patternWindowYears = DEFAULT_PATTERN_WINDOW,
  droppedCount = 0,
  originalCount,
}: Props) {
  // #465 Q2 (progressive disclosure): which analogue's row is currently
  // expanded to show its non-canonical Pattern instances. null = none.
  // Expansion renders additional thin stripes WITHIN the row's existing
  // vertical space (below the canonical bar, above the next row's labels)
  // so layout doesn't shift — visible at a glance which row is open. Cap
  // at MAX_SUB_INSTANCES sub-bars to fit the available pixels; remaining
  // instances accessible via the API or future redesign.
  const [expandedAnalogueId, setExpandedAnalogueId] = useState<number | null>(null);
  const MAX_SUB_INSTANCES = 4;
  // Filter to analogues that have an event year (from qgi-data enrichment)
  const withEvents = analogues.filter(
    (a) => a.event_year_b !== null && a.event_year_b !== undefined
  );
  const withoutEvents = analogues.filter(
    (a) => a.event_year_b === null || a.event_year_b === undefined
  );

  /**
   * #354v2 Position C + end-alignment: resolve each analogue's pattern
   * [start, end]. Invariant: the resolved pattern MUST end at (or within
   * ±2 years of) `event_year_b`, so the diamond marker visually sits at
   * the right edge of the bar.
   *
   * Priority:
   *   1. `pair_start_b` + `pair_length` — the length-L, event-end-aligned
   *      window from `enrich_analogues_common_length.py` v2 (2026-04-19).
   *      Guaranteed aligned by construction.
   *   2. `best_pattern_*` — legacy per-pair best-PPS window, USED ONLY
   *      WHEN IT ALSO ENDS NEAR THE EVENT. The pre-v2 enrichment wrote
   *      these without alignment checks, so they can drift; we verify
   *      on-the-fly here and reject if not aligned.
   *   3. Event-year-anchored fallback: `[event_year - patternWindowYears,
   *      event_year]`. Guaranteed aligned because defined that way.
   */
  const END_ALIGNMENT_TOLERANCE = 2;

  const resolveAnaloguePattern = (a: (typeof analogues)[number]) => {
    const eventYear = a.event_year_b;

    // Priority 1: v2 length-L aligned window.
    if (a.pair_start_b !== undefined && a.pair_length !== undefined) {
      const patternEnd = a.pair_start_b + a.pair_length;
      // #457 item 8: recompute terminus check defensively. Pipeline-side
      // `event_in_window` historically used containment semantics
      // (eyb ∈ [start, end]) which falsely passed Tier-3 fallback rows
      // where the event sat anywhere inside a long bar. Terminus is the
      // honest visual narrative: "pattern terminates at the event."
      const eventInWindow =
        eventYear != null && Math.abs(eventYear - patternEnd) <= END_ALIGNMENT_TOLERANCE;
      return {
        start: a.pair_start_b,
        end: patternEnd,
        length: a.pair_length,
        isReal: true,
        isCommonLength: true,
        eventInWindow,
        subjectStartA: a.pair_start_a,
      };
    }

    // Priority 2: legacy best_pattern_* — only if end-aligned on the fly.
    if (
      a.best_pattern_start_b !== undefined &&
      a.best_pattern_length !== undefined &&
      eventYear !== null &&
      eventYear !== undefined
    ) {
      const legacyEnd = a.best_pattern_start_b + a.best_pattern_length;
      if (Math.abs(legacyEnd - eventYear) <= END_ALIGNMENT_TOLERANCE) {
        return {
          start: a.best_pattern_start_b,
          end: legacyEnd,
          length: a.best_pattern_length,
          isReal: true,
          isCommonLength: false,
          // #457 item 8: terminus check matches Priority 1. Inside this
          // branch the precondition above already guarantees it's true,
          // but state it explicitly for parity with the v2 path.
          eventInWindow: Math.abs(eventYear - legacyEnd) <= END_ALIGNMENT_TOLERANCE,
          subjectStartA: a.best_pattern_start_a,
        };
      }
      // else fall through: legacy window doesn't end at event → reject
    }

    // Priority 3: event-anchored fallback. Guaranteed to end at event.
    const ey = eventYear ?? CURRENT_YEAR;
    return {
      start: ey - patternWindowYears,
      end: ey,
      length: patternWindowYears,
      isReal: false,
      isCommonLength: false,
      eventInWindow: true, // event defines the window by construction
      subjectStartA: undefined,
    };
  };

  // Pre-compute the resolved pattern for every analogue so the legend
  // labels + visual differentiation downstream reflect what actually
  // renders (not just which fields are present). Sonnet pre-mortem
  // flagged that the previous `allReal` check looked at field presence
  // — which could lie when the legacy best_pattern_* survived but
  // got rejected by the on-the-fly end-alignment check in resolveAnaloguePattern.
  const resolvedByAnalogueId = new Map(
    withEvents.map((a) => [a.country_b_id, resolveAnaloguePattern(a)])
  );

  const allReal = withEvents.every(
    (a) => resolvedByAnalogueId.get(a.country_b_id)?.isReal ?? false
  );
  const allCommonLength = withEvents.every(
    (a) => resolvedByAnalogueId.get(a.country_b_id)?.isCommonLength ?? false
  );
  // P0 defensive guard (Sonnet review): canonicalLength is an optional
  // prop, so `allCommonLength` can be true while `canonicalLength` is
  // undefined. Without this guard the legend literally renders "L=?yr".
  const showCommonLengthLabel = allCommonLength && canonicalLength != null;

  // #457 item 2: when the subject country has already had the event for
  // this category, the synthetic "[NOW − canonicalLength, NOW]" cyan bar
  // labelled "PATTERN STILL UNFOLDING" is a visual lie — the pattern has
  // already concluded. Hide the dedicated subject row and surface the
  // event-already-happened fact as a stat line above the SVG instead.
  const subjectHadEvent =
    subject.subject_event_year_a !== null && subject.subject_event_year_a !== undefined;

  // Compute axis range — include event markers + every pattern window + padding
  const allYears: number[] = [CURRENT_YEAR];
  if (!subjectHadEvent) {
    allYears.push(CURRENT_YEAR - patternWindowYears); // subject "still unfolding" bar
  }
  if (
    subject.subject_event_year_a !== null &&
    subject.subject_event_year_a !== undefined
  ) {
    allYears.push(subject.subject_event_year_a);
  }
  withEvents.forEach((a) => {
    const pw = resolveAnaloguePattern(a);
    allYears.push(pw.start, pw.end);
    // #457 item 3: per-row subject pattern segment at [pair_start_a, +L].
    // Each analogue row now renders the SUBJECT's matching segment as a
    // cyan bar alongside the analogue's orange bar — one small bar per
    // pair, not one shared rectangle that doesn't match any specific pair.
    if (a.pair_start_a !== undefined && a.pair_length !== undefined) {
      allYears.push(a.pair_start_a, a.pair_start_a + a.pair_length);
    }
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
  const rowCount =
    (subjectHadEvent ? 0 : 1) + withEvents.length + (withoutEvents.length > 0 ? 1 : 0);
  const height = marginTop + rowCount * rowHeight + 84; // + legend + x-axis area

  const xOf = (year: number) =>
    marginLeft + ((year - minYear) / (maxYear - minYear)) * innerWidth;
  const yOf = (rowIdx: number) => marginTop + rowIdx * rowHeight;

  // Year ticks every 10 years
  const firstTick = Math.ceil(minYear / 10) * 10;
  const ticks: number[] = [];
  for (let y = firstTick; y <= maxYear; y += 10) ticks.push(y);

  /**
   * #354: subject window length.
   *
   * When `canonicalLength` is available (post-#354 enrichment), the
   * subject row extends back `canonicalLength` years from NOW. Each
   * analogue row's subject portion (if we decide to show one per row
   * later) is `pair_start_a` to `pair_start_a + pair_length`, which
   * shifts per row — but the single top-level subject bar uses the
   * canonical length as a representative window.
   */
  const subjectWindow = canonicalLength ?? patternWindowYears;
  const subjectStart = CURRENT_YEAR - subjectWindow;

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
          title={
            showCommonLengthLabel
              ? `All analogue rows share pattern length ~${canonicalLength} years (common-length enforcement per #354). Subject row extends ${subjectWindow} years to NOW.`
              : allReal
                ? "Analogue pattern windows from qgi_data.patterns (per-pair best-PPS — lengths vary across rows)."
                : "Windows ≈ 15yr fallback · Events real (qgi-data)."
          }
        >
          {showCommonLengthLabel
            ? `Common length L=${canonicalLength}yr · Events real`
            : allReal
              ? "Patterns real · Events real · Lengths vary"
              : "Windows ≈ 15yr fallback · Events real"}
        </div>
      </div>

      {/* #457 item 2: subject-already-had-event stat. Replaces the
          synthetic "PATTERN STILL UNFOLDING" cyan bar that misrepresented
          the subject's status when the event had already occurred. */}
      {subjectHadEvent && (
        <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          <strong style={{ color: COLOR_SUBJECT }}>{subject.country_name}</strong> had a{" "}
          <strong>{categoryLabel}</strong> event in{" "}
          <strong style={{ color: COLOR_EVENT }}>{subject.subject_event_year_a}</strong>.
          The analogues below are the historical Pattern instances that backed this
          recipe.
        </p>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ maxHeight: Math.max(320, height) }}
        role="img"
        aria-label={
          subjectHadEvent
            ? `Timeline comparing ${withEvents.length} historical analogues that experienced ${categoryLabel}. ${subject.country_name} had its event in ${subject.subject_event_year_a}; analogue rows show the matching pattern segments alongside each historical pattern that backed this recipe.`
            : `Timeline comparing ${subject.country_name}'s pattern to ${withEvents.length} historical analogues that experienced ${categoryLabel}. Subject pattern extends to ${CURRENT_YEAR}; analogue patterns end at their historical event.`
        }
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

        {/* ────── Subject row (only when subject hasn't had the event — #457 item 2) ────── */}
        {!subjectHadEvent && (
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
        )}

        {/* ────── Analogue rows ────── */}
        {withEvents.map((a, i) => {
          // #457 item 2: when the subject row is hidden (subject already
          // had the event), analogue rows start at index 0 instead of 1.
          const rowIdx = subjectHadEvent ? i : i + 1;
          const eventYear = a.event_year_b as number;
          const pw = resolveAnaloguePattern(a);
          const patternStart = pw.start;
          const patternEnd = pw.end;
          // #457 item 3: subject pattern segment for THIS pair, drawn
          // alongside the analogue's pattern. Reads as "your country's
          // years X-Y align with the analogue's years M-N" — granular
          // alignment instead of the old shared cyan-to-NOW rectangle
          // that didn't match any specific pair. Skipped when pair_*
          // fields are absent (legacy data without v2 enrichment).
          const hasSubjectSegment =
            a.pair_start_a !== undefined && a.pair_length !== undefined;
          const subjectSegStart = a.pair_start_a;
          const subjectSegEnd =
            hasSubjectSegment &&
            a.pair_start_a !== undefined &&
            a.pair_length !== undefined
              ? a.pair_start_a + a.pair_length
              : undefined;
          // #354: prefer the length-L pair PPS + corr when available, else
          // fall back to the global best-PPS fields.
          const displayPps = a.pair_pps ?? a.best_pps;
          const displayCorr = a.pair_avg_corr ?? a.mean_corr;
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
                corr {(displayCorr * 100).toFixed(0)}% · pps {displayPps.toFixed(0)} ·{" "}
                {pw.length}yr
              </text>

              {/* #465 Q2: chevron + click-to-expand when this analogue has
                  multiple Pattern instances available (pair_instances len
                  > 1, post-Q2-pipeline data). Rendered as a small "▾ N"
                  toggle inside the bar area's left margin, so clicking it
                  doesn't conflict with the bar geometry. Pre-pipeline
                  data has no pair_instances → toggle hidden, no behavior
                  change. */}
              {a.pair_instances && a.pair_instances.length > 1 && (
                <g
                  transform={`translate(${marginLeft - 8}, ${barHeight / 2 + 4})`}
                  onClick={() =>
                    setExpandedAnalogueId(
                      expandedAnalogueId === a.country_b_id ? null : a.country_b_id
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  <title>
                    {expandedAnalogueId === a.country_b_id ? "Hide" : "Show"}{" "}
                    {a.pair_instances.length - 1} additional Pattern instance(s) for{" "}
                    {a.country_b_name}
                  </title>
                  {/* Hit target (transparent, larger than visible glyph) */}
                  <circle r={9} fill="transparent" />
                  {/* Visible chevron + count */}
                  <text
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    fill={COLOR_ANALOGUE}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {expandedAnalogueId === a.country_b_id ? "▴" : "▾"}
                    {a.pair_instances.length}
                  </text>
                </g>
              )}

              {/* #457 item 3: subject pattern segment (cyan), drawn at
                  this pair's [pair_start_a, pair_start_a + pair_length].
                  Lighter fill than the analogue bar so it visually reads
                  as "your country's matching segment" rather than
                  competing with the analogue's pattern. */}
              {hasSubjectSegment &&
                subjectSegStart !== undefined &&
                subjectSegEnd !== undefined && (
                  <>
                    <rect
                      x={xOf(subjectSegStart)}
                      y={0}
                      width={xOf(subjectSegEnd) - xOf(subjectSegStart)}
                      height={barHeight}
                      fill={COLOR_SUBJECT}
                      fillOpacity={0.18}
                      stroke={COLOR_SUBJECT}
                      strokeWidth={1}
                      rx={2}
                    />
                    <text
                      x={(xOf(subjectSegStart) + xOf(subjectSegEnd)) / 2}
                      y={-4}
                      fontSize="8.5"
                      fontFamily="ui-monospace, monospace"
                      textAnchor="middle"
                      fill={COLOR_SUBJECT}
                      fillOpacity={0.85}
                    >
                      {subjectSegStart}–{subjectSegEnd}
                    </text>
                  </>
                )}

              {/* Analogue pattern bar. Earlier iteration rendered
                  fallback windows (15yr event-anchored approximation)
                  with dashed stroke + "(approx)" label + reduced
                  opacity to distinguish them from real pair-window
                  data. User feedback (2026-04-19): that distinction is
                  an internal data-quality concern that leaks to the UI
                  as visual degradation — users want to see the
                  analogue's window, not a debug indicator of which
                  pipeline produced it. Uniform bar for every row.
                  Transparency lives in the header badge ("WINDOWS ≈
                  15YR FALLBACK" when that's the dominant mode). */}
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
                {patternStart}–{patternEnd}
              </text>

              {/* #465 Q2: when this row is expanded, render thin sub-bars
                  for the non-canonical Pattern instances (skip index 0 —
                  that's the canonical bar already drawn above). Stacked
                  below the canonical bar within the row's vertical space
                  so layout doesn't shift. Cap at MAX_SUB_INSTANCES (4)
                  to fit; remaining instances accessible via API. Each
                  sub-bar shows its native length + start_year via title
                  tooltip — full progressive-disclosure fidelity comes in
                  v0.2 redesign with proper height management. */}
              {expandedAnalogueId === a.country_b_id &&
                a.pair_instances &&
                a.pair_instances.slice(1, 1 + MAX_SUB_INSTANCES).map((inst, subIdx) => {
                  const subY = barHeight + 4 + subIdx * 5;
                  const subEnd = inst.sb + inst.l;
                  return (
                    <g key={`sub-${a.country_b_id}-${subIdx}`}>
                      <title>
                        Pattern instance #{subIdx + 2}: {inst.sb}–{subEnd}
                        {" ("}
                        {inst.l}yr, pps {inst.pps.toFixed(0)}, corr{" "}
                        {(inst.ac * 100).toFixed(0)}%{")"}
                      </title>
                      <rect
                        x={xOf(inst.sb)}
                        y={subY}
                        width={Math.max(2, xOf(subEnd) - xOf(inst.sb))}
                        height={3}
                        fill={COLOR_ANALOGUE}
                        fillOpacity={0.4}
                        rx={1}
                      />
                    </g>
                  );
                })}

              {/* #354: event-outside-window indicator. When the analogue's
                  median-year event falls outside its length-L pattern, the
                  "pattern → event" narrative breaks. Still render the star
                  for data transparency but flag with a ⚠ glyph + muted
                  colour so users don't read it as a clean forecast. */}
              {pw.isReal && !pw.eventInWindow && (
                <g>
                  <title>
                    Event falls outside the pattern window — interpret as retrospective
                    analogue rather than forward forecast
                  </title>
                  <text
                    x={marginLeft + 4}
                    y={barHeight / 2 + 4}
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                    fill={COLOR_LABEL}
                  >
                    ⚠
                  </text>
                </g>
              )}

              {/* #457 item 1: tail line from pattern end to real event
                  year when they differ (the D4 ±2 grace window). Reads
                  as "model observed up to here, event happened over
                  here" — convention from event-aware timelines. */}
              {patternEnd !== eventYear && (
                <line
                  x1={xOf(patternEnd)}
                  y1={barHeight / 2}
                  x2={xOf(eventYear)}
                  y2={barHeight / 2}
                  stroke={COLOR_LABEL}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={0.7}
                />
              )}

              {/* #457 item 1: diamond at REAL event year. Previously
                  anchored to `patternEnd` to keep the marker on the
                  bar's right edge — but that misrepresented the event
                  when the pair-window's end and the event year drifted
                  apart (up to ±2yr per the D4 grace window). With the
                  tail line above bridging the visual gap, the diamond
                  can sit at the truth.

                  Shape: rotated-square diamond (12px across) — a neutral
                  geometric marker that fits QGI's data-observatory
                  aesthetic (no star, no achievement glyph). */}
              <g transform={`translate(${xOf(eventYear)}, ${barHeight / 2})`}>
                <polygon
                  points="0,-6 6,0 0,6 -6,0"
                  fill={COLOR_EVENT}
                  stroke={COLOR_EVENT}
                  strokeWidth={1.25}
                />
              </g>
              {/* #457 item 7: anchor the label "end" when the diamond is
                  near the right edge so the year text doesn't clip past
                  the viewBox. Threshold ~80px reserves enough room for
                  "◆ 1994" at fontSize 9.5. */}
              {(() => {
                const labelX = xOf(eventYear);
                const nearRightEdge = labelX > width - marginRight - 80;
                return (
                  <text
                    x={nearRightEdge ? labelX - 12 : labelX + 12}
                    y={barHeight / 2 + 4}
                    fontSize="9.5"
                    fontFamily="ui-monospace, monospace"
                    fill={COLOR_EVENT}
                    fontWeight={600}
                    textAnchor={nearRightEdge ? "end" : "start"}
                  >
                    ◆ {eventYear}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Pending-data row for analogues without event info (rare; <3%) */}
        {withoutEvents.length > 0 &&
          (() => {
            // #457 item 2: pending row index shifts up when the subject
            // row is hidden because the subject already had the event.
            const rowIdx = (subjectHadEvent ? 0 : 1) + withEvents.length;
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
          label={
            subjectHadEvent
              ? `${subject.country_name?.toUpperCase() ?? "SUBJECT"} — MATCHING PATTERN SEGMENT`
              : `${subject.country_name?.toUpperCase() ?? "SUBJECT"} — PATTERN STILL UNFOLDING`
          }
        />
        <LegendEntry color={COLOR_ANALOGUE} label="ANALOGUE — PATTERN ENDED AT EVENT" />
        <LegendEntry
          color={COLOR_EVENT}
          label={`◆ ${categoryLabel.toUpperCase()} (REAL EVENT YEAR)`}
          isDiamond
        />
        {!subjectHadEvent && (
          <LegendEntry color={COLOR_NOW} label={`NOW · ${CURRENT_YEAR}`} isDashed />
        )}
      </div>

      {/* #354 footnote: when fewer analogues are shown than originally
          available (because some had no length-L window), surface the
          count so users know the panel isn't cherry-picked. */}
      {droppedCount > 0 && originalCount && (
        <p
          className="mt-2 text-[10px] leading-relaxed"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Showing {withEvents.length} of {originalCount} analogues at common length L=
          {canonicalLength ?? "?"}
          yr ± 2. {droppedCount} analogue{droppedCount === 1 ? " was" : "s were"} dropped
          because no pattern of this length exists for their pair with{" "}
          {subject.country_name}. Their best-PPS matches are at different lengths and
          aren&apos;t shown to preserve the panel&apos;s length invariant (all rows same
          L).
        </p>
      )}
    </div>
  );
}

function LegendEntry({
  color,
  label,
  isDiamond,
  isDashed,
}: {
  color: string;
  label: string;
  isDiamond?: boolean;
  isDashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {isDiamond ? (
        <svg width={14} height={14} viewBox="-7 -7 14 14" aria-hidden="true">
          <polygon points="0,-5 5,0 0,5 -5,0" fill={color} />
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
