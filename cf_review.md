Good — no staging consumer of monitoring outputs. The output type change (literal list → `concat(...)` of splats) is harmless.

One more check — the `lambda_arns` output map type issue more carefully. With `enable_cascade=true` (staging), all entries are real strings. The Terraform type inference will make this `map(string)`. This output is not consumed in staging. No issue for staging. The QA issue (null entries in map(string)) is real but not a staging concern.

Let me also verify the `state_machine_arn` null-vs-empty issue for QA path — but since QA has no infrastructure yet (qa/main.tf is just a TODO comment), this is moot.

Let me now do a final check: are there any non-`moved` resources in the diff that represent a genuinely new resource (not a rename/move) that would show up as `+create` in staging plan?

Looking at the diff in its entirety:
- All new resources are existing resources with `count` added + `moved` blocks
- The `variable` declarations are new but don't create AWS resources
- `moved` blocks are pure state refactors
- `output` changes produce no AWS resource changes

The only legitimate plan change I can identify for staging is the `batch_job_terminator` env var change.

Let me double-check by looking at whether `ops_janitor` or `ops_dlq_scanner` env var expressions produce an identical string. With `enable_cascade=true`:

- `ops_janitor` QUEUE_URLS old: `join(",", [a_main, a_dlq, b_main, b_dlq, c_main, c_dlq])` (6 URLs)
- `ops_janitor` QUEUE_URLS new: `join(",", compact([a_main, a_dlq, b_main, b_dlq, c_main, c_dlq]))` (6 non-empty URLs, compact changes nothing)

These produce the **same string**. No plan diff.

- `ops_dlq_scanner` DLQ_URLS old: `join(",", [a_dlq, b_dlq, c_dlq])` (3 DLQ URLs)  
- `ops_dlq_scanner` DLQ_URLS new: `join(",", compact([a_dlq, b_dlq, c_dlq]))` (3 non-empty DLQ URLs, compact changes nothing)

Same string. No plan diff.

The `a_reporter` PIPELINE_B_ARN: old = `aws_lambda_function.b_orchestrator.arn`, new = `var.enable_cascade ? aws_lambda_function.b_orchestrator[0].arn : ""`. With `enable_cascade=true`, both resolve to the same ARN of the same Lambda (after the `moved` block maps state). No plan diff.

---

Here is the complete adversarial assessment:

---

**VERDICT: ONE CONFIRMED DEFECT — STAGING ZERO-DIFF INVARIANT VIOLATED**

**The invariant "with enable_cascade=true, staging has a ZERO plan diff" is DISPROVED.**

---

## DEFECT 1 — PRODUCTION INCIDENT RISK

**File:** `modules/pipeline/main.tf` line 1177
**Type:** Unconditional env-var mutation on an ungated, always-deployed Lambda

The `batch_job_terminator` Lambda `BATCH_JOB_QUEUE` env var is changed unconditionally from `"qgi-pipeline-b-high-priority-queue"` to `"qgi-recipe-fleet-queue"`. There is no `var.enable_cascade` guard. With `enable_cascade=true` (staging), `terraform plan` will produce:

```
~ aws_lambda_function.batch_job_terminator
  ~ environment[0].variables[BATCH_JOB_QUEUE]
      "qgi-pipeline-b-high-priority-queue" -> "qgi-recipe-fleet-queue"
```

This is a plan change, not a zero-diff. In practice it is also a **correctness change**: the job terminator is a cost kill-switch. If a runaway Phase B SCDI Batch run occurs in staging and someone pulls the emergency lever, it will now attempt to drain `qgi-recipe-fleet-queue` instead of `qgi-pipeline-b-high-priority-queue`. Phase B SCDI jobs will keep running.

**Fix:** Guard with `enable_cascade`:
```hcl
BATCH_JOB_QUEUE = var.enable_cascade ? "qgi-pipeline-b-high-priority-queue" : "qgi-recipe-fleet-queue"
```

This makes the env var value identical to today's staging state when `enable_cascade=true`, and uses the TE queue when cascade is off.

---

## DEFECT 2 — QA-PATH TYPE ERROR (latent, not staging)

**File:** `modules/pipeline/outputs.tf` lines 18-24

The `lambda_arns` output is an untyped map. With `enable_cascade=false`, `one(aws_lambda_function.b_orchestrator[*].arn)` returns `null`. Terraform infers the output type as `map(string)` from the always-present keys; null entries corrupt that type. On a QA `terraform plan`, this will fail with a type error like:

```
Error: Inconsistent value types
The map elements must all have the same type but element "b_orchestrator"
has type null.
```

**Production risk:** Blocks any `terraform plan` in QA with `enable_cascade=false`. Since QA/main.tf is currently a stub, this is not live-blocking today, but it must be fixed before QA wires up.

**Fix:** Replace the inferred map with an explicit `object({})` output type, or use `try(one(...), "")` to coerce nulls to empty strings:
```hcl
b_orchestrator = try(one(aws_lambda_function.b_orchestrator[*].arn), "")
```
Apply this to all 7 cascade entries.

