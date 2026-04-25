"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import type { CountryRisk, RiskTier } from "@/lib/country-risks";
import { CountryFlag } from "@/components/design/CountryFlag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CountryEntry {
  id: string;
  name: string;
  alpha_2: string;
  curated: boolean;
  overall_risk_tier: RiskTier;
  tiers: CountryRisk["tiers"];
}

type L1Id = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

type SortOption =
  | "tier_desc"
  | "ovr_desc"
  | "ovr_asc"
  | "alpha_asc"
  | "alpha_desc"
  | "curated_first";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const L1_META: Record<L1Id, { label: string; full: string; color: string }> = {
  A: { label: "POL", full: "Political Power", color: "#7B5EE6" },
  B: { label: "CON", full: "Conflict & Violence", color: "#E64545" },
  C: { label: "GOV", full: "Governance & Rights", color: "#E68F29" },
  D: { label: "ECO", full: "Economic Stress", color: "#3FA9F5" },
  E: { label: "SOC", full: "Social Mobilization", color: "#3FBF8F" },
  F: { label: "DIP", full: "Diplomacy & Geopolitics", color: "#9F7AEA" },
  G: { label: "HUM", full: "Humanitarian Crisis", color: "#E94989" },
  H: { label: "STR", full: "Structural Trends", color: "#7A8FA0" },
};

const L1_IDS: L1Id[] = ["A", "B", "C", "D", "E", "F", "G", "H"];

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "rgba(248, 113, 113, 0.12)", text: "#f87171", border: "#f87171" },
  MODERATE: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
  INDICATIVE: { bg: "rgba(56, 189, 248, 0.12)", text: "#38bdf8", border: "#38bdf8" },
};

const TIER_SHORT: Record<RiskTier, string> = {
  HIGH: "HIGH",
  MODERATE: "MOD",
  INDICATIVE: "IND",
};

const TIER_FILTERS: RiskTier[] = ["HIGH", "MODERATE", "INDICATIVE"];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "tier_desc", label: "Risk tier (default)" },
  { value: "ovr_desc", label: "Overall score (high to low)" },
  { value: "ovr_asc", label: "Overall score (low to high)" },
  { value: "alpha_asc", label: "Alphabetical (A-Z)" },
  { value: "alpha_desc", label: "Alphabetical (Z-A)" },
  { value: "curated_first", label: "Curated first" },
];

// #432 Bug 2: URL-backed filter state. Defaults match the prior
// useState defaults so an empty URL (no params) renders the same as
// before. Param shapes:
//   q      = search string
//   tier   = HIGH | MODERATE | INDICATIVE   (omit for ALL)
//   sort   = ovr_desc | alpha_asc | ...     (omit for tier_desc)
//   l1     = A..H                            (omit when no L1 filter)
//   min    = 30..90                          (omit when 50 default)
// Manually-typed `/countries?tier=HIGH` and copy-paste-share both work.
const DEFAULT_TIER: RiskTier | "ALL" = "ALL";
const DEFAULT_SORT: SortOption = "tier_desc";
const DEFAULT_MIN_SCORE = 50;
const VALID_TIERS = new Set<RiskTier>(["HIGH", "MODERATE", "INDICATIVE"]);
const VALID_SORTS = new Set<SortOption>([
  "tier_desc",
  "ovr_desc",
  "ovr_asc",
  "alpha_asc",
  "alpha_desc",
  "curated_first",
]);
const VALID_L1: ReadonlySet<string> = new Set(L1_IDS);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert raw salience (0-0.5 range) to 0-100 score for display */
function salienceTo100(raw: number): number {
  return Math.min(100, Math.max(0, Math.round((raw / 0.5) * 100)));
}

