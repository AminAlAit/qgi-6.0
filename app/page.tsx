import Link from "next/link";

/**
 * QGI Landing Page — public, static.
 *
 * Sections:
 * 1. Hero with tagline
 * 2. Live preview: 3 country risk cards
 * 3. How it works: 3-step visual
 * 4. Sign up CTA
 * 5. Footer
 */

const PREVIEW_COUNTRIES = [
  {
    name: "Argentina",
    alpha_2: "AR",
    tier: "HIGH" as const,
    topCategory: "Fiscal policy change",
    precedents: 187,
    signal: "14 precedent windows, 11 preceded fiscal_policy_change in analogous economies",
  },
  {
    name: "Russia",
    alpha_2: "RU",
    tier: "HIGH" as const,
    topCategory: "Civil war & insurgency",
    precedents: 142,
    signal: "Cross-regional pattern convergence from 8 predictor countries",
  },
  {
    name: "Ethiopia",
    alpha_2: "ET",
    tier: "MODERATE" as const,
    topCategory: "Government formation",
    precedents: 98,
    signal: "Structural indicators mirror pre-transition trajectories in 5 economies",
  },
];

const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

const STEPS = [
  {
    num: "01",
    title: "Detect Indicator Relationships",
    desc: "We find statistically significant correlations between economic indicators across 214 countries spanning decades of World Bank data.",
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

export default function LandingPage() {
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
          <div className="flex items-center gap-2">
            <span
              className="font-data text-sm tracking-[0.25em] font-semibold"
              style={{ color: "var(--qgi-accent)" }}
            >
              QGI
            </span>
            <span
              className="text-[11px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Intelligence
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              How it works
            </a>
            <Link
              href="/methodology"
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Methodology
            </Link>
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
            Pattern Recurrence Intelligence &mdash; Statistical Beta
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
            spanning 214 countries and 58 indicators.
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
          {PREVIEW_COUNTRIES.map((c) => {
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
                    <span className="text-2xl">
                      {countryFlag(c.alpha_2)}
                    </span>
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

      {/* ─── CTA ────────────────────────────────────────────────────── */}
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

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="font-data text-xs tracking-[0.25em] font-semibold"
              style={{ color: "var(--qgi-accent)" }}
            >
              QGI
            </span>
            <span
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Pattern Recurrence Intelligence &mdash; Statistical Beta
            </span>
          </div>
          <p
            className="text-[10px] leading-relaxed max-w-sm text-center sm:text-right"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            QGI surfaces economically-grounded risk candidates that analysts
            should examine.
          </p>
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

/** Convert ISO 3166-1 alpha-2 to emoji flag. */
function countryFlag(alpha2: string): string {
  const codePoints = [...alpha2.toUpperCase()].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65
  );
  return String.fromCodePoint(...codePoints);
}
