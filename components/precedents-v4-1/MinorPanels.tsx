/**
 * MinorPanels — smaller panels for Recipes V4.1.
 *
 * Polish pass (Sofia, 2026-05-27 — #153 / #154 / #155 / #156):
 *   - DefinitionPanel still exported for back-compat but no longer used
 *     by the V4.1 page (Definition now lives in PageLayout's header lede).
 *   - IdentityCardPanel slimmed: walk metadata + window dropped. Status
 *     renders as a user-facing phrase (formatStatus), not the raw enum.
 *   - WindowPanel + DiscriminationPanel get de-jargonized captions while
 *     preserving methodology meaning (R&D Q5 binds the FACT, not the
 *     word "LOCK"); technical readers find the threshold in the tooltip.
 *   - All "gate" / "walk" / "walked_no_graduation" phrasing scrubbed
 *     from visible copy.
 */
import type { ReactNode } from "react";
import { PanelBase } from "./PanelBase";
import { flagFor } from "@/lib/te-mock/country-flags";
import type { IndicatorWithWeight, CountryScore } from "@/lib/te-mock/recipe-v4-1-mock";

/* ───────── DefinitionPanel (deprecated — kept for compat) ──────────── */
export function DefinitionPanel({
  familyColor,
  definition,
}: {
  familyColor: string;
  definition: string;
}) {
  return (
    <PanelBase
      title="Definition"
      familyColor={familyColor}
      titleTooltip="The recipe's structural identity. Locked at recipe creation; refines as curated events grow."
      id="cap-1"
    >
      <p
        style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--qgi-text)", margin: 0 }}
      >
        {definition}
      </p>
    </PanelBase>
  );
}

/* ───────── IndicatorSet (with SHAP %) ───────────────────────────────── */

export function IndicatorSetPanel({
  familyColor,
  indicators,
}: {
  familyColor: string;
  indicators: IndicatorWithWeight[];
}) {
  const hasWeights =
    indicators.length > 0 && indicators.every((i) => typeof i.shapWeightPct === "number");
  return (
    <PanelBase
      title="Indicator set"
      familyColor={familyColor}
      titleTooltip={`The ${indicators.length || "N"} ingredients whose canonical movement shape defines this recipe. Their weights sum to 100% across the selected set.`}
      caption={
        indicators.length > 0
          ? `${indicators.length} indicators · weights sum to 100% across the selected set`
          : undefined
      }
      sectionPending={indicators.length === 0 ? "discrimination" : null}
      id="cap-2"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {indicators.map((ind) => (
          <div
            key={ind.code}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: "10px",
              alignItems: "center",
              padding: "8px 10px",
              background: "var(--qgi-bg)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "9.5px",
                  letterSpacing: "0.6px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                  marginBottom: "2px",
                  textTransform: "uppercase",
                }}
              >
                {ind.provider}
              </div>
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--qgi-text)",
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
                title={ind.code}
              >
                {ind.name}
              </div>
              {/* 2026-05-27 (#159): raw indicator code (e.g. v2pepwrgen) removed
                  from visible row; available on hover via the title attribute. */}
            </div>
            {hasWeights && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "4px",
                  minWidth: "90px",
                }}
              >
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: familyColor,
                    letterSpacing: "-0.3px",
                  }}
                >
                  {ind.shapWeightPct.toFixed(0)}%
                </div>
                <svg
                  width="80"
                  height="6"
                  viewBox="0 0 80 6"
                  style={{ display: "block" }}
                >
                  <rect
                    x="0"
                    y="0"
                    width="80"
                    height="6"
                    rx="1"
                    fill="var(--qgi-bg)"
                    stroke="var(--qgi-border)"
                    strokeWidth="0.5"
                  />
                  <rect
                    x="0"
                    y="0"
                    width={(ind.shapWeightPct / 100) * 80}
                    height="6"
                    rx="1"
                    fill={familyColor}
                    opacity="0.85"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelBase>
  );
}

/* ───────── Optimal window (#156 polish) ─────────────────────────────── */

export function WindowPanel({
  familyColor,
  windowYears,
  ciLow,
  ciHigh,
}: {
  familyColor: string;
  windowYears: number;
  ciLow?: number;
  ciHigh?: number;
}) {
  const sweepCopy =
    ciLow !== undefined && ciHigh !== undefined
      ? `Chosen from a search across ${ciLow}–${ciHigh} years of history.`
      : null;
  return (
    <PanelBase
      title="Optimal window"
      familyColor={familyColor}
      titleTooltip="How many years of indicator history before the event the recipe's canonical shape spans."
      id="cap-3"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "2px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
          <span
            style={{
              fontSize: "64px",
              fontWeight: 700,
              color: familyColor,
              fontFamily: "ui-monospace, monospace",
              lineHeight: 0.95,
              letterSpacing: "-2.5px",
            }}
          >
            {windowYears}
          </span>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.5px",
              paddingBottom: "8px",
              textTransform: "uppercase",
            }}
          >
            years
          </span>
        </div>
        <p
          style={{
            fontSize: "12.5px",
            lineHeight: 1.55,
            color: "var(--qgi-text-muted)",
            margin: 0,
          }}
        >
          The recipe&apos;s canonical shape spans the {windowYears} years leading up to
          each event.
          {sweepCopy ? (
            <>
              {" "}
              <span style={{ color: "var(--qgi-text-dim)" }}>{sweepCopy}</span>
            </>
          ) : null}
        </p>
      </div>
    </PanelBase>
  );
}

