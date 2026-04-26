import { loadCountryRisks } from "@/lib/country-risks";
import { signalCountryUrl, precedentSlugUrl } from "@/lib/recipes-aggregated";
import {
  loadCountryRecipeScores,
  loadRecipeBySlug,
} from "@/lib/recipes-aggregated-loader";
import { countrySlug } from "@/lib/slug";
import { CATEGORY_L1_MAP } from "@/lib/category-taxonomy";
import { CountryFlag } from "@/components/design/CountryFlag";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * #464 — `/signals/{country-slug}/{recipe-slug}`. Country-vs-Recipe
 * leaf: how does THIS country's trajectory match the canonical Recipe
 * for THIS event_category?
 *
 * Replaces the old `/countries/{id}/{cat}` (which now 301-redirects here).
 *
 * Week 2: similarity score is a placeholder from
 * `country-recipe-scores-mock.json`. Real V2.0 score from
 * `qgi_data.country_recipe_scores` lands in Week 3 (#463). Until then,
 * the analogue panel still consumes today's `analogues-enriched.json`
 * (no shape change), so the UI degrades gracefully.
 */

interface Props {
  params: Promise<{ country: string; slug: string }>;
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function resolveCountryBySlug(slug: string) {
  const data = await loadCountryRisks();
  for (const [id, c] of Object.entries(data.countries)) {
    if (countrySlug(c.name) === slug) {
      return { id, ...c };
    }
  }
  return null;
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
  const description = `${c.name}'s trajectory match against the canonical ${label} Recipe — similarity score, fingerprint coverage, historical analogues.`;
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

  const recipe = await loadRecipeBySlug(slug);
  const scoresFile = await loadCountryRecipeScores().catch(() => null);
  const score = scoresFile?.scores[country]?.[slug] ?? null;

  const label = formatCategory(slug);
  const l1 = CATEGORY_L1_MAP[slug];

  return (
    <div
      className="min-h-screen p-6 lg:p-10"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Breadcrumb */}
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

        {/* Hero */}
        <div className="flex items-start gap-4 flex-wrap">
          <CountryFlag alpha2={resolved.alpha_2} size={40} />
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] tracking-widest uppercase mb-1"
              style={{ color: "var(--qgi-accent)" }}
            >
              {l1 ? `L1-${l1.group}` : ""} Signal
            </div>
            <h1 className="text-3xl font-semibold leading-tight">
              {resolved.name} — {label}
            </h1>
          </div>
          <div className="text-right">
            <div
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Similarity
            </div>
            <div
              className="text-3xl font-semibold font-data"
              style={{
                color:
                  score == null
                    ? "var(--qgi-text-muted)"
                    : score >= 0.7
                      ? "#f87171"
                      : score >= 0.4
                        ? "#fbbf24"
                        : "var(--qgi-text-muted)",
              }}
            >
              {score == null ? "—" : score.toFixed(2)}
            </div>
            <div
              className="text-[9px] tracking-widest uppercase mt-1"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              MOCK · #463 wires real
            </div>
          </div>
        </div>

        {/* Recipe context */}
        {recipe && (
          <div
            className="rounded-lg border p-6"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            <div
              className="text-[10px] tracking-widest uppercase mb-3"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Recipe context
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  Canonical length
                </div>
                <div className="text-xl font-semibold font-data">
                  {recipe.canonical_length}yr
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  Total instances
                </div>
                <div className="text-xl font-semibold font-data">
                  {recipe.total_instances.toLocaleString()}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  Distinct pairs
                </div>
                <div className="text-xl font-semibold font-data">
                  {recipe.n_distinct_country_pairs}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  OECD share
                </div>
                <div className="text-xl font-semibold font-data">
                  {(recipe.coverage_bias_diagnostic.oecd_share * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href={precedentSlugUrl(slug)}
                className="text-[11px] tracking-widest uppercase hover:text-[var(--qgi-accent)] transition-colors"
                style={{ color: "var(--qgi-accent)" }}
              >
                See full Recipe →
              </Link>
            </div>
          </div>
        )}

        <p
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Mock data — real similarity score ships in Week 3 (#463). Analogue panel will be
          wired in once {recipe ? `${slug}` : "this category"} is in
          `analogues-enriched.json` (today&apos;s pipeline output — unchanged).
        </p>
      </div>
    </div>
  );
}
