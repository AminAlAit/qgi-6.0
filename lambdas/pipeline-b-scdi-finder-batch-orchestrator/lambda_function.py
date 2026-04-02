import boto3
import os
import pandas as pd
from io import BytesIO
import logging
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3_client = boto3.client('s3')
batch_client = boto3.client('batch')

def sanitize_for_batch(name: str) -> str:
    """Sanitizes a string for a valid AWS Batch job name."""
    name = name.replace(' ', '_').replace('.', '_')
    return re.sub(r'[^a-zA-Z0-9_-]', '', name)

def get_country_map(bucket: str) -> dict:
    """
    Loads the countries.csv file from S3 once and returns a name-to-id dictionary.
    """
    try:
        countries_key = "pipeline-A-indicator-extractor/input/countries.csv"
        logger.info(f"Loading countries mapping from s3://{bucket}/{countries_key}")
        countries_obj = s3_client.get_object(Bucket=bucket, Key=countries_key)
        countries_df = pd.read_csv(countries_obj['Body'])
        return {row["name_1"]: row["id"] for _, row in countries_df.iterrows()}
    except Exception as e:
        logger.error(f"FATAL: Failed to load and parse countries mapping file: {e}", exc_info=True)
        raise

def lambda_handler(event, context):
    bucket = os.environ.get('S3_BUCKET')
    input_prefix = os.environ.get('S3_INPUT_PREFIX')
    job_queue = os.environ.get('BATCH_JOB_QUEUE')
    job_definition = os.environ.get('BATCH_JOB_DEFINITION')

    if not all([bucket, input_prefix, job_queue, job_definition]):
        logger.error("FATAL: Missing one or more environment variables.")
        return {'statusCode': 500, 'body': 'Internal configuration error.'}
    
    mode = event.get("mode", "test")
    logger.info(f"Running in '{mode}' mode.")

    country_name_to_id_map = get_country_map(bucket)
    logger.info(f"Successfully loaded mapping for {len(country_name_to_id_map)} countries.")

    jobs_to_submit = []
    indicators_to_process = []
    
    # Check for a list of indicators, then a single indicator, else full scan.
    multiple_indicators = event.get("indicator_ids") # Plural list
    single_indicator = event.get("indicator_id")   # Singular string

    if multiple_indicators:
        logger.info(f"Running in multi-indicator mode for: {multiple_indicators}")
        indicators_to_process = multiple_indicators
    elif single_indicator:
        logger.info(f"Running in single-indicator mode for: {single_indicator}")
        indicators_to_process = [single_indicator] # Put the single string into a list
    else:
        logger.info("Running in full-scan mode. Scanning S3 for all indicators...")
        try:
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=input_prefix, Delimiter='/')

            for page in pages:
                for prefix in page.get('CommonPrefixes', []):
                    indicator_id = prefix.get('Prefix').strip('/').split('/')[-1]
                    indicators_to_process.append(indicator_id)
        except Exception as e:
            logger.error(f"Error during S3 scanning: {e}", exc_info=True)
            return {'statusCode': 500, 'body': 'Failed during S3 scan.'}

    logger.info(f"Found {len(indicators_to_process)} indicator(s) to process.")

    for indicator_id in indicators_to_process:
        indicator_key = f"{input_prefix}{indicator_id}/{indicator_id}.parquet"
        logger.info(f"Processing indicator: {indicator_id}")

        try:
            obj = s3_client.get_object(Bucket=bucket, Key=indicator_key)
            df = pd.read_parquet(BytesIO(obj['Body'].read()))
            countries = df['country'].unique()

            for country_a_name in countries:
                country_a_id = country_name_to_id_map.get(country_a_name)
                
                if not country_a_id:
                    logger.warning(f"Skipping job for '{country_a_name}' as it was not found in the country mapping file.")
                    continue

                sane_indicator = sanitize_for_batch(indicator_id)
                sane_country = sanitize_for_batch(country_a_name)
                job_name = f"scdi-{sane_indicator}-{sane_country}"
                
                jobs_to_submit.append({
                    "jobName": job_name[:128],
                    "jobQueue": job_queue,
                    "jobDefinition": job_definition,
                    "containerOverrides": {
                        'environment': [
                            {'name': 'INDICATOR_ID', 'value': indicator_id},
                            {'name': 'COUNTRY_A_NAME', 'value': country_a_name}
                        ]
                    }
                })
        except Exception as e:
            logger.error(f"Could not read or process indicator {indicator_id}: {e}", exc_info=True)
            continue

    logger.info(f"Phase 1 Complete. Collected {len(jobs_to_submit)} total jobs.")

    if mode == "debug":
        num_to_process = event.get("number_of_countries_to_process", 1)
        logger.info(f"Debug Mode: Attempting to submit up to {num_to_process} jobs.")
        debug_output_prefix = "pipeline-B-scdi-finder/debug-output"
        submitted_count = 0
        for job_params in jobs_to_submit:
            if submitted_count >= num_to_process: break
            job_params["containerOverrides"]["environment"].append({'name': 'S3_DEBUG_OUTPUT_PREFIX', 'value': debug_output_prefix})
            job_params["jobName"] = "debug-" + job_params["jobName"]
            try:
                batch_client.submit_job(**job_params)
                submitted_count += 1
            except Exception as e:
                logger.error(f"Failed to submit debug job {job_params['jobName']}: {e}")
                continue
        logger.info(f"Debug mode complete. Successfully submitted {submitted_count} jobs.")
        return {'statusCode': 200, 'body': f"Successfully submitted {submitted_count} debug jobs."}

    elif "invoke" in mode:
        logger.info("Phase 2: Submitting all jobs to AWS Batch...")
        submitted_count = 0
        for job_params in jobs_to_submit:
            try:
                batch_client.submit_job(**job_params)
                submitted_count += 1
                if mode == "invoke_5":
                    if submitted_count > 4:
                        break
            except Exception as e:
                logger.error(f"Failed to submit job {job_params['jobName']}: {e}")
                continue
        logger.info(f"Phase 2 Complete. Successfully submitted {submitted_count} of {len(jobs_to_submit)} jobs.")
        return {'statusCode': 200, 'body': f'Successfully submitted {submitted_count} of {len(jobs_to_submit)} jobs.'}
    
    else: # This will catch 'test' mode
        logger.info("Phase 2 Skipped. Running in 'test' mode (dry run).")
        return {'statusCode': 200, 'body': f'Dry run complete. Collected {len(jobs_to_submit)} jobs.'}