/**
 * Country name -> salience file slug (must match filenames in data/salience/).
 *
 * T3 #296 HIGH fix (2026-04-19): hyphens were being stripped to nothing,
 * producing "timorleste" and "guineabissau" which miss the correct files
 * `timor_leste.json` and `guinea_bissau.json`. Convert hyphens to
 * underscores before the alphanumeric filter.
 *
 * A full switch to id-keyed salience data would require regenerating all
 * 198 files in data/salience/, which is a pipeline-side change — parked
 * for a future session.
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "") // strip leading "The "
    .replace(/\bof the\b/g, "of") // "Republic of the Congo" → "Republic of Congo"
    .replace(/[-–—]/g, "_") // hyphens + en/em dashes → underscore
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Compute OVR from L1 scores (Option B from the design doc — geo mean of top 4 with breadth bonus) */
function computeOvr(l1Scores: Record<string, number>): number {
  const scores = L1_IDS.map((id) => salienceTo100(l1Scores[id] ?? 0));
  const sorted = [...scores].sort((a, b) => b - a);
  const top4 = sorted.slice(0, 4);

  // Geometric mean of top 4 (add 1 to avoid zero-product, then subtract)
  const product = top4.reduce((acc, v) => acc * (v + 1), 1);
  const geoMean = Math.pow(product, 1 / 4) - 1;

  // Breadth bonus: fraction of L1s >= 50
  const breadth = scores.filter((s) => s >= 50).length / 8;
  const ovrRaw = geoMean * (0.85 + 0.3 * breadth);

  return Math.min(100, Math.max(0, Math.round(ovrRaw)));
}

/**
 * Get dominant L1 (highest scoring).
 *
 * T3 #296 MEDIUM fix: previously returned "A" (POL) when all scores were
 * zero (which is the default for every non-curated country with no salience
 * file), painting every uncurated country with a misleading "POL" label.
 * Now returns null when no positive score exists; caller renders a neutral
 * placeholder.
 */
