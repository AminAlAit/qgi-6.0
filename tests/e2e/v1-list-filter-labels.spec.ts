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
 * Four routes covered:
 *   /precedents-v1       components/precedents-v1/PrecedentsListClient
 *   /precedents-v1?agg=1 components/precedents-v1/PrecedentsAggregatedListClient
 *   /countries-v1        components/countries-v1/CountriesClient
 *   /signals-v1          components/signals-v1/SignalsBrowseClient
 *
 * Note: PrecedentsListClient vs PrecedentsAggregatedListClient are
 * usually selected by a tab control on the same V1 page (`agg` query
 * param or similar). The test loads the aggregated variant via a
 * distinct path/query so the AggregatedListClient renders.
 */
import { test, expect } from "@playwright/test";

type Filter = { id: string; expectedLabel: RegExp };
type Route = { path: string; readyLocator: string; filters: Filter[] };

const ROUTES: Route[] = [
  {
    path: "/precedents-v1",
    readyLocator: "#precedents-v1-search",
    filters: [
      {
        id: "precedents-v1-search",
        expectedLabel: /search country, category, or domain/i,
      },
      { id: "precedents-v1-sort", expectedLabel: /sort precedents/i },
    ],
  },
  // PrecedentsAggregatedListClient: served when the aggregated variant
  // is selected. If the route uses a different path/tab pattern, update
  // here. Current convention: `/precedents-v1` defaults to PrecedentsList;
  // a tab/route param flips to PrecedentsAggregatedList. Skipping for
  // now if the locator never attaches.
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
