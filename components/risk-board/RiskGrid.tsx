/**
 * The board's centerpiece: rows = recipes, columns = top-10 country/score
 * cells per row, rendered as a heatmap-style intensity bar.
 *
 * Sticky left column carries the recipe identity (icon + label + L1 family
 * pill + status chip). Each cell links to the recipe detail page.
 *
 * 2026-05-26 schema-align (R&D reply qgi-docs #169 §Q7): three cell states
 * are honored — `scored` (rank shown), `not_scored` (country lacks
 * indicator coverage for this recipe; visually muted, NEVER framed as
 * "low score"), and `no_walk_yet` (recipe is queued). Each scored row
 * now also renders a coverage-honesty caption: "X of Y platform countries
 * scored · Z lack coverage."
 *
 * Filtering / search are applied upstream by RiskBoardFilters (client
 * component); this component is presentation-only.
 */
import Link from "next/link";
import type { Route } from "next";
import { iconForRecipe } from "@/lib/te-mock/icons";
import type { TrackerRecipe } from "@/lib/te-mock/recipes";
import {
  getRecipeRow,
  zoneFor,
  type RecipeRow,
  type BoardCell,
} from "@/lib/te-mock/risk-board-data";
import { STATUS_META } from "@/components/precedents-v2/StatusChip";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

export function RiskGrid({ recipes }: { recipes: TrackerRecipe[] }) {
  const rows: Array<{ recipe: TrackerRecipe; row: RecipeRow }> = [];
  for (const recipe of recipes) {
    const row = getRecipeRow(recipe.recipe_id);
    if (row) rows.push({ recipe, row });
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "32px",
          border: "1px dashed var(--qgi-border)",
          borderRadius: "6px",
          textAlign: "center",
          color: "var(--qgi-text-muted)",
          fontSize: "13px",
        }}
      >
        No recipes match the current filters.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        background: "var(--qgi-surface)",
        overflow: "hidden",
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px repeat(10, minmax(0, 1fr))",
          background: "var(--qgi-bg)",
          borderBottom: "1px solid var(--qgi-border)",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          letterSpacing: "1px",
          color: "var(--qgi-text-dim)",
        }}
      >
        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--qgi-border)" }}>
          Recipe ↓ · Country →
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              padding: "10px 6px",
              textAlign: "center",
              borderRight: i === 9 ? "none" : "1px solid var(--qgi-border)",
            }}
          >
            #{i + 1}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map(({ recipe, row }, idx) => (
        <RecipeGridRow
          key={recipe.recipe_id}
          recipe={recipe}
          row={row}
          isLast={idx === rows.length - 1}
        />
      ))}
    </div>
  );
}

function RecipeGridRow({
  recipe,
  row,
  isLast,
}: {
  recipe: TrackerRecipe;
  row: RecipeRow;
  isLast: boolean;
}) {
  const isQueued = row.display_state === "queued";
  const statusMeta = STATUS_META[recipe.status];

  // Coverage caption — only on scored rows, per R&D reply §Q7. Honest framing:
  // a country lacking coverage is "not scored," never "low score."
  const hasCoverageData = row.n_countries_scored !== null;
  const coverageGap = hasCoverageData
    ? row.platform_roster_size - (row.n_countries_scored as number)
    : 0;

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid var(--qgi-border)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px repeat(10, minmax(0, 1fr))",
          background: isQueued ? "rgba(0,0,0,0.18)" : "transparent",
        }}
      >
        {/* Sticky left identity cell */}
        <Link
          href={`/precedents-v2/${recipe.recipe_id}` as Route}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRight: "1px solid var(--qgi-border)",
              borderLeft: `3px solid ${recipe.l1_color}`,
              height: "100%",
              opacity: isQueued ? 0.62 : 1,
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: recipe.l1_color,
                flexShrink: 0,
              }}
            >
              <RecipeIcon recipeId={recipe.recipe_id} size={18} strokeWidth={1.6} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {recipe.label}
              </div>
              <div
                style={{
                  fontSize: "9.5px",
                  letterSpacing: "0.3px",
                  color: statusMeta.color,
                  fontFamily: "ui-monospace, monospace",
                  marginTop: "2px",
                }}
              >
                {statusMeta.label}
              </div>
            </div>
          </div>
        </Link>

        {/* 10 cells */}
        {row.cells.map((cell, i) => (
          <HeatCell
            key={`${recipe.recipe_id}-${i}`}
            cell={cell}
            recipeId={recipe.recipe_id}
            familyColor={recipe.l1_color}
            isLastCol={i === 9}
          />
        ))}
      </div>

      {/* Coverage caption — honesty surface, R&D reply §Q7 */}
      {hasCoverageData && (
        <div
          style={{
            padding: "6px 14px 8px",
            paddingLeft: "295px", // align under the cell columns, past the 280px identity col + 12px gutter
            fontSize: "10px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
            background: "rgba(0,0,0,0.06)",
            borderTop: "1px solid var(--qgi-border)",
          }}
          title={
            row.countries_not_scored_iso && row.countries_not_scored_iso.length > 0
              ? `Lacking coverage: ${row.countries_not_scored_iso.join(", ")}`
              : undefined
          }
        >
          {row.n_countries_scored} of {row.platform_roster_size} platform countries scored
          {coverageGap > 0
            ? ` · ${coverageGap} lack coverage for this recipe's indicators`
            : ""}
        </div>
      )}
    </div>
  );
}

