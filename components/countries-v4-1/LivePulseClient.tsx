"use client";

/**
 * LivePulseClient — the per-country pro terminal behind the ⚡ entry
 * (/countries/[iso]/live-pulse, founder-ratified sub-route 2026-06-10).
 *
 * Density-first: the standard country page carries the explanatory arc;
 * this view assumes the reader has it and goes straight to instruments.
 *   - Stage: the full decade of monthly news pulse for one theme, pannable
 *     and zoomable, with verified event pins and the structural level.
 *   - Quadrant: all fourteen themes for this country, struct x pulse.
 *   - Drift matrix: fourteen themes x twenty-four months.
 * Every reading is real: run-2 structural resemblance x the monthly news
 * pulse series (2015 onward).
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ExplainTip } from "@/components/design/ExplainTip";
import { useTheme } from "@/lib/hooks/useTheme";
import { getEchartsTokens, type EchartsTokens } from "@/lib/echarts-theme";
import type { HfVerdict } from "@/lib/hf/topics-data";
import type { HfCountryDetail, HfTopicSeries } from "@/lib/hf/pulse-detail";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const VERDICT_LABEL: Record<HfVerdict, string> = {
  ACTIVE: "Active",
  SIGNAL: "Signal",
  LATENT: "Latent",
  QUIET: "Quiet",
};

function verdictVar(v: HfVerdict): string {
  return v === "ACTIVE"
    ? "var(--qgi-warning)"
    : v === "SIGNAL"
      ? "var(--qgi-accent)"
      : v === "LATENT"
        ? "var(--qgi-text-muted)"
        : "var(--qgi-text-dim)";
}

function verdictTok(v: HfVerdict, t: EchartsTokens): string {
  return v === "ACTIVE"
    ? t.warning
    : v === "SIGNAL"
      ? t.accent
      : v === "LATENT"
        ? t.textMuted
        : t.textDim;
}

export function LivePulseClient({ detail }: { detail: HfCountryDetail }) {
  // Open on the strongest combined reading (validated first, weakest leg).
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
  const cell = sel?.cell ?? null;
  const verdict: HfVerdict = cell?.verdict ?? "QUIET";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Theme rail — all fourteen, board six first. */}
      <div
        role="group"
        aria-label="News themes"
        style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}
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
              // Verdict in the accessible name too — the dot alone is
              // color-only signalling (WCAG 1.4.1).
              title={`${s.topic.name}${s.topic.validated ? " (validated)" : ""}. ${s.topic.scope} Current verdict: ${VERDICT_LABEL[v]}.`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 11px",
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                background: active ? "var(--qgi-surface-2)" : "transparent",
                color: active ? "var(--qgi-text)" : "var(--qgi-text-muted)",
                border: `1px solid ${active ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
                borderRadius: "4px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: verdictVar(v),
                }}
              />
              {s.topic.validated ? "▲ " : ""}
              {s.topic.label}
            </button>
          );
        })}
      </div>

      {/* Reading strip for the selected theme */}
      {cell && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "26px",
            padding: "12px 18px",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "6px",
          }}
        >
          <Metric
            label="Verdict"
            explain="The combined reading for this theme. Active: structural and news pulse both at 60 or above. Signal: news pulse at 60 or above but structure below 60, often noise. Latent: structure at 60 or above while the news stays quiet. Quiet: neither reaches 60."
          >
            <span style={{ color: verdictVar(verdict), fontWeight: 700 }}>
              {VERDICT_LABEL[verdict]}
            </span>
          </Metric>
          <Metric
            label="Structural"
            explain={
              "How closely this country's long-run indicators resemble the shape that ran ahead of this kind of event in the past. 0 to 100; 60 and above counts as elevated."
            }
          >
            <span className="font-data">
              {cell.struct !== null ? Math.round(cell.struct) : "–"}
            </span>
          </Metric>
          <Metric
            label="News pulse"
            explain={
              "How much of this country's news coverage is on this theme this month, measured against its own history. 50 is the country's normal month; 60 and above counts as elevated."
            }
          >
            <span className="font-data" style={{ color: "var(--qgi-accent)" }}>
              {Math.round(cell.pulse)}
            </span>
          </Metric>
          <Metric
            label="vs last month"
            explain={
              "How much the news pulse moved since last month. A positive jump (amber) means the theme took over more of the country's coverage; a negative move (green) means it eased."
            }
          >
            <span
              className="font-data"
              style={{
                color:
                  cell.prevPulse !== null && cell.pulse - cell.prevPulse >= 5
                    ? "var(--qgi-warning)"
                    : cell.prevPulse !== null && cell.pulse - cell.prevPulse <= -5
                      ? "var(--qgi-success)"
                      : "var(--qgi-text-muted)",
              }}
            >
              {cell.prevPulse === null
                ? "–"
                : Math.round(cell.pulse - cell.prevPulse) === 0
                  ? "0"
                  : `${cell.pulse - cell.prevPulse > 0 ? "+" : ""}${Math.round(cell.pulse - cell.prevPulse)}`}
            </span>
          </Metric>
          {sel.topic.validated && (
            // The site's strongest empirical claim earns a real tooltip with
            // its basis (persona panel: analysts wanted to cite it but the
            // badge was a dead hover).
            <ExplainTip
              text="Measured on about 190 verified events (elections; currency, inflation and banking crises) across the covered countries, 2015 to 2026: this theme's news pulse moved ahead of its events by about two months on average, and the lead held when recomputed using only information available at the time. Full validation on the methodology page."
              style={{
                marginLeft: "auto",
                fontSize: "10.5px",
                letterSpacing: "0.5px",
                color: "var(--qgi-success)",
                border:
                  "1px solid color-mix(in srgb, var(--qgi-success) 45%, transparent)",
                borderRadius: "10px",
                padding: "3px 10px",
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
            >
              ▲ Leads events by ~2 months
            </ExplainTip>
          )}
        </div>
      )}

      {/* Stage: a decade of pulse, pannable */}
      <div
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "6px",
          padding: "12px 12px 6px",
        }}
      >
        {sel && <StageChart series={sel} thresholds={detail.thresholds} />}
      </div>

      {/* Quadrant + drift matrix */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "14px",
        }}
      >
        <div
          style={{
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "6px",
            padding: "12px",
          }}
        >
          <MiniTitle explain="Every theme plotted by its two readings: structural resemblance runs across, news pulse runs up. The dashed lines mark 60, the elevated threshold, and the corner names are the four verdicts. Click a dot to put that theme on the chart above.">
            All themes · structure × pulse
          </MiniTitle>
          <CountryQuadrant detail={detail} selectedId={topicId} onSelect={setTopicId} />
        </div>
        <div
          style={{
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "6px",
            padding: "12px",
          }}
        >
          <MiniTitle explain="Each row is a theme and each column a month; brighter cells mean a higher news pulse that month. The highlighted row is the theme on the chart above.">
            Two years · theme by theme
          </MiniTitle>
          <DriftMatrix detail={detail} selectedId={topicId} />
        </div>
      </div>

      <div
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.3px",
        }}
      >
        Pulse updates monthly; structural scores refresh each release. Themes marked ▲
        carry a validated news lead of about two months.
      </div>
    </div>
  );
}

function Metric({
  label,
  explain,
  children,
}: {
  label: string;
  /** Plain-language definition for first-time readers (hover/click/keys). */
  explain?: string;
  children: React.ReactNode;
}) {
  const labelSpan = (
    <span
      style={{
        fontSize: "10px",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: "var(--qgi-text-dim)",
        fontFamily: "ui-monospace, monospace",
        borderBottom: explain ? "1px dotted var(--qgi-text-dim)" : "none",
        paddingBottom: explain ? "1px" : 0,
      }}
    >
      {label}
    </span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {explain ? <ExplainTip text={explain}>{labelSpan}</ExplainTip> : labelSpan}
      <span style={{ fontSize: "19px", lineHeight: 1.1 }}>{children}</span>
    </div>
  );
}

function MiniTitle({
  explain,
  children,
}: {
  explain?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <span
      style={{
        borderBottom: explain ? "1px dotted var(--qgi-text-dim)" : "none",
        paddingBottom: explain ? "1px" : 0,
      }}
    >
      {children}
    </span>
  );
  return (
    <div
      style={{
        fontSize: "10.5px",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: "var(--qgi-text-dim)",
        fontFamily: "ui-monospace, monospace",
        margin: "2px 0 8px",
      }}
    >
      {explain ? <ExplainTip text={explain}>{inner}</ExplainTip> : inner}
    </div>
  );
}

/* ── Stage: full-history pulse with pan/zoom ─────────────────────────── */

function StageChart({
  series,
  thresholds,
}: {
  series: HfTopicSeries;
  thresholds: { struct: number; pulse: number };
}) {
  const { isDark } = useTheme();
  const t = getEchartsTokens(isDark);
  const struct = series.cell?.struct ?? null;
  const n = series.months.length;
  // Default window: the last 4 years; the slider opens the full decade.
  // The user's pan/zoom is CONTROLLED state: the option object is rebuilt
  // per render and echarts-for-react re-applies baked start/end on every
  // setOption — without feeding the live window back in, selecting a theme
  // (or toggling dark mode) would snap the view back to the default.
  const defaultStart = n > 48 ? Math.round(((n - 48) / n) * 100) : 0;
  const [win, setWin] = useState<{ start: number; end: number }>({
    start: defaultStart,
    end: 100,
  });

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
      formatter: (ps: Array<{ axisValue: string; data: number }>) => {
        const p = ps[0];
        const ev = series.events.find((e) => e.date === p.axisValue);
        return (
          `${p.axisValue}<br/>news pulse ${Math.round(p.data)}` +
          (struct !== null ? `<br/>structural ${Math.round(struct)}` : "") +
          (ev ? `<br/><span style="color:${t.amber}">${ev.label}</span>` : "")
        );
      },
    },
    grid: { left: 44, right: 18, top: 20, bottom: 58 },
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
        formatter: (v: string) => v.slice(0, 7),
      },
    },
    yAxis: {
      min: 0,
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: t.splitLine, opacity: 0.5 } },
      axisLabel: { color: t.textDim, fontSize: 10 },
    },
    dataZoom: [
      { type: "inside", start: win.start, end: win.end },
      {
        type: "slider",
        start: win.start,
        end: win.end,
        height: 22,
        bottom: 10,
        backgroundColor: "transparent",
        borderColor: t.border,
        fillerColor: `${t.accent}1a`,
        handleStyle: { color: t.accent, borderColor: t.accent },
        moveHandleStyle: { color: t.border },
        dataBackground: {
          lineStyle: { color: t.border },
          areaStyle: { color: `${t.border}80` },
        },
        selectedDataBackground: {
          lineStyle: { color: t.accent },
          areaStyle: { color: `${t.accent}33` },
        },
        textStyle: { color: t.textDim, fontSize: 9 },
        brushSelect: false,
      },
    ],
    series: [
      {
        name: "News pulse",
        type: "line",
        data: series.pulse,
        symbol: "none",
        sampling: "lttb",
        lineStyle: { width: 1.6, color: t.accent },
        areaStyle: { color: `${t.accent}1e` },
        markPoint: {
          symbol: "pin",
          symbolSize: 20,
          itemStyle: { color: t.surface2, borderColor: t.amber, borderWidth: 1.5 },
          label: { show: false },
          // No emphasis label: the axis tooltip already names the event on a
          // pinned month, and two boxes saying the same thing read as a bug
          // (founder catch 2026-06-11).
          emphasis: { disabled: true },
          data: markers.map((m) => ({ coord: m.coord, value: m.label })),
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.textDim, type: "dashed", width: 1 },
          // Terse instrument tags: a terminal labels its reference lines
          // (on Latent themes the two run close and read as duplicate
          // gridlines without them).
          label: {
            show: true,
            position: "insideEndTop" as const,
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            color: t.textDim,
            formatter: "elevated 60",
          },
          data: [
            { yAxis: thresholds.pulse },
            ...(struct !== null
              ? [
                  {
                    yAxis: struct,
                    lineStyle: { color: t.amber, type: "dashed" as const, width: 1.4 },
                    label: {
                      show: true,
                      position: "insideEndTop" as const,
                      fontSize: 10,
                      fontFamily: "ui-monospace, monospace",
                      color: t.amber,
                      formatter: `structural ${Math.round(struct)}`,
                    },
                  },
                ]
              : []),
          ],
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      onEvents={{
        datazoom: (e: {
          start?: number;
          end?: number;
          batch?: Array<{ start: number; end: number }>;
        }) => {
          const z = e.batch?.[0] ?? e;
          if (typeof z.start === "number" && typeof z.end === "number") {
            const s = z.start;
            const en = z.end;
            // Skip no-op updates so drag ticks don't churn renders.
            setWin((prev) =>
              Math.abs(prev.start - s) < 0.05 && Math.abs(prev.end - en) < 0.05
                ? prev
                : { start: s, end: en }
            );
          }
        },
      }}
      style={{ height: "380px", width: "100%" }}
    />
  );
}

/* ── Quadrant: all themes for this country ───────────────────────────── */

function CountryQuadrant({
  detail,
  selectedId,
  onSelect,
}: {
  detail: HfCountryDetail;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { isDark } = useTheme();
  const t = getEchartsTokens(isDark);
  const th = detail.thresholds;

  const points = detail.series
    .filter((s) => s.cell && s.cell.struct !== null)
    .map((s) => {
      const c = s.cell!;
      const col = verdictTok(c.verdict, t);
      const isSel = s.topic.id === selectedId;
      // Label only what must be readable: the selection, the two validated
      // themes, and elevated readings. The dense sub-threshold cluster keeps
      // its dots (tooltip carries the names) — shiftY alone could not
      // untangle the same-y pileup (review finding).
      const labeled = isSel || s.topic.validated || c.pulse >= 60;
      return {
        name: s.topic.label,
        topicId: s.topic.id,
        value: [c.struct, c.pulse],
        verdict: c.verdict,
        symbolSize: isSel ? 13 : 9,
        z: isSel ? 12 : 10,
        itemStyle: {
          color: col,
          borderColor: isSel ? t.text : "transparent",
          borderWidth: isSel ? 1.5 : 0,
        },
        label: {
          show: labeled,
          position: "right" as const,
          color: isSel ? t.text : t.textMuted,
          fontSize: isSel ? 12 : 10.5,
          fontWeight: (isSel ? 600 : 400) as 400 | 600,
          formatter: s.topic.label,
        },
      };
    });

  const structVals = points.map((p) => p.value[0] as number);
  const xMin = Math.min(
    30,
    Math.max(0, Math.floor((Math.min(...structVals) - 5) / 10) * 10)
  );

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
      formatter: (p: { data: { name: string; value: number[]; verdict: HfVerdict } }) =>
        `<b>${p.data.name}</b><br/>structural ${Math.round(p.data.value[0])} · news pulse ${Math.round(
          p.data.value[1]
        )}<br/>${VERDICT_LABEL[p.data.verdict]}`,
    },
    grid: { left: 40, right: 70, top: 16, bottom: 34 },
    xAxis: {
      min: xMin,
      max: 100,
      name: "STRUCTURAL",
      nameLocation: "middle",
      nameGap: 24,
      nameTextStyle: { color: t.textDim, fontSize: 9.5, letterSpacing: 1 },
      axisLine: { lineStyle: { color: t.border } },
      splitLine: { show: false },
      axisLabel: { color: t.textDim, fontSize: 10 },
    },
    yAxis: {
      min: 0,
      max: 100,
      name: "PULSE",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: t.textDim, fontSize: 9.5, letterSpacing: 1 },
      axisLine: { lineStyle: { color: t.border } },
      splitLine: { show: false },
      axisLabel: { color: t.textDim, fontSize: 10 },
    },
    // Name the quadrants once, faintly — the one place the whole verdict
    // vocabulary becomes self-evident at a glance (review finding).
    graphic: [
      cornerCaption("Active", t.warning, "right", "top"),
      cornerCaption("Signal", t.accent, "left", "top"),
      cornerCaption("Latent", t.textMuted, "right", "bottom"),
      cornerCaption("Quiet", t.textDim, "left", "bottom"),
    ],
    series: [
      {
        type: "scatter",
        data: points,
        labelLayout: { moveOverlap: "shiftY" as const },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.textDim, type: "dashed", width: 1 },
          label: { show: false },
          data: [{ xAxis: th.struct }, { yAxis: th.pulse }],
        },
      },
    ],
  };

  const onEvents = {
    click: (p: { data?: { topicId?: string } }) => {
      if (p.data?.topicId) onSelect(p.data.topicId);
    },
  };

  return (
    <ReactECharts
      option={option}
      onEvents={onEvents}
      style={{ height: "330px", width: "100%" }}
    />
  );
}

/* ── Drift matrix: all themes x 24 months ────────────────────────────── */

function cornerCaption(
  text: string,
  fill: string,
  x: "left" | "right",
  y: "top" | "bottom"
) {
  return {
    type: "text" as const,
    [x]: x === "left" ? "12%" : "10%",
    [y]: y === "top" ? "8%" : "14%",
    style: {
      text,
      fill,
      fontSize: 10,
      fontFamily: "ui-monospace, monospace",
      opacity: 0.8,
    },
    silent: true,
    z: 1,
  };
}

function DriftMatrix({
  detail,
  selectedId,
}: {
  detail: HfCountryDetail;
  selectedId: string;
}) {
  const { isDark } = useTheme();
  const t = getEchartsTokens(isDark);

  const months = detail.series[0]?.months.slice(-24) ?? [];
  const topics = detail.series.map((s) => s.topic.label);
  const selectedIdx = detail.series.findIndex((s) => s.topic.id === selectedId);
  const cells: Array<[number, number, number]> = [];
  detail.series.forEach((s, ti) => {
    s.pulse.slice(-24).forEach((p, mi) => {
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
    grid: { left: 96, right: 8, top: 24, bottom: 6 },
    xAxis: {
      type: "category",
      data: months,
      position: "top",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: t.textDim,
        fontSize: 9.5,
        interval: 3,
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
      // Selected theme's row label carries the accent — closes the
      // cross-panel selection loop (review finding).
      axisLabel: {
        color: t.textMuted,
        fontSize: 10.5,
        formatter: (value: string, idx: number) =>
          idx === selectedIdx ? `{sel|${value}}` : value,
        rich: { sel: { color: t.accent, fontWeight: 600 as const, fontSize: 10.5 } },
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 100,
      // Monotonic in both themes (light must end on its darkest blue).
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
        itemStyle: { borderColor: t.surface, borderWidth: 1.5, borderRadius: 2 },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: `${40 + detail.series.length * 22}px`, width: "100%" }}
    />
  );
}
