/**
 * Cairo-school horizontal tier bar — visual shorthand for risk tier.
 *
 * A reader's eye should group HIGH / MODERATE / INDICATIVE countries
 * instantly without reading a number. This component renders a small
 * proportional bar that encodes tier as fill width + color, not an
 * abstract score.
 *
 * Design intent (Ingrid Halvorsen-Mbeki, Sard Majles S-Country):
 *   - No raw numbers on the bar itself — the tier label does the labelling
 *   - Three stops: HIGH (~80% fill), MODERATE (~50%), INDICATIVE (~25%)
 *   - Tier colors match design.ts: danger / warning / dim
 *   - Optional `showLabel` prop for contexts where prose already names the tier
 *
 * The bar is intentionally narrow (h-1.5) so it reads as a Cairo-style
 * annotation glyph alongside a country name, not a chart axis.
 */

import type { RiskTier } from "@/lib/country-risks.schema";

const TIER_CONFIG: Record<
  RiskTier,
  { fill: string; bg: string; width: string; label: string }
> = {
  HIGH: {
    fill: "#f87171", // qgi-danger
    bg: "#f8717118",
    width: "80%",
    label: "HIGH",
  },
  MODERATE: {
    fill: "#fbbf24", // qgi-warning
    bg: "#fbbf2418",
    width: "50%",
    label: "MODERATE",
  },
  INDICATIVE: {
    fill: "#4a6280", // qgi-text-dim
    bg: "#4a628018",
    width: "25%",
    label: "INDICATIVE",
  },
};

export function CairoTierBar({
  tier,
  showLabel = true,
  compact = false,
}: {
  tier: RiskTier;
  showLabel?: boolean;
  /** compact = used inline in prose; standard = standalone row element */
  compact?: boolean;
}) {
  const cfg = TIER_CONFIG[tier];
  return (
    <div
      className={compact ? "inline-flex items-center gap-1.5" : "flex items-center gap-2"}
    >
      {/* Track + fill */}
      <div
        className={compact ? "w-12 h-1" : "w-20 h-1.5"}
        style={{
          backgroundColor: cfg.bg,
          borderRadius: "2px",
          overflow: "hidden",
          flexShrink: 0,
        }}
        role="img"
        aria-label={`Risk tier: ${cfg.label}`}
      >
        <div
          style={{
            width: cfg.width,
            height: "100%",
            backgroundColor: cfg.fill,
            borderRadius: "2px",
          }}
        />
      </div>
      {showLabel && (
        <span
          className={
            compact
              ? "font-data text-[9px] tracking-widest uppercase"
              : "font-data text-[10px] tracking-widest uppercase"
          }
          style={{ color: cfg.fill, flexShrink: 0 }}
        >
          {cfg.label}
        </span>
      )}
    </div>
  );
}

/**
 * Inline tier badge — used in prose paragraphs where a full bar would
 * interrupt reading flow. Renders as a small pill with fill color.
 *
 * Example: "Iran is currently at <TierPill tier="HIGH" /> …"
 */
export function TierPill({ tier }: { tier: RiskTier }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span
      className="inline-flex items-center rounded font-data font-semibold tracking-wider px-1.5 py-0.5 text-[9px] mx-0.5 align-middle"
      style={{
        color: cfg.fill,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.fill}40`,
      }}
    >
      {cfg.label}
    </span>
  );
}

/**
 * Tier definition — plain English inline glossary for first use.
 * Renders as a parenthetical that can live in flowing prose.
 */
export function TierGloss() {
  return (
    <span
      className="text-[11px] leading-relaxed"
      style={{ color: "var(--qgi-text-dim)" }}
    >
      (
      <TierPill tier="HIGH" /> top 20% of scored countries · <TierPill tier="MODERATE" />{" "}
      next 30% · <TierPill tier="INDICATIVE" /> remaining 50%)
    </span>
  );
}
