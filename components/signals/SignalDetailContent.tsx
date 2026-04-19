"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SignalRow } from "@/lib/types";
import { DualTimeline } from "@/components/signals/DualTimeline";
import { BriefingExport } from "@/components/signals/BriefingExport";
import {
  TierBadge,
  ConvergenceBadge,
  PpsValue,
} from "@/components/design/Badges";

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

export function SignalDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const signalId = searchParams.get("id");

  const [signal] = useState<SignalRow | null>(() => readSignalFromStorage(signalId));

  if (!signal) {
    return (
      <div className="flex items-center justify-center h-full text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
        SIGNAL NOT FOUND
      </div>
    );
  }

  const corrPct = Math.round(signal.avg_correlation * 100);
  // T7 #300 HIGH fix (2026-04-19): `pattern_power_score` in prod data is
  // the RAW value (can be ~399 for strong patterns), while `pps` is the
  // normalized 0-100 version. If only the raw value is available, clamp
  // it through a heuristic divide rather than letting `PpsValue`'s
  // `/100` suffix produce "399.4 / 100".
  const rawPps = signal.pps ?? signal.pattern_power_score;
  const pps = rawPps != null && rawPps > 100 ? Math.min(100, rawPps / 10) : rawPps;

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

      {/* Title + tier + convergence (#128, #133) */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xs tracking-[0.2em] uppercase font-semibold" style={{ color: "var(--qgi-accent)" }}>
            Signal Detail
          </h1>
          {signal.pattern_tier && <TierBadge tier={signal.pattern_tier} size="sm" />}
          {signal.convergence_tier && (
            <ConvergenceBadge
              tier={signal.convergence_tier}
              nPredictors={signal.n_predictors}
              nRegions={signal.n_regions}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-data text-lg" style={{ color: "var(--qgi-country-a)" }}>
            {signal.country_a_name}
          </span>
          <span className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            following
          </span>
          <span className="font-data text-lg" style={{ color: "var(--qgi-country-b)" }}>
            {signal.country_b_name}
          </span>
        </div>
      </div>

      {/* Score card */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="PATTERN STRENGTH"
          /* T7 #300 P1-3 fix (Sonnet reviewer 2026-04-19): earlier
             `showSuffix={signal.pps !== undefined}` suppressed the "/100"
             suffix for signals where only raw `pattern_power_score` was
             present — even though the normalization on line 48 already
             produced a valid 0-100 value. Suffix should appear whenever
             `pps` is a finite number. */
          value={<PpsValue pps={pps} size="md" showSuffix={pps != null && Number.isFinite(pps)} />}
        />
        <MetricCard
          label="AVG CORRELATION"
          value={
            <span
              className="font-data text-xl font-bold"
              style={{
                color: corrPct >= 80 ? "var(--qgi-success)" : "var(--qgi-amber)",
              }}
            >
              {corrPct}%
            </span>
          }
        />
        <MetricCard
          label="INDICATORS"
          value={
            <span className="font-data text-xl font-bold" style={{ color: "var(--qgi-text)" }}>
              {signal.indicator_count}
            </span>
          }
        />
        <MetricCard
          label="PATTERN LENGTH"
          value={
            <span className="font-data text-xl font-bold" style={{ color: "var(--qgi-text)" }}>
              {signal.length}
              <span className="text-xs font-normal" style={{ color: "var(--qgi-text-dim)" }}>
                {" "}
                yrs
              </span>
            </span>
          }
        />
      </div>

      {/* #122 item 1: dual timeline */}
      <DualTimeline signal={signal} />

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

      {/* Forecast timing (#134).
          T7 #300 HIGH fix v2 (2026-04-19, Sonnet reviewer P0-1): the
          earlier Math.abs() trick lied about the data. A negative
          median_lead_time means the historical event co-occurred with or
          preceded the precedent pattern's end, NOT that it followed
          `|lead|` years later. Split the render into two branches:
          - leadYears > 0: normal forward-looking forecast
          - leadYears <= 0: "event co-occurred with pattern" framing,
            no projected year. */}
      {signal.median_lead_time !== undefined && signal.median_lead_time !== null && (
        <div
          className="rounded border p-4"
          style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
        >
          <div className="text-[9px] tracking-[0.15em] uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
            Forecast Timing
          </div>
          {signal.median_lead_time > 0 ? (
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
              Historical precedents in {signal.country_b_name} preceded their matching events by a median of{" "}
              <span className="font-data font-semibold" style={{ color: "var(--qgi-amber)" }}>
                {signal.median_lead_time} year{signal.median_lead_time === 1 ? "" : "s"}
              </span>
              {signal.min_lead_time != null && signal.max_lead_time != null && signal.min_lead_time > 0 && (
                <>
                  {" "}
                  (range: {signal.min_lead_time}–{signal.max_lead_time} yrs)
                </>
              )}
              . Projected onto {signal.country_a_name}&apos;s still-running pattern, the implied event window is{" "}
              <span className="font-data font-semibold" style={{ color: "var(--qgi-amber)" }}>
                ~{signal.end_year_a + signal.median_lead_time}
              </span>
              .
            </p>
          ) : (
            /* Sonnet reviewer P1-B (2026-04-19): event_title_b + event_year_b
               are optional on SignalRow (missing when Athena patterns lack
               enrichment). Fall back to "matching event" / "—" to avoid
               rendering the literal string "undefined". */
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
              The matching event in {signal.country_b_name}
              {signal.event_title_b && signal.event_year_b != null ? (
                <>
                  {" "}(&quot;{signal.event_title_b}&quot; in {signal.event_year_b})
                </>
              ) : null}
              {" "}co-occurred with the precedent pattern rather than following it. No forward forecast
              window is projected for {signal.country_a_name} on this signal — the analogue is retrospective.
            </p>
          )}
        </div>
      )}

      {/* Explanation */}
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

      {/* #122 item 5: copy-briefing */}
      <BriefingExport signal={signal} />

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
        View Evidence (Underlying Pattern) &rarr;
      </button>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="rounded border p-3 text-center flex flex-col justify-center"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
        minHeight: 68,
      }}
    >
      <div className="mb-1">{value}</div>
      <div className="text-[8px] tracking-[0.2em] uppercase" style={{ color: "var(--qgi-text-dim)" }}>
        {label}
      </div>
    </div>
  );
}
