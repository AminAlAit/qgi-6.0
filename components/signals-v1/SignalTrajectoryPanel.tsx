"use client";

/**
 * SignalTrajectoryPanel — "How is this country's actual indicator data
 * moving, and how does it match the canonical fingerprint trajectory?"
 *
 * Persona design (Yuki Takahashi-Rowe + Dr. Lena Hadid-Marchetti, 2026-05-01):
 *
 *   Decision record:
 *   D1. 4 indicators (top-4 by TF-IDF) — fewer = scannable, and below rank 4
 *       you hit near-ubiquitous indicators that appear in 60%+ of ALL recipes
 *       and carry no discriminatory information (Lena's criterion, not Yuki's).
 *   D2. Z-score per series within the displayed window — raw values across
 *       Population/GDP/Mortality are 10 orders of magnitude apart; z-score is
 *       the only encoding that puts shape on screen.
 *   D3. X-axis: years-from-pattern-end (0 = last year of canonical window).
 *       Calendar years appear ONLY in tooltips. This lets the viewer see shape
 *       alignment without the distraction of calendar distance.
 *   D4. Subject observed = solid #38bdf8, subject predicted = dashed #6b7f96
 *       (--qgi-predicted, same token used in IndexChart). NOT two colors —
 *       a second color implies a second series, not a modality change.
 *   D5. Canonical reference = faint orange/amber at 0.25 opacity, no markers.
 *   D6. Small-multiples (2x2 grid) — not a multi-line chart. Every indicator
 *       has its own scale story; tangled lines kill dashboards.
 *   D7. Mobile: 1-column, show top-2, "Show all" expand.
 *   D8. Pearson r shown in each card header as "r = 0.87" — this IS the
 *       "why does the country score 0.76" payoff for each indicator.
 *   D9. <5 non-null observed points in window → "Insufficient data" card.
 *   D10. Athena fail → entire panel replaced by "Trajectory data unavailable".
 */

import { useState } from "react";
import ReactECharts from "echarts-for-react";
import type { TrajectoryPanelData, IndicatorTrajectory } from "@/lib/signals-trajectory";

interface Props {
  data: TrajectoryPanelData | null;
  countryName: string;
  eventCategory: string;
}

export function SignalTrajectoryPanel({ data, countryName, eventCategory }: Props) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Graceful degradation — Athena failed or returned nothing.
  if (!data || data.trajectories.length === 0) {
    return (
      <div
        className="rounded-lg border p-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Indicator Trajectories
        </div>
        <p className="text-[11px]" style={{ color: "var(--qgi-text-muted)" }}>
          Trajectory data unavailable — historical analogues above still apply. This panel
          requires a live Athena connection and may be suppressed during cold cache
          periods.
        </p>
      </div>
    );
  }

  const { trajectories, referenceCountryName, patternLength } = data;

  // Desktop: all 4. Mobile: top-2 unless expanded.
  const desktopItems = trajectories;
  const mobileItems = mobileExpanded ? trajectories : trajectories.slice(0, 2);

  const catLabel = eventCategory.replace(/_/g, " ");

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      {/* Panel header */}
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <div
          className="text-[10px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Indicator Trajectories
        </div>
        {referenceCountryName && (
          <div className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
            Canonical reference: {referenceCountryName} &nbsp;·&nbsp; {patternLength}yr
            window
          </div>
        )}
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--qgi-text-muted)" }}>
        How {countryName}&apos;s key indicators move relative to the canonical{" "}
        <span style={{ color: "var(--qgi-text)" }}>{catLabel}</span> pattern. X-axis:
        years from pattern end (0 = last year of window). Values are z-scored within the
        window for shape comparison.
      </p>

      {/* Desktop: 2×2 grid */}
      <div className="hidden md:grid md:grid-cols-2 gap-4">
        {desktopItems.map((traj) => (
          <TrajectoryCard key={traj.indicatorId} traj={traj} countryName={countryName} />
        ))}
      </div>

      {/* Mobile: single column, 2 shown + expand */}
      <div className="md:hidden flex flex-col gap-4">
        {mobileItems.map((traj) => (
          <TrajectoryCard key={traj.indicatorId} traj={traj} countryName={countryName} />
        ))}
        {!mobileExpanded && trajectories.length > 2 && (
          <button
            onClick={() => setMobileExpanded(true)}
            className="text-[10px] tracking-wider uppercase self-start mt-1"
            style={{ color: "var(--qgi-accent)" }}
          >
            Show all {trajectories.length} indicators
          </button>
        )}
      </div>

      {/* Legend */}
      <div
        className="mt-4 pt-3 text-[10px] flex flex-wrap gap-x-5 gap-y-1.5 items-center"
        style={{
          borderTop: "1px solid var(--qgi-border)",
          color: "var(--qgi-text-dim)",
        }}
      >
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6">
            <line x1="0" y1="3" x2="20" y2="3" stroke="#38bdf8" strokeWidth="2" />
          </svg>
          Observed
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6">
            <line
              x1="0"
              y1="3"
              x2="20"
              y2="3"
              stroke="#6b7f96"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          Predicted
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6">
            <line
              x1="0"
              y1="3"
              x2="20"
              y2="3"
              stroke="#fb923c"
              strokeWidth="2"
              opacity={0.35}
            />
          </svg>
          Canonical reference
        </span>
        <span style={{ color: "var(--qgi-text-dim)" }}>
          r = Pearson correlation with canonical trajectory
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single indicator mini-chart card
// ---------------------------------------------------------------------------

