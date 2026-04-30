/**
 * Bake `data/recipes-aggregated.json` from Athena `qgi_data.recipes_aggregated`
 * (#546, replaces the hand-curated `recipes-aggregated-mock.json`).
 *
 * The Glue table has 72 rows (one per L3 event_category) populated by
 * `pipeline-recipe-engine-finalize` Lambda Step 2c. This script reads the
 * full table, resolves indicator IDs to indicator names via `indexes.json`,
 * and writes the JSON in the shape `lib/recipes-aggregated.ts` expects.
 *
 * Re-run:  npx tsx scripts/bake-recipes-aggregated.ts
 *
 * Schema mirrors the existing mock file 1:1 so #547 (loader switch) is a
 * one-line change with no schema-fork risk.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";

const REGION = "eu-central-1";
const DB = "qgi_data";
const WG = "QGI-Lambda-Workgroup";
const OUT = join(process.cwd(), "data", "recipes-aggregated.json");
const INDEXES = join(process.cwd(), "data", "indexes.json");

interface IndicatorIndexEntry {
  id: string; // World Bank code, e.g. "NY.GDP.MKTP.KD.ZG"
  numeric_id: number; // smallint that recipes_aggregated.indicator_id stores
  name: string;
}

type IndicatorIndexFile = IndicatorIndexEntry[];

interface FingerprintEntry {
  indicator_id: number;
  indicator_name: string;
  frequency: number;
  ci_lower: number;
  ci_upper: number;
  avg_corr_magnitude: number;
  tfidf_score: number;
}

interface LengthBucket {
  length: number;
  count: number;
}

interface CoverageBiasDiagnostic {
  n_pairs: number;
  oecd_share: number;
  regional_concentration: Array<{ region: string; share: number }>;
}

interface RecipeAggregated {
  event_category: string;
  canonical_length: number;
  length_distribution: LengthBucket[];
  indicator_fingerprint: FingerprintEntry[];
  coverage_bias_diagnostic: CoverageBiasDiagnostic;
  total_instances: number;
  n_distinct_country_pairs: number;
  last_recomputed_at: string;
  contains_predicted: boolean;
}

interface RecipesAggregatedFile {
  generated_at: string;
  pipeline_version: string;
  schema_version: number;
  recipes: RecipeAggregated[];
}

async function runQuery(client: AthenaClient, sql: string): Promise<string[][]> {
  const start = await client.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: DB },
      WorkGroup: WG,
    })
  );
  const qid = start.QueryExecutionId!;
  // Poll for completion
  for (let i = 0; i < 60; i++) {
    const exec = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: qid })
    );
    const state = exec.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") break;
    if (state === "FAILED" || state === "CANCELLED") {
      throw new Error(
        `Query ${state}: ${exec.QueryExecution?.Status?.StateChangeReason}`
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  // Page results
  const rows: string[][] = [];
  let nextToken: string | undefined;
  let isFirst = true;
  do {
    const res = await client.send(
      new GetQueryResultsCommand({
        QueryExecutionId: qid,
        NextToken: nextToken,
      })
    );
    for (const row of res.ResultSet?.Rows ?? []) {
      if (isFirst) {
        isFirst = false;
        continue; // header
      }
      rows.push((row.Data ?? []).map((c) => c.VarCharValue ?? ""));
    }
    nextToken = res.NextToken;
  } while (nextToken);
  return rows;
}

function buildIndicatorMap(): Map<number, string> {
  // indexes.json is a flat array of {id, numeric_id, name, sector, org, ...}.
  // recipes_aggregated.indicator_fingerprint stores the smallint numeric_id;
  // we map back to the human-readable name for the frontend.
  const file = JSON.parse(readFileSync(INDEXES, "utf-8")) as IndicatorIndexFile;
  const m = new Map<number, string>();
  for (const e of file) {
    m.set(Number(e.numeric_id), e.name);
  }
  return m;
}

function parseLengthDistribution(s: string): LengthBucket[] {
  // s is JSON from json_format(cast(... as JSON)): [{"length":5,"count":12}, ...]
  if (!s) return [];
  const arr = JSON.parse(s) as Array<{ length: number; count: number }>;
  return arr.map((e) => ({ length: Number(e.length), count: Number(e.count) }));
}

function parseFingerprint(
  s: string,
  indicatorMap: Map<number, string>
): FingerprintEntry[] {
  // s is JSON: [{"indicator_id":42,"frequency":0.412,...}, ...]
  if (!s) return [];
  const arr = JSON.parse(s) as Array<{
    indicator_id: number;
    frequency: number;
    ci_lower: number;
    ci_upper: number;
    avg_corr_magnitude: number;
    tfidf_score: number;
  }>;
  return arr.map((e) => {
    const id = Number(e.indicator_id);
    return {
      indicator_id: id,
      indicator_name: indicatorMap.get(id) ?? `(unknown ${id})`,
      frequency: Number(e.frequency),
      ci_lower: Number(e.ci_lower),
      ci_upper: Number(e.ci_upper),
      avg_corr_magnitude: Number(e.avg_corr_magnitude),
      tfidf_score: Number(e.tfidf_score),
    };
  });
}

function parseCoverageBias(s: string): CoverageBiasDiagnostic {
  // s is JSON: {"n_pairs":12,"oecd_share":0.3,"regional_concentration":[...]}
  if (!s) return { n_pairs: 0, oecd_share: 0, regional_concentration: [] };
  const obj = JSON.parse(s) as {
    n_pairs: number;
    oecd_share: number;
    regional_concentration: Array<{ region: string; share: number }>;
  };
  return {
    n_pairs: Number(obj.n_pairs),
    oecd_share: Number(obj.oecd_share),
    regional_concentration: (obj.regional_concentration ?? []).map((r) => ({
      region: String(r.region),
      share: Number(r.share),
    })),
  };
}

async function main() {
  console.log("[bake-recipes-aggregated] Connecting to Athena...");
  const client = new AthenaClient({ region: REGION });
  const indicatorMap = buildIndicatorMap();
  console.log(
    `[bake-recipes-aggregated] Loaded ${indicatorMap.size} indicator name mappings from indexes.json`
  );

  // Sort by total_instances DESC so high-salience recipes appear first.
  // Complex types (array<struct>, struct) are serialised via
  // `json_format(cast(... as JSON))` since direct cast-to-varchar isn't
  // supported in Athena for these shapes.
  const sql = `
    SELECT
      event_category,
      cast(canonical_length as varchar) as canonical_length,
      json_format(cast(length_distribution as JSON)) as length_distribution_json,
      json_format(cast(indicator_fingerprint as JSON)) as indicator_fingerprint_json,
      json_format(cast(coverage_bias_diagnostic as JSON)) as coverage_bias_diagnostic_json,
      cast(total_instances as varchar) as total_instances,
      cast(n_distinct_country_pairs as varchar) as n_distinct_country_pairs,
      cast(last_recomputed_at as varchar) as last_recomputed_at,
      pipeline_version,
      cast(schema_version as varchar) as schema_version,
      cast(coalesce(contains_predicted, false) as varchar) as contains_predicted
    FROM ${DB}.recipes_aggregated
    ORDER BY total_instances DESC
  `;

  console.log("[bake-recipes-aggregated] Running Athena query...");
  const rows = await runQuery(client, sql);
  console.log(`[bake-recipes-aggregated] Got ${rows.length} recipes`);

  let pipelineVersion = "v2.0-baked";
  let schemaVersion = 1;
  const recipes: RecipeAggregated[] = rows.map((r) => {
    const [
      event_category,
      canonical_length,
      length_distribution,
      indicator_fingerprint,
      coverage_bias_diagnostic,
      total_instances,
      n_distinct_country_pairs,
      last_recomputed_at,
      pipeline_version,
      schema_version,
      contains_predicted,
    ] = r;
    pipelineVersion = pipeline_version;
    schemaVersion = Number(schema_version);
    return {
      event_category,
      canonical_length: Number(canonical_length),
      length_distribution: parseLengthDistribution(length_distribution),
      indicator_fingerprint: parseFingerprint(indicator_fingerprint, indicatorMap),
      coverage_bias_diagnostic: parseCoverageBias(coverage_bias_diagnostic),
      total_instances: Number(total_instances),
      n_distinct_country_pairs: Number(n_distinct_country_pairs),
      last_recomputed_at,
      contains_predicted: contains_predicted === "true",
    };
  });

  const out: RecipesAggregatedFile = {
    generated_at: new Date().toISOString(),
    pipeline_version: pipelineVersion,
    schema_version: schemaVersion,
    recipes,
  };

  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(
    `[bake-recipes-aggregated] Wrote ${OUT} (${recipes.length} recipes, ${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
