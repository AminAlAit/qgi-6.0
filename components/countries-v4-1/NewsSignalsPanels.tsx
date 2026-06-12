"use client";

/**
 * News-layer panels for the country page (HF merge step 2, 2026-06-10).
 *
 * NewsSignalsPanel — the country's six news themes as selectable chips
 * (verdict + pulse), with the selected theme's three-year pulse charted
 * against its verified event markers and the structural level.
 *
 * TopicDriftPanel — twelve months x six themes heatmap: how the news
 * profile has shifted, theme by theme.
 *
 * Both ride PanelShell (V4.1 idiom) and the ECharts theme tokens. echarts
 * loads behind next/dynamic so country pages without a visitor opening
 * these panels stay light.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { PanelShell } from "@/components/countries-v4-1/PanelShell";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { useTheme } from "@/lib/hooks/useTheme";
import { getEchartsTokens } from "@/lib/echarts-theme";
import type { HfVerdict } from "@/lib/hf/topics-data";
import type { HfCountryDetail, HfTopicSeries } from "@/lib/hf/pulse-detail";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const VERDICT_LABEL: Record<HfVerdict, string> = {
  ACTIVE: "Active",
  SIGNAL: "Signal",
  LATENT: "Latent",
  QUIET: "Quiet",
};

function verdictColor(v: HfVerdict): string {
  return v === "ACTIVE"
    ? "var(--qgi-warning)"
    : v === "SIGNAL"
      ? "var(--qgi-accent)"
      : v === "LATENT"
        ? "var(--qgi-text-muted)"
        : "var(--qgi-text-dim)";
}

/* ── News signals: theme chips + pulse-vs-events chart ───────────────── */

export function NewsSignalsPanel({ detail }: { detail: HfCountryDetail }) {
  // Default to the strongest reading: validated topics first, weakest-leg.
  const initial = useMemo(() => {
    let best: HfTopicSeries | null = null;
    const legs = (s: HfTopicSeries) =>
      s.cell ? Math.min(s.cell.struct ?? 0, s.cell.pulse) : -1;
    for (const s of detail.series) {
      if (
        best === null ||
        (s.topic.validated && !best.topic.validated) ||
        (s.topic.validated === best.topic.validated && legs(s) > legs(best))
      ) {
        best = s;
      }
    }
    return best?.topic.id ?? detail.series[0]?.topic.id;
  }, [detail]);
  const [topicId, setTopicId] = useState(initial);

  const sel = detail.series.find((s) => s.topic.id === topicId) ?? detail.series[0];

  return (
    <PanelShell
      title="News signals"
      accent="var(--qgi-accent)"
      tooltip="News pulse is a monthly index of how much of this country's news coverage is on a theme. 50 is the country's own long-run normal; 60 and above counts as elevated. The verdict combines that pulse with the structural resemblance behind the theme."
      caption={
        <>
          What the news is amplifying for {detail.name} right now. Select a theme to see
          its three-year pulse against the events on the record.
        </>
      }
      fullWidth
    >
      {/* Theme chips */}
      <div
        role="group"
        aria-label="News themes"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginBottom: "12px",
        }}
      >
        {detail.series.map((s) => {
          const active = s.topic.id === topicId;
          const v = s.cell?.verdict ?? "QUIET";
          return (
            <button
              key={s.topic.id}
              type="button"
              onClick={() => setTopicId(s.topic.id)}
              aria-pressed={active}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "3px",
                padding: "8px 12px",
                minWidth: "108px",
                background: active ? "var(--qgi-surface-2)" : "var(--qgi-bg)",
                border: "1px solid var(--qgi-border)",
                borderRadius: "6px",
                cursor: "pointer",
                boxShadow: active ? "inset 0 0 0 1px var(--qgi-accent)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: active ? "var(--qgi-text)" : "var(--qgi-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {s.topic.validated ? "▲ " : ""}
                {s.topic.label}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: "6px",
                  fontSize: "10.5px",
                }}
              >
                <span style={{ color: verdictColor(v), fontWeight: 600 }}>
                  {VERDICT_LABEL[v]}
                </span>
                <span
                  className="font-data"
                  style={{ color: "var(--qgi-text-dim)", fontSize: "11px" }}
                >
                  {s.cell ? Math.round(s.cell.pulse) : "–"}
                  <span style={{ opacity: 0.55 }}>/100</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {sel && <PulseEventsChart series={sel} thresholds={detail.thresholds} />}

      {/* Verdict legend — the country page carries the explanatory arc, so
          the four states are defined here (the terminal may assume them). */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
          marginTop: "12px",
          fontSize: "11px",
          color: "var(--qgi-text-muted)",
        }}
      >
        {(Object.keys(detail.verdicts) as HfVerdict[]).map((v) => (
          <span
            key={v}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: verdictColor(v),
              }}
            />
            {VERDICT_LABEL[v]}
            <InfoTooltip text={detail.verdicts[v]} />
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <Link
          href={"/methodology#news-layer" as Route}
          target="_blank"
          rel="noopener"
          style={{ color: "var(--qgi-accent)", textDecoration: "none", fontSize: "11px" }}
        >
          How verdicts are assigned →
        </Link>
      </div>

      <p
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          margin: "10px 0 0",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.3px",
        }}
      >
        Themes marked ▲ carry a validated news lead of about two months. Event markers
        come from the verified record.
      </p>
    </PanelShell>
  );
}

