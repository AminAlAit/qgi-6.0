import type { Metadata } from "next";
import {
  COMPOUND_COUNTRIES,
  COMPOUND_CASE_STUDIES,
  countLitAtThreshold,
  type CompoundCountry,
} from "@/lib/te-mock/compound-risk-data";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { CompoundHero } from "@/components/compound-risk/CompoundHero";
import { CompoundFilters } from "@/components/compound-risk/CompoundFilters";
import { CompoundLeaderboard } from "@/components/compound-risk/CompoundLeaderboard";
import { CompoundOverlapChart } from "@/components/compound-risk/CompoundOverlapChart";
import { CaseStudyBox } from "@/components/compound-risk/CaseStudyBox";

export const metadata: Metadata = {
  title: "Compound Risk · QG Intelligence",
  description:
    "Countries whose recent signals resemble multiple crisis shapes at once. Compound Risk is a 0-100 score that averages a country's recipe matches, dampened for thin coverage.",
};

interface PageProps {
  searchParams: Promise<{
    min?: string;
    families?: string;
  }>;
}

export default async function CompoundRiskPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const minThreshold = Math.max(2, Math.min(4, Number(sp.min ?? "3") || 3));
  const familyFilter = (sp.families ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-H]$/.test(s));

  // Sort by compound score (desc), then by lit-recipe count (desc).
  const sortedAll: CompoundCountry[] = [...COMPOUND_COUNTRIES].sort(
    (a, b) =>
      b.compound_score - a.compound_score || b.lit_recipes.length - a.lit_recipes.length
  );

  const filtered = sortedAll.filter((c) => {
    if (c.lit_recipes.length < minThreshold) return false;
    if (familyFilter.length > 0) {
      const fams = new Set(c.lit_families);
      // Require ALL selected families to be present in this country's lit set.
      for (const f of familyFilter) if (!fams.has(f)) return false;
    }
    return true;
  });

  const litAtThreshold = countLitAtThreshold(sortedAll, minThreshold);
  const totalCountries = sortedAll.length;

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {/* HowToReadButton (vintage stamp removed per V4.1 §2 — one stamp lives
            under TAKE THE TOUR in the global header). */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <HowToReadButton routeKey="compound-risk" />
        </div>

        {/* Hero */}
        <CompoundHero
          litAtThreshold={litAtThreshold}
          minThreshold={minThreshold}
          totalCountries={totalCountries}
        />

        {/* Filters */}
        <CompoundFilters minThreshold={minThreshold} familyFilter={familyFilter} />

        {/* Leaderboard */}
        <CompoundLeaderboard
          countries={filtered}
          minThreshold={minThreshold}
          allCount={sortedAll.length}
        />

        {/* Overlap chart (top 5) */}
        <CompoundOverlapChart countries={filtered.slice(0, 5)} />

        {/* Case studies */}
        <section data-tour="case-studies" style={{ marginTop: "48px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
              marginBottom: "14px",
              borderTop: "1px solid var(--qgi-border)",
              paddingTop: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                margin: 0,
                color: "var(--qgi-text)",
                flex: 1,
              }}
            >
              Compound case studies
            </h2>
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "var(--qgi-text-muted)",
              marginBottom: "16px",
              maxWidth: "780px",
              lineHeight: 1.5,
            }}
          >
            Structural reads on three countries where multiple recipes light up at once,
            and what each stack tells us about the country&apos;s position in the corpus.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: "16px",
            }}
          >
            {COMPOUND_CASE_STUDIES.map((cs) => (
              <CaseStudyBox key={cs.iso} study={cs} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <div
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
          <span>Compound Risk</span>
          <span>
            Bounded 0-100 score, averaged across recipe matches. Not a probability.
          </span>
        </div>
      </div>
    </div>
  );
}