function TrajectoryCard({
  traj,
  countryName,
}: {
  traj: IndicatorTrajectory;
  countryName: string;
}) {
  // Truncate long names for the card header.
  const shortName =
    traj.indicatorName.length > 42
      ? traj.indicatorName.slice(0, 40) + "…"
      : traj.indicatorName;

  // No data for this country in the window (< 5 non-null points).
  if (!traj.hasData && !traj.hasCanonical) {
    return (
      <EmptyCard name={shortName} message={`No data available for ${countryName}`} />
    );
  }

  return (
    <div
      className="rounded border flex flex-col"
      style={{
        backgroundColor: "var(--qgi-bg)",
        borderColor: "var(--qgi-border)",
        minHeight: 220,
      }}
    >
      {/* Card header */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[11px] leading-tight font-medium flex-1 min-w-0"
            style={{ color: "var(--qgi-text-muted)" }}
            title={traj.indicatorName}
          >
            {shortName}
          </span>
          {traj.pearsonR !== null && (
            <span
              className="font-data text-[11px] font-semibold shrink-0"
              style={{
                color: rColor(traj.pearsonR),
              }}
              title="Pearson correlation between subject and canonical trajectories"
            >
              r = {traj.pearsonR.toFixed(2)}
            </span>
          )}
        </div>
        {!traj.hasData && traj.hasCanonical && (
          <div
            className="text-[9px] mt-0.5 tracking-wide"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {countryName} data insufficient — canonical only
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 px-1 pb-2">
        <TrajectoryChart traj={traj} countryName={countryName} />
      </div>
    </div>
  );
}

function EmptyCard({ name, message }: { name: string; message: string }) {
  return (
    <div
      className="rounded border flex flex-col items-center justify-center p-5 gap-2"
      style={{
        backgroundColor: "var(--qgi-bg)",
        borderColor: "var(--qgi-border)",
        borderStyle: "dashed",
        minHeight: 220,
      }}
    >
      <span
        className="text-[11px] text-center leading-tight"
        style={{ color: "var(--qgi-text-dim)" }}
        title={name}
      >
        {name}
      </span>
      <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
        {message}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ECharts line chart for one indicator
// ---------------------------------------------------------------------------

function TrajectoryChart({
  traj,
  countryName,
}: {
  traj: IndicatorTrajectory;
  countryName: string;
}) {
  // Build x-axis labels (years-from-end integers).
  const xLabels =
    traj.subject.length > 0
      ? traj.subject.map((p) => String(p.yearsFromEnd))
      : traj.canonical.map((p) => String(p.yearsFromEnd));

  // Split subject into observed and predicted segments.
  // ECharts handles two series on the same x-axis; the predicted segment
  // starts at the first point where isPredicted=true.
  const firstPredIdx = traj.subject.findIndex((p) => p.isPredicted);

  // Observed: all points up to (but not including) the first predicted index.
  const observedData = traj.subject.map((p, i) => {
    if (firstPredIdx >= 0 && i >= firstPredIdx) return null;
    return p.value;
  });

  // Predicted: null until the boundary, then the predicted tail.
  // We anchor it one point before the first predicted so there's no gap.
  const predictedData = traj.subject.map((p, i) => {
    if (firstPredIdx < 0) return null; // no predicted values at all
    if (i < firstPredIdx - 1) return null; // before anchor
    if (i === firstPredIdx - 1) return traj.subject[i].value; // anchor point
    return p.isPredicted ? p.value : null;
  });

  // Canonical data (aligned by yearsFromEnd).
  const canonicalData = xLabels.map((xLabel) => {
    const match = traj.canonical.find((c) => String(c.yearsFromEnd) === xLabel);
    return match?.value ?? null;
  });

  // Tooltip formatter: show calendarYear for subject, "Canonical" for reference.
  const subjectPoints = traj.subject;
  const refLabel = traj.referenceLabel;

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 10 },
      formatter: (
        params: Array<{
          seriesName: string;
          dataIndex: number;
          value: number | null;
        }>
      ) => {
        const idx = params[0]?.dataIndex ?? 0;
        const subj = subjectPoints[idx];
        const yearLabel = subj?.calendarYear != null ? ` (${subj.calendarYear})` : "";
        const lines = params
          .filter((p) => p.value != null)
          .map((p) => {
            const isCanonical = p.seriesName === "Canonical";
            const isPred = p.seriesName === "Predicted";
            const color = isCanonical ? "#fb923c" : isPred ? "#6b7f96" : "#38bdf8";
            const suffix = isCanonical
              ? ` — ${refLabel}`
              : isPred
                ? `${yearLabel} (Predicted by pipeline)`
                : yearLabel;
            return `<span style="color:${color}">${p.seriesName}${suffix}: ${
              p.value != null ? p.value.toFixed(2) + "σ" : "—"
            }</span>`;
          });
        return `<div style='font-family:monospace;font-size:10px'><div style='color:#8aa6be;font-size:9px;margin-bottom:2px'>Year ${xLabels[idx] ?? "?"} from pattern end</div>${lines.join("<br/>")}</div>`;
      },
    },
    grid: { top: 8, right: 8, bottom: 28, left: 42 },
    xAxis: {
      type: "category",
      data: xLabels,
      axisLine: { lineStyle: { color: "#243347" } },
      axisLabel: {
        color: "#8aa6be",
        fontSize: 8,
        interval: Math.floor(xLabels.length / 5),
        formatter: (val: string) => (val === "0" ? "0 ←end" : val),
      },
      splitLine: {
        show: true,
        lineStyle: { color: "#1a2a3a" },
      },
      // Mark the "0" position (pattern end) with a reference line.
    },
    yAxis: {
      type: "value",
      scale: true,
      name: "σ",
      nameTextStyle: { color: "#8aa6be", fontSize: 8 },
      axisLine: { lineStyle: { color: "#243347" } },
      splitLine: { lineStyle: { color: "#1a2a3a" } },
      axisLabel: { color: "#8aa6be", fontSize: 8 },
    },
    series: [
      // Canonical reference — faint amber overlay, no markers.
      // markLine on this series marks the pattern-end position (yearsFromEnd=0).
      {
        name: "Canonical",
        type: "line",
        data: canonicalData,
        lineStyle: { color: "#fb923c", width: 1.5, opacity: 0.3 },
        itemStyle: { color: "#fb923c", opacity: 0.3 },
        symbol: "none",
        connectNulls: false,
        z: 1,
        ...(xLabels.includes("0")
          ? {
              markLine: {
                silent: true,
                symbol: "none",
                lineStyle: { color: "#8aa6be", type: "dotted" as const, width: 1 },
                data: [{ xAxis: "0", name: "Pattern end" }],
                label: { show: false },
              },
            }
          : {}),
      },
      // Subject observed — solid electric blue.
      {
        name: countryName,
        type: "line",
        data: observedData,
        lineStyle: { color: "#38bdf8", width: 2 },
        itemStyle: { color: "#38bdf8" },
        symbol: "circle",
        symbolSize: 3,
        connectNulls: false,
        z: 3,
      },
      // Subject predicted — dashed muted blue-grey.
      ...(firstPredIdx >= 0
        ? [
            {
              name: "Predicted",
              type: "line" as const,
              data: predictedData,
              lineStyle: {
                color: "#6b7f96",
                width: 2,
                type: "dashed" as const,
              },
              itemStyle: { color: "#6b7f96" },
              symbol: "circle",
              symbolSize: 3,
              connectNulls: false,
              z: 2,
            },
          ]
        : []),
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 170, width: "100%" }}
      notMerge
      opts={{ renderer: "svg" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Color for Pearson r badge
// ---------------------------------------------------------------------------

function rColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return "var(--qgi-success)";
  if (abs >= 0.4) return "var(--qgi-amber)";
  return "var(--qgi-text-muted)";
}
