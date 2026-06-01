/**
 * PrecedentsTimelinePanel — V4.1 "Precedents" section (renamed from
 * "Recent additions" 2026-05-27). Horizontal-timeline ticker of the
 * recipe's verified-positive corpus events: year-axis tick marks,
 * green "+" for added / red "−" for vacated dots.
 *
 * 2026-05-27 #162 part A:
 *   The chip strip below the timeline (one chip per event) was dropped.
 *   Each event now surfaces ONLY on hover/focus of its dot, as a small
 *   popup themed like Sofia's TooltipChip (small box, family-color left
 *   border, dark surface background). One surface, not two — kills the
 *   redundancy and lets the timeline breathe.
 *
 * 2026-05-27 #162 part B:
 *   Popup flags are <img src="https://flagcdn.com/16x12/<iso2>.png" />
 *   instead of emoji codepoints. Windows 10 default font stack has no
 *   regional-indicator glyph table, so 🇺🇦 renders as "UA". flagcdn gives
 *   us identical bitmap output across Windows / macOS / Linux. Emoji
 *   stays in the data for ARIA / fallback.
 *
 * Title casing harmonised with peer V4.1 panels ("Sample-size sufficiency",
 * "Reliability", "Indicator sensitivity") 2026-05-27 per founder #157.
 * Footer legend extended in the same pass to communicate the MEANING of
 * "added" / "vacated" curator actions, not just their colors.
 *
 * — Daniyar Bekmurat, Comparative Historical Pattern Matching
 */
"use client";

import { useState, type CSSProperties } from "react";
// 2026-05-29 (Naila #27): switched from country-iso2 to country-flags' iso2For
// — the country-flags lookup is the more complete table (including the
// 2026-05-29 gap-fill batch covering Ivory Coast, Benin, Togo, Tanzania,
// Liberia, Republic of Congo, Mauritania, etc.). country-iso2 returns
// empty string on miss; country-flags returns null — we treat both as falsy.
import { iso2For } from "@/lib/te-mock/country-flags";

export interface PrecedentEvent {
  year: number;
  country: string;
  country_iso: string;
  flag_emoji: string;
  action: "added" | "vacated";
  reason: string;
}

export interface PrecedentsTimelinePanelProps {
  familyColor: string;
  events: PrecedentEvent[];
  totalEventsInCorpus: number;
}

