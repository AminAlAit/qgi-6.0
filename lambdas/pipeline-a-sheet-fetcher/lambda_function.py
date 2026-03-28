import boto3
import os
import json
import pandas as pd
import io
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')

# Env Vars:
# INPUT_BUCKET: qgi-data-lake-111111111111
# INPUT_KEY: pipeline-A-indicator-extractor/indicators/Pipeline A Dispatcher World Bank Indicators.xlsx
# OUTPUT_BUCKET: qgi-data-lake-111111111111
# OUTPUT_KEY: indicators/indicators.json

def lambda_handler(event, context):
    try:
        input_bucket = os.environ['INPUT_BUCKET']
        input_key = os.environ['INPUT_KEY']
        output_bucket = os.environ['OUTPUT_BUCKET']
        output_key = os.environ['OUTPUT_KEY']

        logger.info(f"Reading Excel from s3://{input_bucket}/{input_key}")

        # 1. Get object from S3
        response = s3_client.get_object(Bucket=input_bucket, Key=input_key)
        file_content = response['Body'].read()

        # 2. Read Excel into Pandas DataFrame
        # explicitly asking for 'phase_2_indicators'
        # engine='openpyxl' is included in the AWS SDK Pandas Layer
        try:
            df = pd.read_excel(
                io.BytesIO(file_content), 
                engine='openpyxl', 
                sheet_name='phase_2_indicators' 
            )
        except ValueError as ve:
            # If the sheet name is wrong, pandas throws a ValueError
            logger.error(f"Sheet 'phase_2_indicators' not found. Available sheets unknown.")
            raise ve

        # 3. Clean and Transform
        # Ensure column names are stripped of whitespace
        df.columns = df.columns.str.strip()
        
        indicators = []
        for index, row in df.iterrows():
            # Basic validation: Skip if ID or Numeric ID is missing
            if pd.isna(row.get('id_string')) or pd.isna(row.get('numeric_id')):
                continue

            indicators.append({
                "id_string": str(row['id_string']).strip(),
                "numeric_id": int(row['numeric_id']),
                "name": str(row['name']).strip(),
                # Handle status safely
                "status": str(row['status']).strip().lower() if not pd.isna(row.get('status')) else "hold"
            })

        if not indicators:
            raise ValueError("No valid indicators found in the Excel file.")

        # 4. Save as JSON
        output_body = json.dumps({"indicators": indicators}, indent=2)

        s3_client.put_object(
            Bucket=output_bucket,
            Key=output_key,
            Body=output_body,
            ContentType='application/json'
        )
        
        logger.info(f"Successfully saved {len(indicators)} indicators to s3://{output_bucket}/{output_key}")
        return {"status": "Success", "indicators_fetched": len(indicators)}

    except Exception as e:
        logger.error(f"Sheet Fetcher Failed: {e}", exc_info=True)
        raise e
