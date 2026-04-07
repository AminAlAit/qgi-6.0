"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SignalRow } from "@/lib/types";

function readSignalFromStorage(signalId: string | null): SignalRow | null {
  if (!signalId) return null;
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem("qgi-signal-" + signalId);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as SignalRow;
  } catch {
    return null;
  }
}

export default function SignalDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const signalId = searchParams.get("id");

  // Lazy initial state — sessionStorage read happens once at mount, not in
  // an effect, which avoids the react-hooks/set-state-in-effect lint rule
  // and skips the loading flicker entirely.
  const [signal] = useState<SignalRow | null>(() => readSignalFromStorage(signalId));

  if (!signal) {
    return (
      <div className="flex items-center justify-center h-full text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
        SIGNAL NOT FOUND
      </div>
    );
  }

  const ppsColor =
    signal.pattern_power_score >= 8
      ? "var(--qgi-danger)"
      : signal.pattern_power_score >= 5
        ? "var(--qgi-amber)"
        : "var(--qgi-success)";

  const corrPct = Math.round(signal.avg_correlation * 100);

  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-[10px] tracking-wider uppercase self-start"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        &larr; Back
      </button>

      {/* Title */}
      <div>
        <h1 className="text-xs tracking-[0.2em] uppercase font-semibold mb-2" style={{ color: "var(--qgi-accent)" }}>
          Signal Detail
        </h1>
        <div className="flex items-center gap-3">
          <span className="font-data text-lg" style={{ color: "var(--qgi-country-b)" }}>
            {signal.country_a_name}
          </span>
          <span className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            following
          </span>
          <span className="font-data text-lg" style={{ color: "var(--qgi-country-a)" }}>
            {signal.country_b_name}
          </span>
        </div>
      </div>

      {/* Score card */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "POWER SCORE", value: signal.pattern_power_score.toFixed(1), color: ppsColor },
          { label: "CORRELATION", value: `${corrPct}%`, color: corrPct >= 80 ? "var(--qgi-success)" : "var(--qgi-amber)" },
          { label: "INDICATORS", value: String(signal.indicator_count), color: "var(--qgi-text)" },
          { label: "PATTERN LENGTH", value: `${signal.length} yrs`, color: "var(--qgi-text)" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded border p-3 text-center"
            style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
          >
            <div className="font-data text-xl font-bold mb-1" style={{ color: m.color }}>
              {m.value}
            </div>
            <div className="text-[8px] tracking-[0.2em] uppercase" style={{ color: "var(--qgi-text-dim)" }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Event category */}
      <div
        className="rounded border p-4"
        style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
      >
        <div className="text-[9px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--qgi-text-dim)" }}>
          Matching Event Category
        </div>
        <span
          className="px-3 py-1 rounded text-xs tracking-wider uppercase font-data"
          style={{ backgroundColor: "var(--qgi-surface-2)", color: "var(--qgi-accent)" }}
        >
          {signal.event_category.replace(/_/g, " ")}
        </span>
      </div>

      {/* Timeline comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Predictor (B) */}
        <div
          className="rounded border p-4"
          style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
        >
          <div className="text-[9px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--qgi-text-dim)" }}>
            Precedent (Historical)
          </div>
          <div className="font-data text-sm mb-2" style={{ color: "var(--qgi-country-a)" }}>
            {signal.country_b_name}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Pattern window</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {signal.start_year_b} – {signal.end_year_b}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Event year</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {signal.event_year_b}
              </span>
            </div>
            <div className="text-[10px] mt-1" style={{ color: "var(--qgi-text-muted)" }}>
              {signal.event_title_b}
            </div>
          </div>
        </div>

        {/* Following (A) */}
        <div
          className="rounded border p-4"
          style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
        >
          <div className="text-[9px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--qgi-text-dim)" }}>
            Following (Active Now)
          </div>
          <div className="font-data text-sm mb-2" style={{ color: "var(--qgi-country-b)" }}>
            {signal.country_a_name}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Pattern window</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {signal.start_year_a} – {signal.end_year_a}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Event year</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {signal.event_year_a}
              </span>
            </div>
            <div className="text-[10px] mt-1" style={{ color: "var(--qgi-text-muted)" }}>
              {signal.event_title_a}
            </div>
          </div>
        </div>
      </div>

      {/* Event window explanation */}
      <div
        className="rounded border p-4"
        style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
      >
        <div className="text-[9px] tracking-[0.15em] uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
          How this signal works
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
          {signal.country_b_name} and {signal.country_a_name} share a {signal.length}-year pattern of
          {" "}{signal.indicator_count} correlated indicators ({corrPct}% avg correlation).
          {" "}{signal.country_b_name}&apos;s pattern started in {signal.start_year_b} and ended in {signal.end_year_b},
          followed by &quot;{signal.event_title_b}&quot; in {signal.event_year_b}.
          {" "}{signal.country_a_name}&apos;s matching pattern started in {signal.start_year_a} and ends in {signal.end_year_a} —
          meaning a similar event (&quot;{signal.event_category.replace(/_/g, " ")}&quot;) may follow.
        </p>
      </div>

      {/* Navigate to underlying pattern */}
      <button
        onClick={() => {
          const qs = new URLSearchParams({
            country_a: String(signal.country_a_id),
            country_b: String(signal.country_b_id),
            length: String(signal.length),
            start_a: String(signal.start_year_a),
            start_b: String(signal.start_year_b),
          });
          router.push(`/patterns?${qs}`);
        }}
        className="self-start px-4 py-2 rounded text-[10px] tracking-wider uppercase font-semibold border transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ borderColor: "var(--qgi-accent)", color: "var(--qgi-accent)" }}
      >
        View Underlying Pattern &rarr;
      </button>
    </div>
  );
}
