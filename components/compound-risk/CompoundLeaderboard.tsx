import Link from "next/link";
import type { Route } from "next";
import { iconForRecipe } from "@/lib/te-mock/icons";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import {
  RECIPE_LOOKUP,
  type CompoundCountry,
  type CompoundLitRecipe,
} from "@/lib/te-mock/compound-risk-data";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { FamilyChip } from "@/components/countries-v4-1/FamilyChip";
import { flagFor } from "@/lib/te-mock/country-flags";
import { familyColor, familyLabel } from "@/lib/te-mock/l1-families";
import { statusLabel } from "@/lib/te-mock/country-families";

interface Props {
  countries: CompoundCountry[];
  minThreshold: number;
  allCount: number;
}

export function CompoundLeaderboard({ countries, minThreshold, allCount }: Props) {
  return (
    <section style={{ marginTop: "32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
          marginBottom: "14px",
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
          §01
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
          Compound leaderboard
        </h2>
        <span
          style={{
            fontSize: "10.5px",
            color: "var(--qgi-text-muted)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
          }}
        >
          showing {countries.length} of {allCount} · ≥{minThreshold} recipes lit
        </span>
      </div>

      {countries.length === 0 ? (
        <div
          style={{
            padding: "32px",
            border: "1px dashed var(--qgi-border)",
            background: "rgba(122,143,160,0.04)",
            borderRadius: "8px",
            textAlign: "center",
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
            fontStyle: "italic",
          }}
        >
          No countries clear the current threshold + family filter. Loosen the minimum or
          remove a family requirement.
        </div>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {countries.map((c, i) => (
            <CompoundRow key={c.iso} country={c} rank={i + 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

function CompoundRow({ country, rank }: { country: CompoundCountry; rank: number }) {
  const sortedRecipes = [...country.lit_recipes].sort((a, b) => b.score - a.score);
  return (
    <li>
      <article
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "8px",
          padding: "14px 16px",
          display: "grid",
          gridTemplateColumns: "44px minmax(180px, 1.4fr) 1fr 110px",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* Rank */}
        <div
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            textAlign: "right",
          }}
        >
          {String(rank).padStart(2, "0")}
        </div>

        {/* Country block */}
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/countries/${country.iso.toLowerCase()}` as Route}
            style={{
              textDecoration: "none",
              color: "var(--qgi-text)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <FlagImg emoji={flagFor(country.country)} name={country.country} width={24} />
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.2 }}>
                {country.country}
              </span>
              <span
                style={{
                  fontSize: "10.5px",
                  color: "var(--qgi-text-dim)",
                  letterSpacing: "0.6px",
                  fontFamily: "ui-monospace, monospace",
                  marginTop: "2px",
                }}
              >
                {country.iso} · {country.region}
              </span>
            </span>
          </Link>
          <div
            style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}
          >
            {country.lit_families.map((famId) => {
              const fam = country.lit_recipes.find((r) => r.l1_id === famId);
              if (!fam) return null;
              const color = familyColor(famId, fam.l1_color);
              const label = familyLabel(famId, fam.l1_label);
              return (
                <FamilyChip
                  key={famId}
                  id={famId}
                  label={label}
                  color={color}
                  showLabel={false}
                />
              );
            })}
          </div>
        </div>

        {/* Recipe icons row */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {sortedRecipes.map((r) => (
            <RecipeChip key={r.recipe_id} recipe={r} />
          ))}
        </div>

        {/* Score block */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "3px",
            }}
          >
            COMPOUND RISK
          </div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 600,
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-amber)",
              lineHeight: 1,
            }}
          >
            {country.compound_score.toFixed(1)}
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
              marginTop: "4px",
              letterSpacing: "0.3px",
            }}
          >
            {country.lit_recipes.length} recipes lit
          </div>
        </div>
      </article>
    </li>
  );
}

function RecipeChip({ recipe }: { recipe: CompoundLitRecipe }) {
  const tracker = RECIPE_LOOKUP[recipe.recipe_id];
  const isGraduated = recipe.recipe_id === "foreign_intervention"; // demo near-deployed
  const rawStatus = isGraduated ? "graduated" : (tracker?.status ?? "queued");
  const { label: friendlyStatus } = statusLabel(rawStatus);
  const chipColor = familyColor(recipe.l1_id, recipe.l1_color);
  return (
    <Link
      href={`/precedents-v2/${recipe.recipe_id}` as Route}
      title={`${recipe.label}: score ${recipe.score.toFixed(1)} (decile ${recipe.decile}), ${friendlyStatus}`}
      style={{
        textDecoration: "none",
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "38px",
        height: "38px",
        borderRadius: "6px",
        background: `${chipColor}1A`,
        border: `1px solid ${chipColor}`,
        color: chipColor,
        // Tested-did-not-hold-up signature: dashed border per RecipeCard.tsx convention.
        borderStyle:
          !isGraduated && rawStatus === "walked_no_graduation" ? "dashed" : "solid",
        opacity: !isGraduated && rawStatus === "queued" ? 0.55 : 1,
      }}
    >
      <RecipeIcon recipeId={recipe.recipe_id} size={20} strokeWidth={1.6} />
      <span
        style={{
          position: "absolute",
          bottom: "-4px",
          right: "-4px",
          fontSize: "9px",
          fontFamily: "ui-monospace, monospace",
          background: "var(--qgi-bg)",
          color: "var(--qgi-text-muted)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "8px",
          padding: "1px 4px",
          lineHeight: 1,
          letterSpacing: "0.2px",
        }}
      >
        {recipe.score.toFixed(0)}
      </span>
      {/* Hidden a11y status — screen readers pick it up from title above */}
      <span style={{ position: "absolute", left: "-9999px" }} aria-hidden>
        {friendlyStatus}
      </span>
    </Link>
  );
}
