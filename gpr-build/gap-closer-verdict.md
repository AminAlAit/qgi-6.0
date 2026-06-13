# F-GPR-1 Learned Gap-Closer — Adversarial Verdict

**Verdict: KEEP-NAIVE.** The learned gap-closer does not beat the naive `gpr_share` blend. It does not even tie it — it underperforms it materially, out of sample, on the headline metric. The ceiling is real and it is a **corpus** ceiling, not a weighting problem.

Audited against Ji-Hoon Park's pre-registered protocol. Numbers independently reproduced from raw files; no leakage or overfit found; the null is clean and publishable.

---

## 1. The OOS numbers (independently verified)

All figures below were re-derived from `C:/tmp/gpr_monthly_v2.csv` + `gpr_export.xls` using the frozen metric helpers, and match `gap-closer-results.json` to 6 decimals.

| Metric (OOS, sealed test window 2021-11 → 2026-05, 55 mo/country) | Gap-closer | Naive blend | Verdict |
|---|---|---|---|
| **Mean Δ-Spearman (HEADLINE)** | **0.3082** | **0.5425** | naive wins by **+0.2344** |
| Mean levels-Pearson (diagnostic, trend-inflated) | 0.4492 | — | — |
| Countries where gap-closer ≥ naive | **4 / 44** | (naive strictly better in **40 / 44**) | naive dominates |
| Countries with negative OOS Δ-Spearman | **3** (CHL −0.077, ISR −0.110, PER −0.004) | 0 | gap-closer breaks sign |
| Countries reaching levels-Pearson ≥ 0.9 (production fidelity) | **0 / 44** | 0 / 44 | corpus ceiling, 3rd confirmation |
| In-sample Δ-Spearman | 0.3097 | — | — |
| **Overfit gap (in-sample − OOS)** | **+0.0015** | — | not overfit |

Note the naive's OOS Δ-Spearman (0.5425) is *higher* than its historical full-window 0.4604 reference because the sealed test window is the high-signal COVID / Ukraine / Gaza era — this is the correct G3 paired baseline (same 55 months, same countries), and it is the number the gap-closer must beat. It loses to it by a wide margin.

## 2. Pre-registered bars (all recomputed independently)

| Bar | Threshold | Result | Pass |
|---|---|---|---|
| 1. Mean OOS Δ-Spearman ≥ 0.51 | ≥ 0.51 | 0.3082 | **FAIL** (below even the naive) |
| 2. Beats naive in ≥ 30/44 countries | ≥ 30 | 4 | **FAIL** |
| 3. Overfit gap ≤ 0.10 | ≤ 0.10 | 0.0015 | PASS |
| 4. Zero negative OOS Δ-Spearman | 0 | 3 | **FAIL** |

3 of 4 bars fail. Ship requires all 4. **SHIP = False.**

## 3. Leakage audit — CLEAN

I attacked the four most likely leak paths. None present.

- **Did test-window data touch the fit?** No. The train-only feature standardizer mean (`g1_share` = 0.172289) reproduces exactly when I recompute it from train months only, and **differs** from the full-sample value (0.174631) — proving test months were excluded from the standardizer. Same for the per-country target de-mean: USA's frozen constant (2.221751) equals the independently-computed **train-only** target mean. This is the single highest-risk leak (G1 full-sample/test-window centering) and it is correctly train-only.
- **Was the ridge penalty tuned on test?** No. Lambda is chosen by a nested chronological inner split *inside* train (inner-train 2015-02→2020-06, inner-val 2020-07→2021-10). The inner-best landed at grid edge λ=100, which correctly triggered the pre-registered sane-default fallback to λ=1.0. The test window is never read in this loop. Honest per protocol (d).
- **Was the OOS split chronological?** Yes, strict first-60% = 81 train / 55 test of 136 months. And the panel is **perfectly rectangular**: all 44 countries share the identical 136-month index (2015-02→2026-05), so the global month-index cut is the same chronological split for every country — no per-country split drift, no test-into-train spill.
- **Spot-check (ARG):** independently re-fitting the frozen weights/standardizer against ARG's raw rows gives gap-closer OOS Δ-Spearman 0.243682, naive 0.337069, levels-Pearson 0.306866 — identical to the reported panel. The harness is not fabricating numbers.

