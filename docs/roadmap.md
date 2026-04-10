# ML & AI Roadmap for QGI

> Owner: Amin Al-Ait | Last updated: 2026-04-03
> Related tickets: #70 (Knowledge extraction parent), #74 (Recipes), #84 (Twitter/X bot)

---

## 1. Overview

QGI's data pipeline produces structured, labeled data that is naturally suited for machine learning. The recipe system creates labeled training data (pattern features → event outcomes), enabling supervised, unsupervised, and generative AI applications.

This document catalogs all ML/AI application ideas, with real-life examples, organized by technique and readiness.

---

## 2. Unsupervised Learning — Pattern Discovery

### 2.1 Recipe Clustering (discover unlabeled event types)

**What it does:** Groups SCDIs/patterns that behave similarly but haven't been explicitly labeled as an event type. Discovers hidden structure in the data.

**Technique:** K-means, DBSCAN, or hierarchical clustering on pattern feature vectors (indicator composition, correlation strength, length, country characteristics).

**Real-life examples:**

**Example A: "Pre-diversification syndrome"**
Oil-dependent countries (Saudi Arabia, Nigeria, Kazakhstan, Venezuela) all show the same SCDI shape across 3-4 indicators (energy exports, GDP composition, education spending) about 5 years before they announce economic diversification programs. Nobody labeled this as an event type, but clustering reveals it's a recurring pattern. Discovery: *"There's a consistent indicator signature that precedes economic diversification — we should make this a recipe."*

**Example B: "Silent democratic backslide"**
Several country pairs (Hungary-Poland, Turkey-Egypt, Philippines-Thailand) cluster together with similar patterns in press freedom proxy indicators, FDI, and internet penetration — but the events at the end are labeled differently ("Constitutional Amendment", "Emergency Powers", "Electoral Reform"). Clustering reveals these are all the same underlying phenomenon: democratic erosion. Free-text events masked the commonality; clustering exposed it.

**Example C: Discovering unknown leading indicators**
200 SCDIs that all involve the same obscure indicator (e.g., "commercial bank branches per 100K adults") paired with very different events across different countries. Clustering reveals this indicator is a universal leading signal — it precedes many different event types. We didn't know it was important; statistics told us.

**Example D: "Post-conflict economic boom"**
Countries emerging from military conflict (Rwanda 2000s, Vietnam 1990s, Colombia 2010s) cluster together across GDP growth, FDI inflows, and infrastructure spending, despite being labeled with completely different events. The cluster reveals a common post-conflict recovery signature — predictive of rapid economic growth.

**Example E: "Demographic pressure cooker"**
Youth unemployment, urbanization rate, and food import dependency show a consistent clustered pattern 3-7 years before social unrest in MENA countries. The individual events are labeled "Arab Spring", "Bread Riots", "Protests" — different labels, same underlying demographic pressure.

**Example F: "Tech leapfrog indicator"**
Countries that skip traditional telecom infrastructure show a cluster across mobile subscriptions, internet users, and GDP per capita growth. This "tech leapfrog" pattern correlates with Economic Growth events but through a different mechanism than traditional industrialization — clustering separates the two growth modes.

---

### 2.2 Anomaly Detection

**What it does:** Identifies patterns that DON'T fit any known recipe — statistical outliers that may represent novel phenomena.

**Technique:** Isolation Forest, one-class SVM, or autoencoder reconstruction error.

**Real-life examples:**

**Example A: "COVID pattern break"**
Post-2020, several countries show patterns that historically matched Economic Crisis recipes, but their technology/digital indicators behave opposite (going UP during a crisis). Anomaly detection flags these as outliers — they're a new variant of economic crisis where digital acceleration coexists with traditional decline.

**Example B: "Unprecedented divergence"**
Two countries (Germany-Italy) with a 30-year correlated pattern across 8 indicators suddenly diverge on 3 indicators simultaneously in 2024. No historical recipe explains this divergence pattern. Anomaly detection surfaces it for human analysis.

---

## 3. Supervised Learning — Event Prediction

### 3.1 Event Category Classification (RF/GBM)

**What it does:** Given a set of active pattern features, predicts the most likely event category. More nuanced than exact recipe matching because it learns from thousands of examples.

