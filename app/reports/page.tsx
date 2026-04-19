import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports — QGI Intelligence",
  description:
    "Pre-computed analytical reports demonstrating QGI's risk analysis capabilities. Sample reports available for download.",
};

/**
 * /reports — public page listing downloadable QGI analytical reports.
 *
 * Phase 1: placeholder with the FSI demo report slot (not yet generated).
 * Phase 2: actual PDF download + email capture gate.
 */
export default function ReportsPage() {
  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Navbar (same as methodology/legal) */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-1" title="Home">
            <span
              className="font-data text-sm tracking-[0.25em] font-semibold"
              style={{ color: "var(--qgi-accent)", marginRight: "-0.25em" }}
            >
              QG
            </span>
            <span
              className="text-[11px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Intelligence
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/methodology"
              className="text-xs tracking-wider uppercase transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Methodology
            </Link>
            <Link
              href="/dashboard"
              className="text-xs tracking-wider uppercase px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "var(--qgi-accent)",
                color: "var(--qgi-bg)",
              }}
            >
              Open Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12">
          <div
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-accent)" }}
          >
            Reports
          </div>
          <h1 className="text-3xl font-semibold mb-4">Analytical Reports</h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Pre-computed pattern analyses demonstrating what QGI delivers to risk analysts
            and institutional clients. Each report is generated from live pipeline data
            and is fully reproducible.
          </p>
        </div>

        {/* Report Cards */}
        <div className="space-y-6">
          {/* 2026-04-19: FSI Demo Report hidden per user directive — ticket
              #264 reopened as "needs rework" (earlier draft did not meet
              the editorial bar we want to set for QGI Reports). Keeping
              the route live but unlinked here so any outbound links don't
              404 until the rewrite ships. Production-ready reports coming
              from the 5-agent production pipeline will replace this slot. */}

          {/* Upcoming report placeholder */}
          <div
            className="rounded-lg border p-6 opacity-50"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            <h2 className="text-lg font-semibold mb-1">
              Regional Risk Brief — Middle East & North Africa
            </h2>
            <p className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
              Planned Q3 2026. Regional pattern analysis across 20 MENA countries with
              cross-border contagion scoring.
            </p>
          </div>

          <div
            className="rounded-lg border p-6 opacity-50"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            <h2 className="text-lg font-semibold mb-1">
              Structural Twins Deep Dive — BRICS+
            </h2>
            <p className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
              Planned Q4 2026. Which non-BRICS economies share structural trajectories
              with the bloc&apos;s members?
            </p>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-baseline gap-1">
            <span
              className="font-data text-xs tracking-[0.25em] font-semibold"
              style={{ color: "var(--qgi-accent)", marginRight: "-0.25em" }}
            >
              QG
            </span>
            <span
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Intelligence
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/methodology"
              className="text-[10px] tracking-wider transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Methodology
            </Link>
            <Link
              href="/legal"
              className="text-[10px] tracking-wider transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Legal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-data text-lg font-bold" style={{ color: "var(--qgi-accent)" }}>
        {value}
      </div>
      <div
        className="text-[10px] tracking-wider uppercase"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
    </div>
  );
}
