"use client";

/**
 * PatternSegmentTimeline — segment timeline panel between hero and shape overlay.
 *
 * Shows two horizontal tracks (one per country) on a shared calendar x-axis.
 * Each track has a green-filled segment spanning that country's window start→end.
 * For offset patterns the two segments are horizontally displaced, making the
 * rhyme offset visually obvious. For aligned patterns they line up.
 *
 * Kicker: WINDOW SPAN
 * Heading: "When each country's window falls"
 */

import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { pairDetailFlagFor } from "@/lib/te-mock/patterns-v4-pair-detail-mock";

interface PatternSegmentTimelineProps {
  countryA: string;
  countryB: string;
  /** Start year of country A's window */
  startA: number;
  /** End year (exclusive) of country A's window = startA + length */
  endA: number;
  /** Start year of country B's window */
  startB: number;
  /** End year (exclusive) of country B's window = startB + length */
  endB: number;
}

const TRACK_HEIGHT = 18;
const LABEL_WIDTH = 120;
const AXIS_HEIGHT = 24;
const SEGMENT_COLOR = "#3FA96A"; // muted green

export function PatternSegmentTimeline({
  countryA,
  countryB,
  startA,
  endA,
  startB,
  endB,
}: PatternSegmentTimelineProps) {
  // Compute overall calendar range with some padding.
  const earliest = Math.min(startA, startB);
  const latest = Math.max(endA, endB);
  const span = latest - earliest;
  const padYears = Math.max(3, Math.round(span * 0.08));
  const axisMin = earliest - padYears;
  const axisMax = latest + padYears;
  const axisSpan = axisMax - axisMin;

  function pct(year: number): number {
    return ((year - axisMin) / axisSpan) * 100;
  }

  // Decade tick marks.
  const ticks: number[] = [];
  const firstDecade = Math.ceil(axisMin / 10) * 10;
  for (let y = firstDecade; y <= axisMax; y += 10) {
    ticks.push(y);
  }

  // For aligned patterns both tracks are identical — show the length label only once.
  const isAligned = startA === startB && endA === endB;

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
        WINDOW SPAN
      </div>
      <h2
        style={{
          fontSize: "15px",
          fontWeight: 700,
          margin: "0 0 20px",
          color: "var(--qgi-text)",
        }}
      >
        When each country&apos;s window falls
      </h2>

      {/* Timeline tracks */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[
          { name: countryA, start: startA, end: endA },
          { name: countryB, start: startB, end: endB },
        ].map(({ name, start, end }, trackIdx) => {
          const leftPct = pct(start);
          const widthPct = ((end - start) / axisSpan) * 100;
          const length = end - start;
          // Only show the centred length label on the first track for aligned
          // patterns (avoids printing "22 y" twice on identical tracks).
          const showLengthLabel = !isAligned || trackIdx === 0;

          return (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* Country label left column */}
              <div
                style={{
                  width: `${LABEL_WIDTH}px`,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FlagImg
                  emoji={pairDetailFlagFor(name)}
                  name={name}
                  width={20}
                  radius={2}
                />
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--qgi-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </span>
              </div>

              {/* Track + segment */}
              <div style={{ flex: 1, position: "relative" }}>
                {/* Track background */}
                <div
                  style={{
                    height: `${TRACK_HEIGHT}px`,
                    background: "var(--qgi-bg)",
                    border: "1px solid var(--qgi-border)",
                    borderRadius: "4px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Segment */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: "100%",
                      background: `${SEGMENT_COLOR}30`,
                      borderLeft: `3px solid ${SEGMENT_COLOR}`,
                      borderRight: `2px solid ${SEGMENT_COLOR}`,
                      borderRadius: "2px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Year labels below segment */}
                <div
                  style={{
                    position: "relative",
                    height: "16px",
                    marginTop: "2px",
                  }}
                >
                  {/* Start year */}
                  <span
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      transform: "translateX(-50%)",
                      fontSize: "9px",
                      fontFamily: "ui-monospace, monospace",
                      color: SEGMENT_COLOR,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {start}
                  </span>
                  {/* Length centered — shown only once for aligned patterns */}
                  {showLengthLabel && (
                    <span
                      style={{
                        position: "absolute",
                        left: `${leftPct + widthPct / 2}%`,
                        transform: "translateX(-50%)",
                        fontSize: "9px",
                        fontFamily: "ui-monospace, monospace",
                        color: "var(--qgi-text-dim)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {length} y
                    </span>
                  )}
                  {/* End year */}
                  <span
                    style={{
                      position: "absolute",
                      left: `${leftPct + widthPct}%`,
                      transform: "translateX(-50%)",
                      fontSize: "9px",
                      fontFamily: "ui-monospace, monospace",
                      color: SEGMENT_COLOR,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {end}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared x-axis */}
      <div
        style={{
          marginLeft: `${LABEL_WIDTH + 12}px`,
          marginTop: "6px",
          position: "relative",
          height: `${AXIS_HEIGHT}px`,
        }}
      >
        {/* Axis line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: "var(--qgi-border)",
          }}
        />
        {ticks.map((y) => {
          const leftPct = ((y - axisMin) / axisSpan) * 100;
          if (leftPct < 0 || leftPct > 100) return null;
          return (
            <div
              key={y}
              style={{
                position: "absolute",
                left: `${leftPct}%`,
                top: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: "translateX(-50%)",
              }}
            >
              <div
                style={{
                  width: "1px",
                  height: "4px",
                  background: "var(--qgi-text-dim)",
                }}
              />
              <span
                style={{
                  fontSize: "8px",
                  fontFamily: "ui-monospace, monospace",
                  color: "var(--qgi-text-dim)",
                  marginTop: "2px",
                  whiteSpace: "nowrap",
                }}
              >
                {y}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
