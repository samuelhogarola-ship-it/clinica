import { expect, test } from "@playwright/test";
import { buildPageUrl, installSeriousErrorTracking, loadStarterConfig } from "./helpers.js";

const starterConfig = await loadStarterConfig();

for (const routePath of starterConfig.pages) {
  test(`smoke ${routePath}`, async ({ page }, testInfo) => {
    const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);
    const response = await page.goto(buildPageUrl(starterConfig.baseUrl, routePath), {
      waitUntil: starterConfig.smoke.waitUntil
    });

    expect(response, "The page did not return an HTTP response").not.toBeNull();
    expect(response.status(), `Expected ${routePath} to return 200`).toBe(200);

    if (starterConfig.smoke.requireH1) {
      await expect(page.locator(starterConfig.smoke.h1Selector).first()).toBeVisible();
    }

    await expect(page).toHaveTitle(/\S+/);

    if (starterConfig.smoke.requireFooter) {
      await expect(page.locator(starterConfig.smoke.footerSelector).first()).toBeVisible();
    }

    expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
  });
}
