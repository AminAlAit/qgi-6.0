/**
 * /patterns-v4 — gallery of canonical movement shapes (V4 mockup).
 *
 * IA-spec §1 surface. Vocabulary is quarantined: "pattern" here means the
 * canonical 4-indicator movement shape that defines a recipe per the
 * Methodology Charter §3, NOT the SCDI-era dyadic co-movement pattern.
 *
 * Pure Server Component. No client interactivity here — the ranking
 * sub-page (/patterns-v4/ranking) is the only V4 surface that uses
 * `"use client"`.
 *
 * Sibling routes (untouched):
 *   - /patterns (legacy SCDI/Cascade — preserved per IA spec §1)
 *   - /precedents-v2 (recipe report cards)
 *
 * Local-only branch: `local/te-precedents-mockup`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Layers, ChartLine } from "lucide-react";
import {
  getAllPatterns,
  getL1Families,
  type PatternEntry,
} from "@/lib/te-mock/patterns-v4-data";
import { vintageStamp } from "@/lib/te-mock/recipes";
import { PatternCard } from "@/components/patterns-v4/PatternCard";
import { VocabularyQuarantineNote } from "@/components/patterns-v4/VocabularyQuarantineNote";

export const metadata: Metadata = {
  title: "Patterns (v4 mockup) · QG Intelligence",
  description:
    "TE-era patterns gallery — canonical movement shapes of the recipe catalog. Local-only mockup; not for production.",
  robots: { index: false, follow: false },
};

const L1_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function PatternsV4GalleryPage() {
  const patterns = getAllPatterns();
  const families = getL1Families();

  // Group patterns by L1 family for sectioned layout (matches Precedents V4 idiom).
  const groups: Record<string, PatternEntry[]> = {};
  for (const p of patterns) {
    if (!groups[p.l1_id]) groups[p.l1_id] = [];
    groups[p.l1_id].push(p);
  }

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Mockup banner — full-width */}
      <div
        style={{
          background: "rgba(56,189,248,0.08)",
          borderBottom: "1px solid rgba(56,189,248,0.3)",
          padding: "7px 0",
          textAlign: "center",
          fontSize: "10.5px",
          color: "var(--qgi-accent)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "1.5px",
        }}
      >
        MOCKUP · /patterns-v4 · local only
      </div>

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {/* Eyebrow + title */}
        <div
          style={{
            color: "var(--qgi-accent)",
            fontSize: "10px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "8px",
          }}
        >
          Patterns · canonical movement shapes
        </div>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 600,
            lineHeight: 1.15,
            margin: "0 0 14px",
          }}
        >
          The pattern catalog
        </h1>
        <p
          style={{
            color: "var(--qgi-text-muted)",
            fontSize: "15px",
            lineHeight: 1.6,
            maxWidth: "820px",
            margin: "0 0 24px",
          }}
        >
          A <strong style={{ color: "var(--qgi-text)" }}>pattern</strong> is the recurring
          4-indicator movement shape that defines a recipe — the canonical trajectory that
          the historical positives in our verified-events corpus rhyme around. Each
          pattern carries a small sparkline preview of its shape, the recipe it belongs
          to, the L1 family, and the average shape-similarity score of its current top-10
          country matches. Open any card to see the shape rendered full-size with
          historical examples and the present-tense leaderboard.
        </p>

        {/* Quarantine note — first thing under the lede */}
        <VocabularyQuarantineNote />

        {/* Top metric strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
            padding: "14px 16px",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "6px",
            marginBottom: "24px",
          }}
        >
          <MetricChip
            icon={<Layers size={13} color="var(--qgi-accent)" />}
            label="Patterns in catalog"
            value={String(patterns.length)}
          />
          <MetricChip label="L1 families" value={String(families.length)} />
          <MetricChip
            label="Verified positives (sum)"
            value={String(
              patterns.reduce((s, p) => s + p.n_positives, 0).toLocaleString()
            )}
          />
          <MetricChip
            label="Window range"
            value={`${minWin(patterns)}–${maxWin(patterns)}y`}
          />
          <span style={{ flex: 1 }} />
          <Link
            href={"/patterns-v4/ranking" as Route}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 14px",
              background: "rgba(56,189,248,0.1)",
              border: "1px solid var(--qgi-accent)",
              color: "var(--qgi-accent)",
              borderRadius: "4px",
              fontSize: "11.5px",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.5px",
              textDecoration: "none",
            }}
          >
            <ChartLine size={13} />
            Shape-discrimination ranking →
          </Link>
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1px",
              color: "var(--qgi-text-dim)",
              padding: "5px 9px",
              background: "var(--qgi-bg)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Vintage: {vintageStamp()}
          </span>
        </div>

        {/* L1-grouped sections (matches Precedents V4 layout) */}
        {L1_ORDER.map((l1Id) => {
          const rs = groups[l1Id];
          if (!rs?.length) return null;
          const l1Label = rs[0].l1_label;
          const l1Color = rs[0].l1_color;
          return (
            <section key={l1Id} style={{ marginTop: "32px" }}>
              <header
                style={{
                  display: "flex",
                  gap: "16px",
                  alignItems: "stretch",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{ width: "4px", background: l1Color, borderRadius: "2px" }}
                  aria-hidden="true"
                />
                <div>
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      margin: 0,
                      color: "var(--qgi-text)",
                    }}
                  >
                    {l1Label}
                  </h2>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--qgi-text-dim)",
                      marginTop: "4px",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {rs.length} pattern{rs.length === 1 ? "" : "s"} · avg shape-match
                    across all{" "}
                    {(rs.reduce((s, r) => s + r.avg_match_score, 0) / rs.length).toFixed(
                      1
                    )}
                  </div>
                </div>
              </header>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "14px",
                }}
              >
                {rs.map((p) => (
                  <PatternCard key={p.id} pattern={p} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Footer cross-links */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid var(--qgi-border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "12px",
            color: "var(--qgi-text-muted)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
          }}
        >
          <Link
            href={"/precedents-v2" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            Precedents (recipe report cards) →
          </Link>
          <Link
            href={"/patterns-v4/ranking" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            Shape-discrimination ranking →
          </Link>
          <Link
            href={"/patterns" as Route}
            style={{ color: "var(--qgi-text-dim)", textDecoration: "none" }}
          >
            Legacy /patterns (Correlation Cascade) →
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "3px",
        padding: "6px 12px",
        borderRight: "1px solid var(--qgi-border)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "9.5px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "1px",
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function minWin(ps: PatternEntry[]): number {
  return Math.min(...ps.map((p) => p.window_y));
}
function maxWin(ps: PatternEntry[]): number {
  return Math.max(...ps.map((p) => p.window_y));
}
