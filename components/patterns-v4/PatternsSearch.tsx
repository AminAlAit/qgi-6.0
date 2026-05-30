"use client";

/**
 * PatternsSearch — client-side search + filter shell for the /patterns
 * catalogue. Receives the full pre-filtered list from the Server Component;
 * all filtering happens in-browser so the page stays a Server Component.
 *
 * Filters:
 *   - Free-text search (country name, both sides of the pair)
 *   - Pattern tier (XL / L / M / S)
 *   - Min correlation (>0.85, >0.90, >0.95)
 *
 * Pagination: 50 results per page.
 *
 * V4.1 chrome: flag images, PPS number, tier badge, family-neutral slate
 * accent, no methodology jargon.
 *
 * 2026-05-30
 */

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, X } from "lucide-react";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { iso2For, flagFor } from "@/lib/te-mock/country-flags";
import { MUTED_GRAY, confidenceT, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";
import type { CatalogueEntry } from "@/lib/cascade-patterns/patterns-data";

const ACCENT = "#5B7E99"; // CALM_SLATE_BLUE
const PAGE_SIZE = 50;

const TIER_CHIPS = [
  { value: "", label: "All tiers" },
  { value: "XL", label: "XL" },
  { value: "L", label: "L" },
  { value: "M", label: "M" },
  { value: "S", label: "S" },
] as const;

const CORR_CHIPS = [
  { value: 0, label: "Any correlation" },
  { value: 0.85, label: "r > 0.85" },
  { value: 0.9, label: "r > 0.90" },
  { value: 0.95, label: "r > 0.95" },
] as const;

interface Props {
  entries: CatalogueEntry[];
}

export function PatternsSearch({ entries }: Props) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [corrFloor, setCorrFloor] = useState(0);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let out = entries;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (e) =>
          e.country_a.toLowerCase().includes(q) || e.country_b.toLowerCase().includes(q)
      );
    }

    if (tierFilter) {
      out = out.filter((e) => e.tier === tierFilter);
    }

    if (corrFloor > 0) {
      out = out.filter((e) => e.corr >= corrFloor);
    }

    return out;
  }, [entries, query, tierFilter, corrFloor]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleQuery = useCallback((val: string) => {
    setQuery(val);
    setPage(1);
  }, []);

  const handleTier = useCallback((val: string) => {
    setTierFilter(val);
    setPage(1);
  }, []);

  const handleCorr = useCallback((val: number) => {
    setCorrFloor(val);
    setPage(1);
  }, []);

  const hasFilters = !!query || !!tierFilter || corrFloor > 0;

  return (
    <div>
      {/* Search + filter row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        {/* Text search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "5px",
            padding: "6px 10px",
            flex: "1 1 220px",
            minWidth: "180px",
            maxWidth: "340px",
          }}
        >
          <Search size={13} color="var(--qgi-text-dim)" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search countries..."
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "12px",
              color: "var(--qgi-text)",
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button
              onClick={() => handleQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                color: "var(--qgi-text-dim)",
                display: "flex",
              }}
              aria-label="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Tier chips */}
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {TIER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => handleTier(chip.value)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                borderRadius: "4px",
                border: "1px solid",
                cursor: "pointer",
                transition: "all 100ms",
                borderColor: tierFilter === chip.value ? ACCENT : "var(--qgi-border)",
                background:
                  tierFilter === chip.value ? `${ACCENT}18` : "var(--qgi-surface)",
                color: tierFilter === chip.value ? ACCENT : "var(--qgi-text-muted)",
                fontWeight: tierFilter === chip.value ? 600 : 400,
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Correlation floor chips */}
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {CORR_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => handleCorr(chip.value)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                borderRadius: "4px",
                border: "1px solid",
                cursor: "pointer",
                transition: "all 100ms",
                borderColor: corrFloor === chip.value ? ACCENT : "var(--qgi-border)",
                background:
                  corrFloor === chip.value ? `${ACCENT}18` : "var(--qgi-surface)",
                color: corrFloor === chip.value ? ACCENT : "var(--qgi-text-muted)",
                fontWeight: corrFloor === chip.value ? 600 : 400,
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              handleQuery("");
              handleTier("");
              handleCorr(0);
            }}
            style={{
              fontSize: "11px",
              color: "var(--qgi-text-dim)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Results count */}
      <p
        style={{
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "10px",
        }}
      >
        {filtered.length} pair{filtered.length !== 1 ? "s" : ""}
        {hasFilters ? " matching" : " in catalogue"}
        {pageCount > 1 && ` — page ${page} of ${pageCount}`}
      </p>

      {/* Results list */}
      {pageEntries.length === 0 ? (
        <div
          style={{
            padding: "32px 24px",
            textAlign: "center",
            border: "1px dashed var(--qgi-border)",
            borderRadius: "6px",
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
          }}
        >
          No pairs match the current filters.
        </div>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {pageEntries.map((entry, i) => (
            <li key={entry.slug}>
              <PairRow entry={entry} rank={(page - 1) * PAGE_SIZE + i + 1} />
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
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: "5px 12px",
              fontSize: "11px",
              fontFamily: "ui-monospace, monospace",
              borderRadius: "4px",
              border: "1px solid var(--qgi-border)",
              background: "var(--qgi-surface)",
              color: page === 1 ? "var(--qgi-text-dim)" : "var(--qgi-text-muted)",
              cursor: page === 1 ? "default" : "pointer",
            }}
          >
            Previous
          </button>
          <span
            style={{
              fontSize: "11px",
              color: "var(--qgi-text-muted)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {page} / {pageCount}
          </span>
          <button
            disabled={page === pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            style={{
              padding: "5px 12px",
              fontSize: "11px",
              fontFamily: "ui-monospace, monospace",
              borderRadius: "4px",
              border: "1px solid var(--qgi-border)",
              background: "var(--qgi-surface)",
              color: page === pageCount ? "var(--qgi-text-dim)" : "var(--qgi-text-muted)",
              cursor: page === pageCount ? "default" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PairRow — single entry in the search results list
// ---------------------------------------------------------------------------

function PairRow({ entry, rank }: { entry: CatalogueEntry; rank: number }) {
  const ppsDisplay = Math.round(entry.pps);
  // Normalise PPS to a 0-100 confidence-like t value for color.
  // Catalogue range is roughly 0-3000; we map 0-2000 to 0-100 loosely.
  const ppsT = Math.min(1, entry.pps / 2000);
  const corrT = confidenceT(entry.corr * 100);
  const ppsColor = lerpHexToRgb(MUTED_GRAY, ACCENT, ppsT);
  const ppsGlow = confidenceGlow(ACCENT, ppsT);

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
          transition: "border-color 120ms",
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

        {/* Country pair */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
          }}
        >
          {/* Country A */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--qgi-text)",
              whiteSpace: "nowrap",
            }}
          >
            <FlagImg
              emoji={flagFor(entry.country_a)}
              name={entry.country_a}
              width={14}
              radius={2}
              style={{ flexShrink: 0 }}
            />
            {entry.country_a}
          </span>

          <span
            style={{
              fontSize: "11px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            +
          </span>

          {/* Country B */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--qgi-text)",
              whiteSpace: "nowrap",
            }}
          >
            <FlagImg
              emoji={flagFor(entry.country_b)}
              name={entry.country_b}
              width={14}
              radius={2}
              style={{ flexShrink: 0 }}
            />
            {entry.country_b}
          </span>

          {/* Metadata row */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              alignItems: "center",
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: "10.5px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {entry.window_length}y window
            </span>
            <span
              style={{
                fontSize: "10.5px",
                color: lerpHexToRgb(MUTED_GRAY, "#b0cfb8", corrT),
                fontFamily: "ui-monospace, monospace",
              }}
            >
              r = {entry.corr.toFixed(3)}
            </span>
            <TierBadge tier={entry.tier} />
          </div>
        </div>

        {/* PPS score */}
        <div
          style={{
            textAlign: "right",
            flexShrink: 0,
          }}
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
            title={`Pattern Power Score: ${ppsDisplay}`}
          >
            {ppsDisplay}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// TierBadge
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, string> = {
  XL: "#6C77E8",
  L: "#3FA9F5",
  M: "#3FBF8F",
  S: "#8A7A6E",
};

export function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? "#9ab0c4";
  return (
    <span
      style={{
        fontSize: "9px",
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.8px",
        fontWeight: 600,
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: "3px",
        padding: "1px 5px",
        lineHeight: 1.5,
      }}
    >
      {tier}
    </span>
  );
}
