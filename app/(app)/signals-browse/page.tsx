import { loadCountryRisks } from "@/lib/country-risks";
import { SignalsBrowseClient } from "@/components/signals/SignalsBrowseClient";

export const metadata = {
  title: "Signals — QGI Intelligence",
  description:
    "Browse historical risk signals — the economic trajectories that preceded geopolitical events.",
};

/**
 * Aggregate country-risks data by category to create Signal profiles.
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
      }>;
      totalRecipes: number;
      avgSalience: number;
      maxSalience: number;
    }
  > = {};

  for (const [id, country] of Object.entries(data.countries)) {
    // Use S-tier (most actionable) for signal browsing
    const cats = country.tiers?.S?.top_categories ?? [];
    for (const cat of cats) {
      const salience = cat.salience_score ?? cat.z_score;
      if (!signalMap[cat.category]) {
        signalMap[cat.category] = {
          category: cat.category,
          countries: [],
          totalRecipes: 0,
          avgSalience: 0,
          maxSalience: 0,
        };
      }
      signalMap[cat.category].countries.push({
        id,
        name: country.name,
        alpha_2: country.alpha_2,
        salience,
        recipes: cat.recipe_count,
        curated: country.curated,
      });
      signalMap[cat.category].totalRecipes += cat.recipe_count;
    }
  }

  // Compute averages and sort countries within each signal
  const signals = Object.values(signalMap).map((s) => {
    s.countries.sort((a, b) => b.salience - a.salience);
    s.avgSalience =
      s.countries.length > 0
        ? s.countries.reduce((sum, c) => sum + c.salience, 0) / s.countries.length
        : 0;
    s.maxSalience = s.countries[0]?.salience ?? 0;
    return s;
  });

  // Sort signals by max salience descending
  signals.sort((a, b) => b.maxSalience - a.maxSalience);

  return signals;
}

export default async function SignalsBrowsePage() {
  let signals: Awaited<ReturnType<typeof buildSignals>> = [];
  let error: string | null = null;

  try {
    signals = await buildSignals();
  } catch (err) {
    error = (err as Error).message;
  }

  if (error) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--qgi-text-muted)" }}>Signal data not available.</p>
      </div>
    );
  }

  return <SignalsBrowseClient signals={signals} />;
}
