/**
 * /recipes/[slug]/trajectory — Per-recipe trajectory deep-dive.
 *
 * MOCK ELIMINATION — 2026-05-30
 * getPattern(slug) + buildCurrentMatches (patterns-v4-data.ts:649-721)
 * synthesised current_top_matches entirely from recipe mock country lists.
 * The canonical shape series were also synthesised archetype curves — not
 * bake output. Zero fleet-run-1 data reached this page. Verdict: honest empty state.
 * Gap logged to C:\tmp\backend-gaps\patterns-trajectory.md
 *
 * Route remains alive so recipe pages that link here do not 404.
 * generateStaticParams returns an empty array — no pre-rendered slugs;
 * all requests hit the fallback shell. robots: noindex kept.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  // No pre-rendered trajectory pages until the bake emits shape data.
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Trajectory · ${slug} · QG Intelligence`,
    description:
      "The canonical movement shape of a recipe. Live results will appear when the trajectory engine emits per-recipe shape data.",
    robots: { index: false, follow: false },
  };
}

export default async function TrajectoryDeepDivePage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
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
            href={"/recipes" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            ← Recipes
          </Link>
          <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
          <Link
            href={`/recipes/${slug}` as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            {slug}
          </Link>
          <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
          <span style={{ color: "var(--qgi-text)" }}>Trajectory</span>
        </nav>

        {/* Page eyebrow */}
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
          Trajectory
        </div>

        <h1
          style={{
            fontSize: "30px",
            fontWeight: 600,
            lineHeight: 1.15,
            margin: "0 0 12px",
          }}
        >
          Canonical movement shape
        </h1>

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
            Trajectory shape not yet available
          </h2>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            The trajectory deep-dive shows the canonical movement shape of a recipe: the
            recurring indicator-composite arc that its verified-positive history rhymes
            around, plus the countries whose current movement most closely matches that
            shape. Per-recipe shape series and per-country trajectory alignment scores are
            not yet emitted by the bake. This page will populate when the trajectory
            engine begins producing shape output.
          </p>
        </div>
      </div>
    </div>
  );
}
