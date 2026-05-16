/**
 * #741 PR-b regression guard (2026-05-17) — WCAG 1.3.1 + 4.1.2 for
 * V1 list-client filter components.
 *
 * Sibling spec to v3-merged-filter-labels.spec.ts (PR-a) and
 * methodology-events.spec.ts (PR #83). Same 4-assertion contract per
 * control:
 *   (a)   control exists (toHaveCount 1)
 *   (a.1) NO aria-label attribute (accname-1.2 §4.3 precedence guard)
 *   (b)   matching <label[for]> exists
 *   (c)   label text matches expected accessible name
 *   (d)   label is in DOM (toBeAttached); visibility intentionally not
 *         asserted — most are sr-only, conditional renders may vary.
 *
 * Three routes covered:
 *   /precedents-v1   components/precedents-v1/PrecedentsAggregatedListClient
 *                    (the only component mounted by app/(app)/precedents-v1/page.tsx;
 *                    PrecedentsListClient is currently orphaned — labels added in
 *                    PR #87 for defense-in-depth if it's ever re-wired, but the
 *                    spec doesn't reach it. Filed as a follow-up to delete or
 *                    re-mount.)
 *   /countries-v1    components/countries-v1/CountriesClient
 *   /signals-v1      components/signals-v1/SignalsBrowseClient
 *
 * #741 PR-b Sonnet review (2026-05-17) caught the misaligned spec target —
 * `/precedents-v1` mounts AggregatedListClient (ids `precedents-v1-agg-*`),
 * NOT PrecedentsListClient (ids `precedents-v1-*`). Updated below.
 */
import { test, expect } from "@playwright/test";

type Filter = { id: string; expectedLabel: RegExp };
type Route = { path: string; readyLocator: string; filters: Filter[] };

const ROUTES: Route[] = [
  {
    path: "/precedents-v1",
    // app/(app)/precedents-v1/page.tsx mounts AggregatedListClient
    // exclusively — its ids are `precedents-v1-agg-*`.
    readyLocator: "#precedents-v1-agg-search",
    filters: [
      {
        id: "precedents-v1-agg-search",
        expectedLabel: /search categories or domains/i,
      },
      { id: "precedents-v1-agg-sort", expectedLabel: /sort precedents/i },
    ],
  },
  {
    path: "/countries-v1",
    readyLocator: "#country-search",
    filters: [
      { id: "country-search", expectedLabel: /search countries/i },
      { id: "country-sort", expectedLabel: /sort countries/i },
    ],
  },
  {
    path: "/signals-v1",
    readyLocator: "#signals-v1-search",
    filters: [
      { id: "signals-v1-search", expectedLabel: /search signals/i },
      { id: "signals-v1-tier", expectedLabel: /filter by tier/i },
      { id: "signals-v1-region", expectedLabel: /filter by region/i },
    ],
  },
];

test.describe("#741 PR-b — V1 list filter labels (WCAG 1.3.1 + 4.1.2)", () => {
  for (const route of ROUTES) {
    test.describe(`route ${route.path}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(route.path);
        await expect(page.locator(route.readyLocator)).toBeAttached();
      });

      for (const { id, expectedLabel } of route.filters) {
        test(`control #${id} has <label> matching ${expectedLabel}`, async ({ page }) => {
          const control = page.locator(`#${id}`);
          await expect(control).toHaveCount(1);
          await expect(control).not.toHaveAttribute("aria-label", /.+/);
          const label = page.locator(`label[for="${id}"]`);
          await expect(label).toHaveCount(1);
          await expect(label).toHaveText(expectedLabel);
          await expect(label).toBeAttached();
        });
      }
    });
  }
});