**Technique:** Random Forest, XGBoost, or LightGBM. Training data = recipes (pattern features → event outcome).

**Real-life examples:**

**Example A: Probabilistic risk assessment**
Egypt has 4 active patterns: energy imports rising (corr 0.89), foreign reserves declining (0.91), inflation accelerating (0.78), tourism revenue dropping (0.72). Model outputs: Currency Crisis 68%, Sovereign Default 22%, Political Transition 10%. More nuanced than binary recipe matching.

**Example B: Feature importance = QGI indicator ranking**
The model reveals *which indicators matter most* per event type. GDP growth is #1 for Economic Reform but #8 for Military Conflict. Military expenditure + arms imports + refugee outflows are top 3 for Military Conflict. This becomes QGI's proprietary "indicator importance" ranking — unique intellectual property.

**Example C: Non-obvious indicator combinations**
ML discovers *interaction effects*: "When energy exports AND education spending change simultaneously, it's 3x more predictive of Political Transition than either alone." Humans miss these cross-indicator interactions; ML catches them.

**Example D: Regional bias correction**
The model learns that the same indicator patterns have different meanings in different regions. Declining FDI in Sub-Saharan Africa correlates with Political Transition, but in EU countries it correlates with Economic Reform (regulatory change). Without ML, you'd apply the same recipe globally and get false positives.

**Example E: Correlation strength as a signal**
Not all correlations are equal. ML learns that patterns with correlation 0.95+ preceding Military Conflict are 4x more accurate than patterns at 0.70. This informs dynamic thresholding — instead of a fixed 0.7 cutoff, the model learns optimal thresholds per event type.

**Example F: Pattern length significance**
3-year patterns preceding Currency Crisis have 80% accuracy. 7-year patterns preceding Currency Crisis have only 50% accuracy (too many confounders over longer periods). ML discovers the optimal pattern length per event type — something a static rule can't do.

---

### 3.2 Confidence Calibration

**What it does:** Ensures our confidence scores are calibrated — a 70% confidence warning should come true ~70% of the time.

**Technique:** Platt scaling, isotonic regression, or temperature scaling on top of the classifier.

**Value:** Trust. If users learn that "80% confidence" is reliable, they act on warnings. If it's poorly calibrated (80% confidence only comes true 40% of the time), QGI loses credibility.

---

## 4. Time-Series Forecasting — Temporal Prediction

### 4.1 Pattern Trajectory Forecasting

**What it does:** Predicts *when* a pattern reaches recipe threshold, not just *whether* it will.

**Technique:** ARIMA, Prophet, or LSTM on the pattern's correlation trajectory over time.

**Real-life examples:**

**Example A: "Turkey is 18 months away"**
Turkey's pattern matches the Currency Crisis recipe at 60% today. The correlation has been increasing by 0.05/month for 6 months. Forecast: crosses 80% recipe threshold in ~18 months. Without forecasting, you'd only know "it's at 60% now." With it: "it's at 60% and accelerating — estimated arrival: Q3 2027."

**Example B: Decelerating signals = false alarm detection**
Argentina's pattern matched Economic Crisis at 55% and was rising. But the rate of increase has halved over 3 months. Forecast: tops out at 65%, never reaches threshold. This prevents false alarms. Frontend shows: "Signal weakening — previously flagged risk is subsiding."

**Example C: Seasonality detection**
Agricultural indicators have seasonal patterns. A pattern that looks alarming might be a seasonal dip, not a real divergence. Time-series decomposition separates cyclical from structural. Forecast: "This apparent pattern break is seasonal — expect normalization by Q2."

**Example D: Acceleration detection = urgency signal**
Two countries both match Military Conflict at 55%. But Country A's correlation is accelerating (second derivative positive) while Country B's is linear. Forecast: A reaches threshold in 8 months, B in 24 months. The acceleration is the urgency signal — A gets a higher-priority warning.

**Example E: "Window of intervention"**
Forecasting a pattern's trajectory reveals a window where intervention could change the outcome. "If foreign reserves stabilize in the next 6 months, the Currency Crisis trajectory flattens. After 6 months, the momentum becomes self-reinforcing." This is actionable intelligence for policymakers.

