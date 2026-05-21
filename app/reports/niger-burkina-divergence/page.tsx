import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArticleJsonLd } from "@/components/seo/ArticleJsonLd";
import Chart1DivergenceBars, {
  Chart1DivergenceBarsHero,
} from "./charts/Chart1DivergenceBars";
import Chart2IndicatorWeights from "./charts/Chart2IndicatorWeights";
import Chart3CosineVsRecipe from "./charts/Chart3CosineVsRecipe";
import Chart4BosniaTemplate from "./charts/Chart4BosniaTemplate";
import TocSidebar from "./TocSidebar";
import PrintButton from "./PrintButton";

/**
 * The Junta That Cannot Stay Isolated: Niger's Structural Divergence Inside the AES Bloc.
 *
 * R8 panel #1 (mean 27.75/30, tightest panel std-dev 0.43).
 *
 * Compliance: qgi-docs/internal/ops/qgi-report-guidelines.md
 *  - E1 G0 Pass (recipe-cohort divergence between 95%-cosine peers not findable
 *    by a two-hour desk analyst)
 *  - E2 soft-landing intro (AES bloc unity frame first; QGI introduced in para 2)
 *  - E3 byline + E4 reading-time chip
 *  - E5 three verbatim pull-quotes
 *  - E6 end-of-piece CTA with commission ask
 *  - E7 inline Fn footnotes + static numbered list at #footnotes
 *  - E8 methodology aside with disclosed gaps
 *  - E9 no em-dashes in prose; "scoring run" not "bake"
 *  - E10 numbers trace to draft + QGI scoring run 2026-04-30
 *  - E11 named falsification scenario (December 31, 2026 ECOWAS communication test)
 *  - V1 chart hero (Chart3 — the cosine-vs-recipe paradox)
 *  - V2 inline SVG only, design tokens only
 *  - V3 tooltip placement outside overflow parents
 *  - V4 OG card via opengraph-image.tsx
 *  - L1/L2/L3/L4 route structure, sticky TOC, print stylesheet, metadata
 */

const BAKE_DATE = "2026-04-30";
const PUBLISH_DATE = "2026-05-21";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Niger's Structural Divergence from Burkina Faso Inside the AES Bloc",
  description:
    "QGI Intelligence places Niger #4 of 58 on its Multilateral Agreement recipe at 94/100. Its closest structural peer Burkina Faso sits at #57 with 2/100. The two AES juntas are on opposite structural paths.",
  alternates: {
    canonical: "https://qgintelligence.com/reports/niger-burkina-divergence",
  },
  openGraph: {
    title:
      "The Junta That Cannot Stay Isolated: Niger's Structural Divergence Inside the AES Bloc",
    description:
      "Niger and Burkina Faso are 95% cosine peers. On QGI's Multilateral Agreement recipe, Niger ranks #4 of 58; Burkina Faso #57. The structural divergence the AES frame misses.",
    url: "https://qgintelligence.com/reports/niger-burkina-divergence",
    siteName: "QGI Intelligence",
    type: "article",
    publishedTime: `${PUBLISH_DATE}T00:00:00Z`,
  },
  twitter: {
    card: "summary_large_image",
    title:
      "The Junta That Cannot Stay Isolated: Niger's Structural Divergence Inside the AES Bloc",
    description:
      "Niger and Burkina Faso are 95% cosine peers. On Multilateral Agreement, Niger ranks #4 of 58; Burkina Faso #57. The divergence the AES frame misses.",
  },
  robots: { index: true, follow: true },
};

// ─── Footnote registry ─────────────────────────────────────────────────────────
// Numbered by order of first appearance in the prose body.

