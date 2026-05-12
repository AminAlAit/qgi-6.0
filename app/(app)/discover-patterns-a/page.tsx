/**
 * DISCOVER PATTERNS — V2.1 Tabs (A-variant)
 *
 * Yuki Takahashi-Rowe (Product 1) design, per Sard Majles S-First (2026-05-01).
 * Four buyer-intent tabs: Firing Now / Top Confidence / By Region / Tier Shifts.
 *
 * Mock-fill session: 2026-05-12. Data from data/discover-patterns-mock.json.
 * NOT wired to the live pipeline — for design evaluation only.
 * See stub for Tomás hard-requirements (loading/empty/ARIA) to satisfy before ship.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { DiscoverPatternsTabs } from "./DiscoverPatternsTabs";
import patternsData from "@/data/discover-patterns-mock.json";

export const metadata: Metadata = {
  title: "Discover Patterns — QGI Intelligence",
  description:
    "Explore QGI's statistically-validated country-pair patterns. Four buyer-intent views: firing now, top confidence, by region, and recent tier shifts.",
  robots: { index: false, follow: false },
};

export default function DiscoverPatternsPage() {
  // Server component — passes mock data down. Real integration: replace with
  // an async fetch from /api/patterns/ranking + recipe-confidence.json.
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-full text-xs tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Loading pattern index…
        </div>
      }
    >
      <DiscoverPatternsTabs
        patterns={patternsData.patterns}
        generatedAt={patternsData.generated_at}
      />
    </Suspense>
  );
}
