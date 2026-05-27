/**
 * Reliability panel (capability #7) — V4.1, #139 + #159/#160 polish.
 *
 * Polish pass (Talia, 2026-05-27):
 *   - "V1 SEPARATION" tile renamed to "Separation power" (friendlier).
 *   - "V4 OOT RECALL" tile renamed to "Out-of-time accuracy" (friendlier).
 *   - "Walks completed" tile dropped per founder approval — number was
 *     opaque to non-methodologists; the verdict already telegraphs walk
 *     state, and methodology-curious readers can reach the pre-reg.
 *   - Caption for Separation power: R&D Q8-locked descriptive sentence
 *     retained VERBATIM; threshold-mention line polished from "Pre-
 *     registered LOCK floor is +20pp" to "Pre-registered validation
 *     bar is +20pp" (drops the "LOCK" jargon without losing the fact).
 *   - Caption for Out-of-time accuracy: identical polish — "LOCK floor"
 *     → "validation bar".
 *
 * Verdict chip color still reflects LOCK (green) / HARD_FAIL (red) /
 * MARGINAL/VACATED (amber); the verdict CAPTION (R&D Q8-locked) is the
 * friendly user-facing surface.
 */
type Verdict = "LOCK" | "HARD_FAIL" | "MARGINAL" | "VACATED";

const VERDICT_COLOR: Record<Verdict, string> = {
  LOCK: "#3FBF8F",
  HARD_FAIL: "#E64545",
  MARGINAL: "#E68F29",
  VACATED: "#E68F29",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  LOCK: "LOCK",
  HARD_FAIL: "HARD-FAIL",
  MARGINAL: "MARGINAL",
  VACATED: "VACATED",
};

const VERDICT_CAPTION: Record<Verdict, string> = {
  LOCK: "The recipe cleared every pre-registered gate (discrimination floor, V1 separation, V4 OOT recall). It is eligible for the live risk board.",
  HARD_FAIL:
    "The recipe failed at least one pre-registered gate. It is publicly reported, not deployed, and stays in the queue for re-walk if the methodology is amended.",
  MARGINAL:
    "The recipe cleared the discrimination floor but missed a secondary gate. It is held pending a follow-up walk; no live deployment yet.",
  VACATED:
    "A prior graduation was withdrawn after a leak or methodology error was discovered. The recipe re-enters the queue under the corrected protocol.",
};

export function ReliabilityPanel({
  familyColor,
  v1SeparationPp,
  v4OotRecallPct,
  verdict,
}: {
  familyColor: string;
  v1SeparationPp: number;
  v4OotRecallPct: number;
  /** Retained in the prop signature for upstream-bake compatibility; the
   *  page no longer renders a "Walks completed" tile (#159). Callers may
   *  pass the value without effect. */
  walksCompleted?: number;
  verdict: Verdict;
}) {
  const verdictColor = VERDICT_COLOR[verdict];

  return (
    <section
      aria-labelledby="reliability-panel-heading"
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${familyColor}`,
        borderRadius: "6px",
        padding: "18px 20px 20px",
        minWidth: "340px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <header>
        <h3
          id="reliability-panel-heading"
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: familyColor,
            margin: 0,
            letterSpacing: "0.1px",
          }}
        >
          Reliability
        </h3>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px 14px",
        }}
      >
        <Metric
          label="Separation power"
          value={`+${v1SeparationPp.toFixed(1)}pp`}
          caption="How cleanly the recipe separates pre-event country-years from non-event ones — the gap, in percentile points, between the two groups' median similarity. Pre-registered validation bar is +20pp; higher is better."
          valueColor={v1SeparationPp >= 20 ? "#3FBF8F" : "#E68F29"}
        />
        <Metric
          label="Out-of-time accuracy"
          value={`${v4OotRecallPct.toFixed(1)}%`}
          caption="Of crisis country-years held out of training (post-2005 events), the share the recipe still ranked HIGH one year before the event. Pre-registered validation bar is 60%."
          valueColor={v4OotRecallPct >= 60 ? "#3FBF8F" : "#E68F29"}
        />
        <Metric
          label="Verdict"
          value={VERDICT_LABEL[verdict]}
          caption={VERDICT_CAPTION[verdict]}
          valueColor={verdictColor}
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  caption,
  valueColor,
}: {
  label: string;
  value: string;
  caption: string;
  valueColor: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div
        style={{
          fontSize: "9.5px",
          letterSpacing: "1px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "22px",
          fontWeight: 600,
          lineHeight: 1,
          color: valueColor,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "11px",
          lineHeight: 1.5,
          color: "var(--qgi-text-muted)",
        }}
      >
        {caption}
      </div>
    </div>
  );
}
