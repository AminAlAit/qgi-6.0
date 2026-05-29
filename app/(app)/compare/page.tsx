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

/**
 * V4.1 round-3.2 lockdown (2026-05-29) — /compare is "Coming soon".
 *
 * The page renders the existing comparison chrome, BUT with identity
 * overlaid on cloned Argentina + Egypt data so the headline countries
 * read as "United States" vs "China". The whole body is blurred and
 * non-interactive; a centered overlay carries the founder-authored
 * "We're working on it" message. searchParams is intentionally ignored —
 * we don't want bookmarks pointing at the locked surface to render
 * different content.
 */
const LOCKDOWN = true;

export const metadata: Metadata = {
  title: "Compare · QG Intelligence",
  description:
    "Compare two countries on the same set of recipes side by side. Read across for one country, down for one recipe.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function ComparePage(_props: Props) {
  // Clone the existing default countries to get a real CountryV4 shape
  // (every downstream component is happy), then overlay the visible
  // identity fields with USA / China so the blurred backdrop reads as
  // the founder asked.
  const baseA = getCountryByIso("ARG")!;
  const baseB = getCountryByIso("EGY")!;
  const countryA = {
    ...baseA,
    iso: "USA",
    name: "United States",
    flag_emoji: "🇺🇸",
    region: "Americas",
  };
  const countryB = {
    ...baseB,
    iso: "CHN",
    name: "China",
    flag_emoji: "🇨🇳",
    region: "Asia",
  };

  const glance = atAGlance(countryA, countryB);
  const matrixRows = compareGapRows(countryA, countryB);
  const topRow = topSharedRecipe(countryA, countryB);

  return (
    <div
      style={{
        minHeight: "100%",
        background: "var(--qgi-bg)",
        color: "var(--qgi-text)",
        position: "relative",
      }}
    >
      {/* Blurred backdrop — the actual page body, with pointer events
        disabled so nothing inside is reachable while the page is locked.
        aria-hidden so screen readers skip the decorative blur and land on
        the overlay's heading instead. */}
      <div
        aria-hidden="true"
        style={{
          filter: LOCKDOWN ? "blur(6px) saturate(0.85)" : undefined,
          pointerEvents: LOCKDOWN ? "none" : undefined,
          userSelect: LOCKDOWN ? "none" : undefined,
        }}
      >
        {/* §00 Header band */}
        <div
          style={{
            borderBottom: "1px solid var(--qgi-border)",
            background: "var(--qgi-surface)",
          }}
        >
          <div
            style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 24px 24px" }}
          >
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

              {/* GenerateComparisonReportButton + HowToReadButton
                V4.1 §2: vintage stamp removed — lives in the global header. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
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
              Two countries, the same metrics, today. Read across for one country, down
              for one recipe.
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

      {LOCKDOWN && (
        <div
          // Overlay container — covers the whole page area so the blurred
          // backdrop reads as a single "frosted glass" surface. The thin
          // veil dims the body further so the foreground panel reads as
          // primary even on the brightest blurred cells.
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "rgba(11, 18, 27, 0.45)",
          }}
        >
          <section
            aria-labelledby="compare-lockdown-heading"
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderLeft: "3px solid var(--qgi-accent)",
              borderRadius: "8px",
              padding: "28px 32px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "3.5px",
                textTransform: "uppercase",
                color: "var(--qgi-accent)",
                fontFamily: "ui-monospace, monospace",
                marginBottom: "12px",
              }}
            >
              Coming soon
            </div>
            <h1
              id="compare-lockdown-heading"
              style={{
                fontSize: "22px",
                fontWeight: 600,
                lineHeight: 1.25,
                margin: "0 0 12px",
                color: "var(--qgi-text)",
              }}
            >
              Side-by-side country comparison
            </h1>
            <p
              style={{
                fontSize: "13.5px",
                lineHeight: 1.6,
                color: "var(--qgi-text-muted)",
                margin: 0,
              }}
            >
              We&apos;re currently working on making it possible for you to compare
              countries to one another. Same recipes, same metrics, side by side. Until
              then, you can compare any country to its closest historical analog via
              <Link
                href={"/nearest-analog" as Route}
                style={{
                  color: "var(--qgi-accent)",
                  textDecoration: "none",
                  marginLeft: "5px",
                }}
              >
                Nearest Analog
              </Link>
              .
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
