/**
 * COUNTRIES V2 — Narrative variant (guided tour, Cairo school)
 *
 * Design intent (Ingrid Halvorsen-Mbeki, Sard Majles S-Country 2026-05-02):
 * A guided tour of the global risk landscape for readers who don't know
 * what RCI or LOCO means. Opens with framing, moves through "5 countries
 * to watch", explains what a HIGH-risk country actually means with a
 * worked example, then hands off to V1 /countries for the full browser.
 *
 * Cairo bars: small horizontal bars next to country names encode tier
 * as proportional fill width + color — no abstract numbers.
 *
 * Auto-narrative: short MOCK sentences that summarize what data means.
 * In production: AI-generation pipeline with human-review gate (per
 * Ingrid's binding rule in the Sard Majles decision).
 *
 * All MOCK: content is clearly labelled inline and in mockNarratives.ts.
 *
 * Visual chrome: Lloyd's-banner style (full-width content blocks,
 * narrative flow, generous typography) — not Tufte footnotes.
 *
 * Implementation status: MOCK-FILLED design exploration.
 * Cross-decision deps: same as original scaffold comment at top.
 *
 * @see components/countries-v2-narrative/mockNarratives.ts
 * @see components/countries-v2-narrative/CairoTierBar.tsx
 */

import Link from "next/link";
import {
  CairoTierBar,
  TierGloss,
  TierPill,
} from "@/components/countries-v2-narrative/CairoTierBar";
import {
  WATCH_COUNTRIES,
  WORKED_EXAMPLE,
} from "@/components/countries-v2-narrative/mockNarratives";
import { countrySlug } from "@/lib/slug";
import { loadCountryRisks } from "@/lib/country-risks";
import type { RiskTier } from "@/lib/country-risks.schema";

export const revalidate = 3600;

export const metadata = {
  title: "Countries — QGI Intelligence",
  description:
    "A guided tour of geopolitical risk across 156 countries — plain-language explainer for policy researchers, journalists, and general audiences.",
  robots: { index: false, follow: false }, // design exploration, not indexed
};

// ---------------------------------------------------------------------------
// Tier distribution summary — pulled from live data to keep the framing
// paragraph honest even when mock content is in use.
// ---------------------------------------------------------------------------

type TierCounts = { HIGH: number; MODERATE: number; INDICATIVE: number; total: number };

