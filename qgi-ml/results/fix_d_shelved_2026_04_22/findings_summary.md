# Fix D (V1.9.2) — shelved findings summary

**Date shelved:** 2026-04-22
**Trigger to resume:** verified-country event-curation coverage ≥ 190 countries (currently 89 staging / ~173 curated working set).
**First order of business on resume:** convene small stats council (Roshani / Kwame / Marcus); meeting does not end until path forward is clear. Agenda in §"Stats-council agenda" below.

---

## One-line summary

Real Athena-backed simulation revealed that Fix D's single-threshold regime over-weights rare-XL-category outliers (Bhutan's economic_liberalization, Guatemala's volcanic_eruption) above active-conflict countries (Syria/Yemen civil_war). Target HIGH-share band [25, 45]% and face-validity are not simultaneously satisfiable on the current 86-country staging universe. Shelved pending more data and a structural redesign.

---

## What was done (2026-04-22 session)

1. Wrote the design doc — `qgi-docs/methodology/recipes/v1.9.2-design.md` (commit `db0fd06`, now shelved with addendum `HEAD`).
2. Built a proxy simulator `simulate_fix_d.py` using `country-risks-v191.json` as input. Ran it; face validity came back 4/11; flagged methodology limitations (top-10 truncation).
3. Spawned adversarial Sonnet audit. Sonnet found P0-A (Cape Verde/Denmark/Germany absent from staging), P0-B (rare-category artifacts in proxy), P0-C (Venezuela prediction wrong — later refuted by real simulation).
4. Amin provided staging SSO creds. Wrote `simulate_fix_d_real.py` (Athena-backed, read-only, ~$0.50 spend). Ran it on 86 staging countries with recipes.
5. Real results revealed the rare-XL-outlier problem and the threshold-vs-band incompatibility. Shelved.

---

## Key numbers from the real simulation

| Threshold | HIGH | MOD | IND | HIGH share | Face validity (of 11 testable) | In target band? |
|---|---:|---:|---:|---:|---:|---|
| 3.0 | 76 | 9 | 1 | 88.4% | 11/11 | no |
| 3.2 | 71 | 14 | 1 | 82.6% | 11/11 | no |
| 3.5 | 62 | 23 | 1 | 72.1% | 9/11 | no |
| 3.8 | 45 | 40 | 1 | 52.3% | 7/11 | no |
| 4.0 | 38 | 45 | 3 | 44.2% | 4/11 | ✓ |
| 4.3 | 24 | 57 | 5 | 27.9% | 2/11 | ✓ |

**Takeaway:** there is no threshold where face validity is good AND HIGH share is in the target band. Pick one.

## Face-validity table at recommended threshold 4.0

| Country | Expected | V1.9.1 actual | Fix D actual | Fix D top category | salience |
|---|---|---|---|---|---:|
| Syria | HIGH | HIGH | MODERATE | military_coup [XL] | 3.54 |
| Somalia | HIGH | HIGH | MODERATE | humanitarian_crisis [S] | 3.96 |
| Yemen | HIGH | HIGH | MODERATE | military_coup [XL] | 3.21 |
| Afghanistan | HIGH | HIGH | MODERATE | poverty_and_inequality_crisis [XL] | 3.89 |
| Lebanon | HIGH | HIGH | MODERATE | interstate_war [XL] | 3.98 |
| Ethiopia | HIGH | HIGH | HIGH ✓ | poverty_and_inequality_crisis [S] | 4.73 |
| Pakistan | HIGH* | HIGH | HIGH ✓ | interstate_war [XL] | 4.04 |
| Iran | HIGH | MODERATE | MODERATE | foreign_intervention [XL] | 3.42 |
| Ukraine | HIGH | MODERATE | MODERATE | interstate_war [XL] | 3.58 |
| Venezuela | HIGH | INDICATIVE | HIGH ✓ | currency_crisis [XL] | 4.09 |
| Costa Rica | NOT_HIGH | MODERATE | INDICATIVE ✓ | economic_recession [XL] | 1.94 |

*Pakistan tier is contested across artifacts. V1.9.1 release notes say MODERATE expected; V1.9.1 actual is HIGH.

## Top-15 by Fix D salience (not the countries you'd expect)