function PulseEventsChart({
  series,
  thresholds,
}: {
  series: HfTopicSeries;
  thresholds: { struct: number; pulse: number };
}) {
  const { isDark } = useTheme();
  const t = getEchartsTokens(isDark);
  const struct = series.cell?.struct ?? null;

  const markers = series.events
    .map((e) => {
      const i = series.months.indexOf(e.date);
      return i < 0 ? null : { coord: [e.date, series.pulse[i]], label: e.label };
    })
    .filter(Boolean) as Array<{ coord: [string, number]; label: string }>;

  const option = {
    backgroundColor: "transparent",
    animation: false,
    tooltip: {
      trigger: "axis",
      // Render on document.body so the popup can never be squeezed or cut
      // at a panel border (founder catch 2026-06-11; ECharts analog of the
      // #567 InfoTooltip position:fixed fix).
      appendToBody: true,
      confine: true,
      backgroundColor: t.surface2,
      borderColor: t.border,
      textStyle: { color: t.text, fontSize: 11 },
      formatter: (ps: Array<{ axisValue: string; data: number; seriesName: string }>) => {
        const p = ps[0];
        const ev = series.events.find((e) => e.date === p.axisValue);
        return (
          `${p.axisValue}<br/>news pulse ${Math.round(p.data)}` +
          (struct !== null ? `<br/>structural ${Math.round(struct)}` : "") +
          (ev ? `<br/><span style="color:${t.amber}">${ev.label}</span>` : "")
        );
      },
    },
    legend: {
      top: 2,
      right: 6,
      textStyle: { color: t.textMuted, fontSize: 10 },
      data: ["News pulse", "Structural"],
    },
    grid: { left: 42, right: 16, top: 28, bottom: 26 },
    xAxis: {
      type: "category",
      data: series.months,
      boundaryGap: false,
      axisLine: { lineStyle: { color: t.border } },
      axisTick: { show: false },
      axisLabel: {
        color: t.textDim,
        fontSize: 10,
        interval: 5,
        formatter: (v: string) => v.slice(2),
      },
    },
    yAxis: {
      min: 0,
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: t.splitLine, opacity: 0.5 } },
      axisLabel: { color: t.textDim, fontSize: 10 },
    },
    series: [
      {
        name: "News pulse",
        type: "line",
        data: series.pulse,
        symbol: "none",
        lineStyle: { width: 1.8, color: t.accent },
        areaStyle: { color: `${t.accent}22` },
        markPoint: {
          symbol: "pin",
          symbolSize: 20,
          itemStyle: { color: t.surface2, borderColor: t.amber, borderWidth: 1.5 },
          label: { show: false },
          // No emphasis label: the axis tooltip names the event on a pinned
          // month; a second box duplicating it reads as a bug (founder catch).
          emphasis: { disabled: true },
          data: markers.map((m) => ({ coord: m.coord, value: m.label })),
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.textDim, type: "dashed", width: 1 },
          label: {
            show: true,
            position: "insideEndTop" as const,
            color: t.textDim,
            fontSize: 10,
            formatter: "elevated 60",
          },
          data: [{ yAxis: thresholds.pulse }],
        },
      },
      {
        name: "Structural",
        type: "line",
        data: series.months.map(() => struct),
        symbol: "none",
        // Series-level color so the legend swatch matches the line (without
        // it ECharts paints the key from its default palette).
        color: t.amber,
        itemStyle: { color: t.amber },
        lineStyle: { width: 1.6, type: "dashed", color: t.amber, opacity: 0.8 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "260px", width: "100%" }} />;
}

