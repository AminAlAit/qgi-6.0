import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArticleJsonLd } from "@/components/seo/ArticleJsonLd";

/**
 * Ghana's Double Signal — R7 commission → Daniel Mensah draft → Helena
 * Marchetti edit verdict (PUBLISH-AFTER-EDITS, V3) → engineering pass.
 *
 * Flow: R7 commission → daniel-v1 → daniel-v2 → helena-edit-verdict
 * (B+ / A−, 27/30) → daniel-v3 (helena edits applied) → helena ratify
 * (content-approved, ready for engineering pass) → this file.
 *
 * QGI April 2026 bake (generated 2026-04-30, V1.9.1).
 * Ghana Elections & Voting: 99/100 [CI 97–100], LOCO AUC 0.711.
 * Closest structural peer: Mauritania at 99% cosine on L1 dims A/D/F.
 * All salience numbers hardcoded against the 2026-04-30 bake.
 */

const BAKE_DATE = "2026-04-30";
const PUBLISH_DATE = "2026-05-19";

// ─── Chart data constants ─────────────────────────────────────────────────────

/** Chart 1: Elections & Voting and Military Coup salience z-scores per tier window */
const SALIENCE_BARS_DATA = [
  {
    window: "S",
    label: "Short",
    elections: 1.56,
    coup: 1.39,
  },
  {
    window: "M",
    label: "Medium",
    elections: 1.9,
    coup: 1.42,
  },
  {
    window: "L",
    label: "Long",
    elections: 2.76,
    coup: 0.8,
    highlight: true,
  },
  {
    window: "XL",
    label: "Extra-Long",
    elections: 2.38,
    coup: null,
  },
] as const;

/** Chart 2: Per-dimension L1 salience — Ghana vs Mauritania */
const L1_DIMENSIONS = [
  { id: "A", label: "Political", ghana: 1.66, mauritania: 1.05 },
  { id: "B", label: "Conflict", ghana: 0, mauritania: 0 },
  { id: "C", label: "Governance", ghana: 0, mauritania: 0 },
  { id: "D", label: "Economic", ghana: 1.01, mauritania: 0.64 },
  { id: "E", label: "Social", ghana: 0.24, mauritania: 0.18 },
  { id: "F", label: "Diplomatic", ghana: 0.5, mauritania: 0.5 },
  { id: "G", label: "Humanitarian", ghana: 0, mauritania: 0.32 },
  { id: "H", label: "Structural", ghana: 0, mauritania: 0.03 },
] as const;

/** Chart 3: IMF ECF event markers + QGI Economic L1 salience bake-series */
const IMF_ECF_MARKERS: Array<{
  year: number;
  label: string;
  debtGdp: number;
  event?: boolean;
}> = [
  { year: 2018, label: "Pre-programme", debtGdp: 57.9 },
  { year: 2019, label: "", debtGdp: 62.4 },
  { year: 2020, label: "COVID shock", debtGdp: 76.7 },
  { year: 2021, label: "", debtGdp: 81.1 },
  { year: 2022, label: "Sovereign default (Dec 2022)", debtGdp: 93.5, event: true },
  { year: 2023, label: "ECF entry (May 2023)", debtGdp: 88.2, event: true },
  { year: 2024, label: "ECF 2nd review", debtGdp: 79.1, event: true },
  { year: 2025, label: "ECF 3rd review", debtGdp: 74.3, event: true },
];

/** Chart 4: Ghana L1 8-dim profile — fallback to labeled bar chart */
const RADAR_DATA = [
  { id: "A", label: "Political Power\n& Regime", value: 1.66 },
  { id: "B", label: "Conflict &\nInsurgency", value: 0 },
  { id: "C", label: "Governance\n& Rule of Law", value: 0 },
  { id: "D", label: "Economic &\nFinancial Stress", value: 1.01 },
  { id: "E", label: "Social\n& Civil Unrest", value: 0.24 },
  { id: "F", label: "Diplomatic &\nGeopolitical", value: 0.5 },
  { id: "G", label: "Humanitarian\n& Displacement", value: 0 },
  { id: "H", label: "Structural\nVulnerability", value: 0 },
] as const;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:
    "Ghana's Double Signal: The Ballot Box, the Barracks, and the Country Nobody Expected — QGI Blog",
  description:
    "QGI places Ghana at the 99th percentile of global election-stress in its April 2026 bake. Its closest structural analogue is not Burkina Faso — it is Mauritania. That comparison is the story.",
  alternates: {
    canonical: "https://qgintelligence.com/blog/ghana-mauritania-mirror",
  },
  openGraph: {
    title:
      "Ghana's Double Signal: The Ballot Box, the Barracks, and the Country Nobody Expected",
    description:
      "QGI places Ghana at the 99th percentile of global election-stress. Its closest structural peer is Mauritania at 99% cosine similarity — not Mali, not Burkina Faso. What that structural resemblance means.",
    url: "https://qgintelligence.com/blog/ghana-mauritania-mirror",
    siteName: "QGI Intelligence",
    type: "article",
    publishedTime: `${PUBLISH_DATE}T00:00:00Z`,
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "QGI Intelligence — Quantitative Geopolitical Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Ghana's Double Signal: The Ballot Box, the Barracks, and the Country Nobody Expected",
    description:
      "Ghana is at the 99th percentile of global election-stress. Its structural analogue is Mauritania. That comparison is the story.",
  },
  robots: { index: true, follow: true },
};

// ─── Inline SVG chart components ─────────────────────────────────────────────