export function PrecedentsTimelinePanel({
  familyColor,
  events,
  totalEventsInCorpus,
}: PrecedentsTimelinePanelProps) {
  const sorted = [...events].sort((a, b) => a.year - b.year);
  const visibleAdded = sorted.filter((e) => e.action === "added").length;
  const visibleVacated = sorted.filter((e) => e.action === "vacated").length;

  const minYear = sorted.length > 0 ? sorted[0].year - 1 : new Date().getFullYear() - 10;
  const maxYear =
    sorted.length > 0 ? sorted[sorted.length - 1].year + 1 : new Date().getFullYear();
  const yearSpan = Math.max(1, maxYear - minYear);

  const byYear = new Map<number, PrecedentEvent[]>();
  for (const ev of sorted) {
    const bucket = byYear.get(ev.year) ?? [];
    bucket.push(ev);
    byYear.set(ev.year, bucket);
  }

  // Viewport-space coords (px) so the popup can be absolutely positioned
  // OVER the SVG. We keep the SVG dimensions as the layout's truth and
  // mirror coords for popup placement via a parent wrapper at the same
  // aspect ratio.
  const W = 540;
  const H = 132;
  const padL = 14;
  const padR = 14;
  const axisY = 86;
  const innerW = W - padL - padR;
  const xFor = (year: number) => padL + ((year - minYear) / yearSpan) * innerW;

  const tickStep = Math.max(1, Math.ceil(yearSpan / 7));
  const ticks: number[] = [];
  for (let y = minYear; y <= maxYear; y += tickStep) ticks.push(y);
  if (ticks[ticks.length - 1] !== maxYear) ticks.push(maxYear);

  const chipStyle: CSSProperties = {
    fontFamily: "ui-monospace, monospace",
    fontSize: "10px",
    letterSpacing: "0.3px",
  };

  const ADDED = "#3FBF8F";
  const VACATED = "#E64545";

  const titleStyle: CSSProperties = {
    fontSize: "15px",
    fontWeight: 600,
    color: familyColor,
    margin: 0,
    letterSpacing: "0.1px",
  };

  // ── Flat positioned model for hover targets and popups ──────────────────
  // Each event gets a stable id from year+iso+stack index; we pre-compute
  // its normalised x (% across the SVG) and y (% down the SVG) so the
  // overlaid HTML popup can land near the dot regardless of container size.
  type Positioned = {
    id: string;
    ev: PrecedentEvent;
    cxSvg: number;
    cySvg: number;
    xPct: number; // 0..100
    yPct: number; // 0..100
  };
  const positioned: Positioned[] = [];
  for (const [year, bucket] of byYear.entries()) {
    bucket.forEach((ev, i) => {
      const cxSvg = xFor(year);
      const cySvg = axisY - 16 - i * 16;
      positioned.push({
        id: `${ev.country_iso}-${year}-${i}`,
        ev,
        cxSvg,
        cySvg,
        xPct: (cxSvg / W) * 100,
        yPct: (cySvg / H) * 100,
      });
    });
  }

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hovered = positioned.find((p) => p.id === hoveredId) ?? null;

  if (sorted.length === 0) {
    return (
      <section
        aria-labelledby="precedents-panel-heading-empty"
        data-tour="precedents-timeline-panel"
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderLeft: `3px solid ${familyColor}`,
          borderRadius: "6px",
          padding: "16px 18px 18px",
          minWidth: "340px",
        }}
      >
        <h2 id="precedents-panel-heading-empty" style={titleStyle}>
          Precedents
        </h2>
        <div
          style={{
            marginTop: "12px",
            padding: "16px 14px",
            border: "1px dashed var(--qgi-border)",
            background: "rgba(255,255,255,0.015)",
            borderRadius: "5px",
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
          }}
        >
          No recent curation actions for this recipe at the current release.
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="precedents-panel-heading"
      data-tour="precedents-timeline-panel"
      style={{
        background: "var(--qgi-surface)",
        borderLeft: `3px solid ${familyColor}`,
        border: "1px solid var(--qgi-border)",
        borderRadius: "6px",
        padding: "16px 18px 18px",
        minWidth: "340px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2 id="precedents-panel-heading" style={titleStyle}>
            Precedents
          </h2>
          <span style={{ ...chipStyle, color: "var(--qgi-text-dim)" }}>
            curated-event corpus
          </span>
        </div>
        {/* 2026-05-29 (Naila #27): right-side "75 verified events" chip
            removed; the subtitle below carries the same number with a
            proper sentence, so the chip was duplicate signal. */}
      </header>

      {/* 2026-05-29 (Naila #27): subtitle rewritten with proper spacing —
          previously rendered as "75verified events..." due to a missing
          space in the template literal. Sentence reads cleanly now and
          carries the count, the curation actions count, and the hover hint
          in one breath. */}
      <p
        style={{
          fontSize: "12px",
          color: "var(--qgi-text-muted)",
          margin: "2px 0 14px",
          lineHeight: 1.5,
        }}
      >
        {totalEventsInCorpus.toLocaleString()} verified events in this recipe&apos;s
        corpus. Showing the {sorted.length} most recent curation actions. Hover any marker
        for detail.
      </p>

      {/* Timeline + popup overlay. The wrapper is `position: relative` and
          carries an aspect ratio matching the SVG viewBox, so the popup
          (HTML, not SVG) can be placed at xPct/yPct of the wrapper and
          land on top of the right dot. */}
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            minWidth: "320px",
            aspectRatio: `${W} / ${H}`,
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Horizontal timeline of curated-event corpus actions"
            style={{ display: "block", position: "absolute", inset: 0 }}
          >
            <line
              x1={padL}
              x2={W - padR}
              y1={axisY}
              y2={axisY}
              stroke="var(--qgi-border)"
              strokeWidth={1}
            />
            {ticks.map((y) => (
              <g key={`tick-${y}`}>
                <line
                  x1={xFor(y)}
                  x2={xFor(y)}
                  y1={axisY - 3}
                  y2={axisY + 3}
                  stroke="var(--qgi-text-dim)"
                  strokeWidth={1}
                />
                <text
                  x={xFor(y)}
                  y={axisY + 16}
                  fontSize="9"
                  textAnchor="middle"
                  fill="var(--qgi-text-dim)"
                  fontFamily="ui-monospace, monospace"
                >
                  {y}
                </text>
              </g>
            ))}
            {positioned.map((p) => {
              const { ev, cxSvg, cySvg, id } = p;
              const color = ev.action === "added" ? ADDED : VACATED;
              const isHovered = hoveredId === id;
              return (
                <g key={id}>
                  <line
                    x1={cxSvg}
                    x2={cxSvg}
                    y1={axisY}
                    y2={cySvg + 5}
                    stroke={color}
                    strokeWidth={0.8}
                    opacity={isHovered ? 0.95 : 0.55}
                  />
                  <circle
                    cx={cxSvg}
                    cy={cySvg}
                    r={isHovered ? 5.5 : 4.5}
                    fill={color}
                    opacity={0.95}
                  />
                  {ev.action === "added" ? (
                    <g stroke="var(--qgi-bg)" strokeWidth={1.4} strokeLinecap="round">
                      <line x1={cxSvg - 2.2} x2={cxSvg + 2.2} y1={cySvg} y2={cySvg} />
                      <line x1={cxSvg} x2={cxSvg} y1={cySvg - 2.2} y2={cySvg + 2.2} />
                    </g>
                  ) : (
                    <line
                      x1={cxSvg - 2.4}
                      x2={cxSvg + 2.4}
                      y1={cySvg}
                      y2={cySvg}
                      stroke="var(--qgi-bg)"
                      strokeWidth={1.4}
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML hover/focus targets: one transparent disc per dot, sized
              larger than the SVG circle so the hit area is generous. We
              keep these as buttons so keyboard focus surfaces the same
              popup as mouse hover (accessibility parity). */}
          {positioned.map((p) => {
            const { ev, xPct, yPct, id } = p;
            const labelAction = ev.action === "added" ? "added" : "removed";
            return (
              <button
                key={`hit-${id}`}
                type="button"
                aria-label={`${ev.year} ${ev.country}, ${labelAction}: ${ev.reason}`}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === id ? null : prev))}
                onFocus={() => setHoveredId(id)}
                onBlur={() => setHoveredId((prev) => (prev === id ? null : prev))}
                style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  width: "18px",
                  height: "18px",
                  transform: "translate(-50%, -50%)",
                  padding: 0,
                  border: "none",
                  borderRadius: "50%",
                  background: "transparent",
                  cursor: "pointer",
                  outline: "none",
                }}
              />
            );
          })}

          {/* The popup itself — single instance, repositioned per hover.
              Smart placement: dot in the right 25% opens left; dot in
              the top 30% opens below; otherwise default opens above &
              centered. Translate values are picked so the popup never
              clips its own anchor. */}
          {hovered &&
            (() => {
              const ev = hovered.ev;
              const iso = iso2For(ev.country);
              const opensLeft = hovered.xPct > 75;
              const opensRight = hovered.xPct < 18;
              const opensBelow = hovered.yPct < 30;

              // Translate is "(x)% (y)%" relative to popup size. The
              // anchor (left/top) is the dot center; the translate
              // moves the popup to the desired quadrant.
              let tx = "-50%";
              let ty = "calc(-100% - 10px)"; // default: above & centered
              if (opensLeft) {
                tx = "calc(-100% - 10px)";
                ty = "-50%";
              } else if (opensRight) {
                tx = "10px";
                ty = "-50%";
              } else if (opensBelow) {
                ty = "calc(0% + 14px)";
              }

              const color = ev.action === "added" ? ADDED : VACATED;

              return (
                <div
                  role="tooltip"
                  style={{
                    position: "absolute",
                    left: `${hovered.xPct}%`,
                    top: `${hovered.yPct}%`,
                    transform: `translate(${tx}, ${ty})`,
                    zIndex: 50,
                    minWidth: "200px",
                    maxWidth: "280px",
                    padding: "8px 10px 9px",
                    background: "var(--qgi-surface-2)",
                    border: "1px solid var(--qgi-border)",
                    borderLeft: `2px solid ${familyColor}`,
                    borderRadius: "5px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "11px",
                    lineHeight: 1.5,
                    color: "var(--qgi-text)",
                    letterSpacing: "0.1px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "4px",
                    }}
                  >
                    {iso ? (
                      <img
                        src={`https://flagcdn.com/16x12/${iso}.png`}
                        alt={`${ev.country} flag`}
                        width={16}
                        height={12}
                        style={{
                          display: "inline-block",
                          verticalAlign: "middle",
                          borderRadius: "1px",
                          flex: "0 0 16px",
                        }}
                      />
                    ) : (
                      <span aria-hidden="true" style={{ fontSize: "12px" }}>
                        {ev.flag_emoji}
                      </span>
                    )}
                    <span style={{ color: "var(--qgi-text-dim)" }}>{ev.year}</span>
                    <span style={{ color: "var(--qgi-text)", fontWeight: 600 }}>
                      {ev.country}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        color,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        fontSize: "9.5px",
                        letterSpacing: "0.6px",
                      }}
                    >
                      {ev.action === "vacated" ? "removed" : ev.action}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "var(--qgi-text-muted)",
                      fontFamily:
                        "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                      fontSize: "12px",
                    }}
                  >
                    {ev.reason}
                  </div>
                </div>
              );
            })()}
        </div>
      </div>

      <footer
        style={{
          marginTop: "14px",
          paddingTop: "10px",
          borderTop: "1px dashed var(--qgi-border)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          color: "var(--qgi-text-muted)",
          letterSpacing: "0.3px",
        }}
      >
        {/* 2026-05-29 (Naila #28): legend now reads as plain English —
            "+" and "−" markers say what each one MEANS, in audience terms,
            not curator-internal language. "Added to the corpus" beats
            "curator confirmed this country-year as a real positive...". */}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <span
            aria-hidden
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: ADDED,
              color: "var(--qgi-bg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 12px",
              marginTop: "2px",
              fontWeight: 700,
              fontSize: "10px",
            }}
          >
            +
          </span>
          <span style={{ lineHeight: 1.55 }}>
            <strong style={{ color: "var(--qgi-text)", fontWeight: 600 }}>
              {visibleAdded} added
            </strong>
            <span style={{ color: "var(--qgi-text-dim)" }}>
              {" "}
              a verified case of this event was admitted to the corpus.
            </span>
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <span
            aria-hidden
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: VACATED,
              color: "var(--qgi-bg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 12px",
              marginTop: "2px",
              fontWeight: 700,
              fontSize: "10px",
            }}
          >
            −
          </span>
          <span style={{ lineHeight: 1.55 }}>
            <strong style={{ color: "var(--qgi-text)", fontWeight: 600 }}>
              {visibleVacated} removed
            </strong>
            <span style={{ color: "var(--qgi-text-dim)" }}>
              {" "}
              a previously-included case was removed on re-review (mis-coded event type,
              insufficient sourcing, or a definitional reframing).
            </span>
          </span>
        </div>
        <div
          style={{
            color: "var(--qgi-text-dim)",
            paddingTop: "2px",
          }}
        >
          curation actions {minYear}–{maxYear}
        </div>
      </footer>
    </section>
  );
}
