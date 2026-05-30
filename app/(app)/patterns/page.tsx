/**
 * /patterns — Pair-pattern catalogue.
 *
 * MOCK ELIMINATION — 2026-05-30
 * The pair-pattern catalogue was 100% seed data from
 * lib/te-mock/patterns-v4-main-data.ts (FULL_CATALOGUE + FAMILY_ACTIVE_ISOS).
 * The bake does not yet emit pair-detection results. Verdict: honest empty state.
 * Gap logged to C:\tmp\backend-gaps\patterns-trajectory.md
 *
 * The route remains alive so existing links / nav entries do not 404.
 */
import type { Metadata } from "next";
import { PageLayout } from "@/components/patterns-v4/PageLayout";

export const metadata: Metadata = {
  title: "Patterns · Country pair catalogue · QG Intelligence",
  description:
    "The QGI pair catalogue: country pairs whose indicator-composite histories ran in close parallel over a shared historical window, ranked by pair strength.",
};

export default function PatternsV4Page() {
  return (
    <PageLayout>
      {/* Page eyebrow */}
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "2px",
          color: "var(--qgi-accent)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        PATTERNS
      </div>

      <h1
        style={{
          fontSize: "clamp(24px, 4vw, 38px)",
          fontWeight: 800,
          margin: "0 0 14px",
          color: "var(--qgi-text)",
          lineHeight: 1.15,
        }}
      >
        Long-run rhymes between country pairs
      </h1>

      {/* Honest empty state */}
      <div
        style={{
          padding: "40px 24px",
          border: "1px dashed var(--qgi-border)",
          borderRadius: "6px",
          background: "rgba(91, 126, 153, 0.05)",
          textAlign: "center",
          maxWidth: "640px",
          margin: "40px auto",
        }}
      >
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "10px",
            color: "var(--qgi-text)",
          }}
        >
          Pair-pattern catalog under development
        </h2>
        <p
          style={{
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          The pair-pattern catalog is a research artifact under separate methodology
          development. It identifies country pairs whose indicator-composite histories ran
          in close parallel over shared multi-decade windows. Live results will appear
          here when the pair-detection engine lands in the trajectory engine bake.
        </p>
      </div>
    </PageLayout>
  );
}
