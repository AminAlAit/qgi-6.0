/**
 * IndicatorSensitivityPanel — Recipes V4.1 §Indicator sensitivity panel.
 *
 * Renders variable-N (3-5) horizontal bars labelled with real indicator names
 * (catalog names, not codes), each bar showing the AUC drop if that single
 * indicator is removed from the recipe.
 *
 * Design contract (NON-NEGOTIABLE, per R&D reply qgi-docs te-frontend-v4.1
 * 2026-05-27, Q4):
 *   - Title:   "Indicator sensitivity" (disambiguates per-indicator).
 *   - Caption: R&D-approved verbatim wording (see CAPTION constant below).
 *   - Header tooltip carries the anti-causal sentence verbatim — see
 *     ANTI_CAUSAL_TOOLTIP below. NEVER paraphrase. NEVER imply that
 *     "improving indicator X" lowers a country's risk on this recipe.
 *
 * Family color rule (see docs/precedents-v4-1-l1-color-rule.md): the L1
 * family color appears as a thin left border, chip tints, and the headline
 * accent. The surface stays dark navy; the color never floods the panel
 * background.
 *
 * No chart libraries. Inline SVG. No new dependencies.
 *
 * — Dr. Kwame Asante, Compound-Risk Political Economy
 */

import type { CSSProperties } from "react";

// === R&D-locked strings — DO NOT EDIT ===========================================
const ANTI_CAUSAL_TOOLTIP =
  "Sensitivity is structural responsiveness, never a lever to pull. " +
  "The page must never imply 'improve indicator X to lower this country's risk.'";

const CAPTION =
  "How much each ingredient carries the recipe — the AUC drop if any " +
  "single indicator were removed. If removing any one collapses the score, " +
  "the recipe is over-reliant on it.";
// ==============================================================================

export interface IndicatorSensitivity {
  /** Catalog code, e.g. "v2x_polyarchy" or "RQ.EST". Used as a stable key. */
  code: string;
  /** Catalog-canonical name, e.g. "Electoral democracy index". Rendered verbatim. */
  name: string;
  /** Data provider, e.g. "V-Dem", "World Bank WGI". Rendered as a small tag. */
  provider: string;
  /**
   * AUC drop attributable to removing this single indicator from the recipe.
   * Expressed as a non-negative number in AUC points (e.g. 0.07 means LOCO-AUC
   * falls by 0.07 if this indicator is dropped). Larger = more load-bearing.
   */
  aucDrop: number;
}

export interface IndicatorSensitivityPanelProps {
  /** L1 family color (e.g. Foreign Intervention = "#E64545"). */
  familyColor: string;
  /** 3-5 indicators. Caller decides ordering; component sorts descending by aucDrop. */
  indicators: IndicatorSensitivity[];
}

// 2026-05-27 Sonnet review P1-1: removed the prior `headerTooltip?: string`
// override prop. R&D Q4 #1 marks the anti-causal sentence as NON-NEGOTIABLE;
// an override prop made the obligation silently bypass-able by a future
// caller. The panel now renders ANTI_CAUSAL_TOOLTIP unconditionally.

// Family-color usage rule: thin border + chip tints + headline color only.
const SURFACE_BG = "var(--qgi-surface)";
const PAGE_BG = "var(--qgi-bg)";
const TEXT = "var(--qgi-text)";
const TEXT_DIM = "var(--qgi-text-dim)";
const TEXT_MUTED = "var(--qgi-text-muted)";
const BORDER = "var(--qgi-border)";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function clampIndicators(xs: IndicatorSensitivity[]): IndicatorSensitivity[] {
  // Enforce variable-N 3-5 contract. Sort descending by aucDrop so the
  // most load-bearing indicator is at the top — readers scan top-down.
  const sorted = [...xs].sort((a, b) => b.aucDrop - a.aucDrop);
  if (sorted.length < 3) return sorted; // caller error; render what we have
  if (sorted.length > 5) return sorted.slice(0, 5);
  return sorted;
}

function fmtAucDrop(d: number): string {
  // AUC drops are typically 0.01..0.12. Show two decimals; no leading +/−.
  return d.toFixed(2);
}

