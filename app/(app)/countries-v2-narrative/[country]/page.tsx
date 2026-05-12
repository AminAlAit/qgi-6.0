/**
 * COUNTRIES V2 — Narrative per-country page
 *
 * A guided Scientific American-style tour of a single country's risk profile.
 * Reads like an article, not a terminal. Every piece of jargon is explained
 * on first use. Structure:
 *
 *   1. Opening paragraph (what is happening here right now)
 *   2. Tier assignment banner (Lloyd's-style) with Cairo bar
 *   3. "The 3 categories driving this country's risk right now" — with a
 *      sentence per category explaining what the signal means
 *   4. "Recent events that moved the score" — 4-5 events with dates +
 *      one-sentence explanations
 *   5. "How this compares to similar countries" — peer-group narrative
 *   6. Handoffs: V1 country profile (full data), browse all
 *
 * Cairo bars: horizontal tier bars for the country and its peers.
 * Auto-narrative: MOCK sentences in production would be AI-generated with
 * human-review gate (per Ingrid's binding rule, Sard Majles S-Country).
 *
 * For countries without MOCK narrative content, a graceful fallback renders
 * the live scoring data in a narrative template.
 *
 * Visual chrome: Lloyd's-banner style throughout.
 *
 * Implementation status: MOCK-FILLED design exploration.
 *
 * @see components/countries-v2-narrative/mockNarratives.ts
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadCountryRisks } from "@/lib/country-risks";
import { resolveCountryBySlug } from "@/lib/country-risks";
import { countrySlug } from "@/lib/slug";
import { CairoTierBar, TierPill } from "@/components/countries-v2-narrative/CairoTierBar";
import { COUNTRY_NARRATIVES } from "@/components/countries-v2-narrative/mockNarratives";
import type { RiskTier, CategoryScore } from "@/lib/country-risks.schema";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country: slug } = await params;
  const data = await resolveCountryBySlug(slug).catch(() => null);
  if (!data)
    return {
      title: "Country not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  return {
    title: `${data.name} — Risk narrative — QGI Intelligence`,
    description: `Plain-language narrative risk profile for ${data.name}. Risk tier: ${data.overall_risk_tier}.`,
    robots: { index: false, follow: false }, // design exploration
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Top 3 categories by salience_score across all tiers, deduplicated. */
function topCategories(
  tiers: Record<string, { top_categories: CategoryScore[] }>
): CategoryScore[] {
  const seen = new Set<string>();
  const all: CategoryScore[] = [];
  for (const tier of Object.values(tiers)) {
    for (const cat of tier.top_categories) {
      if (!seen.has(cat.category)) {
        seen.add(cat.category);
        all.push(cat);
      }
    }
  }
  return all.sort((a, b) => b.salience_score - a.salience_score).slice(0, 3);
}

/** MOCK: narrative template for countries without authored copy */
function generateFallbackNarrative(
  name: string,
  tier: RiskTier,
  topCats: CategoryScore[]
): string {
  // MOCK: template-based auto-narrative for non-authored countries
  const tierDesc: Record<RiskTier, string> = {
    HIGH: "sits at the highest tier in QGI's three-tier framework — meaning its composite risk profile places it in the top 20% of all 156 countries we score",
    MODERATE:
      "sits at MODERATE tier — meaning its composite risk profile places it in the middle band of the global distribution, elevated above INDICATIVE but not at the most acute level",
    INDICATIVE:
      "is scored at INDICATIVE tier — the broadest band in QGI's framework, where background signals are tracked but not yet elevated relative to the global distribution",
  };
  const catNames = topCats
    .slice(0, 2)
    .map((c) => c.category.replace(/_/g, " "))
    .join(" and ");
  return `${name} ${tierDesc[tier]}. The categories showing the strongest signals right now are ${catNames || "under assessment"} — these are the dimensions where ${name}'s indicator data diverges most from global norms. This narrative page shows a template; full authored copy would be added here by QGI's editorial team for countries of particular relevance.`;
}

/** Category label human-readable formatter */
function catLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ---------------------------------------------------------------------------
// Severity signal bar — small inline bar for a category's salience
// ---------------------------------------------------------------------------