/* ───────── Identity card (merged with sample-size — #161 / Sofia 2026-05-27) ─── */
/*                                                                                  */
/* Founder #161: Sample-size sufficiency stops being a sibling panel; its           */
/* user-facing essence (real-world case count + an "is the recipe big enough        */
/* to be evaluated" yes/no) folds into Identity card. The "LOCO cohorts" tile       */
/* and the "≥60-pos" jargon are gone from visible copy. Threshold detail stays      */
/* in the tooltip for technical readers. R&D Q5 binding preserved.                  */

const STATUS_LABELS: Record<string, string> = {
  graduated: "Graduated",
  in_validation: "In validation",
  walked_no_graduation: "Reviewed, not graduated",
  vacated: "Graduation vacated",
  queued: "Queued",
  retired: "Retired",
  live_legacy: "Live (legacy)",
  in_progress: "In progress",
};

function formatStatus(raw: string): string {
  if (STATUS_LABELS[raw]) return STATUS_LABELS[raw];
  const friendly = raw.replace(/_/g, " ").toLowerCase();
  return friendly.charAt(0).toUpperCase() + friendly.slice(1);
}

export function IdentityCardPanel({
  familyColor,
  l1_id,
  l1_label,
  l2_label,
  nIndicators,
  status,
  vintage,
  nPositives,
  thresholdMet,
}: {
  familyColor: string;
  l1_id: string;
  l1_label: string;
  l2_label: string;
  nIndicators: number;
  status: string;
  vintage: string;
  /** Curated count of documented real-world cases of this event. */
  nPositives: number;
  /** Whether the corpus is large enough for the recipe to be evaluated. */
  thresholdMet: boolean;
}) {
  const eligibleColor = thresholdMet ? "#3FBF8F" : "#E68F29";
  const eligibleLabel = thresholdMet ? "Eligible for evaluation" : "Not yet eligible";
  return (
    <PanelBase
      title="Identity card"
      familyColor={familyColor}
      titleTooltip="The recipe's ID badge: taxonomic position, indicator count, current status, vintage, and the size of the curated case corpus. Recipes need at least 60 verified positives before the discrimination assessment can run."
      id="cap-5"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "14px 18px",
        }}
      >
        <Field label="L1 family" value={`${l1_id} · ${l1_label}`} accent={familyColor} />
        <Field label="L2 sub-class" value={l2_label} />
        <Field label="Indicators" value={String(nIndicators)} />
        <Field label="Status" value={formatStatus(status)} />
        <Field label="Tracker vintage" value={vintage} />
        <Field
          label="Real-world cases"
          value={nPositives.toLocaleString()}
          inlineChip={
            <span
              title={
                thresholdMet
                  ? "The curated corpus is large enough for the recipe to be honestly assessed."
                  : "The curated corpus is not yet large enough for an honest assessment. More cases are being collected."
              }
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.6px",
                fontFamily: "ui-monospace, monospace",
                color: eligibleColor,
                border: `1px solid ${eligibleColor}`,
                borderRadius: "3px",
                padding: "1px 6px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {eligibleLabel}
            </span>
          }
        />
      </div>
    </PanelBase>
  );
}

function Field({
  label,
  value,
  accent,
  inlineChip,
}: {
  label: string;
  value: string;
  accent?: string;
  inlineChip?: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.7px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "3px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: "12.5px",
            color: accent ?? "var(--qgi-text)",
            fontWeight: 500,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {value}
        </div>
        {inlineChip}
      </div>
    </div>
  );
}

/* ───────── Discrimination (#156 polish — de-jargonized caption) ─────── */

