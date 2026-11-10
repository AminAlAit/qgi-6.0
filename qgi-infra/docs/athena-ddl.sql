-- QGI Data Lake — Athena/Glue Table DDL
-- Database: qgi_data
-- Region: eu-central-1
-- State backend: s3://qgi-data-lake-111111111111/
--
-- These tables are managed by the QGI pipeline (hand-built, pending Terraform in qgi-infra).
-- Run these in Athena workgroup: primary

-- ---------------------------------------------------------------------------
-- scdis  (output of Pipeline B — scdi-finder)
-- Partitioned by country_a_id for efficient country-pair queries
-- ---------------------------------------------------------------------------
CREATE EXTERNAL TABLE `qgi_data`.`scdis` (
  `country_b_id`       smallint,
  `length`             smallint,
  `start_year_a`       smallint,
  `start_year_b`       smallint,
  `correlation`        float,
  `indicator_numeric_id` smallint
)
PARTITIONED BY (`country_a_id` smallint)
STORED AS PARQUET
LOCATION 's3://qgi-data-lake-111111111111/pipeline-B-scdi-finder/scdis-compacted/'
TBLPROPERTIES ('parquet.compress'='SNAPPY');

-- Refresh partitions after a Pipeline B run:
-- MSCK REPAIR TABLE qgi_data.scdis;

-- ---------------------------------------------------------------------------
-- patterns  (output of Pipeline C — pattern synthesizer)
-- Partitioned by country_a_id
-- ---------------------------------------------------------------------------
CREATE EXTERNAL TABLE `qgi_data`.`patterns` (
  `pattern_id`              string,
  `country_b_id`            smallint,
  `length`                  smallint,
  `start_year_a`            smallint,
  `start_year_b`            smallint,
  `indicator_count`         bigint,
  `avg_correlation`         double,
  `pattern_power_score`     double,
  `indicator_numeric_ids`   array<smallint>
)
PARTITIONED BY (`country_a_id` smallint)
STORED AS PARQUET
LOCATION 's3://qgi-data-lake-111111111111/pipeline-C-pattern-synthesizer/output/data/'
TBLPROPERTIES ('parquet.compress'='SNAPPY');

-- ---------------------------------------------------------------------------
-- pattern_indicator_map  (output of Pipeline C — maps patterns to indicators)
-- ---------------------------------------------------------------------------
CREATE EXTERNAL TABLE `qgi_data`.`pattern_indicator_map` (
  `indicator_id` string
)
PARTITIONED BY (`pattern_id` string)
STORED AS PARQUET
LOCATION 's3://qgi-data-lake-111111111111/pipeline-C-pattern-synthesizer/output/map_data/'
TBLPROPERTIES ('parquet.compress'='SNAPPY');

-- ---------------------------------------------------------------------------
-- countries  (reference table — input to Pipeline A)
-- CSV, no partitions
-- Note: columns are name_1..name_20 (multiple name variants per country)
-- ---------------------------------------------------------------------------
CREATE EXTERNAL TABLE `qgi_data`.`countries` (
  `0_index_id`   string,
  `id`           string,
  `name_1`       string,
  `name_2`       string,
  `name_3`       string,
  `name_4`       string,
  `name_5`       string,
  `name_6`       string,
  `name_7`       string,
  `name_8`       string,
  `name_9`       string,
  `name_10`      string,
  `alpha_2`      string,
  `alpha_3`      string,
  `numeric_code` string,
  `name_11`      string,
  `name_12`      string,
  `name_13`      string,
  `name_14`      string,
  `name_15`      string,
  `name_16`      string,
  `name_17`      string,
  `name_18`      string,
  `name_19`      string,
  `name_20`      string
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
LOCATION 's3://qgi-data-lake-111111111111/pipeline-A-indicator-extractor/input/'
TBLPROPERTIES ('skip.header.line.count'='1');

-- ---------------------------------------------------------------------------
-- Stale / temp tables found in qgi_data (to be dropped — see qgi-aws-tf issues)
-- scdis_a7f626b69d804cdac07d217d6c4e1255
-- temp_table_a5fae7aa57ea4264a2dc4f18cfa3c883
-- temp_table_b0476606dd8545a39656ecf35900ffce
-- ---------------------------------------------------------------------------
