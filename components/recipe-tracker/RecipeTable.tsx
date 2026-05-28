"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { getMock, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { ArrowUpDown, ChevronUp, ChevronDown, Search, ListFilter } from "lucide-react";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

type SortKey = "label" | "status" | "loco" | "l1";
type SortDir = "asc" | "desc";

const STATUS_RANK: Record<TrackerRecipe["status"], number> = {
  graduated: 0,
  in_progress: 1,
  walked_no_graduation: 2,
  live_legacy: 3,
  queued: 4,
};

const STATUS_LABEL: Record<TrackerRecipe["status"], string> = {
  graduated: "Deployed",
  walked_no_graduation: "Tested, did not hold up",
  in_progress: "In review",
  live_legacy: "Early method, under review",
  queued: "Not yet tested",
};

const STATUS_COLOR: Record<TrackerRecipe["status"], string> = {
  graduated: "#3FBF8F",
  walked_no_graduation: "#E68F29",
  in_progress: "#a78bfa",
  live_legacy: "#7A8FA0",
  queued: "#64748b",
};

// Plausible "next walk ETA" by L1 family — mock, sequenced by priority.
const NEXT_WALK_BY_L1: Record<string, string> = {
  B: "2026-06-04",
  A: "2026-06-11",
  F: "2026-06-18",
  E: "2026-06-25",
  D: "2026-07-02",
  C: "2026-07-09",
  G: "2026-07-23",
  H: "2026-08-06",
};

// Plausible last-walk dates for the four walked_no_graduation + civil_war legacy.
const LAST_WALK: Record<string, string> = {
  foreign_intervention: "2026-05-22",
  terrorist_attack: "2026-05-19",
  economic_recession: "2026-05-19",
  elections_and_voting: "2026-05-09",
  civil_war_and_insurgency: "2026-05-22",
};

/** Map raw verdict strings (from JSON or legacy enums) to plain-English labels. */
function verdictLabel(text: string): string {
  if (/HARD_FAIL/i.test(text) && /MARGINAL/i.test(text))
    return "Marginal: did not hold up";
  if (/HARD.?FAIL/i.test(text)) return "Did not hold up";
  if (/SUSPEND/i.test(text)) return "On hold pending re-validation";
  return text.replace(/legacy-LOCK\s*/gi, "").trim();
}

