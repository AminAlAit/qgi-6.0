"use client";

/**
 * PatternDetailClient — per-pattern data dossier (Elif / Tufte style).
 *
 * Layout: one narrow stream, left-right gutter via max-w. No sidebar.
 * The content IS the page — no chrome wrappers, no colored section headers.
 *
 * Structure:
 *   1. Breadcrumb + pair identity header
 *   2. Signal summary strip (PPS · correlation · tier · RCI · architecture)
 *   3. Correlation sparkline at 100% width, annotated
 *   4. Mechanism narrative (from mock; real data in #648)
 *   5. Indicator coverage (SCDI count + mock top indicators)
 *   6. Chronology (A start → B start, lead time, last firing)
 *   7. Disclosure dossier (buyer-grade data: training concentration, caveat)
 *   8. Back nav
 */

import Link from "next/link";
import type { PatternFacet, Tier, RCI } from "../types";

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<Tier, string> = {
  STRONG: "#22c55e",
  MODERATE: "#fbbf24",
  MARGINAL: "#a3a3a3",
};

const RCI_COLORS: Record<RCI, string> = {
  GREEN: "#22c55e",
  YELLOW: "#fbbf24",
  RED: "#f87171",
  INSUFFICIENT: "#4a6280",
};

const RCI_PROSE: Record<RCI, string> = {
  GREEN: "High confidence — sufficient positive examples, stable calibration.",
  YELLOW: "Moderate confidence — small positive cohort, calibration acceptable.",
  RED: "Low confidence — fewer than 5 confirmed positives in LOCO holdout.",
  INSUFFICIENT:
    "Insufficient data — positive count below minimum threshold for any conclusion.",
};

const ARCH_PROSE: Record<string, string> = {
  D2: "D2 multi-task head: level-based features, shared backbone, per-recipe output head.",
  D5: "D5 trajectory head: rate-of-change features, shared backbone. Used when D5 LOCO ≥ D2 + 0.003.",
  "V1-statistical":
    "V1 statistical: Pearson correlation on raw indicator trajectories. No ML backbone.",
};

// MOCK top-indicator names keyed by recipe category
const MOCK_INDICATORS: Record<string, string[]> = {
  civil_war_and_insurgency: [
    "Battle-related deaths (VC.BTL.DETH)",
    "Political stability (PV.EST)",
    "Government expenditure share (NE.CON.GOVT.ZS)",
    "Energy import dependence (EG.IMP.CONS.ZS)",
    "Voice & accountability (VA.EST)",
  ],
  elections_and_voting: [
    "Electoral democracy index (v2x_polyarchy)",
    "Freedom of expression (v2x_freexp)",
    "Voter turnout (v2elvotlg)",
    "Opposition party participation (v2psoppaut)",
    "Clean elections (v2elecclean)",
  ],
  multilateral_agreement: [
    "Trade openness (NE.EXP.GNFS.ZS)",
    "Foreign direct investment (BX.KLT.DINV.WD.GD.ZS)",
    "Current account balance (BN.CAB.XOKA.GD.ZS)",
    "Import concentration (v2elreggov)",
    "Tariff rate (TM.TAX.MRCH.WM.AR.ZS)",
  ],
  bilateral_treaty: [
    "Trade in services (BX.GSR.NFSV.CD)",
    "Bilateral investment (BX.KLT.DREM.CD.DT)",
    "Rule of law (RL.EST)",
    "Regulatory quality (RQ.EST)",
    "GDP per capita growth (NY.GDP.PCAP.KD.ZG)",
  ],
  government_formation: [
    "Government stability (v2exstabns)",
    "Legislative effectiveness (v2lglegplo)",
    "Party institutionalization (v2psintnl)",
    "Political polarization (v2smpolsoc)",
    "Regime durability (e_p_polity)",
  ],
};

