"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
import { RciBadge } from "@/components/design/RciBadge";
import { signalCountryRecipeUrl, type RecipeAggregated } from "@/lib/recipes-aggregated";
import { getRecipeConfidence } from "@/lib/recipe-confidence";
import { filterDemographic3 } from "@/lib/demographic-3-suppression";
import indexesData from "@/data/indexes.json";
import {
  buildIndicatorNameLookup,
  isBakedUnknown,
} from "@/lib/indicator-numeric-supplement";

// #470 item 2 (option c per Sonnet consult): build a numeric_id → name
// lookup once at module load. indexes.json is the curated indicator
// catalog (260 entries, ~2 KB), already imported elsewhere in the
// frontend. Lookup is O(1) per render. See [#473](https://github.com/AminAlAit/qgi-aws-tf/issues/473) for the FAOSTAT
// trigger that would push us to a Glue JOIN or a CI-enforced sync.
//
// 2026-05-17: same supplement-overlay as the V3 dossier — V1 reads the
// same `recipes-aggregated.json`, so it had the identical "(unknown N)"
// symptom for the 21 legacy ids. See lib/indicator-numeric-supplement.ts
// for the root-cause write-up.
const INDICATOR_NAME_BY_ID = buildIndicatorNameLookup(
  (indexesData as Array<{ numeric_id: number; name: string }>)
    .filter((idx) => typeof idx.numeric_id === "number" && idx.name)
    .map((idx) => [idx.numeric_id, idx.name] as const)
);

/**
 * #464 — `/precedents-v1/{slug}` client. Renders one Recipe (one L3 category):
 * canonical_length + length_distribution + indicator_fingerprint with
 * uncertainty + coverage_bias_diagnostic + currently-flagged countries
 * (link to `/signals-v1/{country}/{slug}`).
 *
 * Mock-data scope: scores from `country-recipe-scores-mock.json`. Real
 * scores from `qgi_data.country_recipe_scores` ship in #463 (Week 3).
 */

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FlaggedCountry {
  countrySlug: string;
  name: string;
  alpha_2: string;
  score: number;
  tier: string;
}

interface Props {
  recipe: RecipeAggregated;
  flaggedCountries: FlaggedCountry[];
}

const TIER_COLORS: Record<string, string> = {
  HIGH: "#f87171",
  MODERATE: "#fbbf24",
  INDICATIVE: "#38bdf8",
};

