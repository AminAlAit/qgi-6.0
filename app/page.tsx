import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
import NewsletterForm from "@/components/NewsletterForm";
import { loadCountryRisks, type RiskTier } from "@/lib/country-risks";

/**
 * QGI Landing Page — public, static.
 *
 * Sections:
 * 1. Navbar
 * 2. Hero with tagline
 * 3. Live preview: 3 country risk cards (pulled from live country-risks.json)
 * 4. How it works: 3-step visual
 * 5. Metrics bar
 * 6. Key differentiators
 * 7. About / mission statement
 * 8. Newsletter capture
 * 9. Get in touch / request demo
 * 10. Footer (enhanced)
 *
 * T1 #294 fix (2026-04-19): preview cards used to be hardcoded for
 * Argentina/Russia/Ethiopia and drifted from the actual pipeline output.
 * Now pull the top 3 HIGH-tier countries by max salience from the same
 * baked JSON the dashboard reads. Revalidates on the page-level ISR.
 */

// Revalidate once per hour so the preview reflects pipeline re-runs
// without re-rendering on every request (T16 perf).
export const revalidate = 3600;

type PreviewCountry = {
  name: string;
  alpha_2: string;
  tier: RiskTier;
  topCategory: string;
  precedents: number;
  signal: string;
};

