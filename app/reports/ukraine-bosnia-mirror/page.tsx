import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArticleJsonLd } from "@/components/seo/ArticleJsonLd";
import Chart1CosinePeerRanking, {
  Chart1CosinePeerRankingHero,
} from "./charts/Chart1CosinePeerRanking";
import Chart2BilateralMultilateralSequence from "./charts/Chart2BilateralMultilateralSequence";
import Chart3IndicatorFingerprint from "./charts/Chart3IndicatorFingerprint";
import TocSidebar from "./TocSidebar";
import PrintButton from "./PrintButton";

/**
 * Ukraine's Structural Mirror: What Bosnia 1996 Tells the Credit Desk About UKRAIN 2027.
 *
 * R8 panel #3 (mean 27.00/30, won tie-break vs Tomás on lower std-dev). Author:
 * Dmitri Volkov, Managing Director, Volkov Capital EM Macro Fund ($1.2B AUM, NYC).
 * LP-letter / sovereign-credit register.
 *
 * Compliance: qgi-docs/internal/ops/qgi-report-guidelines.md (E1-E11, V1-V4, L1-L4).
 */

const BAKE_DATE = "2026-04-30";
const PUBLISH_DATE = "2026-05-21";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Ukraine's Structural Mirror: What Bosnia 1996 Tells the Credit Desk",
  description:
    "QG Intelligence identifies Bosnia and Herzegovina as Ukraine's #1 structural twin at 81% cosine similarity, categorically ahead of the next-closest peer cluster at 65%. A falsifiable structural-credit thesis.",
  alternates: {
    canonical: "https://qgintelligence.com/reports/ukraine-bosnia-mirror",
  },
  openGraph: {
    title:
      "Ukraine's Structural Mirror: What Bosnia 1996 Tells the Credit Desk About UKRAIN 2027",
    description:
      "Ukraine's #1 structural twin at 81% cosine is Bosnia, categorically ahead of the 65% next-closest cluster. The Bilateral → Multilateral sequence is the trade.",
    url: "https://qgintelligence.com/reports/ukraine-bosnia-mirror",
    siteName: "QG Intelligence",
    type: "article",
    publishedTime: `${PUBLISH_DATE}T00:00:00Z`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Ukraine's Closest Structural Twin: Bosnia 1996",
    description:
      "QGI places Ukraine's structural twin at Bosnia (81% cosine, 16-point gap to the next-closest cluster). A falsifiable credit thesis.",
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
    term: "cosine similarity",
    def: "A geometric measure of how similar two countries' 8-dimension L1 risk vectors are, regardless of scale; 81% cosine similarity means the two profiles point in nearly the same direction across all active dimensions.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 3,
    term: "structural twin",
    def: "The country whose current L1 risk profile most closely matches another's by cosine similarity within the QGI cohort; not a synonym for an economic peer or political ally.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 4,
    term: "8-dimensional decomposition",
    def: "The 8 master categories of QGI's L1 risk taxonomy: Political, Conflict, Governance, Economic, Social, Diplomatic, Humanitarian, Structural. Cosine similarity is computed across these dimensions.",
    anchor: "#l1-dimensions-and-peers",
  },
  {
    n: 5,
    term: "Bilateral Treaty recipe",
    def: "A per-recipe score (0–100) ranking how closely a country's current indicator trajectory resembles historical cases that preceded a bilateral treaty event, within the 127-country cohort that fires on this recipe.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 6,
    term: "Multilateral Agreement recipe",
    def: "A per-recipe score (0–100) ranking how closely a country's current indicator trajectory resembles historical cases that preceded multilateral institutionalisation, within the 58-country cohort that fires on this recipe. The highest-LOCO-AUC recipe in QGI's current locked set.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 7,
    term: "Precedent Match",
    def: "A 0–100 score expressing how close a country's current indicator trajectory is to historical precedents that preceded a specific event class.",
    anchor: "#aggregate-vs-per-recipe",
  },
  {
    n: 8,
    term: "LOCO AUC",
    def: "Leave-One-Country-Out Area Under the Curve: a cross-validation metric measuring how well the recipe discriminates countries that later experienced an event from those that did not, after removing each country from its own training set; 0.5 = chance, 1.0 = perfect.",
    anchor: "#loco-auc",
  },
  {
    n: 9,
    term: "STRONG evidence grade",
    def: "QGI's qualitative label for a LOCO AUC in the highest validated tier; the label travels with the recipe, not the country score. The Multilateral Agreement recipe carries STRONG.",
    anchor: "#loco-auc",
  },
  {
    n: 10,
    term: "MODERATE evidence grade",
    def: "QGI's label for a LOCO AUC in the mid validated tier: meaningfully above chance but not in the strongest band. The Bilateral Treaty recipe carries MODERATE.",
    anchor: "#loco-auc",
  },
  {
    n: 11,
    term: "Expected Calibration Error / ECE",
    def: "The average difference between a model's predicted probability and the actual observed event rate across score buckets; lower is better, 0 is perfect alignment.",
    anchor: "#calibration-error",
  },
  {
    n: 12,
    term: "95% CI",
    def: "A 95% bootstrap confidence interval estimated by resampling the cohort thousands of times; narrower intervals indicate more stable estimates.",
    anchor: "#bootstrap-ci",
  },
  {
    n: 13,
    term: "Tier HIGH / INDICATIVE",
    def: "Country-level severity labels assigned based on maximum salience across all patterns; HIGH requires sustained cross-category signal strength, INDICATIVE is a sub-MODERATE band.",
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

export default function UkraineBosniaMirrorReportPage() {
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
        headline="Ukraine's Structural Mirror: What Bosnia 1996 Tells the Credit Desk About UKRAIN 2027"
        description="QGI identifies Bosnia as Ukraine's #1 structural twin at 81% cosine similarity, 16 percentage points ahead of the next-closest peer cluster."
        url="https://qgintelligence.com/reports/ukraine-bosnia-mirror"
        datePublished={`${PUBLISH_DATE}T00:00:00Z`}
        imageUrl="https://qgintelligence.com/reports/ukraine-bosnia-mirror/opengraph-image"
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
            Sovereign Credit Note · Published {PUBLISH_DATE}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight mb-4">
            Ukraine&apos;s Structural Mirror: What Bosnia 1996 Tells the Credit Desk About
            UKRAIN 2027
          </h1>
          <p className="text-xs mb-1" style={{ color: "var(--qgi-text-dim)" }}>
            By Amin Al-Ait · Scoring date: {BAKE_DATE} · QGI V1.9.1
          </p>
          <p
            className="text-[11px] tracking-wide uppercase"
            style={{ color: "var(--qgi-text-muted)", fontVariant: "small-caps" }}
          >
            ~7 min read · April 2026 scoring run
          </p>
        </div>

        {/* Hero */}
        <div className="mb-8">
          <Chart1CosinePeerRankingHero />
          <p
            className="mt-1 text-xs text-center"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Ukraine&apos;s top-5 cosine peers, April 2026 scoring run: Bosnia 81%
            categorically ahead of the next-closest cluster at 65%. Source: QGI
            computation.
          </p>
        </div>

        <div
          className="prose-qgi text-sm sm:text-base leading-relaxed space-y-5"
          style={{ color: "var(--qgi-text)" }}
        >
          {/* Soft-landing intro */}
          <p>
            The standard Ukraine sovereign credit frame is by now well rehearsed. War
            premium. Reconstruction liability. IMF program integrity. The 2022 default and
            2024 restructuring. The JPMorgan EMBI exclusion and its implications for
            passive flows. Every fixed-income desk in New York and London is running some
            version of this model.
          </p>
          <p>
            What no sell-side desk has done, because the comparison requires machinery
            conventional research lacks, is ask which country&apos;s historical indicator
            trajectory most closely resembles Ukraine&apos;s current structural
            fingerprint. Not which country faces similar geopolitical risk. Not which peer
            sovereign defaulted and recovered on a comparable timeline. Which country,
            across the full <Fn n={4}>8-dimensional decomposition</Fn> of political,
            conflict, governance, economic, social, diplomatic, humanitarian, and
            structural indicators, looks most like Ukraine in April 2026.
          </p>
          <p>
            According to QG Intelligence&apos;s <Fn n={1}>April 2026 scoring run</Fn>, the
            answer is{" "}
            <Link
              href={"/countries/bosnia_and_herzegovina" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-accent)" }}
            >
              Bosnia and Herzegovina
            </Link>
            . The <Fn n={2}>cosine similarity</Fn> is 81%, a 16-percentage-point gap above
            the next-closest peer.
          </p>

          {/* Section 1 */}
          <h2
            id="the-categorical-peer"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            1. The Categorical Peer
          </h2>
          <p>
            Ukraine&apos;s second through fifth <Fn n={3}>structural twins</Fn> (Oman, Sri
            Lanka, T&uuml;rkiye, Uzbekistan) all cluster at 65%. Bosnia is not marginally
            ahead. It is categorically in a different league as Ukraine&apos;s structural
            comparator. The relationship is bidirectional: navigate to Bosnia&apos;s
            profile and Ukraine appears as Bosnia&apos;s #1 structural twin at the same
            81% figure.
          </p>

          <Chart1CosinePeerRanking />

          {/* Section 2 */}
          <h2
            id="bosnia-template"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            2. The Bosnia Template Has a Credit History
          </h2>
          <p>
            Bosnia in 1996 was a post-Dayton state emerging from a devastating conflict.
            By 2000, it had executed a multilateral framework that locked in institutional
            architecture, the OHR, the IMF program, the World Bank reconstruction
            facility, the EU Stabilisation and Association process, that produced
            sustained spread compression on its sovereign obligations over the subsequent
            decade.
          </p>
          <p>
            The structural preconditions for that transition, as QGI&apos;s model reads
            them, were fiscal trajectory recovery (tax revenue growth), labour market
            normalisation (female labour force participation recovery), and governance
            improvement (Voice and Accountability trajectory). These are the three
            highest-importance indicators in QGI&apos;s{" "}
            <Fn n={6}>Multilateral Agreement recipe</Fn>, the system&apos;s strongest
            validated recipe (<Fn n={8}>LOCO AUC</Fn> 0.8689,{" "}
            <Fn n={11}>Expected Calibration Error</Fn> 0.009,{" "}
            <Fn n={9}>STRONG evidence grade</Fn>).
          </p>
          <p>
            Bosnia today scores <Fn n={7}>99/100</Fn> [<Fn n={12}>95% CI</Fn>{" "}
            96&ndash;100] on that recipe, ranking #1 in the 58-country multilateral
            agreement cohort. The model has finished its read on Bosnia: the trajectory
            features that historically precede multilateral institutionalisation are, for
            Bosnia, fully resolved. Bosnia is at the end of the pattern, not the
            beginning.
          </p>

          {/* Pull-quote 1 */}
          <PullQuote>
            &ldquo;Bosnia is at the end of the pattern, not the beginning. Ukraine is at
            the beginning.&rdquo;
          </PullQuote>

          {/* Section 3 */}
          <h2
            id="what-qgi-shows-for-ukraine"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            3. What the QGI Data Actually Shows for Ukraine
          </h2>
          <p>
            Ukraine&apos;s current QGI profile is dominated by Civil War and Insurgency:
            93/100 [88&ndash;98], #6 of 83 countries in that recipe&apos;s cohort. That is
            the expected reading for an active conflict state. What is not expected is the{" "}
            <Fn n={5}>Bilateral Treaty recipe</Fn> signal also firing at 95/100
            [91&ndash;98], ranking Ukraine #7 of 127 countries in that cohort.
          </p>

          <Chart3IndicatorFingerprint />

          <p>
            The Bilateral Treaty recipe&apos;s mechanism is defined in its dossier as: the
            change in diplomatic posture matters more than the absolute relations level.
            The recipe&apos;s highest-importance indicators are population change
            (importance weight 0.53), employment ratio change (0.42), and mobile cellular
            subscriptions change (0.38). These are not diplomatic variables. They are
            demographic and economic trajectory variables. The model is reading
            Ukraine&apos;s structural economic momentum, the displacement-and-return of
            population, the employment shock, the telecom infrastructure rebuild, and
            matching it to historical patterns that preceded bilateral treaty engagement.
            The war is not blocking the structural signal. It is part of the indicator
            signature the model has learned to associate with this trajectory.
          </p>
          <p>
            The Multilateral Agreement signal for Ukraine is currently flat: 51/100
            [33&ndash;70], ranking #29 of 58. The 37-point confidence interval is the
            honest disclosure. The model is genuinely uncertain about Ukraine&apos;s
            multilateral agreement trajectory. That uncertainty is the asymmetric
            opportunity.
          </p>

          {/* Section 4 */}
          <h2
            id="the-bilateral-multilateral-sequence"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            4. The Bilateral → Multilateral Sequence
          </h2>
          <p>
            Bosnia&apos;s path produced: Bilateral Treaty signals first (structural
            diplomatic warming), Multilateral Agreement signals second (institutionalised
            framework locked in). Ukraine is currently in the bilateral treaty phase. The
            structural question is whether the multilateral agreement phase will follow.
          </p>

          <Chart2BilateralMultilateralSequence />

          {/* Section 5 */}
          <h2
            id="forward-call-and-falsification"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            5. The Forward Call and the Falsification Anchor
          </h2>
          <p>
            The falsifiable forward call: if Ukraine&apos;s Multilateral Agreement ML
            Precedent Match score (currently 51/100) crosses above 70/100 in the January
            2027 or April 2027 scoring run, the Bosnia structural template is actively
            reproducing in Ukraine&apos;s indicator data. That is the trigger for adding
            credit risk in UKRAIN bonds.
          </p>
          <p>
            The falsification event: if Ukraine&apos;s Multilateral Agreement score
            remains below 60/100 and the confidence interval does not narrow through the
            next two scoring runs, the Bosnia path is not activating. At that point, the
            structural case for spread compression does not have QGI&apos;s structural
            validation, and the position should be closed or sized down.
          </p>

          {/* Pull-quote 2 — verbatim from Section 4 prose. */}
          <PullQuote>
            &ldquo;Ukraine is currently in the bilateral treaty phase. The structural
            question is whether the multilateral agreement phase will follow.&rdquo;
          </PullQuote>

          <p>
            The current UKRAIN 2028 bonds trade at approximately 800&ndash;850 basis
            points over UST equivalents. Bosnia&apos;s post-Dayton equivalent spread
            (proxied through IBRD lending spreads, since BiH did not access markets until
            1997) compressed by roughly 300&ndash;400 basis points over the 24 months
            following the Multilateral Agreement signal reaching full strength in the
            indicator data. The recovery-bond analog, the GDP-linked warrants Ukraine
            issued in the 2024 restructuring, is the instrument most directly sensitive to
            this structural transition, as its payoff function is explicitly tied to
            Ukrainian GDP growth exceeding 3% over a sustained period, which is itself the
            output of the institutionalisation trajectory the Bosnia template describes.
          </p>

          {/* Section 6 */}
          <h2
            id="three-structural-caveats"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            6. Three Structural Caveats the Desk Must Hold
          </h2>
          <p>
            <strong>First, Russia also scores in the top-10.</strong> Russia is #6 on the
            Multilateral Agreement recipe at 91/100. The recipe is reading both
            combatants&apos; indicator trajectories as structurally consistent with a
            multilateral engagement pathway. This does not invalidate the Ukraine thesis.
            It may mean the recipe is detecting a bilateral-to-multilateral negotiation
            trajectory that both parties are on simultaneously. But it complicates a
            simple &ldquo;Ukraine stabilises, Russia doesn&apos;t&rdquo; framing.
          </p>
          <p>
            <strong>
              Second, the Bilateral Treaty recipe carries a Colombia training
              concentration.
            </strong>{" "}
            The Bilateral Treaty recipe has a 25% training concentration in Colombia,
            whose 2016 peace process dominates the training data. Ukraine&apos;s
            95th-percentile bilateral treaty score is partially driven by the model having
            learned Colombia&apos;s post-conflict structural signature. The signal is
            directionally informative but the calibration carries the Colombia caveat as
            disclosed in the recipe dossier. The recipe&apos;s overall validation tier is{" "}
            <Fn n={10}>MODERATE</Fn>, not STRONG.
          </p>
          <p>
            <strong>Third, the data vintage runs through approximately 2024.</strong> The
            structural indicators underlying these scores are annual series with data
            vintage through approximately 2024. The scoring run is April 2026 but much of
            the underlying economic and governance data reflects a 2024 reality.
            Ukraine&apos;s 2025 economic trajectory, particularly whether the IMF program
            disbursements have normalised fiscal flows and whether labour market data
            shows the post-mobilisation adjustment, may not yet be fully captured. The
            next scoring run (expected summer 2026) is the model&apos;s first opportunity
            to incorporate 2025 data in meaningful volume.
          </p>

          {/* Section 7 */}
          <h2
            id="what-the-desk-gets-that-bloomberg-cannot"
            className="text-xl sm:text-2xl font-semibold mt-10 mb-3"
          >
            7. What QGI Gives the Desk That Bloomberg and Sell-Side Cannot
          </h2>
          <p>
            A Bloomberg analyst could tell you that Ukraine restructured its debt in 2024
            and that the IMF program is currently in its fourth review. An area-studies
            specialist could describe Bosnia&apos;s post-Dayton institutionalisation in
            detail. A sell-side EM credit strategist could model Ukrainian GDP recovery
            scenarios.
          </p>
          <p>
            None of them would identify Bosnia as Ukraine&apos;s closest structural
            analogue across 156 countries. None would produce the specific falsifiable
            trigger, Ukraine&apos;s Multilateral Agreement ML score crossing 70/100, as
            the credit-event equivalent of the Bosnia template activating. None would
            connect the Bilateral Treaty signal (95th percentile, #7 globally) to the
            structural sequence that historically precedes multilateral framework lock-in.
          </p>

          {/* Pull-quote 3 — verbatim from Section 7 prose. */}
          <PullQuote>
            &ldquo;None would produce the specific falsifiable trigger, Ukraine&apos;s
            Multilateral Agreement ML score crossing 70/100, as the credit-event
            equivalent of the Bosnia template activating.&rdquo;
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
                href={"/countries/ukraine" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Ukraine
              </Link>{" "}
              QGI Risk Score 96/100 [94&ndash;99], <Fn n={13}>Tier HIGH</Fn>; Civil War
              &amp; Insurgency 93/100 [88&ndash;98] #6 of 83; Bilateral Treaty 95/100
              [91&ndash;98] #7 of 127; Multilateral Agreement 51/100 [33&ndash;70] #29 of
              58 &middot;{" "}
              <Link
                href={"/countries/bosnia_and_herzegovina" as Route}
                className="underline underline-offset-2"
                style={{ color: "var(--qgi-accent)" }}
              >
                Bosnia and Herzegovina
              </Link>{" "}
              QGI Risk Score 41/100 [34&ndash;49], Tier INDICATIVE; Multilateral Agreement
              99/100 [96&ndash;100] #1 of 58 &middot; Russia Multilateral Agreement 91/100
              #6 of 58 &middot; Ukraine&shy;Bosnia composite cosine similarity 81% on the
              8-dimension L1 risk profile (bidirectional, each other&apos;s #1 structural
              twin); next-closest peer cluster (Oman, Sri Lanka, T&uuml;rkiye, Uzbekistan)
              at ~65% &middot; Multilateral Agreement recipe LOCO AUC 0.8689, ECE 0.009,
              STRONG evidence grade &middot; Bilateral Treaty recipe LOCO AUC 0.6681,
              MODERATE evidence grade, with disclosed 25% training-concentration in
              Colombia (2016 peace process) &middot; Bilateral Treaty top indicators:
              population change (0.53), employment ratio change (0.42), mobile cellular
              subscriptions change (0.38) &middot; April 2026 scoring run (generated{" "}
              {BAKE_DATE}) &middot; QGI V1.9.1.
            </p>
            <p className="mb-2">
              Methodology disclosures: (1){" "}
              <strong>
                Russia is in the top-10 of the Multilateral Agreement cohort.
              </strong>{" "}
              Recipe may be detecting a bilateral-to-multilateral negotiation trajectory
              both combatants are on simultaneously; the Ukraine reading is not contingent
              on a Russian collapse. (2){" "}
              <strong>Bilateral Treaty recipe Colombia training concentration.</strong>{" "}
              25% of the recipe&apos;s training instances come from Colombia&apos;s 2016
              peace-process episode; Ukraine&apos;s 95-percentile signal is partially
              driven by the model having learned Colombia&apos;s post-conflict structural
              signature. Recipe validation tier is MODERATE, not STRONG. (3){" "}
              <strong>Data vintage through ~2024.</strong> Underlying annual series are
              through approximately 2024 even though the scoring run is April 2026; the
              next scoring run (expected summer 2026) is the first opportunity to
              incorporate 2025 data in volume. (4){" "}
              <strong>
                Spread figures are draft author estimates, not QGI-computed outputs.
              </strong>{" "}
              The UKRAIN 2028 ~800&ndash;850 bps and the post-Dayton ~300&ndash;400 bps
              compression figures are the author&apos;s market estimates referenced here
              for context. Treat as directional. (5){" "}
              <strong>
                This piece is structural pattern analysis, not investment advice.
              </strong>
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
              Ukraine&apos;s full risk profile is at{" "}
              <Link
                href={"/countries/ukraine" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                qgintelligence.com/countries/ukraine
              </Link>
              ; Bosnia&apos;s at{" "}
              <Link
                href={"/countries/bosnia_and_herzegovina" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                /countries/bosnia_and_herzegovina
              </Link>
              . Recipe dossiers:{" "}
              <Link
                href={"/precedents/bilateral_treaty" as Route}
                className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
                style={{ color: "var(--qgi-accent)" }}
              >
                /precedents/bilateral_treaty
              </Link>{" "}
              and{" "}
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
              . If your fund or institution would like to commission structural credit
              analysis on a specific sovereign, or discuss access to QGI&apos;s full
              dataset and signal tracking, write to{" "}
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
            &middot; Scores cited from the {BAKE_DATE} V1.9.1 scoring run. This piece
            reports structural pattern resemblance and historical-analogue comparison. It
            is not a forecast.
          </p>
        </div>
      </article>
    </div>
  );
}
