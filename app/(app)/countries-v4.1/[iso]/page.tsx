/**
 * /countries-v4.1/[iso] — single-country page, V4.1 panels idiom.
 *
 * Parallel to /countries-v4/[iso] (the older §01–§08 dossier, left
 * untouched). Reading arc (Sofia): header → lit recipes → why/what's-moving
 * pair → recent movement → analogs → how to read → vintage & sources.
 *
 * Honesty bar (Kwame/Talia): discrimination ranks not probabilities; no
 * internal machinery (M8-R5 / walk / gate / Majles / LOCO / Cohort); the
 * firewall lives as a calm always-present panel; momentum terminates at
 * today; analogs are similarity not forecast; no rendered persona credit;
 * no em-dashes. Server component; params is Promise per Next.js 16.
 *
 * Mockup only. Local-only.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { COUNTRIES_V4, getCountryByIso } from "@/lib/te-mock/countries-v4-data";
import { familiesByBestScore } from "@/lib/te-mock/country-families";
import { NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import { CountryV41Header } from "@/components/countries-v4-1/CountryV41Header";
import { LitRecipesPanel } from "@/components/countries-v4-1/LitRecipesPanel";
import {
  WhyScoresPanel,
  WhatsMovingPanel,
} from "@/components/countries-v4-1/DriversPanels";
import { RankHistoryPanel } from "@/components/countries-v4-1/RankHistoryPanel";
import { AnalogsPanelV41 } from "@/components/countries-v4-1/AnalogsPanelV41";
import {
  HowToReadPanel,
  VintageSourcesPanel,
} from "@/components/countries-v4-1/ReadMePanels";

interface Params {
  params: Promise<{ iso: string }>;
}

export async function generateStaticParams() {
  return COUNTRIES_V4.map((c) => ({ iso: c.iso.toLowerCase() }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { iso } = await params;
  const country = getCountryByIso(iso);
  return {
    title: country
      ? `${country.name} · QG Intelligence`
      : "Country not found · QG Intelligence",
    description: country
      ? `${country.name}: the recipes its recent signals resemble, the indicators behind each score, recent movement, and historical analogs. Local-only mockup.`
      : "Country not found.",
    robots: { index: false, follow: false },
  };
}

// A full-width row holding a responsive pair of panels (stacks on narrow).
function PanelPair({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "16px",
      }}
    >
      {children}
    </div>
  );
}

export default async function CountryV41DetailPage({ params }: Params) {
  const { iso } = await params;
  const country = getCountryByIso(iso);
  if (!country) notFound();

  const fams = familiesByBestScore(country);
  const driversAccent = fams[0]?.color ?? NEUTRAL_SLATE;
  const topRecipe = country.top_recipes[0];

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Header band */}
      <div
        style={{
          borderBottom: "1px solid var(--qgi-border)",
          background: "var(--qgi-surface)",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 24px 24px" }}>
          <nav
            aria-label="Breadcrumb"
            style={{
              fontSize: "11px",
              letterSpacing: "0.3px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "16px",
            }}
          >
            <Link
              href={"/countries-v4.1" as Route}
              style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
            >
              ← Countries
            </Link>
            <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
            <span style={{ color: "var(--qgi-text-muted)" }}>{country.region}</span>
            <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
            <span>{country.iso}</span>
          </nav>
          <CountryV41Header country={country} />
        </div>
      </div>

      {/* Body — reading arc */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "24px 24px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <LitRecipesPanel country={country} />

          <PanelPair>
            <WhyScoresPanel
              accent={driversAccent}
              countryName={country.name}
              topRecipeLabel={topRecipe?.label ?? "its top recipe"}
              attribution={country.drivers_attribution}
            />
            <WhatsMovingPanel
              accent={driversAccent}
              countryName={country.name}
              movement={country.drivers_movement}
            />
          </PanelPair>

          <RankHistoryPanel country={country} />

          <PanelPair>
            <AnalogsPanelV41 country={country} />
            <HowToReadPanel />
          </PanelPair>

          <VintageSourcesPanel country={country} />
        </div>
      </div>
    </div>
  );
}
