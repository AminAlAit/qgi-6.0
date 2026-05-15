"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
import type { CalloutStyle } from "@/components/ml/Callouts";
import type { CountryRisk, RiskTier } from "@/lib/country-risks.schema";
import type { BuyerMlRecipe } from "@/lib/buyer-view";
import { countrySlug } from "@/lib/slug";

/**
 * V2 signals list — country picker grid for the top-4 LOCKed ML recipes.
 *
 * MVP-shallow scope (#655 founder pick 2026-05-12): list page shows
 * countries (read from country-risks.json). Each country card links to the
 * detail page for the strongest LOCKed recipe (currently
 * `civil_war_and_insurgency`, the only STRONG-tier D2 LOCK with measured AHI
 * + risk_elevation interpretation hint). When the bake exposes per-(country,
 * recipe) firing scores in a future cycle, this list page rewires to rank
 * countries by firing strength instead of V1 overall_risk_tier.
 *
 * The detail route `/signals-v2{a,b}/[country]/[slug]` accepts ANY top-4
 * recipe — the breadcrumb on the detail page exposes recipe-switching.
 */

const TIER_COLORS: Record<RiskTier, string> = {
  HIGH: "#ef4444", // red-500 — risk-tier chrome, not a caveat (Nasrin's no-red rule covers caveats)
  MODERATE: "#fbbf24", // amber-400
  INDICATIVE: "#a3a3a3", // neutral-400
};

export function SignalsV2List({
  countries,
  topRecipes,
  caveatStyle,
  generatedAt,
  modelVersion,
  defaultRecipeSlug,
}: {
  countries: Array<{ id: string } & CountryRisk>;
  /** Buyer-shaped top-4 recipes (currently just for count display). */
  topRecipes: BuyerMlRecipe[];
  caveatStyle: CalloutStyle;
  generatedAt: string;
  modelVersion: string;
  /** Recipe slug each country card links to by default. The detail page's
   *  recipe-switcher gets the user to the other top-4 recipes. */
  defaultRecipeSlug: string;
}) {
  const variantLetter = caveatStyle === "tufte" ? "a" : "b";
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1
          className="text-xs tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Signals V2 ({variantLetter.toUpperCase()})
        </h1>
        <p className="text-2xl font-semibold mb-2" style={{ color: "var(--qgi-text)" }}>
          ML-derived country signals
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-dim)" }}>
          Pick a country to view the top-4 validated ML recipes (currently{" "}
          {topRecipes.length}) against that country&apos;s context. Per-(country, recipe)
          firing scores arrive in a future bake; today this lists countries sorted by V1
          overall risk tier as the entry point. Detail pages show the recipe tear-sheet +
          the country slug in the header; switching recipes happens via the detail-page
          breadcrumb.{" "}
          {caveatStyle === "tufte" ? (
            <span className="italic">
              Compact view — caveats render as inline footnote annotations.{" "}
              <Link
                href="/signals-v2b"
                className="underline"
                style={{ color: "var(--qgi-text)" }}
              >
                Banner view →
              </Link>
            </span>
          ) : (
            <span className="italic">
              Banner view — caveats render as full-width prominent banners.{" "}
              <Link
                href="/signals-v2a"
                className="underline"
                style={{ color: "var(--qgi-text)" }}
              >
                Compact view →
              </Link>
            </span>
          )}
        </p>
      </header>

      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        data-testid="country-grid"
      >
        {countries.map((c) => (
          <CountryCard
            key={c.id}
            country={c}
            caveatStyle={caveatStyle}
            defaultRecipeSlug={defaultRecipeSlug}
          />
        ))}
      </div>

      <footer
        className="mt-12 pt-6 text-xs border-t"
        style={{
          color: "var(--qgi-text-dim)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <p>
          Generated {generatedAt} · Model version {modelVersion}. See{" "}
          <Link
            href="/signals"
            className="underline"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            V1 signals (statistical scoring)
          </Link>{" "}
          for the legacy, country-coverage-broader view.
        </p>
      </footer>
    </div>
  );
}

function CountryCard({
  country,
  caveatStyle,
  defaultRecipeSlug,
}: {
  country: { id: string } & CountryRisk;
  caveatStyle: CalloutStyle;
  defaultRecipeSlug: string;
}) {
  const cSlug = countrySlug(country.name);
  // Defensive: countries without a deterministic slug aren't routable; skip.
  if (!cSlug) return null;
  const href =
    caveatStyle === "tufte"
      ? (`/signals-v2a/${cSlug}/${defaultRecipeSlug}` as const)
      : (`/signals-v2b/${cSlug}/${defaultRecipeSlug}` as const);
  const tierColor = TIER_COLORS[country.overall_risk_tier];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg p-3 transition-colors"
      style={{
        backgroundColor: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
      }}
    >
      <CountryFlag alpha2={country.alpha_2} size={24} />
      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-medium truncate"
          style={{ color: "var(--qgi-text)" }}
        >
          {country.name}
        </div>
        <div
          className="font-data text-[10px] tracking-wide uppercase"
          style={{ color: tierColor }}
        >
          {country.overall_risk_tier}
        </div>
      </div>
    </Link>
  );
}
