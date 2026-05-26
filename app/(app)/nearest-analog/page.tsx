/**
 * /nearest-analog — Nearest-Analog finder mockup page.
 *
 * Implements §2.C of `qgi-docs/internal/design/te-site-architecture-target-state.md`:
 * "Pick a country today, the system shows you the closest historical match.
 * Pure shape-matching across the recipe library."
 *
 * Maps to Capability #12 (Nearest historical analog) in the TE capability
 * ledger — SHAP-weighted cosine across the 4-indicator trajectory, k=3,
 * self-excluded, regional-clustering caveat applied.
 *
 * Honesty regime (M8-R5 binding):
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
import Link from "next/link";
import type { Route } from "next";
import { Telescope } from "lucide-react";
import {
  getCurrentCountries,
  defaultCurrentCountry,
} from "@/lib/te-mock/nearest-analog-data";
import { vintageStamp } from "@/lib/te-mock/recipes";
import { CountryPicker } from "@/components/nearest-analog/CountryPicker";
import { MethodologyBox } from "@/components/nearest-analog/MethodologyBox";

export const metadata: Metadata = {
  title: "Nearest-Analog Finder (mockup) · QG Intelligence",
  description:
    "Pick a country today, see its closest historical pre-crisis shape matches. TE Capability #12 mockup. Local-only; not for production.",
  robots: { index: false, follow: false },
};

export default function NearestAnalogPage() {
  const entries = getCurrentCountries();
  const dflt = defaultCurrentCountry();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "24px" }}>
        {/* Mockup banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "5px 12px",
              border: "1px solid var(--qgi-accent)",
              color: "var(--qgi-accent)",
              borderRadius: "4px",
              fontSize: "11px",
              letterSpacing: "1.5px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            MOCKUP · /nearest-analog · local only
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "5px 10px",
              border: "1px solid var(--qgi-border)",
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.4px",
              background: "var(--qgi-surface)",
              borderRadius: "4px",
            }}
          >
            Data as of {vintageStamp()}
          </span>
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
            Trajectory Engine · Capability 12
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
            Nearest-Analog finder
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
            Pick a country today, the engine shows you the closest historical match —
            &ldquo;this looks most like Tunisia 2008 + Argentina 2015.&rdquo; Pure
            shape-matching across the 71-recipe library. A <strong>similarity</strong>{" "}
            statement, not a forecast: the historical outcome is what happened to the
            analog country, never a prediction about today&apos;s.
          </p>
        </header>

        {/* M8-R5 disclosure banner */}
        <div
          style={{
            padding: "14px 18px",
            background: "rgba(230,143,41,0.08)",
            border: "1px solid #E68F29",
            borderRadius: "8px",
            marginBottom: "24px",
            borderLeft: "3px solid #E68F29",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.2px",
              color: "#E68F29",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            HONESTY-REGIME DISCLOSURE · M8-R5 BINDING
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--qgi-text)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Analog matches are{" "}
            <strong>shape similarities, NOT forward predictions</strong>. &ldquo;Egypt
            today looks like Tunisia 2008&rdquo; means the indicator trajectories rhyme —
            it does NOT mean Egypt will follow Tunisia&apos;s outcome. No QGI recipe is
            currently 🟢 Validated; the demo render uses{" "}
            <Link
              href={"/precedents-v2/foreign_intervention" as Route}
              style={{
                color: "var(--qgi-accent)",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
              }}
            >
              foreign_intervention
            </Link>{" "}
            as the primary recipe (post-vacate, walked-failed), with other walked-failed
            and queued recipes contributing as secondary shapes. Tier chips show this on
            every recipe surface.
          </p>
        </div>

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
            <CountryPicker entries={entries} defaultIso={dflt.iso} />
          </main>
          <div style={{ position: "sticky", top: "24px" }}>
            <MethodologyBox />
          </div>
        </div>

        {/* Persona signature */}
        <footer
          style={{
            marginTop: "48px",
            paddingTop: "20px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.4px",
            textAlign: "right",
          }}
        >
          Designed by Daniyar Bekmurat — Comparative Historical Pattern Matching
        </footer>
      </div>
    </div>
  );
}
