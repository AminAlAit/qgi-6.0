/**
 * /countries-v4 — Countries V4 gallery (the per-country hub index).
 *
 * Per IA §1 — "Countries · KEEP, EVOLVE into per-country hub": this is
 * the entry into the integration point for the per-country TE
 * capabilities (scores + drivers + momentum + analogues + compound).
 *
 * The existing /countries and /countries/[iso] routes are NOT touched.
 * V4 lives in parallel under /countries-v4.
 *
 * Server Component. Region filter + sort are a small client surface in
 * CountriesFilters.tsx; the rest is pure server-rendered.
 *
 * Designed by Dr. Kwame Asante (with Talia, Daniyar, Sofia consulted).
 * Mockup only. Local-only branch `local/te-precedents-mockup`.
 */
import type { Metadata } from "next";
import { Globe, Flame, Layers, Sparkles } from "lucide-react";
import { vintageStamp } from "@/lib/te-mock/recipes";
import {
  COUNTRIES_V4,
  REGION_ORDER,
  COUNTRY_OF_THE_WEEK_ISO,
  countriesByRegion,
  type CountryV4,
} from "@/lib/te-mock/countries-v4-data";
import { CountriesHero } from "@/components/countries-v4/CountriesHero";
import { CountriesFilters } from "@/components/countries-v4/CountriesFilters";
import { CountryCard } from "@/components/countries-v4/CountryCard";

export const metadata: Metadata = {
  title: "Countries (v4 mockup) · QG Intelligence",
  description:
    "Per-country hub index — TE scores, drivers, momentum, analogs, compound. Local-only mockup; not for production.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    region?: string;
    sort?: string;
  }>;
}

export default async function CountriesV4Page({ searchParams }: PageProps) {
  const sp = await searchParams;
  const regionFilter = (sp.region ?? "").trim();
  const sortKey = (sp.sort ?? "compound") as "compound" | "lit" | "name";

  // Hero tile counts — derived from the mock corpus.
  const total = COUNTRIES_V4.length;
  const litAny = COUNTRIES_V4.filter((c) => c.recipes_lit_count >= 1).length;
  const compoundHigh = COUNTRIES_V4.filter((c) => c.recipes_lit_count >= 3).length;
  const cotw =
    COUNTRIES_V4.find((c) => c.iso === COUNTRY_OF_THE_WEEK_ISO) ?? COUNTRIES_V4[0];

  // Apply region filter + sort to the underlying corpus before regrouping.
  const filtered =
    regionFilter && (REGION_ORDER as readonly string[]).includes(regionFilter)
      ? COUNTRIES_V4.filter((c) => c.region === regionFilter)
      : COUNTRIES_V4;

  const sorted = [...filtered].sort((a: CountryV4, b: CountryV4) => {
    if (sortKey === "lit") return b.recipes_lit_count - a.recipes_lit_count;
    if (sortKey === "name") return a.name.localeCompare(b.name);
    return b.compound_score - a.compound_score;
  });

  // When sort is "name" or "compound" we still group by region so the
  // page reads as a geographic atlas — the sort just changes within-group
  // ordering. When sort is "compound" the within-group order is desc on
  // compound, which is the default expectation.
  const grouped = countriesByRegion(sorted);

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {/* Mockup banner + vintage stamp */}
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
            MOCKUP · /countries-v4 · local only
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

        {/* Hero — 4 Sofia-style tiles */}
        <CountriesHero
          total={total}
          litAny={litAny}
          compoundHigh={compoundHigh}
          countryOfTheWeek={cotw}
          vintage={vintageStamp()}
        />

        {/* M8-R5 honesty disclosure */}
        <div
          style={{
            marginTop: "20px",
            padding: "14px 16px",
            border: "1px solid var(--qgi-border)",
            borderLeft: "3px solid #E68F29",
            background: "rgba(230,143,41,0.05)",
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.2px",
              color: "#E68F29",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "6px",
            }}
          >
            HONESTY-REGIME DISCLOSURE · M8-R5
          </div>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--qgi-text)",
              margin: 0,
            }}
          >
            Every score on this page is a <strong>discrimination rank</strong>, not a
            probability. A country lighting up on a recipe means its recent movement shape
            sits high in the distribution of shape-resembling countries — it does not mean
            an event is likely. The &ldquo;recipes lit&rdquo; count is honest about
            graduation tier: today the program has <strong>0 graduated</strong> recipes;
            the visible lights are split between <em>walked-failed</em> and{" "}
            <em>queued</em>. Each per-country page surfaces the same mix.
          </p>
        </div>

        {/* Filters + sort */}
        <CountriesFilters
          regions={REGION_ORDER}
          activeRegion={regionFilter}
          activeSort={sortKey}
          totalShown={sorted.length}
        />

        {/* Regional sections */}
        {REGION_ORDER.map((region) => {
          const inRegion = grouped[region] ?? [];
          if (inRegion.length === 0) return null;
          const regionLit = inRegion.filter((c) => c.recipes_lit_count >= 1).length;
          return (
            <section key={region} style={{ marginTop: "32px" }}>
              <header
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
                  REGION
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
                  {region}
                </h2>
                <span
                  style={{
                    fontSize: "10.5px",
                    color: "var(--qgi-text-muted)",
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.3px",
                  }}
                >
                  {inRegion.length} countries · {regionLit} lit
                </span>
              </header>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))",
                  gap: "14px",
                }}
              >
                {inRegion.map((c) => (
                  <CountryCard key={c.iso} country={c} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Footer + persona signature */}
        <footer
          style={{
            marginTop: "48px",
            paddingTop: "20px",
            borderTop: "1px solid var(--qgi-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Globe size={13} strokeWidth={1.6} /> {total} countries · {litAny} lit ·{" "}
            {compoundHigh} with compound ≥3
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={12} strokeWidth={1.6} />
            <Flame size={12} strokeWidth={1.6} />
            <Layers size={12} strokeWidth={1.6} />
            Designed by Dr. Kwame Asante — Compound-Risk Political Economy · with Talia,
            Daniyar, Sofia consulted
          </span>
        </footer>
      </div>
    </div>
  );
}
