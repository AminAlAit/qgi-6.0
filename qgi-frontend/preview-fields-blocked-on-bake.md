# Preview-chipped fields — blocked on upstream bake

This is the **Flavor B audit output from PR-iv (2026-05-15)**. Every `Preview`
chip currently surfacing on a V3 (canonical) route is listed here with its
upstream blocker.

Removing any of these requires changes outside the frontend: a pipeline bake
script needs to emit the column, then the JSON snapshot in `data/` needs to
include it.

## Countries (`/countries`)

### List page

| Column                  | Field                              | Upstream blocker                                                                                               |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| ML cov                  | per-country anchor stability count | #648 — per-country AHI bake (currently `anchor_ahi_value` is per-recipe, not per-country)                      |
| Trend                   | 6-quarter score trend              | per-quarter score history bake doesn't exist (Athena `recipe_country_pair_v` is window-keyed, not time-series) |
| Updated                 | per-country recompute timestamp    | bake only emits a single `generated_at` for the whole snapshot, not per-country                                |
| 5 to watch curated band | hand-curated entries               | by design — `mockWatchCountries.ts` is editorial, refreshed weekly outside the bake                            |

### Detail page (`/countries/[iso]`)

| Field                                        | Upstream blocker                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| ML matrix global percentile column           | bake doesn't ship a global-percentile rank per (country, recipe) — would need a cross-country normalization step |
| "What's happening here" preview-template tag | ~140 unauthored countries; requires `qgi-data` to ship per-country authored narrative JSON                       |

**PR-iv removed**: Anchor stability (AHI) column now reads real
`anchor_ahi_value` from the validated recipe set instead of seeded preview.
Currently 1 of 4 top-4 recipes carries a real value (`civil_war_and_insurgency`
= 0.1052); the other 3 render `—` with a per-row Preview chip until the
bake measures them.

## Signals (`/signals`)

### Per-country page (`/signals/[country]`)

| Field                                             | Upstream blocker                                                                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALIGNMENT column header                           | salience-z is REAL but column is labeled "Alignment" pending #463 — the future bake will ship per-country alignment scores semantically distinct from salience-z |
| "What's happening here" lede preview-template tag | curated-vs-template fork; ~140 unauthored countries need `qgi-data` authored narratives                                                                          |

### Leaf page (`/signals/[country]/[slug]`)

| Field                                             | Upstream blocker                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Discrim. / Calibration on stat-only rows          | these are recipe-level fields only present for ML-validated recipes; stat-only rows have no equivalent |
| "What's happening here" lede preview-template tag | same as per-country                                                                                    |

## Patterns (`/patterns`)

### List page

| Facet / column                                | Upstream blocker                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Architecture facet (D2 / D5 / V1-statistical) | `ranking.json` rows don't carry a `lineage` or `architecture` field               |
| Falsification status facet                    | needs ML Stage 4 falsification rule status per row                                |
| Recipe Confidence Index (RCI) facet           | needs RCI field in ranking.json                                                   |
| L1 category facet                             | needs L1 mapping per pattern instance (currently only per category, not per pair) |
| Region facet                                  | needs country→region join in the bake                                             |
| Sparkline trajectory column                   | needs 7-point per-window correlation time-series in ranking.json                  |
| RCI dot per row                               | same as RCI facet — needs RCI field                                               |
| Preset chip filter wire-up                    | client-side, not blocked on bake — deferred to a UX-focused follow-up             |

### Detail page (`/patterns/[slug]`)

| Field                             | Upstream blocker                    |
| --------------------------------- | ----------------------------------- |
| Architecture chip                 | same as facet above                 |
| Recipe Confidence chip            | same as RCI facet                   |
| Lede preview-template tag         | no authored per-pair narratives yet |
| Discrim. / Calibration stat cells | recipe-level fields, not per-pair   |

## Cross-cutting follow-ups

- **#648** — per-country anchor stability bake. Unblocks: Countries list ML cov, Countries detail per-row AHI on the 3 currently-null recipes
- **#463** — per-country alignment score bake. Unblocks: Signals ALIGNMENT column relabeling
- **ranking.json schema upgrade** — emit Architecture / RCI / Falsification status / L1 / Region columns per pattern instance. Unblocks: all Patterns list facets + detail chips
- **Time-series ranking bake** — emit 7-point trailing correlation series per pattern window. Unblocks: Patterns sparkline column
- **qgi-data authored narrative JSON** — hand-curated per-country prose. Unblocks: all 4 V3 family lede "What's happening here" panels

When any of the above ships, search `Preview` in `components/` and `app/(app)/`
to find every removal site at once.

## Audit pass log

| Date       | PR    | Notes                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-15 | PR-iv | Initial Flavor A vs Flavor B audit. Removed 1 seeded preview (Countries detail AHI → real `anchor_ahi_value`); standardised all 5 V3 pages to surface real bake `generated_at` instead of request-time `new Date()` for the "Updated" / "Generated" date in headers and footers. Everything else above is Flavor B (truly blocked on upstream). |
