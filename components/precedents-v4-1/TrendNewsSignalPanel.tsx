"use client";

/**
 * TrendNewsSignalPanel — the news layer on the trend report card
 * (HF merge step 3, 2026-06-11).
 *
 * Answers "where is the news confirming THIS trend right now": every
 * covered country's trend score paired with the trend's primary news
 * theme's pulse, read on the standard 60/60 verdicts. Rows link to the
 * trend-country drilldown.
 *
 * Conventions carried from the earlier review/persona rounds: PanelShell
 * frame, ExplainTip/InfoTooltip (never title-only), thresholds stated
 * inline, sentence-case pills, "theme" noun, /100 cue, >=10.5px text,
 * methodology link in a new tab, no em-dashes.
 */

import Link from "next/link";
import type { Route } from "next";
import { PanelShell } from "@/components/countries-v4-1/PanelShell";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import type { HfVerdict } from "@/lib/hf/topics-data";
import type { TrendNewsSignal } from "@/lib/hf/trend-signal";
import { GLOBAL_PERCENTILE_NOTE, WITHIN_COUNTRY_NOTE } from "@/lib/hf/news-scale";

const VERDICT_LABEL: Record<HfVerdict, string> = {
  ACTIVE: "Active",
  SIGNAL: "Signal",
  LATENT: "Latent",
  QUIET: "Quiet",
};

const VERDICT_STYLE: Record<HfVerdict, { color: string; bg: string; border: string }> = {
  ACTIVE: {
    color: "var(--qgi-warning)",
    bg: "color-mix(in srgb, var(--qgi-warning) 13%, transparent)",
    border: "color-mix(in srgb, var(--qgi-warning) 50%, transparent)",
  },
  SIGNAL: {
    color: "var(--qgi-accent)",
    bg: "color-mix(in srgb, var(--qgi-accent) 12%, transparent)",
    border: "color-mix(in srgb, var(--qgi-accent) 50%, transparent)",
  },
  LATENT: {
    color: "var(--qgi-text-muted)",
    bg: "var(--qgi-surface-2)",
    border: "var(--qgi-border)",
  },
  QUIET: {
    color: "var(--qgi-text-dim)",
    bg: "transparent",
    border: "color-mix(in srgb, var(--qgi-border) 70%, transparent)",
  },
};

