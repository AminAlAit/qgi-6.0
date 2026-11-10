# Dashboard QA sweep — 2026-05-15

## Verdict: PASS WITH POLISH

Two P0 issues found (one confirmed, one environment-contextual). Two P2 typos. No console errors on clean load.

---

## P0 (blockers) — 2 items

### P0-1: Top Convergences rows have no clickable target

**File:** `app/(app)/dashboard/BaseClient.tsx` ~L1302–L1353  
**Selector:** `section[aria-labelledby="signal-snapshot-heading"] div:first-child ul li`  
**Repro:** Load `/dashboard`, inspect the Top Convergences list. All 5 `<li>` items have `hover:bg-[var(--qgi-surface-2)]` applied (visible hover highlight on mouse-over) but contain neither an `<a>` nor a `<button>`. Clicking any convergence row does nothing.  
**Expected:** Per spec: "Top convergences rows clickable?" — each row should navigate to the signal detail or at minimum to `/signals` with a filter pre-applied.  
**Actual:** `hasLink: false, hasButton: false` for all 5 rows. The hover highlight creates a false affordance. Verified via `querySelectorAll` and accessibility snapshot.  
**Note:** The hover CSS (line ~1310: `hover:bg-[var(--qgi-surface-2)]`) implies interactivity. Either add `<Link>` wrapping each row (e.g. `/signals?country={country_id}&category={category}`) or remove the hover style if the click-through is intentionally deferred.

---

### P0-2: Page navigates away from `/dashboard` unprompted in dev environment (test-env only)

**File:** N/A (no application code defect found)  
**Repro:** In the Playwright MCP browser, loading `/dashboard` repeatedly causes the page to navigate to `/precedents` or `/countries` within 5–15 seconds of page load. Server returns HTTP 200 with no redirect header. No `router.push` or `redirect()` call exists in `BaseClient.tsx`, `page.tsx`, `layout.tsx`, or any nav component.  
**Root cause identified:** The Playwright browser session had a residual tab (`/countries/india`) from a prior QA session that was still executing client-side React router code. This rogue tab's Next.js router state was bleeding into the shared browser context and triggering navigations on the active tab. Closing the stale tab (`browser_tabs close index=0`) resolved the instability.  
**Status:** NOT an application bug — test-environment artifact. Confirmed by: (a) server returns 200 with no `Location` header, (b) no routing code in dashboard files, (c) stable once rogue tab closed.  
**Action needed:** None in app code. Document that QA sweeps must start from a fresh browser session (no residual tabs from prior tests).

---

## P1 (quality) — 0 items

All P1 checks passed:

