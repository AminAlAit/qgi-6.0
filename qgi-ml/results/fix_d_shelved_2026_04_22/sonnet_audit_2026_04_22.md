# Sonnet adversarial audit — V1.9.2 Fix D design + proxy simulation

**Date:** 2026-04-22
**Auditor:** Sonnet 4.x (general-purpose subagent, adversarial framing)
**Audited artifacts:**
- Design doc: `qgi-docs/methodology/recipes/v1.9.2-design.md` (commit `db0fd06`, pre-shelf)
- Proxy simulator: `qgi-ml/scripts/simulate_fix_d.py`
- Proxy simulation output: `fix_d_proxy_simulation.json` (preserved in this folder)
- Proxy results summary: `.tmp/fix_d_proxy_results_summary.md` (not preserved — superseded by findings_summary.md)

**Audit invoked:** after the proxy simulation returned 4/11 face validity with several surprising demotions. Adversarial framing with a "find at least 5 concerns" requirement.

---

## Verdict (from the audit, verbatim)

> The design doc is conceptually sound and correctly identifies the root cause, but it makes two overconfident predictions (Syria z-predictions and the Venezuela recovery claim), under-specifies Fix D in ways that will cause implementation drift, and fails to name a critical ambiguity that could break the whole approach (zero-inflation). The proxy simulation is correctly built for what it is, but the results summary over-claims: the explanation for proxy failure is only partially right, and the fact that the three primary false-positive test cases (Cape Verde, Denmark, Germany) are entirely absent from the 89-country dataset is not adequately flagged. Both artifacts together do not constitute a validated directional signal — the proxy gives no useful signal at all, and the design doc's worked examples are purely theoretical.

---

## Critical concerns (P0 — must fix before proceeding)

### P0-A: Primary face-validity cases absent from the data, making the simulation useless as a validation instrument.

The three countries Fix D is supposed to fix as false positives — Cape Verde, Denmark, Germany — are not in the 89-country staging dataset at all. `simulate_fix_d.py` silently skips them (fv_total=11 instead of 14), and the results summary buries this in a footnote. The only false-positive check that worked was "Costa Rica NOT_HIGH" which is not a contested case. The results summary calls this a proxy limitation but never states the blunt consequence: the proxy cannot test whether Fix D closes #376. That is the entire point of the exercise. This should be named a blocking limitation, not a caveat.

**Post-simulation confirmation (2026-04-22 real Athena run):** P0-A stands. The Athena-backed simulator found 86 distinct countries with recipes in the staging recipes table. Cape Verde, Denmark, Germany remain absent. This is a staging-data coverage issue, not a simulator issue, and it is the primary reason Fix D is shelved pending ≥190-country curation.

### P0-B: Top-10-truncation diagnosis is correct but incomplete.

Your diagnosis — "μ_k is biased upward because only elevated countries appear in the top-10 subset" — is the right first-order explanation. I confirmed it numerically: civil_war S-tier across 48 countries that made the top-10 has μ=1.162, σ=0.609. Syria's per-country z of 1.668 yields z_global of only (1.668-1.162)/0.609 = 0.83, salience 0.83 — well below the MODERATE floor of 0.975 at threshold=1.5. The demotions of Syria, Somalia, Ethiopia, Pakistan to MODERATE (and near-INDICATIVE for Syria) are fully explained by this.

But there is a second problem you did not name: Syria's actual max proxy salience (1.327) does not come from civil_war at all — it comes from L-tier `sanctions_and_arms_embargo`, a category with only 16 countries in the L-tier subset and a sigma of 0.231 (tight distribution → inflated z). The proxy is producing spurious HIGH-adjacent signals from obscure categories with small population, not from the intended crisis categories. This is an artifact of the z-of-z approach, not a feature, and it means the threshold sweep is calibrated to an artificial signal. The results summary does not mention this.

**Post-simulation confirmation (2026-04-22 real Athena run):** the rare-category-outlier problem surfaces equally in the real simulation (not just the proxy). Bhutan's economic_liberalization, Guatemala's volcanic_eruption, Argentina's economic_nationalization lead the salience distribution over genuine conflict zones. P0-B was directionally correct and, if anything, understated — the issue is structural to per-category global z against a zero-inflated distribution, not a proxy artifact.

### P0-C: The design doc's Venezuela prediction is almost certainly wrong.

Design doc §4 (worked examples) predicts Venezuela's `political_repression` z_global = +1.5 to +2.0. The staging data shows Venezuela's political_repression per-country z is only 0.633 (L tier) and 0.26 (S tier). Even using the biased top-10 subset distribution (μ=0.811, σ=0.391 for L tier), Venezuela's z_global = (0.633-0.811)/0.391 = -0.455. Venezuela ranks 20th-ish globally in political_repression — well below Syria, Russia, Eritrea, Turkiye, Belarus, Myanmar, etc. A realistic real-Fix-D global μ_k (including near-zero countries) would lower μ further, but Venezuela's absolute raw signal is just not large globally. The claim that "Venezuela's political_repression z's will stand on their own merit without needing a composite override" is not supported by the data available. The proxy shows Venezuela's max_salience_fix_d at 0.404, deep in INDICATIVE. This matters because Venezuela recovery was one of the three named Fix D targets.

