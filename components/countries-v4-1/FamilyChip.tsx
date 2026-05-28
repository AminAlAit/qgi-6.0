/**
 * FamilyChip — an L1 threat-family chip: letter glyph + label.
 *
 * Per Talia's color consult (2026-05-28): every family chip carries its
 * single-letter L1 code as a bold glyph. This is the load-bearing
 * disambiguator — it survives the residual A/F purple proximity and
 * color-blindness, where hue alone would not. Color appears as a thin
 * border + a low-alpha tint only; the surface is never flooded.
 *
 * `iconNode` — optional override for the letter glyph. When supplied (Rule 2:
 * country-scoped family chips), it renders in place of the bold letter so the
 * chip carries the top-recipe icon for that family while still showing the
 * family label. The letter remains the default when no iconNode is provided.
 */
import type { CSSProperties, ReactNode } from "react";

export function FamilyChip({
  id,
  label,
  color,
  showLabel = true,
  emphasis = false,
  iconNode,
  style,
}: {
  id: string;
  label: string;
  color: string;
  /** When false, renders just the glyph (compact). */
  showLabel?: boolean;
  /** Dominant family gets a full-perimeter border; others are quieter. */
  emphasis?: boolean;
  /**
   * Optional icon node that replaces the bold letter glyph. Used on
   * country-scoped surfaces (Rule 2) where the top-recipe icon for the
   * family conveys more information than the bare letter. Falls back to
   * the letter when omitted.
   */
  iconNode?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      title={`${id} · ${label}`}
      aria-label={`${label} family`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: showLabel ? "6px" : 0,
        fontSize: "10px",
        lineHeight: 1.4,
        padding: showLabel ? "2px 8px 2px 6px" : "2px 5px",
        border: `1px solid ${color}${emphasis ? "" : "99"}`,
        borderRadius: "3px",
        color,
        background: `${color}14`, // ~8% alpha tint, surface stays navy underneath
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {iconNode != null ? (
        <span style={{ display: "inline-flex", alignItems: "center" }}>{iconNode}</span>
      ) : (
        <span style={{ fontWeight: 700 }}>{id}</span>
      )}
      {showLabel && <span style={{ opacity: 0.95 }}>{label}</span>}
    </span>
  );
}
