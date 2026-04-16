"use client";

/**
 * EXAMPLE / PROTOTYPE: Patterns Browsing V2
 * Demonstrates the 4-state browsing UX from
 * ux-consult-patterns-browsing-2026-04-17.md
 *
 * States:
 *   S0 - Landing: top 10 global pairs
 *   S1 - Country A selected: partner table
 *   S2 - Pair selected: windows table
 *   S3 - Window selected: pattern summary card
 *
 * All data is hardcoded for prototype purposes.
 */

import { useState, useMemo } from "react";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BrowseState = "S0" | "S1" | "S2" | "S3";

interface CountryOption {
  id: string;
  name: string;
  alpha2: string;
}

interface GlobalPairRow {
  rank: number;
  countryA: CountryOption;
  countryB: CountryOption;
  pps: number;
  length: number;
  correlation: number;
  lead: number;
  indicators: number;
}

interface PartnerRow {
  country: CountryOption;
  bestPps: number;
  avgR: number;
  combos: number;
  bestLead: number;
}

interface WindowRow {
  id: number;
  startA: number;
  endA: number;
  startB: number;
  endB: number;
  length: number;
  indicators: number;
  correlation: number;
  pps: number;
  lead: number;
}

/* ------------------------------------------------------------------ */
/*  Hardcoded data                                                     */
/* ------------------------------------------------------------------ */

const COUNTRY_OPTIONS: CountryOption[] = [
  { id: "116", name: "South Korea", alpha2: "KR" },
  { id: "216", name: "Thailand", alpha2: "TH" },
  { id: "136", name: "Malaysia", alpha2: "MY" },
  { id: "60", name: "Denmark", alpha2: "DK" },
  { id: "75", name: "France", alpha2: "FR" },
  { id: "15", name: "Austria", alpha2: "AT" },
  { id: "155", name: "Netherlands", alpha2: "NL" },
  { id: "74", name: "Finland", alpha2: "FI" },
  { id: "43", name: "Chile", alpha2: "CL" },
  { id: "100", name: "India", alpha2: "IN" },
  { id: "175", name: "Paraguay", alpha2: "PY" },
  { id: "82", name: "Germany", alpha2: "DE" },
  { id: "211", name: "Sweden", alpha2: "SE" },
  { id: "101", name: "Iran", alpha2: "IR" },
  { id: "233", name: "Venezuela", alpha2: "VE" },
  { id: "24", name: "Brazil", alpha2: "BR" },
  { id: "110", name: "Japan", alpha2: "JP" },
  { id: "154", name: "Nigeria", alpha2: "NG" },
  { id: "70", name: "Egypt", alpha2: "EG" },
  { id: "222", name: "United Kingdom", alpha2: "GB" },
];

const TOP_GLOBAL_PAIRS: GlobalPairRow[] = [
  { rank: 1, countryA: { id: "116", name: "South Korea", alpha2: "KR" }, countryB: { id: "216", name: "Thailand", alpha2: "TH" }, pps: 1584, length: 49, correlation: 0.921, lead: 10, indicators: 28 },
  { rank: 2, countryA: { id: "136", name: "Malaysia", alpha2: "MY" }, countryB: { id: "216", name: "Thailand", alpha2: "TH" }, pps: 1571, length: 56, correlation: 0.912, lead: 4, indicators: 26 },
  { rank: 3, countryA: { id: "60", name: "Denmark", alpha2: "DK" }, countryB: { id: "75", name: "France", alpha2: "FR" }, pps: 1516, length: 58, correlation: 0.908, lead: 0, indicators: 25 },
  { rank: 4, countryA: { id: "15", name: "Austria", alpha2: "AT" }, countryB: { id: "75", name: "France", alpha2: "FR" }, pps: 1502, length: 55, correlation: 0.905, lead: 2, indicators: 24 },
  { rank: 5, countryA: { id: "75", name: "France", alpha2: "FR" }, countryB: { id: "155", name: "Netherlands", alpha2: "NL" }, pps: 1498, length: 56, correlation: 0.903, lead: 1, indicators: 27 },
  { rank: 6, countryA: { id: "74", name: "Finland", alpha2: "FI" }, countryB: { id: "75", name: "France", alpha2: "FR" }, pps: 1487, length: 52, correlation: 0.899, lead: 3, indicators: 23 },
  { rank: 7, countryA: { id: "60", name: "Denmark", alpha2: "DK" }, countryB: { id: "155", name: "Netherlands", alpha2: "NL" }, pps: 1475, length: 57, correlation: 0.896, lead: 0, indicators: 25 },
  { rank: 8, countryA: { id: "43", name: "Chile", alpha2: "CL" }, countryB: { id: "116", name: "South Korea", alpha2: "KR" }, pps: 1423, length: 48, correlation: 0.887, lead: 8, indicators: 22 },
  { rank: 9, countryA: { id: "100", name: "India", alpha2: "IN" }, countryB: { id: "216", name: "Thailand", alpha2: "TH" }, pps: 1398, length: 45, correlation: 0.882, lead: 6, indicators: 21 },
  { rank: 10, countryA: { id: "175", name: "Paraguay", alpha2: "PY" }, countryB: { id: "116", name: "South Korea", alpha2: "KR" }, pps: 1356, length: 41, correlation: 0.874, lead: 12, indicators: 20 },
];

