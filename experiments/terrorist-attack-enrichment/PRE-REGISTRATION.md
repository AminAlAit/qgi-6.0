# terrorist_attack enrichment — PRE-REGISTRATION 🔒 (drafted 2026-07-10)

**Method of record:** `qgi-docs/internal/rnd/recipe-enrichment-methodology-and-banking-case.md` +
`qgi-docs/architecture/indicator-criteria.md`. Templates: `qgi-ml/experiments/banking-enrichment/PLAN.md §11`,
`qgi-ml/experiments/military-coup-enrichment/PRE-REGISTRATION.md`. Fixed BEFORE any further code runs beyond the
recon already performed; no post-hoc relaxation once ratified.

**Status: DRAFT, locked pending the standard ratification pass** (5-persona positions → reconcile → chair-consensus
→ strict-purist adversarial GREEN) that banking §11 and military_coup both went through before their first AUC was
computed. This document is the fixed protocol to be ratified, not yet an executed run. Recon that produced the
numbers below is already done and is treated as pre-registration input (Step-0-equivalent diagnostics), not as a
first bite at the AUC apple — no AUC number for any enrichment candidate has been computed yet.

---

## 0. Context (recon, verified this pass)

- **Step 0 (event-set audit): PASSED.** 242 events / 71 countries / 1958–2021.
- **run-2 driver set:** `VC.BTL.DETH`, `VC.IDP.NWDS`, `DT.TDS.DECT.EX.ZS`, `MS.MIL.XPND.GD.ZS`, `v2xel_frefair`,
  `SL.UEM.1524.ZS`. Architecture binding: n_pos=242 ≥ 60 → **XGBoost** (not in question; only the driver set is).
- **THE FINDING THAT GATES EVERYTHING ELSE: there is currently no valid honest baseline.** run-2's own 6-driver
  set fails `coverage_gate_ok` (≥50% positive-survival) at **every** cell of `WINDOW_GRID=[3,5,7,10,12,15,18,21,25]`
  on the current 242-event positives.csv — best is **11.98% pos-survival @ window=10**. The ungated argmax
  `_final_fit` would otherwise report (loco_auc=0.7323, CI [0.591, 0.841], window=15) is a **skew/coverage-inflation
  mirage worse in kind than banking's**: only 21/242 (8.7%) positives survive at that window, all from 2013–2021,
  concentrated in a Sahel/Horn-of-Africa/South-Asia jihadist-era cluster, missing every pre-2013 event and every
  advanced-economy canonical case (US, UK, France, India, Israel, Germany, Japan, …). **Root cause isolated:**
  `VC.IDP.NWDS` has only 16 years of depth (2008–2024), violating indicator-criteria.md crit-2 (≥20 continuous
  years overlapping the 1958–2021 event span) outright — it should not have cleared screening as a run-2 driver,
  and it was carrying essentially all of the 0.7323 mirage (dropping it collapses AUC to 0.35–0.48). **But dropping
  it alone is not sufficient** — the remaining 5 WDI/V-Dem drivers (depths starting 1989/1970/1960/1991/1789) still
  fail coverage at every window (best 30.6% @ w10), because the AND-requirement across mismatched-depth series
  still restricts usable events to a late-20th-century sliver.
- This is a **more severe finding than banking or military_coup** (both of which at least produced an honest,
  coverage-passing — if lower — baseline before any enrichment work began). Here the base driver set itself must
  be re-screened/rebuilt before an enrichment comparison is meaningful at all.

---

## 1. Hypothesis

Once terrorist_attack has a coverage-passing, honest base driver set (Phase 0, below), orthogonal mechanism-specific
indicators — youth-bulge demographics, ongoing-conflict proximity, horizontal ethnic exclusion, and a strictly-lagged
prior-attack history — can lift LOCO-AUC honestly above that rebuilt baseline, net of the confound battery.

**This pre-registration is explicitly two-phase and Phase 1 is contingent on Phase 0 succeeding.** Phase 0 is not
optional scaffolding around the "real" experiment — on the evidence in §0, it *is* the load-bearing open question.

---

## 2. Phase 0 — rebuild the honest base driver set (BLOCKING PREREQUISITE, pre-registered criteria)

