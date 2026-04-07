/**
 * Dashboard JSON cache reader (#146).
 *
 * Reads pre-computed dashboard JSONs from S3 instead of running Athena queries.
 * The pipeline-recipe-engine Lambda writes these on every monthly pipeline run
 * to s3://{S3_DATA_BUCKET}/dashboard/{ranking,early-warning,recipes-top50}.json.
 *
 * Routes that use this should still keep an Athena fallback for the case where
 * the pre-compute hasn't run yet (fresh environment) or is stale.
 */
import { GetObjectCommand, S3Client, NoSuchKey } from "@aws-sdk/client-s3";

const REGION = "eu-central-1";
const BUCKET = process.env.S3_DATA_BUCKET ?? "qgi-data-lake-222222222222";
const PREFIX = "dashboard";

// In-process cache so the same Lambda instance doesn't re-fetch on every request.
// Stored on globalThis so it survives `next dev` HMR (same trick as lib/athena.ts).
type CacheEntry<T> = { value: T; expiresAt: number };
const globalForDashboard = globalThis as typeof globalThis & {
  __qgiDashboardCache?: Map<string, CacheEntry<unknown>>;
};
const cache =
  globalForDashboard.__qgiDashboardCache ?? new Map<string, CacheEntry<unknown>>();
if (!globalForDashboard.__qgiDashboardCache) {
  globalForDashboard.__qgiDashboardCache = cache;
}
const CACHE_TTL_MS = 600_000; // 10 minutes

let _client: S3Client | undefined;
function getClient(): S3Client {
  if (!_client) _client = new S3Client({ region: REGION });
  return _client;
}

/**
 * Fetch a pre-computed dashboard JSON from S3.
 * Returns null if the object doesn't exist (caller should fall back to Athena).
 * Throws on any other S3 error.
 */
export async function getDashboardJson<T>(filename: string): Promise<T | null> {
  const cacheKey = `${BUCKET}/${PREFIX}/${filename}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}/${filename}` })
    );
    const body = await res.Body?.transformToString("utf-8");
    if (!body) return null;
    const parsed = JSON.parse(body) as T;
    cache.set(cacheKey, { value: parsed, expiresAt: now + CACHE_TTL_MS });
    return parsed;
  } catch (err) {
    if (err instanceof NoSuchKey) return null;
    // Some SDK error shapes use name/Code instead of NoSuchKey instance
    const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NoSuchKey" || e.Code === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

// Strongly-typed payload shapes that mirror what pipeline-recipe-engine writes.
// Keep these in sync with qgi-pipeline/lambdas/pipeline-recipe-engine/lambda_function.py.

export type PatternTier = "S" | "M" | "L" | "XL";

export type RankingPayload = {
  generated_at: string;
  limit: number;
  results: Array<{
    country_a: string;
    country_b: string;
    country_a_id: string;
    country_b_id: string;
    start_year_a: number;
    start_year_b: number;
    pattern_length: number;
    avg_correlation: number;
    pattern_power_score: number;
    num_indexes: number;
    pattern_tier: PatternTier | null; // #128
    predicted: boolean;
  }>;
};

export type EarlyWarningPayload = {
  generated_at: string;
  as_of_year: number;
  results: Array<{
    country_a: string;
    country_b: string;
    start_year_a: string | number;
    start_year_b: string | number;
    pattern_length: string | number;
    avg_correlation: number;
    pattern_power_score: number;
    num_indexes: number;
    pattern_tier: PatternTier | null; // #128
  }>;
};

export type RecipesTop50Payload = {
  generated_at: string;
  as_of_year: number;
  results: Array<{
    recipe_id: string;
    event_category: string;
    country_a_id: number;
    country_b_id: number;
    country_a_name: string;
    country_b_name: string;
    start_year_a: number;
    start_year_b: number;
    length: number;
    avg_correlation: number;
    end_year_a: number;
    end_year_b: number;
    event_window: number;
    event_year_a: number;
    event_year_b: number;
    event_title_a: string;
    event_title_b: string;
    indicator_count: number;
    instance_count: number; // #129
    pattern_power_score: number; // legacy, kept for compat/debug
    pps: number; // #129 — new normalized 0-100 Pattern Strength
    pattern_tier: PatternTier | null; // #128
  }>;
};
