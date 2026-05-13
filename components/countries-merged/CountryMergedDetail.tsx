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

export interface MlMatrixRow {
  recipe_id: string;
  display_name: string;
  architecture_label: string;
  loco_auc: number;
  /** Expected Calibration Error overall (calibration band, REAL data). */
  ece_overall: number;
  /** Per-country AHI (preview value; null = "no anchor in battery yet"). */
  ahi_preview: number | null;
  /** Per-country global percentile (preview value; null when no anchor). */
  pct_preview: number | null;
  has_anchor: boolean;
}

export interface StructuralPeer {
  slug: string;
  name: string;
  alpha_2: string;
  tier: string;
  similarity: number;
}

export function CountryMergedDetail({
  iso,
  name,
  alpha_2,
  curated,
  tier,
  l1Rows,
  top3,
  mlRows = [],
  mlCovCount = 0,
  mlMatrixDefaultExpanded = false,
  structuralPeers = [],
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
  /** PR #4 — ML coverage matrix rows (currently top-4 LOCKed). */
  mlRows?: ReadonlyArray<MlMatrixRow>;
  /** PR #4 — count of rows with anchor coverage (drives the default
   *  expansion gate per brief Section 4). */
  mlCovCount?: number;
  mlMatrixDefaultExpanded?: boolean;
  /** PR #4 — structural-peer cohort (top-5 by L1-profile similarity). */
  structuralPeers?: ReadonlyArray<StructuralPeer>;
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

      {/* ============== Section 4 — ML recipe coverage matrix (Marcus flagship) ============== */}
      {mlRows.length > 0 && (
        <MlCoverageMatrix
          rows={mlRows}
          covCount={mlCovCount}
          defaultExpanded={mlMatrixDefaultExpanded}
        />
      )}

      {/* ============== Section 5 — Structural peers ============== */}
      {structuralPeers.length > 0 && (
        <StructuralPeers peers={structuralPeers} subjectName={name} />
      )}

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

/**
 * PR #4 — Section 4 ML recipe coverage matrix (Marcus flagship). Brief
 * §"Section 4": 7-col table × 13 LOCKed recipes. Currently top-4 set
 * (the only recipes with stable buyer-view metrics); expands to full 13
 * post-KI-2 roster lock.
 *
 * Columns: Recipe · Architecture · LOCO AUC · Calibration · AHI · Pctile · Status
 *
 * Expansion default per brief 7th-vote: expanded when ≥1 anchor measured
 * in the top-4 set (proxy for ≥3/13 on the full LOCKed set). Uses native
 * <details> so server-render works (no client state).
 */
function MlCoverageMatrix({
  rows,
  covCount,
  defaultExpanded,
}: {
  rows: ReadonlyArray<MlMatrixRow>;
  covCount: number;
  defaultExpanded: boolean;
}) {
  return (
    <section className="mb-8" aria-labelledby="ml-matrix-heading">
      <details
        className="group rounded-lg border"
        open={defaultExpanded}
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <summary
          className="cursor-pointer px-4 py-3 flex items-center gap-2 flex-wrap"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <span
            id="ml-matrix-heading"
            className="text-[10px] tracking-widest uppercase font-semibold"
          >
            ML recipe coverage
          </span>
          <span
            className="text-[9px] font-data normal-case tracking-normal"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            ({covCount} of {rows.length} validated recipes measured)
          </span>
          <span
            className="font-data text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded ml-2"
            style={{
              color: "rgba(251, 191, 36, 0.95)",
              backgroundColor: "rgba(251, 191, 36, 0.12)",
              border: "1px solid rgba(251, 191, 36, 0.30)",
            }}
            title="Anchor stability + Global percentile are preview values until the sibling bake ships per-country anchor data. Discrimination + Calibration are REAL."
          >
            Preview
          </span>
          <span
            className="ml-auto text-[10px] tracking-wider transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ▶
          </span>
        </summary>
        <div className="border-t" style={{ borderColor: "var(--qgi-border)" }}>
          <div
            className="hidden md:grid items-center px-4 py-2 text-[10px] tracking-widest uppercase"
            style={{
              gridTemplateColumns: "2fr 110px 70px 70px 70px 60px 90px",
              gap: 8,
              color: "var(--qgi-text-dim)",
              backgroundColor: "var(--qgi-surface-2)",
              borderBottom: "1px solid var(--qgi-border)",
            }}
          >
            <span>Recipe</span>
            <span>Architecture</span>
            <span
              className="text-right"
              title="Discrimination (out-of-country): probability the recipe ranks a positive case above a negative one on countries never seen during training. 0.5 = chance, 1.0 = perfect."
            >
              Discrim.
            </span>
            <span
              className="text-right"
              title="Calibration error: average gap between predicted probability and observed frequency. 0 = perfectly calibrated; <0.02 target; >0.05 unreliable."
            >
              Calibration
            </span>
            <span
              className="text-right"
              title="Anchor stability for this country (preview value): how robust the recipe is to held-out anchor events. Higher = more stable."
            >
              Anchor
            </span>
            <span
              className="text-right"
              title="Global percentile rank for this recipe's anchor stability on this country (preview value)."
            >
              Pctile
            </span>
            <span>Status</span>
          </div>
          {rows.map((r, idx) => (
            <div
              key={r.recipe_id}
              className="grid items-center px-4 py-2.5 gap-2"
              style={{
                gridTemplateColumns: "2fr 110px 70px 70px 70px 60px 90px",
                borderBottom:
                  idx === rows.length - 1 ? "none" : "1px solid var(--qgi-border)",
              }}
              title={
                r.has_anchor
                  ? "Measured anchor for this country (preview value)"
                  : "No anchor case in v2 regression suite for this recipe yet"
              }
            >
              <span className="text-sm truncate" style={{ color: "var(--qgi-text)" }}>
                {r.display_name}
              </span>
              <span
                className="font-data text-[10px]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {r.architecture_label}
              </span>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {r.loco_auc.toFixed(3)}
              </span>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{
                  color:
                    r.ece_overall <= 0.02
                      ? "#34d399"
                      : r.ece_overall <= 0.05
                        ? "var(--qgi-text-muted)"
                        : "#fbbf24",
                }}
              >
                {r.ece_overall.toFixed(3)}
              </span>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{
                  color:
                    r.ahi_preview !== null
                      ? "var(--qgi-text-muted)"
                      : "var(--qgi-text-dim)",
                }}
              >
                {r.ahi_preview !== null ? r.ahi_preview.toFixed(2) : "—"}
              </span>
              <span
                className="font-data text-[10px] tabular-nums text-right"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {r.pct_preview !== null ? `${r.pct_preview}p` : "—"}
              </span>
              <span>
                <StatusChip measured={r.has_anchor} />
              </span>
            </div>
          ))}
          <div
            className="px-4 py-2 text-[10px]"
            style={{
              color: "var(--qgi-text-dim)",
              backgroundColor: "var(--qgi-surface-2)",
              borderTop: "1px solid var(--qgi-border)",
            }}
          >
            Discrimination (out-of-country) + Calibration error from ml-recipe-stack
            (real). Per-country Anchor stability + Global percentile: preview values until
            anchor battery v3 ships (qgi-ml follow-up).{" "}
            <Link
              href={"/methodology" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              How to read this →
            </Link>
          </div>
        </div>
      </details>
    </section>
  );
}

function StatusChip({ measured }: { measured: boolean }) {
  if (measured) {
    return (
      <span
        className="font-data text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded"
        style={{
          color: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.10)",
          border: "1px solid rgba(34, 197, 94, 0.30)",
        }}
      >
        measured
      </span>
    );
  }
  return (
    <span
      className="font-data text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded"
      style={{
        color: "var(--qgi-text-dim)",
        border: "1px solid var(--qgi-border)",
      }}
      title="No anchor case in v2 regression suite for this recipe yet"
    >
      no anchor
    </span>
  );
}

