import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import {
  loadRecipeTracker,
  groupByFamily,
  tierLabel,
  type Recipe,
  type RecipeFamily,
} from "@/lib/recipe-tracker";

export const metadata: Metadata = {
  title: "Recipe Tracker · QG Intelligence",
  description:
    "Live status board for all 71 QGI recipes. One graduated. One in progress. Five in validation. Sixty-four queued. Graduation requires clearing hard validation gates in held-out historical data, and most candidates will not.",
  alternates: { canonical: "https://qgintelligence.com/blog/recipe-tracker" },
  openGraph: {
    title: "Recipe Tracker · QG Intelligence",
    description:
      "Live status board for all 71 QGI recipes: graduated, in validation, and queued.",
    url: "https://qgintelligence.com/blog/recipe-tracker",
    siteName: "QG Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Recipe Tracker · QG Intelligence",
    description:
      "71 QGI recipes: 1 graduated, 1 in progress, 5 in validation, 64 queued. Graduation requires cleared hard validation gates.",
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

function TierBadge({ status }: { status: Recipe["status"] }) {
  const label = tierLabel(status);
  const color: string =
    status === "graduated"
      ? "var(--qgi-success)"
      : status === "queued"
        ? "var(--qgi-text-dim)"
        : "var(--qgi-warning)";
  return (
    <span
      className="text-[9px] tracking-widest uppercase font-semibold"
      style={{ color }}
    >
      {label}
    </span>
  );
}

function VerdictChip({ verdict }: { verdict: string }) {
  return (
    <span
      className="inline-block text-[9px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded"
      style={{
        color: "var(--qgi-danger)",
        backgroundColor: "rgba(248, 113, 113, 0.08)",
        border: "1px solid rgba(248, 113, 113, 0.2)",
      }}
    >
      {verdict}
    </span>
  );
}

function GraduatedCard({ recipe }: { recipe: Recipe }) {
  const stats = recipe.stats!;
  const blogUrl = stats.blog_url as Route;
  const l1Color = recipe.l1_color;

  return (
    <li>
      <Link
        href={blogUrl}
        aria-label={`${recipe.label}: graduated recipe, read the full graduation post`}
        className="block rounded-lg overflow-hidden transition-transform hover:-translate-y-0.5"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: `1px solid ${l1Color}40`,
          borderLeft: `3px solid ${l1Color}`,
          boxShadow: `0 0 16px ${l1Color}33, 0 1px 4px rgba(0,0,0,0.3)`,
        }}
      >
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="mb-1">
                <TierBadge status={recipe.status} />
              </div>
              <h3
                className="text-base font-semibold leading-tight group-hover:underline"
                style={{ color: "var(--qgi-text)" }}
              >
                {recipe.label}
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
                {recipe.l2_label}
              </p>
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
              <StatChip label="LOCO-AUC" value={stats.loco_auc.toFixed(4)} accent />
            )}
            {stats.window_y !== undefined && (
              <StatChip label="Window" value={`${stats.window_y}y`} />
            )}
            {stats.n_indicators !== undefined && (
              <StatChip label="Indicators" value={String(stats.n_indicators)} />
            )}
            {stats.n_countries_scored !== undefined && (
              <StatChip label="Countries" value={String(stats.n_countries_scored)} />
            )}
          </dl>

          {/* Discrimination note */}
          <p
            className="text-[10px] mt-3 leading-relaxed"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Similarity score, not calibrated probability. Two hard validation gates
            cleared.
          </p>
        </div>
      </Link>
    </li>
  );
}

function InValidationCard({ recipe }: { recipe: Recipe }) {
  const l1Color = recipe.l1_color;
  // Show the honest verdict chip whenever the recipe carries one — including
  // live_legacy recipes like civil_war_and_insurgency that are on the dashboard
  // via the earlier pathway but HARD_FAILED F-ML-1 re-validation. Per M8-R5,
  // a HARD_FAIL must never be sugar-coated into a plain "In Validation" card.
  const showVerdict = recipe.stats?.verdict !== undefined;

  return (
    <li>
      <div
        role="article"
        aria-label={`${recipe.label}: in validation, not yet clickable`}
        className="block rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: `1px solid ${l1Color}26`,
          borderLeft: `3px solid ${l1Color}80`,
          cursor: "not-allowed",
        }}
      >
        <div className="p-4">
          <div className="mb-1">
            <TierBadge status={recipe.status} />
          </div>
          <h3
            className="text-base font-semibold leading-tight"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {recipe.label}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
            {recipe.l2_label}
          </p>
          {showVerdict && recipe.stats?.verdict && (
            <div className="mt-3">
              <VerdictChip verdict={recipe.stats.verdict} />
            </div>
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
          cursor: "not-allowed",
          opacity: 0.55,
        }}
      >
        <div className="p-4">
          <div className="mb-1">
            <TierBadge status={recipe.status} />
          </div>
          <h3
            className="text-sm font-medium leading-tight"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {recipe.label}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
            {recipe.l2_label}
          </p>
        </div>
      </div>
    </li>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  if (recipe.status === "graduated") return <GraduatedCard recipe={recipe} />;
  if (recipe.status === "queued") return <QueuedCard recipe={recipe} />;
  return <InValidationCard recipe={recipe} />;
}

