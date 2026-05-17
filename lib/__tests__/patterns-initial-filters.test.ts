import { describe, expect, it } from "vitest";
import { resolvePatternsInitialFilters } from "@/lib/patterns-initial-filters";

/**
 * #781 — regression tests for /patterns URL-state seeding.
 *
 * Karl Henriksen (Eurasia Group, persona-test Round 4 2026-05-17)
 * found that URL query params on /patterns silently no-op'd. URLs
 * like `/patterns?country_a=31&country_b=208…` (constructed by
 * dashboard, country-detail, pattern-scatter, V1 ranking) landed on
 * the default unfiltered list.
 */

const ROWS = [
  {
    country_a: "Iran",
    country_b: "South Korea",
    country_a_id: 31,
    country_b_id: 208,
  },
  {
    country_a: "Argentina",
    country_b: "Brazil",
    country_a_id: 10,
    country_b_id: 24,
  },
  {
    country_a: "Mexico",
    country_b: "Colombia",
    country_a_id: 150,
    country_b_id: 47,
  },
];

describe("resolvePatternsInitialFilters — #781", () => {
  it("returns empty filters for empty params", () => {
    const out = resolvePatternsInitialFilters({}, ROWS);
    expect(out.search).toBe("");
    expect(out.countryFilter).toEqual([]);
    expect(out.tierFilter).toEqual([]);
  });

  it("seeds `q` from the search param", () => {
    const out = resolvePatternsInitialFilters({ q: "mex" }, ROWS);
    expect(out.search).toBe("mex");
  });

  it("seeds countryFilter from `country=` CSV (names)", () => {
    const out = resolvePatternsInitialFilters({ country: "Mexico,Colombia" }, ROWS);
    expect(out.countryFilter.sort()).toEqual(["Colombia", "Mexico"]);
  });

  it("seeds countryFilter from `country_a` numeric ID (Karl's dashboard CTA)", () => {
    // 31 = Iran in fixture
    const out = resolvePatternsInitialFilters({ country_a: "31" }, ROWS);
    expect(out.countryFilter).toEqual(["Iran"]);
  });

  it("seeds countryFilter from BOTH `country_a` and `country_b` numeric IDs (Karl's exact URL shape)", () => {
    const out = resolvePatternsInitialFilters(
      { country_a: "31", country_b: "208" },
      ROWS
    );
    expect(out.countryFilter.sort()).toEqual(["Iran", "South Korea"]);
  });

  it("merges `country` CSV with numeric `country_a` / `country_b` (no duplicates)", () => {
    const out = resolvePatternsInitialFilters({ country: "Iran", country_a: "31" }, ROWS);
    expect(out.countryFilter).toEqual(["Iran"]);
  });

  it("silently drops `country_a` IDs that don't map to any row", () => {
    const out = resolvePatternsInitialFilters({ country_a: "99999" }, ROWS);
    expect(out.countryFilter).toEqual([]);
  });

  it("seeds tierFilter from `tier=` CSV", () => {
    const out = resolvePatternsInitialFilters({ tier: "S-win,L-win" }, ROWS);
    expect(out.tierFilter.sort()).toEqual(["L-win", "S-win"]);
  });

  it("silently drops invalid tier values", () => {
    const out = resolvePatternsInitialFilters({ tier: "S-win,BOGUS,XL-win" }, ROWS);
    expect(out.tierFilter.sort()).toEqual(["S-win", "XL-win"]);
  });

  it("handles array-valued params (Next.js can supply repeated keys as string[])", () => {
    const out = resolvePatternsInitialFilters(
      { q: ["first", "second"], tier: ["S-win,M-win"] },
      ROWS
    );
    expect(out.search).toBe("first");
    expect(out.tierFilter.sort()).toEqual(["M-win", "S-win"]);
  });

  it("resolves country IDs that exist in the corpus but outside the top-250 visible window (regression for Opus-4.7 Finding 1 on PR #103)", () => {
    // Karl's exact URL: country_a=31 (Iran) + country_b=208 (South Korea).
    // Iran is in the corpus but its highest-PPS pattern row sits below
    // the top-250 slice that the visible list shows. The resolver must
    // be invoked against the FULL corpus, not the sliced display rows,
    // or this regression returns half the expected pair.
    const fullCorpus = [
      ...ROWS,
      {
        country_a: "Iran",
        country_b: "Tajikistan",
        country_a_id: 31,
        country_b_id: 220,
      },
    ];
    const out = resolvePatternsInitialFilters(
      { country_a: "31", country_b: "208" },
      fullCorpus
    );
    expect(out.countryFilter.sort()).toEqual(["Iran", "South Korea"]);
  });

  it("composes all four schemes in one URL", () => {
    const out = resolvePatternsInitialFilters(
      {
        q: "test",
        country: "Brazil",
        country_a: "31",
        tier: "L-win",
      },
      ROWS
    );
    expect(out.search).toBe("test");
    expect(out.countryFilter.sort()).toEqual(["Brazil", "Iran"]);
    expect(out.tierFilter).toEqual(["L-win"]);
  });
});
