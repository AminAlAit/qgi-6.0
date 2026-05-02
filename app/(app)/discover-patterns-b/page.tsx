/**
 * DISCOVER PATTERNS — V2.2 (Facets)
 *
 * Sard Majles S-First decision (2026-05-01):
 * Elif Şahin-Moreau (Information Design Tufte) + Tomás Drahovský-Osei (UI
 * craft) recommended "C (faceted filter strip + drawer/inline detail)" —
 * the data is the same set, the lenses are filter combinations; tabs hide
 * structure where facets reveal it. Tomás specified Datadog-style drawer
 * over inline expansion to keep ranked list as persistent anchor.
 *
 * Founder direction (2026-05-02):
 * Ship BOTH the tabs variant AND the facets variant as sibling V2 pages.
 * Plurality on facets (2.5 vs 1.5 vs 1) — facets is the leading candidate
 * but founder wants empirical comparison.
 *
 * Implementation status: SCAFFOLD — design spec locked, layout chrome in
 * place. Data integration is the next session's work.
 *
 * Tomás's hard requirements (must satisfy before ship): see V2.1 file.
 *
 * Decision file:
 *   qgi-docs/internal/majles/2026-05-01_S-First_patterns_ranking_merge.md
 */
import Link from "next/link";

export const metadata = {
  title: "Discover Patterns — V2 Facets — QGI Intelligence",
  robots: { index: false, follow: false },
};

export default function DiscoverPatternsFacetsScaffold() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V2 design exploration · Sibling B (facets)
        </div>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          Discover Patterns — Facets variant
        </h1>
        <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
          Faceted filter strip with drawer-on-row-click. Persistent leaderboard anchor;
          pattern detail expands into a side drawer (Datadog model). Elif Şahin-Moreau +
          Tomás Drahovský-Osei&apos;s pick per Sard Majles S-First (2026-05-01) — facets
          reveal structure where tabs hide it.
        </p>
      </header>

      <section
        className="rounded-lg border p-6 mb-8"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          Implementation status
        </h2>
        <ul
          className="text-xs space-y-2 list-disc list-inside"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          <li>
            <strong>Locked:</strong> design pattern (facets + drawer), name (Discover
            Patterns), nav slot, R10 continuity rules
          </li>
          <li>
            <strong>Pending:</strong> data integration (unified leaderboard backed by
            RANKING data + facet filters from PATTERNS data), Tomás hard requirements,
            Sunita R11 cognitive walkthrough
          </li>
        </ul>
      </section>

      <section
        className="rounded-lg border p-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          While V2 is in progress, use the originals
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 text-sm">
          <Link
            href="/patterns/ranking"
            className="px-4 py-2 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          >
            → /patterns/ranking
          </Link>
          <Link
            href="/patterns"
            className="px-4 py-2 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          >
            → /patterns
          </Link>
          <Link
            href="/discover-patterns-a"
            className="px-4 py-2 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-accent)",
              color: "var(--qgi-accent)",
            }}
          >
            ↔ Compare with V2.1 (tabs)
          </Link>
        </div>
      </section>
    </div>
  );
}