export function IndicatorSensitivityPanel({
  familyColor,
  indicators,
}: IndicatorSensitivityPanelProps) {
  const rows = clampIndicators(indicators);
  // Locked per R&D Q4 #1; no override path.
  const tooltip = ANTI_CAUSAL_TOOLTIP;

  // Scale bars so the largest drop fills ~92% of the track. If everything is
  // tiny, the bars stay tiny — that itself communicates "no indicator carries
  // the recipe alone," which is exactly what a healthy sensitivity profile
  // looks like.
  const maxDrop = Math.max(0.01, ...rows.map((r) => r.aucDrop));
  const trackPct = (d: number) => Math.min(100, (d / maxDrop) * 92);

  const panelStyle: CSSProperties = {
    background: SURFACE_BG,
    border: `1px solid ${BORDER}`,
    borderLeft: `3px solid ${familyColor}`,
    borderRadius: 6,
    padding: "16px 18px 18px",
    minWidth: 340,
    color: TEXT,
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  };

  const titleStyle: CSSProperties = {
    fontSize: 13,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: familyColor,
    fontFamily: MONO,
    fontWeight: 600,
  };

  const hintStyle: CSSProperties = {
    fontSize: 10,
    letterSpacing: "0.4px",
    color: TEXT_MUTED,
    fontFamily: MONO,
    cursor: "help",
    border: `1px solid ${BORDER}`,
    borderRadius: 3,
    padding: "1px 6px",
    userSelect: "none",
  };

  const captionStyle: CSSProperties = {
    fontSize: 12,
    lineHeight: 1.5,
    color: TEXT_DIM,
    marginBottom: 14,
    maxWidth: "60ch",
  };

  return (
    <section
      aria-label="Indicator sensitivity"
      style={panelStyle}
      data-panel="indicator-sensitivity"
    >
      <header style={headerStyle}>
        <h3 style={titleStyle}>Indicator sensitivity</h3>
        {/* Header tooltip carries the anti-causal sentence verbatim.
            Native `title` is intentional: works without JS, screen-reader
            accessible, no popover dependency. */}
        <span title={tooltip} aria-label={tooltip} style={hintStyle} role="note">
          ⓘ what this means
        </span>
      </header>

      <p style={captionStyle}>{CAPTION}</p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {rows.map((row) => {
          const widthPct = trackPct(row.aucDrop);

          // Family-color chip tint: thin border + low-alpha background-tint
          // proxy via the family color at reduced opacity. Surface remains
          // dark navy underneath; we never flood the row.
          const barFill = familyColor;

          return (
            <li
              key={row.code}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gridTemplateRows: "auto auto",
                columnGap: 10,
                rowGap: 4,
                alignItems: "baseline",
              }}
            >
              {/* Row 1: catalog name (left) — AUC-drop chip (right) */}
              <div
                style={{
                  fontSize: 13,
                  color: TEXT,
                  lineHeight: 1.3,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={`${row.name} (${row.code} · ${row.provider})`}
              >
                {row.name}
                <span
                  style={{
                    fontSize: 10,
                    color: TEXT_MUTED,
                    fontFamily: MONO,
                    marginLeft: 8,
                    letterSpacing: "0.3px",
                  }}
                >
                  {row.provider}
                </span>
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  color: familyColor,
                  border: `1px solid ${familyColor}`,
                  background: PAGE_BG,
                  borderRadius: 3,
                  padding: "1px 7px",
                  whiteSpace: "nowrap",
                  letterSpacing: "0.3px",
                }}
                aria-label={`AUC drop ${fmtAucDrop(row.aucDrop)}`}
              >
                −{fmtAucDrop(row.aucDrop)} AUC
              </div>

              {/* Row 2: full-width bar track + indicator code below */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <svg
                  width="100%"
                  height="10"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Removing ${row.name} drops LOCO-AUC by ${fmtAucDrop(row.aucDrop)}`}
                  style={{ display: "block" }}
                >
                  {/* Track (dark page bg, so the bar contrasts on the surface) */}
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height="10"
                    rx="2"
                    ry="2"
                    fill={PAGE_BG}
                    stroke={BORDER}
                    strokeWidth="0.5"
                  />
                  {/* Fill (family color, never floods full width unless the
                      indicator is genuinely catastrophic to remove). */}
                  <rect
                    x="0"
                    y="0"
                    width={widthPct}
                    height="10"
                    rx="2"
                    ry="2"
                    fill={barFill}
                    opacity="0.85"
                  />
                </svg>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: TEXT_MUTED,
                    letterSpacing: "0.3px",
                  }}
                >
                  {row.code}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer micro-note: scale hint. Caption already carries the meaning;
          this only tells the reader what the bar length is normalized to. */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: `1px solid ${BORDER}`,
          fontFamily: MONO,
          fontSize: 10,
          color: TEXT_MUTED,
          letterSpacing: "0.3px",
        }}
      >
        bars scaled to largest drop in this recipe · n = {rows.length}
      </div>
    </section>
  );
}

export default IndicatorSensitivityPanel;
