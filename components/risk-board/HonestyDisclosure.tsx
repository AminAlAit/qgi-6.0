/**
 * Honesty-regime disclosure block (M8-R5). Surfaces the discrimination-vs-
 * probability contract directly on the page. Lifted in tone from the
 * §11 calibration block in RecipeDetail.tsx so the two pages feel cousin.
 */
export function HonestyDisclosure() {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--qgi-border)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: "6px",
        borderLeft: "3px solid #E68F29",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "1.2px",
          color: "#E68F29",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "6px",
        }}
      >
        HONESTY-REGIME DISCLOSURE · M8-R5
      </div>
      <p
        style={{
          fontSize: "13px",
          color: "var(--qgi-text)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Scores on this board are <strong>discrimination ranks, not probabilities</strong>.
        A country positioned at 80 is not &quot;80% likely&quot; to experience the event —
        it sits high in the distribution of countries whose recent movement shape
        resembles the recipe. Movements over time describe{" "}
        <strong>rank shifts and decile movement</strong>, never forward odds. No row makes
        a forward-dated claim; the Trajectory Engine measures present-tense resemblance
        only.
      </p>
    </div>
  );
}
