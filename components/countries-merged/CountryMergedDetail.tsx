import Link from "next/link";
import type { Route } from "next";
import { CountryFlag } from "@/components/design/CountryFlag";
import type { RiskTier } from "@/lib/country-risks.schema";

/**
 * Country merged-detail page — Build PR #3 of 5 (A3 Family 2 merger brief).
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 2 — Countries §"Detail page composition")
 *
 * Sections shipped this PR:
 *   1. Hero (flag + name + tier pill + Sipho tooltip)
 *   2. Lloyd's tier banner
 *   3. "What's happening here" opening (preview template for unauthored)
 *   4. "What this doesn't mean" 3-bullet (country-specific)
 *   5. L1 risk profile — 8-row small-multiples (Elif fold from V1 8 cards)
 *   6. Cross-family handoffs footer
 *
 * Deferred to PR #4: ML coverage matrix · structural peers · indicator
 * trajectories · recent events density-strip · top precedents · radar.
 *
 * Server component (no client interactivity needed for PR #3; PR #4 may
 * promote sections to client when ML matrix collapse + events drawer ship).
 */

const TIER_META: Record<
  RiskTier,
  { label: string; color: string; bg: string; border: string; tooltip: string }
> = {
  HIGH: {
    label: "HIGH",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.35)",
    tooltip:
      "Top 20% of 156 scored countries. Composite of 71 risk-category z-scores, aggregated via max(L1) per V1.9.1 methodology. Reflects structural conditions visible in indicator data — relative position, not predictive forecast.",
  },
  MODERATE: {
    label: "MODERATE",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
    tooltip:
      "Middle band (next 30% after HIGH). At least one L1 risk dimension elevated relative to global norms. Warrants monitoring; does not indicate acute risk across the board.",
  },
  INDICATIVE: {
    label: "INDICATIVE",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
    border: "rgba(56,189,248,0.35)",
    tooltip:
      "Background level (bottom 50%). Categories scored and tracked; no single dimension currently elevated enough to move composite above MODERATE. Tier is the most stable rung.",
  },
};

const TIER_BANNER_COPY: Record<RiskTier, string> = {
  HIGH: "{country} sits at Tier HIGH — the top 20% of countries we score. This reflects structural conditions visible in indicator data; it is a relative position, not a prediction of imminent crisis.",
  MODERATE:
    "{country} sits at Tier MODERATE — the middle band, above background but below the most elevated quartile. At least one risk dimension is elevated relative to global norms.",
  INDICATIVE:
    "{country} sits at Tier INDICATIVE — the broadest band. Background signals are tracked but no single dimension is currently elevated.",
};

