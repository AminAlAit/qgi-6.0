# Banking & Financial Crisis — Recipe Enrichment Plan (plan of record)

**Created:** 2026-07-09 · **Trend:** `banking_and_financial_crisis` · **First of the per-trend enrichment passes.**
**Origin:** run-3.1 pilot closed INVALIDATED — indicator *selection* is fragile regardless of sample size, but
**predictive power (AUC) was never capped.** The fix is sourcing **orthogonal, mechanism-specific indicators**,
one trend at a time. Banking is first (most country-starved, clearest mechanism, cleanest free data) *and* the
template for every later trend. See `../run-3.1-pilot/POST-MORTEM.md` and
`qgi-docs/architecture/indicator-criteria.md`.

---

## 0. What we are actually improving — the WHOLE recipe, not just confidence

A live recipe's profile (`results/shape_fits/<recipe>/phase1_lock.json`) is a **joint fit** of three things off
the driver set + training positives:

| Component | Field | Fit by |
|---|---|---|
| **Drivers** (key indicators) | `indicator_ids` | selection (greedy / audition) |
| **Canonical length** | `canonical_length_T` (point + posterior IQR) | `fit_shape_prototype.py` (`tariq_v1_emit_acf_panel_pooled`) |
| **Canonical movement** | `per_indicator_trajectory_signature` (posterior trajectory / cov per driver) | `fit_shape_prototype.py` (hierarchical-Bayes GP) |

Length and movement are **derived from the drivers**, not fixed constants (observed: foreign_intervention length
IQR `[4,6]` vs recession `[5,5]` — genuinely estimated). Terminating event + aggregation rule are definitional and
stay fixed.

**REQUIRED — re-derive the full recipe (the "bake"):** after selecting enriched drivers we **re-run
`fit_shape_prototype.py`** so `canonical_length_T` **and** `per_indicator_trajectory_signature` are re-estimated
from the new set. We do **not** bolt new drivers onto a frozen length/movement and only re-score AUC — that would
yield exactly the one-gain outcome we are avoiding. Success = a **sharper whole recipe** (tighter / more-distinct
length, cleaner movement) **and** a real confidence gain.

> Watch item: all current live recipes land at `canonical_length_T.point = 5`. If that is the length prior/pooling
> flattening real differences, better drivers are exactly what should let lengths differentiate — check per-recipe
> length movement after the re-fit, don't assume 5.

---

## Step 0 — Event-set audit (MUST precede any indicator work) ⭐ trend-agnostic

**Enriching a trend means attending to its EVENTS *and* its indicators — not just indicators.** A recipe's positive
event set is the ground truth every driver is fit and scored against. If the set is **unrepresentative of the trend's
real-world universe** — missing canonical instances, or skewed to one country-group/era — then *no indicator can add
signal for the events that aren't there.* An indicator question can be a disguised missing-events problem.

**Before touching a single indicator, audit the positive set:**
1. **Canonical-instance check** — are the textbook instances of this trend present? (For banking: Argentina 2001,
   Mexico 1994, the 1997 Asian crisis, Russia 1998…)
2. **Composition check** — is the country/era mix representative, or skewed? (Compute the country-group + decade
   distribution; compare against a domain catalog, e.g. Laeven-Valencia for banking crises.)
3. **Mechanism-coverage check** — do the events span the mechanisms you intend to add? A mechanism (e.g. EM
   twin-crisis / sudden-stop) is untestable if the events it explains are absent from the set.

**If the set is unrepresentative → fix the events FIRST** (targeted enrichment via the `/qgi-enrich-events` pipeline,
onset-year, breadth-first over the missing country-group) → rebuild `positives.csv` → *then* proceed to indicators.
Skipping this wastes indicator effort on a set that structurally can't reward it.

> **Banking worked example (2026-07-10):** the first indicator pass (§3–§6 below) found the sole gate-surviving
> candidate *lowered* AUC, and external-fragility couldn't even be tested — because the banking positive set was
> **missing nearly every canonical EM crisis** (Argentina/Mexico/Brazil/Indonesia/Turkey/Russia = 0 events; skewed
> advanced/European). The blocker was events, not indicators. → event batch requested (76 → ~112, big-EM-first);
> indicator re-test waits on it. This is why Step 0 exists.

---

## 1. Admission bar — the 6 QGI indicator criteria (canonical)