function SalienceBar({ score }: { score: number }) {
  // salience_score is roughly 0-2+ in the data; cap at 2 for display
  const pct = Math.min((score / 2) * 100, 100);
  const color = pct >= 60 ? "#f87171" : pct >= 35 ? "#fbbf24" : "#4a6280";
  return (
    <div
      className="w-16 h-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: `${color}20`, overflow: "hidden" }}
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
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CountryNarrativePage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country: slug } = await params;
  const countryData = await resolveCountryBySlug(slug).catch(() => null);
  if (!countryData) notFound();

  const { id, name, overall_risk_tier: tier, curated, tiers: tierData } = countryData;

  // MOCK authored narrative if available; else fallback template
  const mock = COUNTRY_NARRATIVES[id] ?? null;
  const topCats = topCategories(tierData);

  // Peer countries — MOCK for authored, empty for fallback
  const peerNames: string[] = mock?.peers ?? [];

  // Get peer tier data for the comparison section
  let peerCountries: Array<{ name: string; tier: RiskTier }> = [];
  if (peerNames.length > 0) {
    try {
      const allData = await loadCountryRisks();
      peerCountries = Object.values(allData.countries)
        .filter((c) => peerNames.includes(c.name))
        .map((c) => ({ name: c.name, tier: c.overall_risk_tier as RiskTier }));
    } catch {
      // Fallback: show peer names without tier data
      peerCountries = peerNames.map((n) => ({ name: n, tier: "INDICATIVE" as RiskTier }));
    }
  }

  const fallbackOpening = generateFallbackNarrative(name, tier as RiskTier, topCats);

  return (
    <article className="max-w-3xl mx-auto px-6 py-12">
      {/* ------------------------------------------------------------------ */}
      {/* Breadcrumb + back navigation */}
      {/* ------------------------------------------------------------------ */}
      <nav
        className="mb-8 flex items-center gap-2 text-xs flex-wrap"
        style={{ color: "var(--qgi-text-dim)" }}
        aria-label="Back navigation"
      >
        <Link
          href="/countries-v2-narrative"
          className="underline underline-offset-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          ← Countries (narrative)
        </Link>
        <span>·</span>
        <span style={{ color: "var(--qgi-text-muted)" }}>{name}</span>
        {!mock && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{
              color: "var(--qgi-warning)",
              backgroundColor: "var(--qgi-warning)15",
              border: "1px solid var(--qgi-warning)30",
            }}
          >
            MOCK template (no authored copy)
          </span>
        )}
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Header — country name + tier */}
      {/* ------------------------------------------------------------------ */}
      <header className="mb-8">
        <div
          className="text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Country risk narrative · Q1 2026
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <h1
            className="text-3xl font-semibold leading-tight"
            style={{ color: "var(--qgi-text)" }}
          >
            {name}
          </h1>
          <CairoTierBar tier={tier as RiskTier} showLabel />
        </div>

        {/* Curated badge */}
        {curated && (
          <div
            className="inline-flex items-center gap-1.5 text-[10px] font-data tracking-wide px-2 py-1 rounded mb-4"
            style={{
              color: "var(--qgi-success)",
              backgroundColor: "var(--qgi-success)18",
              border: "1px solid var(--qgi-success)40",
            }}
          >
            CURATED — full event history available
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* Tier assignment banner — Lloyd's-banner style */}
        {/* ------------------------------------------------------------ */}
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor:
              tier === "HIGH"
                ? "#f8717110"
                : tier === "MODERATE"
                  ? "#fbbf2410"
                  : "var(--qgi-surface-2)",
            border: `1px solid ${
              tier === "HIGH"
                ? "#f8717140"
                : tier === "MODERATE"
                  ? "#fbbf2440"
                  : "var(--qgi-border)"
            }`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TierPill tier={tier as RiskTier} />
            <span className="text-xs font-semibold" style={{ color: "var(--qgi-text)" }}>
              Risk tier —{" "}
              {tier === "HIGH"
                ? "top 20% of 156 countries scored"
                : tier === "MODERATE"
                  ? "middle band — next 30% of 156 countries scored"
                  : "background level — bottom 50% of 156 countries scored"}
            </span>
          </div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {tier === "HIGH"
              ? "A HIGH tier means the composite of all 71 category scores places this country in the most elevated quartile globally. It reflects structural conditions visible in indicator data — it is a relative position, not a prediction of imminent crisis."
              : tier === "MODERATE"
                ? "A MODERATE tier means at least one risk category is showing elevated signals relative to global norms. It warrants monitoring but does not indicate acute risk across the board."
                : "An INDICATIVE tier means background-level signals are present and being tracked. No single category is currently elevated enough to move the composite into the top 50%."}
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Opening narrative */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10" aria-labelledby="opening-heading">
        <h2
          id="opening-heading"
          className="text-[10px] tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          What&apos;s happening here
        </h2>

        <p className="text-base leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {/* MOCK: opening paragraph from authored copy or template */}
          {mock?.openingParagraph ?? fallbackOpening}
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: The 3 driving categories */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10" aria-labelledby="categories-heading">
        <div
          className="rounded-t-lg px-5 py-3"
          style={{
            backgroundColor: "var(--qgi-surface-2)",
            borderBottom: "2px solid var(--qgi-accent)30",
          }}
        >
          <div
            className="text-[10px] tracking-widest uppercase mb-0.5"
            style={{ color: "var(--qgi-accent)" }}
          >
            Signal breakdown
          </div>
          <h2
            id="categories-heading"
            className="text-base font-semibold"
            style={{ color: "var(--qgi-text)" }}
          >
            The 3 categories driving {name}&apos;s score right now
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
          {mock ? (
            // MOCK: authored category narratives
            <div className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
              {mock.drivingCategoryNarratives.map((cat, i) => (
                <div key={cat.category} className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="font-data text-[10px] w-4 flex-shrink-0"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: "var(--qgi-text)" }}
                    >
                      {cat.label}
                    </span>
                    {/* Salience bar from live data if available */}
                    {topCats.find((c) => c.category === cat.category) && (
                      <SalienceBar
                        score={
                          topCats.find((c) => c.category === cat.category)!.salience_score
                        }
                      />
                    )}
                  </div>
                  <p
                    className="text-sm leading-relaxed pl-6"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {cat.sentence}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            // Fallback: live data categories with template text
            <div className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
              {topCats.map((cat, i) => (
                <div key={cat.category} className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="font-data text-[10px] w-4 flex-shrink-0"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: "var(--qgi-text)" }}
                    >
                      {catLabel(cat.category)}
                    </span>
                    <SalienceBar score={cat.salience_score} />
                    <span
                      className="font-data text-[10px]"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      salience {cat.salience_score.toFixed(2)}
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed pl-6"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {/* MOCK: template narrative for non-authored categories */}
                    MOCK template — in production, a sentence explaining what the{" "}
                    <em>{cat.category.replace(/_/g, " ")}</em> signal means for {name}{" "}
                    would be generated here. This category&apos;s salience score is{" "}
                    {cat.salience_score.toFixed(3)}, computed from {cat.recipe_count}{" "}
                    historical precedent recipes.
                    {cat.last_event_year && (
                      <> Last curated event year: {cat.last_event_year}.</>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Methodology note */}
          <div
            className="px-5 py-3 text-[10px]"
            style={{
              color: "var(--qgi-text-dim)",
              borderTop: "1px solid var(--qgi-border)",
              backgroundColor: "var(--qgi-surface-2)",
            }}
          >
            Categories are ranked by salience score — a composite of z-score, Reciprocal
            Rank Fusion rank, and severity tier across 4 time-horizon windows (S/M/L/XL =
            3–8 yr / 9–20 yr / 21–40 yr / 41+ yr). ·{" "}
            <Link
              href="/methodology"
              className="underline underline-offset-1"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Full methodology →
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Recent events */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10" aria-labelledby="events-heading">
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
            {curated ? "Curated event history" : "Illustrative events"}
          </div>
          <h2
            id="events-heading"
            className="text-base font-semibold"
            style={{ color: "var(--qgi-text)" }}
          >
            Recent events that moved the score
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
          {mock?.recentEvents?.length ? (
            <div className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
              {mock.recentEvents.map((ev, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    {/* Date */}
                    <span
                      className="font-data text-xs flex-shrink-0 w-12 mt-0.5"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {ev.date}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium mb-1"
                        style={{ color: "var(--qgi-text)" }}
                      >
                        {ev.title}
                      </p>
                      <p
                        className="text-xs leading-relaxed mb-2"
                        style={{ color: "var(--qgi-text-muted)" }}
                      >
                        {ev.explanation}
                      </p>
                      <span
                        className="text-[9px] font-data tracking-wide px-1.5 py-0.5 rounded"
                        style={{
                          color: "var(--qgi-text-dim)",
                          backgroundColor: "var(--qgi-surface-2)",
                          border: "1px solid var(--qgi-border)",
                        }}
                      >
                        {ev.categoryTag.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
                {curated
                  ? "No curated events loaded for this country in the design mock."
                  : "Event narrative not authored for this country in the design exploration."}
              </p>
              {curated && (
                <p className="text-xs mt-2" style={{ color: "var(--qgi-text-dim)" }}>
                  In production, curated events from{" "}
                  <code className="font-data">qgi-data/events/curated/{slug}.json</code>{" "}
                  would populate this section.
                </p>
              )}
            </div>
          )}

          <div
            className="px-5 py-3 text-[10px]"
            style={{
              color: "var(--qgi-text-dim)",
              borderTop: "1px solid var(--qgi-border)",
              backgroundColor: "var(--qgi-surface-2)",
            }}
          >
            {mock
              ? "MOCK: illustrative events written for design exploration. Production events come from qgi-data curated event corpus."
              : "MOCK template: event history not authored for this country."}
            {curated && (
              <>
                {" "}
                ·{" "}
                <Link
                  href={`/countries/${slug}`}
                  className="underline underline-offset-1"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Full event timeline in V1 profile →
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Peer comparison */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10" aria-labelledby="peers-heading">
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
            Structural context
          </div>
          <h2
            id="peers-heading"
            className="text-base font-semibold"
            style={{ color: "var(--qgi-text)" }}
          >
            How {name} compares to similar countries
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
          {mock?.peerParagraph ? (
            <>
              <p
                className="text-sm leading-relaxed mb-5"
                style={{ color: "var(--qgi-text)" }}
              >
                {mock.peerParagraph}
              </p>

              {/* Peer bars */}
              {peerCountries.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: "var(--qgi-surface-2)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  <div
                    className="text-[10px] tracking-widest uppercase mb-3"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    Peer group · current tiers
                  </div>

                  {/* This country first */}
                  <div
                    className="flex items-center gap-3 mb-2 pb-2"
                    style={{ borderBottom: "1px solid var(--qgi-border)" }}
                  >
                    <span
                      className="text-xs w-28 flex-shrink-0 font-medium"
                      style={{ color: "var(--qgi-text)" }}
                    >
                      {name} ← you
                    </span>
                    <CairoTierBar tier={tier as RiskTier} compact />
                  </div>

                  <div className="space-y-2">
                    {peerCountries.map((peer) => (
                      <div key={peer.name} className="flex items-center gap-3">
                        <span
                          className="text-xs w-28 flex-shrink-0"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          {peer.name}
                        </span>
                        <CairoTierBar tier={peer.tier} compact />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {/* MOCK: template peer paragraph */}
              MOCK template — in production, peer countries with similar structural risk
              profiles would be identified here, with a narrative paragraph explaining
              what makes the comparison meaningful. The V1 Country Intelligence Browser
              already surfaces analogue countries (countries whose historical indicator
              trajectories most closely match {name}&apos;s current profile).
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Handoffs */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="rounded-lg p-5 mb-8"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
        }}
        aria-labelledby="handoff-heading"
      >
        <h2
          id="handoff-heading"
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--qgi-text)" }}
        >
          Explore more
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          {curated && (
            <Link
              href={`/countries/${countrySlug(name) ?? id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--qgi-accent)",
                color: "#0f1923",
              }}
            >
              Full V1 profile — all data →
            </Link>
          )}
          <Link
            href="/countries-v2-narrative"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              color: "var(--qgi-text)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            ← Back to narrative overview
          </Link>
          <Link
            href="/countries"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              color: "var(--qgi-text-muted)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            Browse all countries →
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="pt-6 text-xs space-y-1"
        style={{
          color: "var(--qgi-text-dim)",
          borderTop: "1px solid var(--qgi-border)",
        }}
      >
        <p>
          Scoring: V1.9.1 · Country ID: <span className="font-data">{id}</span> ·{" "}
          <Link
            href="/methodology"
            className="underline underline-offset-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Full methodology →
          </Link>
        </p>
        <p>
          {mock
            ? "Narrative content is MOCK / authored copy for design exploration."
            : "Narrative content is a MOCK template — no authored copy exists for this country yet."}
        </p>
        <p>
          V2 design exploration · not indexed ·{" "}
          <Link
            href="/countries-v2-narrative"
            className="underline underline-offset-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            ← Narrative index
          </Link>{" "}
          ·{" "}
          <Link
            href="/countries-v2-table"
            className="underline underline-offset-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Table variant →
          </Link>
        </p>
      </footer>
    </article>
  );
}
