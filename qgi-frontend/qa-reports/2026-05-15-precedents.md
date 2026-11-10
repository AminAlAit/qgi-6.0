# Precedents QA sweep — 2026-05-15

**Verdict: PASS WITH POLISH — no blockers, 4 P1 post-cutover regressions, 3 P2 polish items**

Tested at `http://localhost:3000/precedents` (dev server, Next.js 16, `SKIP_AUTH=true`).
Browser: Playwright MCP, viewport 1440×900.

---

## P0 (blockers) — 0 items

None. List page renders, detail pages render for both ML and STAT lineages, 404 slug handled gracefully.

---

## P1 (quality) — 4 items

### P1-A — Hydration mismatch: `toLocaleString()` in list-page footer

**File:** `components/precedents/PrecedentsMergedListClient.tsx:845`
**Code:**

```js
Generated {new Date(generatedAt).toLocaleString()} · pipeline {pipelineVersion}
```

`toLocaleString()` with no explicit locale argument produces locale-dependent output. Server (Node.js) and browser (Chromium) use different locale defaults, so the date string differs between SSR and hydration, triggering a React hydration mismatch warning in the console on every page load.

**Fix:** Pass a stable locale and options:

```js
new Date(generatedAt).toLocaleString("en-GB", { timeZone: "UTC" });
```

or render with `suppressHydrationWarning` if the exact string doesn't need to match server output.

---

### P1-B — ML detail: back-link routes to stale `/precedents-v2b`

**File:** `components/precedents-v2/PrecedentsV2Detail.tsx:479` → `BreadcrumbNav`

The breadcrumb "← Back to V2 precedents list" links to `/precedents-v2b` when `variantLetter="b"` (which is always the case when called from `/precedents/[slug]` because `caveatStyle="lloyds"` maps to `variantLetter="b"`).

Post PR-iii cutover, `/precedents-v2b` is a stale route (still live via the old app dir, but no longer the canonical list). The back-link should point to `/precedents`.

**Impact:** Every ML detail page back-navigation lands on the V2-B variant list instead of the canonical list.

---

### P1-C — ML detail footer: sibling link is self-referential (circular)

**File:** `components/precedents/MergedDetailFooter.tsx:39–42`

```js
const siblingHref: Route =
  lineage === "ML"
    ? (`/precedents/${slug}` as Route)   // ← resolves to the CURRENT page
    : (`/precedents-v2b/${slug}` as Route);
```

For `lineage="ML"`, `siblingHref` equals the current URL (`/precedents/civil_war_and_insurgency`). The comment on line 36–38 explicitly notes "Once cutover lands, the sibling collapses to the same `/precedents/[slug]` URL — the lineage pivot becomes a **state toggle** inside this shell rather than a route hop" — meaning this link should either be removed or converted to a within-page lineage toggle. As-is it renders as a clickable "See the unadjudicated statistical signal this recipe was promoted from →" that just reloads the current page.

**Impact:** Misleading UX — user clicks the cross-lineage link expecting the STAT view and gets the same page.

---

### P1-D — STAT detail footer: sibling link routes to stale `/precedents-v2b/[slug]`

**File:** `components/precedents/MergedDetailFooter.tsx:42`

