"use client";

/**
 * WorldDotMap — compact dot-cartogram showing all countries colored by risk tier.
 *
 * Countries are grouped into 6 regional columns (SSA, MNA, EAP, SAS, LAC, ECA).
 * Each country renders as a small colored circle with a hover tooltip.
 * No heavy map dependencies — pure CSS/SVG, renders instantly.
 */

import { useMemo, useState } from "react";
import type { RiskTier } from "@/lib/country-risks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DotCountry {
  id: string;
  name: string;
  alpha_2: string;
  tier: RiskTier;
  region: string;
}

interface Props {
  countries: DotCountry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<RiskTier, string> = {
  HIGH: "#f87171",
  MODERATE: "#fbbf24",
  INDICATIVE: "#38bdf8",
};

const NO_DATA_COLOR = "#1a2a3a";

const REGION_ORDER = ["SSA", "MNA", "EAP", "SAS", "LAC", "ECA"] as const;

const REGION_LABELS: Record<string, string> = {
  SSA: "Sub-Saharan Africa",
  MNA: "Middle East & N. Africa",
  EAP: "East Asia & Pacific",
  SAS: "South Asia",
  LAC: "Latin America & Carib.",
  ECA: "Europe & Central Asia",
};

const REGION_SHORT: Record<string, string> = {
  SSA: "SSA",
  MNA: "MNA",
  EAP: "EAP",
  SAS: "SAS",
  LAC: "LAC",
  ECA: "ECA",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorldDotMap({ countries }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Group countries by region, sorted: HIGH first, then MODERATE, then INDICATIVE
  const regionGroups = useMemo(() => {
    const groups: Record<string, DotCountry[]> = {};
    for (const r of REGION_ORDER) groups[r] = [];

    for (const c of countries) {
      const region = c.region && groups[c.region] ? c.region : "ECA";
      groups[region].push(c);
    }

    // Sort within each region: HIGH -> MODERATE -> INDICATIVE, then alphabetically
    const tierOrder: Record<RiskTier, number> = { HIGH: 0, MODERATE: 1, INDICATIVE: 2 };
    for (const region of REGION_ORDER) {
      groups[region].sort((a, b) => {
        const td = tierOrder[a.tier] - tierOrder[b.tier];
        if (td !== 0) return td;
        return a.name.localeCompare(b.name);
      });
    }

    return groups;
  }, [countries]);

  // Tier legend counts
  const tierCounts = useMemo(() => {
    const counts: Record<RiskTier, number> = { HIGH: 0, MODERATE: 0, INDICATIVE: 0 };
    for (const c of countries) {
      counts[c.tier]++;
    }
    return counts;
  }, [countries]);

  const hoveredCountry = hoveredId
    ? countries.find((c) => c.id === hoveredId)
    : null;

  return (
    <div
      style={{
        backgroundColor: "var(--qgi-bg)",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--qgi-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
              color: "var(--qgi-text-dim)",
            }}
          >
            Global Risk Map
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--qgi-text-dim)",
            }}
          >
            {countries.length} countries
          </span>
        </div>

        {/* Tier legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(["HIGH", "MODERATE", "INDICATIVE"] as RiskTier[]).map((tier) => (
            <div
              key={tier}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: TIER_COLORS[tier],
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: "var(--qgi-text-dim)",
                  fontFamily: "var(--font-data)",
                }}
              >
                {tier === "INDICATIVE" ? "IND" : tier} {tierCounts[tier]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Dot grid body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 1,
          padding: "8px 12px 12px",
        }}
      >
        {REGION_ORDER.map((region) => {
          const group = regionGroups[region];
          return (
            <div key={region} style={{ display: "flex", flexDirection: "column" as const }}>
              {/* Region label */}
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  color: "var(--qgi-text-dim)",
                  textAlign: "center" as const,
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                {REGION_SHORT[region]}
                <span
                  style={{
                    fontSize: 8,
                    color: "var(--qgi-text-dim)",
                    fontWeight: 400,
                    marginLeft: 3,
                    opacity: 0.6,
                  }}
                >
                  {group.length}
                </span>
              </div>

              {/* Country dots */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap" as const,
                  justifyContent: "center" as const,
                  gap: 3,
                  minHeight: 20,
                }}
              >
                {group.map((c) => {
                  const isHovered = hoveredId === c.id;
                  return (
                    <span
                      key={c.id}
                      onMouseEnter={() => setHoveredId(c.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: "inline-block",
                        width: isHovered ? 10 : 8,
                        height: isHovered ? 10 : 8,
                        borderRadius: "50%",
                        backgroundColor: TIER_COLORS[c.tier] ?? NO_DATA_COLOR,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        opacity: isHovered ? 1 : 0.75,
                        boxShadow: isHovered
                          ? `0 0 6px ${TIER_COLORS[c.tier] ?? NO_DATA_COLOR}`
                          : "none",
                      }}
                      title={`${c.name} (${c.alpha_2}) — ${c.tier}`}
                    />
                  );
                })}
                {group.length === 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--qgi-text-dim)",
                      opacity: 0.4,
                    }}
                  >
                    --
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating tooltip */}
      {hoveredCountry && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: 4,
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 10,
            pointerEvents: "none" as const,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: TIER_COLORS[hoveredCountry.tier],
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "var(--qgi-text)",
              fontWeight: 500,
            }}
          >
            {hoveredCountry.name}
          </span>
          <span
            style={{
              fontSize: 9,
              color: "var(--qgi-text-dim)",
            }}
          >
            {hoveredCountry.alpha_2}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: TIER_COLORS[hoveredCountry.tier],
            }}
          >
            {hoveredCountry.tier}
          </span>
        </div>
      )}
    </div>
  );
}
