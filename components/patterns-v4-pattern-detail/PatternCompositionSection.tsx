"use client";

/**
 * PatternCompositionSection — client wrapper that holds pie↔grid toggle state.
 *
 * Category filter chips live at the top of PatternIndicatorsGrouped (collocated
 * with the SCDIs they affect). The pie remains as a visual summary of composition
 * only; users do not need to scroll up to the pie to toggle categories.
 */

import { useState, useCallback, useMemo } from "react";
import type { PatternIndicator } from "@/lib/cascade-patterns/scdi-mock";
import { PatternCompositionPie } from "./PatternCompositionPie";
import { PatternIndicatorsGrouped } from "./PatternIndicatorsGrouped";
import { sectorColor } from "@/lib/cascade-patterns/sector-colors";

interface PatternCompositionSectionProps {
  indicators: PatternIndicator[];
  countryA: string;
  countryB: string;
  startA: number;
  startB: number;
  length: number;
}

export function PatternCompositionSection({
  indicators,
  countryA,
  countryB,
  startA,
  startB,
  length,
}: PatternCompositionSectionProps) {
  const [hiddenSectors, setHiddenSectors] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((sector: string) => {
    setHiddenSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
  }, []);

  // Build ordered sector list from indicators (sorted by count desc).
  const sectors = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ind of indicators) {
      counts[ind.sector] = (counts[ind.sector] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([sector, count]) => ({ sector, count, color: sectorColor(sector) }));
  }, [indicators]);

  return (
    <>
      <PatternCompositionPie
        indicators={indicators}
        hiddenSectors={hiddenSectors}
        onToggle={handleToggle}
      />
      <PatternIndicatorsGrouped
        indicators={indicators}
        countryA={countryA}
        countryB={countryB}
        startA={startA}
        startB={startB}
        length={length}
        hiddenSectors={hiddenSectors}
        onToggle={handleToggle}
        sectors={sectors}
      />
    </>
  );
}
