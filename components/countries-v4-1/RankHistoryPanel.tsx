/**
 * RankHistoryPanel (P4) — where the country has sat in the score
 * distribution over the last 12 quarters, for its most-lit recipes.
 * Full-width, neutral/structural accent.
 *
 * Retrospective only (Kwame): the caption says so, and every sparkline ends
 * at the latest reading with no forward extrapolation (MiniSparkline
 * enforces the terminating end dot).
 */
import { PanelShell } from "./PanelShell";
import { MiniSparkline } from "./MiniSparkline";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import { familyColor, NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

export function RankHistoryPanel({ country }: { country: CountryV4 }) {
  // recipe_id → l1_id, so we can apply the family display palette (the
  // momentum records only carry the raw tracker color, not the family id).
  const l1ById = new Map(country.top_recipes.map((r) => [r.recipe_id, r.l1_id]));

  // Honest empty state: fleet-run-1 is the FIRST vintage (2026-05-30).
  // Rank history requires ≥2 vintages; we have none yet.
  const hasHistory = country.momentum.some((m) => m.rank_history.length > 0);

  return (
    <PanelShell
      title="Recent movement (last 12 quarters)"
      accent={NEUTRAL_SLATE}
      fullWidth
      dataTour="rank-history-panel"
      caption={`Where ${country.name} has sat in the score distribution over the last 3 years, for its most-lit recipes. Past movement only, not a projection of where it is going.`}
    >
      {!hasHistory ? (
        <p
          style={{
            fontSize: "12px",
            color: "var(--qgi-text-dim)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Rank history will appear once the next quarterly vintage lands. This is the
          first bake for these recipes.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "16px",
          }}
        >
          {country.momentum.map((m) => {
            const color = familyColor(l1ById.get(m.recipe_id) ?? "", m.l1_color);
            const current = m.rank_history[m.rank_history.length - 1] ?? 0;
            return (
              <div
                key={m.recipe_id}
                style={{
                  border: "1px solid var(--qgi-border)",
                  background: "var(--qgi-bg)",
                  borderRadius: "6px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    title={`${m.label} (${l1ById.get(m.recipe_id) ?? "?"} family)`}
                    aria-label={`${m.label} recipe icon`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      border: `1px solid ${color}99`,
                      borderRadius: "3px",
                      color,
                      background: `${color}14`,
                      flexShrink: 0,
                    }}
                  >
                    <RecipeIcon recipeId={m.recipe_id} size={14} strokeWidth={1.8} />
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--qgi-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                    title={m.label}
                  >
                    {m.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--qgi-text)",
                    }}
                  >
                    {current.toFixed(0)}
                  </span>
                </div>
                <MiniSparkline
                  values={m.rank_history}
                  color={color}
                  width={206}
                  height={36}
                />
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}
