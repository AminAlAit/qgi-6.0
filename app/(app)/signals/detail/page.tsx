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

  const corrPct = Math.round(signal.avg_correlation * 100);

  // #122: prefer the new V1.5.3 pps field; fall back to legacy pattern_power_score
  // so pre-V1.5.3 cached signals still render a score.
  const pps = signal.pps ?? signal.pattern_power_score;

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

      {/* Score card — 4 or 5 metrics depending on what V1.5.3 fields are present */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="PATTERN STRENGTH"
          value={<PpsValue pps={pps} size="md" showSuffix={signal.pps !== undefined} />}
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

      {/* #122 item 1: dual timeline — the "highest credibility per hour" viz */}
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

      {/* Forecast timing (#134) — only when present */}
      {signal.median_lead_time !== undefined && signal.median_lead_time !== null && (
        <div
          className="rounded border p-4"
          style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
        >
          <div className="text-[9px] tracking-[0.15em] uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
            Forecast Timing
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
            Historical precedents in {signal.country_b_name} preceded their matching events by a median of{" "}
            <span className="font-data font-semibold" style={{ color: "var(--qgi-amber)" }}>
              {signal.median_lead_time} year{signal.median_lead_time === 1 ? "" : "s"}
            </span>
            {signal.min_lead_time != null && signal.max_lead_time != null && (
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
        </div>
      )}

      {/* Explanation paragraph (kept from the original detail page) */}
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

      {/* #122 item 5: copy-briefing button */}
      <BriefingExport signal={signal} />

      {/* Navigate to underlying pattern — which has the full SCDI table and
          evidence depth that #122 item 2 asks for (it already exists there) */}
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
