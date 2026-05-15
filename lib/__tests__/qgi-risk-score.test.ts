/**
 * #721 (2026-05-16) — verify QGI Risk Score Step 1 bake fields are present
 * + valid in `data/country-risks.json`, and check key invariants from the
 * Majles synthesis spec.
 *
 * Spec: `qgi-docs/internal/ops/qgi-risk-score-majles-2026-05-16.md`
 *
 * Invariants tested:
 *  1. Top-level metadata present (version, cohort_n, method, baked_at)
 *  2. Per-country: every "ok" coverage_flag has all three score fields
 *     non-null and in [0, 100]; every "insufficient" has all three null
 *  3. CI low ≤ score ≤ CI high (within reasonable rounding)
 *  4. Cohort N matches the number of "ok" coverage_flag countries
 *  5. Strict-ordinal-not-probability invariant: NO score-related field
 *     is named or annotated as "probability" anywhere in the data
 */
import { describe, it, expect } from "vitest";
import countryRisksJson from "@/data/country-risks.json";
import { CountryRisksDataSchema } from "@/lib/country-risks.schema";

const parsed = CountryRisksDataSchema.parse(countryRisksJson);

describe("QGI Risk Score Step 1 bake (#721)", () => {
  it("top-level metadata present", () => {
    expect(parsed.qgi_risk_score_version).toBe("v1");
    expect(parsed.qgi_risk_score_cohort_n).toBeTypeOf("number");
    expect(parsed.qgi_risk_score_cohort_n).toBeGreaterThan(0);
    expect(parsed.qgi_risk_score_method).toBe("percentile-rank-of-max-salience");
    expect(parsed.qgi_risk_score_baked_at).toBeTypeOf("string");
    expect(new Date(parsed.qgi_risk_score_baked_at!).toISOString()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });

  it("every 'ok' country has all 3 score fields non-null and in [0, 100]", () => {
    let okCount = 0;
    for (const c of Object.values(parsed.countries)) {
      if (c.coverage_flag === "ok") {
        okCount++;
        expect(c.qgi_risk_score_0_100, `${c.name}: score`).not.toBeNull();
        expect(c.qgi_risk_score_ci_low, `${c.name}: ci_low`).not.toBeNull();
        expect(c.qgi_risk_score_ci_high, `${c.name}: ci_high`).not.toBeNull();
        const s = c.qgi_risk_score_0_100!;
        const lo = c.qgi_risk_score_ci_low!;
        const hi = c.qgi_risk_score_ci_high!;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeLessThanOrEqual(100);
      }
    }
    expect(okCount).toBe(parsed.qgi_risk_score_cohort_n);
  });

  it("every 'insufficient' country has all 3 score fields null", () => {
    for (const c of Object.values(parsed.countries)) {
      if (c.coverage_flag === "insufficient") {
        expect(c.qgi_risk_score_0_100, `${c.name}: score`).toBeNull();
        expect(c.qgi_risk_score_ci_low, `${c.name}: ci_low`).toBeNull();
        expect(c.qgi_risk_score_ci_high, `${c.name}: ci_high`).toBeNull();
      }
    }
  });

  it("CI bounds bracket the score (1-pt rounding slack)", () => {
    for (const c of Object.values(parsed.countries)) {
      if (c.coverage_flag === "ok") {
        const s = c.qgi_risk_score_0_100!;
        const lo = c.qgi_risk_score_ci_low!;
        const hi = c.qgi_risk_score_ci_high!;
        expect(lo - 1).toBeLessThanOrEqual(s);
        expect(hi + 1).toBeGreaterThanOrEqual(s);
      }
    }
  });

  it("face-validity: known-high countries score high, known-low countries score low", () => {
    const byName = new Map<string, (typeof parsed.countries)[string]>();
    for (const c of Object.values(parsed.countries)) byName.set(c.name, c);

    for (const name of ["Syria", "Sudan", "Myanmar"]) {
      const c = byName.get(name);
      if (c?.coverage_flag === "ok") {
        expect(c.qgi_risk_score_0_100, `${name} ≥ 70`).toBeGreaterThanOrEqual(70);
      }
    }
    for (const name of ["Norway", "Denmark", "Switzerland"]) {
      const c = byName.get(name);
      if (c?.coverage_flag === "ok") {
        expect(c.qgi_risk_score_0_100, `${name} ≤ 30`).toBeLessThanOrEqual(30);
      }
    }
  });

  it("strict ordinal: no 'probability' framing in field names anywhere", () => {
    const probabilityRegex = /probabilit/i;
    const sample = parsed.countries[Object.keys(parsed.countries)[0]];
    for (const key of Object.keys(sample)) {
      expect(probabilityRegex.test(key), `Field "${key}" contains 'probability'`).toBe(
        false
      );
    }
    for (const key of Object.keys(parsed)) {
      expect(
        probabilityRegex.test(key),
        `Top-level "${key}" contains 'probability'`
      ).toBe(false);
    }
  });
});