- `<details role="note" aria-label="Methodology note">` element: expands/collapses correctly on click (before=false, after=true confirmed via programmatic click).
- Tier badges: HIGH badge shows `color: rgb(248, 113, 113)` (red) ✓; MODERATE amber ✓; INDICATIVE blue ✓ (from tier-segment titles `"HIGH: 66 (42%)"`, `"MOD: 26 (17%)"`, `"IND: 64 (41%)"`).
- Sidebar Dashboard entry highlighted: `color: rgb(56, 189, 248)` (accent blue) + `backgroundColor: rgba(56, 189, 248, 0.15)` — correct active state ✓.
- Bake date in masthead: shows `2026-04-30` (NOT today's date `2026-05-15`) ✓ — `hasBakeDate: true, hasTodaysDate: false`.
- Freshness dot: `aria-label="Data freshness: 15 days ago"` present ✓.
- ARIA landmarks: `main`, `nav` (`<aside nav>`), `footer`, `region[aria-label="QGI family summary"]`, `region[aria-labelledby="watchlist-heading"]`, `region[aria-labelledby="signal-snapshot-heading"]` all present ✓.
- InfoTooltip "i" circles: implemented as `<span role="button" tabIndex={0} aria-label="More info">`. 3 present (Tier Distribution, Salience Spread, Top Convergences). Hover + click + keyboard (Enter/Space) all wired in `InfoTooltip.tsx`. Tooltip uses `position: fixed` with `getBoundingClientRect()` coords — escapes `overflow-hidden` ancestors ✓.
- E1 fallback rule (signals `n_high < 3`): `signalsHighCount = 1 < 3` → showing `21` (high+moderate) in amber (`rgb(245, 158, 11)`) labeled "risk categories at elevated signal levels" ✓. NOT red "1 firing HIGH".

---

## P2 (polish) — 3 items

### P2-1: Footer renders "VV1.9.1 scoring" (double-V prefix)

**File:** `app/(app)/dashboard/BaseClient.tsx` line 1473  
**Code:** `V{stats.version} scoring`  
**Root cause:** `data/country-risks.json` stores `version: "V1.9.1"` (already includes the "V" prefix). Prepending another literal `V` doubles it.  
**Rendered:** `"VV1.9.1 scoring · Data as of 2026-04-30 · ..."` — confirmed via `footer.innerText`.  
**Fix:** Change to `{stats.version} scoring` (remove the hardcoded `V` prefix) or strip leading "V" from the value: `{stats.version.replace(/^V/, '')}`.  
**Contrast:** The masthead strip (line 659) correctly uses `Scoring {stats.version}` → renders `"Scoring V1.9.1"` without doubling.

### P2-2: "All 66high-risk countries →" missing space

**File:** `app/(app)/dashboard/BaseClient.tsx` line 1013  
**Code:** `All {stats.high} high-risk countries &#8594;`  
**Rendered:** `"All 66high-risk countries →"` — `innerText` confirms no space between the count and "high-risk".  
**Root cause:** JSX adjacent text nodes without explicit spacing. The space between `{stats.high}` and `high-risk` collapses.  
**Fix:** `All {stats.high}{" "}high-risk countries →` or rewrite as a string: `` `All ${stats.high} high-risk countries →` ``.

### P2-3: Mobile masthead overflows at 375px

**Repro:** Resize to 375×667. The masthead strip (`minHeight: 40, maxHeight: 40`) clips the "156 scored / 214 in scope" text at 375px — the right-side "Data as of 2026-04-30 (15 days ago)" group is truncated/hidden.  
**Impact:** Cosmetic only. The full data is still readable on scroll-down.  
**Fix:** Consider wrapping the masthead to 2 lines below `sm:` breakpoint, or abbreviate the tooltip-bearing count to just `156 / 214` on mobile.

---

## Verified working

- **Four-family band links:** Countries → `/countries` ✓; Signals → `/signals` ✓; Patterns → `/patterns` ✓; Precedents → `/precedents` ✓. All confirmed by `querySelectorAll` href inspection.
- **Featured country card:** Links to `/countries/205` (Somalia) ✓. `aria-label="Risk tier: HIGH"` on badge ✓.
- **Watchlist rows:** All 10 link to `/countries/{numeric-id}` ✓ (checked first 3: `/countries/50`, `/countries/205`, `/countries/121`).
- **"All N high-risk countries →" CTA:** Present, `href="/countries?tier=HIGH"` ✓ (spacing issue noted in P2-2 above).
- **Top Pattern Pair buttons:** 5 present, all with `aria-disabled` absent (all have numeric IDs). Click on "Paraguay→South Korea" button navigated to `/patterns?country_a=172&country_b=208&length=64&start_a=1963&start_b=1962` ✓.
- **"Full ranking →" link:** `href="/patterns/ranking"` ✓ (note: `next.config.ts` 308-redirects `/patterns/ranking` → `/patterns-v1/ranking` — this is intentional per PR-iii comment in the config).
- **Footer methodology link:** `href="/methodology"` ✓.
- **Console errors on load:** 0 errors, 0 warnings on clean load (confirmed with fresh tab, no residual state).
- **E1 fallback rule:** signalsHighCount=1 < 3 → amber, "risk categories at elevated signal levels" ✓. Not showing red "1 firing HIGH".
- **"What this doesn't mean" `<details>`:** Expands/collapses on click ✓. Has `role="note"` + `aria-label="Methodology note"` ✓.
- **Sidebar active state:** Dashboard link highlighted in accent color when on `/dashboard` ✓.
- **Bake date:** Shows 2026-04-30 (not today's date) ✓.
- **Freshness dot:** `aria-label="Data freshness: 15 days ago"` + `role="img"` ✓.
- **ARIA landmarks:** All 6 sections have labels/headings ✓. Skip-to-content link is first focusable element ✓.
- **Tab order:** Logical — Skip to content → Wordmark → Dashboard → Precedents → Countries → Signals → Patterns → band cards → featured card → watchlist rows → pattern pair buttons → footer methodology link. 44 focusable elements total ✓.
- **Mobile layout at 375×667:** Four-family band stacks to single column ✓. Content readable ✓ (masthead clips noted in P2-3).
- **InfoTooltip "i" circles:** 3 present (Tier Distribution, Salience Spread, Top Convergences). `role="button"`, `tabIndex={0}`, `aria-label="More info"` ✓. Hover + click + keyboard wired ✓.
- **Hydration:** 0 React hydration errors on the dashboard itself (the 1 known hydration error is on `/precedents` — date locale mismatch — unrelated to this sweep).
- **Section 3 (four-family band) E1 rule verified:** E1 amber path confirmed rendering correctly.

---

## Key numbers (bake as of 2026-04-30)

- Countries: 156 scored / 214 in scope
- HIGH tier: 66 countries
- MODERATE: 26, INDICATIVE: 64
- Signals: signalsHigh=1 (< 3, E1 fires) → showing 21 elevated (high+moderate)
- Top pattern: Paraguay→South Korea, PPS 2850, 64y, 91% corr
- Precedents: 4 / 13 ML-validated