/** Chart 1 — Grouped horizontal bars: Elections & Voting vs Military Coup across S/M/L/XL windows */
function SalienceBarChart() {
  const maxVal = 3;
  const barH = 14;
  const groupGap = 32;
  const barGap = 4;
  const labelW = 52;
  const chartW = 400;
  const svgH = SALIENCE_BARS_DATA.length * (barH * 2 + barGap + groupGap) + 20;

  return (
    <figure
      id="ghana-election-coup-salience-bars"
      className="my-8"
      style={{ maxWidth: "100%", overflowX: "auto" }}
    >
      <svg
        viewBox={`0 0 ${labelW + chartW + 8} ${svgH}`}
        width="100%"
        aria-label="Grouped horizontal bar chart showing Ghana salience z-scores for Elections and Voting and Military Coup across S M L and XL tier windows"
        style={{ display: "block" }}
      >
        <title>
          Ghana: Elections &amp; Voting vs Military Coup salience z-scores by tier window
        </title>
        {SALIENCE_BARS_DATA.map((row, i) => {
          const y = i * (barH * 2 + barGap + groupGap) + 10;
          const electW = Math.round((row.elections / maxVal) * chartW);
          const coupW = row.coup != null ? Math.round((row.coup / maxVal) * chartW) : 0;
          const isHighlight = "highlight" in row && row.highlight;
          return (
            <g key={row.window}>
              {/* Window label */}
              <text
                x={labelW - 6}
                y={y + barH - 2}
                textAnchor="end"
                fontSize="11"
                fontFamily="var(--font-data, monospace)"
                fill="var(--qgi-text-dim)"
              >
                {row.window}-tier
              </text>
              {/* Elections & Voting bar */}
              <rect
                x={labelW}
                y={y}
                width={electW}
                height={barH}
                rx={2}
                fill={isHighlight ? "#a78bfa" : "rgba(167,139,250,0.65)"}
                aria-label={`Elections and Voting ${row.window} window z-score ${row.elections}`}
              />
              {isHighlight && (
                <text
                  x={labelW + electW + 4}
                  y={y + barH - 3}
                  fontSize="10"
                  fontFamily="var(--font-data, monospace)"
                  fill="#a78bfa"
                  fontWeight="600"
                >
                  {row.elections}σ ▲ peak
                </text>
              )}
              {!isHighlight && (
                <text
                  x={labelW + electW + 4}
                  y={y + barH - 3}
                  fontSize="10"
                  fontFamily="var(--font-data, monospace)"
                  fill="rgba(167,139,250,0.85)"
                >
                  {row.elections}σ
                </text>
              )}
              {/* Military Coup bar */}
              {row.coup != null ? (
                <>
                  <rect
                    x={labelW}
                    y={y + barH + barGap}
                    width={coupW}
                    height={barH}
                    rx={2}
                    fill="rgba(251,191,36,0.7)"
                    aria-label={`Military Coup ${row.window} window z-score ${row.coup}`}
                  />
                  <text
                    x={labelW + coupW + 4}
                    y={y + barH + barGap + barH - 3}
                    fontSize="10"
                    fontFamily="var(--font-data, monospace)"
                    fill="rgba(251,191,36,0.9)"
                  >
                    {row.coup}σ
                  </text>
                </>
              ) : (
                <text
                  x={labelW + 4}
                  y={y + barH + barGap + barH - 3}
                  fontSize="10"
                  fontFamily="var(--font-data, monospace)"
                  fill="var(--qgi-text-muted)"
                >
                  — not in top tier
                </text>
              )}
            </g>
          );
        })}
        {/* Legend */}
        <g transform={`translate(${labelW}, ${svgH - 14})`}>
          <rect x={0} y={0} width={10} height={10} rx={2} fill="rgba(167,139,250,0.85)" />
          <text
            x={14}
            y={9}
            fontSize="10"
            fill="var(--qgi-text-dim)"
            fontFamily="sans-serif"
          >
            Elections &amp; Voting
          </text>
          <rect x={130} y={0} width={10} height={10} rx={2} fill="rgba(251,191,36,0.7)" />
          <text
            x={144}
            y={9}
            fontSize="10"
            fill="var(--qgi-text-dim)"
            fontFamily="sans-serif"
          >
            Military Coup
          </text>
        </g>
      </svg>
      <figcaption
        className="mt-2 text-xs leading-relaxed"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Ghana salience z-scores — Elections &amp; Voting vs Military Coup across tier
        windows. L-tier peak (2.76σ) highlighted. Military Coup absent from XL top tier.
        Source: country-risks.json, April 2026 bake (QGI V1.9.1).
      </figcaption>
    </figure>
  );
}