function prettyCategory(slug: string): string {
  // "civil_war_and_insurgency" -> "Civil War & Insurgency"
  return slug
    .replace(/_and_/g, " & ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadPreviewCountries(): Promise<PreviewCountry[]> {
  try {
    const data = await loadCountryRisks();
    const rows: Array<PreviewCountry & { _salience: number }> = [];
    for (const country of Object.values(data.countries)) {
      if (country.overall_risk_tier !== "HIGH") continue;
      const cats = country.tiers?.S?.top_categories ?? [];
      const top = cats[0];
      if (!top) continue;
      const salience = top.salience_score ?? top.z_score ?? 0;
      const precedents = top.recipe_count ?? 0;
      rows.push({
        name: country.name,
        alpha_2: country.alpha_2,
        tier: country.overall_risk_tier,
        topCategory: prettyCategory(top.category),
        precedents,
        signal: `${precedents.toLocaleString()} precedent windows; top drivers in ${prettyCategory(
          top.category
        ).toLowerCase()}.`,
        _salience: salience,
      });
    }
    rows.sort((a, b) => b._salience - a._salience);
    return rows.slice(0, 3).map(({ _salience: _s, ...rest }) => rest);
  } catch {
    // Static fallback if country-risks.json is unreachable at build time.
    return [
      {
        name: "Syria",
        alpha_2: "SY",
        tier: "HIGH",
        topCategory: "Civil War & Insurgency",
        precedents: 0,
        signal: "Preview unavailable — pipeline output missing.",
      },
      {
        name: "Sudan",
        alpha_2: "SD",
        tier: "HIGH",
        topCategory: "Civil War & Insurgency",
        precedents: 0,
        signal: "Preview unavailable — pipeline output missing.",
      },
      {
        name: "Afghanistan",
        alpha_2: "AF",
        tier: "HIGH",
        topCategory: "Civil War & Insurgency",
        precedents: 0,
        signal: "Preview unavailable — pipeline output missing.",
      },
    ];
  }
}

const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

const STEPS = [
  {
    num: "01",
    title: "Detect Indicator Relationships",
    desc: "We find statistically significant correlations between economic indicators across 197 countries spanning decades of World Bank data.",
  },
  {
    num: "02",
    title: "Match Historical Precedents",
    desc: "When Country A's trajectory today mirrors Country B's trajectory before a known geopolitical event, we surface that precedent.",
  },
  {
    num: "03",
    title: "Score & Rank Risk Candidates",
    desc: "Z-score normalization and rank fusion ensemble produce country-level risk tiers. Analysts examine the evidence, not a black-box score.",
  },
];

export default async function LandingPage() {
  const previewCountries = await loadPreviewCountries();
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* ─── Navbar ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          {/* GH#251: clickable; on public pages, click navigates to root. */}
          <Link href="/" className="flex items-baseline gap-1" title="Home">
            <span
              className="font-data text-sm tracking-[0.25em] font-semibold"
              style={{
                color: "var(--qgi-accent)",
                // Compensate trailing letter-spacing so visual gap to
                // "Intelligence" matches the qgintelligence.com domain.
                marginRight: "-0.25em",
              }}
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
          <nav className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              How it works
            </a>
            <Link
              href="/reports"
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Reports
            </Link>
            <Link
              href="/methodology"
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Methodology
            </Link>
            <a
              href="#contact"
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Contact
            </a>
            <Link
              href="/dashboard"
              className="text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "var(--qgi-accent)",
                color: "var(--qgi-bg)",
              }}
            >
              Open Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <div
            className="inline-block mb-6 px-3 py-1 rounded-full text-[10px] tracking-widest uppercase border"
            style={{
              borderColor: "var(--qgi-accent)",
              color: "var(--qgi-accent)",
              backgroundColor: "var(--qgi-accent-glow)",
            }}
          >
            Pattern Recurrence Intelligence
          </div>
          <h1
            className="text-4xl sm:text-5xl font-semibold leading-tight tracking-tight"
            style={{ color: "var(--qgi-text)" }}
          >
            Quantitative
            <br />
            Geopolitical
            <br />
            <span style={{ color: "var(--qgi-accent)" }}>Intelligence</span>
          </h1>
          <p
            className="mt-6 text-lg leading-relaxed max-w-xl"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            QGI surfaces economically-grounded risk candidates that analysts
            should examine. We find historical precedents in World Bank data
            spanning 197 countries and 69 indicators (as of April 2026).
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/countries"
              className="px-6 py-3 rounded text-sm font-medium tracking-wide transition-all hover:brightness-110"
              style={{
                backgroundColor: "var(--qgi-accent)",
                color: "var(--qgi-bg)",
              }}
            >
              Explore Countries
            </Link>
            <a
              href="#how-it-works"
              className="px-6 py-3 rounded text-sm tracking-wide border transition-colors hover:bg-[var(--qgi-surface-2)]"
              style={{
                borderColor: "var(--qgi-border)",
                color: "var(--qgi-text-muted)",
              }}
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ─── Live Preview: Country Risk Cards ───────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2
          className="text-xs tracking-widest uppercase mb-8"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Live Intelligence Preview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {previewCountries.map((c) => {
            const style = TIER_STYLES[c.tier];
            return (
              <div
                key={c.alpha_2}
                className="rounded-lg border p-5 transition-colors hover:border-[var(--qgi-accent)]"
                style={{
                  backgroundColor: "var(--qgi-surface)",
                  borderColor: "var(--qgi-border)",
                }}
              >
                {/* Country header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <CountryFlag alpha2={c.alpha_2} size={24} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <span
                    className="text-[10px] tracking-widest font-semibold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: style.bg,
                      color: style.text,
                      border: `1px solid ${style.border}40`,
                    }}
                  >
                    {c.tier}
                  </span>
                </div>

                {/* Top category */}
                <div
                  className="text-sm font-medium mb-1"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {c.topCategory}
                </div>

                {/* Precedent count */}
                <div
                  className="font-data text-xs mb-3"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {c.precedents} precedent windows
                </div>

                {/* Signal description */}
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {c.signal}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="border-t"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2
            className="text-xs tracking-widest uppercase mb-12"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num}>
                <div
                  className="font-data text-3xl font-bold mb-4"
                  style={{ color: "var(--qgi-accent)" }}
                >
                  {step.num}
                </div>
                <h3 className="text-lg font-medium mb-3">{step.title}</h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Metrics Bar ────────────────────────────────────────────── */}
      <section
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <Metric value="214" label="Countries Analyzed" />
          <Metric value="58" label="Economic Indicators" />
          <Metric value="2.01B" label="Patterns Computed" />
          <Metric value="2.2x" label="Lift@50 vs Baseline" />
        </div>
      </section>

      {/* ─── Key Differentiators ────────────────────────────────────── */}
      <section
        className="border-t"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2
            className="text-xs tracking-widest uppercase mb-12"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Why QGI
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Differentiator
              label="Scale"
              value="2.01B"
              unit="patterns"
              desc="Computed across 197 countries and 69 economic indicators (as of April 2026). Every pairwise relationship, every historical window, examined."
            />
            <Differentiator
              label="Method"
              value="Statistical"
              unit="not editorial"
              desc="Risk candidates emerge from correlation analysis and rank fusion — not from analyst opinion or curated country lists."
            />
            <Differentiator
              label="Foundation"
              value="Open data"
              unit="CC BY 4.0"
              desc="Built on World Bank Open Data. Reproducible, auditable, and verifiable. No proprietary black-box scores."
            />
            <Differentiator
              label="Approach"
              value="Analogues"
              unit="not forecasts"
              desc="We ask which countries walked this economic path before, and what followed. Historical precedents grounded in decades of data."
            />
          </div>
        </div>
      </section>

      {/* ─── About / Mission ────────────────────────────────────────── */}
      <section
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-24 grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="text-xs tracking-widest uppercase mb-6"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              About
            </h2>
            <p
              className="text-xl font-medium leading-relaxed mb-6"
              style={{ color: "var(--qgi-text)" }}
            >
              QGI makes geopolitical risk measurable by finding historical
              economic precedents at scale.
            </p>
            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Traditional political risk analysis relies on expert judgment,
              regional specialists, and editorial discretion. QGI takes a
              different approach: statistical pattern matching across the full
              historical record of World Bank economic data.
            </p>
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              When a country&rsquo;s economic indicators today resemble the
              trajectory of another country before a known geopolitical event,
              that is a precedent worth examining — not a prediction, but a
              structured historical analogue that analysts can evaluate on its
              merits.
            </p>
            <p
              className="text-sm leading-relaxed mb-8"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Built by a Cloud Data Engineer with a passion for quantitative
              approaches to geopolitical analysis.
            </p>
            <Link
              href="/methodology"
              className="text-sm tracking-wide border-b pb-0.5 transition-colors hover:text-[var(--qgi-accent)] hover:border-[var(--qgi-accent)]"
              style={{
                color: "var(--qgi-text-muted)",
                borderColor: "var(--qgi-border)",
              }}
            >
              Read the full methodology
            </Link>
          </div>
          <div className="space-y-6">
            <PrincipleCard
              heading="Pattern-based, not opinion-based"
              body="Risk tier assignments emerge from computed correlations, z-score normalization, and reciprocal rank fusion. The methodology is documented, versioned, and open to scrutiny."
            />
            <PrincipleCard
              heading="Analysts examine evidence"
              body="QGI surfaces candidates for human review. Each country profile shows which precedent countries triggered the signal and which economic indicators aligned — giving analysts the underlying data, not just a score."
            />
            <PrincipleCard
              heading="Continuously updated"
              body="The pipeline ingests updated World Bank data monthly. Risk tiers and precedent rankings refresh automatically as new data arrives."
            />
          </div>
        </div>
      </section>

      {/* ─── Primary CTA ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-2xl font-semibold mb-4">
          Start exploring geopolitical risk
        </h2>
        <p
          className="mb-8 max-w-md mx-auto"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Browse country intelligence profiles built on decades of economic data
          and historically verified precedents.
        </p>
        <Link
          href="/countries"
          className="inline-block px-8 py-3 rounded text-sm font-medium tracking-wide transition-all hover:brightness-110"
          style={{
            backgroundColor: "var(--qgi-accent)",
            color: "var(--qgi-bg)",
          }}
        >
          Open Country Intelligence Browser
        </Link>
      </section>

      {/* ─── Newsletter ─────────────────────────────────────────────── */}
      <section
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div className="max-w-lg">
            <h2
              className="text-xs tracking-widest uppercase mb-4"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Stay Updated
            </h2>
            <p
              className="text-lg font-medium mb-2"
              style={{ color: "var(--qgi-text)" }}
            >
              Monthly intelligence digest
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Receive the QGI monthly update: new country risk tiers, methodology
              improvements, and notable precedent matches from the latest pipeline
              run. No marketing, no noise.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <NewsletterForm />
          </div>
        </div>
      </section>

      {/* ─── Get in Touch / Request Demo ────────────────────────────── */}
      <section
        id="contact"
        className="border-t"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-24 grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="text-xs tracking-widest uppercase mb-6"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Get in Touch
            </h2>
            <p
              className="text-xl font-medium leading-relaxed mb-6"
              style={{ color: "var(--qgi-text)" }}
            >
              Enterprise access, custom reports, or academic licensing?
            </p>
            <p
              className="text-sm leading-relaxed mb-8"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              QGI is actively working with political
              risk analysts, corporate strategy teams, think tanks, and academics
              who want structured, data-driven geopolitical intelligence.
              Reach out to discuss access, custom country reports, or
              institutional licensing.
            </p>
            <div className="flex flex-col gap-4">
              <a
                href="mailto:contact@qgintelligence.com?subject=Demo%20Request"
                className="inline-flex items-center gap-2 px-6 py-3 rounded text-sm font-medium tracking-wide transition-all hover:brightness-110 w-fit"
                style={{
                  backgroundColor: "var(--qgi-accent)",
                  color: "var(--qgi-bg)",
                }}
              >
                Request a Demo
              </a>
              <a
                href="mailto:contact@qgintelligence.com"
                className="text-sm transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                contact@qgintelligence.com
              </a>
            </div>
          </div>
          <div className="space-y-5 pt-2">
            <UseCase
              title="Corporate Strategy Teams"
              body="Identify which markets exhibit structural analogues to countries that experienced supply-chain disruptions, sanctions regimes, or government transitions."
            />
            <UseCase
              title="Political Risk Analysts"
              body="Augment qualitative assessments with quantitative precedent evidence. Bring the historical record to bear on current country trajectories."
            />
            <UseCase
              title="Think Tanks & Academics"
              body="Access reproducible, open-data-backed risk signals for research. Full methodology documentation and data provenance available."
            />
            <UseCase
              title="Journalists & Media"
              body="Ground geopolitical reporting in economic data. QGI surfaces which historical episodes a current situation most closely resembles."
            />
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
            {/* Wordmark */}
            <Link href="/" className="flex items-baseline gap-1" title="Home">
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
            {/* Nav links */}
            <div className="flex items-center gap-6">
              <Link
                href="/methodology"
                className="text-[11px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Methodology
              </Link>
              <Link
                href="/legal"
                className="text-[11px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Legal
              </Link>
              <a
                href="#contact"
                className="text-[11px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Contact
              </a>
              <a
                href="mailto:contact@qgintelligence.com"
                className="text-[11px] tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                contact@qgintelligence.com
              </a>
            </div>
          </div>
          <div
            className="border-t pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <span
              className="text-[10px] tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              &copy; 2026 QGI Intelligence. All rights reserved.
            </span>
            <span
              className="text-[10px] tracking-wider uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Pattern Recurrence Intelligence
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="font-data text-2xl font-bold"
        style={{ color: "var(--qgi-accent)" }}
      >
        {value}
      </div>
      <div
        className="text-xs mt-1 tracking-wider uppercase"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {label}
      </div>
    </div>
  );
}

function Differentiator({
  label,
  value,
  unit,
  desc,
}: {
  label: string;
  value: string;
  unit: string;
  desc: string;
}) {
  return (
    <div
      className="rounded-lg border p-6"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div
        className="text-[10px] tracking-widest uppercase mb-3"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span
          className="font-data text-2xl font-bold"
          style={{ color: "var(--qgi-accent)" }}
        >
          {value}
        </span>
        <span
          className="text-xs tracking-wide"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {unit}
        </span>
      </div>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {desc}
      </p>
    </div>
  );
}

function PrincipleCard({
  heading,
  body,
}: {
  heading: string;
  body: string;
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        backgroundColor: "var(--qgi-surface-2)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-2"
        style={{ color: "var(--qgi-text)" }}
      >
        {heading}
      </h3>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {body}
      </p>
    </div>
  );
}

function UseCase({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="border-l-2 pl-4 py-1"
      style={{ borderColor: "var(--qgi-accent)" }}
    >
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: "var(--qgi-text)" }}
      >
        {title}
      </h3>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {body}
      </p>
    </div>
  );
}

