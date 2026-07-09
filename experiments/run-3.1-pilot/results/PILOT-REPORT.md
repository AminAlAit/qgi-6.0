# run-3.1 selection-method pilot -- PILOT REPORT

- seed base: `12345`  |  B_eval: `1000`  |  FDR q: `0.1`  |  π keep: `0.6`
- ΔAUC = paired bootstrap `AUC(run31) - AUC(run2)`, paired on (country, year); baseline is **run-2** (never run-3).

## OVERALL: **INVALIDATED (control veto failed)**

### civil_war_and_insurgency  (control_veto)  -- FAIL
> CONTROL VETO -- evaluated first

- ΔAUC point: `NaN`  |  95% CI: `[NaN, NaN]`  |  paired rows: `0`  |  boot valid: `0`
- FDR: p=`1.0000`  p_adj=`1.0000`  reject=`False`
- arm LOCO-AUC: `NaN`  CI `[n/a, n/a]`  |  run-2 LOCO-AUC: `0.6264`
- stability (mean pairwise Jaccard): run31=`0.0684`  run3method=`0.0532`  improvement=`0.0151`
- stable-set size: `0`  |  reference-set size: `6`  |  mean π over reference set: `0.1944`

| check | verdict | detail |
|---|---|---|
| delta_auc_ci_contains_zero | FAIL | {"ci95": [null, null], "contains_zero": false, "required": true} |
| abs_point_estimate_le | FAIL | {"point": null, "threshold": 0.02} |
| selected_set_jaccard_vs_run2_ge | FAIL | {"jaccard": 0.0, "threshold": 0.6} |
| _raw pass_ | FAIL | all sub-checks |
| _post-FDR pass_ | FAIL | control: raw_pass AND not FDR-rejected (no significant harm) |

### executive_power_consolidation  (patient)  -- FAIL

- ΔAUC point: `NaN`  |  95% CI: `[NaN, NaN]`  |  paired rows: `0`  |  boot valid: `0`
- FDR: p=`1.0000`  p_adj=`1.0000`  reject=`False`
- arm LOCO-AUC: `NaN`  CI `[n/a, n/a]`  |  run-2 LOCO-AUC: `0.7070`
- stability (mean pairwise Jaccard): run31=`0.0328`  run3method=`0.0249`  improvement=`0.0078`
- stable-set size: `0`  |  reference-set size: `1`  |  mean π over reference set: `0.1250`

| check | verdict | detail |
|---|---|---|
| pi_ge_keep_on_frac_of_set_ge | FAIL | {"frac_pi_ge_keep": 0.0, "threshold": 0.6, "pi_keep": 0.6, "reference_set_size": 1} |
| split_half_pi_jaccard_reliability_ge | PASS | {"reliability": 1.0, "threshold": 0.7} |
| indicator_count_within_of_run2 | FAIL | {"count": 0, "run2_count": 9, "diff": 9, "within": 3} |
| loco_auc_ci_lower_ge_run2_minus | FAIL | {"arm_ci95_lo": null, "run2_loco_auc": 0.7069751731126499, "margin": 0.02, "required_ge": 0.6869751731126499} |
| _raw pass_ | FAIL | all sub-checks |
| _post-FDR pass_ | FAIL | patient: bar is π/count/AUC-CI (FDR of Δ not gating) |

### military_coup  (patient)  -- FAIL

- ΔAUC point: `0.0071`  |  95% CI: `[-0.0597, 0.0795]`  |  paired rows: `549`  |  boot valid: `1000`
- FDR: p=`0.8132`  p_adj=`1.0000`  reject=`False`
- arm LOCO-AUC: `0.6932`  CI `[0.6466, 0.7352]`  |  run-2 LOCO-AUC: `0.6768`
- stability (mean pairwise Jaccard): run31=`0.1470`  run3method=`0.1460`  improvement=`0.0010`
- stable-set size: `1`  |  reference-set size: `5`  |  mean π over reference set: `0.1917`