const FOOTNOTES = [
  {
    n: 1,
    term: "April 2026 scoring run",
    def: "A specific computation run of QGI's full pipeline on the April 2026 data snapshot; scores are tied to a scoring date because indicator data and model outputs change as new data arrives.",
    anchor: "#what-is-a-scoring-run",
  },
  {
    n: 2,
    term: "Multilateral Agreement recipe",
    def: "A per-recipe score (0–100) ranking how closely a country's current indicator trajectory resembles historical cases that preceded a country joining or institutionalising a multilateral international agreement, within a 58-country cohort that fires on this recipe.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 3,
    term: "Precedent Match score 94/100",
    def: "The score is 94 out of 100; the bracketed range is a 95% bootstrap confidence interval showing the uncertainty around the estimate from repeated resampling of the cohort.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 4,
    term: "95% cosine similarity",
    def: "A geometric measure of how similar two countries' 8-dimension L1 risk vectors are, regardless of scale; 95% cosine similarity means the two profiles point in nearly the same direction across all active dimensions.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 5,
    term: "composite L1 level",
    def: "The 8-dimension master categorisation (Political, Conflict, Governance, Economic, Social, Diplomatic, Humanitarian, Structural) at which QGI computes country-vs-country structural similarity.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 6,
    term: "LOCO AUC 0.8689",
    def: "Leave-One-Country-Out Area Under the Curve: a cross-validation metric measuring how well the recipe discriminates countries that later experienced an event from those that did not, after removing each country from its own training set; 0.5 = chance, 1.0 = perfect. 0.8689 is the highest LOCO AUC across QGI's four currently LOCKed recipes.",
    anchor: "#loco-auc",
  },
  {
    n: 7,
    term: "STRONG evidence grade",
    def: "QGI's qualitative label for a LOCO AUC in the highest validated tier; the label travels with the recipe, not the country score.",
    anchor: "#loco-auc",
  },
  {
    n: 8,
    term: "calibration error 0.009",
    def: "Expected Calibration Error (ECE): the average difference between a model's predicted probability and the actual observed event rate across score buckets; 0.009 means predictions are on average 0.9 percentage points off.",
    anchor: "#calibration-error",
  },
  {
    n: 9,
    term: "trend-features architecture",
    def: "A recipe design that scores the direction of indicator change over time, not absolute indicator levels; a country improving on a structural indicator scores high even if the absolute level is still poor.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 10,
    term: "95% CI",
    def: "A 95% bootstrap confidence interval estimated by resampling the cohort thousands of times; narrower intervals indicate more stable estimates.",
    anchor: "#bootstrap-ci",
  },
  {
    n: 11,
    term: "salience",
    def: "A measure of how unusual a country's score for a given risk category is relative to its own historical average, scaled in units of standard deviation; high salience means the signal is far above that country's mean.",
    anchor: "#scoring",
  },
  {
    n: 12,
    term: "anchor battery",
    def: "Historically completed precedent windows where the recipe's prediction can be cross-checked against the actual outcome; a recipe with anchored evidence for a specific country is more trustworthy in that context than one without.",
    anchor: "#aggregate-vs-per-recipe",
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

export default function NigerBurkinaDivergenceReportPage() {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Print stylesheet (L3) */}
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
        headline="The Junta That Cannot Stay Isolated: Niger's Structural Divergence Inside the AES Bloc"
        description="Niger and Burkina Faso are 95% cosine peers at the L1 composite level. On QGI's Multilateral Agreement recipe, Niger ranks #4 of 58 at 94/100; Burkina Faso ranks #57 of 58 at 2/100. The two AES juntas are on opposite structural paths."
        url="https://qgintelligence.com/reports/niger-burkina-divergence"
        datePublished={`${PUBLISH_DATE}T00:00:00Z`}
        imageUrl="https://qgintelligence.com/reports/niger-burkina-divergence/opengraph-image"
        author={{ type: "Person", name: "Amin Al-Ait" }}
      />

      {/* Navbar */}
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

      {/* Sticky TOC sidebar */}
      <TocSidebar />

      <article className="mx-auto max-w-3xl px-6 py-16">
        {/* Hero */}
        <div className="mb-8">
          <div
            className="text-[10px] tracking-widest uppercase mb-3 font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            Country Analysis · Published {PUBLISH_DATE}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight mb-4">
            The Junta That Cannot Stay Isolated: Niger&apos;s Structural Divergence Inside
            the AES Bloc
          </h1>
          <p className="text-xs mb-1" style={{ color: "var(--qgi-text-dim)" }}>
            By Amin Al-Ait · Scoring date: {BAKE_DATE} · QGI V1.9.1
          </p>
          <p
            className="text-[11px] tracking-wide uppercase"
            style={{ color: "var(--qgi-text-muted)", fontVariant: "small-caps" }}
          >
            ~9 min read · April 2026 scoring run
          </p>
        </div>

        {/* Hero image: the cosine-vs-recipe paradox at ~900x400 */}
        <div className="mb-8">
          <Chart1DivergenceBarsHero />
          <p
            className="mt-1 text-xs text-center"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Niger vs Burkina Faso vs Mali, Multilateral Agreement recipe Precedent Match
            scores, April 2026 scoring run. Source: QGI computation.
          </p>
        </div>

        <div
          className="prose-qgi text-sm sm:text-base leading-relaxed space-y-5"
          style={{ color: "var(--qgi-text)" }}
        >
          {/* Soft-landing intro (E2) */}
          <p>
            When the Alliance des &Eacute;tats du Sahel formally declared itself an
            international confederation in July 2024, and when its three members, Mali,
            Burkina Faso, and Niger, completed their withdrawal from ECOWAS in January
            2025, the international commentary settled into a familiar frame. A unified
            anti-Western bloc. Insulated from multilateral pressure. Converging on a
            post-ECOWAS Sahel order anchored by Russian security partnerships. Africa
            desks across foreign ministries and think tanks have largely treated the three
            states as one analytical unit.
          </p>
          <p>
            QGI Intelligence is a system that searches for structural resemblance between
            countries&apos; indicator trajectories and historical precedents, running the
            numbers across 156 countries and hundreds of governance, economic, and
            security indicators to surface patterns that conventional regional analysis
            does not reach. In its <Fn n={1}>April 2026 scoring run</Fn>, Niger ranks #4
            globally on QGI&apos;s{" "}
            <Fn n={2}>
              <Link
                href={"/precedents/multilateral_agreement" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Multilateral Agreement
              </Link>{" "}
              recipe
            </Fn>{" "}
            with a <Fn n={3}>Precedent Match score 94/100</Fn> (95% CI 84&ndash;100).
            Burkina Faso, Niger&apos;s closest structural peer at{" "}
            <Fn n={4}>95% cosine similarity</Fn> on the <Fn n={5}>composite L1 level</Fn>,
            ranks #57 of 58 on the same recipe with a score of 2/100 (95% CI 0&ndash;5).
          </p>
          <p>
            These are not different gradations of the same signal. They are opposite
            structural readings produced by the same model, applied to two countries that
            every West Africa analyst treats as part of a unified political project.
          </p>
          <p>That divergence is the story.</p>

          {/* Section 1 */}
          <h2
            id="two-juntas-opposite-trajectories"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            1. Two Juntas, One Alliance, Opposite Structural Trajectories
          </h2>
          <p>
            The AES confederation was announced as a political and security project. Its
            joint statements, mutual-defence protocols, and anti-ECOWAS posture constitute
            the political layer that the news cycle covers. Beneath that political
            surface, the structural-indicator trajectories QGI&apos;s Multilateral
            Agreement model reads tell a different story.
          </p>
          <p>
            Stated plainly:{" "}
            <Link
              href={"/countries/niger" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Niger
            </Link>{" "}
            ranks #4 globally among 58 countries on the Multilateral Agreement recipe,
            which predicts a country engaging with or joining multilateral international
            agreements.{" "}
            <Link
              href={"/countries/burkina_faso" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Burkina Faso
            </Link>
            , its closest structural peer at 95% cosine similarity at the L1 composite
            level, ranks #57 of 58 on the same recipe.{" "}
            <Link
              href={"/countries/mali" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Mali
            </Link>{" "}
            sits in a separate analytical position again: its profile carries no
            Multilateral Agreement score in the current run, with top structural peers
            (Sudan 95%, India 94%, Lebanon 93%, South Sudan 93%) clustered around complex,
            multi-party conflict states rather than the bilateral-engagement dynamics
            visible in Niger.
          </p>

          <Chart1DivergenceBars />

          <p>
            The divergence is not visible in conventional country profiles, diplomatic
            communiqu&eacute;s, or even the security incident databases that typically
            anchor Africa risk analysis. It is visible in the structural-indicator
            trajectories that QGI&apos;s Multilateral Agreement model reads, and it is
            visible nowhere else.
          </p>

          {/* Section 2 */}
          <h2
            id="what-the-model-reads"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            2. What QGI&apos;s Model Is Reading
          </h2>
          <p>
            The Multilateral Agreement recipe is the strongest of QGI&apos;s four
            validated recipes in evidentiary terms. Its out-of-country discrimination
            score, <Fn n={6}>LOCO AUC 0.8689</Fn>, is the highest in the currently locked
            set, paired with an overall <Fn n={8}>calibration error 0.009</Fn> and a{" "}
            <Fn n={7}>STRONG evidence grade</Fn>. It runs on a{" "}
            <Fn n={9}>trend-features architecture</Fn>, which means it scores the
            direction of indicator change over time, not absolute indicator levels. The
            recipe&apos;s own dossier states the mechanism: the change in diplomatic
            posture matters more than the absolute relations level. A country improving
            its structural engagement trajectory scores high even if its absolute
            institutional quality remains low.
          </p>
          <p>
            For Niger, three dominant indicators drive the Multilateral Agreement signal.
          </p>

          <Chart2IndicatorWeights />

          <p>
            <strong>Tax revenue (% of GDP) year-over-year change</strong>, importance
            weight 0.60, the highest. Niger&apos;s fiscal trajectory has been improving
            since ECOWAS sanctions were lifted in February 2024. Uranium export revenues
            resumed; the fiscal consolidation forced by sanctions produced a measurable
            improvement in the tax-revenue-to-GDP trajectory.
          </p>
          <p>
            <strong>Female labour force participation rate, year-over-year change</strong>
            , importance weight 0.53. Niger has the world&apos;s highest total fertility
            rate and one of the lowest female labour force participation rates. Any upward
            movement, even marginal, produces a strong trend signal in this feature,
            because the model trained on historical patterns in which demographic
            inclusion preceded multilateral engagement.
          </p>
          <p>
            <strong>
              Voice and Accountability (V-Dem estimate, year-over-year change)
            </strong>
            , importance weight 0.40, flagged with a &ldquo;Possible country bias&rdquo;
            caveat. This indicator is moving negatively (coup governments destroy
            democratic institutions), but the rate of decline may have stabilised relative
            to the immediate post-coup period, which registers as a less-negative trend
            feature. The country-bias flag matters: V-Dem&apos;s historical training data
            reflects institutional dynamics that map imperfectly onto junta consolidation
            periods.
          </p>
          <p>
            Burkina Faso&apos;s Multilateral Agreement signal (2/100, bottom of cohort)
            reflects the structural opposite. Its fiscal trajectory, demographic
            indicators, and governance trajectory are all moving in directions that
            historically precede multilateral disengagement, not engagement. Its Civil War
            &amp; Insurgency score sits at 81/100 (#16 globally of 83 countries), a
            country whose conflict trajectory is deepening, absorbing institutional
            capacity, and crowding out the structural conditions that historically precede
            multilateral re-engagement.
          </p>

          {/* Pull-quote 1 */}
          <PullQuote>
            &ldquo;These are not different gradations of the same signal. They are
            opposite structural readings produced by the same model, applied to two
            countries that every West Africa analyst treats as part of a unified political
            project.&rdquo;
          </PullQuote>

          {/* Section 3 */}
          <h2
            id="aes-frame-misses"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            3. A Structural Reading the AES Frame Misses
          </h2>
          <p>
            Political projects do not override structural indicator trajectories in the
            medium run. They can suppress them, redirect them, or create temporary
            divergences between political posture and structural reality. QGI&apos;s
            Multilateral Agreement recipe is measuring the structural substrate, not the
            political posture.
          </p>
          <p>
            In Niger&apos;s case, the structural substrate is moving toward the conditions
            that historically precede multilateral engagement at the same time that the
            political posture is moving away from multilateral institutions. This is the
            structural tension the model is surfacing.
          </p>

          <Chart3CosineVsRecipe />

          <p>
            There is a historical template for this kind of tension. Bosnia and
            Herzegovina sits #1 globally on the Multilateral Agreement recipe at 99/100
            (95% CI 96&ndash;100), and its dashboard lead-time data shows its highest
            convergence scores firing at &minus;4 to +1 year relative to the multilateral
            event, meaning Bosnia&apos;s structural indicators were already on the
            trajectory toward multilateral engagement during the Dayton negotiation period
            (1993&ndash;1995), before the agreement was concluded. The structural
            conditions for multilateral re-engagement preceded the political decision by
            years.
          </p>
          <p>
            This is the template QGI&apos;s model learned from. The recipe&apos;s trend
            features capture the structural readiness for multilateral engagement even
            before the political will materialises. Niger may be in an analogous
            pre-negotiation phase: its indicators are building the structural case for
            re-engagement while the political surface maintains the isolation posture.
          </p>

          {/* Section 4 */}
          <h2
            id="why-niger-not-mali-burkina"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            4. Why Niger, Not Mali or Burkina Faso
          </h2>
          <p>The AES has three members. Why does only Niger show this divergence?</p>
          <p>
            Mali&apos;s QGI profile (Risk Score 64/100 [56&ndash;72], Civil War 48/100,
            #44 of 83) shows none of the recipe-level signals Niger carries. It has no
            Multilateral Agreement score, no Elections score, no Bilateral Treaty score in
            the current run. Its top structural peers, listed above, cluster around
            complex multi-party civil conflicts and contested governance rather than the
            bilateral engagement dynamics visible in Niger&apos;s profile. Mali is
            structurally mid-table in a broad conflict-affected cohort. It carries no
            strong forward-looking treaty signal in either direction.
          </p>
          <p>
            Burkina Faso, as detailed above, is structurally moving in the opposite
            direction from Niger: deeper conflict, lower multilateral trajectory, lower
            bilateral engagement trajectory.
          </p>
          <p>
            Niger&apos;s structural distinctiveness within the AES is driven by three
            factors a field analyst can name.
          </p>
          <p>
            <strong>First, the uranium economy.</strong> Niger produces approximately 5%
            of the world&apos;s uranium and is France&apos;s primary supplier. Uranium
            extraction requires a degree of external commercial engagement (multinational
            mining contracts, international commodity pricing, export infrastructure) that
            creates structural dependencies on external economic institutions even when
            political alignment is hostile. These economic dependencies leave traces in
            fiscal and trade indicator trajectories that the model reads as
            structural-engagement signals.
          </p>
          <p>
            <strong>Second, the demographic starting point.</strong> Niger&apos;s extreme
            demographic indicators (highest fertility rate globally, very young median
            age, very low female labour force participation) mean that even marginal
            improvements register as large proportional changes in a trend-feature model.
            The model reads these movements as structural preparation for multilateral
            engagement. In Niger&apos;s case, they may be more directly a consequence of
            population structure than of any diplomatic intention.
          </p>
          <p>
            <strong>Third, the ECOWAS sanctions experience.</strong> Unlike Burkina Faso,
            which was sanctioned but less severely, Niger experienced a near-complete
            ECOWAS embargo from August 2023 to February 2024. The embargo and its lifting
            left visible traces in Niger&apos;s fiscal and trade indicators.
            Sanctions-and-relief cycles produce the kind of fiscal trajectory changes that
            the Multilateral Agreement model reads as structural engagement signals.
          </p>

          {/* Pull-quote 2 */}
          <PullQuote>
            &ldquo;The dominant indicators driving Niger&apos;s signal are fiscal and
            demographic. They are not moved by AES membership agreements or Russia
            security protocols. They are moved by the underlying economic and demographic
            dynamics of a uranium-export economy with an extreme demographic
            profile.&rdquo;
          </PullQuote>

          {/* Section 5 */}
          <h2 id="forward-call" className="text-xl sm:text-2xl font-semibold mt-10 mb-3">
            5. The Forward Call
          </h2>
          <p>
            By Q4 2026, Niger&apos;s structural trajectory on the Multilateral Agreement
            recipe, absent a reversal in the indicator trends that drive it, will generate
            observable diplomatic movement toward structured dialogue with the ECOWAS
            secretariat. This will not be re-entry into ECOWAS. It will take the form of a
            formal communication or informal diplomatic contact seeking a structured
            negotiation framework: the kind of outreach that historically precedes treaty
            re-engagement by 1 to 3 years on the model&apos;s historical template.
          </p>
          <p>
            <strong>The falsification event.</strong> If by December 31, 2026, the CNSP
            government has made no formal or documented informal communication to the
            ECOWAS secretariat seeking any form of structured dialogue (not re-entry, not
            sanctions relief, just dialogue), the structural trajectory reading is wrong.
            Multiple independent sources would need to confirm the absence of contact: a
            denial from the ECOWAS Executive Secretariat plus silence from Niger&apos;s
            own foreign ministry.
          </p>
          <p>
            The alternative path: the structural indicators are correct in their direction
            but the political constraint (Tchiani&apos;s personal position, Russia-backed
            isolation doctrine, internal CNSP disagreement) delays the manifestation by
            more than the Q4 2026 window. In that case the structural reading is
            directionally correct but the timing is wrong. QGI&apos;s historical lead
            times on the Multilateral Agreement recipe range from &minus;4 to +1 years
            (per the Bosnia dashboard data), so the window uncertainty is genuinely wide.
          </p>

          {/* Section 6 */}
          <h2
            id="what-qgi-doesnt-see"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            6. What QGI Doesn&apos;t See, and Why the Case Holds Anyway
          </h2>

          <Chart4BosniaTemplate />

          <p>
            <strong>The Russia dependency.</strong> Niger&apos;s agreement with
            Wagner/Africa Corps creates a structural incentive for continued isolation
            that QGI&apos;s indicator base cannot capture. PMC contracts do not appear in
            SIPRI arms transfer data. Russian advisory missions are not reflected in the
            sovereignty index changes that drive the diplomacy L1 dimension. The
            structural case for Niger&apos;s re-engagement trajectory competes with a
            political economy of Wagner dependence that is invisible to QGI.
          </p>
          <p>
            <strong>The AES institutional inertia.</strong> The confederation has created
            a bureaucratic and political architecture with its own momentum. Even if
            Niger&apos;s CNSP leadership wanted to pursue re-engagement, the AES framework
            creates costs for defection. These institutional dynamics are not captured in
            per-country indicator scoring.
          </p>
          <p>
            <strong>V-Dem country bias.</strong> The Voice and Accountability indicator
            (0.40 importance in Niger&apos;s Multilateral Agreement fingerprint) carries a
            &ldquo;Possible country bias&rdquo; caveat. This signals that V-Dem&apos;s
            coding methodology may produce artefactual readings in post-coup environments
            where institutional continuity is disrupted.
          </p>
          <p>
            <strong>No anchor battery.</strong> The Multilateral Agreement recipe has no
            anchored historical case for Niger itself in the current scoring run. This
            means there is no &ldquo;Niger has been here before, and the model called it
            right&rdquo; track-record statement available; the case rests on the
            recipe&apos;s cohort-wide validation, not country-specific past performance.
          </p>
          <p>
            Despite these gaps, the structural case holds for a specific reason. The
            dominant indicators driving Niger&apos;s Multilateral Agreement signal are not
            diplomatic or governance indicators. They are fiscal and demographic. Tax
            revenue trajectory (0.60 importance) and female labour force participation
            (0.53 importance) are structural conditions that persist independently of
            political alliances. They are not moved by AES membership agreements or Russia
            security protocols. They are moved by the underlying economic and demographic
            dynamics of a uranium-export economy with an extreme demographic profile. And
            those dynamics are pointing in a direction the political surface contradicts.
          </p>

          {/* Section 7 */}
          <h2
            id="implications-for-ecowas"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            7. Implications for the ECOWAS Reconstitution Debate
          </h2>
          <p>
            The structural reading has a direct diplomatic implication. The current
            consensus in AU and ECOWAS circles is that all three AES states are equally
            hostile to re-engagement and that the path to Sahel reintegration requires a
            change of regime, not a change of policy.
          </p>
          <p>
            QGI&apos;s structural reading suggests this consensus may be wrong for Niger
            specifically. If Niger&apos;s indicator trajectory is correctly reading a
            structural readiness for re-engagement, the diplomatic strategy should
            differentiate: engaging Niger&apos;s junta separately from Burkina
            Faso&apos;s, offering a structured dialogue framework that is distinct from
            full re-entry, and allowing the structural conditions to create political
            space for Tchiani&apos;s government to signal openness without losing AES
            solidarity.
          </p>
          <p>
            For a regional diplomacy that has spent two years treating the AES as a
            monolith, the recipe-level divergence is a small but concrete handhold for
            differentiated engagement.
          </p>

          {/* Pull-quote 3 */}
          <PullQuote>
            &ldquo;For a regional diplomacy that has spent two years treating the AES as a
            monolith, the recipe-level divergence is a small but concrete handhold for
            differentiated engagement.&rdquo;
          </PullQuote>

          {/* Methodology aside (E8) */}
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
                href={"/countries/niger" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Niger
              </Link>{" "}
              Risk Score 89/100 [83&ndash;94], Multilateral Agreement Precedent Match
              94/100 [84&ndash;100] #4 of 58, Elections &amp; Voting 93/100 [88&ndash;97]
              #10 of 131, Civil War &amp; Insurgency 57/100 #36 of 83 &middot;{" "}
              <Link
                href={"/countries/burkina_faso" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Burkina Faso
              </Link>{" "}
              Risk Score 90/100 [85&ndash;94], Civil War &amp; Insurgency 81/100 #16 of
              83, Multilateral Agreement 2/100 #57 of 58, Elections 59/100 &middot;{" "}
              <Link
                href={"/countries/mali" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Mali
              </Link>{" "}
              Risk Score 64/100 [56&ndash;72], Civil War 48/100 #44 of 83 &middot;
              Multilateral Agreement recipe: LOCO AUC 0.8689, ECE 0.009, N=58, STRONG
              evidence grade &middot; Niger&apos;s Multilateral Agreement indicator
              fingerprint: Tax revenue change importance 0.60, Female LFPR change 0.53,
              Voice &amp; Accountability change 0.40 (Possible country bias) &middot;
              Bosnia and Herzegovina: #1 globally on Multilateral Agreement at 99/100
              [96&ndash;100], lead times &minus;4 to +1 year &middot; Niger&shy;Burkina
              Faso cosine peer: 95% similarity on the 8-dimension L1 composite &middot;
              April 2026 scoring run (generated {BAKE_DATE}) &middot; QGI V1.9.1.
            </p>
            <p className="mb-2">
              Methodology disclosures: (1){" "}
              <strong>Wagner / Africa Corps presence is not captured.</strong> World Bank
              arms transfer indicators and SIPRI series do not reflect informal PMC
              deployments, advisory contracts, or mining-for-security exchanges. The
              re-engagement reading is conditional on these dynamics not overwhelming the
              structural substrate. (2){" "}
              <strong>
                AES confederation institutional dynamics are not scored per-country.
              </strong>{" "}
              The bloc&apos;s bureaucratic momentum creates costs for defection that QGI
              does not model. (3){" "}
              <strong>V-Dem &ldquo;Possible Country Bias&rdquo; caveat</strong> applies to
              the Voice and Accountability indicator (0.40 importance) for Niger.
              V-Dem&apos;s historical training data reflects institutional dynamics that
              map imperfectly onto junta consolidation periods. (4){" "}
              <strong>
                No <Fn n={12}>anchor battery</Fn> for Niger
              </strong>{" "}
              in the Multilateral Agreement recipe&apos;s current locked set: there is no
              prior closed Niger window where the recipe&apos;s prediction can be
              cross-checked against an actual outcome. The case rests on the recipe&apos;s
              cohort-wide LOCO validation, not country-specific past performance. (5){" "}
              <strong>The 95% cosine figure is the composite L1 cosine similarity</strong>{" "}
              on the 8-dimension risk vector and reflects regime+conflict+governance
              co-presence; the recipe-level Precedent Match scores in this piece are
              computed from a different, trend-features-based scoring path that the cosine
              peer construction does not see.
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

          {/* End-of-piece CTA (E6) */}
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
              Niger&apos;s full risk profile (salience scores, precedent matches, and
              structural peers) is at{" "}
              <Link
                href={"/countries/niger" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                qgintelligence.com/countries/niger
              </Link>
              . Burkina Faso&apos;s profile is at{" "}
              <Link
                href={"/countries/burkina_faso" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                /countries/burkina_faso
              </Link>
              . The Multilateral Agreement precedent cohort (58 countries ranked) is at{" "}
              <Link
                href={"/precedents/multilateral_agreement" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                /precedents/multilateral_agreement
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

          {/* Static footnotes list (E7) */}
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

          {/* Dateline */}
          <p
            className="text-xs mt-12 pt-6 border-t"
            style={{
              color: "var(--qgi-text-dim)",
              borderColor: "var(--qgi-border)",
            }}
          >
            Published {PUBLISH_DATE} &middot; QGI Intelligence &middot; By Amin Al-Ait
            &middot; Salience values cited from the {BAKE_DATE} V1.9.1 scoring run. This
            piece reports structural pattern resemblance and historical-analogue
            comparison. It is not a forecast.
          </p>
        </div>
      </article>
    </div>
  );
}
