#!/usr/bin/env bash
# qgi-cost-preflight.sh — 5-second cost-safety check before AWS-touching work.
#
# Per qgi-aws-tf#807 (cost-protection plan, 2026-05-18 incident post-mortem
# at qgi-docs/internal/ops/cost-incident-2026-05-16.md).
#
# Run this BEFORE every:
#   - aws stepfunctions start-execution
#   - aws lambda invoke
#   - aws athena start-query-execution (without explicit --work-group QGI-Lambda-Workgroup)
#   - any Terraform apply on qgi-infra
#
# Prints a 5-line summary + a GO / CAUTION / STOP verdict. Read-only.
#
# Usage:
#   ./cost-preflight.sh                    # staging account (default)
#   ./cost-preflight.sh --account staging  # explicit
#   ./cost-preflight.sh --account qa       # qa account
#   ./cost-preflight.sh --account prod     # prod account
#
# Credentials must be pre-loaded in the shell env (AWS_ACCESS_KEY_ID etc.).

set -u

ACCOUNT_ID="${QGI_ACCOUNT_ID:-222222222222}"
REGION="${AWS_DEFAULT_REGION:-eu-central-1}"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --account)
      case "$2" in
        staging)  ACCOUNT_ID=222222222222 ;;
        qa)       ACCOUNT_ID=333333333333 ;;
        prod)     ACCOUNT_ID=444444444444 ;;
        *)        echo "Unknown account: $2" >&2; exit 2 ;;
      esac
      shift 2
      ;;
    --region) REGION="$2"; shift 2 ;;
    --help|-h)
      grep '^# ' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Sanity check: caller has creds AND they belong to the requested account
# (qgi-aws-tf#813 B1 fix — without this, --account qa with staging creds
# silently queries CE-qa for cost but SFN/Athena-staging for workload state,
# producing a wrong CAUTION/STOP verdict).
CALLER_IDENTITY=$(aws sts get-caller-identity --output json 2>&1) || {
  echo "STOP: no AWS credentials in shell env. Source your creds first."
  exit 1
}
CALLER=$(echo "$CALLER_IDENTITY" | python -c "import sys, json; print(json.load(sys.stdin)['Arn'])" 2>/dev/null)
CALLER_ACCOUNT=$(echo "$CALLER_IDENTITY" | python -c "import sys, json; print(json.load(sys.stdin)['Account'])" 2>/dev/null)
if [ "$CALLER_ACCOUNT" != "$ACCOUNT_ID" ]; then
  echo "STOP: caller credentials are for account $CALLER_ACCOUNT but --account flag requested $ACCOUNT_ID."
  echo "      Either load the correct SSO creds for $ACCOUNT_ID, or drop the --account flag."
  exit 2
fi

echo "============================================================"
echo "QGI cost preflight — $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "Account: $ACCOUNT_ID  Region: $REGION"
echo "Caller:  $CALLER"
echo "============================================================"

# 1. MTD spend
TODAY=$(date -u +%Y-%m-%d)
MONTH_START=$(date -u +%Y-%m-01)
TOMORROW=$(date -u -d 'tomorrow' +%Y-%m-%d 2>/dev/null || date -u -v+1d +%Y-%m-%d)

MTD_TOTAL=$(aws ce get-cost-and-usage \
  --time-period Start=$MONTH_START,End=$TOMORROW \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --filter "{\"Dimensions\":{\"Key\":\"LINKED_ACCOUNT\",\"Values\":[\"$ACCOUNT_ID\"]}}" \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text 2>/dev/null || echo "0")

# Coerce to float; default to 0 if Cost Explorer returned None / empty / "None"
# (qgi-aws-tf#813 N2 fix — `--output text` returns the literal string "None"
# when the Amount field is null, which awk treats as 0 silently and loses signal.)
[ -z "$MTD_TOTAL" ] || [ "$MTD_TOTAL" = "None" ] && MTD_TOTAL="0"
MTD_FLOAT=$(awk "BEGIN { printf \"%.2f\", $MTD_TOTAL }" 2>/dev/null || echo "0.00")

echo "MTD spend (account $ACCOUNT_ID): \$$MTD_FLOAT"

# 2. Today's spend
TODAY_COST=$(aws ce get-cost-and-usage \
  --time-period Start=$TODAY,End=$TOMORROW \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter "{\"Dimensions\":{\"Key\":\"LINKED_ACCOUNT\",\"Values\":[\"$ACCOUNT_ID\"]}}" \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text 2>/dev/null || echo "0")
[ -z "$TODAY_COST" ] || [ "$TODAY_COST" = "None" ] && TODAY_COST="0"
TODAY_FLOAT=$(awk "BEGIN { printf \"%.2f\", $TODAY_COST }" 2>/dev/null || echo "0.00")
echo "Today spend:                     \$$TODAY_FLOAT"

# 3. Forecast 24h
FORECAST=$(aws ce get-cost-forecast \
  --time-period Start=$TOMORROW,End=$(date -u -d "$TOMORROW + 1 day" +%Y-%m-%d 2>/dev/null || date -u -v+2d +%Y-%m-%d) \
  --metric UNBLENDED_COST \
  --granularity DAILY \
  --filter "{\"Dimensions\":{\"Key\":\"LINKED_ACCOUNT\",\"Values\":[\"$ACCOUNT_ID\"]}}" \
  --query 'Total.Amount' \
  --output text 2>/dev/null || echo "0")
