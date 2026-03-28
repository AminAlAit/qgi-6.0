import boto3
import os
import logging
import json

logger = logging.getLogger()
logger.setLevel(logging.INFO)

batch_client = boto3.client('batch')

def lambda_handler(event, context):
    """
    Terminates all active jobs in a specified AWS Batch job queue.
    """
    job_queue = os.environ.get('BATCH_JOB_QUEUE')
    # The reason for termination will be passed in the Lambda's test event
    reason = event.get('reason', 'Manual termination triggered by Lambda.')

    if not job_queue:
        logger.error("FATAL: BATCH_JOB_QUEUE environment variable not set.")
        return {'statusCode': 500, 'body': 'Internal configuration error.'}

    logger.info(f"Starting termination process for all active jobs in queue: {job_queue}")
    
    # These are all the states that represent a job that is not in a terminal state
    active_statuses = ['SUBMITTED', 'PENDING', 'RUNNABLE', 'STARTING', 'RUNNING']
    terminated_job_ids = []

    for status in active_statuses:
        logger.info(f"--- Checking for jobs in '{status}' state ---")
        try:
            paginator = batch_client.get_paginator('list_jobs')
            pages = paginator.paginate(jobQueue=job_queue, jobStatus=status)
            
            for page in pages:
                for job in page.get('jobSummaryList', []):
                    job_id = job['jobId']
                    job_name = job['jobName']
                    logger.info(f"Terminating job '{job_name}' (ID: {job_id}) with reason: {reason}")
                    try:
                        batch_client.terminate_job(
                            jobId=job_id,
                            reason=reason
                        )
                        terminated_job_ids.append(job_id)
                    except Exception as e:
                        # This can happen if the job finishes between the list and terminate calls
                        logger.warning(f"Could not terminate job {job_id}. It may have already completed. Error: {e}")
        except Exception as e:
            logger.error(f"Failed to list or process jobs with status {status}. Error: {e}", exc_info=True)
            continue # Continue to the next status

    summary = f"Termination process complete. Terminated {len(terminated_job_ids)} jobs in queue '{job_queue}'."
    logger.info(summary)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': summary,
            'terminated_job_ids': terminated_job_ids
        })
    }