function getDominantL1(l1Scores: Record<string, number>): L1Id | null {
  let best: L1Id | null = null;
  let bestVal = 0;
  for (const id of L1_IDS) {
    const v = l1Scores[id] ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = id;
    }
  }
  return best;
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CountriesClient({
  countries,
  salienceMap,
}: {
  countries: CountryEntry[];
  salienceMap: Record<string, Record<string, number>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // #432 Bug 2: derive initial state from URL so manually-typed
  // `/countries?tier=HIGH&l1=B` and pasted-shared links both apply
  // filters on first render. Validation rejects unknown values so a
  // bad URL silently falls back to defaults instead of crashing.
  const initialTier = useMemo<RiskTier | "ALL">(() => {
    const v = searchParams.get("tier");
    if (v && VALID_TIERS.has(v as RiskTier)) return v as RiskTier;
    return DEFAULT_TIER;
  }, [searchParams]);
  const initialSort = useMemo<SortOption>(() => {
    const v = searchParams.get("sort");
    if (v && VALID_SORTS.has(v as SortOption)) return v as SortOption;
    return DEFAULT_SORT;
  }, [searchParams]);
  const initialL1 = useMemo<L1Id | null>(() => {
    const v = searchParams.get("l1");
    if (v && VALID_L1.has(v)) return v as L1Id;
    return null;
  }, [searchParams]);
  const initialMin = useMemo(() => {
    const v = Number(searchParams.get("min"));
    return Number.isFinite(v) && v >= 30 && v <= 90 ? v : DEFAULT_MIN_SCORE;
  }, [searchParams]);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [tierFilter, setTierFilter] = useState<RiskTier | "ALL">(initialTier);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [l1Filter, setL1Filter] = useState<L1Id | null>(initialL1);
  const [l1MinScore, setL1MinScore] = useState(initialMin);

  // Persist filter state into the URL so reload + copy-link both
  // restore the same view. `router.replace` keeps history clean (each
  // keystroke in the search box doesn't add a history entry). The
  // effect runs on every state change; debouncing the search input
  // is a future polish item.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (tierFilter !== DEFAULT_TIER) params.set("tier", tierFilter);
    if (sortBy !== DEFAULT_SORT) params.set("sort", sortBy);
    if (l1Filter) params.set("l1", l1Filter);
    if (l1Filter && l1MinScore !== DEFAULT_MIN_SCORE)
      params.set("min", String(l1MinScore));
    const qs = params.toString();
    // #440: cast to Route — typed routes can't statically verify
    // arbitrary query-string composition. The path part (/countries)
    // is still pre-validated as a real route.
    const target: Route = (qs ? `/countries?${qs}` : "/countries") as Route;
    if (target !== `${window.location.pathname}${window.location.search}`) {
      router.replace(target, { scroll: false });
    }
  }, [router, search, tierFilter, sortBy, l1Filter, l1MinScore]);

  // Pre-compute OVR and L1 scores for each country
  const enriched = useMemo(() => {
    return countries.map((c) => {
      const slug = toSlug(c.name);
      const rawL1 = salienceMap[slug] ?? {};
      const l1Scores: Record<L1Id, number> = {} as Record<L1Id, number>;
      for (const id of L1_IDS) {
        l1Scores[id] = salienceTo100(rawL1[id] ?? 0);
      }
      const ovr = computeOvr(rawL1);
      const dominantL1 = getDominantL1(rawL1);
      return { ...c, l1Scores, ovr, dominantL1 };
    });
  }, [countries, salienceMap]);

  // Filter
  const filtered = useMemo(() => {
    let result = enriched;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.alpha_2.toLowerCase().includes(q)
      );
    }
    if (tierFilter !== "ALL") {
      result = result.filter((c) => c.overall_risk_tier === tierFilter);
    }
    if (l1Filter) {
      result = result.filter((c) => c.l1Scores[l1Filter] >= l1MinScore);
    }
    return result;
  }, [enriched, search, tierFilter, l1Filter, l1MinScore]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const tierOrder: Record<RiskTier, number> = { HIGH: 0, MODERATE: 1, INDICATIVE: 2 };

    switch (sortBy) {
      case "ovr_desc":
        arr.sort((a, b) => b.ovr - a.ovr);
        break;
      case "ovr_asc":
        arr.sort((a, b) => a.ovr - b.ovr);
        break;
      case "alpha_asc":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "alpha_desc":
        arr.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "curated_first":
        arr.sort((a, b) => {
          if (a.curated !== b.curated) return a.curated ? -1 : 1;
          return b.ovr - a.ovr;
        });
        break;
      case "tier_desc":
      default:
        arr.sort((a, b) => {
          const td = tierOrder[a.overall_risk_tier] - tierOrder[b.overall_risk_tier];
          if (td !== 0) return td;
          return b.ovr - a.ovr;
        });
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  /**
   * T3 #296 HIGH fix: tier chip counts were computed over unfiltered
   * `countries` so numbers stayed flat even after the user searched. Now
   * compute over a search-filtered set (but NOT tier-filtered — otherwise
   * switching tiers would always show 0 or 1 outside the current tier).
   */
  const tierCounts = useMemo(() => {
    let base = enriched;
    if (search) {
      const q = search.toLowerCase();
      base = base.filter(
        (c) => c.name.toLowerCase().includes(q) || c.alpha_2.toLowerCase().includes(q)
      );
    }
    if (l1Filter) {
      base = base.filter((c) => c.l1Scores[l1Filter] >= l1MinScore);
    }
    const counts: Record<string, number> = { ALL: base.length };
    for (const c of base) {
      counts[c.overall_risk_tier] = (counts[c.overall_risk_tier] ?? 0) + 1;
    }
    return counts;
  }, [enriched, search, l1Filter, l1MinScore]);

  const curatedCount = useMemo(
    () => countries.filter((c) => c.curated).length,
    [countries]
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-xs tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Country Intelligence Browser
        </h1>
        <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
          {countries.length}&nbsp;countries &middot; {curatedCount}&nbsp;curated &middot;
          V1.9.1 scoring
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Row 1: Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="country-search" className="sr-only">
            Search countries
          </label>
          <input
            id="country-search"
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded border text-sm flex-1 max-w-xs outline-none transition-colors focus:border-[var(--qgi-accent)] focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          />

          <label htmlFor="country-sort" className="sr-only">
            Sort countries
          </label>
          <select
            id="country-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 rounded border text-xs outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-muted)",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Tier chips */}
        <div className="flex gap-2 flex-wrap">
          <FilterChip
            label={`All (${tierCounts.ALL ?? 0})`}
            active={tierFilter === "ALL"}
            onClick={() => setTierFilter("ALL")}
          />
          {TIER_FILTERS.map((tier) => (
            <FilterChip
              key={tier}
              label={`${tier} (${tierCounts[tier] ?? 0})`}
              active={tierFilter === tier}
              onClick={() => setTierFilter(tier)}
              color={TIER_STYLES[tier].text}
            />
          ))}
        </div>

        {/* Row 3: L1 domain filter chips */}
        <div className="flex gap-2 flex-wrap items-center">
          <span
            className="text-[10px] tracking-wider uppercase mr-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Filter by domain:
          </span>
          <FilterChip
            label="All"
            active={l1Filter === null}
            onClick={() => setL1Filter(null)}
          />
          {L1_IDS.map((id) => (
            <FilterChip
              key={id}
              label={L1_META[id].label}
              active={l1Filter === id}
              onClick={() => {
                // #432 Bug 3: reset min-score whenever the chip changes
                // (toggle off, or switch to a different L1) so a strict
                // ≥90 picked for one domain doesn't silently filter
                // every other domain to a near-empty list.
                setL1Filter(l1Filter === id ? null : id);
                setL1MinScore(50);
              }}
              color={L1_META[id].color}
            />
          ))}
          {l1Filter && (
            <select
              value={l1MinScore}
              onChange={(e) => setL1MinScore(Number(e.target.value))}
              className="ml-2 px-2 py-1 rounded border text-[10px]"
              style={{
                backgroundColor: "var(--qgi-surface)",
                borderColor: "var(--qgi-border)",
                color: "var(--qgi-text-muted)",
              }}
            >
              {[30, 40, 50, 60, 70, 80, 90].map((v) => (
                <option key={v} value={v}>
                  &ge; {v}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Results count — aria-live so screen readers announce filter updates (T15 #308) */}
      <div
        className="text-xs mb-4"
        style={{ color: "var(--qgi-text-dim)" }}
        aria-live="polite"
      >
        Showing {sorted.length} of {countries.length}
        {l1Filter && (
          <span>
            {" "}
            &middot; {L1_META[l1Filter].full} &ge; {l1MinScore}
          </span>
        )}
      </div>

      {/* Country Card Grid */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        }}
      >
        {sorted.map((country) => (
          <CountryCard key={country.id} country={country} />
        ))}
      </div>

      {sorted.length === 0 && (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          No countries match your filters.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Country Card (FIFA / Trading Card style)
// ---------------------------------------------------------------------------

interface EnrichedCountry extends CountryEntry {
  l1Scores: Record<L1Id, number>;
  ovr: number;
  dominantL1: L1Id | null;
}

function CountryCard({ country }: { country: EnrichedCountry }) {
  const style = TIER_STYLES[country.overall_risk_tier];
  // T3 #296: dominantL1 is null when no salience data — render neutral
  // colour + "No salience data" label instead of defaulting to "POL".
  const dominantColor = country.dominantL1
    ? L1_META[country.dominantL1].color
    : "var(--qgi-text-dim)";

  // Get top category from S-tier
  const topCats = country.tiers?.S?.top_categories ?? [];
  const topCat = topCats[0];

  // Top domain label
  const topDomainLabel = country.dominantL1
    ? L1_META[country.dominantL1].full
    : "No salience data";

  return (
    <Link
      href={`/countries/${country.id}`}
      className="group block rounded-lg border overflow-hidden transition-all"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
        minWidth: 220,
        maxWidth: 300,
      }}
    >
      {/* ─── Top strip: OVR + Name + Verified ─── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        {/* OVR badge */}
        <div
          className="shrink-0 flex items-center justify-center rounded font-bold text-lg leading-none"
          style={{
            width: 40,
            height: 40,
            border: `2px solid ${style.text}`,
            color: style.text,
            backgroundColor: style.bg,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {country.ovr}
        </div>

        {/* Name + alpha2 */}
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold truncate group-hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text)" }}
          >
            {country.name}
          </div>
          <div
            className="text-[10px] tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {country.alpha_2}
          </div>
        </div>

        {/* Verified badge — T15 #308: role=img + aria-label so screen readers announce state */}
        <div
          className="shrink-0"
          title={country.curated ? "Events curated by QGI analysts" : "Curation pending"}
        >
          {country.curated ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              role="img"
              aria-label="Curated country — events verified by QGI analysts"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="rgba(52, 211, 153, 0.15)"
                stroke="#34d399"
                strokeWidth="1.5"
              />
              <path
                d="M8 12.5l2.5 2.5L16 9.5"
                stroke="#34d399"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              role="img"
              aria-label="Uncurated country — event corpus not yet verified"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="rgba(74, 98, 128, 0.15)"
                stroke="#4a6280"
                strokeWidth="1.5"
              />
              <rect x="10.5" y="7" width="3" height="6" rx="0.5" fill="#4a6280" />
              <circle cx="12" cy="16" r="1.5" fill="#4a6280" />
            </svg>
          )}
        </div>
      </div>

      {/* ─── Tier pill ─── */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <span
          className="text-[9px] tracking-widest font-bold px-2 py-0.5 rounded"
          style={{
            backgroundColor: style.bg,
            color: style.text,
            border: `1px solid ${style.border}30`,
          }}
        >
          {TIER_SHORT[country.overall_risk_tier]}
        </span>
      </div>

      {/* ─── Flag panel (hero art) ─── */}
      <div
        className="relative mx-3 mb-2 rounded-md overflow-hidden flex items-center justify-center"
        style={{
          height: 90,
          background: `linear-gradient(180deg, var(--qgi-surface-2) 0%, ${dominantColor}10 100%)`,
        }}
      >
        {/* #1: back to original crisp size — stretching distorted the flags */}
        <CountryFlag alpha2={country.alpha_2} size={48} />
      </div>

      {/* ─── L1 Stat block ─── */}
      <div className="px-3 pb-2">
        <div
          className="text-[8px] tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Domain scores
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {L1_IDS.map((id) => {
            const val = country.l1Scores[id];
            const meta = L1_META[id];
            return (
              <div key={id} className="flex items-center gap-1.5" title={meta.full}>
                <span
                  className="text-[10px] font-bold tracking-wide"
                  style={{
                    color: meta.color,
                    width: 28,
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {meta.label}
                </span>
                <span
                  className="text-[11px] font-semibold"
                  style={{
                    color: "var(--qgi-text)",
                    fontFamily: "var(--font-mono, monospace)",
                    width: 24,
                    textAlign: "right",
                  }}
                >
                  {val}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: val >= 50 ? meta.color : "transparent",
                    border: `1.5px solid ${meta.color}`,
                    opacity: val >= 50 ? 1 : 0.4,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="mx-3 mb-2" style={{ borderTop: "1px solid var(--qgi-border)" }} />

      {/* ─── Top domain + category ─── */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-[8px] tracking-widest uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Top domain
          </span>
          <span className="text-[10px] font-semibold" style={{ color: dominantColor }}>
            {topDomainLabel}
          </span>
        </div>
        {topCat ? (
          <>
            {/* #432 Bug 5: top-category text deep-links to the category
                drill-down. Nested Link inside the outer card Link is
                technically invalid HTML (anchors can't nest), so we use
                a `<span>` with onClick + onKeyDown for a11y, and
                stopPropagation so the outer card's navigation doesn't
                steal the click. The drill-down route is the strongest
                page on the site — surfacing it as a discrete link makes
                the value prop reachable in one click instead of two. */}
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/countries/${country.id}/${topCat.category}`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/countries/${country.id}/${topCat.category}`;
                }
              }}
              className="block text-[10px] truncate mb-0.5 cursor-pointer hover:underline"
              style={{ color: "var(--qgi-text-muted)" }}
              title={`Drill into ${formatCategory(topCat.category)} for ${country.name}`}
            >
              {formatCategory(topCat.category)}
            </span>
            <div
              className="text-[9px] font-data"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {topCat.recipe_count.toLocaleString()} windows
              {topCat.last_event_year ? ` \u00B7 last ${topCat.last_event_year}` : ""}
            </div>
          </>
        ) : (
          <div className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
            Data accumulating
          </div>
        )}
      </div>

      {/* ─── Footer button ─── */}
      <div
        className="px-3 py-2 text-center transition-colors group-hover:bg-[var(--qgi-surface-2)]"
        style={{ borderTop: "1px solid var(--qgi-border)" }}
      >
        <span
          className="text-[10px] tracking-wider uppercase font-semibold"
          style={{ color: "var(--qgi-accent)" }}
        >
          View profile
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Filter chip (reused)
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors"
      style={{
        backgroundColor: active
          ? color
            ? `${color}20`
            : "var(--qgi-accent-glow)"
          : "transparent",
        borderColor: active ? (color ?? "var(--qgi-accent)") : "var(--qgi-border)",
        color: active ? (color ?? "var(--qgi-accent)") : "var(--qgi-text-muted)",
      }}
    >
      {label}
    </button>
  );
}
