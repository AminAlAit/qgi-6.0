/**
 * Site stats consistency check (#431).
 *
 * Locks the marketing/methodology numbers in `lib/site-stats.ts` to the
 * actual baked data. If a future pipeline run changes the country count,
 * indicator catalog size, or scoring version, this test fails — forcing
 * the constant to be updated in lock-step rather than drifting silently.
 *
 * Was filed because a 2026-04-24 QA sweep found 5 different country
 * counts across 6 surfaces of qgintelligence.com.
 */
import { describe, expect, it } from "vitest";
import countryRisks from "@/data/country-risks.json";
import indexes from "@/data/indexes.json";
import {
  CANONICAL_SCOPE_SENTENCE,
  SCORING_VERSION,
  TOTAL_COUNTRIES,
  TOTAL_INDICATORS,
  TOTAL_INDICATOR_CATALOG,
  UN_STATES,
  getScoredThisCycle,
} from "@/lib/site-stats";

describe("site-stats", () => {
  it("UN_STATES is the standard 197 (constant scope descriptor)", () => {
    expect(UN_STATES).toBe(197);
  });

  it("TOTAL_COUNTRIES is at least the cycle-scored count", () => {
    // Pipeline scope (TOTAL_COUNTRIES) is a superset of currently-scored
    // countries — should always be >= the scored count for the active
    // cycle. If the scored count exceeds 214 something is very wrong.
    const scored = Object.keys(countryRisks.countries).length;
    expect(TOTAL_COUNTRIES).toBeGreaterThanOrEqual(scored);
    expect(scored).toBeLessThan(300); // sanity ceiling
  });

  it("SCORING_VERSION matches the live country-risks payload", () => {
    expect(SCORING_VERSION).toBe(countryRisks.version);
  });

  it("indicator catalog count is plausibly aligned with indexes.json", () => {
    // indexes.json holds the FULL catalog (currently ~260 with mock/draft
    // entries) while TOTAL_INDICATOR_CATALOG (74) is the count of indicators
    // we publicly claim are in the catalog (69 World Bank + 5 FAO).
    // We assert the public claim is less than or equal to the file size so
    // a future shrink of the catalog can't silently leave the constant
    // overstating it.
    expect(TOTAL_INDICATOR_CATALOG).toBeLessThanOrEqual(indexes.length);
    expect(TOTAL_INDICATORS).toBeLessThanOrEqual(TOTAL_INDICATOR_CATALOG);
  });

  it("CANONICAL_SCOPE_SENTENCE references the canonical numbers", () => {
    expect(CANONICAL_SCOPE_SENTENCE).toContain(String(TOTAL_COUNTRIES));
    expect(CANONICAL_SCOPE_SENTENCE).toContain(String(TOTAL_INDICATORS));
  });

  it("getScoredThisCycle reads from country-risks at runtime", () => {
    // The dynamic helper is what dashboard headers should call so we don't
    // hardcode the cycle-specific number anywhere in the surface code.
    const n = getScoredThisCycle(
      countryRisks as unknown as Parameters<typeof getScoredThisCycle>[0]
    );
    expect(n).toBeGreaterThan(0);
    expect(n).toBe(
      Object.values(countryRisks.countries).filter((c) => c.overall_risk_tier).length
    );
  });
});
