/**
 * /nearest-analog — Nearest-Analog finder mockup page.
 *
 * Implements §2.C of `qgi-docs/internal/design/te-site-architecture-target-state.md`:
 * "Pick a country today, the system shows you the closest historical match.
 * Pure shape-matching across the recipe library."
 *
 * Maps to Capability #12 (Nearest historical analog) in the TE capability
 * ledger: SHAP-weighted cosine across the 4-indicator trajectory, k=3,
 * self-excluded, regional-clustering caveat applied.
 *
 * Honesty constraints:
 * - Matches are SIMILARITY, never forward predictions.
 * - "What happened next" is HISTORICAL FACT about the analog country.
 * - All non-graduated recipes carry visible tier chips.
 * - Vintage stamp on every result.
 *
 * Server component. The CountryPicker child is "use client" — that's the
 * only interactive surface on the page.
 *
 * Mockup only. Not for production. Local branch `local/te-precedents-mockup`.
 */
import type { Metadata } from "next";
import { Telescope } from "lucide-react";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import {
  getCurrentCountries,
  defaultCurrentCountry,
} from "@/lib/te-mock/nearest-analog-data";
import { CountryPicker } from "@/components/nearest-analog/CountryPicker";
import { MethodologyBox } from "@/components/nearest-analog/MethodologyBox";
import { COUNTRIES_V4 } from "@/lib/te-mock/countries-v4-data";

export const metadata: Metadata = {
  title: "Nearest Analog Finder · QG Intelligence",
  description:
    "Pick a country today, see its closest historical pre-crisis shape matches.",
};

interface NearestAnalogPageProps {
  searchParams: Promise<{ iso?: string }>;
}

export default async function NearestAnalogPage({
  searchParams,
}: NearestAnalogPageProps) {
  const { iso: isoParam } = await searchParams;
  const entries = getCurrentCountries();
  const dflt = defaultCurrentCountry();

  // Resolve requested ISO: if the corpus has it use it; otherwise pass the
  // default and let CountryPicker render the "no data yet" banner.
  const requestedIso = isoParam?.toUpperCase();
  const inCorpus = requestedIso ? entries.some((e) => e.iso === requestedIso) : false;
  const resolvedDefaultIso = inCorpus ? (requestedIso as string) : dflt.iso;

  // If an ISO was requested but isn't in the analog corpus, look up its name
  // from the v4 country list for a human-readable banner.
  const unavailableName =
    requestedIso && !inCorpus
      ? (COUNTRIES_V4.find((c) => c.iso === requestedIso)?.name ?? requestedIso)
      : null;

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "24px" }}>
        {/* V4.1 §2: vintage stamp removed — lives in the global header. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          <HowToReadButton routeKey="nearest-analog" />
        </div>

        {/* Hero */}
        <header style={{ marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--qgi-accent)",
              fontSize: "10px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "10px",
            }}
          >
            <Telescope size={13} strokeWidth={2} />
            Nearest Analog
          </div>
          <h1
            style={{
              fontSize: "36px",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 14px",
              maxWidth: "920px",
            }}
          >
            Nearest Analog finder
          </h1>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "16px",
              lineHeight: 1.55,
              maxWidth: "780px",
              margin: 0,
            }}
          >
            Pick a country today, the engine shows you the closest historical match:
            &ldquo;this looks most like Tunisia 2008 + Argentina 2015.&rdquo; Pure
            shape-matching across the 71-recipe library. A <strong>similarity</strong>{" "}
            statement, not a forecast: the historical outcome is what happened to the
            analog country, never a prediction about today&apos;s.
          </p>
        </header>

        {/* Main: picker + results column · methodology side panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <main style={{ minWidth: 0 }}>
            <CountryPicker
              entries={entries}
              defaultIso={resolvedDefaultIso}
              unavailableName={unavailableName ?? undefined}
            />
          </main>
          <div style={{ position: "sticky", top: "24px" }}>
            <MethodologyBox />
          </div>
        </div>
      </div>
    </div>
  );
}
