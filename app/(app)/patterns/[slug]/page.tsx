/**
 * /patterns/[slug] — Pair detail page.
 *
 * Rebuilt 2026-05-30. Replaces the honest-empty-state stub.
 *
 * Slug format: "{country_a_id}-{country_b_id}" (lower numeric ID first).
 * e.g. "15-195" for Azerbaijan + Saudi Arabia.
 *
 * Data flow:
 *   - Pair metadata from getCatalogue() / getPartnersIndex()
 *   - Per-pair window detail from loadPairWindows(idA, idB)
 *
 * V4.1 §0 confidence-first. Flag images on both countries. No em-dashes.
 * No methodology jargon in copy.
 */

import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Layers } from "lucide-react";
import {
  getCatalogue,
  getCascadeVintage,
  getPairBySlug,
} from "@/lib/cascade-patterns/patterns-data";
import { loadPairWindows } from "@/lib/cascade-patterns/pair-windows";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import { MUTED_GRAY, confidenceT, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";
import { TierBadge } from "@/components/patterns-v4/PatternsSearch";

const ACCENT = "#5B7E99";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const catalogue = getCatalogue();
  const featured = [
    "15-195", // Azerbaijan + Saudi Arabia (canonical pair)
  ];
  // Pre-render catalogue entries + the canonical founding pair
  const slugs = new Set([...featured, ...catalogue.map((e) => e.slug)]);
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
    description: `Pair-pattern detail: ${pair.country_a} and ${pair.country_b}. Best window ${pair.window_length} years, correlation ${pair.corr.toFixed(3)}.`,
  };
}

