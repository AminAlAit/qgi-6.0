# run-3.1 CPSS Selection-Stability Pilot — Post-Mortem

**Date closed:** 2026-07-09 · **Branch:** `experiment/run-3.1-stability-pilot` @ `a7a0513`
**Verdict:** ❌ **INVALIDATED / NO-GO** (control veto failed)
**Machine scorecard:** [`results/PILOT-REPORT.md`](results/PILOT-REPORT.md) · [`results/report.json`](results/report.json)
**Pre-registration:** [`PRE-REGISTRATION.md`](PRE-REGISTRATION.md) (gate fixed *before* results — no post-hoc goalpost moving)

---

## 1. What we tested

After the run-3 AWS enrichment (250 indicators) came back **net-neutral** on AUC, we asked a narrower question:
**is our indicator *selection* stable — do the same indicators get picked when we perturb the data?**

Method: **Complementary-Pairs Stability Selection (CPSS)**. For each recipe we ran selection on 24
country-bootstrap subsamples (complementary 50% country-halving) and kept only indicators chosen in
**≥60%** of runs (π ≥ 0.60 = a "stable core"). Two arms per recipe — `run31` (greedy + correlation-dedup
|r|>0.85) and `run3method` (plain greedy) — scored against the **run-2** production baseline.

5 recipes × 2 arms + 5 run-2 baselines = 15 walks. All landed clean (0 crashes; survived multiple
Docker outages + 2 laptop reboots via checkpointing).

## 2. Result — all 5 fail, every stable core empty

| Recipe | Role in gate | Events / countries | Stable core (bar ≥1 @ π≥0.60) | Mean π over ref-set | run-2 LOCO-AUC | Verdict |
|---|---|---|---|---|---|---|
| **civil_war** | **control (veto)** | **516 / 88** | **0** | **0.194** | 0.626 | ❌ FAIL |
| exec_power | patient | 106 / 58 | 0 | 0.125 | 0.707 | ❌ FAIL |
| military_coup | patient | 205 / 73 | 1 | 0.192 | 0.677 | ❌ FAIL |
| banking | gain-is-real | 76 / 48 | 0 | 0.056 | 0.771 | ❌ FAIL |
| territorial | loss-decisive | 163 / 62 | 0 | 0.056 | 0.701 | ❌ FAIL |

Overall: `other_passing=0`, pooled `mean_pi=0.124`. No recipe produced a stable core; the **best single
indicator anywhere was picked ~19% of the time** against a 60% bar.

## 3. The decisive finding (control veto)

**`civil_war` is the control — the trend with the *most* data (516 events, 88 countries, 7× banking) —
and its stable core is *also* empty (top π ~19%).**

This is the whole point of the pilot. If fragility were an event-count problem, the data-richest trend
should have been the *least* fragile. It was **just as fragile as banking (76 events).** Selection
fragility is **not** a sample-size problem in any range we can realistically reach.

## 4. What this rules out — and, crucially, what it does NOT

- ❌ **Ruled out:** "more events → stable indicators." Dead. Confirmed by the control, not merely suspected.
- ❌ **Ruled out:** correlation-dedup as the stabilizer. `run31` vs `run3method` stability improvement was
  negligible everywhere (+0.001 to +0.015) and **negative for banking (−0.004)** — dedup slightly *hurt*.
- ✅ **NOT ruled out — and this is the important part:** **predictive power (AUC).** CPSS measured *pick
  stability*, a different question. Every live recipe still predicts fine — run-2 LOCO-AUC **0.63–0.77**.
  **A fragile *choice* of indicators is not a bad *prediction*.** The blend works; the "which exact
  indicators" is what's unstable — and that is not what the product sells on.

## 5. Root-cause read

The candidate pool is large and internally **collinear** (WB + heavily V-Dem governance). Many indicators
carry near-identical signal, so a greedy walk on a perturbed subsample swaps freely between
equivalent-but-different indicators. Result: high-variance *selection*, stable *prediction*. Adding more
correlated indicators (run-3's 141, mostly V-Dem) or more events changes neither.

## 6. Decisions ratified (founder, post-Majles + this result)

1. **Shelve CPSS** → audit-only (quarterly / pre-graduation), not a per-run gate. It reliably finds
   nothing stable even at 516 events; it is diagnostic, not productive.
2. **Keep the run-2 (109-indicator) recipes LIVE** and soften the live copy: present as a *"blend of
   correlated predictors,"* not "key indicators"; widen confidence bands.
3. **Events → coverage/estimation-power only**, never sold as a stability fix. Banking coverage batch is
   optional, low-priority (see events-chat handoff).
4. **Keep the 250-indicator pool as a candidate bench** — tested per-trend after sourcing, never a blanket
   109→250 swap.

## 7. Game plan forward — the actual fix

The goal was always **higher AUC via better indicators** — which the pilot never tested or capped.
run-3 didn't lift AUC because it added **redundant** indicators, not because indicators can't help.

1. **Source, don't filter.** Bring in *orthogonal* predictors that measure what a recipe is currently
   blind to (banking → credit-to-GDP gap, bank leverage, capital-flow surges, house prices, short-term
   external debt). Mechanism-driven, **one trend at a time.**
2. **Pilot on banking first** (most country-starved, clearest mechanism, finance data readily available).
   Add ~10–20 genuinely new predictors.
3. **Judge by the honest test:** does banking's **LOCO-AUC beat run-2 by a real margin** (the
   paired-bootstrap ΔAUC already built here)? **No stability gate.** Pass → repeat per trend; fail → the
   signal isn't there, stop chasing.
4. **Redundancy pre-filter = hygiene, not cure.** Dropping indicators too correlated with the existing
   pool keeps things clean/fast, but it removes clutter — it does not add signal. Nice-to-have on the side.

**One line:** stop testing *stability*, start testing *whether new orthogonal indicators raise AUC* —
banking as the first proof, measured by ΔAUC vs run-2.
