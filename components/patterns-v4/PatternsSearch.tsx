"use client";

/**
 * PatternsSearch — client-side search engine for the /patterns catalogue.
 *
 * Layout (Sara Ahmed / Sard majles 2026-05-30):
 *   Two-column at desktop: slim left filter panel (240px fixed) + results.
 *   Mobile: filters collapse above results table.
 *
 * Filter dimensions:
 *   - Country A (typeahead over 215 countries)
 *   - Country B (typeahead over 215 countries)
 *   - Pattern length range slider (corpusMin–corpusMax years; bounds derived dynamically)
 *   - Start year for A (range; only available for entries with real start_year_a)
 *   - Start year for B (range; aligned patterns have sa = sb)
 *
 * Tier chips removed (2026-05-31): the range slider IS the only term-based filter.
 * Tier badges remain on result rows as labels; no tier filter in the filter panel.
 *
 * Default corpus: all ~23,179 pairs from fullCorpus (partners index).
 * When start-year filters are active: restricted to entries where
 * start_year_a > 0 (i.e. the ranking.json top-1000 corpus only).
 *
 * PPS column: visible in result rows with a tooltip explaining the score.
 * Tier labels: "short pattern" / "medium term" / "long term".
 *
 * Pagination: 50/page.
 *
 * 2026-05-30 / 2026-05-31
 */

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, X, SlidersHorizontal, Info } from "lucide-react";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import { MUTED_GRAY, confidenceT, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";
import type { CatalogueEntry, TierCounts } from "@/lib/cascade-patterns/patterns-data";

const ACCENT = "#5B7E99";
const PAGE_SIZE = 50;

// Tier display config
const TIER_LABEL: Record<string, string> = {
  XL: "long term",
  L: "long term",
  M: "medium term",
  S: "short pattern",
};

const TIER_COLORS: Record<string, string> = {
  XL: "#6C77E8",
  L: "#3FA9F5",
  M: "#3FBF8F",
  S: "#8A7A6E",
};

interface Props {
  entries: CatalogueEntry[];
  fullCorpus: CatalogueEntry[];
  tierCounts: TierCounts;
  countryNames: string[];
  /** Shortest window_length in the corpus — derived dynamically server-side. */
  minPatternLength: number;
  maxPatternLength: number;
}

export function PatternsSearch({
  entries,
  fullCorpus,
  // tierCounts kept in props API for forward-compat; not rendered in filter panel (2026-05-31).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tierCounts: _tierCounts,
  countryNames,
  minPatternLength,
  maxPatternLength,
}: Props) {
  // Filter state
  const [countryA, setCountryA] = useState("");
  const [countryB, setCountryB] = useState("");
  const [lengthMin, setLengthMin] = useState(minPatternLength);
  const [lengthMax, setLengthMax] = useState(maxPatternLength);
  const [startYearAMin, setStartYearAMin] = useState(1960);
  const [startYearAMax, setStartYearAMax] = useState(2024);
  const [startYearBMin, setStartYearBMin] = useState(1960);
  const [startYearBMax, setStartYearBMax] = useState(2024);
  // Start-year filter is always visible; active when user changes from defaults.
  const [useYearFilter, setUseYearFilter] = useState(false);
  const [page, setPage] = useState(1);

  const resetFilters = useCallback(() => {
    setCountryA("");
    setCountryB("");
    setLengthMin(minPatternLength);
    setLengthMax(maxPatternLength);
    setStartYearAMin(1960);
    setStartYearAMax(2024);
    setStartYearBMin(1960);
    setStartYearBMax(2024);
    setUseYearFilter(false);
    setPage(1);
  }, [minPatternLength, maxPatternLength]);

  const resetAndPage = useCallback((fn: () => void) => {
    fn();
    setPage(1);
  }, []);

  // Determine active corpus:
  // When year filters are active, restrict to entries that have real start_year_a
  // (i.e. from ranking.json). Otherwise use full corpus.
  const activeCorpus = useMemo(() => {
    if (useYearFilter) {
      return entries.filter((e) => e.start_year_a > 0);
    }
    return fullCorpus;
  }, [entries, fullCorpus, useYearFilter]);

  const filtered = useMemo(() => {
    let out = activeCorpus;

    if (countryA.trim()) {
      const q = countryA.trim().toLowerCase();
      out = out.filter(
        (e) =>
          e.country_a.toLowerCase().includes(q) || e.country_b.toLowerCase().includes(q)
      );
    }

    if (countryB.trim()) {
      const q = countryB.trim().toLowerCase();
      // Country B: must match in the slot NOT already matched by A
      // (simpler approach: both must match somewhere in the pair)
      out = out.filter((e) => {
        const qa = countryA.trim().toLowerCase();
        // If A matched country_a, B should match country_b, and vice versa
        if (qa) {
          const aMatchesA = e.country_a.toLowerCase().includes(qa);
          const bMatchesA = e.country_b.toLowerCase().includes(qa);
          if (aMatchesA) return e.country_b.toLowerCase().includes(q);
          if (bMatchesA) return e.country_a.toLowerCase().includes(q);
        }
        return (
          e.country_a.toLowerCase().includes(q) || e.country_b.toLowerCase().includes(q)
        );
      });
    }

    // Length filter
    out = out.filter((e) => e.window_length >= lengthMin && e.window_length <= lengthMax);

    // Start year filters (only when year mode active)
    if (useYearFilter) {
      out = out.filter(
        (e) =>
          e.start_year_a >= startYearAMin &&
          e.start_year_a <= startYearAMax &&
          e.start_year_b >= startYearBMin &&
          e.start_year_b <= startYearBMax
      );
    }

    return out;
  }, [
    activeCorpus,
    countryA,
    countryB,
    lengthMin,
    lengthMax,
    useYearFilter,
    startYearAMin,
    startYearAMax,
    startYearBMin,
    startYearBMax,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters =
    !!countryA ||
    !!countryB ||
    lengthMin !== minPatternLength ||
    lengthMax !== maxPatternLength ||
    useYearFilter;

  return (
    <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
      {/* ── Left filter panel ─────────────────────────────────────────────── */}
      <aside
        style={{
          width: "232px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0",
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "7px",
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "11px 14px 10px",
            borderBottom: "1px solid var(--qgi-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              fontWeight: 600,
            }}
          >
            <SlidersHorizontal size={12} strokeWidth={2} />
            Filters
          </div>
          {hasFilters && (
            <button
              onClick={resetFilters}
              style={{
                fontSize: "10px",
                color: ACCENT,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                padding: 0,
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Country A */}
        <FilterSection label="Country A">
          <CountryInput
            value={countryA}
            onChange={(v) => resetAndPage(() => setCountryA(v))}
            placeholder="Any country"
            countryNames={countryNames}
          />
        </FilterSection>

        {/* Country B */}
        <FilterSection label="Country B">
          <CountryInput
            value={countryB}
            onChange={(v) => resetAndPage(() => setCountryB(v))}
            placeholder="Any country"
            countryNames={countryNames}
          />
        </FilterSection>

        {/* Pattern length — single range slider; no tier chips */}
        <FilterSection label="Pattern length">
          <LengthRangeSlider
            min={lengthMin}
            max={lengthMax}
            corpusMin={minPatternLength}
            corpusMax={maxPatternLength}
            onMinChange={(v) => resetAndPage(() => setLengthMin(v))}
            onMaxChange={(v) => resetAndPage(() => setLengthMax(v))}
          />
        </FilterSection>

        {/* Start year — always visible; note that it narrows corpus to top-ranked entries */}
        <FilterSection label="Start year" last>
          <p
            style={{
              fontSize: "9.5px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              margin: "0 0 8px",
              lineHeight: 1.5,
            }}
          >
            Searches top-ranked entries with recorded start years.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <YearRangeInput
              label="Country A"
              min={startYearAMin}
              max={startYearAMax}
              onMinChange={(v) =>
                resetAndPage(() => {
                  setStartYearAMin(v);
                  setUseYearFilter(true);
                })
              }
              onMaxChange={(v) =>
                resetAndPage(() => {
                  setStartYearAMax(v);
                  setUseYearFilter(true);
                })
              }
              floor={1960}
              ceil={2024}
            />
            <YearRangeInput
              label="Country B"
              min={startYearBMin}
              max={startYearBMax}
              onMinChange={(v) =>
                resetAndPage(() => {
                  setStartYearBMin(v);
                  setUseYearFilter(true);
                })
              }
              onMaxChange={(v) =>
                resetAndPage(() => {
                  setStartYearBMax(v);
                  setUseYearFilter(true);
                })
              }
              floor={1960}
              ceil={2024}
            />
          </div>
        </FilterSection>
      </aside>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Results count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              margin: 0,
            }}
          >
            {filtered.length.toLocaleString()} pattern
            {filtered.length !== 1 ? "s" : ""}
            {hasFilters ? " matching" : ""}
            {pageCount > 1 && ` — page ${page} of ${pageCount}`}
            {useYearFilter && (
              <span
                style={{
                  color: "var(--qgi-text-dim)",
                  fontSize: "9.5px",
                  marginLeft: "8px",
                }}
              >
                (start-year search across top-ranked entries)
              </span>
            )}
          </p>

          {/* Column headers */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              alignItems: "center",
              fontSize: "9.5px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.5px",
            }}
          >
            <span>sorted by</span>
            <PPSColumnHeader />
          </div>
        </div>

        {/* Results list */}
        {pageEntries.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              border: "1px dashed var(--qgi-border)",
              borderRadius: "6px",
              color: "var(--qgi-text-muted)",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            No patterns match the current filters.
            <br />
            <button
              onClick={resetFilters}
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: ACCENT,
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "5px",
            }}
          >
            {pageEntries.map((entry, i) => (
              <li key={entry.slug}>
                <PatternRow entry={entry} rank={(page - 1) * PAGE_SIZE + i + 1} />
              </li>
            ))}
          </ol>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "20px",
              flexWrap: "wrap",
            }}
          >
            <PagBtn disabled={page === 1} onClick={() => setPage(1)}>
              First
            </PagBtn>
            <PagBtn
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </PagBtn>
            <span
              style={{
                fontSize: "11px",
                color: "var(--qgi-text-muted)",
                fontFamily: "ui-monospace, monospace",
                minWidth: "60px",
                textAlign: "center",
              }}
            >
              {page} / {pageCount}
            </span>
            <PagBtn
              disabled={page === pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </PagBtn>
            <PagBtn disabled={page === pageCount} onClick={() => setPage(pageCount)}>
              Last
            </PagBtn>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PatternRow
// ---------------------------------------------------------------------------

function PatternRow({ entry, rank }: { entry: CatalogueEntry; rank: number }) {
  const ppsDisplay = Math.round(entry.pps);
  const ppsT = Math.min(1, entry.pps / 2000);
  const corrT = confidenceT(entry.corr * 100);
  const ppsColor = lerpHexToRgb(MUTED_GRAY, ACCENT, ppsT);
  const ppsGlow = confidenceGlow(ACCENT, ppsT);

  const tierLabel = TIER_LABEL[entry.tier] ?? entry.tier.toLowerCase();
  const tierColor = TIER_COLORS[entry.tier] ?? "#9ab0c4";

  return (
    <Link
      href={`/patterns/${entry.slug}` as Route}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr auto",
          alignItems: "center",
          gap: "10px",
          padding: "9px 12px",
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderLeft: `2px solid ${ACCENT}`,
          borderRadius: "5px",
          transition: "background 120ms, border-color 120ms",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            "var(--qgi-surface-2, var(--qgi-bg))";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--qgi-surface)";
        }}
      >
        {/* Rank */}
        <span
          style={{
            fontSize: "10px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            textAlign: "right",
          }}
        >
          {rank}
        </span>

        {/* Country pair + metadata */}
        <div style={{ minWidth: 0 }}>
          {/* Country chips row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px",
              marginBottom: "5px",
            }}
          >
            <CountryChip name={entry.country_a} />
            <span
              style={{
                fontSize: "10px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              +
            </span>
            <CountryChip name={entry.country_b} />
          </div>

          {/* Metadata row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "center",
            }}
          >
            {/* Tier badge */}
            <span
              title={`Tier: ${tierLabel}`}
              style={{
                fontSize: "9px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.5px",
                fontWeight: 600,
                color: tierColor,
                background: `${tierColor}18`,
                border: `1px solid ${tierColor}40`,
                borderRadius: "3px",
                padding: "1px 5px",
                lineHeight: 1.5,
                whiteSpace: "nowrap",
              }}
            >
              {tierLabel}
            </span>

            {/* Length */}
            <span
              style={{
                fontSize: "10.5px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {entry.window_length}y
            </span>

            {/* Correlation */}
            <span
              style={{
                fontSize: "10.5px",
                color: lerpHexToRgb(MUTED_GRAY, "#b0cfb8", corrT),
                fontFamily: "ui-monospace, monospace",
              }}
            >
              correlation = {entry.corr.toFixed(3)}
            </span>

            {/* Start years (only when available) */}
            {entry.start_year_a > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {entry.start_year_a === entry.start_year_b
                  ? `from ${entry.start_year_a}`
                  : `A ${entry.start_year_a} · B ${entry.start_year_b}`}
              </span>
            )}
          </div>
        </div>

        {/* PPS score */}
        <div
          style={{ textAlign: "right", flexShrink: 0 }}
          title="Pattern Power Score: structural correlation strength used to rank results"
        >
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "-0.5px",
              color: ppsColor,
              textShadow: ppsGlow || undefined,
            }}
          >
            {ppsDisplay}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Filter sub-components
// ---------------------------------------------------------------------------

function FilterSection({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderBottom: last ? "none" : "1px solid var(--qgi-border)",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "1.4px",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text-dim)",
          fontWeight: 600,
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function CountryInput({
  value,
  onChange,
  placeholder,
  countryNames,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  countryNames: string[];
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!q) return [];
    const out: string[] = [];
    for (const name of countryNames) {
      if (name.toLowerCase().includes(q)) {
        out.push(name);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [q, countryNames]);

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--qgi-bg)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "4px",
          padding: "5px 8px",
        }}
      >
        <Search size={11} color="var(--qgi-text-dim)" strokeWidth={2} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "11.5px",
            color: "var(--qgi-text)",
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
        {value && (
          <button
            onClick={() => onChange("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              color: "var(--qgi-text-dim)",
              display: "flex",
            }}
            aria-label="Clear"
          >
            <X size={10} />
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 3px)",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "4px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            zIndex: 50,
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(name);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "6px 10px",
                background: "transparent",
                border: "none",
                color: "var(--qgi-text)",
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--qgi-bg)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <FlagImg emoji={flagFor(name)} name={name} width={13} radius={2} />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LengthRangeSlider({
  min,
  max,
  corpusMin,
  corpusMax,
  onMinChange,
  onMaxChange,
}: {
  min: number;
  max: number;
  corpusMin: number;
  corpusMax: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-muted)",
          }}
        >
          {min}y
        </span>
        <span
          style={{
            fontSize: "10px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-dim)",
          }}
        >
          to {max}y
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <input
          type="range"
          min={corpusMin}
          max={corpusMax}
          value={min}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (v <= max) onMinChange(v);
          }}
          style={{ width: "100%", accentColor: ACCENT }}
          aria-label="Minimum length"
        />
        <input
          type="range"
          min={corpusMin}
          max={corpusMax}
          value={max}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (v >= min) onMaxChange(v);
          }}
          style={{ width: "100%", accentColor: ACCENT }}
          aria-label="Maximum length"
        />
      </div>
    </div>
  );
}

