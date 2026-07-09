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

The **criteria + this screening/testing engine (§1, §2, §5, §6) are trend-agnostic** — built once, reused for every
recipe. Only the **mechanism list + shortlist + datasets (§3, §4)** are re-derived per trend (a fresh sourcing panel).
Banking proves the pipeline end-to-end; later trends turn the same crank with new ingredients.