Metric math is single-source (imported `pearson_r/spearman_r/diff` from the frozen PoC module; new code = ridge solve + plumbing only). Data hygiene: 0 share-out-of-range flags, 0 months skipped, `total_docs>0` enforced.

## 4. Overfit audit — CLEAN (and this is the load-bearing finding)

In-sample Δ-Spearman 0.3097 vs OOS 0.3082 → gap **+0.0015**. The model scores essentially the same on data it was fit on as on data it never saw. That is **not** a memorization failure — it is the opposite. The learned linear re-weighting is genuinely, stably weak. A model that overfit would post a large in-sample/OOS gap; this one has none, which proves the 0.31 is a real ceiling of what a *linear re-weighting of these 11 GDELT-derived features* can do, not a tuning artifact we could rescue with more regularization or more data.

The final z-scored weights confirm the mechanism: the largest are tiny and offsetting (`g1_share` −0.16, `g2_share` +0.16, everything else < 0.07, `avg_tone` ≈ +0.005). The ridge found no informative re-weighting — it landed on a near-null combination that loses signal relative to the simple equal-ish sum the naive blend already encodes.

## 5. Why it underperforms rather than ties

The naive `gpr_share` is already a near-optimal aggregation of the conflict categories — effectively summing the GPR-relevant g-categories over total docs. The within-country fixed-effects ridge, forced to explain variation around each country's own baseline (the correct target for Δ-Spearman), cannot find a linear combination that beats that sum, because **the signal that's missing isn't a weighting the model could recover — it's in a corpus the model never sees.** GDELT machine-coded global news vs Iacoviello's ~10 hand-curated broadsheets is a content gap, not a coefficient gap. Re-weighting the same GDELT categories redistributes within the GDELT signal; it cannot manufacture broadsheet fidelity that isn't in the inputs. Two independent dictionaries already pinned the ceiling at ~0.46; this learned fit lands at 0.31 OOS — inside the same corpus-bound regime, on the wrong side of the naive aggregation. The 0/44 at levels-Pearson ≥ 0.9 is the third independent confirmation of that corpus boundary.

This is exactly the null Ji-Hoon pre-registered ("I expect this to FAIL bar 1"), and the protocol was built so a null lands clean rather than tortured into a marginal win. It did. The bars were paired country-wise and set at +0.05 precisely so a noise-level bump couldn't sneak through — and the result isn't even a bump, it's a regression.

## 6. Decision

**KEEP THE NAIVE 0.46 BLEND.** Do not ship the learned gap-closer.

- It fails 3 of 4 pre-registered bars (mean, country-wise, sign), passing only the overfit guard — and it passes that one *because* it's genuinely weak, not because it generalizes well.
- It underperforms the naive baseline by 0.23 Δ-Spearman OOS and loses head-to-head in 40 of 44 countries.
- The finding is the value: **a learned linear re-weighting of GDELT categories does not beat the equal-blend proxy out of sample; the gap to Iacoviello's published GPRC is a corpus difference, not a weighting one.** That closes the "can we learn our way past 0.46?" question with a clean, honest no.

**Confidence-first framing for any external write-up:** state plainly that the proxy tracks GPR *shape* at ~0.46 Δ-Spearman and that we tested whether machine learning could push past that — it could not, because the remaining gap is the corpus the GDELT feed can't reach, not a knob we hadn't turned. The naive blend stays the production proxy; r > 0.9 remains the *production fidelity* bar for an eventual calibrated series and is, by construction, unreachable by re-weighting the same GDELT signal. No overclaim.

---

*Audited files: `gap_closer.py`, `gap-closer-results.json`, `validate_gpr_full.py`, `validate_gpr_poc.py`. Independent reproduction scripts confirmed ARG OOS metrics, all 44-country aggregates, all four bars, rectangularity, and train-only standardizer/de-mean constants. No leakage, no overfit.*
