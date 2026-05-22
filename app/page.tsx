import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { CountryFlag } from "@/components/design/CountryFlag";
import { LandingHeaderNav } from "@/components/landing/LandingHeaderNav";
import { loadCountryRisks, type RiskTier } from "@/lib/country-risks";
import { countrySlug } from "@/lib/slug";
import {
  TOTAL_COUNTRIES,
  TOTAL_INDICATORS,
  TOTAL_PATTERNS,
  DATA_VINTAGE_YEAR,
  SCORING_VERSION,
} from "@/lib/site-stats";

/**
 * Landing page redesign (2026-05-22).
 *
 * Three-panel reading flow modeled on the /reports surface:
 *  1. Typographic hero, one precise claim, primary CTA to /dashboard
 *  2. Live country panel (highest-salience HIGH-tier from the pipeline)
 *  3. Metrics strip + curated reports panel + methodology note
 *
 * Removed from prior page: enumerated "How It Works" steps (duplicated on
 * /methodology), differentiator boxes, dedicated About prose, standalone
 * newsletter section (collapsed to footer), contact/use-case grid. Contact +
 * newsletter signup route to contact@qgintelligence.com (ops inbox) per
 * reference_qgi_ops_email.md.
 */

export const metadata: Metadata = {
  title: "QGI Intelligence · Quantitative Geopolitical Risk Analysis",
  description: `Structural pattern-matching across ${TOTAL_COUNTRIES} countries and ${TOTAL_INDICATORS} economic indicators. Historical precedents, not editorial judgment.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: "QGI Intelligence · Quantitative Geopolitical Risk Analysis",
    description: `Structural pattern-matching across ${TOTAL_COUNTRIES} countries and ${TOTAL_INDICATORS} economic indicators. Historical precedents, not editorial judgment.`,
    url: "https://qgintelligence.com",
    siteName: "QGI Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QGI Intelligence · Quantitative Geopolitical Risk Analysis",
    description: `Structural pattern-matching across ${TOTAL_COUNTRIES} countries and ${TOTAL_INDICATORS} economic indicators. Historical precedents, not editorial judgment.`,
  },
  robots: { index: true, follow: true },
};

export const revalidate = 3600;

type PreviewCountry = {
  id: string;
  slug: string;
  name: string;
  alpha_2: string;
  tier: RiskTier;
  topCategory: string;
  precedents: number;
};

function prettyCategory(slug: string): string {
  return slug
    .replace(/_and_/g, " & ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadPreviewCountries(): Promise<PreviewCountry[]> {
  try {
    const data = await loadCountryRisks();
    const rows: Array<PreviewCountry & { _salience: number }> = [];
    for (const [id, country] of Object.entries(data.countries)) {
      if (country.overall_risk_tier !== "HIGH") continue;
      const cats = country.tiers?.S?.top_categories ?? [];
      const top = cats[0];
      if (!top) continue;
      const salience = top.salience_score ?? top.z_score ?? 0;
      const slug = countrySlug(country.name) ?? id;
      rows.push({
        id,
        slug,
        name: country.name,
        alpha_2: country.alpha_2,
        tier: country.overall_risk_tier,
        topCategory: prettyCategory(top.category),
        precedents: top.recipe_count ?? 0,
        _salience: salience,
      });
    }
    rows.sort((a, b) => b._salience - a._salience);
    return rows.slice(0, 3).map(({ _salience: _s, ...rest }) => rest);
  } catch {
    return [
      {
        id: "217",
        slug: "the_syrian_arab_republic",
        name: "Syria",
        alpha_2: "SY",
        tier: "HIGH",
        topCategory: "Civil War & Insurgency",
        precedents: 0,
      },
      {
        id: "212",
        slug: "sudan",
        name: "Sudan",
        alpha_2: "SD",
        tier: "HIGH",
        topCategory: "Civil War & Insurgency",
        precedents: 0,
      },
      {
        id: "1",
        slug: "afghanistan",
        name: "Afghanistan",
        alpha_2: "AF",
        tier: "HIGH",
        topCategory: "Civil War & Insurgency",
        precedents: 0,
      },
    ];
  }
}

const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: {
    bg: "rgba(248, 113, 113, 0.10)",
    text: "#f87171",
    border: "rgba(248, 113, 113, 0.35)",
  },
  MODERATE: {
    bg: "rgba(251, 191, 36, 0.10)",
    text: "#fbbf24",
    border: "rgba(251, 191, 36, 0.35)",
  },
  INDICATIVE: {
    bg: "rgba(56, 189, 248, 0.10)",
    text: "#38bdf8",
    border: "rgba(56, 189, 248, 0.35)",
  },
};

const FEATURED_REPORTS = [
  {
    href: "/reports/niger-burkina-divergence" as Route,
    eyebrow: "Country Analysis · May 2026",
    headline:
      "The Junta That Cannot Stay Isolated: Niger's Structural Divergence Inside the AES Bloc",
    lede: "QGI places Niger at #4 of 58 on its Multilateral Agreement recipe at 94/100. Its closest structural peer, Burkina Faso (95% cosine), sits at #57 with 2/100.",
  },
  {
    href: "/reports/india-pakistan-mirror" as Route,
    eyebrow: "Country Analysis · May 2026",
    headline:
      "India and Pakistan Are 99% the Same Risk, and Neither Risk Framework Wants to Hear It",
    lede: "QGI places India and Pakistan at 99% cosine similarity, each other's #1 structural peer in the 156-country cohort. The convergence is recent, not embedded.",
  },
  {
    href: "/reports/ukraine-bosnia-mirror" as Route,
    eyebrow: "Sovereign Credit Note · May 2026",
    headline:
      "Ukraine's Structural Mirror: What Bosnia 1996 Tells the Credit Desk About UKRAIN 2027",
    lede: "Ukraine's closest structural twin is Bosnia at 81% cosine, 16 points ahead of the next cluster. A falsifiable thesis: Multilateral Agreement crossing 70/100 is the entry trigger.",
  },
  {
    href: "/reports/ghana-mauritania-mirror" as Route,
    eyebrow: "Country Analysis · May 2026",
    headline:
      "Ghana's Double Signal: The Ballot Box, the Barracks, and the Country Nobody Expected",
    lede: "Ghana sits at the 99th percentile of global election-stress. Its closest structural peer is Mauritania at 99% cosine similarity, not Mali, not Burkina Faso.",
  },
];

export default async function LandingPage() {
  const previewCountries = await loadPreviewCountries();

  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded"
        style={{ backgroundColor: "var(--qgi-accent)", color: "var(--qgi-bg)" }}
      >
        Skip to content
      </a>

      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.88)",
        }}
      >
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <Link href={"/" as Route} className="flex items-baseline gap-1" title="Home">
            <span
              className="font-data text-sm tracking-[0.25em] font-semibold"
              style={{ color: "var(--qgi-accent)", marginRight: "-0.25em" }}
            >
              QG
            </span>
            <span
              className="text-[11px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Intelligence
            </span>
          </Link>
          <LandingHeaderNav />
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 pt-24 pb-20">
          <div
            className="text-[10px] tracking-widest uppercase mb-5 font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            Pattern Recurrence Intelligence · {SCORING_VERSION}
          </div>

          <h1
            className="text-3xl sm:text-4xl xl:text-5xl font-semibold leading-tight tracking-tight max-w-2xl"
            style={{ color: "var(--qgi-text)" }}
          >
            Historical precedents in economic data,{" "}
            <span style={{ color: "var(--qgi-accent)" }}>not editorial judgment.</span>
          </h1>

          <p
            className="mt-5 text-base leading-relaxed max-w-xl"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            QGI finds structural analogues across {TOTAL_COUNTRIES} countries and{" "}
            {TOTAL_INDICATORS} economic indicators (data through {DATA_VINTAGE_YEAR}).
            Candidates for analyst review, not black-box scores.
          </p>

          <div className="mt-8 flex items-center gap-4 flex-wrap">
            <Link
              href={"/dashboard" as Route}
              className="px-6 py-2.5 rounded text-sm font-medium tracking-wide transition-all hover:brightness-110"
              style={{ backgroundColor: "var(--qgi-accent)", color: "var(--qgi-bg)" }}
            >
              Open Dashboard
            </Link>
            <Link
              href={"/reports" as Route}
              className="px-6 py-2.5 rounded text-sm tracking-wide border transition-colors hover:border-[var(--qgi-accent)]"
              style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
            >
              Read Reports
            </Link>
          </div>
        </section>

        {/* ── Live country panel ────────────────────────────────── */}
        <section
          className="border-t"
          style={{ borderColor: "var(--qgi-border)" }}
          aria-labelledby="live-panel-label"
        >
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
              <div>
                <div
                  id="live-panel-label"
                  className="text-[10px] tracking-widest uppercase mb-1 font-semibold"
                  style={{ color: "var(--qgi-accent)" }}
                >
                  Current High-Tier Countries
                </div>
                <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                  Highest-salience HIGH-tier countries from the live scoring pipeline
                </p>
              </div>
              <Link
                href={"/countries" as Route}
                className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)] shrink-0"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                All {TOTAL_COUNTRIES} countries &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {previewCountries.map((c) => {
                const style = TIER_STYLES[c.tier] ?? TIER_STYLES.HIGH;
                return (
                  <Link
                    key={c.alpha_2}
                    href={`/countries/${c.slug}` as Route}
                    className="block rounded border p-5 transition-colors hover:border-[var(--qgi-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)]"
                    style={{
                      backgroundColor: "var(--qgi-surface)",
                      borderColor: "var(--qgi-border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <CountryFlag alpha2={c.alpha_2} size={22} />
                        <span
                          className="font-medium text-sm truncate"
                          style={{ color: "var(--qgi-text)" }}
                        >
                          {c.name}
                        </span>
                      </div>
                      <span
                        className="text-[9px] tracking-widest font-semibold px-2 py-0.5 rounded shrink-0 ml-2"
                        style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        {c.tier}
                      </span>
                    </div>
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: "var(--qgi-text)" }}
                    >
                      {c.topCategory}
                    </div>
                    {c.precedents > 0 && (
                      <div
                        className="font-data text-[11px]"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        {c.precedents.toLocaleString()} historical matches
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Metrics strip ─────────────────────────────────────── */}
        <section
          className="border-t"
          style={{
            borderColor: "var(--qgi-border)",
            backgroundColor: "var(--qgi-surface)",
          }}
          aria-label="Pipeline scale metrics"
        >
          <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <MetricStat value={String(TOTAL_COUNTRIES)} label="Countries" />
            <MetricStat value={String(TOTAL_INDICATORS)} label="Indicators scored" />
            <MetricStat value={TOTAL_PATTERNS} label="Patterns computed" />
            <MetricStat value={String(DATA_VINTAGE_YEAR)} label="Data vintage" />
          </div>
        </section>

        {/* ── Reports panel ─────────────────────────────────────── */}
        <section
          className="border-t"
          style={{ borderColor: "var(--qgi-border)" }}
          aria-labelledby="reports-panel-label"
        >
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
              <div>
                <div
                  id="reports-panel-label"
                  className="text-[10px] tracking-widest uppercase mb-1 font-semibold"
                  style={{ color: "var(--qgi-accent)" }}
                >
                  Analytical Reports
                </div>
                <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                  Falsifiable structural analyses from the current scoring run
                </p>
              </div>
              <Link
                href={"/reports" as Route}
                className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)] shrink-0"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                All reports &rarr;
              </Link>
            </div>

            <div className="space-y-4">
              {FEATURED_REPORTS.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="block rounded border p-5 transition-colors hover:border-[var(--qgi-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)]"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    borderColor: "var(--qgi-border)",
                  }}
                >
                  <div
                    className="text-[10px] tracking-widest uppercase mb-2 font-semibold"
                    style={{ color: "var(--qgi-accent)" }}
                  >
                    {r.eyebrow}
                  </div>
                  <h2
                    className="text-base font-semibold mb-2 leading-snug"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {r.headline}
                  </h2>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {r.lede}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Methodology note ──────────────────────────────────── */}
        <section
          className="border-t"
          style={{
            borderColor: "var(--qgi-border)",
            backgroundColor: "var(--qgi-surface)",
          }}
          aria-labelledby="method-panel-label"
        >
          <div className="mx-auto max-w-5xl px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <div
                id="method-panel-label"
                className="text-[10px] tracking-widest uppercase mb-4 font-semibold"
                style={{ color: "var(--qgi-accent)" }}
              >
                Methodology
              </div>
              <p
                className="text-lg font-medium leading-relaxed mb-4"
                style={{ color: "var(--qgi-text)" }}
              >
                Risk candidates emerge from correlation analysis and rank fusion, not from
                curated country lists or analyst opinion.
              </p>
              <p
                className="text-sm leading-relaxed mb-6"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                When a country&rsquo;s economic indicators today resemble the trajectory
                of another country before a known geopolitical event, that is a precedent
                worth examining: not a prediction, but a structured historical analogue
                that analysts can evaluate on its merits. Every score is tied to a named
                scoring run, a data vintage, and a documented recipe so it is reproducible
                and auditable.
              </p>
              <Link
                href={"/methodology" as Route}
                className="text-sm tracking-wide border-b pb-0.5 transition-colors hover:text-[var(--qgi-accent)] hover:border-[var(--qgi-accent)]"
                style={{
                  color: "var(--qgi-text-muted)",
                  borderColor: "var(--qgi-border)",
                }}
              >
                Read the methodology
              </Link>
            </div>

            <div className="space-y-5 pt-1">
              <Principle
                label="Statistical, not editorial"
                body="Correlations, z-score normalization, and reciprocal rank fusion. The scoring recipe is documented, versioned, and open to scrutiny."
              />
              <Principle
                label="Evidence for analysts"
                body="Each country profile shows which precedent countries triggered the signal and which economic indicators aligned. Analysts examine the evidence, not a summary score."
              />
              <Principle
                label="Open data foundation"
                body={`Built on World Bank Open Data (CC BY 4.0). ${TOTAL_INDICATORS} indicators scored from the full historical series through ${DATA_VINTAGE_YEAR}. Reproducible and verifiable.`}
              />
            </div>
          </div>
        </section>
      </main>

      <footer
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
            <Link href={"/" as Route} className="flex items-baseline gap-1" title="Home">
              <span
                className="font-data text-xs tracking-[0.25em] font-semibold"
                style={{ color: "var(--qgi-accent)", marginRight: "-0.25em" }}
              >
                QG
              </span>
              <span
                className="text-[10px] tracking-widest uppercase"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                Intelligence
              </span>
            </Link>
            <nav
              className="flex items-center gap-5 flex-wrap"
              aria-label="Footer navigation"
            >
              {[
                { href: "/dashboard" as Route, label: "Dashboard" },
                { href: "/reports" as Route, label: "Reports" },
                { href: "/methodology" as Route, label: "Methodology" },
                { href: "/about" as Route, label: "About" },
                { href: "/legal" as Route, label: "Legal" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[11px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div
            className="border-t pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <span
              className="text-[10px] tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              &copy; 2026 QGI Intelligence. Data through {DATA_VINTAGE_YEAR}. Scoring{" "}
              {SCORING_VERSION}.
            </span>
            <div className="flex items-center gap-4 flex-wrap">
              <a
                href="mailto:contact@qgintelligence.com?subject=QGI%20Newsletter%20Signup"
                className="text-[11px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Newsletter signup
              </a>
              <a
                href="mailto:contact@qgintelligence.com"
                className="text-[11px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MetricStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="font-data text-2xl font-bold"
        style={{ color: "var(--qgi-accent)" }}
      >
        {value}
      </div>
      <div
        className="text-[10px] mt-1 tracking-wider uppercase"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {label}
      </div>
    </div>
  );
}

function Principle({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <h3
        className="text-xs tracking-wider uppercase font-semibold mb-1"
        style={{ color: "var(--qgi-text)" }}
      >
        {label}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
        {body}
      </p>
    </div>
  );
}
