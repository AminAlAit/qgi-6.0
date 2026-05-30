"use client";

/**
 * PatternCompositionSection — client wrapper that holds pie↔grid toggle state.
 *
 * Contains both PatternCompositionPie and PatternIndicatorsGrouped.
 * The hidden-sectors Set is managed here and passed to both.
 */

import { useState, useCallback } from "react";
import type { PatternIndicator } from "@/lib/cascade-patterns/scdi-mock";
import { PatternCompositionPie } from "./PatternCompositionPie";
import { PatternIndicatorsGrouped } from "./PatternIndicatorsGrouped";

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
      />
    </>
  );
}
