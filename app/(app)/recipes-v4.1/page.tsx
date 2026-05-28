import type { Metadata } from "next";
import { getAllRecipes, vintageStamp, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { RecipeCard } from "@/components/precedents-v2/RecipeCard";

export const metadata: Metadata = {
  title: "Recipes V4.1 (mockup) · QG Intelligence",
  description:
    "Recipes V4.1 gallery — dashboard panel grid + L1-color accent + tooltip-based honesty. Local-only, not for production.",
  robots: { index: false, follow: false },
};

const STATUS_ORDER: Record<TrackerRecipe["status"], number> = {
  graduated: 0,
  walked_no_graduation: 1,
  in_progress: 2,
  live_legacy: 3,
  queued: 4,
};

const L1_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Recipes V4.1 gallery — sibling to /precedents-v2 with the 2026-05-27
 * vocabulary swap applied (Charter §3-aligned: "Recipes" as the methodology
 * unit at page level). The detail page at /recipes-v4.1/[slug] carries
 * the dashboard panel grid + L1-color accent + tooltip honesty redesign.
 *
 * Cards reuse the V4 RecipeCard component (still good) but link into V4.1
 * detail routes — that's the only behavior shift at gallery level.
 */
export default function RecipesV41GalleryPage() {
  const recipes = getAllRecipes();
  const groups: Record<string, TrackerRecipe[]> = {};
  for (const r of recipes) {
    if (!groups[r.l1_id]) groups[r.l1_id] = [];
    groups[r.l1_id].push(r);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.label.localeCompare(b.label)
    );
  }

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {/* Mockup banner */}
        <div
          style={{
            display: "inline-block",
            padding: "5px 12px",
            border: "1px solid var(--qgi-accent)",
            color: "var(--qgi-accent)",
            borderRadius: "4px",
            fontSize: "11px",
            letterSpacing: "1.5px",
            marginBottom: "16px",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          MOCKUP · Recipes V4.1 · local only
        </div>

        {/* Hero */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              color: "var(--qgi-accent)",
              fontSize: "10px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "8px",
            }}
          >
            Recipes
          </div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 600,
              lineHeight: 1.15,
              margin: "0 0 12px",
            }}
          >
            The recipe catalog
          </h1>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "15px",
              lineHeight: 1.55,
              maxWidth: "780px",
            }}
          >
            All {recipes.length} structural-event recipes in the QG Intelligence research
            program, grouped by L1 family. Pick any recipe to open its V4.1 report card:
            dashboard panel grid, L1-color accent, honesty via tooltips not yellow boxes.
          </p>
          <p
            style={{
              color: "var(--qgi-text-dim)",
              fontSize: "11.5px",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.3px",
              marginTop: "8px",
            }}
          >
            Vintage {vintageStamp()} · pick foreign_intervention to see the demo-graduated
            page in full.
          </p>
        </div>

        {/* Sections per L1 */}
        {L1_ORDER.map((l1Id) => {
          const rs = groups[l1Id];
          if (!rs?.length) return null;
          const l1Label = rs[0].l1_label;
          const l1Color = rs[0].l1_color;
          return (
            <section key={l1Id} style={{ marginTop: "32px" }}>
              <header
                style={{
                  display: "flex",
                  gap: "16px",
                  alignItems: "stretch",
                  marginBottom: "16px",
                }}
              >
                <div style={{ width: "4px", background: l1Color, borderRadius: "2px" }} />
                <div>
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      margin: 0,
                      color: "var(--qgi-text)",
                    }}
                  >
                    {l1Label}
                  </h2>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--qgi-text-dim)",
                      marginTop: "4px",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {rs.length} recipes
                  </div>
                </div>
              </header>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "14px",
                }}
              >
                {rs.map((r) => (
                  <RecipeCard key={r.recipe_id} recipe={r} basePath="/recipes-v4.1" />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