export default async function PairDetailPage({ params }: Params) {
  const { slug } = await params;
  const pair = getPairBySlug(slug);
  const vintage = getCascadeVintage();

  if (!pair) {
    return <NotFound slug={slug} />;
  }

  // Load detailed window data
  const windows = await loadPairWindows(pair.country_a_id, pair.country_b_id);
  const topWindows = windows?.top.slice(0, 10) ?? [];

  const ppsDisplay = Math.round(pair.pps);
  const ppsT = Math.min(1, pair.pps / 2000);
  const corrT = confidenceT(pair.corr * 100);
  const ppsColor = lerpHexToRgb(MUTED_GRAY, ACCENT, ppsT);
  const ppsGlow = confidenceGlow(ACCENT, ppsT);

  // Build a2 emoji for FlagImg
  const emojiA = buildEmoji(pair.country_a_a2);
  const emojiB = buildEmoji(pair.country_b_a2);

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
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Link
            href={"/patterns" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            Pair Patterns
          </Link>
          <span style={{ opacity: 0.4 }}>/</span>
          <span>
            {pair.country_a} + {pair.country_b}
          </span>
        </nav>

        {/* Eyebrow */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--qgi-accent)",
            fontSize: "10px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "14px",
          }}
        >
          <Layers size={12} strokeWidth={2} />
          PATTERNS
        </div>

        {/* Hero: both countries */}
        <header style={{ marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            {/* Country A */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.4px",
              }}
            >
              <FlagImg
                emoji={emojiA || flagFor(pair.country_a)}
                name={pair.country_a}
                width={26}
                radius={3}
              />
              {pair.country_a}
            </span>

            <span
              style={{
                fontSize: "20px",
                color: "var(--qgi-text-dim)",
                fontWeight: 300,
              }}
            >
              +
            </span>

            {/* Country B */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.4px",
              }}
            >
              <FlagImg
                emoji={emojiB || flagFor(pair.country_b)}
                name={pair.country_b}
                width={26}
                radius={3}
              />
              {pair.country_b}
            </span>
          </div>

          {/* Vintage stamp */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "10.5px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
              padding: "4px 10px",
            }}
          >
            Cascade vintage: {vintage.label}
          </div>
        </header>

        {/* Stats row */}
        <section
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "32px",
          }}
        >
          <StatTile
            label="Pattern Power Score"
            value={
              <span
                style={{
                  color: ppsColor,
                  textShadow: ppsGlow || undefined,
                  fontSize: "28px",
                  fontWeight: 800,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "-1px",
                }}
              >
                {ppsDisplay}
              </span>
            }
          />
          <StatTile
            label="Correlation"
            value={
              <span
                style={{
                  color: lerpHexToRgb(MUTED_GRAY, "#b0cfb8", corrT),
                  fontSize: "28px",
                  fontWeight: 800,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "-1px",
                }}
              >
                {pair.corr.toFixed(3)}
              </span>
            }
          />
          <StatTile
            label="Window length"
            value={
              <span
                style={{
                  color: "var(--qgi-text)",
                  fontSize: "28px",
                  fontWeight: 800,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "-1px",
                }}
              >
                {pair.window_length}y
              </span>
            }
          />
          <StatTile
            label="Tier"
            value={
              <span style={{ paddingTop: "4px" }}>
                <TierBadge tier={pair.tier} />
              </span>
            }
          />
          {pair.num_indexes > 0 && (
            <StatTile
              label="Shared indicators"
              value={
                <span
                  style={{
                    color: "var(--qgi-text)",
                    fontSize: "28px",
                    fontWeight: 800,
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "-1px",
                  }}
                >
                  {pair.num_indexes}
                </span>
              }
            />
          )}
          {pair.start_year_a > 0 && (
            <StatTile
              label="Window starts"
              value={
                <span
                  style={{
                    color: "var(--qgi-text-muted)",
                    fontSize: "22px",
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {pair.start_year_a} / {pair.start_year_b}
                </span>
              }
            />
          )}
        </section>

        {/* Top windows table */}
        {topWindows.length > 0 && (
          <section style={{ marginBottom: "32px" }}>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: ACCENT,
                margin: "0 0 12px",
              }}
            >
              Top windows
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "var(--qgi-text-dim)",
                margin: "0 0 14px",
                lineHeight: 1.5,
              }}
            >
              Best sliding windows by Pattern Power Score. Start years show where each
              country&apos;s window begins.
            </p>
            <div
              style={{
                background: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
                borderLeft: `3px solid ${ACCENT}`,
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--qgi-border)",
                      color: "var(--qgi-text-dim)",
                      fontSize: "10px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    <Th>Rank</Th>
                    <Th>Length</Th>
                    <Th>Start A</Th>
                    <Th>Start B</Th>
                    <Th>Correlation</Th>
                    <Th>PPS</Th>
                  </tr>
                </thead>
                <tbody>
                  {topWindows.map((w, i) => {
                    const wPpsT = Math.min(1, w.pps / 2000);
                    const wCorrT = confidenceT(w.ac * 100);
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom:
                            i < topWindows.length - 1
                              ? "1px solid var(--qgi-border)"
                              : "none",
                        }}
                      >
                        <Td dim>{i + 1}</Td>
                        <Td>{w.l}y</Td>
                        <Td>{w.sa}</Td>
                        <Td>{w.sb}</Td>
                        <Td
                          style={{
                            color: lerpHexToRgb(MUTED_GRAY, "#b0cfb8", wCorrT),
                          }}
                        >
                          {w.ac.toFixed(3)}
                        </Td>
                        <Td
                          style={{
                            color: lerpHexToRgb(MUTED_GRAY, ACCENT, wPpsT),
                            fontWeight: i === 0 ? 700 : 400,
                          }}
                        >
                          {Math.round(w.pps)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Back link */}
        <div style={{ marginTop: "32px" }}>
          <Link
            href={"/patterns" as Route}
            style={{
              fontSize: "12px",
              color: ACCENT,
              textDecoration: "none",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Back to Pair Patterns
          </Link>
        </div>

        {/* Footer */}
        <footer
          style={{
            marginTop: "32px",
            paddingTop: "16px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.6,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Cascade vintage {vintage.label}. Pair ID: {slug}.
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmoji(a2?: string): string {
  if (!a2 || a2.length !== 2) return "";
  return String.fromCodePoint(
    ...a2
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "6px",
        padding: "12px 16px",
        minWidth: "120px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.4px",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "8px 14px",
        textAlign: "left",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  dim,
  style,
}: {
  children: React.ReactNode;
  dim?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "7px 14px",
        color: dim ? "var(--qgi-text-dim)" : "var(--qgi-text)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

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
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            Pair Patterns
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
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              marginBottom: "10px",
              color: "var(--qgi-text)",
            }}
          >
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
              color: "#5B7E99",
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
