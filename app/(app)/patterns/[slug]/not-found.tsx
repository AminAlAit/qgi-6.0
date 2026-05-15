import Link from "next/link";

/**
 * Per-pattern 404 fallback. PR-vii (2026-05-15).
 *
 * The Pattern detail page calls `notFound()` for unknown slugs. Without
 * this file the user landed on Next.js's default empty body. Now they
 * get a styled message + a route back to the master list.
 */
export default function PatternNotFound() {
  return (
    <div className="p-8 lg:p-12 max-w-2xl mx-auto">
      <p
        className="text-[10px] tracking-widest uppercase mb-3"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Pattern not found
      </p>
      <h1
        className="text-2xl font-semibold leading-snug mb-3"
        style={{ color: "var(--qgi-text)" }}
      >
        This pattern instance isn&apos;t in the current bake.
      </h1>
      <p
        className="text-sm leading-relaxed mb-6 max-w-[60ch]"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        The slug you tried doesn&apos;t map to any country-pair window in the latest
        ranking snapshot. The slug shape is{" "}
        <code
          className="px-1 py-0.5 rounded text-xs"
          style={{
            backgroundColor: "var(--qgi-surface-2)",
            color: "var(--qgi-text)",
          }}
        >
          {`{country-a}-{country-b}-{start_year_a}-{start_year_b}`}
        </code>
        . Two adjacent windows for the same pair share country slugs but differ on the two
        trailing years.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/patterns"
          className="px-3 py-2 rounded text-[11px] tracking-widest uppercase border transition-colors hover:bg-[color:var(--qgi-surface-2)]"
          style={{ borderColor: "var(--qgi-accent)", color: "var(--qgi-accent)" }}
        >
          ← All patterns
        </Link>
        <Link
          href="/dashboard"
          className="px-3 py-2 rounded text-[11px] tracking-widest uppercase border transition-colors hover:bg-[color:var(--qgi-surface-2)]"
          style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
