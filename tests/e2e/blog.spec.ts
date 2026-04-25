/**
 * Blog index + post regression suite (#433 Article JSON-LD + #439).
 *
 * Verifies:
 *   - /blog renders the post list with proper anchors
 *   - Each post page loads and emits the Article JSON-LD schema
 *     (#433: Google rich-card eligibility)
 *   - The home → /blog → post navigation chain is clickable
 */
import { test, expect } from "@playwright/test";

test.describe("/blog", () => {
  test("blog index lists posts as <a> elements", async ({ page }) => {
    await page.goto("/blog");
    // Each post link is an <a href="/blog/...">.
    const postLinks = page.locator('a[href^="/blog/"]');
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    const first = await postLinks.first().getAttribute("href");
    expect(first).toMatch(/^\/blog\/[a-z0-9-]+$/);
  });

  test("a blog post renders with Article JSON-LD schema", async ({ page }) => {
    await page.goto("/blog");
    const firstPostLink = page
      .locator('a[href^="/blog/"]')
      .filter({ has: page.locator("h2") })
      .first();
    const href = await firstPostLink.getAttribute("href");
    expect(href).toBeTruthy();
    await firstPostLink.click();
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+/);
    // Article schema (added in #433) is embedded as <script type="application/ld+json">.
    const ldJson = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();
    expect(ldJson).toBeTruthy();
    const payload = JSON.parse(ldJson || "{}");
    // The schema may be Article or an array containing Article (the layout
    // also injects Organization at the body root). Accept both shapes.
    const types = Array.isArray(payload)
      ? payload.map((p) => p["@type"])
      : [payload["@type"]];
    expect(types).toContain("Article");
  });
});
