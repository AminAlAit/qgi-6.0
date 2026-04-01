# AWS CLI Cross-Account Operations — Patterns and Pitfalls

Best practices for Claude Code instances working with multiple AWS accounts in this Codespace.

---

## The credential model

The Codespace runs as IAM user `ci-terraform-deployer` (management account `111111111111`).  
All cross-account work (staging, QA, prod) requires assuming a role in the target account.

| Account | Role to assume | Used for |
|---------|---------------|---------|
| staging `222222222222` | `OrganizationAccountAccessRole` | Terraform, Lambda deploy, S3, DynamoDB |
| QA `333333333333` | `OrganizationAccountAccessRole` | Terraform, Lambda deploy, S3, DynamoDB |
| prod `444444444444` | `qgi-cross-account-ops` | Lambda deploy, S3 (not Terraform) |
| prod `444444444444` | `OrganizationAccountAccessRole` | Terraform only (via provider assume_role) |

---

## Pattern: assume role and export credentials

**Always use explicit `export` — not inline assignment — when multiple commands need the same credentials.**

```bash
CREDS_JSON=$(aws sts assume-role \
  --role-arn "arn:aws:iam::222222222222:role/OrganizationAccountAccessRole" \
  --role-session-name my-session \
  --output json)
export AWS_ACCESS_KEY_ID=$(echo "$CREDS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['Credentials']['AccessKeyId'])")
export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['Credentials']['SecretAccessKey'])")
export AWS_SESSION_TOKEN=$(echo "$CREDS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['Credentials']['SessionToken'])")

# ... run commands ...

unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
```

**Why python3 instead of jq?** `jq` is not always installed. `python3` is always available and handles JSON reliably.

---

## Common pitfalls

### 1. Credentials expire mid-script
STS session tokens last 1 hour by default. Long-running scripts (e.g. Terraform apply + deploy loop) may expire. If you get `ExpiredTokenException`, re-assume the role.

### 2. Circular role assumption
If the shell is already running as `OrganizationAccountAccessRole` (e.g. a background task that pre-assumed it), trying to assume the same role again fails:
```
is not authorized to perform: sts:AssumeRole on resource:
arn:aws:iam::222222222222:role/OrganizationAccountAccessRole
```
**Fix:** Always start from the base management IAM user credentials. Don't pre-assume roles in background tasks. Terraform provider `assume_role` + backend `assume_role` together cause this when the shell is already assumed.

### 3. NoCredentials after unset in same command block
If you `unset` credentials and immediately try to use them in the next line of the same shell block, they're gone:
```bash
# BAD — unset clears before prod block runs
deploy_staging
unset AWS_ACCESS_KEY_ID ...
deploy_prod  # fails: NoCredentials
```
**Fix:** Assume fresh credentials for each account block separately.

### 4. Piping large JSON through python3 stdin
Commands like `echo $CREDS_JSON | python3 -c "..."` can fail if `$CREDS_JSON` is empty (e.g. assume-role failed silently). Always check `$CREDS_JSON` is non-empty before parsing, or save to a temp file first:
```bash
aws ... --output json > /tmp/creds.json
python3 -c "import json; d=json.load(open('/tmp/creds.json')); ..."
```

### 5. Terraform apply needs management account credentials, not assumed role
Terraform for staging/QA uses the AWS provider `assume_role` block to assume `OrganizationAccountAccessRole`. The shell must be running as the **management IAM user** (`ci-terraform-deployer`), not as an already-assumed role.  
**Check:** `aws sts get-caller-identity` should show `111111111111` and `user/ci-terraform-deployer`.

### 6. DynamoDB/S3 operations on target accounts
When running DynamoDB or S3 commands against staging/QA/prod, you **must** assume the target account role first. Commands run without assuming a role go to the management account and will either 403 or hit the wrong resources.

---

## Pattern: deploy Lambda code to multiple accounts

```bash
ZIP="/path/to/function.zip"
FN="qgi-pipeline-a-completer"

for ACCOUNT in 222222222222 333333333333 444444444444; do
  ROLE="OrganizationAccountAccessRole"
  [ "$ACCOUNT" = "444444444444" ] && ROLE="qgi-cross-account-ops"

  CREDS_JSON=$(aws sts assume-role \
    --role-arn "arn:aws:iam::${ACCOUNT}:role/${ROLE}" \
    --role-session-name deploy-${ACCOUNT} \
    --output json)
  export AWS_ACCESS_KEY_ID=$(echo "$CREDS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['Credentials']['AccessKeyId'])")
  export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['Credentials']['SecretAccessKey'])")
  export AWS_SESSION_TOKEN=$(echo "$CREDS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['Credentials']['SessionToken'])")

  # Upload via S3 (avoids 70 MB direct upload limit)
  aws s3 cp "$ZIP" "s3://qgi-data-lake-${ACCOUNT}/lambda-deploys/$(basename $ZIP)" \
    --region eu-central-1 --quiet
  aws lambda update-function-code \
    --function-name "$FN" \
    --s3-bucket "qgi-data-lake-${ACCOUNT}" \
    --s3-key "lambda-deploys/$(basename $ZIP)" \
    --region eu-central-1 \
    --query 'FunctionName' --output text

  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
done
```

---

## Pattern: build Lambda zip for arm64

All Lambda functions run on Graviton (arm64). Dependencies must be compiled for the right platform:

```bash
pip install -r requirements.txt \
  --target package/ \
  --platform manylinux2014_aarch64 \
  --only-binary=:all: \
  --python-version 3.13 \
  --quiet
cp lambda_function.py package/
cd package && zip -qr ../function.zip . && cd ..
```

**Size limits:**
- Direct upload: 70 MB compressed
- S3-based upload: 250 MB unzipped (hard limit)
- If unzipped > 250 MB: use a Lambda Layer for heavy dependencies

**statsmodels is too large** (>250 MB unzipped with dependencies). Use pure numpy ETS instead — see `lambdas/pipeline-a-completer/lambda_function.py`.

---

## Pattern: check execution history from Step Functions

```bash
aws stepfunctions get-execution-history \
  --execution-arn "arn:aws:states:eu-central-1:ACCOUNT:execution:STATE_MACHINE:RUN_NAME" \
  --region eu-central-1 \
  --output json > /tmp/sfn_history.json

python3 - <<'PYEOF'
import json
with open('/tmp/sfn_history.json') as f:
    data = json.load(f)
for e in data['events']:
    if e.get('type') == 'TaskStateExited':
        details = e.get('stateExitedEventDetails', {})
        print(f"[{details.get('name')}]:", details.get('output','')[:200])
PYEOF
```

Always write to `/tmp/` first — piping large JSON through stdin is fragile.

