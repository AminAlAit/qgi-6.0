"use client";

/**
 * Client component for the recipe risk-score page interactive elements:
 *   - Methodology tooltip on risk scores (M8-R5 paired-framing)
 *   - SHAP bar chart (SVG, inline, no heavy lib)
 *
 * Tooltip text content is verbatim per M8-R5 BINDING rider:
 *   "This is a similarity-to-canonical-pre-crisis-trajectory score, not a
 *    calibrated probability. Walk-3 ECE failed Beta calibration; this score
 *    is the discrimination layer (LOCO-AUC 0.9147) presented directly."
 */

import { useState } from "react";

// ---------------------------------------------------------------------------
// Risk score tooltip (M8-R5 paired-framing)
// ---------------------------------------------------------------------------

export const RISK_SCORE_TOOLTIP_TEXT =
  "This is a similarity-to-canonical-pre-crisis-trajectory score, not a calibrated probability. " +
  "Walk-3 ECE failed Beta calibration; this score is the discrimination layer (LOCO-AUC 0.9147) " +
  "presented directly.";

interface RiskScoreWithTooltipProps {
  score: number;
  zone: "HIGH" | "MODERATE" | "LOW";
}

const ZONE_TEXT_COLOR: Record<"HIGH" | "MODERATE" | "LOW", string> = {
  HIGH: "#f87171",
  MODERATE: "#fbbf24",
  LOW: "#9ab0c4",
};

export function RiskScoreWithTooltip({ score, zone }: RiskScoreWithTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="font-mono text-sm font-semibold tabular-nums underline decoration-dotted cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--qgi-accent)]"
        style={{ color: ZONE_TEXT_COLOR[zone] }}
        aria-label={`Risk score ${score.toFixed(1)} — click for methodology note`}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
      >
        {score.toFixed(1)}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 rounded px-3 py-2 text-xs leading-relaxed shadow-lg"
          style={{
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        >
          {RISK_SCORE_TOOLTIP_TEXT}
          <br />
          <a
            href="https://github.com/AminAlAit/qgi-docs/blob/main/methodology/similarity-as-risk-metric.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block"
            style={{ color: "var(--qgi-accent)" }}
          >
            Read methodology
          </a>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SHAP weight bar chart — inline SVG, no echarts dependency
// ---------------------------------------------------------------------------

interface ShapIndicator {
  id: string;
  label: string;
  weight: number;
}

interface ShapBarChartProps {
  indicators: ShapIndicator[];
}

const INDICATOR_LABELS: Record<string, string> = {
  "RQ.EST": "Rule of Law (RQ.EST)",
  v2pepwrgen: "Female political power (v2pepwrgen)",
  v2stfisccap: "Fiscal capacity (v2stfisccap)",
  v2elintmon: "Electoral integrity monitor (v2elintmon)",
};

export function ShapBarChart({ indicators }: ShapBarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (indicators.length === 0) return null;

  const maxWeight = Math.max(...indicators.map((i) => i.weight));
  const barH = 24;
  const gap = 10;
  const labelW = 220;
  const chartW = 220;
  const svgH = indicators.length * (barH + gap) + 30;

  return (
    <figure className="my-0" aria-label="SHAP indicator importance weights">
      <svg
        viewBox={`0 0 ${labelW + chartW + 80} ${svgH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        <title>
          SHAP importance weights for {indicators.map((i) => i.id).join(", ")}
        </title>
        {indicators.map((ind, i) => {
          const y = i * (barH + gap) + 4;
          const barW = maxWeight > 0 ? Math.round((ind.weight / maxWeight) * chartW) : 0;
          const dimmed = hovered !== null && hovered !== ind.id;
          const opacity = dimmed ? 0.35 : 1;
          const label = INDICATOR_LABELS[ind.id] ?? ind.id;

          return (
            <g key={ind.id}>
              <text
                x={labelW - 6}
                y={y + barH / 2 + 4}
                textAnchor="end"
                fontSize="11"
                fontFamily="var(--font-geist-sans, sans-serif)"
                fill="var(--qgi-text-muted)"
                style={{ opacity }}
              >
                {label}
              </text>
              <rect
                x={labelW}
                y={y}
                width={barW}
                height={barH}
                rx={3}
                fill="#a78bfa"
                style={{
                  opacity,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
                aria-label={`${label}: ${(ind.weight * 100).toFixed(1)}%`}
                onMouseEnter={() => setHovered(ind.id)}
                onMouseLeave={() => setHovered(null)}
              />
              <text
                x={labelW + barW + 6}
                y={y + barH / 2 + 4}
                fontSize="11"
                fontFamily="var(--font-geist-mono, monospace)"
                fill="#a78bfa"
                fontWeight="600"
                style={{ opacity, pointerEvents: "none" }}
              >
                {(ind.weight * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
        <text
          x={labelW + chartW / 2}
          y={svgH - 6}
          textAnchor="middle"
          fontSize="9"
          fill="var(--qgi-text-dim)"
          fontFamily="var(--font-geist-sans, sans-serif)"
        >
          SHAP-normalized importance weight (Miriam M14-R5 BINDING)
        </text>
      </svg>
      <figcaption className="text-xs mt-1" style={{ color: "var(--qgi-text-dim)" }}>
        Direction of effect: all four indicators are negatively aligned — higher indicator
        values predict lower crisis similarity. The weights show relative importance only.
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Validation stat chip
// ---------------------------------------------------------------------------

interface ValidationChipProps {
  pass: boolean;
}

export function ValidationChip({ pass }: ValidationChipProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        background: pass ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
        color: pass ? "#34d399" : "#f87171",
        border: `1px solid ${pass ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
      }}
      aria-label={pass ? "PASS" : "FAIL"}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}
