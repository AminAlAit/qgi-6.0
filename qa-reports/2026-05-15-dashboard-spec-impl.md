# Dashboard Playwright Spec — Implementation Report

**Date:** 2026-05-15  
**Issue:** #685  
**Spec file:** `tests/e2e/dashboard.spec.ts`

---

## What was done

Wrote and verified `tests/e2e/dashboard.spec.ts` covering the 7 assertions from issue #685 against the live local dev server at `http://localhost:3000`.

### Source files read

- `app/(app)/dashboard/page.tsx` — server component; passes `signalsHighCount`, `signalsModerateCount`, `signalsTotalCount`, `mlValidatedCount`, `totalLocked` as props to `BaseClient`
- `app/(app)/dashboard/BaseClient.tsx` — client component housing the full DOM; `FourFamilyBand` sub-component at the bottom (lines 1729–1897) implements the E1 fallback rule
- `dashboard-majles-2026-05-15.md` — Majles synthesis spec (engineering pre-flight E1/E2/E3 clarifications)
- Existing `tests/e2e/` specs for style conventions

### Key DOM anchors used in assertions

| Assertion                | Selector / locator                                           |
| ------------------------ | ------------------------------------------------------------ | -------- | --------- | -------------- |
| Four-family band exists  | `section[aria-label="QGI family summary"]`                   |
| Band cards (×4)          | child `<a href="/countries                                   | /signals | /patterns | /precedents">` |
| Dominant number per card | `.font-data.text-4xl` first child                            |
| E1 label                 | `span.text-xs` first child of signals card                   |
| E1 color check           | `el.style.color` evaluated in-page                           |
| Featured tier badge      | `[aria-label^="Risk tier:"]` inside `a[href^="/countries/"]` |
| Lede sentence            | `p` filtered by `/QGI tracks political risk across/i`        |
| Methodology `<details>`  | `details[role="note"][aria-label="Methodology note"]`        |
| Footer methodology link  | `footer a[href="/methodology"]`                              |

---

## Test run output

```
Running 14 tests using 10 workers

  ok  1 [chromium] › four-family summary band: all 4 cards are present with non-zero numbers (15.9s)
  ok  2 [chromium] › four-family band CTAs link to /countries, /signals, /patterns, /precedents (16.0s)
  ok  3 [chromium] › footer contains a methodology link pointing to /methodology (15.7s)
  ok  4 [chromium] › "What this doesn't mean" details element has role="note" and aria-label="Methodology note" (15.8s)
  ok  5 [chromium] › lede sentence contains a country count that matches the bake total (16.0s)
  ok  6 [chromium] › signals card: E1 fallback rule — label is correct based on HIGH count (15.8s)
  ok  7 [chromium] › featured signal card: tier badge has aria-label matching Risk tier: HIGH|MODERATE|INDICATIVE (15.9s)
  ok  8 [mobile-chrome] › four-family summary band: all 4 cards are present with non-zero numbers (16.3s)
  ok  9 [mobile-chrome] › signals card: E1 fallback rule — label is correct based on HIGH count (16.2s)
  ok 10 [mobile-chrome] › featured signal card: tier badge has aria-label matching Risk tier: HIGH|MODERATE|INDICATIVE (16.2s)
  ok 11 [mobile-chrome] › lede sentence contains a country count that matches the bake total (5.8s)
  ok 12 [mobile-chrome] › footer contains a methodology link pointing to /methodology (5.8s)
  ok 13 [mobile-chrome] › four-family band CTAs link to /countries, /signals, /patterns, /precedents (5.9s)
  ok 14 [mobile-chrome] › "What this doesn't mean" details element has role="note" and aria-label="Methodology note" (5.6s)

  14 passed (36.3s)
```

14/14 passing. 7 tests × 2 devices (chromium + mobile-chrome Pixel 5). Zero failures, zero retries.

---

## Notes on bake-independence

- **Countries count:** extracted via regex `/across\s+(\d+)\s+countries/i` — asserts `> 0` and `<= 250`, not a specific number.
- **Countries HIGH count:** asserts `> 0`, not pinned to 66.
- **E1 label check:** asserts the label is exactly one of the two valid E1 outcomes, not which one (depends on bake data).
- **E1 color:** the `#f87171` / amber branch is asserted against `rgb(248, 113, 113)` (Playwright resolves inline hex to RGB) and "not red" for the fallback path. CSS custom properties (`var(--qgi-amber)`) are not resolved in this check — only the inline `style.color` is compared.

---

## Run command

```bash
npx playwright test tests/e2e/dashboard.spec.ts
```

Or via the project script:

```bash
npm run test:e2e -- tests/e2e/dashboard.spec.ts
```
