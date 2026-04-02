import os
import logging
import json
import gzip
import time
import random
import boto3
import pandas as pd
import wbgapi as wb
import hashlib
from io import StringIO

S3_BUCKET = os.environ.get('S3_BUCKET')
S3_INPUT_PREFIX = os.environ.get('S3_INPUT_PREFIX')
S3_OUTPUT_PREFIX = os.environ.get('S3_OUTPUT_PREFIX')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('DYNAMODB_TABLE')
table = dynamodb.Table(TABLE_NAME)
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

COUNTRIES_CSV_KEY = f"{S3_INPUT_PREFIX}/countries.csv"

class ETLWorker:
    def __init__(self):
        self.country_mapping = None

    def _get_country_mapping(self):
        # ... (Same as before) ...
        if self.country_mapping is None:
            logger.info(f"Loading country mapping from s3://{S3_BUCKET}/{COUNTRIES_CSV_KEY}")
            obj = s3_client.get_object(Bucket=S3_BUCKET, Key=COUNTRIES_CSV_KEY)
            df = pd.read_csv(StringIO(obj['Body'].read().decode('utf-8')))
            df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
            if 'name_1' in df.columns:
                 mapping = {}
                 for col in df.columns:
                     if col != 'name_1':
                         temp_map = df.dropna(subset=[col]).set_index(col)['name_1'].to_dict()
                         mapping.update(temp_map)
                 self.country_mapping = mapping
            else:
                 raise ValueError("countries.csv missing 'name_1' column")
        return self.country_mapping

    def get_remote_hash(self, key):
        """Gets the custom content hash from S3 metadata."""
        try:
            response = s3_client.head_object(Bucket=S3_BUCKET, Key=key)
            return response['Metadata'].get('content_hash')
        except:
            return None

    def update_state(self, run_id, indicator_id, status):
        """Writes the result to DynamoDB."""
        if not run_id: return
        try:
            # Set TTL for 30 days from now
            expire_at = int(time.time()) + (30 * 24 * 60 * 60)
            table.put_item(Item={
                'run_id': run_id,
                'indicator_id': indicator_id,
                'status': status, # 'UPDATED', 'UNCHANGED', 'FAILED', 'SKIPPED'
                'timestamp': int(time.time()),
                'expire_at': expire_at
            })
        except Exception as e:
            logger.error(f"Failed to update DynamoDB: {e}", exc_info=True)
            raise

    def _fetch_with_retry(self, indicator_id: str, max_attempts=5) -> pd.DataFrame:
        """Fetches data with custom exponential backoff for 429 errors."""
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"Fetching {indicator_id} (Attempt {attempt}/{max_attempts})")
                return wb.data.DataFrame(indicator_id)
            except wb.APIError as e:
                if attempt == max_attempts:
                    logger.error(f"Final attempt failed for {indicator_id}: {e}")
                    raise e
                # Exponential backoff: 10s, 20s, 40s, 80s...
                sleep_time = (10 * (2 ** (attempt - 1))) + random.uniform(0, 5)
                logger.warning(f"Got APIError for {indicator_id}. Retrying in {sleep_time:.2f}s... Error: {e}")
                time.sleep(sleep_time)
            except Exception as e:
                # Don't retry other errors (like network issues) blindly here, let SQS handle them
                logger.error(f"Non-retriable error for {indicator_id}: {e}")
                raise e

    def run(self, indicator_id: str, run_id: str = None):
        logger.info(f"--- START WORKER for {indicator_id} (RunID: {run_id}) ---")

        wait_time = random.uniform(5.0, 300) # 5 seconds to 5 minutes
        logger.info(f"Adding random jitter of {wait_time:.2f} seconds")
        time.sleep(wait_time)
        
        try:
            # 1. EXTRACT
            raw_df = self._fetch_with_retry(indicator_id)
            if raw_df.empty:
                self.update_state(run_id, indicator_id, "SKIPPED")
                return

            # 2. TRANSFORM
            mapping = self._get_country_mapping()
            df = raw_df.dropna(axis="columns", how="all").copy()
            df["economy"] = df.index
            df_long = pd.melt(df, id_vars=["economy"], var_name="year", value_name="value")
            df_long["year"] = df_long["year"].str.extract(r"(\d+)").astype(int)
            df_long = df_long.rename(columns={"economy": "country"})
            df_long["country"] = df_long["country"].map(mapping).fillna(df_long["country"])
            canonical_names = set(mapping.values())
            df_long = df_long[df_long["country"].isin(canonical_names)]
            final_df = df_long.dropna(subset=['value']).sort_values(by=["country", "year"])

            # 3. HASHING & CHECK logic
            # Convert to CSV string (deterministic) to calculate hash
            csv_str = final_df.to_csv(index=False)
            new_hash = hashlib.md5(csv_str.encode('utf-8')).hexdigest()
            
            output_key = f"{S3_OUTPUT_PREFIX}/csv/{indicator_id}/{indicator_id}.csv.gz"
            
            # Check existing S3 Metadata
            existing_hash = self.get_remote_hash(output_key)

            if existing_hash == new_hash:
                logger.info(f"Hash match ({new_hash}). Data unchanged. Skipping upload.")
                self.update_state(run_id, indicator_id, "UNCHANGED")
                return

            # 4. LOAD (Only if changed)
            logger.info(f"Hash mismatch (Old: {existing_hash} | New: {new_hash}). Uploading.")
            
            # Create reproducible GZIP (mtime=0) to ensure binary stability if needed later
            csv_buffer = gzip.compress(csv_str.encode('utf-8'), mtime=0)
            
            s3_client.put_object(
                Bucket=S3_BUCKET, 
                Key=output_key, 
                Body=csv_buffer,
                Metadata={'content_hash': new_hash} # Store hash for next time
            )
            self.update_state(run_id, indicator_id, "UPDATED")
            logger.info(f"SUCCESS: Saved s3://{S3_BUCKET}/{output_key}")

        except Exception as e:
            self.update_state(run_id, indicator_id, "FAILED")
            raise e

# Initialize outside handler for warm starts
worker = ETLWorker()


def lambda_handler(event, context):
    for record in event['Records']:
        try:
            payload = json.loads(record['body'])
            indicator_id = payload['id_string']
            # EXTRACT RUN_ID from payload
            run_id = payload.get('run_id') 
            
            worker.run(indicator_id, run_id)
        except Exception as e:
            # Log the specific message ID that failed
            logger.error(f"FAILED processing message {record['messageId']}: {e}", exc_info=True)
            raise e # CRITICAL: Raise so SQS knows to retry this message later!
