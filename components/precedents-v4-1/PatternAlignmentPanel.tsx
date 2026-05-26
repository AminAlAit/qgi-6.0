/**
 * PatternAlignmentPanel — V4.1 §Pattern-level alignment (capability #3,
 * canonical movement shape). R&D Q3 ratified: N mini sparklines (N = recipe's
 * indicator count, 3-5) showing the canonical shape across the recipe's
 * window. Mean trajectory in bold + 25/75 percentile band in faint family
 * color (R&D: more honest than rendering individual country paths).
 *
 * — Daniyar Bekmurat, Comparative Historical Pattern Matching
 */
import Link from "next/link";
import type { Route } from "next";

export interface AlignmentIndicator {
  code: string;
  name: string;
  provider: string;
}

export interface AlignmentShape {
  indicatorCode: string;
  mean: number[];
  p25: number[];
  p75: number[];
}

export interface PatternAlignmentPanelProps {
  familyColor: string;
  recipeId: string;
  windowYears: number;
  indicators: AlignmentIndicator[];
  shapeData: AlignmentShape[];
}

export function PatternAlignmentPanel({
  familyColor,
  recipeId,
  windowYears,
  indicators,
  shapeData,
}: PatternAlignmentPanelProps) {
  const shapeByCode = new Map(shapeData.map((s) => [s.indicatorCode, s]));

  return (
    <section
      style={{
        background: "var(--qgi-surface)",
        borderLeft: `3px solid ${familyColor}`,
        border: "1px solid var(--qgi-border)",
        borderRadius: "6px",
        padding: "16px 18px 18px",
        minWidth: "340px",
      }}
      aria-label="Pattern-level alignment — canonical movement shape"
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
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: familyColor,
              letterSpacing: "0.4px",
              margin: 0,
            }}
          >
            PATTERN-LEVEL ALIGNMENT
          </h3>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "10px",
              color: "var(--qgi-text-dim)",
              letterSpacing: "0.3px",
            }}
          >
            canonical movement shape · {indicators.length} indicators · {windowYears}y
            window
          </span>
        </div>
        <Link
          href={`/patterns-v4/${recipeId}` as Route}
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "10px",
            color: familyColor,
            textDecoration: "none",
            border: `1px solid ${familyColor}`,
            padding: "3px 8px",
            borderRadius: "3px",
            letterSpacing: "0.4px",
          }}
        >
          full pattern →
        </Link>
      </header>

      <p
        style={{
          fontSize: "12px",
          color: "var(--qgi-text-muted)",
          margin: "2px 0 16px",
          lineHeight: 1.5,
        }}
      >
        What the precedent shape <em>looks like</em> — the trajectory countries need to
        follow to score high on this recipe. Mean across verified positives in{" "}
        <strong>bold</strong>; the band shows 25th–75th percentile.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {indicators.map((ind) => {
          const shape = shapeByCode.get(ind.code);
          return (
            <IndicatorShape
              key={ind.code}
              indicator={ind}
              shape={shape}
              familyColor={familyColor}
              windowYears={windowYears}
            />
          );
        })}
      </div>

      <footer
        style={{
          marginTop: "14px",
          paddingTop: "10px",
          borderTop: "1px dashed var(--qgi-border)",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          color: "var(--qgi-text-dim)",
          letterSpacing: "0.3px",
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "16px",
              height: "2px",
              background: familyColor,
              display: "inline-block",
            }}
          />
          mean trajectory
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "16px",
              height: "8px",
              background: familyColor,
              opacity: 0.18,
              display: "inline-block",
              border: `1px solid ${familyColor}55`,
            }}
          />
          25th–75th percentile
        </span>
        <span style={{ marginLeft: "auto" }}>z-score, year-0 = event year</span>
      </footer>
    </section>
  );
}

function IndicatorShape({
  indicator,
  shape,
  familyColor,
  windowYears,
}: {
  indicator: AlignmentIndicator;
  shape: AlignmentShape | undefined;
  familyColor: string;
  windowYears: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: "12px",
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "0.8px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "2px",
            textTransform: "uppercase",
          }}
        >
          {indicator.provider}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--qgi-text)",
            fontWeight: 600,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={indicator.name}
        >
          {indicator.name}
        </div>
        <code
          style={{
            fontSize: "9.5px",
            color: "var(--qgi-text-muted)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {indicator.code}
        </code>
      </div>
      <ShapeSparkline shape={shape} familyColor={familyColor} windowYears={windowYears} />
    </div>
  );
}

function ShapeSparkline({
  shape,
  familyColor,
  windowYears,
}: {
  shape: AlignmentShape | undefined;
  familyColor: string;
  windowYears: number;
}) {
  if (!shape || shape.mean.length === 0) {
    return (
      <div
        style={{
          height: "52px",
          border: "1px dashed var(--qgi-border)",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          color: "var(--qgi-text-dim)",
          fontStyle: "italic",
        }}
      >
        shape pending walk
      </div>
    );
  }

  const W = 360;
  const H = 56;
  const padT = 6;
  const padB = 14;
  const padL = 4;
  const padR = 4;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const N = shape.mean.length;
  const all = [...shape.mean, ...shape.p25, ...shape.p75];
  const rawMax = Math.max(...all);
  const rawMin = Math.min(...all);
  const absMax = Math.max(Math.abs(rawMax), Math.abs(rawMin), 1.0);
  const maxY = absMax + 0.2;
  const minY = -absMax - 0.2;

  const xFor = (i: number) => padL + (i / Math.max(1, N - 1)) * innerW;
  const yFor = (v: number) => padT + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const bandTop = shape.p75
    .map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(" ");
  const bandBottom = shape.p25
    .map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
    .reverse()
    .join(" ");
  const bandPolyPoints = `${bandTop} ${bandBottom}`;

  const meanPath = shape.mean
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Canonical movement shape sparkline"
      style={{ display: "block" }}
    >
      <line
        x1={padL}
        x2={padL + innerW}
        y1={yFor(0)}
        y2={yFor(0)}
        stroke="var(--qgi-border)"
        strokeDasharray="2 3"
        strokeWidth={0.5}
      />
      <polygon points={bandPolyPoints} fill={familyColor} opacity={0.16} />
      <polyline
        points={shape.p75
          .map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
          .join(" ")}
        fill="none"
        stroke={familyColor}
        opacity={0.35}
        strokeWidth={0.8}
      />
      <polyline
        points={shape.p25
          .map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
          .join(" ")}
        fill="none"
        stroke={familyColor}
        opacity={0.35}
        strokeWidth={0.8}
      />
      <path
        d={meanPath}
        fill="none"
        stroke={familyColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={padL + innerW}
        x2={padL + innerW}
        y1={padT}
        y2={padT + innerH}
        stroke="var(--qgi-text-dim)"
        strokeDasharray="1 2"
        strokeWidth={0.6}
      />
      <text
        x={padL}
        y={H - 3}
        fontSize="8"
        fill="var(--qgi-text-dim)"
        fontFamily="ui-monospace, monospace"
      >
        t−{windowYears}y
      </text>
      <text
        x={padL + innerW}
        y={H - 3}
        fontSize="8"
        fill="var(--qgi-text-dim)"
        fontFamily="ui-monospace, monospace"
        textAnchor="end"
      >
        event
      </text>
    </svg>
  );
}
