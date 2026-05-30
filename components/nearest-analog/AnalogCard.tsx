/**
 * AnalogCard — a single historical-analog card showing one nearest-neighbour
 * match for the current country: country+year, match score, the primary
 * recipe that drove the match, the trajectory overlay sparkline, and the
 * "what happened next" historical fact.
 *
 * Server component. The trajectory overlay is rendered as inline SVG by
 * TrajectorySparkline (no client interactivity).
 *
 * Honesty constraints:
 * - "what_happened_next" is HISTORICAL FACT about the analog country, never a
 *   forecast about the current country.
 * - Weak analogs (match_score < 70) carry a visible weak-match chip per
 *   ledger Feature 12 ("match-quality floor 0.70 — 'weak analog'").
 * - The regional-clustering caveat is shown on the parent results panel,
 *   not repeated on every card.
 */
import { getRecipe } from "@/lib/te-mock/recipes";
import type { HistoricalAnalog } from "@/lib/te-mock/nearest-analog-data";
import { statusLabel } from "@/lib/te-mock/country-families";
import { TrajectorySparkline } from "./TrajectorySparkline";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import { familyColor, CALM_SLATE_BLUE } from "@/lib/te-mock/l1-families";

// Slate-blue accent (#5B7E99) used for "not yet curated" placeholder elements.
const CURATION_PLACEHOLDER_COLOR = "#5B7E99";

// P2-2: lightweight region lookup covering both current-country subjects and
// historical analogs that appear in nearest-analog-data.ts. Used to detect
// cross-region matches without needing a prop from AnalogResults.
const COUNTRY_REGIONS: Record<string, string> = {
  // Current countries (subjects)
  Egypt: "MENA",
  Lebanon: "MENA",
  Pakistan: "South Asia",
  Türkiye: "MENA",
  Venezuela: "Latin America",
  Iran: "MENA",
  Myanmar: "Southeast Asia",
  Ethiopia: "Sub-Saharan Africa",
  Tunisia: "MENA",
  Nigeria: "Sub-Saharan Africa",
  // Historical analogs
  Algeria: "MENA",
  Syria: "MENA",
  Sudan: "Sub-Saharan Africa",
  Eritrea: "Sub-Saharan Africa",
  Zimbabwe: "Sub-Saharan Africa",
  Argentina: "Latin America",
  Greece: "Europe",
  Hungary: "Europe",
  Russia: "Europe",
  Cuba: "Latin America",
  Bangladesh: "South Asia",
  Indonesia: "Southeast Asia",
  Belarus: "Europe",
};

export interface AnalogCardProps {
  rank: number; // 1, 2, 3
  analog: HistoricalAnalog;
  currentCountryName: string;
  currentTrajectory: number[];
  /** Region of the subject country — used to detect cross-region matches. */
  subjectRegion?: string;
}