function FamilySection({ family }: { family: RecipeFamily }) {
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
        {family.recipes.map((recipe) => (
          <RecipeCard key={recipe.recipe_id} recipe={recipe} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RecipeTrackerPage() {
  const data = await loadRecipeTracker();
  const families = groupByFamily(data.recipes);

  const graduatedCount = data.status_counts.graduated ?? 0;
  const inProgressCount = data.status_counts.in_progress ?? 0;
  const inValidationCount =
    (data.status_counts.live_legacy ?? 0) +
    (data.status_counts.walked_no_graduation ?? 0);
  const queuedCount = data.status_counts.queued ?? 0;

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

          <h1 className="text-3xl font-semibold mb-4">Recipe Tracker</h1>

          {/* Status summary chips */}
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
                {graduatedCount}
              </span>
              <span style={{ color: "var(--qgi-text-muted)" }}>Graduated</span>
            </div>
            {inProgressCount > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
                style={{
                  backgroundColor: "rgba(56, 189, 248, 0.08)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                }}
              >
                <span
                  className="qgi-live-dot"
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "var(--qgi-accent)",
                    animation: "qgi-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }}
                />
                <span
                  className="font-data tabular-nums font-semibold"
                  style={{ color: "var(--qgi-accent)" }}
                >
                  {inProgressCount}
                </span>
                <span style={{ color: "var(--qgi-text-muted)" }}>In Progress</span>
              </div>
            )}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
              style={{
                backgroundColor: "rgba(251, 191, 36, 0.08)",
                border: "1px solid rgba(251, 191, 36, 0.2)",
              }}
            >
              <span
                className="font-data tabular-nums font-semibold"
                style={{ color: "var(--qgi-warning)" }}
              >
                {inValidationCount}
              </span>
              <span style={{ color: "var(--qgi-text-muted)" }}>In Validation</span>
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

          {/* Intro paragraph — Ingrid's voice */}
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
              QGI works with {data.n_recipes} recipes, named patterns of geopolitical
              change, each requiring validation against historical data before any score
              derived from it is published. This tracker is the index of that program. A
              recipe is <strong style={{ color: "var(--qgi-text)" }}>Graduated</strong>{" "}
              when it has cleared two hard validation gates in held-out historical data:
              discriminating pre-crisis trajectories from non-crisis ones, and recovering
              a minimum share of holdout events in an out-of-time test. One recipe has
              cleared those gates:{" "}
              <strong style={{ color: "var(--qgi-text)" }}>Foreign Intervention</strong>.
              {inProgressCount > 0 && (
                <>
                  {" "}
                  <strong style={{ color: "var(--qgi-accent)" }}>
                    Elections &amp; Voting
                  </strong>{" "}
                  is <strong style={{ color: "var(--qgi-accent)" }}>In Progress</strong>:
                  a validation walk is running against it as this board updates.
                </>
              )}{" "}
              {inValidationCount} recipes are{" "}
              <strong style={{ color: "var(--qgi-text)" }}>In Validation</strong>: either
              live on the dashboard via an earlier scoring pathway, or walked through the
              ML framework without clearing all gates; their scores are not yet
              methodology-certified. The remaining {queuedCount} are{" "}
              <strong style={{ color: "var(--qgi-text)" }}>Queued</strong>: the validation
              framework has not been applied to them yet. Most will not graduate on the
              first walk: that is the point of having gates. QGI publishes what it has
              validated, not what it expects to validate.
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
            Generated {data.generated} &middot; QG Intelligence &middot; {data.n_recipes}{" "}
            recipes across 8 families. Graduation requires two cleared hard validation
            gates in held-out historical data. Scores derived from graduated recipes are
            similarity scores, not calibrated probabilities.
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
              href={"/blog/foreign-intervention-graduation" as Route}
              className="underline underline-offset-2 transition-colors"
              style={{ color: "var(--qgi-accent)" }}
            >
              Foreign Intervention graduation post
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
