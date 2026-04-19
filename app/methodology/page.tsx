import type { Metadata } from "next";
import Link from "next/link";
import LayeredTaxonomyTree from "@/components/methodology/LayeredTaxonomyTree";

// T8 #301 + T19 #312: full openGraph + twitter + canonical. This is a
// share-worthy page; previously it rendered a blank social preview card.
export const metadata: Metadata = {
  title: "Methodology — QGI Intelligence",
  description:
    "How QGI finds historical precedents in economic data to surface geopolitical risk candidates. Open-data foundation, statistical ensemble, calibration + ranking validation.",
  alternates: { canonical: "https://qgintelligence.com/methodology" },
  openGraph: {
    title: "Methodology — QGI Intelligence",
    description:
      "How QGI finds historical precedents in economic data to surface geopolitical risk candidates.",
    url: "https://qgintelligence.com/methodology",
    siteName: "QGI Intelligence",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Methodology — QGI Intelligence",
    description:
      "How QGI finds historical precedents in economic data to surface geopolitical risk candidates.",
  },
};

/**
 * Public methodology page — no auth required.
 * Critical for credibility (every user persona asks for it).
 */
export default function MethodologyPage() {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Navbar (same as landing) */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          {/* GH#251 + GH#245: clickable QG wordmark, links home */}
          <Link href="/" className="flex items-baseline gap-1" title="Home">
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
          <Link
            href="/countries"
            className="text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors"
            style={{
              backgroundColor: "var(--qgi-accent)",
              color: "var(--qgi-bg)",
            }}
          >
            Explore Countries
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-6 py-16">
        {/* Title */}
        <div className="mb-12">
          <div
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-accent)" }}
          >
            Methodology
          </div>
          <h1 className="text-3xl font-semibold mb-4">How QGI Finds Geopolitical Risk</h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            QGI surfaces economically-grounded risk candidates by finding historical
            precedents in World Bank data spanning 197 countries and 69 indicators (as of
            April 2026; we are actively expanding the indicator set and curated country
            coverage — next update within 90 days). Here is how it works.
          </p>
        </div>

        {/* T21 #314 (Alex s1+s2): Key Terms box — non-experts couldn't
            parse "SCDI", "PPS", "salience", "rank fusion" without a
            glossary. Collapsible <details> avoids pushing methodology
            content below the fold while still surfacing the glossary to
            first-time readers. */}
        <details
          className="mb-10 rounded-lg border"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <summary
            className="cursor-pointer px-5 py-3 text-sm font-semibold flex items-center gap-2"
            style={{ color: "var(--qgi-text)" }}
          >
            <span style={{ color: "var(--qgi-accent)" }}>▸</span>
            Key Terms Glossary
            <span
              className="text-[10px] font-normal tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              (click to expand)
            </span>
          </summary>
          <dl
            className="px-5 pb-5 pt-1 text-sm leading-relaxed grid gap-3"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                SCDI — Statistically Correlated Development Indicator
              </dt>
              <dd>
                A pair of country-indicator trajectories with strong Pearson correlation
                (|r| ≥ 0.5) over a shared window. The building block of every pattern.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                Pattern
              </dt>
              <dd>
                A bundle of 3+ SCDIs between the same two countries, over the same time
                window. Patterns carry a Pattern Power Score (PPS) that rolls correlation,
                indicator count, and window length into a single 0–100 quality metric.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                Precedent
              </dt>
              <dd>
                A pattern whose predictor country experienced a known geopolitical event
                within a forward window after the pattern ended. The event is recorded in
                QGI&apos;s curated event corpus.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                Pattern Length Tier (S / M / L / XL)
              </dt>
              <dd>
                <strong>S</strong> = 3–8 years (policy cycles, shocks); <strong>M</strong>{" "}
                = 9–20 years (leadership eras); <strong>L</strong> = 21–40 years
                (structural shifts); <strong>XL</strong> = 41+ years (civilizational
                parallels). Severity-agnostic — describes window length only.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                Risk Tier (HIGH / MODERATE / INDICATIVE)
              </dt>
              <dd>
                A country-level severity label derived from max salience across all
                patterns. Category-stratified: crisis categories (civil war, coup,
                political violence) promote at salience ≥ 1.4; other categories at ≥
                1.625.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                Salience Score
              </dt>
              <dd>
                Per-country z-score (how far above this country&apos;s own average)
                multiplied by a category drama weight (1.0 for wars / coups, 0.6 for
                elections, etc). Surfaces
                <em> unusually</em> pronounced category scores.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                Rank Fusion (RRF)
              </dt>
              <dd>
                Reciprocal Rank Fusion ensemble combining the pattern-based risk signal
                with a persistence baseline. Smooths single-model instability without
                optimizing any single metric.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "var(--qgi-text)" }}>
                Pattern Depth
              </dt>
              <dd>
                Total count of precedent matches across all pattern-length tiers for a
                country. Shown on each country profile as &quot;sparse&quot; (&lt;1,500),
                &quot;moderate&quot; (1,500–5,000), or &quot;robust&quot; (5,000+) so a
                score can be read against its evidence base.
              </dd>
            </div>
          </dl>
        </details>

        {/* Section 1: The Core Idea */}
        <Section id="core-idea" title="The Core Idea">
          <p>
            Countries often walk the same economic path, just at different times. When
            Country A&apos;s economic trajectory today mirrors Country B&apos;s trajectory
            from years ago — and Country B subsequently experienced a significant
            geopolitical event — QGI flags that as a precedent worth examining.
          </p>
          <p>
            QGI does not predict the future. It identifies structural similarities between
            countries&apos; economic trajectories and surfaces historical precedents that
            analysts should investigate.
          </p>
        </Section>

        {/* Section 2: Three Layers of Analysis */}
        <Section id="three-layers" title="Three Layers of Analysis">
          <h3
            className="text-sm font-semibold mt-6 mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Layer 1: Indicator Relationships (SCDIs)
          </h3>
          <p>
            A Single Dyadic Correlating Index (SCDI) is a statistically significant
            correlation between Country A&apos;s trajectory on one economic indicator and
            Country B&apos;s trajectory on the same indicator, possibly offset in time. We
            compute Pearson correlations across every country pair, every indicator, and
            every possible time window.
          </p>
          <DataBox>
            Example: Saudi Arabia&apos;s energy export trajectory from 2011–2016
            correlated at 95% with Azerbaijan&apos;s from 2016–2021.
          </DataBox>

          <h3
            className="text-sm font-semibold mt-6 mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Layer 2: Patterns
          </h3>
          <p>
            A Pattern aggregates all SCDIs that share the same country pair, time window,
            and segment length across multiple indicators. It answers: &ldquo;How many
            indicators, and how strongly, does Country A&apos;s trajectory match Country
            B&apos;s?&rdquo;
          </p>
          <DataBox>
            A pattern spanning 8 indicators at 91% average correlation is a strong
            structural similarity. One spanning 2 indicators at 55% is noise.
          </DataBox>

          <h3
            className="text-sm font-semibold mt-6 mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Layer 3: Precedents
          </h3>
          <p>
            A Precedent matches a pattern to a known geopolitical event. If Country
            B&apos;s economic trajectory was followed by a fiscal policy change, and
            Country A is currently walking that same trajectory, the system flags it:
            &ldquo;Country A is following a path that preceded fiscal_policy_change in
            Country B.&rdquo;
          </p>
          <DataBox>
            14 historical precedent windows, 11 preceded fiscal_policy_change in analogous
            economies — this is what QGI shows, not a probability.
          </DataBox>
        </Section>

        {/* Section 3: Data Sources */}
        <Section id="data-sources" title="Data Sources">
          <p>
            QGI currently uses 58 economic indicators from the World Bank Open Data
            platform (CC BY 4.0 license), covering:
          </p>
          <ul
            className="list-disc list-inside space-y-1 mt-3"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            <li>Macroeconomic: GDP, GNI, inflation, trade balance</li>
            <li>Fiscal: government debt, tax revenue, expenditure</li>
            <li>Financial: credit to private sector, reserves, FDI</li>
            <li>Military: military expenditure, armed forces, arms trade</li>
            <li>Social: unemployment, education enrollment, health</li>
            <li>Governance: World Governance Indicators (6 dimensions)</li>
            <li>Infrastructure: electricity access, internet, mobile</li>
            <li>Environment: CO2 emissions, renewable energy, forest area</li>
          </ul>
          <p className="mt-3">
            Additional providers (V-Dem governance indices, FAOSTAT food security, UCDP
            conflict data, UNHCR displacement data) are being integrated to expand
            coverage to 150+ indicators.
          </p>
        </Section>

        {/* Section: Event Taxonomy */}
        <Section id="event-taxonomy" title="Event Taxonomy">
          <p>
            QGI&apos;s event corpus is organized in a four-layer hierarchy that preserves
            full granularity while remaining scannable. The precedent engine matches
            patterns to <strong>Layer 3</strong> canonical event types (the actual
            prediction targets); the layered structure is a navigation aid for the country
            profile UI.
          </p>
          <LayeredTaxonomyTree />
          <p className="mt-3 text-[11px]" style={{ color: "var(--qgi-text-dim)" }}>
            Layer 4 — the individual event records themselves (13,812 events across 197
            countries as of April 2026) — is surfaced on the per-country profile pages,
            not in this overview.
          </p>
        </Section>

        {/* Section 4: Scoring */}
        <Section id="scoring" title="How Scoring Works">
          <h3
            className="text-sm font-semibold mt-6 mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Z-Score Normalization
          </h3>
          <p>
            For each country, we compute how unusual each event category&apos;s precedent
            count is compared to that country&apos;s own average. This removes the
            data-completeness bias — countries with more complete World Bank data
            don&apos;t automatically score higher.
          </p>

          <h3
            className="text-sm font-semibold mt-6 mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Salience Score
          </h3>
          <p>
            The z-score is multiplied by a category relevance weight that reflects the
            geopolitical consequence of each event type. Civil war and economic crisis
            carry full weight. Infrastructure projects and education reforms carry minimal
            weight. This ensures the ranking surfaces consequential signals, not
            statistically unusual but low-impact events.
          </p>

          <h3
            className="text-sm font-semibold mt-6 mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Rank Fusion
          </h3>
          <p>
            The salience-weighted scores are blended with a persistence baseline (did this
            country experience similar events recently?) using Reciprocal Rank Fusion.
            This ensures both structural trajectory signals and recent history contribute
            to the final ranking.
          </p>

          <h3
            className="text-sm font-semibold mt-6 mb-2"
            style={{ color: "var(--qgi-accent)" }}
          >
            Risk Tiers
          </h3>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <TierCard
              tier="HIGH"
              color="#f87171"
              description="Strong, consequential signal detected. Multiple historical precedents converge."
            />
            <TierCard
              tier="MODERATE"
              color="#fbbf24"
              description="Notable signal present. Historical precedents exist but are less concentrated."
            />
            <TierCard
              tier="INDICATIVE"
              color="#38bdf8"
              description="Weak or low-consequence signals only. Baseline monitoring."
            />
          </div>
        </Section>

        {/* Section 5: Validation */}
        <Section id="validation" title="Validation">
          <p>
            QGI V1.8.1 was backtested against 403 ground-truth country-event pairs across
            55 curated countries with a 2020 cutoff (trained on pre-2020 data, tested on
            2020–2025 events). Backtest cohort is 55 countries; current scoring cohort is
            126 countries across 197 total in the pipeline (as of April 2026).
          </p>

          <p className="mt-4">
            Two different questions matter, and we report both candidly:
          </p>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {/* Ranking quality */}
            <div
              className="rounded border p-4"
              style={{
                borderColor: "var(--qgi-border)",
                backgroundColor: "var(--qgi-surface-2)",
              }}
            >
              <div
                className="text-[10px] tracking-[0.15em] uppercase mb-2 font-mono"
                style={{ color: "var(--qgi-accent)" }}
              >
                1. Ranking quality · Lift@50, F1
              </div>
              <p className="text-sm">
                How well does QGI surface the most interesting countries at the top of its
                output? This is the analyst-triage use case.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <MetricCard label="Lift@50" value="2.24×" note="vs random" />
                <MetricCard label="F1 Score" value="0.480" note="vs persistence 0.336" />
              </div>
              <p className="mt-3 text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                <strong>QGI beats the persistence baseline</strong> on ranking metrics.
                The top-50 predictions are 2.24× more likely to match a real event than
                random selection — useful for horizon-scanning and portfolio triage.
              </p>
            </div>

            {/* Calibration */}
            <div
              className="rounded border p-4"
              style={{
                borderColor: "var(--qgi-border)",
                backgroundColor: "var(--qgi-surface-2)",
              }}
            >
              <div
                className="text-[10px] tracking-[0.15em] uppercase mb-2 font-mono"
                style={{ color: "var(--qgi-accent)" }}
              >
                2. Probability calibration · AUPRC
              </div>
              <p className="text-sm">
                How well-calibrated are QGI&apos;s probability estimates across all
                thresholds? This is the decision-theory use case.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <MetricCard label="AUPRC" value="0.43" note="QGI V1.8.1" />
                <MetricCard label="Baseline" value="0.58" note="persistence AUPRC" />
              </div>
              <p className="mt-3 text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                <strong>Persistence beats QGI on AUPRC.</strong> This is expected:
                persistence is an exceptionally strong calibration baseline for rare
                structural events because countries that had civil wars or coups tend to
                have them again. QGI&apos;s value-add is detecting
                <em> when the signal is changing</em> — not re-asserting the base rate.
                For decision-theory applications that need calibrated probabilities,
                persistence is currently stronger. V1.9 XGBoost targets AUPRC &gt; 0.55.
              </p>
            </div>
          </div>

          <p className="mt-5">
            <strong>When to use QGI vs persistence:</strong> use QGI for top-K analyst
            triage (&ldquo;which 50 countries deserve closer review this quarter?&rdquo;);
            use persistence (or V1.9 once it ships) for calibrated probability estimates
            in decision-theory pipelines.
          </p>

          <div
            className="mt-5 rounded border p-4"
            style={{
              borderColor: "var(--qgi-border)",
              backgroundColor: "var(--qgi-surface-2)",
            }}
          >
            <div
              className="text-[10px] tracking-[0.15em] uppercase mb-2 font-mono"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Statistical hygiene — multiple-testing correction
            </div>
            <p className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
              SCDI detection applies Benjamini-Hochberg FDR correction (p &lt; 0.05)
              across all pairwise correlation tests per country_a to control the
              false-discovery rate under the scale of ~14.3B pairwise tests. Without
              BH-FDR, this many tests would produce thousands of spurious correlations by
              chance alone.
            </p>
          </div>
        </Section>

        {/* Section 6: Pattern Tiers */}
        <Section id="pattern-tiers" title="Pattern Length Tiers">
          <p>
            Patterns are grouped by how many years they span, which reflects fundamentally
            different types of structural dynamics:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <TierCard
              tier="S (3–8 yr)"
              color="#f87171"
              description="Short-term: policy cycles, commodity shocks, fiscal crises."
            />
            <TierCard
              tier="M (9–20 yr)"
              color="#fbbf24"
              description="Medium-term: leadership eras, generational shifts, reform cycles."
            />
            <TierCard
              tier="L (21–40 yr)"
              color="#38bdf8"
              description="Long-term: Cold War legacies, development trajectories, structural eras."
            />
            <TierCard
              tier="XL (41+ yr)"
              color="#a78bfa"
              description="Institutional: civilizational similarities, deep structural parallels."
            />
          </div>
        </Section>

        {/* Section 7: Limitations */}
        <Section id="limitations" title="Limitations">
          <ul
            className="list-disc list-inside space-y-2"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            <li>
              <strong>Annual resolution:</strong> World Bank data is updated annually. QGI
              detects slow-moving structural trajectories (5–10 year patterns), not
              fast-moving crises.
            </li>
            <li>
              <strong>Correlation is not causation:</strong> A statistical match between
              two countries&apos; trajectories does not mean one causes the other. QGI
              identifies historical analogues, not causal mechanisms.
            </li>
            <li>
              <strong>Data lag:</strong> World Bank indicators are typically 1–2 years
              behind the current year. The most recent complete data year is usually 2
              years ago.
            </li>
            <li>
              <strong>Economic indicators only:</strong> QGI does not currently
              incorporate political event data, social media sentiment, or conflict
              databases. Events driven by personality politics, external military
              intervention, or sudden natural disasters may not show in economic
              trajectories.
            </li>
            <li>
              <strong>Category breadth:</strong> Some event categories (e.g.,
              &ldquo;government formation&rdquo;) are broad. A government formation could
              mean a routine election or a post-coup transition. Category specificity is
              being improved.
            </li>
          </ul>
        </Section>

        {/* Section 8: Honest Framing */}
        <Section id="framing" title="How to Read QGI">
          <DataBox>
            QGI surfaces economically-grounded risk candidates that analysts should
            examine. It does not replace expert judgment. Risk tiers reflect historical
            precedent density, not probability forecasts.
          </DataBox>
          <p className="mt-4">
            When QGI shows &ldquo;Argentina — Fiscal Policy Change — HIGH,&rdquo; it
            means: Argentina&apos;s current economic trajectory statistically resembles
            the trajectories of multiple countries that subsequently experienced fiscal
            policy changes. Whether Argentina will actually experience a fiscal policy
            change depends on many factors QGI does not measure.
          </p>
          <p>
            The value of QGI is in the evidence trail: which countries, which indicators,
            which time periods form the historical analogy. That evidence is what analysts
            should examine.
          </p>
        </Section>

        {/* Footer */}
        <div
          className="mt-16 pt-8 border-t text-center"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <p
            className="text-[10px] tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Pattern Recurrence Intelligence
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <Link
              href="/"
              className="text-xs transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Home
            </Link>
            <Link
              href="/countries"
              className="text-xs transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Countries
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div
        className="space-y-3 text-sm leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {children}
      </div>
    </section>
  );
}

function DataBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded border-l-2 pl-4 py-3 my-4 text-sm"
      style={{
        borderColor: "var(--qgi-accent)",
        backgroundColor: "var(--qgi-accent-glow)",
        color: "var(--qgi-text)",
      }}
    >
      {children}
    </div>
  );
}

function TierCard({
  tier,
  color,
  description,
}: {
  tier: string;
  color: string;
  description: string;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="text-xs font-semibold tracking-wider mb-1" style={{ color }}>
        {tier}
      </div>
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {description}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div
      className="rounded-lg border p-3 text-center"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="font-data text-xl font-bold" style={{ color: "var(--qgi-accent)" }}>
        {value}
      </div>
      <div className="text-xs font-medium mt-1">{label}</div>
      <div className="text-[10px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
        {note}
      </div>
    </div>
  );
}
