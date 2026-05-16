"use client";

import ReactECharts from "echarts-for-react";
import { useRouter } from "next/navigation";
import type { PatternRow } from "@/lib/types";

interface Props {
  patterns: PatternRow[];
}

export function PatternScatter({ patterns }: Props) {
  const router = useRouter();

  const data = patterns.map((p) => [
    p.pattern_length,
    p.num_indexes,
    p.pattern_power_score,
    p.country_a,
    p.country_b,
    p.start_year_a,
    p.start_year_b,
    p.country_a_id ?? p.country_a,
    p.country_b_id ?? p.country_b,
  ]);

  const option = {
    backgroundColor: "transparent",
    title: {
      text: "The Strengths & Lengths of International Relationships",
      textStyle: {
        color: "var(--qgi-text-muted)",
        fontSize: 11,
        fontWeight: 400,
        letterSpacing: 2,
      },
      top: 0,
      left: 0,
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
      formatter: (params: { value: (string | number)[] }) => {
        const [len, idx, pps, ca, cb, sya, syb] = params.value;
        return [
          `<b style="color:#38bdf8">${ca}</b> → <b style="color:#fb923c">${cb}</b>`,
          `Duration: ${len} yrs &nbsp;|&nbsp; Indexes: ${idx}`,
          `Score: <span style="color:#f59e0b">${Number(pps).toFixed(3)}</span>`,
          `${sya}–${Number(sya) + Number(len) - 1} / ${syb}–${Number(syb) + Number(len) - 1}`,
        ].join("<br/>");
      },
    },
    grid: { top: 36, right: 16, bottom: 48, left: 56 },
    xAxis: {
      name: "PATTERN DURATION (YRS)",
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: { color: "#8aa6be", fontSize: 9, letterSpacing: 1 },
      type: "value",
      axisLine: { lineStyle: { color: "#243347" } },
      splitLine: { lineStyle: { color: "#1a2a3a" } },
      axisLabel: { color: "#7a90a8", fontSize: 10 },
    },
    yAxis: {
      name: "INDICATOR MATCHES",
      nameLocation: "middle",
      nameGap: 40,
      nameTextStyle: { color: "#8aa6be", fontSize: 9, letterSpacing: 1 },
      type: "value",
      axisLine: { lineStyle: { color: "#243347" } },
      splitLine: { lineStyle: { color: "#1a2a3a" } },
      axisLabel: { color: "#7a90a8", fontSize: 10 },
    },
    series: [
      {
        type: "scatter",
        data,
        symbolSize: (val: number[]) => Math.max(4, Math.min(32, val[2] * 30)),
        itemStyle: {
          color: "rgba(56, 189, 248, 0.55)",
          borderColor: "#38bdf8",
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: {
            color: "#38bdf8",
            borderColor: "#fff",
            borderWidth: 1.5,
          },
        },
      },
    ],
  };

  const onEvents = {
    click: (params: { value: (string | number)[] }) => {
      const [len, , , , , sya, syb, caId, cbId] = params.value;
      const qs = new URLSearchParams({
        country_a: String(caId),
        country_b: String(cbId),
        length: String(len),
        start_a: String(sya),
        start_b: String(syb),
      });
      router.push(`/patterns?${qs.toString()}`);
    },
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", width: "100%" }}
      onEvents={onEvents}
    />
  );
}
