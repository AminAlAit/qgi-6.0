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
        {/* Mockup banner */}
        <div
          style={{
            display: "inline-block",
            padding: "5px 12px",
            border: "1px solid var(--qgi-accent)",
            color: "var(--qgi-accent)",
            borderRadius: "4px",
            fontSize: "11px",
            letterSpacing: "1.5px",
            marginBottom: "16px",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          MOCKUP · /compound-risk · local only
        </div>

        {/* Hero */}
        <CompoundHero
          litAtThreshold={litAtThreshold}
          minThreshold={minThreshold}
          totalCountries={totalCountries}
          vintage={COMPOUND_VINTAGE}
        />

        {/* M8-R5 honesty banner */}
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
            HONESTY-REGIME DISCLOSURE · M8-R5 · COMPOUND READ-OFF
          </div>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--qgi-text)",
              margin: 0,
            }}
          >
            The <strong>compound score</strong> is a transparent stacking heuristic — the
            sum of a country&apos;s top-decile margins across the recipes it currently
            lights up on. It is <strong>not a joint probability</strong>. A country lit on
            three recipes is <em>not</em> &quot;60% likely to experience all three&quot;;
            the score is a positioning aggregate over three independent{" "}
            <strong>discrimination ranks</strong>, not a multiplied likelihood. Only{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>
              foreign_intervention
            </code>{" "}
            has even a candidate graduation today (currently re-validating after a
            coverage-fix); the rest are <em>walked-failed</em> or <em>queued</em>. With
            one graduated recipe in the program, the compound view is{" "}
            <strong>illustrative</strong>; it becomes meaningful as more recipes graduate
            across quarterly re-walks.
          </p>
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
            co-light. These are <strong>mock narratives for design preview</strong> — not
            published QGI assessments. They will be replaced by curated, dated briefs once
            the recipe fleet graduates a second validated recipe.
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
          <span>
            Data vintage · {COMPOUND_VINTAGE} · all values are mockup placeholders
          </span>
          <span>
            Compound score = sum of top-decile margins · stacking heuristic only
          </span>
        </div>
      </div>
    </div>
  );
}
