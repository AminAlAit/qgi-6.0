"use client";

import ReactECharts from "echarts-for-react";
import { sectorColor } from "@/lib/design";

interface Props {
  data: { name: string; value: number }[];
  onSectorClick?: (sector: string | null) => void;
  activeSector?: string | null;
}

export function SectorRose({ data, onSectorClick, activeSector }: Props) {
  const enriched = data.map((d) => ({
    ...d,
    itemStyle: {
      color:
        activeSector && activeSector !== d.name
          ? "rgba(36, 51, 71, 0.8)"
          : sectorColor(d.name),
    },
  }));

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#1e2d42",
      borderColor: "#243347",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
      formatter: "{b}: {c} indicators",
    },
    series: [
      {
        type: "pie",
        radius: ["20%", "72%"],
        roseType: "area",
        center: ["50%", "52%"],
        data: enriched,
        label: {
          show: true,
          color: "#7a90a8",
          fontSize: 9,
          formatter: "{b}",
        },
        emphasis: {
          label: { color: "#e2e8f0", fontSize: 10, fontWeight: 600 },
        },
      },
    ],
  };

  const onEvents = {
    click: (params: { name: string }) => {
      if (onSectorClick) {
        onSectorClick(activeSector === params.name ? null : params.name);
      }
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
