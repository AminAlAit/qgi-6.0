/**
 * MinorPanels — the eight smaller panels I own (orchestrator) for Recipes V4.1,
 * sitting beside the persona-built ones (Sofia: PanelBase/PageLayout/Tooltip;
 * Talia: SampleSize/Reliability/ScoreDistribution; Daniyar: PrecedentsTimeline/
 * PatternAlignment; Kwame: IndicatorSensitivity).
 *
 * All eight use Sofia's PanelBase wrapper, follow the family-color cross-cut
 * rule (thin left border + chip tints + headline color; never a flood), and
 * carry honesty via tooltips/section-pending gates (not inline disclaimers).
 *
 * Panels:
 *   - DefinitionPanel       (capability §1)
 *   - IndicatorSetPanel     (capability §2 + #5; SHAP % per indicator)
 *   - WindowPanel           (capability §3; optimal-window display)
 *   - IdentityCardPanel     (capability §5 + #142 vintage merge)
 *   - DiscriminationPanel   (capability §6 — LOCO-AUC score chip)
 *   - TopCountriesPanel     (capability §8; flags per #135)
 *   - BottomCountriesPanel  (capability §9; table form per #136)
 *   - CalibrationPanel      (capability §11 — section-pending gate)
 */
import Link from "next/link";
import type { Route } from "next";
import { PanelBase } from "./PanelBase";
import { flagFor } from "@/lib/te-mock/country-flags";
import type { IndicatorWithWeight, CountryScore } from "@/lib/te-mock/recipe-v4-1-mock";

/* ───────── §1 Definition ─────────────────────────────────────────────── */

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
      titleTooltip="The recipe's structural identity: which event the recipe is trying to discriminate. Locked at recipe creation; refines as curated events grow, never changes meaning."
      id="cap-1"
    >
      <p
        style={{
          fontSize: "14px",
          lineHeight: 1.6,
          color: "var(--qgi-text)",
          margin: 0,
        }}
      >
        {definition}
      </p>
    </PanelBase>
  );
}

/* ───────── §2 + §5 Indicator set (with SHAP %) ────────────────────────── */

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
      titleTooltip={`The ${indicators.length || "N"} ingredients whose canonical movement shape defines this recipe. Greedy selection picked these from the full V-Dem / World Bank panel; their SHAP weights sum to 100.`}
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
              >
                {ind.name}
              </div>
              <code
                style={{
                  fontSize: "10px",
                  color: "var(--qgi-text-muted)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {ind.code}
              </code>
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

/* ───────── §3 Window ─────────────────────────────────────────────────── */

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
  return (
    <PanelBase
      title="Optimal window"
      familyColor={familyColor}
      titleTooltip="How many years of indicator history before the event the recipe's canonical shape spans. Picked by the greedy walker from the 3-25y sweep."
      id="cap-3"
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
        <div
          style={{
            fontSize: "56px",
            fontWeight: 700,
            color: familyColor,
            fontFamily: "ui-monospace, monospace",
            lineHeight: 1,
            letterSpacing: "-2px",
          }}
        >
          {windowYears}
          <span style={{ fontSize: "20px", marginLeft: "2px" }}>y</span>
        </div>
        <div
          style={{ fontSize: "12px", color: "var(--qgi-text-muted)", lineHeight: 1.5 }}
        >
          {ciLow !== undefined && ciHigh !== undefined ? (
            <>
              Selected from the {ciLow}–{ciHigh}y sweep.
              <br />
              The shape spans {windowYears} years before each event.
            </>
          ) : (
            <>
              The recipe&apos;s canonical shape spans {windowYears} years before each
              event.
            </>
          )}
        </div>
      </div>
    </PanelBase>
  );
}

/* ───────── §5 + §14 Identity card (with vintage merged) ─────────────── */

export function IdentityCardPanel({
  familyColor,
  l1_id,
  l1_label,
  l2_label,
  windowYears,
  nIndicators,
  status,
  walkId,
  walkNumber,
  cohortDef,
  ratifiedBy,
  walkDate,
  vintage,
}: {
  familyColor: string;
  l1_id: string;
  l1_label: string;
  l2_label: string;
  windowYears: number;
  nIndicators: number;
  status: string;
  walkId: string;
  walkNumber: number;
  cohortDef: string;
  ratifiedBy: string;
  walkDate: string;
  vintage: string;
}) {
  return (
    <PanelBase
      title="Identity card"
      familyColor={familyColor}
      titleTooltip="The recipe's ID badge: L1/L2 taxonomic position, indicator count, window, current status, and the vintage stamp of the walk that produced these numbers."
      id="cap-5"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px 16px",
        }}
      >
        <Field label="L1 family" value={`${l1_id} · ${l1_label}`} accent={familyColor} />
        <Field label="L2 sub-class" value={l2_label} />
        <Field label="Window" value={`${windowYears}y`} />
        <Field label="Indicators" value={String(nIndicators)} />
        <Field label="Status" value={status.replace(/_/g, " ")} />
        <Field label="Tracker vintage" value={vintage} />
        {walkId && <Field label="Walk" value={`#${walkNumber} · ${walkId}`} />}
        {cohortDef && <Field label="Cohort" value={cohortDef} />}
        {ratifiedBy && <Field label="Ratified by" value={ratifiedBy} />}
        {walkDate && <Field label="Walk date" value={walkDate} />}
      </div>
    </PanelBase>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
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
          fontSize: "12.5px",
          color: accent ?? "var(--qgi-text)",
          fontWeight: 500,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ───────── §6 Discrimination — LOCO-AUC score ────────────────────────── */

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
  return (
    <PanelBase
      title="Discrimination"
      familyColor={familyColor}
      titleTooltip={`Leave-One-Cohort-Out AUC — how cleanly the recipe separates pre-event country-years from non-event ones. The pre-registered LOCK floor is ${lockFloor.toFixed(4)}; a recipe must clear it before graduation.`}
      sectionPending={!showResults || locoAuc === null ? "discrimination" : null}
      id="cap-6"
    >
      {showResults && locoAuc !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color: chipColor,
                fontFamily: "ui-monospace, monospace",
                lineHeight: 1,
                letterSpacing: "-2px",
              }}
            >
              {locoAuc.toFixed(3)}
            </div>
            <div
              style={{
                fontSize: "11.5px",
                color: "var(--qgi-text-muted)",
                lineHeight: 1.45,
              }}
            >
              LOCO-AUC ={" "}
              <strong style={{ color: chipColor, fontFamily: "ui-monospace, monospace" }}>
                {locoAuc.toFixed(4)}
              </strong>
              {ciLow !== undefined && ciHigh !== undefined && (
                <>
                  {" "}
                  · 95% CI [{ciLow.toFixed(3)}, {ciHigh.toFixed(3)}]
                </>
              )}
              <br />
              {cleared ? "Cleared LOCK floor by" : "Below LOCK floor by"}{" "}
              <strong style={{ fontFamily: "ui-monospace, monospace" }}>
                {Math.abs(locoAuc - lockFloor).toFixed(3)}
              </strong>
              .
            </div>
          </div>
        </div>
      )}
    </PanelBase>
  );
}

