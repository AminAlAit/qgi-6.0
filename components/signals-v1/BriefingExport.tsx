"use client";

/**
 * BriefingExport — one-click "copy briefing paragraph" button (#122 spec
 * item 5). Generates analyst-ready markdown text from a signal row that
 * users can paste directly into a brief or report.
 *
 * Why this matters: analysts brief their managers. Giving them the text
 * they need, in the voice they need it in, is a genuine product
 * differentiator over "here's a dashboard, figure out what to say."
 *
 * The generated text deliberately leads with the analogy ("structurally
 * analogous to X's 2005-2015 trajectory"), cites sample size + correlation
 * strength for rigor, names the predicted event category + window, and
 * acknowledges the convergence context when present (#133).
 */

import { useState } from "react";
import type { SignalRow } from "@/lib/types";

interface Props {
  signal: SignalRow;
}

/**
 * Generate the analyst-ready briefing text from a signal row.
 * Exported for unit testing.
 */
export function buildBriefing(signal: SignalRow): string {
  const avgCorrPct = Math.round(signal.avg_correlation * 100);
  const pps = signal.pps ?? signal.pattern_power_score;
  const lead = signal.median_lead_time ?? null;
  const minLead = signal.min_lead_time ?? null;
  const maxLead = signal.max_lead_time ?? null;

  // Implied event year in country A. Prefer the explicit lead time if
  // present, else derive from the historical lag in country B.
  const derivedLead = signal.event_year_b - signal.end_year_b;
  const impliedLead = lead !== null ? lead : derivedLead;
  const impliedYear = signal.end_year_a + impliedLead;
  const impliedWindow =
    minLead !== null && maxLead !== null
      ? `${signal.end_year_a + minLead}–${signal.end_year_a + maxLead}`
      : `~${impliedYear}`;

  const categoryHuman = signal.event_category.replace(/_/g, " ");
  const lines: string[] = [];

  lines.push(
    `**Pattern-matching engine identifies ${signal.country_a_name} as structurally analogous to ${signal.country_b_name}'s ${signal.start_year_b}–${signal.end_year_b} trajectory.**`
  );
  lines.push("");
  lines.push(
    `Across ${signal.indicator_count} shared macroeconomic indicators, the two countries' ${signal.length}-year pattern windows correlate at an average of ${avgCorrPct}%, yielding a Pattern Strength score of ${typeof pps === "number" ? pps.toFixed(1) : "—"}${signal.pps !== undefined ? "/100" : ""}.`
  );

  // Predicted event
  lines.push("");
  lines.push(
    `${signal.country_b_name}'s pattern concluded in ${signal.end_year_b} and was followed by "${signal.event_title_b}" (${signal.event_year_b}) — a ${categoryHuman} event. ${signal.country_a_name}'s analogous pattern ends in ${signal.end_year_a}; projecting the historical ${impliedLead}-year lead time forward suggests a similar event in the ${impliedWindow} window.`
  );

  // Convergence context (#133)
  if (signal.convergence_tier && signal.n_predictors && signal.n_predictors > 1) {
    const tierLabel =
      signal.convergence_tier === "high"
        ? "high convergence"
        : signal.convergence_tier === "multilateral"
          ? "multi-lateral convergence"
          : signal.convergence_tier === "emerging"
            ? "emerging consensus"
            : "single signal";
    lines.push("");
    lines.push(
      `This is not a standalone signal: ${signal.n_predictors} independent predictor countries across ${signal.n_regions ?? "multiple"} geographic regions produce matching forecasts for the same event category and timeframe — classified as ${tierLabel}.`
    );
  }

  // Caveats
  lines.push("");
  lines.push(
    `This is a structural analogy, not a point forecast. Confidence is bounded by pattern length (${signal.length}yr), sample correlation, and the availability of a single historical precedent. For full methodology see [QGI documentation].`
  );

  return lines.join("\n");
}

export function BriefingExport({ signal }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildBriefing(signal);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: use a temporary textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const preview = buildBriefing(signal);

  return (
    <div
      className="rounded border p-4"
      style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[9px] tracking-[0.15em] uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Briefing Text
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-1 rounded text-[10px] tracking-wider uppercase font-semibold border transition-colors"
          style={{
            borderColor: copied ? "var(--qgi-success)" : "var(--qgi-accent)",
            color: copied ? "var(--qgi-success)" : "var(--qgi-accent)",
            backgroundColor: copied ? "rgba(52, 211, 153, 0.1)" : "transparent",
          }}
        >
          {copied ? "✓ Copied" : "Copy Briefing"}
        </button>
      </div>
      <pre
        className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {preview}
      </pre>
    </div>
  );
}
