import { resolveCountryBySlug } from "@/lib/country-risks";
import {
  signalCountryUrl,
  precedentSlugUrl,
  type RecipeAggregated,
} from "@/lib/recipes-aggregated";
import {
  loadCountryRecipeScores,
  loadRecipeBySlug,
} from "@/lib/recipes-aggregated-loader";
import { loadTrajectoryPanelData } from "@/lib/signals-trajectory";
import { filterDemographic3 } from "@/lib/demographic-3-suppression";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import { CountryFlag } from "@/components/design/CountryFlag";
import { RciBadge } from "@/components/design/RciBadge";
import { getRecipeConfidence } from "@/lib/recipe-confidence";
import { SignalFingerprintPanel } from "@/components/signals/SignalFingerprintPanel";
import { SignalTrajectoryPanel } from "@/components/signals/SignalTrajectoryPanel";
import { SignalAnaloguesTable } from "@/components/signals/SignalAnaloguessTable";
import type { AnalogueEntry } from "@/components/signals/SignalAnaloguessTable";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { promises as fs } from "fs";
import path from "path";

/**
 * ISR: cache this page for 1 hour. Athena queries in loadTrajectoryPanelData
 * are expensive on cold start (~2-4s); ISR ensures only the first visitor per
 * hour pays that cost. Graceful degradation means the page still renders even
 * if Athena times out — the trajectory panel shows "unavailable" instead of
 * causing a 500.
 */
export const revalidate = 3600;

/**
 * /signals/{country-slug}/{recipe-slug} — Persona-redesigned leaf page.
 *
 * Redesigned by Yuki Takahashi-Rowe (Product) + Dr. Lena Hadid-Marchetti
 * (UX-stats) on 2026-05-01 (feat/signals-redesign-personas-20260501).
 * Trajectory panel added 2026-05-01 (feat/signals-trajectory-plots-20260501).
 *
 * Key panels:
 *   1. Hero: flag, title, RCI badge, similarity score with semantic tier label
 *   2. Recipe metadata stripe: canonical length, instances, pairs, OECD share,
 *      pattern window (event range from analogues subject data)
 *   3. Fingerprint panel: top-8 indicators by TF-IDF as horizontal bars with
 *      Wilson CI whiskers
 *   4. Indicator Trajectory Panel (NEW): top-4 fingerprint indicators plotted
 *      as z-scored trajectories (years-from-pattern-end axis) with canonical
 *      reference overlay from the highest-PPS recipe instance. Predicted values
 *      shown as dashed line. ISR-cached for 1h; degrades gracefully if Athena
 *      is unavailable.
 *   5. CTA: link to full Recipe (/precedents/[slug])
 *   6. Historical analogues table: ranked by PPS, event_in_window highlighted
 *   7. Coverage bias note: collapsible diagnostic footer
 *
 * Data sources:
 *   - data/country-recipe-scores.json — similarity score
 *   - data/recipes-aggregated.json — fingerprint + recipe metadata
 *   - data/recipe-confidence.json — RCI tier
 *   - data/analogues-enriched.json — historical analogues
 *   - Athena qgi_data.indicators_completed — country + reference trajectories
 *   - Athena qgi_data.recipes — top-PPS recipe instance for canonical reference
 */

