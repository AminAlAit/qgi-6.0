import { loadCountryRisks, type CategoryScore } from "@/lib/country-risks";
import { SignalsBrowseClient } from "@/components/signals-v1/SignalsBrowseClient";
import { CATEGORY_L1_MAP, L1_GROUPS, type L1Group } from "@/lib/category-taxonomy";
import { COUNTRY_REGIONS, type Region } from "@/lib/regions";

// T19 #312: adds openGraph + twitter so signals page is shareable.
export const metadata = {
  title: "Signals · QGI Intelligence",
  description:
    "Early-warning radar — browse active risk signals by domain, severity, and geography.",
  // #699: canonical points to V3 counterpart; explicit noindex (defense in
  // depth atop robots.ts Disallow).
  alternates: { canonical: "/signals" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Signals · QGI Intelligence",
    description:
      "Early-warning radar — browse active risk signals by domain, severity, and geography.",
    url: "https://qgintelligence.com/signals-v1",
    siteName: "QGI Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Signals · QGI Intelligence",
    description:
      "Early-warning radar — browse active risk signals by domain, severity, and geography.",
  },
};

/** Salience tier thresholds (per-signal maxSalience). */
function getSalienceTier(maxSalience: number): "CRITICAL" | "ELEVATED" | "BASELINE" {
  if (maxSalience >= 2.5) return "CRITICAL";
  if (maxSalience >= 1.0) return "ELEVATED";
  return "BASELINE";
}

/**
 * Aggregate country-risks data by category to create enriched Signal profiles
 * with L1 domain mapping, tier classification, and regional distribution.
 */
async function buildSignals() {
  const data = await loadCountryRisks();
  const signalMap: Record<
    string,
    {
      category: string;
      countries: Array<{
        id: string;
        name: string;
        alpha_2: string;
        salience: number;
        recipes: number;
        curated: boolean;
        region: Region | "Unknown";
      }>;
      totalRecipes: number;
      avgSalience: number;
      maxSalience: number;
      l1Domain: { code: string; label: string; shortLabel: string; color: string } | null;
      tier: "CRITICAL" | "ELEVATED" | "BASELINE";
      regionalDistribution: Record<string, number>;
    }
  > = {};

  for (const [id, country] of Object.entries(data.countries)) {
    // T7 #300 HIGH fix (Elena s2, 2026-04-19): previously read ONLY
    // S-tier (3-8yr pattern length) categories. This excluded every M/L/XL
    // signal from the signals discovery surface — a professional risk
    // analyst looking for 10-year or 25-year structural trajectories saw
    // nothing. Now merge all tier categories, keeping the highest salience
    // entry per (country, category) tuple.
    const perCategoryBest = new Map<string, CategoryScore>();
    for (const tierBlock of Object.values(country.tiers ?? {})) {
      for (const c of tierBlock.top_categories ?? []) {
        const sal = c.salience_score ?? c.z_score ?? 0;
        const existing = perCategoryBest.get(c.category);
        const existingSal = existing
          ? (existing.salience_score ?? existing.z_score ?? 0)
          : -Infinity;
        if (sal > existingSal) perCategoryBest.set(c.category, c);
      }
    }
    const cats = Array.from(perCategoryBest.values());
    for (const cat of cats) {
      // T7 #300 MEDIUM fix: default to 0 when both salience_score and
      // z_score are missing. Previously produced NaN downstream via
      // `.toFixed(1)` on undefined.
      const salience = cat.salience_score ?? cat.z_score ?? 0;
      const region = COUNTRY_REGIONS[country.alpha_2?.toUpperCase()] ?? "Unknown";

      if (!signalMap[cat.category]) {
        // Look up L1 domain
        const l1Mapping = CATEGORY_L1_MAP[cat.category];
        const l1Group = l1Mapping
          ? L1_GROUPS.find((g: L1Group) => g.code === l1Mapping.group)
          : undefined;

        signalMap[cat.category] = {
          category: cat.category,
          countries: [],
          totalRecipes: 0,
          avgSalience: 0,
          maxSalience: 0,
          l1Domain: l1Group
            ? {
                code: l1Group.code,
                label: l1Group.label,
                shortLabel: l1Group.shortLabel,
                color: l1Group.color,
              }
            : null,
          tier: "BASELINE",
          regionalDistribution: {},
        };
      }

      signalMap[cat.category].countries.push({
        id,
        name: country.name,
        alpha_2: country.alpha_2,
        salience,
        recipes: cat.recipe_count,
        curated: country.curated,
        region,
      });
      signalMap[cat.category].totalRecipes += cat.recipe_count;

      // Track regional distribution
      const regionKey = region as string;
      signalMap[cat.category].regionalDistribution[regionKey] =
        (signalMap[cat.category].regionalDistribution[regionKey] ?? 0) + 1;
    }
  }

  // Compute averages, tiers, and sort countries within each signal
  const signals = Object.values(signalMap).map((s) => {
    s.countries.sort((a, b) => b.salience - a.salience);
    s.avgSalience =
      s.countries.length > 0
        ? s.countries.reduce((sum, c) => sum + c.salience, 0) / s.countries.length
        : 0;
    s.maxSalience = s.countries[0]?.salience ?? 0;
    s.tier = getSalienceTier(s.maxSalience);
    return s;
  });

  // Sort signals by max salience descending
  signals.sort((a, b) => b.maxSalience - a.maxSalience);

  // Compute aggregate metadata
  const totalCountries = new Set(signals.flatMap((s) => s.countries.map((c) => c.id)))
    .size;

  const tierCounts = { CRITICAL: 0, ELEVATED: 0, BASELINE: 0 };
  for (const s of signals) {
    tierCounts[s.tier]++;
  }

  // Compute domain activation (country counts per L1 domain)
  const domainActivation: Record<
    string,
    {
      code: string;
      label: string;
      shortLabel: string;
      color: string;
      signalCount: number;
      countryCount: number;
    }
  > = {};
  for (const s of signals) {
    if (s.l1Domain) {
      if (!domainActivation[s.l1Domain.code]) {
        domainActivation[s.l1Domain.code] = {
          ...s.l1Domain,
          signalCount: 0,
          countryCount: 0,
        };
      }
      domainActivation[s.l1Domain.code].signalCount++;
      domainActivation[s.l1Domain.code].countryCount += s.countries.length;
    }
  }

  // Sort domain activation by L1 code order (A-H)
  const sortedDomainActivation = Object.values(domainActivation).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  return {
    signals,
    meta: {
      totalSignals: signals.length,
      totalCountries,
      tierCounts,
      domainActivation: sortedDomainActivation,
      version: data.version,
      generatedAt: data.generated_at,
      curatedCount: data.curated_country_count,
    },
  };
}

export default async function SignalsBrowsePage() {
  let result: Awaited<ReturnType<typeof buildSignals>> | null = null;
  let error: string | null = null;

  try {
    result = await buildSignals();
  } catch (err) {
    error = (err as Error).message;
  }

  if (error || !result) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--qgi-text-muted)" }}>Signal data not available.</p>
      </div>
    );
  }

  return <SignalsBrowseClient signals={result.signals} meta={result.meta} />;
}