/* ── Topic drift: months x themes heatmap ────────────────────────────── */

export function TopicDriftPanel({
  detail,
  accent,
}: {
  detail: HfCountryDetail;
  accent: string;
}) {
  const { isDark } = useTheme();
  const t = getEchartsTokens(isDark);

  const months = detail.series[0]?.months.slice(-12) ?? [];
  const topics = detail.series.map((s) => s.topic.label);
  const cells: Array<[number, number, number]> = [];
  detail.series.forEach((s, ti) => {
    s.pulse.slice(-12).forEach((p, mi) => {
      cells.push([mi, ti, Math.round(p)]);
    });
  });

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      // Render on document.body so the popup can never be squeezed or cut
      // at a panel border (founder catch 2026-06-11; ECharts analog of the
      // #567 InfoTooltip position:fixed fix).
      appendToBody: true,
      confine: true,
      backgroundColor: t.surface2,
      borderColor: t.border,
      textStyle: { color: t.text, fontSize: 11 },
      formatter: (p: { value: [number, number, number] }) =>
        `${topics[p.value[1]]} · ${months[p.value[0]]}<br/>news pulse ${p.value[2]}`,
    },
    grid: { left: 110, right: 16, top: 28, bottom: 8 },
    xAxis: {
      type: "category",
      data: months,
      position: "top",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: t.textDim,
        fontSize: 10,
        formatter: (v: string) => v.slice(2),
      },
    },
    yAxis: {
      type: "category",
      data: topics,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { color: t.textMuted, fontSize: 11 },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 100,
      // Monotonic intensity in BOTH themes: dark brightens toward accent;
      // light must END on its darkest blue or mid values out-shade maxima.
      inRange: {
        color: isDark
          ? [t.surface, t.accentDim, t.accent]
          : [t.surface, t.accent, t.accentDim],
      },
    },
    series: [
      {
        type: "heatmap",
        data: cells,
        itemStyle: { borderColor: t.surface, borderWidth: 3, borderRadius: 3 },
        label: {
          show: true,
          fontSize: 10,
          fontFamily: "ui-monospace, monospace",
          color: isDark ? "#06131c" : "#ffffff",
          formatter: (p: { value: [number, number, number] }) =>
            p.value[2] >= 60 ? String(p.value[2]) : "",
        },
      },
    ],
  };

  return (
    <PanelShell
      title="Theme drift"
      accent={accent}
      tooltip="Each cell is one month's news pulse for one theme, against this country's own normal of 50. Bright cells are months the theme ran well above it; numbers appear from 60, the elevated mark."
      caption={
        <>
          How {detail.name}&apos;s news profile has shifted across the last twelve months,
          theme by theme.
        </>
      }
      fullWidth
    >
      <ReactECharts
        option={option}
        style={{ height: `${56 + detail.series.length * 38}px`, width: "100%" }}
      />
    </PanelShell>
  );
}
