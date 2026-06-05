/**
 * /blog/trend-tracker — the live trend status board.
 *
 * 2026-06-05: renamed from /blog/recipe-tracker (founder direction: the
 * concept is called Trends everywhere users see it; "recipe" stays pipeline
 * vocabulary only). The old slug 308s here via next.config. Data refreshed
 * to the te-fleet-run-2 vintage: tier ladder Validated / In play
 * (directional) / Experimental / Queued replaces the graduation-era statuses.
 */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import {
  loadRecipeTracker,
  groupByFamily,
  tierBadgeLabel,
  type Recipe,
  type RecipeFamily,
} from "@/lib/recipe-tracker";

export const metadata: Metadata = {
  title: "Trend Tracker · QG Intelligence",
  description:
    "Live status board for all 71 QGI trends. Nine in play, thirty-five experimental, twenty-seven queued. Every trend must clear hard validation gates in held-out historical data before its scores carry weight.",
  alternates: { canonical: "https://qgintelligence.com/blog/trend-tracker" },
  openGraph: {
    title: "Trend Tracker · QG Intelligence",
    description:
      "Live status board for all 71 QGI trends: in play, experimental, and queued.",
    url: "https://qgintelligence.com/blog/trend-tracker",
    siteName: "QG Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Trend Tracker · QG Intelligence",
    description:
      "71 QGI trends: 9 in play, 35 experimental, 27 queued. Every score is gated on validation against held-out history.",
  },
};

// ---------------------------------------------------------------------------
// Sub-components (server — no client boundary needed)
// ---------------------------------------------------------------------------

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt
        className="text-[9px] tracking-widest uppercase font-semibold"
        style={{ color: accent ? "var(--qgi-success)" : "var(--qgi-text-dim)" }}
      >
        {label}
      </dt>
      <dd
        className="font-data tabular-nums text-sm font-semibold"
        style={{ color: accent ? "var(--qgi-success)" : "var(--qgi-text)" }}
      >
        {value}
      </dd>
    </div>
  );
}

function TierBadge({ tier }: { tier: Recipe["tier"] }) {
  const label = tierBadgeLabel(tier);
  const color: string =
    tier === "validated" || tier === "directional"
      ? "var(--qgi-success)"
      : tier === "experimental"
        ? "var(--qgi-text-muted)"
        : "var(--qgi-text-dim)";
  return (
    <span
      className="text-[9px] tracking-widest uppercase font-semibold"
      style={{ color }}
    >
      {label}
    </span>
  );
}

/** A trend that is in play: live scores on the dashboard, card links through. */
function InPlayCard({ recipe }: { recipe: Recipe }) {
  const stats = recipe.stats ?? {};
  const l1Color = recipe.l1_color;
  const href = `/trends/${recipe.recipe_id}` as Route;
  const ci =
    stats.ci95_lo !== undefined && stats.ci95_hi !== undefined
      ? `${stats.ci95_lo.toFixed(2)}–${stats.ci95_hi.toFixed(2)}`
      : null;

  return (
    <li>
      <Link
        href={href}
        aria-label={`${recipe.label}: in play, open the trend page`}
        className="block rounded-lg overflow-hidden transition-transform hover:-translate-y-0.5"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: `1px solid ${l1Color}40`,
          borderLeft: `3px solid ${l1Color}`,
          boxShadow: `0 0 16px ${l1Color}22, 0 1px 4px rgba(0,0,0,0.3)`,
        }}
      >
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="mb-1">
                <TierBadge tier={recipe.tier} />
              </div>
              <h3
                className="text-base font-semibold leading-tight"
                style={{ color: "var(--qgi-text)" }}
              >
                {recipe.label}
              </h3>
              {recipe.l2_label !== recipe.label && (
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {recipe.l2_label}
                </p>
              )}
            </div>
            {/* Arrow affordance */}
            <span
              className="text-sm mt-0.5 flex-shrink-0"
              style={{ color: l1Color }}
              aria-hidden="true"
            >
              &rarr;
            </span>
          </div>

          {/* Stats band */}
          <dl
            className="flex flex-wrap gap-x-5 gap-y-2 pt-3"
            style={{ borderTop: `1px solid ${l1Color}30` }}
          >
            {stats.loco_auc !== undefined && (
              <StatChip label="OOC score" value={stats.loco_auc.toFixed(2)} accent />
            )}
            {ci && <StatChip label="95% CI" value={ci} />}
            {stats.window_y !== undefined && (
              <StatChip label="Window" value={`${stats.window_y}y`} />
            )}
            {stats.n_indicators !== undefined && (
              <StatChip label="Signals" value={String(stats.n_indicators)} />
            )}
          </dl>

          {/* Reading note */}
          <p
            className="text-[10px] mt-3 leading-relaxed"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Out-of-country score on held-out history. Similarity, not a calibrated
            probability.
          </p>
        </div>
      </Link>
    </li>
  );
}

