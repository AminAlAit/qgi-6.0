"use client";

/**
 * Pattern Power Ranking — GH#255 enrichment: flags, (i) tooltips, year-gap filter.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import type { PatternRow } from "@/lib/types";
import countryRisksData from "@/data/country-risks.json";

const PAGE_SIZE = 50;

// Build a country-id -> alpha_2 lookup from the baked-in country-risks JSON
const ALPHA2_MAP: Record<string, string> = {};
const NAME_TO_ALPHA2: Record<string, string> = {};
for (const [id, country] of Object.entries(
  (countryRisksData as { countries: Record<string, { name: string; alpha_2: string }> }).countries
)) {
  ALPHA2_MAP[id] = country.alpha_2;
  NAME_TO_ALPHA2[country.name] = country.alpha_2;
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
  const [sortCol, setSortCol] = useState<keyof PatternRow>("pattern_power_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchPage = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(PAGE_SIZE),
        });
        if (minPps) params.set("min_pps", minPps);
        if (minCorr) params.set("min_corr", minCorr);

        const res = await fetch(`/api/patterns/ranking?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: RankingResponse = await res.json();
        setRows(data.results);
        setDeduped(Boolean(data.deduped));
        setTotalUniquePairs(data.total_unique_pairs ?? null);
        setHasMore(data.results.length === PAGE_SIZE);
      } catch (err) {
        console.error("Failed to fetch ranking:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [minPps, minCorr]
  );

  useEffect(() => {
    setPage(1);
    fetchPage(1);
  }, [fetchPage]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchPage(newPage);
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

  // Client-side year-gap filter + sort
  const filtered = useMemo(() => {
    let result = rows;
    if (minYearGap) {
      const gap = Number(minYearGap);
      if (gap > 0) {
        result = result.filter(
          (p) => Math.abs(p.start_year_a - p.start_year_b) >= gap
        );
      }
    }
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
  }, [rows, sortCol, sortDir, minYearGap]);

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
          {filtered.length} results
        </span>
        <button
          disabled={!hasMore}
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
