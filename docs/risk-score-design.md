# QGI Risk Score — Design & Expert Review

> Owner: Amin Al-Ait | Last updated: 2026-04-03
> Status: Design phase — formula under review
> Related tickets: #115 (Country Profiles), #80 (Backtesting)

---

## 1. Concept

A QGI-exclusive composite indicator: a single 0-100 "Risk Score" per country that distills all early warning data into one actionable number. This is proprietary — not sourced from any provider.

---

## 2. Original Proposed Formula (V0 — prototype)

```
risk_score = normalize_to_100(
    active_warning_count * w1 +
    max_confidence * w2 +
    pattern_diversity * w3 +
    recipe_coverage * w4 +
    trend_acceleration * w5
)
```

---

## 3. Expert Review (Sonnet, 2026-04-03)

### Weaknesses identified

1. **Double-counting / collinearity:** `active_warning_count`, `pattern_diversity`, and `recipe_coverage` are correlated. Data-rich countries get inflated scores regardless of actual risk.

2. **`max_confidence` discards distribution:** Two countries with max=0.9 treated identically even if one has 1 warning and the other has 20. Use mean or top-k average instead.

3. **`trend_acceleration` underspecified:** Rate of change of what, over what window? Confidence scores are noisy; naive first derivative produces garbage. Need smoothed signal (EWMA slope) and minimum observation window.

4. **`pattern_diversity` conflates coverage with risk:** 5/5 active indicators is more alarming than 20/50. Use a ratio (active/available) not raw count.

5. **Normalization via min-max is fragile:** One outlier resets the scale. A score of 70 today might mean 40 tomorrow because other countries changed, not because this country improved.

### Missing components

1. **`historical_accuracy` per recipe** — a 90% accurate recipe should massively outweigh a 30% one. Critical omission.
2. **`estimated_years_to_event`** — proximity decay: 6-month warning matters more than 5-year warning.
3. **Event severity weighting** — Military Conflict >> Currency Crisis >> Trade Policy Shift. Non-negotiable.
4. **Recurrence / persistence** — track record of confirmed warnings = structurally different country.
5. **Baseline volatility** — chronic fragile states always score high; score becomes useless for detecting *change*.

### Linear sum is wrong

Geopolitical risk has threshold effects. 3 low-confidence warnings ≠ 3x one low-confidence warning. Risk compounds non-linearly.

---

## 4. Revised Formula (V1 — probability-aggregation)

Recommended by expert review:

```python
# For each active warning i:
adjusted_confidence_i = (
    confidence_i
    * historical_accuracy_i
    * time_weight(years_to_event_i)
    * severity_weight(event_type_i)
)

# Probability that at least one warning materializes (assuming independence)
country_raw_score = 1 - product(1 - adjusted_confidence_i for all i)

# Calibrate to historical base rates
risk_score = sigmoid_transform(country_raw_score)
```

### Why this is better
- No double-counting: each warning contributes independently
- Naturally bounds to [0,1] before transformation
- Incorporates historical accuracy, time-to-event, severity natively
- Probabilistic interpretation: "X% chance of at least one warned event within N years"
- Explainable: rank warnings by contribution to the product

### Independence assumption caveat
"Currency Crisis" and "Balance of Payments Crisis" are NOT independent. Fix by clustering warnings into event families, apply product within families, then combine families.

---

## 5. Product Architecture

### Two-level scoring (approved)
- **Headline:** One composite score per country (for ranking, dashboard, choropleth)
- **Drilldown:** One sub-score per event category per country (for analysis, radar chart)
- Composite = function of sub-scores, not blind sum of raw warnings

### Normalization strategy
- **DO NOT use min-max** (outlier-sensitive, temporally unstable)
- **DO NOT use percentile rank** (relative, not absolute)
- **USE sigmoid/log transform** calibrated to historical data:
  - 50 = historical median risk level
  - 90 = historical top decile
  - Scale is stable over time: "70" means the same in April and October

