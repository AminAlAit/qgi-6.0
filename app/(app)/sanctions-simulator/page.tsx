/**
 * /sanctions-simulator — Phase-0 "Coming soon" teaser (2026-06-04).
 *
 * A blurred decorative data-viz backdrop (faux sparklines, bar columns, scatter
 * dots in the QGI family-color palette, pure CSS/inline-SVG — zero new deps)
 * with a centered card over it, mirroring the Compare "coming soon" treatment.
 *
 * The surface is height-constrained to 100% / overflow:hidden so the overlay
 * is always on screen and neither the background nor the card is reachable by
 * scroll — same contract as /compare.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sanctions Simulator · QG Intelligence",
  description:
    "A what-if scenario tool: pick a country and a sanctions hardness level, see how its indicators bend and which trends it would start to resemble ~5 years out.",
  robots: { index: false, follow: false },
};

// QGI family-color palette — same literals as compare/page.tsx so the blurred
// backdrop reads as part of the same visual language.
const BLUE = "#3FA9F5";
const RED = "#E64545";
const AMBER = "#E68F29";
const GREEN = "#3FBF8F";
const PURPLE = "#7B5EE6";
const SLATE = "#5B7E99";

// Faux sparkline path data — hand-crafted SVG polyline points.
// These represent plausible "indicator movement before/after sanction" shapes:
// sharp drop, slow grind down, V-recovery, flat-then-cliff. All purely decorative.
const SPARKLINES: { pts: string; color: string }[] = [
  {
    pts: "0,38 10,36 20,34 30,32 40,30 50,28 56,20 60,18 70,22 80,24 90,26 100,28",
    color: BLUE,
  },
  {
    pts: "0,20 10,22 20,24 30,22 40,30 50,38 56,46 60,50 70,52 80,54 90,56 100,58",
    color: RED,
  },
  {
    pts: "0,30 10,29 20,28 30,28 40,27 50,26 56,16 60,12 70,14 80,18 90,22 100,26",
    color: AMBER,
  },
  {
    pts: "0,50 10,48 20,46 30,44 40,44 50,44 56,36 60,32 70,35 80,38 90,42 100,46",
    color: GREEN,
  },
  {
    pts: "0,25 10,26 20,27 30,26 40,28 50,30 56,42 60,48 70,46 80,44 90,42 100,40",
    color: PURPLE,
  },
];

// Faux bar chart columns — hardness tiers 1-5, per-indicator delta heights.
const BAR_GROUPS: { tier: number; bars: { h: number; color: string }[] }[] = [
  {
    tier: 1,
    bars: [
      { h: 20, color: BLUE },
      { h: 12, color: GREEN },
      { h: 8, color: SLATE },
    ],
  },
  {
    tier: 2,
    bars: [
      { h: 32, color: BLUE },
      { h: 24, color: RED },
      { h: 14, color: AMBER },
    ],
  },
  {
    tier: 3,
    bars: [
      { h: 48, color: RED },
      { h: 36, color: AMBER },
      { h: 22, color: PURPLE },
    ],
  },
  {
    tier: 4,
    bars: [
      { h: 62, color: RED },
      { h: 50, color: PURPLE },
      { h: 38, color: AMBER },
    ],
  },
  {
    tier: 5,
    bars: [
      { h: 74, color: RED },
      { h: 64, color: PURPLE },
      { h: 56, color: BLUE },
    ],
  },
];

// Faux scatter dots — "before vs after" scatter plot of indicator Δ vs GDP.
// Each dot is { x, y } in 0-100 space, colorized by regime cluster.
const SCATTER: { x: number; y: number; r: number; color: string }[] = [
  { x: 12, y: 72, r: 4, color: RED },
  { x: 20, y: 58, r: 3, color: RED },
  { x: 28, y: 64, r: 5, color: AMBER },
  { x: 35, y: 42, r: 3, color: AMBER },
  { x: 44, y: 35, r: 4, color: PURPLE },
  { x: 52, y: 28, r: 3, color: BLUE },
  { x: 58, y: 22, r: 5, color: BLUE },
  { x: 65, y: 18, r: 3, color: GREEN },
  { x: 72, y: 14, r: 4, color: GREEN },
  { x: 80, y: 10, r: 3, color: SLATE },
  { x: 88, y: 8, r: 4, color: SLATE },
  // Second cluster — higher-income, smaller Δ
  { x: 15, y: 30, r: 3, color: BLUE },
  { x: 25, y: 24, r: 4, color: PURPLE },
  { x: 38, y: 18, r: 3, color: AMBER },
  { x: 50, y: 15, r: 5, color: RED },
  { x: 62, y: 10, r: 3, color: GREEN },
  { x: 75, y: 8, r: 4, color: BLUE },
];

export default function SanctionsSimulatorPage() {
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        background: "var(--qgi-bg)",
        color: "var(--qgi-text)",
      }}
    >
      {/* ── Blurred decorative data-viz backdrop ──────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          filter: "blur(8px) saturate(1.1)",
          pointerEvents: "none",
          userSelect: "none",
          height: "100%",
          padding: "32px 48px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          opacity: 0.7,
        }}
      >
        {/* §1 — Header band: hardness-tier label strip + compound delta stat */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "20px",
            alignItems: "center",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderLeft: `3px solid ${RED}`,
            borderRadius: "10px",
            padding: "22px 32px",
            minHeight: "80px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                fontSize: "9.5px",
                letterSpacing: "2.5px",
                textTransform: "uppercase",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Sanctions impact model · scenario · not a forecast
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--qgi-text)",
                letterSpacing: "0.5px",
              }}
            >
              Iran · Tier 4 · Comprehensive sanctions
            </div>
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { label: "Trend shift", val: "+7", color: RED },
              { label: "Δ indicators", val: "43 / 109", color: AMBER },
              { label: "Resemblance Δ", val: "×2.4", color: PURPLE },
            ].map(({ label, val, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    color,
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}
                >
                  {val}
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "var(--qgi-text-dim)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* §2 — Main two-column: sparklines (left) + bar chart (right) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
            gap: "20px",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* §2a — Sparkline panel: indicator trajectories before/after */}
          <div
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "10px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div
                style={{
                  fontSize: "9.5px",
                  letterSpacing: "2.5px",
                  textTransform: "uppercase",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                §01 · Indicator trajectories · t−5y to t+5y from sanction onset
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                }}
              >
                Simulated indicator movement (Tier 4 Δ applied)
              </div>
            </div>

            {/* SVG sparklines stack */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}
            >
              {SPARKLINES.map(({ pts, color }, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "1px",
                      color: "var(--qgi-text-dim)",
                      fontFamily: "ui-monospace, monospace",
                      width: "110px",
                      flexShrink: 0,
                      textTransform: "uppercase",
                    }}
                  >
                    {
                      [
                        "Trade Openness",
                        "Political Stability",
                        "Regulatory Quality",
                        "Gov Effectiveness",
                        "Military Exp / GDP",
                      ][i]
                    }
                  </div>
                  <svg
                    viewBox="0 0 100 60"
                    preserveAspectRatio="none"
                    style={{ flex: 1, height: "32px", overflow: "visible" }}
                  >
                    {/* Baseline grid lines */}
                    {[15, 30, 45].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="100"
                        y2={y}
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth="0.5"
                      />
                    ))}
                    {/* Sanction-onset marker */}
                    <line
                      x1="56"
                      y1="0"
                      x2="56"
                      y2="60"
                      stroke={color}
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                      opacity="0.5"
                    />
                    {/* The sparkline itself */}
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                    {/* Endpoint dot */}
                    {(() => {
                      const last = pts.split(" ").at(-1)!.split(",");
                      return (
                        <circle
                          cx={last[0]}
                          cy={last[1]}
                          r="2"
                          fill={color}
                          opacity="0.9"
                        />
                      );
                    })()}
                  </svg>
                  {/* Delta badge */}
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      color,
                      width: "36px",
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {["−8.2", "+14.1", "−12.6", "−9.8", "+7.3"][i]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* §2b — Bar chart: per-hardness-tier impact profile */}
          <div
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "10px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div
                style={{
                  fontSize: "9.5px",
                  letterSpacing: "2.5px",
                  textTransform: "uppercase",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                §02 · Hardness-tier impact profile
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                }}
              >
                Avg indicator Δ by tier
              </div>
            </div>

            {/* Grouped bar chart — one cluster per tier */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "14px",
                flex: 1,
                justifyContent: "space-between",
              }}
            >
              {BAR_GROUPS.map(({ tier, bars }) => (
                <div
                  key={tier}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "5px",
                    flex: 1,
                  }}
                >
                  {/* Bar columns */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: "3px",
                      height: "80px",
                    }}
                  >
                    {bars.map(({ h, color }, bi) => (
                      <div
                        key={bi}
                        style={{
                          width: "10px",
                          height: `${h}px`,
                          background: color,
                          opacity: 0.75,
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                    ))}
                  </div>
                  {/* Tier label */}
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "1px",
                      color: "var(--qgi-text-dim)",
                      fontFamily: "ui-monospace, monospace",
                      textTransform: "uppercase",
                    }}
                  >
                    T{tier}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* §3 — Bottom strip: scatter plot + trend-shift table */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
            gap: "20px",
          }}
        >
          {/* §3a — Scatter: Δ-GDP vs political-stability delta */}
          <div
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "10px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "9.5px",
                letterSpacing: "2.5px",
                textTransform: "uppercase",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              §03 · Episode scatter · GDP Δ vs pol. stability Δ · n=38
            </div>
            <svg viewBox="0 0 100 60" style={{ width: "100%", height: "80px" }}>
              {/* Axis lines */}
              <line
                x1="0"
                y1="60"
                x2="100"
                y2="60"
                stroke="var(--qgi-border)"
                strokeWidth="0.5"
              />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="60"
                stroke="var(--qgi-border)"
                strokeWidth="0.5"
              />
              {/* Grid */}
              {[20, 40].map((v) => (
                <g key={v}>
                  <line
                    x1="0"
                    y1={v}
                    x2="100"
                    y2={v}
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="0.4"
                  />
                  <line
                    x1={v}
                    y1="0"
                    x2={v}
                    y2="60"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="0.4"
                  />
                  <line
                    x1={v + 40}
                    y1="0"
                    x2={v + 40}
                    y2="60"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="0.4"
                  />
                </g>
              ))}
              {/* Scatter dots */}
              {SCATTER.map(({ x, y, r, color }, i) => (
                <circle key={i} cx={x} cy={y} r={r} fill={color} opacity="0.65" />
              ))}
            </svg>
          </div>

          {/* §3b — Trend-shift table: before/after top-5 resemblances */}
          <div
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "10px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "9.5px",
                letterSpacing: "2.5px",
                textTransform: "uppercase",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              §04 · Trend-resemblance shift · now → simulated
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {[
                { trend: "Sanctions & Arms Embargo", now: 68, sim: 94, color: RED },
                { trend: "Economic Stress", now: 42, sim: 78, color: AMBER },
                { trend: "Foreign Intervention", now: 55, sim: 71, color: PURPLE },
                { trend: "Trade Dispute", now: 38, sim: 62, color: BLUE },
                { trend: "Mass Protest", now: 30, sim: 54, color: GREEN },
              ].map(({ trend, now, sim, color }) => (
                <div
                  key={trend}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 36px 8px 36px",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--qgi-text-muted)",
                      fontFamily: "ui-monospace, monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {trend}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: "ui-monospace, monospace",
                      color: "var(--qgi-text-dim)",
                      textAlign: "right",
                    }}
                  >
                    {now}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--qgi-text-dim)",
                      textAlign: "center",
                    }}
                  >
                    →
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      color,
                      textAlign: "right",
                    }}
                  >
                    {sim}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Coming-soon overlay ────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "rgba(11, 18, 27, 0.55)",
        }}
      >
        <section
          data-tour="sanctions-coming-soon"
          aria-labelledby="sanctions-lockdown-heading"
          style={{
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderLeft: "3px solid var(--qgi-accent)",
            borderRadius: "8px",
            padding: "30px 34px",
            maxWidth: "560px",
            width: "100%",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "3.5px",
              textTransform: "uppercase",
              color: "var(--qgi-accent)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "12px",
            }}
          >
            Coming soon
          </div>
          <h1
            id="sanctions-lockdown-heading"
            style={{
              fontSize: "23px",
              fontWeight: 600,
              lineHeight: 1.25,
              margin: "0 0 14px",
              color: "var(--qgi-text)",
            }}
          >
            Sanctions Simulator
          </h1>
          <p
            style={{
              fontSize: "13.5px",
              lineHeight: 1.65,
              color: "var(--qgi-text-muted)",
              margin: "0 0 10px",
            }}
          >
            A what-if scenario tool. Pick a country and a sanctions hardness level
            (targeted, sectoral, or comprehensive) and see how its indicators would bend
            and which trends it would start to resemble roughly five years out. A
            scenario, not a forecast.
          </p>
          <p
            style={{
              fontSize: "13.5px",
              lineHeight: 1.65,
              color: "var(--qgi-text-muted)",
              margin: "0 0 10px",
            }}
          >
            The mechanism: the Trajectory Engine already maps a country&apos;s indicator
            vector to trend resemblances. The simulator perturbs the inputs by applying a
            per-tier impact profile learned from how historically sanctioned
            countries&apos; indicators moved in the five years following sanctions onset,
            then re-runs the same scoring to show the shift.
          </p>
          <p
            style={{
              fontSize: "12.5px",
              lineHeight: 1.55,
              color: "var(--qgi-text-dim)",
              margin: 0,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.3px",
            }}
          >
            Impact model in R&D. Shipping when the backtest holds.
          </p>
        </section>
      </div>
    </div>
  );
}
