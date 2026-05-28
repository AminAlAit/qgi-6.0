import type { Metadata } from "next";
import {
  COMPOUND_COUNTRIES,
  COMPOUND_VINTAGE,
  COMPOUND_CASE_STUDIES,
  countLitAtThreshold,
  type CompoundCountry,
} from "@/lib/te-mock/compound-risk-data";
import { CompoundHero } from "@/components/compound-risk/CompoundHero";
import { CompoundFilters } from "@/components/compound-risk/CompoundFilters";
import { CompoundLeaderboard } from "@/components/compound-risk/CompoundLeaderboard";
import { CompoundOverlapChart } from "@/components/compound-risk/CompoundOverlapChart";
import { CaseStudyBox } from "@/components/compound-risk/CaseStudyBox";

export const metadata: Metadata = {
  title: "Compound Risk (mockup) · QG Intelligence",
  description:
    "Countries lit on multiple crisis recipes at once. Compound score is a stacking heuristic over discrimination ranks, not a joint probability. Local-only mockup.",
  robots: { index: false, follow: false },
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
        {/* Vintage chip */}
        <div
          style={{
            display: "inline-block",
            padding: "5px 12px",
            border: "1px solid var(--qgi-border)",
            color: "var(--qgi-text-dim)",
            borderRadius: "4px",
            fontSize: "11px",
            letterSpacing: "1px",
            marginBottom: "16px",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Data as of {COMPOUND_VINTAGE}
        </div>

        {/* Hero */}
        <CompoundHero
          litAtThreshold={litAtThreshold}
          minThreshold={minThreshold}
          totalCountries={totalCountries}
          vintage={COMPOUND_VINTAGE}
        />

        {/* How to read this board */}
        <div
          style={{
            marginTop: "20px",
            padding: "16px 18px",
            border: "1px solid #5B7E99",
            borderLeft: "3px solid #5B7E99",
            background: "rgba(91,126,153,0.06)",
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#5B7E99",
              marginBottom: "10px",
              letterSpacing: "0.3px",
            }}
          >
            How to read this board
          </div>
          <ol
            style={{
              margin: 0,
              padding: "0 0 0 18px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <li style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--qgi-text)" }}>
              The <strong>compound score</strong> is a relative stacking of high rankings
              across this country&apos;s lit recipes, not a probability.
            </li>
            <li style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--qgi-text)" }}>
              A country lit on three recipes is <em>not</em> &quot;more likely to
              experience all three&quot;. The score aggregates independent{" "}
              <strong>discrimination ranks</strong>, not multiplied likelihoods.
            </li>
            <li style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--qgi-text)" }}>
              Only{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                foreign_intervention
              </code>{" "}
              has a candidate deployment today (currently re-validating after a coverage
              fix). The rest are either tested without holding up, or not yet tested. With
              one near-deployed recipe, this view is <strong>illustrative</strong>.
            </li>
            <li style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--qgi-text)" }}>
              The view becomes meaningful as more recipes are validated and deployed
              across quarterly reviews.
            </li>
          </ol>
        </div>

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
        <section style={{ marginTop: "48px" }}>
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
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "1.5px",
                fontFamily: "ui-monospace, monospace",
                color: "var(--qgi-text-dim)",
              }}
            >
              §03
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
              Current compound case studies
            </h2>
            <span
              style={{
                fontSize: "9px",
                letterSpacing: "1px",
                padding: "2px 7px",
                border: "1px dashed var(--qgi-accent)",
                color: "var(--qgi-accent)",
                borderRadius: "3px",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              MOCK NARRATIVE
            </span>
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
            Analyst-style structural reads on two countries where multiple recipes
            co-light. These are <strong>mock narratives for design preview only</strong>,
            not published QGI assessments. They will be replaced by curated, dated briefs
            once the recipe fleet deploys a second validated recipe.
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
          <span>Compound Risk · data as of {COMPOUND_VINTAGE}</span>
          <span>Compound score: stacked rank, not a probability</span>
        </div>
      </div>
    </div>
  );
}
