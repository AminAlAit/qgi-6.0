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
import { FamilyChip } from "./FamilyChip";
import { familyColor, NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

export function RankHistoryPanel({ country }: { country: CountryV4 }) {
  // recipe_id → l1_id, so we can apply the family display palette (the
  // momentum records only carry the raw tracker color, not the family id).
  const l1ById = new Map(country.top_recipes.map((r) => [r.recipe_id, r.l1_id]));

  return (
    <PanelShell
      title="Recent movement (last 12 quarters)"
      accent={NEUTRAL_SLATE}
      fullWidth
      dataTour="rank-history-panel"
      caption={`Where ${country.name} has sat in the score distribution over the last 3 years, for its most-lit recipes. Past movement only, not a projection of where it is going.`}
    >
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
                <FamilyChip
                  id={l1ById.get(m.recipe_id) ?? "?"}
                  label={m.label}
                  color={color}
                  showLabel={false}
                />
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
    </PanelShell>
  );
}
