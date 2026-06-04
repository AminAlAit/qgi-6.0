/**
 * /patterns/[slug] — per-pair detail, rich layout, zero mocks.
 *
 * Data sources (real):
 *   - getPairBySlug  → catalogue scalars (country names, ISO2, corr,
 *     window_length, start_year_a/b, num_indexes, pps, tier, predicted)
 *   - getCatalogue   → rank within catalogue
 *   - loadPairWindows → top-window list + length histogram (scalar only —
 *     no composite time-series)
 *
 * Honest placeholders (real data absent, next data release):
 *   - PairShapeOverlayPanel — composite z-score series not in pair-windows;
 *     arrives with the cascade SCDI bake (pattern-scdis.json)
 *   - PairIndicatorsPanel  — per-indicator breakdown needs pattern-scdis.json
 *   - PairDecadesPanel     — decade mini-charts need composite series
 *   - PairTodayPanel       — present-day TE recipe data not wired to cascade
 *     pairs; country profile links are available via /countries/{iso2}
 *
 * Tour anchors:
 *   - data-tour="pair-header"        PairHeader component (line ~90)
 *   - data-tour="pair-summary"       PairSummaryPanel component (line ~103)
 *   - data-tour="pair-shape-overlay" placeholder section (line ~143)
 *   - data-tour="pair-indicators"    placeholder section (line ~175)
 *
 * 2026-06-04 rebuild — rich pair-detail layout, zero-mock, honest placeholders.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPairBySlug, getCatalogue } from "@/lib/cascade-patterns/patterns-data";
import { loadPairWindows } from "@/lib/cascade-patterns/pair-windows";
import { PairHeader } from "@/components/patterns-v4-pair-detail/PairHeader";
import { PairSummaryPanel } from "@/components/patterns-v4-pair-detail/PairSummaryPanel";
import { PairHandoffsFooter } from "@/components/patterns-v4-pair-detail/PairHandoffsFooter";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const pair = getPairBySlug(slug);
  return {
    title: pair
      ? `${pair.country_a} & ${pair.country_b} · Pattern · QG Intelligence`
      : "Pattern not found · QG Intelligence",
    description: pair
      ? `${pair.country_a} and ${pair.country_b}: a ${pair.window_length}-year structural parallel (correlation ${pair.corr.toFixed(2)}).`
      : "Pattern not found.",
  };
}

/** Styled heading for placeholder panels — keeps the visual language consistent. */
function PanelHeading({ label, title }: { label: string; title: string }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "1.6px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "4px",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <h2
        style={{
          fontSize: "15px",
          fontWeight: 700,
          margin: 0,
          color: "var(--qgi-text)",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

/** Card wrapper matching the dark-surface visual system used by rich components. */
function PanelCard({
  children,
  dataTour,
}: {
  children: React.ReactNode;
  dataTour?: string;
}) {
  return (
    <div
      data-tour={dataTour}
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "10px",
        padding: "20px 22px",
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  );
}

/** Dashed pending-data placeholder body used across several panels. */
function PendingNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "13px",
        color: "var(--qgi-text-muted)",
        margin: 0,
        lineHeight: 1.65,
        fontStyle: "italic",
        borderTop: "1px dashed var(--qgi-border)",
        paddingTop: "12px",
        marginTop: "4px",
      }}
    >
      {children}
    </p>
  );
}

