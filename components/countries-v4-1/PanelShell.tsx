/**
 * PanelShell — the V4.1 panel card frame for the country page.
 *
 * Mirrors the Recipes V4.1 panel idiom: dark navy surface, 1px border, a
 * 3px left border in the accent color, a small UPPERCASE mono eyebrow
 * title in the accent, an optional ⓘ hover tooltip, an optional caption,
 * then content. `fullWidth` makes the panel span the whole grid row.
 *
 * Accent convention on this page (Talia): structural panels (lit recipes,
 * movement, provenance) use neutral slate; the drivers pair uses the
 * top-lit family color; analogs use an archival gold; the read-me panel
 * uses a calm slate-blue. Family color never floods the surface.
 */
import type { CSSProperties, ReactNode } from "react";

export function PanelShell({
  title,
  accent,
  icon,
  caption,
  tooltip,
  fullWidth = false,
  children,
  style,
}: {
  title: string;
  accent: string;
  /** Optional leading symbol (e.g. a family-colored RecipeIcon) rendered in
   *  the accent color before the title. */
  icon?: ReactNode;
  caption?: ReactNode;
  tooltip?: string;
  fullWidth?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        gridColumn: fullWidth ? "1 / -1" : "auto",
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: "6px",
        padding: "16px 18px 18px",
        minWidth: 0,
        ...style,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: caption ? "6px" : "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          {icon && (
            <span
              style={{ display: "inline-flex", color: accent, flexShrink: 0 }}
              aria-hidden
            >
              {icon}
            </span>
          )}
          <h3
            style={{
              fontSize: "13px",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: accent,
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
        {tooltip && (
          <span
            title={tooltip}
            role="note"
            style={{
              fontSize: "10px",
              letterSpacing: "0.4px",
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
              cursor: "help",
              border: "1px solid var(--qgi-border)",
              borderRadius: "3px",
              padding: "1px 6px",
              userSelect: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            ⓘ what this means
          </span>
        )}
      </header>
      {caption && (
        <p
          style={{
            fontSize: "12px",
            lineHeight: 1.5,
            color: "var(--qgi-text-dim)",
            margin: "0 0 14px",
            maxWidth: "72ch",
          }}
        >
          {caption}
        </p>
      )}
      {children}
    </section>
  );
}
