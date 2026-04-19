"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { IndexCatalogue } from "@/components/dashboard/IndexCatalogue";
import type { IndexEntry, PatternRow } from "@/lib/types";

// Dynamically import ECharts components to avoid SSR issues
const PatternScatter = dynamic(
  () => import("@/components/charts/PatternScatter").then((m) => m.PatternScatter),
  { ssr: false }
);
const SectorRose = dynamic(
  () => import("@/components/charts/SectorRose").then((m) => m.SectorRose),
  { ssr: false }
);

interface Props {
  patterns: PatternRow[];
  indexes: IndexEntry[];
}

export function DashboardClient({ patterns, indexes }: Props) {
  const [activeSector, setActiveSector] = useState<string | null>(null);

  // Scatter uses top 200 by PPS (dense but not overwhelming)
  const scatterData = useMemo(
    () =>
      [...patterns]
        .sort((a, b) => b.pattern_power_score - a.pattern_power_score)
        .slice(0, 200),
    [patterns]
  );

  // Rose chart: count indexes per sector
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const idx of indexes) {
      counts[idx.sector] = (counts[idx.sector] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [indexes]);

  const hasPatterns = patterns.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center px-6 py-3 border-b shrink-0"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <span
          className="text-[10px] tracking-[0.25em] uppercase font-semibold"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Pattern Universe
        </span>
        {hasPatterns && (
          <span
            className="ml-4 font-data text-xs"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {patterns.length.toLocaleString()} patterns
          </span>
        )}
        {!hasPatterns && (
          <span className="ml-4 text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            Connect Athena to load live data
          </span>
        )}
      </div>

      {/* Top half: scatter + leaderboard */}
      <div
        className="flex border-b shrink-0"
        style={{ height: "45%", borderColor: "var(--qgi-border)" }}
      >
        {/* Scatter */}
        <div className="flex-1 border-r p-3" style={{ borderColor: "var(--qgi-border)" }}>
          {hasPatterns ? (
            <PatternScatter patterns={scatterData} />
          ) : (
            <EmptyState label="SCATTER PLOT" sublabel="Patterns data unavailable" />
          )}
        </div>

        {/* Leaderboard */}
        <div className="w-96 flex flex-col">
          <div
            className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b"
            style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
          >
            Top Patterns by Strength
          </div>
          <div className="flex-1 overflow-hidden">
            {hasPatterns ? (
              <Leaderboard patterns={patterns.slice(0, 1000)} />
            ) : (
              <EmptyState label="LEADERBOARD" sublabel="No pattern data" />
            )}
          </div>
        </div>
      </div>

      {/* Bottom half: index catalogue + sector rose */}
      <div className="flex flex-1 min-h-0">
        {/* Index catalogue */}
        <div
          className="flex-1 border-r flex flex-col min-h-0"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <div
            className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b shrink-0"
            style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
          >
            Index Catalogue
            {activeSector && (
              <span style={{ color: "var(--qgi-accent)" }}>
                {" "}
                — {activeSector}
                <button
                  onClick={() => setActiveSector(null)}
                  className="ml-2 text-[9px]"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  ✕ clear
                </button>
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <IndexCatalogue indexes={indexes} activeSector={activeSector} />
          </div>
        </div>

        {/* Sector rose */}
        <div className="w-72 flex flex-col">
          <div
            className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b shrink-0"
            style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
          >
            Sectors
          </div>
          <div className="flex-1">
            <SectorRose
              data={sectorCounts}
              activeSector={activeSector}
              onSectorClick={setActiveSector}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <span
        className="text-[9px] tracking-[0.2em] uppercase"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </span>
      <span className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
        {sublabel}
      </span>
    </div>
  );
}
