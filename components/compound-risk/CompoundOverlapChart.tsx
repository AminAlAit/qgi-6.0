import { iconForRecipe } from "@/lib/te-mock/icons";
import type { CompoundCountry } from "@/lib/te-mock/compound-risk-data";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

interface Props {
  countries: CompoundCountry[];
}

export function CompoundOverlapChart({ countries }: Props) {
  if (countries.length === 0) return null;

  const maxScore = Math.max(
    ...countries.flatMap((c) => c.lit_recipes.map((r) => r.score)),
    100
  );

  return (
    <section style={{ marginTop: "48px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
          marginBottom: "14px",
          borderTop: "1px solid var(--qgi-border)",
          paddingTop: "24px",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            letterSpacing: "1.5px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-dim)",
          }}
        >
          §02
        </span>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 600,
            margin: 0,
            color: "var(--qgi-text)",
            flex: 1,
          }}
        >
          Where the families stack — top {countries.length}
        </h2>
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "1px",
            padding: "2px 7px",
            border: "1px solid #3FBF8F",
            color: "#3FBF8F",
            borderRadius: "3px",
            fontFamily: "ui-monospace, monospace",
            opacity: 0.85,
          }}
        >
          Stacked bar
        </span>
      </div>
      <p
        style={{
          fontSize: "12px",
          color: "var(--qgi-text-muted)",
          marginBottom: "20px",
          maxWidth: "780px",
          lineHeight: 1.5,
        }}
      >
        Each bar is the country&apos;s compound stack, segmented by L1 family. Wider
        segments = larger contribution to the compound score. Read horizontally to see{" "}
        <em>which families pile up on which country</em>.
      </p>

      <div
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "8px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {countries.map((c) => {
          const total = c.lit_recipes.reduce((s, r) => s + r.score, 0);
          return (
            <div
              key={c.iso}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr 70px",
                gap: "14px",
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1 }} aria-hidden>
                  {c.flag}
                </span>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--qgi-text)",
                    }}
                  >
                    {c.country}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--qgi-text-dim)",
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.4px",
                    }}
                  >
                    {c.iso}
                  </span>
                </div>
              </div>
              <div
                style={{
                  height: "26px",
                  display: "flex",
                  borderRadius: "4px",
                  overflow: "hidden",
                  border: "1px solid var(--qgi-border)",
                  background: "var(--qgi-bg)",
                  width: `${Math.min(100, (total / (maxScore * 4)) * 100 + 30)}%`,
                  transition: "width 0.2s",
                }}
              >
                {c.lit_recipes.map((r, idx) => {
                  const pct = (r.score / total) * 100;
                  return (
                    <div
                      key={r.recipe_id}
                      title={`${r.label} · ${r.score.toFixed(1)} · family ${r.l1_id}`}
                      style={{
                        width: `${pct}%`,
                        background: `${r.l1_color}66`,
                        borderRight:
                          idx < c.lit_recipes.length - 1
                            ? `1px solid ${r.l1_color}`
                            : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: r.l1_color,
                        minWidth: "22px",
                      }}
                    >
                      <RecipeIcon recipeId={r.recipe_id} size={14} strokeWidth={1.8} />
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--qgi-amber)",
                  fontFamily: "ui-monospace, monospace",
                  textAlign: "right",
                }}
              >
                {c.compound_score.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Family legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "14px" }}>
        {Array.from(
          new Map(
            countries.flatMap((c) =>
              c.lit_recipes.map((r) => [
                r.l1_id,
                { id: r.l1_id, label: r.l1_label, color: r.l1_color },
              ])
            )
          ).values()
        ).map((f) => (
          <span
            key={f.id}
            style={{
              fontSize: "10.5px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.3px",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                background: f.color,
                borderRadius: "2px",
                display: "inline-block",
              }}
            />
            {f.id} · {f.label}
          </span>
        ))}
      </div>
    </section>
  );
}
