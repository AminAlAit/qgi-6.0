/**
 * Unit tests for lib/recipe-similarity.ts
 *
 * Tests the pure groupCountriesByZone() function and type contracts
 * without hitting the filesystem (no mocking of fs needed for pure logic).
 *
 * The loader functions (loadShapWeights, loadSimilarityScores,
 * loadSimilarityValidations) are integration-tested implicitly by the
 * page render; pure unit coverage lives here.
 */
import { describe, it, expect } from "vitest";
import { groupCountriesByZone } from "@/lib/recipe-similarity";
import type {
  SimilarityScoresFile,
  RecipeSimilarityScore,
} from "@/lib/recipe-similarity";

// ---------------------------------------------------------------------------
// Minimal fixture factory — shapes exactly match SimilarityScoresFile
// ---------------------------------------------------------------------------

function makeScore(
  zone: "HIGH" | "MODERATE" | "LOW",
  risk_score: number
): RecipeSimilarityScore {
  return {
    cosine_similarity_S: (risk_score / 100) * 2 - 1,
    risk_score,
    zone,
    zone_label: `zone-${zone}`,
    per_indicator: {
      "RQ.EST": { cosine: 0.9, weight: 0.5112, weighted_contribution: 0.46 },
    },
    aggregation_method: "weighted_arithmetic_mean",
  };
}

function makeScoresFile(
  entries: Array<[string, RecipeSimilarityScore]>
): SimilarityScoresFile {
  return {
    schema_version: 1,
    recipe_id: "foreign_intervention",
    evaluation_year: 2021,
    computed_at_utc: "2026-05-22T00:00:00Z",
    scoring_metric: "cosine_arithmetic_mean_shap_weighted_v1",
    selected_indicators: ["RQ.EST"],
    chosen_window: 18,
    shap_importance_normalized: { "RQ.EST": 1.0 },
    n_countries_scored: entries.length,
    scores: Object.fromEntries(entries),
  };
}

// ---------------------------------------------------------------------------
// groupCountriesByZone
// ---------------------------------------------------------------------------

describe("groupCountriesByZone", () => {
  it("partitions countries into three zone buckets", () => {
    const file = makeScoresFile([
      ["Syria", makeScore("HIGH", 96.0)],
      ["Afghanistan", makeScore("HIGH", 90.0)],
      ["Bolivia", makeScore("MODERATE", 55.0)],
      ["Argentina", makeScore("MODERATE", 48.0)],
      ["Germany", makeScore("LOW", 8.0)],
    ]);

    const { high, moderate, low } = groupCountriesByZone(file);

    expect(high).toHaveLength(2);
    expect(moderate).toHaveLength(2);
    expect(low).toHaveLength(1);
  });

  it("sorts each zone by risk_score descending", () => {
    const file = makeScoresFile([
      ["A", makeScore("HIGH", 80.0)],
      ["B", makeScore("HIGH", 95.0)],
      ["C", makeScore("HIGH", 70.0)],
    ]);

    const { high } = groupCountriesByZone(file);

    expect(high[0].name).toBe("B");
    expect(high[1].name).toBe("A");
    expect(high[2].name).toBe("C");
    // strictly descending
    for (let i = 1; i < high.length; i++) {
      expect(high[i].risk_score).toBeLessThanOrEqual(high[i - 1].risk_score);
    }
  });

  it("returns country name on each row", () => {
    const file = makeScoresFile([["Iran", makeScore("HIGH", 98.0)]]);
    const { high } = groupCountriesByZone(file);
    expect(high[0].name).toBe("Iran");
    expect(high[0].risk_score).toBe(98.0);
  });

  it("handles empty scores object", () => {
    const file = makeScoresFile([]);
    const { high, moderate, low } = groupCountriesByZone(file);
    expect(high).toHaveLength(0);
    expect(moderate).toHaveLength(0);
    expect(low).toHaveLength(0);
  });

  it("LOW zone sort: lowest scores last (highest first)", () => {
    const file = makeScoresFile([
      ["X", makeScore("LOW", 20.0)],
      ["Y", makeScore("LOW", 5.0)],
      ["Z", makeScore("LOW", 12.0)],
    ]);
    const { low } = groupCountriesByZone(file);
    expect(low[0].risk_score).toBe(20.0);
    expect(low[2].risk_score).toBe(5.0);
  });
});