/* ───────── §8 Top scoring countries (with flags) ─────────────────────── */

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
      titleTooltip="Top-10 countries by discrimination rank on this recipe. Rank, not probability — a country at 98 is positioned at the top of the distribution of countries whose movement shape resembles past precedents."
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

/* ───────── §9 Bottom scoring countries (table form) ──────────────────── */

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
      titleTooltip="The lowest-scoring countries on this recipe — the structural negative space. Useful for confirming the recipe discriminates: if Switzerland and Norway sit at the bottom of a Foreign Intervention recipe, the discriminator is doing its job."
      sectionPending={!showResults || countries.length === 0 ? "discrimination" : null}
      id="cap-9"
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12.5px",
          color: "var(--qgi-text)",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--qgi-border)" }}>
            <th
              style={{
                textAlign: "left",
                padding: "6px 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: "9.5px",
                letterSpacing: "0.6px",
                color: "var(--qgi-text-dim)",
                fontWeight: 600,
              }}
            >
              #
            </th>
            <th />
            <th
              style={{
                textAlign: "left",
                padding: "6px 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: "9.5px",
                letterSpacing: "0.6px",
                color: "var(--qgi-text-dim)",
                fontWeight: 600,
              }}
            >
              Country
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "6px 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: "9.5px",
                letterSpacing: "0.6px",
                color: "var(--qgi-text-dim)",
                fontWeight: 600,
              }}
            >
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {countries.map((c, i) => (
            <tr
              key={c.name}
              style={{
                borderBottom:
                  i < countries.length - 1 ? "1px solid var(--qgi-border)" : "none",
              }}
            >
              <td
                style={{
                  padding: "8px 0",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "11px",
                  color: "var(--qgi-text-dim)",
                }}
              >
                {countries.length - i + countries.length}{" "}
                {/* show rank-from-bottom-of-roster */}
              </td>
              <td style={{ padding: "8px 0", width: "20px" }} aria-hidden>
                <span style={{ fontSize: "14px", lineHeight: 1 }}>{flagFor(c.name)}</span>
              </td>
              <td style={{ padding: "8px 0", fontSize: "13px" }}>{c.name}</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--qgi-text-muted)",
                }}
              >
                {c.score.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelBase>
  );
}

/* ───────── §11 Calibration ───────────────────────────────────────────── */

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
      titleTooltip="Calibration ECE — once the recipe graduates AND clears the ECE gate, the score in the country panels flips from a rank to a calibrated probability interval (Venn-Abers, per cohort)."
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
            Pre-reg gate: ECE ≤ 0.08.
          </div>
        </div>
      )}
    </PanelBase>
  );
}

/* ───────── Cross-link footer (deep-link to /patterns-v4/<id>) ────────── */

export function PatternCrossLinkFooter({
  familyColor,
  recipeId,
}: {
  familyColor: string;
  recipeId: string;
}) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        marginTop: "8px",
        padding: "12px 16px",
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${familyColor}`,
        borderRadius: "6px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "12px",
        color: "var(--qgi-text-muted)",
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.2px",
      }}
    >
      <span>The full canonical pattern viz lives at /patterns-v4/{recipeId}.</span>
      <Link
        href={`/patterns-v4/${recipeId}` as Route}
        style={{
          color: familyColor,
          textDecoration: "none",
          fontWeight: 600,
          border: `1px solid ${familyColor}`,
          padding: "4px 10px",
          borderRadius: "3px",
        }}
      >
        Open pattern →
      </Link>
    </div>
  );
}
