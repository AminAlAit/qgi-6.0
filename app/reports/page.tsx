import Link from "next/link";
import type { Metadata } from "next";
import { PublicNav } from "@/components/PublicNav";
import { getDisplayableReports, getLatestForRail } from "./_data/reports-manifest";
import { LatestRail } from "./_components/LatestRail";
import { CategoryFilteredGrid } from "./_components/CategorySegmentedControl";

export const metadata: Metadata = {
  title: "Intelligence Reports · QG Intelligence",
  description:
    "Pattern-driven analysis of sovereign risk, geopolitical alignment, and structural divergence. Reproducible by design.",
  alternates: {
    canonical: "https://qgintelligence.com/reports",
  },
  openGraph: {
    title: "Intelligence Reports · QG Intelligence",
    description:
      "Pattern-driven analysis of sovereign risk, geopolitical alignment, and structural divergence.",
    url: "https://qgintelligence.com/reports",
    siteName: "QG Intelligence",
    type: "website",
  },
};

export default function ReportsPage() {
  const latest = getLatestForRail();
  const latestSlugs = new Set(latest.map((r) => r.slug));
  const browsable = getDisplayableReports().filter((r) => !latestSlugs.has(r.slug));

  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
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
          <PublicNav currentPage="reports" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
        <div className="mb-12">
          <div
            className="text-[10px] tracking-widest uppercase mb-3 font-data"
            style={{ color: "var(--qgi-accent)" }}
          >
            Reports
          </div>
          <h1 className="text-3xl lg:text-4xl font-semibold mb-4 leading-tight">
            Intelligence Reports
          </h1>
          <p
            className="text-base lg:text-lg leading-relaxed max-w-3xl"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Pattern-driven analysis of sovereign risk, geopolitical alignment, and
            structural divergence. Each report is generated from live pipeline data and is
            fully reproducible by design.
          </p>
        </div>

        <LatestRail reports={latest} />

        <CategoryFilteredGrid reports={browsable} />
      </main>

      <footer
        className="border-t"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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
