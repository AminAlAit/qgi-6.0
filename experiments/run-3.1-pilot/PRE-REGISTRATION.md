# Run-3.1 selection-method pilot — PRE-REGISTRATION (locked)

**Status:** PRE-REGISTERED. This document is committed **before** any pilot code executes. Its git commit is the timestamp of record; the pass/fail bar below may not be changed after the first pilot walk runs. Amendments require a new commit that explicitly supersedes this one and re-runs from scratch.

**Provenance:** Founder-approved scorecard (2 rounds of a 5-expert Sonnet council: Vásquez-Moreau / Chen / Okonkwo / Sørensen / Rao). Founder ratified the scorecard and the ≤$50/month AWS cap; this is its concrete form.

**Governing rules:** LOCO leakage firewall is sacred; determinism (seed 12345 base); run-separation vintages; resemblance-not-forecast; laptop-default cost rule (this whole pilot is local/offline, ~$0; the only paid step is a later ~$8–14 AWS walk, gated on a PASS).

> ### AMENDMENT 1 (pre-run, founder-ratified) — B schedule 50 → 24
> **What changed:** the offline pilot runs `--b-schedule 12,24` (ceiling **B=24 walks = 12 complementary-pairs resamples**) instead of the original `[50,75,…,200]`.
> **Why:** empirical measurement (not available when §2/§5 were written) showed a single walk is **~30–40 min** — the greedy runs up to **12** steps for event-rich recipes (n_pos ≥ 60), not the assumed ~5, each sweeping 40 candidates × 9 windows × leave-one-country-out. A faithful B=50 × 5 recipes × 2 arms is **~1.2 days** of laptop compute; B=24 is a ~14–16h overnight run that still yields a clear selection-stability signal (12 resamples → 24 selected sets per recipe-arm for the π estimate).
> **Legitimacy:** amended **before any scored pilot walk ran** (only throwaway B=2 calibration/validation had executed), so the pre-reg lock ("may not change after the first pilot walk runs") is not violated. All thresholds in §5 are UNCHANGED — only the resample count changed. If the B=24 result is borderline, the pre-registered path is to raise B (toward the original 50) and re-run, not to re-tune the bar.

---

## 1. The question
Does replacing plain greedy forward selection with **collinearity-dedup + country-bootstrap stability selection** make the TE recipe walks *stable* (reproducible indicator sets) without regressing accuracy — enough to justify a full-fleet run-3.1 on AWS?

Run-3 diagnosis (settled): tripling the pool with collinear V-Dem-extended/WB indicators created near-ties in the univariate top-40 prefilter; greedy's winner-take-all steps locked onto arbitrary tie-breaks → wholesale, order-dependent instability (executive_power_consolidation collapsed 9→1 indicators; military_coup swapped its whole set). All 8 biggest movers had overlapping run-2/run-3 CIs = noise.

## 2. The method under test (swap ONLY the selection layer)
Everything else — XGBoost hyperparams, LOCO folds, seed base, the 248-indicator pool, positives — is held fixed. The only change vs the production walk is the selection layer:

1. **Collinearity dedup (new, pre-top-40):** on the training panel, cluster candidate indicators by pairwise `|r| > 0.85`; keep only the **best-univariate-LOCO representative per cluster**. Removes the near-duplicate flood that poisoned run-3's menu.
2. **Greedy unchanged:** the existing `greedy_outer_loop` (XGBoost `n_jobs=1`, LOCO-scored, `DELTA_STEP=0.005`, caps as-is).
3. **Country-bootstrap stability wrapper (new):** run the identical greedy walk `B` times over **complementary-pairs country-level bootstrap** resamples (resample N/2 countries, evaluate both complementary halves — never resample rows; firewall sacred). Seed each resample deterministically as `12345 + resample_index`.
4. **Aggregate:** each indicator's **selection frequency** `π_j` across the B walks. The **stable core** = indicators with `π_j ≥ 0.60`. Report `π_j` and a per-recipe **selection-stability KPI** alongside LOCO-AUC.