Every candidate must pass all six (full spec: `qgi-docs/architecture/indicator-criteria.md`):
breadth (≥120 or the trend's panel) · depth-in-the-right-years (≥20 continuous, overlapping 1974–2020) ·
open license (CC-BY / commercial-OK) · leakage-free (knowable before, not a consequence) · panel-native
(annual, (country, year)) · orthogonal (new mechanism, not a duplicate).

## 2. Screening pipeline (order = cheapest / hardest veto first)

1. **License** → CC-BY / commercial-OK, else reject.
2. **Panel shape** → annual, joins on (country, year).
3. **COVERAGE-AT-THE-POSITIVE-CELLS (hard pre-gate)** → ≥~80% non-null on the **76 crisis (country, t‑1 AND t‑2)
   cells**, reported per-event, not as a global average. *This is the specific fix for run-3.1's banking arm, which
   returned **zero paired rows** because the enrichment indicators did not exist on the crisis country-years.* A
   perfect mechanism empty on Argentina/Indonesia/Nigeria is worthless.
4. **Leakage** → value determined before the crisis, independent of it; lagged to t‑1/t‑2.
5. **RESIDUAL-ORTHOGONALITY (hard pre-gate, in code)** → residualize each **derived feature** (gap/growth/ratio —
   NOT the raw series) against run‑2's existing indicators; reject `|ρ| > 0.5` vs any pool member / low incremental
   partial-AUC. Redundancy hides in the transform — this is the exact lesson run‑3 taught.

Only survivors are pulled and tested. **Test one mechanism at a time**, cap the final recipe at **+3 to +6** truly
orthogonal drivers (76 positives / 48 countries cannot support another 100-indicator dragnet).

## 3. Banking indicator shortlist (from the 5-persona panel)

**FIRST: audit run‑2's existing banking drivers for any credit-gap/growth term.** If present, the credit mechanism
is "orthogonality theater" and the lead bet pivots to external-sector fragility.

| Pri | Indicator (the transform) | Mechanism | Source (CC-BY) |
|---|---|---|---|
| P1 | One-sided **credit-to-GDP gap** + 3y real credit growth | domestic credit boom | WDI `FS.AST.PRVT.GD.ZS` / GFDD |
| P1 | **Short-term external debt / reserves** (Guidotti-Greenspan) + ST-share | rollover / sudden-stop (EM twin) | IDS `DT.DOD.DSTC.IR.ZS` |
| P1 | **M2 / reserves** | run vulnerability | WDI (broad money + reserves) |
| P2 | Current account + **capital-inflow surge** (the change, not the level) | external-imbalance boom | WDI |
| P2 | **Net foreign assets / currency mismatch** — *reconstruct from IDS/IIP* (EWN is license-blocked) | external balance-sheet | WB IDS/IIP |
| P3 | **REER overvaluation** (one-sided detrend) | overvaluation → correction | PWT 10.x / WDI |
| P3 | **Commodity terms-of-trade shock** (build = Pink-Sheet prices × export weights) | exogenous trigger | WB Pink Sheet |

## 4. Datasets — web-verified license status (2026-07-09)

**✅ ADMIT — all CC-BY 4.0, commercial OK (ship first, zero legal risk):**
- **WDI** (World Bank) — 217 economies, 1960– · credit, M2/reserves, CA, REER
- **GFDD** (World Bank) — 214 economies, 1960–2021 · private credit, bank funding/liquidity (avoid NPL/Z-score — outcomes, start ~1998)
- **IDS** (World Bank) — 120+ LMIC (EM only), 1970– · short-term external debt / reserves
- **PWT 10.x** (Groningen) — 183 countries, 1950–2019 · REER-overvaluation, revision-robust GDP

**⚠️ Conditional / second wave:**
- **Pink Sheet** (WB, CC-BY) — global commodity prices, **not a country panel** → use to *build* country ToT, not as-is.
- **External Wealth of Nations** — **BLOCKED**: Brookings copyright, commercial use needs permission/fees. Reconstruct NFA from WB IDS/IIP.
- **BIS / IMF-IFS / JST / Bruegel** — free to access, commercial redistribution unverified/likely-NC → second wave only, or reconstruct in-house. (Also: BIS credit-gap ~40 countries, JST 18 — fail the EM coverage gate anyway.)

## 5. Guardrails (enforced as code)

- **One-sided filter only** — a two-sided HP filter peeks at the future → fake AUC. Reconstruct the credit gap in-house; leakage-proof fallback = raw 3y credit growth.
- **Lag to t‑1/t‑2, beginning-of-period stocks** — reserves are drained *during* the crisis; GDP collapses and mechanically inflates credit/GDP at onset.
- **Leakage ban-list** — no crisis-response/outcome fields (Laeven-Valencia fiscal cost, liquidity support, guarantees; bank NPLs, Z-score, provisioning) and no hidden crisis dummies in JST / Reinhart-Rogoff files.
- **Missingness-as-signal** — IDS is EM-only; a tree learns "missing = country-type = base-rate." Use native-NaN + explicit missingness flag + ablation; do **not** mean-impute.
- **LOCO averages out global/year factors** — US rates, term spread, VIX add zero cross-sectionally; value only as **interactions** with country vulnerability. (VIX is CBOE-licensed = out.)
- **Vintage/revision optimism** — back-revised data partly "knows" the crisis. Prefer changes over levels; state the caveat.
- **Hyperinflation/unit hazards** — Argentina/Brazil/Russia/Turkey: use real / GDP-scaled, winsorize, harmonize units at ingest.

## 6. Acceptance — judge the whole recipe, no stability gate

A candidate/enriched recipe is accepted only if:
1. **Confidence:** country-**block** paired-bootstrap **ΔAUC 95% CI lower bound > 0** vs run‑2 (0.771), FDR-adjusted
   across the candidate set. (Block bootstrap because Argentina '80/'89/'01 etc. inflate naive significance.)
2. **Mechanism-aligned lift:** a per-country ΔAUC decomposition shows the gain lands on the countries the mechanism
   targets (twin-crisis EMs — Mexico '94, Indonesia/Korea/Thailand '97, Turkey '01, Argentina '01) — not 2–3 lucky folds.
3. **Sharper whole recipe (the bake):** after `fit_shape_prototype.py` re-fit, `canonical_length_T` and
   `per_indicator_trajectory_signature` are re-derived; the recipe is not worse and ideally tighter / more distinct.
4. **Locked hold-out confirmation:** confirmed **once** on a hold-out locked *before* screening (skeptic favors a
   **temporal** block — train pre-2005, test 2005–2020 — so a forecasting product survives regime change; country-holdout is second-best). Screen on LOCO, confirm once on the lock-box.

## 7. Open decisions (founder)

- **Lead mechanism:** credit-gap (economists) vs external-fragility (skeptic/EM). → *resolve by auditing run‑2's existing drivers first; test both, attribute one at a time.*
- **Hold-out design:** temporal vs country. → *recommend both (LOCO to screen, one temporal lock to confirm).*
- **Property / house prices:** high-value pair vs EM coverage-trap → *deprioritize for this EM-heavy panel.*

## 8. Reusability

The **Step 0 event-set audit + the criteria + the screening/testing engine (Step 0, §1, §2, §5, §6) are
trend-agnostic** — built once, reused for every recipe. Only the **mechanism list + shortlist + datasets (§3, §4)**
are re-derived per trend (a fresh sourcing panel). Every per-trend pass runs **Step 0 (events) → §1–§6 (indicators)
→ re-fit the whole recipe**. Banking proves the pipeline end-to-end; later trends turn the same crank with new
ingredients.

## 9. Status log

- **2026-07-09** — plan of record created; run-2 → 250-pool origin. Committed qgi-ml `eb96ed9`.
- **2026-07-10 — P0 (audit):** run-2 banking drivers = `NV.SRV.TOTL.ZS` (services %GDP) + `v2x_gender` + `MS.MIL.XPND.GD.ZS`; **no credit term** → credit-gap genuinely orthogonal. Baseline LOCO-AUC 0.7707 reproduced byte-exact. Machinery + Docker vehicle (`qgi-run31-pilot:py313`) verified.
- **2026-07-10 — P1–P3 (indicators, first pass):** 6 candidates built; **only `credit_growth_3y_fd` cleared both gates** (80% coverage, orthogonal). Adding it **lowered** AUC: 0.771 → 0.751, **ΔAUC −0.052** (CI [−0.148, +0.057], crosses zero) — REJECTED, robust across all 9 windows, purist-verified byte-exact + leakage-clean. External-fragility (ST-debt/reserves, M2/reserves) **vetoed at the coverage gate** (EM-only data vs advanced-heavy positives). Artifacts under `p1/` (`build_features.py`, `screen.py`, `p2_evaluate.py`, candidates, results).
- **2026-07-10 — ROOT CAUSE → Step 0 added:** the banking positive set is **missing nearly every canonical EM crisis** (Argentina/Mexico/Brazil/Indonesia/Turkiye/Russia = 0). This — not the indicators — is the blocker. **Event batch requested** (targeted Mode-A, onset-year, big-EM-first, 76 → ~112). Country-id join verified (`turkiye`/`ivory_coast`/`czechia`/`cabo_verde`/Congos all map to the panel's Title-case keys). **Indicator re-test (§1–§6) waits on the event batch merging + `positives.csv` rebuild.**
- **Bonus flag:** the run-2 0.771 anchor is itself window-selection-fragile (only 0.771 at `window=25`; ~0.5–0.64 elsewhere) — pre-existing multiple-comparisons optimism in run-2, worth revisiting separately.
- **2026-07-10 — RE-TEST on enriched 116-positive set:** rebuilt `positives.csv` via `build_verified_positives.py` (76→116, 48→88 countries, all flagship EM crises in, malaysia PARTIAL excluded). Re-gated all 6 candidates + re-tested. Results (purist-reproduced byte-exact, 3 fresh Docker runs, leakage-clean): **(a) run-2's true representative baseline = 0.638, NOT 0.771** (the 0.771 was skew-inflated ~0.13 by the old advanced-heavy set). **(b)** `credit_growth_3y_fd` still the only gate-passer; ΔAUC flipped −0.052→**+0.025** but CI [−0.059,+0.112] crosses zero (p=0.62) and lift is NOT EM-concentrated → REJECTED. **(c)** external-fragility coverage improved a lot on the EM subset (stdebt/reserves 24→41%, 11/13 twin-crises; M2/reserves 56→67%, 12/13) but **still fails the aggregate 80% gate** because ~30+ advanced-economy positives have 0% IDS coverage by construction → never AUC-tested. Artifacts under `p1/retest_116/`. **Conclusion: the events fix worked for its target, but banking is structurally two crisis types (EM vs advanced) and no single-recipe indicator won. → wide-net re-selection is the next move (see §10).**

- **2026-07-10 — WIDE-NET re-selection (pooled, 250+6 deduped→188, +t2/t3 lag features, ≤6 drivers, lock-floor 0.50, checkpointed):** greedy selected a SINGLE indicator — **GII (UNDP Gender Inequality Index)**, window 10, discovery LOCO-AUC 0.680 = +0.042 over 0.638. **REJECTED on honest validation** (all byte-reproduced by purist): (1) country-block paired-bootstrap dAUC +0.062, 95% CI **[−0.046, +0.177], p=0.29 → fails CI-lower>0**; (2) leakage-safe locked temporal hold-out AUC **0.569 < baseline 0.638** → does not replicate out-of-time. **GII is a development-level / coverage confound:** drops all 20 pre-1990 positives + 69% of fragile-state/EM crises (0.680 computed on an "advanced + 2008" subset), its edge is concentrated in the 2008-GFC window (+0.14) while it **underperforms the baseline in the 1990s EM twin-crisis era (0.486 < 0.592, worse than a coin flip)** — the fingerprint of a confound, not a mechanism. The discovery-vs-confirmed honesty machinery did its job: the +0.042 would have shipped a fake win. **Loose end:** the bare income-proxy same-pipeline test wasn't run (ordinal signal: GNI-per-capita outranks GII in the pre-screen). Artifacts: `widenet/results/full_run/` + `*_report.json`. **Conclusion: three passes (credit / external-fragility / wide-net-GII), three confounds or coverage-vetoes → the POOLED banking recipe is exhausted; the EM/advanced split (§10 #2) is the last untried structural idea.**

- **2026-07-10 — EM-SCOPED EXTERNAL-FRAGILITY TEST (pre-registered §11) → BANKING CYCLE CLOSED.** Ran the locked §11 protocol (purist-reproduced byte-exact, fresh Docker; commitment enforced by code). EM-eligible n_pos=**56 → LR** (committed, not nudged). **EM-only baseline = 0.543** (run-2's 3 drivers carry ~no signal on EMs). Results, all through the 7-gate AND-battery: **stdebt_reserves** +0.053 but CI [−0.085,+0.170] crosses zero (p=0.42), fails income-proxy/era/hold-out (hold-out CI-lower 0.235, below chance) — and fails the EM 80% coverage pre-gate (71.4%). **m2_reserves** AUC 0.373 (below chance) — **confirmed 4th confound** (D2 placebo: scrambled values reproduce the "signal" → it's coverage pattern, not content). **credit_growth (advanced subset)** −0.055, CI crosses zero, no lift. **NONE clears the AND-gate.** Honest limitation: no WB income table exists locally → used a political-stability cohort proxy that misclassifies Argentina'01/Brazil'94 as "advanced" (flagged; doesn't inflate anything). Artifacts: `em_test/`. **Per §11's own pre-registered rule → banking's honest ceiling = ~0.638 (0.543 on EM); FOUR mechanism families tried (credit-growth / external-fragility pooled / wide-net-GII / external-fragility EM-scoped), four confounds/nulls. NO 4th/5th search. Cycle closed.**

**BANKING VERDICT (cycle closed 2026-07-10):** honest ceiling **~0.638** (the live "0.771" was a skew+window mirage). The recipe stays run-2's 3 drivers, length/movement unchanged (nothing passed). **Product action:** correct the live number 0.771→0.638 + widen bands (§10 #5). **Methodology win:** the pre-registration + confound battery + purist discipline caught 4 fake wins that the old process would have shipped (0.771, GII, etc.) — proven + reusable for every future trend. **Next:** event-depth (§10 #8, deeper EM episodes) OR move to a fatter/cleaner trend for a first honest win. One loose thread if ever revisited: source a real WB income-group classification (vs the political-stability proxy) and re-check the EM subset — but given the decisiveness (coverage pre-gate fail + placebo confound + below-chance hold-out) it is very unlikely to flip.

## 10. Banking deep-dive backlog (for later)

The full per-recipe deep-dive, captured 2026-07-10 for when we return to it:

1. **Wide-net re-selection (the immediate next run).** Stop bolting single candidates onto run-2's 3 stale drivers (services/gender/military, fit to the *skewed* set). Run the full greedy audition over the **whole 250+ indicator pool + our derived transforms** (credit gap/growth, ST-debt/reserves, M2/reserves) on the corrected 116-positive set. This is real QGI wide-net methodology — let everything compete, catch hidden co-variates. Judge on **LOCO ΔAUC vs the honest 0.638 baseline**, no stability gate; accept the fragile blend, don't oversell any single indicator.
2. **EM vs rich-country split — let the result decide, don't pre-split.** Banking is two crisis types: EM twin/sudden-stop (external-fragility data exists) vs advanced-economy 2008-style (need credit/leverage; external data absent). If the wide net can't serve both pooled → split into two sub-recipes with different drivers + **per-group coverage gates**. Trigger = wide net underperforms or picks are incoherent across groups.
3. **EM-scoped coverage gate.** To finally AUC-test external-fragility, scope G1 to the EM banking subset (coverage now 85–92%, 11–12/13 twin-crises). ⚠️ **Control the missingness-as-EM-proxy confound** (purist flag): "has IDS data" must not proxy "is EM = higher base rate." Verify lift lands on EM twin-crises via per-country decomposition, not advanced folds.
4. **Advanced-economy external-fragility proxy.** If we want external-fragility to serve *both* groups, source a reserves/external-position series covering advanced economies (or reconstruct). Otherwise it's EM-only by construction.
5. **Fix the live product baseline.** Banking's real representative AUC ≈ **0.638**, not 0.771 (skew + window optimism). Push the correction downstream (soften wording / widen bands per the standing live-trend decision).
6. **Window-selection fragility.** run-2's AUC is an argmax over 9 windows with no nested/out-of-sample selection — bake nested window selection into both the honest baseline and candidate comparisons.
7. **Acceptance discipline (carry from §6).** country-block ΔAUC CI-lower>0 vs 0.638 + mechanism-aligned per-country lift + locked temporal hold-out → then re-fit the whole recipe (`fit_shape_prototype`) for length/movement (the "bake").
8. **2nd events batch (optional).** Current set = one representative crisis per country (breadth). Deep multi-year episodes (Argentina '80/'89/'01; Turkiye '94/'01) available as a follow-up batch if we want within-country temporal signal.

## 11. PRE-REGISTRATION — EM-scoped external-fragility test (2026-07-10) 🔒

Ratified by the 5-expert consensus panel (positions→reconcile→chair→purist GREEN + 3 hardening edits). **Fixed BEFORE any AUC is computed; no post-hoc relaxation.** This is banking's *last* indicator experiment this cycle.

**Structure — "split the gate/eligibility, pool the fit" (NOT a hard split).** Test the external-fragility mechanism only where it applies + has data (EM), fairly, fraud-checked; if it survives, fold it into the ONE live recipe as a **regime-conditional interaction term** (value if EM-eligible, native-NaN for advanced rows, L2-shrunk) — never two separate models. Hard split is an evidence-gated last resort only.

**EM-eligibility (ex-ante, leak-safe):** WB income-group / IMF-WEO advanced-economy classification at event year **t−1** (lagged so a country's own crisis or later graduation — e.g. South Korea, Poland, Chile — can't reclassify it). Spot-check graduation edge cases.

**🔒 COMMITMENT (write before any AUC):** the resulting EM-eligible **n_pos** and the architecture it triggers under the codebase's binding rule (**n_pos<60 → LR / THIN_CAP=5; n_pos≥60 → XGBoost**) are recorded as a commitment, reported explicitly, and **binding** — no nudging a borderline country's eligibility to cross the 60-line after the fact.

**The experiment (one pass, all reusing built machinery):**
1. Recompute run-2's 3-driver baseline via LOCO **restricted to the EM-eligible subset**, window **LOCKED** to the pooled baseline's chosen window (no fresh argmax on the smaller sample). *This EM-only baseline — NOT 0.638 — is the only valid denominator.*
2. Score **stdebt_reserves** + **m2_reserves** LOCO on that identical EM subset, EM-scoped 80% coverage gate (indicator-criteria.md trend-panel-floor exception).
3. Same pass, secondary/non-gating track: re-test the already-built **credit_growth_3y_fd on the advanced-only subset** vs its own recomputed baseline.

**ACCEPTANCE BAR — all 7 ANDed (D1–D7); the AND-gate is the primary defense:**
1. **Coverage-matched baseline** — judged vs the EM-subset baseline, never pooled 0.638.
2. **Missingness/coverage placebo** — a bare "has-IDS-data" dummy AND a values-scrambled (mask-preserved) permutation must each score near-null (~0.50–0.55); if either reproduces the lift → reject. *(new script, test-first)*
3. **Income-proxy control** — must beat a bare GNI-per-capita fit (`NY.GNP.PCAP.CD`, already in panel), CI excluding zero, **within** the EM subsample. *(new script, test-first)*
4. **Era/2008 decomposition** — survives `auc_with_without_cohort(exclude 2008)`; must NOT invert/collapse in the 1990s EM twin-crisis era (the GII fingerprint).
5. **Per-country decomposition** — lift concentrated on named twin-crises (Mexico'94, Thai/Korea/Indonesia'97, Russia'98, Turkiye'01, Argentina'01, Brazil'94), not 2–3 lucky folds.
6. **Country-block paired-bootstrap ΔAUC 95% CI-lower > 0** vs the coverage-matched baseline, BH-FDR across the ≤3 candidates. *(FDR is weak at k≤3 — a secondary safeguard, NOT the headline defense; the D1–D7 AND-gate is.)*
7. **Locked leakage-safe temporal hold-out** replicates (downgraded to advisory if EM post-2005 positives < ~8).

**If it clears all 7:** promote as the regime-conditional interaction term → re-score FULL 116/88 LOCO vs the true 0.638 → XGBoost-with-native-regime-flag sensitivity cross-check (disagreement in direction ⇒ unresolved, don't ship) → re-bake `fit_shape_prototype` (length + movement, per §0). Parallel cheap check: nested window selection on the pooled baseline (confirm 0.638 isn't itself argmax-optimistic).

**If ANY gate fails (the modal expected outcome):** record ~0.638 (or its nested-corrected value) as banking's **honest ceiling for this cycle**, push the live-product correction (§10 #5), and redirect to event-depth (§10 #8) or the next trend. **No 4th/5th indicator search.**

**Odds (un-anchored prior, lower-confidence than GII's — no EM-subset discovery number exists yet):** ~**30–50%** of clearing. Expected size if it clears: **modest, EM-concentrated +0.03–0.08** (high-0.6s/low-0.7s), not a return to the 0.771 mirage.
