/**
 * PrecedentsTimelinePanel — V4.1 "Precedents" section (renamed from
 * "Recent additions" 2026-05-27). Horizontal-timeline ticker of the
 * recipe's verified-positive corpus events: year-axis tick marks,
 * flag + country chip per event, green "+" for added / red "−" for vacated.
 *
 * Title casing harmonised with peer V4.1 panels ("Sample-size sufficiency",
 * "Reliability", "Indicator sensitivity") 2026-05-27 per founder #157.
 * Footer legend extended in the same pass to communicate the MEANING of
 * "added" / "vacated" curator actions, not just their colors.
 *
 * — Daniyar Bekmurat, Comparative Historical Pattern Matching
 */
import type { CSSProperties } from "react";

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

  if (sorted.length === 0) {
    return (
      <section
        aria-labelledby="precedents-panel-heading"
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderLeft: `3px solid ${familyColor}`,
          borderRadius: "6px",
          padding: "16px 18px 18px",
          minWidth: "340px",
        }}
      >
        <h3 id="precedents-panel-heading" style={titleStyle}>
          Precedents
        </h3>
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
          No recent curation actions for this recipe at the current vintage.
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="precedents-panel-heading"
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
          <h3 id="precedents-panel-heading" style={titleStyle}>
            Precedents
          </h3>
          <span style={{ ...chipStyle, color: "var(--qgi-text-dim)" }}>
            curated-event corpus
          </span>
        </div>
        <span
          style={{
            ...chipStyle,
            color: "var(--qgi-text)",
            fontWeight: 600,
          }}
          title="Total verified positives in this recipe's training corpus"
        >
          {totalEventsInCorpus.toLocaleString()} verified events
        </span>
      </header>

      <p
        style={{
          fontSize: "12px",
          color: "var(--qgi-text-muted)",
          margin: "2px 0 14px",
          lineHeight: 1.5,
        }}
      >
        {totalEventsInCorpus.toLocaleString()} verified events in this recipe&apos;s
        corpus. Showing the {sorted.length} most recent curation actions.
      </p>

      <div style={{ overflowX: "auto" }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Horizontal timeline of curated-event corpus actions"
          style={{ display: "block", minWidth: "320px" }}
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
          {[...byYear.entries()].map(([year, bucket]) =>
            bucket.map((ev, i) => {
              const cx = xFor(year);
              const cy = axisY - 16 - i * 16;
              const color = ev.action === "added" ? ADDED : VACATED;
              return (
                <g key={`${ev.country_iso}-${year}-${i}`}>
                  <line
                    x1={cx}
                    x2={cx}
                    y1={axisY}
                    y2={cy + 5}
                    stroke={color}
                    strokeWidth={0.8}
                    opacity={0.55}
                  />
                  <circle cx={cx} cy={cy} r={4.5} fill={color} opacity={0.95} />
                  {ev.action === "added" ? (
                    <g stroke="var(--qgi-bg)" strokeWidth={1.4} strokeLinecap="round">
                      <line x1={cx - 2.2} x2={cx + 2.2} y1={cy} y2={cy} />
                      <line x1={cx} x2={cx} y1={cy - 2.2} y2={cy + 2.2} />
                    </g>
                  ) : (
                    <line
                      x1={cx - 2.4}
                      x2={cx + 2.4}
                      y1={cy}
                      y2={cy}
                      stroke="var(--qgi-bg)"
                      strokeWidth={1.4}
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "12px 0 0",
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}
      >
        {sorted.map((ev, idx) => {
          const color = ev.action === "added" ? ADDED : VACATED;
          const glyph = ev.action === "added" ? "+" : "−";
          return (
            <li
              key={`${ev.country_iso}-${ev.year}-${idx}`}
              title={`${ev.year} · ${ev.country} — ${ev.action} (${ev.reason})`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 8px",
                background: "var(--qgi-bg)",
                border: `1px solid ${color}`,
                borderRadius: "12px",
                fontFamily: "ui-monospace, monospace",
                fontSize: "10px",
                color: "var(--qgi-text)",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "11px", lineHeight: 1 }}>
                {ev.flag_emoji}
              </span>
              <span style={{ color: "var(--qgi-text-dim)" }}>{ev.year}</span>
              <span style={{ color: "var(--qgi-text)" }}>{ev.country}</span>
              <span
                style={{
                  color,
                  fontWeight: 700,
                  width: "9px",
                  textAlign: "center",
                  display: "inline-block",
                }}
                aria-label={ev.action}
              >
                {glyph}
              </span>
            </li>
          );
        })}
      </ul>

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
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: ADDED,
              display: "inline-block",
              flex: "0 0 8px",
              marginTop: "4px",
            }}
          />
          <span style={{ lineHeight: 1.55 }}>
            <strong style={{ color: "var(--qgi-text)", fontWeight: 600 }}>
              {visibleAdded} added
            </strong>
            <span style={{ color: "var(--qgi-text-dim)" }}>
              {" "}
              — curator confirmed this country-year as a real positive of this
              recipe&apos;s event type and admitted it to the training corpus.
            </span>
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: VACATED,
              display: "inline-block",
              flex: "0 0 8px",
              marginTop: "4px",
            }}
          />
          <span style={{ lineHeight: 1.55 }}>
            <strong style={{ color: "var(--qgi-text)", fontWeight: 600 }}>
              {visibleVacated} vacated
            </strong>
            <span style={{ color: "var(--qgi-text-dim)" }}>
              {" "}
              — removed on re-review (mis-coded event type, ambiguous foreign-vs-
              intrastate framing, or insufficient sourcing).
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