---

## 5. Generative AI / LLM Applications

### 5.1 Recipe Interpretation (natural language)

**What it does:** Takes statistical recipe output and generates human-readable risk narratives.

**Real-life examples:**

**Example A: Country risk briefing**
Statistical input: Egypt matches Currency Crisis recipe at 78%, 3/4 indicators matching. LLM output:

> "Egypt's current trajectory closely mirrors pre-crisis patterns seen in Turkey (2016-2018) and Argentina (2016-2018). The key driver is a simultaneous decline in foreign reserves and rise in external debt, historically associated with currency crises in import-dependent economies. Unlike Turkey's case, Egypt maintains strong Gulf sovereign wealth fund backing, which could delay or mitigate the outcome."

The statistical pipeline says "Currency Crisis, 78%." The LLM explains *why*, adds context, and notes mitigating factors.

**Example B: Indicator significance narration**
Statistical input: arms imports indicator is #1 feature for Military Conflict recipe. LLM output:

> "Arms imports is the strongest single predictor of military conflict in QGI's model. When a country's arms import pattern mirrors historical pre-conflict trajectories (as seen in Azerbaijan pre-2020, Saudi Arabia pre-2015), the probability of military engagement within 3 years is 71%. This indicator leads other signals by an average of 18 months."

**Example C: Pattern comparison narration**
Two countries have similar profiles. LLM output:

> "Nigeria's current indicator profile is most similar to Venezuela circa 2014: both show declining oil revenues, rising debt-to-GDP, and falling currency reserves. Venezuela's trajectory led to sovereign default by 2017. However, Nigeria's diversification into agriculture and tech (represented by rising non-oil GDP share) provides a buffer that Venezuela lacked."

---

### 5.2 Anomaly Narration

**What it does:** When a pattern *deviates* from a known recipe, LLM explains what's different and why it matters.

**Real-life examples:**

**Example A: "Greece 2010 — but with a twist"**
Portugal 2023 matches 85% of Sovereign Default recipe (Greece 2010, Argentina 2001). But FDI inflows are *increasing*, not decreasing. LLM:

> "Portugal shows classic pre-default patterns except for strong FDI inflows, likely from EU Recovery Fund disbursements. This structural support wasn't available to Greece in 2010. The deviation suggests Portugal may experience debt restructuring rather than full default — the EU backstop changes the dynamics."

**Example B: "Recipe evolution detection"**
COVID broke many patterns. Post-2020, 14 countries match Economic Crisis at 70% but tech indicators surge instead of decline. LLM:

> "The digital acceleration during COVID-19 created a new variant of economic crisis: traditional indicators decline while tech adoption surges. This 'digital-offset crisis' pattern has appeared in 14 countries. It may represent an entirely new recipe: economies that can digitize through a crisis recover faster, while those that can't suffer deeper damage."

**Example C: "Missing ingredient"**
A country matches Military Conflict recipe on 4/5 indicators, but the 5th (refugee outflows) shows zero movement. LLM:

> "This pattern matches the Military Conflict recipe but lacks the refugee displacement indicator that typically precedes open conflict. Historically, this 4/5 match pattern (without refugee displacement) has been associated with covert military operations or proxy conflicts rather than full-scale war. The absence of a specific indicator is itself informative."

**Example D: "Opposite direction match"**
A country's indicators match a recipe in pattern shape but in the *opposite direction*. LLM:

> "India's technology indicators show the mirror image of the 'Tech Bubble Burst' recipe — same curve shape but inverted. Historically, this mirror pattern has preceded technology sector booms, not busts. The opposite-direction match suggests India is entering a period of rapid tech sector growth."

---

### 5.3 Cross-Recipe Reasoning

**What it does:** Analyzes what happens when multiple recipes activate simultaneously.

**Real-life examples:**

**Example A: "The Arab Spring cocktail"**
Tunisia 2010: Political Transition (60%), Economic Crisis (50%), Social Movement (45%). No single recipe is high-confidence. But historically, when those three overlap at moderate confidence, the result was revolution (Egypt 1952, Iran 1979, Romania 1989). LLM:

