/**
 * Zod schema for `country-risks.json` (#440 Part B).
 *
 * The frontend used to trust the structure of pipeline JSON outputs;
 * when the pipeline shipped V1.9.1 with renamed fields (#428 fallout),
 * the UI silently rendered stale values because the shape mismatch
 * never threw. Zod-parsing the file at load time means a regen with a
 * drifted schema fails LOUD instead of softly painting `undefined`.
 *
 * The TypeScript interfaces in `country-risks.ts` are re-derived from
 * these schemas (via `z.infer`) so the two stay in lock-step
 * automatically — there's only ONE source of truth for the shape.
 *
 * If the pipeline adds a field, adding it here (with a sensible
 * default or `.optional()`) is the only place the frontend needs to
 * change. If the pipeline removes/renames a field, the next deploy's
 * load-time parse fails — which is exactly when you want to know.
 */

import { z } from "zod";

export const RiskTierSchema = z.enum(["HIGH", "MODERATE", "INDICATIVE"]);

export const CategoryScoreSchema = z.object({
  category: z.string(),
  z_score: z.number(),
  salience_score: z.number(),
  severity_tier: z.number(),
  rrf_rank: z.number(),
  rrf_score: z.number(),
  recipe_count: z.number(),
  last_event_year: z.number().nullable(),
});

export const TierDataSchema = z.object({
  top_categories: z.array(CategoryScoreSchema),
});

export const CountryRiskSchema = z.object({
  name: z.string(),
  alpha_2: z.string(),
  curated: z.boolean(),
  overall_risk_tier: RiskTierSchema,
  // Tiers are S/M/L/XL but the file may add new keys; Record<string, ...>
  // keeps the schema forward-compatible.
  tiers: z.record(z.string(), TierDataSchema),
});

export const CountryRisksDataSchema = z.object({
  generated_at: z.string(),
  version: z.string(),
  scoring: z.string(),
  // The pipeline writes per-tier-length config under top-level `tiers`
  // alongside per-country tier data. Two distinct concepts unfortunately
  // sharing a key. Keep the shape mirror.
  tiers: z.record(
    z.string(),
    z.object({
      min_length: z.number(),
      max_length: z.number(),
    })
  ),
  curated_country_count: z.number(),
  total_countries: z.number(),
  countries: z.record(z.string(), CountryRiskSchema),
});

// Re-derive the TS types from the schemas so the two never drift.
export type RiskTier = z.infer<typeof RiskTierSchema>;
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;
export type TierData = z.infer<typeof TierDataSchema>;
export type CountryRisk = z.infer<typeof CountryRiskSchema>;
export type CountryRisksData = z.infer<typeof CountryRisksDataSchema>;