**Post-simulation refutation (2026-04-22 real Athena run):** P0-C was wrong in direction. Venezuela does recover to HIGH under real Fix D — but via `currency_crisis` [XL] at salience 4.09, not via political_repression. The audit looked at the wrong category. The design doc's top-level claim (Venezuela flips to HIGH) held; the worked-example row for Venezuela named the wrong category but the tier prediction was correct. This is a caution about trusting proxy-based audit conclusions over real-data simulation.

---

## Serious concerns (P1 — should fix before real simulation run)

### P1-A: Design doc §2 equation is under-specified — omits the tier dimension.

The formula is written as `z(c, k) = (score(c,k) - μ_k) / σ_k` but in QGI, score is actually score(c, k, tier) — each of S/M/L/XL is a separate distribution. The simulator correctly groups by `(tier_name, category)`, producing 164 distributions for 89 countries. The design doc equation, however, collapses tier, which would mean merging S-tier and XL-tier civil_war scores into a single global distribution. This is methodologically wrong: a 3-8 year S-tier pattern signal for civil_war is not on the same scale as a 41-999 year XL-tier signal. If an implementer reads the equation literally and computes μ_k across all tiers, the distributions will be contaminated and the z's will be meaningless. The equation in §2 needs to read `z(c, k, t)` with the tier dimension explicit.

**Status:** open. Must be addressed in the post-shelf design revision.

### P1-B: "Single threshold suffices because categories on same scale" is imprecise.

The argument is: "every category now lives on the same standardized scale." This is only true of the z-scores, not of the saliences. Salience = z_global × severity_weight. civil_war at z=1.5 gives salience 1.5; elections at z=1.5 gives salience 0.9. A single salience threshold still implicitly requires crisis categories to be globally less extreme than low-severity categories to hit HIGH. This is the intended design — severity weighting is deliberate — but the claim that a single threshold "suffices because categories are on the same scale" is imprecise and will confuse anyone reading the methodology.

**Status:** open. Will be rewritten in the post-shelf design revision.

### P1-C: `moderate_ratio=0.65` in the simulator is undocumented and arguably wrong.

The `label_tier()` function hardcodes `moderate_ratio=0.65` (MODERATE floor = 0.65 × HIGH). This was not justified. V1.9.1 uses two different ratios: CRISIS_MODERATE/CRISIS_HIGH = 1.0/1.4 = 0.714, and REGULAR_MODERATE/REGULAR_HIGH = 1.3/2.0 = 0.65. The simulator picked the REGULAR ratio, but under Fix D's single-threshold regime, which ratio applies to MODERATE?

**Status:** open. The unshelved design must specify the MODERATE threshold explicitly.

### P1-D: Face-validity cliff at threshold 1.3→1.4 in proxy sweep not investigated.

**Status:** moot — proxy simulation superseded by real simulation. Real sweep shows a similar cliff at 3.2→4.0, driven by the rare-XL-outlier problem. Cause now known.

### P1-E: Pakistan's expected tier is inconsistent between artifacts.

V1.9.1 release notes say Pakistan's expected tier is MODERATE. `FACE_VALIDITY` in the simulator says HIGH. Design doc worked examples says "HIGH or MODERATE."

**Status:** open. Golden test set (#379) must resolve before the re-simulation. Proposed: accept `["HIGH", "MODERATE"]` for Pakistan as a transition allowance.

---

## P2 nits

- `sigma_distribution.min` reports 0.0 when the clamping-to-1e-6 should show clamped value.
- Population std (`pstdev`) vs sample std (`stdev`) choice undocumented.
- Test-first rule violated — simulator committed without unit tests.
- Worked-examples false precision ("+3.0 to +3.5" suggests narrow empirical range; actually a theoretical argument).

---

## What held up (from the audit)

- Top-10 truncation diagnosis as first-order explanation for proxy failure.
- Proxy caveat transparency.
- Design doc scope (scoring function only, schema unchanged, pipeline untouched).
- Timeline and Fix E escalation path.
- Internal correctness of `compute_global_zscore_per_category` and `apply_fix_d`.
- The recognition that real simulation requires Athena-backed raw scores.

---

## Recommended next steps from the audit (pre-shelf)

1. Prominent warning in results summary: Cape Verde/Denmark/Germany absence is blocking.
2. Fix §2 equation to include tier dimension.
3. Specify MODERATE threshold under single-threshold regime.
4. Add Cape Verde + Denmark to staging output (or investigate why they're absent).
5. Qualify Venezuela prediction.
6. Investigate FV cliff at threshold 1.3→1.4.
7. Write unit tests for `simulate_fix_d.py`.

**Post-shelf resolution:** items 1, 2, 3, 5 fold into the shelved-findings addendum in the main design doc and the stats-council agenda. Items 4 and 6 are answered by the real simulation. Item 7 is tracked as technical debt on the simulators.
