import Link from "next/link";

/**
 * #852 — Custom not-found page for /countries/[iso].
 *
 * Renders when resolveCountryBySlug() returns null (country absent from the
 * scored dataset) and the page calls notFound(). Guinea-Bissau, Cabo Verde,
 * and São Tomé and Príncipe are three confirmed examples (some cycles do
 * not include them). The generic in-shell fallback provided no guidance;
 * Lusophone-Africa specialists interpreted the dead end as a data error rather
 * than a known coverage gap.
 *
 * Co-located with page.tsx so Next.js's segment-scoped not-found routing
 * catches the /countries/[iso] subtree specifically rather than falling
 * through to the global app/(app)/not-found.tsx.
 */
export default function CountryNotFound() {
  return (
    <div className="p-8 lg:p-12 max-w-2xl mx-auto">
      <p
        className="text-[10px] tracking-widest uppercase mb-3"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Country not in scored dataset
      </p>
      <h1
        className="text-2xl font-semibold leading-snug mb-3"
        style={{ color: "var(--qgi-text)" }}
      >
        This country is not currently scored by QGI.
      </h1>
      <p
        className="text-sm leading-relaxed mb-4 max-w-[60ch]"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        This country has not yet been included in the current scored cycle, either due to
        data availability constraints or because it falls outside the current indicator
        coverage. Coverage expands with each pipeline bake.
      </p>
      <p
        className="text-sm leading-relaxed mb-6 max-w-[60ch]"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        If you believe this country should be included, check the full list below to
        confirm whether a different spelling or slug is used.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/countries"
          className="px-3 py-2 rounded text-[11px] tracking-widest uppercase border transition-colors hover:bg-[color:var(--qgi-surface-2)]"
          style={{ borderColor: "var(--qgi-accent)", color: "var(--qgi-accent)" }}
        >
          View all scored countries →
        </Link>
        <Link
          href="/dashboard"
          className="px-3 py-2 rounded text-[11px] tracking-widest uppercase border transition-colors hover:bg-[color:var(--qgi-surface-2)]"
          style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
        >
          ← Dashboard
        </Link>
      </div>
    </div>
  );
}
