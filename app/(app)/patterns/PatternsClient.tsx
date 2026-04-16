"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { CascadeFilter, type PatternSelection } from "@/components/patterns/CascadeFilter";
import { PatternSummaryCard } from "@/components/patterns/PatternSummaryCard";
import { ScdiTable } from "@/components/patterns/ScdiTable";
import {
  TRANSFORMATION_LABELS,
  type Transformation,
} from "@/lib/transforms";

const IndexChart = dynamic(
  () => import("@/components/patterns/IndexChart").then((m) => m.IndexChart),
  { ssr: false }
);

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

export default function PatternsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial: Partial<PatternSelection> = {
    country_a: searchParams.get("country_a") ?? undefined,
    country_b: searchParams.get("country_b") ?? undefined,
    length: searchParams.get("length") ? Number(searchParams.get("length")) : undefined,
    start_a: searchParams.get("start_a") ? Number(searchParams.get("start_a")) : undefined,
    start_b: searchParams.get("start_b") ? Number(searchParams.get("start_b")) : undefined,
  };

  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transformation, setTransformation] = useState<Transformation>("raw");
  // #250: align to "Year 1, Year 2, ..." when start years differ. Without
  // this, the chart's xAxis is country A's calendar years and country B's
  // points (at country B's calendar years) fall outside the category list
  // and never render — invisible line, but headline correlation still real
  // because the underlying values are paired by index position, not date.
  const [align, setAlign] = useState(false);
  // Auto-align flag we read from the metadata when the pattern loads.
  const startsDiffer =
    detail != null &&
    Number(detail.metadata.start_year_a) !== Number(detail.metadata.start_year_b);
  // The effective align value used by the chart: user-toggled OR forced when
  // the two windows are at different calendar years (early-warning patterns).
  const effectiveAlign = align || startsDiffer;
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(true);
  const [showTable, setShowTable] = useState(true);

  const onSelect = useCallback(
    async (sel: PatternSelection) => {
      // Update URL without navigation
      const qs = new URLSearchParams({
        country_a: sel.country_a,
        country_b: sel.country_b,
        length: String(sel.length),
        start_a: String(sel.start_a),
        start_b: String(sel.start_b),
      });
      router.replace(`/patterns?${qs.toString()}`, { scroll: false });

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/patterns/detail?country_a=${encodeURIComponent(sel.country_a)}&country_b=${encodeURIComponent(sel.country_b)}&start_a=${sel.start_a}&start_b=${sel.start_b}&length=${sel.length}`,
          { headers: { Authorization: "Bearer __client__" } }
        );
        if (!res.ok) {
          // Surface a friendlier message for the well-known 500 path:
          // /api/patterns/detail goes to live Athena and the deployed
          // environment doesn't always have those credentials wired
          // (see #247). The dashboard JSON cache covers Ranking, but
          // per-pattern detail is computed on demand. Until that's
          // pre-computed too, give users a helpful message instead of
          // the raw status code.
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pattern");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const isEarlyWarning =
    detail !== null &&
    Number(detail.metadata.start_year_b) < Number(detail.metadata.start_year_a) &&
    Number(detail.metadata.start_year_a) + Number(detail.metadata.pattern_length) >=
      new Date().getFullYear() - 2;

  const visibleScdis = selectedIndex
    ? detail?.scdis.filter((s) => s.index_name === selectedIndex) ?? []
    : detail?.scdis ?? [];

  // #9: collapse the cascade sidebar when a pattern is loaded to reclaim
  // ~256px for the data viz. User can re-expand with the "Change pattern" button.
  const [cascadeExpanded, setCascadeExpanded] = useState(true);
  const hasDetail = detail != null && !loading;

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel — cascade filter. Collapses when a pattern is loaded. */}
      {hasDetail && !cascadeExpanded ? (
        <div
          className="w-10 shrink-0 border-r flex flex-col items-center pt-3"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <button
            onClick={() => setCascadeExpanded(true)}
            className="text-[9px] tracking-wider writing-mode-vertical px-1 py-3 rounded transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              color: "var(--qgi-text-dim)",
              writingMode: "vertical-lr",
              transform: "rotate(180deg)",
            }}
            title="Expand filter panel"
          >
            Change pattern &rsaquo;
          </button>
        </div>
      ) : (
        <div
          className={`${hasDetail ? "w-52" : "w-64"} shrink-0 border-r flex flex-col overflow-y-auto transition-all`}
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <div
            className="text-[9px] tracking-[0.25em] uppercase px-4 py-2.5 border-b flex items-center justify-between"
            style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
          >
            <span>Discover Patterns</span>
            {hasDetail && (
              <button
                onClick={() => setCascadeExpanded(false)}
                className="text-[9px] hover:text-[var(--qgi-accent)]"
                title="Collapse filter panel"
              >
                &lsaquo;
              </button>
            )}
          </div>
          <CascadeFilter initial={initial} onSelect={onSelect} />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Empty state */}
        {!detail && !loading && !error && (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-3 p-12"
          >
            <span
              className="text-[10px] tracking-[0.25em] uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Patterns Portal
            </span>
            <p className="text-sm text-center max-w-sm" style={{ color: "var(--qgi-text-dim)" }}>
              Select a Predictor Country and follow the steps to discover a geopolitical
              pattern.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <span className="font-data text-xs animate-pulse" style={{ color: "var(--qgi-text-dim)" }}>
              Loading pattern…
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
              <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Pattern detail */}
        {detail && !loading && (
          <>
            <PatternSummaryCard
              meta={detail.metadata as unknown as Parameters<typeof PatternSummaryCard>[0]["meta"]}
              scdis={detail.scdis}
              isEarlyWarning={isEarlyWarning}
            />

            {/* Toolbar */}
            <div
              className="flex items-center gap-4 px-5 py-2 border-b shrink-0"
              style={{ borderColor: "var(--qgi-border)" }}
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

              {/* Align toggle (#250: forced ON when start years differ) */}
              <label
                className={`flex items-center gap-2 ${
                  startsDiffer ? "cursor-default opacity-60" : "cursor-pointer"
                }`}
                title={
                  startsDiffer
                    ? "Auto-aligned: this pattern's two windows are at different calendar years"
                    : "Align both series to Year 1, Year 2, ..."
                }
              >
                <input
                  type="checkbox"
                  checked={effectiveAlign}
                  disabled={startsDiffer}
                  onChange={(e) => setAlign(e.target.checked)}
                  className="accent-[var(--qgi-accent)]"
                />
                <span className="text-[10px] tracking-wider" style={{ color: "var(--qgi-text-muted)" }}>
                  Align to Year 1
                  {startsDiffer && (
                    <span style={{ color: "var(--qgi-amber)" }}> (auto)</span>
                  )}
                </span>
              </label>
              {startsDiffer && (
                <span
                  className="text-[10px] tracking-wider"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {detail!.metadata.country_a} {detail!.metadata.start_year_a}
                  &ndash;
                  {Number(detail!.metadata.start_year_a) +
                    Number(detail!.metadata.pattern_length) -
                    1}
                  {"  vs  "}
                  {detail!.metadata.country_b} {detail!.metadata.start_year_b}
                  &ndash;
                  {Number(detail!.metadata.start_year_b) +
                    Number(detail!.metadata.pattern_length) -
                    1}
                </span>
              )}

              {/* Section toggles */}
              <div className="ml-auto flex gap-3">
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

            {/* SCDIs Table */}
            {showTable && (
              <div className="border-b shrink-0" style={{ borderColor: "var(--qgi-border)" }}>
                <div
                  className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b"
                  style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
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

            {/* Index Charts */}
            {showCharts && (
              <div className="p-4">
                <div
                  className="text-[9px] tracking-[0.25em] uppercase mb-3"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Index Charts
                  {selectedIndex && (
                    <button
                      onClick={() => setSelectedIndex(null)}
                      className="ml-3"
                      style={{ color: "var(--qgi-accent)" }}
                    >
                      Show all ✕
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {visibleScdis.map((s) => (
                    <IndexChart
                      key={s.index_name}
                      indexName={s.index_name}
                      valuesA={s.values_a}
                      valuesB={s.values_b}
                      startYearA={Number(detail.metadata.start_year_a)}
                      startYearB={Number(detail.metadata.start_year_b)}
                      correlation={s.correlation}
                      predicted={s.predicted}
                      transformation={transformation}
                      align={effectiveAlign}
                      countryA={detail.metadata.country_a}
                      countryB={detail.metadata.country_b}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
