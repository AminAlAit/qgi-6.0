"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SignalRow } from "@/lib/types";

// Module-level cache so navigating away and back doesn't re-fetch
let cachedSignals: SignalRow[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export default function ActiveSignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<SignalRow[]>(cachedSignals ?? []);
  const [loading, setLoading] = useState(!cachedSignals);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Use cache if fresh
    if (cachedSignals && Date.now() - cacheTime < CACHE_TTL) {
      setSignals(cachedSignals);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // API path stays /api/recipes/* — that's the data-layer name. The UX
        // name "signals" applies to the user-facing layer only (#121).
        const res = await fetch("/api/recipes/top50");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cachedSignals = data;
        cacheTime = Date.now();
        setSignals(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function openDetail(s: SignalRow) {
    sessionStorage.setItem("qgi-signal-" + s.recipe_id, JSON.stringify(s));
    router.push(`/signals/detail?id=${encodeURIComponent(s.recipe_id)}`);
  }

  function confidenceColor(pps: number) {
    if (pps >= 8) return "var(--qgi-danger)";
    if (pps >= 5) return "var(--qgi-amber)";
    return "var(--qgi-success)";
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="text-xs tracking-[0.2em] uppercase font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            Active Signals
          </h1>
        </div>
        <span className="text-[10px] tracking-wider font-data" style={{ color: "var(--qgi-text-dim)" }}>
          {signals.length} ACTIVE SIGNALS
        </span>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
        Highest-confidence signals where a country is currently following another&apos;s historical
        trajectory. Each signal is grounded in a structural precedent — the predictor country
        experienced a matching event after a similar pattern, and the same outcome may follow.
      </p>

      {/* Signal cards */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
            LOADING SIGNALS...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-xs tracking-wider" style={{ color: "var(--qgi-danger)" }}>
            {error}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
            NO ACTIVE SIGNALS FOUND
          </div>
        ) : (
          signals.map((s, i) => (
            <button
              key={s.recipe_id + i}
              onClick={() => openDetail(s)}
              className="w-full text-left rounded border p-4 transition-colors hover:bg-[var(--qgi-surface-2)]"
              style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
            >
              {/* Top row: rank, countries, PPS */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-data text-[10px] w-6 text-center" style={{ color: "var(--qgi-text-dim)" }}>
                    #{i + 1}
                  </span>
                  <span className="font-data text-xs" style={{ color: "var(--qgi-country-b)" }}>
                    {s.country_a_name}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                    following
                  </span>
                  <span className="font-data text-xs" style={{ color: "var(--qgi-country-a)" }}>
                    {s.country_b_name}
                  </span>
                </div>
                <span className="font-data text-sm font-bold" style={{ color: confidenceColor(s.pattern_power_score) }}>
                  {s.pattern_power_score.toFixed(1)}
                </span>
              </div>

              {/* Middle: event info */}
              <div className="flex items-center gap-2 mb-2 ml-9">
                <span
                  className="px-2 py-0.5 rounded text-[9px] tracking-wider uppercase font-data"
                  style={{ backgroundColor: "var(--qgi-surface-2)", color: "var(--qgi-accent)" }}
                >
                  {s.event_category.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] truncate max-w-md" style={{ color: "var(--qgi-text-dim)" }}>
                  {s.event_title_b}
                </span>
              </div>

              {/* Bottom: metadata */}
              <div className="flex items-center gap-4 ml-9">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round(s.avg_correlation * 100))}%`,
                      minWidth: "4px",
                      backgroundColor:
                        s.avg_correlation >= 0.8
                          ? "var(--qgi-success)"
                          : s.avg_correlation >= 0.6
                            ? "var(--qgi-amber)"
                            : "var(--qgi-text-dim)",
                    }}
                  />
                  <span className="font-data text-[10px]" style={{ color: "var(--qgi-text-muted)" }}>
                    {Math.round(s.avg_correlation * 100)}%
                  </span>
                </div>
                <span className="font-data text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                  {s.length}yr
                </span>
                <span className="font-data text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                  {s.indicator_count} idx
                </span>
                <span className="font-data text-[10px]" style={{ color: "var(--qgi-text-muted)" }}>
                  {s.start_year_a}–{s.end_year_a}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
