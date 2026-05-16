"use client";

/**
 * PatternsClient V4 -- Matches Browse V2 prototype exactly.
 *
 * Browse states:
 *   S0 - Landing: welcome card with stats + prompt (NO top pairs table)
 *   S1 - Country A selected: partner table (flag, name, lengths, range)
 *   S2 - Pair selected: pair header + LENGTH RANGE slider + windows table
 *   S3 - Pattern loaded: V2 hero card + expandable SCDIs
 *
 * Key changes from V3:
 * - S0: removed Top Global Pairs table (that's what /ranking is for)
 * - S1: enhanced partner table with range column
 * - S2: replaced Duration/Window dropdowns with length-range slider +
 *        filterable windows table (ported from Browse V2 prototype)
 * - Cascade strip: only Predictor + Following dropdowns (no Duration/Window)
 */

import { useState, useCallback, useEffect, useId, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { ScdiTable } from "@/components/patterns-v1/ScdiTable";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { TRANSFORMATION_LABELS, type Transformation } from "@/lib/transforms";
import { sectorColor } from "@/lib/design";
import type { PatternRow } from "@/lib/types";
import countriesList from "@/data/countries.json";
import { TOTAL_COUNTRIES, TOTAL_PATTERNS } from "@/lib/site-stats";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ------------------------------------------------------------------ */
/*  Country lookup                                                     */
/* ------------------------------------------------------------------ */

interface CountryEntry {
  id: string;
  name: string;
  alpha_2: string;
}

const COUNTRIES_LIST = countriesList as CountryEntry[];

const ALPHA2_MAP: Record<string, string> = {};
const NAME_TO_ALPHA2: Record<string, string> = {};
const ID_TO_NAME: Record<string, string> = {};
for (const c of COUNTRIES_LIST) {
  ALPHA2_MAP[c.id] = c.alpha_2;
  NAME_TO_ALPHA2[c.name] = c.alpha_2;
  ID_TO_NAME[c.id] = c.name;
}

function getAlpha2(idOrName: string | undefined, name: string): string {
  if (idOrName && ALPHA2_MAP[idOrName]) return ALPHA2_MAP[idOrName];
  if (NAME_TO_ALPHA2[name]) return NAME_TO_ALPHA2[name];
  return "";
}

function getCountryName(id: string): string {
  return ID_TO_NAME[id] ?? id;
}

/* ------------------------------------------------------------------ */
/*  PPS color helpers                                                  */
/* ------------------------------------------------------------------ */

const PPS_QUINTILES = [
  { label: "Very weak", min: 0, max: 0.5, color: "#8aa6be" },
  { label: "Weak", min: 0.5, max: 0.65, color: "#7a90a8" },
  { label: "Moderate", min: 0.65, max: 0.75, color: "#fbbf24" },
  { label: "Strong", min: 0.75, max: 0.85, color: "#fb923c" },
  { label: "Very strong", min: 0.85, max: 1.0, color: "#f87171" },
];

function ppsLabel(pps: number): string {
  if (pps >= 0.85) return "Very Strong";
  if (pps >= 0.75) return "Strong";
  if (pps >= 0.65) return "Moderate";
  if (pps >= 0.5) return "Weak";
  return "Very Weak";
}

function ppsColor(pps: number): string {
  if (pps >= 0.85) return "#f87171";
  if (pps >= 0.75) return "#fb923c";
  if (pps >= 0.65) return "#fbbf24";
  if (pps >= 0.5) return "#7a90a8";
  return "#8aa6be";
}

function rawPpsColor(pps: number): string {
  if (pps >= 1500) return "#f87171";
  if (pps >= 1000) return "#fb923c";
  if (pps >= 500) return "#fbbf24";
  return "#7a90a8";
}

function corrColor(r: number): string {
  if (r >= 0.9) return "#f87171";
  if (r >= 0.85) return "#fb923c";
  if (r >= 0.8) return "#fbbf24";
  return "#7a90a8";
}

/* ------------------------------------------------------------------ */
/*  PPS inline bar (from V2 prototype)                                 */
/* ------------------------------------------------------------------ */

function PpsBar({
  pps,
  maxPps,
  colorFn,
}: {
  pps: number;
  maxPps: number;
  colorFn?: (v: number) => string;
}) {
  const pct = Math.min(100, maxPps > 0 ? (pps / maxPps) * 100 : 0);
  const color = colorFn ? colorFn(pps) : rawPpsColor(pps);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 rounded-full"
        style={{
          width: "80px",
          backgroundColor: "var(--qgi-surface-2)",
        }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="font-data text-xs" style={{ color }}>
        {Math.round(pps)}
      </span>
    </div>
  );
}

function leadLabel(lead: number): string {
  if (lead === 0) return "sync";
  if (lead > 0) return `+${lead}yr`;
  return `${lead}yr`;
}

/* ------------------------------------------------------------------ */
/*  Sector colors for SCDI cards                                       */
/* ------------------------------------------------------------------ */

const SECTOR_COLORS: Record<string, string> = {
  Demographic: "#fbbf24",
  Health: "#fb923c",
  Economic: "#38bdf8",
  Trade: "#34d399",
  Education: "#a78bfa",
  Infrastructure: "#f472b6",
  Environment: "#22d3ee",
};

function getSectorColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? sectorColor(sector) ?? "#7a90a8";
}

/* ------------------------------------------------------------------ */
/*  Pattern detail type                                                */
/* ------------------------------------------------------------------ */

interface PatternDetail {
  metadata: Record<string, string>;
  scdis: {
    index_name: string;
    sector: string;
    org: string;
    correlation: number;
    predicted: boolean;
    values_a: number[];
    values_b: number[];
  }[];
}

/* ------------------------------------------------------------------ */
/*  Cascade API types (from CascadeFilter)                             */
/* ------------------------------------------------------------------ */

interface ApiCountry {
  id: string;
  name: string;
}

interface Partner {
  country_b_id: string;
  country_b_name: string;
  available_lengths: number[];
  /**
   * T6 #299 fix (2026-04-19): these fields were previously only read via a
   * duplicate apiFetch call that fetched the same /api/patterns/partners
   * endpoint and cast to a wider inline type. Adding them here so the
   * samePredictorPartners/sameFollowingPartners effects can derive from
   * the existing `partners` state instead of issuing redundant requests.
   */
  alpha2?: string;
  best_pps?: number;
}

interface WindowData {
  length: number;
  start_year_a: number;
  start_year_b: number;
  num_indexes: number;
  avg_correlation: number;
  pattern_power_score: number;
}

/**
 * T6 #299 HIGH fix (2026-04-19): previously sent a literal placeholder
 * `Authorization: Bearer __client__` header on every request. It was a
 * no-op against `withAuth` in SKIP_AUTH=true dev and would fail hard
 * against a real Cognito verifier once that lands (Q13 / #343). Until
 * the real JWT path is wired, just send no Authorization header — the
 * server uses SKIP_AUTH + dev payload already.
 */
async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Timeline helpers                                                   */
/* ------------------------------------------------------------------ */

function yearToPercent(year: number, start: number, end: number): number {
  return ((year - start) / (end - start)) * 100;
}

/* ------------------------------------------------------------------ */
/*  Searchable Country Dropdown (inline, from V2 prototype)            */
/* ------------------------------------------------------------------ */

interface DropdownOption {
  id: string;
  name: string;
  alpha2: string;
}