/**
 * PR #4 — Section 5 Structural peers. Brief title: "Countries that look most
 * like {country} today" (Ingrid rename from "Structural Twins"). Top-5 by
 * cosine similarity on the 8-dim L1 salience vector. REAL data — no
 * Preview chip.
 */
function StructuralPeers({
  peers,
  subjectName,
}: {
  peers: ReadonlyArray<StructuralPeer>;
  subjectName: string;
}) {
  return (
    <section className="mb-8" aria-labelledby="peers-heading">
      <h2
        id="peers-heading"
        className="text-[10px] tracking-widest uppercase mb-3"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Countries that look most like {subjectName} today
        <span
          className="ml-2 text-[9px] font-data normal-case tracking-normal"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          (top 5 by L1 risk-profile similarity)
        </span>
      </h2>
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {peers.map((peer, idx) => {
          const peerTierMeta = TIER_META[peer.tier as RiskTier];
          const simPct = Math.round(peer.similarity * 100);
          return (
            <Link
              key={peer.slug}
              href={`/countries-merged/${peer.slug}` as Route}
              className="grid items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--qgi-surface-2)] group"
              style={{
                gridTemplateColumns: "32px 1fr 110px 1fr 64px",
                borderBottom:
                  idx === peers.length - 1 ? "none" : "1px solid var(--qgi-border)",
                borderLeft: `3px solid ${peerTierMeta?.color ?? "var(--qgi-border)"}`,
              }}
            >
              <CountryFlag alpha2={peer.alpha_2} size={14} />
              <span
                className="text-sm group-hover:text-[var(--qgi-accent)] transition-colors font-medium"
                style={{ color: "var(--qgi-text)" }}
              >
                {peer.name}
              </span>
              {peerTierMeta && <TierPill meta={peerTierMeta} />}
              <div
                className="rounded-sm overflow-hidden"
                style={{
                  backgroundColor: "var(--qgi-border)",
                  height: 4,
                }}
                role="img"
                aria-label={`Similarity: ${simPct}%`}
                title="Cosine similarity on 8-dim L1 risk-profile vectors. Higher = more similar risk fingerprint."
              >
                <div
                  style={{
                    width: `${simPct}%`,
                    height: "100%",
                    backgroundColor: "#38bdf8",
                    borderRadius: 2,
                  }}
                />
              </div>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {simPct}%
              </span>
            </Link>
          );
        })}
      </div>
      <p className="text-[10px] mt-2" style={{ color: "var(--qgi-text-dim)" }}>
        Similarity computed on the 8-dim L1 risk-profile vector (max-salience per L1
        group, cosine similarity). REAL data.
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
