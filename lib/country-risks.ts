/**
 * Types and loader for country-risks.json — the pre-computed V1.8.1
 * scoring data that powers the Country Intelligence Browser.
 *
 * Schema designed to accommodate future V1.9 XGBoost outputs
 * (calibrated probabilities, SHAP explanations).
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskTier = "HIGH" | "MODERATE" | "INDICATIVE";

export interface CategoryScore {
  category: string;
  z_score: number;
  salience_score: number;
  drama_tier: number;
  rrf_rank: number;
  rrf_score: number;
  recipe_count: number;
  last_event_year: number | null;
}

export interface TierData {
  top_categories: CategoryScore[];
}

export interface CountryRisk {
  name: string;
  alpha_2: string;
  curated: boolean;
  overall_risk_tier: RiskTier;
  tiers: Record<string, TierData>;
}

export interface CountryRisksData {
  generated_at: string;
  version: string;
  scoring: string;
  tiers: Record<string, { min_length: number; max_length: number }>;
  curated_country_count: number;
  total_countries: number;
  countries: Record<string, CountryRisk>;
}

// ---------------------------------------------------------------------------
// Loader (S3 with in-memory cache)
// ---------------------------------------------------------------------------

let _cache: CountryRisksData | null = null;
let _cacheTs = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const BUCKET = process.env.QGI_DATA_LAKE_BUCKET ?? "qgi-data-lake-222222222222";
const REGION = process.env.AWS_REGION ?? "eu-central-1";
const S3_KEY = "dashboard/country-risks.json";

export async function loadCountryRisks(): Promise<CountryRisksData> {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL) return _cache;

  // Try local file first (fast, zero AWS cost, always present in repo)
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "country-risks.json");
    const raw = await fs.readFile(filePath, "utf-8");
    _cache = JSON.parse(raw) as CountryRisksData;
    _cacheTs = now;
    return _cache;
  } catch {
    // Local file missing — fall back to S3
  }

  // S3 fallback (production override / fresh pipeline output)
  try {
    const s3 = new S3Client({ region: REGION });
    const resp = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: S3_KEY })
    );
    const body = await resp.Body?.transformToString();
    if (body) {
      _cache = JSON.parse(body) as CountryRisksData;
      _cacheTs = now;
      return _cache;
    }
  } catch {
    // S3 also unavailable
  }

  throw new Error(
    "country-risks.json not found in data/ or S3. Run generate_country_risks.py first."
  );
}

/**
 * Get a single country's risk data by country_id.
 */
export async function getCountryRisk(
  countryId: string
): Promise<CountryRisk | null> {
  const data = await loadCountryRisks();
  return data.countries[countryId] ?? null;
}

/**
 * Get all countries sorted by risk tier (HIGH first) then by max z-score descending.
 */
export async function getCountriesSortedByRisk(): Promise<
  Array<{ id: string } & CountryRisk>
> {
  const data = await loadCountryRisks();
  const tierOrder: Record<RiskTier, number> = {
    HIGH: 0,
    MODERATE: 1,
    INDICATIVE: 2,
  };

  return Object.entries(data.countries)
    .map(([id, risk]) => ({ id, ...risk }))
    .sort((a, b) => {
      const tierDiff =
        tierOrder[a.overall_risk_tier] - tierOrder[b.overall_risk_tier];
      if (tierDiff !== 0) return tierDiff;
      // Within same tier, sort by max z-score descending
      const maxZA = getMaxSalience(a);
      const maxZB = getMaxSalience(b);
      return maxZB - maxZA;
    });
}

function getMaxSalience(country: CountryRisk): number {
  let max = -999;
  for (const tier of Object.values(country.tiers)) {
    for (const cat of tier.top_categories.slice(0, 5)) {
      const salience = cat.salience_score ?? cat.z_score;
      if (salience > max) max = salience;
    }
  }
  return max;
}
