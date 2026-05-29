/**
 * TopPairsStrip — Dashboard right-rail "story tape" of top country-recipe
 * pairs ranked by confidence.
 *
 * 2026-05-30 — restructured from a 2-column horizontal strip into a single-
 * column vertical rail. The component now sits in a sticky right-side column
 * on the dashboard, holding up to 20 hand-curated pairs (data contract:
 * `data/curated-top-pairs.json` produced by a parallel curation agent;
 * graceful fallback to getTopPairs() when the curated drop is absent).
 *
 * Rail design rationale (Sard mini-majles, 2026-05-30):
 *   - Position: sticky (scrolls until pinned), not fixed. Preserves natural
 *     scroll rhythm; works at any page length.
 *   - Width: 320px (set by parent grid). One-line row layout: rank · flag ·
 *     country · recipe · score. Rationale (when present) renders on a
 *     second line, dim.
 *   - Cap: all 20 visible with internal scroll on max-height. The rail IS
 *     the story tape; hiding rows behind a "Show all" defeats the
 *     peripheral-scan affordance.
 *   - Header: "Top 20 today" with one-line caption. Calm slate so the rail
 *     stays quieter than the family-color insight plots.
 *   - Visual weight: family-color left border on each row (the only color
 *     tie-back to the rest of the dashboard idiom); score uses the shared
 *     lerp + glow helper.
 */
import Link from "next/link";
import type { Route } from "next";
import { PanelBase } from "./PanelBase";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import { getAllRecipes } from "@/lib/te-mock/recipes";
import {
  getCuratedTopPairs,
  getTopPairs,
  type BoardPair,
  type CuratedBoardPair,
} from "@/lib/te-mock/risk-board-data";
import { familyColor } from "@/lib/te-mock/l1-families";
import { MUTED_GRAY, confidenceT, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";

interface Props {
  /**
   * Max pairs to show. Default 20 — matches the curated drop size.
   * The rail's internal scroll absorbs whatever fits in the viewport.
   */
  limit?: number;
}

export function TopPairsStrip({ limit = 20 }: Props) {
  // Curated 20-pair list is the canonical source. Fall back to the legacy
  // getTopPairs() merge when the curated drop is not yet present, so the
  // surface never renders empty during the parallel-agent landing window.
  const curated = getCuratedTopPairs();
  const pairs: Array<CuratedBoardPair | (BoardPair & { rank: number })> =
    curated.length > 0
      ? curated.slice(0, limit)
      : getTopPairs()
          .slice(0, limit)
          .map((p, i) => ({ ...p, rank: i + 1 }));

  const recipes = new Map(getAllRecipes().map((r) => [r.recipe_id, r]));
  const countLabel = pairs.length;

  return (
    <PanelBase
      title={`Top ${countLabel} today`}
      caption="Country-recipe matches, ranked by confidence."
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
      {/* Internal-scroll container. max-height tops out near the viewport
          so the rail behaves as a peripheral companion: visible at scan,
          scrollable when the user invests attention. */}
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          maxHeight: "calc(100vh - 220px)",
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {pairs.map((pair) => {
          const recipe = recipes.get(pair.recipe_id);
          if (!recipe) return null;
          return (
            <PairRow
              key={`${pair.country}-${pair.recipe_id}-${pair.rank}`}
              pair={pair}
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
  recipeLabel,
  recipeFamilyColor,
}: {
  pair: CuratedBoardPair | (BoardPair & { rank: number });
  recipeLabel: string;
  recipeFamilyColor: string;
}) {
  const pct = Math.round(pair.score);
  const cT = confidenceT(pair.score);
  const pctColor = lerpHexToRgb(MUTED_GRAY, recipeFamilyColor, cT);
  const pctGlow = confidenceGlow(recipeFamilyColor, cT);
  // 2026-05-30 polish — rationale dropped from the rail per founder ask
  // ("too much text"). The curated long-form rationale moves to the cell
  // title attribute so it surfaces on hover for the curious reader, but
  // the visible row stays at 2 lines: rank+flag+country+score / recipe
  // label.
  const rationale = "rationale" in pair ? pair.rationale : undefined;

  return (
    <li>
      <Link
        href={`/recipes/${pair.recipe_id}` as Route}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
        title={rationale}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            padding: "7px 9px",
            background: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            borderLeft: `2px solid ${recipeFamilyColor}`,
            borderRadius: "4px",
          }}
        >
          {/* Row 1: rank · flag · country · score */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minHeight: "20px",
            }}
          >
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
              {String(pair.rank).padStart(2, "0")}
            </span>

            <FlagImg
              emoji={flagFor(pair.country)}
              name={pair.country}
              width={14}
              radius={2}
            />

            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--qgi-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
            >
              {pair.country}
            </span>

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

          {/* Row 2: recipe label (indented under the flag column) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingLeft: "26px",
              fontSize: "11px",
              color: "var(--qgi-text-muted)",
              lineHeight: 1.25,
            }}
            title={recipeLabel}
          >
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
              }}
            >
              {recipeLabel}
            </span>
          </div>

          {/* 2026-05-30: rationale row dropped from the visible card. The
              full editorial note moves to the link's title attribute so
              hovering surfaces it without the visual weight. */}
        </div>
      </Link>
    </li>
  );
}