**B schedule + stopping rule (not a guessed 50):** checkpoint at `B = 50`, then `+25` (75, 100, 125, 150, 175, 200). **Stop** when, for **two consecutive** checkpoints, BOTH hold: (a) `max_j |Δπ_j| < 0.05` across the pool, and (b) Jaccard overlap of `{j : π_j ≥ 0.60}` between checkpoints `≥ 0.90`. **Hard ceiling `B = 200`.** (Cost is $0/local; wall-clock is the only constraint — do not stop early just because it's free.)

**Held in reserve (NOT in the primary path):** beam search; single-XGBoost-on-all-40 (SHAP/gain) as a non-gating diagnostic only; a bounded best-subset (size ≤ 5–6) ceiling probe on the 2 broken canaries, diagnostic-only.

## 3. The 5 pilot recipes (roles)
| Recipe | n_pos | Role | run-2 LOCO | run-3 LOCO |
|---|---|---|---|---|
| civil_war_and_insurgency | 511 | **CONTROL** (must NOT move) | 0.682 | 0.667 |
| executive_power_consolidation | 105 | Patient A (broke 9→1 indicators) | 0.782 | 0.653 |
| military_coup | 203 | Patient B (broke, full-set swap) | 0.686 | 0.784 |
| banking_and_financial_crisis | 75 | "Is the gain real?" (run-3 gainer) | 0.771 | 0.839 |
| territorial_disputes | 162 | "Is the loss real?" (run-3 loser, tier drop) | 0.706 | 0.629 |

## 4. Reproducibility contract (Q2)
- **One pinned Docker image** (XGBoost / numpy / BLAS versions pinned) runs BOTH the local pilot and any future AWS walk — no separately-maintained local Python env. The tie-break-drift guard.
- **Signed lockfile manifest per recipe:** selected stable set, full `π_j` table, `B` used, seed sequence, dedup cluster map, `git_commit`, indicator-pool content hash, and the walk `config-signature`. The AWS walk consumes this by hash and fails closed on mismatch.
- **Determinism cross-check:** one fixed-indicator-set local dry-run on the final locked set must reproduce LOCO-AUC within `2×SE` of the bootstrap CI.
- **Firewall code-review checkpoint:** with-replacement country resampling must NOT leak a resampled-in duplicate country as its own held-out LOCO fold. Verified before results are trusted.

---

## 5. THE LOCKED SCORECARD (pass/fail bar)

**All ΔAUC tests below:** paired bootstrap on OOF predictions, paired on **identical country folds**, run-3.1 vs **run-2** (never run-3), `B_eval = 1000` (post-hoc, no retraining), **BH-FDR correction at q = 0.10** applied jointly across the 5 recipe-level tests.

### 5.0 CONTROL VETO — civil_war_and_insurgency (mandatory, evaluated FIRST)
- [ ] paired ΔLOCO-AUC 95% CI **contains 0** AND `|point estimate| ≤ 0.02`
- [ ] selected-indicator-set **Jaccard vs run-2 ≥ 0.60**
- **If either fails → the entire pilot is INVALIDATED**, regardless of the other four.

### 5.1 executive_power_consolidation (broke 9→1)
- [ ] `π_j ≥ 0.60` on **≥ 60%** of the locked set
- [ ] **split-half `π_j` Jaccard reliability ≥ 0.70**
- [ ] final indicator **count within ±3** of run-2's count
- [ ] LOCO-AUC **CI lower bound ≥ run-2 − 0.02**

### 5.2 military_coup (broke, full-set swap)
- [ ] same four sub-criteria as 5.1 (π≥0.6 on ≥60% of set; split-half Jaccard ≥ 0.70; count within ±3 of run-2; AUC CI lower bound ≥ run-2 − 0.02)

### 5.3 banking_and_financial_crisis (run-3 gainer — is it real?)
- [ ] paired ΔAUC 95% CI **lower bound > 0** AND **≥ +0.03** (else it's the same tie-break noise as the other movers)

### 5.4 territorial_disputes (run-3 loser — resolve decisively)
- [ ] CI **recovers to include run-2's ~0.71** (was noise; dedup fixed it) **OR** CI **stays significantly below with a tight interval** (real effect → flag for separate investigation)
- [ ] a **wide, ambiguous CI** straddling neither conclusion is a **FAIL**

### 5.5 OVERALL AWS-FUNDING GATE (all four must hold)
- [ ] **Control (5.0) passes** — mandatory
- [ ] **≥ 3 of the remaining 4** recipes clear their individual bar, post-BH-FDR(q=0.10)
- [ ] **mean `π_j` ≥ 0.60** across all 5 locked sets
- [ ] **mean pairwise Jaccard indicator-set stability** across the 5 recipes improves **≥ 0.30 absolute** over the run-3 baseline

**Anything short of this:** iterate locally (raise B toward 200, re-inspect the dedup threshold) — it is free; there is no reason to escalate to AWS on a maybe.

---

## 6. What a PASS authorizes / what it does NOT
- A PASS authorizes **one** discrete founder decision: run the gated full-fleet run-3.1 on AWS (`cost-preflight → canary → SQS approval → wave-gated fan-out`), expected ~$8–14, inside the $50/month cap. It does **not** auto-run.
- We will **not**: ship all-40-XGBoost+SHAP as primary; cherry-pick flattering recipes to the frontend; expect the collinear new indicators to be miracles; or publish the mis-stamped run-3 vintage (separate stamp bug, fixed independently).
