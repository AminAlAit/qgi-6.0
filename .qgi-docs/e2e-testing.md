# QGI Pipeline — E2E Testing Runbook

This document is mandatory reading before running any E2E test. Failure to follow these rules wastes money and time.

---

## Critical rules

### 1. Always cap at 2 indicators

**Never run an E2E test with more than 2 indicators.**

The full indicator set is ~260 rows. Even with `status=process` filtering, dispatching 50+ indicators:
- Takes 60–90 minutes just for Phase 1 (Lambda throttling on new accounts)
- Generates hundreds of Batch jobs (Phase 2)
- Produces gigabytes of Athena data (Phase 3/4)
- Costs real money

The `dispatch_limit` variable controls this. It is currently set to `2` in all environments' `main.tf`. **Do not change it before enabling the monthly schedule.**

### 2. Use a timestamped run ID

Always name executions `<env>-e2e-YYYYMMDD-HHMMSS` so runs are traceable in the Step Functions console.

### 3. Stop runaway executions immediately

If you accidentally start a run with the wrong limit, stop it immediately:
```bash
ROLE=$(aws sts assume-role --role-arn arn:aws:iam::<ACCOUNT_ID>:role/qgi-cross-account-ops --role-session-name stop --output json)
AK=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['AccessKeyId'])")
SK=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['SecretAccessKey'])")
ST=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['SessionToken'])")
AWS_ACCESS_KEY_ID=$AK AWS_SECRET_ACCESS_KEY=$SK AWS_SESSION_TOKEN=$ST \
  aws stepfunctions stop-execution \
  --execution-arn "<EXECUTION_ARN>" \
  --region eu-central-1
```

---

## How dispatch_limit works

`dispatch_limit` is set in each environment's `main.tf` module call:

```hcl
# environments/prod/main.tf
module "pipeline" {
  ...
  dispatch_limit = 2   # ← set to 0 only when enabling the real monthly schedule
}
```

The value flows to the `a-dispatcher` Lambda as `DISPATCH_LIMIT` env var. When `> 0`, the dispatcher slices `process_list[:DISPATCH_LIMIT]` before sending to SQS.

**Set to 0 only when** the monthly EventBridge schedule is being enabled for real production runs.

---

## Account IDs

| Environment | Account ID | State machine ARN |
|-------------|------------|-------------------|
| staging | `222222222222` | `arn:aws:states:eu-central-1:222222222222:stateMachine:qgi-indicator-monthly-updater` |
| qa | `333333333333` | `arn:aws:states:eu-central-1:333333333333:stateMachine:qgi-indicator-monthly-updater` |
| prod | `444444444444` | `arn:aws:states:eu-central-1:444444444444:stateMachine:qgi-indicator-monthly-updater` |

---

## Starting an E2E run

```bash
# 1. Assume the cross-account ops role
ACCOUNT_ID=444444444444   # change for staging/qa
ROLE=$(aws sts assume-role --role-arn arn:aws:iam::${ACCOUNT_ID}:role/qgi-cross-account-ops --role-session-name e2e --output json)
AK=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['AccessKeyId'])")
SK=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['SecretAccessKey'])")
ST=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['SessionToken'])")

# 2. Start execution
ENV=prod   # staging / qa / prod
RUN_ID="${ENV}-e2e-$(date -u +%Y%m%d-%H%M%S)"
AWS_ACCESS_KEY_ID=$AK AWS_SECRET_ACCESS_KEY=$SK AWS_SESSION_TOKEN=$ST \
  aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:eu-central-1:${ACCOUNT_ID}:stateMachine:qgi-indicator-monthly-updater \
  --name "$RUN_ID" \
  --region eu-central-1
echo "Started: $RUN_ID"
```

## Checking execution status

```bash
AWS_ACCESS_KEY_ID=$AK AWS_SECRET_ACCESS_KEY=$SK AWS_SESSION_TOKEN=$ST \
  aws stepfunctions get-execution-history \
  --execution-arn "arn:aws:states:eu-central-1:${ACCOUNT_ID}:execution:qgi-indicator-monthly-updater:${RUN_ID}" \
  --region eu-central-1 \
  --query "events[-10:]"
```

---

## Expected timeline (2-indicator run)

| Phase | Expected duration |
|-------|------------------|
| Phase 0: Janitor | ~5s |
| Phase 1: Dispatch + workers | 5–15 min (throttling on new accounts) |
| Phase 2: Batch SCDI | 10–20 min |
| Phase 3: Glue MSCK REPAIR | 1–2 min |
| Phase 4: Pattern synthesis | 5–10 min |
| Phase 5: DLQ audit | ~30s |
| **Total** | **~25–50 min** |

Phase 1 is the slowest due to Lambda burst limits on new accounts. The Step Functions retry config (30s base, 5 retries, 2× backoff) handles transient 429s — do not panic if a-checker polls a few times before flipping `done=true`.

---

## Deploying Lambda code changes from the Codespace

The `qgi-cross-account-ops` role has `lambda:UpdateFunctionCode` on `qgi-*`. To deploy a single Lambda without GitHub Actions:

```bash
# Example: redeploy a-dispatcher
cd /workspaces/qgi-pipeline
zip -j /tmp/dispatcher.zip lambdas/pipeline-a-dispatcher/lambda_function.py

ROLE=$(aws sts assume-role --role-arn arn:aws:iam::444444444444:role/qgi-cross-account-ops --role-session-name deploy --output json)
AK=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['AccessKeyId'])")
SK=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['SecretAccessKey'])")
ST=$(echo $ROLE | python3 -c "import sys,json; c=json.load(sys.stdin)['Credentials']; print(c['SessionToken'])")

AWS_ACCESS_KEY_ID=$AK AWS_SECRET_ACCESS_KEY=$SK AWS_SESSION_TOKEN=$ST \
  aws lambda update-function-code \
  --function-name qgi-pipeline-a-dispatcher \
  --zip-file fileb:///tmp/dispatcher.zip \
  --region eu-central-1 \
  --query 'LastUpdateStatus'
```

Note: this deploys only the `.py` file. For Lambdas with dependencies (requirements.txt), the GitHub Actions `deploy-lambdas.yml` workflow must be used instead — it builds a proper layer zip.

---

## Common failures and fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Lambda.TooManyRequestsException` immediately fails execution | Retry not configured on that Task state | Add `Retry = local.lambda_retry` to the state in `modules/pipeline/main.tf`, apply |
| `done=false` stuck forever | Workers throttled, not completing | Wait — retries will eventually clear it. If >2h, check CloudWatch for worker errors |
| Phase 2 Batch jobs not starting | ECR cross-account pull denied | Check `qgi-cross-account-ecr-pull` role in management account |
| Phase 4 c-workers DLQ spike | Pattern logic bug | Check c-worker CloudWatch logs |
