"use client";

/**
 * PatternsClient V3 -- Horizontal cascade strip layout.
 *
 * Browse states (borrowed from Browse V2 prototype):
 *   S0 - Landing: top 10 global pairs table (from ranking cache)
 *   S1 - Country A selected: filter strip shows "Predictor > Following"
 *   S2 - Pair + length selected: year window selector appears
 *   S3 - Pattern loaded: V2 hero card + expandable SCDIs
 *
 * The vertical cascade sidebar has been removed. All filter controls
 * live in a sticky horizontal strip at the top. Data-fetching logic
 * from CascadeFilter.tsx is inlined here.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { ScdiTable } from "@/components/patterns/ScdiTable";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import {
  TRANSFORMATION_LABELS,
  type Transformation,
} from "@/lib/transforms";
import { sectorColor } from "@/lib/design";
import type { PatternRow } from "@/lib/types";
import countriesList from "@/data/countries.json";

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
  { label: "Very weak", min: 0, max: 0.5, color: "#4a6280" },
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
  return "#4a6280";
}

function rawPpsColor(pps: number): string {
  if (pps >= 1500) return "#f87171";
  if (pps >= 1000) return "#fb923c";
  if (pps >= 500) return "#fbbf24";
  return "#7a90a8";
}

function corrColor(r: number): string {
  if (r >= 0.90) return "#f87171";
  if (r >= 0.85) return "#fb923c";
  if (r >= 0.80) return "#fbbf24";
  return "#7a90a8";
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
}

interface YearPair {
  start_year_a: number;
  start_year_b: number;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: "Bearer __client__" } });
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

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.alpha2.toLowerCase().includes(q)
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
        <span
          className="ml-auto text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
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
          <div
            className="p-2 border-b"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <input
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
                  color:
                    value === c.id
                      ? "var(--qgi-accent)"
                      : "var(--qgi-text)",
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
          {i > 0 && (
            <span style={{ color: "var(--qgi-text-dim)" }}>&rsaquo;</span>
          )}
          <button
            onClick={() => i < segments.length - 1 && onNavigate(seg.state)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              color:
                i === segments.length - 1
                  ? "var(--qgi-text)"
                  : "var(--qgi-text-muted)",
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

export default function PatternsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven initial state
  const initialA = searchParams.get("country_a") ?? "";
  const initialB = searchParams.get("country_b") ?? "";
  const initialLength = searchParams.get("length") ? Number(searchParams.get("length")) : "";
  const initialStartA = searchParams.get("start_a") ? Number(searchParams.get("start_a")) : "";
  const initialStartB = searchParams.get("start_b") ? Number(searchParams.get("start_b")) : "";

  // ---- Cascade state (inlined from CascadeFilter) ----
  const [apiCountries, setApiCountries] = useState<ApiCountry[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [lengths, setLengths] = useState<number[]>([]);
  const [yearPairs, setYearPairs] = useState<YearPair[]>([]);

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

  // S0 landing: top pairs from ranking cache
  const [topPairs, setTopPairs] = useState<PatternRow[]>([]);
  const [landingLoading, setLandingLoading] = useState(true);

  // V2 detail: expandable SCDI card
  const [expandedScdi, setExpandedScdi] = useState<string | null>(null);
  const [scdiAligned, setScdiAligned] = useState(true);

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
    apiFetch<ApiCountry[]>("/api/countries").then(setApiCountries).catch(() => {});
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

  // Load lengths when B changes
  useEffect(() => {
    if (!countryA || !countryB) {
      setLengths([]);
      return;
    }
    apiFetch<number[]>(
      `/api/patterns/lengths?country_a=${encodeURIComponent(countryA)}&country_b=${encodeURIComponent(countryB)}`
    )
      .then(setLengths)
      .catch(() => setLengths([]));
  }, [countryA, countryB]);

  // Load year pairs when length changes
  useEffect(() => {
    if (!countryA || !countryB || !length) {
      setYearPairs([]);
      return;
    }
    apiFetch<YearPair[]>(
      `/api/patterns/years?country_a=${encodeURIComponent(countryA)}&country_b=${encodeURIComponent(countryB)}&length=${length}`
    )
      .then(setYearPairs)
      .catch(() => setYearPairs([]));
  }, [countryA, countryB, length]);

  // Fire pattern load when all 5 params are set
  useEffect(() => {
    if (!countryA || !countryB || !length || !yearPair) return;
    const [startA, startB] = yearPair.split(":").map(Number);
    loadPattern(countryA, countryB, Number(length), startA, startB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryA, countryB, length, yearPair]);

  // Fetch top pairs for S0 landing
  useEffect(() => {
    async function fetchTopPairs() {
      try {
        const res = await fetch("/api/patterns/ranking?page=1&limit=1000", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const raw: PatternRow[] = data.results ?? [];
          const bestPerPair = new Map<string, PatternRow>();
          for (const row of raw) {
            const a = row.country_a_id ?? row.country_a;
            const b = row.country_b_id ?? row.country_b;
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
      } finally {
        setLandingLoading(false);
      }
    }
    fetchTopPairs();
  }, []);

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
        const res = await fetch(
          `/api/patterns/detail?country_a=${encodeURIComponent(ca)}&country_b=${encodeURIComponent(cb)}&start_a=${startA}&start_b=${startB}&length=${len}`,
          { headers: { Authorization: "Bearer __client__" } }
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

  // ---- Navigation from S0 landing table ----
  function navigateToPattern(p: PatternRow) {
    const ca = p.country_a_id ?? p.country_a;
    const cb = p.country_b_id ?? p.country_b;
    setCountryA(ca);
    setCountryB(cb);
    setLength(p.pattern_length);
    setYearPair(`${p.start_year_a}:${p.start_year_b}`);
  }

  // ---- Breadcrumb navigation ----
  function navigateToState(target: BrowseState) {
    if (target === "S0") {
      setCountryA("");
      setCountryB("");
      setLength("");
      setYearPair("");
      setDetail(null);
      setError(null);
      router.replace("/patterns", { scroll: false });
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

  function handleLengthChange(val: string) {
    setLength(val ? Number(val) : "");
    setYearPair("");
    setDetail(null);
    setError(null);
  }

  function handleYearPairChange(val: string) {
    setYearPair(val);
    setDetail(null);
    setError(null);
  }

  // ---- Derived values ----
  const isEarlyWarning =
    detail !== null &&
    Number(detail.metadata.start_year_b) < Number(detail.metadata.start_year_a) &&
    Number(detail.metadata.start_year_a) + Number(detail.metadata.pattern_length) >=
      new Date().getFullYear() - 2;

  const countryAName = countryA ? getCountryName(countryA) : "";
  const countryBName = countryB ? getCountryName(countryB) : "";
  const alpha2AVal = countryA ? (ALPHA2_MAP[countryA] ?? "") : "";
  const alpha2BVal = countryB ? (ALPHA2_MAP[countryB] ?? "") : "";

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
  let contextLine = `214 countries  \u00b7  2.01B patterns  \u00b7  ${topPairs.length > 0 ? `${topPairs.length} ranked pairs in cache` : "Loading..."}`;
  if (browseState === "S1" && countryA) {
    contextLine = `${countryAName || countryA} has patterns with ${partners.length} countries`;
  } else if (browseState === "S2" && countryA && countryB) {
    contextLine = `${countryAName || countryA} + ${countryBName || countryB}: ${lengths.length} lengths available`;
  } else if (browseState === "S3" && detail) {
    const meta = detail.metadata;
    contextLine = `${meta.pattern_length} years  \u00b7  ${meta.num_indexes} indicators  \u00b7  PPS ${Number(meta.pattern_power_score) <= 1 ? Number(meta.pattern_power_score).toFixed(2) : Math.round(Number(meta.pattern_power_score))}`;
  }

  // ---- Select styles ----
  const selectClass =
    "px-3 py-1.5 text-xs rounded border bg-transparent outline-none focus:border-[var(--qgi-accent)] transition-colors min-w-[120px]";
  const selectStyle = {
    borderColor: "var(--qgi-border)",
    color: "var(--qgi-text)",
    backgroundColor: "var(--qgi-surface)",
  };

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

          <span
            className="pb-2 text-sm"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            &rarr;
          </span>

          <CountryDropdown
            label="Following"
            value={countryB}
            options={countryBOptions}
            onChange={handleCountryBChange}
            disabled={!countryA || partners.length === 0}
          />

          {/* Length selector -- appears after B is selected */}
          {countryA && countryB && (
            <div>
              <div
                className="text-[9px] tracking-widest uppercase mb-1"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Duration
              </div>
              <select
                value={length}
                onChange={(e) => handleLengthChange(e.target.value)}
                className={selectClass}
                style={selectStyle}
                disabled={lengths.length === 0}
              >
                <option value="">Select length...</option>
                {lengths.map((l) => (
                  <option key={l} value={l}>
                    {l} years
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Year window selector -- appears after length is selected */}
          {countryA && countryB && length && (
            <div>
              <div
                className="text-[9px] tracking-widest uppercase mb-1"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Window
              </div>
              <select
                value={yearPair}
                onChange={(e) => handleYearPairChange(e.target.value)}
                className={selectClass}
                style={{ ...selectStyle, minWidth: "200px" }}
                disabled={yearPairs.length === 0}
              >
                <option value="">Select window...</option>
                {yearPairs.map((yp) => (
                  <option
                    key={`${yp.start_year_a}:${yp.start_year_b}`}
                    value={`${yp.start_year_a}:${yp.start_year_b}`}
                  >
                    {yp.start_year_a}&ndash;{yp.start_year_a + Number(length) - 1} / {yp.start_year_b}&ndash;{yp.start_year_b + Number(length) - 1}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 2: Breadcrumb + context counts */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 border-t"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <Breadcrumb
            segments={breadcrumbSegments}
            onNavigate={navigateToState}
          />
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
        {/*  S0 LANDING -- shown when no country is selected             */}
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
                Explore structural similarities between countries across
                economic indicators and decades of data. Start by
                selecting a Predictor Country above, or browse the
                top-ranked pattern pairs below.
              </p>
              <div
                className="flex gap-4 mt-3 text-[10px] font-data tracking-wider"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                <span>214 countries</span>
                <span>&middot;</span>
                <span>2.01B patterns</span>
                <span>&middot;</span>
                <span>{topPairs.length > 0 ? `${topPairs.length} ranked pairs in cache` : "Loading..."}</span>
              </div>
            </div>

            {/* Top pairs table */}
            {landingLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="font-data text-xs animate-pulse" style={{ color: "var(--qgi-text-dim)" }}>
                  Loading top pairs...
                </span>
              </div>
            ) : topPairs.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-xs tracking-widest uppercase"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    TOP GLOBAL PAIRS
                    <InfoTooltip text="Top 10 pattern pairs ranked by Pattern Power Score (PPS), drawn from the pre-computed ranking cache." />
                  </h3>
                  <a
                    href="/patterns/ranking"
                    className="text-[10px] tracking-wider transition-colors hover:underline"
                    style={{ color: "var(--qgi-accent)" }}
                  >
                    View full ranking &rarr;
                  </a>
                </div>

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
                        <th className="px-3 py-2.5 text-left">
                          PAIR
                          <InfoTooltip text="Predictor country followed by Following country." />
                        </th>
                        <th className="px-3 py-2.5 text-right">YRS</th>
                        <th className="px-3 py-2.5 text-right">IDX</th>
                        <th className="px-3 py-2.5 text-right">CORR</th>
                        <th className="px-3 py-2.5 text-left pl-6">
                          PPS
                          <InfoTooltip text="Pattern Power Score -- composite strength metric." />
                        </th>
                        <th className="px-3 py-2.5 text-right">LEAD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPairs.map((row, i) => {
                        const a2A = getAlpha2(row.country_a_id, row.country_a);
                        const a2B = getAlpha2(row.country_b_id, row.country_b);
                        const lead = row.start_year_b - row.start_year_a;
                        const maxPps = topPairs[0]?.pattern_power_score ?? 1;
                        const pct = Math.min(100, (row.pattern_power_score / maxPps) * 100);
                        return (
                          <tr
                            key={`${row.country_a_id}-${row.country_b_id}-${row.start_year_a}-${i}`}
                            onClick={() => navigateToPattern(row)}
                            className="border-b transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                            style={{ borderColor: "var(--qgi-border)" }}
                          >
                            <td className="px-3 py-2.5 font-data" style={{ color: "var(--qgi-text-dim)" }}>
                              {i + 1}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <CountryFlag alpha2={a2A} size={16} />
                                <span className="font-data text-xs" style={{ color: "var(--qgi-country-a)" }}>
                                  {row.country_a}
                                </span>
                                <span style={{ color: "var(--qgi-text-dim)" }}>&rarr;</span>
                                <CountryFlag alpha2={a2B} size={16} />
                                <span className="font-data text-xs" style={{ color: "var(--qgi-country-b)" }}>
                                  {row.country_b}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                              {row.pattern_length}
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                              {row.num_indexes}
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: corrColor(row.avg_correlation) }}>
                              {(row.avg_correlation * 100).toFixed(0)}%
                            </td>
                            <td className="px-3 py-2.5 pl-6">
                              <div className="flex items-center gap-2">
                                <div className="h-2 rounded-full" style={{ width: "80px", backgroundColor: "var(--qgi-surface-2)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: rawPpsColor(row.pattern_power_score) }} />
                                </div>
                                <span className="font-data text-xs" style={{ color: rawPpsColor(row.pattern_power_score) }}>
                                  {Math.round(row.pattern_power_score)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-data" style={{ color: lead > 0 ? "var(--qgi-success)" : "var(--qgi-text-dim)" }}>
                              {lead === 0 ? "sync" : lead > 0 ? `+${lead}yr` : `${lead}yr`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p
                  className="mt-3 text-[10px] tracking-wider"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Click any row to view full pattern detail, or use the filter strip above to discover patterns manually.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <span className="text-[10px] tracking-[0.25em] uppercase" style={{ color: "var(--qgi-text-dim)" }}>
                  Patterns Portal
                </span>
                <p className="text-sm text-center max-w-sm" style={{ color: "var(--qgi-text-dim)" }}>
                  Select a Predictor Country above and follow the steps to discover a geopolitical pattern.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/*  S1 PARTNER TABLE -- shown when Country A selected           */}
        {/* ============================================================ */}
        {browseState === "S1" && !loading && !error && (
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3
                  className="text-xs tracking-widest uppercase flex items-center gap-2"
                  style={{ color: "var(--qgi-text)" }}
                >
                  <CountryFlag alpha2={alpha2AVal} size={18} />
                  {(countryAName || countryA).toUpperCase()}&apos;S PATTERN PARTNERS
                  <InfoTooltip text="All countries that share structural indicator patterns with the selected predictor country." />
                </h3>
                <div
                  className="text-[10px] tracking-wider mt-1 font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {partners.length} countries with shared patterns
                </div>
              </div>
            </div>

            {/* Partner table */}
            {partners.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <span className="font-data text-xs animate-pulse" style={{ color: "var(--qgi-text-dim)" }}>
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
                          <InfoTooltip text="Number of distinct pattern lengths available for this pair." />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map((p) => {
                        const pAlpha2 = ALPHA2_MAP[p.country_b_id] ?? "";
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
                  Click any row to see all pattern windows for {countryAName || countryA} + that country, or use the Following dropdown above.
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
                <span style={{ color: "var(--qgi-text-dim)" }}>&mdash;&mdash;&mdash;</span>
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
                {lengths.length > 0
                  ? `${lengths.length} pattern lengths available -- select Duration and Window above to view a pattern`
                  : "Loading lengths..."}
              </div>
            </div>

            {/* Guidance */}
            <div
              className="rounded-lg p-5 text-center"
              style={{
                backgroundColor: "var(--qgi-surface)",
                border: "1px dashed var(--qgi-border)",
              }}
            >
              <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
                SELECT A WINDOW
              </div>
              <p className="text-xs max-w-md mx-auto" style={{ color: "var(--qgi-text-dim)" }}>
                Use the Duration and Window selectors in the filter strip above to choose
                a specific pattern window. The full pattern detail will load once all
                parameters are selected.
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-24">
            <span className="font-data text-xs animate-pulse" style={{ color: "var(--qgi-text-dim)" }}>
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
              <div className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: "var(--qgi-amber)" }}>
                Pattern detail unavailable
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/*  V2 PATTERN DETAIL VIEW                                      */}
        {/* ============================================================ */}
        {detail && !loading && (() => {
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
          const gaugePct = isNormalized ? ppsRaw * 100 : Math.min(100, (ppsRaw / 2000) * 100);
          const ppsDisplay = isNormalized ? ppsRaw.toFixed(2) : Math.round(ppsRaw).toLocaleString();
          const ppsLbl = isNormalized ? ppsLabel(ppsRaw) : (ppsRaw >= 1500 ? "Very Strong" : ppsRaw >= 1000 ? "Strong" : ppsRaw >= 500 ? "Moderate" : "Weak");
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
                    style={{ backgroundColor: "rgba(248, 113, 113, 0.12)", borderBottom: "1px solid #f87171" }}
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
                        <div className="text-lg font-semibold" style={{ color: "var(--qgi-country-a)" }}>
                          {detailCountryA.toUpperCase()}
                        </div>
                        <div className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                          {startA} &mdash; {endA}
                        </div>
                        <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
                          PREDICTOR
                        </div>
                      </div>
                    </div>

                    {/* Center: PPS gauge + stats */}
                    <div className="flex flex-col items-center gap-3 px-4 lg:px-8">
                      {lag !== 0 && (
                        <div className="flex items-center gap-2 text-[10px] tracking-widest" style={{ color: "var(--qgi-text-dim)" }}>
                          <span>&larr; {Math.abs(lag)}yr lag &rarr;</span>
                        </div>
                      )}

                      {/* PPS gauge bar */}
                      <div className="w-full max-w-xs">
                        <div className="flex rounded-full h-4 overflow-hidden relative">
                          {isNormalized ? (
                            PPS_QUINTILES.map((q) => (
                              <div key={q.label} className="h-full" style={{ width: `${(q.max - q.min) * 100}%`, backgroundColor: q.color, opacity: 0.35 }} />
                            ))
                          ) : (
                            [
                              { min: 0, max: 500, color: "#4a6280" },
                              { min: 500, max: 1000, color: "#fbbf24" },
                              { min: 1000, max: 1500, color: "#fb923c" },
                              { min: 1500, max: 2000, color: "#f87171" },
                            ].map((q) => (
                              <div key={q.min} className="h-full" style={{ width: `${((q.max - q.min) / 2000) * 100}%`, backgroundColor: q.color, opacity: 0.35 }} />
                            ))
                          )}
                          <div
                            className="absolute top-0 h-full w-1 rounded"
                            style={{ left: `${gaugePct}%`, backgroundColor: "#fff", transform: "translateX(-50%)", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }}
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="font-data text-3xl font-bold" style={{ color: ppsClr }}>
                          {ppsDisplay}
                        </div>
                        <div className="text-[9px] tracking-widest uppercase" style={{ color: "var(--qgi-text-dim)" }}>
                          PPS -- {ppsLbl}
                        </div>
                      </div>

                      <div className="flex gap-4 text-[10px] font-data" style={{ color: "var(--qgi-text-muted)" }}>
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
                        <div className="text-lg font-semibold" style={{ color: "var(--qgi-country-b)" }}>
                          {detailCountryB.toUpperCase()}
                        </div>
                        <div className="font-data text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                          {startB} &mdash; {endB}
                        </div>
                        <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "var(--qgi-text-dim)" }}>
                          FOLLOWING
                        </div>
                      </div>
                      <CountryFlag alpha2={detailA2B} size={36} />
                    </div>
                  </div>
                </div>

                {/* Row 2: Timeline ribbon */}
                <div className="px-6 lg:px-8 py-5" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                  <div className="relative h-20">
                    <div className="absolute top-1/2 left-0 right-0 h-px" style={{ backgroundColor: "var(--qgi-border)" }} />

                    {/* Year labels */}
                    {Array.from(
                      new Set(
                        [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030]
                          .filter((y) => y >= timelineStart && y <= timelineEnd)
                      )
                    ).map((y) => (
                      <div
                        key={y}
                        className="absolute bottom-0 text-[9px] font-data -translate-x-1/2"
                        style={{ left: `${yearToPercent(y, timelineStart, timelineEnd)}%`, color: "var(--qgi-text-dim)" }}
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
                      style={{ left: `${yearToPercent((startA + endA) / 2, timelineStart, timelineEnd)}%`, top: "10px", color: "#fff" }}
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
                      style={{ left: `${yearToPercent((startB + endB) / 2, timelineStart, timelineEnd)}%`, top: "50px", color: "#fff" }}
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
                              style={{ left: `${yearToPercent(today, timelineStart, timelineEnd)}%`, top: "0", bottom: "0", width: "1px", backgroundColor: "#34d399" }}
                            />
                            <div
                              className="absolute text-[8px] tracking-wider -translate-x-1/2"
                              style={{ left: `${yearToPercent(today, timelineStart, timelineEnd)}%`, top: "0", color: "#34d399" }}
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
                <div className="p-6 lg:p-8 flex gap-3">
                  {["View methodology", "View ranking"].map((label) => (
                    <a
                      key={label}
                      href={label === "View methodology" ? "/methodology" : "/patterns/ranking"}
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
                {/* Transformation selector */}
                <select
                  value={transformation}
                  onChange={(e) => setTransformation(e.target.value as Transformation)}
                  className="text-[10px] rounded border px-2 py-1 bg-transparent outline-none focus:border-[var(--qgi-accent)]"
                  style={{ borderColor: "var(--qgi-border)", color: "var(--qgi-text-muted)" }}
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
                      backgroundColor: effectiveAlign ? "var(--qgi-accent)" : "var(--qgi-border)",
                      opacity: startsDiffer ? 0.6 : 1,
                      cursor: startsDiffer ? "default" : "pointer",
                    }}
                    title={startsDiffer ? "Auto-aligned: windows at different calendar years" : "Align to Year 1, Year 2, ..."}
                  >
                    <div
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                      style={{ left: effectiveAlign ? "calc(100% - 14px)" : "2px" }}
                    />
                  </button>
                  <span className="text-[10px] tracking-wider" style={{ color: effectiveAlign ? "var(--qgi-accent)" : "var(--qgi-text-dim)" }}>
                    {effectiveAlign ? "Aligned (Year 1-N)" : "Calendar years"}
                    {startsDiffer && <span style={{ color: "var(--qgi-amber)" }}> (auto)</span>}
                  </span>
                </div>

                <div className="flex-1" />

                {/* Sector chips */}
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).map(([s]) => (
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
                      borderColor: showTable ? "var(--qgi-accent)" : "var(--qgi-border)",
                      color: showTable ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                    }}
                  >
                    TABLE
                  </button>
                  <button
                    onClick={() => setShowCharts(!showCharts)}
                    className="text-[10px] tracking-wider px-2 py-1 rounded border"
                    style={{
                      borderColor: showCharts ? "var(--qgi-accent)" : "var(--qgi-border)",
                      color: showCharts ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
                    }}
                  >
                    CHARTS
                  </button>
                </div>
              </div>

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
                          border: isExpanded ? `1px solid ${sc}66` : "1px solid var(--qgi-border)",
                        }}
                        onClick={() => setExpandedScdi(isExpanded ? null : s.index_name)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[9px] tracking-wider truncate" style={{ color: "var(--qgi-text-muted)" }} title={s.index_name}>
                            {s.index_name}
                          </div>
                          <span className="text-[9px] ml-2 shrink-0" style={{ color: "var(--qgi-text-dim)" }}>
                            {isExpanded ? "collapse" : "expand"}
                          </span>
                        </div>

                        {isExpanded ? (
                          <div>
                            <div className="flex items-center gap-3 mb-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setScdiAligned(!scdiAligned); }}
                                className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                                style={{ backgroundColor: scdiAligned ? "var(--qgi-accent)" : "var(--qgi-border)" }}
                              >
                                <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform" style={{ left: scdiAligned ? "calc(100% - 14px)" : "2px" }} />
                              </button>
                              <span className="text-[9px] tracking-wider" style={{ color: scdiAligned ? "var(--qgi-accent)" : "var(--qgi-text-dim)" }}>
                                {scdiAligned ? `Aligned (Year 1-${len})` : "Calendar years"}
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
                                    top: 0, right: 8,
                                    textStyle: { color: "#7a90a8", fontSize: 9 },
                                    itemWidth: 12, itemHeight: 2,
                                  },
                                  grid: { top: 30, right: 12, bottom: 24, left: 48 },
                                  xAxis: scdiAligned
                                    ? {
                                        type: "category" as const,
                                        data: Array.from({ length: len }, (_, j) => `Year ${j + 1}`),
                                        axisLine: { lineStyle: { color: "#243347" } },
                                        axisLabel: { color: "#4a6280", fontSize: 9 },
                                      }
                                    : {
                                        type: "value" as const,
                                        min: Math.min(startA, startB) - 1,
                                        max: Math.max(endA, endB) + 1,
                                        axisLine: { lineStyle: { color: "#243347" } },
                                        axisLabel: { color: "#4a6280", fontSize: 9, formatter: (v: number) => String(Math.round(v)) },
                                        splitLine: { show: false },
                                      },
                                  yAxis: {
                                    type: "value",
                                    scale: true,
                                    axisLine: { lineStyle: { color: "#243347" } },
                                    splitLine: { lineStyle: { color: "#1a2a3a" } },
                                    axisLabel: { color: "#4a6280", fontSize: 9 },
                                  },
                                  series: scdiAligned
                                    ? [
                                        { name: detailCountryA, type: "line", data: s.values_a, lineStyle: { color: "#38bdf8", width: 2 }, itemStyle: { color: "#38bdf8" }, symbol: "circle", symbolSize: 4 },
                                        { name: detailCountryB, type: "line", data: s.values_b, lineStyle: { color: "#fb923c", width: 2 }, itemStyle: { color: "#fb923c" }, symbol: "circle", symbolSize: 4 },
                                      ]
                                    : [
                                        { name: detailCountryA, type: "line", data: s.values_a.map((v, j) => [startA + j, v]), lineStyle: { color: "#38bdf8", width: 2 }, itemStyle: { color: "#38bdf8" }, symbol: "circle", symbolSize: 4 },
                                        { name: detailCountryB, type: "line", data: s.values_b.map((v, j) => [startB + j, v]), lineStyle: { color: "#fb923c", width: 2 }, itemStyle: { color: "#fb923c" }, symbol: "circle", symbolSize: 4 },
                                      ],
                                }}
                                style={{ height: "100%", width: "100%" }}
                                notMerge
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mb-2 rounded" style={{ backgroundColor: "var(--qgi-surface)" }}>
                            <div className="flex items-end gap-px h-16 w-full px-1">
                              {Array.from({ length: Math.min(len, 20) }, (_, j) => {
                                const h = 12 + Math.sin((j * 1.1 + i) * 0.8) * 18 + ((j * 7 + i * 13) % 11);
                                return (
                                  <div
                                    key={j}
                                    className="flex-1 rounded-t"
                                    style={{ height: `${Math.max(4, h)}px`, backgroundColor: "var(--qgi-country-a)", opacity: 0.3 + (j / len) * 0.5 }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: sc }} />
                          <span className="font-data text-[10px]" style={{ color: "var(--qgi-text-muted)" }}>
                            r={s.correlation.toFixed(2)} {s.correlation >= 0.85 ? "***" : s.correlation >= 0.75 ? "**" : "*"}
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
                  <div className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b" style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}>
                    Indicator Matches ({detail.scdis.length})
                  </div>
                  <ScdiTable
                    scdis={detail.scdis}
                    onRowSelect={(name) => setSelectedIndex(selectedIndex === name ? null : name)}
                    selectedIndex={selectedIndex}
                  />
                </div>
              )}

              {/* === RELATED PATTERNS (placeholder) === */}
              <div
                className="rounded-xl p-5"
                style={{
                  backgroundColor: "var(--qgi-surface)",
                  border: "1px dashed var(--qgi-border)",
                }}
              >
                <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
                  RELATED PATTERNS
                </div>
                <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                  Related patterns (same predictor, same following, similar indicator mix) will appear
                  here after the pattern adjacency pre-computation pipeline runs. For now, explore
                  the{" "}
                  <a href="/patterns/ranking" className="underline" style={{ color: "var(--qgi-accent)" }}>
                    full ranking
                  </a>{" "}
                  to discover similar patterns.
                </p>
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
                V1.8.1 z-score + RRF &middot; Pearson r &ge; 0.65 &middot;
                &plusmn;15% event window &middot; PPS quintiles: very weak &lt;0.50 / weak &lt;0.65 /
                moderate &lt;0.75 / strong &lt;0.85 / very strong &ge;0.85
              </footer>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
