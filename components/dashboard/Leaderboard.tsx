"use client";

import { useRouter } from "next/navigation";
import type { PatternRow } from "@/lib/types";

interface Props {
  patterns: PatternRow[];
}

export function Leaderboard({ patterns }: Props) {
  const router = useRouter();

  function navigate(p: PatternRow) {
    const qs = new URLSearchParams({
      country_a: p.country_a,
      country_b: p.country_b,
      length: String(p.pattern_length),
      start_a: String(p.start_year_a),
      start_b: String(p.start_year_b),
    });
    router.push(`/patterns?${qs.toString()}`);
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="text-[9px] tracking-[0.2em] uppercase px-4 py-2 border-b flex gap-0"
        style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
      >
        <span className="flex-1">PREDICTOR</span>
        <span className="flex-1">FOLLOWING</span>
        <span className="w-16 text-right">PPS</span>
        <span className="w-10 text-right">YRS</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {patterns.map((p, i) => (
          <button
            key={i}
            onClick={() => navigate(p)}
            className="w-full text-left flex items-center gap-0 px-4 py-2 border-b text-xs transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <span
              className="flex-1 font-data truncate"
              style={{ color: "var(--qgi-country-a)" }}
            >
              {p.country_a}
            </span>
            <span
              className="flex-1 font-data truncate"
              style={{ color: "var(--qgi-country-b)" }}
            >
              {p.country_b}
            </span>
            <span
              className="w-16 text-right font-data font-semibold"
              style={{ color: "var(--qgi-amber)" }}
            >
              {p.pattern_power_score.toFixed(3)}
            </span>
            <span
              className="w-10 text-right font-data"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              {p.pattern_length}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