**Why this must be pre-registered too:** without fixing the acceptance bar for Phase 0 *before* rebuilding, "keep
swapping drivers until coverage passes" is exactly the kind of undisciplined search the whole methodology exists to
prevent. Phase 0 gets its own fixed bar:

1. **Hard coverage constraint during selection, not after.** Re-run driver selection over run-2's original candidate
   pool (WDI + V-Dem, the same universe run-2 drew from) with `coverage_gate_ok` (≥50% positive-survival at the
   selected window) enforced as a **hard filter inside the selection loop**, not merely reported post-hoc. This is
   the structural fix — run-2's selection evidently didn't enforce this, which is how `VC.IDP.NWDS` got in.
2. **Depth floor enforced up front.** Any candidate driver must independently clear indicator-criteria.md crit-2
   (≥20 continuous years overlapping 1958–2021) before entering the selection pool — this alone would have
   excluded `VC.IDP.NWDS` from run-2.
3. **Window LOCKED, not argmaxed, for the deliverable.** Pick the single window (from `WINDOW_GRID`) that clears
   the coverage gate with the best positive-survival / AUC trade-off, lock it, and use that locked window for
   **all** of Phase 1's baseline-vs-candidate comparisons. No fresh argmax later (inherits banking §11's and coup's
   commitment discipline — never re-select the window after seeing enrichment results).
4. **Provisional-honesty flag, carried forward.** Even a coverage-passing rebuilt baseline may still skew toward
   the post-2013/Sahel-Horn-South Asia era if the surviving driver pool is itself recency-biased (the same
   mismatched-depth problem, one notch down). Phase 0's number is reported as **discovery-grade and provisional**
   until Phase 1's D5 (era/country decomposition) and D7 (temporal hold-out) — run on the *rebuilt baseline itself*,
   not only on candidates — confirm it is not a smaller version of the same mirage. If it is, that is itself a
   reportable finding, not a Phase-1 failure.

**Phase 0 deliverable:** a driver set (target 4–6 drivers, same slot budget as run-2) that clears
`coverage_gate_ok` at one locked window on the 242-event set, with a discovery LOCO-AUC number reported alongside
its coverage %, its window, and its era/country spread. **This number — not 0.7323, not the ungated 5-driver
number — becomes the sole denominator for every Phase 1 ΔAUC.**

**Phase 0 stop rule:** if no combination of coverage-clearing, depth-qualified drivers exists at any window in
`WINDOW_GRID` (i.e., the AND-coverage problem cannot be solved by driver substitution alone), the terrorist_attack
enrichment cycle is **BLOCKED, not failed** — escalate to the founder for a Step-0-style diagnosis of whether the
*panel itself* (not the events) is too depth-mismatched for a 1958–2021 span, analogous to how banking's blocker
turned out to be events rather than indicators. Do not report any AUC as a live product number for this trend until
resolved. Do not proceed to Phase 1.

---

## 3. Phase 1 — enrichment candidate shortlist (contingent on Phase 0 clearing)

In priority order:

1. **`OWID_POP_YOUNG`** (youth bulge / population age structure) — **primary bet.** 100% coverage at t-1/t-2,
   1950–2023 depth, 196 countries; clears crit-1/2 outright. Orthogonality clean (|r| ≤ 0.46 vs all 6 run-2
   drivers, no domain-exception needed). Hindsight risk LOW — slow-moving demographic/census statistic, not
   expert-rated, not event-triggered, not an episode/spell series.
2. **`UCDP_SB_ONSET`** (ongoing armed conflict / civil-war proximity, onset) — 93.8% coverage. Numerically clean
   cross-sectional orthogonality (|r| ≤ 0.09 vs all 6 run-2 drivers, even `VC.BTL.DETH` despite shared UCDP
   lineage) — **but this is exactly the episode/spell hindsight class the task brief warns about.** UCDP-style
   "onset" determinations are classically confirmed only after a peace-year threshold is satisfied on either side,
   i.e., retrospectively dated the same way `OWID_AUTOCRATIZATION` was for military_coup. **MANDATORY D8 (§4)
   before any positive result is trusted — cross-sectional orthogonality (D3) does not catch this.**