/** A trend walked in the current vintage that did not clear the gates. */
function ExperimentalCard({ recipe }: { recipe: Recipe }) {
  const l1Color = recipe.l1_color;

  return (
    <li>
      <div
        role="article"
        aria-label={`${recipe.label}: experimental, scores held back`}
        className="block rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: `1px solid ${l1Color}26`,
          borderLeft: `3px solid ${l1Color}80`,
          cursor: "default",
        }}
      >
        <div className="p-4">
          <div className="mb-1">
            <TierBadge tier={recipe.tier} />
          </div>
          <h3
            className="text-base font-semibold leading-tight"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {recipe.label}
          </h3>
          {recipe.l2_label !== recipe.label && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
              {recipe.l2_label}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function QueuedCard({ recipe }: { recipe: Recipe }) {
  const l1Color = recipe.l1_color;

  return (
    <li>
      <div
        role="article"
        aria-label={`${recipe.label}: queued, validation not yet started`}
        className="block rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: `1px solid ${l1Color}18`,
          borderLeft: `3px solid ${l1Color}30`,
          cursor: "default",
          opacity: 0.55,
        }}
      >
        <div className="p-4">
          <div className="mb-1">
            <TierBadge tier={recipe.tier} />
          </div>
          <h3
            className="text-sm font-medium leading-tight"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {recipe.label}
          </h3>
          {recipe.l2_label !== recipe.label && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
              {recipe.l2_label}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function TrendCard({ recipe }: { recipe: Recipe }) {
  if (recipe.tier === "directional" || recipe.tier === "validated")
    return <InPlayCard recipe={recipe} />;
  if (recipe.tier === "queued") return <QueuedCard recipe={recipe} />;
  return <ExperimentalCard recipe={recipe} />;
}

const TIER_ORDER: Record<Recipe["tier"], number> = {
  validated: 0,
  directional: 1,
  experimental: 2,
  queued: 3,
};

function FamilySection({ family }: { family: RecipeFamily }) {
  const ordered = [...family.recipes].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.label.localeCompare(b.label)
  );

  return (
    <section aria-labelledby={`family-${family.l1_id}`}>
      {/* Family header */}
      <div
        className="flex items-center gap-3 mb-5 pb-2"
        style={{ borderBottom: `1px solid ${family.l1_color}30` }}
      >
        <div
          className="w-2 h-6 rounded-sm flex-shrink-0"
          style={{ backgroundColor: family.l1_color }}
          aria-hidden="true"
        />
        <h2
          id={`family-${family.l1_id}`}
          className="text-sm font-semibold tracking-wider uppercase"
          style={{ color: family.l1_color }}
        >
          {family.l1_label}
        </h2>
        <span
          className="text-[11px] font-data tabular-nums ml-auto"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {family.recipes.length}
        </span>
      </div>

      {/* Card grid */}
      <ul
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
        }}
      >
        {ordered.map((recipe) => (
          <TrendCard key={recipe.recipe_id} recipe={recipe} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TrendTrackerPage() {
  const data = await loadRecipeTracker();
  const families = groupByFamily(data.recipes);

  const validatedCount = data.tier_counts.validated ?? 0;
  const inPlayCount = data.tier_counts.directional ?? 0;
  const experimentalCount = data.tier_counts.experimental ?? 0;
  const queuedCount = data.tier_counts.queued ?? 0;

  return (
    <div
      className="min-h-full"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Sticky header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "rgba(15, 25, 35, 0.85)",
        }}
      >
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <Link href={"/" as Route} className="flex items-baseline gap-1" title="Home">
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
            href={"/blog" as Route}
            className="text-xs tracking-wider uppercase"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            &larr; All posts
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* Page hero */}
        <div className="mb-12">
          {/* Eyebrow with LIVE badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[10px] tracking-widest uppercase font-semibold"
              style={{ color: "var(--qgi-accent)" }}
            >
              Blog
            </span>
            <span
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              &middot;
            </span>
            {/* LIVE badge */}
            <span className="flex items-center gap-1.5">
              <span
                className="qgi-live-dot"
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: "var(--qgi-success)",
                  animation: "qgi-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
              <span
                className="text-[10px] tracking-widest uppercase font-semibold"
                style={{ color: "var(--qgi-success)" }}
              >
                Live
              </span>
            </span>
          </div>

          <h1 className="text-3xl font-semibold mb-4">Trend Tracker</h1>

          {/* Status summary chips. validated (0 today) is deliberately merged
              into the "In play" chip; when the first trend clears every gate,
              add a separate "Validated" chip here rather than letting the
              count silently absorb it. */}
          <div className="flex flex-wrap gap-3 mb-8">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
              style={{
                backgroundColor: "rgba(52, 211, 153, 0.08)",
                border: "1px solid rgba(52, 211, 153, 0.2)",
              }}
            >
              <span
                className="font-data tabular-nums font-semibold"
                style={{ color: "var(--qgi-success)" }}
              >
                {inPlayCount + validatedCount}
              </span>
              <span style={{ color: "var(--qgi-text-muted)" }}>In play</span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
              style={{
                backgroundColor: "rgba(138, 166, 190, 0.08)",
                border: "1px solid rgba(138, 166, 190, 0.2)",
              }}
            >
              <span
                className="font-data tabular-nums font-semibold"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {experimentalCount}
              </span>
              <span style={{ color: "var(--qgi-text-muted)" }}>Experimental</span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
              style={{
                backgroundColor: "rgba(138, 166, 190, 0.06)",
                border: "1px solid rgba(138, 166, 190, 0.15)",
              }}
            >
              <span
                className="font-data tabular-nums font-semibold"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {queuedCount}
              </span>
              <span style={{ color: "var(--qgi-text-dim)" }}>Queued</span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
              style={{
                backgroundColor: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              <span
                className="font-data tabular-nums font-semibold"
                style={{ color: "var(--qgi-text)" }}
              >
                {data.n_recipes}
              </span>
              <span style={{ color: "var(--qgi-text-dim)" }}>Total</span>
            </div>
          </div>

          {/* Intro paragraph */}
          <div
            className="rounded-lg p-6"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderLeft: "3px solid var(--qgi-accent)",
            }}
          >
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              QGI reads every country against {data.n_recipes} trends, named patterns of
              geopolitical change, and every trend must earn its place on the dashboard by
              clearing validation gates in held-out historical data. This board is the
              index of that program.{" "}
              <strong style={{ color: "var(--qgi-text)" }}>
                {inPlayCount + validatedCount} trends are in play
              </strong>
              : they separate the years before an event from quiet years in countries the
              model never trained on, and they drive the live country scores on the
              dashboard.{" "}
              <strong style={{ color: "var(--qgi-text)" }}>
                {experimentalCount} are experimental
              </strong>
              : walked through the exact same gates without clearing them, so their scores
              stay off the dashboard. The remaining{" "}
              <strong style={{ color: "var(--qgi-text)" }}>
                {queuedCount} are queued
              </strong>{" "}
              for a future run. The bar is set in held-out history, and most trends will
              not clear it on a given walk: that is the point of having one. The board
              updates with every fleet run.
            </p>
          </div>
        </div>

        {/* Inline keyframe for the LIVE dot — scoped to this page */}
        <style>{`
          @keyframes qgi-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>

        {/* Family sections */}
        <div className="space-y-14">
          {families.map((family) => (
            <FamilySection key={family.l1_id} family={family} />
          ))}
        </div>

        {/* Footer */}
        <footer
          className="mt-16 pt-8 border-t text-xs"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-dim)",
          }}
        >
          <p>
            Updated {data.generated} &middot; vintage {data.vintage_current} &middot; QG
            Intelligence &middot; {data.n_recipes} trends across 8 families. Scores from
            trends in play are out-of-country similarity scores, not calibrated
            probabilities.
          </p>
          <p className="mt-2">
            <Link
              href={"/methodology" as Route}
              className="underline underline-offset-2 transition-colors"
              style={{ color: "var(--qgi-accent)" }}
            >
              Full methodology
            </Link>
            {" · "}
            <Link
              href={"/trends" as Route}
              className="underline underline-offset-2 transition-colors"
              style={{ color: "var(--qgi-accent)" }}
            >
              Browse the trend catalog
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
