import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArticleJsonLd } from "@/components/seo/ArticleJsonLd";
import Chart1CosineDecomposition, {
  Chart1CosineDecompositionHero,
} from "./charts/Chart1CosineDecomposition";
import Chart2RecipeIndicators from "./charts/Chart2RecipeIndicators";
import Chart3TimeWindowSigma from "./charts/Chart3TimeWindowSigma";
import TocSidebar from "./TocSidebar";
import PrintButton from "./PrintButton";

/**
 * India and Pakistan Are 99% the Same Risk.
 *
 * R8 panel #2 (mean 27.25/30). Author: Rajesh Iyer, Adjunct Fellow at Carnegie India,
 * retired Chief Risk Officer of ICICI Bank. Buy-side / sovereign-credit register.
 *
 * Compliance: qgi-docs/internal/ops/qgi-report-guidelines.md (E1-E11, V1-V4, L1-L4).
 */

const BAKE_DATE = "2026-04-30";
const PUBLISH_DATE = "2026-05-21";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "India and Pakistan Are 99% the Same Risk: QG Intelligence Report",
  description:
    "QGI places India and Pakistan at 99% cosine similarity, making them each other's #1 structural peer in the 156-country cohort. The convergence is recent, driven by the past decade's indicator movements, not a decades-long identity.",
  alternates: {
    canonical: "https://qgintelligence.com/reports/india-pakistan-mirror",
  },
  openGraph: {
    title:
      "India and Pakistan Are 99% the Same Risk, and Neither Risk Framework Wants to Hear It",
    description:
      "QGI places India and Pakistan at 99% cosine similarity. The two countries' Civil War & Insurgency recipe fingerprints are nearly identical. The convergence is recent.",
    url: "https://qgintelligence.com/reports/india-pakistan-mirror",
    siteName: "QG Intelligence",
    type: "article",
    publishedTime: `${PUBLISH_DATE}T00:00:00Z`,
  },
  twitter: {
    card: "summary_large_image",
    title: "India and Pakistan Are 99% the Same Risk",
    description:
      "QGI places India and Pakistan at 99% cosine similarity. Each other's #1 structural peer. The convergence is recent.",
  },
  robots: { index: true, follow: true },
};

// ─── Footnote registry ─────────────────────────────────────────────────────────

const FOOTNOTES = [
  {
    n: 1,
    term: "April 2026 scoring run",
    def: "A specific computation run of QGI's full pipeline on the April 2026 data snapshot; scores are tied to a scoring date because indicator data and model outputs change as new data arrives.",
    anchor: "#what-is-a-scoring-run",
  },
  {
    n: 2,
    term: "99% cosine similarity",
    def: "A geometric measure of how similar two countries' 8-dimension L1 risk vectors are, regardless of scale; 99% cosine similarity means the two profiles point in nearly the same direction across all active dimensions.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 3,
    term: "structural peer",
    def: "The country whose current L1 risk profile most closely matches another's by cosine similarity within the QGI cohort; not a synonym for an economic peer or a political ally.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 4,
    term: "Tier HIGH",
    def: "A country-level severity label (HIGH / MODERATE / INDICATIVE) assigned based on maximum salience across all patterns, with additional composite-promotion rules; HIGH requires sustained cross-category signal strength.",
    anchor: "#scoring",
  },
  {
    n: 5,
    term: "Civil War and Insurgency precedent recipe",
    def: "A per-recipe score (0–100) ranking how closely a country's current indicator trajectory resembles historical cases that preceded civil-war onset or escalation, within an 83-country cohort that fires on this recipe.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 6,
    term: "Precedent Match",
    def: "A 0–100 score expressing how close a country's current indicator trajectory is to historical precedents that preceded a specific event class.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 7,
    term: "LOCO AUC 0.769",
    def: "Leave-One-Country-Out Area Under the Curve: a cross-validation metric measuring how well the recipe discriminates countries that later experienced an event from those that did not, after removing each country from its own training set; 0.5 = chance, 1.0 = perfect.",
    anchor: "#loco-auc",
  },
  {
    n: 8,
    term: "Expected Calibration Error 0.006",
    def: "The average difference between predicted probability and observed event rate across score buckets; 0.006 means predictions are on average 0.6 percentage points off the empirical frequency.",
    anchor: "#calibration-error",
  },
  {
    n: 9,
    term: "8-dimension L1 risk profile",
    def: "The eight master categories (A through H) used in the current QGI taxonomy: Political Power & Regime, Conflict & Political Violence, State Authority & Governance, Economic & Financial Stress, Social Mobilization & Civil Society, Diplomatic & Geopolitical Relations, Humanitarian & Displacement, Structural Vulnerability.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 10,
    term: "95% CI",
    def: "A 95% bootstrap confidence interval estimated by resampling the cohort thousands of times; narrower intervals indicate more stable estimates.",
    anchor: "#bootstrap-ci",
  },
  {
    n: 11,
    term: "salience z-score",
    def: "A measure of how unusual a country's score for a given risk category is relative to its own historical average, scaled in units of standard deviation (σ); z = 1.94 means the score is 1.94 standard deviations above that country's own mean.",
    anchor: "#scoring",
  },
  {
    n: 12,
    term: "S / M / L / XL time windows",
    def: "Pattern Length Tiers grouping historical precedent windows by duration: S = 3–8 years (policy cycles), M = 9–20 years (leadership eras), L = 21–40 years (structural shifts), XL = 41+ years; each tier captures a different type of structural dynamic.",
    anchor: "#pattern-tiers",
  },
  {
    n: 13,
    term: "MODERATE / INDICATIVE tier label",
    def: "Per-window salience tier labels: MODERATE if z ≥ 1.0σ; INDICATIVE for sub-MODERATE but non-trivial movement. These are window-level labels distinct from the country-level Tier HIGH composite.",
    anchor: "#scoring",
  },
] as const;

