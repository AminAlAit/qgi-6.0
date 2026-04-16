"use client";

/**
 * Pattern Power Ranking — GH#255 enrichment: flags, (i) tooltips, year-gap filter.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import type { PatternRow } from "@/lib/types";
import countriesList from "@/data/countries.json";

const PAGE_SIZE = 50;

// Build alpha_2 lookups from the FULL 251-country countries.json (not
// country-risks.json which only has 126). Fixes missing flags for
// countries like Paraguay that are in the pattern DB but not in the
// scored country-risks set.
const ALPHA2_MAP: Record<string, string> = {};
const NAME_TO_ALPHA2: Record<string, string> = {};
for (const c of countriesList as Array<{ id: string; name: string; alpha_2: string }>) {
  ALPHA2_MAP[c.id] = c.alpha_2;
  NAME_TO_ALPHA2[c.name] = c.alpha_2;
}

interface RankingResponse {
  page: number;
  limit: number;
  results: PatternRow[];
  deduped?: boolean;
  total_unique_pairs?: number;
}

export default function RankingPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [deduped, setDeduped] = useState(false);
  const [totalUniquePairs, setTotalUniquePairs] = useState<number | null>(null);

  // Filters
  const [minPps, setMinPps] = useState("");
  const [minCorr, setMinCorr] = useState("");
  const [minYearGap, setMinYearGap] = useState("");
  // Dedup toggle — when ON, collapses to one row per country pair (best PPS
  // window). When OFF, shows all raw windows (up to 1000).
  const [dedupEnabled, setDedupEnabled] = useState(false);
  const [sortCol, setSortCol] = useState<keyof PatternRow>("pattern_power_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Fetch ALL results from the cache (up to 1000) in one go — client-side
  // pagination + dedup + filtering is fast enough for this volume.
  const [allRows, setAllRows] = useState<PatternRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "1000" });
      if (minPps) params.set("min_pps", minPps);
      if (minCorr) params.set("min_corr", minCorr);
      const res = await fetch(`/api/patterns/ranking?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RankingResponse = await res.json();
      setAllRows(data.results);
      setTotalUniquePairs(data.total_unique_pairs ?? null);
      setDeduped(Boolean(data.deduped));
    } catch (err) {
      console.error("Failed to fetch ranking:", err);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [minPps, minCorr]);

  useEffect(() => {
    setPage(1);
    fetchAll();
  }, [fetchAll]);

  function handlePageChange(newPage: number) {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }

  function handleSort(col: keyof PatternRow) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function navigateToPattern(p: PatternRow) {
    const qs = new URLSearchParams({
      country_a: p.country_a_id ?? p.country_a,
      country_b: p.country_b_id ?? p.country_b,
      length: String(p.pattern_length),
      start_a: String(p.start_year_a),
      start_b: String(p.start_year_b),
    });
    router.push(`/patterns?${qs}`);
  }

  // Client-side: dedup toggle + year-gap filter + sort + paginate
  const processed = useMemo(() => {
    let result = allRows;

    // Optional dedup by pair (best PPS per pair)
    if (dedupEnabled) {
      const bestPerPair = new Map<string, PatternRow>();
      for (const row of result) {
        const a = row.country_a_id ?? row.country_a;
        const b = row.country_b_id ?? row.country_b;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const existing = bestPerPair.get(key);
        if (!existing || row.pattern_power_score > existing.pattern_power_score) {
          bestPerPair.set(key, row);
        }
      }
      result = Array.from(bestPerPair.values());
    }

    // Year-gap filter
    if (minYearGap) {
      const gap = Number(minYearGap);
      if (gap > 0) {
        result = result.filter(
          (p) => Math.abs(p.start_year_a - p.start_year_b) >= gap
        );
      }
    }

    // Sort
    return [...result].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [allRows, sortCol, sortDir, minYearGap, dedupEnabled]);

  // Paginate
  const totalPages = Math.ceil(processed.length / PAGE_SIZE);
  const filtered = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortIndicator = (col: keyof PatternRow) =>
    sortCol === col ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";

  function getAlpha2(idOrName: string | undefined, name: string): string {
    if (idOrName && ALPHA2_MAP[idOrName]) return ALPHA2_MAP[idOrName];
    if (NAME_TO_ALPHA2[name]) return NAME_TO_ALPHA2[name];
    return "";
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1
            className="text-xs tracking-[0.2em] uppercase font-semibold"
            style={{ color: "var(--qgi-accent)" }}
          >
            Pattern Power Ranking
          </h1>
          {deduped && totalUniquePairs != null && (
            <span
              className="text-[10px] tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {totalUniquePairs} unique pairs &middot; best window per pair
            </span>
          )}
        </div>
        <span
          className="text-[10px] tracking-wider font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          PAGE {page}
        </span>
      </div>

      {/* Filters — #5/#6/#7: MIN PPS + MIN CORRELATION + YEAR GAP */}
      <div
        className="flex gap-4 items-end p-3 rounded border flex-wrap"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <FilterInput
          label="Min PPS"
          value={minPps}
          onChange={setMinPps}
          step="0.1"
          placeholder="0"
        />
        <FilterInput
          label="Min Correlation"
          value={minCorr}
          onChange={setMinCorr}
          step="0.01"
          min="0"
          max="1"
          placeholder="0"
        />
        <FilterInput
          label="Min Year Gap"
          value={minYearGap}
          onChange={setMinYearGap}
          step="1"
          min="0"
          max="60"
          placeholder="0"
          tooltip="Minimum |start_year_a - start_year_b|. Set >0 to find early-warning patterns where one country's window is offset in time from the other."
        />
        {/* Dedup toggle */}
        <label className="flex items-center gap-2 cursor-pointer self-end pb-1">
          <input
            type="checkbox"
            checked={dedupEnabled}
            onChange={(e) => { setDedupEnabled(e.target.checked); setPage(1); }}
            className="accent-[var(--qgi-accent)]"
          />
          <span className="text-[9px] tracking-[0.15em] uppercase" style={{ color: "var(--qgi-text-dim)" }}>
            Unique pairs only
          </span>
        </label>
      </div>

      {/* Table */}
      <div
        className="flex-1 rounded border overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Header row — #6: (i) tooltips on PPS + Corr */}
        <div
          className="grid text-[9px] tracking-[0.15em] uppercase px-4 py-2.5 border-b select-none"
          style={{
            gridTemplateColumns: "1fr 1fr 80px 80px 60px 60px 100px 70px",
            color: "var(--qgi-text-dim)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <button className="text-left hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("country_a")}>
            Predictor{sortIndicator("country_a")}
          </button>
          <button className="text-left hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("country_b")}>
            Following{sortIndicator("country_b")}
          </button>
          <button className="text-right hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("start_year_a")}>
            Year A{sortIndicator("start_year_a")}
          </button>
          <button className="text-right hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("start_year_b")}>
            Year B{sortIndicator("start_year_b")}
          </button>
          <button className="text-right hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("pattern_length")}>
            Yrs{sortIndicator("pattern_length")}
          </button>
          <button className="text-right hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("num_indexes")}>
            Idx{sortIndicator("num_indexes")}
          </button>
          <button className="text-right hover:text-[var(--qgi-text-muted)] flex items-center justify-end gap-0.5" onClick={() => handleSort("avg_correlation")}>
            Corr{sortIndicator("avg_correlation")}
            <InfoTooltip text="Average Pearson correlation across all matched indicators in this pattern window. >85% = very strong, 65-85% = strong, <65% = weak." />
          </button>
          <button className="text-right hover:text-[var(--qgi-text-muted)] flex items-center justify-end gap-0.5" onClick={() => handleSort("pattern_power_score")}>
            PPS{sortIndicator("pattern_power_score")}
            <InfoTooltip text="Pattern Power Score — a composite ranking metric blending correlation strength, pattern length, and indicator coverage. Higher = more historically grounded match. Range 0-2000+." />
          </button>
        </div>

        {/* Body — #5: flags inline */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex items-center justify-center py-16 text-xs tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              LOADING...
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex items-center justify-center py-16 text-xs tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              NO PATTERNS FOUND
            </div>
          ) : (
            filtered.map((p, i) => {
              const alpha2A = getAlpha2(p.country_a_id, p.country_a);
              const alpha2B = getAlpha2(p.country_b_id, p.country_b);
              const yearGap = Math.abs(p.start_year_a - p.start_year_b);
              return (
                <button
                  key={`${p.country_a}-${p.country_b}-${p.start_year_a}-${p.start_year_b}-${i}`}
                  onClick={() => navigateToPattern(p)}
                  className="w-full grid items-center px-4 py-2 border-b text-xs transition-colors hover:bg-[var(--qgi-surface-2)]"
                  style={{
                    gridTemplateColumns: "1fr 1fr 80px 80px 60px 60px 100px 70px",
                    borderColor: "var(--qgi-border)",
                  }}
                >
                  {/* Predictor with flag */}
                  <span className="text-left font-data truncate flex items-center gap-1.5">
                    <CountryFlag alpha2={alpha2A} size={14} />
                    <span style={{ color: "var(--qgi-country-a)" }}>{p.country_a}</span>
                  </span>
                  {/* Following with flag */}
                  <span className="text-left font-data truncate flex items-center gap-1.5">
                    <CountryFlag alpha2={alpha2B} size={14} />
                    <span style={{ color: "var(--qgi-country-b)" }}>{p.country_b}</span>
                  </span>
                  <span className="text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                    {p.start_year_a}
                  </span>
                  <span className="text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                    {p.start_year_b}
                    {yearGap > 0 && (
                      <span
                        className="ml-1 text-[9px]"
                        style={{ color: "var(--qgi-amber)" }}
                        title={`${yearGap}-year offset (early warning)`}
                      >
                        +{yearGap}
                      </span>
                    )}
                  </span>
                  <span className="text-right font-data" style={{ color: "var(--qgi-text-muted)" }}>
                    {p.pattern_length}
                  </span>
                  <span className="text-right font-data" style={{ color: "var(--qgi-text)" }}>
                    {p.num_indexes}
                  </span>
                  <span
                    className="text-right font-data"
                    style={{
                      color:
                        p.avg_correlation >= 0.85
                          ? "var(--qgi-success)"
                          : p.avg_correlation >= 0.65
                            ? "var(--qgi-amber)"
                            : "var(--qgi-text-muted)",
                    }}
                  >
                    {(p.avg_correlation * 100).toFixed(1)}%
                  </span>
                  <span
                    className="text-right font-data font-semibold"
                    style={{ color: "var(--qgi-amber)" }}
                  >
                    {p.pattern_power_score.toFixed(1)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          disabled={page <= 1}
          onClick={() => handlePageChange(page - 1)}
          className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors disabled:opacity-30"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-muted)",
          }}
        >
          &larr; Previous
        </button>
        <span
          className="text-[10px] tracking-wider font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {processed.length} total &middot; page {page}/{Math.max(1, totalPages)}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => handlePageChange(page + 1)}
          className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors disabled:opacity-30"
          style={{
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text-muted)",
          }}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  tooltip,
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tooltip?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[9px] tracking-[0.15em] uppercase flex items-center"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 px-2 py-1.5 rounded text-xs font-data border outline-none focus:border-[var(--qgi-accent)]"
        style={{
          backgroundColor: "var(--qgi-bg)",
          borderColor: "var(--qgi-border)",
          color: "var(--qgi-text)",
        }}
        {...inputProps}
      />
    </div>
  );
}
