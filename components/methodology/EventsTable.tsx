"use client";

/**
 * All-verified-events table (#523).
 *
 * Single 2.4 MB JSON loaded once at page mount, paged + filtered client-
 * side. Cost-saving choice — no Athena per page-flip, no API roundtrips.
 *
 * Filters: country dropdown, category dropdown, year-range inputs,
 * fulltext search on title. Source URL shown as domain inline; row click
 * opens source in a new tab.
 */
import { useMemo, useState } from "react";
import events from "@/data/verified-events.json";

type Event = {
  country: string;
  year: number;
  title: string;
  category: string;
  source: string | null;
  sourceDomain: string | null;
};

const PAGE_SIZE = 50;

function prettyCategory(s: string): string {
  if (!s) return "—";
  return s
    .split("_")
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export default function EventsTable() {
  const all = events as Event[];

  // Distinct values for filters
  const countries = useMemo(
    () => Array.from(new Set(all.map((e) => e.country))).sort(),
    [all]
  );
  const categories = useMemo(
    () => Array.from(new Set(all.map((e) => e.category).filter(Boolean))).sort(),
    [all]
  );

  const [country, setCountry] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [yearMin, setYearMin] = useState<string>("");
  const [yearMax, setYearMax] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const yMin = yearMin ? parseInt(yearMin, 10) : null;
    const yMax = yearMax ? parseInt(yearMax, 10) : null;
    return all.filter((e) => {
      if (country && e.country !== country) return false;
      if (category && e.category !== category) return false;
      if (yMin != null && !isNaN(yMin) && e.year < yMin) return false;
      if (yMax != null && !isNaN(yMax) && e.year > yMax) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, country, category, yearMin, yearMax, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function resetFilters() {
    setCountry("");
    setCategory("");
    setYearMin("");
    setYearMax("");
    setSearch("");
    setPage(0);
  }

  return (
    <div>
      {/* Header counts */}
      <div className="mb-4 flex items-baseline justify-between flex-wrap gap-2">
        <div
          className="text-[11px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {filtered.length.toLocaleString()} of {all.length.toLocaleString()} events
        </div>
        <div className="text-[11px]" style={{ color: "var(--qgi-text-muted)" }}>
          Page {safePage + 1} / {totalPages}
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-lg border p-3 mb-4 flex flex-wrap gap-2 items-center"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
        }}
      >
        <input
          type="text"
          placeholder="Search title…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="flex-1 min-w-[160px] text-xs px-3 py-2 rounded outline-none"
          style={{
            backgroundColor: "var(--qgi-bg)",
            color: "var(--qgi-text)",
            border: "1px solid var(--qgi-border)",
          }}
        />
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setPage(0);
          }}
          className="text-xs px-3 py-2 rounded outline-none"
          style={{
            backgroundColor: "var(--qgi-bg)",
            color: "var(--qgi-text)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
          className="text-xs px-3 py-2 rounded outline-none"
          style={{
            backgroundColor: "var(--qgi-bg)",
            color: "var(--qgi-text)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {prettyCategory(c)}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Year ≥"
          value={yearMin}
          onChange={(e) => {
            setYearMin(e.target.value);
            setPage(0);
          }}
          className="text-xs px-3 py-2 rounded outline-none w-24"
          style={{
            backgroundColor: "var(--qgi-bg)",
            color: "var(--qgi-text)",
            border: "1px solid var(--qgi-border)",
          }}
        />
        <input
          type="number"
          placeholder="Year ≤"
          value={yearMax}
          onChange={(e) => {
            setYearMax(e.target.value);
            setPage(0);
          }}
          className="text-xs px-3 py-2 rounded outline-none w-24"
          style={{
            backgroundColor: "var(--qgi-bg)",
            color: "var(--qgi-text)",
            border: "1px solid var(--qgi-border)",
          }}
        />
        <button
          onClick={resetFilters}
          className="text-[11px] tracking-wider uppercase px-3 py-2 rounded transition-colors"
          style={{
            color: "var(--qgi-text-muted)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr
              className="text-[10px] tracking-widest uppercase"
              style={{
                backgroundColor: "var(--qgi-surface)",
                color: "var(--qgi-text-muted)",
              }}
            >
              <th className="text-left px-4 py-3 font-normal">Year</th>
              <th className="text-left px-4 py-3 font-normal">Country</th>
              <th className="text-left px-4 py-3 font-normal">Title</th>
              <th className="text-left px-4 py-3 font-normal hidden md:table-cell">
                Category
              </th>
              <th className="text-left px-4 py-3 font-normal hidden md:table-cell">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-xs"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  No events match these filters.
                </td>
              </tr>
            )}
            {slice.map((e, i) => (
              <tr
                key={i}
                className="hover:bg-white/5 transition-colors border-t"
                style={{ borderColor: "var(--qgi-border)" }}
              >
                <td
                  className="px-4 py-3 font-data tabular-nums"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {e.year}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--qgi-text)" }}>
                  {e.country}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--qgi-text)" }}>
                  {e.title}
                </td>
                <td
                  className="px-4 py-3 hidden md:table-cell"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {prettyCategory(e.category)}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {e.source ? (
                    <a
                      href={e.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-data hover:underline inline-flex items-center gap-1.5"
                      style={{ color: "var(--qgi-accent)" }}
                    >
                      <span aria-hidden>🔗</span>
                      {e.sourceDomain || "source"}
                    </a>
                  ) : (
                    <span style={{ color: "var(--qgi-text-muted)" }}>—</span>
                  )}
                  {/* Multi-source badge slot — not lit today (verification = 1 URL) */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="px-3 py-2 rounded tracking-wider uppercase disabled:opacity-30"
            style={{
              color: "var(--qgi-text-muted)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            ← Prev
          </button>
          <span style={{ color: "var(--qgi-text-muted)" }}>
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="px-3 py-2 rounded tracking-wider uppercase disabled:opacity-30"
            style={{
              color: "var(--qgi-text-muted)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
