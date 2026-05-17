/**
 * Types and loader for country-risks.json — the pre-computed V1.9.1
 * scoring data that powers the Country Intelligence Browser.
 *
 * Schema designed to accommodate future V1.9 XGBoost outputs
 * (calibrated probabilities, SHAP explanations).
 *
 * #440: Types are re-exported from `country-risks.schema.ts` so the
 * Zod schema is the single source of truth. Adding a field anywhere
 * else is a build error.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  CountryRisksDataSchema,
  type CountryRisk,
  type CountryRisksData,
  type CategoryScore,
  type RiskTier,
  type TierData,
} from "./country-risks.schema";

// Re-export the canonical types so existing imports
// (`import type { ... } from "@/lib/country-risks"`) keep working
// without every caller switching to `.schema`.
export type { CountryRisk, CountryRisksData, CategoryScore, RiskTier, TierData };

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

  // T13 #306 + #440: validate the whole shape via Zod, not just a
  // top-level guard. A V1.9.1 → V1.10 schema rename now fails LOUD at
  // load time (with a precise field-level error message) instead of
  // softly painting the dashboard with `undefined` once the user clicks
  // through to a country profile.
  //
  // #451: schema-mismatch events are also fired into Sentry with the
  // first 5 Zod issues attached as extra context. This is the critical
  // signal a pipeline regen drifted shape — without it we'd see vague
  // "the dashboard is broken" reports from users instead of an exact
  // field-level diff.
  const parseAndValidate = (raw: string): CountryRisksData => {
    const parsed: unknown = JSON.parse(raw);
    const result = CountryRisksDataSchema.safeParse(parsed);
    if (!result.success) {
      // Zod's `.message` is human-readable JSON path + reason; stick the
      // first 5 issues into the error so logs aren't truncated to noise
      // for a deeply broken payload.
      const issues = result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ");
      const err = new Error(`country-risks.json schema mismatch: ${issues}`);
      // Report to Sentry if it's wired (production). The dynamic import
      // avoids pulling Sentry into the bundle for environments that
      // don't have it (local dev), and the try/catch keeps Sentry's
      // own transport failures from masking the original schema error.
      if (process.env.SENTRY_DSN) {
        void import("@sentry/nextjs")
          .then((Sentry) => {
            Sentry.captureException(err, {
              tags: { source: "country-risks-schema" },
              extra: {
                first_issues: result.error.issues.slice(0, 5),
                total_issue_count: result.error.issues.length,
              },
            });
          })
          .catch(() => {
            /* Sentry SDK unavailable; original error still propagates */
          });
      }
      throw err;
    }
    return result.data;
  };

  // Try local file first (fast, zero AWS cost, always present in repo)
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "country-risks.json");
    const raw = await fs.readFile(filePath, "utf-8");
    _cache = parseAndValidate(raw);
    _cacheTs = now;
    return _cache;
  } catch {
    // Local file missing or malformed — fall back to S3
  }

  // S3 fallback (production override / fresh pipeline output)
  try {
    const s3 = new S3Client({ region: REGION });
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: S3_KEY }));
    const body = await resp.Body?.transformToString();
    if (body) {
      _cache = parseAndValidate(body);
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
export async function getCountryRisk(countryId: string): Promise<CountryRisk | null> {
  const data = await loadCountryRisks();
  return data.countries[countryId] ?? null;
}

/**
 * #470 item 3: shared lookup for the V2.0 `/signals/{country-slug}/...`
 * routes — resolves a country slug (e.g. "yemen") back to the
 * `{id, ...CountryRisk}` row by matching `countrySlug(name)` across the
 * dataset.
 *
 * Promoted out of `app/(app)/signals/[country]/page.tsx` +
 * `app/(app)/signals/[country]/[slug]/page.tsx` where it was duplicated.
 *
 * Returns null when no match — callers issue notFound() at that point.
 *
 * #715 (2026-05-16) — common-name slug aliases. The canonical bake uses
 * names like "Turkiye" / "Myanmar" / "Timor-Leste" — readers / journalists
 * type "turkey" / "burma" / "east_timor". Without an alias layer, those
 * URLs 404. Persona test 2026-05-15 (James/FT, Dmitri/HF) bounced on this.
 *
 * The alias map is a complement to the route-level numeric-ID accept
 * (#714 fix). Together they cover the two common 404 paths: typed
 * common name + dashboard numeric ID. Slugs remain canonical.
 */
export const COMMON_NAME_ALIASES: Readonly<Record<string, string>> = {
  // Country names where the canonical bake spelling differs from the
  // common-English name a reader is likely to type.
  turkey: "turkiye",
  burma: "myanmar",
  east_timor: "timor_leste",
  czech_republic: "czechia",
  swaziland: "eswatini",
  cape_verde: "cabo_verde",
  // DRC variants (canonical is verbose "The Democratic Republic of the Congo"
  // → slug "the_democratic_republic_of_the_congo"). Hyphen variants like
  // `dr-congo` are normalized to `dr_congo` by `resolveCountryBySlug`
  // before this map is consulted.
  drc: "the_democratic_republic_of_the_congo",
  dr_congo: "the_democratic_republic_of_the_congo",
  democratic_republic_of_the_congo: "the_democratic_republic_of_the_congo",
  congo_kinshasa: "the_democratic_republic_of_the_congo",
  // #759: persona test 2026-05-17 (Fatima/UNDP) pasted `congo-dem-rep`
  // from a WhatsApp link → normalize → `congo_dem_rep`. Add explicit
  // alias since `countrySlug()` doesn't produce that abbreviation.
  congo_dem_rep: "the_democratic_republic_of_the_congo",
  // Short abbreviations
  uk: "united_kingdom",
  usa: "united_states",
  us: "united_states",
  uae: "united_arab_emirates",
};

export async function resolveCountryBySlug(
  slug: string
): Promise<({ id: string } & CountryRisk) | null> {
  const { countrySlug } = await import("./slug");
  const data = await loadCountryRisks();
  // #759 (persona-test 2026-05-17) — normalize hyphen → underscore +
  // lowercase first. External linkers (WhatsApp / Slack / search engines
  // / hand-typed URLs) overwhelmingly produce hyphen-separated slugs
  // (`dr-congo`, `north-korea`, `democratic-republic-of-the-congo`) but
  // `countrySlug()` produces underscore-separated canonical slugs from
  // the baked country names. Persona test 2026-05-17 had Fatima/UNDP
  // and James/FT both 404 on hyphen-variant URLs that would have matched
  // a canonical slug under a one-character substitution.
  const normalized = slug.toLowerCase().replace(/-/g, "_");
  // Direct canonical match.
  for (const [id, c] of Object.entries(data.countries)) {
    if (countrySlug(c.name) === normalized) {
      return { id, ...c };
    }
  }
  // #715 — alias fallback. If the requested slug is a known common-name
  // alias, retry with the canonical form. Single lookup; no recursion
  // (alias values must point to canonical slugs, never other aliases).
  const aliased = COMMON_NAME_ALIASES[normalized];
  if (aliased) {
    for (const [id, c] of Object.entries(data.countries)) {
      if (countrySlug(c.name) === aliased) {
        return { id, ...c };
      }
    }
  }
  return null;
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
      const tierDiff = tierOrder[a.overall_risk_tier] - tierOrder[b.overall_risk_tier];
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