function formatCategory(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CountryMergedDetail({
  iso,
  name,
  alpha_2,
  curated,
  tier,
  l1Rows,
  top3,
}: {
  iso: string;
  name: string;
  alpha_2: string;
  curated: boolean;
  tier: RiskTier;
  l1Rows: ReadonlyArray<{
    code: string;
    label: string;
    shortLabel: string;
    color: string;
    /** Max salience score across all tier windows for this L1 group.
     *  Null when the country has no top_category in this group. */
    salience: number | null;
  }>;
  top3: ReadonlyArray<{
    category: string;
    salience_score: number;
    l1_group: string | null;
  }>;
}) {
  const tierMeta = TIER_META[tier];
  // Highlighted L1 groups — the codes that contain a top-3 driving category.
  // Drives the bold + caret marker on the L1 row per brief Section 3.
  const top3L1 = new Set(top3.map((c) => c.l1_group).filter((g): g is string => !!g));

  // Max salience across all L1 rows — used to normalize the salience bar.
  // Default to 1 so a country with no salience signals doesn't divide by 0.
  const maxSalience = Math.max(
    1,
    ...l1Rows.map((r) => r.salience ?? 0).filter((v) => v > 0)
  );

  return (
    <article className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
      {/* ============== Breadcrumb ============== */}
      <nav
        className="mb-6 text-[10px] tracking-widest uppercase"
        style={{ color: "var(--qgi-text-dim)" }}
        aria-label="Breadcrumb"
      >
        <Link
          href={"/countries-merged" as Route}
          className="hover:text-[var(--qgi-text-muted)] transition-colors"
        >
          ← Countries
        </Link>
      </nav>

      {/* ============== Hero ============== */}
      <header className="mb-6">
        <div
          className="text-[10px] tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Merged preview · cutover pending sign-off
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CountryFlag alpha2={alpha_2} size={36} countryName={name} />
          <h1
            className="text-3xl font-semibold leading-tight"
            style={{ color: "var(--qgi-text)" }}
          >
            {name} · Tier {tier}
          </h1>
          <TierPill meta={tierMeta} />
        </div>
        {curated && (
          <div className="mt-2">
            <span
              className="font-data text-[10px] tracking-wide uppercase px-2 py-0.5 rounded"
              style={{
                color: "var(--qgi-text-muted)",
                border: "1px solid var(--qgi-border)",
              }}
              title="Curated event history available — full timeline reachable via the events section (PR #4)"
            >
              Curated event history
            </span>
          </div>
        )}
      </header>

      {/* ============== Lloyd's tier banner (Section 1 of brief) ============== */}
      <section
        role="note"
        aria-label="Tier definition"
        className="mb-6 rounded-lg p-4 max-w-[68ch]"
        style={{
          backgroundColor: tierMeta.bg,
          border: `1px solid ${tierMeta.border}`,
          borderLeftWidth: 3,
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {TIER_BANNER_COPY[tier].replace("{country}", name)}
        </p>
      </section>

      {/* ============== Section "What's happening here" (Ingrid) ============== */}
      <WhatsHappeningHere name={name} tier={tier} top3={top3} />

      {/* ============== Section "What this doesn't mean" ============== */}
      <WhatThisDoesntMean name={name} />

      {/* ============== Section 3 — L1 risk profile (small-multiples) ============== */}
      <section className="mb-8" aria-labelledby="l1-profile-heading">
        <h2
          id="l1-profile-heading"
          className="text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          L1 risk profile
          <span
            className="ml-2 text-[9px] font-data normal-case tracking-normal"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            (8 risk dimensions; top-3 drivers highlighted)
          </span>
        </h2>
        <div
          className="rounded-lg border overflow-hidden"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          {l1Rows.map((row, idx) => (
            <L1Row
              key={row.code}
              row={row}
              maxSalience={maxSalience}
              isTopDriver={top3L1.has(row.code)}
              isLast={idx === l1Rows.length - 1}
            />
          ))}
        </div>
      </section>

      {/* ============== Cross-family handoffs footer ============== */}
      <footer
        className="pt-6 border-t mt-8"
        style={{ borderColor: "var(--qgi-border)" }}
        aria-label="Cross-family handoffs"
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Related across QGI
        </div>
        <div className="flex flex-col gap-2 text-sm max-w-[68ch]">
          <Link
            href={`/signals/${iso}` as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Currently firing signals for {name} →
          </Link>
          <Link
            href={"/precedents-merged" as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            See related precedent recipes →
          </Link>
          <Link
            href={"/patterns?sort=loco_auc" as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            See related ranked patterns →
          </Link>
          <Link
            href={`/countries/${iso}` as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            See the V1 country profile (legacy) →
          </Link>
        </div>
        <p
          className="text-[10px] mt-5 font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V1.9.1 scoring · Composite = max(L1) per Phase 3 decision · Country ID:{" "}
          <span className="tabular-nums">{iso}</span> ·{" "}
          <Link
            href={"/methodology" as Route}
            className="underline underline-offset-2"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Methodology →
          </Link>
          {" · "}
          <span style={{ color: "var(--qgi-text-muted)" }}>
            Preview shell — V1 + V2-Table + V2-Narrative detail pages remain reachable.
          </span>
        </p>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierPill({ meta }: { meta: (typeof TIER_META)[RiskTier] }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-data font-semibold tracking-wider uppercase"
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
      }}
      title={meta.tooltip}
    >
      {meta.label}
    </span>
  );
}

/**
 * "What's happening here" opening narrative (Ingrid voice).
 *
 * Brief: 90-110 words / 4-5 sentences / 3 movements:
 *   (1) shape of risk this country currently sits in
 *   (2) what shifted recently / temporal context
 *   (3) what the model keys on that a headline reader would miss
 *
 * PR #3 ships the preview-template variant (for unauthored countries).
 * Authored copy for hero countries (Iran, Syria, Venezuela, Germany,
 * Georgia + extensions) lands when qgi-data ships the per-country
 * authored-narrative JSON (follow-up).
 */
function WhatsHappeningHere({
  name,
  tier,
  top3,
}: {
  name: string;
  tier: RiskTier;
  top3: ReadonlyArray<{ category: string; salience_score: number }>;
}) {
  const top1 = top3[0] ? formatCategory(top3[0].category) : "—";
  return (
    <section className="mb-8" aria-labelledby="whats-happening-heading">
      <div className="flex items-center gap-2 mb-3">
        <h2
          id="whats-happening-heading"
          className="text-[10px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          What&apos;s happening here
        </h2>
        <span
          className="font-data text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded"
          style={{
            color: "rgba(251, 191, 36, 0.95)",
            backgroundColor: "rgba(251, 191, 36, 0.12)",
            border: "1px solid rgba(251, 191, 36, 0.30)",
          }}
          title="Preview template — country-specific authored copy lands when qgi-data ships per-country authored-narrative JSON"
        >
          Preview template
        </span>
      </div>
      <p
        className="text-base leading-relaxed max-w-[68ch]"
        style={{ color: "var(--qgi-text)" }}
      >
        {name} sits at Tier {tier} — {tierBlurb(tier)}. The current top-salience signal is{" "}
        {top1}; alongside it,{" "}
        {top3.length > 1
          ? formatCategory(top3[1].category).toLowerCase()
          : "other dimensions"}{" "}
        {top3.length > 2 ? `and ${formatCategory(top3[2].category).toLowerCase()} ` : ""}
        also register above background. The 8-row profile below shows the full L1-domain
        footprint; click through to{" "}
        <Link
          href={"/methodology" as Route}
          className="underline underline-offset-2"
          style={{ color: "var(--qgi-text)" }}
        >
          methodology
        </Link>{" "}
        for how composites and salience are computed.
      </p>
    </section>
  );
}

function tierBlurb(tier: RiskTier): string {
  switch (tier) {
    case "HIGH":
      return "the top 20% of countries we score";
    case "MODERATE":
      return "the middle band, with at least one elevated risk dimension";
    case "INDICATIVE":
      return "background level, with no dimension currently elevated above MODERATE";
    default:
      // PR #3 Sonnet review nit: explicit default so a future RiskTier
      // addition doesn't silently emit "undefined." in the prose template.
      return "";
  }
}

/**
 * Country-specific "What this doesn't mean" 3-bullet callout (Ingrid voice,
 * brief verbatim with {country}/{year} substitutions). Per Marcus + Sipho
 * carry-over from list page: keep on every detail page.
 */
function WhatThisDoesntMean({ name }: { name: string }) {
  // PR #3 Sonnet review nit: use getUTCFullYear so build-machine local
  // time doesn't leak into the rendered year token. ISR rebuilds hourly
  // catch the year rollover by Jan 1 UTC.
  const year = new Date().getUTCFullYear();
  return (
    <section
      role="note"
      aria-label="What tier does not mean"
      className="mb-8 rounded-lg p-4 max-w-[68ch]"
      style={{
        backgroundColor: "rgba(251, 191, 36, 0.08)",
        border: "1px solid rgba(251, 191, 36, 0.30)",
      }}
    >
      <div
        className="text-[10px] tracking-widest uppercase font-semibold mb-2"
        style={{ color: "rgba(251, 191, 36, 0.95)" }}
      >
        What this doesn&apos;t mean
      </div>
      <ul
        className="text-xs leading-relaxed list-disc pl-5 space-y-1"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        <li>
          This is not a forecast that {name} will collapse or face a specific outcome in{" "}
          {year}.
        </li>
        <li>It is not a comment on the legitimacy of any government.</li>
        <li>
          It is a structural-pattern reading; outcomes depend on choices not yet made.
        </li>
      </ul>
    </section>
  );
}

/**
 * One row of the L1 risk profile small-multiples table (Section 3). Real
 * salience drives the bar width (normalized against the country's max
 * L1 salience). Top-3-driver rows get a caret marker + bold treatment.
 *
 * Brief Section 3 full spec includes additional columns (world median tick
 * / 75yr sparkline / rank / trend Δ) — deferred to PR #4 once the
 * per-L1 world-median dataset bakes.
 */
function L1Row({
  row,
  maxSalience,
  isTopDriver,
  isLast,
}: {
  row: {
    code: string;
    label: string;
    shortLabel: string;
    color: string;
    salience: number | null;
  };
  maxSalience: number;
  isTopDriver: boolean;
  isLast: boolean;
}) {
  const sal = row.salience ?? 0;
  const pct = Math.min(100, Math.max(0, (sal / maxSalience) * 100));
  return (
    <div
      className="grid items-center gap-3 px-4 py-3"
      style={{
        gridTemplateColumns: "32px 1fr 1.4fr 64px",
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${row.color}`,
        backgroundColor: isTopDriver ? "rgba(56, 189, 248, 0.04)" : "transparent",
      }}
    >
      {/* L1 code chip (A..H) */}
      <span
        className="font-data text-[10px] font-semibold tracking-widest uppercase text-center px-1 py-0.5 rounded"
        style={{
          color: row.color,
          backgroundColor: `${row.color}18`,
          border: `1px solid ${row.color}40`,
        }}
        title={row.label}
      >
        {row.code}
      </span>

      {/* Full L1 label + top-driver marker */}
      <span
        className="text-sm flex items-center gap-1.5"
        style={{
          color: "var(--qgi-text)",
          fontWeight: isTopDriver ? 600 : 400,
        }}
      >
        {row.label}
        {isTopDriver && (
          <span
            className="font-data text-[9px] tracking-widest uppercase ml-1"
            style={{ color: "var(--qgi-accent)" }}
            title="Top-3 driver — one of this country's strongest current signals"
          >
            ▸ driver
          </span>
        )}
      </span>

      {/* Salience bar (REAL data, normalized) */}
      <div
        className="rounded-sm overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-border)",
          height: 6,
        }}
        role="img"
        aria-label={`${row.shortLabel} salience: ${sal.toFixed(2)} of ${maxSalience.toFixed(2)} max`}
        title={`Max salience score across all tier windows for the ${row.label} L1 group. Bar normalized against the country's strongest L1 signal.`}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: row.color,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Numeric salience (tabular) */}
      <span
        className="font-data text-[11px] tabular-nums text-right"
        style={{
          color: sal > 0 ? "var(--qgi-text-muted)" : "var(--qgi-text-dim)",
        }}
      >
        {sal > 0 ? sal.toFixed(2) : "—"}
      </span>
    </div>
  );
}
