"use client";

import { useState } from "react";
import { pearsonPValue, formatPValue, significanceLabel } from "@/lib/stats";

interface ScdiRow {
  index_name: string;
  sector: string;
  org: string;
  correlation: number;
  predicted: boolean;
  // #125: optional values arrays — when present we compute n + p-value
  values_a?: Array<number | null>;
  values_b?: Array<number | null>;
}

interface Props {
  scdis: ScdiRow[];
  activeSectors?: string[];
  onSectorFilter?: (sectors: string[]) => void;
  onRowSelect?: (indexName: string) => void;
  selectedIndex?: string | null;
}

const SECTOR_COLORS: Record<string, string> = {
  Economic: "#38bdf8", Trade: "#34d399", Military: "#f87171",
  Governance: "#a78bfa", Health: "#fb923c", Demographic: "#fbbf24",
  Social: "#e879f9", Education: "#22d3ee", Infrastructure: "#4ade80",
  Environment: "#86efac", Finance: "#93c5fd", Energy: "#fde68a",
  Government: "#c4b5fd", Other: "#7a90a8",
};

export function ScdiTable({ scdis, onRowSelect, selectedIndex }: Props) {
  const [sortKey, setSortKey] = useState<"correlation" | "index_name" | "sector">("correlation");
  const [sortAsc, setSortAsc] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string[]>([]);

  const allSectors = Array.from(new Set(scdis.map((s) => s.sector))).sort();

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function toggleSector(s: string) {
    setSectorFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  const visible = scdis
    .filter((s) => sectorFilter.length === 0 || sectorFilter.includes(s.sector))
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === "correlation") return (a.correlation - b.correlation) * dir;
      return a[sortKey].localeCompare(b[sortKey]) * dir;
    });

  const SortIndicator = ({ col }: { col: typeof sortKey }) =>
    sortKey === col ? (sortAsc ? "↑" : "↓") : "";

  return (
    <div className="flex flex-col">
      {/* Sector filter chips */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b" style={{ borderColor: "var(--qgi-border)" }}>
        {allSectors.map((s) => (
          <button
            key={s}
            onClick={() => toggleSector(s)}
            className="text-[9px] rounded px-2 py-0.5 transition-colors"
            style={{
              color: sectorFilter.includes(s) ? "var(--qgi-bg)" : (SECTOR_COLORS[s] ?? "#7a90a8"),
              backgroundColor: sectorFilter.includes(s)
                ? (SECTOR_COLORS[s] ?? "#7a90a8")
                : `${SECTOR_COLORS[s] ?? "#7a90a8"}18`,
            }}
          >
            {s.toUpperCase()}
          </button>
        ))}
        {sectorFilter.length > 0 && (
          <button
            onClick={() => setSectorFilter([])}
            className="text-[9px] px-2 py-0.5"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            ✕ clear
          </button>
        )}
      </div>

      {/* Table header */}
      <div
        className="grid text-[9px] tracking-widest uppercase px-4 py-2 border-b"
        style={{
          gridTemplateColumns: "1fr 80px 80px 70px 50px 70px 40px",
          color: "var(--qgi-text-dim)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <button onClick={() => toggleSort("index_name")} className="text-left">
          INDICATOR {SortIndicator({ col: "index_name" })}
        </button>
        <button onClick={() => toggleSort("sector")} className="text-left">
          SECTOR {SortIndicator({ col: "sector" })}
        </button>
        <span>SOURCE</span>
        <button onClick={() => toggleSort("correlation")} className="text-right">
          R {SortIndicator({ col: "correlation" })}
        </button>
        <span className="text-right" title="Number of observations used to compute the correlation (after dropping years where either side is missing)">N</span>
        <span className="text-right" title="Two-tailed p-value of the Pearson correlation. *** p<0.001, ** p<0.01, * p<0.05">P-VALUE</span>
        <span></span>
      </div>

      {/* Rows */}
      {visible.map((row, i) => {
        // #125: compute n + p-value from the actual values arrays when present.
        // Falls back to "—" if the route didn't supply values (older routes).
        const va = row.values_a ?? [];
        const vb = row.values_b ?? [];
        let n = 0;
        for (let j = 0; j < Math.min(va.length, vb.length); j++) {
          if (va[j] != null && vb[j] != null && Number.isFinite(va[j]) && Number.isFinite(vb[j])) n++;
        }
        const p = n >= 3 ? pearsonPValue(row.correlation, n) : NaN;
        const sig = significanceLabel(p);
        const sigColor =
          sig === "***" ? "var(--qgi-success)" :
          sig === "**" ? "var(--qgi-success)" :
          sig === "*" ? "var(--qgi-amber)" :
          sig === "ns" ? "var(--qgi-text-dim)" :
          "var(--qgi-text-dim)";

        return (
          <button
            key={i}
            onClick={() => onRowSelect?.(row.index_name)}
            className="grid items-center px-4 py-2.5 border-b text-xs transition-colors hover:bg-[var(--qgi-surface-2)] text-left"
            style={{
              gridTemplateColumns: "1fr 80px 80px 70px 50px 70px 40px",
              borderColor: "var(--qgi-border)",
              backgroundColor:
                selectedIndex === row.index_name ? "var(--qgi-surface-2)" : "transparent",
            }}
          >
            <span className="truncate pr-2" style={{ color: "var(--qgi-text)" }}>
              {row.index_name}
              {row.predicted && (
                <span
                  className="ml-2 text-[9px] rounded px-1.5 py-0.5"
                  style={{ color: "var(--qgi-predicted)", backgroundColor: "rgba(107,127,150,0.15)" }}
                >
                  PREDICTED
                </span>
              )}
            </span>
            <span
              className="text-[9px] truncate"
              style={{ color: SECTOR_COLORS[row.sector] ?? "#7a90a8" }}
            >
              {row.sector}
            </span>
            <span className="text-[9px] truncate" style={{ color: "var(--qgi-text-dim)" }}>
              {row.org}
            </span>
            <span
              className="text-right font-data font-semibold"
              style={{
                color:
                  row.correlation >= 0.8
                    ? "var(--qgi-success)"
                    : row.correlation >= 0.6
                      ? "var(--qgi-amber)"
                      : "var(--qgi-text-muted)",
              }}
            >
              {row.correlation.toFixed(3)}
            </span>
            <span className="text-right font-data text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
              {n > 0 ? n : "—"}
            </span>
            <span className="text-right font-data text-[10px]" style={{ color: sigColor }}>
              {n >= 3 ? `${formatPValue(p)} ${sig}` : "—"}
            </span>
            <span className="text-center text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
              {selectedIndex === row.index_name ? "●" : "○"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