> "While no single risk indicator is critical, the simultaneous moderate activation of three recipes matches the historical fingerprint of revolutionary upheaval. This combination is more dangerous than any single high-confidence warning."

**Example B: "Military buildup + Diplomacy = proxy war"**
Country X matches Military Conflict (70%) + Diplomacy (55%). Historically, this combination didn't lead to direct war — it led to proxy conflicts (Saudi Arabia/Yemen, Russia/Syria). LLM:

> "Military involvement is likely but through proxy rather than direct engagement. The diplomatic activity signal suggests the country is building coalitions, not preparing for unilateral action."

**Example C: "Cancellation effects"**
Economic Reform (65%) + Political Transition (60%) = reform succeeded, managed transition. Economic Reform (65%) + Military Conflict (40%) = reform imposed by coup, destabilizing. Same primary recipe, different outcome depending on secondary signal.

**Example D: "Cascading recipe activation"**
Country A triggers Currency Crisis recipe. 6 months later, neighboring Country B triggers Economic Crisis recipe. LLM:

> "The sequential activation of Currency Crisis in Country A followed by Economic Crisis in Country B matches the contagion pattern seen in the Asian Financial Crisis (Thailand 1997 → Indonesia/South Korea 1998). Historical precedent suggests 2-3 additional neighboring economies may be affected within 12 months."

---

### 5.4 Social Media Content Generation

**What it does:** Generates Twitter/X posts from early warnings, timed to coincide with trending news. Connected to #84 (Twitter/X bot).

**Flow:**
1. Early warning system flags a country
2. LLM generates narrative (see 5.1)
3. Monitor news APIs for that country trending
4. When country is in the news, auto-generate tweet:

> "Our data shows [Country X] matches 3 historical recipes at moderate confidence — the same combination that preceded major events in Egypt 1952, Iran 1979, Tunisia 2011.
>
> QGI predicted this signal 6 months ago.
>
> Full analysis: qgintelligence.com/warnings/[id]"

**Example: Egypt trending due to currency devaluation**

> "6 months ago, QGI's pattern analysis flagged Egypt with a 78% Currency Crisis signal — matching pre-crisis trajectories of Turkey 2018 and Argentina 2018.
>
> Today's devaluation confirms the pattern.
>
> How we saw it coming: qgintelligence.com/early-warnings/egypt-2026"

This is the "banger post" strategy: QGI's predictions validated by real events in real-time = credibility + virality.

---

## 6. Implementation Priority

| Phase | Technique | Complexity | Value | Prerequisite |
|-------|-----------|------------|-------|-------------|
| V1 | Template-based warnings | Low | High | Recipes pipeline |
| V1 | Backtesting metrics | Low | High | Recipes + 2020 cutoff |
| V2 | LLM narrative generation | Medium | High | V1 warnings |
| V2 | Social media integration | Medium | High | V2 LLM + news API |
| V3 | RF/GBM classification | Medium | Medium | Large recipe dataset |
| V3 | Confidence calibration | Medium | High | Classification model |
| V4 | Time-series forecasting | High | High | Active pattern tracking |
| V4 | Unsupervised clustering | Medium | Medium | Full recipe dataset |
| V5 | Anomaly detection + narration | High | High | All of the above |
| V5 | Cross-recipe reasoning | High | Very High | Mature recipe library |

---

## 7. QGI-Exclusive Derived Products

### 7.1 Risk Score (0-100)

A composite, proprietary indicator per country:

```
risk_score = weighted_sum(
    active_warning_count * w1,
    max_confidence * w2,
    pattern_diversity * w3,
    recipe_coverage * w4,
    trend_acceleration * w5
)
```

This IS the QGI product — distillation of all data into a single actionable number.

### 7.2 Indicator Importance Rankings

Per event type, which indicators are most predictive? Derived from ML feature importance. Unique to QGI.

### 7.3 Country Similarity Index

"Which countries are most similar to X right now?" Based on active pattern profiles. Nearest-neighbor search in feature space.

### 7.4 Future: QGI Composite Indicators

QGI could compute its own indicators by combining existing ones — e.g., a "Stability Index" derived from multiple World Bank indicators. This is a future avenue for exploration.