function HeatCell({
  cell,
  recipeId,
  familyColor,
  isLastCol,
}: {
  cell: BoardCell;
  recipeId: string;
  familyColor: string;
  isLastCol: boolean;
}) {
  // ── State-specific render branches ─────────────────────────────────────
  if (cell.state === "no_walk_yet") {
    return (
      <div
        style={{
          position: "relative",
          height: "62px",
          padding: "6px 8px",
          borderRight: isLastCol ? "none" : "1px solid var(--qgi-border)",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          cursor: "default",
        }}
        title="No walk yet — recipe queued for next vintage."
      >
        <div
          style={{
            fontSize: "10.5px",
            color: "var(--qgi-text-dim)",
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          no walk yet
        </div>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-dim)",
            lineHeight: 1,
          }}
        >
          —
        </span>
      </div>
    );
  }

  if (cell.state === "not_scored") {
    // Distinct from "no_walk_yet": the recipe IS walked, this country
    // just lacks coverage for its indicators. Honesty per R&D reply §Q7:
    // explicit hatched pattern + "not scored" copy, NEVER a low rank.
    return (
      <div
        style={{
          position: "relative",
          height: "62px",
          padding: "6px 8px",
          borderRight: isLastCol ? "none" : "1px solid var(--qgi-border)",
          background:
            "repeating-linear-gradient(45deg, rgba(122,143,160,0.05) 0 4px, transparent 4px 8px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          cursor: "help",
        }}
        title={`${cell.country} · not scored — country lacks indicator coverage for this recipe. NOT the same as a low score.`}
      >
        <div
          style={{
            fontSize: "10.5px",
            color: "var(--qgi-text-dim)",
            fontWeight: 500,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {cell.country}
        </div>
        <span
          style={{
            fontSize: "10px",
            letterSpacing: "0.6px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            textTransform: "uppercase",
          }}
        >
          not scored
        </span>
      </div>
    );
  }

  // ── Scored cell — the normal heatmap branch ────────────────────────────
  const score = cell.score as number; // safe: state === "scored"
  const intensity = Math.max(0, Math.min(1, (score - 40) / 60));
  const alpha = 0.1 + intensity * 0.55;
  const zone = zoneFor(score);
  const zoneColor =
    zone === "HIGH"
      ? "#E64545"
      : zone === "MODERATE"
        ? "#E68F29"
        : "var(--qgi-text-muted)";

  return (
    <Link
      href={`/precedents-v2/${recipeId}` as Route}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          position: "relative",
          height: "62px",
          padding: "6px 8px",
          borderRight: isLastCol ? "none" : "1px solid var(--qgi-border)",
          background: `linear-gradient(90deg, ${hexToRgba(familyColor, alpha)} 0%, ${hexToRgba(familyColor, alpha * 0.4)} 100%)`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        title={`${cell.country} · discrimination rank ${score.toFixed(1)} (${zone})`}
      >
        <div
          style={{
            fontSize: "10.5px",
            color: "var(--qgi-text)",
            fontWeight: 500,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {cell.country}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text)",
              lineHeight: 1,
            }}
          >
            {score.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: "8.5px",
              letterSpacing: "0.8px",
              color: zoneColor,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {zone}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* Tiny inline helper — keeps the gradient calc readable above. Accepts #RGB or #RRGGBB. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
