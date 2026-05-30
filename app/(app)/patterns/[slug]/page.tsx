/**
 * /patterns/[slug] — Pair detail page.
 *
 * V4.1 full redesign 2026-05-30.
 * Majles-directed (Sara Ahmed layout + Selene Rao copy + Sard arbitration):
 *   Hero: both flags + names, PPS gradient score with bold glow, tier badge,
 *         correlation, window length, breadcrumb.
 *   Panel A "Pair profile" — key stats in a clean grid, 1-sentence rationale.
 *   Panel B "Window history" — every window sorted by PPS, table + mini-bars.
 *   Panel C "Other partners" — top-5 other partners for each country.
 *
 * Accent colours (Sard): XL=#6C77E8, L=#3FA9F5, M=#3FBF8F, S=#8A7A6E.
 * Hero score uses confidenceGlowBold (recipe-card intensity).
 * British spelling throughout. No em-dashes. Flag next to every country name.
 *
 * Data flow:
 *   - pair metadata from getPairBySlug (catalogue → partners-index fallback)
 *   - window detail from loadPairWindows(idA, idB)
 *   - other-partners from getPartnersIndex() filtered to each country id
 *
 * Slug format: "{lower_id}-{higher_id}"  e.g. "15-195" = Azerbaijan + Saudi Arabia.
 */

import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Layers } from "lucide-react";
import type { CSSProperties } from "react";
import {
  getCatalogue,
  getPairBySlug,
  getPartnersIndex,
  getCascadeVintage,
} from "@/lib/cascade-patterns/patterns-data";
import { loadPairWindows } from "@/lib/cascade-patterns/pair-windows";
import type { WindowEntry } from "@/lib/cascade-patterns/pair-windows";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import {
  MUTED_GRAY,
  confidenceT,
  lerpHexToRgb,
  confidenceGlow,
  confidenceGlowBold,
} from "@/lib/color-lerp";
import { TierBadge } from "@/components/patterns-v4/PatternsSearch";
import type { CatalogueEntry } from "@/lib/cascade-patterns/patterns-data";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CALM_SLATE = "#5B7E99";

const TIER_ACCENT: Record<string, string> = {
  XL: "#6C77E8",
  L: "#3FA9F5",
  M: "#3FBF8F",
  S: "#8A7A6E",
};

