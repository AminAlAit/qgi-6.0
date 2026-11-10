# Dashboard JTBD Majles Convening — 2026-05-15

## Pre-meeting brief

Each persona reviewed: (1) the current live dashboard (`app/(app)/dashboard/page.tsx` + `BaseClient.tsx`) — a 5-zone vertical stack with Status Bar, Situation Summary, Intelligence Grid, Signal Landscape, and a collapsed Data Foundation; (2) one page route from each V3 family (`/precedents`, `/countries`, `/signals`, `/patterns`) to understand the data architecture and design language shipped in PR-iii; (3) `merger-brief-2026-05-13.md` for the Tufte/Foreign-Affairs/Lloyd's voice grammar and tier-vocabulary system; (4) `preview-fields-blocked-on-bake.md` — the Flavor B audit listing every field still preview-chipped across the 4 families; (5) live bake stats: 156 countries scored (V1.9.1, generated 2026-04-30), tiers: 66 HIGH / 26 MODERATE / 64 INDICATIVE, curated 55/156. Top-salience HIGH: DRC 2.59, Somalia 2.53, Lebanon 2.51. Top pattern pair: Paraguay → South Korea, PPS 2850, 64-year window, 91% corr.

**What counts as "data we can use without a bake change"**: any field already present in `data/country-risks.json`, `data/ranking.json`, `data/recipes-top50.json`, `data/ml-recipe-stack.json`, `data/indexes.json`, or `data/taxonomy_hierarchy.json` — including `overall_risk_tier`, `tiers.S.top_categories[*].salience_score`, `pattern_power_score`, `avg_correlation`, `n_predictors`, `median_lead_time`, `convergence_tier`. Fields listed in `preview-fields-blocked-on-bake.md` (per-country AHI, 6-quarter trend, per-country update timestamp, authored narratives, RCI, architecture lineage per pattern row, sparklines) are NOT available.

---

## Persona POVs

### Marcus Osei-Bonsu — Methodology 1 (commercial quant)

The current dashboard's headline metrics — "S-tier signals," "peak salience," "active convergences" — are methodologically real but presented without enough lineage for a sophisticated buyer to trust them without clicking through. The salience score (from `tiers.S.top_categories[0].salience_score`) is a z-score-family quantity; calling it a bare number next to "countries rising" without the distribution anchor invites misreading as a probability or a normalized 0-1 score. The Dashboard redesign has a chance to fix this by surfacing at most one number per family that is methodologically defensible at a glance — the tier count (HIGH: 66) is that number for Countries, the n_predictors convergence count is that number for Signals, the PPS rank is that for Patterns, and the "13 locked recipes, 4 validated above chance" is that for Precedents. If we build the Dashboard around those four anchors — one per family, correctly labeled — we give a Verisk-trained buyer something to cross-check immediately rather than a wall of opaque stats. I am also concerned that "Featured Signal" (highest-salience curated country, which is DRC today) is selected algorithmically but presented with the visual weight of an editorial claim. The current narrative copy — "X independent predictor countries converge on a Y trajectory" — is a claim about convergence, not just salience; we must ensure the link to `/countries/{id}` makes the underlying data visible before any commercial buyer repeats that sentence to a client. The disclosure strip placed below — the current Status Bar — is far too small for a buyer who needs to know what "generated 2026-04-30" actually means for their use case. The new Dashboard should place a one-line freshness statement ("Scored 156 countries · V1.9.1 methodology · Last updated 30 Apr 2026") as the first visible text, not a 40px status bar at the top. I am not asking for a methodology primer on the landing page; I am asking for a single sentence that tells a buyer whether the data is live enough to use. The four family "top-line cards" should each carry a "What this is" label of no more than six words, in plain English not acronyms, so the page earns methodological trust before the user clicks anything. Finally, the "Outliers" panel (above/below median deviation) is a surrogate for temporal change that we explicitly cannot support yet — it should be either renamed "Spread" or removed entirely, because calling deviation from the median an "outlier" implies time-series motion we don't have.

— Marcus Osei-Bonsu

### Yuki Takahashi-Rowe — Product 1