export function TrendNewsSignalPanel({
  slug,
  trendLabel,
  signal,
}: {
  slug: string;
  trendLabel: string;
  signal: TrendNewsSignal;
}) {
  const { topic, rows, pulseOnly, perTrend } = signal;

  const newsNoun = perTrend
    ? `${trendLabel.toLowerCase()} news pulse`
    : `${topic.label} news pulse`;
  const captionLead = pulseOnly
    ? `Where the news is running with the ${trendLabel.toLowerCase()} trend this month. Each covered country's ${newsNoun}`
    : `Where the news is running with the ${trendLabel.toLowerCase()} trend this month. Each covered country's trend score against the ${newsNoun}`;
  const captionTail = pulseOnly
    ? ", strongest news readings first. Open a row for the signal-by-signal view."
    : ", strongest combined readings first. Open a row for the signal-by-signal view.";
  // Per-Trend pulse is a global cross-country percentile (50 = global median);
  // the legacy crosswalk pulse is a within-country index (50 = own normal).
  const tipBasis = perTrend
    ? "How much of the country's news coverage runs on this trend, ranked across every covered country and month. 50 is the global median for this trend; 60 and above counts as elevated."
    : "How much of the country's news coverage runs on this trend, measured against its own history. 50 is the country's normal month; 60 and above counts as elevated.";
  const tipComposite =
    !perTrend && !pulseOnly
      ? ` This panel reads each country's score on this specific trend; the Risk Board reads the broader ${topic.label} composite, so the two can differ.`
      : "";
  const panelTip = pulseOnly
    ? "This trend's news pulse: how much of each country's coverage runs on the trend each month, ranked across every covered country and month (50 is the global median). This trend is shown news-only; the verdict reads the pulse alone, elevated from 60 upward."
    : perTrend
      ? "This trend's news pulse: how much of each country's coverage runs on the trend each month, ranked across every covered country and month (50 is the global median). The verdict pairs that pulse with the country's score on this trend; both count as elevated from 60 upward."
      : `This trend's news comes through the ${topic.label} theme: how much of each country's news coverage runs on that theme each month, against the country's own normal of 50. The verdict pairs that pulse with the country's score on this trend; both count as elevated from 60 upward.`;

  return (
    <PanelShell
      title="News signal"
      accent="var(--qgi-accent)"
      tooltip={panelTip}
      caption={
        <>
          {captionLead}
          <InfoTooltip text={`${tipBasis}${tipComposite}`} />
          {captionTail}
        </>
      }
      fullWidth
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))",
          gap: "8px",
        }}
      >
        {rows.map((r) => {
          const vs = VERDICT_STYLE[r.verdict];
          const inner = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                padding: "9px 12px",
                background: "var(--qgi-bg)",
                border: "1px solid var(--qgi-border)",
                borderRadius: "6px",
                minWidth: 0,
              }}
            >
              <FlagImg emoji={flagFor(r.name)} name={r.name} width={16} radius={2} />
              <span
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.name}
              </span>
              <span
                className="font-data"
                title={
                  r.struct == null
                    ? `News pulse ${Math.round(r.pulse)} (news only — no structural axis)`
                    : `Trend score ${Math.round(r.struct)} · news pulse ${Math.round(r.pulse)}`
                }
                style={{
                  fontSize: "11px",
                  color: "var(--qgi-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {r.struct == null
                  ? `news ${Math.round(r.pulse)}`
                  : `${Math.round(r.struct)} · ${Math.round(r.pulse)}`}
              </span>
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  padding: "2px 8px",
                  borderRadius: "9px",
                  color: vs.color,
                  background: vs.bg,
                  border: `1px solid ${vs.border}`,
                  whiteSpace: "nowrap",
                }}
              >
                {VERDICT_LABEL[r.verdict]}
              </span>
            </div>
          );
          return r.iso2 ? (
            <Link
              key={r.iso3}
              href={`/trends/${slug}/countries/${r.iso2}` as Route}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {inner}
            </Link>
          ) : (
            <span key={r.iso3}>{inner}</span>
          );
        })}
      </div>

      {/* Legend + methodology link (same idiom as the country page) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
          marginTop: "12px",
          fontSize: "11px",
          color: "var(--qgi-text-muted)",
        }}
      >
        {(Object.keys(VERDICT_STYLE) as HfVerdict[]).map((v) => (
          <span
            key={v}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: VERDICT_STYLE[v].color,
              }}
            />
            {VERDICT_LABEL[v]}
            <InfoTooltip text={signal.verdicts[v]} />
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <Link
          href={"/methodology#news-layer" as Route}
          target="_blank"
          rel="noopener"
          style={{ color: "var(--qgi-accent)", textDecoration: "none", fontSize: "11px" }}
        >
          How verdicts are assigned →
        </Link>
      </div>

      <p
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          margin: "10px 0 0",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.3px",
        }}
      >
        {pulseOnly
          ? "The number is the news pulse, 0 to 100 — this trend carries no structural axis."
          : "The numbers read trend score · news pulse, both 0 to 100."}
        {` ${perTrend ? GLOBAL_PERCENTILE_NOTE : WITHIN_COUNTRY_NOTE}`}
        {" Pulse updates monthly."}
        {signal.notScored.length > 0 &&
          ` ${signal.notScored.join(" and ")} ${signal.notScored.length === 1 ? "is" : "are"} not scored on this trend (indicator coverage), so ${signal.notScored.length === 1 ? "it does" : "they do"} not appear here.`}
      </p>
    </PanelShell>
  );
}
