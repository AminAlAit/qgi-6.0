"use client";

/**
 * PatternRankingTable — the /patterns-v4/ranking client surface.
 *
 * Structural-discrimination leaderboard. Each row = one country. Sort by
 * match score, filter by L1 family of the top-matched pattern, full-text
 * search by country name.
 *
 * Client component (only this page in V4 carries interactivity — the gallery
 * + detail pages are pure Server Components, matching the precedents-v2
 * convention).
 *
 * Honesty regime: every score is a SHAPE-SIMILARITY RANK, not a probability.
 * The page header carries the persistent quarantine note + the M8-R5
 * disclosure. Side panel explains how this ranking differs from /risk-board.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChartLine, Search, ListFilter } from "lucide-react";
import type { RankingEntry } from "@/lib/te-mock/patterns-v4-data";

type SortKey = "rank" | "country" | "top_score" | "region";

export interface PatternRankingTableProps {
  rows: RankingEntry[];
  families: Array<{ id: string; label: string; color: string }>;
}

export function PatternRankingTable({ rows, families }: PatternRankingTableProps) {
  const [query, setQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let r = rows;
    if (familyFilter) r = r.filter((row) => row.top_l1_id === familyFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      r = r.filter(
        (row) =>
          row.country.toLowerCase().includes(q) ||
          row.region.toLowerCase().includes(q) ||
          row.top_pattern_name.toLowerCase().includes(q)
      );
    }
    const sorted = [...r].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "rank") cmp = a.rank - b.rank;
      else if (sortKey === "country") cmp = a.country.localeCompare(b.country);
      else if (sortKey === "top_score") cmp = a.top_score - b.top_score;
      else if (sortKey === "region") cmp = a.region.localeCompare(b.region);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, familyFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // numeric defaults to desc; text defaults to asc
      setSortDir(key === "top_score" ? "desc" : "asc");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 280px",
        gap: "20px",
        alignItems: "flex-start",
      }}
    >
      {/* Main column — controls + table */}
      <div>
        {/* Controls strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            padding: "12px 14px",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "6px",
            marginBottom: "12px",
          }}
        >
          {/* Search */}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              background: "var(--qgi-bg)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
              flex: "1 1 220px",
              minWidth: "180px",
            }}
          >
            <Search size={13} color="var(--qgi-text-dim)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country, region, or pattern…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--qgi-text)",
                fontSize: "12.5px",
                fontFamily: "inherit",
              }}
              aria-label="Search ranking"
            />
          </label>

          {/* Family filter chips */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            <ListFilter size={12} color="var(--qgi-text-dim)" />
            <button
              type="button"
              onClick={() => setFamilyFilter(null)}
              style={chipBtnStyle(familyFilter === null)}
            >
              All families
            </button>
            {families.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFamilyFilter(familyFilter === f.id ? null : f.id)}
                style={chipBtnStyle(familyFilter === f.id, f.color)}
                aria-pressed={familyFilter === f.id}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: f.color,
                    marginRight: "5px",
                    display: "inline-block",
                    verticalAlign: "middle",
                  }}
                />
                {f.id}
              </button>
            ))}
          </div>

          <span style={{ flex: 1 }} />
          <span
            style={{
              fontSize: "10px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.4px",
            }}
          >
            {filtered.length} of {rows.length} countries
          </span>
        </div>

        {/* Table */}
        <div
          style={{
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12.5px",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "44px" }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: "78px" }} />
              <col style={{ width: "auto" }} />
            </colgroup>
            <thead>
              <tr
                style={{
                  background: "var(--qgi-bg)",
                  borderBottom: "1px solid var(--qgi-border)",
                }}
              >
                <Th
                  active={sortKey === "rank"}
                  dir={sortDir}
                  onClick={() => toggleSort("rank")}
                >
                  #
                </Th>
                <Th
                  active={sortKey === "country"}
                  dir={sortDir}
                  onClick={() => toggleSort("country")}
                >
                  Country
                </Th>
                <Th
                  active={sortKey === "region"}
                  dir={sortDir}
                  onClick={() => toggleSort("region")}
                >
                  Region
                </Th>
                <Th>Top-matched pattern</Th>
                <Th
                  active={sortKey === "top_score"}
                  dir={sortDir}
                  onClick={() => toggleSort("top_score")}
                  align="right"
                >
                  Match
                </Th>
                <Th>Runner-up</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      color: "var(--qgi-text-dim)",
                      fontStyle: "italic",
                    }}
                  >
                    No countries match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((row, i) => (
                <tr
                  key={row.country}
                  style={{
                    borderBottom:
                      i < filtered.length - 1 ? "1px solid var(--qgi-border)" : "none",
                  }}
                >
                  <td
                    style={{
                      padding: "11px 12px",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "11.5px",
                      color: "var(--qgi-text-dim)",
                    }}
                  >
                    {String(row.rank).padStart(2, "0")}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <div style={{ fontWeight: 600, color: "var(--qgi-text)" }}>
                      {row.country}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "11px 12px",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "10.5px",
                      color: "var(--qgi-text-muted)",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {row.region}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <Link
                      href={`/patterns-v4/${row.top_pattern_id}` as Route}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "var(--qgi-text)",
                        textDecoration: "none",
                      }}
                    >
                      <span
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: row.top_l1_color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "12.5px" }}>{row.top_pattern_name}</span>
                      <span
                        style={{
                          fontSize: "9.5px",
                          padding: "1px 5px",
                          border: `1px solid ${row.top_l1_color}`,
                          color: row.top_l1_color,
                          borderRadius: "3px",
                          fontFamily: "ui-monospace, monospace",
                          letterSpacing: "0.3px",
                        }}
                      >
                        {row.top_l1_id}
                      </span>
                    </Link>
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "right" }}>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: row.top_l1_color,
                      }}
                    >
                      {row.top_score.toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <Link
                      href={`/patterns-v4/${row.runner_pattern_id}` as Route}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "var(--qgi-text-muted)",
                        textDecoration: "none",
                        fontSize: "11.5px",
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: row.runner_l1_color,
                          flexShrink: 0,
                          opacity: 0.7,
                        }}
                      />
                      <span>{row.runner_pattern_name}</span>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: "10.5px",
                          color: "var(--qgi-text-dim)",
                        }}
                      >
                        {row.runner_score.toFixed(1)}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* M8-R5 footer */}
        <div
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            border: "1px solid #E64545",
            background: "rgba(230,69,69,0.05)",
            borderLeft: "3px solid #E64545",
            borderRadius: "5px",
            fontSize: "12px",
            color: "var(--qgi-text-muted)",
            lineHeight: 1.55,
          }}
        >
          <div
            style={{
              fontSize: "9.5px",
              letterSpacing: "1.3px",
              color: "#E64545",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "4px",
              fontWeight: 600,
            }}
          >
            M8-R5 DISCLOSURE
          </div>
          Scores in this table are <strong>shape-similarity discrimination ranks</strong>,
          not probabilities. A country at 90 is not 90% likely to see the event; it is
          positioned high in the distribution of how closely its trajectory rhymes with
          the canonical shape.
        </div>
      </div>

      {/* Side panel — how this differs from risk-board */}
      <aside
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "6px",
          padding: "14px 16px",
          position: "sticky",
          top: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <ChartLine size={14} color="var(--qgi-accent)" />
          <h3
            style={{
              fontSize: "12px",
              letterSpacing: "1.2px",
              color: "var(--qgi-accent)",
              fontFamily: "ui-monospace, monospace",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            How this differs from Risk Board
          </h3>
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--qgi-text-muted)",
            lineHeight: 1.6,
            margin: "0 0 10px",
          }}
        >
          The <strong style={{ color: "var(--qgi-text)" }}>Patterns ranking</strong> sorts
          countries by shape similarity to ANY pattern in the catalog — including
          walked-failed and queued recipes. It asks:{" "}
          <em>whose trajectory rhymes with something we know about?</em>
        </p>
        <p
          style={{
            fontSize: "12px",
            color: "var(--qgi-text-muted)",
            lineHeight: 1.6,
            margin: "0 0 10px",
          }}
        >
          The{" "}
          <Link href={"/risk-board" as Route} style={{ color: "var(--qgi-accent)" }}>
            Risk Board
          </Link>{" "}
          ranks only on{" "}
          <strong style={{ color: "var(--qgi-text)" }}>Validated (🟢) recipes</strong>{" "}
          with calibration disclosure, surfacing recipe scores with their confidence
          bands. It asks:{" "}
          <em>where are we confident enough to put a tier on the table?</em>
        </p>
        <p
          style={{
            fontSize: "11.5px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.55,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Use Patterns for structural exploration; use Risk Board for decision-grade
          tiering.
        </p>
      </aside>
    </div>
  );
}

function chipBtnStyle(active: boolean, accent?: string): React.CSSProperties {
  const color = accent ?? "var(--qgi-accent)";
  return {
    fontSize: "10.5px",
    padding: "4px 9px",
    background: active ? "rgba(56,189,248,0.1)" : "transparent",
    color: active ? color : "var(--qgi-text-muted)",
    border: `1px solid ${active ? color : "var(--qgi-border)"}`,
    borderRadius: "3px",
    cursor: "pointer",
    fontFamily: "ui-monospace, monospace",
    letterSpacing: "0.3px",
    transition: "all 0.12s",
  };
}

function Th({
  children,
  active,
  dir,
  onClick,
  align = "left",
}: {
  children: React.ReactNode;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: "10px 12px",
        textAlign: align,
        fontSize: "9.5px",
        letterSpacing: "1.3px",
        textTransform: "uppercase",
        color: active ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
        fontFamily: "ui-monospace, monospace",
        fontWeight: 600,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {children}
      {active && (
        <span style={{ marginLeft: "5px", fontSize: "9px" }}>
          {dir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </th>
  );
}