/** Chart 2 — Grouped bar chart: per-dimension L1 salience, Ghana vs Mauritania */
function L1ComparisonChart() {
  const maxVal = 2.0;
  const barW = 22;
  const barGap = 3;
  const groupGap = 16;
  const labelH = 38;
  const chartH = 200;
  const svgW = L1_DIMENSIONS.length * (barW * 2 + barGap + groupGap) + groupGap + 20;

  return (
    <figure
      id="ghana-l1-vs-mauritania"
      className="my-8"
      style={{ maxWidth: "100%", overflowX: "auto" }}
    >
      <svg
        viewBox={`0 0 ${svgW} ${chartH + labelH + 20}`}
        width="100%"
        aria-label="Grouped bar chart comparing per-dimension L1 salience for Ghana and Mauritania across 8 dimensions"
        style={{ display: "block" }}
      >
        <title>Per-dimension L1 salience: Ghana vs Mauritania (April 2026 bake)</title>
        {L1_DIMENSIONS.map((dim, i) => {
          const x = groupGap + i * (barW * 2 + barGap + groupGap);
          const ghanaH = Math.round((dim.ghana / maxVal) * chartH);
          const mauH = Math.round((dim.mauritania / maxVal) * chartH);
          const isActive = dim.id === "A" || dim.id === "D" || dim.id === "F";
          return (
            <g key={dim.id}>
              {/* Ghana bar */}
              <rect
                x={x}
                y={chartH - ghanaH}
                width={barW}
                height={ghanaH || 2}
                rx={2}
                fill={isActive ? "#a78bfa" : "rgba(167,139,250,0.35)"}
                aria-label={`Ghana dimension ${dim.id} salience ${dim.ghana}`}
              />
              {dim.ghana > 0 && (
                <text
                  x={x + barW / 2}
                  y={chartH - ghanaH - 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="var(--font-data, monospace)"
                  fill={isActive ? "#a78bfa" : "rgba(167,139,250,0.6)"}
                >
                  {dim.ghana}
                </text>
              )}
              {/* Mauritania bar */}
              <rect
                x={x + barW + barGap}
                y={chartH - mauH}
                width={barW}
                height={mauH || 2}
                rx={2}
                fill={isActive ? "#fbbf24" : "rgba(251,191,36,0.3)"}
                aria-label={`Mauritania dimension ${dim.id} salience ${dim.mauritania}`}
              />
              {dim.mauritania > 0 && (
                <text
                  x={x + barW + barGap + barW / 2}
                  y={chartH - mauH - 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="var(--font-data, monospace)"
                  fill={isActive ? "#fbbf24" : "rgba(251,191,36,0.55)"}
                >
                  {dim.mauritania}
                </text>
              )}
              {/* Dimension label */}
              <text
                x={x + barW}
                y={chartH + 12}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-data, monospace)"
                fontWeight={isActive ? "700" : "400"}
                fill={isActive ? "var(--qgi-text)" : "var(--qgi-text-dim)"}
              >
                {dim.id}
              </text>
              <text
                x={x + barW}
                y={chartH + 26}
                textAnchor="middle"
                fontSize="9"
                fontFamily="sans-serif"
                fill="var(--qgi-text-dim)"
              >
                {dim.label}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <g transform={`translate(${groupGap}, ${chartH + labelH + 6})`}>
          <rect x={0} y={0} width={10} height={10} rx={2} fill="#a78bfa" />
          <text
            x={14}
            y={9}
            fontSize="10"
            fill="var(--qgi-text-dim)"
            fontFamily="sans-serif"
          >
            Ghana
          </text>
          <rect x={64} y={0} width={10} height={10} rx={2} fill="#fbbf24" />
          <text
            x={78}
            y={9}
            fontSize="10"
            fill="var(--qgi-text-dim)"
            fontFamily="sans-serif"
          >
            Mauritania
          </text>
          <text
            x={160}
            y={9}
            fontSize="9"
            fill="var(--qgi-text-muted)"
            fontFamily="sans-serif"
          >
            Bold = shared active dims (A / D / F)
          </text>
        </g>
      </svg>
      <figcaption
        className="mt-2 text-xs leading-relaxed"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Per-dimension L1 salience: Ghana vs Mauritania. Shared active dimensions A
        (Political Power &amp; Regime), D (Economic &amp; Financial Stress), and F
        (Diplomatic &amp; Geopolitical Relations) account for 99% of the cosine match
        (Political 66%, Economic 24%, Diplomatic 9%). Source: country-risks.json, April
        2026 bake.
      </figcaption>
    </figure>
  );
}

/** Chart 3 — Line + event markers: Ghana public debt/GDP 2018–2025 + ECF milestones */
function FiscalTrajectoryChart() {
  const paddingL = 44;
  const paddingR = 16;
  const paddingT = 16;
  const paddingB = 28;
  const svgW = 560;
  const svgH = 220;
  const chartW = svgW - paddingL - paddingR;
  const chartH = svgH - paddingT - paddingB;

  const years = IMF_ECF_MARKERS.map((d) => d.year);
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const minDebt = 50;
  const maxDebt = 100;

  const xScale = (year: number) =>
    paddingL + ((year - minYear) / (maxYear - minYear)) * chartW;
  const yScale = (val: number) =>
    paddingT + chartH - ((val - minDebt) / (maxDebt - minDebt)) * chartH;

  const pathD = IMF_ECF_MARKERS.map((d, i) => {
    const px = xScale(d.year);
    const py = yScale(d.debtGdp);
    return `${i === 0 ? "M" : "L"} ${px} ${py}`;
  }).join(" ");

  return (
    <figure
      id="ghana-imf-fiscal-trajectory"
      className="my-8"
      style={{ maxWidth: "100%", overflowX: "auto" }}
    >
      <svg
        viewBox={`0 0 ${svgW} ${svgH + 36}`}
        width="100%"
        aria-label="Line chart showing Ghana public debt as percentage of GDP from 2018 to 2025 with IMF ECF program event markers"
        style={{ display: "block" }}
      >
        <title>Ghana public debt/GDP 2018–2025 with IMF ECF event markers</title>

        {/* Y-axis gridlines */}
        {[60, 70, 80, 90, 100].map((v) => (
          <g key={v}>
            <line
              x1={paddingL}
              y1={yScale(v)}
              x2={paddingL + chartW}
              y2={yScale(v)}
              stroke="var(--qgi-border)"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
            <text
              x={paddingL - 4}
              y={yScale(v) + 4}
              textAnchor="end"
              fontSize="9"
              fontFamily="var(--font-data, monospace)"
              fill="var(--qgi-text-dim)"
            >
              {v}%
            </text>
          </g>
        ))}

        {/* Trigger-watch window shading: Q3 2026 watch zone */}
        <rect
          x={xScale(2025.5)}
          y={paddingT}
          width={xScale(2026) - xScale(2025.5)}
          height={chartH}
          fill="rgba(167,139,250,0.08)"
        />
        <text
          x={xScale(2025.75)}
          y={paddingT + 10}
          textAnchor="middle"
          fontSize="8"
          fontFamily="sans-serif"
          fill="rgba(167,139,250,0.6)"
        >
          Watch window
        </text>

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Event markers and year labels */}
        {IMF_ECF_MARKERS.map((d) => {
          const px = xScale(d.year);
          const py = yScale(d.debtGdp);
          return (
            <g key={d.year}>
              <circle
                cx={px}
                cy={py}
                r={d.event ? 5 : 3}
                fill={d.event ? "#fbbf24" : "#a78bfa"}
                stroke="var(--qgi-bg)"
                strokeWidth="1.5"
                aria-label={`${d.year}: debt/GDP ${d.debtGdp}%${d.event ? " — " + d.label : ""}`}
              />
              {d.event && d.label && (
                <text
                  x={px}
                  y={py - 9}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="sans-serif"
                  fill="#fbbf24"
                >
                  {d.label}
                </text>
              )}
              <text
                x={px}
                y={paddingT + chartH + 14}
                textAnchor="middle"
                fontSize="9"
                fontFamily="var(--font-data, monospace)"
                fill="var(--qgi-text-dim)"
              >
                {d.year}
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text
          x={8}
          y={paddingT + chartH / 2}
          textAnchor="middle"
          fontSize="9"
          fontFamily="sans-serif"
          fill="var(--qgi-text-muted)"
          transform={`rotate(-90, 8, ${paddingT + chartH / 2})`}
        >
          Debt / GDP %
        </text>

        {/* Legend */}
        <g transform={`translate(${paddingL}, ${svgH + 16})`}>
          <circle cx={5} cy={5} r={5} fill="#fbbf24" />
          <text
            x={14}
            y={9}
            fontSize="9"
            fill="var(--qgi-text-dim)"
            fontFamily="sans-serif"
          >
            ECF milestone (IMF program docs — not QGI data)
          </text>
          <circle cx={240} cy={5} r={3} fill="#a78bfa" />
          <text
            x={250}
            y={9}
            fontSize="9"
            fill="var(--qgi-text-dim)"
            fontFamily="sans-serif"
          >
            Debt/GDP datapoint (IMF Article IV historical)
          </text>
        </g>
      </svg>
      <figcaption
        className="mt-2 text-xs leading-relaxed"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Ghana public debt/GDP 2018–2025 (historical, IMF Article IV consultation series)
        with ECF program event markers. No IMF forward projections are included. ECF event
        markers derive from IMF program documentation, not QGI-computed data. Six-month
        trigger watch window (May–November 2026) shaded.
      </figcaption>
    </figure>
  );
}

/** Chart 4 — 8-row labeled bar chart: Ghana L1 risk profile (radar fallback) */
function L1ProfileChart() {
  const maxVal = 2.0;
  const barMaxW = 340;
  const labelW = 140;
  const rowH = 24;
  const rowGap = 6;
  const svgW = labelW + barMaxW + 80;
  const svgH = RADAR_DATA.length * (rowH + rowGap) + 30;

  return (
    <figure
      id="ghana-l1-profile-radar"
      className="my-8"
      style={{ maxWidth: "100%", overflowX: "auto" }}
    >
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        aria-label="Horizontal bar chart showing Ghana 8-dimension L1 risk profile from April 2026 bake"
        style={{ display: "block" }}
      >
        <title>Ghana 8-dimension L1 risk profile — April 2026 bake</title>

        {/* Reference line at global HIGH-tier median ~0.6 (illustrative) */}
        <line
          x1={labelW + Math.round((0.6 / maxVal) * barMaxW)}
          y1={0}
          x2={labelW + Math.round((0.6 / maxVal) * barMaxW)}
          y2={svgH - 20}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text
          x={labelW + Math.round((0.6 / maxVal) * barMaxW) + 3}
          y={10}
          fontSize="8"
          fontFamily="sans-serif"
          fill="rgba(255,255,255,0.3)"
        >
          HIGH-tier median
        </text>

        {RADAR_DATA.map((dim, i) => {
          const y = i * (rowH + rowGap) + 12;
          const barW = Math.round((dim.value / maxVal) * barMaxW);
          const isActive = dim.value > 0;
          return (
            <g key={dim.id}>
              {/* Dimension label */}
              <text
                x={labelW - 6}
                y={y + rowH / 2 + 4}
                textAnchor="end"
                fontSize="10"
                fontFamily="sans-serif"
                fill={isActive ? "var(--qgi-text)" : "var(--qgi-text-dim)"}
              >
                {dim.id}. {dim.label.replace("\n", " ")}
              </text>
              {/* Background track */}
              <rect
                x={labelW}
                y={y}
                width={barMaxW}
                height={rowH}
                rx={3}
                fill="rgba(255,255,255,0.03)"
              />
              {/* Value bar */}
              {isActive && (
                <rect
                  x={labelW}
                  y={y}
                  width={barW}
                  height={rowH}
                  rx={3}
                  fill={
                    dim.id === "A"
                      ? "#a78bfa"
                      : dim.id === "D"
                        ? "rgba(167,139,250,0.7)"
                        : dim.id === "F"
                          ? "rgba(167,139,250,0.5)"
                          : "rgba(167,139,250,0.35)"
                  }
                  aria-label={`Dimension ${dim.id} value ${dim.value}`}
                />
              )}
              {/* Value label */}
              <text
                x={isActive ? labelW + barW + 5 : labelW + 5}
                y={y + rowH / 2 + 4}
                fontSize="10"
                fontFamily="var(--font-data, monospace)"
                fill={isActive ? "rgba(167,139,250,0.9)" : "var(--qgi-text-muted)"}
              >
                {isActive ? dim.value.toFixed(2) : "0 — zero signal"}
              </text>
            </g>
          );
        })}

        {/* Annotation */}
        <text
          x={labelW}
          y={svgH - 6}
          fontSize="9"
          fontFamily="sans-serif"
          fill="rgba(167,139,250,0.55)"
          fontStyle="italic"
        >
          Political dominance + Economic stress — zero conflict signal. Mauritania 2008
          template, not Burkina Faso 2022.
        </text>
      </svg>
      <figcaption
        className="mt-2 text-xs leading-relaxed"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Ghana 8-dimension L1 risk profile, April 2026 bake. Dimensions A (Political Power
        &amp; Regime, 1.66), D (Economic &amp; Financial Stress, 1.01), and F (Diplomatic
        &amp; Geopolitical Relations, 0.50) are the three active dimensions that drive the
        Mauritania cosine match. Dashed reference line is the illustrative global
        HIGH-tier median. Source: country-risks.json, QGI V1.9.1.
      </figcaption>
    </figure>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function GhanaMauritaniaMirrorPage() {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <ArticleJsonLd
        headline="Ghana's Double Signal: The Ballot Box, the Barracks, and the Country Nobody Expected"
        description="QGI places Ghana at the 99th percentile of global election-stress in its April 2026 bake. Its closest structural analogue is not Burkina Faso — it is Mauritania."
        url="https://qgintelligence.com/blog/ghana-mauritania-mirror"
        datePublished={`${PUBLISH_DATE}T00:00:00Z`}
        imageUrl="https://qgintelligence.com/og-default.png"
        author={{ type: "Person", name: "Daniel Mensah" }}
      />

      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href={"/" as Route} className="flex items-baseline gap-1" title="Home">
            <span
              className="font-data text-sm tracking-[0.25em] font-semibold"
              style={{ color: "var(--qgi-accent)", marginRight: "-0.25em" }}
            >
              QG
            </span>
            <span
              className="text-[11px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Intelligence
            </span>
          </Link>
          <Link
            href={"/blog" as Route}
            className="text-xs tracking-wider uppercase"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            ← All posts
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        {/* Hero */}
        <div className="mb-8">
          <div
            className="text-[10px] tracking-widest uppercase mb-3 font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            Field note · Published {PUBLISH_DATE}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight mb-4">
            Ghana&apos;s Double Signal: The Ballot Box, the Barracks, and the Country
            Nobody Expected
          </h1>
          <p
            className="text-base sm:text-lg leading-relaxed mb-4"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            QGI places{" "}
            <Link
              href={"/countries/ghana" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Ghana
            </Link>{" "}
            at the 99th percentile of global election-stress in its April 2026 bake. Its
            closest structural analogue is not Burkina Faso — it is{" "}
            <Link
              href={"/countries/mauritania" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Mauritania
            </Link>
            . That comparison is the story.
          </p>
          <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            By Daniel Mensah · Bake date: {BAKE_DATE} · QGI V1.9.1
          </p>
        </div>

        <div
          className="prose-qgi text-sm sm:text-base leading-relaxed space-y-5"
          style={{ color: "var(--qgi-text)" }}
        >
          <p>
            The standard read on{" "}
            <Link
              href={"/countries/ghana" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Ghana
            </Link>{" "}
            is reassuring: functioning multiparty democracy, peaceful power transfer in
            December 2024, IMF program on track, ECOWAS anchor state. V-Dem, Freedom
            House, and Afrobarometer all point the same direction: Ghana is the exemplar
            of democratic consolidation in West Africa.
          </p>
          <p>
            QGI&apos;s April 2026 bake does not read the situation that way. Ghana&apos;s{" "}
            <Link
              href={"/precedents/elections_and_voting" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Elections &amp; Voting
            </Link>{" "}
            Precedent Match registers 99/100 [95% bootstrap CI: 97&ndash;100], placing it
            at the 99th percentile of a 131-country global cohort. Its top-salience risk
            category at the short-horizon window is not elections &mdash; it is Military
            Coup. And its closest structural analogue, at 99% cosine similarity on the
            8-dimension L1 risk profile, is not Mali or Burkina Faso or Niger. It is{" "}
            <Link
              href={"/countries/mauritania" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Mauritania
            </Link>
            .
          </p>

          {/* Section 1 */}
          <h2 id="signal" className="text-xl sm:text-2xl font-semibold mt-10 mb-3">
            1. The Signal &mdash; Two Numbers That Don&apos;t Belong Together
          </h2>
          <p>
            Ghana&apos;s{" "}
            <Link
              href={"/precedents/elections_and_voting" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Elections &amp; Voting
            </Link>{" "}
            score of 99/100 [CI 97&ndash;100] is not alarming in isolation.
            Elections-related structural stress is common in countries navigating economic
            transitions and competitive party politics; the signal at any given moment
            captures more than coup risk. The recipe&apos;s LOCO AUC of 0.711 (MODERATE
            evidence strength) and calibration error of 0.012 tell you it is a
            well-performing model &mdash; one of the more reliable in QGI&apos;s current
            validated set.
          </p>
          <p>
            What makes Ghana unusual is the tier-window progression. At the S-tier (short
            time-horizon window), Military Coup is Ghana&apos;s top-ranked risk category
            with a salience z-score of 1.39. Elections &amp; Voting is third. At the
            M-tier (medium window), Military Coup holds the top rank (salience 1.42);
            Elections &amp; Voting climbs to second (salience 1.14, z-score 1.90). At the
            L-tier (long window), Elections &amp; Voting surges to first &mdash; salience
            1.66, z-score 2.76 &mdash; with Military Coup holding second. At the XL-tier
            (longest window), Elections &amp; Voting dominates at z-score 2.38; Military
            Coup has dropped out of the top tier entirely.
          </p>

          <SalienceBarChart />

          <p>
            At short-horizon windows, the model is picking up coup-adjacent conditions as
            the dominant signal. At longer windows, the election-stress signature becomes
            primary. This is the structural fingerprint of a country where institutional
            stress is building across two timescales simultaneously &mdash; not a country
            with an acute crisis in one domain.
          </p>
          <p>
            QGI&apos;s composite risk score for Ghana is 68/100 [CI 60&ndash;75], Tier
            HIGH. The recipe-level breakdown from the current bake shows Elections &amp;
            Voting at 99/100, Multilateral Agreement at 73/100 [CI 55&ndash;90], and
            Bilateral Treaty at 27/100 [CI 19&ndash;34]. The wide CI on Multilateral
            Agreement reflects either model uncertainty or data-coverage thinness for
            Ghana&apos;s multilateral treaty history; either reading is consistent with
            the structural argument. Civil War and Insurgency produces a null result for
            Ghana &mdash; the model does not see conflict-state conditions. This is not
            the DRC profile. It is not the Sudan profile. The stress is specifically in
            the political-economy intersection where electoral legitimacy meets
            institutional fragility.
          </p>
          <p>
            The election-stress signal at the 99th percentile is available to any FT
            reader who follows Ghana. The simultaneous top-rank salience of Military Coup
            at short-horizon windows is what QGI adds. These two signals together
            constitute what I call the &ldquo;coup-by-election&rdquo; structural template:
            not a naked seizure of power, but a contested or destabilizing electoral
            outcome that becomes the pretext for military intervention. The framing
            matters because it points you toward a different historical template than the
            Burkina Faso or Mali junta model.
          </p>
          <p>
            A methodological note: the Military Coup category appears as top salience
            through a statistical classification layer within QGI&apos;s scoring engine,
            not from a dedicated LOCO-validated recipe. Ghana&apos;s four validated recipe
            scores are Elections &amp; Voting (99/100, LOCO AUC 0.711), Multilateral
            Agreement (73/100, LOCO AUC 0.869), Bilateral Treaty (27/100, LOCO AUC 0.668),
            and Civil War &amp; Insurgency (null). The Military Coup signal is
            directional, not model-validated. I am using it as a structural indicator, not
            as a forecast. The election-stress signal is the ML-validated load-bearing
            component; Military Coup is the contextual reinforcement.
          </p>

          {/* Section 2 */}
          <h2
            id="mauritania-mirror"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            2. The Mauritania Mirror &mdash; Why This Comparator Stops You
          </h2>

          <L1ComparisonChart />

          <p>
            QGI identifies{" "}
            <Link
              href={"/countries/mauritania" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Mauritania
            </Link>{" "}
            as Ghana&apos;s closest structural analogue, with a cosine similarity of 99%
            on the 8-dimension L1 risk profile. Political Power &amp; Regime accounts for
            66% of the cosine similarity, Economic &amp; Financial Stress for 24%, and
            Diplomatic &amp; Geopolitical Relations for 9%. The three shared active
            dimensions &mdash; A, D, and F in QGI&apos;s taxonomy &mdash; form the entire
            explanatory structure of the match. Ghana and Mauritania&apos;s risk
            fingerprints are not generally similar across all eight dimensions; they are
            precisely similar on the three dimensions that matter most for
            regime-political economy interactions.
          </p>
          <p>
            Mauritania does not appear on standard West Africa risk dashboards as a
            comparator for Ghana. The West Africa risk fraternity clusters Ghana
            comparisons around Senegal (similarly competitive electoral democracy),
            C&ocirc;te d&apos;Ivoire (larger Francophone economy), or, in the pessimistic
            register, Burkina Faso (post-2015 democratic fragility before the coups).
            Mauritania is off the standard mental map for Ghana analysis because the two
            countries sit in different subregional frames &mdash; Ghana Anglophone
            coastal, Mauritania Arabic-French Sahelian desert &mdash; and because their
            recent political trajectories appear to diverge. Ghana held credible elections
            in December 2024. Mauritania is run by a general-turned-president who came to
            power through a coup.
          </p>
          <p>
            That apparent divergence is exactly why the structural similarity is
            analytically interesting.
          </p>
          <p>
            In August 2008, General Mohamed Ould Abdel Aziz overthrew President Sidi Ould
            Cheikh Abdallahi &mdash; a civilian elected in 2007 in what international
            observers called Mauritania&apos;s most credible election to that point. The
            pretext was Abdallahi&apos;s attempt to dismiss officers loyal to Aziz. The AU
            condemned the coup and suspended Mauritania; the EU froze development
            assistance. In 2009, Aziz ran for president, won with 52% in a disputed but
            non-violently contested election, and was internationally recognized within
            months. His successor, Mohamed Ould Ghazouani, was his hand-picked former
            general.
          </p>
          <p>
            This is the &ldquo;soft coup with electoral normalization&rdquo; template. It
            differs from the Burkina Faso/Mali/Niger junta model in a structural way: the
            Mauritania template involves military intervention followed by electoral
            legitimation, not an indefinite suspension of the constitutional order. The
            coup leader runs for election and wins. The international community accepts
            the result, resets bilateral relations, and moves on. The AU deterrence
            mechanism, already weakened by the Sahel coups, was tested and passed the
            Mauritania case &mdash; in part because Aziz moved fast toward an electoral
            framework.
          </p>
          <p>
            The structural question for Ghana is not whether its military officer corps is
            currently planning a coup. Thirty years of civilian rule and the institutional
            memory of Rawlings-era interventions have created a genuine culture of
            military professionalism in the Ghana Armed Forces. The question is whether
            the cost-benefit calculus of intervention has shifted &mdash; whether the
            external deterrence that constrained the calculus has eroded, and whether the
            domestic conditions (fiscal deterioration, legitimacy stress, proximity to
            operational theaters) are accumulating.
          </p>
          <p>
            QGI&apos;s 99% cosine match with{" "}
            <Link
              href={"/countries/mauritania" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Mauritania
            </Link>{" "}
            says: the structural conditions that produce the soft-coup-with-normalization
            pattern are present in Ghana&apos;s indicator trajectory at a level of
            similarity the model finds historically meaningful. Mali and Burkina Faso
            offer the junta-with-no-timetable template &mdash; indefinite constitutional
            suspension, foreign security contractors, Russia-backed legitimation
            architecture. That is a different and more destabilizing outcome. The
            Mauritania template &mdash; intervention, quick elections, institutional
            continuity &mdash; is exactly the scenario where preventive engagement has the
            most leverage and the narrowest window. The distinction matters for policy
            more than it matters for risk scoring.
          </p>

          {/* Section 3 */}
          <h2 id="forward-call" className="text-xl sm:text-2xl font-semibold mt-10 mb-3">
            3. The Forward Call &mdash; A Six-Month Trigger, Not a Year Target
          </h2>
          <p>
            The forward call is an event-trigger window, not a calendar target. The
            structural stress QGI is measuring does not wait for election day &mdash; in
            the Mauritania analogue, it materialized in the 18 months <em>between</em> a
            credible election and a coup. The near-term trigger runs through the IMF
            Extended Credit Facility review cycle. Ghana entered the ECF in 2023 and is in
            its third review, with disbursements contingent on continued fiscal
            consolidation. The Mahama government inherited Bawumia&apos;s debt
            restructuring architecture and must sustain it against an NDC base that ran on
            relief from austerity.{" "}
            <strong>
              The six-month watch window is May&ndash;November 2026: if Ghana misses an
              ECF disbursement trigger or requests a substantial program modification,
              accompanied by public-sector wage arrears or fuel subsidy rollbacks, the
              fiscal-legitimacy stress will register in QGI&apos;s next bake cycle.
            </strong>{" "}
            That is the leading indicator.
          </p>

          <FiscalTrajectoryChart />

          <p>
            <strong>The falsification scenario.</strong> The call is off if the Mahama
            government navigates the third and fourth ECF reviews without significant
            program modification &mdash; and if ECOWAS reconstitutes a credible deterrence
            framework through the Accra Initiative, giving Ghanaian military officers a
            named reputational cost for intervention. Both conditions holding by November
            2026 would signal that QGI&apos;s L-tier election-stress peak has decayed
            before reaching the Mauritania threshold.
          </p>
          <p>
            The moderate form is most probable: not a junta, not a clean democratic
            handover, but a period of elevated civil-military tension where the
            military&apos;s role as a fiscal-crisis stabilizer becomes politically central
            &mdash; exercised through informal veto power over economic policy rather than
            an overt seizure of government. A disputed 2028 electoral outcome resolved
            through military mediation &mdash; the Mauritania 2009 pattern &mdash; would
            confirm this scenario. A coup before November 2026 would confirm the extreme
            form. A clean second electoral cycle with no institutional crisis would
            falsify it.
          </p>

          {/* Section 4 */}
          <h2 id="gaps" className="text-xl sm:text-2xl font-semibold mt-10 mb-3">
            4. What QGI Doesn&apos;t See &mdash; And Why the Case Still Holds
          </h2>
          <p>Three named gaps warrant disclosure.</p>
          <p>
            <strong>Foreign security presence.</strong> QGI&apos;s indicator base &mdash;
            World Bank development indicators, V-Dem electoral quality scores, SIPRI arms
            transfer data &mdash; cannot see informal private military company (PMC)
            approaches. Wagner Group / Africa Corps has operated in Burkina Faso, in the
            operational theater that borders Ghana&apos;s northern corridor directly. The
            commercial logic of PMC deployments (mining concession revenue in exchange for
            security services) maps precisely onto Ghana&apos;s gold-exporting economy.
            This is not an assertion that PMC discussions are occurring; it is an
            observation that QGI would not surface them if they were. Field knowledge has
            to carry this.
          </p>
          <p>
            <strong>AES bloc-level political coherence.</strong> Niger&apos;s Elections
            &amp; Voting score is 93/100, placing it #10 globally in the same recipe
            cohort as Ghana. Niger sits directly north of Ghana&apos;s northern corridor.
            The Alliance des &Eacute;tats du Sahel has explicitly positioned itself as a
            peer legitimacy-granting structure &mdash; a Ghanaian military government
            recognized by Bamako and Niamey would have a form of regional standing that
            did not exist before 2023. This bloc-level political reality is invisible to
            QGI&apos;s per-country scoring. It changes the expected consequences of a coup
            attempt from near-certain AU isolation (the 2008 Mauritania model) to a more
            ambiguous regional response.
          </p>
          <p>
            <strong>Civil society resilience.</strong>{" "}
            <Link
              href={"/countries/ghana" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Ghana
            </Link>
            &apos;s civil society &mdash; the Commission on Human Rights and
            Administrative Justice, the Ghana Centre for Democratic Development, the major
            media houses &mdash; proved robust during the 2008 election dispute, resolving
            a contested outcome within constitutional frameworks. QGI cannot measure
            institutional resilience directly; it measures indicator trajectories. The
            Mauritania analogue involved weaker civil society. This is the most important
            reason Ghana&apos;s structural risk, conditional on the indicator conditions
            being met, may be lower than the cosine similarity alone implies.
          </p>
          <p>
            Despite these gaps, the structural case holds because of what QGI can see: the
            deteriorating fiscal-political trajectory in Ghana&apos;s Economic &amp;
            Financial Stress dimension (salience 1.01 on the L1 profile), the Political
            Power &amp; Regime dimension at maximum salience in the current bake (1.66
            &mdash; the same dimension that accounts for 66% of the Ghana-Mauritania
            cosine match), and the election-stress recipe at the 99th percentile of a
            validated global cohort. The gaps do not negate the structural reading; they
            bound the probability and shape the intervention options.
          </p>

          <L1ProfileChart />

          {/* Methodology footnote */}
          <aside
            role="note"
            aria-label="Methodology footnote"
            className="my-8 rounded-lg p-5 text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              color: "var(--qgi-text-dim)",
              fontSize: "0.75rem",
            }}
          >
            <div
              className="text-[10px] tracking-widest uppercase font-semibold mb-3"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Methodology
            </div>
            <p className="mb-2">
              QGI data: Elections &amp; Voting Precedent Match 99/100 [CI 97&ndash;100]
              &middot; LOCO AUC 0.711 &middot; ECE 0.012 &middot; Cohort N=131 &middot;
              QGI Risk Score 68/100 [CI 60&ndash;75] &middot; Tier HIGH &middot; Political
              Power &amp; Regime L1 salience 1.66 (peak at L-tier window, z-score 2.76)
              &middot; Military Coup top salience at S-tier (z=1.39) and M-tier (z=1.42)
              &middot;{" "}
              <Link
                href={"/countries/mauritania" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Mauritania
              </Link>{" "}
              99% cosine peer (intersection-only cosine on shared active L1 dimensions
              A/D/F; Jaccard 0.75; composite similarity 74.3%) &middot; Per-dimension
              breakdown of cosine: Political Power &amp; Regime 66%, Economic &amp;
              Financial Stress 24%, Diplomatic &amp; Geopolitical Relations 9% &middot;
              Multilateral Agreement 73/100 [CI 55&ndash;90] &middot; Bilateral Treaty
              27/100 [CI 19&ndash;34] &middot; Civil War &amp; Insurgency: null &middot;
              April 2026 bake (generated {BAKE_DATE}) &middot; QGI V1.9.1 scoring.
            </p>
            <p className="mb-2">
              Methodology disclosures: (1) Military Coup salience derives from a
              statistical classification layer, not a dedicated LOCO-validated recipe.
              Treat as directional indicator, not model-validated output. The ML-validated
              load-bearing finding in this piece is the Elections &amp; Voting 99/100
              score. (2) The 99% cosine similarity cited is the intersection-only cosine
              on the three shared active L1 dimensions (A, D, F); the composite score
              (Jaccard &times; cosine) is 74.3%. The QGI countries page renders the cosine
              figure; this article uses the same metric. (3) ECF event markers in Chart 3
              derive from IMF program documentation (historical disbursement records), not
              QGI-computed data. Debt/GDP figures are from IMF Article IV consultation
              historical series. No IMF forward projections are incorporated in this
              piece. (4) The &ldquo;soft coup with electoral normalization&rdquo; template
              is an analyst classification of the Mauritanian precedent, not a
              QGI-generated category.
            </p>
            <p>
              See{" "}
              <Link
                href={"/methodology" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                QGI methodology
              </Link>{" "}
              for bake computation, salience definition, and cohort construction.
            </p>
          </aside>

          <p
            className="text-xs mt-12 pt-6 border-t"
            style={{
              color: "var(--qgi-text-dim)",
              borderColor: "var(--qgi-border)",
            }}
          >
            Published {PUBLISH_DATE} &middot; QGI Intelligence &middot; By Daniel Mensah
            &middot; Salience values cited from the {BAKE_DATE} V1.9.1 bake. This piece
            reports structural pattern resemblance and historical analogue comparison. It
            is not a forecast.
          </p>
        </div>
      </article>
    </div>
  );
}
