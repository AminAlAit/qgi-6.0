/**
 * CountryCardV41 — one country tile on /countries-v4.1.
 *
 * Color rules (Talia consult 2026-05-28):
 *   - Left 3px border = the DOMINANT lit family (family of the highest-
 *     scoring lit recipe). The headline stays neutral text — 40 colored
 *     headlines in a grid is noise.
 *   - A top "family ribbon" = equal-width segments, one per distinct lit
 *     family (ordered by best score, capped at 4 + a neutral "+N"), so the
 *     full set of threat kinds reads at a glance. Equal width on purpose:
 *     the ribbon is a categorical legend, NOT a magnitude bar.
 *   - Magnitude (compound) = a number + a NEUTRAL slate bar + sort order.
 *     Never a hue. Color encodes kind; length/number encode how much.
 *   - Flags are flagcdn images (FlagImg), never emoji.
 *
 * Honesty: today 0 recipes are deployed program-wide, so the count chip
 * reads "N lit · 0 deployed" in neutral styling (no green "validated"
 * affordance exists while deployed == 0).
 */
import Link from "next/link";
import type { Route } from "next";
import { FlagImg } from "./FlagImg";
import { NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import { familiesByBestScore } from "@/lib/te-mock/country-families";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

export function CountryCardV41({
  country,
  maxCompound,
}: {
  country: CountryV4;
  /** Atlas-wide max compound, for normalizing the neutral magnitude bar. */
  maxCompound: number;
}) {
  const fams = familiesByBestScore(country);
  const dominant = fams[0];
  const accent = dominant?.color ?? NEUTRAL_SLATE;
  const isDark = country.recipes_lit_count === 0;

  // Ribbon: up to 4 family segments + a neutral overflow segment.
  const MAX_SEG = 4;
  const shown = fams.slice(0, MAX_SEG);
  const overflow = fams.length - shown.length;

  const compoundPct = Math.max(
    2,
    Math.min(100, (country.compound_score / Math.max(1, maxCompound)) * 100)
  );

  const topRecipe = country.top_recipes[0];

  return (
    <Link
      href={`/countries-v4.1/${country.iso.toLowerCase()}` as Route}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <article
        style={{
          position: "relative",
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderLeft: `3px solid ${accent}`,
          borderRadius: "8px",
          overflow: "hidden",
          paddingTop: "6px", // room for the ribbon
          minHeight: "188px",
          display: "flex",
          flexDirection: "column",
          opacity: isDark ? 0.72 : 1,
        }}
      >
        {/* Family ribbon — equal-width categorical segments */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            display: "flex",
            gap: "1px",
            background: "var(--qgi-bg)",
          }}
        >
          {shown.map((f) => (
            <span
              key={f.id}
              title={`${f.id} · ${f.label}`}
              style={{ flex: 1, background: f.color }}
            />
          ))}
          {overflow > 0 && (
            <span
              title={`+${overflow} more famil${overflow === 1 ? "y" : "ies"}`}
              style={{ flex: 1, background: NEUTRAL_SLATE }}
            />
          )}
          {shown.length === 0 && (
            <span style={{ flex: 1, background: "var(--qgi-border)" }} />
          )}
        </div>

        <div
          style={{
            padding: "10px 14px 14px",
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          {/* Top row — flag + ISO chip */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "10px",
            }}
          >
            <FlagImg
              emoji={country.flag_emoji}
              name={country.name}
              width={30}
              radius={3}
            />
            <span
              style={{
                fontSize: "9.5px",
                padding: "2px 7px",
                border: "1px solid var(--qgi-border)",
                color: "var(--qgi-text-dim)",
                borderRadius: "3px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.5px",
              }}
            >
              {country.iso}
            </span>
          </div>

          {/* Name + region (neutral, not hued) */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                lineHeight: 1.2,
                color: "var(--qgi-text)",
                marginBottom: "3px",
              }}
            >
              {country.name}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--qgi-text-muted)",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
              }}
            >
              {country.region}
            </div>
          </div>

          {/* Compound: number + neutral magnitude bar */}
          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
                marginBottom: "5px",
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                  lineHeight: 1,
                }}
              >
                {country.compound_score.toFixed(0)}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  letterSpacing: "1px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                }}
                title="A relative stacking of high rankings, not a probability."
              >
                COMPOUND
              </span>
            </div>
            <div
              style={{
                height: "4px",
                borderRadius: "2px",
                background: "var(--qgi-bg)",
                border: "1px solid var(--qgi-border)",
                overflow: "hidden",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  width: `${compoundPct}%`,
                  height: "100%",
                  background: NEUTRAL_SLATE,
                  opacity: 0.85,
                }}
              />
            </div>

            {/* Bottom: top recipe + honest lit count */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "9px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
                gap: "8px",
              }}
            >
              {topRecipe ? (
                <span
                  style={{
                    fontSize: "10.5px",
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--qgi-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                  title={`Top: ${topRecipe.label} (${topRecipe.score.toFixed(0)})`}
                >
                  <span style={{ color: "var(--qgi-text-dim)" }}>top:</span>{" "}
                  <span style={{ color: accent, fontWeight: 600 }}>
                    {topRecipe.score.toFixed(0)}
                  </span>{" "}
                  {topRecipe.label}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--qgi-text-dim)",
                    fontStyle: "italic",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  no recipes lit
                </span>
              )}
              <span
                style={{
                  fontSize: "9.5px",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.3px",
                  background: "rgba(122,143,160,0.10)",
                  color: "var(--qgi-text-muted)",
                  border: "1px solid var(--qgi-border)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                title={`${country.recipes_lit_count} recipes lit; ${country.recipes_lit_graduated} deployed for decisions. Lit means the country's recent signals resemble that recipe's pattern; it is not a confirmed prediction.`}
              >
                {country.recipes_lit_count} lit · {country.recipes_lit_graduated} deployed
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