FORECAST_AVAILABLE=1
if [ -z "$FORECAST" ] || [ "$FORECAST" = "None" ]; then
  FORECAST="0"
  FORECAST_AVAILABLE=0
fi
FORECAST_FLOAT=$(awk "BEGIN { printf \"%.2f\", $FORECAST }" 2>/dev/null || echo "0.00")
if [ "$FORECAST_AVAILABLE" -eq 0 ]; then
  echo "Forecast next 24h:               \$$FORECAST_FLOAT  (unavailable — insufficient CE data)"
else
  echo "Forecast next 24h:               \$$FORECAST_FLOAT"
fi

# 4. Running Athena queries (last 50; filter to running/queued)
RUNNING_ATHENA=$(aws athena list-query-executions --region "$REGION" --max-results 50 \
  --query 'QueryExecutionIds[]' --output text 2>/dev/null | tr '\t' '\n' | head -50)
RUNNING_ATHENA_COUNT=0
# qgi-aws-tf#813 B2 fix: track API failures on workload-state calls. Silent
# failures here would otherwise produce a false GO (running workloads invisible
# because list-executions failed = treated as "no executions running").
WORKLOAD_API_FAILURE=0

if [ -n "$RUNNING_ATHENA" ]; then
  # shellcheck disable=SC2086  # word-split RUNNING_ATHENA so IDs become separate positional args
  RUNNING_ATHENA_COUNT=$(aws athena batch-get-query-execution --region "$REGION" \
    --query-execution-ids $RUNNING_ATHENA \
    --query 'QueryExecutions[?Status.State==`RUNNING` || Status.State==`QUEUED`] | length(@)' \
    --output text 2>/dev/null) || { WORKLOAD_API_FAILURE=1; RUNNING_ATHENA_COUNT=0; }
fi
echo "Running Athena queries:          $RUNNING_ATHENA_COUNT"

# 5. Running Step Functions executions
SFN_RUNNING=0
SM_ARNS=$(aws stepfunctions list-state-machines --region "$REGION" \
  --query 'stateMachines[].stateMachineArn' --output text 2>/dev/null) || { WORKLOAD_API_FAILURE=1; SM_ARNS=""; }
SM_ARNS=$(echo "$SM_ARNS" | tr '\t' '\n')
for arn in $SM_ARNS; do
  COUNT=$(aws stepfunctions list-executions --state-machine-arn "$arn" \
    --status-filter RUNNING --region "$REGION" \
    --query 'length(executions)' --output text 2>/dev/null) || { WORKLOAD_API_FAILURE=1; COUNT=0; }
  SFN_RUNNING=$((SFN_RUNNING + COUNT))
done
echo "Running SFN executions:          $SFN_RUNNING"
if [ "$WORKLOAD_API_FAILURE" -eq 1 ]; then
  echo "WARN: one or more workload-state API calls failed; counts above may be incomplete."
fi

# Verdict
echo "============================================================"

# Use awk for float comparisons (POSIX-portable)
mtd_gt() { awk "BEGIN { exit !(${MTD_FLOAT:-0} > $1) }"; }
today_gt() { awk "BEGIN { exit !(${TODAY_FLOAT:-0} > $1) }"; }
forecast_gt() { awk "BEGIN { exit !(${FORECAST_FLOAT:-0} > $1) }"; }

if mtd_gt 40 || today_gt 25 || forecast_gt 15 || [ "$SFN_RUNNING" -gt 1 ]; then
  VERDICT="STOP"
  COLOR=$'\033[1;31m'
elif mtd_gt 20 || today_gt 10 || forecast_gt 5 || [ "$SFN_RUNNING" -gt 0 ] || [ "$RUNNING_ATHENA_COUNT" -gt 0 ] || [ "$WORKLOAD_API_FAILURE" -eq 1 ]; then
  # qgi-aws-tf#813 B2 fix: API failure on workload-state calls promotes to CAUTION
  # rather than silently defaulting to GO when workload counts are unknown.
  VERDICT="CAUTION"
  COLOR=$'\033[1;33m'
else
  VERDICT="GO"
  COLOR=$'\033[1;32m'
fi
RESET=$'\033[0m'

echo "Verdict: ${COLOR}${VERDICT}${RESET}"
echo "============================================================"

case "$VERDICT" in
  GO)
    echo "Spend nominal, no concurrent workload. Safe to proceed with"
    echo "an AWS-touching action — but still get per-run founder sign-off"
    echo "per the QGI-R&D | 001 cost rule."
    exit 0
    ;;
  CAUTION)
    echo "Spend elevated OR concurrent workload detected. Re-check what's"
    echo "running and confirm intent before proceeding. Founder sign-off"
    echo "REQUIRED with explicit acknowledgement of the current cost rate."
    exit 0
    ;;
  STOP)
    echo "DO NOT proceed without founder sign-off. Daily threshold or"
    echo "forecast indicates a possible runaway. Investigate concurrent"
    echo "workloads first."
    exit 1
    ;;
esac
