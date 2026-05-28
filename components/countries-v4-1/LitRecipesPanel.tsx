/**
 * LitRecipesPanel (P1) — the RESULTS hero: every recipe this country is lit
 * on, as a ranked table. Full-width, neutral/structural accent (it spans
 * families). Each row: family dot + letter glyph + recipe label + a score
 * bar (filled in the recipe's family color, length = the 0-100 rank) +
 * the score + an honest status chip.
 *
 * Honesty: the caption carries Kwame's canonical graduation-gap sentence;
 * status chips use blessed plain labels (statusLabel); green is reserved
 * for a genuinely deployed recipe, which is none today.
 */
import Link from "next/link";
import type { Route } from "next";
import { PanelShell } from "./PanelShell";
import { FamilyChip } from "./FamilyChip";
import { familyColor, NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import { statusLabel, type StatusTone } from "@/lib/te-mock/country-families";
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

  return (
    <PanelShell
      title="Lit recipes"
      accent={NEUTRAL_SLATE}
      fullWidth
      caption="None of these patterns has yet cleared our validation bar, so every light here is a flag worth a closer look, not a confirmed prediction. Scores are a relative ranking from 0 to 100, not a probability."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {rows.map((r) => {
          const color = familyColor(r.l1_id, r.l1_color);
          const { label, tone } = statusLabel(r.status);
          return (
            <Link
              key={r.recipe_id}
              href={`/precedents-v4.1/${r.recipe_id}` as Route}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(120px, 1fr) auto auto",
                alignItems: "center",
                gap: "12px",
                padding: "8px 8px",
                borderRadius: "5px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {/* Family dot + glyph + label */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}
              >
                <FamilyChip
                  id={r.l1_id}
                  label={r.l1_label}
                  color={color}
                  showLabel={false}
                />
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

              {/* Score bar (family hue, length = rank) */}
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
                    background: color,
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

              {/* Honest status chip */}
              <span
                style={{
                  fontSize: "9.5px",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.2px",
                  whiteSpace: "nowrap",
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
