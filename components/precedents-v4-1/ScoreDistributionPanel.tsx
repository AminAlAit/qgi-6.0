"use client";

import * as React from "react";

/**
 * Score distribution panel (capability #10) — V4.1, #140 + #160 polish.
 *
 * Default: histogram (bin 10, hover → country list). Alt: strip plot
 * (one dot per country, tier-colored). Founder picks between the two.
 * Median/p90/p99/max surface as axis annotations; no cryptic prose.
 *
 * Polish pass (Talia, 2026-05-27 #160):
 *   - Axis annotations "p90" / "p99" → "top 10%" / "top 1%" (reads as
 *     plain English; the quantile semantics are unchanged). "med" stays
 *     as "median"; "max" stays as "max".
 *   - "ALT: STRIP PLOT" section label → "Alternate view: per-country dots".
 *   - Histogram hover tooltip now reads "score range" / "n countries"
 *     instead of leaning on the "discrimination rank" jargon. The fact
 *     R&D Q5 binds (rank, not probability) is preserved by the panel's
 *     title-tooltip in PanelBase plus the header paragraph; the hover
 *     surface is shorter and friendlier.
 */
interface HistogramBin {
  bin_lo: number;
  bin_hi: number;
  count: number;
  countries?: string[];
}

export function ScoreDistributionPanel({
  familyColor,
  histogram,
  median,
  p90,
  p99,
  max,
}: {
  familyColor: string;
  histogram: HistogramBin[];
  median: number;
  p90: number;
  p99: number;
  max: number;
}) {
  const stripDots = React.useMemo(() => {
    const dots: Array<{ score: number; name: string; tier: Tier }> = [];
    for (const b of histogram) {
      if (!b.countries) continue;
      for (const name of b.countries) {
        const score = (b.bin_lo + b.bin_hi) / 2;
        dots.push({ score, name, tier: tierFor(score) });
      }
    }
    return dots;
  }, [histogram]);

  const hasData = histogram.length > 0 && histogram.some((b) => b.count > 0);
  if (!hasData) {
    return (
      <section
        data-tour="score-distribution-panel"
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderLeft: `3px solid ${familyColor}`,
          borderRadius: "6px",
          padding: "18px 20px 20px",
          minWidth: "340px",
          minHeight: "200px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: familyColor, margin: 0 }}>
          Score distribution
        </h2>
        <div
          style={{
            marginTop: "auto",
            padding: "16px 14px",
            border: "1px dashed var(--qgi-border)",
            background: "rgba(255,255,255,0.015)",
            borderRadius: "5px",
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
          }}
        >
          Fills after this recipe completes a validated walk.
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="score-distribution-panel-heading"
      data-tour="score-distribution-panel"
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${familyColor}`,
        borderRadius: "6px",
        padding: "18px 20px 20px",
        minWidth: "340px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <header>
        <h2
          id="score-distribution-panel-heading"
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: familyColor,
            margin: 0,
            letterSpacing: "0.1px",
          }}
        >
          Score distribution
        </h2>
        <p
          style={{
            fontSize: "11px",
            lineHeight: 1.5,
            color: "var(--qgi-text-muted)",
            margin: "6px 0 0",
          }}
        >
          How the recipe&apos;s rank-0-to-100 scores spread across all scored countries.
          Hover any bar for the country list. Median, top 10%, top 1%, and max mark the
          right-tail shape.
        </p>
      </header>

      <Histogram
        histogram={histogram}
        familyColor={familyColor}
        median={median}
        p90={p90}
        p99={p99}
        max={max}
      />

      <div>
        <div
          style={{
            fontSize: "10px",
            letterSpacing: "1.2px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "8px",
          }}
        >
          Alternate view: per-country dots
        </div>
        <StripPlot
          dots={stripDots}
          median={median}
          p90={p90}
          p99={p99}
          max={max}
          familyColor={familyColor}
        />
      </div>
    </section>
  );
}

function Histogram({
  histogram,
  familyColor,
  median,
  p90,
  p99,
  max,
}: {
  histogram: HistogramBin[];
  familyColor: string;
  median: number;
  p90: number;
  p99: number;
  max: number;
}) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const W = 560;
  const H = 192;
  const PAD_L = 30;
  const PAD_R = 16;
  const PAD_T = 24; // +10 vs prior; room for two-line annotations
  const PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const maxCount = Math.max(1, ...histogram.map((b) => b.count));
  const xForScore = (s: number) => PAD_L + (s / 100) * plotW;
  const barWidth = plotW / histogram.length - 1.5;
  const hoveredBin = hoverIdx !== null ? histogram[hoverIdx] : null;

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Histogram of recipe scores"
      >
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + plotH - t * plotH;
          return (
            <line
              key={t}
              x1={PAD_L}
              x2={PAD_L + plotW}
              y1={y}
              y2={y}
              stroke="var(--qgi-border)"
              strokeWidth={0.5}
              strokeDasharray="2 3"
            />
          );
        })}
        {histogram.map((b, i) => {
          const x = xForScore(b.bin_lo) + 0.75;
          const h = (b.count / maxCount) * plotH;
          const y = PAD_T + plotH - h;
          const isHover = hoverIdx === i;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1, h)}
              fill={familyColor}
              fillOpacity={isHover ? 0.95 : 0.6}
              stroke={familyColor}
              strokeWidth={isHover ? 1 : 0.5}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
        <line
          x1={PAD_L}
          x2={PAD_L + plotW}
          y1={PAD_T + plotH}
          y2={PAD_T + plotH}
          stroke="var(--qgi-border)"
          strokeWidth={1}
        />
        {Array.from({ length: 11 }).map((_, i) => {
          const s = i * 10;
          const x = xForScore(s);
          return (
            <g key={i}>
              <line
                x1={x}
                x2={x}
                y1={PAD_T + plotH}
                y2={PAD_T + plotH + 3}
                stroke="var(--qgi-border)"
                strokeWidth={0.75}
              />
              <text
                x={x}
                y={PAD_T + plotH + 13}
                fontSize={8.5}
                fill="var(--qgi-text-dim)"
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {s}
              </text>
            </g>
          );
        })}
        <Annotation
          x={xForScore(median)}
          top={PAD_T - 6}
          label="median"
          value={median}
          color="var(--qgi-text-muted)"
        />
        <Annotation
          x={xForScore(p90)}
          top={PAD_T - 6}
          label="top 10%"
          value={p90}
          color="var(--qgi-text-muted)"
        />
        <Annotation
          x={xForScore(p99)}
          top={PAD_T - 6}
          label="top 1%"
          value={p99}
          color="var(--qgi-text-muted)"
        />
        <Annotation
          x={xForScore(max)}
          top={PAD_T - 6}
          label="max"
          value={max}
          color={familyColor}
        />
        {[median, p90, p99, max].map((q, i) => (
          <line
            key={i}
            x1={xForScore(q)}
            x2={xForScore(q)}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke="var(--qgi-text-dim)"
            strokeDasharray="2 3"
            strokeWidth={0.5}
            opacity={0.6}
          />
        ))}
      </svg>
      {hoveredBin && (
        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            background: "var(--qgi-bg)",
            border: `1px solid ${familyColor}`,
            borderRadius: "4px",
            padding: "8px 10px",
            maxWidth: "220px",
            fontFamily: "ui-monospace, monospace",
            fontSize: "10.5px",
            color: "var(--qgi-text)",
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ color: familyColor, marginBottom: "4px", fontWeight: 600 }}>
            score {hoveredBin.bin_lo}–{hoveredBin.bin_hi} · {hoveredBin.count}{" "}
            {hoveredBin.count === 1 ? "country" : "countries"}
          </div>
          {hoveredBin.countries && hoveredBin.countries.length > 0 ? (
            <div style={{ color: "var(--qgi-text-muted)", lineHeight: 1.5 }}>
              {hoveredBin.countries.slice(0, 12).join(", ")}
              {hoveredBin.countries.length > 12
                ? `, +${hoveredBin.countries.length - 12} more`
                : ""}
            </div>
          ) : (
            <div style={{ color: "var(--qgi-text-dim)", fontStyle: "italic" }}>
              Country list not available for this range.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Annotation({
  x,
  top,
  label,
  value,
  color,
}: {
  x: number;
  top: number;
  label: string;
  value: number;
  color: string;
}) {
  // Two-line annotation: label on top, value beneath. Reads cleanly for
  // multi-word friendly labels ("top 10%", "top 1%") that would otherwise
  // collide with the value on a single line.
  return (
    <g>
      <text
        x={x}
        y={top - 9}
        fontSize={8.5}
        fill={color}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
      <text
        x={x}
        y={top - 1}
        fontSize={8.5}
        fill={color}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {value.toFixed(0)}
      </text>
      <line x1={x} x2={x} y1={top + 2} y2={top + 5} stroke={color} strokeWidth={0.75} />
    </g>
  );
}

type Tier = "low" | "mid" | "high" | "extreme";

function tierFor(score: number): Tier {
  if (score >= 75) return "extreme";
  if (score >= 50) return "high";
  if (score >= 25) return "mid";
  return "low";
}

const TIER_COLOR: Record<Tier, string> = {
  low: "#5C6675",
  mid: "#A78BFA",
  high: "#E68F29",
  extreme: "#E64545",
};

const TIER_RADIUS: Record<Tier, number> = {
  low: 2.4,
  mid: 2.8,
  high: 3.2,
  extreme: 3.6,
};

function StripPlot({
  dots,
  median,
  p90,
  p99,
  max,
  familyColor,
}: {
  dots: Array<{ score: number; name: string; tier: Tier }>;
  median: number;
  p90: number;
  p99: number;
  max: number;
  familyColor: string;
}) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const W = 560;
  const H = 100;
  const PAD_L = 30;
  const PAD_R = 16;
  const PAD_T = 32; // +10 vs prior; room for two-line annotations
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const yMid = PAD_T + (H - PAD_T - PAD_B) / 2;
  const xForScore = (s: number) => PAD_L + (s / 100) * plotW;

  const dotsWithJitter = React.useMemo(
    () =>
      dots.map((d, i) => ({
        ...d,
        idx: i,
        jitter: ((hashStr(d.name) % 1000) / 1000 - 0.5) * 14,
      })),
    [dots]
  );

  const hovered = hoverIdx !== null ? dotsWithJitter[hoverIdx] : null;

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Strip plot of recipe scores"
      >
        <line
          x1={PAD_L}
          x2={PAD_L + plotW}
          y1={H - PAD_B}
          y2={H - PAD_B}
          stroke="var(--qgi-border)"
          strokeWidth={1}
        />
        {Array.from({ length: 11 }).map((_, i) => {
          const s = i * 10;
          const x = xForScore(s);
          return (
            <g key={i}>
              <line
                x1={x}
                x2={x}
                y1={H - PAD_B}
                y2={H - PAD_B + 3}
                stroke="var(--qgi-border)"
                strokeWidth={0.75}
              />
              <text
                x={x}
                y={H - PAD_B + 13}
                fontSize={8.5}
                fill="var(--qgi-text-dim)"
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {s}
              </text>
            </g>
          );
        })}
        <Annotation
          x={xForScore(median)}
          top={PAD_T - 6}
          label="median"
          value={median}
          color="var(--qgi-text-muted)"
        />
        <Annotation
          x={xForScore(p90)}
          top={PAD_T - 6}
          label="top 10%"
          value={p90}
          color="var(--qgi-text-muted)"
        />
        <Annotation
          x={xForScore(p99)}
          top={PAD_T - 6}
          label="top 1%"
          value={p99}
          color="var(--qgi-text-muted)"
        />
        <Annotation
          x={xForScore(max)}
          top={PAD_T - 6}
          label="max"
          value={max}
          color={familyColor}
        />
        {[median, p90, p99, max].map((q, i) => (
          <line
            key={i}
            x1={xForScore(q)}
            x2={xForScore(q)}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="var(--qgi-text-dim)"
            strokeDasharray="2 3"
            strokeWidth={0.5}
            opacity={0.6}
          />
        ))}
        {dotsWithJitter.map((d) => (
          <circle
            key={d.idx}
            cx={xForScore(d.score)}
            cy={yMid + d.jitter}
            r={TIER_RADIUS[d.tier]}
            fill={TIER_COLOR[d.tier]}
            fillOpacity={hoverIdx === d.idx ? 1 : 0.78}
            stroke={hoverIdx === d.idx ? "var(--qgi-text)" : "none"}
            strokeWidth={hoverIdx === d.idx ? 1 : 0}
            onMouseEnter={() => setHoverIdx(d.idx)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </svg>
      <div
        style={{
          display: "flex",
          gap: "12px",
          fontSize: "9.5px",
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text-dim)",
          letterSpacing: "0.5px",
          marginTop: "4px",
          flexWrap: "wrap",
        }}
      >
        <LegendDot color={TIER_COLOR.low} label="0–24 low" />
        <LegendDot color={TIER_COLOR.mid} label="25–49 mid" />
        <LegendDot color={TIER_COLOR.high} label="50–74 high" />
        <LegendDot color={TIER_COLOR.extreme} label="75–100 extreme" />
      </div>
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            background: "var(--qgi-bg)",
            border: `1px solid ${TIER_COLOR[hovered.tier]}`,
            borderRadius: "4px",
            padding: "6px 8px",
            fontFamily: "ui-monospace, monospace",
            fontSize: "10.5px",
            color: "var(--qgi-text)",
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ color: TIER_COLOR[hovered.tier], fontWeight: 600 }}>
            {hovered.name}
          </span>{" "}
          · score {hovered.score.toFixed(0)}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
