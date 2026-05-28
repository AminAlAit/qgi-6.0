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
/**
 * Verdict union widened 2026-05-29 for TE sample-10 wire-up.
 *
 * Cards in sample-10 carry verdicts in the pipeline taxonomy:
 *   LOCK / HARD_FAIL / MARGINAL_PENDING_BETA_CALIBRATION / COVERAGE_FAIL /
 *   DID_NOT_HOLD (cascade-era)
 *
 * The user-facing labels still collapse to four buckets — "validated",
 * "did not hold up", "held back", "under re-evaluation" — so the chip
 * stays calm and there's no jargon leak.
 */
type Verdict =
  | "LOCK"
  | "HARD_FAIL"
  | "MARGINAL"
  | "MARGINAL_PENDING_BETA_CALIBRATION"
  | "COVERAGE_FAIL"
  | "DID_NOT_HOLD"
  | "VACATED";

const VERDICT_COLOR: Record<Verdict, string> = {
  LOCK: "#3FBF8F",
  HARD_FAIL: "#E64545",
  MARGINAL: "#E68F29",
  MARGINAL_PENDING_BETA_CALIBRATION: "#E68F29",
  COVERAGE_FAIL: "#9AA3AD",
  DID_NOT_HOLD: "#E64545",
  VACATED: "#E68F29",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  LOCK: "Validated",
  HARD_FAIL: "Did not hold up",
  MARGINAL: "Held back",
  MARGINAL_PENDING_BETA_CALIBRATION: "Held back",
  COVERAGE_FAIL: "Insufficient coverage",
  DID_NOT_HOLD: "Did not hold up",
  VACATED: "Under re-evaluation",
};

const VERDICT_CAPTION: Record<Verdict, string> = {
  LOCK: "The recipe cleared every pre-registered check (discrimination floor, separation power, out-of-time recall). It is eligible for the live risk board.",
  HARD_FAIL:
    "The recipe failed at least one pre-registered check. It is publicly reported, not deployed, and stays in the queue for re-walk if the methodology is amended.",
  MARGINAL:
    "The recipe cleared the discrimination floor but missed a secondary check. It is held pending a follow-up walk; no live deployment yet.",
  MARGINAL_PENDING_BETA_CALIBRATION:
    "The recipe cleared discrimination but its probability calibration is not yet computed for this vintage. The rank is reliable; the probability is not.",
  COVERAGE_FAIL:
    "The recipe did not have enough qualifying historical events across cohorts to meet the discrimination test. The walk fired but cannot yet be scored.",
  DID_NOT_HOLD:
    "The recipe held in earlier methodology rounds but failed a later check. It is publicly reported and held back pending re-walk.",
  // 2026-05-28 (#1): the vacate/leak narrative is internal — it belongs on
  // /recipe-tracker + the blog, not on the user-facing recipe page. Keep this
  // confident and minimal; the up-to-date status pointer lives in the page
  // header's demo-disclosure when applicable.
  VACATED: "Under re-evaluation.",
};

export function ReliabilityPanel({
  familyColor,
  v1SeparationPp,
  v4OotRecallPct,
  verdict,
}: {
  familyColor: string;
  /** Null = first vintage / not yet computed. Renders the disclosure tile. */
  v1SeparationPp: number | null;
  /** Null = first vintage / not yet computed. Renders the disclosure tile. */
  v4OotRecallPct: number | null;
  /** Retained in the prop signature for upstream-bake compatibility; the
   *  page no longer renders a "Walks completed" tile (#159). Callers may
   *  pass the value without effect. */
  walksCompleted?: number;
  /** Accepts both the four canonical buckets and the pipeline-emitted
   *  verdicts; both map to the same four user-facing labels. */
  verdict: Verdict | string;
}) {
  // Normalize unknown verdict strings to VACATED so we never crash on a
  // future pipeline string.
  const v: Verdict = (verdict in VERDICT_COLOR ? verdict : "VACATED") as Verdict;
  const verdictColor = VERDICT_COLOR[v];

  return (
    <section
      aria-labelledby="reliability-panel-heading"
      data-tour="reliability-panel"
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
        <h2
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
        </h2>
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
          value={v1SeparationPp == null ? "—" : `+${v1SeparationPp.toFixed(1)}pp`}
          caption={
            v1SeparationPp == null
              ? "Separation power is computed across multiple validation passes. This is the first vintage of this recipe; the metric becomes available from the next quarterly run."
              : "How cleanly the recipe separates pre-event country-years from non-event ones. The gap, in percentile points, between the two groups' median similarity. Pre-registered validation bar is +20pp; higher is better."
          }
          valueColor={
            v1SeparationPp == null
              ? "var(--qgi-text-muted)"
              : v1SeparationPp >= 20
                ? "#3FBF8F"
                : "#E68F29"
          }
        />
        <Metric
          label="Out-of-time accuracy"
          value={v4OotRecallPct == null ? "—" : `${v4OotRecallPct.toFixed(1)}%`}
          caption={
            v4OotRecallPct == null
              ? "Out-of-time accuracy is computed across multiple validation passes. This is the first vintage of this recipe; the metric becomes available from the next quarterly run."
              : "Of crisis country-years held out of training (post-2005 events), the share the recipe still ranked HIGH one year before the event. Pre-registered validation bar is 60%."
          }
          valueColor={
            v4OotRecallPct == null
              ? "var(--qgi-text-muted)"
              : v4OotRecallPct >= 60
                ? "#3FBF8F"
                : "#E68F29"
          }
        />
        <Metric
          label="Verdict"
          value={VERDICT_LABEL[v]}
          caption={VERDICT_CAPTION[v]}
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