| check | verdict | detail |
|---|---|---|
| pi_ge_keep_on_frac_of_set_ge | FAIL | {"frac_pi_ge_keep": 0.2, "threshold": 0.6, "pi_keep": 0.6, "reference_set_size": 5} |
| split_half_pi_jaccard_reliability_ge | PASS | {"reliability": 1.0, "threshold": 0.7} |
| indicator_count_within_of_run2 | FAIL | {"count": 1, "run2_count": 5, "diff": 4, "within": 3} |
| loco_auc_ci_lower_ge_run2_minus | FAIL | {"arm_ci95_lo": 0.6465594737757763, "run2_loco_auc": 0.6767869106809126, "margin": 0.02, "required_ge": 0.6567869106809126} |
| _raw pass_ | FAIL | all sub-checks |
| _post-FDR pass_ | FAIL | patient: bar is π/count/AUC-CI (FDR of Δ not gating) |

### banking_and_financial_crisis  (gain_is_real)  -- FAIL

- ΔAUC point: `NaN`  |  95% CI: `[NaN, NaN]`  |  paired rows: `0`  |  boot valid: `0`
- FDR: p=`1.0000`  p_adj=`1.0000`  reject=`False`
- arm LOCO-AUC: `NaN`  CI `[n/a, n/a]`  |  run-2 LOCO-AUC: `0.7707`
- stability (mean pairwise Jaccard): run31=`0.0190`  run3method=`0.0232`  improvement=`-0.0042`
- stable-set size: `0`  |  reference-set size: `3`  |  mean π over reference set: `0.0556`

| check | verdict | detail |
|---|---|---|
| paired_delta_auc_ci_lower_gt | FAIL | {"ci_lower": null, "threshold": 0.0} |
| paired_delta_auc_ci_lower_ge | FAIL | {"ci_lower": null, "threshold": 0.03} |
| _raw pass_ | FAIL | all sub-checks |
| _post-FDR pass_ | FAIL | banking: raw_pass AND FDR-rejected (significant positive gain) |

### territorial_disputes  (loss_resolve_decisively)  -- FAIL

- ΔAUC point: `NaN`  |  95% CI: `[NaN, NaN]`  |  paired rows: `0`  |  boot valid: `0`
- FDR: p=`1.0000`  p_adj=`1.0000`  reject=`False`
- arm LOCO-AUC: `NaN`  CI `[n/a, n/a]`  |  run-2 LOCO-AUC: `0.7010`
- stability (mean pairwise Jaccard): run31=`0.0224`  run3method=`0.0202`  improvement=`0.0023`
- stable-set size: `0`  |  reference-set size: `3`  |  mean π over reference set: `0.0556`

| check | verdict | detail |
|---|---|---|
| ci_includes_run2_point | FAIL | {"arm_ci95": [null, null], "run2_point": 0.700999149659864} |
| ci_upper_lt_run2_and_tight | FAIL | {"arm_ci95_hi": null, "run2_point": 0.700999149659864, "width": null, "width_threshold": 0.08} |
| _raw pass_ | FAIL | all sub-checks |
| _post-FDR pass_ | FAIL | territorial: ambiguous wide CI -> FAIL |

## Overall AWS-funding gate

| gate check | verdict | detail |
|---|---|---|
| control_passes | FAIL | {"control_raw_pass": false, "control_post_fdr_pass": false, "required": true} |
| min_other_recipes_passing_post_fdr | FAIL | {"n_passing": 0, "required_min": 3, "of": 4} |
| mean_pi_across_all_5_ge | FAIL | {"mean_pi": 0.12444444444444444, "threshold": 0.6} |
| mean_pairwise_jaccard_stability_improvement_ge | FAIL | {"mean_improvement": 0.004422953254474981, "threshold": 0.3} |
| **OVERALL** | **FAIL** | invalidated_by_control=`True` |
