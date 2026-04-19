"use client";

import { useState, useMemo } from "react";

interface TimelineEvent {
  year: number;
  title: string;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  civil_war_and_insurgency: "#f87171",
  military_conflict: "#f87171",
  political_violence: "#f87171",
  terrorist_attack: "#f87171",
  economic_crisis: "#fbbf24",
  currency_crisis: "#fbbf24",
  banking_and_financial_crisis: "#fbbf24",
  fiscal_policy_change: "#fbbf24",
  elections_and_voting: "#38bdf8",
  government_formation: "#38bdf8",
  constitutional_change: "#38bdf8",
  democratic_transition: "#38bdf8",
  executive_transition: "#38bdf8",
  migration_and_refugees: "#a78bfa",
  humanitarian_crisis: "#a78bfa",
  natural_disaster: "#a78bfa",
  economic_growth: "#34d399",
  infrastructure_project: "#34d399",
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "var(--qgi-text-muted)";
}

interface Props {
  events: TimelineEvent[];
  countryName: string;
}

export function EventsTimeline({ events, countryName }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...events].sort((a, b) => b.year - a.year),
    [events]
  );

  // Group by decade for the mini-chart
  const decades = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const e of events) {
      const decade = `${Math.floor(e.year / 10) * 10}s`;
      groups[decade] = (groups[decade] ?? 0) + 1;
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  const maxPerDecade = Math.max(...decades.map(([, c]) => c), 1);

  const displayed = expanded ? sorted : sorted.slice(0, 10);

  if (events.length === 0) return null;

  return (
    <section
      className="rounded-lg border p-6"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Curated Events — {countryName}
        </h2>
        <span
          className="font-data text-[10px]"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {/* T4 #297 HIGH fix (2026-04-19): header previously hardcoded
              "1990–present". Some curated countries extend to 1932 (Ukraine
              Holodomor era etc.). Compute bounds from the data. */}
          {events.length} events
          {events.length > 0 &&
            ` (${Math.min(...events.map((e) => e.year))}–${Math.max(
              ...events.map((e) => e.year)
            )})`}
        </span>
      </div>

      {/* Mini decade distribution bar */}
      <div className="flex items-end gap-1 mb-4 h-8">
        {decades.map(([decade, count]) => (
          <div key={decade} className="flex flex-col items-center flex-1">
            <div
              className="w-full rounded-t"
              style={{
                height: `${(count / maxPerDecade) * 28}px`,
                backgroundColor: "var(--qgi-accent)",
                opacity: 0.6,
                minHeight: 2,
              }}
            />
            <span
              className="text-[8px] mt-0.5"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {decade}
            </span>
          </div>
        ))}
      </div>

      {/* Event list */}
      <div className="space-y-0">
        {displayed.map((event, i) => (
          <div
            key={`${event.year}-${i}`}
            className="flex items-start gap-3 py-2 border-b last:border-b-0"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <span
              className="font-data text-xs w-10 shrink-0 pt-0.5"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {event.year}
            </span>
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: getCategoryColor(event.category) }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs leading-relaxed truncate">
                {event.title}
              </div>
              <div
                className="text-[9px] tracking-wider uppercase"
                style={{ color: getCategoryColor(event.category) }}
              >
                {event.category.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        ))}
      </div>

      {sorted.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[10px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {expanded
            ? "Show less"
            : `Show all ${sorted.length} events`}
        </button>
      )}
    </section>
  );
}
