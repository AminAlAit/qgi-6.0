"use client";

import { useState } from "react";
import taxonomyData from "@/data/taxonomy_hierarchy.json";

type Layer2 = {
  id: string;
  label: string;
  definition: string;
  layer3: string[];
};

type Layer1 = {
  id: string;
  label: string;
  display_label: string;
  definition: string;
  color_hint: string;
  layer2: Layer2[];
};

type TaxonomyData = {
  layer1: Layer1[];
};

const data = taxonomyData as TaxonomyData;

type Props = {
  /**
   * Per-L1 salience scores for the country, e.g. { "A": 0.43, "B": 0.0, ... }.
   * If null/undefined or all zero, widget renders in "data not yet available" state.
   * Source: qgi-ml/output/salience/{country}.json (eventually pipeline-recipe-engine-finalize).
   */
  l1Scores?: Record<string, number> | null;
  /**
   * Per-L2 sub-category salience, e.g. { "A1": 0.43, "A2": 0.0, ... }.
   * Used to populate the inline drill-down when an L1 card is expanded.
   */
  l2Scores?: Record<string, number> | null;
};

/**
 * 8-card Layer-1 taxonomy widget for the country profile page.
 * Implements the layered taxonomy design: always shows all 8 cards (D3),
 * color-coded by salience tier; click expands to L2 sub-categories inline.
 *
 * See ticket #231 + qgi-docs/methodology/event-taxonomy-layered-design.md
 */
export default function TaxonomyL1Widget({ l1Scores, l2Scores }: Props) {
  const [openL1, setOpenL1] = useState<string | null>(null);

  const hasData =
    l1Scores != null &&
    Object.values(l1Scores).some((v) => v > 0);

  return (
    <div
      className="rounded-lg border p-4 my-6"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Risk Domains (Layered Taxonomy)
        </h2>
        {!hasData && (
          <span
            className="text-[10px]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            salience scoring pending
          </span>
        )}
      </div>
      {/* #12: explain what the numbers mean */}
      <p
        className="text-[11px] leading-relaxed mb-4"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        These 8 cards summarize recent risk signals across the master taxonomy
        groups. Each score reflects the <strong>most recent + most impactful
        event</strong> in that domain (recency-weighted max). Higher = more
        recent activity. Click a card to see sub-categories.
      </p>

      {/* 8 L1 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {data.layer1.map((l1) => {
          const score = l1Scores?.[l1.id] ?? 0;
          const tier = scoreToTier(score);
          const isOpen = openL1 === l1.id;

          return (
            <button
              key={l1.id}
              onClick={() => setOpenL1(isOpen ? null : l1.id)}
              className="text-left rounded border p-2.5 transition-all hover:border-[var(--qgi-accent)]"
              style={{
                backgroundColor: isOpen
                  ? "var(--qgi-accent-glow)"
                  : "var(--qgi-bg)",
                borderTopColor: isOpen ? "var(--qgi-accent)" : "var(--qgi-border)",
                borderRightColor: isOpen ? "var(--qgi-accent)" : "var(--qgi-border)",
                borderBottomColor: isOpen ? "var(--qgi-accent)" : "var(--qgi-border)",
                borderLeftWidth: 3,
                borderLeftColor: l1.color_hint,
              }}
              aria-expanded={isOpen}
              title={l1.definition}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span
                  className="text-[9px] font-semibold tracking-wider uppercase"
                  style={{ color: l1.color_hint }}
                >
                  {l1.id}
                </span>
                <TierBadge tier={tier} score={score} />
              </div>
              <div
                className="text-[11px] font-medium leading-tight"
                style={{ color: "var(--qgi-text)" }}
              >
                {l1.display_label}
              </div>
              {/* #12: tier label beneath the card name */}
              <div className="text-[9px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
                {tier === "high" ? "Recent activity" :
                 tier === "moderate" ? "Active (1-3yr)" :
                 tier === "indicative" ? "Historical only" : "No events"}
              </div>
            </button>
          );
        })}
      </div>

      {/* L2 expansion */}
      {openL1 && (
        <div
          className="mt-3 rounded border p-3"
          style={{
            backgroundColor: "var(--qgi-bg)",
            borderColor: "var(--qgi-border)",
          }}
        >
          {(() => {
            const l1 = data.layer1.find((x) => x.id === openL1)!;
            return (
              <>
                <div className="mb-2">
                  <div
                    className="text-[10px] tracking-widest uppercase"
                    style={{ color: l1.color_hint }}
                  >
                    {l1.label}
                  </div>
                  <p
                    className="text-[10px] mt-0.5 leading-relaxed"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {l1.definition}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {l1.layer2.map((l2) => {
                    const l2score = l2Scores?.[l2.id] ?? 0;
                    const l2tier = scoreToTier(l2score);
                    return (
                      <div
                        key={l2.id}
                        className="rounded border px-2.5 py-1.5 flex items-center justify-between gap-2"
                        style={{
                          borderColor: "var(--qgi-border)",
                          backgroundColor: "var(--qgi-surface)",
                        }}
                      >
                        <div>
                          <div
                            className="text-[11px] font-medium"
                            style={{ color: "var(--qgi-text)" }}
                          >
                            {l2.label}
                          </div>
                          <div
                            className="text-[9px] mt-0.5"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            {l2.layer3.length} type
                            {l2.layer3.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <TierBadge tier={l2tier} score={l2score} />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mt-2 text-[9px] text-right"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Click another card to switch.
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type Tier = "high" | "moderate" | "indicative" | "none";

/**
 * Tier thresholds calibrated for Stage A salience (default severity = 0.5,
 * so scores naturally cap at ~0.5 with decay reducing them). When the
 * pipeline wires up real per-event severity (Stage B, ticket #233-B), these
 * thresholds should be re-raised toward the design-doc values
 * (high >= 0.65, moderate >= 0.4).
 *
 * Stage A interpretation:
 *  - high (>= 0.43): event in this domain within last ~1 year
 *  - moderate (>= 0.30): event within last ~3 years
 *  - indicative (> 0): older or no recent event in this domain
 */
function scoreToTier(score: number): Tier {
  if (score >= 0.43) return "high";
  if (score >= 0.3) return "moderate";
  if (score > 0) return "indicative";
  return "none";
}

function TierBadge({ tier, score }: { tier: Tier; score: number }) {
  const colors: Record<Tier, { bg: string; text: string }> = {
    high: { bg: "rgba(230, 69, 69, 0.15)", text: "#E64545" },
    moderate: { bg: "rgba(230, 143, 41, 0.15)", text: "#E68F29" },
    indicative: { bg: "rgba(230, 192, 41, 0.12)", text: "#E6C029" },
    none: { bg: "transparent", text: "var(--qgi-text-dim)" },
  };
  const c = colors[tier];
  return (
    <span
      className="font-mono text-[9px] px-1.5 py-0.5 rounded"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {score > 0 ? score.toFixed(2) : "—"}
    </span>
  );
}
