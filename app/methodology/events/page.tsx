import type { Metadata } from "next";
import Link from "next/link";
import EventsTable from "@/components/methodology/EventsTable";
import StatPie from "@/components/methodology/StatPie";
import { PIE_PALETTE, type PieSlice } from "@/components/methodology/pie-data";
import taxonomy from "@/data/taxonomy-with-counts.json";
import verifiedEvents from "@/data/verified-events.json";

interface L1 {
  label: string;
  display_label?: string;
  event_count?: number;
}
const MASTER_GROUP_SLICES: PieSlice[] = (taxonomy as { layer1: L1[] }).layer1
  .map((l1, i) => ({
    label: l1.display_label || l1.label,
    value: l1.event_count || 0,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
  }))
  .filter((s) => s.value > 0);

const SOURCE_SLICES: PieSlice[] = (() => {
  const m = new Map<string, number>();
  for (const e of verifiedEvents as Array<{ sourceDomain?: string | null }>) {
    const d = e.sourceDomain;
    if (!d) continue;
    m.set(d, (m.get(d) || 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      color: PIE_PALETTE[i % PIE_PALETTE.length],
    }));
})();

export const metadata: Metadata = {
  title: "All verified events · QGI Methodology",
  description:
    "Searchable table of every verified event in QGI's data lake, with public source URLs.",
  alternates: { canonical: "https://qgintelligence.com/methodology/events" },
  openGraph: {
    title: "All verified events · QGI Methodology",
    description:
      "Searchable table of every verified event in QGI's data lake, with public source URLs.",
    url: "https://qgintelligence.com/methodology/events",
    siteName: "QG Intelligence",
    type: "article",
  },
};

export default function MethodologyEventsPage() {
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
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
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
          <Link
            href="/methodology"
            className="text-[11px] tracking-widest uppercase"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            ← Methodology
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-16">
        <div className="pt-10 pb-6">
          <h1
            className="text-2xl md:text-3xl font-light tracking-tight mb-3"
            style={{ color: "var(--qgi-text)" }}
          >
            All verified events
          </h1>
          <p
            className="text-sm leading-relaxed max-w-2xl"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Every event in QGI&apos;s data lake, with the verification source URL. Filter
            by country, category, year range, or fulltext search the title.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <StatPie title="Events by master group" slices={MASTER_GROUP_SLICES} />
          <StatPie title="Events by source" slices={SOURCE_SLICES} />
        </div>

        <EventsTable />
      </main>
    </div>
  );
}
