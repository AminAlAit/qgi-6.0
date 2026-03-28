import boto3
import os
import json
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')
lambda_client = boto3.client('lambda')

TABLE_NAME = "qgi-indicator-updates"
SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN'] # Create an SNS topic for your email
PIPELINE_B_ARN = os.environ['PIPELINE_B_ARN'] # Orchestrator ARN

def lambda_handler(event, context):
    run_id = event.get('run_id') # Passed from Step Function
    if not run_id:
        return {"status": "Error", "message": "No run_id provided"}

    table = dynamodb.Table(TABLE_NAME)
    
    # Query all items for this run_id
    response = table.query(KeyConditionExpression=Key('run_id').eq(run_id))
    items = response['Items']
    
    # Aggregate results
    updated = [i['indicator_id'] for i in items if i['status'] == 'UPDATED']
    failed = [i['indicator_id'] for i in items if i['status'] == 'FAILED']
    unchanged_count = len([i for i in items if i['status'] == 'UNCHANGED'])
    
    message = (
        f"QGI Monthly Update Report (RunID: {run_id})\n"
        f"------------------------------------------------\n"
        f"Total Processed: {len(items)}\n"
        f"Unchanged:       {unchanged_count}\n"
        f"Failed:          {len(failed)}\n"
        f"Updated:         {len(updated)}\n\n"
    )
    
    if failed:
        message += f"FAILED INDICATORS:\n{', '.join(failed)}\n\n"
        
    if updated:
        message += f"UPDATED INDICATORS (Triggering Pipeline B):\n{', '.join(updated)}"
    else:
        message += "No updates found. Pipeline B will NOT be triggered."

    # 1. Notify User
    sns.publish(
        TopicArn=SNS_TOPIC_ARN,
        Subject=f"QGI Update: {len(updated)} Changes",
        Message=message
    )

    # 2. Trigger Pipeline B (If there are updates)
    if updated:
        # Construct the "Surgical" payload for Pipeline B
        pipeline_b_payload = {
            "mode": "invoke",
            "indicator_ids": updated # Pass the specific list!
        }
        
        # Invoke asynchronously
        lambda_client.invoke(
            FunctionName=PIPELINE_B_ARN,
            InvocationType='Event',
            Payload=json.dumps(pipeline_b_payload)
        )

    return {
        "status": "Complete", 
        "updated_count": len(updated),
        "updated_ids": updated 
    }
