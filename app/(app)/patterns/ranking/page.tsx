"use client";

/**
 * Pattern Power Ranking — Card-row leaderboard redesign (Phase 0 + Phase 1).
 *
 * Each row is a mini-story with 3 zones:
 *   Zone 1 (Rank): #1-3 amber accent, intensity fades
 *   Zone 2 (Pair Block): flags + directional arrow + lead-time badge
 *   Zone 3 (Strength Block): PPS bar + correlation pill
 *
 * Design reference: ux-redesign-ranking-2026-04-17.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import type { PatternRow } from "@/lib/types";
import countriesList from "@/data/countries.json";

// ---------------------------------------------------------------------------
// Country lookup maps
// ---------------------------------------------------------------------------
const ALPHA2_MAP: Record<string, string> = {};
const NAME_TO_ALPHA2: Record<string, string> = {};
for (const c of countriesList as Array<{ id: string; name: string; alpha_2: string }>) {
  ALPHA2_MAP[c.id] = c.alpha_2;
  NAME_TO_ALPHA2[c.name] = c.alpha_2;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PPS color tiers calibrated to raw PPS range (0-2500). */
function rawPpsColor(pps: number): string {
  if (pps >= 1500) return "#f87171"; // red -- elite
  if (pps >= 1000) return "#fb923c"; // orange -- strong
  if (pps >= 500) return "#fbbf24"; // amber -- moderate
  return "#7a90a8"; // slate -- weak
}

/** Correlation tier definitions */
type CorrTier = "S" | "A" | "B" | "C";

function getCorrTier(r: number): CorrTier {
  if (r >= 0.85) return "S";
  if (r >= 0.7) return "A";
  if (r >= 0.55) return "B";
  return "C";
}

const CORR_TIER_COLORS: Record<CorrTier, string> = {
  S: "#34d399", // emerald
  A: "#38bdf8", // sky
  B: "#fbbf24", // amber
  C: "#7a90a8", // slate
};

