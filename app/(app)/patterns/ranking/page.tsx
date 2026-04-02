"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PatternRow } from "@/lib/types";

const PAGE_SIZE = 50;

const SECTORS = [
  "Economy",
  "Military",
  "Trade",
  "Social",
  "Investments",
  "Education",
  "Health",
  "State Integrity",
  "Resources",
  "Energy",
  "Public Services",
  "Political State",
  "Human Rights & Development",
];

interface RankingResponse {
  page: number;
  limit: number;
  results: PatternRow[];
}

export default function RankingPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [minPps, setMinPps] = useState("");
  const [minCorr, setMinCorr] = useState("");
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
      country_a: p.country_a,
      country_b: p.country_b,
      length: String(p.pattern_length),
      start_a: String(p.start_year_a),
      start_b: String(p.start_year_b),
    });
    router.push(`/patterns?${qs}`);
  }

  // Client-side sort (within the current page)
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const sortIndicator = (col: keyof PatternRow) =>
    sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-xs tracking-[0.2em] uppercase font-semibold"
          style={{ color: "var(--qgi-accent)" }}
        >
          Pattern Power Ranking
        </h1>
        <span
          className="text-[10px] tracking-wider font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          PAGE {page}
        </span>
      </div>

      {/* Filters */}
      <div
        className="flex gap-4 items-end p-3 rounded border"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <div className="flex flex-col gap-1">
          <label
            className="text-[9px] tracking-[0.15em] uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Min PPS
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="0"
            value={minPps}
            onChange={(e) => setMinPps(e.target.value)}
            className="w-24 px-2 py-1.5 rounded text-xs font-data border outline-none focus:border-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-bg)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-[9px] tracking-[0.15em] uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Min Correlation
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            placeholder="0"
            value={minCorr}
            onChange={(e) => setMinCorr(e.target.value)}
            className="w-24 px-2 py-1.5 rounded text-xs font-data border outline-none focus:border-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-bg)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="flex-1 rounded border overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* Header row */}
        <div
          className="grid text-[9px] tracking-[0.15em] uppercase px-4 py-2.5 border-b select-none"
          style={{
            gridTemplateColumns: "1fr 1fr 80px 80px 60px 60px 90px 50px",
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
          <button className="text-right hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("avg_correlation")}>
            Corr{sortIndicator("avg_correlation")}
          </button>
          <button className="text-right hover:text-[var(--qgi-text-muted)]" onClick={() => handleSort("pattern_power_score")}>
            PPS{sortIndicator("pattern_power_score")}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex items-center justify-center py-16 text-xs tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              LOADING…
            </div>
          ) : sorted.length === 0 ? (
            <div
              className="flex items-center justify-center py-16 text-xs tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              NO PATTERNS FOUND
            </div>
          ) : (
            sorted.map((p, i) => (
              <button
                key={`${p.country_a}-${p.country_b}-${p.start_year_a}-${p.start_year_b}-${i}`}
                onClick={() => navigateToPattern(p)}
                className="w-full grid items-center px-4 py-2 border-b text-xs transition-colors hover:bg-[var(--qgi-surface-2)]"
                style={{
                  gridTemplateColumns: "1fr 1fr 80px 80px 60px 60px 90px 50px",
                  borderColor: "var(--qgi-border)",
                }}
              >
                <span
                  className="text-left font-data truncate"
                  style={{ color: "var(--qgi-country-a)" }}
                >
                  {p.country_a}
                </span>
                <span
                  className="text-left font-data truncate"
                  style={{ color: "var(--qgi-country-b)" }}
                >
                  {p.country_b}
                </span>
                <span
                  className="text-right font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {p.start_year_a}
                </span>
                <span
                  className="text-right font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {p.start_year_b}
                </span>
                <span
                  className="text-right font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {p.pattern_length}
                </span>
                <span
                  className="text-right font-data"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {p.num_indexes}
                </span>
                <span
                  className="text-right font-data"
                  style={{
                    color:
                      p.avg_correlation >= 0.8
                        ? "var(--qgi-success)"
                        : p.avg_correlation >= 0.6
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
            ))
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
          ← Previous
        </button>
        <span
          className="text-[10px] tracking-wider font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {sorted.length} results
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
          Next →
        </button>
      </div>
    </div>
  );
}
