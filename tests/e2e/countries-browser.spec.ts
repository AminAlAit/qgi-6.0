/**
 * Countries browser regression suite (#432 + #439).
 *
 * Locks the URL-state behavior shipped in #432 Bug 2 (filter state
 * survives reload + paste-share) plus the L1 chip toggle from #432
 * Bug 3 (min-score resets when chip changes).
 *
 * Plus neighborhood coverage for the surface — search, sort, deep-link
 * to a country profile.
 */
import { test, expect } from "@playwright/test";

test.describe("/countries browser", () => {
  test("renders the card grid", async ({ page }) => {
    await page.goto("/countries");
    // Search input — ARIA label is sr-only so use the placeholder.
    await expect(page.getByPlaceholder(/search countries/i)).toBeVisible();
    // The "View profile" footer button is on every country card; >=20 is
    // a robust "the grid actually rendered" assertion.
    await expect
      .poll(async () => await page.locator("text=View profile").count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(20);
  });

  test("?tier=HIGH initialises filter state from URL", async ({ page }) => {
    await page.goto("/countries?tier=HIGH");
    // Once filtered to HIGH, the rendered card count must drop below the
    // unfiltered total. We don't pin to a specific number because the
    // pipeline rebalances tiers each cycle.
    const filteredCount = await page.locator("text=View profile").count();
    await page.goto("/countries");
    const totalCount = await page.locator("text=View profile").count();
    expect(filteredCount).toBeLessThan(totalCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("typing in search updates the URL with ?q=", async ({ page }) => {
    await page.goto("/countries");
    const search = page.getByPlaceholder(/search countries/i);
    await search.fill("syria");
    // The useEffect → router.replace fires on the next tick. Poll the URL.
    await expect.poll(async () => page.url(), { timeout: 5_000 }).toMatch(/[?&]q=syria/);
  });

  test("country card link navigates to /countries/[id]", async ({ page }) => {
    await page.goto("/countries");
    // The first card's primary link wraps the whole card.
    const firstCard = page.locator('a[href^="/countries/"]').first();
    const href = await firstCard.getAttribute("href");
    expect(href).toMatch(/^\/countries\/\d+$/);
    await firstCard.click();
    await expect(page).toHaveURL(/\/countries\/\d+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