// ─── Inline Footnote component ────────────────────────────────────────────────

function Fn({ n, children }: { n: number; children: React.ReactNode }) {
  const fn = FOOTNOTES.find((f) => f.n === n);
  if (!fn) return <>{children}</>;
  return (
    <span className="fn-wrap" style={{ position: "relative", display: "inline" }}>
      <span
        className="fn-term"
        tabIndex={0}
        style={{
          borderBottom: "1px dotted var(--qgi-accent)",
          cursor: "help",
          outline: "none",
        }}
      >
        {children}
        <sup
          style={{
            color: "var(--qgi-accent)",
            fontSize: "0.65em",
            marginLeft: "1px",
            verticalAlign: "super",
          }}
        >
          {n}
        </sup>
      </span>
      <span
        className="fn-tooltip"
        role="tooltip"
        style={{
          display: "none",
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 280,
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: 4,
          padding: "8px 10px",
          zIndex: 20,
          fontSize: 11,
          lineHeight: 1.5,
          pointerEvents: "none",
          whiteSpace: "normal",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        <span style={{ color: "var(--qgi-text)", display: "block", marginBottom: 4 }}>
          {fn.def}
        </span>
        <a
          href={`/methodology${fn.anchor}`}
          style={{
            color: "var(--qgi-accent)",
            textDecoration: "underline",
            fontSize: 10,
          }}
        >
          Read more →
        </a>
      </span>

      <style>{`
        .fn-wrap:hover .fn-tooltip,
        .fn-wrap:focus-within .fn-tooltip {
          display: block !important;
        }
      `}</style>
    </span>
  );
}

// ─── Pull-quote component ─────────────────────────────────────────────────────

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className="print:border-black"
      style={{
        margin: "2rem auto",
        maxWidth: 580,
        padding: "0.75rem 1.5rem",
        borderLeft: "4px solid var(--qgi-accent)",
        fontStyle: "italic",
        fontSize: "1.2em",
        lineHeight: 1.55,
        color: "var(--qgi-text)",
        backgroundColor: "rgba(167,139,250,0.04)",
        borderRadius: "0 4px 4px 0",
      }}
    >
      {children}
    </blockquote>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function IndiaPakistanMirrorReportPage() {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  .print\\:hidden, header, footer, .fn-tooltip { display: none !important; }
  body, .rpt-page-root { background: #fff !important; color: #111 !important; }
  article { max-width: 100% !important; padding: 0 !important; }
  h1, h2, h3 { color: #111 !important; }
  blockquote { border-left-color: #333 !important; background: transparent !important; color: #111 !important; }
  aside { background: #f5f5f5 !important; border-color: #ccc !important; color: #333 !important; }
  a { color: #111 !important; text-decoration: underline !important; }
  #footnotes { border-top: 1px solid #ccc !important; }
  figure { overflow: visible !important; }
  @page { margin: 20mm 15mm; }
}
          `,
        }}
      />

      <ArticleJsonLd
        headline="India and Pakistan Are 99% the Same Risk"
        description="QGI places India and Pakistan at 99% cosine similarity. The Civil War & Insurgency recipe fires on both countries with the same fingerprint."
        url="https://qgintelligence.com/reports/india-pakistan-mirror"
        datePublished={`${PUBLISH_DATE}T00:00:00Z`}
        imageUrl="https://qgintelligence.com/reports/india-pakistan-mirror/opengraph-image"
        author={{ type: "Person", name: "Amin Al-Ait" }}
      />

      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md print:hidden"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
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
          <nav className="flex items-center gap-4">
            <Link
              href={"/reports" as Route}
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)] flex items-center gap-1"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              &larr; All Reports
            </Link>
            <PrintButton />
          </nav>
        </div>
      </header>

      <TocSidebar />

      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8">
          <div
            className="text-[10px] tracking-widest uppercase mb-3 font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            Country Analysis · Published {PUBLISH_DATE}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight mb-4">
            India and Pakistan Are 99% the Same Risk, and Neither Risk Framework Wants to
            Hear It
          </h1>
          <p className="text-xs mb-1" style={{ color: "var(--qgi-text-dim)" }}>
            By Amin Al-Ait · Scoring date: {BAKE_DATE} · QGI V1.9.1
          </p>
          <p
            className="text-[11px] tracking-wide uppercase"
            style={{ color: "var(--qgi-text-muted)", fontVariant: "small-caps" }}
          >
            ~8 min read · April 2026 scoring run
          </p>
        </div>

        {/* Hero: cosine decomposition */}
        <div className="mb-8">
          <Chart1CosineDecompositionHero />
          <p
            className="mt-1 text-xs text-center"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            India and Pakistan 99% cosine similarity, decomposed across 6 of 8 L1
            dimensions. April 2026 scoring run, QGI V1.9.1.
          </p>
        </div>

        <div
          className="prose-qgi text-sm sm:text-base leading-relaxed space-y-5"
          style={{ color: "var(--qgi-text)" }}
        >
          {/* Soft-landing intro */}
          <p>
            Conventional sovereign risk frameworks place India and Pakistan at opposite
            ends of the spectrum. India: investment grade, rising global power, democratic
            consolidation, $3.5 trillion economy on a 6.5% growth trajectory. Pakistan:
            IMF-dependent, hybrid civil-military governance, sovereign-default flirtation
            in 2023, CCC+ rated. The two countries share a border, a colonial partition,
            and two-thirds of their historical disputes; in the world of risk pricing they
            inhabit different universes.
          </p>
          <p>
            QG Intelligence is a structural-precedent platform that runs across 156
            countries and hundreds of governance, economic, and security indicators. It
            does not produce a credit rating; it produces a structural-similarity
            comparison between every country and every other. In its{" "}
            <Fn n={1}>April 2026 scoring run</Fn>, QGI places{" "}
            <Link
              href={"/countries/india" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              India
            </Link>{" "}
            and{" "}
            <Link
              href={"/countries/pakistan" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Pakistan
            </Link>{" "}
            at <Fn n={2}>99% cosine similarity</Fn>, making them each other&apos;s #1{" "}
            <Fn n={3}>structural peer</Fn> in the entire 156-country cohort. Both sit at
            QGI&apos;s <Fn n={4}>Tier HIGH</Fn>. Both score within 3 percentile points of
            each other on the{" "}
            <Fn n={5}>
              <Link
                href={"/precedents/civil_war_and_insurgency" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Civil War and Insurgency
              </Link>{" "}
              precedent recipe
            </Fn>
            .
          </p>
          <p>
            This is not a data error. The 99% match holds across QGI scoring run cycles
            and survives the dimensional decomposition that follows.
          </p>
          <p>What follows is the structural reading.</p>

          {/* Section 1 */}
          <h2
            id="opposite-ends-of-the-spectrum"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            1. The Two Countries on Opposite Ends of the Spectrum, At 99%
          </h2>
          <p>
            India scores 72/100 [<Fn n={10}>95% CI</Fn> 62&ndash;81] on the Civil War and
            Insurgency recipe, ranking #24 of 83. Pakistan scores 68/100 [CI 58&ndash;78],
            ranking #27 of 83. The two countries are within three percentile points of
            each other on a recipe whose <Fn n={7}>LOCO AUC 0.769</Fn> and{" "}
            <Fn n={8}>Expected Calibration Error 0.006</Fn> across 64,830 historical
            instances place it in the highest validated tier of QGI&apos;s current locked
            set.
          </p>
          <p>
            When QGI decomposes the 99% cosine match into its constituent risk dimensions,
            it finds that the similarity spans 6 of 8 risk categories. Conflict and
            Political Violence accounts for 45% of the match. Political Power and Regime
            follows at 17%. State Authority and Governance and Economic and Financial
            Stress each contribute 11%. Social Mobilisation and Civil Society contributes
            10%. Diplomatic and Geopolitical Relations contributes approximately 6%.
          </p>

          {/* Section 2 */}
          <h2
            id="what-the-cosine-decomposition-shows"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            2. What the Cosine Decomposition Shows
          </h2>
          <p>
            Two-thirds of the match is structural-violence and regime-state-authority
            co-presence. The remaining third is economic and social stress at roughly
            equal weight. The dimension shapes are not generally similar across all eight
            L1 categories; they are specifically similar on the dimensions that matter
            most for conflict-onset trajectory.
          </p>

          <Chart1CosineDecomposition />

          <p>
            The decomposition is what gives the 99% number its analytical content. A
            country could be 99% cosine peers with another on the basis of a single
            dominant dimension; the match in that case would be a one-dimensional
            artefact, not a structural identity. India and Pakistan&apos;s 99% match is
            spread across six dimensions in proportions that broadly recapitulate the
            Civil War and Insurgency recipe&apos;s own indicator weights. The two
            measurements are pointing at the same underlying object from different angles.
          </p>

          {/* Section 3 */}
          <h2
            id="what-it-doesnt-mean"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            3. What It Does Not Mean
          </h2>
          <p>
            QGI&apos;s structural reading is not a probability forecast. The 99%
            similarity does not predict that India will experience the kind of conflict
            escalation that Pakistan has experienced in Khyber Pakhtunkhwa or Balochistan.
            India&apos;s democratic institutions, its independent judiciary, its
            professional civil service, and its track record of governing 1.4 billion
            people through successive peaceful transfers of power are real structural
            facts that QGI&apos;s recipe level does not capture. The platform&apos;s own
            documentation is honest about this: it reports structural pattern resemblance,
            not predictive probability.
          </p>
          <p>
            What it does mean is more uncomfortable: at the level of the indicators that
            historically precede civil conflict onset and escalation, indicators that
            cross economic, political, governance, and demographic dimensions,
            India&apos;s current trajectory and Pakistan&apos;s current trajectory are
            producing the same statistical signature. The model cannot see the
            institutions that might absorb the stress. It can see the stressors
            themselves.
          </p>

          {/* Pull-quote 1 */}
          <PullQuote>
            &ldquo;The model cannot see the institutions that might absorb the stress. It
            can see the stressors themselves.&rdquo;
          </PullQuote>

          {/* Section 4 */}
          <h2
            id="the-stressors-driving-the-match"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            4. The Stressors Driving the Match
          </h2>
          <p>
            The Civil War and Insurgency recipe fires on both countries with the same
            fingerprint at the indicator level: battle-related deaths year-on-year change
            (importance weight 0.55), Political Stability and Absence of
            Violence/Terrorism change (0.40), government final consumption expenditure
            change (0.20), energy imports as a percentage of energy use change (0.18), and
            arms imports trajectory (0.12). Same rank order. Same importance weights. Two
            countries, one structural signature.
          </p>

          <Chart2RecipeIndicators />

          <p>
            <strong>Battle-related deaths change</strong> is the top driver (0.55 weight).
            In India this reflects the ongoing low-intensity conflict in Jammu and
            Kashmir, the North-East insurgencies (primarily Manipur since 2023), and
            Naxalite-related violence. In Pakistan it reflects the TTP insurgency, ongoing
            Balochistan operations, and the post-Afghanistan withdrawal security
            deterioration. The model does not distinguish between a counterinsurgency
            state and a failing state. It reads the same underlying data.
          </p>
          <p>
            <strong>Political Stability and Absence of Violence/Terrorism change</strong>{" "}
            (0.40) is the second driver. V-Dem and World Governance Indicators have both
            recorded deterioration in this score for India in recent years, driven by
            state-level communal violence incidents, the Manipur crisis, and increased
            political polarisation indices. Pakistan&apos;s equivalent deterioration is
            more acute but the directions have been converging.
          </p>
          <p>
            <strong>Energy import dependency change</strong> (0.18 weight in Civil War,
            0.65 weight in Elections and Voting) is a cross-cutting structural driver
            across South Asia. India, with approximately 44% of its energy imported, has
            seen this trajectory tighten as coal import dependency has fluctuated with
            global price shocks. Pakistan&apos;s energy import crisis of 2022&ndash;2024
            was more acute, but the model is reading the structural trend, not the
            episodic crisis.
          </p>

          {/* Section 5 */}
          <h2
            id="banking-system-implication"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            5. The Banking-System Implication
          </h2>
          <p>
            India&apos;s financial system has spent the past decade building its internal
            risk frameworks on the premise of India-Pakistan structural divergence. The
            RBI Financial Stability Report assesses India&apos;s macro-prudential risk in
            isolation. Its CRAR stress tests treat the external environment through the
            lens of global commodity prices and capital flows, not through structural
            geopolitical precedent comparison. Indian commercial banks run country risk
            assessments on V-Dem + WGI + S&amp;P sovereign composite frameworks. None of
            these frameworks would produce the finding that India and Pakistan are
            structural equivalents, because none of them are designed to ask the question
            QGI asks: out of all 156 countries in the world right now, which one&apos;s
            recent indicator trajectory most closely resembles a given country&apos;s
            across the full set of dimensions that historically precede geopolitical
            stress?
          </p>
          <p>The answer, for India, is Pakistan. The answer, for Pakistan, is India.</p>
          <p>
            For sovereign credit analysts at Indian banks pricing offshore bond
            portfolios, for RBI staff assessing cross-border contagion risk, for IMF India
            and Pakistan teams sitting in the same building in Washington who have never
            had a quantitative tool placing their two countries in the same structural
            cohort, this finding creates a specific analytical obligation. The obligation
            is not to panic, and not to ignore. It is to ask: what are the Indian
            structural indicators that most closely track Pakistan&apos;s conflict-onset
            trajectory, and are those indicators accelerating or decelerating?
          </p>

          {/* Pull-quote 2 */}
          <PullQuote>
            &ldquo;The answer, for India, is Pakistan. The answer, for Pakistan, is
            India.&rdquo;
          </PullQuote>

          {/* Section 6 */}
          <h2
            id="sigma-tier-divergence-at-xl"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            6. The Sigma-Tier Divergence at XL: Why the Convergence Is Recent, Not
            Embedded
          </h2>
          <p>
            Pakistan&apos;s Civil War and Insurgency signal is more consistent across time
            windows than India&apos;s. Pakistan scores <Fn n={13}>MODERATE</Fn> (above
            1.0σ) at all four time horizons: Short (1.94σ), Medium (1.74σ), Long (1.47σ),
            and Extra-Long (1.06σ). India scores MODERATE at <Fn n={12}>S, M, and L</Fn>{" "}
            windows but drops to INDICATIVE at XL (0.83σ).
          </p>

          <Chart3TimeWindowSigma />

          <p>
            The longer the time window, the more the structural similarity dissipates.
            This is the central nuance of the QGI reading. The structural convergence is a
            relatively recent phenomenon, driven by the past decade&apos;s indicator
            movements, not a decades-long structural identity. India has not walked
            Pakistan&apos;s full historical trajectory. It has converged on it recently.
          </p>
          <p>
            For a sovereign credit framework, this distinction matters. A
            recently-converged trajectory is reversible by the same kind of indicator
            movement that produced it. An embedded structural identity is not. The
            XL-window divergence is the analytical hand-hold that distinguishes
            India&apos;s risk reading from a pure Pakistan-equivalent reading.
          </p>

          {/* Section 7 */}
          <h2 id="forward-call" className="text-xl sm:text-2xl font-semibold mt-10 mb-3">
            7. The Forward Call, With Explicit Falsification
          </h2>
          <p>
            If India&apos;s Civil War and Insurgency <Fn n={11}>salience z-score</Fn> in
            the next QGI scoring run maintains its S-window reading above 1.5σ while the
            XL window remains below 1.0σ, it indicates the structural convergence is a
            medium-term phenomenon, not yet a structural embedding. The structural risk is
            real but contained in a medium-term horizon.
          </p>
          <p>The forward call falsifies in two ways.</p>
          <p>
            <strong>First, decay.</strong> If India&apos;s political stability indicators
            and battle-related deaths change measure improve in the next 12&ndash;18
            months (through successful conflict resolution in Manipur, a sustained
            reduction in J&amp;K militancy-related deaths, or a V-Dem political stability
            uptick post-2024 electoral consolidation), India&apos;s S-window signal would
            be expected to decay below MODERATE tier. A decay below 1.0σ in the next
            scoring run would falsify the structural convergence claim.
          </p>
          <p>
            <strong>Second, escalation.</strong> If India&apos;s Bilateral Treaty signal
            (currently INDICATIVE at 0.74σ, driven by demographic factors) escalates above
            MODERATE in the wake of the April 2026 Pahalgam attack and its bilateral
            consequences, the structural fingerprint changes in a measurable way trackable
            in real time against the next scoring run.
          </p>

          {/* Pull-quote 3 */}
          <PullQuote>
            &ldquo;The convergence is recent, driven by the past decade&apos;s indicator
            movements. India has not walked Pakistan&apos;s full historical trajectory. It
            has converged on it recently.&rdquo;
          </PullQuote>

          {/* Methodology aside */}
          <aside
            id="methodology-footnote"
            role="note"
            aria-label="Methodology footnote"
            className="my-8 rounded-lg p-5 text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              color: "var(--qgi-text-dim)",
              fontSize: "0.75rem",
            }}
          >
            <div
              className="text-[10px] tracking-widest uppercase font-semibold mb-3"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Methodology
            </div>
            <p className="mb-2">
              QGI data:{" "}
              <Link
                href={"/countries/india" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                India
              </Link>{" "}
              Civil War &amp; Insurgency 72/100 [CI 62&ndash;81] #24 of 83, σ tiers S 1.94
              / M 1.74 / L 1.47 / XL 0.83 (MODERATE / MODERATE / MODERATE / INDICATIVE),
              Bilateral Treaty INDICATIVE 0.74σ &middot;{" "}
              <Link
                href={"/countries/pakistan" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Pakistan
              </Link>{" "}
              Civil War &amp; Insurgency 68/100 [CI 58&ndash;78] #27 of 83, σ tiers S 1.94
              / M 1.74 / L 1.47 / XL 1.06 (all MODERATE) &middot; Both Tier HIGH &middot;
              Cosine similarity 99% (each other&apos;s #1 of 156) &middot; Decomposition:
              Conflict &amp; Political Violence 45%, Political Power &amp; Regime 17%,
              State Authority &amp; Governance 11%, Economic &amp; Financial Stress 11%,
              Social Mobilisation &amp; Civil Society 10%, Diplomatic &amp; Geopolitical
              Relations ~6% &middot; Civil War &amp; Insurgency recipe LOCO AUC 0.769, ECE
              0.006, N=64,830 historical instances &middot; Recipe indicator fingerprint:
              battle-related deaths YoY change (0.55), Political Stability &amp; Absence
              of Violence/Terrorism change (0.40), government final consumption
              expenditure change (0.20), energy imports % of energy use change (0.18),
              arms imports trajectory (0.12) &middot; April 2026 scoring run (generated{" "}
              {BAKE_DATE}) &middot; QGI V1.9.1.
            </p>
            <p className="mb-2">
              Methodology disclosures: (1){" "}
              <strong>
                QGI&apos;s structural reading is not a probability forecast.
              </strong>{" "}
              Cosine similarity measures geometric alignment of 8-dimension L1 risk
              vectors. The model captures stressors, not institutional capacity to absorb
              them. Treat the 99% figure as a structural-resemblance measurement, not as a
              credit-rating-equivalent probability statement. (2){" "}
              <strong>Cosine variant.</strong> The 99% figure is the composite cosine on
              the active L1 dimensions; per-dimension contributions sum to ~100% by
              construction. (3) <strong>S/M/L/XL window labels</strong> are per-window
              MODERATE (z &ge; 1.0σ) vs INDICATIVE (sub-MODERATE) labels, distinct from
              the country-level Tier HIGH composite. (4){" "}
              <strong>April 2026 Pahalgam attack monitor.</strong> The Bilateral Treaty
              escalation falsification trigger refers to a real-world event in the
              post-scoring-run period; the next QGI scoring run is the analytical
              instrument to check whether the structural fingerprint moves on this event.
            </p>
            <p>
              See{" "}
              <Link
                href={"/methodology" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                QGI methodology
              </Link>{" "}
              for scoring run details, recipe construction, and cohort definitions.
            </p>
          </aside>

          {/* CTA */}
          <aside
            className="my-8 rounded-lg p-6 print:hidden"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              <strong style={{ color: "var(--qgi-text)" }}>
                Explore the underlying data.
              </strong>{" "}
              India&apos;s full risk profile is at{" "}
              <Link
                href={"/countries/india" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                qgintelligence.com/countries/india
              </Link>
              ; Pakistan&apos;s at{" "}
              <Link
                href={"/countries/pakistan" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                /countries/pakistan
              </Link>
              . The Civil War &amp; Insurgency precedent cohort (83 countries ranked) is
              at{" "}
              <Link
                href={"/precedents/civil_war_and_insurgency" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                /precedents/civil_war_and_insurgency
              </Link>
              . The methodology behind the scoring is at{" "}
              <Link
                href={"/methodology" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                /methodology
              </Link>
              . If your organisation would like to commission country-specific structural
              analysis of this kind, or discuss access to QGI&apos;s full dataset, write
              to{" "}
              <a
                href="mailto:contact@qgintelligence.com"
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                contact@qgintelligence.com
              </a>
              .
            </p>
          </aside>

          {/* Footnotes */}
          <section
            id="footnotes"
            className="my-8 pt-6"
            style={{ borderTop: "1px solid var(--qgi-border)" }}
            aria-label="Footnotes"
          >
            <div
              className="text-[10px] tracking-widest uppercase font-semibold mb-4"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Term definitions
            </div>
            <ol className="space-y-3 text-xs leading-relaxed list-none p-0">
              {FOOTNOTES.map((fn) => (
                <li key={fn.n} id={`fn-${fn.n}`} style={{ color: "var(--qgi-text-dim)" }}>
                  <span
                    style={{
                      color: "var(--qgi-accent)",
                      fontFamily: "var(--font-data, monospace)",
                      marginRight: 6,
                    }}
                  >
                    {fn.n}.
                  </span>
                  <strong style={{ color: "var(--qgi-text)" }}>{fn.term}</strong>
                  {": "}
                  {fn.def}{" "}
                  <a
                    href={`/methodology${fn.anchor}`}
                    className="underline underline-offset-2"
                    style={{ color: "var(--qgi-accent)" }}
                  >
                    Read more →
                  </a>
                </li>
              ))}
            </ol>
          </section>

          <p
            className="text-xs mt-12 pt-6 border-t"
            style={{
              color: "var(--qgi-text-dim)",
              borderColor: "var(--qgi-border)",
            }}
          >
            Published {PUBLISH_DATE} &middot; QG Intelligence &middot; By Amin Al-Ait
            &middot; Values cited from the {BAKE_DATE} V1.9.1 scoring run. This piece
            reports structural pattern resemblance and historical-analogue comparison. It
            is not a forecast.
          </p>
        </div>
      </article>
    </div>
  );
}
