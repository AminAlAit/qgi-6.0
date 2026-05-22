/**
 * COUNTRIES V2 — Narrative variant (small-multiples + annotation)
 *
 * Sard Majles S-Country decision (2026-05-02):
 * Small-multiples table base (Tufte) + 3-sentence narrative annotation per
 * country (Cairo school — Ingrid Halvorsen-Mbeki). Yuki + Sunita + Ingrid +
 * Nasrin all wanted narrative co-equal or co-present with the bars; Elif +
 * Rodrigo wanted bars-only. The narrative variant serves the
 * NGO/think-tank/policy-researcher audience (target-audiences.md Segments
 * 4, 6, 10) without losing the analytical density that financial buyers
 * need.
 *
 * Founder direction (2026-05-02):
 * Ship 2 sibling V2 pages of /countries (delta version dropped — Tomás
 * ship-blocker on data dependency). Founder picks after R8 local preview.
 *
 * Implementation status: SCAFFOLD — design spec locked.
 *
 * Cross-decision dependencies (locked Phase 3 + 4 outcomes):
 *   - Composite tier display = max(L1) badge
 *   - Calibration intervals: methodology + /countries/[id] only
 *   - Citation furniture: hover-only (clean surface)
 *   - Strengths section: auto-generated from indicator-trajectory positive
 *     slope (human-review gate per Ingrid)
 *   - Demographic 3 already suppressed from fingerprints via Phase 5 Stage A
 *
 * Decision file:
 *   qgi-docs/internal/majles/2026-05-02_S-Country_country_profile_redesign.md
 */
import Link from "next/link";

export const metadata = {
  title: "Countries V2 · Narrative · QG Intelligence",
  robots: { index: false, follow: false },
};

export default function CountriesV2NarrativeScaffold() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V2 design exploration · Sibling B (small-multiples + narrative)
        </div>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          Countries V2 — Narrative variant
        </h1>
        <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
          Small-multiples per-L1 bars (data layer) + 3-sentence &quot;why this country is
          interesting&quot; annotation per row (narrative layer). Cairo school + Tufte
          school co-existing. Designed to serve NGO / policy-research / think-tank buyers
          alongside financial-analyst buyers.
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
            <strong>Locked:</strong> hybrid layout (bars + narrative), Composite tier
            badge, hover-only citations, auto-generated strengths from trajectory slope
          </li>
          <li>
            <strong>Pending:</strong> data integration (per-L1 percentile + narrative
            annotation source), narrative-generation pipeline (likely AI + human-review
            gate per Ingrid), Tomás hard requirements, Sunita R11 cognitive walkthrough
          </li>
          <li>
            <strong>M11 L1-score caveat (#580):</strong> see V2 Table sibling
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
            href="/countries-v2-table"
            className="px-4 py-2 rounded border transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-accent)",
              color: "var(--qgi-accent)",
            }}
          >
            ↔ Compare with V2 Table variant
          </Link>
        </div>
      </section>
    </div>
  );
}
