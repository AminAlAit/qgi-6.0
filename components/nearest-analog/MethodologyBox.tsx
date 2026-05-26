/**
 * MethodologyBox — side panel explaining shape-matching in plain terms.
 * Pairs the mechanic (SHAP-weighted cosine across the 4-indicator
 * trajectory, k=3 nearest neighbours, self-exclusion) with the caveats
 * (regional-clustering, similarity-not-destiny, vintage stamp).
 *
 * Server component.
 */
import {
  Telescope,
  Compass,
  Crosshair,
  History as HistoryIcon,
  ShieldAlert,
} from "lucide-react";
import { vintageStamp } from "@/lib/te-mock/recipes";

export function MethodologyBox() {
  return (
    <aside
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderRadius: "8px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--qgi-border)",
        }}
      >
        <Telescope size={18} strokeWidth={1.6} color="var(--qgi-accent)" />
        <div>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1.5px",
              color: "var(--qgi-accent)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "1px",
            }}
          >
            METHODOLOGY · CAPABILITY 12
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--qgi-text)" }}>
            How shape-matching works
          </div>
        </div>
      </header>

      {/* Mechanic */}
      <Row icon={Compass} title="The mechanic">
        For each recipe&apos;s selected indicators (typically 4), we compute the
        SHAP-weighted cosine similarity between the current country&apos;s recent
        quarterly trajectory and every historical positive&apos;s pre-event trajectory in
        the training corpus. The country is self-excluded — Iran-2025 cannot match
        Iran-2024.
      </Row>

      {/* Aggregation */}
      <Row icon={Crosshair} title="k=3 nearest neighbours">
        We surface the three closest historical analogs by aggregated cosine score across
        all recipes the country lights up on, weighted by per-recipe SHAP contribution.
        Match scores are scaled 0–100; a score of 85 means very tight rhyme, 70 is the
        floor below which we flag the analog as <em>weak</em>.
      </Row>

      {/* Vintage */}
      <Row icon={HistoryIcon} title="Vintage">
        Training corpus: curated verified-positive events catalogued through{" "}
        <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--qgi-text)" }}>
          {vintageStamp()}
        </span>
        . Each quarterly re-walk adds new positives and may shift analog rankings —
        vintage stamp on every result.
      </Row>

      {/* Caveat */}
      <div
        style={{
          padding: "12px",
          background: "rgba(230,69,69,0.06)",
          border: "1px solid rgba(230,69,69,0.4)",
          borderRadius: "6px",
          borderLeft: "3px solid #E64545",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "10px",
            letterSpacing: "1.2px",
            color: "#E64545",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "6px",
            fontWeight: 600,
          }}
        >
          <ShieldAlert size={12} strokeWidth={2} />
          ANTI-CAUSAL FIREWALL · M8-R5
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--qgi-text)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          A nearest-analog match is a <strong>shape similarity</strong>, never a forward
          prediction. &quot;Egypt today looks like Tunisia 2008&quot; means the indicator
          trajectories rhyme — it does <strong>NOT</strong> mean Egypt will follow
          Tunisia&apos;s outcome. The Trajectory Engine measures resemblance to past
          pre-crisis shapes; it does not forecast destiny. Regional clustering applies:
          LOCO validation is within-region-out-of-country, not true out-of-region, so
          cross-region analogs (e.g. Lebanon ↔ Argentina) inherit additional uncertainty.
        </p>
      </div>
    </aside>
  );
}

function Row({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Telescope;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: "10px" }}>
      <div style={{ flexShrink: 0, marginTop: "2px", color: "var(--qgi-text-muted)" }}>
        <Icon size={14} strokeWidth={1.6} />
      </div>
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--qgi-text)",
            marginBottom: "3px",
            letterSpacing: "0.2px",
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--qgi-text-muted)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {children}
        </p>
      </div>
    </div>
  );
}
