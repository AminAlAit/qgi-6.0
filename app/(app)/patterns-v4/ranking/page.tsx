/**
 * /patterns-v4/ranking — structural-discrimination leaderboard (V4 mockup).
 *
 * Top-30 countries ranked by their CURRENT shape-match score against ANY
 * pattern in the catalog. The TE-language replacement for the legacy
 * /patterns/ranking surface.
 *
 * This is the only /patterns-v4 surface with interactivity (sort + filter +
 * search), so the table itself is a Client Component but the page shell + the
 * data load stay on the server.
 *
 * IA-spec §1: this is a SUB-VIEW of Patterns, not a top-level peer of the TE
 * risk views — keep the "how this differs from /risk-board" panel visible
 * (rendered inside PatternRankingTable).
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getRanking, getL1Families } from "@/lib/te-mock/patterns-v4-data";
import { vintageStamp } from "@/lib/te-mock/recipes";
import { PatternRankingTable } from "@/components/patterns-v4/PatternRankingTable";
import { VocabularyQuarantineNote } from "@/components/patterns-v4/VocabularyQuarantineNote";

export const metadata: Metadata = {
  title: "Pattern shape-discrimination ranking (v4 mockup) · QG Intelligence",
  description:
    "Top-30 countries ranked by shape-similarity against the V4 pattern catalog. Local-only mockup; not for production.",
  robots: { index: false, follow: false },
};

export default function PatternsRankingPage() {
  const rows = getRanking();
  const families = getL1Families();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Mockup banner */}
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
        MOCKUP · /patterns-v4/ranking · local only
      </div>

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {/* Breadcrumb */}
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.3px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "16px",
          }}
        >
          <Link
            href={"/patterns-v4" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            ← Patterns
          </Link>
          <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
          <span style={{ color: "var(--qgi-text)" }}>Ranking</span>
        </div>

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
          Patterns · Shape-discrimination ranking
        </div>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: 600,
            lineHeight: 1.15,
            margin: "0 0 12px",
          }}
        >
          Countries ranked by shape match
        </h1>
        <p
          style={{
            color: "var(--qgi-text-muted)",
            fontSize: "14.5px",
            lineHeight: 1.6,
            maxWidth: "820px",
            margin: "0 0 22px",
          }}
        >
          The top-{rows.length} countries whose <em>current</em> trajectory most closely
          rhymes with any canonical movement shape in the V4 catalog. Each row shows the
          top-matched pattern, its match score, and the country&apos;s runner-up pattern.
          Sort by any column; filter by L1 family; search by country, region, or pattern
          name.
        </p>

        <VocabularyQuarantineNote />

        {/* Compact vintage + count strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
            padding: "8px 0 18px",
            fontSize: "11px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-dim)",
            letterSpacing: "0.5px",
          }}
        >
          <span>
            Vintage:{" "}
            <span style={{ color: "var(--qgi-text-muted)" }}>{vintageStamp()}</span>
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>
            Top-{rows.length} of all scoring countries · {families.length} L1 families
            represented
          </span>
        </div>

        <PatternRankingTable rows={rows} families={families} />
      </div>
    </div>
  );
}