3. **`v2pepwrsoc`** (ethnic/social-group power exclusion, EPR-style horizontal inequality) — 99.6% coverage. Fails
   the |ρ|<0.5 pre-screen against `v2xel_frefair` (r=+0.649, shared V-Dem "governance quality" latent factor) —
   **requires D3b residualization (partial out `v2xel_frefair`) before testing**, per the coup precedent that made
   this mandatory for all V-Dem candidates. Hindsight risk MODERATE (standard V-Dem rater-hindsight caution) but
   **not** episode-coded — D8 is not triggered for this one; D3b is.
4. **`prior_attack_count` / `years_since_last_attack`** (the terrorism-trap, `DERIVED_NOT_IN_PANEL`) — **build
   prerequisite, blocking, mirrors coup D4.** Must be constructed as a strictly-lagged derived feature from
   `qgi-data`'s curated `terrorist_attack` events (same pattern as the coup-trap) — prior events strictly before
   t, never same-year. Built **first**, before any other candidate is gated (§4 D4), and **also** screened itself
   as a base-rate candidate. Not coverage-screenable until built.

**Backup / deprioritized, not run in Phase 1 pass 1:**
- `v2pepwrses` — same V-Dem family as `v2pepwrsoc` (r=+0.613 vs `v2xel_frefair`), likely redundant; test **only**
  as a substitute if `v2pepwrsoc` is disqualified, never jointly with it (avoid double-counting one mechanism as
  two candidates).
