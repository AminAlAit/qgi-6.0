"use client";

/**
 * TopicBoard — the news-layer view of /risk-board (2026-06-10).
 *
 * The structural grid answers "which countries resemble which trends".
 * This view answers "which of those readings the news is confirming right
 * now". Each country x topic cell carries one of four verdicts:
 *   Active  = structure primed AND news live   (act on it)
 *   Signal  = news spike without structure     (often noise)
 *   Latent  = structure primed, news quiet     (watch it)
 *   Quiet   = neither elevated
 *
 * Three reading lenses, one per audience (founder ask 2026-06-10):
 *   Scan    — the returning analyst's 10-second sweep (rank by active count)
 *   Surge   — the journalist's "what just changed" (rank by pulse jump)
 *   Primed & quiet — the risk professional's edge: structure says primed,
 *                    coverage has not arrived yet (rank by latent density)
 *
 * Plus a Map mode: the confirm/reject quadrant per topic, flags positioned
 * by structural resemblance x news pulse.
 *
 * Verdict colors ride the token system (no red, founder-ratified):
 * Active=warning amber, Signal=accent cyan, Latent=muted, Quiet=dim.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";

// echarts only loads when the Map mode first mounts — keeps the ~300KB
// bundle off the default /risk-board path (review finding).
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import { flagFor, iso2For } from "@/lib/te-mock/country-flags";
import { useTheme } from "@/lib/hooks/useTheme";
import { getEchartsTokens } from "@/lib/echarts-theme";
import type { HfBoard, HfCell, HfTopic, HfVerdict } from "@/lib/hf/topics-data";

/* ── Verdict presentation ────────────────────────────────────────────── */

const VERDICT_STYLE: Record<
  HfVerdict,
  { label: string; color: string; bg: string; border: string }
> = {
  ACTIVE: {
    label: "Active",
    color: "var(--qgi-warning)",
    bg: "color-mix(in srgb, var(--qgi-warning) 13%, transparent)",
    border: "color-mix(in srgb, var(--qgi-warning) 50%, transparent)",
  },
  SIGNAL: {
    label: "Signal",
    color: "var(--qgi-accent)",
    bg: "color-mix(in srgb, var(--qgi-accent) 12%, transparent)",
    border: "color-mix(in srgb, var(--qgi-accent) 50%, transparent)",
  },
  LATENT: {
    label: "Latent",
    color: "var(--qgi-text-muted)",
    bg: "var(--qgi-surface-2)",
    border: "var(--qgi-border)",
  },
  QUIET: {
    // Ghost pill, not bare text: keeps the four-state vocabulary structurally
    // identical while staying the visually quietest state (review finding).
    label: "Quiet",
    color: "var(--qgi-text-dim)",
    bg: "transparent",
    border: "color-mix(in srgb, var(--qgi-border) 70%, transparent)",
  },
};

type Lens = "scan" | "surge" | "primed";

const LENS_META: Record<Lens, { label: string; lede: string }> = {
  scan: {
    label: "Scan",
    lede: "Countries ranked by how many themes are active right now. The ten-second sweep.",
  },
  surge: {
    label: "Surge",
    lede: "Ranked by the biggest jump in news pulse since last month. What the world started talking about.",
  },
  primed: {
    label: "Primed & quiet",
    lede: "The Latent readings: structure elevated, news quiet. Where the conditions exist before the coverage arrives.",
  },
};

interface Props {
  data: HfBoard;
}

