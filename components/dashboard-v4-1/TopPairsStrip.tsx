/**
 * TopPairsStrip — slim Dashboard version of the Risk Board "Today across
 * the catalog" hero (now retired from /risk-board).
 *
 * The full hero (RiskBoardHero) carried per-row recipe icons + zone chips
 * + rank-delta indicators + 18px family-color score numbers. The Dashboard
 * lives in a denser context, so this slim version is a single 2-column
 * grid of compact rows, each showing:
 *
 *   rank · flag · country · recipe label · confidence %
 *
 * The confidence number reuses the shared color-lerp + glow helper so the
 * visual reads the same as Risk Board cells (white-glow toned) and recipe
 * cards (family-color glow), keeping the cross-surface language
 * consistent. Surface chrome follows the dashboard's PanelBase idiom.
 */
import Link from "next/link";
import type { Route } from "next";
import { PanelBase } from "./PanelBase";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import { getAllRecipes } from "@/lib/te-mock/recipes";
import { getTopPairs, type BoardPair } from "@/lib/te-mock/risk-board-data";
import { familyColor } from "@/lib/te-mock/l1-families";
import { MUTED_GRAY, confidenceT, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";

interface Props {
  /** How many pairs to show. Default 8 — fits a 2-column grid on dashboard. */
  limit?: number;
}

export function TopPairsStrip({ limit = 8 }: Props) {
  const pairs = getTopPairs().slice(0, limit);
  const recipes = new Map(getAllRecipes().map((r) => [r.recipe_id, r]));

  return (
    <PanelBase
      title="Today across the catalog"
      caption={`Top ${pairs.length} country-recipe matches, ranked by confidence.`}
      rightSlot={
        <Link
          href={"/risk-board" as Route}
          style={{
            fontSize: "10.5px",
            letterSpacing: "0.4px",
            color: "var(--qgi-accent)",
            fontFamily: "ui-monospace, monospace",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Open Risk Board →
        </Link>
      }
    >
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "6px",
        }}
      >
        {pairs.map((pair, idx) => {
          const recipe = recipes.get(pair.recipe_id);
          if (!recipe) return null;
          return (
            <PairRow
              key={`${pair.country}-${pair.recipe_id}`}
              pair={pair}
              rank={idx + 1}
              recipeLabel={recipe.label}
              recipeFamilyColor={familyColor(recipe.l1_id, recipe.l1_color)}
            />
          );
        })}
      </ol>
    </PanelBase>
  );
}

function PairRow({
  pair,
  rank,
  recipeLabel,
  recipeFamilyColor,
}: {
  pair: BoardPair;
  rank: number;
  recipeLabel: string;
  recipeFamilyColor: string;
}) {
  const pct = Math.round(pair.score);
  const cT = confidenceT(pair.score);
  // Slate panel background → family-color endpoint reads well here.
  const pctColor = lerpHexToRgb(MUTED_GRAY, recipeFamilyColor, cT);
  const pctGlow = confidenceGlow(recipeFamilyColor, cT);

  return (
    <li>
      <Link
        href={`/recipes/${pair.recipe_id}` as Route}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "7px 10px",
            background: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            borderLeft: `2px solid ${recipeFamilyColor}`,
            borderRadius: "4px",
            minHeight: "34px",
          }}
        >
          {/* Rank */}
          <span
            style={{
              fontSize: "10px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.5px",
              flexShrink: 0,
              minWidth: "18px",
            }}
          >
            {String(rank).padStart(2, "0")}
          </span>

          {/* Country flag */}
          <FlagImg
            emoji={flagFor(pair.country)}
            name={pair.country}
            width={14}
            radius={2}
          />

          {/* Country + recipe label, both ellipsised */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
              fontSize: "12px",
              lineHeight: 1.2,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                color: "var(--qgi-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flexShrink: 0,
                maxWidth: "44%",
              }}
            >
              {pair.country}
            </span>
            <span
              style={{
                color: "var(--qgi-text-dim)",
                fontSize: "10.5px",
              }}
            >
              ·
            </span>
            <span
              style={{
                color: "var(--qgi-text-muted)",
                fontSize: "11.5px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
              }}
              title={recipeLabel}
            >
              {recipeLabel}
            </span>
          </div>

          {/* Confidence — same color/glow rule as Risk Board + Recipe cards */}
          <span
            style={{
              fontSize: "14px",
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "-0.3px",
              color: pctColor,
              textShadow: pctGlow || undefined,
              flexShrink: 0,
              transition: "text-shadow 180ms ease-out, color 180ms",
              minWidth: "32px",
              textAlign: "right",
            }}
            title={`${pct}% confidence — this country's recent path matches the recipe's canonical shape.`}
          >
            {pct}%
          </span>
        </div>
      </Link>
    </li>
  );
}
