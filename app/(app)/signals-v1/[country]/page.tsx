import { resolveCountryBySlug } from "@/lib/country-risks";
import { signalCountryRecipeUrl } from "@/lib/recipes-aggregated";
import { getCountrySignals } from "@/lib/recipes-aggregated-loader";
import { CATEGORY_L1_MAP } from "@/lib/category-taxonomy";
import { CountryFlag } from "@/components/design/CountryFlag";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * #464 — `/signals-v1/{country-slug}`. Country-rolled-up watchlist:
 * every signal firing on this country, sortable. Default sort:
 * similarity score desc.
 *
 * Week 2: similarity scores are placeholders from
 * `data/country-recipe-scores-mock.json`. Week 3 swaps to the real
 * `qgi_data.country_recipe_scores` table (#463) without route changes.
 */

interface Props {
  params: Promise<{ country: string }>;
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const c = await resolveCountryBySlug(country);
  if (!c) {
    return {
      title: "Page not found · QG Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const description = `Active signals on ${c.name}: every Recipe currently firing, ranked by similarity to the historical fingerprint.`;
  const canonical = `https://qgintelligence.com/signals-v1/${country}`;
  return {
    title: `${c.name} · Signals · QG Intelligence`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${c.name} · Signals`,
      description,
      url: canonical,
      siteName: "QG Intelligence",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${c.name} · Signals`,
      description,
    },
  };
}

export default async function SignalCountryPage({ params }: Props) {
  const { country } = await params;
  const resolved = await resolveCountryBySlug(country);
  if (!resolved) notFound();

  const signals = await getCountrySignals(country).catch(() => []);

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
            href="/signals-v1"
            className="transition-colors hover:text-[var(--qgi-accent)]"
          >
            Signals
          </Link>
          {" / "}
          <span style={{ color: "var(--qgi-text-muted)" }}>{resolved.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <CountryFlag alpha2={resolved.alpha_2} size={40} />
          <div>
            <div
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Active Signals
            </div>
            <h1 className="text-3xl font-semibold leading-tight">{resolved.name}</h1>
          </div>
          <div className="ml-auto text-right">
            <div
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Country tier
            </div>
            <div
              className="text-lg font-semibold font-data"
              style={{
                color:
                  resolved.overall_risk_tier === "HIGH"
                    ? "#f87171"
                    : resolved.overall_risk_tier === "MODERATE"
                      ? "#fbbf24"
                      : "#38bdf8",
              }}
            >
              {resolved.overall_risk_tier}
            </div>
          </div>
        </div>

        {/* Signals table */}
        {signals.length === 0 ? (
          <div
            className="rounded-lg border p-6 text-center"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-muted)",
            }}
          >
            No active signals. Mock-data scope only — real similarity scores wire up in
            Week 3 with #463.
          </div>
        ) : (
          <div
            className="rounded-lg border overflow-hidden"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-[10px] tracking-widest uppercase font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  <th className="text-left p-4">Recipe</th>
                  <th className="text-right p-4">Similarity</th>
                  <th className="text-right p-4 hidden md:table-cell">L1</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => {
                  const label = formatCategory(s.event_category);
                  const l1 = CATEGORY_L1_MAP[s.event_category];
                  return (
                    <tr
                      key={s.event_category}
                      className="border-t transition-colors hover:bg-[var(--qgi-surface-2)]"
                      style={{ borderColor: "var(--qgi-border)" }}
                    >
                      <td className="p-4">
                        <Link
                          href={signalCountryRecipeUrl(country, s.event_category)}
                          className="hover:text-[var(--qgi-accent)] transition-colors"
                        >
                          {label}
                        </Link>
                      </td>
                      <td
                        className="p-4 text-right font-data font-semibold"
                        style={{
                          color:
                            s.score >= 0.7
                              ? "#f87171"
                              : s.score >= 0.4
                                ? "#fbbf24"
                                : "var(--qgi-text-muted)",
                        }}
                      >
                        {s.score.toFixed(2)}
                      </td>
                      <td
                        className="p-4 text-right hidden md:table-cell text-[10px] tracking-widest uppercase font-data"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        {l1?.group ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Mock data — real similarity scores ship in Week 3 (#463). Sorted by score desc.
        </p>
      </div>
    </div>
  );
}