### External reporting
- Report in bands: Low (0-20) / Moderate (20-40) / Elevated (40-60) / High (60-80) / Critical (80-100)
- Continuous number used internally only
- Never report spurious precision (73.4 vs 73.6 implies precision we don't have)

---

## 6. Event Severity Weights

Non-negotiable. Two dimensions:

1. **Consequence magnitude:** human cost, economic disruption, contagion potential
   - Military Conflict: high
   - State Collapse: very high
   - Currency Crisis: medium-high
   - Economic Reform: low
   - Trade Policy Shift: low

2. **Reversibility:** one-way doors vs recoverable
   - Partition/state collapse: irreversible
   - Currency devaluation: recoverable
   - Policy reform: recoverable

Weights derived from historical damage data (GDP loss, displacement figures) or expert elicitation. This is a product decision as much as a technical one.

---

## 7. Validation Strategy

### Must-haves before publication

1. **Out-of-sample backtesting:** Train on pre-2015, test on 2015-2024. Report ONLY held-out performance.

2. **Construct validity:** High-scoring countries should correlate with:
   - Higher CDS spreads
   - Higher EMBI spreads
   - Lower FDI inflows
   - Higher emigration rates
   - Lower investor confidence surveys

3. **Face validity:** Show rankings to country risk analysts. Germany should not rank above Venezuela for currency crisis risk.

4. **Sensitivity analysis:** How much does the score change if you drop one indicator? One recipe? One data year? Fragile scores are not trustworthy.

5. **Temporal stability:** Stable countries should have stable scores. Scores should change meaningfully 1-3 years before confirmed events. Plot score trajectories pre-event = primary sales proof point.

6. **Comparative benchmarking:** Run in parallel with EIU/FSI for 12 months. Track which predicts more events. Publish results.

### Pitfalls to avoid

- **Garbage-in amplification:** Sparse data coverage (e.g., sub-Saharan Africa in World Bank) → artificially low scores. Track data completeness as a first-class metric alongside the score.
- **Overfitting weights:** Tuning w1-w5 on full dataset finds weights that fit past perfectly, predict nothing. Must use held-out test set.
- **Correlation ≠ prediction:** Maximize precision/recall at threshold or AUC-ROC, not correlation (which can be gamed by post-hoc following).
- **Survivorship bias:** Don't exclude countries where events occurred but data is missing (conflict zones have gaps during the very periods we want to predict).

---

## 8. How QGI Compares to Existing Indices

| Aspect | EIU / Maplecroft / FSI | QGI Risk Score |
|--------|------------------------|----------------|
| Input type | Qualitative + surveys | Fully quantitative |
| Directionality | Descriptive (current state) | Predictive (forward-looking) |
| Update frequency | Annual/quarterly | Monthly (per pipeline run) |
| Backtestable | Not rigorously | Yes (recipes + historical accuracy) |
| Governance inputs | Yes (analyst judgment) | No (gap — WB indicators miss coups) |
| News/text signal | Some | No (gap) |
| Peer review | Published track records | Not yet (required before institutional adoption) |
| Severity model | Yes | Not yet (required) |

### QGI's genuine differentiation
"The underlying data assets — SCDIs, Recipes, historical accuracy — are genuinely differentiated. The formula just needs to be worthy of them."

---

## 9. Future Avenue: QGI Composite Indicators

Beyond the Risk Score, QGI could compute its own indicators by combining existing ones. Examples:
- "QGI Stability Index" — derived from multiple WB indicators
- "QGI Diversification Score" — how economically diversified a country is based on indicator patterns
- "QGI Contagion Risk" — likelihood of being affected by a neighbor's crisis

This is a V5+ exploration avenue. The Risk Score is the first such indicator.

---

## 10. Implementation Phases

| Phase | What | Dependency |
|-------|------|-----------|
| V1 | Prototype with linear formula, simple normalization | Recipes pipeline |
| V2 | Probability-aggregation formula, sigmoid calibration | V1 + backtesting results |
| V3 | Event severity weights, time proximity decay | V2 + severity classification |
| V4 | ML-optimized (gradient boosting learns non-linear interactions) | V3 + large recipe dataset |
| V5 | Comparative benchmarking vs EIU/FSI | V4 + 12 months of data |