For `lineage="STAT"`, `siblingHref = /precedents-v2b/${slug}`. Post cutover, the ML-validated view of a recipe lives at `/precedents/${slug}` (if it's a top-4 hero slug) or does not exist (if not). The link label is "See the ML-validated version of this recipe →" — correct intent, wrong destination.

**Impact:** Clicking the sibling link from any STAT detail page lands on a stale V2-B route instead of the canonical ML detail.

---

## P2 (polish) — 3 items

### P2-A — STAT detail breadcrumb links to `/precedents-v1`

**File:** `components/precedents-v1/PrecedentSlugClient.tsx:79`

```jsx
<Link href="/precedents-v1">Precedents</Link>
```

The component was moved to serve `/precedents/[slug]` (canonical) in PR-iii, but its internal breadcrumb still hardcodes the old `/precedents-v1` path. Clicking "Precedents" in the breadcrumb of any STAT detail page navigates to the V1 archive instead of the canonical list.

**Fix:** Change to `href="/precedents"`.

---

### P2-B — STAT detail shows stale mock-data banner

**File:** `components/precedents-v1/PrecedentSlugClient.tsx:368`

```
Mock data — schema mirrors `qgi_data.recipes_aggregated` (#462). Real values land
Week 3 once the next pipeline run produces the table.
```

"Week 3" has passed. If real data is now flowing, this banner should be removed. If still using mock data, the timeline reference should be updated to avoid confusion.

---

### P2-C — List-page footer contains stale preview-shell copy

**File:** `components/precedents/PrecedentsMergedListClient.tsx:848`

```
Preview shell — V1 + V2-A + V2-B routes remain live until founder cutover (PR #5).
```

PR-iii (2026-05-15) completed the cutover. The text "until founder cutover (PR #5)" is now stale. The footer also calls this a "Merged preview" — if the cutover is complete, this label should reflect production status, not preview.

---

## Verified working

| Feature                                                                                                                                           | Result                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/precedents` list renders (72 recipes, ML hero + STAT catalogue)                                                                                 | PASS                                                              |
| ML hero rows highlighted with green left-border                                                                                                   | PASS                                                              |
| "ML-VALIDATED" lineage chip filter                                                                                                                | PASS (renders, ARIA `role="radiogroup"` + `aria-checked` correct) |
| "STATISTICAL" lineage chip filter                                                                                                                 | PASS                                                              |
| Domain filter chips (Conflict, Economic, Political, Governance, Environmental)                                                                    | PASS                                                              |
| Sort controls (Tier, LOCO AUC, Coverage, Alphabetical)                                                                                            | PASS (select visible)                                             |
| Search input present                                                                                                                              | PASS                                                              |
| "Mix zones" checkbox present; disabled when sort=Tier                                                                                             | PASS                                                              |
| Row keyboard nav: `tabIndex={0}` + `onKeyDown` Enter/Space → expand                                                                               | PASS (code-confirmed)                                             |
| Row click → `ExpandedMechanismCell` toggle (`aria-expanded` + `aria-controls`)                                                                    | PASS (code-confirmed)                                             |
| "View dossier →" link inside expanded cell → `/precedents/[slug]`                                                                                 | PASS                                                              |
| `WhatWereStillTesting` native `<details>/<summary>` collapsible                                                                                   | PASS (code-confirmed)                                             |
| `HowToReadThis` preamble dismissible (localStorage persist)                                                                                       | PASS (code-confirmed)                                             |
| ML detail `/precedents/civil_war_and_insurgency` renders Template A (PrecedentsV2Detail)                                                          | PASS                                                              |
| STAT detail `/precedents/mass_protest` renders Template B (PrecedentSlugClient)                                                                   | PASS                                                              |
| STAT detail: all content sections present (canonical length, instances, indicator fingerprint, coverage bias, flagged countries 156-country list) | PASS                                                              |
| STAT detail: country links route to `/signals/[country_slug]/[recipe_slug]`                                                                       | PASS                                                              |
| MergedDetailFooter present on both ML and STAT detail pages                                                                                       | PASS                                                              |
| "See related ranked patterns →" → `/patterns?sort=loco_auc`                                                                                       | PASS                                                              |
| "How we validated this →" → `/methodology`                                                                                                        | PASS                                                              |
| 404 slug `/precedents/this-does-not-exist` → `notFound()` renders "404 / This page could not be found" with sidebar intact                        | PASS                                                              |
| Sidebar shows Precedents as `LIVE` badge, `href="/precedents"`                                                                                    | PASS                                                              |
| `proxy.ts` matcher excludes `/precedents` (public route, no auth gate)                                                                            | PASS                                                              |
| `/precedents-merged` 308-redirects to `/precedents` (next.config.ts)                                                                              | PASS (config-confirmed)                                           |

---

## Notes

**Dev-environment caveat — Fast Refresh navigation interference.** During the test session, Next.js Fast Refresh (HMR) triggered continuous `[Fast Refresh] rebuilding` cycles (every ~3–5 seconds) that caused the client router to re-navigate to previously visited URLs between tool calls. This is a dev-environment artifact; it does not reproduce in production Vercel deploys. Two findings were confirmed through code review rather than live interaction to work around this.

**MergedDetailFooter "cutover pending sign-off" label (line 91)** is visible on both ML and STAT detail pages: "Merged preview · ML-adjudicated lineage · cutover pending sign-off". If the cutover is now considered complete (PR-iii merged 2026-05-15), this label should be updated to remove the pending qualifier — but this is lower priority than P2-C and was not separately bucketed.
