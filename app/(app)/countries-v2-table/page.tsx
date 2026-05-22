/**
 * COUNTRIES V2 — Table variant (small-multiples)
 *
 * Sard Majles S-Country decision (2026-05-02):
 * Pure small-multiples table (Elif Şahin-Moreau / Rodrigo Vasconcelos-Kwok /
 * Tomás Drahovský-Osei recommendation) — 1 row per country, each row has
 * 8 micro-bars (one per L1) showing percentile-position-within-distribution.
 * Tufte school: maximum data density per pixel. Power-user friendly.
 *
 * Founder direction (2026-05-02):
 * Ship 2 sibling V2 pages of /countries (delta version dropped — Tomás
 * ship-blocker on data dependency). Founder picks after R8 local preview.
 *
 * Implementation status: SCAFFOLD — design spec locked.
 * Pending: data integration, R11 cognitive walkthrough, mobile responsive.
 *
 * Cross-decision dependencies (locked Phase 3 + 4 outcomes):
 *   - Composite tier display = max(L1) badge (NOT manufactured OVR)
 *   - Calibration intervals: methodology page + /countries/[id] only, not browse
 *   - Citation furniture: hover-only (clean surface)
 *   - Per-L1 small-multiples = the badge per row (color = tier severity,
 *     bar position = percentile within global L1 distribution)
 *   - Demographic 3 already suppressed from fingerprints via Phase 5 Stage A
 *
 * Decision file:
 *   qgi-docs/internal/majles/2026-05-02_S-Country_country_profile_redesign.md
 */
import Link from "next/link";

export const metadata = {
  title: "Countries V2 · Table · QG Intelligence",
  robots: { index: false, follow: false },
};

export default function CountriesV2TableScaffold() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V2 design exploration · Sibling A (small-multiples table)
        </div>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          Countries V2 — Table variant
        </h1>
        <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
          1 row per country with 8 per-L1 percentile micro-bars. Tufte school — maximum
          data density. Replaces the FIFA-card pattern per AS1 + S-Country majles
          direction. Power-user friendly: scannable, comparable across countries at a
          glance.
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
            <strong>Locked:</strong> small-multiples shape, per-L1 percentile encoding,
            Composite tier badge (max L1), no calibration intervals on browse, hover-only
            citations
          </li>
          <li>
            <strong>Pending:</strong> data integration (compute per-L1 percentile rank for
            each country), Tomás hard requirements (loading/empty/keyboard/microcopy +
            WCAG once #579 lands), Sunita R11 cognitive walkthrough (3-5 sub-agents),
            mobile responsive
          </li>
          <li>
            <strong>M11 L1-score caveat (#580 + 2026-05-02 investigation):</strong> until
            severity scores are added to curated events, ~25 countries (incl. India) have
            ≤4 unique L1 values. The percentile micro-bars will reflect this compression
            honestly — buyers will see uniform bars for those countries until corpus
            enrichment lands.
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
            href="/countries"
            className="px-4 py-2 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          >
            → /countries (current FIFA-card)
          </Link>
          <Link
            href="/countries-v2-narrative"
            className="px-4 py-2 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-accent)",
              color: "var(--qgi-accent)",
            }}
          >
            ↔ Compare with V2 Narrative variant
          </Link>
        </div>
      </section>
    </div>
  );
}
