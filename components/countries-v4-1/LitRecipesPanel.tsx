/**
 * LitRecipesPanel (P1) — title "Active recipes": every recipe this
 * country's current trajectory matches, as a ranked table. Full-width,
 * neutral/structural accent (it spans families). Each row: family dot +
 * letter glyph + recipe label + a score bar (filled in the recipe's
 * family color, length = the 0-100 rank) + the score + an honest status
 * chip.
 *
 * 2026-05-28: "Lit recipes" -> "Recipes in play" per founder pick (game/
 * board metaphor pairs with the risk-board leaderboard framing; reads as
 * "currently in the running," not as a status claim about the recipes).
 * 2026-05-31: "Recipes in play" -> "Active recipes" (founder); rows now link
 * to /trends/{id}/countries/{iso2} (the "how this country is tracing that
 * recipe" match page) instead of the recipe detail page.
 *
 * Honesty: the caption carries Kwame's canonical graduation-gap sentence;
 * status chips use blessed plain labels (statusLabel); green is reserved
 * for a genuinely deployed recipe, which is none today.
 */
import Link from "next/link";
import type { Route } from "next";
import { PanelShell } from "./PanelShell";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import { familyColor, NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import { statusLabel, type StatusTone } from "@/lib/te-mock/country-families";
import { iso2For } from "@/lib/te-mock/country-flags";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

function statusChipStyle(tone: StatusTone): React.CSSProperties {
  if (tone === "deployed") {
    return {
      color: "#3FBF8F",
      border: "1px solid #3FBF8F",
      background: "rgba(63,191,143,0.12)",
    };
  }
  if (tone === "failed") {
    return {
      color: "#E68F29",
      border: "1px solid rgba(230,143,41,0.55)",
      background: "rgba(230,143,41,0.08)",
    };
  }
  return {
    color: "var(--qgi-text-muted)",
    border: "1px solid var(--qgi-border)",
    background: "rgba(122,143,160,0.08)",
  };
}

export function LitRecipesPanel({ country }: { country: CountryV4 }) {
  const rows = country.top_recipes.slice(0, 15);
  // Each row links to the country-recipe match page ("how this country is
  // tracing that recipe"). The match page resolves the country by iso2.
  // Guard the format: some names resolve to an emoji/null in the flag map.
  const rawIso2 = iso2For(country.name);
  const iso2 = rawIso2 && /^[a-z]{2}$/.test(rawIso2) ? rawIso2 : null;

  return (
    <PanelShell
      title="Active trends"
      accent={NEUTRAL_SLATE}
      fullWidth
      dataTour="recipes-in-play-panel"
      caption={`Every row is a trend ${country.name}'s recent signals are actively tracing. Scores are a relative 0-to-100 ranking of resemblance, not a probability. Open a row to see how ${country.name} is tracing that trend, signal by signal.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {rows.map((r) => {
          const color = familyColor(r.l1_id, r.l1_color);
          const { label, tone } = statusLabel(r.status);
          return (
            <Link
              key={r.recipe_id}
              href={
                (iso2
                  ? `/trends/${r.recipe_id}/countries/${iso2}`
                  : `/trends/${r.recipe_id}`) as Route
              }
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "grid",
                // Fixed widths on the trailing columns so the bar column
                // starts at the same x-position on every row. Previously
                // both trailing columns were `auto`, which let the status
                // chip's variable width ("Not yet tested" vs "Tested, did
                // not hold up") push the fr-based columns sideways and
                // visually misalign the bars. 36px = 2-3 digit score;
                // 190px holds the longest statusLabel string with the
                // chip right-aligned inside it.
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(120px, 1fr) 36px 190px",
                alignItems: "center",
                gap: "12px",
                padding: "8px 8px",
                borderRadius: "5px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {/* Recipe icon + label (Rule 1: chip is per-recipe, use the recipe's icon) */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}
              >
                <span
                  title={`${r.label} (${r.l1_label} family)`}
                  aria-label={`${r.label}, ${r.l1_label} family`}
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
                  <RecipeIcon recipeId={r.recipe_id} size={14} strokeWidth={1.8} />
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--qgi-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.label}
                </span>
              </div>

              {/* Score bar — NEUTRAL_SLATE per V4.1 rule 8 (magnitude bars
                  carry the rank-not-probability semantics; family color
                  stays on the chip glyph and the row left-edge accent
                  but never on the rank bar itself). */}
              <div
                style={{
                  height: "8px",
                  borderRadius: "2px",
                  background: "var(--qgi-bg)",
                  border: "1px solid var(--qgi-border)",
                  overflow: "hidden",
                }}
                aria-hidden
              >
                <div
                  style={{
                    width: `${Math.max(2, Math.min(100, r.score))}%`,
                    height: "100%",
                    background: NEUTRAL_SLATE,
                    opacity: 0.85,
                  }}
                />
              </div>

              {/* Score number */}
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--qgi-text)",
                  letterSpacing: "-0.3px",
                  textAlign: "right",
                  minWidth: "30px",
                }}
              >
                {r.score.toFixed(0)}
              </span>

              {/* Honest status chip — right-aligned inside the fixed
                  190px column so every row's chip ends at the same edge,
                  giving the row a true table-like alignment. */}
              <span
                style={{
                  fontSize: "10.5px",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.2px",
                  whiteSpace: "nowrap",
                  justifySelf: "end",
                  ...statusChipStyle(tone),
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </PanelShell>
  );
}