| Country | V1.9.1 tier | Fix D @ thr=4.0 | Top Fix D category | salience |
|---|---|---|---|---:|
| Bhutan | INDICATIVE | HIGH | economic_liberalization [XL] | 4.96 |
| Argentina | MODERATE | HIGH | economic_nationalization [XL] | 4.88 |
| Chile | MODERATE | HIGH | economic_nationalization [XL] | 4.88 |
| Bolivia | HIGH | HIGH | water_crisis [S] | 4.84 |
| Guatemala | INDICATIVE | HIGH | volcanic_eruption [XL] | 4.84 |
| South Korea | INDICATIVE | HIGH | humanitarian_crisis [XL] | 4.79 |
| Niger | HIGH | HIGH | resource_conflict [XL] | 4.77 |
| Morocco | MODERATE | HIGH | resource_conflict [S] | 4.74 |
| Ethiopia | HIGH | HIGH | poverty_and_inequality_crisis [S] | 4.73 |
| Ghana | MODERATE | HIGH | resource_conflict [XL] | 4.71 |
| Brazil | INDICATIVE | HIGH | resource_conflict [XL] | 4.69 |
| Cambodia | INDICATIVE | HIGH | economic_liberalization [XL] | 4.63 |
| Mexico | MODERATE | HIGH | ethnic_and_communal_conflict [XL] | 4.62 |
| Kenya | MODERATE | HIGH | ethnic_and_communal_conflict [XL] | 4.61 |
| Burkina Faso | HIGH | HIGH | humanitarian_crisis [XL] | 4.56 |

**Why:** rare categories with a handful of non-zero countries produce extreme z. Severity weighting does not correct enough.

---

## What ≥190 verified countries is expected to change

1. **Global category means drop.** More zero-fill → crisis-category z's rise → better separation from the bulk.
2. **Rare-XL-outlier problem may worsen.** Adding small countries that are zero on volcanic_eruption / economic_nationalization pushes μ down further, which pushes the handful of non-zero countries' z UP. Structural fix required.
3. **False-positive test cases re-enter.** Cape Verde (curated-173 list) + Denmark/Germany (need to be added) bring the V1.9.1 Fix C regression-check online.

---

## Stats-council agenda (for when unshelved)

1. Present the real-simulation evidence. Establish that current design is mathematically inconsistent with product-calibration target.
2. Decide structural patch between:
   - (a) Fix D + log-transform of raw scores before z (compresses rare-category outliers).
   - (b) Fix D + severity-zero filter on non-risk categories (excludes them from tier labeling).
   - (c) Fix D + category whitelist (only "risk-relevant" categories contribute to salience).
   - (d) Abandon Fix D; implement Fix E (Roshani's hierarchical partial pooling with regional priors).
3. Re-simulate with ≥190 countries using chosen approach.
4. Decide on threshold-vs-band philosophy. Is [25, 45]% HIGH-share band a hard product constraint or a soft calibration guide?
5. Meeting does not end until path is clear. Majority vote on (a/b/c/d) with Roshani's veto per Majles 2026-04-21 consensus.

---

## Evidence package in this folder

- `fix_d_real_simulation.json` — full Athena-backed output (86 countries, 280 (category, tier) distributions, 51-point threshold sweep, per-country top category, per-country salience).
- `fix_d_proxy_simulation.json` — pre-Athena z-of-z proxy run (preserved for contrast).
- `sonnet_audit_2026_04_22.md` — adversarial audit from Sonnet with post-simulation status annotations.
- `findings_summary.md` — this document.

## Re-run instructions (when unshelved)

```bash
source .tmp/aws-session.sh  # fresh staging SSO creds
cd qgi-ml/scripts
python simulate_fix_d_real.py \
    --bucket qgi-data-lake-222222222222 \
    --output ../../results/fix_d_rerun_YYYY_MM_DD/fix_d_real_simulation.json
```

Compare against `fix_d_real_simulation.json` in this folder. Key comparisons:

- Sigma distribution shape (does rare-category tail tighten at ≥190 countries?)
- Top-15 salience countries (do conflict zones reclaim top spots?)
- Face-validity vs threshold curve (does a clean threshold emerge in [25, 45]% band?)
- Cape Verde/Denmark/Germany present in recipes table?
