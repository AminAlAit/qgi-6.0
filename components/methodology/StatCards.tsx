/**
 * Metric-card stat strip (#529, refactored 2026-04-29).
 *
 * Replaces the single-line stat strip with a tasteful card grid + monochrome
 * provider logos for World Bank / V-Dem / FAOSTAT. No cheese.
 */
import Link from "next/link";
import type { Route } from "next";
import stats from "@/data/methodology-stats.json";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MiniStat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div>
      <div
        className="font-data text-[26px] leading-none tabular-nums tracking-tight mb-1.5"
        style={{ color: "var(--qgi-text)" }}
      >
        {value}
      </div>
      <div
        className="text-[10px] tracking-widest uppercase mb-1"
        style={{ color: "var(--qgi-accent)" }}
      >
        {label}
      </div>
      {sub ? (
        <div className="text-[10px]" style={{ color: "var(--qgi-text-muted)" }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function StatCards() {
  const breakdown =
    (stats as { indicator_breakdown?: Record<string, number> }).indicator_breakdown || {};

  return (
    <section
      id="stats"
      className="py-8 border-b"
      style={{ borderColor: "var(--qgi-border)" }}
    >
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2
          className="text-xs tracking-[0.25em] uppercase"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          The data lake, by the numbers
        </h2>
        <span
          className="text-[11px] italic tracking-wide"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Updated {fmtDate(stats.updated)}
        </span>
      </div>

      {/* One equal-height row: events (wide, clickable) · countries · indicators (clickable).
          Footer links sit at the bottom of each card so the row reads as one cohesive set. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <Link
          href={"/methodology/events" as Route}
          className="lg:col-span-6 group rounded-lg border p-5 flex flex-col justify-between transition-colors hover:border-[var(--qgi-accent)]"
          style={{
            borderColor: "var(--qgi-border)",
            backgroundColor: "var(--qgi-surface)",
          }}
        >
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            <MiniStat
              value={fmt(stats.total_verified_events)}
              label="Verified events"
              sub={`${stats.earliest_event_year}–${stats.latest_event_year}`}
            />
            <MiniStat
              value={stats.category_count.toString()}
              label="Event categories"
              sub="3-layer taxonomy"
            />
            <MiniStat
              value={fmt(stats.unique_source_urls)}
              label="Source URLs"
              sub={`${fmt(stats.unique_source_domains)} unique domains`}
            />
          </div>
          <span
            className="mt-6 text-[11px] tracking-wider uppercase transition-colors group-hover:text-[var(--qgi-accent)]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Browse all events &rarr;
          </span>
        </Link>

        <div
          className="lg:col-span-3 rounded-lg border p-5 flex flex-col justify-between"
          style={{
            borderColor: "var(--qgi-border)",
            backgroundColor: "var(--qgi-surface)",
          }}
        >
          <MiniStat value="180+" label="Countries &amp; territories" />
          <span
            className="mt-6 text-[11px] tracking-wider uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Scored every release
          </span>
        </div>

        <Link
          href={"/methodology/indicators" as Route}
          className="lg:col-span-3 group rounded-lg border p-5 flex flex-col justify-between transition-colors hover:border-[var(--qgi-accent)]"
          style={{
            borderColor: "var(--qgi-border)",
            backgroundColor: "var(--qgi-surface)",
          }}
        >
          <MiniStat
            value={stats.indicator_count.toString()}
            label="Indicators"
            sub="across 3 providers"
          />
          <span
            className="mt-6 text-[11px] tracking-wider uppercase transition-colors group-hover:text-[var(--qgi-accent)]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Browse all indicators &rarr;
          </span>
        </Link>
      </div>

      {/* Provider strip with monochrome logos */}
      <div
        className="mt-6 rounded-lg border p-5"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Indicator providers
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <ProviderCell
            name="World Bank"
            count={breakdown["World Bank"] || 69}
            logo={<WBLogo />}
          />
          <ProviderCell
            name="V-Dem"
            count={breakdown["V-Dem"] || 35}
            logo={<VDemLogo />}
          />
          <ProviderCell
            name="FAOSTAT"
            count={breakdown["FAOSTAT"] || 5}
            logo={<FAOLogo />}
          />
        </div>
      </div>
    </section>
  );
}

function ProviderCell({
  name,
  count,
  version,
  logo,
}: {
  name: string;
  count: number;
  version?: string;
  logo: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="shrink-0 w-12 h-12 rounded-md flex items-center justify-center"
        style={{ backgroundColor: "var(--qgi-bg)" }}
        aria-hidden
      >
        {logo}
      </div>
      <div>
        <div className="text-sm font-data" style={{ color: "var(--qgi-text)" }}>
          {name}
        </div>
        <div
          className="text-[10px] tracking-wider uppercase"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {count} indicators
          {version && <span className="ml-1">· {version}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Monochrome provider logos (text-mark) ───────────────────────────────

function WBLogo() {
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7" aria-label="World Bank">
      <circle cx="18" cy="18" r="16" fill="none" stroke="#a1a8b3" strokeWidth="1.5" />
      <text
        x="18"
        y="22"
        textAnchor="middle"
        fontSize="10"
        fill="#a1a8b3"
        fontWeight="600"
        letterSpacing="-0.5"
      >
        WB
      </text>
    </svg>
  );
}

function VDemLogo() {
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7" aria-label="V-Dem">
      <rect
        x="3"
        y="3"
        width="30"
        height="30"
        rx="3"
        fill="none"
        stroke="#a1a8b3"
        strokeWidth="1.5"
      />
      <text
        x="18"
        y="14"
        textAnchor="middle"
        fontSize="7"
        fill="#a1a8b3"
        letterSpacing="1"
      >
        VAR
      </text>
      <text
        x="18"
        y="24"
        textAnchor="middle"
        fontSize="9"
        fill="#a1a8b3"
        fontWeight="700"
      >
        Dem
      </text>
    </svg>
  );
}

function FAOLogo() {
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7" aria-label="FAOSTAT">
      {/* Wheat-stalk silhouette gesture */}
      <path
        d="M18 5 L18 30 M14 12 Q18 14 22 12 M14 18 Q18 20 22 18 M14 24 Q18 26 22 24"
        fill="none"
        stroke="#a1a8b3"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <text
        x="18"
        y="35"
        textAnchor="middle"
        fontSize="6"
        fill="#a1a8b3"
        letterSpacing="0.5"
      >
        FAO
      </text>
    </svg>
  );
}
