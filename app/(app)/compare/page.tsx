/**
 * /compare -- two-country structural comparison page.
 *
 * Server component. Reads ?a=<iso>&b=<iso> from the URL, defaulting to
 * ARG (Argentina) and EGY (Egypt). All sections render server-side except
 * the CountryPickerPair (client component for combobox interaction).
 *
 * Section order:
 *   §00 Header band (breadcrumb, h1, lede, picker, HowToReadButton)
 *   §01 At-a-glance strip
 *   §02 Shared-recipe matrix
 *   §03 Drivers face-off
 *   §04 What's moving (both panels)
 *   §05 Rank history pair
 *   §06 Analog overlap
 *   §07 Vintage and sources
 *
 * V4.1 bar: no em-dashes, no banned vocab, no persona credits, flags via
 * FlagImg, family colors via familyColor(), NEUTRAL_SLATE for magnitude bars.
 * Mockup only -- local-only branch.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { CountryPickerPair } from "@/components/compare/CountryPickerPair";
import { GenerateComparisonReportButton } from "@/components/compare/GenerateComparisonReportButton";
import { CompareAtAGlance } from "@/components/compare/CompareAtAGlance";
import { CompareMatrix } from "@/components/compare/CompareMatrix";
import { CompareDriversFaceOff } from "@/components/compare/CompareDriversFaceOff";
import { CompareMovementPair } from "@/components/compare/CompareMovementPair";
import { CompareRankHistory } from "@/components/compare/CompareRankHistory";
import { CompareAnalogsPair } from "@/components/compare/CompareAnalogsPair";
import { CompareVintageSources } from "@/components/compare/CompareVintageSources";
import {
  getCountryByIso,
  atAGlance,
  compareGapRows,
  topSharedRecipe,
} from "@/lib/te-mock/compare-data";

const DEFAULT_A = "ARG";
const DEFAULT_B = "EGY";

export const metadata: Metadata = {
  title: "Compare · QG Intelligence",
  description:
    "Compare two countries on the same set of recipes side by side. Read across for one country, down for one recipe.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function ComparePage({ searchParams }: Props) {
  const { a: rawA, b: rawB } = await searchParams;

  const isoA = (rawA ?? DEFAULT_A).toUpperCase();
  const isoB = (rawB ?? DEFAULT_B).toUpperCase();

  // Fall back to defaults when ISO codes are invalid.
  const countryA = getCountryByIso(isoA) ?? getCountryByIso(DEFAULT_A)!;
  const countryB = getCountryByIso(isoB) ?? getCountryByIso(DEFAULT_B)!;

  const glance = atAGlance(countryA, countryB);
  const matrixRows = compareGapRows(countryA, countryB);
  const topRow = topSharedRecipe(countryA, countryB);

  return (
    <div
      style={{
        minHeight: "100%",
        background: "var(--qgi-bg)",
        color: "var(--qgi-text)",
      }}
    >
      {/* §00 Header band */}
      <div
        style={{
          borderBottom: "1px solid var(--qgi-border)",
          background: "var(--qgi-surface)",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 24px 24px" }}>
          {/* Breadcrumb + HowToReadButton row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "12px",
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
                href={"/countries" as Route}
                style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
              >
                Countries
              </Link>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span>Compare</span>
            </nav>

            {/* Vintage chip + GenerateComparisonReportButton + HowToReadButton */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.4px",
                  color: "var(--qgi-text-dim)",
                  padding: "3px 8px",
                  border: "1px solid var(--qgi-border)",
                  borderRadius: "3px",
                }}
              >
                {countryA.vintage}
              </span>
              <GenerateComparisonReportButton
                countryA={countryA.name}
                countryB={countryB.name}
              />
              <HowToReadButton routeKey="compare" />
            </div>
          </div>

          {/* H1 + lede */}
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 600,
              lineHeight: 1.2,
              margin: "0 0 8px",
            }}
          >
            Compare
          </h1>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.65,
              color: "var(--qgi-text-muted)",
              margin: "0 0 20px",
              maxWidth: "640px",
            }}
          >
            Two countries, the same metrics, today. Read across for one country, down for
            one recipe.
          </p>

          {/* CountryPickerPair -- the hero, full width */}
          <CountryPickerPair isoA={countryA.iso} isoB={countryB.iso} />
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "24px 24px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* §01 At-a-glance strip */}
          <CompareAtAGlance countryA={countryA} countryB={countryB} glance={glance} />

          {/* §02 Shared-recipe matrix */}
          <CompareMatrix countryA={countryA} countryB={countryB} rows={matrixRows} />

          {/* §03 Drivers face-off */}
          <CompareDriversFaceOff
            countryA={countryA}
            countryB={countryB}
            topRow={topRow}
          />

          {/* §04 What is moving */}
          <CompareMovementPair countryA={countryA} countryB={countryB} />

          {/* §05 Rank history pair */}
          <CompareRankHistory countryA={countryA} countryB={countryB} />

          {/* §06 Analog overlap */}
          <CompareAnalogsPair countryA={countryA} countryB={countryB} />

          {/* §07 Vintage and sources */}
          <CompareVintageSources countryA={countryA} countryB={countryB} />
        </div>
      </div>
    </div>
  );
}