// France's partner table (S1 data)
const FRANCE_PARTNERS: PartnerRow[] = [
  { country: { id: "60", name: "Denmark", alpha2: "DK" }, bestPps: 1274, avgR: 0.908, combos: 14, bestLead: 0 },
  { country: { id: "15", name: "Austria", alpha2: "AT" }, bestPps: 1270, avgR: 0.905, combos: 12, bestLead: 2 },
  { country: { id: "155", name: "Netherlands", alpha2: "NL" }, bestPps: 1263, avgR: 0.903, combos: 15, bestLead: 1 },
  { country: { id: "74", name: "Finland", alpha2: "FI" }, bestPps: 1254, avgR: 0.899, combos: 11, bestLead: 3 },
  { country: { id: "211", name: "Sweden", alpha2: "SE" }, bestPps: 1193, avgR: 0.884, combos: 9, bestLead: 2 },
  { country: { id: "82", name: "Germany", alpha2: "DE" }, bestPps: 1167, avgR: 0.878, combos: 13, bestLead: 1 },
  { country: { id: "222", name: "United Kingdom", alpha2: "GB" }, bestPps: 1102, avgR: 0.861, combos: 10, bestLead: 3 },
  { country: { id: "43", name: "Chile", alpha2: "CL" }, bestPps: 987, avgR: 0.823, combos: 6, bestLead: 8 },
];

// France-Netherlands windows table (S2 data)
const FR_NL_WINDOWS: WindowRow[] = [
  { id: 1, startA: 1969, endA: 2025, startB: 1970, endB: 2026, length: 56, indicators: 27, correlation: 0.903, pps: 1498, lead: 1 },
  { id: 2, startA: 1967, endA: 2025, startB: 1968, endB: 2026, length: 58, indicators: 25, correlation: 0.897, pps: 1462, lead: 1 },
  { id: 3, startA: 1971, endA: 2023, startB: 1973, endB: 2025, length: 52, indicators: 23, correlation: 0.891, pps: 1434, lead: 2 },
  { id: 4, startA: 1975, endA: 2023, startB: 1976, endB: 2024, length: 48, indicators: 21, correlation: 0.884, pps: 1387, lead: 1 },
  { id: 5, startA: 1978, endA: 2023, startB: 1980, endB: 2025, length: 45, indicators: 19, correlation: 0.876, pps: 1321, lead: 2 },
];

/* ------------------------------------------------------------------ */
/*  Color helpers (matching ranking page patterns)                     */
/* ------------------------------------------------------------------ */

function ppsColor(pps: number): string {
  if (pps >= 1400) return "#f87171"; // red -- very strong
  if (pps >= 1200) return "#fb923c"; // orange -- strong
  if (pps >= 1000) return "#fbbf24"; // amber -- moderate
  if (pps >= 700) return "#7a90a8";  // muted -- weak
  return "#4a6280";                   // dim -- very weak
}

function corrColor(r: number): string {
  if (r >= 0.90) return "#f87171";
  if (r >= 0.85) return "#fb923c";
  if (r >= 0.80) return "#fbbf24";
  return "#7a90a8";
}

function leadLabel(lead: number): string {
  if (lead === 0) return "sync";
  if (lead > 0) return `+${lead}yr`;
  return `${lead}yr`;
}

/* ------------------------------------------------------------------ */
/*  PPS inline bar                                                     */
/* ------------------------------------------------------------------ */

function PpsBar({ pps, maxPps }: { pps: number; maxPps: number }) {
  const pct = Math.min(100, (pps / maxPps) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 rounded-full"
        style={{
          width: "80px",
          backgroundColor: "var(--qgi-surface-2)",
        }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: ppsColor(pps),
          }}
        />
      </div>
      <span className="font-data text-xs" style={{ color: ppsColor(pps) }}>
        {pps}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Breadcrumb component                                               */
/* ------------------------------------------------------------------ */

function Breadcrumb({
  segments,
  onNavigate,
}: {
  segments: { label: string; alpha2?: string; state: BrowseState }[];
  onNavigate: (state: BrowseState) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] tracking-wider">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <span style={{ color: "var(--qgi-text-dim)" }}>&rsaquo;</span>
          )}
          <button
            onClick={() => onNavigate(seg.state)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--qgi-surface-2)]"
            style={{
              color:
                i === segments.length - 1
                  ? "var(--qgi-text)"
                  : "var(--qgi-text-muted)",
              cursor: i === segments.length - 1 ? "default" : "pointer",
            }}
          >
            {seg.alpha2 && <CountryFlag alpha2={seg.alpha2} size={12} />}
            {seg.label}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Country search dropdown (simplified combobox)                      */
