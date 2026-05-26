import type { Metadata } from "next";
import { getAllRecipes, vintageStamp, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { RecipeCard } from "@/components/precedents-v2/RecipeCard";

export const metadata: Metadata = {
  title: "Precedents (v2 mockup) · QG Intelligence",
  description:
    "TE-era precedents gallery mockup. All 71 recipes grouped by L1 family with status-aware cards. Local-only; not for production.",
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

export default function PrecedentsGalleryPage() {
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

  const statusCounts = recipes.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

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
          MOCKUP · precedents-v2 · local only
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
            Precedents
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
            All {recipes.length} structural-precedent recipes in the QG Intelligence
            research program, grouped by L1 family. Each card links to its detail page
            with the recipe&apos;s 15-capability profile. Icons are Lucide line-art
            symbols, chosen per recipe to match its meaning.
          </p>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
            padding: "16px 0",
            marginBottom: "16px",
            borderTop: "1px solid var(--qgi-border)",
            borderBottom: "1px solid var(--qgi-border)",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--qgi-text-dim)",
              marginRight: "6px",
            }}
          >
            Tier
          </span>
          {(
            [
              ["All", recipes.length, true],
              ["◐ Walked-failed", statusCounts.walked_no_graduation ?? 0, false],
              ["▣ Legacy", statusCounts.live_legacy ?? 0, false],
              ["○ Queued", statusCounts.queued ?? 0, false],
            ] as Array<[string, number, boolean]>
          ).map(([label, count, active]) => (
            <span
              key={label}
              style={{
                fontSize: "11px",
                padding: "5px 10px",
                background: active ? "var(--qgi-accent)" : "var(--qgi-surface)",
                color: active ? "var(--qgi-bg)" : "var(--qgi-text-muted)",
                border: `1px solid ${active ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
                borderRadius: "4px",
                userSelect: "none",
              }}
            >
              {label} ({count})
            </span>
          ))}
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1px",
              color: "var(--qgi-text-dim)",
              padding: "4px 8px",
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
            }}
          >
            Tracker vintage: {vintageStamp()}
          </span>
        </div>

        {/* Sections per L1 */}
        {L1_ORDER.map((l1Id) => {
          const rs = groups[l1Id];
          if (!rs?.length) return null;
          const l1Label = rs[0].l1_label;
          const l1Color = rs[0].l1_color;
          const counts = rs.reduce(
            (acc, r) => {
              acc[r.status] = (acc[r.status] ?? 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );
          const parts: string[] = [];
          if (counts.walked_no_graduation)
            parts.push(`${counts.walked_no_graduation} walked-failed`);
          if (counts.live_legacy) parts.push(`${counts.live_legacy} legacy`);
          if (counts.queued) parts.push(`${counts.queued} queued`);
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
                    {rs.length} recipes · {parts.join(" · ") || "no recipes"}
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
                  <RecipeCard key={r.recipe_id} recipe={r} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