export function RecipeTable({ recipes }: { recipes: TrackerRecipe[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<TrackerRecipe["status"]>>(
    new Set()
  );
  const [l1Filter, setL1Filter] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const l1Options = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; color: string }>();
    for (const r of recipes) {
      if (!seen.has(r.l1_id)) {
        seen.set(r.l1_id, { id: r.l1_id, label: r.l1_label, color: r.l1_color });
      }
    }
    return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = recipes.filter((r) => {
      if (statusFilter.size && !statusFilter.has(r.status)) return false;
      if (l1Filter.size && !l1Filter.has(r.l1_id)) return false;
      if (!q) return true;
      return (
        r.label.toLowerCase().includes(q) ||
        r.recipe_id.toLowerCase().includes(q) ||
        r.l1_label.toLowerCase().includes(q) ||
        r.l2_label.toLowerCase().includes(q)
      );
    });

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "label") return a.label.localeCompare(b.label) * dir;
      if (sortKey === "l1")
        return (a.l1_id.localeCompare(b.l1_id) || a.label.localeCompare(b.label)) * dir;
      if (sortKey === "status") {
        const diff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        return (diff !== 0 ? diff : a.label.localeCompare(b.label)) * dir;
      }
      if (sortKey === "loco") {
        const av = a.stats?.loco_auc ?? -Infinity;
        const bv = b.stats?.loco_auc ?? -Infinity;
        return (av - bv) * dir;
      }
      return 0;
    });
    return rows;
  }, [recipes, search, statusFilter, l1Filter, sortKey, sortDir]);

  const toggleStatus = (s: TrackerRecipe["status"]) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };
  const toggleL1 = (id: string) => {
    setL1Filter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "loco" ? "desc" : "asc");
    }
  };

  return (
    <section>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            margin: 0,
          }}
        >
          All 71 recipes
        </h2>
        <span
          style={{
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {filtered.length} of {recipes.length} shown
        </span>
      </header>

      {/* Filter strip */}
      <div
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "6px",
          padding: "14px",
          marginBottom: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Search */}
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Search size={14} color="var(--qgi-text-dim)" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipe, family, ID…"
            style={{
              flex: 1,
              background: "var(--qgi-bg)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
              padding: "6px 10px",
              color: "var(--qgi-text)",
              fontSize: "12px",
              fontFamily: "ui-monospace, monospace",
              outline: "none",
            }}
          />
        </label>

        {/* Status filter row */}
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}
        >
          <ListFilter size={12} color="var(--qgi-text-dim)" aria-hidden="true" />
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginRight: "4px",
            }}
          >
            Status
          </span>
          {(Object.keys(STATUS_LABEL) as TrackerRecipe["status"][]).map((s) => {
            const active = statusFilter.has(s);
            const c = STATUS_COLOR[s];
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(s)}
                style={{
                  fontSize: "10.5px",
                  padding: "3px 9px",
                  borderRadius: "3px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.3px",
                  cursor: "pointer",
                  border: `1px solid ${active ? c : "var(--qgi-border)"}`,
                  background: active ? `${c}22` : "var(--qgi-bg)",
                  color: active ? c : "var(--qgi-text-muted)",
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(new Set())}
              style={{
                fontSize: "10px",
                color: "var(--qgi-text-dim)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              clear
            </button>
          )}
        </div>

        {/* L1 filter row */}
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}
        >
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginLeft: "20px",
            }}
          >
            L1 family
          </span>
          {l1Options.map((l1) => {
            const active = l1Filter.has(l1.id);
            return (
              <button
                key={l1.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleL1(l1.id)}
                style={{
                  fontSize: "10.5px",
                  padding: "3px 9px",
                  borderRadius: "3px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.3px",
                  cursor: "pointer",
                  border: `1px solid ${active ? l1.color : "var(--qgi-border)"}`,
                  background: active ? `${l1.color}22` : "var(--qgi-bg)",
                  color: active ? l1.color : "var(--qgi-text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: l1.color,
                    display: "inline-block",
                  }}
                />
                {l1.id} · {l1.label}
              </button>
            );
          })}
          {l1Filter.size > 0 && (
            <button
              type="button"
              onClick={() => setL1Filter(new Set())}
              style={{
                fontSize: "10px",
                color: "var(--qgi-text-dim)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              clear
            </button>
          )}
        </div>
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
        <div style={{ overflowX: "auto", maxHeight: "640px", overflowY: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12.5px",
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                background: "var(--qgi-surface-2)",
                zIndex: 2,
              }}
            >
              <tr>
                <Th width="34px" />
                <Th
                  onClick={() => setSort("label")}
                  active={sortKey === "label"}
                  dir={sortDir}
                >
                  Recipe
                </Th>
                <Th onClick={() => setSort("l1")} active={sortKey === "l1"} dir={sortDir}>
                  L1 family
                </Th>
                <Th
                  onClick={() => setSort("status")}
                  active={sortKey === "status"}
                  dir={sortDir}
                >
                  Status
                </Th>
                <Th>Verdict</Th>
                <Th
                  align="right"
                  onClick={() => setSort("loco")}
                  active={sortKey === "loco"}
                  dir={sortDir}
                >
                  Disc. score
                </Th>
                <Th align="right">Window</Th>
                <Th align="right">n ind</Th>
                <Th>Last tested</Th>
                <Th>Next ETA</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const mock = getMock(r);
                const window =
                  r.stats?.window_y ??
                  (r.status === "queued" || r.status === "live_legacy"
                    ? null
                    : mock.window);
                const nInd = r.stats?.n_indicators ?? null;
                const last = LAST_WALK[r.recipe_id] ?? null;
                const next =
                  r.status === "graduated" || r.status === "in_progress"
                    ? "n/a"
                    : (NEXT_WALK_BY_L1[r.l1_id] ?? "n/a");
                const isClickable = true; // every row links to its precedents-v2 detail
                return (
                  <tr
                    key={r.recipe_id}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--qgi-border)",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                      opacity: r.status === "queued" ? 0.78 : 1,
                    }}
                  >
                    <Td>
                      <span
                        style={{
                          width: "26px",
                          height: "26px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: r.l1_color,
                          border:
                            r.status === "queued" ? `1px dashed ${r.l1_color}` : "none",
                          borderRadius: "4px",
                        }}
                      >
                        <RecipeIcon recipeId={r.recipe_id} size={16} strokeWidth={1.6} />
                      </span>
                    </Td>
                    <Td>
                      {isClickable ? (
                        <Link
                          href={`/precedents-v2/${r.recipe_id}` as Route}
                          style={{
                            color: "var(--qgi-text)",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          {r.label}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--qgi-text)" }}>{r.label}</span>
                      )}
                      <div
                        style={{
                          fontSize: "10.5px",
                          color: "var(--qgi-text-dim)",
                          marginTop: "2px",
                        }}
                      >
                        {r.l2_label}
                      </div>
                    </Td>
                    <Td>
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "2px 7px",
                          borderRadius: "3px",
                          fontFamily: "ui-monospace, monospace",
                          letterSpacing: "0.3px",
                          border: `1px solid ${r.l1_color}66`,
                          background: `${r.l1_color}15`,
                          color: r.l1_color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.l1_id} · {r.l1_label}
                      </span>
                    </Td>
                    <Td>
                      <StatusPill status={r.status} />
                    </Td>
                    <Td>
                      {r.stats?.verdict ? (
                        <VerdictPill
                          text={verdictLabel(r.stats.verdict)}
                          status={r.status}
                        />
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td align="right">
                      {r.stats?.loco_auc != null ? (
                        <span
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            color:
                              r.status === "graduated"
                                ? "#3FBF8F"
                                : r.status === "walked_no_graduation"
                                  ? "#E68F29"
                                  : "var(--qgi-text)",
                            fontWeight: 600,
                          }}
                        >
                          {r.stats.loco_auc.toFixed(4)}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td align="right">
                      {window != null ? (
                        <span
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            color: "var(--qgi-text-muted)",
                          }}
                        >
                          {window}y
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td align="right">
                      {nInd != null ? (
                        <span
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            color: "var(--qgi-text-muted)",
                          }}
                        >
                          {nInd}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      {last ? (
                        <span
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            color: "var(--qgi-text-muted)",
                            fontSize: "11px",
                          }}
                        >
                          {last}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          color: "var(--qgi-text-dim)",
                          fontSize: "11px",
                        }}
                      >
                        {next}
                      </span>
                    </Td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: "var(--qgi-text-dim)",
                    }}
                  >
                    No recipes match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({
  children,
  width,
  align,
  onClick,
  active,
  dir,
}: {
  children?: React.ReactNode;
  width?: string;
  align?: "left" | "right";
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
}) {
  const ariaSortValue: React.AriaAttributes["aria-sort"] = onClick
    ? active
      ? dir === "asc"
        ? "ascending"
        : "descending"
      : "none"
    : undefined;

  return (
    <th
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      aria-sort={ariaSortValue}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        width,
        textAlign: align ?? "left",
        padding: "10px 12px",
        fontSize: "10px",
        letterSpacing: "1px",
        textTransform: "uppercase",
        fontFamily: "ui-monospace, monospace",
        color: active ? "var(--qgi-accent)" : "var(--qgi-text-dim)",
        fontWeight: 600,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        borderBottom: "1px solid var(--qgi-border)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        {children}
        {onClick &&
          (active ? (
            dir === "asc" ? (
              <ChevronUp size={11} aria-hidden="true" />
            ) : (
              <ChevronDown size={11} aria-hidden="true" />
            )
          ) : (
            <ArrowUpDown size={10} opacity={0.5} aria-hidden="true" />
          ))}
      </span>
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "10px 12px",
        verticalAlign: "middle",
        textAlign: align ?? "left",
        color: "var(--qgi-text)",
      }}
    >
      {children}
    </td>
  );
}

function Dash() {
  return (
    <span style={{ color: "var(--qgi-text-dim)", fontFamily: "ui-monospace, monospace" }}>
      n/a
    </span>
  );
}

function StatusPill({ status }: { status: TrackerRecipe["status"] }) {
  const color = STATUS_COLOR[status];
  const label = STATUS_LABEL[status];
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "10px",
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.4px",
        border: `1px solid ${color}`,
        background: `${color}1A`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function VerdictPill({
  text,
  status,
}: {
  text: string;
  status: TrackerRecipe["status"];
}) {
  const upper = text.toUpperCase();
  const isFail = /FAIL|HARD|SUSPEND/.test(upper);
  const color = isFail ? "#E64545" : status === "graduated" ? "#3FBF8F" : "#7A8FA0";
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "3px",
        border: `1px solid ${color}55`,
        background: `${color}10`,
        color,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
        maxWidth: "260px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "inline-block",
      }}
      title={text}
    >
      {text.length > 36 ? text.slice(0, 34) + "…" : text}
    </span>
  );
}
