"use client";

import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { applyTransformation, type Transformation } from "@/lib/transforms";
import indexData from "@/data/indexes.json";
import type { IndexEntry } from "@/lib/types";

const INDEX_MAP: Record<string, IndexEntry> = Object.fromEntries(
  (indexData as IndexEntry[]).map((idx) => [idx.name, idx])
);

interface Props {
  indexName: string;
  valuesA: number[];
  valuesB: number[];
  startYearA: number;
  startYearB: number;
  correlation: number;
  predicted: boolean;
  transformation: Transformation;
  align: boolean;
  countryA: string;
  countryB: string;
}

export function IndexChart({
  indexName,
  valuesA,
  valuesB,
  startYearA,
  startYearB,
  correlation,
  predicted,
  transformation,
  align,
  countryA,
  countryB,
}: Props) {
  const meta = INDEX_MAP[indexName];

  const { xAxisA, xAxisB, tA, tB } = useMemo(() => {
    const tA = applyTransformation(valuesA, transformation);
    const tB = applyTransformation(valuesB, transformation);
    const len = Math.max(tA.length, tB.length);

    if (align) {
      const xAxis = Array.from({ length: len }, (_, i) => `Year ${i + 1}`);
      return { xAxisA: xAxis, xAxisB: xAxis, tA, tB };
    }

    const xA = Array.from({ length: tA.length }, (_, i) => String(startYearA + i));
    const xB = Array.from({ length: tB.length }, (_, i) => String(startYearB + i));
    return { xAxisA: xA, xAxisB: xB, tA, tB };
  }, [valuesA, valuesB, startYearA, startYearB, transformation, align]);

  const option = {
    backgroundColor: "transparent",
    title: {
      text: indexName,
      subtext: `${(correlation * 100).toFixed(1)}% correlation`,
      textStyle: { color: "var(--qgi-text-muted)", fontSize: 10, fontWeight: 400 },
      subtextStyle: {
        color: correlation >= 0.8 ? "#34d399" : correlation >= 0.6 ? "#f59e0b" : "#7a90a8",
        fontSize: 9,
      },
      top: 4,
      left: 8,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 10 },
    },
    legend: {
      data: [countryA, countryB],
      top: 4,
      right: 8,
      textStyle: { color: "#7a90a8", fontSize: 9 },
      itemWidth: 12,
      itemHeight: 2,
    },
    grid: { top: 56, right: 16, bottom: 32, left: 48 },
    xAxis: {
      type: "category",
      data: align ? xAxisA : xAxisA,
      axisLine: { lineStyle: { color: "#243347" } },
      axisLabel: { color: "#4a6280", fontSize: 9 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#243347" } },
      splitLine: { lineStyle: { color: "#1a2a3a" } },
      axisLabel: { color: "#4a6280", fontSize: 9 },
    },
    series: [
      {
        name: countryA,
        type: "line",
        data: align ? tA.map((v, i) => [xAxisA[i], v]) : xAxisA.map((x, i) => [x, tA[i]]),
        lineStyle: { color: "#38bdf8", width: 1.5 },
        itemStyle: { color: "#38bdf8" },
        symbol: "none",
        smooth: false,
      },
      {
        name: countryB,
        type: "line",
        data: align ? tB.map((v, i) => [xAxisB[i], v]) : xAxisB.map((x, i) => [x, tB[i]]),
        lineStyle: {
          color: predicted ? "#6b7f96" : "#fb923c",
          width: 1.5,
          type: predicted ? "dashed" : "solid",
          opacity: predicted ? 0.7 : 1,
        },
        itemStyle: { color: predicted ? "#6b7f96" : "#fb923c" },
        symbol: "none",
        smooth: false,
      },
    ],
  };

  return (
    <div
      className="rounded border p-2 flex flex-col"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
        minHeight: 220,
      }}
    >
      <ReactECharts option={option} style={{ height: 200 }} />
      {meta?.description && (
        <p className="text-[9px] px-2 pb-1 leading-relaxed" style={{ color: "var(--qgi-text-dim)" }}>
          {meta.description}
        </p>
      )}
    </div>
  );
}
