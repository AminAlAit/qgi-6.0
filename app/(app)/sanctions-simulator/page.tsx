/**
 * /sanctions-simulator — interactive scenario bench (vision prototype).
 *
 * Pick a country + a sanctions hardness tier + a horizon; the page perturbs the
 * country's current state by a tier-scaled impact profile and shows, live, how
 * its indicators bend and which event trends it drifts toward.
 *
 * This is a realized VISION of the surface specced in
 * `qgi-docs/internal/ops/sanctions-simulator-rnd-brief-2026-06-04.md`. The
 * impact model itself is still R&D, so every figure is ILLUSTRATIVE and labeled
 * as such (persistent "Illustrative scenario" badge + the disclosure below +
 * the "How to read" panel). Nothing here is a forecast: it is a resemblance
 * statement about a hypothetical input, run through the same Trajectory Engine
 * framing used across the site.
 *
 * Kept noindex while the model is illustrative.
 */
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { SanctionsSimulator } from "@/components/sanctions-sim/SanctionsSimulator";

export const metadata: Metadata = {
  title: "Sanctions Simulator · QG Intelligence",
  description:
    "A what-if scenario tool: pick a country and a sanctions hardness level, see how its indicators bend and which event trends it drifts toward over a five-year horizon. A scenario, not a forecast.",
  robots: { index: false, follow: false },
};

export default function SanctionsSimulatorPage() {
  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* Header */}
        <header style={{ marginBottom: 22 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "var(--qgi-accent)",
              fontSize: 10,
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              marginBottom: 12,
            }}
          >
            <ShieldAlert size={13} strokeWidth={2} />
            Sanctions Simulator
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <h1
              style={{
                fontSize: "clamp(26px, 4vw, 38px)",
                fontWeight: 700,
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              What would a sanction do?
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 11px",
                borderRadius: 999,
                border: "1px solid var(--qgi-accent)",
                background: "var(--qgi-accent-glow)",
                color: "var(--qgi-accent)",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "1px",
                textTransform: "uppercase",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Illustrative scenario
            </span>
          </div>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--qgi-text-muted)",
              maxWidth: 820,
              margin: 0,
            }}
          >
            Pick a country and a sanctions hardness, then watch how its indicators bend
            and which historical event trends it starts to resemble over a five-year
            horizon. The Trajectory Engine already maps a country&apos;s indicators to
            trend resemblances. This perturbs that input by a tier impact profile and
            re-runs the same scoring. It is a <strong>scenario, not a forecast</strong>.
          </p>
        </header>

        <SanctionsSimulator />

        <footer
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--qgi-border)",
            fontSize: 11,
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            lineHeight: 1.6,
            maxWidth: 880,
          }}
        >
          Indicator paths and trend resemblances shown here are illustrative: they apply
          historical sanction-period averages to the current trajectory, not a calibrated
          causal model. Figures are directional. The validated impact model is in
          development.
        </footer>
      </div>
    </div>
  );
}