function YearRangeInput({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
  floor,
  ceil,
}: {
  label: string;
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  floor: number;
  ceil: number;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "9px",
          fontFamily: "ui-monospace, monospace",
          color: "var(--qgi-text-dim)",
          marginBottom: "4px",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          type="number"
          min={floor}
          max={max}
          value={min}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v >= floor && v <= max) onMinChange(v);
          }}
          style={{
            width: "54px",
            background: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "3px",
            padding: "3px 5px",
            fontSize: "11px",
            color: "var(--qgi-text)",
            fontFamily: "ui-monospace, monospace",
            outline: "none",
          }}
        />
        <span
          style={{
            fontSize: "9px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          to
        </span>
        <input
          type="number"
          min={min}
          max={ceil}
          value={max}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v <= ceil && v >= min) onMaxChange(v);
          }}
          style={{
            width: "54px",
            background: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "3px",
            padding: "3px 5px",
            fontSize: "11px",
            color: "var(--qgi-text)",
            fontFamily: "ui-monospace, monospace",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PPS column header with tooltip
// ---------------------------------------------------------------------------

function PPSColumnHeader() {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
      }}
    >
      <span
        style={{
          fontSize: "9.5px",
          fontFamily: "ui-monospace, monospace",
          color: ACCENT,
          fontWeight: 600,
          letterSpacing: "0.3px",
          cursor: "default",
        }}
      >
        PPS
      </span>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "help",
          color: "var(--qgi-text-dim)",
          display: "flex",
          alignItems: "center",
        }}
        aria-label="What is PPS?"
      >
        <Info size={10} strokeWidth={2} />
      </button>
      {show && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: "220px",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "5px",
            padding: "9px 11px",
            fontSize: "10.5px",
            lineHeight: 1.55,
            color: "var(--qgi-text-muted)",
            fontFamily: "inherit",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 100,
          }}
        >
          <strong
            style={{ color: "var(--qgi-text)", display: "block", marginBottom: "4px" }}
          >
            Pattern Power Score
          </strong>
          A structural correlation score combining window length, Pearson r, and indicator
          count. Used here only to rank results from highest to lowest strength.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CountryChip({ name }: { name: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "12.5px",
        fontWeight: 600,
        color: "var(--qgi-text)",
        whiteSpace: "nowrap",
      }}
    >
      <FlagImg
        emoji={flagFor(name)}
        name={name}
        width={13}
        radius={2}
        style={{ flexShrink: 0 }}
      />
      {name}
    </span>
  );
}

function PagBtn({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: "11px",
        fontFamily: "ui-monospace, monospace",
        borderRadius: "4px",
        border: "1px solid var(--qgi-border)",
        background: "var(--qgi-surface)",
        color: disabled ? "var(--qgi-text-dim)" : "var(--qgi-text-muted)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Re-export TierBadge so FeaturedPairsStrip can still import it
export function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? "#9ab0c4";
  const label = TIER_LABEL[tier] ?? tier.toLowerCase();
  return (
    <span
      style={{
        fontSize: "9px",
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.5px",
        fontWeight: 600,
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: "3px",
        padding: "1px 5px",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
