import { expect, test } from "@playwright/test";
import {
  buildPageUrl,
  collectScopedLinks,
  installSeriousErrorTracking,
  loadStarterConfig,
  normalizeInternalUrls
} from "./helpers.js";

const starterConfig = await loadStarterConfig();

test.describe("navigation", () => {
  test.skip(!starterConfig.navigation.enabled, "Navigation checks disabled in config");

  for (const routePath of starterConfig.pages) {
    test(`navigation ${routePath}`, async ({ page, request }, testInfo) => {
      const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);
      await page.goto(buildPageUrl(starterConfig.baseUrl, routePath), { waitUntil: "domcontentloaded" });

      if (starterConfig.navigation.requireNavbar) {
        await expect(page.locator(starterConfig.navigation.navbarSelector).first()).toBeVisible();
      }

      if (starterConfig.navigation.requireFooter) {
        await expect(page.locator(starterConfig.navigation.footerSelector).first()).toBeVisible();
      }

      const scopedLinks = await collectScopedLinks(page, starterConfig.navigation.linkScopeSelectors);
      const internalLinks = normalizeInternalUrls(starterConfig.baseUrl, scopedLinks);

      expect(internalLinks.length, `No internal navigation links found on ${routePath}`).toBeGreaterThan(0);

      for (const expectedLink of starterConfig.navigation.expectedLinks) {
        const found = internalLinks.some(({ pathname }) => pathname === expectedLink);
        expect(found, `Expected link ${expectedLink} to be present on ${routePath}`).toBe(true);
      }

      if (starterConfig.navigation.checkBrokenInternalLinks) {
        for (const link of internalLinks) {
          const response = await request.get(link.url);
          expect(
            response.status(),
            `Broken internal link detected on ${routePath}: ${link.pathname}`
          ).toBeLessThan(400);
        }
      }

      expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
    });
  }

  test("whatsapp CTA", async ({ page }, testInfo) => {
    test.skip(!starterConfig.whatsapp.enabled, "WhatsApp checks disabled in config");

    const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);
    await page.goto(buildPageUrl(starterConfig.baseUrl, starterConfig.pages[0]), {
      waitUntil: "domcontentloaded"
    });

    const whatsappLink = page.locator(starterConfig.whatsapp.selector).first();
    await expect(whatsappLink).toBeVisible();

    const href = await whatsappLink.getAttribute("href");

    expect(href, "WhatsApp CTA is missing an href").toBeTruthy();
    expect(
      /^https:\/\/wa\.me\/|^https:\/\/api\.whatsapp\.com\/|^whatsapp:\/\//.test(href),
      `Invalid WhatsApp href: ${href}`
    ).toBe(true);

    expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
  });
});