- `NY.GDP.PCAP.CD` — **deliberately NOT tested as a standalone Phase-1 candidate.** GDP per capita is the classic
  development-level/"just re-detects poor-unstable-country" confound (banking lesson #5). Rather than test it and
  then need a control *for* it, it is used **as the control** — see D3a below, mirroring banking §11's income-proxy
  gate (bare `NY.GNP.PCAP.CD` fit). Every surviving candidate (`OWID_POP_YOUNG`, `UCDP_SB_ONSET`, `v2pepwrsoc`,
  the trap) must beat a bare GDP-per-capita fit within the CI. If a future cycle wants to test development level
  itself as a mechanism, it needs its own orthogonal control (e.g., partialled against population/urbanization) —
  out of scope here.

**Excluded outright, do not test this cycle:**
- **`OWID_AUTOCRATIZATION`** — CONFIRMED confound from the military_coup cycle (V-Dem ERT `aut_ep` episode flag,
  cleared all 7 gates for coup at +0.059 dAUC, then proven fake by lag-decay: dead by t-3, and by leakage-safe
  reconstruction). All |r|<0.1 vs terrorist_attack's run-2 drivers looks clean the same way it looked clean for
  coup — that is the trap. Not a serious candidate; do not re-litigate.
- **`PV.EST`** (WGI Political Stability and Absence of Violence/Terrorism) — **disqualifying leakage (crit-4), not
  just hindsight risk.** This WGI sub-index explicitly scores "absence of terrorism/politically-motivated violence"
  as a defining component — using it to predict `terrorist_attack` is near-circular by definition. Excluded on
  leakage grounds independent of its 44.6% coverage failure.
- **`GE.EST` / `RQ.EST` / `CC.EST` / `RL.EST`** — coverage-vetoed (44.6% at t-1/t-2, WGI starts 1996).
- **`OWID_STATECAP`** — orthogonality failure (r=+0.734 vs `v2xel_frefair`, worst of any candidate scanned) plus
  unresolved composite-methodology/sourcing caution. Deprioritized on orthogonality alone.
- **`v2svstterr`** (state territorial authority) — HIGH conceptual circularity: V-Dem experts rating a state's
  monopoly of force are very likely to mark it down *because of* visible ongoing terrorism/insurgency —
  near-tautological with the outcome, PV.EST's leakage flavor but via rater-hindsight. Held in backlog; if ever
  revisited it requires the **same D8** check as `UCDP_SB_ONSET` before any result is trusted. Not run in Phase 1
  pass 1 (deprioritized behind `UCDP_SB_ONSET` to keep the episode/spell-risk exposure to one candidate this pass).
- **`UCDP_YEARS_SINCE_LAST_CONFLICT` / `UCDP_GED_TOTAL_DEATHS`** — coverage-vetoed (5–7%, 16-country cut).
- **`SI.POV.GINI`** — coverage-vetoed (16.5%).

---

## 4. Acceptance bar — 8-gate AND battery (D1–D7 standard + mandatory D8 for episode/spell-class candidates)

All ANDed; the AND-gate is the primary defense (FDR alone is weak at small k, per banking/coup precedent).

1. **D1 — coverage-matched baseline.** Judged vs Phase 0's rebuilt, locked-window baseline — never vs 0.7323
   (mirage) and never vs the ungated 5-driver number (still coverage-failing).
2. **D2 — missingness/coverage placebo.** A bare has-data dummy AND a values-scrambled (mask-preserved) permutation
   must each score near-null (~0.50–0.55) for every candidate; if either reproduces the lift → reject (this is the
   check that caught banking's `m2_reserves` as a confirmed 4th confound).
3. **D3a — income/development-proxy control.** Every candidate must beat a bare `NY.GDP.PCAP.CD` fit, CI excluding
   zero, on the same sample — the terrorism-specific instance of banking's income-proxy gate (lesson #5: "just
   re-detecting unstable/poor country").
   **D3b — V-Dem-family orthogonality (mandatory for `v2pepwrsoc` / `v2pepwrses`).** Residualize against the full
   run-2 V-Dem block (`v2xel_frefair` — currently run-2's only V-Dem driver, so this is a single-term partial
   correlation, not the 4-driver block coup faced); reject on shared-latent-factor collinearity.
4. **D4 — prior-attack-history control.** The trap feature is built FIRST (§3, item 4) as a blocking prerequisite.
   Every other candidate must show incremental lift **over a prior-attack-count-alone baseline** — does it add
   anything beyond "this country has attacks"? If the trap build slips, D4 is explicitly downgraded to advisory in
   writing (never left ambiguous between "gates everything" and "deferred") — mirrors coup's resolved D4.
5. **D5 — per-country / per-era decomposition.** Lift must land on a plausible spread of terrorism-affected
   countries and eras, and must **NOT** be concentrated in the same 2013–2021 Sahel/Horn-of-Africa/South-Asia
   jihadist-era cluster that produced the 0.7323 mirage in §0 — this is the terrorism-specific version of "not 2–3
   lucky folds," directly targeting the exact skew already caught once in this trend. Also applied to Phase 0's
   rebuilt baseline itself (§2 item 4).
6. **D6 — country-block paired-bootstrap ΔAUC 95% CI-lower > 0** vs Phase 0's baseline, BH-FDR across the shortlist
   (≤4 candidates + the trap). Secondary to the AND-gate, not the headline defense.
7. **D7 — locked leakage-safe temporal hold-out** (fit-once/score-once, no re-selection) replicates. Given the
   242-event span runs to 1958, a pre/post split should have real hold-out mass on both sides — advisory-only
   downgrade condition (sparse post-cut positives) is less likely here than it was for banking's EM subset, but
   check before locking the cut year.
8. **D8 — MANDATORY lag-decay + leakage-safe-reconstruction check for any episode/spell/expert-coded candidate
   that clears D1–D7.** Applies to `UCDP_SB_ONSET` by pre-registration (and to `v2svstterr` if it is ever promoted
   out of backlog). Required sub-checks, all run before the candidate is trusted:
   - **Lag decay:** score the candidate's lift at t-1, t-2, t-3, t-4/5. A candidate whose lift is concentrated at
     t-1 and dead by t-3 is coincident/backdated, not leading — reject regardless of D1–D7 status.
   - **Leakage-safe real-time reconstruction:** rebuild an analog signal from strictly ≤t, one-sided/cumulative
     information only (e.g., a real-time onset proxy built from strictly-lagged UCDP battle-death or conflict-year
     counts, not the coded "onset" flag itself) and re-score; if the real-time reconstruction is non-significant
     while the coded flag is significant, the coded flag's edge is retrospective dating, not signal.
   - **Strict-episode test:** require the onset/episode to have started ≥2–3 years before t; if the lift vanishes
     under this stricter timing, reject.
   - This is the exact battery that unmasked `OWID_AUTOCRATIZATION` for military_coup — D3-style cross-sectional
     orthogonality alone (already numerically clean for `UCDP_SB_ONSET`, §3 item 2) does **not** catch this failure
     mode, which is why D8 is a separate, mandatory, non-optional gate rather than folded into D3.

**If a candidate clears D1–D7 but is episode/spell/expert-coded-onset in nature and D8 has not yet run, it is
PROVISIONAL, not accepted.** No live-number or product claim is made on D1–D7 alone for that class of candidate.

---

## 5. Discovery vs Confirmed

Per the method of record: the greedy/argmax LOCO-AUC (Phase 0's rebuilt-baseline number, and each Phase-1
candidate's raw LOCO-AUC) is **discovery only** — an argmax scored on the same folds it reports, inherently
optimistic (this is exactly the mechanism that produced both the 0.7323 mirage here and run-2's original 0.771
mirage on banking). The **trusted/confirmed** number for any claim is:
- country-block paired-bootstrap ΔAUC, 95% CI lower bound > 0, vs the coverage-matched Phase-0 baseline (D6);
- a per-country/per-era decomposition showing the lift lands where the mechanism should, not on 2–3 lucky folds or
  the known 2013–2021 skew cluster (D5);
- a locked, leakage-safe temporal hold-out, fit-once/score-once (D7);
- for episode/spell-class candidates only, the D8 lag-decay + reconstruction battery.

The gap between the discovery number and the confirmed number is reported explicitly as measured selection
optimism, for both Phase 0's baseline and every Phase 1 candidate — not just for whichever wins.

---

## 6. Stop rule

- **Phase 0 fails to produce any coverage-passing driver set** (§2 stop rule): cycle BLOCKED, escalate to founder
  for a panel-depth diagnosis, no Phase 1, no live-number claim for this trend.
- **Phase 0 succeeds, Phase 1 runs, and no candidate clears the full D1–D7 (+D8 where triggered) battery:** record
  Phase 0's rebuilt, locked-window baseline as terrorist_attack's **honest ceiling** for this cycle. Update the live
  product number to that value (or flag it as still-provisional per §2 item 4 if D5/D7 reveal residual era skew in
  the baseline itself). No further indicator search this cycle — move to the next trend/track.
- **A candidate clears D1–D7 but is episode/spell/expert-coded-onset and D8 has not run:** treat as unresolved, not
  accepted, not rejected — run D8 before any claim. Do not ship on D1–D7 alone (this is the specific discipline
  the coup cycle's `OWID_AUTOCRATIZATION` near-miss is here to prevent from repeating).

---

## 7. Odds (prior, un-anchored)

**Lower than military_coup's 45–60%, roughly in banking's 30–50% band or below, for two compounding reasons specific
to this trend:**
1. Phase 0 itself is not guaranteed to succeed — the AND-coverage problem across mismatched-depth WDI/V-Dem series
   is structural, not a single-driver fix (§0), so there is real probability mass on the cycle stalling at Phase 0
   before Phase 1 ever runs.
2. The best-positioned candidate (`OWID_POP_YOUNG`) is structurally clean and comparable to coup's
   `v2stcritapparm` (a genuinely new mechanism run-2 wholly lacks) — a positive sign — but the shortlist also
   carries a higher concentration of episode/spell-risk candidates (`UCDP_SB_ONSET`, backlogged `v2svstterr`) than
   either prior cycle had, i.e., a higher chance of a coup-style "clears D1–D7, dies at D8" near-miss rather than
   either a clean win or a clean null.

**Point estimate: ~20–35% chance any candidate clears the full battery honestly** (conditional on Phase 0
succeeding at all), plus a **separately-tracked ~40–50% chance that `UCDP_SB_ONSET` specifically clears D1–D7 and
is then killed by D8** — worth calling out in the eventual outcome write-up as its own line, the way coup's
write-up did for `OWID_AUTOCRATIZATION`, because "cleared 7 gates, died at the 8th" is itself the reportable
methodology result even when the net product outcome is a null. **Expected size if anything clears cleanly:
modest, +0.02–0.06**, not a return to the 0.7323 mirage.