function CountryDropdown({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string; // country id
  options: DropdownOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  // #741 PR-c (2026-05-17): unique id per CountryDropdown instance so the
  // <label htmlFor> + <input id> association doesn't collide when the
  // page renders multiple CountryDropdowns (Country A + Country B
  // pickers on the same /patterns-v1 page).
  const searchInputId = useId();

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (c) => c.name.toLowerCase().includes(q) || c.alpha2.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div
        className="text-[9px] tracking-widest uppercase mb-1"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-colors min-w-[180px]"
        style={{
          backgroundColor: disabled ? "var(--qgi-bg)" : "var(--qgi-surface)",
          borderColor: open ? "var(--qgi-accent)" : "var(--qgi-border)",
          color: selected ? "var(--qgi-text)" : "var(--qgi-text-dim)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {selected ? (
          <>
            <CountryFlag alpha2={selected.alpha2} size={14} />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span>Select country...</span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-lg border shadow-xl z-50 overflow-hidden"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--qgi-border)" }}>
            {/* #741 PR-c: sr-only label per WCAG 1.3.1. Label text includes
                the CountryDropdown's `label` prop ("Country A" / "Country B")
                so screen readers can disambiguate the two pickers on the
                same page. */}
            <label htmlFor={searchInputId} className="sr-only">
              Search {label} countries
            </label>
            <input
              id={searchInputId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              autoFocus
              className="w-full px-2 py-1 rounded text-xs border-none outline-none"
              style={{
                backgroundColor: "var(--qgi-surface-2)",
                color: "var(--qgi-text)",
              }}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors hover:bg-[var(--qgi-surface-2)]"
                style={{
                  color: value === c.id ? "var(--qgi-accent)" : "var(--qgi-text)",
                }}
              >
                <CountryFlag alpha2={c.alpha2} size={14} />
                <span>{c.name}</span>
                <span
                  className="ml-auto font-data text-[10px]"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {c.alpha2}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div
                className="px-3 py-4 text-xs text-center"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                No countries match &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Breadcrumb component                                               */
/* ------------------------------------------------------------------ */

type BrowseState = "S0" | "S1" | "S2" | "S3";

function Breadcrumb({
  segments,
  onNavigate,
}: {
  segments: { label: string; alpha2?: string; state: BrowseState }[];
  onNavigate: (state: BrowseState) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] tracking-wider">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span style={{ color: "var(--qgi-text-dim)" }}>&rsaquo;</span>}
          <button
            onClick={() => i < segments.length - 1 && onNavigate(seg.state)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              color:
                i === segments.length - 1 ? "var(--qgi-text)" : "var(--qgi-text-muted)",
              cursor: i === segments.length - 1 ? "default" : "pointer",
            }}
          >
            {seg.alpha2 && <CountryFlag alpha2={seg.alpha2} size={12} />}
            {seg.label}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

// T6 #299 HIGH: optional initial top pairs passed in server-side from
// patterns/page.tsx so we avoid fetching /api/patterns/ranking on mount.
interface PatternsClientProps {
  initialTopPairs?: PatternRow[];
}

export default function PatternsClient({
  initialTopPairs = [],
}: PatternsClientProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven initial state
  const initialA = searchParams.get("country_a") ?? "";
  const initialB = searchParams.get("country_b") ?? "";
  const initialLength = searchParams.get("length")
    ? Number(searchParams.get("length"))
    : "";
  const initialStartA = searchParams.get("start_a")
    ? Number(searchParams.get("start_a"))
    : "";
  const initialStartB = searchParams.get("start_b")
    ? Number(searchParams.get("start_b"))
    : "";

  // ---- Cascade state (inlined from CascadeFilter) ----
  const [apiCountries, setApiCountries] = useState<ApiCountry[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [countryA, setCountryA] = useState(initialA);
  const [countryB, setCountryB] = useState(initialB);
  const [length, setLength] = useState<number | "">(initialLength);
  const [yearPair, setYearPair] = useState<string>(
    initialStartA && initialStartB ? `${initialStartA}:${initialStartB}` : ""
  );

  // ---- Pattern detail state ----
  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transformation, setTransformation] = useState<Transformation>("raw");
  const [align, setAlign] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(true);
  const [showTable, setShowTable] = useState(true);

  // S0 landing: top pairs from ranking cache (used for navigateToPattern but NOT shown in S0)
  // T6 #299: seed from server-loaded prop when available — skips the
  // expensive unconditional /api/patterns/ranking?limit=1000 fetch below.
  const [topPairs, setTopPairs] = useState<PatternRow[]>(initialTopPairs);

  // S2: windows data for the length-range slider experience
  const [allWindows, setAllWindows] = useState<WindowData[]>([]);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [lengthMin, setLengthMin] = useState<number>(0);
  const [lengthMax, setLengthMax] = useState<number>(0);

  // V2 detail: expandable SCDI card
  const [expandedScdi, setExpandedScdi] = useState<string | null>(null);
  const [scdiAligned, setScdiAligned] = useState(true);

  // Related patterns (same predictor partners + same following partners)
  interface RelatedPartner {
    id: string;
    name: string;
    alpha2: string;
    pps: number;
    lmin: number;
    lmax: number;
  }
  const [samePredictorPartners, setSamePredictorPartners] = useState<RelatedPartner[]>(
    []
  );
  const [sameFollowingPartners, setSameFollowingPartners] = useState<RelatedPartner[]>(
    []
  );
  const [samePredictorLoading, setSamePredictorLoading] = useState(false);
  const [sameFollowingLoading, setSameFollowingLoading] = useState(false);

  const startsDiffer =
    detail != null &&
    Number(detail.metadata.start_year_a) !== Number(detail.metadata.start_year_b);
  const effectiveAlign = align || startsDiffer;

  // ---- Derive browse state ----
  const browseState: BrowseState = detail
    ? "S3"
    : yearPair
      ? "S2"
      : countryB
        ? "S2"
        : countryA
          ? "S1"
          : "S0";

  // ================================================================
  //  CASCADE DATA FETCHING (inlined from CascadeFilter)
  // ================================================================

  // Load countries once
  useEffect(() => {
    apiFetch<ApiCountry[]>("/api/countries")
      .then(setApiCountries)
      .catch(() => {});
  }, []);

  // Build dropdown options for Country A (from API countries list, with alpha2)
  const countryAOptions: DropdownOption[] = useMemo(() => {
    return apiCountries.map((c) => ({
      id: c.id,
      name: c.name,
      alpha2: ALPHA2_MAP[c.id] ?? "",
    }));
  }, [apiCountries]);

  // Build dropdown options for Country B (from partners list)
  const countryBOptions: DropdownOption[] = useMemo(() => {
    return partners.map((p) => ({
      id: p.country_b_id,
      name: p.country_b_name,
      alpha2: ALPHA2_MAP[p.country_b_id] ?? "",
    }));
  }, [partners]);

  // Load partners when A changes
  useEffect(() => {
    if (!countryA) {
      setPartners([]);
      return;
    }
    apiFetch<Partner[]>(
      `/api/patterns/partners?country_a=${encodeURIComponent(countryA)}`
    )
      .then(setPartners)
      .catch(() => setPartners([]));
  }, [countryA]);

  // Load ALL windows when B changes (for S2 length-range slider)
  useEffect(() => {
    if (!countryA || !countryB) {
      setAllWindows([]);
      return;
    }
    setWindowsLoading(true);
    apiFetch<WindowData[]>(
      `/api/patterns/windows?country_a=${encodeURIComponent(countryA)}&country_b=${encodeURIComponent(countryB)}`
    )
      .then((data) => {
        setAllWindows(data);
        if (data.length > 0) {
          const lens = data.map((w) => w.length);
          setLengthMin(Math.min(...lens));
          setLengthMax(Math.max(...lens));
        }
      })
      .catch(() => setAllWindows([]))
      .finally(() => setWindowsLoading(false));
  }, [countryA, countryB]);

  // Fire pattern load when all 5 params are set
  useEffect(() => {
    if (!countryA || !countryB || !length || !yearPair) return;
    const [startA, startB] = yearPair.split(":").map(Number);
    loadPattern(countryA, countryB, Number(length), startA, startB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryA, countryB, length, yearPair]);

  // T6 #299 MEDIUM fix (2026-04-19): previously this effect fetched
  // `/api/patterns/partners?country_a=${countryA}` — the SAME endpoint
  // already fetched by the "Load partners when A changes" effect above.
  // Derive samePredictorPartners from the existing `partners` state
  // instead of issuing a duplicate network request. The `setSamePredictor
  // Loading` flag becomes redundant (partners loads in lock-step with
  // countryA), but kept as `false` so downstream loading-indicator logic
  // continues to behave.
  useEffect(() => {
    if (!countryA || partners.length === 0) {
      setSamePredictorPartners([]);
      setSamePredictorLoading(false);
      return;
    }
    setSamePredictorLoading(false);
    setSamePredictorPartners(
      partners
        .filter((p) => p.country_b_id !== countryB)
        .slice(0, 3)
        .map((p) => ({
          id: p.country_b_id,
          name: p.country_b_name,
          alpha2: ALPHA2_MAP[p.country_b_id] ?? "",
          pps: p.best_pps ?? 0,
          lmin: p.available_lengths[0] ?? 0,
          lmax: p.available_lengths[p.available_lengths.length - 1] ?? 0,
        }))
    );
  }, [countryA, countryB, partners]);

  useEffect(() => {
    if (!countryB) {
      setSameFollowingPartners([]);
      return;
    }
    setSameFollowingLoading(true);
    apiFetch<
      Array<{
        country_b_id: string;
        country_b_name: string;
        alpha2?: string;
        best_pps?: number;
        available_lengths: number[];
      }>
    >(`/api/patterns/partners?country_a=${encodeURIComponent(countryB)}`)
      .then((data) => {
        const excl = countryA;
        setSameFollowingPartners(
          data
            .filter((p) => p.country_b_id !== excl)
            .slice(0, 3)
            .map((p) => ({
              id: p.country_b_id,
              name: p.country_b_name,
              alpha2: p.alpha2 ?? ALPHA2_MAP[p.country_b_id] ?? "",
              pps: p.best_pps ?? 0,
              lmin: p.available_lengths[0] ?? 0,
              lmax: p.available_lengths[p.available_lengths.length - 1] ?? 0,
            }))
        );
      })
      .catch(() => setSameFollowingPartners([]))
      .finally(() => setSameFollowingLoading(false));
  }, [countryA, countryB]);

  // T6 #299 HIGH: top pairs for S0 landing. Previously fetched 1000 rows
  // from /api/patterns/ranking on every mount just to display 10 pairs.
  // Now seeded from `initialTopPairs` server prop (see patterns/page.tsx).
  // Only fetch if the prop was empty (e.g. fresh env without baked
  // ranking.json, or caller rendering <PatternsClient /> without props).
  useEffect(() => {
    if (initialTopPairs.length > 0) return;
    async function fetchTopPairs() {
      try {
        // Fetch a much smaller page too — previous `limit=1000` was wasteful.
        const res = await fetch("/api/patterns/ranking?page=1&limit=100", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const raw: PatternRow[] = data.results ?? [];
          // Sonnet P1-4: zero-padded numeric-string key so lex-order
          // matches numeric-order for all WB country IDs.
          const padKey = (v: string | number | undefined, fallback: string) => {
            const n = Number(v);
            return Number.isFinite(n)
              ? String(n).padStart(6, "0")
              : String(v ?? fallback);
          };
          const bestPerPair = new Map<string, PatternRow>();
          for (const row of raw) {
            const a = padKey(row.country_a_id, row.country_a);
            const b = padKey(row.country_b_id, row.country_b);
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            const existing = bestPerPair.get(key);
            if (!existing || row.pattern_power_score > existing.pattern_power_score) {
              bestPerPair.set(key, row);
            }
          }
          const deduped = Array.from(bestPerPair.values())
            .sort((a, b) => b.pattern_power_score - a.pattern_power_score)
            .slice(0, 10);
          setTopPairs(deduped);
        }
      } catch {
        // Non-critical
      }
    }
    fetchTopPairs();
  }, [initialTopPairs.length]);

  // ---- Load pattern detail ----
  const loadPattern = useCallback(
    async (ca: string, cb: string, len: number, startA: number, startB: number) => {
      const qs = new URLSearchParams({
        country_a: ca,
        country_b: cb,
        length: String(len),
        start_a: String(startA),
        start_b: String(startB),
      });
      router.replace(`/patterns?${qs.toString()}`, { scroll: false });

      setLoading(true);
      setError(null);
      try {
        // T6 #299 HIGH fix: drop the placeholder Authorization header
        // (same rationale as apiFetch above).
        const res = await fetch(
          `/api/patterns/detail?country_a=${encodeURIComponent(ca)}&country_b=${encodeURIComponent(cb)}&start_a=${startA}&start_b=${startB}&length=${len}`
        );
        if (!res.ok) {
          if (res.status === 500 || res.status === 504) {
            throw new Error(
              "Pattern detail data isn't available right now (per-pattern detail is fetched live and is currently being pre-computed for cache). Try Ranking for a pre-computed top-50 view, or check back after the next monthly pipeline run."
            );
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data: PatternDetail = await res.json();
        setDetail(data);
        setSelectedIndex(null);
        setExpandedScdi(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pattern");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  // ---- Breadcrumb navigation ----
  function navigateToState(target: BrowseState) {
    if (target === "S0") {
      setCountryA("");
      setCountryB("");
      setLength("");
      setYearPair("");
      setDetail(null);
      setError(null);
      router.replace("/patterns-v1", { scroll: false });
    } else if (target === "S1") {
      setCountryB("");
      setLength("");
      setYearPair("");
      setDetail(null);
      setError(null);
    } else if (target === "S2") {
      setYearPair("");
      setDetail(null);
      setError(null);
    }
  }

  // ---- Cascade change handlers ----
  function handleCountryAChange(id: string) {
    setCountryA(id);
    setCountryB("");
    setLength("");
    setYearPair("");
    setDetail(null);
    setError(null);
  }

  function handleCountryBChange(id: string) {
    setCountryB(id);
    setLength("");
    setYearPair("");
    setDetail(null);
    setError(null);
  }

  // ---- Derived values ----
  const isEarlyWarning =
    detail !== null &&
    Number(detail.metadata.start_year_b) > Number(detail.metadata.start_year_a) &&
    Number(detail.metadata.start_year_a) + Number(detail.metadata.pattern_length) >=
      new Date().getFullYear() - 2;

  const countryAName = countryA ? getCountryName(countryA) : "";
  const countryBName = countryB ? getCountryName(countryB) : "";
  const alpha2AVal = countryA ? (ALPHA2_MAP[countryA] ?? "") : "";
  const alpha2BVal = countryB ? (ALPHA2_MAP[countryB] ?? "") : "";

  // ---- S2 slider: filtered windows ----
  const windowLengths = useMemo(() => {
    const s = new Set(allWindows.map((w) => w.length));
    return Array.from(s).sort((a, b) => a - b);
  }, [allWindows]);

  const globalMinLen = windowLengths.length > 0 ? windowLengths[0] : 0;
  const globalMaxLen =
    windowLengths.length > 0 ? windowLengths[windowLengths.length - 1] : 0;

  const filteredWindows = useMemo(
    () => allWindows.filter((w) => w.length >= lengthMin && w.length <= lengthMax),
    [allWindows, lengthMin, lengthMax]
  );

  const topWindowPps =
    allWindows.length > 0 ? Math.max(...allWindows.map((w) => w.pattern_power_score)) : 1;

  // ---- Breadcrumb segments ----
  const breadcrumbSegments: { label: string; alpha2?: string; state: BrowseState }[] = [
    { label: "All Pairs", state: "S0" },
  ];
  if (countryA && browseState !== "S0") {
    breadcrumbSegments.push({
      label: countryAName || countryA,
      alpha2: alpha2AVal,
      state: "S1",
    });
  }
  if (countryB && (browseState === "S2" || browseState === "S3")) {
    breadcrumbSegments.push({
      label: `${countryAName || countryA} - ${countryBName || countryB}`,
      alpha2: alpha2BVal,
      state: "S2",
    });
  }
  if (detail && browseState === "S3") {
    const meta = detail.metadata;
    breadcrumbSegments.push({
      label: `${meta.start_year_a}-${Number(meta.start_year_a) + Number(meta.pattern_length) - 1}`,
      state: "S3",
    });
  }

  // ---- Context line ----
  let contextLine = `${TOTAL_COUNTRIES} countries  \u00b7  ${TOTAL_PATTERNS} patterns  \u00b7  ${topPairs.length > 0 ? `${topPairs.length} ranked pairs in cache` : "Loading..."}`;
  if (browseState === "S1" && countryA) {
    contextLine = `${countryAName || countryA} has patterns with ${partners.length} countries`;
  } else if (browseState === "S2" && countryA && countryB) {
    contextLine = `${countryAName || countryA} + ${countryBName || countryB}: ${allWindows.length} windows  \u00b7  lengths ${globalMinLen}-${globalMaxLen} years`;
  } else if (browseState === "S3" && detail) {
    const meta = detail.metadata;
    contextLine = `${meta.pattern_length} years  \u00b7  ${meta.num_indexes} indicators  \u00b7  Score ${Number(meta.pattern_power_score) <= 1 ? Number(meta.pattern_power_score).toFixed(2) : Math.round(Number(meta.pattern_power_score))}`;
  }

  // ---- Export helpers ----
  function exportCsv() {
    if (!detail) return;
    const meta = detail.metadata;
    const header = "indicator,sector,org,correlation,predicted,values_a,values_b";
    const rows = detail.scdis.map((s) =>
      [
        `"${s.index_name}"`,
        `"${s.sector}"`,
        `"${s.org}"`,
        s.correlation.toFixed(4),
        s.predicted ? "1" : "0",
        `"${s.values_a.join("|")}"`,
        `"${s.values_b.join("|")}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qgi-pattern-${meta.country_a}-${meta.country_b}-${meta.start_year_a}-${meta.start_year_b}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPatternSummary() {
    if (!detail) return;
    const meta = detail.metadata;
    const ppsRaw = Number(meta.pattern_power_score);
    const isNorm = ppsRaw <= 1;
    const ppsDisplay = isNorm ? ppsRaw.toFixed(2) : Math.round(ppsRaw).toLocaleString();
    const startA = Number(meta.start_year_a);
    const endA = startA + Number(meta.pattern_length) - 1;
    const startB = Number(meta.start_year_b);
    const endB = startB + Number(meta.pattern_length) - 1;
    const lines = [
      `QGI Pattern Summary`,
      `-------------------`,
      `Predictor:  ${meta.country_a} (${startA}-${endA})`,
      `Following:  ${meta.country_b} (${startB}-${endB})`,
      `Length:     ${meta.pattern_length} years`,
      `Indicators: ${meta.num_indexes}`,
      `Avg Corr:   ${Number(meta.avg_correlation).toFixed(3)}`,
      `Score:      ${ppsDisplay}`,
      ``,
      `Top indicators:`,
      ...detail.scdis
        .slice(0, 5)
        .map((s) => `  - ${s.index_name} (r=${s.correlation.toFixed(2)})`),
      ``,
      `Source: qgintelligence.com/patterns`,
    ];
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: download as text
      const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qgi-pattern-${meta.country_a}-${meta.country_b}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ============================================================ */}
      {/*  HORIZONTAL CASCADE STRIP (full width, sticky)               */}
      {/* ============================================================ */}
      <div
        className="sticky top-0 z-30 border-b shrink-0"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Row 1: Filter selectors */}
        <div className="flex items-end gap-4 px-4 py-3 flex-wrap">
          <CountryDropdown
            label="Predictor"
            value={countryA}
            options={countryAOptions}
            onChange={handleCountryAChange}
          />

          <span className="pb-2 text-sm" style={{ color: "var(--qgi-text-dim)" }}>
            &rarr;
          </span>

          <CountryDropdown
            label="Following"
            value={countryB}
            options={countryBOptions}
            onChange={handleCountryBChange}
            disabled={!countryA || partners.length === 0}
          />
        </div>

        {/* Row 2: Breadcrumb + context counts */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 border-t"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <Breadcrumb segments={breadcrumbSegments} onNavigate={navigateToState} />
          <span
            className="ml-auto text-[10px] font-data tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {contextLine}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT AREA                                           */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto">
        {/* ============================================================ */}
        {/*  S0 LANDING -- welcome card, no top pairs table               */}
        {/* ============================================================ */}
        {browseState === "S0" && !loading && !error && (
          <div className="p-6 space-y-6">
            {/* Summary card */}
            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              <h2
                className="text-sm tracking-widest uppercase mb-2"
                style={{ color: "var(--qgi-text)" }}
              >
                PATTERNS PORTAL
              </h2>
              <p
                className="text-xs leading-relaxed max-w-2xl"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                Explore structural similarities between countries across 260 economic
                indicators and 60+ years of data. Start by selecting a Predictor Country
                above, or browse the{" "}
                <a
                  href="/patterns-v1/ranking"
                  className="underline transition-colors hover:text-[var(--qgi-accent)]"
                  style={{ color: "var(--qgi-accent)" }}
                >
                  full ranking
                </a>{" "}
                for pre-computed top pairs.
              </p>
              <div
                className="flex gap-4 mt-3 text-[10px] font-data tracking-wider"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                <span>{TOTAL_COUNTRIES} countries</span>
                <span>&middot;</span>
                <span>{TOTAL_PATTERNS} patterns</span>
                <span>&middot;</span>
                <span>
                  {topPairs.length > 0
                    ? `${topPairs.length} ranked pairs in cache`
                    : "Loading..."}
                </span>
              </div>
            </div>

            <p
              className="text-[10px] tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Select a country above to see all its pattern partners, or visit{" "}
              <a
                href="/patterns-v1/ranking"
                className="underline"
                style={{ color: "var(--qgi-accent)" }}
              >
                Ranking
              </a>{" "}
              for the top global pairs.
            </p>
          </div>
        )}

        {/* ============================================================ */}
        {/*  S1 PARTNER TABLE -- shown when Country A selected           */}
        {/* ============================================================ */}
        {browseState === "S1" && !loading && !error && (
          <div className="p-6 space-y-4">
            {/* Header + controls */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3
                  className="text-xs tracking-widest uppercase flex items-center gap-2"
                  style={{ color: "var(--qgi-text)" }}
                >
                  <CountryFlag alpha2={alpha2AVal} size={18} />
                  {(countryAName || countryA).toUpperCase()}&apos;S PATTERN PARTNERS
                  <InfoTooltip text="All countries that share structural indicator patterns with the selected predictor country, ranked by number of available pattern lengths." />
                </h3>
                <div
                  className="text-[10px] tracking-wider mt-1 font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {partners.length} countries &middot; showing top {partners.length}
                </div>
              </div>
            </div>

            {/* Partner table */}
            {partners.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <span
                  className="font-data text-xs animate-pulse"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Loading partners...
                </span>
              </div>
            ) : (
              <>
                <div
                  className="rounded-lg overflow-hidden border"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    borderColor: "var(--qgi-border)",
                  }}
                >
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        className="border-b text-[10px] tracking-widest uppercase"
                        style={{
                          borderColor: "var(--qgi-border)",
                          color: "var(--qgi-text-dim)",
                        }}
                      >
                        <th className="px-3 py-2.5 text-left w-8"></th>
                        <th className="px-3 py-2.5 text-left">
                          PARTNER
                          <InfoTooltip text="The Following country that shares structural patterns with the selected Predictor." />
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          LENGTHS
                          <InfoTooltip text="Number of distinct pattern lengths available for this pair. More lengths = more evidence." />
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          RANGE
                          <InfoTooltip text="Shortest to longest available pattern length in years." />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map((p) => {
                        const pAlpha2 = ALPHA2_MAP[p.country_b_id] ?? "";
                        const sortedLens = [...p.available_lengths].sort((a, b) => a - b);
                        const minL = sortedLens[0] ?? 0;
                        const maxL = sortedLens[sortedLens.length - 1] ?? 0;
                        return (
                          <tr
                            key={p.country_b_id}
                            onClick={() => handleCountryBChange(p.country_b_id)}
                            className="border-b transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                            style={{ borderColor: "var(--qgi-border)" }}
                          >
                            <td className="px-3 py-2.5">
                              <CountryFlag alpha2={pAlpha2} size={16} />
                            </td>
                            <td
                              className="px-3 py-2.5 font-medium"
                              style={{ color: "var(--qgi-text)" }}
                            >
                              {p.country_b_name}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-data"
                              style={{ color: "var(--qgi-text-muted)" }}
                            >
                              {p.available_lengths.length}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-data"
                              style={{ color: "var(--qgi-text-dim)" }}
                            >
                              {minL}&ndash;{maxL}yr
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p
                  className="text-[10px] tracking-wider"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Click any row to see all pattern windows for {countryAName || countryA}{" "}
                  + that country.
                </p>
              </>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/*  S2 PAIR SELECTED -- shown when A+B selected, no detail yet  */}
        {/* ============================================================ */}
        {browseState === "S2" && !detail && !loading && !error && (
          <div className="p-6 space-y-5">
            {/* Pair header */}
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <CountryFlag alpha2={alpha2AVal} size={24} />
                <span
                  className="text-sm font-semibold tracking-wider"
                  style={{ color: "var(--qgi-country-a)" }}
                >
                  {(countryAName || countryA).toUpperCase()}
                </span>
                <span style={{ color: "var(--qgi-text-dim)" }}>
                  &mdash;&mdash;&mdash;
                </span>
                <CountryFlag alpha2={alpha2BVal} size={24} />
                <span
                  className="text-sm font-semibold tracking-wider"
                  style={{ color: "var(--qgi-country-b)" }}
                >
                  {(countryBName || countryB).toUpperCase()}
                </span>
              </div>
              <div
                className="text-[10px] font-data tracking-wider"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {windowsLoading
                  ? "Loading windows..."
                  : `${allWindows.length} pattern windows \u00b7 ${windowLengths.length} unique lengths \u00b7 best Score ${Math.round(topWindowPps)}`}
              </div>
            </div>

            {/* Length range slider */}
            {!windowsLoading && allWindows.length > 0 && (
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: "var(--qgi-surface)",
                  border: "1px solid var(--qgi-border)",
                }}
              >
                <div
                  className="text-[10px] tracking-widest uppercase mb-3"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  LENGTH RANGE
                  <InfoTooltip text="Filter pattern windows by length. Drag to narrow the range." />
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className="font-data text-xs w-6 text-right"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {globalMinLen}
                  </span>

                  <div className="flex-1 relative">
                    {/* Track background */}
                    <div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: "var(--qgi-surface-2)" }}
                    />

                    {/* Active range highlight */}
                    {globalMaxLen > globalMinLen && (
                      <div
                        className="absolute top-0 h-2 rounded-full"
                        style={{
                          left: `${((lengthMin - globalMinLen) / (globalMaxLen - globalMinLen)) * 100}%`,
                          right: `${100 - ((lengthMax - globalMinLen) / (globalMaxLen - globalMinLen)) * 100}%`,
                          backgroundColor: "var(--qgi-accent)",
                          opacity: 0.4,
                        }}
                      />
                    )}

                    {/* Tick marks for available lengths */}
                    <div
                      className="flex justify-between mt-1.5 relative"
                      style={{ height: "20px" }}
                    >
                      {windowLengths.map((len) => (
                        <div
                          key={len}
                          className="flex flex-col items-center"
                          style={{
                            position: "absolute",
                            left:
                              globalMaxLen > globalMinLen
                                ? `${((len - globalMinLen) / (globalMaxLen - globalMinLen)) * 100}%`
                                : "50%",
                            transform: "translateX(-50%)",
                          }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-1"
                            style={{
                              backgroundColor:
                                len >= lengthMin && len <= lengthMax
                                  ? "var(--qgi-accent)"
                                  : "var(--qgi-text-dim)",
                            }}
                          />
                          <span
                            className="text-[8px] font-data mt-0.5"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            {len}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Dual-thumb range inputs.
                        T6 #299 fix (2026-04-19): previous implementation
                        had two stacked opacity-0 inputs with
                        `pointer-events: auto` on both — every click went
                        to whichever input was rendered last, so both
                        thumbs moved together. Fixed via the
                        `.qgi-dual-thumb-input` class in globals.css,
                        which disables pointer-events on the input body
                        and restores it only on the ::thumb pseudo-element.
                        Each thumb is now independently grabbable. */}
                    <input
                      aria-label="Minimum pattern length"
                      type="range"
                      min={globalMinLen}
                      max={globalMaxLen}
                      value={lengthMin}
                      onChange={(e) =>
                        setLengthMin(Math.min(Number(e.target.value), lengthMax))
                      }
                      className="qgi-dual-thumb-input absolute top-0 w-full h-2 bg-transparent appearance-none"
                      style={{ zIndex: 2 }}
                    />
                    <input
                      aria-label="Maximum pattern length"
                      type="range"
                      min={globalMinLen}
                      max={globalMaxLen}
                      value={lengthMax}
                      onChange={(e) =>
                        setLengthMax(Math.max(Number(e.target.value), lengthMin))
                      }
                      className="qgi-dual-thumb-input absolute top-0 w-full h-2 bg-transparent appearance-none"
                      style={{ zIndex: 3 }}
                    />
                  </div>

                  <span
                    className="font-data text-xs w-6"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {globalMaxLen}
                  </span>
                </div>

                <div
                  className="text-[10px] font-data mt-3 text-center"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {lengthMin} &ndash; {lengthMax} years ({filteredWindows.length} of{" "}
                  {allWindows.length} windows)
                </div>
              </div>
            )}

            {/* Windows table */}
            {windowsLoading ? (
              <div className="flex items-center justify-center py-12">
                <span
                  className="font-data text-xs animate-pulse"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Loading windows...
                </span>
              </div>
            ) : filteredWindows.length > 0 ? (
              <>
                <div
                  className="rounded-lg overflow-hidden border"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    borderColor: "var(--qgi-border)",
                  }}
                >
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        className="border-b text-[10px] tracking-widest uppercase"
                        style={{
                          borderColor: "var(--qgi-border)",
                          color: "var(--qgi-text-dim)",
                        }}
                      >
                        <th className="px-3 py-2.5 text-left w-8">#</th>
                        <th
                          className="px-3 py-2.5 text-left"
                          style={{ color: "var(--qgi-country-a)" }}
                        >
                          {(countryAName || countryA).toUpperCase()}
                          <InfoTooltip text="Time window for the Predictor country." />
                        </th>
                        <th
                          className="px-3 py-2.5 text-left"
                          style={{ color: "var(--qgi-country-b)" }}
                        >
                          {(countryBName || countryB).toUpperCase()}
                          <InfoTooltip text="Time window for the Following country." />
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          YRS
                          <InfoTooltip text="Pattern length in years." />
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          IDX
                          <InfoTooltip text="Number of matching indicators (SCDIs)." />
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          CORR
                          <InfoTooltip text="Average Pearson correlation." />
                        </th>
                        <th className="px-3 py-2.5 text-left pl-6">
                          SCORE
                          <InfoTooltip text="Pattern Power Score — strength + persistence + breadth." />
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          LEAD
                          <InfoTooltip text="Lead time in years." />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWindows.map((w, idx) => {
                        const endA = w.start_year_a + w.length - 1;
                        const endB = w.start_year_b + w.length - 1;
                        const lead = w.start_year_b - w.start_year_a;
                        return (
                          <tr
                            key={`${w.start_year_a}-${w.start_year_b}-${w.length}`}
                            onClick={() => {
                              setLength(w.length);
                              setYearPair(`${w.start_year_a}:${w.start_year_b}`);
                            }}
                            className="border-b transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                            style={{ borderColor: "var(--qgi-border)" }}
                          >
                            <td
                              className="px-3 py-2.5 font-data"
                              style={{ color: "var(--qgi-text-dim)" }}
                            >
                              {idx + 1}
                            </td>
                            <td
                              className="px-3 py-2.5 font-data"
                              style={{ color: "var(--qgi-country-a)" }}
                            >
                              {w.start_year_a}&ndash;{endA}
                            </td>
                            <td
                              className="px-3 py-2.5 font-data"
                              style={{ color: "var(--qgi-country-b)" }}
                            >
                              {w.start_year_b}&ndash;{endB}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-data"
                              style={{ color: "var(--qgi-text-muted)" }}
                            >
                              {w.length}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-data"
                              style={{ color: "var(--qgi-text-muted)" }}
                            >
                              {w.num_indexes}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-data"
                              style={{ color: corrColor(w.avg_correlation) }}
                            >
                              {(w.avg_correlation * 100).toFixed(0)}%
                            </td>
                            <td className="px-3 py-2.5 pl-6">
                              <PpsBar pps={w.pattern_power_score} maxPps={topWindowPps} />
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-data"
                              style={{
                                color:
                                  lead > 0 ? "var(--qgi-success)" : "var(--qgi-text-dim)",
                              }}
                            >
                              {leadLabel(lead)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p
                  className="text-[10px] tracking-wider"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Click any row to view the full pattern detail with indicator charts.
                </p>
              </>
            ) : allWindows.length > 0 ? (
              <div
                className="rounded-lg p-5 text-center"
                style={{
                  backgroundColor: "var(--qgi-surface)",
                  border: "1px dashed var(--qgi-border)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                  No windows match the selected length range. Adjust the slider above.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-24">
            <span
              className="font-data text-xs animate-pulse"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Loading pattern...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-8 max-w-2xl">
            <div
              className="rounded-lg border-l-2 p-4"
              style={{
                borderColor: "var(--qgi-amber)",
                backgroundColor: "var(--qgi-surface)",
              }}
            >
              <div
                className="text-[10px] tracking-[0.2em] uppercase mb-2"
                style={{ color: "var(--qgi-amber)" }}
              >
                Pattern detail unavailable
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/*  V2 PATTERN DETAIL VIEW                                      */}
        {/* ============================================================ */}
        {detail &&
          !loading &&
          (() => {
            const meta = detail.metadata;
            const detailCountryA = meta.country_a;
            const detailCountryB = meta.country_b;
            const startA = Number(meta.start_year_a);
            const startB = Number(meta.start_year_b);
            const len = Number(meta.pattern_length);
            const endA = startA + len - 1;
            const endB = startB + len - 1;
            const avgCorr = Number(meta.avg_correlation);
            const ppsRaw = Number(meta.pattern_power_score);
            const numIdx = Number(meta.num_indexes);
            const lag = startB - startA;
            const detailA2A = getAlpha2(undefined, detailCountryA);
            const detailA2B = getAlpha2(undefined, detailCountryB);

            const isNormalized = ppsRaw <= 1;
            const gaugePct = isNormalized
              ? ppsRaw * 100
              : Math.min(100, (ppsRaw / 2000) * 100);
            const ppsDisplay = isNormalized
              ? ppsRaw.toFixed(2)
              : Math.round(ppsRaw).toLocaleString();
            const ppsLbl = isNormalized
              ? ppsLabel(ppsRaw)
              : ppsRaw >= 1500
                ? "Very Strong"
                : ppsRaw >= 1000
                  ? "Strong"
                  : ppsRaw >= 500
                    ? "Moderate"
                    : "Weak";
            const ppsClr = isNormalized ? ppsColor(ppsRaw) : rawPpsColor(ppsRaw);

            const allYears = [startA, endA, startB, endB, new Date().getFullYear()];
            const timelineStart = Math.min(...allYears) - 3;
            const timelineEnd = Math.max(...allYears) + 3;

            const sectorCounts: Record<string, number> = {};
            for (const s of detail.scdis) {
              sectorCounts[s.sector] = (sectorCounts[s.sector] ?? 0) + 1;
            }

            return (
              <div className="p-6 space-y-6">
                {/* === HERO PATTERN CARD === */}
                <section
                  className="rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  {/* Early Warning Banner */}
                  {isEarlyWarning && (
                    <div
                      className="flex items-center gap-3 px-6 py-2.5 text-xs font-semibold"
                      style={{
                        backgroundColor: "rgba(248, 113, 113, 0.12)",
                        borderBottom: "1px solid #f87171",
                      }}
                    >
                      <span style={{ color: "#f87171" }}>EARLY WARNING SIGNAL</span>
                      <span style={{ color: "var(--qgi-text-muted)", fontWeight: 400 }}>
                        Predictor country is currently in its historical window
                      </span>
                    </div>
                  )}

                  {/* Row 1: Identity + PPS Gauge */}
                  <div className="p-6 lg:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                      {/* Country A */}
                      <div className="flex items-center gap-4">
                        <CountryFlag alpha2={detailA2A} size={36} />
                        <div>
                          <div
                            className="text-lg font-semibold"
                            style={{ color: "var(--qgi-country-a)" }}
                          >
                            {detailCountryA.toUpperCase()}
                          </div>
                          <div
                            className="font-data text-xs"
                            style={{ color: "var(--qgi-text-muted)" }}
                          >
                            {startA} &mdash; {endA}
                          </div>
                          <div
                            className="text-[10px] tracking-widest uppercase mt-0.5"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            PREDICTOR
                          </div>
                        </div>
                      </div>

                      {/* Center: PPS gauge + stats */}
                      <div className="flex flex-col items-center gap-3 px-4 lg:px-8">
                        {lag !== 0 && (
                          <div
                            className="flex items-center gap-2 text-[10px] tracking-widest"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            {/* T6 #299 LOW fix (2026-04-19): arrow direction
                              now reflects the sign of the lag. Positive lag
                              = predictor before follower (forward →).
                              Negative lag = follower before predictor
                              (reverse ←). Previously always rendered "← N →"
                              regardless of sign, losing the directionality. */}
                            {lag > 0 ? (
                              <span>{Math.abs(lag)}yr lag &rarr;</span>
                            ) : (
                              <span>&larr; {Math.abs(lag)}yr lag</span>
                            )}
                          </div>
                        )}

                        {/* PPS gauge bar */}
                        <div className="w-full max-w-xs">
                          <div className="flex rounded-full h-4 overflow-hidden relative">
                            {isNormalized
                              ? PPS_QUINTILES.map((q) => (
                                  <div
                                    key={q.label}
                                    className="h-full"
                                    style={{
                                      width: `${(q.max - q.min) * 100}%`,
                                      backgroundColor: q.color,
                                      opacity: 0.35,
                                    }}
                                  />
                                ))
                              : [
                                  { min: 0, max: 500, color: "#8aa6be" },
                                  { min: 500, max: 1000, color: "#fbbf24" },
                                  { min: 1000, max: 1500, color: "#fb923c" },
                                  { min: 1500, max: 2000, color: "#f87171" },
                                ].map((q) => (
                                  <div
                                    key={q.min}
                                    className="h-full"
                                    style={{
                                      width: `${((q.max - q.min) / 2000) * 100}%`,
                                      backgroundColor: q.color,
                                      opacity: 0.35,
                                    }}
                                  />
                                ))}
                            <div
                              className="absolute top-0 h-full w-1 rounded"
                              style={{
                                left: `${gaugePct}%`,
                                backgroundColor: "#fff",
                                transform: "translateX(-50%)",
                                boxShadow: "0 0 6px rgba(255,255,255,0.5)",
                              }}
                            />
                          </div>
                        </div>

                        <div className="text-center">
                          <div
                            className="font-data text-3xl font-bold"
                            style={{ color: ppsClr }}
                          >
                            {ppsDisplay}
                          </div>
                          <div
                            className="text-[9px] tracking-widest uppercase"
                            style={{ color: "var(--qgi-text-dim)" }}
                            title="Pattern Power Score — strength + persistence + breadth"
                          >
                            SCORE -- {ppsLbl}
                          </div>
                        </div>

                        <div
                          className="flex gap-4 text-[10px] font-data"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          <span>{len}yrs</span>
                          <span>&middot;</span>
                          <span>{numIdx} indicators</span>
                          <span>&middot;</span>
                          <span>avg r {avgCorr.toFixed(3)}</span>
                        </div>
                      </div>

                      {/* Country B */}
                      <div className="flex items-center gap-4 lg:justify-end">
                        <div className="text-right">
                          <div
                            className="text-lg font-semibold"
                            style={{ color: "var(--qgi-country-b)" }}
                          >
                            {detailCountryB.toUpperCase()}
                          </div>
                          <div
                            className="font-data text-xs"
                            style={{ color: "var(--qgi-text-muted)" }}
                          >
                            {startB} &mdash; {endB}
                          </div>
                          <div
                            className="text-[10px] tracking-widest uppercase mt-0.5"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            FOLLOWING
                          </div>
                        </div>
                        <CountryFlag alpha2={detailA2B} size={36} />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Timeline ribbon */}
                  <div
                    className="px-6 lg:px-8 py-5"
                    style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
                  >
                    <div className="relative h-20">
                      <div
                        className="absolute top-1/2 left-0 right-0 h-px"
                        style={{ backgroundColor: "var(--qgi-border)" }}
                      />

                      {/* Year labels */}
                      {Array.from(
                        new Set(
                          [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030].filter(
                            (y) => y >= timelineStart && y <= timelineEnd
                          )
                        )
                      ).map((y) => (
                        <div
                          key={y}
                          className="absolute bottom-0 text-[9px] font-data -translate-x-1/2"
                          style={{
                            left: `${yearToPercent(y, timelineStart, timelineEnd)}%`,
                            color: "var(--qgi-text-dim)",
                          }}
                        >
                          {y}
                        </div>
                      ))}

                      {/* Predictor bar (top) */}
                      <div
                        className="absolute h-5 rounded"
                        style={{
                          left: `${yearToPercent(startA, timelineStart, timelineEnd)}%`,
                          width: `${yearToPercent(endA, timelineStart, timelineEnd) - yearToPercent(startA, timelineStart, timelineEnd)}%`,
                          top: "8px",
                          backgroundColor: "var(--qgi-country-a)",
                          opacity: 0.6,
                        }}
                      />
                      <div
                        className="absolute text-[9px] font-data -translate-x-1/2"
                        style={{
                          left: `${yearToPercent((startA + endA) / 2, timelineStart, timelineEnd)}%`,
                          top: "10px",
                          color: "#fff",
                        }}
                      >
                        {detailA2A} {startA}-{endA}
                      </div>

                      {/* Following bar (bottom) */}
                      <div
                        className="absolute h-5 rounded"
                        style={{
                          left: `${yearToPercent(startB, timelineStart, timelineEnd)}%`,
                          width: `${yearToPercent(endB, timelineStart, timelineEnd) - yearToPercent(startB, timelineStart, timelineEnd)}%`,
                          top: "48px",
                          backgroundColor: "var(--qgi-country-b)",
                          opacity: 0.6,
                        }}
                      />
                      <div
                        className="absolute text-[9px] font-data -translate-x-1/2"
                        style={{
                          left: `${yearToPercent((startB + endB) / 2, timelineStart, timelineEnd)}%`,
                          top: "50px",
                          color: "#fff",
                        }}
                      >
                        {detailA2B} {startB}-{endB}
                      </div>

                      {/* Today marker */}
                      {(() => {
                        const today = new Date().getFullYear();
                        if (today >= timelineStart && today <= timelineEnd) {
                          return (
                            <>
                              <div
                                className="absolute"
                                style={{
                                  left: `${yearToPercent(today, timelineStart, timelineEnd)}%`,
                                  top: "0",
                                  bottom: "0",
                                  width: "1px",
                                  backgroundColor: "#34d399",
                                }}
                              />
                              <div
                                className="absolute text-[8px] tracking-wider -translate-x-1/2"
                                style={{
                                  left: `${yearToPercent(today, timelineStart, timelineEnd)}%`,
                                  top: "0",
                                  color: "#34d399",
                                }}
                              >
                                today
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Row 3: Action buttons */}
                  <div className="p-6 lg:p-8 flex gap-3 flex-wrap">
                    {["View methodology", "View ranking"].map((label) => (
                      <a
                        key={label}
                        href={
                          label === "View methodology"
                            ? "/methodology"
                            : "/patterns-v1/ranking"
                        }
                        className="px-4 py-2 rounded text-[11px] tracking-wider transition-colors"
                        style={{
                          backgroundColor: "var(--qgi-surface-2)",
                          color: "var(--qgi-text-muted)",
                          border: "1px solid var(--qgi-border)",
                        }}
                      >
                        {label}
                      </a>
                    ))}
                    <button
                      onClick={exportPatternSummary}
                      className="px-4 py-2 rounded text-[11px] tracking-wider transition-colors"
                      style={{
                        backgroundColor: "var(--qgi-surface-2)",
                        color: "var(--qgi-text-muted)",
                        border: "1px solid var(--qgi-border)",
                      }}
                    >
                      Export pattern
                    </button>
                  </div>
                </section>

                {/* === TOOLBAR === */}
                <div
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  {/* Transformation selector — #741 PR-c: sr-only label per WCAG 1.3.1 */}
                  <label htmlFor="patterns-v1-transformation" className="sr-only">
                    Indicator transformation
                  </label>
                  <select
                    id="patterns-v1-transformation"
                    value={transformation}
                    onChange={(e) => setTransformation(e.target.value as Transformation)}
                    className="text-[10px] rounded border px-2 py-1 bg-transparent outline-none focus:border-[var(--qgi-accent)]"
                    style={{
                      borderColor: "var(--qgi-border)",
                      color: "var(--qgi-text-muted)",
                    }}
                  >
                    {Object.entries(TRANSFORMATION_LABELS).map(([k, v]) => (
                      <option key={k} value={k} style={{ backgroundColor: "#162032" }}>
                        {v}
                      </option>
                    ))}
                  </select>

                  {/* Align toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => !startsDiffer && setAlign(!effectiveAlign)}
                      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                      style={{
                        backgroundColor: effectiveAlign
                          ? "var(--qgi-accent)"
                          : "var(--qgi-border)",
                        opacity: startsDiffer ? 0.6 : 1,
                        cursor: startsDiffer ? "default" : "pointer",
                      }}
                      title={
                        startsDiffer
                          ? "Auto-aligned: windows at different calendar years"
                          : "Align to Year 1, Year 2, ..."
                      }
                    >
                      <div
                        className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                        style={{ left: effectiveAlign ? "calc(100% - 14px)" : "2px" }}
                      />
                    </button>
                    <span
                      className="text-[10px] tracking-wider"
                      style={{
                        color: effectiveAlign
                          ? "var(--qgi-accent)"
                          : "var(--qgi-text-dim)",
                      }}
                    >
                      {effectiveAlign ? "Aligned (Year 1-N)" : "Calendar years"}
                      {startsDiffer && (
                        <span style={{ color: "var(--qgi-amber)" }}> (auto)</span>
                      )}
                    </span>
                  </div>

                  <div className="flex-1" />

                  {/* Sector chips */}
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(sectorCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([s]) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded text-[9px] tracking-wider"
                          style={{
                            backgroundColor: `${getSectorColor(s)}18`,
                            color: getSectorColor(s),
                            border: `1px solid ${getSectorColor(s)}33`,
                          }}
                        >
                          {s.toUpperCase()}
                        </span>
                      ))}
                  </div>

                  {/* Section toggles */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTable(!showTable)}
                      className="text-[10px] tracking-wider px-2 py-1 rounded border"
                      style={{
                        borderColor: showTable
                          ? "var(--qgi-accent)"
                          : "var(--qgi-border)",
                        color: showTable ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                      }}
                    >
                      TABLE
                    </button>
                    <button
                      onClick={() => setShowCharts(!showCharts)}
                      className="text-[10px] tracking-wider px-2 py-1 rounded border"
                      style={{
                        borderColor: showCharts
                          ? "var(--qgi-accent)"
                          : "var(--qgi-border)",
                        color: showCharts ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                      }}
                    >
                      CHARTS
                    </button>
                  </div>

                  {/* Export CSV */}
                  <button
                    onClick={exportCsv}
                    className="px-3 py-1.5 rounded text-[10px] tracking-wider transition-colors"
                    style={{
                      backgroundColor: "var(--qgi-surface-2)",
                      color: "var(--qgi-text-muted)",
                      border: "1px solid var(--qgi-border)",
                    }}
                  >
                    Export CSV
                  </button>
                </div>

                {/* === MAIN BODY: Charts + Table LEFT / Related Patterns RIGHT === */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
                  {/* ---- Left: SCDI cards + table ---- */}
                  <div className="space-y-6">
                    {/* === V2 EXPANDABLE SCDI CARDS === */}
                    {showCharts && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {detail.scdis.map((s, i) => {
                          const isExpanded = expandedScdi === s.index_name;
                          const sc = getSectorColor(s.sector);
                          return (
                            <div
                              key={s.index_name}
                              className={`rounded-lg p-3 cursor-pointer transition-all hover:border-[var(--qgi-accent)] ${isExpanded ? "col-span-2 lg:col-span-4" : ""}`}
                              style={{
                                backgroundColor: `${sc}08`,
                                border: isExpanded
                                  ? `1px solid ${sc}66`
                                  : "1px solid var(--qgi-border)",
                              }}
                              onClick={() =>
                                setExpandedScdi(isExpanded ? null : s.index_name)
                              }
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div
                                  className="text-[9px] tracking-wider truncate"
                                  style={{ color: "var(--qgi-text-muted)" }}
                                  title={s.index_name}
                                >
                                  {s.index_name}
                                </div>
                                <span
                                  className="text-[9px] ml-2 shrink-0"
                                  style={{ color: "var(--qgi-text-dim)" }}
                                >
                                  {isExpanded ? "collapse" : "expand"}
                                </span>
                              </div>

                              {isExpanded ? (
                                <div>
                                  <div
                                    className="flex items-center gap-3 mb-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setScdiAligned(!scdiAligned);
                                      }}
                                      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                                      style={{
                                        backgroundColor: scdiAligned
                                          ? "var(--qgi-accent)"
                                          : "var(--qgi-border)",
                                      }}
                                    >
                                      <div
                                        className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                                        style={{
                                          left: scdiAligned ? "calc(100% - 14px)" : "2px",
                                        }}
                                      />
                                    </button>
                                    <span
                                      className="text-[9px] tracking-wider"
                                      style={{
                                        color: scdiAligned
                                          ? "var(--qgi-accent)"
                                          : "var(--qgi-text-dim)",
                                      }}
                                    >
                                      {scdiAligned
                                        ? `Aligned (Year 1-${len})`
                                        : "Calendar years"}
                                    </span>
                                  </div>
                                  <div className="h-48 mb-2">
                                    <ReactECharts
                                      option={{
                                        backgroundColor: "transparent",
                                        tooltip: {
                                          trigger: "axis",
                                          backgroundColor: "#1e2d42",
                                          borderColor: "#243347",
                                          textStyle: { color: "#e2e8f0", fontSize: 10 },
                                        },
                                        legend: {
                                          data: [detailCountryA, detailCountryB],
                                          top: 0,
                                          right: 8,
                                          textStyle: { color: "#7a90a8", fontSize: 9 },
                                          itemWidth: 12,
                                          itemHeight: 2,
                                        },
                                        grid: {
                                          top: 30,
                                          right: 12,
                                          bottom: 24,
                                          left: 48,
                                        },
                                        xAxis: scdiAligned
                                          ? {
                                              type: "category" as const,
                                              data: Array.from(
                                                { length: len },
                                                (_, j) => `Year ${j + 1}`
                                              ),
                                              axisLine: {
                                                lineStyle: { color: "#243347" },
                                              },
                                              axisLabel: {
                                                color: "#8aa6be",
                                                fontSize: 9,
                                              },
                                            }
                                          : {
                                              type: "value" as const,
                                              min: Math.min(startA, startB) - 1,
                                              max: Math.max(endA, endB) + 1,
                                              axisLine: {
                                                lineStyle: { color: "#243347" },
                                              },
                                              axisLabel: {
                                                color: "#8aa6be",
                                                fontSize: 9,
                                                formatter: (v: number) =>
                                                  String(Math.round(v)),
                                              },
                                              splitLine: { show: false },
                                            },
                                        yAxis: {
                                          type: "value",
                                          scale: true,
                                          axisLine: { lineStyle: { color: "#243347" } },
                                          splitLine: { lineStyle: { color: "#1a2a3a" } },
                                          axisLabel: { color: "#8aa6be", fontSize: 9 },
                                        },
                                        series: scdiAligned
                                          ? [
                                              {
                                                name: detailCountryA,
                                                type: "line",
                                                data: s.values_a,
                                                lineStyle: { color: "#38bdf8", width: 2 },
                                                itemStyle: { color: "#38bdf8" },
                                                symbol: "circle",
                                                symbolSize: 4,
                                              },
                                              {
                                                name: detailCountryB,
                                                type: "line",
                                                data: s.values_b,
                                                lineStyle: { color: "#fb923c", width: 2 },
                                                itemStyle: { color: "#fb923c" },
                                                symbol: "circle",
                                                symbolSize: 4,
                                              },
                                            ]
                                          : [
                                              {
                                                name: detailCountryA,
                                                type: "line",
                                                data: s.values_a.map((v, j) => [
                                                  startA + j,
                                                  v,
                                                ]),
                                                lineStyle: { color: "#38bdf8", width: 2 },
                                                itemStyle: { color: "#38bdf8" },
                                                symbol: "circle",
                                                symbolSize: 4,
                                              },
                                              {
                                                name: detailCountryB,
                                                type: "line",
                                                data: s.values_b.map((v, j) => [
                                                  startB + j,
                                                  v,
                                                ]),
                                                lineStyle: { color: "#fb923c", width: 2 },
                                                itemStyle: { color: "#fb923c" },
                                                symbol: "circle",
                                                symbolSize: 4,
                                              },
                                            ],
                                      }}
                                      style={{ height: "100%", width: "100%" }}
                                      notMerge
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="mb-2 rounded flex items-center justify-center h-16"
                                  style={{ backgroundColor: "var(--qgi-surface)" }}
                                >
                                  {s.correlation != null ? (
                                    <div className="w-full px-2">
                                      {/* T6 #299 MEDIUM fix (2026-04-19):
                                        correlation bar was `Math.max(4, ...)`
                                        which gave negative correlations a
                                        visible 4% positive-width bar. Now
                                        renders signed: abs() for width,
                                        red for negative, existing color
                                        for positive. */}
                                      <div
                                        className="h-2 rounded-full"
                                        style={{
                                          backgroundColor: "var(--qgi-surface-2)",
                                        }}
                                      >
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${Math.min(100, Math.round(Math.abs(s.correlation) * 100))}%`,
                                            backgroundColor:
                                              s.correlation < 0 ? "#f87171" : sc,
                                            opacity: 0.7,
                                          }}
                                        />
                                      </div>
                                      <div
                                        className="text-center mt-1.5 font-data text-[9px]"
                                        style={{ color: sc }}
                                      >
                                        r = {s.correlation.toFixed(2)}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}

                              <div className="flex items-center justify-between">
                                <div
                                  className="w-1 h-3 rounded-full"
                                  style={{ backgroundColor: sc }}
                                />
                                <span
                                  className="font-data text-[10px]"
                                  style={{ color: "var(--qgi-text-muted)" }}
                                >
                                  r={s.correlation.toFixed(2)}{" "}
                                  {s.correlation >= 0.85
                                    ? "***"
                                    : s.correlation >= 0.75
                                      ? "**"
                                      : "*"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* === SCDI TABLE === */}
                    {showTable && (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          backgroundColor: "var(--qgi-surface)",
                          border: "1px solid var(--qgi-border)",
                        }}
                      >
                        <div
                          className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b"
                          style={{
                            color: "var(--qgi-text-dim)",
                            borderColor: "var(--qgi-border)",
                          }}
                        >
                          Indicator Matches ({detail.scdis.length})
                        </div>
                        <ScdiTable
                          scdis={detail.scdis}
                          onRowSelect={(name) =>
                            setSelectedIndex(selectedIndex === name ? null : name)
                          }
                          selectedIndex={selectedIndex}
                        />
                      </div>
                    )}
                  </div>

                  {/* ---- Right: Related patterns sidebar ---- */}
                  <div className="space-y-4">
                    {/* SAME PREDICTOR panel */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: "var(--qgi-surface)",
                        border: "1px solid var(--qgi-border)",
                      }}
                    >
                      <div className="mb-3">
                        <div
                          className="text-[10px] tracking-widest uppercase font-semibold"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          SAME PREDICTOR
                        </div>
                        <div
                          className="text-[9px] tracking-wider"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {detailCountryA} &rarr; others
                        </div>
                      </div>
                      <div className="space-y-2">
                        {samePredictorLoading ? (
                          <div
                            className="text-[9px]"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            Loading...
                          </div>
                        ) : samePredictorPartners.length === 0 ? (
                          <div
                            className="text-[9px]"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            No other partners
                          </div>
                        ) : (
                          samePredictorPartners.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleCountryBChange(p.id)}
                              className="flex items-center gap-2 p-2 rounded w-full transition-colors text-left cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                            >
                              <div className="flex items-center gap-1 shrink-0">
                                <CountryFlag alpha2={detailA2A} size={14} />
                                <span
                                  className="text-[9px]"
                                  style={{ color: "var(--qgi-text-dim)" }}
                                >
                                  &rarr;
                                </span>
                                <CountryFlag alpha2={p.alpha2} size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-[10px] font-data truncate"
                                  style={{ color: "var(--qgi-text)" }}
                                >
                                  {detailCountryA} &rarr; {p.name}
                                </div>
                                <div
                                  className="text-[9px]"
                                  style={{ color: "var(--qgi-text-dim)" }}
                                >
                                  {p.lmin}&ndash;{p.lmax}yr
                                </div>
                              </div>
                              <div
                                className="font-data text-xs font-bold shrink-0"
                                style={{ color: "var(--qgi-accent)" }}
                              >
                                {p.pps > 1 ? Math.round(p.pps) : p.pps.toFixed(2)}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* SAME FOLLOWING panel */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: "var(--qgi-surface)",
                        border: "1px solid var(--qgi-border)",
                      }}
                    >
                      <div className="mb-3">
                        <div
                          className="text-[10px] tracking-widest uppercase font-semibold"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          SAME FOLLOWING
                        </div>
                        <div
                          className="text-[9px] tracking-wider"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {detailCountryB} &rarr; others
                        </div>
                      </div>
                      <div className="space-y-2">
                        {sameFollowingLoading ? (
                          <div
                            className="text-[9px]"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            Loading...
                          </div>
                        ) : sameFollowingPartners.length === 0 ? (
                          <div
                            className="text-[9px]"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            No other partners
                          </div>
                        ) : (
                          sameFollowingPartners.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setCountryA(countryB);
                                handleCountryBChange(p.id);
                              }}
                              className="flex items-center gap-2 p-2 rounded w-full transition-colors text-left cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                            >
                              <div className="flex items-center gap-1 shrink-0">
                                <CountryFlag alpha2={detailA2B} size={14} />
                                <span
                                  className="text-[9px]"
                                  style={{ color: "var(--qgi-text-dim)" }}
                                >
                                  &rarr;
                                </span>
                                <CountryFlag alpha2={p.alpha2} size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-[10px] font-data truncate"
                                  style={{ color: "var(--qgi-text)" }}
                                >
                                  {detailCountryB} &rarr; {p.name}
                                </div>
                                <div
                                  className="text-[9px]"
                                  style={{ color: "var(--qgi-text-dim)" }}
                                >
                                  {p.lmin}&ndash;{p.lmax}yr
                                </div>
                              </div>
                              <div
                                className="font-data text-xs font-bold shrink-0"
                                style={{ color: "var(--qgi-accent)" }}
                              >
                                {p.pps > 1 ? Math.round(p.pps) : p.pps.toFixed(2)}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* SIMILAR MIX panel (placeholder) */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: "var(--qgi-surface)",
                        border: "1px dashed var(--qgi-border)",
                      }}
                    >
                      <div className="mb-3">
                        <div
                          className="text-[10px] tracking-widest uppercase font-semibold"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          SIMILAR MIX
                        </div>
                        <div
                          className="text-[9px] tracking-wider"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {Object.keys(sectorCounts).slice(0, 3).join(" + ") ||
                            "indicator composition"}
                        </div>
                      </div>
                      <p
                        className="text-[9px] leading-relaxed"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        Patterns with similar indicator composition will appear here after
                        the next pipeline run.
                      </p>
                    </div>
                  </div>
                </div>

                {/* === METHODOLOGY FOOTER === */}
                <footer
                  className="rounded-lg p-4 text-[10px] tracking-wider leading-relaxed"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    color: "var(--qgi-text-dim)",
                    border: "1px solid var(--qgi-border)",
                  }}
                >
                  V1.8.1 z-score + RRF &middot; Pearson r &ge; 0.65 &middot; &plusmn;15%
                  event window &middot; PPS quintiles: very weak &lt;0.50 / weak &lt;0.65
                  / moderate &lt;0.75 / strong &lt;0.85 / very strong &ge;0.85
                </footer>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