const CORR_TIER_LABELS: Record<CorrTier, string> = {
  S: "Very strong correlation",
  A: "Strong correlation",
  B: "Moderate correlation",
  C: "Weak correlation",
};

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------
interface RankingResponse {
  page: number;
  limit: number;
  results: PatternRow[];
  deduped?: boolean;
  total_unique_pairs?: number;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
/**
 * Build the /patterns detail URL for a pattern row, or `null` when the
 * row lacks numeric country IDs (which the /patterns API requires).
 * #435 Bug 3: extracted from the old `navigateToPattern` onClick handler
 * so RankCard can render an `<a href>` that right-click / middle-click /
 * cmd-click and SEO crawlers can all follow — a `<button onClick>` breaks
 * all of those.
 */
function patternDetailHref(p: PatternRow): Route | null {
  if (p.country_a_id == null || p.country_b_id == null) return null;
  const qs = new URLSearchParams({
    country_a: String(p.country_a_id),
    country_b: String(p.country_b_id),
    length: String(p.pattern_length),
    start_a: String(p.start_year_a),
    start_b: String(p.start_year_b),
  });
  // #440: typed routes promotes `<Link href>` from string to Route. The
  // /patterns route accepts arbitrary query strings (5 params spelled out
  // above) — Next's typed-routes generator can't pre-type that surface
  // because query state is a runtime concern, so we cast the formatted
  // URL to `Route` once here. The compile-time path check (`/patterns`
  // is real) still applies.
  return `/patterns?${qs}` as Route;
}

export default function RankingPage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Data state
  const [allRows, setAllRows] = useState<PatternRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUniquePairs, setTotalUniquePairs] = useState<number | null>(null);

  // View mode: "best" = one row per pair (best PPS), "all" = raw 1000 interleaved
  const [viewMode, setViewMode] = useState<"best" | "all">("all");

  // Filters
  const [countrySearch, setCountrySearch] = useState("");
  const [minPps, setMinPps] = useState(0);
  const [corrTierFilter, setCorrTierFilter] = useState<CorrTier | null>(null);
  const [patternTierFilter, setPatternTierFilter] = useState<string | null>(null);
  const [leadTimeFilter, setLeadTimeFilter] = useState<
    "all" | "concurrent" | "early-warning"
  >("all");
  const [minGapYears, setMinGapYears] = useState(0);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const countryInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Scroll position indicator
  const [scrollPosition, setScrollPosition] = useState({ start: 1, end: 20 });
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Fetch all 1000 rows in one go
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "1000" });
      const res = await fetch(`/api/patterns/ranking?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RankingResponse = await res.json();
      setAllRows(data.results);
      setTotalUniquePairs(data.total_unique_pairs ?? null);
    } catch (err) {
      console.error("Failed to fetch ranking:", err);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Close country dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(e.target as Node)
      ) {
        setShowCountryDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function getAlpha2(idOrName: string | number | undefined, name: string): string {
    // idOrName widened to accept number (PatternRow.country_a_id is
    // `string | number` post-T2). Coerce to string for the lookup key.
    const key = idOrName != null ? String(idOrName) : undefined;
    if (key && ALPHA2_MAP[key]) return ALPHA2_MAP[key];
    if (NAME_TO_ALPHA2[name]) return NAME_TO_ALPHA2[name];
    return "";
  }

  // ---------------------------------------------------------------------------
  // Process rows: dedup/interleave + filters
  // ---------------------------------------------------------------------------
  const processed = useMemo(() => {
    let result = allRows;

    // Sonnet reviewer P1-A (2026-04-19): zero-padded numeric-string key so
    // lex-order matches numeric-order. Without this, `"10"` orders before
    // `"2"` lexicographically and the same pair dedups inconsistently
    // between "best" mode and "all" interleave mode, producing duplicate
    // rows on the ranking page.
    const padKey = (v: string | number | undefined, fallback: string) => {
      const n = Number(v);
      return Number.isFinite(n) ? String(n).padStart(6, "0") : String(v ?? fallback);
    };

    if (viewMode === "best") {
      // Dedup: one row per pair (best PPS window)
      const bestPerPair = new Map<string, PatternRow>();
      for (const row of result) {
        const a = padKey(row.country_a_id, row.country_a);
        const b = padKey(row.country_b_id, row.country_b);
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const existing = bestPerPair.get(key);
        if (!existing || row.pattern_power_score > existing.pattern_power_score) {
          bestPerPair.set(key, row);
        }
      }
      result = Array.from(bestPerPair.values()).sort(
        (a, b) => b.pattern_power_score - a.pattern_power_score
      );
    } else {
      // Interleave by pair (round-robin)
      const groups = new Map<string, PatternRow[]>();
      for (const row of result) {
        const a = padKey(row.country_a_id, row.country_a);
        const b = padKey(row.country_b_id, row.country_b);
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        let arr = groups.get(key);
        if (!arr) {
          arr = [];
          groups.set(key, arr);
        }
        arr.push(row);
      }
      const sortedGroups = Array.from(groups.values())
        .map((g) => g.sort((a, b) => b.pattern_power_score - a.pattern_power_score))
        .sort((a, b) => b[0].pattern_power_score - a[0].pattern_power_score);
      const interleaved: PatternRow[] = [];
      let rank = 0;
      let added = true;
      while (added) {
        added = false;
        for (const group of sortedGroups) {
          if (rank < group.length) {
            interleaved.push(group[rank]);
            added = true;
          }
        }
        rank++;
      }
      result = interleaved;
    }

    // Country filter
    if (selectedCountries.length > 0) {
      const lowerSet = new Set(selectedCountries.map((c) => c.toLowerCase()));
      result = result.filter(
        (p) =>
          lowerSet.has(p.country_a.toLowerCase()) ||
          lowerSet.has(p.country_b.toLowerCase())
      );
    }

    // Min PPS filter
    if (minPps > 0) {
      result = result.filter((p) => p.pattern_power_score >= minPps);
    }

    // Correlation tier filter
    if (corrTierFilter) {
      result = result.filter((p) => getCorrTier(p.avg_correlation) === corrTierFilter);
    }

    // Pattern tier filter (S/M/L/XL)
    if (patternTierFilter) {
      result = result.filter((p) => {
        const len = p.pattern_length ?? 0;
        const tier = len <= 8 ? "S" : len <= 20 ? "M" : len <= 40 ? "L" : "XL";
        return tier === patternTierFilter;
      });
    }

    // Lead time filter.
    // T6 #299 MEDIUM fix (2026-04-19): "Early Warning" previously accepted
    // ANY pair with gap > 0 — including purely historical pairs where A's
    // pattern ended decades ago. Tighten to require the pattern is still
    // running (or recent): `start_year_a + length + 2 >= current_year`.
    const currentYear = new Date().getFullYear();
    if (leadTimeFilter !== "all") {
      result = result.filter((p) => {
        const gap = p.start_year_b - p.start_year_a;
        if (leadTimeFilter === "concurrent") return Math.abs(gap) <= 1;
        if (leadTimeFilter === "early-warning") {
          // B preceded A AND A's pattern is still running (within 2 years
          // of the present, which covers the trailing-data normal case).
          const aEnd = p.start_year_a + p.pattern_length;
          return gap > 0 && aEnd >= currentYear - 2;
        }
        return true;
      });
    }

    // Gap years filter
    if (minGapYears > 0) {
      result = result.filter(
        (p) => Math.abs(p.start_year_b - p.start_year_a) >= minGapYears
      );
    }

    return result;
  }, [
    allRows,
    viewMode,
    selectedCountries,
    minPps,
    corrTierFilter,
    patternTierFilter,
    leadTimeFilter,
    minGapYears,
  ]);

  // Max PPS for the bar denominator (per current filtered view)
  const maxPps = useMemo(
    () => Math.max(1, ...processed.map((p) => p.pattern_power_score)),
    [processed]
  );

  // Countries present in data (for search dropdown)
  const countriesInData = useMemo(() => {
    const s = new Set<string>();
    for (const row of allRows) {
      s.add(row.country_a);
      s.add(row.country_b);
    }
    return Array.from(s).sort();
  }, [allRows]);

  // Country search matches
  const countryMatches = useMemo(() => {
    if (!countrySearch.trim()) return countriesInData.slice(0, 12);
    const q = countrySearch.toLowerCase();
    return countriesInData.filter((c) => c.toLowerCase().includes(q)).slice(0, 12);
  }, [countrySearch, countriesInData]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rowHeight = 56;
    const start = Math.floor(el.scrollTop / rowHeight) + 1;
    const visible = Math.floor(el.clientHeight / rowHeight);
    const end = Math.min(start + visible - 1, processed.length);
    setScrollPosition({ start, end });
    setShowBackToTop(el.scrollTop > 200);
  }, [processed.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Active filter count
  const activeFilterCount =
    selectedCountries.length +
    (minPps > 0 ? 1 : 0) +
    (corrTierFilter ? 1 : 0) +
    (patternTierFilter ? 1 : 0) +
    (leadTimeFilter !== "all" ? 1 : 0) +
    (minGapYears > 0 ? 1 : 0);

  function clearAllFilters() {
    setSelectedCountries([]);
    setMinPps(0);
    setPatternTierFilter(null);
    setMinGapYears(0);
    setCorrTierFilter(null);
    setLeadTimeFilter("all");
    setCountrySearch("");
  }

  return (
    <div className="flex flex-col h-full p-6 gap-3">
      {/* ================================================================ */}
      {/* HEADER BAR                                                        */}
      {/* ================================================================ */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1
            className="text-xs tracking-[0.2em] uppercase font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            Pattern Power Ranking
          </h1>
          <div
            className="flex items-center gap-2 text-[10px] tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {totalUniquePairs != null && <span>{totalUniquePairs} pairs</span>}
            <span>&middot;</span>
            <span>{allRows.length.toLocaleString()} windows</span>
          </div>
        </div>

        {/* Best/All toggle */}
        <div
          className="flex rounded-md overflow-hidden border"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <button
            onClick={() => setViewMode("best")}
            className="px-3 py-1.5 text-[9px] tracking-[0.12em] uppercase transition-colors"
            style={{
              backgroundColor:
                viewMode === "best" ? "var(--qgi-surface-2)" : "transparent",
              color: viewMode === "best" ? "var(--qgi-text)" : "var(--qgi-text-dim)",
              borderRight: "1px solid var(--qgi-border)",
            }}
          >
            Best window
          </button>
          <button
            onClick={() => setViewMode("all")}
            className="px-3 py-1.5 text-[9px] tracking-[0.12em] uppercase transition-colors"
            style={{
              backgroundColor:
                viewMode === "all" ? "var(--qgi-surface-2)" : "transparent",
              color: viewMode === "all" ? "var(--qgi-text)" : "var(--qgi-text-dim)",
            }}
          >
            All windows
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* FILTER STRIP                                                      */}
      {/* ================================================================ */}
      <div
        className="rounded border p-3 flex flex-col gap-2.5"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Country search */}
          <div className="relative">
            <input
              ref={countryInputRef}
              type="text"
              value={countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                setShowCountryDropdown(true);
              }}
              onFocus={() => setShowCountryDropdown(true)}
              placeholder="Search country..."
              className="w-44 px-2.5 py-1.5 rounded text-xs font-data border outline-none focus:border-[var(--qgi-accent)] placeholder:text-[var(--qgi-text-dim)]"
              style={{
                backgroundColor: "var(--qgi-bg)",
                borderColor: "var(--qgi-border)",
                color: "var(--qgi-text)",
              }}
            />
            {showCountryDropdown && countryMatches.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 top-full mt-1 w-56 rounded border shadow-lg overflow-hidden max-h-60 overflow-y-auto"
                style={{
                  backgroundColor: "var(--qgi-surface-2)",
                  borderColor: "var(--qgi-border)",
                }}
              >
                {countryMatches.map((name) => {
                  const isSelected = selectedCountries.includes(name);
                  const a2 = NAME_TO_ALPHA2[name] ?? "";
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCountries((prev) => prev.filter((c) => c !== name));
                        } else {
                          setSelectedCountries((prev) => [...prev, name]);
                        }
                        setCountrySearch("");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--qgi-surface)] transition-colors"
                      style={{
                        color: isSelected ? "var(--qgi-accent)" : "var(--qgi-text)",
                      }}
                    >
                      <CountryFlag alpha2={a2} size={12} />
                      <span className="truncate">{name}</span>
                      {isSelected && (
                        <span
                          className="ml-auto text-[10px]"
                          style={{ color: "var(--qgi-accent)" }}
                        >
                          &#10003;
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ backgroundColor: "var(--qgi-border)" }} />

          {/* Min PPS slider */}
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] tracking-[0.12em] uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Min PPS
            </span>
            <input
              type="range"
              min={0}
              max={2500}
              step={50}
              value={minPps}
              onChange={(e) => setMinPps(Number(e.target.value))}
              className="w-24 accent-[var(--qgi-accent)]"
            />
            <span
              className="text-[10px] font-data w-10 text-right"
              style={{ color: minPps > 0 ? "var(--qgi-text)" : "var(--qgi-text-dim)" }}
            >
              {minPps > 0 ? minPps.toLocaleString() : "Any"}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ backgroundColor: "var(--qgi-border)" }} />

          {/* Correlation tier chips */}
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] tracking-[0.12em] uppercase mr-1"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Corr
            </span>
            {(["S", "A", "B", "C"] as CorrTier[]).map((tier) => (
              <button
                key={tier}
                onClick={() => setCorrTierFilter(corrTierFilter === tier ? null : tier)}
                className="px-2 py-0.5 rounded-full text-[10px] font-data font-semibold transition-all"
                title={CORR_TIER_LABELS[tier]}
                style={{
                  backgroundColor:
                    corrTierFilter === tier
                      ? `${CORR_TIER_COLORS[tier]}30`
                      : "transparent",
                  color:
                    corrTierFilter === tier
                      ? CORR_TIER_COLORS[tier]
                      : "var(--qgi-text-dim)",
                  border: `1px solid ${corrTierFilter === tier ? CORR_TIER_COLORS[tier] : "var(--qgi-border)"}`,
                }}
              >
                {tier}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ backgroundColor: "var(--qgi-border)" }} />

          {/* Pattern tier chips (S/M/L/XL) */}
          <div className="flex items-center gap-1.5">
            {(["S", "M", "L", "XL"] as const).map((tier) => {
              const colors: Record<string, string> = {
                S: "#f87171",
                M: "#fbbf24",
                L: "#38bdf8",
                XL: "#a78bfa",
              };
              const active = patternTierFilter === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setPatternTierFilter(active ? null : tier)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-data font-semibold transition-all"
                  title={`${tier} pattern tier`}
                  style={{
                    backgroundColor: active ? `${colors[tier]}30` : "transparent",
                    color: active ? colors[tier] : "var(--qgi-text-dim)",
                    border: `1px solid ${active ? colors[tier] : "var(--qgi-border)"}`,
                  }}
                >
                  {tier}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ backgroundColor: "var(--qgi-border)" }} />

          {/* Gap years filter */}
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] tracking-[0.12em] uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Gap
            </span>
            <input
              type="range"
              min={0}
              max={20}
              value={minGapYears}
              onChange={(e) => setMinGapYears(Number(e.target.value))}
              className="w-16 accent-[var(--qgi-accent)]"
              title={`Min ${minGapYears}yr gap between A and B start years`}
            />
            <span
              className="text-[10px] font-data w-8"
              style={{
                color: minGapYears > 0 ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
              }}
            >
              {minGapYears > 0 ? `≥${minGapYears}yr` : "Any"}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ backgroundColor: "var(--qgi-border)" }} />

          {/* Lead-time toggle */}
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] tracking-[0.12em] uppercase mr-1"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Lead
            </span>
            {(
              [
                { key: "all", label: "All" },
                { key: "concurrent", label: "Concurrent" },
                { key: "early-warning", label: "Early Warning" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLeadTimeFilter(key)}
                className="px-2 py-0.5 rounded-full text-[10px] tracking-wider transition-all"
                style={{
                  backgroundColor:
                    leadTimeFilter === key ? "var(--qgi-surface-2)" : "transparent",
                  color:
                    leadTimeFilter === key ? "var(--qgi-text)" : "var(--qgi-text-dim)",
                  border: `1px solid ${leadTimeFilter === key ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[9px] tracking-[0.12em] uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Active:
            </span>
            {selectedCountries.map((name) => (
              <FilterChip
                key={name}
                label={name}
                onRemove={() =>
                  setSelectedCountries((prev) => prev.filter((c) => c !== name))
                }
              />
            ))}
            {minPps > 0 && (
              <FilterChip
                label={`Score ${"\u2265"} ${minPps.toLocaleString()}`}
                onRemove={() => setMinPps(0)}
              />
            )}
            {corrTierFilter && (
              <FilterChip
                label={`Corr: ${corrTierFilter}`}
                color={CORR_TIER_COLORS[corrTierFilter]}
                onRemove={() => setCorrTierFilter(null)}
              />
            )}
            {leadTimeFilter !== "all" && (
              <FilterChip
                label={leadTimeFilter === "concurrent" ? "Concurrent" : "Early Warning"}
                onRemove={() => setLeadTimeFilter("all")}
              />
            )}
            <button
              onClick={clearAllFilters}
              className="text-[9px] tracking-wider uppercase ml-2 hover:underline"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* LEADERBOARD BODY                                                  */}
      {/* ================================================================ */}
      <div
        className="flex-1 rounded border overflow-hidden flex flex-col relative"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Column labels.
            T14 #307 HIGH fix (2026-04-19): header row gets a min-width so
            it doesn't collapse the country-pair column on 375px viewports.
            RankCard rows below inherit the same minWidth pattern. Page
            body already has overflow-y-auto on the main container so
            horizontal overflow lets users swipe the table until a
            dedicated mobile redesign lands. */}
        <div
          className="grid text-[9px] tracking-[0.12em] uppercase px-4 py-2 border-b select-none shrink-0"
          style={{
            gridTemplateColumns: "42px 1fr 240px",
            color: "var(--qgi-text-dim)",
            borderColor: "var(--qgi-border)",
            minWidth: 640,
          }}
        >
          <span>#</span>
          <div className="flex items-center gap-1">
            <span>Country Pair</span>
            <InfoTooltip text="Predictor country's historical trajectory predicts the following country's trajectory. The arrow shows the direction of prediction." />
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span>Strength</span>
            <InfoTooltip text="Pattern Power Score (PPS) measures overall pattern quality: correlation strength, pattern length, and indicator coverage. The bar shows relative strength within this view. Correlation tier: S (>=85%), A (70-84%), B (55-69%), C (<55%)." />
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex items-center justify-center py-16 text-xs tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              LOADING...
            </div>
          ) : processed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span
                className="text-xs tracking-wider"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                NO PATTERNS MATCH
              </span>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-[10px] tracking-wider underline"
                  style={{ color: "var(--qgi-accent)" }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            processed.map((p, i) => (
              <RankCard
                key={`${p.country_a_id}-${p.country_b_id}-${p.start_year_a}-${p.start_year_b}-${i}`}
                rank={i + 1}
                pattern={p}
                maxPps={maxPps}
                getAlpha2={getAlpha2}
              />
            ))
          )}
        </div>

        {/* Position indicator + back-to-top */}
        {!loading && processed.length > 0 && (
          <div
            className="absolute bottom-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-data"
            style={{
              backgroundColor: "var(--qgi-surface-2)",
              color: "var(--qgi-text-dim)",
              border: "1px solid var(--qgi-border)",
              opacity: 0.9,
            }}
          >
            <span>
              #{scrollPosition.start}-{scrollPosition.end} of{" "}
              {processed.length.toLocaleString()}
            </span>
            {showBackToTop && (
              <button
                onClick={scrollToTop}
                className="ml-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider hover:text-[var(--qgi-text)] transition-colors"
                style={{ color: "var(--qgi-accent)" }}
              >
                Top
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// RankCard — the core card-row component
// ===========================================================================
function RankCard({
  rank,
  pattern: p,
  maxPps,
  getAlpha2,
}: {
  rank: number;
  pattern: PatternRow;
  maxPps: number;
  getAlpha2: (idOrName: string | number | undefined, name: string) => string;
}) {
  const alpha2A = getAlpha2(p.country_a_id, p.country_a);
  const alpha2B = getAlpha2(p.country_b_id, p.country_b);

  // Rank color intensity
  const rankColor =
    rank <= 3
      ? "var(--qgi-amber)"
      : rank <= 10
        ? "var(--qgi-text)"
        : "var(--qgi-text-muted)";

  // Top 3 get a left accent border
  const accentBorder = rank <= 3 ? "3px solid var(--qgi-amber)" : "3px solid transparent";

  // #435 Bug 3: row is now an <a href> (via next/link) instead of <button
  // onClick>. Browsers now honour right-click "Open in new tab",
  // middle-click, cmd/ctrl-click, and SEO crawlers can follow the link
  // for link-equity flow. Rows lacking numeric IDs stay as <div> (no
  // working link target — same silent-skip behaviour as the old
  // navigateToPattern guard).
  const href = patternDetailHref(p);
  const rowClassName =
    "w-full grid items-center px-3 border-b transition-all hover:bg-[var(--qgi-surface-2)] group";
  const rowStyle = {
    gridTemplateColumns: "42px 1fr 240px",
    height: 56,
    minWidth: 640,
    borderColor: "var(--qgi-border)",
    borderLeft: accentBorder,
  } as const;

  const body = (
    <>
      {/* ---- Zone 1: Rank ---- */}
      <span className="font-data text-sm font-semibold" style={{ color: rankColor }}>
        #{rank}
      </span>

      {/* ---- Zone 2: Pair Block ---- */}
      <div className="flex flex-col justify-center gap-0.5 min-w-0 pr-4">
        {/* Line 1: flags + names + arrow */}
        <div className="flex items-center gap-1.5 text-[13px] min-w-0">
          <CountryFlag alpha2={alpha2A} size={14} />
          <span className="font-data truncate" style={{ color: "var(--qgi-country-a)" }}>
            {p.country_a}
          </span>
          <span
            className="text-[11px] mx-0.5 shrink-0"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            &rarr;
          </span>
          <CountryFlag alpha2={alpha2B} size={14} />
          <span className="font-data truncate" style={{ color: "var(--qgi-country-b)" }}>
            {p.country_b}
          </span>
        </div>

        {/* Line 2: metadata */}
        <div
          className="flex items-center gap-1.5 text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <span className="font-data">{p.start_year_a}</span>
          <span style={{ fontSize: 8 }}>&gt;</span>
          <span className="font-data">{p.start_year_b}</span>
          <span className="mx-0.5">&middot;</span>
          <LeadTimeBadge startA={p.start_year_a} startB={p.start_year_b} />
          <span className="mx-0.5">&middot;</span>
          <span className="font-data">{p.pattern_length} yr</span>
          <span className="mx-0.5">&middot;</span>
          <span className="font-data">{p.num_indexes} SCDIs</span>
        </div>
      </div>

      {/* ---- Zone 3: Strength Block ---- */}
      <div className="flex flex-col justify-center gap-1">
        {/* Line 1: PPS bar + value */}
        <PpsBar pps={p.pattern_power_score} maxPps={maxPps} />

        {/* Line 2: Correlation pill */}
        <div className="flex items-center justify-end">
          <CorrelationPill r={p.avg_correlation} />
        </div>
      </div>
    </>
  );

  if (href == null) {
    return (
      <div
        className={rowClassName}
        style={{ ...rowStyle, opacity: 0.6 }}
        title="Missing numeric country IDs — cannot link to detail view"
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${rowClassName} cursor-pointer`}
      style={rowStyle}
      prefetch={false}
    >
      {body}
    </Link>
  );
}

// ===========================================================================
// PpsBar — horizontal strength indicator
// ===========================================================================
function PpsBar({ pps, maxPps }: { pps: number; maxPps: number }) {
  const fillPercent = Math.min(100, (pps / maxPps) * 100);
  const color = rawPpsColor(pps);
  const formatted = Math.round(pps).toLocaleString();

  return (
    <div className="flex items-center gap-2 justify-end">
      <span
        className="text-[9px] uppercase tracking-wider shrink-0"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        PPS
      </span>
      {/* Track */}
      <div
        className="relative h-[6px] rounded-full overflow-hidden"
        style={{
          width: 120,
          backgroundColor: "var(--qgi-surface-2)",
        }}
      >
        {/* Fill */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {/* Value */}
      <span className="font-data text-xs font-semibold text-right w-12" style={{ color }}>
        {formatted}
      </span>
    </div>
  );
}

// ===========================================================================
// CorrelationPill — S/A/B/C tier badge
// ===========================================================================
function CorrelationPill({ r }: { r: number }) {
  const tier = getCorrTier(r);
  const color = CORR_TIER_COLORS[tier];
  const pct = (r * 100).toFixed(0);

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-data font-semibold"
      style={{
        backgroundColor: `${color}18`,
        color,
      }}
      title={CORR_TIER_LABELS[tier]}
    >
      {pct}%<span className="text-[9px] font-bold">{tier}</span>
    </span>
  );
}

// ===========================================================================
// LeadTimeBadge — directional insight at a glance
// ===========================================================================
function LeadTimeBadge({ startA, startB }: { startA: number; startB: number }) {
  const gap = startB - startA;

  if (gap === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[10px] font-data"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <span style={{ fontSize: 9 }}>&#9889;</span>
        concurrent
      </span>
    );
  }

  if (gap > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[10px] font-data font-semibold"
        style={{ color: "var(--qgi-amber)" }}
      >
        <span style={{ fontSize: 9 }}>&#8612;</span>+{gap} yr lead
      </span>
    );
  }

  // gap < 0 (trailing, rare)
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-data"
      style={{ color: "var(--qgi-text-muted)" }}
    >
      {gap} yr trailing
    </span>
  );
}

// ===========================================================================
// FilterChip — closeable active filter chip
// ===========================================================================
function FilterChip({
  label,
  color,
  onRemove,
}: {
  label: string;
  color?: string;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-data"
      style={{
        backgroundColor: color ? `${color}20` : "var(--qgi-surface-2)",
        color: color ?? "var(--qgi-text)",
        border: `1px solid ${color ? `${color}40` : "var(--qgi-border)"}`,
      }}
    >
      {label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 w-3.5 h-3.5 rounded-full inline-flex items-center justify-center hover:bg-[var(--qgi-surface)] text-[9px]"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        &times;
      </button>
    </span>
  );
}