export function DiscriminationPanel({
  familyColor,
  locoAuc,
  ciLow,
  ciHigh,
  lockFloor = 0.7986,
  showResults,
}: {
  familyColor: string;
  locoAuc: number | null;
  ciLow?: number;
  ciHigh?: number;
  lockFloor?: number;
  showResults: boolean;
}) {
  const cleared = locoAuc !== null && locoAuc >= lockFloor;
  const chipColor = cleared ? "#3FBF8F" : "#E68F29";
  const distance = locoAuc !== null ? Math.abs(locoAuc - lockFloor) : 0;
  const verdictCopy = cleared
    ? `Above the validation threshold by ${distance.toFixed(3)}.`
    : `Below the validation threshold by ${distance.toFixed(3)}.`;
  return (
    <PanelBase
      title="Discrimination"
      familyColor={familyColor}
      titleTooltip={`Leave-One-Cohort-Out AUC. How cleanly the recipe separates pre-event country-years from non-event ones. The pre-registered validation threshold is ${lockFloor.toFixed(4)}; a recipe must clear it before graduation.`}
      sectionPending={!showResults || locoAuc === null ? "discrimination" : null}
      id="cap-6"
    >
      {showResults && locoAuc !== null && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "2px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}>
            <span
              style={{
                fontSize: "56px",
                fontWeight: 700,
                color: chipColor,
                fontFamily: "ui-monospace, monospace",
                lineHeight: 0.95,
                letterSpacing: "-2px",
              }}
            >
              {locoAuc.toFixed(3)}
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.6px",
                paddingBottom: "10px",
                textTransform: "uppercase",
              }}
            >
              Discrimination score
            </span>
          </div>
          <p
            style={{
              fontSize: "12.5px",
              lineHeight: 1.55,
              color: "var(--qgi-text-muted)",
              margin: 0,
            }}
          >
            <span style={{ color: chipColor, fontWeight: 600 }}>{verdictCopy}</span>
            {ciLow !== undefined && ciHigh !== undefined && (
              <>
                {" "}
                <span style={{ color: "var(--qgi-text-dim)" }}>
                  95% confidence interval{" "}
                  <code
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      color: "var(--qgi-text-muted)",
                    }}
                  >
                    [{ciLow.toFixed(3)}, {ciHigh.toFixed(3)}]
                  </code>
                  .
                </span>
              </>
            )}
          </p>
        </div>
      )}
    </PanelBase>
  );
}

/* ───────── Top scoring countries (deprecated — Talia's CountriesPanel replaces) ─── */

export function TopCountriesPanel({
  familyColor,
  countries,
  showResults,
}: {
  familyColor: string;
  countries: CountryScore[];
  showResults: boolean;
}) {
  return (
    <PanelBase
      title="Top scoring countries"
      familyColor={familyColor}
      titleTooltip="Top-10 by discrimination rank on this recipe."
      sectionPending={!showResults || countries.length === 0 ? "discrimination" : null}
      id="cap-8"
    >
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {countries.map((c, i) => (
          <li
            key={c.name}
            style={{
              display: "grid",
              gridTemplateColumns: "22px 18px minmax(0, 1fr) auto",
              gap: "8px",
              alignItems: "center",
              padding: "8px 0",
              borderBottom:
                i < countries.length - 1 ? "1px solid var(--qgi-border)" : "none",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "10.5px",
                color: "var(--qgi-text-dim)",
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: "15px", lineHeight: 1 }} aria-hidden>
              {flagFor(c.name)}
            </span>
            <span style={{ fontSize: "13px", color: "var(--qgi-text)" }}>{c.name}</span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "13px",
                color: familyColor,
                fontWeight: 700,
              }}
            >
              {c.score.toFixed(1)}
            </span>
          </li>
        ))}
      </ol>
    </PanelBase>
  );
}

export function BottomCountriesPanel({
  familyColor,
  countries,
  showResults,
}: {
  familyColor: string;
  countries: CountryScore[];
  showResults: boolean;
}) {
  return (
    <PanelBase
      title="Bottom scoring countries"
      familyColor={familyColor}
      titleTooltip="The lowest-scoring countries on this recipe: the structural negative space."
      sectionPending={!showResults || countries.length === 0 ? "discrimination" : null}
      id="cap-9"
    >
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {countries.map((c, i) => (
          <li
            key={c.name}
            style={{
              display: "grid",
              gridTemplateColumns: "22px 18px minmax(0, 1fr) auto",
              gap: "8px",
              alignItems: "center",
              padding: "8px 0",
              borderBottom:
                i < countries.length - 1 ? "1px solid var(--qgi-border)" : "none",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "10.5px",
                color: "var(--qgi-text-dim)",
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: "15px", lineHeight: 1 }} aria-hidden>
              {flagFor(c.name)}
            </span>
            <span style={{ fontSize: "13px", color: "var(--qgi-text)" }}>{c.name}</span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "13px",
                color: "var(--qgi-text-muted)",
                fontWeight: 700,
              }}
            >
              {c.score.toFixed(1)}
            </span>
          </li>
        ))}
      </ol>
    </PanelBase>
  );
}

/* ───────── Calibration ──────────────────────────────────────────────── */

export function CalibrationPanel({
  familyColor,
  showCalibrationData,
  ece,
}: {
  familyColor: string;
  showCalibrationData: boolean;
  ece?: number;
}) {
  return (
    <PanelBase
      title="Calibration"
      familyColor={familyColor}
      titleTooltip="Once the recipe graduates and clears the calibration threshold, the score in country panels flips from a rank to a calibrated probability interval (Venn-Abers, per cohort)."
      sectionPending={showCalibrationData ? null : "probability"}
      id="cap-11"
    >
      {showCalibrationData && ece !== undefined && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
          <div
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: familyColor,
              fontFamily: "ui-monospace, monospace",
              lineHeight: 1,
            }}
          >
            {ece.toFixed(3)}
          </div>
          <div
            style={{ fontSize: "12px", color: "var(--qgi-text-muted)", lineHeight: 1.5 }}
          >
            Expected Calibration Error (ECE).
            <br />
            Pre-registered threshold: ECE ≤ 0.08.
          </div>
        </div>
      )}
    </PanelBase>
  );
}