---

## DEFECT 3 — STATE_MACHINE_ARN NULL PROPAGATION (latent, not staging)

**File:** `modules/pipeline/outputs.tf` line 2; `environments/staging/main.tf` line 44

`one(aws_sfn_state_machine.pipeline[*].arn)` returns `null` when `enable_cascade=false`. In staging, `try(module.pipeline.state_machine_arn, "")` — `try()` catches Terraform *errors*, not null values. So when `enable_cascade=false`, `state_machine_arn` receives `null`, not `""`.

In `modules/iam/main.tf` line 752:
```hcl
var.state_machine_arn != "" ? var.state_machine_arn : "fallback-arn"
```

In Terraform, `null != ""` evaluates to `true`, so null gets passed directly as the IAM policy `Resource`. This produces an invalid ARN in the IAM policy and will either cause a plan error or an AWS API error during apply.

**Fix:** Use `coalesce(one(aws_sfn_state_machine.pipeline[*].arn), "")` in the pipeline output, or add a null-coalesce in the staging wiring:
```hcl
state_machine_arn = coalesce(module.pipeline.state_machine_arn, "")
```

---

## CONFIRMED CLEAN — ZERO PLAN DIFF FOR THE FOLLOWING (staging, enable_cascade=true)

| Invariant | Verdict |
|---|---|
| All 10 `moved` blocks in storage map `X` → `X[0]` | PASS — each `moved` exactly mirrors the `count` resource |
| All 6 `moved` blocks in batch map `X` → `X[0]` | PASS |
| All 21 `moved` blocks in pipeline map `X` → `X[0]` | PASS — verified all 21 resources have matching `moved` |
| All 5 `moved` blocks (for_each key rename) in monitoring map `caught_exception["k"]` → `caught_exception_cascade["k"]` | PASS |
| All 6 `moved` blocks in monitoring map `X` → `X[0]` | PASS |
| `storage/outputs.tf` `all_queue_arns` `concat([a_main, a_dlq], b_main[*].arn, ...)` | PASS — with enable_cascade=true produces same 6-element list as before |
| `storage/outputs.tf` B/C queue outputs (verbose `one()!=null?` ternary) | PASS — with enable_cascade=true returns real URL/ARN, same as before |
| `pipeline/main.tf` `a_reporter` `PIPELINE_B_ARN` guard #4 | PASS — resolves to same b_orchestrator[0].arn via moved state |
| `pipeline/main.tf` `ops_janitor` `QUEUE_URLS` guard #3 with `compact()` | PASS — all 6 URLs non-empty in staging, compact() is a no-op |
| `pipeline/main.tf` `ops_dlq_scanner` `DLQ_URLS` guard #3 with `compact()` | PASS — same analysis |
| `pipeline/main.tf` `c_worker_sqs[0]` and `c_dlq_inspector_sqs[0]` intra-resource `[0].arn` | PASS — gated resources only reference each other |
| `pipeline/main.tf` SFN ASL — all 12 Lambda ARN references use `[0]` | PASS — verified all 10 explicit Lambda ARNs in ASL plus `scheduler → pipeline[0].arn` |
| `pipeline/main.tf` `aws_scheduler_schedule.monthly[0]` → `pipeline[0].arn` | PASS |
| `batch/main.tf` job queue → `scdi_spot[0].arn` intra-ref | PASS |
| `batch/outputs.tf` `one(scdi[*].arn)` etc. | PASS — returns real ARN in staging |
| `pipeline/variables.tf` B/C queue vars given `default=""` | PASS — staging still passes real values explicitly |
| `bake_trigger.tf` secret + `frontend_bake_trigger` Lambda NOT gated | PASS — confirmed ungated; recipe-fleet `data.aws_secretsmanager_secret` resolves to the secret created here |
| `recipe-fleet` `depends_on = [module.pipeline]` ensures secret exists | PASS |
| `monitoring/outputs.tf` `alarm_arns` uses `concat([*].arn,...)` splats | PASS — with enable_cascade=true each splat is a 1-element list, concat produces same 6-element list |
| `monitoring` `caught_exception_cascade` not in outputs (consistent with old `caught_exception`) | PASS — was never in outputs before |
| `enable_cascade` not explicitly passed in staging — relies on default=true | PASS — all 4 module variables declare `default = true` |

---

## SUMMARY

**1 blocking defect (staging plan is not zero-diff) at `modules/pipeline/main.tf:1177`** — the `batch_job_terminator` `BATCH_JOB_QUEUE` env var is changed unconditionally from the Phase B SCDI queue name to the TE recipe-fleet queue name. Fix: make it conditional on `var.enable_cascade`.

**2 latent defects (QA path only, not staging):**
- `modules/pipeline/outputs.tf:18-24` — `lambda_arns` map with null entries will fail type inference when `enable_cascade=false`
- `modules/pipeline/outputs.tf:2` + `environments/staging/main.tf:44` — `try()` does not catch null; IAM module receives null state machine ARN when `enable_cascade=false`