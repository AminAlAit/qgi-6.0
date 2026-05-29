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
  "A recipe is marked Validated only after it clears every checkpoint across held-out groups of cases. Recipes In Play are in active rotation and surface results on the risk board while each pass completes. Nothing on this tracker is a forecast.",
  "When a prior result does not survive audit, we withdraw it publicly and log the reason. The corrections log is in the audit trail below.",
  "Pair strength, discrimination score, and rank are all relative measures within the recipe distribution. None is a probability of any future event.",
];

export function ReadThisPanel() {
  return (
    <section
      data-tour="read-this-panel"
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
