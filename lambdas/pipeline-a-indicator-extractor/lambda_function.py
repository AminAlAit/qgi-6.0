"""ETL pipeline to extract World Bank indicators and load them to S3."""

import os
import logging
import json
import yaml
import boto3
import pandas as pd
import wbgapi as wb
from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple
from io import StringIO, BytesIO

# --- Environment Variables & S3 Client Initialization ---
S3_BUCKET = os.environ.get('S3_BUCKET')
S3_INPUT_PREFIX = os.environ.get('S3_INPUT_PREFIX')
S3_OUTPUT_PREFIX = os.environ.get('S3_OUTPUT_PREFIX')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()

s3_client = boto3.client('s3')
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

# --- Static Configuration ---
COUNTRIES_CSV_KEY = f"{S3_INPUT_PREFIX}/countries.csv"
INDICATORS_CONFIG_FILE = "indicators.yaml" # Master config file

# --- Data Classes for Structure ---
@dataclass
class IndicatorConfig:
    """Represents the configuration for a single indicator from the YAML file."""
    id_string: str
    numeric_id: int
    name: str
    status: str
    category: str
    description: str

@dataclass(frozen=True)
class ETLResult:
    """A summary of the completed ETL pipeline run."""
    processed_indicators: List[str]
    unmatched_economies: Dict[str, List[str]]
    output_location: str
    indicators_with_no_data: List[str]
    status: str = "Success"

class Indicator:
    """Data class to hold all information for a single indicator."""
    id: str = ""
    data: pd.DataFrame = pd.DataFrame()
    indicator_name: str = ""

# --- ETL Pipeline Components ---
class Extractor:
    """Extracts data from the World Bank API."""
    def execute(self, indicator_ids: List[str]) -> List[Indicator]:
        logger.info("Starting data extraction for %d indicators.", len(indicator_ids))
        extracted_indicators = [self._get_one_indicator(ind_id) for ind_id in indicator_ids]
        logger.info("Data extraction completed.")
        return extracted_indicators

    def _get_one_indicator(self, indicator_id: str) -> Indicator:
        logger.info(f"Fetching indicator: {indicator_id}")
        indicator = Indicator()
        indicator.id = indicator_id
        try:
            indicator.data = wb.data.DataFrame(indicator_id)
            # We no longer need to fetch metadata here, it's in our YAML
        except Exception as e:
            logger.error("Failed to fetch data for %s: %s", indicator_id, e)
            indicator.data = pd.DataFrame()
        return indicator

class Transformer:
    """Transforms the extracted indicator data into a clean, long format."""
    def __init__(self):
        self._country_mapping = self._create_country_mapping()

    def _create_country_mapping(self) -> Dict[str, str]:
        logger.info("Creating country mapping from S3 object: %s/%s", S3_BUCKET, COUNTRIES_CSV_KEY)
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=COUNTRIES_CSV_KEY)
            csv_content = response['Body'].read().decode('utf-8')
            ref_df = pd.read_csv(StringIO(csv_content))
            ref_df = ref_df.loc[:, ~ref_df.columns.str.contains("Unnamed")]
            if "name_1" not in ref_df.columns:
                raise KeyError("'name_1' column is missing in the country reference file.")
            
            mapping = {}
            for col in ref_df.columns:
                if col != "name_1":
                    temp_map = ref_df.dropna(subset=[col]).set_index(col)["name_1"].to_dict()
                    mapping.update(temp_map)
            return mapping
        except Exception as e:
            logger.error("Failed to create country mapping: %s", e)
            raise

    def execute(self, indicators: List[Indicator]) -> Tuple[List[Indicator], Dict[str, List[str]]]:
        logger.info("Starting data transformation.")
        unmatched_report = {}
        transformed_indicators = []
        for ind in indicators:
            if ind.data.empty:
                transformed_indicators.append(ind)
                continue
            transformed_ind, unmatched_list = self._transform_one(ind)
            transformed_indicators.append(transformed_ind)
            if unmatched_list:
                unmatched_report[ind.id] = unmatched_list
        logger.info("Data transformation completed.")
        return transformed_indicators, unmatched_report

    def _transform_one(self, indicator: Indicator) -> Tuple[Indicator, List[str]]:
        df = indicator.data.copy()
        df = df.dropna(axis="columns", how="all")
        df["economy"] = df.index
        df_long = pd.melt(df, id_vars=["economy"], var_name="year", value_name="value")
        df_long["year"] = df_long["year"].str.extract(r"(\d+)").astype(int)
        df_long = df_long.rename(columns={"economy": "country"})
        
        df_long["country"] = df_long["country"].map(self._country_mapping).fillna(df_long["country"])
        all_canonical_names = set(self._country_mapping.values())
        unmatched = list(set(val for val in df_long["country"] if val not in all_canonical_names))
        
        if unmatched:
            df_long = df_long[~df_long["country"].isin(unmatched)]
            
        indicator.data = df_long.sort_values(by=["country", "year"]).reset_index(drop=True)
        return indicator, unmatched