export function PrecedentSlugClient({ recipe, flaggedCountries }: Props) {
  const label = formatCategory(recipe.event_category);
  const confidence = getRecipeConfidence(recipe.event_category);

  // Length distribution stats for the dispersion narrative.
  const lengths = recipe.length_distribution;
  const totalCount = lengths.reduce((s, b) => s + b.count, 0);
  const minLen = lengths.length > 0 ? lengths[0].length : 0;
  const maxLen = lengths.length > 0 ? lengths[lengths.length - 1].length : 0;
  const maxBucket = Math.max(...lengths.map((b) => b.count), 1);

  return (
    <div
      className="min-h-screen p-6 lg:p-10"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Breadcrumb */}
        <div
          className="text-[11px] tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <Link
            href="/precedents-v1"
            className="transition-colors hover:text-[var(--qgi-accent)]"
          >
            Precedents
          </Link>
          {" / "}
          <span style={{ color: "var(--qgi-text-muted)" }}>{label}</span>
        </div>

        {/* Hero */}
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--qgi-accent)" }}
            >
              Recipe · L3 category
            </div>
            <RciBadge entry={confidence} size="sm" />
          </div>
          <h1 className="text-3xl font-semibold leading-tight mb-2">{label}</h1>
          <p
            className="text-sm leading-relaxed max-w-2xl"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Canonical pattern length {recipe.canonical_length} years, drawn from{" "}
            {recipe.total_instances.toLocaleString()} historical instances across{" "}
            {recipe.n_distinct_country_pairs} distinct country pairs.
            {recipe.contains_predicted && " Includes forecast indicator-years."}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Canonical length" value={`${recipe.canonical_length}yr`} />
          <Stat label="Total instances" value={recipe.total_instances.toLocaleString()} />
          <Stat
            label="Distinct pairs"
            value={recipe.n_distinct_country_pairs.toString()}
          />
          <Stat
            label="OECD share"
            value={`${(recipe.coverage_bias_diagnostic.oecd_share * 100).toFixed(0)}%`}
          />
        </div>

        {/* Length distribution */}
        {lengths.length > 0 && (
          <Section title="Length distribution">
            <div className="text-[11px] mb-3" style={{ color: "var(--qgi-text-muted)" }}>
              {totalCount} instances span {minLen}–{maxLen} years. The canonical{" "}
              {recipe.canonical_length}-year point estimate hides dispersion; report the
              full histogram below.
            </div>
            <div className="space-y-1">
              {lengths.map((b) => (
                <div
                  key={b.length}
                  className="flex items-center gap-3 text-[11px] font-data"
                >
                  <div
                    className="w-12 text-right tabular-nums"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {b.length}yr
                  </div>
                  <div
                    className="flex-1 h-3 rounded-sm"
                    style={{ backgroundColor: "var(--qgi-surface-2)" }}
                  >
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${(b.count / maxBucket) * 100}%`,
                        backgroundColor: "var(--qgi-accent)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <div
                    className="w-10 text-right tabular-nums"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {b.count}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Indicator fingerprint */}
        {/* M5 phase 1 (Asas Majles 2026-05-01): Demographic 3 (Population /
            Life Expectancy / Mortality under-5) suppressed from display per
            #573 substrate-effect investigation + #577 posterior-weight matrix
            roadmap. See lib/demographic-3-suppression.ts for full rationale. */}
        {(() => {
          const visibleFingerprint = filterDemographic3(recipe.indicator_fingerprint);
          return (
            <Section title={`Indicator fingerprint (top ${visibleFingerprint.length})`}>
              <div
                className="text-[11px] mb-3"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                Indicators ranked by TF-IDF — frequency × inverse-recipe-frequency.
                Confidence intervals (95%) reflect the binomial uncertainty in each
                indicator&apos;s frequency given the{" "}
                {recipe.total_instances.toLocaleString()}-instance sample.
              </div>
              <div className="space-y-2">
                {visibleFingerprint.map((ind) => {
                  // Prefer the catalog lookup (indexes.json + numeric
                  // supplement). Fall through to the baked
                  // `indicator_name` only when it isn't the bake script's
                  // `(unknown N)` placeholder, otherwise surface a
                  // generic `Indicator N` rather than the raw placeholder.
                  const fromCatalog = INDICATOR_NAME_BY_ID.get(ind.indicator_id);
                  const bakedName = ind.indicator_name;
                  const displayName =
                    fromCatalog ??
                    (bakedName && !isBakedUnknown(bakedName) ? bakedName : undefined) ??
                    `Indicator ${ind.indicator_id}`;
                  return (
                    <div
                      key={ind.indicator_id}
                      className="flex items-center gap-3 text-[12px]"
                    >
                      <div className="w-48 truncate" title={displayName}>
                        {displayName}
                      </div>
                      <div
                        className="flex-1 h-4 rounded-sm relative"
                        style={{ backgroundColor: "var(--qgi-surface-2)" }}
                      >
                        {/* CI bounds (lighter) */}
                        <div
                          className="absolute h-full rounded-sm"
                          style={{
                            left: `${ind.ci_lower * 100}%`,
                            width: `${(ind.ci_upper - ind.ci_lower) * 100}%`,
                            backgroundColor: "var(--qgi-accent)",
                            opacity: 0.25,
                          }}
                        />
                        {/* Point estimate (darker) */}
                        <div
                          className="absolute h-full rounded-sm"
                          style={{
                            left: `${Math.max(0, (ind.frequency - 0.005) * 100)}%`,
                            width: `1%`,
                            backgroundColor: "var(--qgi-accent)",
                            opacity: 0.95,
                          }}
                        />
                      </div>
                      <div
                        className="w-16 text-right tabular-nums font-data"
                        style={{ color: "var(--qgi-text-muted)" }}
                      >
                        {(ind.frequency * 100).toFixed(0)}%
                      </div>
                      <div
                        className="w-20 text-right tabular-nums font-data text-[10px]"
                        style={{ color: "var(--qgi-text-dim)" }}
                        title={`95% CI: ${(ind.ci_lower * 100).toFixed(0)}–${(ind.ci_upper * 100).toFixed(0)}%`}
                      >
                        ±{((ind.ci_upper - ind.ci_lower) * 50).toFixed(0)}pp
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })()}

        {/* Coverage bias */}
        <Section title="Coverage bias diagnostic">
          <div className="text-[11px] mb-3" style={{ color: "var(--qgi-text-muted)" }}>
            Per Amara&apos;s research-validity requirement: surface the data-coverage skew
            so users can discount the score for poor-coverage subjects.
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                Pairs in fingerprint
              </div>
              <div className="text-2xl font-semibold font-data">
                {recipe.coverage_bias_diagnostic.n_pairs}
              </div>
            </div>
            <div>
              <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                OECD share
              </div>
              <div className="text-2xl font-semibold font-data">
                {(recipe.coverage_bias_diagnostic.oecd_share * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          {recipe.coverage_bias_diagnostic.regional_concentration.length > 0 && (
            <div className="mt-4">
              <div
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                Regional concentration
              </div>
              <div className="space-y-1">
                {recipe.coverage_bias_diagnostic.regional_concentration.map((r) => (
                  <div key={r.region} className="flex items-center gap-3 text-[11px]">
                    <div className="w-32 truncate">{r.region}</div>
                    <div
                      className="flex-1 h-2 rounded-sm"
                      style={{ backgroundColor: "var(--qgi-surface-2)" }}
                    >
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${r.share * 100}%`,
                          backgroundColor: "var(--qgi-accent)",
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <div
                      className="w-12 text-right tabular-nums font-data"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {(r.share * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Currently-flagged countries */}
        {flaggedCountries.length > 0 && (
          <Section title="Currently flagged">
            <div className="text-[11px] mb-3" style={{ color: "var(--qgi-text-muted)" }}>
              Countries with active similarity to this Recipe, sorted by score desc. Click
              through for the country-vs-Recipe leaf.
            </div>
            <div className="space-y-2">
              {flaggedCountries.map((c) => (
                <Link
                  key={c.countrySlug}
                  href={signalCountryRecipeUrl(c.countrySlug, recipe.event_category)}
                  className="flex items-center gap-3 p-3 rounded-md transition-colors hover:bg-[var(--qgi-surface-2)]"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  {c.alpha_2 && <CountryFlag alpha2={c.alpha_2} size={20} />}
                  <div className="flex-1 text-sm">{c.name}</div>
                  <div
                    className="text-[10px] tracking-widest uppercase font-data"
                    style={{ color: TIER_COLORS[c.tier] ?? "#94a3b8" }}
                  >
                    {c.tier}
                  </div>
                  <div
                    className="text-lg font-semibold font-data tabular-nums"
                    style={{
                      color:
                        c.score >= 0.7
                          ? "#f87171"
                          : c.score >= 0.4
                            ? "#fbbf24"
                            : "var(--qgi-text-muted)",
                    }}
                  >
                    {c.score.toFixed(2)}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md p-3"
      style={{
        backgroundColor: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
      }}
    >
      <div
        className="text-[9px] tracking-widest uppercase mb-1"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
      <div className="text-xl font-semibold font-data">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] tracking-widest uppercase mb-3"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