I have run 80+ pilots of risk-intelligence products, and the single question that determines whether a returning user comes back tomorrow is: what changed since I was last here? The current dashboard answers "what exists" with six panels of information; it does not answer "what changed" at all. The new Dashboard does not have per-country delta data yet (that's blocked on the bake per preview-fields), so it cannot answer the change question directly — but it can fake it honestly by featuring the highest-salience item that is new or notable without pretending we track change. The "Featured Signal" mechanism in the current code already does this: it selects the highest-salience curated country and writes a narrative sentence. That is fine as a first-load hook, but it needs a visual anchor — a country flag, a tier badge, a one-sentence claim, and a "See full profile →" CTA — not a wall of microtype. A returning user at an investment house has 12 seconds before they decide this page is noise. The page must have one dominant visual unit that communicates "here is what QGI is watching most closely right now," and that unit must be large enough to read without zooming. The four-family cross-section (one line per family: top country, top signal, top pattern, top precedent) is the right architecture because it tells a buyer the breadth of the product in a single scroll, but each card must have a hard CTA — "See all 66 HIGH countries →", "See all 71 signals →" — with the count surfaced so a buyer can assess whether the corpus is large enough to be useful. The Data Foundation zone (currently collapsed) should move to a tooltip or a dedicated `/methodology` link rather than a collapsed section; it is not the information a buyer needs on the front door. If a pilot user can't answer "what does QGI track?" in 12 seconds by reading the Dashboard, we lose them.

— Yuki Takahashi-Rowe

### Priya Sundaram-Nair — Consulting 1 (narrative + trust)

The first thing an analyst arriving at 11pm on deadline needs from a risk intelligence platform is not a data portal — it is a sentence that tells them whether the world is more or less stable than it was. The current dashboard does not offer that sentence anywhere; it offers tiers, salience scores, and correlation bars, all of which require translation before they mean anything in a memo. The new Dashboard should open with a single declarative lede — not a slogan, not a tooltip, but a plain-English sentence written by the product rather than derived by the user: something like "Sixty-six countries are at elevated risk in the current cycle. The highest signals are concentrated in governance failure and civil conflict across Sub-Saharan Africa and the Middle East." That sentence is derivable from real bake data (`tiers.HIGH = 66`, `domainHeatmap`, `regionData`) and changes every bake cycle, so it is honest. The narrative arc of the page should then follow: here is the broad picture (tier distribution, regional heat) → here is the sharpest single signal (featured country) → here is what's driving it (top signal category) → here is the deepest structural pattern in the corpus (top pattern pair). Each section feeds the next; a user following the thread has understood the product by the time they reach the bottom. What the current dashboard lacks is voice: "Watchlist," "Outliers," "Domain Heatmap" are labels that describe data containers, not claims that invite a reader in. The V3 family pages — especially Precedents and Countries in the merger brief — have already established a Foreign Affairs register that the Dashboard should inherit. A user coming to qgintelligence.com for the first time should feel they have landed on a publication with a point of view, not a data API with a stylesheet. The disclosure line (bake date, version) is essential, but should sit below the opening statement as a caption, not as the first thing the eye catches.

— Priya Sundaram-Nair

### Elif Şahin-Moreau — Information Design 1 (Tufte)

The current dashboard has a data-ink problem. The tier distribution bar, the region heatstrip, the domain heatmap, the four MetricTiles, the top-convergences list, the top-pattern-pairs list, and the outliers panel are all present on screen simultaneously, none of which is given enough visual weight to be primary. This is a common mistake: treating the dashboard as a census of available data rather than an editorial argument about what matters. The new Dashboard should make one visual argument per zone, not five. The tier distribution (HIGH: 66, MODERATE: 26, INDICATIVE: 64 out of 156) should be a single number with a label, not a stacked bar — "66 countries at elevated risk" is more readable and more honest than a proportional bar where the colors are decorative. The "Featured Signal" card is the strongest element in the current design because it has a clear subject, a clear claim, and a clear link; the rest of the page should be redesigned to give the three other family top-lines the same treatment. Small multiples would serve the family overview better than mixed chart types: four equal-weight cards, each with a number, a label, and a link — Countries (66 HIGH), Signals (top category: governance failure, firing in N countries), Patterns (top pair: Paraguay→South Korea, 64yr, 91% corr), Precedents (13 validated recipes, 4 above chance). No bars, no roses, no domain heatmaps on the Dashboard itself; those belong on the family pages. The region heatstrip adds no information that "66 HIGH countries across 6 regions" does not add more efficiently as a line of text. If a chart cannot be read in 3 seconds without a legend, it should not be on the Dashboard. The data-ink argument here is that the Dashboard page should have almost no chart chrome at all — numbers, labels, links, and one optional small-multiple strip showing tier distribution across the 8 L1 domains (a 1×8 array of counts, monospace-tabular, no bars).

— Elif Şahin-Moreau

### Rodrigo Vasconcelos-Kwok — Information Design 2 (FT/Bloomberg)

The analyst buyer who pays for this product reads the FT terminal, Bloomberg, and Eikon simultaneously. They do not need onboarding prose. They need density at first glance and a clear path to depth. The current Dashboard has the right instinct — salience scores, tier counts, n_predictors — but the type size is working against it. At 9–10px microtype throughout, the "Featured Signal" card and the watchlist are visually equivalent; there is no visual hierarchy between "DRC is the highest signal in the system" and "here are nine other countries that are also HIGH." The fix is not to add bigger type but to give each zone a dominant number — one number that a terminal reader can parse in 300 milliseconds. For the Countries zone that is "66," styled at `text-4xl font-data font-bold`. For Signals it is the count of categories firing HIGH: derive from `signals where max_salience ≥ 2.5`. For Patterns it is the top PPS score: 2850 (Paraguay→South Korea, 64yr). For Precedents it is "13 locked / 4 validated." These four numbers, arranged in a 2×2 or 4×1 grid with their labels, are the page's masthead. Everything below is supporting detail. The tabular watchlist (current Zone 3) is the right format — a terminal reader scans rows, not cards. But it needs a fixed-width salience column in monospace (`font-data`) so the numbers align without wrapping. The convergence signals panel is the strongest signal-intelligence panel in the product; a Bloomberg-trained buyer will understand "3 independent predictors converge on Lebanon governance failure, 1.5yr lead" immediately if it is formatted as a tight two-line row with numbers left-aligned and country names right-truncated. Pattern pairs formatted as "Paraguay → Korea 64yr 91%" in a fixed-width row are immediately legible. The `font-data` CSS class already exists in the codebase; it should be used more aggressively throughout the density zone.

— Rodrigo Vasconcelos-Kwok

### Ingrid Halvorsen-Mbeki — Information Design 3 (Cairo / explanatory)

A first-time visitor to qgintelligence.com today reads "BASE · Cycle: April 2026 · Scoring V1.9.1 · 156 scored / 193 in scope" and has no idea what any of those words mean. "BASE" is the internal route name; it is not a user-facing label. "156 scored / 193 in scope" raises three immediate questions — scored for what? In scope of what? What happened to the other 37? — and answers none of them. The new Dashboard must open with a plain-English sentence that tells a first-time visitor what QGI is. My proposal: "QGI tracks political risk across 156 countries, drawing on decades of historical data to identify which country patterns most closely resemble situations that previously turned unstable." That sentence is true, methodologically defensible, and does not require prior knowledge of "salience" or "SCDI" to understand. The page title should be "Dashboard" or "Intelligence Dashboard" — not "BASE." The "What this doesn't mean" pattern from the V3 family pages (the merger brief's disclosure register) must appear on the Dashboard too: "A HIGH classification means the historical pattern most closely resembles known instability precedents — it is not a prediction that an event will occur." That one sentence, placed beneath the opening lede as a light callout, prevents the most common misreading. The four family cards should each carry a six-word plain-English description: "Countries at elevated risk" / "Risk categories most active now" / "Country pairs with matching trajectories" / "Historical patterns with predictive signal." No jargon in any chrome. The freshness disclosure ("Data as of 30 Apr 2026") should be visible but not alarming; a note like "Updated regularly as new data arrives" alongside the date manages the staleness question without requiring the user to understand bake cycles.

— Ingrid Halvorsen-Mbeki

### Dr. Sunita Krishnaswamy-Park — UX Research 1

Twelve years of enterprise SaaS user studies, including two Bloomberg terminal cohort studies, have produced a consistent finding: on a risk-intelligence dashboard, expert users look first at the top-left of the content area, then follow whatever visual element has the highest contrast ratio relative to its neighbors. They do not read left-to-right or top-to-bottom — they parse the page in under 2 seconds looking for a "status signal" (is the world in crisis or not?) and then drill to whatever confirmed or disconfirmed that read. The current Dashboard's "Featured Signal" card — country flag, name, tier badge, narrative sentence — is the strongest element in the page by this criterion; it has contrast (the red `#f87171` tier badge), it has a subject (country name), and it has a claim (narrative sentence). However, the tier badge says "HIGH" in a 9px tracking font, which is unreadable at a glance. User studies consistently show that color carries the status signal faster than text at this scale; the `#f87171` border-left on the card is doing more work than the badge. My recommendation: make the status color the primary visual cue for the featured card (a full colored left border or background tint, not a 9px badge), and place the country name in `text-xl` minimum. The four-family cross-section is the right architecture, but user studies also show that users in risk domains are trained by Bloomberg/Reuters to expect the "worst item" to be at the top. The current layout puts "Featured Signal" (worst/most notable country) at top-left correctly, but then the four MetricTiles ("S-tier signals," "Countries rising," "Peak salience," "Convergences") are unlabeled to a first-time user. In user testing, "convergences" and "S-tier signals" consistently produce a "What does that mean?" response even from experienced buyers. I would remove those four MetricTile labels in favor of the four plain-English family cross-section cards Ingrid recommends.

— Dr. Sunita Krishnaswamy-Park

### Tomás Drahovský-Osei — UI/Interaction 1 (Datadog-caliber craft)

The current Dashboard has three accessibility failures that will block enterprise buyers with corporate accessibility mandates. First, the "Featured Signal" card is a `<Link>` element with the `<CountryFlag>` inside it; the accessible name of the link is the flag's `alt` text plus the country name, which is adequate, but the tier badge is a `<span>` with no `aria-label` — a screen reader will announce "HIGH" without context. The badge should carry `aria-label="Risk tier: HIGH"`. Second, the "Outliers" panel has an `<InfoTooltip>` with no keyboard trigger; `InfoTooltip` must be reachable via Tab and dismissible via Escape. Third, the entire Zone 4 (Signal Landscape) is three `<div>` columns without any landmark or heading structure — a screen reader user jumping by landmark will skip from the Zone 3 heading to the Zone 5 accordion with no intervening structure. Each zone should carry a `<section>` with an `aria-labelledby` pointing to its section header. On keyboard navigation: the current "Top Pattern Pairs" uses `<button onClick>` which is correct, but the `navigateToPair` function silently no-ops when `country_a_id` or `country_b_id` is missing — the button remains in the DOM with no visual or ARIA indication that it is disabled. Disabled or unavailable buttons must carry `aria-disabled="true"` or be removed from the DOM. For motion preferences: the freshness dot uses a `backgroundColor` transition implicit in the `useMemo` recompute, but there are no `@media (prefers-reduced-motion)` guards on any animation in `BaseClient.tsx`. The `transition-colors` Tailwind class used on hover states throughout should be conditionally suppressed. In the redesign, every interactive element — watchlist rows, convergence items, pattern pair buttons — needs a visible focus ring that meets WCAG 2.1 AA (3:1 contrast minimum against the `var(--qgi-bg)` background). Finally, the "Data Foundation" accordion's toggle icon (a CSS triangle `▶`) has no accessible label; it should carry `aria-expanded` on the trigger and `aria-label="Expand data foundation"`.

— Tomás Drahovský-Osei

---

## Areas of convergence

- **Four-family cross-section is the right architecture.** All 8 personas agree the Dashboard should surface one top-line signal per family (Countries / Signals / Patterns / Precedents) as the primary content layer. The existing code already loads all four data sources; the redesign is a layout and hierarchy change, not a data-layer change.
- **Plain-English labeling is mandatory.** Personas 3 (Priya), 6 (Ingrid), and 7 (Sunita) converge on removing internal vocabulary from all Dashboard chrome. "BASE," "S-tier signals," "salience" as a bare number, and "Outliers" (implies time-series) all need plain-English replacements.
- **The Featured Signal / featured-country card should be visually dominant.** Personas 2 (Yuki), 4 (Elif), 5 (Rodrigo), and 7 (Sunita) all identify the current Featured Signal card as the page's strongest element and argue it should be made larger and more readable, not redesigned.
- **A single opening lede sentence is needed.** Personas 3 (Priya) and 6 (Ingrid) both specify a plain-English product description as the page's first text. Persona 7 (Sunita) provides UX-research backing: users look for a "status signal" in the first 2 seconds; a lede sentence serves this function better than a status bar.
- **Data Foundation zone should be demoted.** Personas 2 (Yuki) and 4 (Elif) both argue the collapsed Data Foundation section is not first-door content. It should remain accessible but not as a collapsed zone on the Dashboard — it belongs on `/methodology`.
- **Accessibility has three specific failures to fix.** Persona 8 (Tomás) identifies concrete WCAG gaps: missing `aria-label` on tier badges, `InfoTooltip` not keyboard-reachable, Zone 4 lacking landmark structure, disabled pattern buttons not surfacing `aria-disabled`.
- **"Outliers" should be renamed or removed.** Personas 1 (Marcus) and 7 (Sunita) both flag the current Outliers panel as misleading without delta data. Consensus: rename to "Salience Spread" or replace with a tighter "What to watch" editorial band.
- **No runtime AWS calls; baked JSON only.** All personas accept this constraint. The current implementation already satisfies it; the redesign must not introduce any new runtime fetch.

## Documented dissents

- **Rodrigo vs. Ingrid on density.** Rodrigo argues for terminal-style density (dominant large numbers, tight tabular rows, monospace throughout). Ingrid argues for plain-English onboarding copy and dismissible preambles. Resolution: **tiered density** — the opening section (lede + four-family cards) uses Ingrid's register; the intelligence grid below uses Rodrigo's tabular density. The two zones serve different scroll depths. Neither persona needs to compromise their primary recommendation.
- **Elif vs. Priya on the domain heatmap.** Elif argues the domain heatmap adds no signal not captured by a text list and should be moved to the `/signals` family page. Priya argues the heatmap provides the "broad picture" narrative anchor she needs. Resolution: **remove the domain heatmap from the Dashboard**. The `/signals` page already has the domain activation strip (PR #2, real data). The Dashboard replaces the heatmap with the four plain-English family cards. Priya's narrative arc is preserved through the sequence of those four cards, not through a chart.
- **Marcus on "Featured Signal" as editorial claim.** Marcus argues the algorithm-selected featured country (highest salience curated country) is presented with editorial authority it has not earned methodologically. Resolution: **add a one-line lineage caption** under the featured card: "Selected as the highest-signal curated country in the current bake — not an editorial endorsement." Six words, grey, small. This satisfies Marcus's lineage concern without redesigning the card.
- **Rodrigo vs. Marcus on number size.** Rodrigo wants the four anchor numbers in `text-4xl`. Marcus wants them labeled precisely. Resolution: `text-4xl font-data` for the number, `text-xs uppercase tracking-widest` for the label — the Bloomberg/Reuters pattern that Rodrigo's target users already know.

---

## Synthesis verdict — Dashboard design spec

### Page architecture (sections, top → bottom)

1. **Masthead strip** (48px, persistent) — bake freshness, version, scope. Replaces current 40px "BASE" status bar.
2. **Page header + lede** — H1 "Dashboard", one plain-English lede sentence, "What this doesn't mean" callout (dismissible, `<details>`).
3. **Four-family summary band** — 4 equal-weight cards in a 2×2 (mobile) or 4×1 (desktop) grid. One card per family. Each card: dominant number, plain-English label, top item, CTA link.
4. **Featured country** (full-width or 2/3-width) — highest-salience curated country, flag + name, tier badge, one-sentence narrative, lineage caption, "See full profile →" CTA. This is the current "Featured Signal" card, enlarged and relabeled.
5. **Intelligence grid** — tabular watchlist (TOP 10 HIGH countries by salience, existing rows format but with accessible landmark) + "Salience Spread" (rename of Outliers, 4 above / 4 below median, with "Spread" label and InfoTooltip explaining it is not a time-series delta).
6. **Signal + Pattern snapshot** (two columns) — Top Convergences (existing, n_predictors ≥ 2, `recipes-top50.json`) + Top Pattern Pairs (existing, `ranking.json` top 5 deduped).
7. **Footer disclosure** — data source, version, bake date, link to `/methodology`.

**Removed from Dashboard**: Domain Heatmap zone, Data Foundation collapsed zone, SectorRose chart, four MetricTiles ("S-tier signals" etc. — replaced by the four-family summary band), "BASE" label.

### Required data fields per section

**Section 1 — Masthead strip**

- `risks.generated_at` → "Data as of 2026-04-30" · REAL
- `risks.version` → "V1.9.1" · REAL
- `risks.total_countries` → 156 · REAL

**Section 2 — Page header + lede**

- Static lede copy (no bake dependency). "What this doesn't mean" callout: static copy.

**Section 3 — Four-family summary band**

- _Countries card_: `tiers.HIGH` count (66) from `country-risks.json` · REAL. Label: "countries at elevated risk". CTA: `/countries?tier=HIGH`
- _Signals card_: count of signals where `max_salience ≥ 2.5` (derived from `country-risks.json` aggregation, same logic already in `/signals/page.tsx`) · REAL. Label: "risk categories firing HIGH". CTA: `/signals`
- _Patterns card_: `ranking.json` top-pair PPS (2850, Paraguay→South Korea) · REAL. Show: "Country pair, N-year window, X% correlation". CTA: `/patterns`
- _Precedents card_: `ml-recipe-stack.json` `metadata.top_4_recipes.length` (4) and hardcoded `totalLocked` (13) from existing page.tsx · REAL. Label: "4 validated recipes / 13 locked". CTA: `/precedents`

**Section 4 — Featured country**

- `featuredAlert` object derived from `country-risks.json` (existing logic in BaseClient.tsx, lines 371–420) · REAL
- `featuredAlert.nPredictors` from `recipes-top50.json` (existing) · REAL
- Lineage caption: static copy appended to card

**Section 5 — Intelligence grid (Watchlist + Salience Spread)**

- `topCountries` (top 10 HIGH by salience from `country-risks.json`) · REAL — existing logic
- `outliers.rising` / `outliers.falling` (deviation from median, `country-risks.json`) · REAL — existing logic, rename label only
- Section: `<section aria-labelledby="watchlist-heading">` wrapping both columns

**Section 6 — Signal + Pattern snapshot**

- `topConvergences` (n_predictors ≥ 2, from `recipes-top50.json`) · REAL — existing
- `topPairs` (top 5 deduped from `ranking.json`) · REAL — existing
- Section: `<section aria-labelledby="signal-snapshot-heading">`

**Section 7 — Footer disclosure**

- Static copy + `risks.generated_at` + `risks.version`

### Voice + chrome rules

- **Page title**: "Dashboard" (not "BASE"). `<h1>` `text-3xl font-semibold tracking-tight`.
- **Lede**: one sentence, plain English, no acronyms. Derivable template: "QGI tracks political risk across {total_countries} countries, using historical precedent to identify where signals most closely resemble known instability patterns." Refresh with each bake via server component (total_countries from bake).
- **"What this doesn't mean" callout**: `<details><summary>` element, Ingrid register. Copy: "A HIGH classification means the historical pattern most closely resembles known instability precedents — it is not a prediction that an event will occur." Collapsed by default; anchor via `aria-label`.
- **Tier vocabulary**: HIGH / MODERATE / INDICATIVE throughout. No "CRITICAL," "ELEVATED," or "S-tier" in user-facing chrome.
- **Lloyd's banner**: NOT on the Dashboard. Lloyd's actuarial footnote style belongs on the family detail pages where claims are being made. Dashboard surfaces counts, not claims.
- **Section labels**: `text-[9px] tracking-[0.25em] uppercase` style (existing `var(--qgi-text-dim)` color) — preserved from current design.
- **Dominant numbers** (four-family band): `font-data text-4xl font-bold` with color: HIGH count in `#f87171`, Signals in `var(--qgi-amber)`, Patterns and Precedents in `var(--qgi-accent)`.
- **Lineage caption on Featured card**: `text-[10px] italic` `var(--qgi-text-dim)`. Copy: "Algorithmically selected — highest-signal curated country in the current bake."
- **Salience Spread label** (renamed Outliers): `<InfoTooltip>` copy: "Countries whose salience deviates most from the median in the current bake. This is a cross-sectional spread, not a time-series delta — it does not indicate change since a previous bake."
- **"Featured Signal" renamed**: to "Most-Watched Country" or simply removed as a section label; the country flag + name carries the identification load.
- **Freshness color dot**: retained from current code. Must add `aria-label="Data freshness: {freshness.label}"` to the dot span.

### What we explicitly are NOT building (deferred)

- **Delta / "What changed" panel**: blocked on per-country historical bake (preview-fields tracker). Deferred to post-#648.
- **Domain heatmap on Dashboard**: moved to `/signals` family page (already exists there via domain activation strip in PR #2).
- **Data Foundation accordion on Dashboard**: moved to `/methodology`. A link to `/methodology#data-sources` in the footer is sufficient.
- **SectorRose chart**: remains on `/methodology` only.
- **"5 Countries to Watch" curated editorial band**: editorial mechanism, blocked on recurring editorial process. Not for Dashboard V1.
- **Authored per-country narrative lede**: blocked on `qgi-data` narrative JSON per preview-fields tracker.
- **Interactive world map**: removed per owner request (already noted in BaseClient.tsx line 905).
- **"Outliers" renamed to "Movers"**: requires delta data. Rename to "Salience Spread" only; "Movers" deferred post-#648.
- **Real-time or streaming indicators**: bake is daily/weekly cycle; no streaming behavior.

### Implementation notes for engineering

**File structure**:

- Edit `app/(app)/dashboard/page.tsx` — no new data sources needed; all current loaders (`loadCountryRisks`, `fetchTopPairs`, `fetchTopSignals`) remain. Add `loadMlRecipeStack` import to derive Precedents card data (already used in `/precedents/page.tsx`).
- Edit `app/(app)/dashboard/BaseClient.tsx` — restructure JSX layout. The existing computed data (stats, topCountries, featuredAlert, outliers, topConvergences, topPairs) is all real and reusable. No new `useMemo` logic needed.
- Remove `SectorRose` dynamic import from `BaseClient.tsx` (no longer needed on Dashboard).
- No new component files required — reuse `CountryFlag`, `InfoTooltip`, `Link`, `TIER_STYLES`.

**Component reuse from V3 families**:

- The four-family summary band cards can use `TIER_STYLES` from `BaseClient.tsx` for coloring.
- The signals count derivation (count where `max_salience ≥ 2.5`) should be computed in `page.tsx` server component to avoid hydration cost — same pattern as `/signals/page.tsx` tier count computation.
- `loadMlRecipeStack` from `lib/recipes-ml-loader.ts` — add to `Promise.allSettled` in `page.tsx`, pass `mlStack.metadata.top_4_recipes.length` down as prop.

**ARIA fixes required** (all in `BaseClient.tsx`):

- Add `aria-label="Risk tier: {tier}"` to all tier badge `<span>` elements.
- Add `<section aria-labelledby="watchlist-heading">` around Zones 3 and 4. Add corresponding `<h2 id="watchlist-heading" className="sr-only">Watchlist</h2>` and `<h2 id="signal-snapshot-heading" className="sr-only">Signal snapshot</h2>`.
- Add `aria-disabled="true"` to pattern pair `<button>` when `!p.country_a_id || !p.country_b_id`.
- Ensure `InfoTooltip` component is keyboard-reachable (check `components/design/InfoTooltip.tsx` — if it uses only `onMouseEnter`, add `onFocus`/`onKeyDown` handler).
- Add `aria-label="Data freshness: {freshness.label}"` to freshness dot `<span>`.
- Add `aria-label="Expand data foundation"` to the Data Foundation accordion button. (If Data Foundation zone is moved/removed per recommendation, this is moot.)
- Rename `<details>` "What this doesn't mean" preamble: add `role="note"` and `aria-label="Methodology note"`.

**Tests recommended**:

- `tests/dashboard.spec.ts` (Playwright, existing pattern from `qgi-frontend/tests/`): assert four-family summary band renders with non-zero numbers; assert featured card has `aria-label` on tier badge; assert lede sentence contains total country count from bake.
- Existing `tests/` pattern from the V3 family pages should guide structure.

**Accessibility requirements** (WCAG 2.1 AA minimum):

- All interactive elements (watchlist rows, convergence rows, pattern buttons): visible focus ring ≥ 3:1 contrast against `var(--qgi-bg)`.
- `@media (prefers-reduced-motion: reduce)` guard on all `transition-colors` / `transition-transform` usages in the component.
- Screen-reader-only headings (`className="sr-only"`) for each major section to enable landmark navigation.

**Page metadata update** (in `page.tsx`):

- Title: "Dashboard — QGI Intelligence" (unchanged)
- Remove `robots: { index: false }` — the Dashboard is now the canonical front door and should be indexed. (Current comment says it was deliberately de-indexed in favor of `/base`; that split is eliminated.)

---

## Risk register

1. **Signals count on the four-family card depends on an aggregation not currently in page.tsx.** The signal HIGH count (categories where `max_salience ≥ 2.5`) requires running the aggregation logic from `/signals/page.tsx` inside the Dashboard server component. Risk: adds ~200ms to server render. Mitigation: move to a shared utility function `lib/signals-aggregated.ts`; memoize at the Next.js revalidate boundary (already `revalidate = 3600` on other pages). Alternatively, store the count as a top-level field in the bake JSON — but that requires a bake change (deferred).

2. **`loadMlRecipeStack` could fail and break the Precedents card.** Currently the Dashboard does not call `loadMlRecipeStack`; adding it to `Promise.allSettled` means a missing `ml-recipe-stack.json` degrades the Precedents card to a fallback state. Mitigation: the existing `Promise.allSettled` pattern already handles partial failure gracefully; add `mlStack: null` fallback and render "13 locked / 4 validated" as static copy when the loader fails (acceptable given these counts change rarely).

3. **"Most-Watched Country" feature card selects DRC today; any algorithmic selection will surprise users who expect editorial curation.** If the bake produces a different top-salience country next cycle (e.g. Somalia overtakes DRC), the "featured" slot changes without editorial review. Mitigation: add the lineage caption ("Algorithmically selected — highest-signal curated country in the current bake") as specified. Long-term: `qgi-data` editorial band (deferred).

4. **Removing the Domain Heatmap creates a navigation gap.** Some users may arrive at the Dashboard expecting the domain overview; the current `domainHeatmap` panel is the only Dashboard-level entry point to the domain dimension of the taxonomy. Mitigation: the `/signals` domain activation strip (real data, PR #2) is a better version of this widget; ensure the Signals CTA on the four-family summary card carries "71 risk categories" as the count so the domain breadth is communicated without a chart.

5. **`robots: { index: false }` removal creates a dual-indexing situation.** If `/base` is still indexed and `/dashboard` (formerly de-indexed) becomes indexed, search engines may surface both. Mitigation: add a canonical URL tag `<link rel="canonical" href="/dashboard" />` to `/dashboard/page.tsx` and a `noindex` or redirect on `/base` once the Dashboard page is confirmed as the canonical entry point. Confirm with founder before the robots change ships.

---

## Engineering pre-flight clarifications

A strict-pragmatic-expert review of this spec surfaced 3 implementation-time
clarifications the engineer needs before writing code. These don't change
the design; they prevent silent runtime breakage.

**E1 — Signals card fallback rule.** Section 3's signals number is HIGH-tier
count (`max_salience ≥ 2.5σ`). In the current bake this is **1** (only
`civil_war_and_insurgency` crosses the threshold). "1 risk category firing
HIGH" is technically correct but useless as a four-family masthead anchor.

Implementation rule:

- When `n_high >= 3`: show `{n_high} risk categories firing HIGH` in
  red (`#f87171`).
- When `n_high < 3`: show `{n_high + n_moderate} risk categories at
elevated signal levels` in amber (`#fbbf24`).
- In both cases, the card body number is large; the threshold-color
  distinction is the only visual.

**E2 — `totalLocked` anchoring.** Section 3's Precedents card surfaces
"13 locked / 4 validated". Both numbers are hardcoded today (`13` from
`/precedents/page.tsx`; `4` from `top_4_recipes.length` in the ML stack).
The "13" number is methodology-pre-registration-locked, NOT data-locked
in the JSON file. Engineering must add a one-line comment above the
constant:

```tsx
// 13 locked recipes per ML Stage 4 pre-registration (qgi-docs/internal/
// ops/ml-track/FINAL-RESULTS.md). Update only if pre-registration is
// revised by founder+ML-Opus.
const TOTAL_LOCKED = 13;
```

**E3 — `ranking.json` field name audit.** The spec mixes field-name
conventions from two files. Authoritative names (verified against live
schemas):

- `ranking.json`: `country_a`, `country_b` (string names),
  `pattern_length` (NOT `length`), `avg_correlation` (NOT `correlation`),
  `pattern_power_score`, `start_year_a`, `start_year_b`, `predicted`,
  `pattern_tier`.
- `recipes-top50.json`: uses `length` instead of `pattern_length`. Don't
  copy field names between the two; they look the same but aren't.

Top pattern pairs in Section 3 + Section 6 should read from `ranking.json`
using the names above. Add a brief inline comment naming the divergence
if the implementation also touches `recipes-top50.json`.

These 3 clarifications are inline implementation notes; they do NOT change
the architecture or persona POVs. They prevent the engineer from copying a
field name from the wrong file or rendering "1 HIGH" as the masthead number
on a 12-second-of-attention page.
