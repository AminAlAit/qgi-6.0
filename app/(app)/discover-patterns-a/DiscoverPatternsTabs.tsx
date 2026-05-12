"use client";
/**
 * DiscoverPatternsTabs — the interactive tabs shell for discover-patterns-a.
 *
 * Four tabs, each a distinct buyer mental model:
 *   1. Firing Now       — what's active / recent (default)
 *   2. Top Confidence   — sorted by LOCO AUC or corr tier
 *   3. By Region        — grouped spatially
 *   4. Tier Shifts      — recent HIGH/MODERATE/INDICATIVE transitions
 *
 * Tomás requirements (T-1 through T-4) are stubbed with labeled skeletons,
 * meaningful empty states, and ARIA roles. Keyboard nav: arrow keys cycle tabs.
 */
import { useState, useCallback } from "react";
import Link from "next/link";
import type { Route } from "next";
import { SECTOR_COLORS, TIER_COLORS, TIER_LABELS } from "@/lib/design";
import { CountryFlag } from "@/components/design/CountryFlag";
import type { PatternTier } from "@/lib/dashboard-cache";

// ---------------------------------------------------------------------------
// Types — mirror discover-patterns-mock.json shape
// ---------------------------------------------------------------------------
export interface MockPattern {
  slug: string;
  display_name: string;
  category: string;
  tier: string;
  pps: number;
  avg_correlation: number;
  canonical_length: number;
  lead_years: number;
  last_firing_year: number;
  predicted: boolean;
  top_countries: string[];
  top_country_codes: string[];
  interpretation_hint: string;
  region: string;
  loco_auc: number;
  tier_shift: string | null;
  tier_shift_date: string | null;
  country_a: string;
  country_b: string;
  country_a_code: string;
  country_b_code: string;
  start_year_a: number;
  start_year_b: number;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
type TabId = "firing-now" | "top-confidence" | "by-region" | "tier-shifts";

const TABS: { id: TabId; label: string; description: string }[] = [
  {
    id: "firing-now",
    label: "Firing Now",
    description: "Patterns with recent confirmed instances",
  },
  {
    id: "top-confidence",
    label: "Top Confidence",
    description: "Highest-conviction signals by ML validation score",
  },
  {
    id: "by-region",
    label: "By Region",
    description: "Patterns grouped by primary geography",
  },
  {
    id: "tier-shifts",
    label: "Tier Shifts",
    description: "Countries that recently moved risk tier",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function interpretationHintLabel(hint: string): { label: string; color: string } {
  switch (hint) {
    case "risk_elevation":
      return { label: "Risk elevation", color: "#f87171" };
    case "stabilisation":
      return { label: "Stabilisation signal", color: "#34d399" };
    case "volatility_flag":
      return { label: "Volatility flag", color: "#fbbf24" };
    default:
      return { label: "Monitor", color: "#7a90a8" };
  }
}

function corrTierLabel(r: number): { tier: string; color: string } {
  if (r >= 0.85) return { tier: "S", color: "#34d399" };
  if (r >= 0.7) return { tier: "A", color: "#38bdf8" };
  if (r >= 0.55) return { tier: "B", color: "#fbbf24" };
  return { tier: "C", color: "#7a90a8" };
}

function patternTierFromStr(tier: string): PatternTier {
  if (tier === "S" || tier === "M" || tier === "L" || tier === "XL") return tier;
  return "M";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function DiscoverPatternsTabs({
  patterns,
  generatedAt,
}: {
  patterns: MockPattern[];
  generatedAt: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("firing-now");

  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIdx: number) => {
    if (e.key === "ArrowRight") {
      const next = TABS[(currentIdx + 1) % TABS.length];
      setActiveTab(next.id);
    } else if (e.key === "ArrowLeft") {
      const prev = TABS[(currentIdx - 1 + TABS.length) % TABS.length];
      setActiveTab(prev.id);
    }
  }, []);

  // Tab-specific sort / grouping
  const firingNow = [...patterns].sort((a, b) => b.last_firing_year - a.last_firing_year);
  const topConfidence = [...patterns].sort((a, b) => b.loco_auc - a.loco_auc);
  const tierShifts = patterns
    .filter((p) => p.tier_shift !== null)
    .sort((a, b) => {
      const da = a.tier_shift_date ?? "";
      const db = b.tier_shift_date ?? "";
      return db.localeCompare(da);
    });

  // Group by region
  const regionMap = new Map<string, MockPattern[]>();
  for (const p of patterns) {
    const list = regionMap.get(p.region) ?? [];
    list.push(p);
    regionMap.set(p.region, list);
  }
  const regionGroups = Array.from(regionMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const activeTabDef = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col h-full">
      {/* ================================================================== */}
      {/* PAGE HEADER                                                          */}
      {/* ================================================================== */}
      <div className="px-6 pt-8 pb-0">
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V2 design evaluation · Sibling A — tabs
        </div>
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1
              className="text-2xl font-semibold mb-1"
              style={{ color: "var(--qgi-text)" }}
            >
              Discover Patterns
            </h1>
            <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
              {patterns.length} active pattern templates · {activeTabDef.description}
            </p>
          </div>
          <div
            className="flex items-center gap-3 text-[10px]"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            <span className="font-data">
              Updated{" "}
              {new Date(generatedAt).toLocaleDateString("en-GB", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <Link
              href={"/discover-patterns-b" as Route}
              className="underline hover:text-[var(--qgi-text)] transition-colors"
            >
              Compare B-variant (facets) →
            </Link>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB BAR — ARIA tablist                                          */}
        {/* ============================================================== */}
        <div
          role="tablist"
          aria-label="Pattern discovery views"
          className="flex gap-0 border-b"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          {TABS.map((tab, idx) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className="relative px-4 py-2.5 text-xs tracking-wide transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[var(--qgi-accent)]"
                style={{
                  color: isActive ? "var(--qgi-text)" : "var(--qgi-text-dim)",
                  fontWeight: isActive ? 600 : 400,
                  borderBottom: isActive
                    ? "2px solid var(--qgi-accent)"
                    : "2px solid transparent",
                  marginBottom: -1,
                  background: "transparent",
                }}
              >
                {tab.label}
                {tab.id === "tier-shifts" && tierShifts.length > 0 && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-data font-semibold"
                    style={{
                      backgroundColor: "#f87171",
                      color: "#fff",
                    }}
                  >
                    {tierShifts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================== */}
      {/* TAB PANELS                                                           */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* --- Firing Now --- */}
        <div
          role="tabpanel"
          id="tabpanel-firing-now"
          aria-labelledby="tab-firing-now"
          hidden={activeTab !== "firing-now"}
        >
          <PatternGrid patterns={firingNow} />
        </div>

        {/* --- Top Confidence --- */}
        <div
          role="tabpanel"
          id="tabpanel-top-confidence"
          aria-labelledby="tab-top-confidence"
          hidden={activeTab !== "top-confidence"}
        >
          <PatternGrid patterns={topConfidence} showConfidenceBar />
        </div>

        {/* --- By Region --- */}
        <div
          role="tabpanel"
          id="tabpanel-by-region"
          aria-labelledby="tab-by-region"
          hidden={activeTab !== "by-region"}
        >
          {regionGroups.map(([region, regionPatterns]) => (
            <div key={region} className="mb-8">
              <h2
                className="text-[10px] tracking-widest uppercase mb-3 pb-1.5 border-b"
                style={{
                  color: "var(--qgi-text-dim)",
                  borderColor: "var(--qgi-border)",
                }}
              >
                {region}
                <span className="ml-2 font-data" style={{ color: "var(--qgi-text-dim)" }}>
                  ({regionPatterns.length})
                </span>
              </h2>
              <PatternGrid patterns={regionPatterns} />
            </div>
          ))}
        </div>

        {/* --- Tier Shifts --- */}
        <div
          role="tabpanel"
          id="tabpanel-tier-shifts"
          aria-labelledby="tab-tier-shifts"
          hidden={activeTab !== "tier-shifts"}
        >
          {tierShifts.length === 0 ? (
            <EmptyState
              message="No tier shifts in the last 90 days."
              hint="Widen the date window or check back after the next pipeline run."
            />
          ) : (
            <PatternGrid patterns={tierShifts} showTierShift />
          )}
        </div>
      </div>

      {/* Footer note */}
      <div
        className="px-6 pb-4 text-[10px] border-t pt-3"
        style={{
          color: "var(--qgi-text-dim)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {/* MOCK: banner stays until real pipeline data wired in (#648) */}
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide mr-3"
          style={{
            backgroundColor: "#fbbf2420",
            color: "#fbbf24",
            border: "1px solid #fbbf2440",
          }}
        >
          PREVIEW DATA
        </span>
        Design evaluation only. Pattern data from{" "}
        <span className="font-data">data/discover-patterns-mock.json</span>. Live
        integration: ticket{" "}
        <Link
          href="/patterns"
          className="underline"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          /patterns
        </Link>{" "}
        and{" "}
        <Link
          href="/patterns/ranking"
          className="underline"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          /patterns/ranking
        </Link>{" "}
        remain the production surfaces.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PatternGrid — 3-col responsive grid of PatternCard
// ---------------------------------------------------------------------------
function PatternGrid({
  patterns,
  showConfidenceBar = false,
  showTierShift = false,
}: {
  patterns: MockPattern[];
  showConfidenceBar?: boolean;
  showTierShift?: boolean;
}) {
  if (patterns.length === 0) {
    return (
      <EmptyState
        message="No patterns match the current view."
        hint="Try a different tab or check back after the next pipeline run."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {patterns.map((p) => (
        <PatternCard
          key={p.slug}
          pattern={p}
          showConfidenceBar={showConfidenceBar}
          showTierShift={showTierShift}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PatternCard — the core card component
// ---------------------------------------------------------------------------
function PatternCard({
  pattern: p,
  showConfidenceBar,
  showTierShift,
}: {
  pattern: MockPattern;
  showConfidenceBar: boolean;
  showTierShift: boolean;
}) {
  const catColor = SECTOR_COLORS[p.category] ?? SECTOR_COLORS.Other;
  const tierColor = TIER_COLORS[patternTierFromStr(p.tier)];
  const hint = interpretationHintLabel(p.interpretation_hint);
  const corr = corrTierLabel(p.avg_correlation);
  const href = `/discover-patterns-a/${p.slug}` as Route;

  return (
    <Link
      href={href}
      className="block rounded-lg p-4 transition-colors"
      style={{
        backgroundColor: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
      }}
    >
      {/* ---- Top row: category + tier + prediction badge ---- */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center rounded font-data font-semibold tracking-wider px-1.5 py-0.5 text-[10px]"
          style={{
            color: catColor,
            backgroundColor: `${catColor}18`,
            border: `1px solid ${catColor}40`,
          }}
        >
          {p.category}
        </span>
        <span
          className="inline-flex items-center rounded font-data tracking-wider px-1.5 py-0.5 text-[10px]"
          style={{
            color: tierColor,
            backgroundColor: `${tierColor}18`,
            border: `1px solid ${tierColor}40`,
          }}
          title={TIER_LABELS[patternTierFromStr(p.tier)]}
        >
          {p.tier}
        </span>
        {p.predicted && (
          <span
            className="ml-auto inline-flex items-center gap-0.5 text-[9px] font-data font-semibold tracking-wider uppercase"
            style={{ color: "var(--qgi-amber)" }}
            title="Pattern is currently firing a predictive signal"
          >
            &#9650; live
          </span>
        )}
      </div>

      {/* ---- Pattern name ---- */}
      <h3
        className="text-[13px] font-semibold leading-snug mb-2"
        style={{ color: "var(--qgi-text)" }}
      >
        {p.display_name}
      </h3>

      {/* ---- Top firing countries ---- */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {p.top_country_codes.slice(0, 3).map((code, i) => (
          <span
            key={code}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            <CountryFlag alpha2={code} size={11} />
            <span className="font-data">{p.top_countries[i]}</span>
          </span>
        ))}
      </div>

      {/* ---- Confidence bar (Top Confidence tab) ---- */}
      {showConfidenceBar && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[9px] tracking-wider uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Out-of-country
            </span>
            <span
              className="font-data text-[11px] font-semibold"
              style={{ color: "var(--qgi-text)" }}
            >
              {p.loco_auc.toFixed(3)}
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--qgi-surface-2)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, p.loco_auc * 100)}%`,
                backgroundColor:
                  p.loco_auc >= 0.8
                    ? "#34d399"
                    : p.loco_auc >= 0.7
                      ? "#fbbf24"
                      : "#7a90a8",
              }}
            />
          </div>
        </div>
      )}

      {/* ---- Tier shift badge (Tier Shifts tab) ---- */}
      {showTierShift && p.tier_shift && (
        <div
          className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded text-[10px] font-data"
          style={{
            backgroundColor: "#f8717118",
            border: "1px solid #f8717140",
            color: "#f87171",
          }}
        >
          <span className="font-semibold">Tier shift:</span>
          <span>{p.tier_shift}</span>
          {p.tier_shift_date && (
            <span className="ml-auto" style={{ color: "var(--qgi-text-dim)" }}>
              {p.tier_shift_date}
            </span>
          )}
        </div>
      )}

      {/* ---- Bottom row: canonical length + lead time + interpretation ---- */}
      <div
        className="flex items-center justify-between gap-2 pt-2.5 border-t"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <div
          className="flex items-center gap-2 text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <span className="font-data">{p.canonical_length} yr</span>
          {p.lead_years > 0 && (
            <>
              <span>&middot;</span>
              <span
                className="font-data font-semibold"
                style={{ color: "var(--qgi-amber)" }}
              >
                +{p.lead_years}yr lead
              </span>
            </>
          )}
          <span>&middot;</span>
          <span
            className="inline-flex items-center px-1.5 py-0 rounded-full font-data font-semibold text-[9px]"
            style={{
              color: corr.color,
              backgroundColor: `${corr.color}18`,
              border: `1px solid ${corr.color}40`,
            }}
          >
            {corr.tier}
          </span>
        </div>
        <span className="text-[10px] font-data" style={{ color: hint.color }}>
          {hint.label}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-lg border gap-3"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <p
        className="text-xs tracking-wider uppercase font-semibold"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {message}
      </p>
      <p
        className="text-[11px] max-w-xs text-center"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {hint}
      </p>
    </div>
  );
}
