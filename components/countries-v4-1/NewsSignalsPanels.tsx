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

// Canonical series colors for the pulse chart (FIX 3: amber = news pulse,
// teal = structural — matches the X-card grammar).
// Teal (#2dd4bf) is theme-invariant; the structural line is always dashed so
// the hue alone suffices for light/dark. Amber is resolved from ECharts tokens
// so it darkens on light mode for small-text contrast.
const STRUCTURAL_TEAL = "#2dd4bf";

/** Short labels used inside the theme-chip buttons (compact form, not renamed). */
const VERDICT_LABEL: Record<HfVerdict, string> = {
  ACTIVE: "Active",
  SIGNAL: "Signal",
  LATENT: "Latent",
  QUIET: "Quiet",
};

/** Canonical zone names used in the panel legend (FIX 4). */
const VERDICT_ZONE_LABEL: Record<HfVerdict, string> = {
  ACTIVE: "Both Firing",
  SIGNAL: "News-Only",
  LATENT: "Silent Alarm",
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
  // Monthly is the overview cadence here; weekly arrives with the live data
  // layer (the monthly series can't be honestly resampled to weeks).
  const [resolution, setResolution] = useState<"1M" | "1W">("1M");

  const sel = detail.series.find((s) => s.topic.id === topicId) ?? detail.series[0];

  return (
    <PanelShell
      title="News signals"
      accent="var(--qgi-accent)"
      tooltip="News pulse is a monthly index of how much of this country's news coverage is on a theme. 50 is the country's own long-run normal; 60 and above counts as elevated. The verdict combines that pulse with the structural resemblance behind the theme."
      caption={
        <>
          What the news is amplifying for {detail.name} right now. Select a theme to see
          its news pulse against the verified events.
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

      {/* Resolution + window hint. Monthly is live; weekly unlocks with the
          live data layer. Last twelve months shown by default; drag to scroll
          into earlier years. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
        }}
      >
        {(["1M", "1W"] as const).map((r) => {
          const active = r === resolution;
          const gated = r === "1W";
          return (
            <button
              key={r}
              type="button"
              disabled={gated}
              onClick={() => !gated && setResolution(r)}
              aria-pressed={gated ? undefined : active}
              aria-disabled={gated || undefined}
              title={gated ? "Weekly view arrives with the live data layer" : undefined}
              style={{
                padding: "3px 9px",
                borderRadius: "4px",
                border: "1px solid var(--qgi-border)",
                background: active ? "var(--qgi-surface-2)" : "transparent",
                color: gated
                  ? "var(--qgi-text-dim)"
                  : active
                    ? "var(--qgi-text)"
                    : "var(--qgi-text-muted)",
                boxShadow: active ? "inset 0 0 0 1px var(--qgi-accent)" : "none",
                cursor: gated ? "not-allowed" : "pointer",
                opacity: gated ? 0.55 : 1,
                letterSpacing: "0.5px",
              }}
            >
              {r}
            </button>
          );
        })}
        <span style={{ color: "var(--qgi-text-dim)", marginLeft: "2px" }}>
          last 12 months · drag left for earlier years
        </span>
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
            {/* Zone name per FIX 4 canonical vocabulary */}
            {VERDICT_ZONE_LABEL[v]}
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

  // Open on the last 12 months; the reader drags left to scroll into earlier
  // years (no double-range slider, TradingView idiom, founder 2026-06-13).
  const n = series.months.length;
  const defaultStart = n > 12 ? Math.round(((n - 12) / n) * 100) : 0;

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
      // News pulse (amber) first, then Structural (teal) — matches X-card grammar.
      data: [
        {
          name: "News pulse",
          itemStyle: { color: t.amber },
          lineStyle: { color: t.amber },
        },
        {
          name: "Structural",
          itemStyle: { color: STRUCTURAL_TEAL },
          lineStyle: { color: STRUCTURAL_TEAL, type: "dashed" },
        },
      ],
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
        hideOverlap: true,
        // Full year on January, month number otherwise — so year boundaries
        // stay legible as the reader scrolls back through history.
        formatter: (v: string) => (v.endsWith("-01") ? v.slice(0, 4) : v.slice(5)),
      },
    },
    yAxis: {
      min: 0,
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: t.splitLine, opacity: 0.5 } },
      axisLabel: { color: t.textDim, fontSize: 10 },
    },
    // Inside-only pan/zoom: drag to scroll through history, wheel to zoom. No
    // slider (founder: "TradingView doesn't have it, we don't need it").
    dataZoom: [
      {
        type: "inside",
        start: defaultStart,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
      },
    ],
    series: [
      {
        // News pulse = AMBER (#F59E0B / t.amber) — canonical X-card grammar (FIX 3).
        name: "News pulse",
        type: "line",
        data: series.pulse,
        symbol: "none",
        color: t.amber,
        itemStyle: { color: t.amber },
        lineStyle: { width: 1.8, color: t.amber },
        areaStyle: { color: `${t.amber}22` },
        markPoint: {
          symbol: "pin",
          symbolSize: 20,
          // Pin border stays amber so it belongs visually to the news-pulse series.
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
          // Threshold line is tinted amber so it visually belongs to the news-pulse series.
          lineStyle: { color: t.amber, type: "dashed", width: 1, opacity: 0.6 },
          label: {
            show: true,
            position: "insideEndTop" as const,
            color: t.amber,
            fontSize: 10,
            formatter: "elevated 60",
          },
          data: [{ yAxis: thresholds.pulse }],
        },
      },
      {
        // Structural = TEAL (#2dd4bf) dashed — canonical X-card grammar (FIX 3).
        name: "Structural",
        type: "line",
        data: series.months.map(() => struct),
        symbol: "none",
        color: STRUCTURAL_TEAL,
        itemStyle: { color: STRUCTURAL_TEAL },
        lineStyle: { width: 1.6, type: "dashed", color: STRUCTURAL_TEAL, opacity: 0.85 },
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