function mockIndicators(category: string): string[] {
  return (
    MOCK_INDICATORS[category] ?? [
      "Indicator A",
      "Indicator B",
      "Indicator C",
      "Indicator D",
      "Indicator E",
    ]
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PatternDetailClient({ pattern: p }: { pattern: PatternFacet }) {
  const tierColor = TIER_COLORS[p.tier];
  const rciColor = RCI_COLORS[p.rci];
  const corrPct = `${(p.avg_correlation * 100).toFixed(1)}%`;
  const indicators = mockIndicators(p.event_category);

  // PPS color
  function ppsColor(pps: number): string {
    if (pps >= 1500) return "#f87171";
    if (pps >= 1000) return "#fb923c";
    if (pps >= 600) return "#fbbf24";
    return "#7a90a8";
  }
  const ppsFill = ppsColor(p.pps);

  return (
    <div
      className="max-w-2xl mx-auto px-6 py-10 space-y-8"
      style={{ color: "var(--qgi-text)" }}
    >
      {/* 1. Breadcrumb */}
      <nav
        className="text-[10px] tracking-wider uppercase"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        <Link href="/discover-patterns-b" className="hover:underline">
          Discover Patterns
        </Link>
        <span className="mx-2">/</span>
        <span>{p.display_name}</span>
      </nav>

      {/* 2. Identity header */}
      <header>
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {p.event_label} · {p.l1_label}
        </div>
        <h1 className="text-2xl font-semibold leading-tight mb-3">
          {p.country_a} → {p.country_b}
        </h1>
        <div
          className="text-sm leading-relaxed"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {/* MOCK: mechanism prose pulled from ml-recipe-stack pattern;
              real integration reads mechanism_narrative from API in #648. */}
          {p.event_label} pattern. {p.country_a} preceded {p.country_b} by{" "}
          {p.lead_years > 0
            ? `${p.lead_years} year${p.lead_years !== 1 ? "s" : ""}`
            : "0 years (concurrent)"}
          , covering a {p.pattern_length}-year window over {p.num_indexes} shared
          indicator indexes. Average Pearson correlation {corrPct}. Last validated firing:{" "}
          {p.last_firing_year}.
        </div>
      </header>

      {/* Thin rule */}
      <hr style={{ borderColor: "var(--qgi-border)" }} />

      {/* 3. Signal summary strip */}
      <section>
        <SectionLabel>Signal summary</SectionLabel>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        >
          <Metric label="Pattern Power Score">
            <span className="font-data text-xl font-semibold" style={{ color: ppsFill }}>
              {p.pps.toLocaleString()}
            </span>
          </Metric>

          <Metric label="Avg correlation">
            <span className="font-data text-xl font-semibold">{corrPct}</span>
          </Metric>

          <Metric label="Pattern length">
            <span className="font-data text-xl font-semibold">{p.pattern_length} yr</span>
          </Metric>

          <Metric label="Lead time">
            <span className="font-data text-xl font-semibold">
              {p.lead_years > 0 ? `+${p.lead_years} yr` : "concurrent"}
            </span>
          </Metric>

          <Metric label="Signal tier">
            <span
              className="font-data text-sm font-semibold uppercase tracking-wide"
              style={{ color: tierColor }}
            >
              {p.tier}
            </span>
          </Metric>

          <Metric label="Recipe confidence">
            <span
              className="font-data text-sm font-semibold uppercase tracking-wide"
              style={{ color: rciColor }}
            >
              {p.rci}
            </span>
          </Metric>
        </div>
      </section>

      {/* 4. Sparkline — wide, annotated */}
      <section>
        <SectionLabel>Correlation trajectory</SectionLabel>
        <DetailSparkline points={p.sparkline} color={ppsFill} />
        <p className="text-[10px] mt-2" style={{ color: "var(--qgi-text-dim)" }}>
          7-point trajectory of avg Pearson r across the pattern window. Final value:{" "}
          {corrPct}. Shape indicates trajectory stability.
          {/* MOCK: in real data, x-axis would carry actual year labels. */}
        </p>
      </section>

      <hr style={{ borderColor: "var(--qgi-border)" }} />

      {/* 5. Indicator coverage */}
      <section>
        <SectionLabel>Indicator coverage — {p.num_indexes} indexes</SectionLabel>
        <p className="text-[11px] mb-3" style={{ color: "var(--qgi-text-muted)" }}>
          Preview: top-{indicators.length} indicators by mean importance for the{" "}
          <em>{p.event_label}</em> recipe. Real indicator fingerprint loads from the
          recipe stack in #648.
        </p>
        <ol className="space-y-1">
          {indicators.map((name, i) => (
            <li
              key={name}
              className="flex items-baseline gap-3 text-[12px]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              <span
                className="font-data text-[10px] w-4 shrink-0"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {i + 1}
              </span>
              <span>{name}</span>
            </li>
          ))}
        </ol>
      </section>

      <hr style={{ borderColor: "var(--qgi-border)" }} />

      {/* 6. Chronology */}
      <section>
        <SectionLabel>Chronology</SectionLabel>
        <dl
          className="grid gap-y-2 text-[12px]"
          style={{ gridTemplateColumns: "max-content 1fr" }}
        >
          <Dd label="Predictor start">{p.start_year_a}</Dd>
          <Dd label="Follower start">{p.start_year_b}</Dd>
          <Dd label="Lead time">
            {p.lead_years > 0 ? `+${p.lead_years} yr` : "concurrent"}
          </Dd>
          <Dd label="Pattern length">{p.pattern_length} yr</Dd>
          <Dd label="Last validation">{p.last_firing_year}</Dd>
          <Dd label="Instance count">{p.instance_count}</Dd>
          <Dd label="Region (A)">{p.region_a}</Dd>
          <Dd label="Region (B)">{p.region_b}</Dd>
        </dl>
      </section>

      <hr style={{ borderColor: "var(--qgi-border)" }} />

      {/* 7. Disclosure dossier */}
      <section>
        <SectionLabel>Disclosure dossier</SectionLabel>
        <div className="space-y-3 text-[12px]" style={{ color: "var(--qgi-text-muted)" }}>
          <DiscloseRow label="Architecture">
            {p.architecture}
            <span
              className="block text-[11px] mt-0.5"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {ARCH_PROSE[p.architecture] ?? ""}
            </span>
          </DiscloseRow>

          <DiscloseRow label="Recipe confidence">
            <span style={{ color: rciColor }}>{p.rci}</span>
            <span
              className="block text-[11px] mt-0.5"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {RCI_PROSE[p.rci]}
            </span>
          </DiscloseRow>

          <DiscloseRow label="Training concentration">
            {/* Preview: in real data, sourced from ml-recipe-stack honest-disclosures */}
            Preview — top training country share not loaded for V1-statistical recipes.
            For ML recipes, sourced from honest-disclosures in #648.
          </DiscloseRow>

          <DiscloseRow label="Buyer recommendation">
            {/* Preview: sourced from buyer-disclosure recommendation in ml-recipe-stack */}
            Preview — real recommendation from the ml recipe stack in #648.
          </DiscloseRow>
        </div>
      </section>

      <hr style={{ borderColor: "var(--qgi-border)" }} />

      {/* 8. Back nav */}
      <footer className="flex items-center gap-6 text-[11px]">
        <Link
          href="/discover-patterns-b"
          className="hover:underline"
          style={{ color: "var(--qgi-accent)" }}
        >
          ← Back to Facets grid
        </Link>
        <Link
          href="/patterns"
          className="hover:underline"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V1 Patterns
        </Link>
        <span
          className="ml-auto text-[9px] italic"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          MOCK · #648
        </span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail sparkline — wider, with end annotation
// ---------------------------------------------------------------------------

function DetailSparkline({ points, color }: { points: number[]; color: string }) {
  const W = 560;
  const H = 56;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(0.001, max - min);

  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map((v) => H - pad - ((v - min) / range) * (H - pad * 2));

  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");

  const areaPath = [
    `M ${xs[0]},${H - pad}`,
    ...xs.map((x, i) => `L ${x},${ys[i]}`),
    `L ${xs[xs.length - 1]},${H - pad}`,
    "Z",
  ].join(" ");

  const endX = xs[xs.length - 1];
  const endY = ys[ys.length - 1];
  const startY = ys[0];

  const maxY = ys.indexOf(Math.min(...ys)); // highest r value
  const annX = xs[maxY];
  const annY = ys[maxY];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Area */}
      <path d={areaPath} fill={`${color}15`} />

      {/* Baseline guide */}
      <line
        x1={pad}
        y1={H - pad}
        x2={W - pad}
        y2={H - pad}
        stroke="var(--qgi-border)"
        strokeWidth={1}
        strokeDasharray="2,4"
      />

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Start dot */}
      <circle
        cx={xs[0]}
        cy={startY}
        r={3}
        fill="var(--qgi-surface)"
        stroke={color}
        strokeWidth={1.5}
      />

      {/* Peak annotation */}
      <circle cx={annX} cy={annY} r={3} fill={color} />
      <text
        x={annX}
        y={annY - 6}
        fontSize={8}
        fill={color}
        textAnchor="middle"
        fontFamily="monospace"
      >
        {(Math.max(...points) * 100).toFixed(0)}%
      </text>

      {/* Terminal dot */}
      <circle cx={endX} cy={endY} r={3.5} fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Typography helpers — Tufte-style, no box chrome
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[9px] tracking-widest uppercase font-semibold mb-3"
      style={{ color: "var(--qgi-text-dim)" }}
    >
      {children}
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2 border-b" style={{ borderColor: "var(--qgi-border)" }}>
      <div
        className="text-[9px] tracking-widest uppercase mb-1"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Dd({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="pr-6 py-1 text-[11px]" style={{ color: "var(--qgi-text-dim)" }}>
        {label}
      </dt>
      <dd className="py-1 font-data text-[12px]" style={{ color: "var(--qgi-text)" }}>
        {children}
      </dd>
    </>
  );
}

function DiscloseRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 pl-3" style={{ borderColor: "var(--qgi-border)" }}>
      <span
        className="text-[9px] tracking-widest uppercase block mb-0.5"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </span>
      <div style={{ color: "var(--qgi-text-muted)" }}>{children}</div>
    </div>
  );
}
