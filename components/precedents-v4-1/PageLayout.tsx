/**
 * PageLayout — V4.1 page-level frame.
 *
 * Header strip: recipe icon + status chip + H1 + recipe-id subtitle +
 * definition lede paragraph (per #155 — Definition is anchoring context,
 * not a panel-tile equal to charts) + optional demo disclosure. Below:
 * dashboard-style panel grid (CSS Grid auto-fit minmax(340px, 1fr)).
 *
 * 2026-05-27 polish (#164 — Sofia): grid now uses `grid-auto-flow: row dense`
 * + `grid-auto-rows: minmax(0, auto)`, and exports a `<TallSlot>` wrapper
 * the page uses to mark naturally-tall panels (Countries, ScoreDistribution,
 * IndicatorSet, PatternAlignment) with `grid-row: span 2`. The dense flow
 * + variable row spans removes the empty-band gaps that the old
 * row-aligned `auto-fit` grid forced under short panels.
 */
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode, CSSProperties } from "react";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

/**
 * TallSlot — wrap a panel that is taller than ~1 grid row so the layout
 * engine reserves N rows for it. With `grid-auto-flow: row dense` on the
 * grid, shorter panels coming AFTER a tall one back-fill the leftover row
 * cells, removing the empty-band gaps that uniform-row `auto-fit` grids
 * create when panel heights are uneven.
 *
 * Why a wrapper (and not a prop on PanelBase)? PanelBase is reused outside
 * the v4.1 grid (e.g. inside ExpandableShell), so span hints are a layout-
 * level concern, not a panel-internals concern. Keeping it in the page
 * composition layer keeps the panel components grid-agnostic.
 *
 * The wrapper itself uses `display: flex; flex-direction: column` so the
 * panel inside (also `display: flex; flex-direction: column`) stretches
 * to fill the wrapper's box, which the grid stretches to span N tracks.
 */
export function TallSlot({ children, span = 2 }: { children: ReactNode; span?: number }) {
  // The wrapper reserves N grid rows via `grid-row: span N`. The panel inside
  // renders at its natural content height; if it's slightly shorter than N
  // rows, the unused space is at the bottom of THIS slot — but neighboring
  // SHORT panels are unaffected because `grid-auto-flow: row dense` (set on
  // the parent grid) back-fills them into the row cells the tall panel did
  // not occupy. Net result: no awkward bands of empty space across the grid.
  const style: CSSProperties = {
    gridRow: `span ${span}`,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  };
  return <div style={style}>{children}</div>;
}

interface RecipeSummary {
  recipe_id: string;
  label: string;
  l1_id: string;
  l1_label: string;
  l1_color: string;
  l2_label: string;
}

interface Props {
  recipe: RecipeSummary;
  statusChip: ReactNode;
  subtitle?: string;
  /**
   * Definition lede paragraph (#155). Rendered under the H1 + subtitle as
   * a 15px line, max-width 720px, primary text color.
   */
  definition?: string;
  demoDisclosure?: ReactNode;
  children: ReactNode;
}

export function PageLayout({
  recipe,
  statusChip,
  subtitle,
  definition,
  demoDisclosure,
  children,
}: Props) {
  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Header strip */}
      <div
        style={{
          borderBottom: "1px solid var(--qgi-border)",
          background: "var(--qgi-surface)",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px 24px 24px" }}>
          {/* Breadcrumb + mockup banner */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <nav
              aria-label="Breadcrumb"
              style={{
                fontSize: "11px",
                letterSpacing: "0.3px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              <Link
                href={"/precedents-v4.1" as Route}
                style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
              >
                ← Recipes V4.1
              </Link>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span style={{ color: recipe.l1_color }}>
                {recipe.l1_id} · {recipe.l1_label}
              </span>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span>{recipe.l2_label}</span>
            </nav>
            {/* 2026-05-27 (#159): MOCKUP · V4.1 chip removed — internal versioning */}
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "88px",
                height: "88px",
                background: "var(--qgi-bg)",
                border: `1px solid ${recipe.l1_color}`,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: recipe.l1_color,
                flexShrink: 0,
              }}
            >
              <RecipeIcon recipeId={recipe.recipe_id} size={52} strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "10px",
                  flexWrap: "wrap",
                }}
              >
                {statusChip}
              </div>
              <h1
                style={{
                  fontSize: "30px",
                  fontWeight: 600,
                  lineHeight: 1.15,
                  margin: "0 0 8px",
                  color: "var(--qgi-text)",
                }}
              >
                {recipe.label}
              </h1>
              {subtitle && (
                <p
                  style={{
                    color: "var(--qgi-text-muted)",
                    fontSize: "13px",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {/* 2026-05-27 (#159): Recipe ID slug exposure removed */}
                  {subtitle}
                </p>
              )}
              {definition && (
                <p
                  style={{
                    marginTop: "16px",
                    marginBottom: 0,
                    maxWidth: "720px",
                    fontSize: "15px",
                    lineHeight: 1.65,
                    color: "var(--qgi-text)",
                  }}
                >
                  {definition}
                </p>
              )}
              {demoDisclosure && (
                <div style={{ marginTop: "16px" }}>{demoDisclosure}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Panel grid — dense row flow + fixed row height so TallSlot span-2
          hints reserve coherent 2-row tracks (~580px) for naturally-tall
          panels, while shorter panels back-fill leftover row cells. Removes
          the empty-band gaps the prior row-aligned `auto-fit` grid forced. */}
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 24px 64px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gridAutoRows: "280px",
            gridAutoFlow: "row dense",
            gap: "16px",
            alignItems: "stretch",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
