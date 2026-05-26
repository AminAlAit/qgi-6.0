/**
 * RecipeContributionBar — ranked horizontal bar list showing which recipes
 * contributed to the current country's analog match, weighted by SHAP-style
 * contribution percentage.
 *
 * This is the "which recipes matched" panel from the spec — for the current
 * country, which canonical shapes pulled it toward its analogs and by how
 * much. Maps to ledger Feature 5 (Aggregation rule) + Feature 14 (driver) at
 * the recipe layer rather than the indicator layer.
 *
 * Honesty regime: chip on every non-graduated recipe marking its tier
 * status. A walked-failed recipe contributing 40% must not be confused
 * with a validated 40% contribution.
 *
 * Server component.
 */
import { iconForRecipe } from "@/lib/te-mock/icons";
import type { RecipeContribution } from "@/lib/te-mock/nearest-analog-data";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

export interface RecipeContributionBarProps {
  contributions: RecipeContribution[];
}

const STATUS_BADGE: Record<
  RecipeContribution["status"],
  { label: string; color: string; bg: string }
> = {
  graduated: { label: "validated", color: "#3FBF8F", bg: "rgba(63,191,143,0.12)" },
  walked_no_graduation: {
    label: "walked-failed",
    color: "#E68F29",
    bg: "rgba(230,143,41,0.12)",
  },
  queued: { label: "queued", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  live_legacy: { label: "legacy ML-1", color: "#7A8FA0", bg: "rgba(122,143,160,0.12)" },
};

export function RecipeContributionBar({ contributions }: RecipeContributionBarProps) {
  const sorted = [...contributions].sort(
    (a, b) => b.contribution_pct - a.contribution_pct
  );
  const max = sorted.length ? sorted[0].contribution_pct : 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {sorted.map((c) => {
        const badge = STATUS_BADGE[c.status];
        const widthPct = (c.contribution_pct / max) * 100;
        return (
          <div
            key={c.recipe_id}
            style={{
              padding: "10px 12px",
              background: "var(--qgi-bg)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "6px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Background fill bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${widthPct}%`,
                background: `linear-gradient(to right, ${c.l1_color}22, ${c.l1_color}05)`,
                borderRight: `1px solid ${c.l1_color}33`,
              }}
            />
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: c.l1_color,
                  flexShrink: 0,
                }}
              >
                <RecipeIcon recipeId={c.recipe_id} size={18} strokeWidth={1.6} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--qgi-text)",
                    }}
                  >
                    {c.recipe_label}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "1px 6px",
                      borderRadius: "3px",
                      border: `1px solid ${badge.color}`,
                      background: badge.bg,
                      color: badge.color,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: c.l1_color,
                  fontFamily: "ui-monospace, monospace",
                  flexShrink: 0,
                }}
              >
                {c.contribution_pct}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
