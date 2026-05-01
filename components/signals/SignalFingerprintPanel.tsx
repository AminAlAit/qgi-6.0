"use client";

/**
 * SignalFingerprintPanel — horizontal bar chart of the top-K
 * fingerprint indicators for a recipe.
 *
 * Persona design (Yuki + Lena, 2026-05-01):
 *   - Top-8 by TF-IDF score (bottom entries are noise below tfidf < 2.0)
 *   - Each bar encodes `frequency` (share of recipe instances that include
 *     the indicator), with Wilson CI whiskers for statistical honesty
 *   - avg_corr_magnitude is omitted because it is 0 for all current entries
 *     (pipeline artifact — see data note)
 *   - Mobile: show top-3 with "show all" expand
 */
import { useState } from "react";
import type { IndicatorFingerprintEntry } from "@/lib/recipes-aggregated";

interface Props {
  fingerprint: IndicatorFingerprintEntry[];
}

const DESKTOP_LIMIT = 8;
const MOBILE_LIMIT = 3;

function Bar({ entry, maxFreq }: { entry: IndicatorFingerprintEntry; maxFreq: number }) {
  const pct = (entry.frequency / maxFreq) * 100;
  const ciLowPct = (entry.ci_lower / maxFreq) * 100;
  const ciHighPct = (entry.ci_upper / maxFreq) * 100;
  const name =
    entry.indicator_name && !entry.indicator_name.startsWith("(unknown")
      ? entry.indicator_name
      : `Indicator #${entry.indicator_id}`;

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Label */}
      <div
        className="w-52 min-w-[9rem] max-w-[13rem] text-[11px] leading-tight text-right pr-2 shrink-0"
        style={{ color: "var(--qgi-text-muted)" }}
        title={name}
      >
        <span className="line-clamp-2">{name}</span>
      </div>

      {/* Bar track */}
      <div className="flex-1 relative h-5 flex items-center">
        {/* Bar fill */}
        <div
          className="h-3 rounded-sm absolute left-0"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--qgi-accent)",
            opacity: 0.75,
          }}
        />
        {/* CI whisker overlay */}
        <div
          className="absolute h-5 border-x border-white/20"
          style={{
            left: `${ciLowPct}%`,
            width: `${ciHighPct - ciLowPct}%`,
          }}
        />
      </div>

      {/* Frequency label + TF-IDF */}
      <div className="w-24 shrink-0 flex flex-col items-end">
        <span
          className="font-data text-xs font-semibold"
          style={{ color: "var(--qgi-text)" }}
        >
          {(entry.frequency * 100).toFixed(0)}%
        </span>
        <span className="font-data text-[9px]" style={{ color: "var(--qgi-text-dim)" }}>
          TF-IDF {entry.tfidf_score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function SignalFingerprintPanel({ fingerprint }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Sort by tfidf_score desc (already sorted in data, but be safe)
  const sorted = [...fingerprint].sort((a, b) => b.tfidf_score - a.tfidf_score);
  const maxFreq = Math.max(...sorted.map((e) => e.frequency), 1);

  const desktopEntries = sorted.slice(0, DESKTOP_LIMIT);
  const mobileEntries = expanded ? desktopEntries : sorted.slice(0, MOBILE_LIMIT);

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div
          className="text-[10px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Recipe Fingerprint
        </div>
        <div className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
          frequency in historical instances &nbsp;·&nbsp; Wilson 95% CI
        </div>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--qgi-text-muted)" }}>
        Indicators most characteristic of this event pattern globally — ranked by TF-IDF
        significance.
      </p>

      {/* Desktop: show top-8 */}
      <div className="hidden md:block space-y-0.5">
        {desktopEntries.map((e) => (
          <Bar key={e.indicator_id} entry={e} maxFreq={maxFreq} />
        ))}
      </div>

      {/* Mobile: show top-3 + expand */}
      <div className="md:hidden space-y-0.5">
        {mobileEntries.map((e) => (
          <Bar key={e.indicator_id} entry={e} maxFreq={maxFreq} />
        ))}
        {!expanded && desktopEntries.length > MOBILE_LIMIT && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-2 text-[10px] tracking-wider uppercase"
            style={{ color: "var(--qgi-accent)" }}
          >
            Show all {desktopEntries.length} indicators
          </button>
        )}
      </div>

      <div
        className="mt-4 pt-3 text-[10px] leading-relaxed"
        style={{
          borderTop: "1px solid var(--qgi-border)",
          color: "var(--qgi-text-dim)",
        }}
      >
        Bar width = frequency of indicator in recipe corpus. Error band = Wilson 95%
        confidence interval. Top {DESKTOP_LIMIT} of {fingerprint.length} indicators shown.
      </div>
    </div>
  );
}