export function TopicBoard({ data }: Props) {
  const [lens, setLensState] = useState<Lens>("scan");
  const [mode, setModeState] = useState<"grid" | "map">("grid");
  const [mapTopic, setMapTopic] = useState<string>("T06");

  // Remember the last lens + view between sessions (persona ask). The rAF
  // defer follows the Sidebar's localStorage-sync idiom.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const l = localStorage.getItem("qgi-topics-lens");
        if (l === "scan" || l === "surge" || l === "primed") setLensState(l);
        if (localStorage.getItem("qgi-topics-mode") === "map") setModeState("map");
      } catch {
        // localStorage blocked; defaults stand.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const setLens = (l: Lens) => {
    setLensState(l);
    try {
      localStorage.setItem("qgi-topics-lens", l);
    } catch {}
  };
  const setMode = (m: "grid" | "map") => {
    setModeState(m);
    try {
      localStorage.setItem("qgi-topics-mode", m);
    } catch {}
  };

  const topics = data.boardTopics;

  // One row per country: cells in topic order + per-lens rank metrics.
  const rows = useMemo(() => {
    return data.countries.map((country) => {
      const cells = topics.map((t) => data.cells[`${country.iso3}|${t.id}`] ?? null);
      const activeCount = cells.filter((c) => c?.verdict === "ACTIVE").length;
      const latentCount = cells.filter((c) => c?.verdict === "LATENT").length;
      const pulseSum = cells.reduce((s, c) => s + (c?.pulse ?? 0), 0);
      const structSum = cells.reduce((s, c) => s + (c?.struct ?? 0), 0);
      // Finite sentinel, not -Infinity: a country whose every cell lacks a
      // prior month (a new entrant) would otherwise make the Surge comparator
      // return NaN ((-Inf)-(-Inf)) and scramble the sort.
      const deltas = cells.flatMap((c) =>
        c && c.prevPulse !== null ? [c.pulse - c.prevPulse] : []
      );
      const maxDelta = deltas.length ? Math.max(...deltas) : Number.MIN_SAFE_INTEGER;
      return { country, cells, activeCount, latentCount, pulseSum, structSum, maxDelta };
    });
  }, [data, topics]);

  const sortedRows = useMemo(() => {
    const r = [...rows];
    if (lens === "surge") r.sort((a, b) => b.maxDelta - a.maxDelta);
    else if (lens === "primed")
      r.sort((a, b) => b.latentCount - a.latentCount || b.structSum - a.structSum);
    else r.sort((a, b) => b.activeCount - a.activeCount || b.pulseSum - a.pulseSum);
    return r;
  }, [rows, lens]);

  // Hero: the strongest combined reading this month. Validated topics first;
  // tiebreak on the WEAKEST leg (min of struct/pulse) so "combined" means
  // combined, not just loudest news (review finding).
  const hero = useMemo(() => {
    type Hero = { country: HfBoard["countries"][number]; topic: HfTopic; cell: HfCell };
    const legs = (c: HfCell) => Math.min(c.struct ?? 0, c.pulse);
    let best: Hero | null = null;
    for (const row of rows) {
      for (let i = 0; i < topics.length; i++) {
        const t = topics[i];
        const c = row.cells[i];
        if (!c || c.verdict !== "ACTIVE") continue;
        const beats =
          best === null ||
          (t.validated && !best.topic.validated) ||
          (t.validated === best.topic.validated && legs(c) > legs(best.cell));
        if (beats) best = { country: row.country, topic: t, cell: c };
      }
    }
    return best;
  }, [rows, topics]);

  const gridTemplate = `200px repeat(${topics.length}, minmax(0, 1fr)) 72px`;

  return (
    <div>
      {/* Intro — the one tab-appropriate sentence under the page h1 (the
          review's P0: the old static page copy described trend rows while
          this view shows country rows). No second heading. */}
      <p
        style={{
          color: "var(--qgi-text-muted)",
          fontSize: "15px",
          lineHeight: 1.6,
          maxWidth: "820px",
          margin: "0 0 16px",
        }}
      >
        Each cell combines a country&apos;s structural resemblance with its monthly news
        pulse
        <InfoTooltip text="News pulse is a monthly index of how much of this country's news coverage is on this theme. 50 is the country's own long-run normal; higher means more attention than usual." />{" "}
        into a single reading. Scan a row for which themes are running hot, or a column
        for which countries are drawing attention on one theme.
      </p>

      {/* Hero: strongest combined reading */}
      {hero && mode === "grid" && (
        <HeroStrip hero={hero} linkable={hero.country.linkable} />
      )}

      {/* Controls: lenses + grid/map switch */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px",
          marginBottom: "8px",
        }}
      >
        {/* Lenses only apply to the grid; hiding them in Map mode avoids a
            selected-but-inert control (review finding). */}
        <div
          style={{
            display: "flex",
            gap: "5px",
            visibility: mode === "grid" ? "visible" : "hidden",
          }}
        >
          {(Object.keys(LENS_META) as Lens[]).map((l) => {
            const active = lens === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLens(l)}
                style={{
                  fontSize: "10.5px",
                  padding: "5px 11px",
                  background: active ? "var(--qgi-accent)" : "transparent",
                  color: active ? "var(--qgi-bg)" : "var(--qgi-text-muted)",
                  border: `1px solid ${active ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
                  borderRadius: "4px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.4px",
                  cursor: "pointer",
                }}
              >
                {LENS_META[l].label}
              </button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "5px" }}>
          {(["grid", "map"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  fontSize: "10.5px",
                  padding: "5px 11px",
                  background: active ? "var(--qgi-surface-2)" : "transparent",
                  color: active ? "var(--qgi-text)" : "var(--qgi-text-dim)",
                  border: `1px solid ${active ? "var(--qgi-text-dim)" : "var(--qgi-border)"}`,
                  borderRadius: "4px",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.4px",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {m === "grid" ? "Grid" : "Quadrant"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lens lede */}
      {mode === "grid" && (
        <p
          style={{
            color: "var(--qgi-text-dim)",
            fontSize: "12.5px",
            margin: "0 0 12px",
            lineHeight: 1.5,
          }}
        >
          {LENS_META[lens].lede}
        </p>
      )}

      {mode === "grid" ? (
        <VerdictGrid
          topics={topics}
          rows={sortedRows}
          lens={lens}
          gridTemplate={gridTemplate}
          history={data.history}
        />
      ) : (
        <QuadrantMap
          data={data}
          topics={topics}
          mapTopic={mapTopic}
          onTopic={setMapTopic}
        />
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
          marginTop: "14px",
          fontSize: "11.5px",
          color: "var(--qgi-text-muted)",
        }}
      >
        {(Object.keys(VERDICT_STYLE) as HfVerdict[]).map((v) => (
          <span
            key={v}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: VERDICT_STYLE[v].color,
              }}
            />
            {VERDICT_STYLE[v].label}
            <InfoTooltip text={data.verdicts[v]} />
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <Link
          href={"/methodology#news-layer" as Route}
          target="_blank"
          rel="noopener"
          style={{
            color: "var(--qgi-accent)",
            textDecoration: "none",
            fontSize: "11.5px",
          }}
        >
          How verdicts are assigned →
        </Link>
      </div>

      {/* Footer note (matches the structural footer idiom) */}
      <div
        style={{
          marginTop: "12px",
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.3px",
        }}
      >
        Covering 12 countries across 6 themes today; new ones enter as their signals
        validate. Pulse updates monthly; structural scores refresh each release.
      </div>
    </div>
  );
}

/* ── Hero strip ──────────────────────────────────────────────────────── */

function HeroStrip({
  hero,
  linkable,
}: {
  hero: {
    country: { name: string; iso3: string };
    topic: HfTopic;
    cell: HfCell;
  };
  linkable: boolean;
}) {
  const body = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        marginBottom: "14px",
        border: "1px solid color-mix(in srgb, var(--qgi-warning) 40%, transparent)",
        background: "color-mix(in srgb, var(--qgi-warning) 6%, transparent)",
        borderRadius: "8px",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--qgi-warning)",
          fontFamily: "ui-monospace, monospace",
          flexShrink: 0,
        }}
      >
        This month
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          fontSize: "13.5px",
          color: "var(--qgi-text)",
          fontWeight: 600,
        }}
      >
        <FlagImg
          emoji={flagFor(hero.country.name)}
          name={hero.country.name}
          width={16}
          radius={2}
        />
        {hero.country.name} · {hero.topic.label}
      </span>
      <span style={{ fontSize: "12.5px", color: "var(--qgi-text-muted)" }}>
        is the strongest combined reading: structural {Math.round(hero.cell.struct ?? 0)},
        news pulse {Math.round(hero.cell.pulse)}.
      </span>
      {linkable && (
        <span
          style={{
            marginLeft: "auto",
            color: "var(--qgi-warning)",
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "11.5px",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Open {hero.country.name}
          <ArrowUpRight size={12} strokeWidth={2} />
        </span>
      )}
    </div>
  );
  return linkable ? (
    <Link
      href={`/countries/${hero.country.iso3.toLowerCase()}` as Route}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      {body}
    </Link>
  ) : (
    body
  );
}

/* ── Verdict grid ────────────────────────────────────────────────────── */

/** Per-lens summary column: header label + the row figure that explains the
 *  ranking, so the rightmost column always answers the active lens's
 *  question (review finding). */
const SUMMARY_HEADER: Record<Lens, string> = {
  scan: "Active",
  surge: "Jump",
  primed: "Primed",
};

const SUMMARY_TOOLTIP: Record<Lens, string> = {
  scan: "How many of this country's themes read Active right now: structure primed and news running together.",
  surge: "This country's biggest single-theme rise in news pulse versus last month.",
  primed: "How many themes read Latent: structure elevated while the news stays quiet.",
};

function VerdictGrid({
  topics,
  rows,
  lens,
  gridTemplate,
  history,
}: {
  topics: HfTopic[];
  rows: Array<{
    country: { name: string; iso3: string; linkable: boolean };
    cells: Array<HfCell | null>;
    activeCount: number;
    latentCount: number;
    maxDelta: number;
  }>;
  lens: Lens;
  gridTemplate: string;
  history: HfBoard["history"];
}) {
  return (
    <div
      style={{
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        background: "var(--qgi-surface)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          background: "var(--qgi-bg)",
          borderBottom: "1px solid var(--qgi-border)",
          fontFamily: "ui-monospace, monospace",
          fontSize: "11px",
          letterSpacing: "1px",
          color: "var(--qgi-text-dim)",
        }}
      >
        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--qgi-border)" }}>
          Country ↓ · Topic →
        </div>
        {topics.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "8px 6px",
              textAlign: "center",
              borderRight: "1px solid var(--qgi-border)",
              lineHeight: 1.4,
            }}
          >
            <span style={{ color: "var(--qgi-text-muted)", whiteSpace: "nowrap" }}>
              {t.label}
              <InfoTooltip
                text={`${t.name}. ${t.scope} ${
                  t.validated
                    ? "Validated: its news pulse tends to move ahead of related events by about two months."
                    : "Tracked and scored; validation against the event record is ongoing."
                }`}
              />
            </span>
            {t.validated && (
              <div
                style={{
                  fontSize: "9.5px",
                  color: "var(--qgi-success)",
                  letterSpacing: "0.5px",
                  marginTop: "2px",
                }}
              >
                ▲ Leads ~2 mo
              </div>
            )}
          </div>
        ))}
        <div style={{ padding: "10px 6px", textAlign: "center" }}>
          {SUMMARY_HEADER[lens]}
          <InfoTooltip text={SUMMARY_TOOLTIP[lens]} />
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, ri) => (
        <div
          key={row.country.iso3}
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate,
            borderBottom: ri === rows.length - 1 ? "none" : "1px solid var(--qgi-border)",
          }}
        >
          <CountryNameCell country={row.country} />
          {row.cells.map((cell, ci) => (
            <TopicCell
              key={topics[ci].id}
              cell={cell}
              lens={lens}
              country={row.country}
              topic={topics[ci]}
              spark={history[`${row.country.iso3}|${topics[ci].id}`]?.pulse}
            />
          ))}
          <SummaryCell lens={lens} row={row} />
        </div>
      ))}
    </div>
  );
}

function SummaryCell({
  lens,
  row,
}: {
  lens: Lens;
  row: { activeCount: number; latentCount: number; maxDelta: number };
}) {
  let text: string;
  let color: string;
  if (lens === "surge") {
    const hasDelta = row.maxDelta > Number.MIN_SAFE_INTEGER;
    text = hasDelta ? `${row.maxDelta >= 0 ? "+" : ""}${Math.round(row.maxDelta)}` : "·";
    color =
      hasDelta && row.maxDelta >= 5
        ? "var(--qgi-warning)"
        : hasDelta && row.maxDelta <= -5
          ? "var(--qgi-success)"
          : "var(--qgi-text-dim)";
  } else if (lens === "primed") {
    text = row.latentCount ? String(row.latentCount) : "·";
    color = row.latentCount > 0 ? "var(--qgi-text-muted)" : "var(--qgi-text-dim)";
  } else {
    text = row.activeCount ? String(row.activeCount) : "·";
    color = row.activeCount > 0 ? "var(--qgi-warning)" : "var(--qgi-text-dim)";
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "ui-monospace, monospace",
        fontSize: "13px",
        fontWeight: 700,
        color,
      }}
    >
      {text}
    </div>
  );
}

function CountryNameCell({
  country,
}: {
  country: { name: string; iso3: string; linkable: boolean };
}) {
  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 14px",
        borderRight: "1px solid var(--qgi-border)",
        height: "100%",
        fontSize: "12.5px",
        fontWeight: 600,
        color: "var(--qgi-text)",
      }}
    >
      <FlagImg emoji={flagFor(country.name)} name={country.name} width={16} radius={2} />
      <span
        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {country.name}
      </span>
    </div>
  );
  return country.linkable ? (
    <Link
      href={`/countries/${country.iso3.toLowerCase()}` as Route}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

function TopicCell({
  cell,
  lens,
  country,
  topic,
  spark,
}: {
  cell: HfCell | null;
  lens: Lens;
  country: { name: string; iso3: string; linkable: boolean };
  topic: HfTopic;
  spark?: number[];
}) {
  if (!cell) {
    return (
      <div
        style={{
          padding: "8px",
          borderRight: "1px solid var(--qgi-border)",
          color: "var(--qgi-text-dim)",
          fontSize: "11px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        –
      </div>
    );
  }
  const vs = VERDICT_STYLE[cell.verdict];
  const delta = cell.prevPulse !== null ? cell.pulse - cell.prevPulse : null;
  // Lens emphasis lives on the CELL BACKGROUND, never the pill: verdict
  // pills keep constant weight and color in every lens so the legend's
  // promise holds (review finding). Primed & quiet highlights its Latent
  // cells with a soft surface tint.
  const emphasized = lens === "primed" && cell.verdict === "LATENT";

  const title = `${country.name} · ${topic.label}: structural ${Math.round(cell.struct ?? 0)}, news pulse ${Math.round(cell.pulse)}${
    delta !== null ? ` (${delta >= 0 ? "+" : ""}${Math.round(delta)} vs last month)` : ""
  }. ${vs.label}.`;

  return (
    // Focusable with an accessible name so the numbers behind the verdict
    // reach keyboard and screen-reader users, not just mouse hover (title).
    <div
      title={title}
      role="note"
      aria-label={title}
      tabIndex={0}
      style={{
        padding: "7px 8px",
        borderRight: "1px solid var(--qgi-border)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        alignItems: "center",
        justifyContent: "center",
        background: emphasized ? "var(--qgi-surface-2)" : "transparent",
        transition: "background 140ms ease-out",
        minHeight: "56px",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.5px",
          padding: "2px 8px",
          borderRadius: "9px",
          color: vs.color,
          background: vs.bg,
          border: `1px solid ${vs.border}`,
          whiteSpace: "nowrap",
        }}
      >
        {vs.label}
      </span>
      {lens === "surge" && delta !== null ? (
        <span
          style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, monospace",
            color:
              delta >= 5
                ? "var(--qgi-warning)"
                : delta <= -5
                  ? "var(--qgi-success)"
                  : "var(--qgi-text-dim)",
          }}
        >
          {delta >= 0 ? "+" : ""}
          {Math.round(delta)}
        </span>
      ) : (
        spark && <Sparkline points={spark.slice(-12)} color={vs.color} />
      )}
    </div>
  );
}

/** Tiny inline pulse sparkline (last 12 months, 0-100 scale). */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 44;
  const h = 12;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${(i * step).toFixed(1)},${(h - (p / 100) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ opacity: 0.65 }}>
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Quadrant map (per-topic scatter) ────────────────────────────────── */

function QuadrantMap({
  data,
  topics,
  mapTopic,
  onTopic,
}: {
  data: HfBoard;
  topics: HfTopic[];
  mapTopic: string;
  onTopic: (id: string) => void;
}) {
  const { isDark } = useTheme();
  const t = getEchartsTokens(isDark);
  const topic = topics.find((x) => x.id === mapTopic) ?? topics[0];

  const points = data.countries
    .map((c) => {
      const cell = data.cells[`${c.iso3}|${topic.id}`];
      if (!cell || cell.struct === null) return null;
      const iso2 = iso2For(c.name);
      const verdictColor =
        cell.verdict === "ACTIVE"
          ? t.warning
          : cell.verdict === "SIGNAL"
            ? t.accent
            : cell.verdict === "LATENT"
              ? t.textMuted
              : t.textDim;
      return {
        name: c.name,
        href: c.linkable ? `/countries/${c.iso3.toLowerCase()}` : null,
        value: [cell.struct, cell.pulse],
        verdict: cell.verdict,
        symbol:
          iso2 && /^[a-z]{2}$/.test(iso2)
            ? `image://https://flagcdn.com/28x21/${iso2}.png`
            : "circle",
        symbolSize: [24, 18],
        label: {
          show: true,
          position: "bottom" as const,
          color: verdictColor,
          fontSize: 10.5,
          formatter: c.name,
        },
      };
    })
    .filter(Boolean);

  const th = data.thresholds;
  // Derive the x floor from the data (10-step, capped at 30) so a future
  // low-structure country can never be silently clipped off the canvas.
  const structVals = points.map((p) => p!.value[0] as number);
  const xMin = Math.min(
    30,
    Math.max(0, Math.floor((Math.min(...structVals) - 5) / 10) * 10)
  );

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: t.surface2,
      borderColor: t.border,
      textStyle: { color: t.text, fontSize: 11 },
      formatter: (p: { data: { name: string; value: number[]; verdict: HfVerdict } }) =>
        `<b>${p.data.name}</b><br/>structural ${Math.round(p.data.value[0])} · news pulse ${Math.round(
          p.data.value[1]
        )}<br/>${VERDICT_STYLE[p.data.verdict].label}`,
    },
    grid: { left: 56, right: 28, top: 30, bottom: 46 },
    xAxis: {
      min: xMin,
      max: 100,
      name: "STRUCTURAL RESEMBLANCE",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: t.textDim, fontSize: 10, letterSpacing: 1 },
      axisLine: { lineStyle: { color: t.border } },
      // Minor gridlines off: the 60/60 threshold lines ARE the read of this
      // chart and must be the only interior lines (review finding).
      splitLine: { show: false },
      axisLabel: { color: t.textMuted, fontSize: 10.5 },
    },
    yAxis: {
      min: 0,
      max: 100,
      name: "NEWS PULSE",
      nameLocation: "middle",
      nameGap: 36,
      nameTextStyle: { color: t.textDim, fontSize: 10, letterSpacing: 1 },
      axisLine: { lineStyle: { color: t.border } },
      splitLine: { show: false },
      axisLabel: { color: t.textMuted, fontSize: 10.5 },
    },
    graphic: [
      quadLabel(0.97, 0.06, "Active", t.warning, "right"),
      quadLabel(0.08, 0.06, "Signal", t.accent, "left"),
      quadLabel(0.97, 0.84, "Latent", t.textMuted, "right"),
      quadLabel(0.08, 0.84, "Quiet", t.textDim, "left"),
    ],
    series: [
      {
        type: "scatter",
        data: points,
        // Persona panel: the flags begged to be clicked. Pointer cursor +
        // click-through to the country profile (linkable countries only).
        cursor: "pointer",
        // Shift colliding country labels apart instead of letting them
        // overprint (review finding: NigeriaThailand ran together).
        labelLayout: { moveOverlap: "shiftY" as const },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.textDim, type: "dashed", width: 1.2 },
          label: { show: false },
          data: [{ xAxis: th.struct }, { yAxis: th.pulse }],
        },
      },
    ],
  };

  return (
    <div
      style={{
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        background: "var(--qgi-surface)",
        padding: "14px",
      }}
    >
      {/* Topic chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
        {topics.map((x) => {
          const active = x.id === topic.id;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => onTopic(x.id)}
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                background: active ? "var(--qgi-surface-2)" : "transparent",
                color: active ? "var(--qgi-text)" : "var(--qgi-text-muted)",
                border: `1px solid ${active ? "var(--qgi-text-dim)" : "var(--qgi-border)"}`,
                borderRadius: "12px",
                fontFamily: "ui-monospace, monospace",
                cursor: "pointer",
              }}
            >
              {x.validated ? "▲ " : ""}
              {x.label}
            </button>
          );
        })}
      </div>
      <p
        style={{
          color: "var(--qgi-text-dim)",
          fontSize: "12px",
          margin: "0 0 4px",
          lineHeight: 1.5,
        }}
      >
        Every covered country on one canvas for {topic.label}: structure runs across, news
        pulse runs up. Top right is where both line up. Themes marked ▲ carry a validated
        news lead of about two months.
      </p>
      <ReactECharts
        option={option}
        onEvents={{
          click: (p: { data?: { href?: string | null } }) => {
            if (p.data?.href) window.location.assign(p.data.href);
          },
        }}
        style={{ height: "440px", width: "100%" }}
      />
    </div>
  );
}

function quadLabel(
  xr: number,
  yr: number,
  text: string,
  fill: string,
  align: "left" | "right"
) {
  return {
    type: "text" as const,
    left: align === "left" ? `${xr * 100}%` : undefined,
    right: align === "right" ? `${(1 - xr) * 100}%` : undefined,
    top: `${yr * 100}%`,
    style: { text, fill, fontSize: 12, fontWeight: "bold" as const },
    z: 1,
  };
}
