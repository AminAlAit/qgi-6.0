import type { Metadata } from "next";

/**
 * #704 (2026-05-16) — orphan V1 sub-route metadata.
 *
 * `patterns-v1/ranking/page.tsx` is a "use client" component, so metadata
 * can't be exported from it directly. This Server Component layout owns
 * the metadata: noindex (V1 archive, per robots.ts Disallow) + canonical
 * pointing to the V3 patterns surface.
 *
 * Sister to `signals-v1/country/page.tsx` (paired SEO follow-up). Both
 * orphan sub-routes inherited the root layout's home canonical pre-#699
 * fix; #699 dropped the root canonical so they inherited nothing; this
 * PR gives them an explicit V3-pointing canonical to channel any
 * residual crawl to the canonical URL.
 */
export const metadata: Metadata = {
  title: "Pattern Power Ranking — QGI Intelligence",
  description:
    "Legacy V1 pattern ranking leaderboard. V3 supersedes via /patterns with sortable query params.",
  alternates: { canonical: "/patterns" },
  robots: { index: false, follow: false },
};

export default function PatternsV1RankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
