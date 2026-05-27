/**
 * ExpandableShell — wraps a chart panel so the user can toggle it between
 * "default cell" and "full-row span" (not fullscreen). Floating button in
 * the top-right corner: Maximize2 → Minimize2. Grid cell takes
 * `gridColumn: 1 / -1` when expanded; the rest of the grid reflows.
 *
 * The wrapped panel doesn't need to know about expand state. Inline SVG
 * charts with `width="100%"` scale up naturally when the cell grows.
 *
 * Family color drives the button accent — matches the panel's left border.
 */
"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

interface Props {
  /** Family color (e.g. Foreign Intervention = "#E64545"). Drives button accent. */
  familyColor: string;
  /** ARIA label root, e.g. "Score distribution". The toggle button gets
   *  "Expand <label>" / "Minimize <label>" appended. */
  label: string;
  /** The chart panel (already a self-styled <section>). */
  children: ReactNode;
}

export function ExpandableShell({ familyColor, label, children }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        // Grid cell behavior: full-row span when expanded; default cell otherwise.
        // The page's grid is auto-fit minmax(340px, 1fr); "1 / -1" spans every
        // column in the current row. The chart's SVG (width 100%) scales up.
        gridColumn: expanded ? "1 / -1" : "auto",
        // A light transition on max-width so the panel doesn't pop.
        transition: "all 180ms ease-out",
      }}
    >
      {children}
      <button
        type="button"
        aria-label={expanded ? `Minimize ${label}` : `Expand ${label}`}
        aria-pressed={expanded}
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Minimize" : "Expand"}
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          width: "26px",
          height: "26px",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--qgi-bg)",
          border: `1px solid ${familyColor}`,
          borderRadius: "4px",
          color: familyColor,
          cursor: "pointer",
          transition: "background 120ms ease, transform 120ms ease",
          opacity: 0.85,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.transform = "scale(1.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.85";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {expanded ? (
          <Minimize2 size={13} strokeWidth={1.8} />
        ) : (
          <Maximize2 size={13} strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}
