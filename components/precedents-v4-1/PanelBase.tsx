/**
 * PanelBase — V4.1 panel primitive.
 *
 * Each capability/sub-capability of the recipe report card renders inside a
 * PanelBase. Panels are dashboard-grid children (PageLayout owns the grid);
 * each panel is self-contained, ~280-440px wide, drop-in.
 *
 * Family color (Charter L1 family — e.g. Foreign Intervention = #E64545
 * Conflict & Violence) is applied as:
 *   - a thin 3px left border (the rhythm marker that replaces §NN)
 *   - chip / accent tints inside the panel (the panel's own concern)
 *   - the panel title color
 *
 * The surface STAYS dark navy (var(--qgi-surface)) — family color never
 * floods the background. This is the Sofia/Talia/Daniyar/Kwame contract;
 * every panel in V4.1 obeys it.
 *
 * Section markers (V4's monospace `§NN`) are dropped per #137. Spatial
 * position in the grid + family-color left border carry the rhythm that
 * `§07 Reliability` was carrying in the long-scroll layout.
 *
 * Dual section-pending copy (R&D Q5):
 *   sectionPending="discrimination" → "Fills after this recipe completes a
 *                                     validated walk."
 *   sectionPending="probability"    → "Fills if/when calibration clears its
 *                                     gate."
 *
 * No "M8-R5" or "Honesty regime" inline text — those facts live in tooltips
 * on score chips + tier ribbon + section-pending gates (R&D Q5).
 */
import type { ReactNode } from "react";
import { TooltipChip } from "./TooltipChip";

type SectionPending = "discrimination" | "probability" | null;

interface Props {
  /** Panel title, e.g. "Discrimination", "Indicator set", "Top scoring countries". */
  title: string;
  /**
   * Optional hover-tooltip on the title — used to surface anti-causal /
   * methodology framing without inline brand text.
   */
  titleTooltip?: string;
  /** Recipe's L1 family color (Charter — already in recipe-tracker.json). */
  familyColor: string;
  /**
   * Dual-flavor section-pending gate. When set, panel renders the pending
   * message instead of `children`. Null = panel populated normally.
   */
  sectionPending?: SectionPending;
  /**
   * Optional anchor id for permalinks (e.g. `cap-7`). Kept available because
   * the underlying URL-anchor pattern is useful for permalinks even with no
   * visible §NN chip. Not rendered as a label.
   */
  id?: string;
  /**
   * Optional right-aligned header slot (small tier chip, walk number, etc.).
   * Use sparingly — the panel's headline is the title.
   */
  headerSlot?: ReactNode;
  /** Optional one-line caption under the title (plain-English explainer). */
  caption?: string;
  children?: ReactNode;
}

const PENDING_COPY: Record<NonNullable<SectionPending>, string> = {
  discrimination: "Fills after this recipe completes a validated walk.",
  probability: "Fills if/when calibration clears its gate.",
};

const PENDING_LABEL: Record<NonNullable<SectionPending>, string> = {
  discrimination: "Awaiting walk",
  probability: "Awaiting calibration",
};

export function PanelBase({
  title,
  titleTooltip,
  familyColor,
  sectionPending = null,
  id,
  headerSlot,
  caption,
  children,
}: Props) {
  return (
    <section
      id={id}
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${familyColor}`,
        borderRadius: "6px",
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: "140px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
        }}
      >
        <h2
          style={{
            fontSize: "15px",
            fontWeight: 600,
            lineHeight: 1.25,
            margin: 0,
            color: familyColor,
            flex: 1,
            letterSpacing: "0.1px",
          }}
        >
          {title}
        </h2>
        {titleTooltip && (
          <TooltipChip
            label={`About ${title}`}
            tooltip={titleTooltip}
            accentColor={familyColor}
          />
        )}
        {headerSlot && <div style={{ flexShrink: 0 }}>{headerSlot}</div>}
      </header>

      {caption && (
        <p
          style={{
            fontSize: "12px",
            lineHeight: 1.5,
            color: "var(--qgi-text-muted)",
            margin: 0,
          }}
        >
          {caption}
        </p>
      )}

      {sectionPending ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "16px 14px",
            border: "1px dashed var(--qgi-border)",
            background: "rgba(255,255,255,0.015)",
            borderRadius: "5px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.1px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              textTransform: "uppercase",
            }}
          >
            {PENDING_LABEL[sectionPending]}
          </div>
          <div
            style={{
              fontSize: "13px",
              lineHeight: 1.5,
              color: "var(--qgi-text-muted)",
            }}
          >
            {PENDING_COPY[sectionPending]}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      )}
    </section>
  );
}