async function getTierCounts(): Promise<TierCounts> {
  try {
    const data = await loadCountryRisks();
    const counts: TierCounts = { HIGH: 0, MODERATE: 0, INDICATIVE: 0, total: 0 };
    for (const c of Object.values(data.countries)) {
      counts[c.overall_risk_tier as RiskTier]++;
      counts.total++;
    }
    return counts;
  } catch {
    // If data unavailable, fall back to V1.9.1 known distribution
    return { HIGH: 27, MODERATE: 48, INDICATIVE: 81, total: 156 };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CountriesV2NarrativePage() {
  const tiers = await getTierCounts();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* ------------------------------------------------------------------ */}
      {/* Navigation stripe */}
      {/* ------------------------------------------------------------------ */}
      <nav
        className="mb-8 flex items-center gap-2 text-xs"
        style={{ color: "var(--qgi-text-dim)" }}
        aria-label="V2 variant navigation"
      >
        <span>Countries V2</span>
        <span>·</span>
        <span
          className="px-2 py-0.5 rounded"
          style={{
            backgroundColor: "var(--qgi-accent-glow)",
            color: "var(--qgi-accent)",
            border: "1px solid var(--qgi-accent)30",
          }}
        >
          Narrative view
        </span>
        <span style={{ color: "var(--qgi-border)" }}>|</span>
        <Link
          href="/countries-v2-table"
          className="underline underline-offset-2 transition-colors"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Table view →
        </Link>
        <span style={{ color: "var(--qgi-border)" }}>|</span>
        <Link
          href="/countries"
          className="underline underline-offset-2 transition-colors"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V1 browser →
        </Link>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Opening — the guided tour begins here */}
      {/* ------------------------------------------------------------------ */}
      <header className="mb-12">
        {/* MOCK: section label */}
        <div
          className="text-[10px] tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Global risk landscape · Q1 2026
        </div>

        <h1
          className="text-3xl font-semibold mb-5 leading-snug"
          style={{ color: "var(--qgi-text)" }}
        >
          {tiers.total} countries, scored on 71 dimensions of geopolitical risk.
        </h1>

        {/* MOCK: framing paragraph */}
        <p
          className="text-base leading-relaxed mb-4"
          style={{ color: "var(--qgi-text)" }}
        >
          Each quarter, QGI scores every country in our dataset across 71 categories of
          political, economic, and security risk — from civil-conflict signals to
          election-integrity indicators to fiscal-policy stress. The result is a{" "}
          <em>risk tier</em> <TierGloss /> that tells you where a country sits relative to
          the rest of the world.
        </p>

        <p
          className="text-base leading-relaxed mb-4"
          style={{ color: "var(--qgi-text)" }}
        >
          Right now, <strong style={{ color: "var(--qgi-danger)" }}>{tiers.HIGH}</strong>{" "}
          countries are at <TierPill tier="HIGH" />,{" "}
          <strong style={{ color: "var(--qgi-warning)" }}>{tiers.MODERATE}</strong> are at{" "}
          <TierPill tier="MODERATE" />, and{" "}
          <strong style={{ color: "var(--qgi-text-muted)" }}>{tiers.INDICATIVE}</strong>{" "}
          are at <TierPill tier="INDICATIVE" />. This page is a guided tour of what&apos;s
          moving right now — in plain language, with the jargon explained as we go.
        </p>

        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
          If you prefer to search and filter all {tiers.total} countries directly,{" "}
          <Link
            href="/countries"
            className="underline underline-offset-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            browse the full country list →
          </Link>
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: 5 countries to watch */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-14" aria-labelledby="watch-heading">
        {/* Section banner — Lloyd's-banner style */}
        <div
          className="rounded-t-lg px-5 py-3 mb-0"
          style={{
            backgroundColor: "var(--qgi-surface-2)",
            borderBottom: "2px solid var(--qgi-accent)40",
          }}
        >
          <div
            className="text-[10px] tracking-widest uppercase mb-0.5"
            style={{ color: "var(--qgi-accent)" }}
          >
            Q1 2026 · Curated
          </div>
          <h2
            id="watch-heading"
            className="text-lg font-semibold"
            style={{ color: "var(--qgi-text)" }}
          >
            5 countries to watch this quarter
          </h2>
        </div>

        <div
          className="rounded-b-lg overflow-hidden"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderTop: "none",
          }}
        >
          {/* MOCK: narrative intro */}
          <p
            className="px-5 pt-5 pb-3 text-sm leading-relaxed"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            The five entries below were selected because they either changed tier this
            quarter or because their driving indicators showed the clearest movement in
            the data. The bar next to each country name shows their current risk tier —
            the longer and more intensely coloured the bar, the higher the tier.
          </p>

          <div className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
            {WATCH_COUNTRIES.map((country) => {
              const slug = countrySlug(country.name);
              const href = slug
                ? (`/countries-v2-narrative/${slug}` as const)
                : ("/countries" as const);

              return (
                <Link
                  key={country.id}
                  href={href}
                  className="block px-5 py-4 transition-colors"
                  style={{ textDecoration: "none" }}
                >
                  <div className="flex items-start gap-4">
                    {/* Flag emoji + country name column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className="font-semibold text-sm"
                          style={{ color: "var(--qgi-text)" }}
                        >
                          {country.name}
                        </span>
                        <CairoTierBar tier={country.tier} compact />
                        {/* Tier movement callout */}
                        {country.previousTier &&
                          country.previousTier !== country.tier && (
                            <span
                              className="text-[9px] font-data tracking-wider uppercase px-1.5 py-0.5 rounded"
                              style={{
                                color: "var(--qgi-accent)",
                                backgroundColor: "var(--qgi-accent-glow)",
                                border: "1px solid var(--qgi-accent)30",
                              }}
                            >
                              {country.previousTier} → {country.tier}
                            </span>
                          )}
                      </div>

                      {/* MOCK: movement sentence */}
                      <p
                        className="text-sm leading-relaxed mb-2"
                        style={{ color: "var(--qgi-text-muted)" }}
                      >
                        {country.movementSentence}
                      </p>

                      {/* Driving category chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {country.drivingCategories.map((cat) => (
                          <span
                            key={cat}
                            className="text-[9px] font-data tracking-wide px-1.5 py-0.5 rounded"
                            style={{
                              color: "var(--qgi-text-dim)",
                              backgroundColor: "var(--qgi-surface-2)",
                              border: "1px solid var(--qgi-border)",
                            }}
                          >
                            {cat.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right arrow hint */}
                    <div
                      className="text-xs mt-0.5 flex-shrink-0"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Footer note */}
          <div
            className="px-5 py-3 text-[10px]"
            style={{
              color: "var(--qgi-text-dim)",
              borderTop: "1px solid var(--qgi-border)",
              backgroundColor: "var(--qgi-surface-2)",
            }}
          >
            {/* MOCK: data provenance note */}
            MOCK: countries selected editorially for Q1 2026 design exploration. In
            production, selection criteria will be: tier changed this quarter OR driving
            category moved by &gt;0.5 z-score. · Data: country-risks.json V1.9.1 ·{" "}
            <Link
              href="/methodology"
              className="underline underline-offset-1"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Methodology →
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: What's a HIGH-risk country, really? */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-14" aria-labelledby="explainer-heading">
        {/* Lloyd's-banner section header */}
        <div
          className="rounded-t-lg px-5 py-3"
          style={{
            backgroundColor: "var(--qgi-surface-2)",
            borderBottom: "2px solid var(--qgi-warning)40",
          }}
        >
          <div
            className="text-[10px] tracking-widest uppercase mb-0.5"
            style={{ color: "var(--qgi-warning)" }}
          >
            Explainer · First read?
          </div>
          <h2
            id="explainer-heading"
            className="text-lg font-semibold"
            style={{ color: "var(--qgi-text)" }}
          >
            What&apos;s a HIGH-risk country, really?
          </h2>
        </div>

        <div
          className="rounded-b-lg p-5"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderTop: "none",
          }}
        >
          {/* Worked example lead */}
          <p
            className="text-sm leading-relaxed mb-5"
            style={{ color: "var(--qgi-text)" }}
          >
            {/* MOCK: Iran as worked example */}
            Let&apos;s use <strong>Iran</strong> as a concrete example.{" "}
            {WORKED_EXAMPLE.shortExplanation}
          </p>

          {/* Step-by-step explanation */}
          <ol className="space-y-4 mb-6">
            {WORKED_EXAMPLE.factoids.map((fact, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="font-data text-[10px] font-semibold mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--qgi-surface-2)",
                    color: "var(--qgi-text-muted)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  {i + 1}
                </span>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {fact}
                </p>
              </li>
            ))}
          </ol>

          {/* Important calibration note */}
          <div
            className="rounded-lg p-4 mb-4"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              border: "1px solid var(--qgi-warning)40",
            }}
          >
            <p
              className="text-xs font-semibold mb-1 tracking-wide uppercase"
              style={{ color: "var(--qgi-warning)" }}
            >
              What this doesn&apos;t mean
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
              A <TierPill tier="HIGH" /> tier does not mean conflict or crisis is
              imminent. It means the structural conditions — as measurable in quantitative
              indicator data — are more elevated than 80% of countries we track. Germany
              sitting at <TierPill tier="MODERATE" /> is not alarming; it reflects a
              political transition period that the data picked up, not a prediction of
              instability. The tiers describe relative positioning, not absolute danger
              thresholds.
            </p>
          </div>

          <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
            Want to see how Iran&apos;s categories break down?{" "}
            <Link
              href="/countries-v2-narrative/iran"
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Read Iran&apos;s narrative profile →
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Tier overview — Cairo bar distribution */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-14" aria-labelledby="distribution-heading">
        <div
          className="rounded-t-lg px-5 py-3"
          style={{
            backgroundColor: "var(--qgi-surface-2)",
            borderBottom: "2px solid var(--qgi-border)",
          }}
        >
          <div
            className="text-[10px] tracking-widest uppercase mb-0.5"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Dataset · {tiers.total} countries
          </div>
          <h2
            id="distribution-heading"
            className="text-lg font-semibold"
            style={{ color: "var(--qgi-text)" }}
          >
            The full picture at a glance
          </h2>
        </div>

        <div
          className="rounded-b-lg p-5"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderTop: "none",
          }}
        >
          {/* Distribution bars */}
          <div className="space-y-4 mb-6">
            {(
              [
                {
                  tier: "HIGH" as const,
                  count: tiers.HIGH,
                  color: "#f87171",
                  note: "Active conflict, humanitarian crisis, or acute political instability",
                },
                {
                  tier: "MODERATE" as const,
                  count: tiers.MODERATE,
                  color: "#fbbf24",
                  note: "Elevated signals in one or more categories; worth monitoring",
                },
                {
                  tier: "INDICATIVE" as const,
                  count: tiers.INDICATIVE,
                  color: "#4a6280",
                  note: "Background-level signals; scored but not currently elevated",
                },
              ] satisfies Array<{
                tier: RiskTier;
                count: number;
                color: string;
                note: string;
              }>
            ).map(({ tier, count, color, note }) => {
              const pct = tiers.total > 0 ? (count / tiers.total) * 100 : 0;
              return (
                <div key={tier}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span
                      className="font-data text-[10px] tracking-widest uppercase w-20 flex-shrink-0"
                      style={{ color }}
                    >
                      {tier}
                    </span>
                    {/* Distribution bar */}
                    <div
                      className="flex-1 h-2 rounded-full"
                      style={{
                        backgroundColor: `${color}15`,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          backgroundColor: color,
                          borderRadius: "4px",
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <span
                      className="font-data text-xs w-20 text-right flex-shrink-0"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {count} countries
                    </span>
                  </div>
                  <p
                    className="text-xs pl-[92px]"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {note}
                  </p>
                </div>
              );
            })}
          </div>

          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            These proportions are a deliberate design of the scoring methodology — the
            tier cutoffs are set so that HIGH is always approximately the top 20% and
            MODERATE the next 30%. That means tier boundaries stay stable over time even
            as the absolute scores shift, which makes quarter-on-quarter comparisons
            meaningful.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Browse all handoff */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="browse-heading">
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <h2
            id="browse-heading"
            className="text-base font-semibold mb-2"
            style={{ color: "var(--qgi-text)" }}
          >
            Browse all {tiers.total} countries
          </h2>
          <p
            className="text-sm leading-relaxed mb-4"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            The narrative view above covers countries with the clearest stories to tell
            right now. For the full searchable, filterable list — with tier badges,
            category breakdowns, and analogue timelines for every country — use the V1
            Country Intelligence Browser.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/countries"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--qgi-accent)",
                color: "#0f1923",
              }}
            >
              Browse all countries →
            </Link>
            <Link
              href="/countries-v2-table"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: "var(--qgi-surface-2)",
                color: "var(--qgi-text)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              V2 Table variant →
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="mt-12 pt-6 text-xs space-y-1"
        style={{
          color: "var(--qgi-text-dim)",
          borderTop: "1px solid var(--qgi-border)",
        }}
      >
        <p>
          Scoring: V1.9.1 · Generated {new Date().toISOString().slice(0, 10)} ·{" "}
          <Link
            href="/methodology"
            className="underline underline-offset-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Full methodology →
          </Link>
        </p>
        <p>
          This is a V2 design exploration — narrative content marked MOCK is illustrative
          copy, not production data. See{" "}
          <Link
            href="/countries-v2-table"
            className="underline underline-offset-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            V2 Table sibling →
          </Link>{" "}
          for the Elif/Rodrigo dense-table variant.
        </p>
      </footer>
    </div>
  );
}