export function AnalogCard({
  rank,
  analog,
  currentCountryName,
  currentTrajectory,
  subjectRegion,
}: AnalogCardProps) {
  const recipe = getRecipe(analog.primary_recipe_id);
  // P2-1: derive canonical color via familyColor() so the F-Diplomacy indigo
  // override flows through instead of the raw tracker l1_color.
  const l1Color = familyColor(recipe?.l1_id ?? "", recipe?.l1_color ?? "#9ab0c4");
  const recipeLabel = recipe?.label ?? analog.primary_recipe_id;
  const recipeStatus = recipe?.status ?? "queued";

  // P2-2: cross-region detection using the inline COUNTRY_REGIONS table.
  // subjectRegion prop takes precedence when provided; falls back to table lookup
  // on currentCountryName so AnalogResults doesn't need to be touched.
  const resolvedSubjectRegion = subjectRegion ?? COUNTRY_REGIONS[currentCountryName];
  const analogRegion = COUNTRY_REGIONS[analog.country];
  const isCrossRegion =
    resolvedSubjectRegion !== undefined &&
    analogRegion !== undefined &&
    resolvedSubjectRegion !== analogRegion;

  // Score-zone framing (mirrors ledger Feature 6: HIGH/MODERATE/LOW)
  const scoreZone =
    analog.match_score >= 85 ? "STRONG" : analog.match_score >= 70 ? "MODERATE" : "WEAK";
  const zoneColor =
    scoreZone === "STRONG" ? "#3FBF8F" : scoreZone === "MODERATE" ? "#E6C45E" : "#E68F29";

  return (
    <article
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Rank ribbon — top-left */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "28px",
          height: "28px",
          background: l1Color,
          color: "var(--qgi-bg)",
          fontFamily: "ui-monospace, monospace",
          fontSize: "13px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottomRightRadius: "8px",
        }}
        aria-label={`Rank ${rank}`}
      >
        #{rank}
      </div>

      {/* Header — country + year + score */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingLeft: "32px",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--qgi-text)",
              lineHeight: 1.2,
            }}
          >
            <FlagImg emoji={flagFor(analog.country)} name={analog.country} width={24} />
            {analog.country}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.4px",
              marginTop: "2px",
            }}
          >
            {analog.year} · pre-event
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: zoneColor,
              fontFamily: "ui-monospace, monospace",
              lineHeight: 1,
            }}
          >
            {analog.match_score.toFixed(1)}
          </div>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1.2px",
              color: zoneColor,
              fontFamily: "ui-monospace, monospace",
              marginTop: "3px",
              fontWeight: 600,
            }}
          >
            {scoreZone} MATCH
          </div>
        </div>
      </div>

      {/* P2-2: Cross-region caveat chip */}
      {isCrossRegion && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "2px 8px",
            borderRadius: "3px",
            border: `1px solid ${CALM_SLATE_BLUE}`,
            background: `${CALM_SLATE_BLUE}1A`,
            fontSize: "9px",
            fontFamily: "ui-monospace, monospace",
            color: CALM_SLATE_BLUE,
            letterSpacing: "0.3px",
            alignSelf: "flex-start",
          }}
        >
          cross-region match
        </div>
      )}

      {/* Recipe driver chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 10px",
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${l1Color}`,
          borderRadius: "6px",
        }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: l1Color,
            flexShrink: 0,
          }}
        >
          <RecipeIcon recipeId={analog.primary_recipe_id} size={20} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "1px",
            }}
          >
            TRAJECTORY SHAPE
          </div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--qgi-text)" }}>
            {recipeLabel}
          </div>
        </div>
        {recipeStatus !== "graduated" &&
          (() => {
            const { label, tone } = statusLabel(recipeStatus);
            const chipColor =
              tone === "failed" ? "#E68F29" : tone === "deployed" ? "#3FBF8F" : "#7A8FA0";
            const chipBg =
              tone === "failed"
                ? "rgba(230,143,41,0.15)"
                : tone === "deployed"
                  ? "rgba(63,191,143,0.12)"
                  : "rgba(122,143,160,0.12)";
            return (
              <span
                style={{
                  fontSize: "9px",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  background: chipBg,
                  border: `1px solid ${chipColor}`,
                  color: chipColor,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.3px",
                }}
              >
                {label}
              </span>
            );
          })()}
      </div>

      {/* Sparkline overlay — rendered only when both trajectories are non-empty.
          Pipeline fleet-run-1 does not yet emit per-analog indicator_trajectory;
          the current country's trajectory is also null in fleet-run-1. Both map
          to [] in buildAllEntries(). When either is empty we show a quiet
          "not yet curated" placeholder instead of crashing. */}
      <div
        style={{
          padding: "10px",
          background: "var(--qgi-bg)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "6px",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "1px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "6px",
          }}
        >
          12-QUARTER COMPOSITE TRAJECTORY
        </div>
        {currentTrajectory.length > 1 && analog.indicator_trajectory.length > 1 ? (
          <TrajectorySparkline
            currentSeries={currentTrajectory}
            analogSeries={analog.indicator_trajectory}
            currentLabel={currentCountryName}
            analogLabel={`${analog.country} ${analog.year}`}
            analogColor={l1Color}
            height={84}
          />
        ) : (
          <div
            style={{
              padding: "14px 10px",
              borderRadius: "4px",
              border: `1px solid ${CURATION_PLACEHOLDER_COLOR}33`,
              background: `${CURATION_PLACEHOLDER_COLOR}0D`,
              fontSize: "11px",
              color: CURATION_PLACEHOLDER_COLOR,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.3px",
            }}
          >
            Trajectory data not yet curated for this analogue.
          </div>
        )}
      </div>

      {/* Weak-match warning */}
      {analog.weak_analog && (
        <div
          style={{
            padding: "8px 10px",
            background: "rgba(230,143,41,0.08)",
            border: "1px solid rgba(230,143,41,0.4)",
            borderRadius: "5px",
            fontSize: "11px",
            color: "#E68F29",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.2px",
          }}
        >
          ⚠ Weak analogue: match score below the 70 floor. Interpret with caution.
        </div>
      )}

      {/* What happened next (HISTORICAL FACT only).
          Pipeline fleet-run-1 emits what_happened_next: null — buildAllEntries()
          maps null to "In training set." which is the canonical honest placeholder.
          Render placeholder in muted slate-blue; curated narrative in normal text. */}
      <div>
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "1.4px",
            color: l1Color,
            fontFamily: "ui-monospace, monospace",
            marginBottom: "6px",
            fontWeight: 600,
          }}
        >
          WHAT HAPPENED NEXT · {analog.country.toUpperCase()} {analog.year}
        </div>
        {analog.what_happened_next === "In training set." ||
        !analog.what_happened_next ? (
          <p
            style={{
              fontSize: "11px",
              color: CURATION_PLACEHOLDER_COLOR,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.3px",
              margin: 0,
              padding: "10px",
              borderRadius: "4px",
              border: `1px solid ${CURATION_PLACEHOLDER_COLOR}33`,
              background: `${CURATION_PLACEHOLDER_COLOR}0D`,
            }}
          >
            In training set.
          </p>
        ) : (
          <p
            style={{
              fontSize: "12.5px",
              color: "var(--qgi-text)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {analog.what_happened_next}
          </p>
        )}
      </div>

      {/* Secondary recipes */}
      {analog.secondary_recipe_ids.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "5px",
            paddingTop: "4px",
            borderTop: "1px solid var(--qgi-border)",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "1px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginRight: "4px",
              padding: "3px 0",
            }}
          >
            ALSO RESEMBLES:
          </span>
          {analog.secondary_recipe_ids.map((sid) => {
            const sr = getRecipe(sid);
            // P2-1: canonical color via familyColor, not raw tracker l1_color.
            const color = familyColor(sr?.l1_id ?? "", sr?.l1_color ?? "#9ab0c4");
            return (
              <span
                key={sid}
                style={{
                  fontSize: "10px",
                  padding: "3px 7px",
                  borderRadius: "3px",
                  border: `1px solid ${color}`,
                  color,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.2px",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                {sr?.label ?? sid}
              </span>
            );
          })}
        </div>
      )}
    </article>
  );
}
