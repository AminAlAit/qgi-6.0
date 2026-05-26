"use client";

/**
 * Client-side filter + search shell around <RiskGrid />. Keeps interactivity
 * out of the server page per the Next.js 16 page convention (page.tsx stays
 * a Server Component).
 *
 * Filters:
 *   - L1 family chips (multi-select; empty = all).
 *   - Status filter (graduated / walked-failed / queued — but only the
 *     scored statuses produce visible scores; queued shows greyed rows).
 *   - Free-text country search (matches any cell.country in any visible row).
 *
 * Search behaviour: when a country query is entered, each row's cells are
 * filtered down to matching countries (and the rank position is preserved).
 * Rows with zero matches drop out.
 */

import { useMemo, useState } from "react";
import { Search, X, Filter, RotateCcw } from "lucide-react";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import type { TrackerRecipe } from "@/lib/te-mock/recipes";
import {
  getRecipeRow,
  type BoardCell,
  type RecipeRow,
} from "@/lib/te-mock/risk-board-data";
import { iconForRecipe } from "@/lib/te-mock/icons";
import Link from "next/link";
import type { Route } from "next";
import { STATUS_META } from "@/components/precedents-v2/StatusChip";

interface Props {
  recipes: TrackerRecipe[];
  /** L1 family meta to render filter chips. Derived once on the server. */
  l1Families: Array<{ id: string; label: string; color: string }>;
}

type StatusFilter = "all" | "scored" | "queued";

