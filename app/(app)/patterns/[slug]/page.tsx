/**
 * /patterns/[slug] — Pair detail page.
 *
 * MOCK ELIMINATION — 2026-05-30
 * The pair detail page was 100% seed data from
 * lib/te-mock/patterns-v4-pair-detail-mock.ts (hand-typed pair objects).
 * The bake does not yet emit per-pair detail results. Verdict: honest empty state.
 * Gap logged to C:\tmp\backend-gaps\patterns-trajectory.md
 *
 * Route remains alive so inbound links do not 404. generateStaticParams returns
 * an empty array — no pre-rendered slugs; all requests hit the fallback shell.
 * robots: noindex kept so non-data pages don't surface in search.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { PageLayout } from "@/components/patterns-v4/PageLayout";

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  // No pre-rendered pair detail pages until the bake emits pair data.
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Pair detail · ${slug} · QG Intelligence`,
    description:
      "Country pair detail. Live results will appear when the pair-detection engine lands in the trajectory engine bake.",
    robots: { index: false, follow: false },
  };
}

export default async function PairDetailPage({ params: _params }: Params) {
  return (
    <PageLayout>
      {/* Breadcrumb */}
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
          href={"/patterns" as Route}
          style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
        >
          ← Patterns
        </Link>
        <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
        <span style={{ color: "var(--qgi-text)" }}>Pair detail</span>
      </nav>

      {/* Page eyebrow */}
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "2px",
          color: "var(--qgi-accent)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        PATTERNS
      </div>

      {/* Honest empty state */}
      <div
        style={{
          padding: "40px 24px",
          border: "1px dashed var(--qgi-border)",
          borderRadius: "6px",
          background: "rgba(91, 126, 153, 0.05)",
          textAlign: "center",
          maxWidth: "640px",
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
          Pair detail not yet available
        </h2>
        <p
          style={{
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          Per-pair detail pages are part of the pair-pattern catalog, a research artifact
          under separate methodology development. Decomposed indicator timelines and
          decade-by-decade breakdowns will appear here when the pair-detection engine
          lands in the trajectory engine bake.
        </p>
      </div>
    </PageLayout>
  );
}