// ---------------------------------------------------------------------------
// Static params + metadata
// ---------------------------------------------------------------------------

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const catalogue = getCatalogue();
  const slugs = new Set(["15-195", ...catalogue.map((e) => e.slug)]);
  return Array.from(slugs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const pair = getPairBySlug(slug);
  if (!pair) {
    return {
      title: `Pair detail · ${slug} · QG Intelligence`,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${pair.country_a} + ${pair.country_b} · Pair Patterns · QG Intelligence`,
    description: `${pair.country_a} and ${pair.country_b} ran in parallel for ${pair.window_length} years. Correlation ${pair.corr.toFixed(3)}, Pattern Power Score ${Math.round(pair.pps)}.`,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PairDetailPage({ params }: Params) {
  const { slug } = await params;
  const pair = getPairBySlug(slug);
  const vintage = getCascadeVintage();

  if (!pair) return <NotFound slug={slug} />;

  // Window data
  const windows = await loadPairWindows(pair.country_a_id, pair.country_b_id);
  const allWindows = windows?.top ?? [];
  const topWindow = allWindows[0] ?? null;

  // Colour derived from tier
  const accent = TIER_ACCENT[pair.tier] ?? CALM_SLATE;

  // PPS gradient
  const ppsT = Math.min(1, pair.pps / 2000);
  const ppsColor = lerpHexToRgb(MUTED_GRAY, accent, ppsT);
  const ppsGlowStr = confidenceGlowBold(accent, ppsT);

  // Correlation gradient
  const corrT = confidenceT(pair.corr * 100);
  const corrColor = lerpHexToRgb(MUTED_GRAY, "#b0cfb8", corrT);
  const corrGlowStr = confidenceGlow("#b0cfb8", corrT);

  // Other partners (top-5 each side, excluding the current partner)
  const allPairs = getPartnersIndex();
  const otherPartnersA = allPairs
    .filter(
      (e) =>
        (e.country_a_id === pair.country_a_id || e.country_b_id === pair.country_a_id) &&
        e.slug !== pair.slug
    )
    .slice(0, 5);
  const otherPartnersB = allPairs
    .filter(
      (e) =>
        (e.country_a_id === pair.country_b_id || e.country_b_id === pair.country_b_id) &&
        e.slug !== pair.slug
    )
    .slice(0, 5);

  // Best rationale sentence (data-driven, not confabulated)
  const bestWindow = topWindow;
  const rationaleEndYear = bestWindow
    ? bestWindow.sa + bestWindow.l - 1
    : pair.start_year_a + pair.window_length - 1;

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-dim)",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Link
            href={"/patterns" as Route}
            style={{ color: CALM_SLATE, textDecoration: "none" }}
          >
            Pair patterns
          </Link>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ opacity: 0.7 }}>
            {pair.country_a} + {pair.country_b}
          </span>
        </nav>

        {/* Eyebrow */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: accent,
            fontSize: "10px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "16px",
          }}
        >
          <Layers size={12} strokeWidth={2} />
          Pair pattern
        </div>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <header
          style={{
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderLeft: `4px solid ${accent}`,
            borderRadius: "8px",
            padding: "22px 24px 20px",
            marginBottom: "24px",
          }}
        >
          {/* Country pair names */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >
            <CountryHeroName country={pair.country_a} a2={pair.country_a_a2} />
            <span
              style={{
                fontSize: "24px",
                color: "var(--qgi-text-dim)",
                fontWeight: 300,
                lineHeight: 1,
              }}
            >
              +
            </span>
            <CountryHeroName country={pair.country_b} a2={pair.country_b_a2} />
          </div>

          {/* Score row */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            {/* PPS — big gradient number */}
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.6px",
                  marginBottom: "3px",
                }}
              >
                Pattern Power Score
              </div>
              <span
                style={{
                  fontSize: "clamp(36px, 5vw, 52px)",
                  fontWeight: 800,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "-2px",
                  lineHeight: 1,
                  color: ppsColor,
                  textShadow: ppsGlowStr || undefined,
                }}
              >
                {Math.round(pair.pps)}
              </span>
            </div>

            {/* Divider */}
            <div
              style={{
                width: "1px",
                height: "44px",
                background: "var(--qgi-border)",
                alignSelf: "center",
                flexShrink: 0,
              }}
            />

            {/* Correlation */}
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.6px",
                  marginBottom: "3px",
                }}
              >
                Correlation
              </div>
              <span
                style={{
                  fontSize: "clamp(22px, 3vw, 32px)",
                  fontWeight: 800,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "-1px",
                  lineHeight: 1,
                  color: corrColor,
                  textShadow: corrGlowStr || undefined,
                }}
              >
                {pair.corr.toFixed(3)}
              </span>
            </div>

            {/* Divider */}
            <div
              style={{
                width: "1px",
                height: "44px",
                background: "var(--qgi-border)",
                alignSelf: "center",
                flexShrink: 0,
              }}
            />

            {/* Window + tier row */}
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.6px",
                  marginBottom: "3px",
                }}
              >
                Best window
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "clamp(18px, 2.5vw, 26px)",
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                    color: "var(--qgi-text)",
                  }}
                >
                  {pair.window_length}y
                </span>
                <TierBadge tier={pair.tier} />
              </div>
            </div>

            {/* Shared indicators */}
            {pair.num_indexes > 0 && (
              <>
                <div
                  style={{
                    width: "1px",
                    height: "44px",
                    background: "var(--qgi-border)",
                    alignSelf: "center",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--qgi-text-dim)",
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.6px",
                      marginBottom: "3px",
                    }}
                  >
                    Shared indicators
                  </div>
                  <span
                    style={{
                      fontSize: "clamp(18px, 2.5vw, 26px)",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "-0.5px",
                      lineHeight: 1,
                      color: "var(--qgi-text)",
                    }}
                  >
                    {pair.num_indexes}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Vintage stamp */}
          <div
            style={{
              marginTop: "16px",
              fontSize: "10.5px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
            }}
          >
            Cascade vintage: {vintage.label}
            {pair.predicted && (
              <span
                style={{
                  marginLeft: "10px",
                  color: "#3FBF8F",
                  fontSize: "10px",
                }}
              >
                Active 2026 signal
              </span>
            )}
          </div>
        </header>

        {/* ── Panel A: Pair profile ──────────────────────────────────── */}
        <PanelShell
          title="Pair profile"
          accent={accent}
          caption={buildPairCaption(pair, topWindow, rationaleEndYear)}
          style={{ marginBottom: "16px" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            {pair.start_year_a > 0 && (
              <StatCell label="Window start A" value={`${pair.start_year_a}`} />
            )}
            {pair.start_year_b > 0 && (
              <StatCell label="Window start B" value={`${pair.start_year_b}`} />
            )}
            {pair.start_year_a > 0 && (
              <StatCell label="Window ends" value={`~${rationaleEndYear}`} />
            )}
            <StatCell label="Length" value={`${pair.window_length} years`} />
            <StatCell
              label="Correlation"
              value={`${(pair.corr * 100).toFixed(1)}%`}
              valueColor={corrColor}
            />
            <StatCell
              label="PPS"
              value={`${Math.round(pair.pps)}`}
              valueColor={ppsColor}
            />
            {pair.num_indexes > 0 && (
              <StatCell label="Indicators" value={`${pair.num_indexes}`} />
            )}
            <StatCell label="Tier" valueNode={<TierBadge tier={pair.tier} />} />
          </div>
        </PanelShell>

        {/* ── Panel B: Window history ────────────────────────────────── */}
        {allWindows.length > 0 && (
          <PanelShell
            title="Window history"
            accent={CALM_SLATE}
            caption={`Every sliding window found for this pair, ranked by Pattern Power Score. ${allWindows.length} windows total — the best of these determines the pair's tier.`}
            style={{ marginBottom: "16px" }}
          >
            <WindowTable
              windows={allWindows}
              countryA={pair.country_a}
              countryB={pair.country_b}
              accent={accent}
            />
          </PanelShell>
        )}

        {/* ── Panel C: Other partners ────────────────────────────────── */}
        {(otherPartnersA.length > 0 || otherPartnersB.length > 0) && (
          <PanelShell
            title="Other partners"
            accent={CALM_SLATE}
            caption="Top structural partners for each country beyond this pair. Ranked by Pattern Power Score."
            style={{ marginBottom: "16px" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              {/* Country A partners */}
              {otherPartnersA.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: "ui-monospace, monospace",
                      color: "var(--qgi-text-muted)",
                      letterSpacing: "0.4px",
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FlagImg
                      emoji={flagFor(pair.country_a)}
                      name={pair.country_a}
                      width={14}
                      radius={2}
                    />
                    {pair.country_a}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {otherPartnersA.map((p) => (
                      <PartnerMiniCard
                        key={p.slug}
                        entry={p}
                        subjectId={pair.country_a_id}
                        accent={accent}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Country B partners */}
              {otherPartnersB.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: "ui-monospace, monospace",
                      color: "var(--qgi-text-muted)",
                      letterSpacing: "0.4px",
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FlagImg
                      emoji={flagFor(pair.country_b)}
                      name={pair.country_b}
                      width={14}
                      radius={2}
                    />
                    {pair.country_b}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {otherPartnersB.map((p) => (
                      <PartnerMiniCard
                        key={p.slug}
                        entry={p}
                        subjectId={pair.country_b_id}
                        accent={accent}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PanelShell>
        )}

        {/* Back link */}
        <div style={{ marginTop: "28px" }}>
          <Link
            href={"/patterns" as Route}
            style={{
              fontSize: "12px",
              color: CALM_SLATE,
              textDecoration: "none",
              fontFamily: "ui-monospace, monospace",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            Back to pair patterns
          </Link>
        </div>

        {/* Footer */}
        <footer
          style={{
            marginTop: "28px",
            paddingTop: "16px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.6,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Cascade vintage {vintage.label}. Pair ID: {slug}. Pattern Power Score and
          correlation reflect the best sliding window found in this pair.
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers — copy (Selene Rao)
// ---------------------------------------------------------------------------

function buildPairCaption(
  pair: CatalogueEntry,
  topWindow: WindowEntry | null,
  endYear: number
): string {
  const icCount = topWindow?.ic ?? pair.num_indexes;
  const startA = topWindow?.sa ?? pair.start_year_a;
  const startB = topWindow?.sb ?? pair.start_year_b;
  const corr = (pair.corr * 100).toFixed(1);

  if (startA > 0 && startB > 0) {
    const startLabel = startA === startB ? `${startA}` : `${startA} / ${startB}`;
    const icLabel = icCount > 0 ? ` across ${icCount} shared indicators` : "";
    return (
      `${pair.country_a} and ${pair.country_b} ran in close structural parallel` +
      `${icLabel}, with indicator-composite histories starting ${startLabel} and ` +
      `running through ~${endYear}. Correlation ${corr}% over a ${pair.window_length}-year window.`
    );
  }

  const icLabel = icCount > 0 ? ` across ${icCount} shared indicators` : "";
  return (
    `${pair.country_a} and ${pair.country_b} ran in close structural parallel` +
    `${icLabel} over a ${pair.window_length}-year shared window. Correlation ${corr}%.`
  );
}

function buildEmoji(a2?: string): string {
  if (!a2 || a2.length !== 2) return "";
  return String.fromCodePoint(
    ...a2
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CountryHeroName({ country, a2 }: { country: string; a2: string }) {
  const emoji = buildEmoji(a2) || flagFor(country);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "clamp(20px, 2.8vw, 30px)",
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: "-0.3px",
        color: "var(--qgi-text)",
      }}
    >
      <FlagImg emoji={emoji} name={country} width={28} radius={4} />
      {country}
    </span>
  );
}

function PanelShell({
  title,
  accent,
  caption,
  children,
  style,
}: {
  title: string;
  accent: string;
  caption?: string;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: "6px",
        padding: "16px 18px 18px",
        ...style,
      }}
    >
      <h3
        style={{
          fontSize: "13px",
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: accent,
          fontFamily: "ui-monospace, monospace",
          fontWeight: 600,
          margin: "0 0 6px",
        }}
      >
        {title}
      </h3>
      {caption && (
        <p
          style={{
            fontSize: "12px",
            lineHeight: 1.55,
            color: "var(--qgi-text-dim)",
            margin: "0 0 14px",
            maxWidth: "72ch",
          }}
        >
          {caption}
        </p>
      )}
      {children}
    </section>
  );
}

function StatCell({
  label,
  value,
  valueColor,
  valueNode,
}: {
  label: string;
  value?: string;
  valueColor?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--qgi-bg)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "5px",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: "9.5px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      {valueNode ? (
        <div style={{ lineHeight: 1 }}>{valueNode}</div>
      ) : (
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "-0.5px",
            lineHeight: 1,
            color: valueColor ?? "var(--qgi-text)",
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function WindowTable({
  windows,
  countryA,
  countryB,
  accent,
}: {
  windows: WindowEntry[];
  countryA: string;
  countryB: string;
  accent: string;
}) {
  const maxPps = Math.max(...windows.map((w) => w.pps));
  const display = windows.slice(0, 20);

  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: "4px",
        border: "1px solid var(--qgi-border)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "11.5px",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <thead>
          <tr
            style={{
              background: "var(--qgi-bg)",
              borderBottom: "1px solid var(--qgi-border)",
              color: "var(--qgi-text-dim)",
              fontSize: "9.5px",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            <WTh>#</WTh>
            <WTh>Length</WTh>
            <WTh>{countryA.split(" ").slice(-1)[0]} start</WTh>
            <WTh>{countryB.split(" ").slice(-1)[0]} start</WTh>
            <WTh>Correlation</WTh>
            <WTh>Indicators</WTh>
            <WTh>PPS</WTh>
          </tr>
        </thead>
        <tbody>
          {display.map((w, i) => {
            const wPpsT = Math.min(1, w.pps / 2000);
            const wCorrT = confidenceT(w.ac * 100);
            const ppsColor = lerpHexToRgb(MUTED_GRAY, accent, wPpsT);
            const corrColor = lerpHexToRgb(MUTED_GRAY, "#b0cfb8", wCorrT);
            const barW = Math.round((w.pps / maxPps) * 80);

            return (
              <tr
                key={i}
                style={{
                  borderBottom:
                    i < display.length - 1 ? "1px solid var(--qgi-border)" : "none",
                  background: i === 0 ? `${accent}08` : undefined,
                }}
              >
                <WTd dim>{i + 1}</WTd>
                <WTd>{w.l}y</WTd>
                <WTd>{w.sa}</WTd>
                <WTd>{w.sb}</WTd>
                <WTd style={{ color: corrColor }}>{w.ac.toFixed(3)}</WTd>
                <WTd dim>{w.ic}</WTd>
                <WTd>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        color: ppsColor,
                        fontWeight: i === 0 ? 700 : 400,
                        minWidth: "42px",
                      }}
                    >
                      {Math.round(w.pps)}
                    </span>
                    <div
                      style={{
                        width: `${barW}px`,
                        height: "3px",
                        background: `${accent}50`,
                        borderRadius: "2px",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </WTd>
              </tr>
            );
          })}
        </tbody>
      </table>
      {windows.length > 20 && (
        <div
          style={{
            padding: "8px 14px",
            fontSize: "10.5px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            borderTop: "1px solid var(--qgi-border)",
            background: "var(--qgi-bg)",
          }}
        >
          Showing top 20 of {windows.length} windows.
        </div>
      )}
    </div>
  );
}

function WTh({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "7px 12px",
        textAlign: "left",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function WTd({
  children,
  dim,
  style,
}: {
  children: React.ReactNode;
  dim?: boolean;
  style?: CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "6px 12px",
        color: dim ? "var(--qgi-text-dim)" : "var(--qgi-text)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function PartnerMiniCard({
  entry,
  subjectId,
  accent,
}: {
  entry: CatalogueEntry;
  subjectId: string;
  accent: string;
}) {
  // Show the "other" country (not the subject)
  const partnerName =
    entry.country_a_id === subjectId ? entry.country_b : entry.country_a;
  const partnerA2 =
    entry.country_a_id === subjectId ? entry.country_b_a2 : entry.country_a_a2;
  const emoji = buildEmoji(partnerA2) || flagFor(partnerName);

  const ppsT = Math.min(1, entry.pps / 2000);
  const ppsColor = lerpHexToRgb(MUTED_GRAY, accent, ppsT);

  return (
    <Link
      href={`/patterns/${entry.slug}` as Route}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "7px 10px",
          background: "var(--qgi-bg)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "4px",
          transition: "border-color 100ms",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--qgi-text)",
            minWidth: 0,
          }}
        >
          <FlagImg emoji={emoji} name={partnerName} width={14} radius={2} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {partnerName}
          </span>
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          <TierBadge tier={entry.tier} />
          <span
            style={{
              fontSize: "11px",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              color: ppsColor,
              minWidth: "34px",
              textAlign: "right",
            }}
          >
            {Math.round(entry.pps)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Not-found state
// ---------------------------------------------------------------------------

function NotFound({ slug }: { slug: string }) {
  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
        <nav
          style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-dim)",
            marginBottom: "24px",
          }}
        >
          <Link
            href={"/patterns" as Route}
            style={{ color: CALM_SLATE, textDecoration: "none" }}
          >
            Pair patterns
          </Link>
          <span style={{ margin: "0 6px", opacity: 0.4 }}>/</span>
          <span>{slug}</span>
        </nav>
        <div
          style={{
            padding: "40px 24px",
            border: "1px dashed var(--qgi-border)",
            borderRadius: "6px",
            background: "rgba(91, 126, 153, 0.05)",
            textAlign: "center",
            maxWidth: "560px",
            margin: "40px auto",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "10px" }}>
            Pair not found
          </h2>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "13px",
              lineHeight: 1.6,
              marginBottom: "16px",
            }}
          >
            The pair ID{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>{slug}</code> is not
            in the current catalogue.
          </p>
          <Link
            href={"/patterns" as Route}
            style={{
              fontSize: "12px",
              color: CALM_SLATE,
              textDecoration: "none",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Browse the catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
