/**
 * DISCOVER PATTERNS — V2.1 (Tabs)
 *
 * Sard Majles S-First decision (2026-05-01):
 * Yuki Takahashi-Rowe (Product 1) recommended "B (merge with tabs)" —
 * Bloomberg/EIU buyer mental model = browse vs. detail mode separation.
 *
 * Founder direction (2026-05-02):
 * Ship BOTH the tabs variant AND the facets variant as sibling V2 pages
 * so founder can compare layouts before locking the merge. R7 (originals
 * /patterns + /patterns/ranking stay live) preserved.
 *
 * Implementation status: SCAFFOLD — design spec locked, layout chrome in
 * place. Data integration (loading PATTERNS + RANKING content into the
 * tab panels) is the next session's work. Sunita's R11 cognitive
 * walkthrough (3-5 sub-agent walkthroughs per Sunita's count direction)
 * runs after data integration, before founder greenlight.
 *
 * Tomás's hard requirements (must satisfy before ship):
 *   - Loading states with labeled skeletons (NOT bare "LOADING...")
 *   - Empty states with WHY explanations + one-click filter widening
 *   - Keyboard nav + ARIA roles on tabs
 *   - Microcopy in buyer language ("Indicator coverage" NOT "indicator_count")
 *
 * Decision file:
 *   qgi-docs/internal/majles/2026-05-01_S-First_patterns_ranking_merge.md
 */
import Link from "next/link";

export const metadata = {
  title: "Discover Patterns · V2 Tabs · QG Intelligence",
  robots: { index: false, follow: false },
};

export default function DiscoverPatternsTabsScaffold() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V2 design exploration · Sibling A (tabs)
        </div>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          Discover Patterns — Tabs variant
        </h1>
        <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
          Two-tab merger of /patterns and /patterns/ranking (default tab = ranking; second
          tab = pattern explorer). Matches the Bloomberg/EIU buyer mental model of
          browse-vs-detail separation.
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
            <strong>Locked:</strong> design pattern (tabs), name (Discover Patterns), nav
            slot, R10 continuity rules
          </li>
          <li>
            <strong>Pending:</strong> data integration (embed RANKING + PATTERNS content
            into tab panels), Tomás hard requirements (loading/empty/keyboard/microcopy),
            Sunita R11 cognitive walkthrough validation
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
            href="/patterns-v2b"
            className="px-4 py-2 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-accent)",
              color: "var(--qgi-accent)",
            }}
          >
            ↔ Compare with V2.2 (facets)
          </Link>
        </div>
      </section>
    </div>
  );
}