export function RiskBoardFilters({ recipes, l1Families }: Props) {
  const [selectedL1, setSelectedL1] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const toggleL1 = (id: string) => {
    setSelectedL1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setSelectedL1(new Set());
    setStatusFilter("all");
    setQuery("");
  };

  const q = query.trim().toLowerCase();

  // Apply filters → rows for RiskGrid.
  const visibleRows = useMemo(() => {
    const rows: Array<{ recipe: TrackerRecipe; row: RecipeRow }> = [];
    for (const recipe of recipes) {
      // L1 filter
      if (selectedL1.size > 0 && !selectedL1.has(recipe.l1_id)) continue;

      const row = getRecipeRow(recipe.recipe_id);
      if (!row) continue;

      // Status filter
      const isQueued = row.display_state === "queued";
      if (statusFilter === "scored" && isQueued) continue;
      if (statusFilter === "queued" && !isQueued) continue;

      // Country search: drop the row if a query is set and nothing matches.
      if (q && !isQueued) {
        const hit = row.cells.some((c) => c.country.toLowerCase().includes(q));
        if (!hit) continue;
      }
      // For queued rows, drop them entirely when there's an active country query
      // (they have no country signal to match on).
      if (q && isQueued) continue;

      rows.push({ recipe, row });
    }
    return rows;
  }, [recipes, selectedL1, statusFilter, q]);

  const activeFilterCount =
    selectedL1.size + (statusFilter !== "all" ? 1 : 0) + (q ? 1 : 0);

  return (
    <>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          padding: "14px 16px",
          marginBottom: "14px",
          border: "1px solid var(--qgi-border)",
          background: "var(--qgi-surface)",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--qgi-text-dim)",
          }}
        >
          <Filter size={14} strokeWidth={1.6} />
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Filter
          </span>
        </div>

        {/* L1 family chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {l1Families.map((fam) => {
            const active = selectedL1.has(fam.id);
            return (
              <button
                key={fam.id}
                type="button"
                onClick={() => toggleL1(fam.id)}
                style={{
                  fontSize: "10.5px",
                  padding: "4px 9px",
                  background: active ? fam.color : "transparent",
                  color: active ? "var(--qgi-bg)" : fam.color,
                  border: `1px solid ${fam.color}`,
                  borderRadius: "4px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.4px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
                title={`Toggle ${fam.label}`}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: active ? "var(--qgi-bg)" : fam.color,
                  }}
                />
                {fam.id} · {fam.label}
              </button>
            );
          })}
        </div>

        <span
          style={{
            width: "1px",
            height: "22px",
            background: "var(--qgi-border)",
            margin: "0 4px",
          }}
        />

        {/* Status filter */}
        <div style={{ display: "flex", gap: "4px" }}>
          {(
            [
              ["all", "All"],
              ["scored", "Scored"],
              ["queued", "No walk yet"],
            ] as Array<[StatusFilter, string]>
          ).map(([key, label]) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                style={{
                  fontSize: "10.5px",
                  padding: "4px 9px",
                  background: active ? "var(--qgi-accent)" : "transparent",
                  color: active ? "var(--qgi-bg)" : "var(--qgi-text-muted)",
                  border: `1px solid ${active ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
                  borderRadius: "4px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.4px",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <span style={{ flex: 1 }} />

        {/* Country search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 10px",
            background: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "4px",
            minWidth: "200px",
          }}
        >
          <Search size={13} strokeWidth={1.8} color="var(--qgi-text-dim)" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country (e.g. Iran)"
            aria-label="Search by country"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--qgi-text)",
              fontFamily: "ui-monospace, monospace",
              fontSize: "11.5px",
              minWidth: 0,
            }}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--qgi-text-dim)",
                cursor: "pointer",
                padding: 0,
                display: "flex",
              }}
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "10.5px",
              padding: "5px 10px",
              background: "transparent",
              color: "var(--qgi-text-dim)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
              fontFamily: "ui-monospace, monospace",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={11} strokeWidth={1.8} />
            Reset ({activeFilterCount})
          </button>
        )}
      </div>

      {/* The grid itself — inlined here so that cell filtering by `q` can
          modulate cells without re-passing many props through props-drilling
          to RiskGrid. RiskGrid (server) is exported for the unfiltered case;
          this client variant is the in-page interactive one. */}
      <FilteredGrid rows={visibleRows} query={q} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* In-place client grid — accepts already-filtered rows + a country query     */
/* to apply per-cell highlighting. Visual contract identical to RiskGrid.    */
/* ────────────────────────────────────────────────────────────────────────── */

function FilteredGrid({
  rows,
  query,
}: {
  rows: Array<{ recipe: TrackerRecipe; row: RecipeRow }>;
  query: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "32px",
          border: "1px dashed var(--qgi-border)",
          borderRadius: "6px",
          textAlign: "center",
          color: "var(--qgi-text-muted)",
          fontSize: "13px",
        }}
      >
        No recipes match the current filters. Try clearing one.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        background: "var(--qgi-surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px repeat(10, minmax(0, 1fr))",
          background: "var(--qgi-bg)",
          borderBottom: "1px solid var(--qgi-border)",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          letterSpacing: "1px",
          color: "var(--qgi-text-dim)",
        }}
      >
        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--qgi-border)" }}>
          Recipe ↓ · Country →
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              padding: "10px 6px",
              textAlign: "center",
              borderRight: i === 9 ? "none" : "1px solid var(--qgi-border)",
            }}
          >
            #{i + 1}
          </div>
        ))}
      </div>

      {rows.map(({ recipe, row }, idx) => (
        <RecipeGridRow
          key={recipe.recipe_id}
          recipe={recipe}
          row={row}
          query={query}
          isLast={idx === rows.length - 1}
        />
      ))}
    </div>
  );
}

function RecipeGridRow({
  recipe,
  row,
  query,
  isLast,
}: {
  recipe: TrackerRecipe;
  row: RecipeRow;
  query: string;
  isLast: boolean;
}) {
  const isQueued = row.display_state === "queued";
  const statusMeta = STATUS_META[recipe.status];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px repeat(10, minmax(0, 1fr))",
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        background: isQueued ? "rgba(0,0,0,0.18)" : "transparent",
      }}
    >
      <Link
        href={`/precedents-v2/${recipe.recipe_id}` as Route}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderRight: "1px solid var(--qgi-border)",
            borderLeft: `3px solid ${recipe.l1_color}`,
            height: "100%",
            opacity: isQueued ? 0.62 : 1,
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: recipe.l1_color,
              flexShrink: 0,
            }}
          >
            <RecipeIcon recipeId={recipe.recipe_id} size={18} strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--qgi-text)",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {recipe.label}
            </div>
            <div
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.3px",
                color: statusMeta.color,
                fontFamily: "ui-monospace, monospace",
                marginTop: "2px",
              }}
            >
              {statusMeta.label}
            </div>
          </div>
        </div>
      </Link>

      {row.cells.map((cell, i) => (
        <HeatCell
          key={`${recipe.recipe_id}-${i}`}
          cell={cell}
          recipeId={recipe.recipe_id}
          familyColor={recipe.l1_color}
          isLastCol={i === 9}
          isQueued={isQueued}
          query={query}
        />
      ))}
    </div>
  );
}

function HeatCell({
  cell,
  recipeId,
  familyColor,
  isLastCol,
  isQueued,
  query,
}: {
  cell: BoardCell;
  recipeId: string;
  familyColor: string;
  isLastCol: boolean;
  isQueued: boolean;
  query: string;
}) {
  const intensity =
    cell.score === null ? 0 : Math.max(0, Math.min(1, (cell.score - 40) / 60));
  const alpha = isQueued ? 0 : 0.1 + intensity * 0.55;
  const zone =
    cell.score === null
      ? "—"
      : cell.score >= 65
        ? "HIGH"
        : cell.score >= 40
          ? "MODERATE"
          : "LOW";
  const zoneColor =
    zone === "HIGH"
      ? "#E64545"
      : zone === "MODERATE"
        ? "#E68F29"
        : "var(--qgi-text-muted)";
  const isQueryMatch =
    query.length > 0 && !isQueued && cell.country.toLowerCase().includes(query);

  const cellInner = (
    <div
      style={{
        position: "relative",
        height: "62px",
        padding: "6px 8px",
        borderRight: isLastCol ? "none" : "1px solid var(--qgi-border)",
        background: isQueued
          ? "transparent"
          : `linear-gradient(90deg, ${hexToRgba(familyColor, alpha)} 0%, ${hexToRgba(familyColor, alpha * 0.4)} 100%)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: isQueued ? "default" : "pointer",
        outline: isQueryMatch ? `2px solid ${familyColor}` : "none",
        outlineOffset: isQueryMatch ? "-2px" : 0,
      }}
      title={
        cell.score === null
          ? "No walk yet — recipe queued for next vintage."
          : `${cell.country} · discrimination rank ${cell.score.toFixed(1)} (${zone})`
      }
    >
      <div
        style={{
          fontSize: "10.5px",
          color: isQueued ? "var(--qgi-text-dim)" : "var(--qgi-text)",
          fontWeight: isQueryMatch ? 700 : 500,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {isQueued ? "no walk yet" : cell.country}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "ui-monospace, monospace",
            color: isQueued ? "var(--qgi-text-dim)" : "var(--qgi-text)",
            lineHeight: 1,
          }}
        >
          {cell.score === null ? "—" : cell.score.toFixed(1)}
        </span>
        {!isQueued && cell.score !== null && (
          <span
            style={{
              fontSize: "8.5px",
              letterSpacing: "0.8px",
              color: zoneColor,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {zone}
          </span>
        )}
      </div>
    </div>
  );

  if (isQueued) return cellInner;
  return (
    <Link
      href={`/precedents-v2/${recipeId}` as Route}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      {cellInner}
    </Link>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