/* ------------------------------------------------------------------ */

function CountryDropdown({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: CountryOption | null;
  options: CountryOption[];
  onChange: (c: CountryOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.alpha2.toLowerCase().includes(q)
    );
  }, [options, search]);

  return (
    <div className="relative">
      <div className="text-[9px] tracking-widest uppercase mb-1" style={{ color: "var(--qgi-text-dim)" }}>
        {label}
      </div>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-colors min-w-[180px]"
        style={{
          backgroundColor: disabled ? "var(--qgi-bg)" : "var(--qgi-surface)",
          borderColor: open ? "var(--qgi-accent)" : "var(--qgi-border)",
          color: value ? "var(--qgi-text)" : "var(--qgi-text-dim)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {value ? (
          <>
            <CountryFlag alpha2={value.alpha2} size={14} />
            <span className="truncate">{value.name}</span>
          </>
        ) : (
          <span>Select country...</span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-lg border shadow-xl z-50 overflow-hidden"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--qgi-border)" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              autoFocus
              className="w-full px-2 py-1 rounded text-xs border-none outline-none"
              style={{
                backgroundColor: "var(--qgi-surface-2)",
                color: "var(--qgi-text)",
              }}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors hover:bg-[var(--qgi-surface-2)]"
                style={{
                  color:
                    value?.id === c.id
                      ? "var(--qgi-accent)"
                      : "var(--qgi-text)",
                }}
              >
                <CountryFlag alpha2={c.alpha2} size={14} />
                <span>{c.name}</span>
                <span
                  className="ml-auto font-data text-[10px]"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {c.alpha2}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div
                className="px-3 py-4 text-xs text-center"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                No countries match &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  S0: Landing state -- top global pairs                              */
/* ------------------------------------------------------------------ */

function StateS0({
  onSelectPair,
}: {
  onSelectPair: (a: CountryOption, b: CountryOption) => void;
}) {
  const maxPps = TOP_GLOBAL_PAIRS[0].pps;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
        }}
      >
        <h2
          className="text-sm tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text)" }}
        >
          PATTERNS PORTAL
        </h2>
        <p
          className="text-xs leading-relaxed max-w-2xl"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          Explore structural similarities between countries across
          260 economic indicators and 60+ years of data. Start by
          selecting a Predictor Country above, or browse the
          top-ranked pattern pairs below.
        </p>
        <div
          className="flex gap-4 mt-3 text-[10px] font-data tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <span>214 countries</span>
          <span>&middot;</span>
          <span>2.01B patterns</span>
          <span>&middot;</span>
          <span>23 ranked pairs in cache</span>
        </div>
      </div>

      {/* Top pairs table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            TOP GLOBAL PAIRS
            <InfoTooltip text="Top 10 pattern pairs ranked by Pattern Power Score (PPS), drawn from the pre-computed ranking cache." />
          </h3>
          <span
            className="text-[10px] tracking-wider"
            style={{ color: "var(--qgi-accent)" }}
          >
            View full ranking &rarr;
          </span>
        </div>

        <div
          className="rounded-lg overflow-hidden border"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b text-[10px] tracking-widest uppercase"
                style={{
                  borderColor: "var(--qgi-border)",
                  color: "var(--qgi-text-dim)",
                }}
              >
                <th className="px-3 py-2.5 text-left w-8">#</th>
                <th className="px-3 py-2.5 text-left">
                  PAIR
                  <InfoTooltip text="Predictor country (earlier window) followed by the Following country (later window)." />
                </th>
                <th className="px-3 py-2.5 text-right">
                  YRS
                  <InfoTooltip text="Pattern length in years." />
                </th>
                <th className="px-3 py-2.5 text-right">
                  IDX
                  <InfoTooltip text="Number of matching indicators (SCDIs) in this pattern." />
                </th>
                <th className="px-3 py-2.5 text-right">
                  CORR
                  <InfoTooltip text="Average Pearson correlation across all matching indicators." />
                </th>
                <th className="px-3 py-2.5 text-left pl-6">
                  PPS
                  <InfoTooltip text="Pattern Power Score -- composite strength metric combining correlation, indicator count, and pattern length." />
                </th>
                <th className="px-3 py-2.5 text-right">
                  LEAD
                  <InfoTooltip text="How many years Country B's window starts after Country A's. Positive = forecasting potential." />
                </th>
              </tr>
            </thead>
            <tbody>
              {TOP_GLOBAL_PAIRS.map((row) => (
                <tr
                  key={row.rank}
                  onClick={() => onSelectPair(row.countryA, row.countryB)}
                  className="border-b transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                  style={{ borderColor: "var(--qgi-border)" }}
                >
                  <td
                    className="px-3 py-2.5 font-data"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {row.rank}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <CountryFlag alpha2={row.countryA.alpha2} size={16} />
                      <span
                        className="font-data text-xs"
                        style={{ color: "var(--qgi-country-a)" }}
                      >
                        {row.countryA.alpha2}
                      </span>
                      <span style={{ color: "var(--qgi-text-dim)" }}>&rarr;</span>
                      <CountryFlag alpha2={row.countryB.alpha2} size={16} />
                      <span
                        className="font-data text-xs"
                        style={{ color: "var(--qgi-country-b)" }}
                      >
                        {row.countryB.alpha2}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-data"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {row.length}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-data"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {row.indicators}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-data"
                    style={{ color: corrColor(row.correlation) }}
                  >
                    {(row.correlation * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2.5 pl-6">
                    <PpsBar pps={row.pps} maxPps={maxPps} />
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-data"
                    style={{
                      color:
                        row.lead > 0
                          ? "var(--qgi-success)"
                          : "var(--qgi-text-dim)",
                    }}
                  >
                    {leadLabel(row.lead)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p
          className="mt-3 text-[10px] tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Click any row to jump to that pattern, or select a country above to
          see all its pattern partners.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  S1: Country A selected -- partner table                            */
/* ------------------------------------------------------------------ */

function StateS1({
  countryA,
  onSelectPartner,
}: {
  countryA: CountryOption;
  onSelectPartner: (partner: CountryOption) => void;
}) {
  const [sortKey, setSortKey] = useState<"pps" | "avgR" | "combos" | "lead" | "name">("pps");
  const [filter, setFilter] = useState("");

  const partners = useMemo(() => {
    let list = [...FRANCE_PARTNERS];
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter((p) => p.country.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case "pps": return b.bestPps - a.bestPps;
        case "avgR": return b.avgR - a.avgR;
        case "combos": return b.combos - a.combos;
        case "lead": return b.bestLead - a.bestLead;
        case "name": return a.country.name.localeCompare(b.country.name);
        default: return 0;
      }
    });
    return list;
  }, [sortKey, filter]);

  const maxPps = Math.max(...FRANCE_PARTNERS.map((p) => p.bestPps));

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3
            className="text-xs tracking-widest uppercase flex items-center gap-2"
            style={{ color: "var(--qgi-text)" }}
          >
            <CountryFlag alpha2={countryA.alpha2} size={18} />
            {countryA.name.toUpperCase()}&apos;S PATTERN PARTNERS
            <InfoTooltip text="All countries that share structural indicator patterns with the selected predictor country, ranked by best PPS." />
          </h3>
          <div
            className="text-[10px] tracking-wider mt-1 font-data"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {FRANCE_PARTNERS.length} countries &middot; showing top{" "}
            {partners.length}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter partners..."
            className="px-2 py-1 rounded text-xs border outline-none"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
              width: "140px",
            }}
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="px-2 py-1 rounded text-[10px] border outline-none tracking-wider uppercase"
            style={{
              backgroundColor: "var(--qgi-surface)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text-muted)",
            }}
          >
            <option value="pps">Sort: Best PPS</option>
            <option value="avgR">Sort: Avg r</option>
            <option value="combos">Sort: Combos</option>
            <option value="lead">Sort: Best Lead</option>
            <option value="name">Sort: A-Z</option>
          </select>
        </div>
      </div>

      {/* Partner table */}
      <div
        className="rounded-lg overflow-hidden border"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr
              className="border-b text-[10px] tracking-widest uppercase"
              style={{
                borderColor: "var(--qgi-border)",
                color: "var(--qgi-text-dim)",
              }}
            >
              <th className="px-3 py-2.5 text-left w-8"></th>
              <th className="px-3 py-2.5 text-left">
                PARTNER
                <InfoTooltip text="The Following country that shares structural patterns with the selected Predictor." />
              </th>
              <th className="px-3 py-2.5 text-left pl-6">
                BEST PPS
                <InfoTooltip text="Highest Pattern Power Score across all window combinations for this pair." />
              </th>
              <th className="px-3 py-2.5 text-right">
                AVG r
                <InfoTooltip text="Average Pearson correlation of the best-PPS window." />
              </th>
              <th className="px-3 py-2.5 text-right">
                COMBOS
                <InfoTooltip text="Number of distinct (length, start_a, start_b) windows for this pair. More combos = more evidence." />
              </th>
              <th className="px-3 py-2.5 text-right">
                BEST LEAD
                <InfoTooltip text="Lead time (years) of the best-PPS window. Positive = forecasting potential." />
              </th>
            </tr>
          </thead>
          <tbody>
            {partners.map((row) => (
              <tr
                key={row.country.id}
                onClick={() => onSelectPartner(row.country)}
                className="border-b transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                style={{ borderColor: "var(--qgi-border)" }}
              >
                <td className="px-3 py-2.5">
                  <CountryFlag alpha2={row.country.alpha2} size={16} />
                </td>
                <td
                  className="px-3 py-2.5 font-medium"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {row.country.name}
                </td>
                <td className="px-3 py-2.5 pl-6">
                  <PpsBar pps={row.bestPps} maxPps={maxPps} />
                </td>
                <td
                  className="px-3 py-2.5 text-right font-data"
                  style={{ color: corrColor(row.avgR) }}
                >
                  {row.avgR.toFixed(3)}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {row.combos}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-data"
                  style={{
                    color:
                      row.bestLead > 0
                        ? "var(--qgi-success)"
                        : "var(--qgi-text-dim)",
                  }}
                >
                  {leadLabel(row.bestLead)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className="text-[10px] tracking-wider"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Click any row to see all pattern windows for {countryA.name} + that
        country.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  S2: Pair selected -- windows table                                 */
/* ------------------------------------------------------------------ */

function StateS2({
  countryA,
  countryB,
  onSelectWindow,
}: {
  countryA: CountryOption;
  countryB: CountryOption;
  onSelectWindow: (w: WindowRow) => void;
}) {
  const allLengths = FR_NL_WINDOWS.map((w) => w.length);
  const minLen = Math.min(...allLengths);
  const maxLen = Math.max(...allLengths);

  const [lengthMin, setLengthMin] = useState(minLen);
  const [lengthMax, setLengthMax] = useState(maxLen);

  const filteredWindows = useMemo(
    () =>
      FR_NL_WINDOWS.filter(
        (w) => w.length >= lengthMin && w.length <= lengthMax
      ),
    [lengthMin, lengthMax]
  );

  const topPps = Math.max(...FR_NL_WINDOWS.map((w) => w.pps));

  return (
    <div className="space-y-5">
      {/* Pair header */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <CountryFlag alpha2={countryA.alpha2} size={24} />
          <span
            className="text-sm font-semibold tracking-wider"
            style={{ color: "var(--qgi-country-a)" }}
          >
            {countryA.name.toUpperCase()}
          </span>
          <span style={{ color: "var(--qgi-text-dim)" }}>&mdash;&mdash;&mdash;</span>
          <CountryFlag alpha2={countryB.alpha2} size={24} />
          <span
            className="text-sm font-semibold tracking-wider"
            style={{ color: "var(--qgi-country-b)" }}
          >
            {countryB.name.toUpperCase()}
          </span>
        </div>
        <div
          className="text-[10px] font-data tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {FR_NL_WINDOWS.length} pattern windows &middot;{" "}
          {new Set(FR_NL_WINDOWS.map((w) => w.length)).size} unique lengths
          &middot; best PPS {topPps}
        </div>
      </div>

      {/* Length slider */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
        }}
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          LENGTH RANGE
          <InfoTooltip text="Filter pattern windows by length. Drag to narrow the range." />
        </div>

        <div className="flex items-center gap-4">
          <span
            className="font-data text-xs w-6 text-right"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {minLen}
          </span>

          <div className="flex-1 relative">
            {/* Track background */}
            <div
              className="h-2 rounded-full"
              style={{ backgroundColor: "var(--qgi-surface-2)" }}
            />

            {/* Active range highlight */}
            <div
              className="absolute top-0 h-2 rounded-full"
              style={{
                left: `${((lengthMin - minLen) / (maxLen - minLen)) * 100}%`,
                right: `${100 - ((lengthMax - minLen) / (maxLen - minLen)) * 100}%`,
                backgroundColor: "var(--qgi-accent)",
                opacity: 0.4,
              }}
            />

            {/* Tick marks for available lengths */}
            <div className="flex justify-between mt-1.5">
              {allLengths.sort((a, b) => a - b).map((len) => (
                <div
                  key={len}
                  className="flex flex-col items-center"
                  style={{
                    position: "absolute",
                    left: `${((len - minLen) / (maxLen - minLen)) * 100}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1"
                    style={{
                      backgroundColor:
                        len >= lengthMin && len <= lengthMax
                          ? "var(--qgi-accent)"
                          : "var(--qgi-text-dim)",
                    }}
                  />
                  <span
                    className="text-[8px] font-data mt-0.5"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {len}
                  </span>
                </div>
              ))}
            </div>

            {/* Range inputs (stacked, transparent) */}
            <input
              type="range"
              min={minLen}
              max={maxLen}
              value={lengthMin}
              onChange={(e) =>
                setLengthMin(
                  Math.min(Number(e.target.value), lengthMax)
                )
              }
              className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
              style={{ pointerEvents: "auto" }}
            />
            <input
              type="range"
              min={minLen}
              max={maxLen}
              value={lengthMax}
              onChange={(e) =>
                setLengthMax(
                  Math.max(Number(e.target.value), lengthMin)
                )
              }
              className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
              style={{ pointerEvents: "auto" }}
            />
          </div>

          <span
            className="font-data text-xs w-6"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {maxLen}
          </span>
        </div>

        <div
          className="text-[10px] font-data mt-3 text-center"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {lengthMin} &ndash; {lengthMax} years ({filteredWindows.length} of{" "}
          {FR_NL_WINDOWS.length} windows)
        </div>
      </div>

      {/* Windows table */}
      <div
        className="rounded-lg overflow-hidden border"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr
              className="border-b text-[10px] tracking-widest uppercase"
              style={{
                borderColor: "var(--qgi-border)",
                color: "var(--qgi-text-dim)",
              }}
            >
              <th className="px-3 py-2.5 text-left w-8">#</th>
              <th className="px-3 py-2.5 text-left" style={{ color: "var(--qgi-country-a)" }}>
                {countryA.name.toUpperCase()}
                <InfoTooltip text="Time window for the Predictor country." />
              </th>
              <th className="px-3 py-2.5 text-left" style={{ color: "var(--qgi-country-b)" }}>
                {countryB.name.toUpperCase()}
                <InfoTooltip text="Time window for the Following country." />
              </th>
              <th className="px-3 py-2.5 text-right">
                YRS
                <InfoTooltip text="Pattern length in years." />
              </th>
              <th className="px-3 py-2.5 text-right">
                IDX
                <InfoTooltip text="Number of matching indicators (SCDIs)." />
              </th>
              <th className="px-3 py-2.5 text-right">
                CORR
                <InfoTooltip text="Average Pearson correlation." />
              </th>
              <th className="px-3 py-2.5 text-left pl-6">
                PPS
                <InfoTooltip text="Pattern Power Score." />
              </th>
              <th className="px-3 py-2.5 text-right">
                LEAD
                <InfoTooltip text="Lead time in years." />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredWindows.map((w, idx) => (
              <tr
                key={w.id}
                onClick={() => onSelectWindow(w)}
                className="border-b transition-colors cursor-pointer hover:bg-[var(--qgi-surface-2)]"
                style={{ borderColor: "var(--qgi-border)" }}
              >
                <td
                  className="px-3 py-2.5 font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {idx + 1}
                </td>
                <td className="px-3 py-2.5 font-data" style={{ color: "var(--qgi-country-a)" }}>
                  {w.startA}&ndash;{w.endA}
                </td>
                <td className="px-3 py-2.5 font-data" style={{ color: "var(--qgi-country-b)" }}>
                  {w.startB}&ndash;{w.endB}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {w.length}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {w.indicators}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-data"
                  style={{ color: corrColor(w.correlation) }}
                >
                  {(w.correlation * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-2.5 pl-6">
                  <PpsBar pps={w.pps} maxPps={topPps} />
                </td>
                <td
                  className="px-3 py-2.5 text-right font-data"
                  style={{
                    color:
                      w.lead > 0
                        ? "var(--qgi-success)"
                        : "var(--qgi-text-dim)",
                  }}
                >
                  {leadLabel(w.lead)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className="text-[10px] tracking-wider"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Click any row to view the full pattern detail with indicator charts.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  S3: Window selected -- pattern summary card                        */
/* ------------------------------------------------------------------ */

function StateS3({
  countryA,
  countryB,
  window,
}: {
  countryA: CountryOption;
  countryB: CountryOption;
  window: WindowRow;
}) {
  // PPS quintile
  const ppsTier =
    window.pps >= 1400
      ? { label: "Very Strong", color: "#f87171" }
      : window.pps >= 1200
        ? { label: "Strong", color: "#fb923c" }
        : window.pps >= 1000
          ? { label: "Moderate", color: "#fbbf24" }
          : { label: "Weak", color: "#7a90a8" };

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <section
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
        }}
      >
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            {/* Country A */}
            <div className="flex items-center gap-4">
              <CountryFlag alpha2={countryA.alpha2} size={36} />
              <div>
                <div
                  className="text-lg font-semibold"
                  style={{ color: "var(--qgi-country-a)" }}
                >
                  {countryA.name.toUpperCase()}
                </div>
                <div
                  className="font-data text-xs"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {window.startA} &mdash; {window.endA}
                </div>
                <div
                  className="text-[10px] tracking-widest uppercase mt-0.5"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  PREDICTOR
                </div>
              </div>
            </div>

            {/* Center stats */}
            <div className="flex flex-col items-center gap-3 px-4 lg:px-8">
              <div
                className="flex items-center gap-2 text-[10px] tracking-widest"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                <span>
                  &larr; {window.lead}yr lag &rarr;
                </span>
              </div>

              {/* PPS gauge bar */}
              <div className="w-full max-w-xs">
                <div className="flex rounded-full h-4 overflow-hidden relative">
                  {[
                    { min: 0, max: 700, color: "#4a6280" },
                    { min: 700, max: 1000, color: "#7a90a8" },
                    { min: 1000, max: 1200, color: "#fbbf24" },
                    { min: 1200, max: 1400, color: "#fb923c" },
                    { min: 1400, max: 1600, color: "#f87171" },
                  ].map((q) => (
                    <div
                      key={q.min}
                      className="h-full"
                      style={{
                        width: `${((q.max - q.min) / 1600) * 100}%`,
                        backgroundColor: q.color,
                        opacity: 0.35,
                      }}
                    />
                  ))}
                  <div
                    className="absolute top-0 h-full w-1 rounded"
                    style={{
                      left: `${Math.min(100, (window.pps / 1600) * 100)}%`,
                      backgroundColor: "#fff",
                      transform: "translateX(-50%)",
                      boxShadow: "0 0 6px rgba(255,255,255,0.5)",
                    }}
                  />
                </div>
                <div
                  className="flex justify-between mt-1 text-[8px] tracking-wider"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  <span>0</span>
                  <span>800</span>
                  <span>1600</span>
                </div>
              </div>

              <div className="text-center">
                <div
                  className="font-data text-3xl font-bold"
                  style={{ color: ppsTier.color }}
                >
                  {window.pps}
                </div>
                <div
                  className="text-[9px] tracking-widest uppercase"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  PPS &mdash; {ppsTier.label}
                </div>
              </div>

              <div
                className="flex gap-4 text-[10px] font-data"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                <span>{window.length}yrs</span>
                <span>&middot;</span>
                <span>{window.indicators} indicators</span>
                <span>&middot;</span>
                <span>
                  avg r {window.correlation.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Country B */}
            <div className="flex items-center gap-4 lg:justify-end">
              <div className="text-right">
                <div
                  className="text-lg font-semibold"
                  style={{ color: "var(--qgi-country-b)" }}
                >
                  {countryB.name.toUpperCase()}
                </div>
                <div
                  className="font-data text-xs"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {window.startB} &mdash; {window.endB}
                </div>
                <div
                  className="text-[10px] tracking-widest uppercase mt-0.5"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  FOLLOWING
                </div>
              </div>
              <CountryFlag alpha2={countryB.alpha2} size={36} />
            </div>
          </div>
        </div>

        {/* Narrative strip */}
        <div
          className="px-6 lg:px-8 py-4 border-t"
          style={{
            borderColor: "var(--qgi-border)",
            backgroundColor: "rgba(0,0,0,0.15)",
          }}
        >
          <p
            className="text-xs leading-relaxed max-w-3xl"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            {countryA.name}&apos;s {window.startA}&ndash;{window.endA} economic
            trajectory mirrors {countryB.name}&apos;s {window.startB}&ndash;
            {window.endB} window across {window.indicators} indicators with an
            average correlation of {(window.correlation * 100).toFixed(0)}%.
            {window.lead > 0
              ? ` ${countryB.name}'s window starts ${window.lead} years after ${countryA.name}'s, providing a ${window.lead}-year forecasting horizon.`
              : " Both windows are concurrent (synchronous pattern)."}
          </p>
        </div>
      </section>

      {/* Placeholder content area */}
      <div
        className="rounded-xl p-8 text-center"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px dashed var(--qgi-border)",
        }}
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          INDICATOR CHARTS &amp; SCDI TABLE
        </div>
        <p
          className="text-xs"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Full pattern detail view with time-series charts and SCDI breakdown
          would render here. See the Pattern V2 example page for the detail
          layout.
        </p>
        <button
          className="mt-4 px-4 py-2 rounded text-xs tracking-wider transition-colors"
          style={{
            backgroundColor: "var(--qgi-accent-glow)",
            color: "var(--qgi-accent)",
            border: "1px solid var(--qgi-accent)",
          }}
          onClick={() => {
            /* prototype: no-op */
          }}
        >
          View full pattern &rarr;
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function PatternsBrowseV2Page() {
  const [state, setState] = useState<BrowseState>("S0");
  const [countryA, setCountryA] = useState<CountryOption | null>(null);
  const [countryB, setCountryB] = useState<CountryOption | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<WindowRow | null>(null);

  // -- State transitions --

  function handleSelectCountryA(c: CountryOption) {
    setCountryA(c);
    setCountryB(null);
    setSelectedWindow(null);
    setState("S1");
  }

  function handleSelectPartner(partner: CountryOption) {
    setCountryB(partner);
    setSelectedWindow(null);
    setState("S2");
  }

  function handleSelectWindow(w: WindowRow) {
    setSelectedWindow(w);
    setState("S3");
  }

  function handleSelectPairFromGlobal(a: CountryOption, b: CountryOption) {
    // For prototype: jump to S1 with Country A (simulating a quick path)
    setCountryA(a);
    setCountryB(null);
    setSelectedWindow(null);
    setState("S1");
  }

  function navigateToState(target: BrowseState) {
    if (target === "S0") {
      setCountryA(null);
      setCountryB(null);
      setSelectedWindow(null);
    } else if (target === "S1") {
      setCountryB(null);
      setSelectedWindow(null);
    } else if (target === "S2") {
      setSelectedWindow(null);
    }
    setState(target);
  }

  // -- Breadcrumb segments --

  const breadcrumbSegments: {
    label: string;
    alpha2?: string;
    state: BrowseState;
  }[] = [{ label: "All Pairs", state: "S0" }];

  if (countryA && (state === "S1" || state === "S2" || state === "S3")) {
    breadcrumbSegments.push({
      label: countryA.name,
      alpha2: countryA.alpha2,
      state: "S1",
    });
  }
  if (countryB && (state === "S2" || state === "S3")) {
    breadcrumbSegments.push({
      label: `${countryA!.name} - ${countryB.name}`,
      alpha2: countryB.alpha2,
      state: "S2",
    });
  }
  if (selectedWindow && state === "S3") {
    breadcrumbSegments.push({
      label: `${selectedWindow.startA}-${selectedWindow.endA}`,
      state: "S3",
    });
  }

  // -- Context line --

  let contextLine = "214 countries  \u00b7  2.01B patterns  \u00b7  23 ranked pairs";
  if (state === "S1" && countryA) {
    contextLine = `${countryA.name} has patterns with ${FRANCE_PARTNERS.length} countries`;
  } else if (state === "S2" && countryA && countryB) {
    const allLens = FR_NL_WINDOWS.map((w) => w.length);
    contextLine = `${countryA.name} + ${countryB.name}: ${FR_NL_WINDOWS.length} windows  \u00b7  lengths ${Math.min(...allLens)}-${Math.max(...allLens)} years`;
  } else if (state === "S3" && selectedWindow) {
    contextLine = `${selectedWindow.length} years  \u00b7  ${selectedWindow.indicators} indicators  \u00b7  PPS ${selectedWindow.pps}`;
  }

  return (
    <div
      className="min-h-screen p-6 lg:p-10"
      style={{ backgroundColor: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ---- Prototype badge ---- */}
        <div
          className="inline-block px-3 py-1 rounded text-[10px] tracking-widest uppercase"
          style={{
            backgroundColor: "rgba(251, 191, 36, 0.15)",
            color: "#fbbf24",
            border: "1px solid rgba(251, 191, 36, 0.3)",
          }}
        >
          UX PROTOTYPE -- NOT LIVE DATA
        </div>

        {/* ============================================================ */}
        {/*  CASCADE STRIP (horizontal, full width)                       */}
        {/* ============================================================ */}
        <div
          className="sticky top-0 z-30 rounded-lg border"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          {/* Row 1: Selectors + shortcut buttons */}
          <div className="flex items-end gap-4 px-4 py-3 flex-wrap">
            <CountryDropdown
              label="Predictor"
              value={countryA}
              options={COUNTRY_OPTIONS}
              onChange={handleSelectCountryA}
            />

            <span
              className="pb-2 text-sm"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              &rarr;
            </span>

            <CountryDropdown
              label="Following"
              value={countryB}
              options={
                countryA
                  ? FRANCE_PARTNERS.map((p) => p.country)
                  : []
              }
              onChange={handleSelectPartner}
              disabled={!countryA}
            />

            {/* Quick-demo buttons */}
            <div className="flex gap-2 pb-1 ml-auto">
              {state === "S0" && (
                <button
                  onClick={() => {
                    const france = COUNTRY_OPTIONS.find((c) => c.alpha2 === "FR")!;
                    handleSelectCountryA(france);
                  }}
                  className="px-3 py-1.5 rounded text-[10px] tracking-wider transition-colors"
                  style={{
                    backgroundColor: "var(--qgi-accent-glow)",
                    color: "var(--qgi-accent)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Try: France
                </button>
              )}
              {state === "S1" && (
                <button
                  onClick={() => {
                    const nl = FRANCE_PARTNERS.find(
                      (p) => p.country.alpha2 === "NL"
                    )!;
                    handleSelectPartner(nl.country);
                  }}
                  className="px-3 py-1.5 rounded text-[10px] tracking-wider transition-colors"
                  style={{
                    backgroundColor: "var(--qgi-accent-glow)",
                    color: "var(--qgi-accent)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Try: Netherlands
                </button>
              )}
              {state === "S2" && (
                <button
                  onClick={() => {
                    handleSelectWindow(FR_NL_WINDOWS[0]);
                  }}
                  className="px-3 py-1.5 rounded text-[10px] tracking-wider transition-colors"
                  style={{
                    backgroundColor: "var(--qgi-accent-glow)",
                    color: "var(--qgi-accent)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Try: Top window
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Breadcrumb + context counts */}
          <div
            className="flex items-center gap-2 px-4 py-1.5 border-t"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <Breadcrumb
              segments={breadcrumbSegments}
              onNavigate={navigateToState}
            />
            <span
              className="ml-auto text-[10px] font-data tracking-wider"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {contextLine}
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/*  MAIN AREA -- state-dependent content                        */}
        {/* ============================================================ */}
        {state === "S0" && (
          <StateS0 onSelectPair={handleSelectPairFromGlobal} />
        )}

        {state === "S1" && countryA && (
          <StateS1
            countryA={countryA}
            onSelectPartner={handleSelectPartner}
          />
        )}

        {state === "S2" && countryA && countryB && (
          <StateS2
            countryA={countryA}
            countryB={countryB}
            onSelectWindow={handleSelectWindow}
          />
        )}

        {state === "S3" && countryA && countryB && selectedWindow && (
          <StateS3
            countryA={countryA}
            countryB={countryB}
            window={selectedWindow}
          />
        )}
      </div>
    </div>
  );
}
