/**
 * VocabularyQuarantineNote — the persistent reminder that "pattern" in V4 is
 * a canonical movement shape (TE language), NOT the dyadic SCDI-era pattern.
 *
 * IA-spec §1: Patterns is KEPT, vocabulary is QUARANTINED. This component is
 * the visible expression of that quarantine. It appears at the top of every
 * /patterns-v4/* surface, sized to read in two heartbeats but not so loud it
 * eats the page.
 *
 * Honesty regime (M8-R5): co-located with the anti-causal firewall, but
 * narrower in scope — this fence is about WORD MEANING, the firewall is
 * about CAUSAL LICENSE. Both apply.
 *
 * Server component.
 */
import Link from "next/link";
import type { Route } from "next";
import { Sigma } from "lucide-react";

export interface VocabularyQuarantineNoteProps {
  /** Optional compact rendering — used inside table cells or sidebar callouts. */
  variant?: "default" | "compact";
}

export function VocabularyQuarantineNote({
  variant = "default",
}: VocabularyQuarantineNoteProps) {
  if (variant === "compact") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px",
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.4)",
          borderRadius: "3px",
          fontSize: "10px",
          color: "var(--qgi-accent)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.3px",
        }}
      >
        <Sigma size={11} strokeWidth={2} />
        Pattern = canonical movement shape (Charter §3)
      </div>
    );
  }
  return (
    <aside
      role="note"
      aria-label="Vocabulary quarantine note"
      style={{
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        padding: "12px 14px",
        background: "rgba(56,189,248,0.06)",
        border: "1px solid rgba(56,189,248,0.35)",
        borderLeft: "3px solid var(--qgi-accent)",
        borderRadius: "5px",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--qgi-accent)",
          background: "rgba(56,189,248,0.12)",
          borderRadius: "5px",
        }}
      >
        <Sigma size={16} strokeWidth={2} />
      </div>
      <div
        style={{
          flex: 1,
          fontSize: "12.5px",
          lineHeight: 1.55,
          color: "var(--qgi-text)",
        }}
      >
        <div
          style={{
            fontSize: "9.5px",
            letterSpacing: "1.3px",
            color: "var(--qgi-accent)",
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            marginBottom: "4px",
          }}
        >
          VOCABULARY UPDATE · QUARANTINE LIVE
        </div>
        <p style={{ margin: 0, color: "var(--qgi-text)" }}>
          In V4, a <strong>pattern</strong> is the <em>canonical movement shape</em> of a
          recipe — the recurring 4-indicator trajectory that defines it per{" "}
          <span style={{ fontFamily: "ui-monospace, monospace" }}>
            Methodology Charter §3 (5-component recipe)
          </span>
          . The SCDI-era &ldquo;pattern&rdquo; vocabulary (dyadic country-pair
          co-movement) is being phased out from the TE surface. The legacy{" "}
          <Link
            href={"/patterns" as Route}
            style={{ color: "var(--qgi-accent)", textDecoration: "underline" }}
          >
            /patterns
          </Link>{" "}
          route stays live as a Correlation Cascade research-track surface.
        </p>
      </div>
    </aside>
  );
}
