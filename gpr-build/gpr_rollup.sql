-- ============================================================================
-- QGI-GPR  -  per-(country, month) GPR-category roll-up from GDELT GKG 2.1
-- ----------------------------------------------------------------------------
-- TEMPLATE. This file is NOT runnable as-is: the {{ ... }} placeholders are
-- rendered by gpr_rollup.py from gpr-theme-dictionary-v2.json (single source of
-- truth for the category theme-sets). Run the renderer to get executable SQL.
--
--   python gpr_rollup.py --phase B        # render + dry-run the owned-table read
--   python gpr_rollup.py --phase A --slice 2015-02-18 2016-01-01   # render Phase A
--
-- Build-plan : qgi-docs/internal/roadmap/qgi-gpr-build-plan.md  (T2.3, §3-§5)
-- Dictionary : qgi-ml/gpr-build/gpr-theme-dictionary-v2.json     (g1..g8 token RE2 families)
-- Answer key : qgi-ml/gpr-poc/data/gpr_export.xls                (SHAREH_CAT_1..8 + GPRC_<ISO3>)
--
-- PRE-CREDS. NOTHING HERE HAS BEEN RUN. Claude holds NO AWS/GCP creds
-- (qgi-aws-tf#809); the founder renders + runs this with a read-only role.
-- ALWAYS run gpr_rollup.py --dry_run (default) for the FREE byte estimate and
-- get founder cost-ack BEFORE any real query (cost rule qgi-aws-tf#807).
--
-- This is a re-implementation on a DIFFERENT corpus (GDELT machine-coded vs
-- Caldara-Iacoviello's ~10 newspapers) with a different normalization window.
-- It is a "GDELT re-implementation calibrated to Caldara-Iacoviello (2022)",
-- NEVER "the GPR".
--
-- Two phases mirror the proven owned-table pattern in seed_live_baseline.py /
-- update_pulse.py:
--   PHASE A (one-time, CAUTION): scan raw public GKG ONCE -> materialize the
--           OWNED, date-partitioned sibling table qgi_gdelt.gkg_gpr_flags
--           (one BOOL per GPR category g1..g8 + gpr_any + FIPS + tone). This is
--           the only expensive step. A SIBLING table, never a widening of the
--           already-paid 194M-row qgi_gdelt.gkg_topic_flags (widening it would
--           force a full rewrite of the closed/immutable partitions - the
--           never-rebuy rule in data/compiled_manifest.json).
--   PHASE B (steady-state, GO): read the OWNED table -> per-(country, month)
--           total_docs + per-category counts + blended share + threats/acts
--           split. Owned-table reads sit in the first 1 TB/month free tier.
--
-- COST CONTROLS baked in (qgi-aws-tf#807):
--   * _PARTITIONTIME date-prune on EVERY raw-GKG scan (the cost driver).
--   * SELECT only V2Themes, V2Locations, DATE, V2Tone, GKGRECORDID
--     (5-column projection; GKG is a wide table - selecting 5 cols cuts
--     bytes-scanned ~10-100x per build-plan §5). NO SELECT *.
--   * Phase B touches only the OWNED flag table, which is itself date-
--     partitioned -> reads are free-tier.
-- ============================================================================


-- ////////////////////////////////////////////////////////////////////////////
-- PLACEHOLDER BLOCK (rendered by gpr_rollup.py from gpr-theme-dictionary-v2.json)
-- ----------------------------------------------------------------------------
-- The renderer substitutes the following tokens. They are shown here so a human
-- can read the template; the rendered SQL inlines the real values.
--
--   {{CAT_FLAG_EXPRS}}     8 lines of:  REGEXP_CONTAINS(V2Themes, r'<g_k re>') AS gN_<slug>
--                          one per category; RE2 family = the confident
--                          dictionary.categories[].gkg_themes tokens joined with '|'.
--                          verify_on_creds tokens are DELIBERATELY excluded from the
--                          frozen P1 regex (added in a later vintage after creds-side
--                          enumeration of the TAX_* trees / WB_* node numbers).
--   {{CAT_OR_LIST}}        g1_<slug> OR g2_<slug> OR ... OR g8_<slug>   (for gpr_any)
--   {{CAT_LOGICAL_OR}}     8 lines of:  LOGICAL_OR(gN_<slug>) AS gN_<slug>   (doc-level collapse)
--   {{CAT_COUNTIF}}        8 lines of:  COUNTIF(gN_<slug>) AS gN_<slug>      (monthly counts)
--   {{THREATS_OR}}         g1 OR g2 OR g3 OR g4 OR g5   (Iacoviello threats half, cats 1-5)
--   {{ACTS_OR}}            g6 OR g7 OR g8               (Iacoviello acts half, cats 6-8)
--   {{COUNTRY_FILTER}}     AND country_code IN ('AR','EG',...)   (Phase B; FIPS list, optional)
--   {{PARTITION_START}}    '2015-02-18'    (Phase A slice lower bound, _PARTITIONTIME prune)
--   {{PARTITION_END}}      '2016-01-01'    (Phase A slice upper bound, exclusive)
--   {{OWNED_TABLE}}        qgi_gdelt.gkg_gpr_flags
--   {{PUBLIC_GKG}}         gdelt-bq.gdeltv2.gkg_partitioned
--   {{MONTH_START}}        '2015-02-01'    (Phase B owned-table prune lower bound)
--
-- The threat/act split is Iacoviello's orthogonal axis (GPRT = cats 1-5,
-- GPRA = cats 6-8), empirically confirmed against the answer key:
--   sum(SHAREH_CAT_1..5) ~ GPRHT (r=0.9889);  sum(SHAREH_CAT_6..8) ~ GPRHA (r=0.9994).
-- ////////////////////////////////////////////////////////////////////////////


-- ----------------------------------------------------------------------------
-- PHASE A  -  one-time backfill into the OWNED flag table  (CAUTION: raw scan)
-- ----------------------------------------------------------------------------
-- Run gpr_rollup.py --phase A --dry_run FIRST. Backfill in yearly slices (the
-- renderer takes --slice START END) so each query's bytes-billed stays cap-able
-- via --maximum_bytes_billed. CREATE the table on the first slice; the INSERT
-- body below runs for every slice (closed slices are never re-scanned - the
-- _PARTITIONTIME lower bound advances per the manifest ledger).

CREATE TABLE IF NOT EXISTS `{{OWNED_TABLE}}`
(
  doc_id        STRING,        -- GKGRECORDID
  event_date    DATE,          -- PARSE_DATE over DATE (YYYYMMDDHHMMSS)
  country_code  STRING,        -- FIPS 10-4 2-letter; one row per (doc, country)
  -- 8x  gN_<slug> BOOL, one per GPR category (rendered from the dictionary):
  {{CAT_COL_DDL}}
  gpr_any       BOOL,          -- doc-OR across all 8 categories (headline flag)
  tone          FLOAT64        -- V2Tone[0]; for the P2 negative-tone threat-gate experiment
)
PARTITION BY event_date;       -- owned table is date-partitioned for cheap Phase-B reads

INSERT INTO `{{OWNED_TABLE}}`
WITH src AS (
  SELECT
    GKGRECORDID AS doc_id,
    PARSE_DATE('%Y%m%d', SUBSTR(CAST(DATE AS STRING), 1, 8)) AS event_date,
    REGEXP_EXTRACT_ALL(V2Locations, r'#([A-Z]{2})#') AS fips_list,
    V2Themes,
    SAFE_CAST(SPLIT(V2Tone, ',')[OFFSET(0)] AS FLOAT64) AS tone
  FROM `{{PUBLIC_GKG}}`
  WHERE _PARTITIONTIME >= TIMESTAMP({{PARTITION_START}})   -- date-prune (REQUIRED, cost driver)
    AND _PARTITIONTIME <  TIMESTAMP({{PARTITION_END}})     -- slice upper bound (exclusive)
    AND V2Locations IS NOT NULL
    AND V2Themes   IS NOT NULL
),
flagged AS (
  SELECT
    doc_id, event_date, tone,
    fips AS country_code,        -- one country per doc-row; de-duped by the GROUP BY below
    {{CAT_FLAG_EXPRS}}
  FROM src, UNNEST(fips_list) AS fips
)
SELECT
  doc_id, event_date, country_code,
  {{CAT_LOGICAL_OR}}
  LOGICAL_OR({{CAT_OR_LIST}}) AS gpr_any,
  MAX(tone) AS tone
FROM flagged
GROUP BY doc_id, event_date, country_code;   -- collapse to one row per (doc, country)


-- ----------------------------------------------------------------------------
-- PHASE B  -  steady-state per-(country, month) roll-up  (GO: OWNED read, free)
-- ----------------------------------------------------------------------------
-- The query the validation / refresh path runs. Reads ONLY the owned flag table.
--   * total_docs  = COUNT(DISTINCT doc_id)  over ALL country docs that month
--                   (any theme / no theme). This is the denominator.
--                   NEVER sum(category flags) - categories overlap (a nuclear-
--                   armed-conflict article hits g2,g3,g4,g6), so each category is
--                   a doc-OR flag and the denominator is a separate DISTINCT count.
--   * gN          = COUNTIF(category flag)  - matched docs for that category.
--   * gpr_matched = COUNTIF(gpr_any)        - blended GPR-proxy numerator.
--   * gpr_share   = gpr_matched / total_docs  (the blended GPR-proxy share; in
--                   [0,1] because gpr_any is a single doc-level OR, unlike v1's
--                   additive 2-topic share that could exceed 1).
--   * threats / acts = Iacoviello's GPRT / GPRA split (cats 1-5 / cats 6-8),
--                   each a doc-OR over its half, divided by total_docs.

SELECT
  country_code,
  FORMAT_DATE('%Y-%m', event_date)                       AS month,
  COUNT(DISTINCT doc_id)                                 AS total_docs,

  -- per-category matched-doc counts (g1..g8)
  {{CAT_COUNTIF}}

  -- blended GPR-proxy: matched docs (doc-OR over all 8 cats) and its share
  COUNTIF(gpr_any)                                       AS gpr_matched,
  SAFE_DIVIDE(COUNTIF(gpr_any), COUNT(DISTINCT doc_id))  AS gpr_share,

  -- Iacoviello threats/acts split (orthogonal to the subject mapping)
  COUNTIF({{THREATS_OR}})                                AS threats_matched,
  SAFE_DIVIDE(COUNTIF({{THREATS_OR}}), COUNT(DISTINCT doc_id)) AS threats_share,
  COUNTIF({{ACTS_OR}})                                   AS acts_matched,
  SAFE_DIVIDE(COUNTIF({{ACTS_OR}}), COUNT(DISTINCT doc_id))    AS acts_share,

  AVG(tone)                                              AS avg_tone
FROM `{{OWNED_TABLE}}`
WHERE event_date >= DATE({{MONTH_START}})                -- owned-table date prune
  {{COUNTRY_FILTER}}
GROUP BY country_code, month
ORDER BY country_code, month;
-- ============================================================================
-- NOTE: any FIPS list rendered into {{COUNTRY_FILTER}} is ILLUSTRATIVE /
-- verify-on-creds. Several FIPS<->ISO3 codes are easy to get wrong (KS=South
-- Korea, SF=South Africa, SZ=Switzerland, GM=Germany, UP=Ukraine). Build the
-- authoritative map from a reference table before the real run - do not trust a
-- hand-entered list (dictionary verify_on_creds_punchlist).
-- ============================================================================