class Loader:
    """Loads transformed data and configuration artifacts to S3."""
    def execute(self, indicators: List[Indicator], indicators_config: List[IndicatorConfig]) -> List[str]:
        logger.info("Starting data loading to S3.")
        self._create_indicator_registry(indicators_config)
        self._create_indicator_map(indicators_config)
        
        skipped_indicators = []
        for indicator in indicators:
            if indicator.data.empty:
                logger.warning("Indicator %s has no data to save. Skipping.", indicator.id)
                skipped_indicators.append(indicator.id)
                continue
            
            try:
                output_key = f"{S3_OUTPUT_PREFIX}/parquet/{indicator.id}/{indicator.id}.parquet"
                parquet_buffer = BytesIO()
                indicator.data.to_parquet(parquet_buffer, index=False, engine='pyarrow', compression='snappy')
                s3_client.put_object(Bucket=S3_BUCKET, Key=output_key, Body=parquet_buffer.getvalue())
                logger.info("Successfully saved %s to s3://%s/%s", indicator.id, S3_BUCKET, output_key)
            except Exception as e:
                logger.error("Failed to save indicator %s to S3: %s", indicator.id, e)
                skipped_indicators.append(indicator.id)
                
        logger.info("Data loading completed.")
        return skipped_indicators

    def _create_indicator_registry(self, indicators_config: List[IndicatorConfig]):
        """Creates and saves a YAML file mapping indicator IDs to their names."""
        logger.info("Creating indicator registry YAML from config.")
        registry = {ind.id_string: ind.name for ind in indicators_config}
        registry_key = f"{S3_OUTPUT_PREFIX}/registry/indicator_registry.yaml"
        try:
            yaml_data = yaml.dump(registry, allow_unicode=True)
            s3_client.put_object(Bucket=S3_BUCKET, Key=registry_key, Body=yaml_data)
            logger.info("Indicator registry saved to s3://%s/%s", S3_BUCKET, registry_key)
        except Exception as e:
            logger.error("Failed to write indicator registry to S3: %s", e)

    def _create_indicator_map(self, indicators_config: List[IndicatorConfig]):
        """Creates and saves the indicator string-to-numeric-ID CSV map."""
        logger.info("Creating indicator numeric ID map CSV from config.")
        map_key = f"{S3_INPUT_PREFIX}/indicator_map.csv" # Note: writing to the INPUT prefix
        try:
            map_data = [{"indicator_id_string": ind.id_string, "indicator_numeric_id": ind.numeric_id} for ind in indicators_config]
            map_df = pd.DataFrame(map_data)
            csv_buffer = StringIO()
            map_df.to_csv(csv_buffer, index=False)
            s3_client.put_object(Bucket=S3_BUCKET, Key=map_key, Body=csv_buffer.getvalue())
            logger.info("Indicator map saved to s3://%s/%s", S3_BUCKET, map_key)
        except Exception as e:
            logger.error("Failed to write indicator map to S3: %s", e)

# --- Lambda Handler ---
def _load_indicator_config() -> List[IndicatorConfig]:
    """Loads and validates the master indicator config file."""
    logger.info(f"Loading master indicator config from '{INDICATORS_CONFIG_FILE}'")
    with open(INDICATORS_CONFIG_FILE, 'r') as f:
        config = yaml.safe_load(f)
    # Convert list of dicts to list of dataclass objects for type safety
    return [IndicatorConfig(**item) for item in config['indicators']]

def lambda_handler(event, context):
    """Orchestrates the ETL process from start to finish."""
    logger.info("ETL pipeline starting.")
    
    try:
        # 1. Load configuration and determine which indicators to process
        all_indicators_config = _load_indicator_config()
        indicators_to_process = [
            ind.id_string for ind in all_indicators_config if ind.status == "process"
        ]
        
        if not indicators_to_process:
            logger.warning("No indicators are marked for processing. Exiting.")
            return {'statusCode': 200, 'body': json.dumps({'status': 'Success', 'message': 'No indicators to process.'})}

        # Instantiate pipeline components
        extractor = Extractor()
        transformer = Transformer()
        loader = Loader()

        # 2. Extract Stage
        logger.info(f"Running extraction for {len(indicators_to_process)} indicators.")
        extracted_indicators = extractor.execute(indicators_to_process)

        # 3. Transform Stage
        transformed_indicators, unmatched_report = transformer.execute(extracted_indicators)

        # 4. Load Stage
        # Pass the full config to the loader so it can create a complete map
        skipped_indicators = loader.execute(transformed_indicators, all_indicators_config)

        logger.info("ETL pipeline completed successfully.")
        
        # 5. Create and return the result report
        result = ETLResult(
            processed_indicators=[ind.id for ind in transformed_indicators if not ind.data.empty],
            unmatched_economies=unmatched_report,
            output_location=f"s3://{S3_BUCKET}/{S3_OUTPUT_PREFIX}",
            indicators_with_no_data=skipped_indicators,
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps(asdict(result))
        }

    except Exception as e:
        logger.error("ETL pipeline failed: %s", str(e), exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'status': 'Failed', 'error': str(e)})
        }
