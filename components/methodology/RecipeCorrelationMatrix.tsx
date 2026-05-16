import { loadCountryRisks } from "@/lib/country-risks";

/**
 * #731 (2026-05-16) — Per-recipe Risk Score correlation matrix surface.
 *
 * Renders the live recipe-recipe Spearman correlation matrix from
 * country-risks.json, alongside the 4-section plain-English explainer
 * the per-recipe Majles (2026-05-16) mandated.
 *
 * Spec: qgi-docs/internal/ops/qgi-risk-score-per-recipe-majles-2026-05-16.md
 *
 * Designed as a Server Component so the matrix stays in sync with the
 * current bake automatically — no hardcoded snapshot.
 *
 * Renders nothing if the bake doesn't carry the matrix (older bakes
 * pre-#729 Step 1.5). Graceful degradation.
 */

function formatRecipeDisplayName(id: string): string {
  // "civil_war_and_insurgency" -> "Civil war & insurgency"
  return id
    .replace(/_and_/g, " & ")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function correlationCellColor(value: number | null): string {
  if (value === null) return "var(--qgi-text-dim)";
  const abs = Math.abs(value);
  // Single-palette intensity (Yuki's discipline from per-recipe Majles).
  // 0.0 → neutral text; 0.5 → mid; 1.0 → strong. Stay below 0.5 for
  // current data (max |corr| ≈ 0.24); palette has room to scale.
  if (abs >= 0.7) return "#f87171"; // red-warning band (currently unused)
  if (abs >= 0.4) return "#fbbf24"; // amber-warning band (currently unused)
  if (abs >= 0.2) return "var(--qgi-text-muted)";
  return "var(--qgi-text-dim)";
}

function formatCorrelation(value: number | null): string {
  if (value === null) return "—";
  if (value === 1.0) return "1.00";
  return value.toFixed(3);
}

export async function RecipeCorrelationMatrix() {
  const data = await loadCountryRisks().catch(() => null);
  if (!data) return null;
  // Type-narrow against the schema-optional fields. Older bakes won't carry these.
  const dataAny = data as unknown as {
    qgi_risk_score_per_recipe_correlation_matrix?: Record<
      string,
      Record<string, number | null>
    >;
    qgi_risk_score_per_recipe_recipes?: string[];
    qgi_risk_score_per_recipe_min_pairs?: number;
    qgi_risk_score_version?: string;
  };
  const matrix = dataAny.qgi_risk_score_per_recipe_correlation_matrix;
  const recipes = dataAny.qgi_risk_score_per_recipe_recipes;
  const minPairs = dataAny.qgi_risk_score_per_recipe_min_pairs ?? 5;
  if (!matrix || !recipes || recipes.length === 0) return null;

  // Compute the headline number — max absolute off-diagonal correlation.
  let maxAbs = 0;
  let maxPair: [string, string] | null = null;
  for (const ra of recipes) {
    for (const rb of recipes) {
      if (ra === rb) continue;
      const cell = matrix[ra]?.[rb];
      if (cell === null || cell === undefined) continue;
      if (Math.abs(cell) > maxAbs) {
        maxAbs = Math.abs(cell);
        maxPair = [ra, rb];
      }
    }
  }

  const independentVerdict = maxAbs < 0.3;

  return (
    <section
      id="recipe-correlation"
      className="mt-8 mb-8"
      aria-labelledby="recipe-correlation-heading"
    >
      <h3
        id="recipe-correlation-heading"
        className="text-sm font-semibold mb-3"
        style={{ color: "var(--qgi-accent)" }}
      >
        Are the per-recipe scores really 4 different signals?
      </h3>

      <p className="text-sm leading-relaxed mb-3">
        Each country page shows four Precedent Match scores — one per locked recipe. A
        fair question: are those four numbers genuinely measuring different things, or are
        they one underlying signal wearing four labels? If they all move together (a
        country high on one is high on all), the per-recipe view would be a false feature.
      </p>

      <p className="text-sm leading-relaxed mb-3">
        We test this with a rank correlation across all countries that score on both
        recipes in each pair. Each cell below answers: if a country ranks high on recipe
        A, does it also tend to rank high on recipe B? Values near <strong>0</strong> mean
        the recipes are telling different stories; values near <strong>+1</strong> would
        mean they move together (same story); values near <strong>−1</strong> would mean
        they move opposite (also linked, just inversely).
      </p>

      <div className="my-4 overflow-x-auto">
        <table className="text-sm border-collapse" style={{ minWidth: "32rem" }}>
          <thead>
            <tr>
              <th
                scope="col"
                className="text-left px-3 py-2 text-[11px] tracking-wider uppercase font-semibold"
                style={{
                  color: "var(--qgi-text-dim)",
                  borderBottom: "1px solid var(--qgi-border)",
                }}
              >
                Recipe
              </th>
              {recipes.map((r) => (
                <th
                  key={r}
                  scope="col"
                  className="text-right px-3 py-2 text-[11px] tracking-wider uppercase font-semibold font-data"
                  style={{
                    color: "var(--qgi-text-dim)",
                    borderBottom: "1px solid var(--qgi-border)",
                  }}
                >
                  {formatRecipeDisplayName(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recipes.map((ra) => (
              <tr key={ra}>
                <th
                  scope="row"
                  className="text-left px-3 py-2 font-medium"
                  style={{
                    color: "var(--qgi-text)",
                    borderBottom: "1px solid var(--qgi-border)",
                  }}
                >
                  {formatRecipeDisplayName(ra)}
                </th>
                {recipes.map((rb) => {
                  const cell = matrix[ra]?.[rb] ?? null;
                  return (
                    <td
                      key={rb}
                      className="text-right px-3 py-2 font-data tabular-nums"
                      style={{
                        color: correlationCellColor(cell),
                        borderBottom: "1px solid var(--qgi-border)",
                        fontWeight: ra === rb ? 600 : 400,
                      }}
                      title={
                        cell === null
                          ? `Fewer than ${minPairs} countries share scores on both recipes — not enough data.`
                          : ra === rb
                            ? "Self-correlation = 1 by definition."
                            : `Rank correlation across countries that score on both recipes.`
                      }
                    >
                      {formatCorrelation(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm leading-relaxed mb-3">
        <strong>Current outcome.</strong>{" "}
        {maxPair ? (
          <>
            The strongest off-diagonal magnitude is{" "}
            <span className="font-data tabular-nums">{maxAbs.toFixed(3)}</span> (between{" "}
            <em>{formatRecipeDisplayName(maxPair[0])}</em> and{" "}
            <em>{formatRecipeDisplayName(maxPair[1])}</em>).{" "}
          </>
        ) : null}
        {independentVerdict
          ? "The four recipes are largely independent — they're measuring genuinely different things. A country scoring high on one is not predictably high on the others."
          : "The four recipes show measurable correlation. Treat the per-recipe scores as related signals, not fully independent ones."}
      </p>

      <p className="text-sm leading-relaxed mb-3">
        <strong>What this lets you do.</strong> If you&apos;re writing a memo, citing two
        recipes for the same country isn&apos;t double-counting — they&apos;re separate
        facts. If you&apos;re integrating the API, you can treat the four per-recipe
        scores as broadly independent signals without needing to residualize one against
        another. If a future bake ever shows a pair above{" "}
        <span className="font-data">0.7</span>, that pair should probably be
        reconsolidated into one score; we publish this table so the test is verifiable,
        not promised.
      </p>

      <p className="text-xs mt-3" style={{ color: "var(--qgi-text-dim)" }}>
        Spearman rank correlation across countries with valid scores on both recipes in
        each pair. Cells where fewer than {minPairs} countries share both recipes are
        shown as &ldquo;—&rdquo;. Self-correlation is 1 by definition. Re-computed every
        bake; updates when the locked-recipe roster changes.
      </p>
    </section>
  );
}
