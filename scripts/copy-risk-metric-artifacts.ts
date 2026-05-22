/**
 * Copy risk-metric artifacts from qgi-data/reference/ into
 * qgi-frontend/data/risk-metric/ so the recipe page loader can read them.
 *
 * Run once after qgi-data#56 merges (or re-run to refresh):
 *   npx tsx scripts/copy-risk-metric-artifacts.ts
 *
 * Source: ../qgi-data/reference/  (relative to qgi-frontend/)
 * Dest:   data/risk-metric/
 *
 * Files copied for each graduated recipe:
 *   - shap-importances-{recipeId}.json
 *   - recipe-similarity-scores-{recipeId}-{year}.json
 *   - similarity-validations-{recipeId}.json
 *   - panel-wide-z-distribution-{year}.json
 *
 * Also copies top-3 audit chart PNGs to:
 *   public/risk-metric/{recipeId}/{country}-vs-{recipeId}.png
 *
 * Source for PNGs: ../../../tmp/qgi-rnd-002/risk-metric-artifacts/audit-charts/
 * (the tmp directory from the qgi-ml pipeline run, per miriam_m14_r4 rider)
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, "..");
const QGIDATA_REF = join(FRONTEND_ROOT, "..", "qgi-data", "reference");

// ── JSON artifacts ───────────────────────────────────────────────────────────

const RECIPE_ID = "foreign_intervention";
const YEAR = 2021;

const DEST_JSON = join(FRONTEND_ROOT, "data", "risk-metric");
mkdirSync(DEST_JSON, { recursive: true });

const jsonArtifacts = [
  `shap-importances-${RECIPE_ID}.json`,
  `recipe-similarity-scores-${RECIPE_ID}-${YEAR}.json`,
  `similarity-validations-${RECIPE_ID}.json`,
  `panel-wide-z-distribution-${YEAR}.json`,
];

for (const file of jsonArtifacts) {
  const src = join(QGIDATA_REF, file);
  const dst = join(DEST_JSON, file);
  if (!existsSync(src)) {
    console.error(`MISSING: ${src}`);
    process.exit(1);
  }
  copyFileSync(src, dst);
  console.log(`Copied: ${file}`);
}

// ── Audit chart PNGs (top-3 HIGH-zone countries) ─────────────────────────────

// The tmp path is from the qgi-ml pipeline run; adjust if your tmp dir differs.
// Per miriam_m14_r4 BINDING: top-10 trajectory overlays archived at:
//   C:\tmp\qgi-rnd-002\risk-metric-artifacts\audit-charts\foreign_intervention\
const PNG_SRC_DIR = join(
  "C:\\tmp\\qgi-rnd-002\\risk-metric-artifacts\\audit-charts",
  RECIPE_ID
);
const PNG_DEST_DIR = join(FRONTEND_ROOT, "public", "risk-metric", RECIPE_ID);
mkdirSync(PNG_DEST_DIR, { recursive: true });

const TOP3_COUNTRIES = ["Iran", "Algeria", "Syria"];

for (const country of TOP3_COUNTRIES) {
  const filename = `${country.replace(/\s+/g, "_")}-vs-${RECIPE_ID}.png`;
  const src = join(PNG_SRC_DIR, filename);
  const dst = join(PNG_DEST_DIR, filename);
  if (!existsSync(src)) {
    console.warn(
      `WARNING: audit chart not found at ${src} — skipping PNG for ${country}`
    );
    continue;
  }
  copyFileSync(src, dst);
  console.log(`Copied PNG: ${filename}`);
}

console.log("\nDone. Commit data/risk-metric/ + public/risk-metric/ to the branch.");