export default async function PatternDetailPage({ params }: Params) {
  const { slug } = await params;
  const pair = getPairBySlug(slug);
  if (!pair) notFound();

  // Catalogue rank (1-indexed, sorted by PPS descending)
  const catalogue = getCatalogue();
  const rankIdx = catalogue.findIndex((e) => e.slug === slug);
  const catalogueRank = rankIdx >= 0 ? rankIdx + 1 : null;
  const catalogueSize = catalogue.length;

  // Load pair-windows to check whether we have extra window metadata.
  // The top[] array holds scalar window records (l, sa, sb, ic, ac, pps) —
  // NO composite time-series. We use the best window's start years to confirm
  // / supplement the catalogue start years.
  const pairWindows = await loadPairWindows(pair.country_a_id, pair.country_b_id);
  const bestWindow = pairWindows?.top[0] ?? null;

  // Prefer start years from the catalogue (getCatalogue already picks the
  // best-PPS window). If start_year_a is 0 (partners-index fallback has 0),
  // use the pair-windows best window's start years.
  const startYearA = pair.start_year_a > 0 ? pair.start_year_a : (bestWindow?.sa ?? 0);
  const startYearB = pair.start_year_b > 0 ? pair.start_year_b : (bestWindow?.sb ?? 0);

  // Canonical shared start year for the header title (use the earlier of the two).
  const sharedStartYear =
    startYearA > 0 && startYearB > 0
      ? Math.min(startYearA, startYearB)
      : startYearA || startYearB || 0;
  const endYear = sharedStartYear > 0 ? sharedStartYear + pair.window_length - 1 : 0;

  // Window length display — prefer pair catalogue value; fall back to best window.
  const windowLength = pair.window_length > 0 ? pair.window_length : (bestWindow?.l ?? 0);

  // Indicator count — prefer catalogue; best window has ic (index count).
  const numIndexes = pair.num_indexes > 0 ? pair.num_indexes : (bestWindow?.ic ?? 0);

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* §1 Header — REAL DATA */}
        <PairHeader
          countryA={pair.country_a}
          countryB={pair.country_b}
          iso2A={pair.country_a_a2}
          iso2B={pair.country_b_a2}
          startYear={sharedStartYear}
          endYear={endYear}
          windowLength={windowLength}
          sharedIndicatorCount={numIndexes}
        />

        {/* §2 Summary panel — REAL DATA
            catalogueRank: position in getCatalogue() sorted by PPS.
            catalogueSize: total catalogue entries.
            startYear/endYear/windowLength: from catalogue + pair-windows.
            sharedIndicatorCount: from catalogue (num_indexes).
            correlation: real Pearson r over the best shared window.
        */}
        <PairSummaryPanel
          catalogueRank={catalogueRank ?? 0}
          catalogueSize={catalogueSize}
          startYear={sharedStartYear}
          endYear={endYear}
          windowLength={windowLength}
          sharedIndicatorCount={numIndexes}
          correlation={pair.corr}
        />

        {/* §3 Shape overlay — HONEST PLACEHOLDER
            The composite z-score series for each country's indicator trajectory
            over the shared window is produced by the cascade SCDI batch
            (pattern-scdis.json). That file has not landed yet. The pair-windows
            files hold only scalar window metadata — no per-year series. */}
        <PanelCard dataTour="pair-shape-overlay">
          <PanelHeading
            label="SHAPE OVERLAY"
            title={`Indicator-composite trajectory, ${sharedStartYear}–${endYear}`}
          />
          <PendingNote>
            The aligned indicator-composite trajectories for this pair are computed by the
            cascade SCDI batch and arrive with the next data release. We show the overlay
            only once the series are real.
          </PendingNote>
        </PanelCard>

        {/* §4 Indicators breakdown — HONEST PLACEHOLDER
            Per-indicator decomposition (which indicators ran in parallel, with
            their z-scored series and crossing-year facts) requires pattern-scdis.json
            which has not landed yet. */}
        <PanelCard dataTour="pair-indicators">
          <PanelHeading
            label="SHARED INDICATORS"
            title="What the resemblance was made of"
          />
          <p
            style={{
              fontSize: "12px",
              color: "var(--qgi-text-dim)",
              margin: "0 0 12px",
              lineHeight: 1.5,
              maxWidth: "640px",
            }}
          >
            {pair.country_a} and {pair.country_b} share resemblance across{" "}
            {numIndexes > 0 ? `${numIndexes} indicators` : "multiple indicators"} in this
            window (Pearson r&nbsp;=&nbsp;{pair.corr.toFixed(3)}).
          </p>
          <PendingNote>
            The per-indicator decomposition — which specific indicators tracked together,
            with their aligned series and crossing-year facts — is computed by the cascade
            SCDI batch and arrives with the next data release.
          </PendingNote>
        </PanelCard>

        {/* §5 Decades panel — HONEST PLACEHOLDER
            Decade-by-decade mini-charts require the composite z-score series. */}
        <PanelCard>
          <PanelHeading
            label="DECADE BY DECADE"
            title="How the resemblance held across the window"
          />
          <PendingNote>
            Decade mini-charts require the indicator-composite series and arrive with the
            next data release.
          </PendingNote>
        </PanelCard>

        {/* §6 Both countries today — HONEST PLACEHOLDER (country profile links are real)
            The "today" panel in the rich design surfaces each country's strongest
            TE recipe match and its catalogue rank. That data lives in the TE score
            pipeline (country-recipe-scores.json), not in the cascade pair catalogue.
            We link to each country's profile page where the full TE picture lives. */}
        <PanelCard>
          <PanelHeading
            label="BOTH COUNTRIES TODAY"
            title="Where each country stands now"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginTop: "4px",
            }}
          >
            <CountryProfileLink countryName={pair.country_a} iso2={pair.country_a_a2} />
            <CountryProfileLink countryName={pair.country_b} iso2={pair.country_b_a2} />
          </div>
          <p
            style={{
              fontSize: "11px",
              color: "var(--qgi-text-dim)",
              margin: "12px 0 0",
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            Each card links to its country profile. Present-day trend scores for these
            countries are on their profile pages. The pair page does not synthesize a
            present-day claim from the historical resemblance.
          </p>
        </PanelCard>

        {/* §7 Handoffs footer — REAL DATA */}
        <PairHandoffsFooter
          countryA={pair.country_a}
          countryB={pair.country_b}
          iso2A={pair.country_a_a2}
          iso2B={pair.country_b_a2}
        />

        <footer
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Structural resemblance across the shared window. Not a forecast.
        </footer>
      </div>
    </div>
  );
}

/**
 * Minimal country-profile link card for the "Both countries today" section.
 * Uses only real data: country name + ISO2 (from CatalogueEntry).
 * Does NOT fabricate recipe labels or ranks.
 */
function CountryProfileLink({
  countryName,
  iso2,
}: {
  countryName: string;
  iso2: string;
}) {
  // Import inline to keep the component co-located in the page file.
  // We pull FlagImg and the flag helper here — same approach as current page.
  return (
    <a
      href={`/countries/${iso2.toLowerCase()}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          background: "var(--qgi-bg)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "8px",
          padding: "16px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--qgi-text)",
            marginBottom: "8px",
          }}
        >
          {countryName}
        </div>
        <span
          style={{
            fontSize: "10px",
            color: "var(--qgi-accent)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
          }}
        >
          Open country profile &rarr;
        </span>
      </div>
    </a>
  );
}
