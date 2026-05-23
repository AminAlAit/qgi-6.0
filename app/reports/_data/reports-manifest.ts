export type ReportStatus = "live" | "disabled" | "placeholder";

export type ReportCategory =
  | "Country Analysis"
  | "Sovereign Credit Note"
  | "Demo Report"
  | "Thematic";

export type Report = {
  slug: string;
  title: string;
  summary: string;
  category: ReportCategory;
  publishedAt: string;
  status: ReportStatus;
  ogImagePath?: string;
  href?: string;
};

export const REPORTS: Report[] = [
  {
    slug: "niger-burkina-divergence",
    title:
      "The Junta That Cannot Stay Isolated: Niger's Structural Divergence Inside the AES Bloc",
    summary:
      "QGI places Niger at #4 of 58 on its Multilateral Agreement recipe at 94/100. Its closest structural peer, Burkina Faso (95% cosine similarity), sits at #57 with 2/100. The two AES juntas are on opposite structural paths.",
    category: "Country Analysis",
    publishedAt: "2026-05-21",
    status: "live",
  },
  {
    slug: "india-pakistan-mirror",
    title:
      "India and Pakistan Are 99% the Same Risk, and Neither Risk Framework Wants to Hear It",
    summary:
      "QGI places India and Pakistan at 99% cosine similarity, each other's #1 structural peer in the 156-country cohort. Civil War & Insurgency recipe fires on both with the same fingerprint. The convergence is recent, not decades-embedded.",
    category: "Country Analysis",
    publishedAt: "2026-05-21",
    status: "live",
  },
  {
    slug: "ukraine-bosnia-mirror",
    title:
      "Ukraine's Structural Mirror: What Bosnia 1996 Tells the Credit Desk About UKRAIN 2027",
    summary:
      "QGI places Ukraine's closest structural twin at Bosnia and Herzegovina (81% cosine, 16-point gap above the next-closest cluster). A falsifiable structural-credit thesis: Multilateral Agreement crossing 70/100 is the entry trigger, 60/100 floor with no CI narrowing is the exit.",
    category: "Sovereign Credit Note",
    publishedAt: "2026-05-21",
    status: "live",
  },
  {
    slug: "ghana-mauritania-mirror",
    title:
      "Ghana's Double Signal: The Ballot Box, the Barracks, and the Country Nobody Expected",
    summary:
      "QGI places Ghana at the 99th percentile of global election-stress in its April 2026 scoring run. Its closest structural peer is Mauritania at 99% cosine similarity, not Mali, not Burkina Faso. What that structural resemblance means for the six-month forward call.",
    category: "Country Analysis",
    publishedAt: "2026-05-19",
    status: "live",
  },
  {
    slug: "fsi-qgi-report",
    title: "FSI x QGI: Fragile-State Pattern Overlay",
    summary:
      "How QGI's structural-analogue patterns align with Fund for Peace's Fragile States Index, where they diverge, and what the divergence flags for analysts.",
    category: "Demo Report",
    publishedAt: "2026-04-24",
    status: "live",
  },
  {
    slug: "burkina-faso-mali-car-mirror",
    title: "Burkina Faso's risk signature mirrors Mali 2010-2012 and CAR 2011-2013",
    summary:
      "Five risk domains light up together on Burkina Faso in our current bake. The same combination preceded the 2012 Mali coup and the 2013 Central African Republic collapse. What that structural resemblance means, and what it does not.",
    category: "Country Analysis",
    publishedAt: "2026-05-15",
    status: "disabled",
  },
];

// publishedAt is YYYY-MM-DD ISO date; lexicographic sort is correct iff this invariant holds.
export function getDisplayableReports(): Report[] {
  return REPORTS.filter((r) => r.status !== "placeholder").sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
}

export function getLatestForRail(): Report[] {
  return REPORTS.filter((r) => r.status === "live")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 2);
}

export function formatPublishedDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