interface Props {
  params: Promise<{ country: string; slug: string }>;
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Semantic label for the similarity score — Yuki's "3-second scan" layer. */
function similarityLabel(score: number): { label: string; color: string } {
  if (score >= 0.75) return { label: "Strong alignment", color: "#f87171" };
  if (score >= 0.55) return { label: "Partial alignment", color: "#fbbf24" };
  if (score >= 0.35) return { label: "Weak signal", color: "#7a90a8" };
  return { label: "Below threshold", color: "#4a6280" };
}

/** Load analogues-enriched.json and look up (countryId, category). */
async function loadAnalogues(
  countryId: string,
  category: string
): Promise<{
  analogues: AnalogueEntry[];
  subjectEventRange: [number, number] | null;
  subjectEventYear: number | null;
  subjectEventTitle: string | null;
}> {
  try {
    const filePath = path.join(process.cwd(), "data", "analogues-enriched.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as {
      countries: Record<
        string,
        Record<
          string,
          {
            subject: {
              subject_event_year_a?: number;
              subject_event_title_a?: string;
              subject_event_range_a?: [number, number];
            };
            analogues: AnalogueEntry[];
            canonical_length?: number;
          }
        >
      >;
    };
    const entry = data.countries[countryId]?.[category];
    if (!entry) {
      return {
        analogues: [],
        subjectEventRange: null,
        subjectEventYear: null,
        subjectEventTitle: null,
      };
    }
    return {
      analogues: entry.analogues ?? [],
      subjectEventRange: entry.subject.subject_event_range_a ?? null,
      subjectEventYear: entry.subject.subject_event_year_a ?? null,
      subjectEventTitle: entry.subject.subject_event_title_a ?? null,
    };
  } catch {
    return {
      analogues: [],
      subjectEventRange: null,
      subjectEventYear: null,
      subjectEventTitle: null,
    };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, slug } = await params;
  const c = await resolveCountryBySlug(country);
  if (!c || !(slug in CATEGORY_L1_MAP)) {
    return {
      title: "Page not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const label = formatCategory(slug);
  const description = `${c.name}'s trajectory match against the canonical ${label} Recipe — similarity score, fingerprint indicators, and historical analogues.`;
  const canonical = `https://qgintelligence.com/signals/${country}/${slug}`;
  return {
    title: `${c.name} — ${label} Signal — QGI Intelligence`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${c.name} — ${label} Signal`,
      description,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${c.name} — ${label} Signal`,
      description,
    },
  };
}

export default async function SignalCountryRecipePage({ params }: Props) {
  const { country, slug } = await params;

  const resolved = await resolveCountryBySlug(country);
  if (!resolved) notFound();
  if (!(slug in CATEGORY_L1_MAP)) notFound();

  // Load all data in parallel. Trajectory data hits Athena — it's
  // wrapped in a .catch() so it never blocks the page render.
  const [recipe, scoresFile, analogueData] = await Promise.all([
    loadRecipeBySlug(slug),
    loadCountryRecipeScores().catch(() => null),
    loadAnalogues(resolved.id, slug),
  ]);

  // Load trajectory data after recipe is resolved (we need fingerprint + canonical_length).
  // Runs as a separate async operation that degrades gracefully to null.
  //
  // M5 phase 1 (2026-05-01): filter Demographic 3 from the fingerprint BEFORE
  // it drives which trajectories are loaded. Otherwise the top-4 trajectory
  // slots get wasted on Population / Life Expectancy curves that look
  // monotonic and contribute no risk signal.
  // #624: pass the full RecipeAggregated so loadTrajectoryPanelData can
  // read pre-baked canonical_country_b_id/name/start_year_b instead of
  // running an unpartitioned Athena scan against qgi_data.recipes.
  // Demographic-3 suppression still applied to the fingerprint here so
  // the top-4 trajectory slots don't get wasted on Population / Life
  // Expectancy curves (M5 phase 1, 2026-05-01).
  const trajectoryData = recipe
    ? await loadTrajectoryPanelData(resolved.name, {
        ...recipe,
        indicator_fingerprint: filterDemographic3(recipe.indicator_fingerprint),
      }).catch(() => null)
    : null;

  const score = scoresFile?.scores[country]?.[slug] ?? null;
  const confidence = getRecipeConfidence(slug);
  const label = formatCategory(slug);
  const l1 = CATEGORY_L1_MAP[slug];
  const l1Group = L1_GROUPS.find((g) => g.code === l1?.group);
  const simInfo = score != null ? similarityLabel(score) : null;

  const { analogues, subjectEventRange, subjectEventYear, subjectEventTitle } =
    analogueData;

  return (
    <div
      className="min-h-screen p-4 md:p-6 lg:p-10"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <div
          className="text-[11px] tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <Link
            href="/signals"
            className="transition-colors hover:text-[var(--qgi-accent)]"
          >
            Signals
          </Link>
          {" / "}
          <Link
            href={signalCountryUrl(country)}
            className="transition-colors hover:text-[var(--qgi-accent)]"
          >
            {resolved.name}
          </Link>
          {" / "}
          <span style={{ color: "var(--qgi-text-muted)" }}>{label}</span>
        </div>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div
          className="rounded-lg border p-5 md:p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Left: identity */}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <CountryFlag
                alpha2={resolved.alpha_2}
                size={40}
                countryName={resolved.name}
              />
              <div className="flex-1 min-w-0">
                {/* Domain chip + RCI */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {l1Group && (
                    <span
                      className="text-[9px] tracking-widest uppercase px-2 py-0.5 rounded font-semibold"
                      style={{
                        color: l1Group.color,
                        backgroundColor: `${l1Group.color}18`,
                        border: `1px solid ${l1Group.color}40`,
                      }}
                    >
                      {l1Group.shortLabel} · L1-{l1Group.code}
                    </span>
                  )}
                  <RciBadge entry={confidence} size="sm" />
                </div>
                <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
                  {resolved.name}
                  <span
                    className="mx-2 font-light"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    —
                  </span>
                  {label}
                </h1>
                {/* Subject event context */}
                {subjectEventTitle && subjectEventYear && (
                  <p
                    className="mt-1.5 text-[11px] leading-snug"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    Reference event:{" "}
                    <span style={{ color: "var(--qgi-text)" }}>{subjectEventTitle}</span>{" "}
                    <span style={{ color: "var(--qgi-text-dim)" }}>
                      ({subjectEventYear})
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Right: similarity score block */}
            <div
              className="flex-shrink-0 text-right sm:text-right flex flex-col items-end"
              style={{ minWidth: 120 }}
            >
              <div
                className="text-[9px] tracking-widest uppercase mb-1"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Recipe Similarity
              </div>
              {score != null ? (
                <>
                  <div
                    className="text-4xl font-semibold font-data leading-none"
                    style={{ color: simInfo?.color ?? "var(--qgi-text)" }}
                  >
                    {score.toFixed(2)}
                  </div>
                  <div
                    className="text-[10px] tracking-wider mt-1 font-semibold uppercase"
                    style={{ color: simInfo?.color ?? "var(--qgi-text)" }}
                  >
                    {simInfo?.label}
                  </div>
                </>
              ) : (
                <div
                  className="text-3xl font-semibold font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  —
                </div>
              )}
              {score == null && (
                <div className="text-[9px] mt-1" style={{ color: "var(--qgi-text-dim)" }}>
                  Score suppressed
                </div>
              )}
            </div>
          </div>

          {/* Score suppressed explanation */}
          {score == null && (
            <div
              className="mt-4 p-3 rounded text-[11px]"
              style={{
                backgroundColor: "rgba(74,98,128,0.15)",
                borderLeft: "3px solid var(--qgi-text-dim)",
                color: "var(--qgi-text-muted)",
              }}
            >
              Similarity score is not available for this country-recipe pair. This may
              indicate insufficient indicator coverage in the pipeline for this
              combination.
            </div>
          )}
        </div>

        {/* ── Recipe Metadata Stripe ─────────────────────────────────────── */}
        {recipe && (
          <div
            className="rounded-lg border p-4 md:p-5"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            <div
              className="text-[10px] tracking-widest uppercase mb-3"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Recipe Context
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCell
                label="Canonical Length"
                value={`${recipe.canonical_length}yr`}
                hint="Median window length across all recipe instances"
              />
              <StatCell
                label="Total Instances"
                value={recipe.total_instances.toLocaleString()}
                hint="Number of country-year windows in the recipe corpus"
              />
              <StatCell
                label="Distinct Pairs"
                value={recipe.n_distinct_country_pairs.toLocaleString()}
                hint="Unique country pairs contributing to this recipe"
              />
              <StatCell
                label="OECD Share"
                value={`${(recipe.coverage_bias_diagnostic.oecd_share * 100).toFixed(0)}%`}
                hint="Share of recipe instances from OECD countries — lower = more globally representative"
              />
            </div>

            {/* Pattern window context line */}
            <div
              className="mt-4 pt-3 text-[11px] flex flex-wrap gap-x-4 gap-y-1"
              style={{
                borderTop: "1px solid var(--qgi-border)",
                color: "var(--qgi-text-muted)",
              }}
            >
              <span>
                <span style={{ color: "var(--qgi-text-dim)" }}>Pattern window:</span>{" "}
                <span
                  className="font-data font-semibold"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {recipe.canonical_length}yr
                </span>{" "}
                canonical
              </span>
              {subjectEventRange && (
                <span>
                  <span style={{ color: "var(--qgi-text-dim)" }}>
                    {resolved.name} event range:
                  </span>{" "}
                  <span
                    className="font-data font-semibold"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {subjectEventRange[0]}–{subjectEventRange[1]}
                  </span>{" "}
                  <span style={{ color: "var(--qgi-text-dim)" }}>
                    ({subjectEventRange[1] - subjectEventRange[0]}yr span)
                  </span>
                </span>
              )}
              {recipe.contains_predicted && (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: "var(--qgi-warning)" }}
                >
                  <span>⚠</span>
                  <span className="text-[9px] tracking-wider uppercase">
                    Contains predicted values
                  </span>
                </span>
              )}
              {!recipe.contains_predicted && (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: "var(--qgi-success)" }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--qgi-success)", opacity: 0.8 }}
                  />
                  <span className="text-[9px] tracking-wider uppercase">
                    Observed data only
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Fingerprint Panel ─────────────────────────────────────────── */}
        {recipe && recipe.indicator_fingerprint.length > 0 && (
          <SignalFingerprintPanel fingerprint={recipe.indicator_fingerprint} />
        )}

        {/* ── Indicator Trajectory Panel ────────────────────────────────── */}
        {/* Inserted between Fingerprint and Analogues per Yuki+Lena design.
            Renders even when trajectoryData=null — the component handles
            the graceful "unavailable" fallback internally. */}
        {recipe && (
          <SignalTrajectoryPanel
            data={trajectoryData}
            countryName={resolved.name}
            eventCategory={slug}
          />
        )}

        {/* ── CTA to full Recipe ────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px]" style={{ color: "var(--qgi-text-muted)" }}>
            Want the full global picture for this event pattern?
          </p>
          <Link
            href={precedentSlugUrl(slug)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border text-[11px] tracking-wider uppercase font-semibold transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              borderColor: "var(--qgi-accent)",
              color: "var(--qgi-accent)",
            }}
          >
            See full Recipe
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* ── Historical Analogues ──────────────────────────────────────── */}
        <SignalAnaloguesTable analogues={analogues} subjectCountryName={resolved.name} />

        {/* ── Coverage Bias Note ────────────────────────────────────────── */}
        {recipe && <CoverageBiasNote recipe={recipe} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (page-local, no need to extract to files)
// ---------------------------------------------------------------------------

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div title={hint}>
      <div
        className="text-[9px] uppercase tracking-wider mb-0.5"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-xl font-semibold font-data"
        style={{ color: "var(--qgi-text)" }}
      >
        {value}
      </div>
    </div>
  );
}

function CoverageBiasNote({
  recipe,
}: {
  recipe: Pick<RecipeAggregated, "coverage_bias_diagnostic" | "last_recomputed_at">;
}) {
  const { n_pairs, oecd_share, regional_concentration } = recipe.coverage_bias_diagnostic;

  return (
    <details
      className="rounded-lg border group"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <summary
        className="px-5 py-3 text-[10px] tracking-widest uppercase cursor-pointer list-none flex items-center gap-2"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <span
          className="transition-transform group-open:rotate-90 inline-block"
          aria-hidden="true"
        >
          ▶
        </span>
        Coverage Bias Diagnostic
      </summary>
      <div
        className="px-5 pb-4 text-[11px] space-y-2"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        <p>
          This Recipe is built from{" "}
          <span className="font-data font-semibold" style={{ color: "var(--qgi-text)" }}>
            {n_pairs.toLocaleString()}
          </span>{" "}
          country pairs.{" "}
          <span
            className="font-data"
            style={{
              color: oecd_share > 0.5 ? "var(--qgi-warning)" : "var(--qgi-text)",
            }}
          >
            {(oecd_share * 100).toFixed(0)}%
          </span>{" "}
          are OECD countries
          {oecd_share > 0.5 ? (
            <span style={{ color: "var(--qgi-warning)" }}>
              {" "}
              — above 50% OECD share; interpret with caution for non-OECD contexts.
            </span>
          ) : (
            " — globally representative coverage."
          )}
        </p>
        {regional_concentration.length > 0 && (
          <p>
            Regional concentration:{" "}
            {regional_concentration
              .map((r) => `${r.region} (${(r.share * 100).toFixed(0)}%)`)
              .join(", ")}
            .
          </p>
        )}
        <p style={{ color: "var(--qgi-text-dim)" }}>
          Last recomputed: {recipe.last_recomputed_at}
        </p>
      </div>
    </details>
  );
}
