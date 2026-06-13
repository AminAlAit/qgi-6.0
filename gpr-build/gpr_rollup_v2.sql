-- ============================================================================
-- QGI-GPR v2  -  per-(country, month) GPR-category roll-up from GDELT GKG 2.1
-- ----------------------------------------------------------------------------
-- TARGET TABLE: qgi_gdelt.gkg_gpr_flags_v2  (NEW table; never touches v1)
-- DICTIONARY:   gpr-theme-dictionary-v3.json (threat-skew fix + token-name bugfixes)
-- RENDERER:     gpr_rollup_v2.py  (or gpr_rollup_v2.py --phase A)
--
-- KEY DIFFERENCE vs gpr_rollup.sql (v1 table):
--   NEW COLUMN: matched_themes ARRAY<STRING>
--     = the GPR-relevant raw GKG theme tokens each doc matched, captured via
--     a BROAD-CAPTURE regex (a curated superset of all plausible
--     war/military/nuclear/terror/conflict/weapon/rebel/extremism/proliferation/
--     peacekeeping token families — the union of every category's gkg_themes
--     tokens plus close siblings).
--
--   PURPOSE: Future dictionary tweaks can RE-FLAG from this column (~$0.30 owned
--     read) instead of re-scanning raw GKG (~$10). Stores only the ~handful of
--     GPR-relevant tokens per doc (small footprint); all non-GPR tokens are
--     discarded at ingest time.
--
--   BROAD-CAPTURE REGEX (rendered by gpr_rollup_v2.py from broad_capture_regex
--     in the v3 dictionary — same single-source-of-truth pattern):
--     {{BROAD_CAPTURE_REGEX}}
--
-- PRE-CREDS. NOTHING HERE HAS BEEN RUN. Claude holds NO AWS/GCP creds
-- (qgi-aws-tf#809); the founder renders + runs this with a write role.
-- ALWAYS run --dry_run (default) for the FREE byte estimate and
-- get founder cost-ack BEFORE any real query (cost rule qgi-aws-tf#807).
--
-- ALSO INHERITS FROM gpr_rollup.sql:
--   * Same Phase A (one-time backfill) + Phase B (steady-state roll-up) structure.
--   * Same 5-column projection from raw GKG (never SELECT *).
--   * Same _PARTITIONTIME date-prune on every raw-GKG scan (cost driver).
--   * Same PARTITION BY event_date + CLUSTER BY country_code on the owned table.
--   * Same manifest guard (gpr_manifest_v2.json) prevents double-billing.
--   * Phase B reads ONLY the owned v2 table — free-tier.
-- ============================================================================


-- ////////////////////////////////////////////////////////////////////////////
-- PLACEHOLDER BLOCK (rendered by gpr_rollup_v2.py from gpr-theme-dictionary-v3.json)
-- ----------------------------------------------------------------------------
-- Placeholders resolved at render time:
--
--   {{CAT_FLAG_EXPRS}}      8 lines of:  REGEXP_CONTAINS(V2Themes, r'<re>') AS gN_<slug>
--   {{CAT_OR_LIST}}         g1_<slug> OR ... OR g8_<slug>   (for gpr_any)
--   {{CAT_LOGICAL_OR}}      8 lines of:  LOGICAL_OR(gN_<slug>) AS gN_<slug>   (doc-level collapse)
--   {{CAT_COL_DDL}}         8 lines of:  gN_<slug>  BOOL  (CREATE TABLE schema)
--   {{CAT_COUNTIF}}         8 lines of:  COUNTIF(gN_<slug>) AS gN_<slug>  (monthly counts)
--   {{THREATS_OR}}          g1 OR g2 OR g3 OR g4 OR g5   (Iacoviello threats half, cats 1-5)
--   {{ACTS_OR}}             g6 OR g7 OR g8               (Iacoviello acts half, cats 6-8)
--   {{COUNTRY_FILTER}}      AND country_code IN ('AR','EG',...)   (Phase B; optional)
--   {{PARTITION_START}}     '2015-02-18'
--   {{PARTITION_END}}       '2026-06-02'    (exclusive; full backfill)
--   {{SLICE_ID}}            '2015-02-18_2026-06-02'
--   {{OWNED_TABLE_V2}}      qgi_gdelt.gkg_gpr_flags_v2
--   {{PUBLIC_GKG}}          gdelt-bq.gdeltv2.gkg_partitioned
--   {{MONTH_START}}         '2015-02-01'
--   {{BROAD_CAPTURE_REGEX}} the broad-capture pattern from the v3 dictionary
-- ////////////////////////////////////////////////////////////////////////////


-- ----------------------------------------------------------------------------
-- PHASE A  -  one-time backfill into the OWNED v2 flag table  (CAUTION: raw scan)
-- ----------------------------------------------------------------------------
-- Full range: 2015-02-18 .. 2026-06-02 (same as v1 but slightly extended to
-- cover 2026-06-01 data; use yearly slices with --slice if needed).
-- Run gpr_rollup_v2.py --phase A --dry_run FIRST. Expected scan ~2.6 TB.

CREATE TABLE IF NOT EXISTS `{{OWNED_TABLE_V2}}`
(
  doc_id          STRING,          -- GKGRECORDID
  event_date      DATE,            -- PARSE_DATE over DATE (YYYYMMDDHHMMSS)
  country_code    STRING,          -- FIPS 10-4 2-letter; one row per (doc, country)
  slice_id        STRING,          -- backfill slice that wrote this row
                                   -- SELECT DISTINCT slice_id to audit coverage
  -- 8x  gN_<slug> BOOL, one per GPR category (rendered from the v3 dictionary):
  {{CAT_COL_DDL}}
  gpr_any         BOOL,            -- doc-OR across all 8 categories (headline flag)
  tone            FLOAT64,         -- V2Tone[0]; for P2 negative-tone threat-gate

  -- NEW (v2 table only): GPR-relevant raw tokens each doc matched.
  -- Populated via the BROAD-CAPTURE regex — a superset of all category tokens
  -- plus close siblings. Enables future re-flagging (~$0.30) without a raw rescan.
  matched_themes  ARRAY<STRING>
)
PARTITION BY event_date            -- date-partitioned for cheap Phase-B reads
CLUSTER BY country_code;           -- per-country reads ~100x cheaper; set BEFORE first insert


INSERT INTO `{{OWNED_TABLE_V2}}`
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
    fips AS country_code,        -- one country per doc-row; de-duped by GROUP BY below
    {{CAT_FLAG_EXPRS}},
    -- BROAD-CAPTURE: collect every GPR-relevant raw token this doc mentioned.
    -- This is the future-proofing column. The regex is a superset of all 8
    -- category gkg_themes plus siblings; it runs over the SAME V2Themes scan
    -- (no extra cost beyond the 5-col projection already selected above).
    ARRAY(
      SELECT t
      FROM UNNEST(SPLIT(V2Themes, ';')) AS t
      WHERE REGEXP_CONTAINS(t, r'{{BROAD_CAPTURE_REGEX}}')
    ) AS matched_themes
  FROM src, UNNEST(fips_list) AS fips
)
SELECT
  doc_id, event_date, country_code,
  {{SLICE_ID}} AS slice_id,     -- manifest audit key
  {{CAT_LOGICAL_OR}}
  LOGICAL_OR({{CAT_OR_LIST}}) AS gpr_any,
  MAX(tone) AS tone,
  -- For matched_themes: take the UNION of all per-country row values for the doc.
  -- Since matched_themes is doc-level (same V2Themes for every country row of the
  -- same doc), ARRAY_AGG + ARRAY_CONCAT gives the same array every time. Use the
  -- first non-empty value via ANY_VALUE to avoid a cross-join expansion.
  ANY_VALUE(matched_themes) AS matched_themes
FROM flagged
GROUP BY doc_id, event_date, country_code;   -- collapse to one row per (doc, country)


-- ----------------------------------------------------------------------------
-- PHASE B  -  steady-state per-(country, month) roll-up  (GO: OWNED read, free)
-- ----------------------------------------------------------------------------
-- Same as gpr_rollup.sql Phase B but reads gkg_gpr_flags_v2.
-- matched_themes is not aggregated here (it's a doc-level column; Phase B is
-- the monthly roll-up). Use Phase A table directly if you need matched_themes.

SELECT
  country_code,
  FORMAT_DATE('%Y-%m', event_date)                       AS month,
  COUNT(DISTINCT doc_id)                                 AS total_docs,

  -- per-category matched-doc counts (g1..g8)
  {{CAT_COUNTIF}}

  -- blended GPR-proxy: matched docs and share
  COUNTIF(gpr_any)                                       AS gpr_matched,
  SAFE_DIVIDE(COUNTIF(gpr_any), COUNT(DISTINCT doc_id))  AS gpr_share,

  -- Iacoviello threats/acts split (cats 1-5 / cats 6-8)
  COUNTIF({{THREATS_OR}})                                AS threats_matched,
  SAFE_DIVIDE(COUNTIF({{THREATS_OR}}), COUNT(DISTINCT doc_id)) AS threats_share,
  COUNTIF({{ACTS_OR}})                                   AS acts_matched,
  SAFE_DIVIDE(COUNTIF({{ACTS_OR}}), COUNT(DISTINCT doc_id))    AS acts_share,

  AVG(tone)                                              AS avg_tone
FROM `{{OWNED_TABLE_V2}}`
WHERE event_date >= DATE({{MONTH_START}})                -- owned-table date prune
  {{COUNTRY_FILTER}}
GROUP BY country_code, month
ORDER BY country_code, month;

-- ============================================================================
-- FUTURE-PROOFING QUERY PATTERN (reference — not run as part of Phase B):
-- ============================================================================
-- When a new dictionary version changes which tokens count for a category,
-- re-flag from the owned v2 table WITHOUT re-scanning raw GKG:
--
--   SELECT
--     doc_id, event_date, country_code,
--     REGEXP_CONTAINS(
--       ARRAY_TO_STRING(matched_themes, ';'),
--       r'<NEW_CATEGORY_REGEX>'
--     ) AS new_g9_flag
--   FROM `qgi_gdelt.gkg_gpr_flags_v2`
--   WHERE event_date >= DATE('2015-02-01')
--
-- This reads only the owned v2 table (free-tier) and never touches raw GKG.
-- Cost: ~$0.30 for a full re-flag over the 11-year window vs ~$10 for a rescan.
-- ============================================================================
