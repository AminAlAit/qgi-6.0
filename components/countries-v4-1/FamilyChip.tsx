/**
 * FamilyChip — an L1 threat-family chip: letter glyph + label.
 *
 * Per Talia's color consult (2026-05-28): every family chip carries its
 * single-letter L1 code as a bold glyph. This is the load-bearing
 * disambiguator — it survives the residual A/F purple proximity and
 * color-blindness, where hue alone would not. Color appears as a thin
 * border + a low-alpha tint only; the surface is never flooded.
 */
import type { CSSProperties } from "react";

export function FamilyChip({
  id,
  label,
  color,
  showLabel = true,
  emphasis = false,
  style,
}: {
  id: string;
  label: string;
  color: string;
  /** When false, renders just the letter glyph (compact). */
  showLabel?: boolean;
  /** Dominant family gets a full-perimeter border; others are quieter. */
  emphasis?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      title={`${id} · ${label}`}
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
      <span style={{ fontWeight: 700 }}>{id}</span>
      {showLabel && <span style={{ opacity: 0.95 }}>{label}</span>}
    </span>
  );
}
