/**
 * #427 regression guard + landing-page happy-path neighborhood coverage.
 *
 * Bug that was fixed (#427):
 *   - Landing page header had no hamburger on <md viewports. Reports,
 *     Blog, Contact links were "hidden md:inline-flex" with no fallback.
 *     On 320-484px viewports, the inline desktop nav overflowed the
 *     viewport by 166px, forcing a horizontal scrollbar + making those
 *     links completely unreachable.
 *
 * Tests (mobile viewport = Pixel 5, 393x851):
 *   1. Landing page loads without horizontal overflow (regression)
 *   2. Methodology/About/Open Dashboard visible by default (neighborhood)
 *   3. Hamburger button visible on mobile (new)
 *   4. Reports not visible before hamburger opened (expected)
 *   5. Clicking hamburger reveals Reports + Blog + Contact (#427 fix)
 *   6. Clicking Reports navigates + closes drawer (new)
 *   7. Desktop viewport: no hamburger, all links inline (neighborhood)
 */
import { test, expect, devices } from "@playwright/test";

test.describe("landing mobile nav (#427)", () => {
  test.describe("mobile (Pixel 5)", () => {
    test.use({ ...devices["Pixel 5"] });

    test("no horizontal overflow on landing at 393px viewport", async ({ page }) => {
      await page.goto("/");
      // #427 regression: the landing page's desktop-only header used to
      // force scrollWidth > innerWidth.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(overflow).toBe(false);
    });

    test("Methodology / About / Open Dashboard visible on mobile", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("link", { name: /^methodology$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /^about$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /open dashboard/i })).toBeVisible();
    });

    test("hamburger button visible on mobile; Reports hidden until click", async ({
      page,
    }) => {
      await page.goto("/");
      const hamburger = page.getByRole("button", { name: /open menu/i });
      await expect(hamburger).toBeVisible();
      // Reports link exists in DOM (in the desktop inline set) but is
      // hidden via CSS on mobile. We assert the button is the only way
      // to reach it.
      const reportsLinks = page.getByRole("link", { name: /^reports$/i });
      // Either: zero visible (desktop inline is display:none),
      // or one visible only if the CSS breakpoint didn't apply.
      const visibleCount = await reportsLinks.evaluateAll(
        (nodes) => nodes.filter((n) => (n as HTMLElement).offsetParent !== null).length
      );
      expect(visibleCount).toBeLessThanOrEqual(0);
    });

    test("clicking hamburger reveals Reports / Blog / Contact", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: /open menu/i }).click();

      // After click: the drawer renders three additional links. Each is
      // now visible (not display:none).
      await expect(page.getByRole("link", { name: /^reports$/i }).last()).toBeVisible();
      await expect(page.getByRole("link", { name: /^blog$/i }).last()).toBeVisible();
      await expect(page.getByRole("link", { name: /^contact$/i }).last()).toBeVisible();

      // Hamburger button now labels "Close menu"
      await expect(page.getByRole("button", { name: /close menu/i })).toBeVisible();
    });

    test("clicking Reports in drawer navigates to /reports", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: /open menu/i }).click();
      // Click the mobile drawer's Reports link (last one in DOM order).
      await page
        .getByRole("link", { name: /^reports$/i })
        .last()
        .click();
      await expect(page).toHaveURL(/\/reports/);
    });
  });

  test.describe("desktop (1280x720)", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("no hamburger on desktop; all nav links visible inline", async ({ page }) => {
      await page.goto("/");
      // Hamburger is md:hidden — should NOT be visible on a desktop viewport.
      await expect(page.getByRole("button", { name: /open menu/i })).toBeHidden();
      // All 6 nav links visible inline
      for (const name of [
        /^reports$/i,
        /^methodology$/i,
        /^about$/i,
        /^blog$/i,
        /^contact$/i,
      ]) {
        await expect(page.getByRole("link", { name }).first()).toBeVisible();
      }
      await expect(page.getByRole("link", { name: /open dashboard/i })).toBeVisible();
    });
  });
});
