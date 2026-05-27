/**
 * PageLayout — V4.1 page-level frame.
 *
 * Header strip: recipe icon + status chip + H1 + recipe-id subtitle +
 * definition lede paragraph (per #155 — Definition is anchoring context,
 * not a panel-tile equal to charts) + optional demo disclosure. Below:
 * dashboard-style panel grid (CSS Grid auto-fit minmax(340px, 1fr)).
 */
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

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
            <span
              style={{
                fontSize: "10px",
                padding: "3px 9px",
                border: "1px solid var(--qgi-accent)",
                color: "var(--qgi-accent)",
                borderRadius: "3px",
                letterSpacing: "1.2px",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              MOCKUP · V4.1
            </span>
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
              <p
                style={{
                  color: "var(--qgi-text-muted)",
                  fontSize: "13px",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Recipe ID{" "}
                <code
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    color: recipe.l1_color,
                  }}
                >
                  {recipe.recipe_id}
                </code>
                {subtitle ? ` · ${subtitle}` : null}
              </p>
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

      {/* Panel grid */}
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 24px 64px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
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
