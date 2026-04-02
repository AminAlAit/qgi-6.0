"use client";

import { useState } from "react";
import type { IndexEntry } from "@/lib/types";

interface Props {
  indexes: IndexEntry[];
  activeSector?: string | null;
}

const SECTOR_COLORS: Record<string, string> = {
  Economic: "#38bdf8",
  Trade: "#34d399",
  Military: "#f87171",
  Governance: "#a78bfa",
  Health: "#fb923c",
  Demographic: "#fbbf24",
  Social: "#e879f9",
  Education: "#22d3ee",
  Infrastructure: "#4ade80",
  Environment: "#86efac",
  Finance: "#93c5fd",
  Energy: "#fde68a",
  Government: "#c4b5fd",
  Other: "#7a90a8",
};

export function IndexCatalogue({ indexes, activeSector }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = activeSector ? indexes.filter((idx) => idx.sector === activeSector) : indexes;

  return (
    <div className="flex flex-col h-full">
      <div
        className="text-[9px] tracking-[0.2em] uppercase px-4 py-2 border-b flex gap-4"
        style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
      >
        <span className="w-6">#</span>
        <span className="flex-1">INDICATOR</span>
        <span className="w-24">SECTOR</span>
        <span className="w-20">SOURCE</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {visible.map((idx, i) => (
          <div key={`${idx.id}-${i}`}>
            <button
              onClick={() => setExpandedId(expandedId === idx.id ? null : idx.id)}
              className="w-full text-left flex items-center gap-4 px-4 py-2 border-b text-xs transition-colors hover:bg-[var(--qgi-surface-2)]"
              style={{ borderColor: "var(--qgi-border)" }}
            >
              <span
                className="w-6 font-data text-[10px] shrink-0"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {idx.numeric_id}
              </span>
              <span className="flex-1 truncate" style={{ color: "var(--qgi-text)" }}>
                {idx.name}
              </span>
              <span
                className="w-24 shrink-0 text-[9px] rounded px-1.5 py-0.5 text-center"
                style={{
                  color: SECTOR_COLORS[idx.sector] ?? "#7a90a8",
                  backgroundColor: `${SECTOR_COLORS[idx.sector] ?? "#7a90a8"}18`,
                }}
              >
                {idx.sector.toUpperCase()}
              </span>
              <span
                className="w-20 shrink-0 text-[9px] truncate"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {idx.org}
              </span>
            </button>
            {expandedId === idx.id && idx.description && (
              <div
                className="px-4 py-3 text-xs border-b"
                style={{
                  backgroundColor: "var(--qgi-surface-2)",
                  borderColor: "var(--qgi-border)",
                  color: "var(--qgi-text-muted)",
                }}
              >
                <p className="mb-1">{idx.description}</p>
                {idx.citation && (
                  <p className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                    {idx.citation}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
