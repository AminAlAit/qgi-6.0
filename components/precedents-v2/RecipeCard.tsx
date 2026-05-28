import Link from "next/link";
import type { Route } from "next";
import { iconForRecipe } from "@/lib/te-mock/icons";
import { vintageStamp, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { STATUS_META } from "./StatusChip";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import { statusLabel } from "@/lib/te-mock/country-families";

const L1_SHORT: Record<string, string> = {
  A: "Polit",
  B: "Confl",
  C: "Gov",
  D: "Econ",
  E: "Social",
  F: "Diplo",
  G: "Human",
  H: "Struc",
};

/**
 * In v4.1 strategy, map the StatusTone to a chip color that avoids banned
 * internal palette labels. Deployed=green / failed=amber / neutral=slate.
 */
function toneColor(tone: "deployed" | "neutral" | "failed"): string {
  if (tone === "deployed") return "#3FBF8F";
  if (tone === "failed") return "#E68F29";
  return "#7A8FA0";
}

/**
 * RecipeCard
 *
 * `basePath` defaults to /precedents-v2 (V4 gallery). The V4.1 gallery
 * passes "/recipes-v4.1" so card clicks land on V4.1 detail pages.
 *
 * `labelStrategy` defaults to "legacy" (byte-identical V4 behavior). Pass
 * "v4.1" for the polished gallery to emit plain-language labels via
 * statusLabel() and suppress banned vocab chips (HARD-FAIL, Legacy ML-1,
 * LOCO, Walk in flight). P0-3 fix 2026-05-28.
 */
export function RecipeCard({
  recipe,
  basePath = "/precedents-v2",
  labelStrategy = "legacy",
}: {
  recipe: TrackerRecipe;
  basePath?: string;
  labelStrategy?: "legacy" | "v4.1";
}) {
  const statusMeta = STATUS_META[recipe.status];
  const isQueued = recipe.status === "queued";
  const isWalked = recipe.status === "walked_no_graduation";
  const isLegacy = recipe.status === "live_legacy";
  const isFmlFail = recipe.recipe_id === "civil_war_and_insurgency";

  // V4.1 derivations (only computed when strategy === "v4.1", harmless otherwise)
  const v41Label = statusLabel(recipe.status);
  const v41Color = toneColor(v41Label.tone);

  const vintage = isQueued
    ? "Vintage: awaiting first walk"
    : isLegacy
      ? "Vintage: legacy (pre-TE)"
      : `Vintage: ${vintageStamp()}`;

  return (
    <Link
      href={`${basePath}/${recipe.recipe_id}` as Route}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <article
        className={`recipe-card status-${recipe.status}`}
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "8px",
          padding: "14px",
          minHeight: "220px",
          display: "flex",
          flexDirection: "column",
          transition: "border-color 0.15s, transform 0.15s",
          cursor: "pointer",
          opacity: isQueued ? 0.62 : 1,
        }}
      >
        {/* Top: crest + L1 chip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: recipe.l1_color,
              opacity: isQueued ? 0.55 : 0.95,
              border: isQueued ? `1px dashed ${recipe.l1_color}` : "none",
              borderRadius: "4px",
            }}
          >
            <RecipeIcon recipeId={recipe.recipe_id} size={32} strokeWidth={1.5} />
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              border: `1px solid ${recipe.l1_color}`,
              color: recipe.l1_color,
              borderRadius: "4px",
              letterSpacing: "0.5px",
              fontFamily: "ui-monospace, monospace",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: recipe.l1_color,
              }}
            />
            {recipe.l1_id} · {L1_SHORT[recipe.l1_id] ?? recipe.l1_id}
          </span>
        </div>

        {/* Text */}
        <div style={{ flex: 1, marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              lineHeight: 1.25,
              color: isQueued ? "rgba(255,255,255,0.7)" : "var(--qgi-text)",
              marginBottom: "3px",
            }}
          >
            {recipe.label}
          </div>
          <div
            style={{ fontSize: "11px", color: "var(--qgi-text-muted)", lineHeight: 1.3 }}
          >
            {recipe.l2_label}
          </div>
        </div>

        {/* Tier ribbon */}
        <div
          style={{
            height: "4px",
            margin: "8px -14px 10px",
            background:
              recipe.status === "graduated"
                ? "#3FBF8F"
                : recipe.status === "walked_no_graduation"
                  ? "repeating-linear-gradient(45deg, #E68F29, #E68F29 4px, transparent 4px, transparent 8px)"
                  : recipe.status === "in_progress"
                    ? "#a78bfa"
                    : recipe.status === "live_legacy"
                      ? "#7A8FA0"
                      : "none",
            borderTop: isQueued ? `1px dashed ${recipe.l1_color}` : "none",
            opacity: isQueued ? 0.3 : 1,
            marginTop: isQueued ? "12px" : "8px",
          }}
        />

        {/* Chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            marginBottom: "8px",
            minHeight: "22px",
          }}
        >
          {labelStrategy === "v4.1" ? (
            // V4.1 strategy: no banned vocab chips; only safe neutral chips
            <>
              {isQueued && <span style={chipStyle("grey")}>Awaiting curated events</span>}
              {isWalked && (
                <span style={chipStyle("muted")}>
                  Score sep {recipe.stats?.loco_auc?.toFixed(2) ?? "—"}
                </span>
              )}
              {isWalked && (
                <span style={chipStyle("muted")}>
                  {recipe.stats?.window_y ?? "?"}y · {recipe.stats?.n_indicators ?? "?"}{" "}
                  ind
                </span>
              )}
              {/* in_progress and live_legacy: status pill in the footer handles it */}
            </>
          ) : (
            // Legacy strategy: byte-identical to the original behavior
            <>
              {isQueued && <span style={chipStyle("grey")}>Awaiting curated events</span>}
              {isWalked && (
                <>
                  <span style={chipStyle("muted")}>
                    LOCO {recipe.stats?.loco_auc?.toFixed(2) ?? "—"}
                  </span>
                  <span style={chipStyle("fail")}>HARD-FAIL</span>
                  <span style={chipStyle("muted")}>
                    {recipe.stats?.window_y ?? "?"}y · {recipe.stats?.n_indicators ?? "?"}{" "}
                    ind
                  </span>
                </>
              )}
              {isLegacy && (
                <>
                  <span style={chipStyle("legacy")}>Legacy ML-1</span>
                  {isFmlFail && <span style={chipStyle("fail")}>F-ML-1 HARD_FAIL</span>}
                </>
              )}
              {recipe.status === "in_progress" && (
                <span style={chipStyle("purple")}>Walk in flight</span>
              )}
            </>
          )}
        </div>

        {/* Trajectory dots */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "10px", height: "6px" }}>
          {isWalked && <span style={dotStyle("#E68F29")} />}
          {isLegacy && [0, 1, 2].map((i) => <span key={i} style={dotStyle("#7A8FA0")} />)}
        </div>

        {/* Foot */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: "8px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <span
            style={{
              fontSize: "9.5px",
              color: "var(--qgi-text-dim)",
              letterSpacing: "0.3px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {vintage}
          </span>
          {labelStrategy === "v4.1" ? (
            <span
              style={{
                fontSize: "9.5px",
                padding: "2px 7px",
                borderRadius: "10px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                background: `${v41Color}26`,
                color: v41Color,
                border: `1px solid ${v41Color}`,
              }}
            >
              {v41Label.label}
            </span>
          ) : (
            <span
              style={{
                fontSize: "9.5px",
                padding: "2px 7px",
                borderRadius: "10px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                background: statusMeta.bgAlpha,
                color: statusMeta.color,
                border: `1px solid ${statusMeta.color}`,
              }}
            >
              {statusMeta.label}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}

function chipStyle(
  kind: "num" | "fail" | "muted" | "legacy" | "purple" | "grey"
): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: "10px",
    padding: "3px 7px",
    borderRadius: "3px",
    border: "1px solid var(--qgi-border)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--qgi-text-muted)",
    fontFamily: "ui-monospace, monospace",
    letterSpacing: "0.3px",
  };
  if (kind === "num") return { ...base, color: "var(--qgi-text)" };
  if (kind === "fail")
    return {
      ...base,
      background: "rgba(230,69,69,0.15)",
      borderColor: "rgba(230,69,69,0.4)",
      color: "#E64545",
    };
  if (kind === "muted") return { ...base, opacity: 0.7 };
  if (kind === "legacy") return { ...base, borderColor: "#7A8FA0", color: "#7A8FA0" };
  if (kind === "purple")
    return { ...base, borderColor: "var(--qgi-accent)", color: "var(--qgi-accent)" };
  if (kind === "grey") return { ...base, color: "var(--qgi-text-dim)" };
  return base;
}

function dotStyle(color: string): React.CSSProperties {
  return {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: color,
    display: "inline-block",
  };
}
