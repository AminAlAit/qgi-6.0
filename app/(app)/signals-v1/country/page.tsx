import { Suspense } from "react";
import type { Metadata } from "next";
import { CountrySignalProfileContent } from "@/components/signals-v1/CountrySignalProfileContent";

/**
 * #704 (2026-05-16) — orphan V1 sub-route metadata.
 *
 * V1 country-signal picker page. V3 dropped the picker entirely (per the
 * 2026-05-15 resurfacing plan); V3's `/signals/[country]` requires an
 * explicit country slug in the URL. Any crawl that reaches this V1
 * archive route attributes the content to the V3 /signals canonical.
 *
 * Sister to `patterns-v1/ranking/layout` (paired SEO follow-up).
 */
export const metadata: Metadata = {
  title: "Country Signal Profile — QGI Intelligence",
  description:
    "Legacy V1 country-signal picker. V3 supersedes via /signals/[country] direct URLs.",
  alternates: { canonical: "/signals" },
  robots: { index: false, follow: false },
};

export default function CountrySignalProfilePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-full text-xs tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Loading country profile...
        </div>
      }
    >
      <CountrySignalProfileContent />
    </Suspense>
  );
}
