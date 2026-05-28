/**
 * /recipes/trajectory-ranking — Trajectory strength ranking.
 *
 * Top-30 countries by how closely their current movement resembles any
 * trajectory in the catalog. Migrated from /patterns/ranking and rebuilt
 * to the V4.1 bar (honest copy, flags, no "pattern" wording, no M8-R5 box).
 * Reached via the button on each trajectory deep-dive.
 *
 * Server shell; the table itself is the one interactive client surface.
 * Mockup only, local-only.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getRanking, getL1Families } from "@/lib/te-mock/patterns-v4-data";
import { vintageStamp } from "@/lib/te-mock/recipes";
import { TrajectoryRankingTable } from "@/components/precedents-v4-1/TrajectoryRankingTable";

export const metadata: Metadata = {
  title: "Trajectory strength ranking · QG Intelligence",
  description:
    "Top-30 countries ranked by how closely their current movement resembles any recipe trajectory.",
};

export default function TrajectoryRankingPage() {
  const rows = getRanking();
  const families = getL1Families();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: "11px",
            letterSpacing: "0.3px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "16px",
          }}
        >
          <Link
            href={"/recipes" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            ← Recipes
          </Link>
          <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
          <span style={{ color: "var(--qgi-text)" }}>Trajectory strength ranking</span>
        </nav>

        <div
          style={{
            color: "var(--qgi-text-dim)",
            fontSize: "10px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "8px",
          }}
        >
          Trajectory strength ranking
        </div>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: 600,
            lineHeight: 1.15,
            margin: "0 0 12px",
          }}
        >
          Countries ranked by trajectory match
        </h1>
        <p
          style={{
            color: "var(--qgi-text-muted)",
            fontSize: "14.5px",
            lineHeight: 1.6,
            maxWidth: "820px",
            margin: "0 0 14px",
          }}
        >
          The top {rows.length} countries whose recent movement most closely resembles any
          trajectory in the catalog. Each row shows the closest-matched trajectory, its
          match score, and the country&apos;s runner-up. Sort any column, filter by
          family, or search. Match scores are similarity ranks, not probabilities.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
            padding: "0 0 18px",
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
            Top {rows.length} of all scoring countries · {families.length} families
            represented
          </span>
        </div>

        <TrajectoryRankingTable rows={rows} families={families} />
      </div>
    </div>
  );
}
