/**
 * ReadThisPanel — V4.1 "How to read this tracker" panel.
 *
 * Replaces the old M8-R5 alarm box with a calm slate-blue panel that carries
 * the same substantive truths in plain language. No internal regime branding,
 * no LOCO acronym, no persona credits.
 *
 * Design idiom mirrors HowToReadPanel in components/countries-v4-1/ReadMePanels.tsx.
 */
import { Info } from "lucide-react";

const CALM_SLATE_BLUE = "#5B7E99";

const STATEMENTS: string[] = [
  "Scores rank how closely a recipe's signals resemble historical pre-event conditions. A high discrimination score means the recipe separates pre-event years from non-event years better than chance: it does not mean any country has a specific probability of an event.",
  "A recipe is considered deployed only after it clears every pre-registered validation checkpoint across held-out groups of cases. Nothing on this tracker is a forecast.",
  "Corrections are surfaced here on purpose. When a prior result does not survive audit, we withdraw it publicly and log the reason.",
  "Most recipes do not hold up. The tracker showing that clearly is the transparency signal, not a sign of failure.",
];

export function ReadThisPanel() {
  return (
    <section
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${CALM_SLATE_BLUE}`,
        borderRadius: "6px",
        padding: "16px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <Info size={14} color={CALM_SLATE_BLUE} />
        <h2
          style={{
            fontSize: "10.5px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: CALM_SLATE_BLUE,
            fontFamily: "ui-monospace, monospace",
            margin: 0,
            fontWeight: 700,
          }}
        >
          How to read this tracker
        </h2>
      </header>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {STATEMENTS.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <span
              style={{
                color: CALM_SLATE_BLUE,
                fontFamily: "ui-monospace, monospace",
                fontSize: "12px",
                lineHeight: 1.6,
                flexShrink: 0,
                fontWeight: 600,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontSize: "12px",
                lineHeight: 1.55,
                color: "var(--qgi-text-muted)",
              }}
            >
              {s}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
